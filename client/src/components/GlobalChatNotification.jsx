import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../platforms/auth/AuthContext';
import { X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import API_URL from '../config';
import IncomingCallOverlay from '../platforms/comunicaciones/components/IncomingCallOverlay';

const GlobalChatNotification = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null); // Estado para llamadas entrantes
  const navigate = useNavigate();
  const location = useLocation();
  const esRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (!user?.token) return;

    const canConnectNow = () => document.visibilityState === 'visible' && navigator.onLine;

    const clearReconnect = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const closeCurrent = () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      clearReconnect();
      if (!canConnectNow()) return;
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
      reconnectTimeoutRef.current = setTimeout(() => {
        retryCountRef.current += 1;
        connect();
      }, delay);
    };

    const connect = () => {
      if (!canConnectNow()) return;
      if (esRef.current && (esRef.current.readyState === EventSource.CONNECTING || esRef.current.readyState === EventSource.OPEN)) return;
      clearReconnect();
      if (esRef.current && esRef.current.readyState === EventSource.CLOSED) {
        closeCurrent();
      }
      const token = user.token;
      const url = `${API_URL}/api/comunicaciones/stream/global?token=${token}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        console.log('✅ [EventSource] Conexión global establecida');
        retryCountRef.current = 0;
      };

      es.onerror = () => {
        if (document.visibilityState === 'visible') {
          console.warn('⚠️ [EventSource] Fallo de conexión global. Reintentando...');
        }
        if (esRef.current === es) {
          closeCurrent();
          scheduleReconnect();
        }
      };

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          
          if (parsed.type === 'appeal_resolved') {
            const data = parsed.data;
            console.log('🔔 [SSE Notification] Recibida resolución de apelación:', data);
            
            // Dispatch browser event to reload lists and notify PortalColaborador
            const ev = new CustomEvent('appealResolvedNotif', { detail: data });
            window.dispatchEvent(ev);

            const newNotif = {
               id: data.actividadId || Date.now(),
               isAppeal: true,
               text: data.respuesta ? data.respuesta : `Tu apelación fue ${data.status}`,
               status: data.status,
               senderName: `Apelación ${data.status === 'aprobada' ? 'Aprobada ✓' : 'Rechazada ✗'}`,
               roomName: `Orden de Trabajo #${data.orden}`,
               actividadId: data.actividadId
            };

            setNotifications(prev => {
               if (prev.find(p => p.id === newNotif.id)) return prev;
               return [...prev, newNotif];
            });

            // Sonido premium tipo WhatsApp (estilo pop o campana corta de Mixkit)
            new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3').play().catch(() => {});
            return;
          }

            if (parsed.type === 'new_appeal') {
            const data = parsed.data;
            console.log('🔔 [SSE Notification] Recibida nueva apelación de técnico:', data);
            
            // Dispatch browser event to reload list in ApelacionesPanel
            const ev = new CustomEvent('newAppealNotif', { detail: data });
            window.dispatchEvent(ev);

            // Solo mostrar la notificación si el usuario es un administrador o supervisor
            if (['admin', 'supervisor'].includes(user?.role)) {
              const newNotif = {
                 id: data.actividadId || Date.now(),
                 isNewAppeal: true,
                 text: `${data.tecnicoNombre} ingresó una apelación por la OT ${data.orden}.`,
                 senderName: `Nueva Apelación ⚠️`,
                 roomName: `Orden de Trabajo #${data.orden}`,
                 actividadId: data.actividadId
              };

              setNotifications(prev => {
                 if (prev.find(p => p.id === newNotif.id)) return prev;
                 return [...prev, newNotif];
              });

              new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3').play().catch(() => {});
            }
            return;
          }

          if (parsed.type === 'NEW_MAIL') {
            const data = parsed.data || parsed;
            console.log('🔔 [SSE Notification] Nuevo Correo:', data);
            const ev = new CustomEvent('newMailNotif', { detail: data });
            window.dispatchEvent(ev);
            return;
          }

          if (parsed.type === 'incoming_call') {
            console.log('🔔 [SSE] Llamada Entrante:', parsed.data);
            setIncomingCall(parsed.data);
            return;
          }

          if (parsed.type === 'call_accepted') {
            console.log('🔔 [SSE] Llamada Aceptada:', parsed.data);
            // Dispatch event for Chat360 to know it was accepted
            const ev = new CustomEvent('callAcceptedNotif', { detail: parsed.data });
            window.dispatchEvent(ev);
            return;
          }

          if (parsed.type === 'call_rejected') {
            console.log('🔔 [SSE] Llamada Rechazada:', parsed.data);
            // Dispatch event for Chat360
            const ev = new CustomEvent('callRejectedNotif', { detail: parsed.data });
            window.dispatchEvent(ev);
            return;
          }

          if (parsed.type === 'global_notification') {
            const msg = parsed.data;
            if (msg.senderRef?._id === user._id) return;
            if (window.location.pathname === '/chat') return;
            
            // Dispatch browser event for GlobalChatWidget
            const ev = new CustomEvent('newChatNotif', { detail: { ...msg, roomName: parsed.roomName } });
            window.dispatchEvent(ev);

            const newNotif = {
                id: msg._id || Date.now(),
                text: msg.type === 'video_link' ? '📞 Te invitaron a una videollamada' : msg.text,
                senderName: msg.senderRef?.name || msg.senderName,
                avatar: msg.senderRef?.avatar || msg.avatar,
                roomName: parsed.roomName,
                roomId: msg.roomId,
                isChat: true
            };

            setNotifications(prev => {
                if (prev.find(p => p.id === newNotif.id)) return prev;
                return [...prev, newNotif];
            });

            new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3').play().catch(() => {});
          }
        } catch (e) {
          console.error("Error parsing message:", e);
        }
      };
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearReconnect();
        closeCurrent();
        return;
      }
      retryCountRef.current = 0;
      connect();
    };

    const handleOnline = () => {
      retryCountRef.current = 0;
      connect();
    };

    connect();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    return () => {
      clearReconnect();
      closeCurrent();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [user?.token, user?._id]);

  // Si cambia de ruta a /chat, limpiamos notificaciones
  useEffect(() => {
     if (location.pathname === '/chat') {
         setNotifications([]);
     }
  }, [location.pathname]);

  const handleClose = (id, e) => {
     e.stopPropagation();
     setNotifications(prev => prev.filter(n => n.id !== id));
  };
  
  const handleOpenChat = () => {
     navigate('/chat');
     setNotifications([]);
  };

  const handleAcceptCall = async (roomId, callType) => {
    try {
      await fetch(`${API_URL}/api/comunicaciones/call/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ callerId: incomingCall.caller._id, status: 'accepted', roomId })
      });
      setIncomingCall(null);
      navigate(`/video-call/${roomId}?type=${callType}`);
    } catch (err) {
      console.error('Error accepting call', err);
    }
  };

  const handleRejectCall = async () => {
    try {
      await fetch(`${API_URL}/api/comunicaciones/call/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ callerId: incomingCall.caller._id, status: 'rejected', roomId: incomingCall.roomId })
      });
      setIncomingCall(null);
    } catch (err) {
      console.error('Error rejecting call', err);
    }
  };

  if (notifications.length === 0 && !incomingCall) return null;

  return (
    <>
      {incomingCall && (
        <IncomingCallOverlay
          callData={incomingCall}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end">
      {notifications.map(n => {
        if (n.isAppeal) {
          const isAprobada = n.status === 'aprobada';
          const iconBg = isAprobada ? 'bg-emerald-500 shadow-emerald-200' : 'bg-rose-500 shadow-rose-200';
          
          return (
            <div 
              key={n.id} 
              onClick={(e) => {
                e.stopPropagation();
                // Despachar evento para abrir modal de detalle en PortalColaborador
                const ev = new CustomEvent('openOTById', { detail: n.actividadId });
                window.dispatchEvent(ev);
                // Remover notificación de la pantalla
                setNotifications(prev => prev.filter(item => item.id !== n.id));
              }} 
              className={`bg-white/98 backdrop-blur-md p-4 rounded-3xl shadow-[0_15px_50px_-10px_rgba(15,118,110,0.25)] border-l-4 ${isAprobada ? 'border-l-emerald-500 border-emerald-100' : 'border-l-rose-500 border-rose-100'} border flex flex-col gap-3 cursor-pointer hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 animate-in slide-in-from-bottom-5 w-[350px] relative group overflow-hidden`}
            >
               {/* Efecto Glow de Fondo */}
               <div className={`absolute -right-10 -bottom-10 w-28 h-28 rounded-full ${isAprobada ? 'bg-emerald-50/40' : 'bg-rose-50/40'} blur-2xl group-hover:scale-125 transition-transform duration-500`} />
               
               <div className="flex items-start gap-3.5 relative z-10">
                 <div className={`w-11 h-11 rounded-2xl flex-shrink-0 flex items-center justify-center text-white font-black shadow-lg ${iconBg} transform group-hover:rotate-12 transition-transform duration-300 text-lg`}>
                   {isAprobada ? '✓' : '✗'}
                 </div>
                 
                 <div className="flex flex-col flex-grow min-w-0">
                   <div className="flex items-center gap-1.5">
                     <span className={`w-2 h-2 rounded-full ${isAprobada ? 'bg-emerald-500 animate-ping' : 'bg-rose-500 animate-pulse'}`} />
                     <span className={`text-[9px] font-black uppercase tracking-widest ${isAprobada ? 'text-emerald-600' : 'text-rose-600'}`}>
                       {isAprobada ? 'Apelación Aprobada' : 'Apelación Rechazada'}
                     </span>
                   </div>
                   <span className="text-xs font-black text-slate-800 tracking-tight leading-snug mt-1 truncate">{n.roomName}</span>
                   <p className="text-[11px] text-slate-500 leading-snug mt-1 line-clamp-2 italic bg-slate-50 p-2 rounded-xl border border-slate-100 font-bold">
                     "{n.text}"
                   </p>
                 </div>

                 <button 
                   onClick={(e) => handleClose(n.id, e)} 
                   className="text-slate-300 hover:text-slate-500 rounded-lg p-1.5 transition-colors absolute top-0.5 right-0.5 z-20"
                 >
                    <X size={14} />
                 </button>
               </div>

               {/* Botón Interactivo Ver Detalles */}
               <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-0.5 relative z-10">
                 <span className="text-[9px] font-black uppercase text-indigo-500 group-hover:underline">Haga clic para ver</span>
                 <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 ${isAprobada ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'}`}>
                   Ver Detalles
                 </span>
               </div>
            </div>
          );
        }

        if (n.isNewAppeal) {
          const iconBg = 'bg-amber-500 shadow-amber-200';
          
          return (
            <div 
              key={n.id} 
              onClick={(e) => {
                e.stopPropagation();
                // Navegar al centro de apelaciones
                navigate('/rendimiento/apelaciones');
                // Remover notificación de la pantalla
                setNotifications(prev => prev.filter(item => item.id !== n.id));
              }} 
              className="bg-white/98 backdrop-blur-md p-4 rounded-3xl shadow-[0_15px_50px_-10px_rgba(245,158,11,0.25)] border-l-4 border-l-amber-500 border-amber-100 border flex flex-col gap-3 cursor-pointer hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 animate-in slide-in-from-bottom-5 w-[350px] relative group overflow-hidden"
            >
               {/* Efecto Glow de Fondo */}
               <div className="absolute -right-10 -bottom-10 w-28 h-28 rounded-full bg-amber-50/40 blur-2xl group-hover:scale-125 transition-transform duration-500" />
               
               <div className="flex items-start gap-3.5 relative z-10">
                 <div className={`w-11 h-11 rounded-2xl flex-shrink-0 flex items-center justify-center text-white font-black shadow-lg ${iconBg} transform group-hover:rotate-12 transition-transform duration-300 text-lg`}>
                   ⚠️
                 </div>
                 
                 <div className="flex flex-col flex-grow min-w-0">
                   <div className="flex items-center gap-1.5">
                     <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                     <span className="text-[9px] font-black uppercase tracking-widest text-amber-600">
                       Nueva Apelación Recibida
                     </span>
                   </div>
                   <span className="text-xs font-black text-slate-800 tracking-tight leading-snug mt-1 truncate">{n.roomName}</span>
                   <p className="text-[11px] text-slate-500 leading-snug mt-1 line-clamp-2 italic bg-slate-50 p-2 rounded-xl border border-slate-100 font-bold">
                     "{n.text}"
                   </p>
                 </div>
 
                 <button 
                   onClick={(e) => handleClose(n.id, e)} 
                   className="text-slate-300 hover:text-slate-500 rounded-lg p-1.5 transition-colors absolute top-0.5 right-0.5 z-20"
                 >
                    <X size={14} />
                 </button>
               </div>
 
               {/* Botón Interactivo Ver Detalles */}
               <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-0.5 relative z-10">
                 <span className="text-[9px] font-black uppercase text-amber-500 group-hover:underline">Haga clic para auditar</span>
                 <span className="px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 bg-amber-50 text-amber-700 hover:bg-amber-100">
                   Revisar
                 </span>
               </div>
            </div>
          );
        }

        return (
          <div 
            key={n.id} 
            onClick={handleOpenChat} 
            className="bg-white/95 backdrop-blur-md p-3 pr-8 rounded-2xl shadow-[0_10px_40px_-10px_rgba(79,70,229,0.3)] border border-indigo-100 flex items-center gap-3 cursor-pointer hover:scale-105 transition-all animate-in slide-in-from-bottom-5 duration-300 relative group"
          >
             <div className="relative flex-shrink-0">
               <div className="w-12 h-12 rounded-full overflow-hidden bg-indigo-100 flex items-center justify-center font-black text-indigo-600 shadow-inner">
                 {n.avatar ? <img src={n.avatar} className="w-full h-full object-cover" /> : n.senderName?.charAt(0)}
               </div>
               <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white animate-pulse shadow-sm" />
             </div>
             
             <div className="flex flex-col min-w-[200px] max-w-[250px]">
               <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{n.roomName}</span>
               <span className="text-sm font-bold text-slate-800 leading-tight truncate">{n.senderName}</span>
               <span className="text-xs text-slate-500 truncate mt-0.5">{n.text}</span>
             </div>

             <button 
               onClick={(e) => handleClose(n.id, e)} 
               className="absolute top-2 right-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg p-1.5 transition-colors"
             >
                <X size={14} />
             </button>
          </div>
        );
      })}
    </div>
    </>
  );
};

export default GlobalChatNotification;
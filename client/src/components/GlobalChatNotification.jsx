import React, { useEffect, useState } from 'react';
import { useAuth } from '../platforms/auth/AuthContext';
import { X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import API_URL from '../config';

const GlobalChatNotification = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user) return;
    const token = user.token;
    const url = `${API_URL}/api/comunicaciones/stream/global?token=${token}`;
    const es = new EventSource(url);

    es.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.type === 'global_notification') {
        const msg = parsed.data;
        // Ignorar propios
        if (msg.senderRef?._id === user._id) return;

        // Si el usuario ya está en /chat, tal vez no queremos mostrar el globo, 
        // o quizás sí si está en otra sala. Por simplicidad, lo mostramos 
        // a menos que sea la ruta /chat
        if (window.location.pathname === '/chat') return;
        
        const newNotif = {
           id: msg._id || Date.now(),
           text: msg.type === 'video_link' ? '📞 Te invitaron a una videollamada' : msg.text,
           senderName: msg.senderRef?.name,
           avatar: msg.senderRef?.avatar,
           roomName: parsed.roomName,
           roomId: msg.roomId
        };
        
        setNotifications(prev => {
           if (prev.find(p => p.id === newNotif.id)) return prev;
           return [...prev, newNotif];
        });
        
        try { new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3').play().catch(() => {}); } catch(e){}
      }
    };

    return () => {
       if (es) es.close();
    };
  }, [user]);

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

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end">
      {notifications.map(n => (
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
      ))}
    </div>
  );
};

export default GlobalChatNotification;

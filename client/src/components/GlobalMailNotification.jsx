import React, { useEffect, useState } from 'react';
import { useAuth } from '../platforms/auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Mail, X } from 'lucide-react';

const GlobalMailNotification = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const navigate = useNavigate();

    // Listen to the custom event dispatched by GlobalChatNotification when it receives a global_notification
    // OR we could connect to SSE here. Actually, GlobalChatNotification connects to SSE and receives all events.
    // If GlobalChatNotification receives 'NEW_MAIL', we can dispatch a CustomEvent to window.
    // Let's rely on a CustomEvent 'newMailNotif' that we will dispatch from GlobalChatNotification!

    useEffect(() => {
        const handleNewMail = (e) => {
            const data = e.detail;
            
            // Revisa si tenemos permisos de notificación nativa
            if (Notification.permission === 'granted') {
                const subject = data.newMailDetails?.subject || 'Nuevo correo recibido';
                const from = data.newMailDetails?.fromName || 'GenAI Mail';
                const notif = new Notification(`📧 ${from}`, {
                    body: subject,
                    icon: '/genai-assistant-logo.png', // Opcional
                    tag: 'genai-mail',
                    renotify: true
                });

                notif.onclick = () => {
                    window.focus();
                    navigate('/comunicaciones/correo');
                };
            }

            // Vibración (si el navegador lo soporta)
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
            }

            // Sonido (campana suave y armónica "tinn")
            new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3').play().catch(() => {});

            // Añadir a notificaciones visuales flotantes
            const newNotif = {
                id: Date.now() + Math.random(),
                accountId: data.accountId,
                accountEmail: data.accountEmail || 'Tu correo',
                mailbox: data.mailbox,
                subject: data.newMailDetails?.subject || 'Nuevo correo recibido',
                fromName: data.newMailDetails?.fromName || 'Desconocido',
                fromAddress: data.newMailDetails?.fromAddress || ''
            };

            setNotifications(prev => [...prev, newNotif]);

            // Auto ocultar después de 8 segundos
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
            }, 8000);
        };

        window.addEventListener('newMailNotif', handleNewMail);
        
        // Pedir permisos de notificación al cargar
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }

        return () => window.removeEventListener('newMailNotif', handleNewMail);
    }, [navigate]);

    const handleClose = (id, e) => {
        e.stopPropagation();
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const handleOpenMail = () => {
        navigate('/comunicaciones/correo');
        setNotifications([]);
    };

    if (notifications.length === 0) return null;

    return (
        <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 items-end">
            {notifications.map(n => (
                <div 
                    key={n.id} 
                    onClick={handleOpenMail} 
                    className="bg-white/95 backdrop-blur-md p-4 pr-10 rounded-2xl shadow-[0_15px_40px_-10px_rgba(59,130,246,0.3)] border border-blue-100 flex items-start gap-4 cursor-pointer hover:scale-105 transition-all animate-in slide-in-from-right-10 duration-500 relative group w-[340px] overflow-hidden"
                >
                    {/* Brillo de fondo animado */}
                    <div className="absolute -right-8 -top-8 w-24 h-24 bg-blue-400/20 rounded-full blur-2xl group-hover:bg-blue-400/40 transition-all duration-500"></div>

                    <div className="relative flex-shrink-0 mt-1">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-white shadow-lg transform group-hover:-rotate-12 transition-transform duration-300">
                            <Mail size={22} className="opacity-90" />
                        </div>
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-bounce shadow-sm"></span>
                    </div>
                    
                    <div className="flex flex-col min-w-0 flex-grow">
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest truncate">{n.accountEmail}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-800 leading-tight truncate">{n.fromName}</span>
                        <span className="text-xs font-semibold text-slate-600 truncate mt-0.5">{n.subject}</span>
                        <p className="text-[10px] text-slate-400 truncate mt-1">Haga clic para abrir el Webmail</p>
                    </div>

                    <button 
                        onClick={(e) => handleClose(n.id, e)} 
                        className="absolute top-2 right-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg p-1.5 transition-colors z-10"
                    >
                        <X size={15} strokeWidth={3} />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default GlobalMailNotification;

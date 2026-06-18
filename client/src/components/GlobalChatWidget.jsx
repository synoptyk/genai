import React, { useEffect, useState } from 'react';
import { MessageCircle, X, ChevronUp } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../platforms/auth/AuthContext';

const GlobalChatWidget = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [unreadCount, setUnreadCount] = useState(0);
    const [previews, setPreviews] = useState([]);
    const [isOpen, setIsOpen] = useState(false);

    // No mostrar el widget flotante si ya estamos en la pantalla de chat completa
    const isChatPage = location.pathname.includes('/chat');

    useEffect(() => {
        const handleNewMessage = (e) => {
            const data = e.detail;
            
            // Si el mensaje es mío, no sumar no leído
            if (data?.senderRef?._id === user?._id) return;

            setUnreadCount(prev => prev + 1);

            const newPreview = {
                id: data._id || Date.now(),
                text: data.text,
                sender: data.senderRef?.name || 'Usuario',
                room: data.roomName || 'Chat'
            };

            setPreviews(prev => {
                const updated = [newPreview, ...prev];
                return updated.slice(0, 3); // Mantener solo los 3 últimos
            });
        };

        window.addEventListener('newChatNotif', handleNewMessage);
        return () => window.removeEventListener('newChatNotif', handleNewMessage);
    }, [user]);

    const handleOpenChat = () => {
        setUnreadCount(0);
        setPreviews([]);
        setIsOpen(false);
        navigate('/chat');
    };

    if (isChatPage) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[9998] flex flex-col items-end gap-4">
            
            {/* Popover de vistas previas de mensajes */}
            {isOpen && previews.length > 0 && (
                <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-indigo-100 w-72 overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
                    <div className="bg-indigo-600 px-4 py-3 text-white flex justify-between items-center shadow-md">
                        <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                            <MessageCircle size={16} /> Nuevos Mensajes
                        </h4>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-indigo-500 p-1 rounded-lg transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                    <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
                        {previews.map(p => (
                            <div key={p.id} onClick={handleOpenChat} className="p-3 bg-slate-50 hover:bg-indigo-50 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-indigo-100">
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="text-xs font-black text-slate-800 uppercase truncate">{p.sender}</span>
                                    <span className="text-[9px] font-bold text-slate-400">{p.room}</span>
                                </div>
                                <p className="text-sm text-slate-600 truncate">{p.text}</p>
                            </div>
                        ))}
                    </div>
                    <div className="p-3 bg-slate-50 border-t border-slate-100">
                        <button onClick={handleOpenChat} className="w-full py-2 bg-indigo-100 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-200 transition-colors">
                            Abrir Chat Social 360
                        </button>
                    </div>
                </div>
            )}

            {/* Burbuja Principal */}
            <div className="relative group">
                {/* Ping animation cuando hay no leídos */}
                {unreadCount > 0 && (
                    <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-75"></div>
                )}
                
                <button 
                    onClick={() => unreadCount > 0 ? setIsOpen(!isOpen) : handleOpenChat()}
                    className="relative w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-full shadow-2xl flex items-center justify-center transform group-hover:scale-110 transition-all duration-300 hover:shadow-indigo-500/50"
                >
                    <MessageCircle size={28} className={unreadCount > 0 ? "animate-bounce" : ""} />
                    
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
            </div>
        </div>
    );
};

export default GlobalChatWidget;

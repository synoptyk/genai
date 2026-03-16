```
import React, { useState, useEffect, useRef } from 'react';
import { Send, X, Phone, Video, Loader2, Minimize2, Maximize2, MessageSquare, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { chatApi } from '../comunicacionesApi';
import GlobalChatNotification from '../../../components/GlobalChatNotification';
import { useAuth } from '../../auth/AuthContext';

const ChatInterface = ({ roomId, roomName, allowedRoles = [], onClose }) => {
    const { user, authHeader } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    const messagesEndRef = useRef(null);
    const API_BASE = `${API_URL}/api`;
    const pollInterval = useRef(null);

    // Seguridad: Autodefinir acceso base a UI.
    const isAuthorized = user?.role === 'ceo_genai' || allowedRoles.includes(user?.role);

    useEffect(() => {
        if (!isAuthorized) return;
        fetchMessages();
        // Polling cada 3 segundos
        pollInterval.current = setInterval(fetchMessages, 3000);
        return () => clearInterval(pollInterval.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchMessages = async () => {
        try {
            const { data } = await axios.get(`${API_BASE}/comunicaciones/chat/${roomId}/messages`, {
                headers: authHeader()
            });
            setMessages(data);
            setLoading(false);

            // Marcar leídos
            await axios.post(`${API_BASE}/comunicaciones/chat/read`, { roomId }, { headers: authHeader() });
        } catch (error) {
            console.error("Error Polling Chat:", error);
            if (error.response?.status === 403) {
                clearInterval(pollInterval.current); // Detener polling si bloqueado
            }
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;

        setSending(true);
        try {
            const { data } = await axios.post(`${API_BASE}/comunicaciones/chat/send`, {
                roomId,
                text: newMessage.trim(),
                type: 'text'
            }, { headers: authHeader() });

            setMessages(prev => [...prev, data]);
            setNewMessage('');
            scrollToBottom();
        } catch (error) {
            console.error("Error al enviar", error);
        } finally {
            setSending(false);
        }
    };

    const handleVideoCall = () => {
        // Enviar un mensaje de tipo sistema con enlace a la sala de WebRTC
        const roomLink = `/video-call/${roomId}`;
        axios.post(`${API_BASE}/comunicaciones/chat/send`, {
            roomId,
            text: `📞 Ha iniciado una videollamada. [Unirse Aquí](${roomLink})`,
            type: 'video_link'
        }, { headers: authHeader() });
        // Redirigir o abrir modal de video aquí. (Para proxy v2)
        window.open(roomLink, '_blank', 'width=800,height=600');
    };

    if (!isAuthorized) {
        return (
            <div className="fixed bottom-4 right-4 w-80 bg-white rounded-2xl shadow-2xl border border-red-200 p-6 z-50">
                <div className="flex items-center gap-3 text-red-500 mb-2">
                    <AlertCircle size={20} />
                    <h3 className="font-black text-sm">Acceso Denegado</h3>
                </div>
                <p className="text-xs text-slate-500 mb-4">No tienes permisos para acceder a esta sala de comunicaciones.</p>
                <button onClick={onClose} className="w-full py-2 bg-slate-100 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-200">Cerrar</button>
            </div>
        );
    }

    if (isMinimized) {
        return (
            <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5">
                <button
                    onClick={() => setIsMinimized(false)}
                    className="flex items-center gap-3 px-6 py-4 bg-indigo-600 text-white rounded-[2rem] shadow-xl hover:bg-indigo-700 hover:scale-105 transition-all"
                >
                    <MessageSquare size={20} />
                    <span className="font-black text-sm">{roomName}</span>
                </button>
            </div>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-full max-w-[380px] h-[600px] max-h-[85vh] bg-white rounded-[2rem] shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
            {/* ── HEADER ── */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
                        <MessageSquare size={18} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-black text-sm tracking-wide leading-tight">{roomName}</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sala Segura</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleVideoCall} className="p-2 bg-white/10 hover:bg-white/20 text-indigo-400 hover:text-indigo-300 rounded-xl transition-colors" title="Video Llamada">
                        <Video size={16} />
                    </button>
                    <button onClick={() => setIsMinimized(true)} className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-colors">
                        <Minimize2 size={16} />
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-colors">
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* ── MESSAGES O SERVICIOS ── */}
            <div className="flex-1 bg-slate-50 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <Loader2 size={30} className="animate-spin text-indigo-400" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-6">
                        <div className="w-16 h-16 bg-slate-200 text-slate-400 rounded-3xl flex items-center justify-center mb-4">
                            <MessageSquare size={24} />
                        </div>
                        <p className="text-sm font-black text-slate-700">Comienza la conversación</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Chat Encriptado de Flujo Directo</p>
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        const isMe = msg.senderRef?._id === user?._id;
                        const isSystem = msg.type === 'system' || msg.type === 'video_link';

                        if (isSystem) {
                            return (
                                <div key={msg._id} className="flex justify-center my-4 opacity-80">
                                    <div className="bg-slate-200/60 text-slate-600 px-4 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-center flex items-center gap-2">
                                        {msg.type === 'video_link' ? <Video size={12} /> : <AlertCircle size={12} />}
                                        <span dangerouslySetInnerHTML={{ __html: msg.text.replace(/\[Unirse Aquí\]\((.*?)\)/g, '<a href="$1" target="_blank" class="text-indigo-600 hover:underline">Unirse Aquí</a>') }} />
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex max-w-[85%] gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div className="shrink-0">
                                        {msg.senderRef?.avatar ? (
                                            <img src={msg.senderRef.avatar} alt="A" className="w-8 h-8 rounded-xl object-cover" />
                                        ) : (
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black
                                                ${isMe ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                                                {msg.senderRef?.name?.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-baseline gap-2 mb-1 px-1">
                                            <span className="text-[10px] font-black text-slate-600">{!isMe && msg.senderRef?.name}</span>
                                            <span className="text-[8px] font-bold text-slate-400">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div className={`px-4 py-3 rounded-[1.5rem] text-sm break-words shadow-sm
                                            ${isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white border text-slate-800 border-slate-100 rounded-tl-sm'}`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* ── INPUT PAD ── */}
            <div className="p-4 bg-white border-t border-slate-100">
                <form onSubmit={handleSend} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Escribe tu mensaje..."
                        className="flex-1 bg-slate-50 border border-slate-200 px-5 py-4 rounded-2xl text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="bg-indigo-600 text-white p-4 rounded-2xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-200"
                    >
                        {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatInterface;

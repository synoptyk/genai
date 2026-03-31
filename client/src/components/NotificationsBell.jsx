import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, BellOff, ExternalLink, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../platforms/auth/AuthContext';

const NotificationsBell = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [vibrating, setVibrating] = useState(false);
    const menuRef = useRef(null);

    const API_URL = process.env.REACT_APP_API_URL || '';

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000); // Poll every minute
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchNotifications = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const res = await axios.get(`${API_URL}/api/notifications`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const newNotifications = res.data;
            
            // Check if there's a NEW unread notification to trigger "vibration"
            const newUnreadCount = newNotifications.filter(n => !n.read).length;
            if (newUnreadCount > unreadCount) {
                setVibrating(true);
                setTimeout(() => setVibrating(false), 2000);
            }
            
            setNotifications(newNotifications);
            setUnreadCount(newUnreadCount);
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    };

    const markAsRead = async (id) => {
        try {
            const token = localStorage.getItem('token');
            await axios.patch(`${API_URL}/api/notifications/${id}/read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(notifications.map(n => n._id === id ? { ...n, read: true } : n));
            setUnreadCount(Math.max(0, unreadCount - 1));
        } catch (err) {
            console.error('Error marking as read:', err);
        }
    };

    const markAllAsRead = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.patch(`${API_URL}/api/notifications/read-all`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(notifications.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2 rounded-xl transition-all relative group ${
                    vibrating ? 'animate-bounce bg-rose-50' : 'hover:bg-slate-100'
                }`}
            >
                <Bell size={20} className={`${isOpen ? 'text-indigo-600' : 'text-slate-500'} group-hover:text-indigo-600`} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white border-2 border-white shadow-sm animate-pulse">
                        {unreadCount > 9 ? '+9' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden z-[100] animate-in slide-in-from-top-2 duration-300">
                    <div className="p-5 border-b border-slate-50 bg-slate-50 flex items-center justify-between">
                        <div>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Notificaciones</h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">Centro de Alertas RRHH</p>
                        </div>
                        {unreadCount > 0 && (
                            <button 
                                onClick={markAllAsRead}
                                className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg hover:bg-indigo-100 transition-all uppercase"
                            >
                                Leer todo
                            </button>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                        {notifications.length > 0 ? (
                            notifications.map((n) => (
                                <div 
                                    key={n._id} 
                                    className={`p-4 border-b border-slate-50 flex gap-4 transition-all hover:bg-slate-50 group ${!n.read ? 'bg-indigo-50/20 shadow-inner' : ''}`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                        n.type === 'approval' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                        <Check size={14} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className={`text-[11px] font-black uppercase truncate ${!n.read ? 'text-slate-900' : 'text-slate-500'}`}>
                                                {n.title}
                                            </p>
                                            <span className="text-[8px] font-bold text-slate-300 whitespace-nowrap">
                                                {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-600 font-bold mt-1 line-clamp-2 leading-relaxed">
                                            {n.message}
                                        </p>
                                        <div className="flex items-center gap-3 mt-2">
                                            {n.link && (
                                                <a 
                                                    href={n.link}
                                                    className="text-[9px] font-black text-indigo-600 hover:underline flex items-center gap-1 uppercase"
                                                    onClick={() => markAsRead(n._id)}
                                                >
                                                    Gestionar <ExternalLink size={10} />
                                                </a>
                                            )}
                                            {!n.read && (
                                                <button 
                                                    onClick={() => markAsRead(n._id)}
                                                    className="text-[9px] font-black text-slate-400 hover:text-indigo-600 uppercase"
                                                >
                                                    Marcar leída
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                                <div className="bg-slate-50 p-4 rounded-full mb-4">
                                    <BellOff size={32} className="text-slate-300" />
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin notificaciones</p>
                                <p className="text-[9px] text-slate-300 font-bold mt-2">Todo está al día en tu centro de mando.</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="p-3 bg-slate-50 text-center">
                         <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">Ecosistema Corporativo · 2026</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationsBell;

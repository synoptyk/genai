import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, HeadphonesIcon, Users, Building, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import ChatInterface from './ChatInterface';

const GlobalChatLauncher = () => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [activeRoom, setActiveRoom] = useState(null);
    const dropdownRef = useRef(null);

    // Cerrar al clickear afuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!user) return null;

    // Calcular salas permitidas según el rol del usuario
    const empRef = user.empresaRef?._id || user.empresaRef;

    const availableRooms = [
        // 1. Soporte Global (Todos)
        {
            id: 'soporte_genai',
            name: 'Soporte GenAI Global',
            icon: <HeadphonesIcon size={16} />,
            color: 'bg-emerald-100 text-emerald-700',
            allowed: true, // todos
            roles: ['ceo_genai', 'ceo', 'admin', 'administrativo', 'supervisor_hse', 'user']
        },
        // 2. Gerencia ↔ Administrativos
        {
            id: `${empRef}_admin_gerencia`,
            name: 'Canal Jefatura y Admins',
            icon: <Building size={16} />,
            color: 'bg-indigo-100 text-indigo-700',
            allowed: ['ceo', 'admin', 'administrativo', 'ceo_genai'].includes(user.role),
            roles: ['ceo', 'admin', 'administrativo', 'ceo_genai']
        },
        // 3. Supervisores ↔ Administrativos
        {
            id: `${empRef}_admin_supervisor`,
            name: 'Coordinación Terreno/Oficina',
            icon: <ShieldAlert size={16} />,
            color: 'bg-amber-100 text-amber-700',
            allowed: ['admin', 'administrativo', 'supervisor_hse', 'ceo', 'ceo_genai'].includes(user.role),
            roles: ['admin', 'administrativo', 'supervisor_hse', 'ceo', 'ceo_genai']
        },
        // 4. Supervisores ↔ Técnicos
        {
            id: `${empRef}_supervisor_tecnico`,
            name: 'Canal Operativo (Técnicos)',
            icon: <Users size={16} />,
            color: 'bg-sky-100 text-sky-700',
            allowed: ['admin', 'supervisor_hse', 'user', 'ceo', 'ceo_genai'].includes(user.role),
            roles: ['admin', 'supervisor_hse', 'user', 'ceo', 'ceo_genai']
        }
    ].filter(r => r.allowed);

    return (
        <div className="fixed bottom-6 right-6 z-[100]" ref={dropdownRef}>
            {/* Lanzador (Oculto si hay sala activa) */}
            {!activeRoom && (
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 
                        ${isOpen ? 'bg-indigo-800 text-white shadow-xl scale-95' : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-110 shadow-[0_0_20px_rgba(79,70,229,0.5)] hover:shadow-[0_0_30px_rgba(79,70,229,0.8)]'}`}
                    title="Mensajería Interna"
                >
                    {/* Efectos Flotantes y Vibración */}
                    {!isOpen && (
                        <>
                            <span className="absolute inline-flex h-full w-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] rounded-full bg-indigo-400 opacity-60"></span>
                        </>
                    )}

                    {isOpen ? <X size={28} className="relative z-10" /> : <MessageCircle size={32} className="relative z-10" />}

                    {/* Alerta de Nuevos Mensajes */}
                    {!isOpen && (
                        <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 border-2 border-white rounded-full animate-pulse z-20 shadow-md"></span>
                    )}
                </button>
            )}

            {/* Dropdown Salas */}
            {isOpen && !activeRoom && (
                <div className="absolute bottom-20 right-0 w-80 bg-white border border-slate-200 shadow-2xl rounded-[1.5rem] overflow-hidden z-[110] animate-in slide-in-from-bottom-5 zoom-in-95 duration-300">
                    <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                        <div>
                            <h3 className="font-black text-sm tracking-wide">Comunicaciones</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Salas Segmentadas</p>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white p-1 bg-white/10 rounded-lg">
                            <X size={14} />
                        </button>
                    </div>

                    <div className="p-3 max-h-[60vh] overflow-y-auto">
                        {availableRooms.length === 0 ? (
                            <p className="text-xs text-slate-500 font-bold text-center py-4">No tienes canales asignados.</p>
                        ) : (
                            <div className="space-y-2">
                                {availableRooms.map(room => (
                                    <button
                                        key={room.id}
                                        onClick={() => {
                                            setActiveRoom(room);
                                            setIsOpen(false);
                                        }}
                                        className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all text-left"
                                    >
                                        <div className={`p-2.5 rounded-xl shadow-sm ${room.color}`}>
                                            {room.icon}
                                        </div>
                                        <div>
                                            <p className="text-[12px] font-black text-slate-800 leading-tight">{room.name}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ingresar a Sala</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Chat Activo */}
            {activeRoom && (
                <ChatInterface
                    roomId={activeRoom.id}
                    roomName={activeRoom.name}
                    allowedRoles={activeRoom.roles}
                    onClose={() => setActiveRoom(null)}
                />
            )}
        </div>
    );
};

export default GlobalChatLauncher;

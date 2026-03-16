import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Send, Search, Users, MessageSquare, 
    MoreVertical, Paperclip, Smile, Check, 
    CheckCheck, Video, Phone, Bell, 
    User, Briefcase, Building2, MapPin,
    Circle, X, ChevronRight, Hash, HeadphonesIcon, Building, ShieldAlert, Calendar
} from 'lucide-react';
import { chatApi } from '../comunicacionesApi';
import AgendaPanel from './AgendaPanel';

const Chat360 = () => {
    // 1. Estado Global
    const [rooms, setRooms] = useState([]); 
    const [contacts, setContacts] = useState([]);
    const [activeRoom, setActiveRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sidebarTab, setSidebarTab] = useState('chats'); // 'chats' | 'contacts'
    
    // UI Modal New Group
    const [showNewGroupModal, setShowNewGroupModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [foundUsers, setFoundUsers] = useState([]);
    const [selectedMembers, setSelectedMembers] = useState([]);

    // Auth User
    const user = useMemo(() => {
        const stored = localStorage.getItem('genai_user') || sessionStorage.getItem('genai_user');
        return stored ? JSON.parse(stored) : null;
    }, []);

    const messagesEndRef = useRef(null);
    const eventSourceRef = useRef(null);

    // 2. Efectos Iniciales
    const loadRooms = async () => {
        try {
            const res = await chatApi.getRooms();
            setRooms(res.data);
            if (res.data.length > 0 && !activeRoom) {
                setActiveRoom(res.data[0]);
            }
        } catch (e) {
            console.error("Error cargando salas:", e);
        }
    };

    useEffect(() => {
        if (user) {
            loadRooms();
            loadContacts();
        }
    }, [user]);

    const loadContacts = async () => {
        try {
            const res = await chatApi.getContacts();
            setContacts(res.data);
        } catch (e) {
            console.error("Error cargando contactos:", e);
        }
    };

    // Búsqueda de usuarios para nuevo grupo
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (userSearch.length > 2) {
                const res = await chatApi.searchUsers(userSearch);
                setFoundUsers(res.data);
            } else {
                setFoundUsers([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [userSearch]);

    // 3. Streaming (SSE)
    useEffect(() => {
        if (!activeRoom || !user) return;

        if (eventSourceRef.current) eventSourceRef.current.close();

        const fetchHistory = async () => {
            setIsLoading(true);
            try {
                const res = await chatApi.getMessages(activeRoom._id || activeRoom.id);
                setMessages(res.data);
                scrollToBottom();
            } catch (e) { console.error("Error historial:", e); }
            finally { setIsLoading(false); }
        };
        fetchHistory();

        const token = user.token;
        const roomId = activeRoom._id || activeRoom.id;
        const url = `${API_URL}/api/comunicaciones/stream/${roomId}?token=${token}`;
        
        const es = new EventSource(url);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'new_message') {
                setMessages(prev => [...prev, parsed.data]);
                scrollToBottom();
                if (parsed.data.senderRef?._id !== user._id) {
                    new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3').play().catch(() => {});
                }
            }
        };

        return () => { if (es) es.close(); };
    }, [activeRoom, user]);

    const scrollToBottom = () => {
        setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, 100);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputText.trim() || !activeRoom) return;
        try {
            await chatApi.sendMessage({
                roomId: activeRoom._id || activeRoom.id,
                text: inputText,
                type: 'text'
            });
            setInputText('');
        } catch (e) { console.error("Error enviado mensaje:", e); }
    };

    const handleVideoCall = () => {
        if (!activeRoom) return;
        const roomId = activeRoom._id || activeRoom.id;
        const roomLink = `/video-call/${roomId}`;
        chatApi.sendMessage({ roomId, text: `📞 Ha iniciado una videollamada. [Unirse Aquí](${roomLink})`, type: 'video_link' });
        window.open(roomLink, '_blank', 'width=1000,height=800');
    };

    const createGroup = async () => {
        if (!newGroupName.trim() || selectedMembers.length === 0) return;
        try {
            const res = await chatApi.createRoom({
                name: newGroupName,
                members: selectedMembers.map(m => m._id),
                type: 'group'
            });
            setRooms(prev => [res.data, ...prev]);
            setActiveRoom(res.data);
            setShowNewGroupModal(false);
            setNewGroupName('');
            setSelectedMembers([]);
        } catch (e) { console.error("Error creando grupo:", e); }
    };

    const handleSelectPreset = (type) => {
        let filtered = [];
        if (type === 'operativo') {
            filtered = contacts.filter(c => 
                (c.cargo || '').toLowerCase().includes('tecnico') || 
                (c.cargo || '').toLowerCase().includes('supervisor') ||
                (c.role || '').toLowerCase().includes('operativo')
            );
        } else if (type === 'administrativo') {
            filtered = contacts.filter(c => 
                (c.cargo || '').toLowerCase().includes('gerente') || 
                (c.cargo || '').toLowerCase().includes('admin') ||
                (c.cargo || '').toLowerCase().includes('ceo')
            );
        } else if (type === 'todos') {
            filtered = contacts;
        }
        
        // Unir con los ya seleccionados evitando duplicados
        setSelectedMembers(prev => {
            const ids = new Set(prev.map(p => p._id));
            const news = filtered.filter(f => !ids.has(f._id));
            return [...prev, ...news];
        });
    };

    const startDirectChat = async (contact) => {
        // Buscar si ya existe una sala directa con este contacto
        const existing = rooms.find(r => 
            r.type === 'direct' && 
            r.members.includes(contact._id)
        );

        if (existing) {
            setActiveRoom(existing);
            setSidebarTab('chats');
        } else {
            // Crear nueva sala directa
            try {
                const res = await chatApi.createRoom({
                    name: contact.name,
                    members: [contact._id],
                    type: 'direct'
                });
                setRooms(prev => [res.data, ...prev]);
                setActiveRoom(res.data);
                setSidebarTab('chats');
            } catch (e) {
                console.error("Error creando chat directo:", e);
            }
        }
    };

    // UI Helpers
    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex h-screen bg-[#F0F2F5] overflow-hidden antialiased font-sans">
            {/* Sidebar Izquierda: Contactos y Salas */}
            <div className="w-[400px] border-r border-gray-200 bg-white flex flex-col shadow-xl z-10">
                {/* Header Pro */}
                <div className="p-4 bg-[#F0F2F5] flex justify-between items-center border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black shadow-lg">
                            {user?.name?.charAt(0) || <User />}
                        </div>
                        <div>
                            <p className="text-sm font-black text-gray-800 uppercase tracking-tight">{user?.name}</p>
                            <p className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                                <Circle size={6} fill="currentColor" /> EN LÍNEA
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-4 text-gray-500">
                        <MessageSquare 
                            size={20} 
                            className="cursor-pointer hover:text-indigo-600 transition-colors" 
                            title="Nuevo Grupo" 
                            onClick={() => setShowNewGroupModal(true)}
                        />
                        <MoreVertical size={20} className="cursor-pointer hover:text-indigo-600 transition-colors" />
                    </div>
                </div>

                {/* Tabs Sidebar */}
                <div className="flex bg-white border-b border-gray-100">
                    <button 
                        onClick={() => setSidebarTab('chats')}
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'chats' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Chats
                    </button>
                    <button 
                        onClick={() => setSidebarTab('contacts')}
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'contacts' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Directorio
                    </button>
                    <button 
                        onClick={() => setSidebarTab('agenda')}
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'agenda' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Agenda
                    </button>
                </div>

                {/* Buscador */}
                <div className="p-3">
                    <div className="relative group">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                        <input 
                            type="text" 
                            placeholder={sidebarTab === 'chats' ? "Buscar conversación..." : "Buscar contacto..."}
                            className="w-full bg-[#F0F2F5] border-none rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-200 transition-all outline-none font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Contenido Dinámico Sidebar */}
                <div className="flex-1 overflow-y-auto">
                    {sidebarTab === 'agenda' ? (
                       <div className="p-12 text-center text-slate-300">
                           <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                           <p className="text-xs font-black uppercase tracking-widest">Panel de Agenda Activo</p>
                           <p className="text-[10px] font-bold mt-2">Usa el área principal (derecha) para crear y ver tus reuniones programadas.</p>
                       </div>
                    ) : sidebarTab === 'chats' ? (
                        rooms.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase())).map(room => (
                            <div 
                                key={room._id || room.id}
                                onClick={() => setActiveRoom(room)}
                                className={`p-4 flex items-center gap-3 cursor-pointer transition-all border-b border-gray-50 hover:bg-gray-50 ${activeRoom?._id === room._id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''}`}
                            >
                                <div className="relative">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md ${room.type === 'company' ? 'bg-amber-500' : room.type === 'support' ? 'bg-emerald-500' : room.type === 'direct' ? 'bg-gray-400' : 'bg-indigo-500'}`}>
                                        {room.type === 'support' ? <HeadphonesIcon size={24} /> : room.type === 'company' ? <Building2 size={24} /> : room.type === 'direct' ? <User size={24} /> : <Users size={24} />}
                                    </div>
                                    {room.type === 'direct' && (
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline">
                                        <h4 className="text-sm font-black text-gray-800 uppercase truncate tracking-tight">{room.name}</h4>
                                        <span className="text-[10px] text-gray-400 font-bold">{formatTime(room.updatedAt)}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 truncate mt-0.5 font-medium">
                                        {room.lastMessage?.text || room.description || 'Inicia la conversación...'}
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : (
                        contacts.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).map(contact => (
                            <div 
                                key={contact._id}
                                onClick={() => startDirectChat(contact)}
                                className="p-4 flex items-center gap-3 cursor-pointer transition-all border-b border-gray-50 hover:bg-gray-50 active:scale-95"
                            >
                                <div className="relative">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white shadow-md ${contact.isOnline ? 'bg-green-500' : 'bg-slate-300'}`}>
                                        {contact.avatar ? <img src={contact.avatar} className="w-full h-full rounded-2xl object-cover" /> : contact.name.charAt(0)}
                                    </div>
                                    {contact.isOnline && (
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline">
                                        <h4 className="text-sm font-black text-gray-800 uppercase truncate tracking-tight">{contact.name}</h4>
                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${contact.isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                            {contact.isOnline ? 'Conectado' : 'Desconectado'}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase truncate mt-0.5">
                                        {contact.cargo || contact.role} {user?.role === 'ceo_genai' && `• ${contact.empresaRef === user.empresaRef ? 'MI EMPRESA' : 'EXTERNO'}`}
                                    </p>
                                </div>
                                <MessageSquare size={16} className="text-indigo-400" />
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Area Principal Derecha */}
            {sidebarTab === 'agenda' ? (
                <AgendaPanel user={user} contacts={contacts} onOpenVideoCall={(roomId) => window.open(`/video-call/${roomId}`, 'VideoCall', 'width=1000,height=800')} />
            ) : (
                <div className="flex-1 flex flex-col bg-[#E5DDD5] relative">
                {activeRoom ? (
                    <>
                        <div className="p-3 bg-[#F0F2F5] flex justify-between items-center border-l border-gray-200 shadow-sm z-20">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md ${activeRoom.type === 'company' ? 'bg-amber-500' : activeRoom.type === 'support' ? 'bg-emerald-500' : 'bg-indigo-500'}`}>
                                    {activeRoom.type === 'support' ? <HeadphonesIcon size={20} /> : <Users size={20} />}
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-tighter">{activeRoom.name}</h3>
                                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest leading-none">
                                        {activeRoom.type === 'group' ? 'Grupo Personalizado' : activeRoom.type === 'company' ? 'Canal Empresa' : 'Soporte'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-5 text-gray-600">
                                <Video size={20} className="cursor-pointer hover:text-indigo-600 transition-colors" onClick={handleVideoCall} title="Iniciar Videollamada" />
                                <Phone size={18} className="cursor-pointer hover:text-indigo-600 transition-colors" />
                                <MoreVertical size={20} className="cursor-pointer hover:text-indigo-600 transition-colors" />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-opacity-20 bg-[url('https://w0.peakpx.com/wallpaper/701/1001/wallpaper-desktop-whatsapp.jpg')]">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center h-full space-y-3">
                                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                    <p className="text-sm font-black text-indigo-900 uppercase opacity-50 tracking-widest">Sincronizando...</p>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center p-12 bg-white bg-opacity-50 backdrop-blur-md rounded-3xl border border-white mx-12">
                                    <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-4">
                                        <MessageSquare size={40} />
                                    </div>
                                    <h2 className="text-xl font-black text-gray-800 mb-2">¡CHAT VACÍO!</h2>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Inicia la comunicación 360 ahora.</p>
                                </div>
                            ) : (
                                messages.map((msg, i) => {
                                    const isMe = msg.senderRef?._id === user._id;
                                    return (
                                        <div key={msg._id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            {msg.type === 'video_link' ? (
                                                <div className="w-full flex justify-center my-2">
                                                    <div className="bg-white/80 backdrop-blur-sm border border-indigo-200 px-6 py-3 rounded-2xl shadow-sm flex items-center gap-3">
                                                        <Video size={18} className="text-indigo-600 animate-pulse" />
                                                        <div className="text-left">
                                                            <p className="text-[10px] font-black uppercase text-indigo-400">Videollamada</p>
                                                                <span 
                                                                    className="text-xs font-bold text-indigo-700 cursor-pointer hover:underline"
                                                                    onClick={(e) => {
                                                                        if (e.target.tagName === 'A') {
                                                                            e.preventDefault();
                                                                            window.open(e.target.href, 'VideoCall', 'width=1000,height=800');
                                                                        }
                                                                    }}
                                                                    dangerouslySetInnerHTML={{ __html: msg.text.replace(/\[Unirse Aquí\]\((.*?)\)/g, '<a href="$1" class="text-indigo-600 font-black">UNIRSE AHORA</a>') }} 
                                                                />
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className={`max-w-[75%] rounded-2xl p-3 shadow-lg relative group transition-all hover:scale-[1.01] ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}>
                                                    {!isMe && <p className="text-[9px] font-black uppercase text-indigo-600 mb-1">{msg.senderRef?.name}</p>}
                                                    <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                                                    <div className="flex items-center justify-end gap-1 mt-1">
                                                        <span className={`text-[8px] font-bold uppercase ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>{formatTime(msg.createdAt)}</span>
                                                        {isMe && <CheckCheck size={10} className="text-indigo-200" />}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-4 bg-[#F0F2F5] border-t border-gray-200 z-20">
                            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                                <Smile size={24} className="text-gray-500 cursor-pointer" />
                                <Paperclip size={24} className="text-gray-500 cursor-pointer" />
                                <input 
                                    type="text"
                                    placeholder="Escribe tu mensaje aquí..."
                                    className="flex-1 bg-white border-none py-3 px-5 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                />
                                <button type="submit" className="w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-600 text-white shadow-lg"><Send size={20} /></button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-32 h-32 bg-white rounded-[40px] shadow-2xl flex items-center justify-center text-indigo-600 mb-8 animate-pulse">
                            <Building2 size={64} />
                        </div>
                        <h2 className="text-3xl font-black text-indigo-900 uppercase">SOCIAL GENAI 360</h2>
                        <p className="text-sm text-gray-500 font-black uppercase">Selecciona o crea un grupo para comenzar.</p>
                        <button 
                            onClick={() => setShowNewGroupModal(true)}
                            className="mt-8 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all"
                        >
                            Crear Nuevo Grupo
                        </button>
                    </div>
                )}
            </div>
            )}

            {/* Modal Crear Grupo */}
            {showNewGroupModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black tracking-tighter uppercase">Nuevo Grupo</h3>
                                <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Diseña tu comunidad de trabajo</p>
                            </div>
                            <button onClick={() => setShowNewGroupModal(false)} className="p-2 hover:bg-white/10 rounded-xl"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nombre del Grupo</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                                    placeholder="Ej: Equipo Prevención Sede Norte"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                />
                            </div>
                            <div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleSelectPreset('operativo')}
                                        className="flex-1 bg-amber-500/10 text-amber-700 text-[9px] font-black uppercase py-2 rounded-xl border border-amber-200 hover:bg-amber-500 hover:text-white transition-all"
                                    >
                                        💼 Personal Operativo
                                    </button>
                                    <button 
                                        onClick={() => handleSelectPreset('administrativo')}
                                        className="flex-1 bg-blue-500/10 text-blue-700 text-[9px] font-black uppercase py-2 rounded-xl border border-blue-200 hover:bg-blue-500 hover:text-white transition-all"
                                    >
                                        🏢 Personal Administrativo
                                    </button>
                                    <button 
                                        onClick={() => handleSelectPreset('todos')}
                                        className="flex-1 bg-indigo-500/10 text-indigo-700 text-[9px] font-black uppercase py-2 rounded-xl border border-indigo-200 hover:bg-indigo-500 hover:text-white transition-all"
                                    >
                                        ⭐ Toda la Empresa
                                    </button>
                                </div>

                                <div className="relative">
                                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        type="text" 
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                                        placeholder="Buscar por nombre o cargo..."
                                        value={userSearch}
                                        onChange={(e) => setUserSearch(e.target.value)}
                                    />
                                </div>
                                <div className="mt-3 max-h-40 overflow-y-auto space-y-2">
                                    {foundUsers.map(u => (
                                        <div 
                                            key={u._id} 
                                            onClick={() => !selectedMembers.find(m => m._id === u._id) && setSelectedMembers([...selectedMembers, u])}
                                            className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 cursor-pointer transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xs">
                                                    {u.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-slate-700">{u.name}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">{u.cargo}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {user?.role === 'ceo_genai' && u.empresaRef !== user.empresaRef && <span className="text-[8px] bg-red-100 text-red-600 px-1 rounded">EXT</span>}
                                                <ChevronRight size={14} className="text-slate-300" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {selectedMembers.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {selectedMembers.map(m => (
                                        <div key={m._id} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase">
                                            {m.name}
                                            <X size={12} className="cursor-pointer" onClick={() => setSelectedMembers(selectedMembers.filter(sm => sm._id !== m._id))} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-6 bg-slate-50 flex gap-3">
                            <button 
                                onClick={() => setShowNewGroupModal(false)}
                                className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={createGroup}
                                disabled={!newGroupName.trim() || selectedMembers.length === 0}
                                className="flex-[2] bg-indigo-600 text-white rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:shadow-none hover:bg-indigo-700 transition-all"
                            >
                                Crear Comunidad
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chat360;

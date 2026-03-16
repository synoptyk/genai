import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Users, Video, Trash2, X, ChevronRight, Check } from 'lucide-react';
import { reunionesApi } from '../comunicacionesApi';

export default function AgendaPanel({ user, contacts, onOpenVideoCall }) {
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [duration, setDuration] = useState('60');
    const [selectedContacts, setSelectedContacts] = useState([]);

    useEffect(() => {
        loadMeetings();
    }, []);

    const loadMeetings = async () => {
        setLoading(true);
        try {
            const res = await reunionesApi.getAll();
            setMeetings(res.data);
        } catch (e) {
            console.error('Error cargando agenda', e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                title,
                description,
                date,
                startTime,
                duration: Number(duration),
                participants: selectedContacts.map(c => c._id)
            };
            await reunionesApi.create(payload);
            setShowModal(false);
            
            // Reset form
            setTitle('');
            setDescription('');
            setDate('');
            setStartTime('');
            setDuration('60');
            setSelectedContacts([]);

            loadMeetings();
        } catch (e) {
            console.error('Error creando reunión', e);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Seguro que deseas cancelar esta reunión?')) return;
        try {
            await reunionesApi.delete(id);
            setMeetings(prev => prev.filter(m => m._id !== id));
        } catch (e) {
            console.error('Error', e);
        }
    };

    const toggleContact = (c) => {
        setSelectedContacts(prev => prev.find(p => p._id === c._id) ? prev.filter(p => p._id !== c._id) : [...prev, c]);
    };

    return (
        <div className="flex-1 bg-white h-full flex flex-col p-8 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b pb-6 mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Agenda Ejecutiva</h2>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">Reuniones y Videollamadas Programadas</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-indigo-600 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-200"
                >
                    <Plus size={16} /> Agendar Reunión
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64 text-slate-300">
                    <span className="animate-pulse font-black uppercase text-xs tracking-widest">Cargando Agenda...</span>
                </div>
            ) : meetings.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                    <Calendar size={48} className="mb-4 text-indigo-100" />
                    <p className="font-bold text-sm">No tienes reuniones programadas.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {meetings.map(m => {
                        const isOrganizer = String(m.organizerRef._id || m.organizerRef) === String(user._id);
                        return (
                            <div key={m._id} className="border border-slate-100 bg-slate-50 rounded-3xl p-6 shadow-sm hover:shadow-md transition group overflow-hidden relative">
                                {m.status === 'Cancelada' && <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center"><span className="bg-rose-500 text-white font-black px-4 py-2 rounded-xl rotate-[-15deg] uppercase tracking-widest">Cancelada</span></div>}
                                
                                <h3 className="text-lg font-black text-slate-800 uppercase mb-2 truncate">{m.title}</h3>
                                {m.description && <p className="text-xs text-slate-500 mb-4 line-clamp-2">{m.description}</p>}
                                
                                <div className="space-y-2 mb-6">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white p-2.5 rounded-xl shadow-sm border border-slate-100">
                                        <Calendar size={14} className="text-indigo-500" /> 
                                        {new Date(m.date).toLocaleDateString('es-CL')}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white p-2.5 rounded-xl shadow-sm border border-slate-100">
                                        <Clock size={14} className="text-emerald-500" /> 
                                        {m.startTime} ({m.duration} min)
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white p-2.5 rounded-xl shadow-sm border border-slate-100">
                                        <Users size={14} className="text-amber-500" /> 
                                        {m.participants.length} Participantes
                                    </div>
                                </div>

                                <div className="flex gap-3 relative z-20">
                                    <button 
                                        onClick={() => onOpenVideoCall(m.roomId)}
                                        className="flex-1 bg-black text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition shadow flex justify-center items-center gap-2"
                                    >
                                        <Video size={14} /> Ingresar
                                    </button>
                                    {isOrganizer && (
                                        <button 
                                            onClick={() => handleDelete(m._id)}
                                            className="p-3 bg-white text-rose-500 border border-slate-200 rounded-2xl hover:bg-rose-50 hover:border-rose-200 transition"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* CREAR REUNIÓN MODAL */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-[90%] md:w-[600px] max-h-[90vh] overflow-y-auto custom-scrollbar p-8">
                        <div className="flex justify-between items-center border-b pb-4 mb-6">
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Nueva Reunión</h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-xl transition">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-5">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Asunto</label>
                                <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none text-sm font-bold" placeholder="Ej. Presentación Comercial" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Descripción (Opcional)</label>
                                <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none text-sm resize-none" rows="2" placeholder="Temario y apuntes..."></textarea>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Fecha</label>
                                    <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none text-sm font-bold" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Hora Inicio</label>
                                    <input required type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none text-sm font-bold" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Duración (min)</label>
                                    <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none text-sm font-bold appearance-none">
                                        <option value="15">15 Minutos</option>
                                        <option value="30">30 Minutos</option>
                                        <option value="45">45 Minutos</option>
                                        <option value="60">1 Hora</option>
                                        <option value="90">1.5 Horas</option>
                                        <option value="120">2 Horas</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block border-t pt-4 mt-6">Participantes / Invitados</label>
                                <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {(contacts || []).map(contact => {
                                        const isSelected = selectedContacts.find(c => c._id === contact._id);
                                        return (
                                            <div 
                                                key={contact._id} 
                                                onClick={() => toggleContact(contact)}
                                                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer border transition-all ${isSelected ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-100 hover:bg-slate-50'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center font-black text-indigo-500 text-xs">
                                                        {contact.avatar ? <img src={contact.avatar} className="w-full h-full rounded-full" /> : contact.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-800 uppercase leading-none">{contact.name}</p>
                                                        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mt-1">{contact.cargo || contact.role}</p>
                                                    </div>
                                                </div>
                                                {isSelected ? <Check size={16} className="text-indigo-600" /> : <div className="w-4 h-4 rounded-full border border-slate-300" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-indigo-600 text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition mt-4">
                                Programar Reunión
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

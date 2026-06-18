import React, { useState, useEffect } from 'react';
import { Megaphone, Plus, X, Send, AlertTriangle } from 'lucide-react';
import { chatApi } from '../comunicacionesApi';

const ChatAnnouncementPanel = ({ user }) => {
    const [announcements, setAnnouncements] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newPriority, setNewPriority] = useState('normal');
    const [isLoading, setIsLoading] = useState(false);

    // Mismos roles que en backend (isTecnico) para decidir si mostrar botón "Crear"
    const canCreate = !['tecnico', 'operativo'].includes(String(user.role || '').toLowerCase()) && !/(tecnico|t[eé]cnico|operativo|conductor|chofer|maestro|ayudante|guardia|operador)/i.test(String(user.cargo || '').toLowerCase());

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const fetchAnnouncements = async () => {
        try {
            const { data } = await chatApi.getAnnouncements(20);
            setAnnouncements(data);
        } catch (error) {
            console.error("Error fetching announcements:", error);
        }
    };

    const handleCreate = async () => {
        if (!newTitle.trim() || !newContent.trim()) return;
        setIsLoading(true);
        try {
            const { data } = await chatApi.createAnnouncement({
                title: newTitle,
                content: newContent,
                priority: newPriority
            });
            setIsCreating(false);
            setNewTitle('');
            setNewContent('');
            setNewPriority('normal');
            setAnnouncements([data, ...announcements]);
        } catch (error) {
            console.error(error);
            alert('Error al crear comunicado. ' + (error.response?.data?.error || ''));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex-1 bg-[#E5DDD5] relative flex flex-col items-center overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="sticky top-0 w-full max-w-4xl bg-white shadow-sm z-10 p-4 border-b border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-md">
                        <Megaphone size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Comunicados Oficiales</h2>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">Información de la empresa</p>
                    </div>
                </div>
                {canCreate && (
                    <button 
                        onClick={() => setIsCreating(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2 shadow-md shadow-indigo-200"
                    >
                        <Plus size={16} /> Crear Comunicado
                    </button>
                )}
            </div>

            {/* Content Area */}
            <div className="w-full max-w-4xl p-4 md:p-8 space-y-6">
                
                {isCreating && (
                    <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-indigo-50 mb-8 animate-[fadeIn_0.3s_ease-out]">
                        <div className="p-4 bg-indigo-50 flex justify-between items-center border-b border-indigo-100">
                            <h3 className="font-black tracking-tight text-indigo-900 uppercase flex items-center gap-2">
                                <Megaphone size={16}/> Nuevo Comunicado
                            </h3>
                            <button onClick={() => setIsCreating(false)} className="text-indigo-400 hover:text-indigo-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Título Oficial</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-gray-800"
                                    placeholder="Ej: Nuevas directrices operativas Q3"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Nivel de Prioridad</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setNewPriority('normal')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${newPriority === 'normal' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>Normal</button>
                                    <button onClick={() => setNewPriority('alta')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${newPriority === 'alta' ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>Alta</button>
                                    <button onClick={() => setNewPriority('urgente')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${newPriority === 'urgente' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>Urgente</button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Contenido</label>
                                <textarea 
                                    rows={5}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="Escribe el cuerpo del comunicado detalladamente..."
                                    value={newContent}
                                    onChange={(e) => setNewContent(e.target.value)}
                                ></textarea>
                            </div>
                            <div className="flex justify-end pt-2">
                                <button 
                                    onClick={handleCreate}
                                    disabled={isLoading || !newTitle.trim() || !newContent.trim()}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest flex items-center gap-2 shadow-md disabled:opacity-50 transition-all active:scale-95"
                                >
                                    <Send size={18} /> Publicar Comunicado
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Feed */}
                {announcements.length === 0 ? (
                    <div className="bg-white p-12 rounded-3xl shadow-sm text-center border border-gray-100 flex flex-col items-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4">
                            <Megaphone size={32} />
                        </div>
                        <h3 className="text-lg font-black text-gray-800 uppercase">Sin Comunicados</h3>
                        <p className="text-xs text-gray-500 font-bold tracking-widest mt-1">No hay avisos recientes en la empresa.</p>
                    </div>
                ) : (
                    announcements.map((ann, i) => (
                        <div key={ann._id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden transition-all hover:shadow-md animate-[fadeIn_0.5s_ease-out]" style={{ animationDelay: `${i * 0.05}s` }}>
                            {/* Card Header */}
                            <div className={`p-5 flex justify-between items-start border-b border-gray-50 ${ann.priority === 'urgente' ? 'bg-red-50' : ann.priority === 'alta' ? 'bg-orange-50' : ''}`}>
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 shadow-inner flex-shrink-0">
                                        {ann.authorRef?.avatar ? <img src={ann.authorRef.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-indigo-500 flex items-center justify-center text-white font-bold">{ann.authorRef?.name?.charAt(0)}</div>}
                                    </div>
                                    <div>
                                        <h3 className={`text-base font-black uppercase tracking-tighter ${ann.priority === 'urgente' ? 'text-red-700' : ann.priority === 'alta' ? 'text-orange-700' : 'text-gray-800'}`}>
                                            {ann.title}
                                        </h3>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                                            Por {ann.authorRef?.name} • {ann.authorRef?.cargo || ann.authorRef?.role}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-[10px] text-gray-400 font-bold">
                                        {new Date(ann.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {ann.priority !== 'normal' && (
                                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest flex items-center gap-1 ${ann.priority === 'urgente' ? 'bg-red-200 text-red-800' : 'bg-orange-200 text-orange-800'}`}>
                                            <AlertTriangle size={10} /> {ann.priority}
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            {/* Card Body */}
                            <div className="p-5 md:p-6 text-gray-600 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                                {ann.content}
                            </div>
                            
                            {/* Opcional Media */}
                            {ann.mediaUrl && (
                                <div className="w-full bg-gray-50 border-t border-gray-100 p-2">
                                    <img src={ann.mediaUrl} className="max-w-full rounded-2xl mx-auto" />
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
            
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default ChatAnnouncementPanel;

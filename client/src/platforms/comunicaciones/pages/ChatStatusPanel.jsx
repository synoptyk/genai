import React, { useState, useEffect } from 'react';
import { Plus, X, Image as ImageIcon, Send, Clock } from 'lucide-react';
import { chatApi } from '../comunicacionesApi';

const STATUS_COLORS = ['#4f46e5', '#db2777', '#059669', '#d97706', '#7c3aed', '#111827'];

const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} hs`;
    return 'Ayer';
};

const ChatStatusPanel = ({ user }) => {
    const [statuses, setStatuses] = useState([]);
    const [myStatus, setMyStatus] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newStatusText, setNewStatusText] = useState('');
    const [newStatusColor, setNewStatusColor] = useState(STATUS_COLORS[0]);
    const [viewingStatus, setViewingStatus] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchStatuses();
    }, []);

    const fetchStatuses = async () => {
        try {
            const { data } = await chatApi.getStatuses();
            
            // Mi estado
            const mySt = data.filter(s => s.userRef?._id === user._id);
            if (mySt.length > 0) setMyStatus(mySt[0]);

            // Otros estados (Agrupar por usuario en el futuro, por ahora listamos)
            const others = data.filter(s => s.userRef?._id !== user._id);
            setStatuses(others);
        } catch (error) {
            console.error("Error fetching statuses:", error);
        }
    };

    const handleCreateStatus = async () => {
        if (!newStatusText.trim()) return;
        setIsLoading(true);
        try {
            await chatApi.createStatus({
                type: 'text',
                content: newStatusText,
                backgroundColor: newStatusColor
            });
            setIsCreating(false);
            setNewStatusText('');
            fetchStatuses();
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewStatus = async (status) => {
        setViewingStatus(status);
        if (!status.viewers.includes(user._id)) {
            try {
                await chatApi.markStatusViewed(status._id);
            } catch (e) {}
        }
    };

    return (
        <div className="flex-1 flex bg-[#f0f2f5]">
            {/* Lista Izquierda */}
            <div className="w-[350px] border-r border-gray-200 bg-white flex flex-col h-full">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h2 className="font-black text-gray-800 tracking-tighter uppercase">Estados 360</h2>
                    <button 
                        onClick={() => setIsCreating(true)}
                        className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-200"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* Mi Estado */}
                    <div className="p-4 border-b border-gray-100">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => myStatus ? handleViewStatus(myStatus) : setIsCreating(true)}>
                            <div className={`relative w-12 h-12 rounded-full p-[2px] ${myStatus ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                                <div className="w-full h-full rounded-full bg-white flex items-center justify-center font-bold text-gray-600 overflow-hidden">
                                    {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover"/> : user.name.charAt(0)}
                                </div>
                                {!myStatus && <div className="absolute bottom-0 right-0 bg-indigo-500 text-white rounded-full p-0.5 border-2 border-white"><Plus size={12}/></div>}
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-gray-800">Mi estado</h3>
                                <p className="text-xs text-gray-500">{myStatus ? 'Toca para ver' : 'Añade una actualización'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Estados Recientes */}
                    <div className="p-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Recientes</h4>
                        {statuses.map(s => (
                            <div key={s._id} className="flex items-center gap-3 mb-4 cursor-pointer" onClick={() => handleViewStatus(s)}>
                                <div className={`relative w-12 h-12 rounded-full p-[2px] ${s.viewers.includes(user._id) ? 'bg-gray-300' : 'bg-indigo-500'}`}>
                                    <div className="w-full h-full rounded-full bg-white flex items-center justify-center font-bold text-gray-600 overflow-hidden">
                                        {s.userRef?.avatar ? <img src={s.userRef.avatar} className="w-full h-full object-cover"/> : s.userRef?.name?.charAt(0)}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-gray-800">{s.userRef?.name}</h3>
                                    <p className="text-xs text-gray-500">{formatTime(s.createdAt)}</p>
                                </div>
                            </div>
                        ))}
                        {statuses.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-4">No hay estados recientes.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Vista Principal */}
            <div className="flex-1 bg-black relative flex flex-col justify-center items-center">
                {isCreating ? (
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col" style={{ height: '80vh' }}>
                        <div className="p-4 bg-gray-50 flex justify-between items-center border-b border-gray-100">
                            <h3 className="font-black text-gray-800">Crear Estado</h3>
                            <button onClick={() => setIsCreating(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                        </div>
                        <div 
                            className="flex-1 flex items-center justify-center p-8 transition-colors duration-300 relative"
                            style={{ backgroundColor: newStatusColor }}
                        >
                            <textarea
                                value={newStatusText}
                                onChange={(e) => setNewStatusText(e.target.value)}
                                placeholder="Escribe un estado..."
                                className="w-full bg-transparent text-white text-center text-3xl font-bold border-none outline-none resize-none placeholder-white/50"
                                maxLength={150}
                                rows={4}
                            />
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                            <div className="flex gap-2">
                                {STATUS_COLORS.map(color => (
                                    <div 
                                        key={color} 
                                        onClick={() => setNewStatusColor(color)}
                                        className={`w-8 h-8 rounded-full cursor-pointer border-2 ${newStatusColor === color ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                                        style={{ backgroundColor: color }}
                                    ></div>
                                ))}
                            </div>
                            <button 
                                onClick={handleCreateStatus}
                                disabled={isLoading || !newStatusText.trim()}
                                className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50"
                            >
                                <Send size={20} />
                            </button>
                        </div>
                    </div>
                ) : viewingStatus ? (
                    <div className="w-full h-full flex flex-col relative">
                        {/* Progress bar fake */}
                        <div className="absolute top-4 left-4 right-4 flex gap-1 z-10">
                            <div className="h-1 bg-white/50 w-full rounded-full overflow-hidden">
                                <div className="h-full bg-white w-full animate-[progress_5s_linear]"></div>
                            </div>
                        </div>
                        {/* Status Content */}
                        <div className="flex-1 flex items-center justify-center relative" style={{ backgroundColor: viewingStatus.backgroundColor || '#000' }}>
                            <button onClick={() => setViewingStatus(null)} className="absolute top-8 right-8 text-white/50 hover:text-white z-10">
                                <X size={32} />
                            </button>
                            {viewingStatus.type === 'text' ? (
                                <h1 className="text-white text-4xl md:text-5xl font-bold text-center px-8 break-words max-w-4xl">
                                    {viewingStatus.content}
                                </h1>
                            ) : (
                                <img src={viewingStatus.mediaUrl} className="max-w-full max-h-full object-contain" />
                            )}
                            <div className="absolute bottom-8 left-8 text-white/80">
                                <h2 className="text-xl font-bold">{viewingStatus.userRef?.name}</h2>
                                <p className="text-sm opacity-80">{formatTime(viewingStatus.createdAt)}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-white/50">
                        <Clock size={64} className="mb-4 opacity-50" />
                        <h2 className="text-2xl font-black tracking-widest uppercase mb-2">Estados 360</h2>
                        <p className="font-bold">Selecciona un estado a la izquierda para visualizarlo.</p>
                    </div>
                )}
            </div>
            <style jsx>{`
                @keyframes progress {
                    from { width: 0%; }
                    to { width: 100%; }
                }
            `}</style>
        </div>
    );
};

export default ChatStatusPanel;

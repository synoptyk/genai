import React, { useState, useEffect } from 'react';
import { 
    History, 
    ArrowRight, 
    User, 
    Calendar, 
    Package, 
    MapPin, 
    Tag,
    ChevronDown,
    Filter,
    Download
} from 'lucide-react';
import logisticaApi from '../logisticaApi';

const HistorialMovimientos = () => {
    const [movimientos, setMovimientos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState('');

    useEffect(() => {
        fetchMovimientos();
    }, []);

    const fetchMovimientos = async () => {
        try {
            const res = await logisticaApi.get('/movimientos');
            setMovimientos(res.data);
        } catch (error) {
            console.error("Error fetching movements", error);
        } finally {
            setLoading(false);
        }
    };

    const getTipoColor = (tipo) => {
        switch (tipo) {
            case 'ENTRADA': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'SALIDA': return 'bg-rose-50 text-rose-600 border-rose-100';
            case 'TRASPASO': return 'bg-sky-50 text-sky-600 border-sky-100';
            case 'AJUSTE': return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'ASIGNACION': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
            default: return 'bg-slate-50 text-slate-600 border-slate-100';
        }
    };

    const filteredMovs = movimientos.filter(m => 
        m.productoRef?.nombre?.toLowerCase().includes(filtro.toLowerCase()) ||
        m.usuarioRef?.name?.toLowerCase().includes(filtro.toLowerCase()) ||
        m.motivo?.toLowerCase().includes(filtro.toLowerCase()) ||
        m.tipo.toLowerCase().includes(filtro.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <History className="text-indigo-600" /> Historial de Movimientos
                    </h1>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Trazabilidad Transversal 360 de Logística</p>
                </div>
                <div className="flex gap-3">
                    <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-2xl hover:bg-slate-50 transition-all font-bold text-xs flex items-center gap-2">
                        <Download size={16} />
                        Exportar
                    </button>
                    <div className="relative">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Filtrar por producto, usuario o tipo..."
                            value={filtro}
                            onChange={(e) => setFiltro(e.target.value)}
                            className="pl-11 pr-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none w-64 transition-all"
                        />
                    </div>
                </div>
            </header>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha & Hora</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Producto</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cantidad</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Origen / Destino</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsable</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="7" className="px-6 py-8 h-16 bg-slate-50/20"></td>
                                    </tr>
                                ))
                            ) : filteredMovs.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-20 text-center text-slate-400 font-bold uppercase tracking-widest">
                                        No se encontraron movimientos
                                    </td>
                                </tr>
                            ) : filteredMovs.map((mov) => (
                                <tr key={mov._id} className="hover:bg-slate-50/50 transition-all group">
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-black text-slate-800">
                                                {new Date(mov.fecha).toLocaleDateString()}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                                                <Clock size={10} /> {new Date(mov.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter border ${getTipoColor(mov.tipo)}`}>
                                            {mov.tipo}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-black text-slate-800 uppercase">{mov.productoRef?.nombre}</span>
                                            <span className="text-[9px] text-slate-400 font-black tracking-widest">{mov.productoRef?.sku}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-black ${mov.tipo === 'SALIDA' ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {mov.tipo === 'SALIDA' ? '-' : '+'}{mov.cantidad}
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase">unid.</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold uppercase">{mov.almacenOrigen?.nombre || '---'}</span>
                                            </div>
                                            <ArrowRight size={12} className="text-slate-300" />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold uppercase text-slate-800">{mov.almacenDestino?.nombre || '---'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                                                <User size={14} />
                                            </div>
                                            <span className="text-[10px] font-black text-slate-600 uppercase">{mov.usuarioRef?.name || 'Sistema'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="text-[10px] font-bold text-slate-500 line-clamp-1 italic">
                                            "{mov.motivo || 'Sin descripción'}"
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default HistorialMovimientos;

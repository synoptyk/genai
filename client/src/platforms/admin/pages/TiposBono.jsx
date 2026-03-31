import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    Coins, Plus, Search, Loader2, Save, Trash2, 
    AlertCircle, Info, CheckCircle2, Scale, 
    TrendingUp, TrendingDown, RefreshCw, X, Edit3, Settings2,
    LayoutGrid, List, Download, Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { bonosConfigApi } from '../../rrhh/rrhhApi';

const TiposBono = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
    const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL', 'IMPONIBLE', 'NO_IMPONIBLE'
    const [linkFilter, setLinkFilter] = useState('ALL'); // 'ALL', 'LINKED', 'NOT_LINKED'
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editing, setEditing] = useState(null);
    const [alert, setAlert] = useState(null);

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const res = await bonosConfigApi.getAll();
            setItems(res.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editing._id) {
                await bonosConfigApi.update(editing._id, editing);
            } else {
                await bonosConfigApi.create(editing);
            }
            fetchItems();
            setEditing(null);
            showNotify('Configuración guardada exitosamente');
        } catch (err) {
            showNotify(err.response?.data?.error || 'Error al guardar', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSeed = async () => {
        if (!confirm('Esto inyectará el Diccionario Maestro DT 2026. ¿Continuar?')) return;
        setLoading(true);
        try {
            await bonosConfigApi.seedDefaults();
            fetchItems();
            showNotify('Diccionario Maestro sincronizado');
        } catch (e) {
            showNotify('Error al sincronizar catálogo', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Seguro que desea eliminar este concepto legal?')) return;
        try {
            await bonosConfigApi.remove(id);
            fetchItems();
            showNotify('Eliminado correctamente');
        } catch (e) {
            showNotify('No se pudo eliminar', 'error');
        }
    };

    const showNotify = (msg, type = 'success') => {
        setAlert({ msg, type });
        setTimeout(() => setAlert(null), 3000);
    };

    const filtered = useMemo(() => items.filter(i => {
        const matchesSearch = i.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             i.baseLegal?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'ALL' || i.tipo === typeFilter;
        const matchesLink = linkFilter === 'ALL' || (linkFilter === 'LINKED' ? i.esModuloProduccion : !i.esModuloProduccion);
        
        return matchesSearch && matchesType && matchesLink;
    }), [items, searchTerm, typeFilter, linkFilter]);

    const handleExportExcel = () => {
        if (!filtered.length) return;
        const ws = XLSX.utils.json_to_sheet(filtered.map(i => ({
            'CONCEPTO': i.nombre,
            'TIPO': i.tipo === 'IMPONIBLE' ? 'Remuneración' : 'Indemnización',
            'BASE LEGAL': i.baseLegal || '-',
            'CODIGO LRE': i.codigoDT || '-',
            'OBSERVACION DT': i.observacionDT || '-',
            'LIMITE REFERENCIAL': i.limiteReferencial || 0,
            'VINCULO PRODUCCION': i.esModuloProduccion ? 'SI' : 'NO'
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Diccionario Bonos");
        XLSX.writeFile(wb, `Diccionario_Bonos_${new Date().getFullYear()}.xlsx`);
    };

    const imponibleCount = useMemo(() => items.filter(i => i.tipo === 'IMPONIBLE').length, [items]);
    const noImponibleCount = useMemo(() => items.filter(i => i.tipo === 'NO_IMPONIBLE').length, [items]);

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-20 font-sans">
            {alert && (
                <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-4 px-6 py-4 rounded-[2rem] shadow-2xl backdrop-blur-xl border animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-500
                    ${alert.type === 'error' ? 'bg-rose-500/95 text-white' : 'bg-emerald-500/95 text-white border-emerald-400'}`}>
                    <CheckCircle2 size={18} />
                    <span className="text-xs font-black uppercase tracking-wider">{alert.msg}</span>
                </div>
            )}

            <div className="max-w-[1600px] mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-indigo-200 text-white ring-8 ring-indigo-50/50">
                            <Coins size={32} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-none uppercase italic">Diccionario de <span className="text-indigo-600 font-black">Bonos DT 2026</span></h1>
                            <div className="flex items-center gap-4 mt-3">
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm">
                                    <Scale size={12} className="text-indigo-500" />
                                    Normativa Vigente Art. 41-42
                                </p>
                                <span className="h-4 w-px bg-slate-200" />
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                                        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter italic">{imponibleCount} Imponibles</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter italic">{noImponibleCount} No Imponibles</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={handleExportExcel} className="p-4 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:bg-emerald-50 hover:text-emerald-600 transition-all shadow-sm" title="Descargar Catálogo Excel">
                            <Download size={18} />
                        </button>
                        <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm">
                            <button onClick={() => setViewMode('grid')} className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-300 hover:text-slate-600'}`}>
                                <LayoutGrid size={16} />
                            </button>
                            <button onClick={() => setViewMode('list')} className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-300 hover:text-slate-600'}`}>
                                <List size={16} />
                            </button>
                        </div>
                        <button onClick={handleSeed} className="group relative overflow-hidden flex items-center gap-2 px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-[1.5rem] text-[10px] font-black uppercase hover:bg-slate-50 transition-all shadow-sm">
                            <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                            Sincronizar Maestro Legal
                        </button>
                        <button onClick={() => setEditing({ nombre: '', tipo: 'IMPONIBLE', activo: true, esModuloProduccion: false })} className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95">
                            <Plus size={16} /> Agregar Concepto
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm p-3 flex items-center gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Filtra por nombre de bono, base legal o clasificación imponible..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-16 pr-6 py-5 bg-transparent rounded-[2rem] text-sm font-bold text-slate-600 focus:outline-none placeholder:text-slate-300 transition-all"
                                />
                            </div>
                            <div className="flex items-center gap-2 pr-2">
                                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-slate-50 border-none text-[9px] font-black uppercase text-slate-500 rounded-xl px-4 py-3 cursor-pointer outline-none hover:bg-slate-100 transition-all">
                                    <option value="ALL">Clasificación [Toda]</option>
                                    <option value="IMPONIBLE">Imponible</option>
                                    <option value="NO_IMPONIBLE">No Imponible</option>
                                </select>
                                <select value={linkFilter} onChange={e => setLinkFilter(e.target.value)} className="bg-slate-50 border-none text-[9px] font-black uppercase text-slate-500 rounded-xl px-4 py-3 cursor-pointer outline-none hover:bg-slate-100 transition-all">
                                    <option value="ALL">Vínculo [Todos]</option>
                                    <option value="LINKED">Vinculados a Op.</option>
                                    <option value="NOT_LINKED">Sin Vínculo</option>
                                </select>
                            </div>
                        </div>

                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {loading ? (
                                    <div className="col-span-full py-32 text-center bg-white rounded-[4rem] border border-slate-100">
                                        <Loader2 size={40} className="animate-spin text-indigo-200 mx-auto" />
                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-4">Consultando Jurisprudencia Laboral...</p>
                                    </div>
                                ) : filtered.length === 0 ? (
                                    <div className="col-span-full py-32 bg-white rounded-[4rem] border-2 border-dashed border-slate-100 text-center">
                                        <Info size={48} className="text-slate-100 mx-auto mb-4" />
                                        <h3 className="text-xl font-black text-slate-400 uppercase tracking-tight">Concepto No Encontrado</h3>
                                        <p className="text-xs text-slate-300 font-bold mb-6 italic">Ajusta tus filtros o restaura el diccionario</p>
                                        <button onClick={handleSeed} className="px-8 py-3 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase ring-4 ring-indigo-50/50">Restaurar Diccionario</button>
                                    </div>
                                ) : filtered.map(item => (
                                    <div key={item._id} className="group bg-white p-8 rounded-[3.5rem] border border-slate-100 hover:border-indigo-100 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-500 relative overflow-hidden flex flex-col h-full">
                                        <div className="flex items-start justify-between mb-6 relative z-10">
                                            <div className="flex items-center gap-5">
                                                <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-lg ${item.tipo === 'IMPONIBLE' ? 'bg-indigo-600 text-white shadow-indigo-100' : 'bg-emerald-500 text-white shadow-emerald-100'}`}>
                                                    {item.tipo === 'IMPONIBLE' ? <TrendingUp size={24}/> : <TrendingDown size={24}/>}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-lg font-black text-slate-800 leading-tight uppercase tracking-tight italic line-clamp-1">{item.nombre}</h3>
                                                        {item.esModuloProduccion && (
                                                            <div className="bg-indigo-600 text-white p-1 rounded-lg" title="Vinculado a Producción (Cierre de Bonos)"><Settings2 size={10} /></div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${item.tipo === 'IMPONIBLE' ? 'bg-slate-100 text-indigo-600' : 'bg-slate-100 text-emerald-600'}`}>
                                                            {item.tipo === 'IMPONIBLE' ? 'Remuneratorio' : 'Indemnizatorio'}
                                                        </span>
                                                        {item.tipo === 'NO_IMPONIBLE' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => setEditing(item)} className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><Edit3 size={14}/></button>
                                                <button onClick={() => handleDelete(item._id)} className="p-3 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"><Trash2 size={14}/></button>
                                            </div>
                                        </div>

                                        <div className="space-y-4 flex-1">
                                            <div className="flex items-start gap-4 p-5 bg-slate-50/60 rounded-[2rem] border border-slate-100/50">
                                                <div className="mt-1"><Scale size={14} className="text-indigo-400" /></div>
                                                <div>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1 block">Contexto Legal RT</span>
                                                    <p className="text-[11px] font-bold text-slate-600 leading-relaxed italic">{item.baseLegal || 'Sujeto a dictámenes ordinarios de la DT'}</p>
                                                </div>
                                            </div>

                                            <p className="text-[11px] text-slate-400 font-semibold leading-relaxed px-2 border-l-2 border-slate-100 py-1 line-clamp-2">
                                                {item.observacionDT || 'Sin descripción técnica disponible. Consultar Manual de Remuneraciones.'}
                                            </p>
                                        </div>

                                        {item.tipo === 'NO_IMPONIBLE' && item.limiteReferencial > 0 && (
                                            <div className="mt-6 bg-slate-900 p-6 rounded-[2.5rem] relative overflow-hidden group/alert">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full translate-x-10 -translate-y-10 group-hover/alert:bg-indigo-500/20 transition-all duration-700" />
                                                <div className="flex gap-4 relative z-10">
                                                    <div className="bg-amber-500 text-slate-900 p-2 rounded-xl h-fit shadow-lg shadow-amber-500/20"><AlertCircle size={16} /></div>
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">Límite de Auditoría</span>
                                                            <span className="text-xs font-black text-amber-400 tabular-nums font-mono">${item.limiteReferencial.toLocaleString('es-CL')}</span>
                                                        </div>
                                                        <p className="text-[9px] font-bold text-slate-400 leading-normal tracking-wide">
                                                            {item.avisoLegal || 'Evite la reclasificación automática por montos desproporcionados.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            /* LIST VIEW */
                            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50/50 text-[10px] uppercase font-black tracking-widest text-slate-400">
                                            <th className="px-8 py-5">Concepto</th>
                                            <th className="px-6 py-5">Clasificación</th>
                                            <th className="px-6 py-5 text-center">Vínculo</th>
                                            <th className="px-6 py-5">Marco Legal</th>
                                            <th className="px-6 py-5 text-right">Tope Ref.</th>
                                            <th className="px-8 py-5 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filtered.map(item => (
                                            <tr key={item._id} className="hover:bg-slate-50/50 transition-all border-l-4 border-l-transparent hover:border-l-indigo-600 group">
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.tipo === 'IMPONIBLE' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                            {item.tipo === 'IMPONIBLE' ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                                                {item.nombre}
                                                            </p>
                                                            <p className="text-[9px] text-slate-400 font-bold truncate max-w-[200px]">{item.observacionDT}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className={`text-[8px] font-black uppercase px-3 py-1 rounded-full ${item.tipo === 'IMPONIBLE' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                        {item.tipo}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <button 
                                                        onClick={async () => {
                                                            try {
                                                                await bonosConfigApi.update(item._id, { ...item, esModuloProduccion: !item.esModuloProduccion });
                                                                fetchItems();
                                                                showNotify('Vínculo operacional actualizado');
                                                            } catch(e) { showNotify('Error al actualizar vínculo', 'error'); }
                                                        }}
                                                        className={`p-2 rounded-xl border transition-all ${item.esModuloProduccion ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-300 border-slate-100 hover:text-slate-600'}`}
                                                        title={item.esModuloProduccion ? "Vinculado a Producción" : "Sin Vínculo Operacional"}
                                                    >
                                                        <Settings2 size={14}/>
                                                    </button>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <p className="text-[10px] font-bold text-slate-500 italic max-w-[180px] truncate">{item.baseLegal}</p>
                                                </td>
                                                <td className="px-6 py-5 text-right font-mono text-[11px] font-bold text-slate-600">
                                                    {item.limiteReferencial ? `$${item.limiteReferencial.toLocaleString('es-CL')}` : '-'}
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => setEditing(item)} className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><Edit3 size={14}/></button>
                                                        <button onClick={() => handleDelete(item._id)} className="p-3 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"><Trash2 size={14}/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-4">
                        <div className="sticky top-6 space-y-6">
                            <div className="bg-indigo-600 rounded-[3.5rem] p-8 text-white shadow-2xl shadow-indigo-200 overflow-hidden relative">
                                <div className="absolute -right-4 -top-4 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                                <div className="flex items-center gap-3 mb-6 relative z-10">
                                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md"><Info size={20}/></div>
                                    <h4 className="text-xl font-black uppercase tracking-tight italic leading-none">Asistente <br/> <span className="text-indigo-200">Legal Digital</span></h4>
                                </div>
                                <p className="text-xs font-bold text-indigo-100 leading-relaxed mb-8 opacity-90 tracking-wide">
                                    La Dirección del Trabajo (DT) clasifica los bonos según su causa. Los remuneratorios afectan gratificación y leyes sociales.
                                </p>
                                
                                <div className="space-y-4 relative z-10">
                                    {[
                                        { title: 'Art. 41: No Remuneración', desc: 'Movilización, colación, viáticos e indemnizaciones no son imponibles bajo criterio de razonabilidad.' },
                                        { title: 'Art. 42: Concepto Remuneración', desc: 'Todo estipendio que sea contraprestación del servicio es imponible (Comisiones, Bonos de Meta).' },
                                        { title: 'Principio de Primacía', desc: 'Si el nombre del bono no coincide con su fin real, la DT puede reclasificarlo e imponer multas.' }
                                    ].map((l, i) => (
                                        <div key={i} className="p-5 bg-white/5 rounded-[2rem] border border-white/10 hover:bg-white/10 transition-all cursor-default">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300 mb-1">{l.title}</p>
                                            <p className="text-[10px] font-semibold text-white/80 leading-relaxed">{l.desc}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black uppercase opacity-60">Actualización</span>
                                        <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">DT MAYO 2026</span>
                                    </div>
                                    <div className="bg-emerald-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase shadow-lg shadow-emerald-500/20 animate-pulse">Vigente</div>
                                </div>
                            </div>

                            <div className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-sm space-y-4">
                                <h5 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4">
                                    <Settings2 size={14} className="text-indigo-600" />
                                    Acciones de Auditoría
                                </h5>
                                <button className="w-full py-4 bg-slate-50 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 transition-all text-left px-6 shadow-sm">Validar Consistencia de Carga</button>
                                <button className="w-full py-4 bg-slate-50 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 transition-all text-left px-6 shadow-sm">Generar Reporte LRE v.2026</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {editing && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[120] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-500 border border-white/10">
                        <div className="px-10 py-8 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200"><Settings2 size={24}/></div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none uppercase italic">Configurar Concepto</h3>
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2 tracking-tighter italic">Definición de base de cálculo y legalidad fiscal</p>
                                </div>
                            </div>
                            <button onClick={() => setEditing(null)} className="p-3 bg-white border border-slate-200 text-slate-400 rounded-full hover:bg-slate-50 transition-all shadow-sm"><X size={20}/></button>
                        </div>
                        
                        <form onSubmit={handleSave} className="p-10">
                            <div className="grid grid-cols-2 gap-6 mb-8">
                                <div className="col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nombre del Bono / Concepto</label>
                                    <input 
                                        type="text" 
                                        required
                                        value={editing.nombre} 
                                        onChange={e => setEditing({...editing, nombre: e.target.value})}
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all shadow-inner"
                                        placeholder="Ej: Bono Responsabilidad, Asignación Movilización..."
                                    />
                                </div>
                                
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Clasificación Legal</label>
                                    <select 
                                        value={editing.tipo}
                                        onChange={e => setEditing({...editing, tipo: e.target.value})}
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-700 uppercase tracking-tight focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="IMPONIBLE">Imponible (Remuneración)</option>
                                        <option value="NO_IMPONIBLE">No Imponible (Indemnizatorio)</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-3 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl cursor-pointer hover:bg-white transition-all self-end"
                                     onClick={() => setEditing({...editing, esModuloProduccion: !editing.esModuloProduccion})}>
                                    <div className={`w-10 h-6 rounded-full transition-all flex items-center px-1 ${editing.esModuloProduccion ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-all ${editing.esModuloProduccion ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">Vínculo Producción & Calidad</span>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Límite Ref. Mensual ($)</label>
                                    <input 
                                        type="number" 
                                        value={editing.limiteReferencial || ''} 
                                        onChange={e => setEditing({...editing, limiteReferencial: parseInt(e.target.value)})}
                                        disabled={editing.tipo === 'IMPONIBLE'}
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all disabled:opacity-30 tabular-nums shadow-inner"
                                        placeholder="0"
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Base de Cálculo / Referencia DT</label>
                                    <input 
                                        type="text" 
                                        value={editing.baseLegal || ''} 
                                        onChange={e => setEditing({...editing, baseLegal: e.target.value})}
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all shadow-inner"
                                        placeholder="Ej: Art. 41 inc. 2 Código del Trabajo"
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Descripción Técnica / Observación</label>
                                    <textarea 
                                        value={editing.observacionDT}
                                        onChange={e => setEditing({...editing, observacionDT: e.target.value})}
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all min-h-[100px] shadow-inner"
                                        placeholder="Explica el origen legal o justificación fiscal del concepto..."
                                    />
                                </div>
                            </div>

                            <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-3 py-5 bg-indigo-600 text-white rounded-[2rem] text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-2xl shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50">
                                {saving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>}
                                {saving ? 'Sincronizando con Base de Datos...' : 'Guardar en Diccionario Legal'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TiposBono;

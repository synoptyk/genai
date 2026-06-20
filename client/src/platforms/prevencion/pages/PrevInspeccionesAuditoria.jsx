import React, { useState, useEffect, useMemo } from 'react';
import {
    ClipboardList, ShieldCheck, HardHat, CheckCircle2, AlertTriangle,
    Truck, Loader2, FileText
} from 'lucide-react';
import { inspeccionesApi } from '../prevencionApi';
import SlideOverFichaInspeccion from '../components/Inspecciones/SlideOverFichaInspeccion';
import { AlertModal } from '../components/Inspecciones/SharedComponents';

const PrevInspeccionesAuditoria = () => {
    const [loading, setLoading] = useState(false);
    const [inspecciones, setInspecciones] = useState([]);
    const [filterTipo, setFilterTipo] = useState('');
    const [filterEstado, setFilterEstado] = useState('');
    const [searchHistorial, setSearchHistorial] = useState('');
    const [alert, setAlert] = useState(null);

    const [fichaOpen, setFichaOpen] = useState(false);
    const [selectedInspeccion, setSelectedInspeccion] = useState(null);

    const showAlert = (message, type = 'info', onConfirm = null) => {
        setAlert({ message, type, onConfirm });
        if (type !== 'confirm') setTimeout(() => setAlert(null), 4000);
    };

    const fetchInspecciones = async () => {
        setLoading(true);
        try {
            const params = filterTipo ? { tipo: filterTipo } : {};
            const res = await inspeccionesApi.getAll(params);
            setInspecciones(res.data || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        fetchInspecciones();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterTipo]);

    const filteredInspecciones = useMemo(() => {
        const q = searchHistorial.trim().toLowerCase();
        return (inspecciones || []).filter(insp => {
            const estadoOk = filterEstado ? (insp.estado || 'En Revisión') === filterEstado : true;
            if (!estadoOk) return false;
            if (!q) return true;
            const hay = [
                insp.nombreTrabajador,
                insp.rutTrabajador,
                insp.empresa,
                insp.ot,
                insp.tipo,
                insp.creadoPor,
                insp.resultado,
                insp.estado,
                insp.vehicular?.patente
            ].some(v => String(v || '').toLowerCase().includes(q));
            return hay;
        });
    }, [inspecciones, filterEstado, searchHistorial]);

    const historialStats = useMemo(() => {
        const total = filteredInspecciones.length;
        const enRevision = filteredInspecciones.filter(i => (i.estado || 'En Revisión') === 'En Revisión').length;
        const aprobadas = filteredInspecciones.filter(i => i.estado === 'Aprobado').length;
        const conAlerta = filteredInspecciones.filter(i => i.alertaHse).length;
        return { total, enRevision, aprobadas, conAlerta };
    }, [filteredInspecciones]);

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-10 pb-20 w-full overflow-x-hidden relative">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-6">
                    <div className="bg-slate-900 text-white p-4 rounded-[1.5rem] shadow-xl border-2 border-white">
                        <ClipboardList size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">
                            Auditoría de <span className="text-rose-600">Inspecciones</span>
                        </h1>
                        <p className="text-slate-500 text-[10px] font-black mt-1 uppercase tracking-[0.3em]">Revisión y Control HSE</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                {[['Total', historialStats.total], ['En Revisión', historialStats.enRevision], ['Aprobadas', historialStats.aprobadas], ['Alertas HSE', historialStats.conAlerta]].map(([label, value], i) => (
                    <div key={label} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                        <p className={`text-[10px] font-black uppercase tracking-widest ${i === 3 ? 'text-rose-500' : 'text-slate-400'}`}>{label}</p>
                        <p className="text-3xl font-black text-slate-900 mt-2">{value}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 mb-8 flex gap-4">
                <input
                    type="text"
                    placeholder="Buscar por Trabajador, RUT, Empresa, OT, Tipo, Patente..."
                    className="flex-1 px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold uppercase outline-none focus:ring-4 focus:ring-rose-500/10"
                    value={searchHistorial}
                    onChange={e => setSearchHistorial(e.target.value)}
                />
                <select
                    className="px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold uppercase outline-none"
                    value={filterEstado}
                    onChange={e => setFilterEstado(e.target.value)}
                >
                    <option value="">Cualquier Estado</option>
                    <option value="En Revisión">En Revisión</option>
                    <option value="Aprobado">Aprobado</option>
                    <option value="Rechazado">Rechazado</option>
                </select>
            </div>

            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="grid grid-cols-[1fr_2fr] lg:grid-cols-4 lg:gap-8 gap-4 p-6 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <div>Tipo / ID</div>
                    <div>Inspeccionado</div>
                    <div className="hidden lg:block">Empresa / OT</div>
                    <div className="hidden lg:block">Resultado / Estado</div>
                </div>
                <div className="divide-y divide-slate-100">
                    {loading ? (
                        <div className="p-20 text-center flex flex-col items-center gap-4">
                            <Loader2 className="animate-spin text-rose-500" size={32} />
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cargando historial...</span>
                        </div>
                    ) : filteredInspecciones.length > 0 ? filteredInspecciones.map(insp => (
                        <div key={insp._id} className="grid grid-cols-[1fr_2fr] lg:grid-cols-4 lg:gap-8 gap-4 p-6 items-center hover:bg-slate-50 transition-all group">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl flex-shrink-0 ${insp.tipo === 'cumplimiento-prevencion' ? 'bg-rose-100 text-rose-600' : insp.tipo === 'epp' ? 'bg-orange-100 text-orange-500' : 'bg-blue-100 text-blue-600'}`}>
                                    {insp.tipo === 'cumplimiento-prevencion' ? <ShieldCheck size={20} /> : insp.tipo === 'epp' ? <HardHat size={20} /> : <Truck size={20} />}
                                </div>
                                <div>
                                    <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">
                                        {insp.tipo === 'cumplimiento-prevencion' ? 'Cumplimiento' : insp.tipo === 'epp' ? 'Insp. EPP' : 'Vehicular'}
                                    </p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate max-w-[120px]">ID: {insp._id.slice(-6)}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{insp.nombreTrabajador}</p>
                                <p className="text-[9px] font-bold text-slate-500 uppercase mt-1 tracking-widest">
                                    {insp.rutTrabajador} {insp.vehicular?.patente ? ` • PATENTE: ${insp.vehicular.patente}` : ''}
                                </p>
                            </div>
                            <div className="hidden lg:block">
                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight truncate">{insp.empresa}</p>
                                <p className="text-[9px] font-bold text-slate-500 uppercase mt-1 tracking-widest truncate">{insp.ot || 'SIN OT'}</p>
                            </div>
                            <div className="flex items-center gap-4 flex-wrap">
                                <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full ${insp.resultado === 'Conforme' ? 'bg-emerald-100 text-emerald-700' : insp.resultado === 'No Conforme' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {insp.resultado}
                                </span>
                                <span className={`text-[8px] font-black uppercase px-3 py-1.5 rounded-full border ${insp.estado === 'Aprobado' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : insp.estado === 'Rechazado' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                    {insp.estado || 'En Revisión'}
                                </span>
                                {insp.alertaHse && (
                                    <span className="flex items-center gap-1.5 text-[8px] font-black text-rose-500 uppercase bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100">
                                        <AlertTriangle size={10} /> Alerta HSE
                                    </span>
                                )}
                                <div className="flex gap-2 w-full mt-2 lg:w-auto lg:mt-0">
                                    <button
                                        onClick={() => {
                                            setSelectedInspeccion(insp);
                                            setFichaOpen(true);
                                        }}
                                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase hover:bg-rose-600 hover:text-white transition-all flex items-center gap-2"
                                    >
                                        <FileText size={14} /> Ver Ficha
                                    </button>
                                </div>
                                <span className="text-[9px] font-bold text-slate-400 w-full lg:w-auto mt-2 lg:mt-0">
                                    {new Date(insp.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    )) : (
                        <div className="p-44 text-center text-slate-300 font-black uppercase text-xs tracking-widest">Sin inspecciones registradas</div>
                    )}
                </div>
            </div>

            <SlideOverFichaInspeccion 
                isOpen={fichaOpen} 
                onClose={() => setFichaOpen(false)} 
                inspeccion={selectedInspeccion} 
                onStatusChange={() => {
                    fetchInspecciones();
                    showAlert('Estado de inspección actualizado exitosamente', 'success');
                }} 
            />
            
            <AlertModal alert={alert} setAlert={setAlert} />
        </div>
    );
};

export default PrevInspeccionesAuditoria;

import React, { useState, useEffect } from 'react';
import { Plane, Plus, X, CheckCircle2, XCircle, Clock, Loader2, Calendar } from 'lucide-react';
import { candidatosApi, configApi } from '../rrhhApi';

const TIPOS = ['Vacaciones', 'Licencia Médica', 'Permiso Sin Goce', 'Permiso Con Goce'];
const TIPO_COLORS = {
    'Vacaciones': 'bg-cyan-100 text-cyan-700 border-cyan-200',
    'Licencia Médica': 'bg-red-100 text-red-700 border-red-200',
    'Permiso Sin Goce': 'bg-amber-100 text-amber-700 border-amber-200',
    'Permiso Con Goce': 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const VacacionesLicencias = () => {
    const [candidatos, setCandidatos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [selectedCandidato, setSelectedCandidato] = useState('');
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ tipo: 'Vacaciones', fechaInicio: '', fechaFin: '', diasHabiles: 0, estado: 'Pendiente', observaciones: '' });
    const [filterTipo, setFilterTipo] = useState('all');
    const [companyConfig, setCompanyConfig] = useState(null);

    useEffect(() => { fetchCandidatos(); }, []);

    const fetchCandidatos = async () => {
        setLoading(true);
        try {
            const [candRes, configRes] = await Promise.all([
                candidatosApi.getAll({ status: 'Contratado' }),
                configApi.get()
            ]);
            setCandidatos(candRes.data);
            setCompanyConfig(configRes.data);
        }
        catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedCandidato) return alert('Selecciona un colaborador');
        setSaving(true);
        try {
            const isPermiso = form.tipo.includes('Permiso');
            const moduleKey = isPermiso ? 'Permiso' : 'Vacaciones';
            const workflow = companyConfig?.approvalWorkflows?.find(w => w.module === moduleKey);
            const approvers = workflow?.approvers || [];

            const requestData = {
                ...form,
                approvalChain: approvers.map(a => ({
                    ...a,
                    status: 'Pendiente',
                    comment: '',
                    updatedAt: null
                })),
                validationRequested: approvers.length > 0
            };

            await candidatosApi.addVacacion(selectedCandidato, requestData);
            alert(approvers.length > 0 ? 'Solicitud registrada e iniciada cadena de aprobación' : 'Solicitud registrada directamente');
            setShowForm(false);
            setForm({ tipo: 'Vacaciones', fechaInicio: '', fechaFin: '', diasHabiles: 0, estado: 'Pendiente', observaciones: '' });
            fetchCandidatos();
        } catch (e) { alert('Error al registrar'); }
        finally { setSaving(false); }
    };

    const allVacaciones = candidatos.flatMap(c =>
        (c.vacaciones || []).map(v => ({ ...v, colaborador: c }))
    ).sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));

    const filtered = filterTipo === 'all' ? allVacaciones : allVacaciones.filter(v => v.tipo === filterTipo);

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-20">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="bg-cyan-500 text-white p-3 rounded-2xl shadow-lg shadow-cyan-200"><Plane size={24} /></div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800">Vacaciones & <span className="text-cyan-500">Licencias</span></h1>
                        <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-wider">Gestión de permisos y ausencias laborales</p>
                    </div>
                </div>
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-cyan-200 active:scale-95">
                    <Plus size={16} /> Nueva Solicitud
                </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
                {[['Total', allVacaciones.length], ['Pendientes', allVacaciones.filter(v => v.estado === 'Pendiente').length], ['Aprobadas', allVacaciones.filter(v => v.estado === 'Aprobado').length]].map(([label, val]) => (
                    <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
                        <div className="text-3xl font-black text-slate-800">{val}</div>
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">{label}</div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-2">
                <button onClick={() => setFilterTipo('all')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider ${filterTipo === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>Todos</button>
                {TIPOS.map(t => (
                    <button key={t} onClick={() => setFilterTipo(t)} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${filterTipo === t ? TIPO_COLORS[t] + ' border-current' : 'bg-slate-100 text-slate-400 border-transparent'}`}>{t}</button>
                ))}
            </div>

            <div className="space-y-3">
                {loading ? (<div className="flex justify-center py-20"><Loader2 className="animate-spin text-cyan-500" size={32} /></div>)
                    : filtered.length === 0 ? (
                        <div className="py-20 bg-white rounded-2xl border border-slate-200 text-center text-slate-400">
                            <Plane size={48} className="mx-auto opacity-20 mb-4" /><p className="font-bold">No hay solicitudes</p>
                        </div>
                    ) : filtered.map((v, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-5 hover:border-cyan-200 transition-all">
                            <div className={`text-[10px] font-black uppercase border px-3 py-1.5 rounded-full whitespace-nowrap ${TIPO_COLORS[v.tipo]}`}>{v.tipo}</div>
                            <div className="flex-1">
                                <div className="font-black text-slate-800 uppercase text-sm">{v.colaborador.fullName}</div>
                                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                    <Calendar size={12} />
                                    {v.fechaInicio ? new Date(v.fechaInicio + 'T12:00:00').toLocaleDateString() : '?'} → {v.fechaFin ? new Date(v.fechaFin + 'T12:00:00').toLocaleDateString() : '?'}
                                    {v.diasHabiles > 0 && <span className="font-bold">({v.diasHabiles} días hábiles)</span>}
                                </div>
                            </div>
                            <div>
                                {v.estado === 'Aprobado' ? <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-black"><CheckCircle2 size={16} />Aprobado</span>
                                    : v.estado === 'Rechazado' ? <span className="flex items-center gap-1.5 text-red-500 text-xs font-black"><XCircle size={16} />Rechazado</span>
                                        : <span className="flex items-center gap-1.5 text-amber-600 text-xs font-black"><Clock size={16} />Pendiente</span>}
                            </div>
                        </div>
                    ))}
            </div>

            {showForm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">
                        <div className="p-6 bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-between">
                            <h2 className="text-xl font-black text-white uppercase">Nueva Solicitud</h2>
                            <button onClick={() => setShowForm(false)} className="p-2 bg-white/20 rounded-xl text-white"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div><label className="label-rrhh">Colaborador *</label>
                                <select required className="input-rrhh" value={selectedCandidato} onChange={e => setSelectedCandidato(e.target.value)}>
                                    <option value="">— Seleccionar —</option>
                                    {candidatos.map(c => <option key={c._id} value={c._id}>{c.fullName} ({c.rut})</option>)}
                                </select>
                            </div>
                            <div><label className="label-rrhh">Tipo</label>
                                <select className="input-rrhh" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div><label className="label-rrhh">Inicio</label><input required type="date" className="input-rrhh" value={form.fechaInicio} onChange={e => setForm({ ...form, fechaInicio: e.target.value })} /></div>
                                <div><label className="label-rrhh">Fin</label><input required type="date" className="input-rrhh" value={form.fechaFin} onChange={e => setForm({ ...form, fechaFin: e.target.value })} /></div>
                                <div><label className="label-rrhh">Días Háb.</label><input type="number" min="0" className="input-rrhh" value={form.diasHabiles} onChange={e => setForm({ ...form, diasHabiles: parseInt(e.target.value) })} /></div>
                            </div>
                            <div><label className="label-rrhh">Estado</label>
                                <select className="input-rrhh" value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
                                    {['Pendiente', 'Aprobado', 'Rechazado'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div><label className="label-rrhh">Observaciones</label>
                                <textarea className="input-rrhh h-20 resize-none" value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 border-2 border-slate-200 text-slate-600 rounded-2xl font-bold">Cancelar</button>
                                <button type="submit" disabled={saving} className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-2xl font-black shadow-lg disabled:opacity-50">
                                    {saving ? '...' : 'Registrar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VacacionesLicencias;

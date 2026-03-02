import React, { useState, useEffect } from 'react';
import { Fingerprint, Users, CheckCircle2, XCircle, Clock, Loader2, Plus } from 'lucide-react';
import { asistenciaApi, candidatosApi, turnosApi } from '../rrhhApi';

const ESTADOS = ['Presente', 'Ausente', 'Tardanza', 'Licencia', 'Permiso', 'Feriado'];
const ESTADO_COLORS = {
    'Presente': 'bg-emerald-100 text-emerald-700',
    'Ausente': 'bg-red-100 text-red-700',
    'Tardanza': 'bg-amber-100 text-amber-700',
    'Licencia': 'bg-blue-100 text-blue-700',
    'Permiso': 'bg-purple-100 text-purple-700',
    'Feriado': 'bg-slate-100 text-slate-500',
};

const ControlAsistencia = () => {
    const [registros, setRegistros] = useState([]);
    const [colaboradores, setColaboradores] = useState([]);
    const [turnos, setTurnos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fecha, setFecha] = useState(new Date().toISOString().substring(0, 10));
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ candidatoId: '', turnoId: '', horaEntrada: '', horaSalida: '', estado: 'Presente', observacion: '' });
    const [saving, setSaving] = useState(false);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchAll(); }, [fecha]);
    useEffect(() => { fetchColTurnos(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        try { const res = await asistenciaApi.getAll({ fecha }); setRegistros(res.data); }
        catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchColTurnos = async () => {
        try {
            const [colRes, turRes] = await Promise.all([candidatosApi.getAll({ status: 'Contratado' }), turnosApi.getAll()]);
            setColaboradores(colRes.data);
            setTurnos(turRes.data);
        } catch (e) { console.error(e); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await asistenciaApi.create({ ...form, fecha });
            setShowForm(false);
            setForm({ candidatoId: '', turnoId: '', horaEntrada: '', horaSalida: '', estado: 'Presente', observacion: '' });
            fetchAll();
        } catch (e) { alert('Error al registrar'); }
        finally { setSaving(false); }
    };

    const stats = {
        total: registros.length,
        presentes: registros.filter(r => r.estado === 'Presente').length,
        ausentes: registros.filter(r => r.estado === 'Ausente').length,
        tardanzas: registros.filter(r => r.estado === 'Tardanza').length,
    };

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-20">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-200"><Fingerprint size={24} /></div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800">Control de <span className="text-indigo-600">Asistencia</span></h1>
                        <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-wider">Registro diario de asistencia del personal</p>
                    </div>
                </div>
                <div className="flex gap-3 items-center">
                    <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                        className="px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/30" />
                    <button onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-indigo-200 active:scale-95">
                        <Plus size={16} /> Registrar
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total', value: stats.total, icon: Users, color: 'slate' },
                    { label: 'Presentes', value: stats.presentes, icon: CheckCircle2, color: 'emerald' },
                    { label: 'Ausentes', value: stats.ausentes, icon: XCircle, color: 'red' },
                    { label: 'Tardanzas', value: stats.tardanzas, icon: Clock, color: 'amber' },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-5">
                        <div className={`text-${s.color}-500 mb-2`}><s.icon size={20} /></div>
                        <div className="text-3xl font-black text-slate-800">{s.value}</div>
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="font-black text-slate-700">Registros del {new Date(fecha + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                </div>
                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
                ) : registros.length === 0 ? (
                    <div className="py-20 text-center text-slate-400">
                        <Fingerprint size={48} className="mx-auto opacity-20 mb-4" />
                        <p className="font-bold">No hay registros para esta fecha</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    {['Colaborador', 'Turno', 'Entrada', 'Salida', 'Estado', 'Observación'].map(h => (
                                        <th key={h} className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {registros.map(r => (
                                    <tr key={r._id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 font-black text-sm flex items-center justify-center">
                                                    {r.candidatoId?.fullName?.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <div className="font-black text-sm text-slate-800 uppercase">{r.candidatoId?.fullName || '—'}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">{r.candidatoId?.rut}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-slate-600">{r.turnoId?.nombre || '—'}</td>
                                        <td className="px-6 py-4 text-xs font-mono font-bold text-slate-700">{r.horaEntrada || '—'}</td>
                                        <td className="px-6 py-4 text-xs font-mono font-bold text-slate-700">{r.horaSalida || '—'}</td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-full ${ESTADO_COLORS[r.estado]}`}>{r.estado}</span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-500">{r.observacion || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">
                        <div className="p-6 bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-between">
                            <h2 className="text-xl font-black text-white uppercase">Registrar Asistencia</h2>
                            <button onClick={() => setShowForm(false)} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white"><Fingerprint size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div><label className="label-rrhh">Colaborador *</label>
                                <select required className="input-rrhh" value={form.candidatoId} onChange={e => setForm({ ...form, candidatoId: e.target.value })}>
                                    <option value="">— Seleccionar colaborador —</option>
                                    {colaboradores.map(c => <option key={c._id} value={c._id}>{c.fullName} ({c.rut})</option>)}
                                </select>
                            </div>
                            <div><label className="label-rrhh">Turno</label>
                                <select className="input-rrhh" value={form.turnoId} onChange={e => setForm({ ...form, turnoId: e.target.value })}>
                                    <option value="">— Sin turno —</option>
                                    {turnos.map(t => <option key={t._id} value={t._id}>{t.nombre} ({t.horaEntrada}-{t.horaSalida})</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="label-rrhh">Hora Entrada</label><input type="time" className="input-rrhh" value={form.horaEntrada} onChange={e => setForm({ ...form, horaEntrada: e.target.value })} /></div>
                                <div><label className="label-rrhh">Hora Salida</label><input type="time" className="input-rrhh" value={form.horaSalida} onChange={e => setForm({ ...form, horaSalida: e.target.value })} /></div>
                            </div>
                            <div><label className="label-rrhh">Estado</label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {ESTADOS.map(e => (
                                        <button key={e} type="button" onClick={() => setForm({ ...form, estado: e })}
                                            className={`px-3 py-2 rounded-xl text-xs font-black uppercase transition-all ${form.estado === e ? ESTADO_COLORS[e] + ' ring-2 ring-current' : 'bg-slate-100 text-slate-400'}`}>
                                            {e}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div><label className="label-rrhh">Observación</label>
                                <input className="input-rrhh" placeholder="Opcional..." value={form.observacion} onChange={e => setForm({ ...form, observacion: e.target.value })} />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 border-2 border-slate-200 text-slate-600 rounded-2xl font-bold">Cancelar</button>
                                <button type="submit" disabled={saving} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg disabled:opacity-50">
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

export default ControlAsistencia;

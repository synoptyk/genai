import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Clock, Users, Edit3, Trash2, X, Loader2 } from 'lucide-react';
import { turnosApi, candidatosApi } from '../rrhhApi';

const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444'];

const ProgramacionTurnos = () => {
    const [turnos, setTurnos] = useState([]);
    const [colaboradores, setColaboradores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        nombre: '', tipo: 'Full Day', horaEntrada: '08:00', horaSalida: '18:00',
        diasSemana: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
        color: '#6366F1', horasTrabajo: 10
    });

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [turnosRes, colRes] = await Promise.all([
                turnosApi.getAll(),
                candidatosApi.getAll({ status: 'Contratado' })
            ]);
            setTurnos(turnosRes.data);
            setColaboradores(colRes.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editId) await turnosApi.update(editId, form);
            else await turnosApi.create(form);
            setShowForm(false); setEditId(null);
            fetchAll();
        } catch (e) { alert('Error al guardar turno'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar turno?')) return;
        try { await turnosApi.remove(id); fetchAll(); }
        catch (e) { alert('Error'); }
    };

    const toggleDia = (dia) => {
        const dias = form.diasSemana.includes(dia)
            ? form.diasSemana.filter(d => d !== dia)
            : [...form.diasSemana, dia];
        setForm({ ...form, diasSemana: dias });
    };

    const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-20">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="bg-orange-500 text-white p-3 rounded-2xl shadow-lg shadow-orange-200"><Calendar size={24} /></div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800">Programación de <span className="text-orange-500">Turnos</span></h1>
                        <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-wider">Gestión de horarios y jornadas laborales</p>
                    </div>
                </div>
                <button onClick={() => { setEditId(null); setShowForm(true); }}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-orange-200 active:scale-95">
                    <Plus size={16} /> Nuevo Turno
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={32} /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {turnos.map(t => (
                        <div key={t._id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all group">
                            <div className="h-2" style={{ backgroundColor: t.color || '#6366F1' }}></div>
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="font-black text-slate-800 uppercase">{t.nombre}</h3>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.tipo}</span>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setForm({ ...t }); setEditId(t._id); setShowForm(true); }} className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl"><Edit3 size={14} /></button>
                                        <button onClick={() => handleDelete(t._id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 mb-4 bg-slate-50 rounded-2xl p-4">
                                    <Clock size={16} className="text-orange-500" />
                                    <span className="font-black text-slate-700">{t.horaEntrada} – {t.horaSalida}</span>
                                    <span className="text-xs text-slate-400">({t.horasTrabajo} hrs)</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mb-4">
                                    {DIAS.map(d => (
                                        <span key={d} className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${(t.diasSemana || []).includes(d) ? 'text-white' : 'bg-slate-100 text-slate-400'}`}
                                            style={(t.diasSemana || []).includes(d) ? { backgroundColor: t.color || '#6366F1' } : {}}>
                                            {d.substring(0, 3)}
                                        </span>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <Users size={14} />
                                    <span>{(t.colominoAsignados || []).length} colaboradores asignados</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {turnos.length === 0 && (
                        <div className="col-span-3 py-20 text-center text-slate-400">
                            <Calendar size={48} className="mx-auto opacity-20 mb-4" />
                            <p className="font-bold">No hay turnos definidos</p>
                            <p className="text-xs mt-1">Crea el primer turno para comenzar a organizar los horarios</p>
                        </div>
                    )}
                </div>
            )}

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-8 bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-between">
                            <h2 className="text-xl font-black text-white uppercase">{editId ? 'Editar Turno' : 'Nuevo Turno'}</h2>
                            <button onClick={() => setShowForm(false)} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-5">
                            <div>
                                <label className="label-rrhh">Nombre del Turno *</label>
                                <input required className="input-rrhh" placeholder="Ej: Turno Mañana" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="label-rrhh">Tipo</label>
                                    <select className="input-rrhh" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                                        {['Mañana', 'Tarde', 'Noche', 'Full Day', 'Personalizado'].map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div><label className="label-rrhh">Horas de Trabajo</label>
                                    <input type="number" className="input-rrhh" min="1" max="24" value={form.horasTrabajo} onChange={e => setForm({ ...form, horasTrabajo: parseInt(e.target.value) })} />
                                </div>
                                <div><label className="label-rrhh">Hora Entrada</label>
                                    <input type="time" className="input-rrhh" value={form.horaEntrada} onChange={e => setForm({ ...form, horaEntrada: e.target.value })} />
                                </div>
                                <div><label className="label-rrhh">Hora Salida</label>
                                    <input type="time" className="input-rrhh" value={form.horaSalida} onChange={e => setForm({ ...form, horaSalida: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="label-rrhh">Días de la Semana</label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {DIAS.map(d => (
                                        <button key={d} type="button" onClick={() => toggleDia(d)}
                                            className={`px-3 py-2 rounded-xl text-xs font-black uppercase transition-all ${form.diasSemana.includes(d) ? 'text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                            style={form.diasSemana.includes(d) ? { backgroundColor: form.color } : {}}>
                                            {d.substring(0, 3)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="label-rrhh">Color</label>
                                <div className="flex gap-2 mt-2">
                                    {COLORS.map(c => (
                                        <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                                            className={`w-8 h-8 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-slate-700 scale-125' : ''}`}
                                            style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3.5 border-2 border-slate-200 text-slate-600 rounded-2xl font-bold">Cancelar</button>
                                <button type="submit" disabled={saving} className="flex-1 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-black shadow-lg disabled:opacity-50">
                                    {saving ? '...' : editId ? 'Actualizar' : 'Crear Turno'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProgramacionTurnos;

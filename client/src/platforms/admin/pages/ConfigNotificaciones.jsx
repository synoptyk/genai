import React, { useState, useEffect } from 'react';
import axios from '../../../api/api';

import { Save, Bell, Clock, Calendar, CheckCircle, AlertCircle, Loader2, X, Users, Globe } from 'lucide-react';
import { useCheckPermission } from '../../../hooks/useCheckPermission';

const ConfigNotificaciones = () => {
    const { hasPermission } = useCheckPermission();
    const canEdit = hasPermission('admin_config_notificaciones', 'editar');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notif, setNotif] = useState(null); // { type: 'success' | 'error', message: '' }
    
    const [config, setConfig] = useState({
        diario: { activo: true, horario: '23:50', soloDiasHabiles: true, copia: '', destinatariosExtra: [] },
        semanal: { activo: true, diaSemana: 0, horario: '23:55', soloDiasHabiles: false, copia: '', destinatariosExtra: [] },
        mensual: { activo: true, diaMes: 1, horario: '23:59', soloDiasHabiles: false, copia: '', destinatariosExtra: [] },
        alertas_modulos: { activo: true, soloDiasHabiles: false, copia: '', destinatariosExtra: [] }
    });

    const showToast = (message, type = 'success') => {
        setNotif({ message, type });
        setTimeout(() => setNotif(null), 5000);
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const { data } = await axios.get('/api/auth/configuracion-notificaciones');
            // Fusionar con el estado inicial para asegurar campos nuevos
            const merged = { ...config };
            Object.keys(data).forEach(key => {
                if (merged[key]) {
                    merged[key] = { ...merged[key], ...data[key] };
                }
            });
            setConfig(merged);
        } catch (err) {
            showToast('Error al cargar configuración', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!canEdit) {
            showToast('No tienes permiso para editar esta configuración', 'error');
            return;
        }

        setSaving(true);
        try {
            await axios.put('/api/auth/configuracion-notificaciones', config);
            showToast('Configuración inteligente actualizada');
        } catch (err) {
            showToast('Error al guardar cambios', 'error');
        } finally {
            setSaving(false);
        }
    };

    const updateField = (freq, field, value) => {
        if (!canEdit) return;

        setConfig(prev => ({
            ...prev,
            [freq]: { ...prev[freq], [field]: value }
        }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando Motor Inteligente...</p>
                </div>
            </div>
        );
    }

    const SectionCard = ({ title, freq, icon: Icon, isEvent = false }) => (
        <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm mb-10 hover:shadow-2xl transition-all duration-500 group relative overflow-hidden">
            <div className="flex items-center justify-between mb-8 pb-8 border-b border-slate-50 relative z-10">
                <div className="flex items-center gap-6">
                    <div className="p-5 bg-indigo-50 rounded-[1.5rem] text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-lg shadow-indigo-100/50 group-hover:shadow-indigo-200">
                        <Icon size={28} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-2">{title}</h3>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Entrega Automatizada de Ecosistema</p>
                    </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer scale-125 origin-right">
                    <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={config[freq].activo}
                        onChange={(e) => updateField(freq, 'activo', e.target.checked)}
                    />
                    <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 shadow-inner"></div>
                </label>
            </div>

            <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 transition-all duration-500 relative z-10 ${!config[freq].activo ? 'opacity-30 pointer-events-none grayscale blur-[2px]' : ''}`}>
                {/* Panel de Tiempo y Reglas */}
                <div className="space-y-8">
                    <div className="flex items-center gap-3 mb-2 px-1">
                        <Clock className="w-5 h-5 text-indigo-500" />
                        <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Programación y Logística</span>
                    </div>
                    
                    {!isEvent ? (
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block ml-1">Hora de Envío</label>
                                <input 
                                    type="time" 
                                    className="w-full bg-slate-50 border-0 rounded-2xl p-5 text-slate-700 font-black focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner text-lg"
                                    value={config[freq].horario}
                                    onChange={(e) => updateField(freq, 'horario', e.target.value)}
                                />
                            </div>
                            {freq === 'semanal' && (
                                <div className="space-y-3">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest block ml-1">Día de Semana</label>
                                    <select 
                                        className="w-full bg-slate-50 border-0 rounded-2xl p-5 text-slate-700 font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner"
                                        value={config[freq].diaSemana}
                                        onChange={(e) => updateField(freq, 'diaSemana', parseInt(e.target.value))}
                                    >
                                        <option value={1}>Lunes</option>
                                        <option value={2}>Martes</option>
                                        <option value={3}>Miércoles</option>
                                        <option value={4}>Jueves</option>
                                        <option value={5}>Viernes</option>
                                        <option value={6}>Sábado</option>
                                        <option value={0}>Domingo</option>
                                    </select>
                                </div>
                            )}
                            {freq === 'mensual' && (
                                <div className="space-y-3">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest block ml-1">Día del Mes</label>
                                    <input 
                                        type="number" min="1" max="31"
                                        className="w-full bg-slate-50 border-0 rounded-2xl p-5 text-slate-700 font-black focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner text-lg text-center"
                                        value={config[freq].diaMes}
                                        onChange={(e) => updateField(freq, 'diaMes', parseInt(e.target.value))}
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-6 bg-amber-50 rounded-[1.5rem] border border-amber-100 flex items-start gap-5 shadow-sm">
                            <div className="p-3 bg-white rounded-xl text-amber-600 shadow-sm mt-1">
                                <AlertCircle className="w-6 h-6 shrink-0" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="font-black text-amber-900 text-sm uppercase tracking-tight">Evento Crítico Detectado</h4>
                                <p className="text-sm text-amber-800/70 font-medium leading-relaxed">
                                    Esta notificación se emite al instante ante aprobaciones o cambios manuales importantes.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl shadow-slate-200 flex items-center justify-between group-hover:-translate-y-1 transition-transform duration-500">
                        <div className="flex items-center gap-5">
                            <div className="p-3 bg-white/10 rounded-[1rem] backdrop-blur-md">
                                <Calendar className="w-6 h-6 text-indigo-300" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black tracking-tight leading-none mb-1">Filtro de Días Hábiles</h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Omitir Sábados y Domingos</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={config[freq].soloDiasHabiles}
                                onChange={(e) => updateField(freq, 'soloDiasHabiles', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500 border border-white/5"></div>
                        </label>
                    </div>
                </div>

                {/* Canal de Distribución Inteligente */}
                <div className="space-y-8">
                    <div className="flex items-center gap-3 mb-2 px-1">
                        <Users className="w-5 h-5 text-indigo-500" />
                        <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Canal de Distribución</span>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest block ml-1 flex items-center justify-between">
                            <span>Destinatarios Externos (Extra)</span>
                            <span className="text-[9px] text-slate-300 lowercase italic font-medium">Separe con comas</span>
                        </label>
                        <div className="relative group/field">
                            <textarea 
                                placeholder="ceo@empresa.com, gerente@empresa.com"
                                className="w-full bg-slate-50 border-0 rounded-[1.5rem] p-6 text-slate-700 font-bold placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner min-h-[120px] text-sm leading-relaxed"
                                value={config[freq].destinatariosExtra?.join(', ')}
                                onChange={(e) => updateField(freq, 'destinatariosExtra', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                            />
                            <div className="absolute right-4 bottom-4 p-2 bg-white rounded-lg opacity-0 group-hover/field:opacity-100 transition-opacity">
                                <Globe size={14} className="text-slate-300" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest block ml-1">Buzón de Auditoría (En Copia CC)</label>
                        <input 
                            type="text"
                            placeholder="admin@empresa.com"
                            className="w-full bg-slate-50 border-0 rounded-[1.2rem] p-5 text-slate-700 font-bold placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner text-sm"
                            value={config[freq].copia}
                            onChange={(e) => updateField(freq, 'copia', e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Decoración de fondo */}
            <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-slate-50/50 rounded-full blur-3xl -z-10 transition-all duration-700 group-hover:bg-indigo-50/50"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-24 pt-12">
            <div className="max-w-[1100px] mx-auto px-6">
                
                {/* Master Header - Neo-Glass */}
                <div className="bg-white/80 backdrop-blur-2xl rounded-[3.5rem] p-12 border border-white shadow-2xl mb-16 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-10">
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-5">
                            <div className="px-5 py-2 bg-slate-900 border border-slate-700 text-white text-[9px] font-black uppercase tracking-[0.3em] rounded-full shadow-2xl flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                Ecosystem Intelligence
                            </div>
                            <span className="text-slate-300 font-black text-[10px] uppercase tracking-widest">v2.1 Master</span>
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-[0.9] mb-5">
                            Panel <span className="text-indigo-600">Comandos</span> <br />
                            <span className="opacity-90 italic">Notificaciones</span>
                        </h1>
                        <p className="text-slate-500 text-lg font-bold max-w-xl leading-relaxed">
                            Configure a quién y cuándo se emiten los reportes. El motor inteligente de la plataforma procesará automáticamente los cambios.
                        </p>
                    </div>

                    <button 
                        onClick={handleSave}
                        disabled={saving || !canEdit}
                        className="relative z-10 flex items-center gap-4 bg-indigo-600 hover:bg-slate-900 text-white px-12 py-7 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-[0_20px_40px_-10px_rgba(79,70,229,0.3)] hover:shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 group-hover:scale-125 transition-all" />}
                        {saving ? 'Procesando...' : 'Actualizar Configuración'}
                    </button>

                    {/* Aura Decorativa */}
                    <div className="absolute top-[-80px] left-[-80px] w-96 h-96 bg-indigo-100/40 rounded-full blur-[100px] -z-10 animate-pulse"></div>
                </div>

                {/* Notification Feed */}
                {notif && (
                    <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-5 p-8 rounded-[2.5rem] shadow-2xl border-2 backdrop-blur-xl animate-bounce duration-300 ${
                        notif.type === 'success' ? 'bg-white/90 border-green-500/20 text-green-900' : 'bg-white/90 border-red-500/20 text-red-900'
                    }`}>
                        <div className={`p-4 rounded-2xl shadow-inner ${notif.type === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
                            {notif.type === 'success' ? <CheckCircle className="w-7 h-7" /> : <AlertCircle className="w-7 h-7" />}
                        </div>
                        <div className="pr-4 border-r border-slate-100">
                            <p className="font-black text-[10px] uppercase tracking-widest leading-none mb-1 opacity-50">{notif.type === 'success' ? 'Operación Exitosa' : 'Fallo de Sistema'}</p>
                            <p className="font-black text-sm tracking-tight">{notif.message}</p>
                        </div>
                        <button onClick={() => setNotif(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-300 hover:text-slate-600">
                            <X size={20} />
                        </button>
                    </div>
                )}

                <div className="space-y-4">
                    <SectionCard title="Reporte Ejecutivo Diario" freq="diario" icon={Bell} />
                    <SectionCard title="Análisis de Gestión Semanal" freq="semanal" icon={Calendar} />
                    <SectionCard title="Balance Estratégico Mensual" freq="mensual" icon={Clock} />

                    <div className="pt-20">
                        <div className="flex items-center gap-5 mb-12">
                            <div className="h-[2px] w-12 bg-indigo-600 rounded-full"></div>
                            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">Disparadores de Eventos</h2>
                        </div>
                        <SectionCard title="Alertas de Módulos (Directo)" freq="alertas_modulos" icon={AlertCircle} isEvent={true} />
                    </div>
                </div>

                {/* Master Footer Branding */}
                <div className="mt-24 p-16 bg-slate-900 rounded-[4rem] text-white relative overflow-hidden shadow-2xl shadow-slate-200">
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-16 items-center">
                        <div className="md:col-span-2 space-y-6">
                            <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-[0.95]">
                                Ecosistema <br />
                                <span className="text-indigo-400">Autónomo 360</span>
                            </h2>
                            <p className="text-slate-400 font-bold text-lg leading-relaxed max-w-xl">
                                La plataforma reconoce inteligentemente cada registro y modificación importante. 
                                <span className="text-white"> Usted tiene el control final del canal.</span>
                            </p>
                        </div>
                        <div className="flex flex-col items-center justify-center space-y-4 relative">
                            <div className="w-40 h-40 border-[10px] border-indigo-500/20 rounded-full flex items-center justify-center relative">
                                <div className="w-28 h-28 border-[6px] border-indigo-500/40 rounded-full flex items-center justify-center">
                                    <div className="w-16 h-16 bg-indigo-500 rounded-full shadow-[0_0_50px_rgba(99,102,241,0.6)] animate-pulse"></div>
                                </div>
                            </div>
                            <div className="text-center">
                                <span className="block text-2xl font-black text-white leading-none">INTELLIGENT</span>
                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400">Ecosistema 360</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Abstract Shapes */}
                    <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-indigo-500/10 to-transparent"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full"></div>
                </div>

            </div>
        </div>
    );
};

export default ConfigNotificaciones;

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { telecomApi as api } from './telecomApi';
import * as XLSX from 'xlsx';
import {
    Calculator, Database, Save, Download, Upload, FileSpreadsheet,
    Plus, Trash2, Edit3, Check, X, Search, ChevronDown, ChevronRight,
    AlertCircle, CheckCircle2, Loader2, Shield, Eye, EyeOff,
    Settings, Zap, RefreshCw, FileText, Copy, Info, Hash,
    Wifi, Tv, Phone, Monitor, Package, Activity, Target
} from 'lucide-react';

const GRUPOS_COLORES = {
    'RED DE SERVICIO DE VOZ': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700', icon: <Phone size={14} /> },
    'BANDA ANCHA': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', icon: <Wifi size={14} /> },
    'TELEVISION': { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700', icon: <Tv size={14} /> },
    'INSTALACIONES MULTIPRODUCTO': { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-700', icon: <Package size={14} /> },
    'RUTINAS Y PREVENTIVOS': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', icon: <Settings size={14} /> },
    'ALTO VALOR': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', icon: <Target size={14} /> },
    'RESOLUCIÓN DE AVERÍAS': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700', icon: <Zap size={14} /> },
};
const DEFAULT_GRUPO = { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-700', icon: <Hash size={14} /> };

const ConfigLPU = () => {
    const [tarifas, setTarifas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null);
    const [busqueda, setBusqueda] = useState('');
    const [grupoFiltro, setGrupoFiltro] = useState('');
    const [gruposExpandidos, setGruposExpandidos] = useState({});
    const [editando, setEditando] = useState(null); // id de tarifa en edición
    const [editForm, setEditForm] = useState({});
    const [showNueva, setShowNueva] = useState(false);
    const [cargandoPlantilla, setCargandoPlantilla] = useState(false);
    const fileRef = useRef(null);

    const nuevaTarifaBase = {
        codigo: '', descripcion: '', observacion: '', grupo: '', categoria: 'ATENCION AL CLIENTE',
        puntos: 0, precio: 0, moneda: 'CLP',
        mapeo: { tipo_trabajo_pattern: '', subtipo_actividad: '', familia_producto: '', es_equipo_adicional: false, campo_cantidad: '', requiere_reutilizacion_drop: '', condicion_extra: '' },
        activo: true, orden: 0
    };
    const [nuevaTarifa, setNuevaTarifa] = useState({ ...nuevaTarifaBase });

    // ── Cargar tarifas ──
    const cargar = async () => {
        try {
            setLoading(true);
            const res = await api.get('/tarifa-lpu');
            setTarifas(res.data);
        } catch (e) { console.error('Tarifas LPU:', e); }
        finally { setLoading(false); }
    };
    useEffect(() => { cargar(); }, []);

    // ── Grupos organizados ──
    const grupos = useMemo(() => {
        const map = {};
        let filtradas = tarifas;
        if (busqueda) {
            const q = busqueda.toLowerCase();
            filtradas = filtradas.filter(t =>
                t.codigo.toLowerCase().includes(q) ||
                t.descripcion.toLowerCase().includes(q) ||
                (t.observacion || '').toLowerCase().includes(q)
            );
        }
        if (grupoFiltro) filtradas = filtradas.filter(t => t.grupo === grupoFiltro);
        filtradas.forEach(t => {
            if (!map[t.grupo]) map[t.grupo] = [];
            map[t.grupo].push(t);
        });
        return map;
    }, [tarifas, busqueda, grupoFiltro]);

    const gruposUnicos = useMemo(() => [...new Set(tarifas.map(t => t.grupo))].sort(), [tarifas]);
    const totalPuntos = useMemo(() => tarifas.reduce((s, t) => s + t.puntos, 0), [tarifas]);

    // ── Expandir/colapsar grupo ──
    const toggleGrupo = (g) => setGruposExpandidos(prev => ({ ...prev, [g]: !prev[g] }));
    const expandirTodos = () => {
        const all = {};
        gruposUnicos.forEach(g => all[g] = true);
        setGruposExpandidos(all);
    };
    const colapsarTodos = () => setGruposExpandidos({});

    // ── CRUD ──
    const guardarNueva = async () => {
        if (!nuevaTarifa.codigo || !nuevaTarifa.descripcion || !nuevaTarifa.grupo) {
            setMsg({ type: 'err', text: 'Código, descripción y grupo son obligatorios.' }); return;
        }
        setSaving(true); setMsg(null);
        try {
            await api.post('/tarifa-lpu', nuevaTarifa);
            setMsg({ type: 'ok', text: `Tarifa ${nuevaTarifa.codigo} creada.` });
            setNuevaTarifa({ ...nuevaTarifaBase });
            setShowNueva(false);
            cargar();
        } catch (e) {
            setMsg({ type: 'err', text: e?.response?.data?.error || 'Error al crear.' });
        } finally { setSaving(false); }
    };

    const iniciarEdicion = (tarifa) => {
        setEditando(tarifa._id);
        setEditForm({ ...tarifa, mapeo: { ...nuevaTarifaBase.mapeo, ...tarifa.mapeo } });
    };

    const guardarEdicion = async () => {
        setSaving(true); setMsg(null);
        try {
            await api.put(`/tarifa-lpu/${editando}`, editForm);
            setMsg({ type: 'ok', text: `Tarifa ${editForm.codigo} actualizada.` });
            setEditando(null);
            cargar();
        } catch (e) {
            setMsg({ type: 'err', text: e?.response?.data?.error || 'Error al actualizar.' });
        } finally { setSaving(false); }
    };

    const eliminar = async (id, codigo) => {
        if (!window.confirm(`¿Eliminar tarifa ${codigo}? Esta acción no se puede deshacer.`)) return;
        try {
            await api.delete(`/tarifa-lpu/${id}`);
            setMsg({ type: 'ok', text: `Tarifa ${codigo} eliminada.` });
            cargar();
        } catch (e) {
            setMsg({ type: 'err', text: 'Error al eliminar.' });
        }
    };

    // ── Plantilla Chile ──
    const cargarPlantillaChile = async () => {
        if (!window.confirm('¿Cargar la plantilla LPU de Chile (Movistar)? Los códigos existentes se actualizarán.')) return;
        setCargandoPlantilla(true); setMsg(null);
        try {
            const res = await api.post('/tarifa-lpu/cargar-plantilla-chile');
            setMsg({ type: 'ok', text: `${res.data.mensaje} — ${res.data.insertados} nuevas, ${res.data.actualizados} actualizadas.` });
            cargar();
            expandirTodos();
        } catch (e) {
            setMsg({ type: 'err', text: e?.response?.data?.error || 'Error al cargar plantilla.' });
        } finally { setCargandoPlantilla(false); }
    };

    // ── Excel ──
    const exportarExcel = () => {
        const rows = tarifas.map(t => ({
            Código: t.codigo, Descripción: t.descripcion, Observación: t.observacion || '',
            Grupo: t.grupo, Categoría: t.categoria, Puntos: t.puntos, Precio: t.precio || 0,
            Activo: t.activo ? 'Sí' : 'No',
            Tipo_Trabajo_Pattern: t.mapeo?.tipo_trabajo_pattern || '',
            Subtipo_Actividad: t.mapeo?.subtipo_actividad || '',
            Familia_Producto: t.mapeo?.familia_producto || '',
            Es_Equipo_Adicional: t.mapeo?.es_equipo_adicional ? 'Sí' : 'No',
            Campo_Cantidad: t.mapeo?.campo_cantidad || '',
            Reutilización_DROP: t.mapeo?.requiere_reutilizacion_drop || '',
            Condición_Extra: t.mapeo?.condicion_extra || '',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Tarifas_LPU');
        XLSX.writeFile(wb, `Tarifas_LPU_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const importarExcel = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const wb = XLSX.read(evt.target.result, { type: 'binary' });
            const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            const tarifasImport = data.map(r => ({
                codigo: r['Código'] || r.codigo || r.CODIGO || '',
                descripcion: r['Descripción'] || r.descripcion || r.DESCRIPCION || '',
                observacion: r['Observación'] || r.observacion || '',
                grupo: r['Grupo'] || r.grupo || r.GRUPO || '',
                categoria: r['Categoría'] || r.categoria || 'ATENCION AL CLIENTE',
                puntos: parseFloat(r['Puntos'] || r.puntos || r.PUNTOS || 0),
                precio: parseFloat(r['Precio'] || r.precio || 0),
                activo: true,
                mapeo: {
                    tipo_trabajo_pattern: r['Tipo_Trabajo_Pattern'] || '',
                    subtipo_actividad: r['Subtipo_Actividad'] || '',
                    familia_producto: r['Familia_Producto'] || '',
                    es_equipo_adicional: r['Es_Equipo_Adicional'] === 'Sí',
                    campo_cantidad: r['Campo_Cantidad'] || '',
                    requiere_reutilizacion_drop: r['Reutilización_DROP'] || '',
                    condicion_extra: r['Condición_Extra'] || '',
                }
            })).filter(t => t.codigo && t.descripcion);

            if (!tarifasImport.length) { setMsg({ type: 'err', text: 'No se encontraron tarifas válidas en el Excel.' }); return; }
            setSaving(true);
            try {
                const res = await api.post('/tarifa-lpu/bulk', { tarifas: tarifasImport });
                setMsg({ type: 'ok', text: `Excel importado: ${res.data.insertados} nuevas, ${res.data.actualizados} actualizadas.` });
                cargar();
            } catch (err) {
                setMsg({ type: 'err', text: err?.response?.data?.error || 'Error al importar.' });
            } finally { setSaving(false); }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    // ── Render campo editable ──
    const Campo = ({ label, value, onChange, type = 'text', placeholder = '', small = false, options = null, helpText = '' }) => (
        <div className={small ? 'flex-1 min-w-[100px]' : 'flex-1 min-w-[180px]'}>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">{label}</label>
            {options ? (
                <select value={value} onChange={e => onChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30">
                    {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
                </select>
            ) : (
                <input type={type} value={value} onChange={e => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                    placeholder={placeholder} step={type === 'number' ? '0.01' : undefined}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30" />
            )}
            {helpText && <span className="text-[8px] text-slate-400 mt-0.5 block">{helpText}</span>}
        </div>
    );

    // ── Formulario de tarifa (crear/editar) ──
    const TarifaForm = ({ data, setData, onSave, onCancel, titulo }) => (
        <div className="bg-white border-2 border-blue-200 rounded-2xl p-5 shadow-lg shadow-blue-100/50 mb-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-blue-700 flex items-center gap-2"><Plus size={14} /> {titulo}</h3>
                <button onClick={onCancel} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><X size={14} /></button>
            </div>

            {/* Fila 1: Básicos */}
            <div className="flex flex-wrap gap-3 mb-3">
                <Campo label="Código *" value={data.codigo} onChange={v => setData(d => ({ ...d, codigo: v }))} placeholder="Ej: 520012" />
                <Campo label="Descripción *" value={data.descripcion} onChange={v => setData(d => ({ ...d, descripcion: v }))} placeholder="Ej: Alta Banda Ancha" />
                <Campo label="Puntos Baremo *" value={data.puntos} onChange={v => setData(d => ({ ...d, puntos: v }))} type="number" small />
                <Campo label="Precio ($)" value={data.precio || 0} onChange={v => setData(d => ({ ...d, precio: v }))} type="number" small />
            </div>

            {/* Fila 2: Clasificación */}
            <div className="flex flex-wrap gap-3 mb-3">
                <Campo label="Grupo *" value={data.grupo} onChange={v => setData(d => ({ ...d, grupo: v }))} placeholder="Ej: BANDA ANCHA"
                    options={[{ value: '', label: 'Seleccionar...' }, ...gruposUnicos.map(g => ({ value: g, label: g })), { value: '__NUEVO__', label: '+ Nuevo grupo' }]} />
                {data.grupo === '__NUEVO__' && (
                    <Campo label="Nombre del nuevo grupo" value={data._nuevoGrupo || ''} onChange={v => setData(d => ({ ...d, _nuevoGrupo: v, grupo: v }))} placeholder="Ej: OTRO GRUPO" />
                )}
                <Campo label="Categoría" value={data.categoria} onChange={v => setData(d => ({ ...d, categoria: v }))}
                    options={['ATENCION AL CLIENTE', 'RESOLUCIÓN DE AVERÍAS', 'ALTO VALOR', 'MANTENIMIENTO']} />
                <Campo label="Orden" value={data.orden || 0} onChange={v => setData(d => ({ ...d, orden: v }))} type="number" small />
            </div>

            {/* Fila 3: Observación */}
            <div className="mb-3">
                <Campo label="Observación / Nota aclaratoria" value={data.observacion || ''} onChange={v => setData(d => ({ ...d, observacion: v }))} placeholder="Explicación que ayude a entender cuándo aplica esta tarifa" />
            </div>

            {/* Fila 4: Mapeo automático */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-3">
                <div className="flex items-center gap-2 mb-3">
                    <Settings size={12} className="text-slate-500" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Mapeo automático — Criterios para vincular con órdenes TOA</span>
                </div>
                <div className="flex flex-wrap gap-3 mb-2">
                    <Campo label="Tipo_Trabajo (patrón)" value={data.mapeo?.tipo_trabajo_pattern || ''} onChange={v => setData(d => ({ ...d, mapeo: { ...d.mapeo, tipo_trabajo_pattern: v } }))} placeholder="Ej: At--------" helpText="Código TOA o regex" small />
                    <Campo label="Subtipo_de_Actividad" value={data.mapeo?.subtipo_actividad || ''} onChange={v => setData(d => ({ ...d, mapeo: { ...d.mapeo, subtipo_actividad: v } }))} placeholder="Ej: Alta" helpText="Valor exacto del campo" small />
                    <Campo label="Familia producto (XML)" value={data.mapeo?.familia_producto || ''} onChange={v => setData(d => ({ ...d, mapeo: { ...d.mapeo, familia_producto: v } }))} placeholder="FIB, IPTV, TOIP, EQ" helpText="Del XML de productos" small />
                    <Campo label="Reutilización DROP" value={data.mapeo?.requiere_reutilizacion_drop || ''} onChange={v => setData(d => ({ ...d, mapeo: { ...d.mapeo, requiere_reutilizacion_drop: v } }))}
                        options={[{ value: '', label: 'No aplica' }, { value: 'SI', label: 'Sí' }, { value: 'NO', label: 'No' }]} small />
                </div>
                <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 min-w-[140px]">
                        <label className="text-[9px] font-black text-slate-400 uppercase">¿Equipo adicional?</label>
                        <button onClick={() => setData(d => ({ ...d, mapeo: { ...d.mapeo, es_equipo_adicional: !d.mapeo?.es_equipo_adicional } }))}
                            className={`px-3 py-1 rounded-lg text-[10px] font-black border transition-all ${data.mapeo?.es_equipo_adicional ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                            {data.mapeo?.es_equipo_adicional ? 'Sí' : 'No'}
                        </button>
                    </div>
                    {data.mapeo?.es_equipo_adicional && (
                        <Campo label="Campo cantidad (XML)" value={data.mapeo?.campo_cantidad || ''} onChange={v => setData(d => ({ ...d, mapeo: { ...d.mapeo, campo_cantidad: v } }))}
                            placeholder="Decos_Adicionales" helpText="Nombre del campo derivado del XML" options={[
                                { value: '', label: 'Seleccionar...' },
                                { value: 'Decos_Adicionales', label: 'Decos_Adicionales' },
                                { value: 'Repetidores_WiFi', label: 'Repetidores_WiFi' },
                                { value: 'Telefonos', label: 'Telefonos' },
                            ]} small />
                    )}
                    <Campo label="Condición extra" value={data.mapeo?.condicion_extra || ''} onChange={v => setData(d => ({ ...d, mapeo: { ...d.mapeo, condicion_extra: v } }))} placeholder="Ej: Coincidente con alta" helpText="Nota libre" small />
                </div>
            </div>

            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100">Cancelar</button>
                <button onClick={onSave} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-all">
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
                </button>
            </div>
        </div>
    );

    return (
        <div className="animate-in fade-in duration-700 max-w-[1920px] mx-auto pb-20 px-4 md:px-8 pt-0 bg-gradient-to-br from-slate-50 via-white to-emerald-50/20 min-h-screen font-sans">

            {/* ═══ HEADER ═══ */}
            <div className="relative -mx-4 md:-mx-8 px-4 md:px-8 pt-8 pb-6 mb-8 bg-gradient-to-r from-slate-900 via-emerald-900 to-teal-900 overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                <div className="relative flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-2xl shadow-2xl">
                            <Calculator size={30} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tight">
                                Configuración <span className="text-emerald-400">LPU</span>
                            </h1>
                            <p className="text-emerald-200/60 text-xs mt-1 font-medium">Lista de Precios Unitarios — Puntos Baremos de Producción</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest backdrop-blur-sm border border-white/10 bg-emerald-500/20 text-emerald-300">
                            <Database size={11} className="inline mr-1.5" />{tarifas.length} tarifas configuradas
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="relative flex flex-wrap gap-3 mt-6">
                    {[
                        { label: 'Total tarifas', value: tarifas.length.toString(), icon: <Hash size={14} />, color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-400/20 text-emerald-300' },
                        { label: 'Grupos', value: gruposUnicos.length.toString(), icon: <Package size={14} />, color: 'from-blue-500/20 to-blue-600/10 border-blue-400/20 text-blue-300' },
                        { label: 'Equipos adicionales', value: tarifas.filter(t => t.mapeo?.es_equipo_adicional).length.toString(), icon: <Monitor size={14} />, color: 'from-violet-500/20 to-violet-600/10 border-violet-400/20 text-violet-300' },
                        { label: 'Con mapeo auto', value: tarifas.filter(t => t.mapeo?.tipo_trabajo_pattern || t.mapeo?.subtipo_actividad).length.toString(), icon: <Activity size={14} />, color: 'from-cyan-500/20 to-cyan-600/10 border-cyan-400/20 text-cyan-300' },
                    ].map((s, i) => (
                        <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r border backdrop-blur-sm ${s.color}`}>
                            {s.icon}
                            <div>
                                <div className="text-[9px] font-bold uppercase tracking-wider opacity-70">{s.label}</div>
                                <div className="text-sm font-black">{s.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ═══ TOOLBAR ═══ */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Buscar */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input type="text" placeholder="Buscar por código, descripción u observación..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-3 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/30" />
                    </div>

                    {/* Filtro grupo */}
                    <select value={grupoFiltro} onChange={e => setGrupoFiltro(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/30 max-w-[200px]">
                        <option value="">Todos los grupos</option>
                        {gruposUnicos.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>

                    <div className="flex items-center gap-2">
                        <button onClick={expandirTodos} className="px-3 py-2 rounded-xl text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all">Expandir</button>
                        <button onClick={colapsarTodos} className="px-3 py-2 rounded-xl text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all">Colapsar</button>
                    </div>

                    <div className="h-6 w-px bg-slate-200" />

                    {/* Acciones */}
                    <button onClick={() => { setShowNueva(true); setEditando(null); }}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all">
                        <Plus size={13} /> Nueva tarifa
                    </button>
                    <button onClick={cargarPlantillaChile} disabled={cargandoPlantilla}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-all">
                        {cargandoPlantilla ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />} Plantilla Chile
                    </button>

                    <div className="h-6 w-px bg-slate-200" />

                    <input type="file" ref={fileRef} accept=".xlsx,.xls" onChange={importarExcel} className="hidden" />
                    <button onClick={() => fileRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all">
                        <Upload size={12} /> Importar Excel
                    </button>
                    <button onClick={exportarExcel} disabled={!tarifas.length}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-all">
                        <Download size={12} /> Exportar Excel
                    </button>
                    <button onClick={cargar}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all">
                        <RefreshCw size={13} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {msg && (
                    <div className={`mt-3 flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {msg.type === 'ok' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />} {msg.text}
                    </div>
                )}
            </div>

            {/* ═══ FORMULARIO NUEVA TARIFA ═══ */}
            {showNueva && (
                <TarifaForm data={nuevaTarifa} setData={setNuevaTarifa} onSave={guardarNueva}
                    onCancel={() => { setShowNueva(false); setNuevaTarifa({ ...nuevaTarifaBase }); }} titulo="Nueva tarifa LPU" />
            )}

            {/* ═══ CONTENIDO PRINCIPAL — Grupos de tarifas ═══ */}
            {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                    <Loader2 size={24} className="animate-spin mr-3" /> Cargando tarifas...
                </div>
            ) : tarifas.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center">
                    <Calculator size={48} className="mx-auto text-slate-200 mb-4" />
                    <h2 className="text-lg font-black text-slate-600 mb-2">Sin tarifas configuradas</h2>
                    <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
                        Configura tu tabla de puntos baremos. Puedes cargar la plantilla base de Chile o crear tarifas manualmente.
                    </p>
                    <div className="flex justify-center gap-3">
                        <button onClick={cargarPlantillaChile} disabled={cargandoPlantilla}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all">
                            {cargandoPlantilla ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />} Cargar Plantilla Chile
                        </button>
                        <button onClick={() => setShowNueva(true)}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-all">
                            <Plus size={16} /> Crear manualmente
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {Object.entries(grupos).map(([grupo, items]) => {
                        const gc = GRUPOS_COLORES[grupo] || DEFAULT_GRUPO;
                        const abierto = gruposExpandidos[grupo];
                        return (
                            <div key={grupo} className={`bg-white rounded-2xl border ${gc.border} shadow-sm overflow-hidden`}>
                                {/* Header del grupo */}
                                <button onClick={() => toggleGrupo(grupo)}
                                    className={`w-full px-5 py-4 flex items-center gap-3 ${gc.bg} hover:brightness-95 transition-all text-left`}>
                                    <div className={`p-2 rounded-xl ${gc.badge}`}>{gc.icon}</div>
                                    <div className="flex-1">
                                        <span className={`font-black text-sm ${gc.text}`}>{grupo}</span>
                                        <span className="ml-3 text-[10px] font-bold text-slate-400">{items.length} tarifas</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${gc.badge}`}>
                                            {items.reduce((s, t) => s + t.puntos, 0).toFixed(2)} pts total
                                        </span>
                                        {abierto ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                                    </div>
                                </button>

                                {/* Filas del grupo */}
                                {abierto && (
                                    <div className="divide-y divide-slate-100">
                                        {items.map(tarifa => (
                                            editando === tarifa._id ? (
                                                <div key={tarifa._id} className="p-4">
                                                    <TarifaForm data={editForm} setData={setEditForm} onSave={guardarEdicion}
                                                        onCancel={() => setEditando(null)} titulo={`Editando ${tarifa.codigo}`} />
                                                </div>
                                            ) : (
                                                <div key={tarifa._id} className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50/50 group transition-colors">
                                                    {/* Código */}
                                                    <div className="w-20 flex-shrink-0">
                                                        <span className="font-mono text-xs font-black text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg">
                                                            {tarifa.codigo}
                                                        </span>
                                                    </div>

                                                    {/* Descripción + obs */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-bold text-slate-700 truncate">{tarifa.descripcion}</div>
                                                        {tarifa.observacion && (
                                                            <div className="text-[10px] text-slate-400 mt-0.5 truncate flex items-center gap-1">
                                                                <Info size={9} /> {tarifa.observacion}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Badges de mapeo */}
                                                    <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0">
                                                        {tarifa.mapeo?.tipo_trabajo_pattern && (
                                                            <span className="text-[8px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono" title="Tipo_Trabajo">
                                                                {tarifa.mapeo.tipo_trabajo_pattern}
                                                            </span>
                                                        )}
                                                        {tarifa.mapeo?.es_equipo_adicional && (
                                                            <span className="text-[8px] font-bold bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded" title="Equipo adicional — se multiplica por cantidad">
                                                                ×QTY {tarifa.mapeo.campo_cantidad}
                                                            </span>
                                                        )}
                                                        {tarifa.mapeo?.requiere_reutilizacion_drop && (
                                                            <span className="text-[8px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded" title="Requiere reutilización de DROP">
                                                                DROP={tarifa.mapeo.requiere_reutilizacion_drop}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Puntos */}
                                                    <div className="w-20 text-right flex-shrink-0">
                                                        <span className="inline-block bg-emerald-100 text-emerald-700 font-black text-xs px-3 py-1.5 rounded-lg border border-emerald-200 min-w-[50px] text-center">
                                                            {tarifa.puntos}
                                                        </span>
                                                    </div>

                                                    {/* Acciones */}
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                        <button onClick={() => iniciarEdicion(tarifa)} className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors">
                                                            <Edit3 size={12} />
                                                        </button>
                                                        <button onClick={() => eliminar(tarifa._id, tarifa.codigo)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ═══ LEYENDA DE AYUDA ═══ */}
            {tarifas.length > 0 && (
                <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Info size={14} className="text-blue-500" />
                        <span className="text-sm font-black text-slate-700">Guía de cálculo de puntos por orden</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 text-[11px] text-slate-600">
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                            <span className="font-black text-blue-700 block mb-1">1. Actividad base</span>
                            Se identifica por el <code className="bg-white px-1 rounded text-[10px]">Tipo_Trabajo</code> y <code className="bg-white px-1 rounded text-[10px]">Subtipo_de_Actividad</code>.
                            Ejemplo: <code className="bg-white px-1 rounded text-[10px]">At------At</code> + Alta = Instalación BA + TV = <strong>2.0 pts</strong>
                        </div>
                        <div className="bg-violet-50 rounded-xl p-4 border border-violet-200">
                            <span className="font-black text-violet-700 block mb-1">2. Equipos adicionales (×QTY)</span>
                            Se multiplican por la cantidad del XML. Ejemplo: 2 decos adicionales × 0.5 = <strong>1.0 pts</strong>. Repetidor WiFi × 0.25 = <strong>0.25 pts</strong>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                            <span className="font-black text-amber-700 block mb-1">3. Reutilización DROP</span>
                            Si <code className="bg-white px-1 rounded text-[10px]">Reutilización_de_Drop = SI</code>, se usa la tarifa con DROP en vez de la estándar. Cambia los puntos base.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConfigLPU;

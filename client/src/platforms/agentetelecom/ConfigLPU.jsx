import React, { useState, useEffect, useRef, useMemo } from 'react';
import { telecomApi as api } from './telecomApi';
import * as XLSX from 'xlsx';
import {
    Calculator, Database, Save, Download, Upload, FileSpreadsheet,
    Plus, Trash2, Edit3, Check, X, Search, ChevronDown, ChevronRight,
    AlertCircle, CheckCircle2, Loader2, Shield, Eye, EyeOff,
    Settings, Zap, RefreshCw, FileText, Copy, Info, Hash,
    Wifi, Tv, Phone, Monitor, Package, Activity, Target, TrendingUp, CalendarDays
} from 'lucide-react';

const GRUPOS_COLORES = {
    'RED DE SERVICIO DE VOZ': { bg: 'bg-indigo-50/50', border: 'border-indigo-100', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-700', icon: <Phone size={14} /> },
    'BANDA ANCHA': { bg: 'bg-blue-50/50', border: 'border-blue-100', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', icon: <Wifi size={14} /> },
    'TELEVISION': { bg: 'bg-rose-50/50', border: 'border-rose-100', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700', icon: <Tv size={14} /> },
    'INSTALACIONES MULTIPRODUCTO': { bg: 'bg-violet-50/50', border: 'border-violet-100', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700', icon: <Package size={14} /> },
    'RUTINAS Y PREVENTIVOS': { bg: 'bg-amber-50/50', border: 'border-amber-100', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', icon: <Settings size={14} /> },
    'ALTO VALOR': { bg: 'bg-emerald-50/50', border: 'border-emerald-100', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', icon: <Target size={14} /> },
    'RESOLUCIÓN DE AVERÍAS': { bg: 'bg-orange-50/50', border: 'border-orange-100', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700', icon: <Zap size={14} /> },
};
const DEFAULT_GRUPO = { bg: 'bg-slate-50/50', border: 'border-slate-100', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-700', icon: <Hash size={14} /> };

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

    // ── Meta de producción ──
    const [metaConfig, setMetaConfig] = useState({ metaProduccionDia: 0, diasLaboralesSemana: 5, diasLaboralesMes: 22 });
    const [savingMeta, setSavingMeta] = useState(false);

    // ── Baremos por Cliente ──
    const [clientesBaremos, setClientesBaremos] = useState([]);
    const [loadingBaremos, setLoadingBaremos] = useState(false);
    const [editCliente, setEditCliente] = useState(null);
    const [formCliente, setFormCliente] = useState({ cliente: '', proyecto: '', valor_punto: 0, retencion: 0, moneda: 'CLP', activo: true, color: '#10b981' });
    const [showModalCliente, setShowModalCliente] = useState(false);

    const nuevaTarifaBase = {
        codigo: '', descripcion: '', observacion: '', grupo: '', categoria: 'ATENCION AL CLIENTE',
        puntos: 0, precio: 0, moneda: 'CLP',
        mapeo: { tipo_trabajo_pattern: '', subtipo_actividad: '', familia_producto: '', es_equipo_adicional: false, campo_cantidad: '', requiere_reutilizacion_drop: '', con_preco: '', condicion_extra: '' },
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

    // ── Cargar config de producción ──
    const cargarMeta = async () => {
        try {
            const res = await api.get('/tarifa-lpu/config-produccion');
            setMetaConfig({
                metaProduccionDia: res.data.metaProduccionDia || 0,
                diasLaboralesSemana: res.data.diasLaboralesSemana || 5,
                diasLaboralesMes: res.data.diasLaboralesMes || 22,
            });
        } catch (e) { console.error('Config producción:', e); }
    };

    const guardarMeta = async () => {
        setSavingMeta(true); setMsg(null);
        try {
            await api.put('/tarifa-lpu/config-produccion', metaConfig);
            setMsg({ type: 'ok', text: `Meta de producción actualizada: ${metaConfig.metaProduccionDia} pts/día, ${(metaConfig.metaProduccionDia * metaConfig.diasLaboralesSemana).toFixed(2)} pts/sem, ${(metaConfig.metaProduccionDia * metaConfig.diasLaboralesMes).toFixed(2)} pts/mes` });
        } catch (e) {
            setMsg({ type: 'err', text: e?.response?.data?.error || 'Error al guardar meta.' });
        } finally { setSavingMeta(false); }
    };

    // ── Cargar Baremos por Cliente ──
    const cargarBaremos = async () => {
        try {
            setLoadingBaremos(true);
            const res = await api.get('/valor-punto');
            setClientesBaremos(res.data);
        } catch (e) { console.error('Baremos:', e); }
        finally { setLoadingBaremos(false); }
    };

    const guardarCliente = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);
        try {
            if (editCliente) {
                await api.put(`/valor-punto/${editCliente}`, formCliente);
                setMsg({ type: 'ok', text: 'Baremo de cliente actualizado.' });
            } else {
                await api.post('/valor-punto', formCliente);
                setMsg({ type: 'ok', text: 'Nuevo baremo de cliente creado.' });
            }
            setShowModalCliente(false);
            setEditCliente(null);
            cargarBaremos();
        } catch (e) {
            setMsg({ type: 'err', text: e?.response?.data?.error || 'Error al guardar baremo.' });
        } finally { setSaving(false); }
    };

    const eliminarCliente = async (id, nombre) => {
        if (!window.confirm(`¿Eliminar baremo de "${nombre}"?`)) return;
        try {
            await api.delete(`/valor-punto/${id}`);
            setMsg({ type: 'ok', text: 'Baremo eliminado.' });
            cargarBaremos();
        } catch (e) { setMsg({ type: 'err', text: 'Error al eliminar baremo.' }); }
    };

    useEffect(() => { 
        cargar(); 
        cargarMeta(); 
        cargarBaremos();
    }, []);

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
            Con_Preco: t.mapeo?.con_preco || '',
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
                    reutilizacion_drop: r['Reutilización_DROP'] || '',
                    con_preco: r['Con_Preco'] || '',
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
                    <Campo label="Con Preco/Venta" value={data.mapeo?.con_preco || ''} onChange={v => setData(d => ({ ...d, mapeo: { ...d.mapeo, con_preco: v } }))}
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
                                { value: 'Decos_Adicionales', label: 'Decos_Adicionales (CAT+WIFI)' },
                                { value: 'Decos_Cable_Adicionales', label: 'Decos_Cable (CAT)' },
                                { value: 'Decos_WiFi_Adicionales', label: 'Decos_WiFi (SMART)' },
                                { value: 'Repetidores_WiFi', label: 'Repetidores_WiFi' },
                                { value: 'Telefonos', label: 'Telefonos' },
                            ]} small />
                    )}
                    <Campo label="Condición extra (Requisito Estricto)" value={data.mapeo?.condicion_extra || ''} onChange={v => setData(d => ({ ...d, mapeo: { ...d.mapeo, condicion_extra: v } }))} placeholder='Ej: Tipo_Operacion=Baja o "Edificio"' helpText="Campo=Valor exacto o texto libre" small />
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
        <div className="animate-in fade-in duration-700 max-w-[1920px] mx-auto pb-20 px-4 md:px-8 pt-0 bg-transparent min-h-screen font-sans">

            {/* ═══ HEADER ═══ */}
            <div className="relative -mx-4 md:-mx-8 px-4 md:px-8 pt-12 pb-14 mb-8 bg-white overflow-hidden border-b border-slate-100">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-50/50 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-50/50 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/3" />
                
                <div className="relative flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
                    <div className="flex items-center gap-6">
                        <div className="p-5 bg-white rounded-3xl shadow-xl shadow-emerald-100/50 border border-emerald-50 text-emerald-600">
                            <Calculator size={32} strokeWidth={2.5} />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">
                                    Configuración <span className="text-emerald-600">LPU</span>
                                </h1>
                                <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                                    v3.2 Premium
                                </div>
                            </div>
                            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.2em]">Lista de Precios Unitarios — Puntos Baremos de Producción</p>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="relative flex flex-wrap gap-4 mt-8">
                    {[
                        { label: 'Total tarifas', value: tarifas.length, icon: <Hash size={16} />, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                        { label: 'Grupos', value: gruposUnicos.length, icon: <Package size={16} />, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
                        { label: 'Equipos adicionales', value: tarifas.filter(t => t.mapeo?.es_equipo_adicional).length, icon: <Monitor size={16} />, color: 'bg-blue-50 text-blue-600 border-blue-100' },
                        { label: 'Mapeo Automático', value: tarifas.filter(t => t.mapeo?.tipo_trabajo_pattern || t.mapeo?.subtipo_actividad).length, icon: <Activity size={16} />, color: 'bg-violet-50 text-violet-600 border-violet-100' },
                    ].map((s, i) => (
                        <div key={i} className={`flex items-center gap-4 px-6 py-4 rounded-[2rem] border shadow-sm transition-all hover:shadow-md ${s.color}`}>
                            <div className="p-2.5 bg-white/60 rounded-xl shadow-inner">{s.icon}</div>
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-0.5">{s.label}</div>
                                <div className="text-lg font-black leading-none">{s.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ═══ TOOLBAR ═══ */}
            <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-slate-200/20 p-5 mb-8">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Buscar */}
                    <div className="relative flex-1 min-w-[300px]">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input type="text" placeholder="Buscar por código, descripción u observación..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-5 text-xs font-black uppercase tracking-tight outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all" />
                    </div>

                    {/* Filtro grupo */}
                    <select value={grupoFiltro} onChange={e => setGrupoFiltro(e.target.value)}
                        className="bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-5 text-xs font-black text-slate-700 uppercase outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all max-w-[220px]">
                        <option value="">Todos los grupos</option>
                        {gruposUnicos.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>

                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                        <button onClick={expandirTodos} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-600 hover:bg-white transition-all">Expandir</button>
                        <button onClick={colapsarTodos} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-600 hover:bg-white transition-all">Colapsar</button>
                    </div>

                    <div className="h-10 w-px bg-slate-100 mx-2" />

                    {/* Acciones */}
                    <div className="flex items-center gap-2">
                        <button onClick={() => { setShowNueva(true); setEditando(null); }}
                            className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white bg-slate-900 hover:bg-emerald-600 hover:scale-105 active:scale-95 shadow-xl shadow-slate-200 transition-all">
                            <Plus size={14} strokeWidth={3} /> Nueva tarifa
                        </button>
                        <button onClick={cargarPlantillaChile} disabled={cargandoPlantilla}
                            className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-95 shadow-xl shadow-blue-100 transition-all">
                            {cargandoPlantilla ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />} Plantilla Chile
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <input type="file" ref={fileRef} accept=".xlsx,.xls" onChange={importarExcel} className="hidden" />
                        <button onClick={() => fileRef.current?.click()}
                            className="p-3.5 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:shadow-lg transition-all" title="Importar Excel">
                            <Upload size={16} />
                        </button>
                        <button onClick={exportarExcel} disabled={!tarifas.length}
                            className="p-3.5 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-100 hover:shadow-lg transition-all" title="Exportar Excel">
                            <Download size={16} />
                        </button>
                        <button onClick={cargar}
                            className="p-3.5 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-100 hover:shadow-lg transition-all">
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
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
                            <div key={grupo} className={`bg-white rounded-[2rem] border ${gc.border} shadow-xl shadow-slate-200/20 overflow-hidden mb-6 transition-all hover:shadow-2xl hover:shadow-slate-200/40`}>
                                {/* Header del grupo */}
                                <button onClick={() => toggleGrupo(grupo)}
                                    className={`w-full px-8 py-6 flex items-center justify-between ${gc.bg} hover:brightness-95 transition-all text-left`}>
                                    <div className="flex items-center gap-5">
                                        <div className={`p-4 rounded-2xl shadow-lg border-2 border-white ${gc.badge}`}>{gc.icon}</div>
                                        <div>
                                            <div className={`font-black text-lg uppercase tracking-tight leading-none mb-1 ${gc.text}`}>{grupo}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{items.length} actividades disponibles</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Carga Global</div>
                                            <div className={`text-xl font-black ${gc.text}`}>{items.reduce((s, t) => s + t.puntos, 0).toFixed(2)} <span className="text-[10px] opacity-60">PTS</span></div>
                                        </div>
                                        <div className={`p-2 rounded-xl bg-white border ${gc.border} text-slate-400 transition-transform duration-300 ${abierto ? 'rotate-180' : ''}`}>
                                            <ChevronDown size={18} />
                                        </div>
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
                                                        {tarifa.mapeo?.con_preco && (
                                                            <span className="text-[8px] font-bold bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded" title="Con Preco / Venta">
                                                                PRECO={tarifa.mapeo.con_preco}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Puntos */}
                                                     <div className="w-24 text-right flex-shrink-0">
                                                         <div className="inline-flex flex-col items-end">
                                                            <div className="text-[14px] font-black text-emerald-600 leading-none">{tarifa.puntos}</div>
                                                            <div className="text-[7px] font-black text-emerald-400 uppercase tracking-widest mt-0.5">PTS BAREMO</div>
                                                         </div>
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

            {/* ═══ SECCIÓN DE NEGOCIO: METAS & BAREMOS ═══ */}
            <div className="mt-16 mb-20">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-4 bg-slate-900 rounded-[1.5rem] shadow-xl text-white">
                        <Target size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-1">Configuración de Negocio</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Metas globales y Valorización por cliente</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-stretch">
                    
                    {/* Meta de Producción — Card Dark Premium (Como en la foto) */}
                    <div className="xl:col-span-4 h-full">
                        <div className="bg-[#0f172a] rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group h-full flex flex-col justify-between border border-white/5">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                            
                            <div>
                                <div className="flex items-center justify-between mb-8">
                                    <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
                                        <TrendingUp size={20} />
                                    </div>
                                    <label className="text-[10px] font-black text-emerald-400/80 uppercase tracking-[0.2em]">Meta Diaria (PTS)</label>
                                </div>

                                <div className="flex justify-center mb-8 relative">
                                    <div className="absolute inset-0 bg-emerald-500/5 blur-2xl rounded-full" />
                                    <input
                                        type="number"
                                        value={metaConfig.metaProduccionDia}
                                        onChange={e => setMetaConfig(prev => ({ ...prev, metaProduccionDia: parseFloat(e.target.value) || 0 }))}
                                        step="0.5"
                                        className="relative w-full max-w-[200px] bg-emerald-500/5 border-2 border-emerald-500/20 rounded-[2rem] py-8 text-6xl font-black text-white text-center outline-none focus:border-emerald-500/50 transition-all shadow-inner tabular-nums"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-8">
                                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Días/Sem</span>
                                        <select
                                            value={metaConfig.diasLaboralesSemana}
                                            onChange={e => setMetaConfig(prev => ({ ...prev, diasLaboralesSemana: parseInt(e.target.value) }))}
                                            className="w-full bg-transparent text-sm font-black text-slate-300 outline-none appearance-none cursor-pointer"
                                        >
                                            <option value={5}>5 Días</option>
                                            <option value={6}>6 Días</option>
                                            <option value={7}>7 Días</option>
                                        </select>
                                    </div>
                                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Días/Mes</span>
                                        <input
                                            type="number"
                                            value={metaConfig.diasLaboralesMes}
                                            onChange={e => setMetaConfig(prev => ({ ...prev, diasLaboralesMes: parseInt(e.target.value) || 22 }))}
                                            className="w-full bg-transparent text-sm font-black text-slate-300 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3 pt-6 border-t border-white/5">
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Semanal</span>
                                        <span className="text-xl font-black text-white tabular-nums">{(metaConfig.metaProduccionDia * metaConfig.diasLaboralesSemana).toFixed(1)} <span className="text-[10px] opacity-40">PTS</span></span>
                                    </div>
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Mensual</span>
                                        <span className="text-xl font-black text-emerald-400 tabular-nums">{(metaConfig.metaProduccionDia * metaConfig.diasLaboralesMes).toFixed(1)} <span className="text-[10px] opacity-40">PTS</span></span>
                                    </div>
                                </div>
                            </div>

                            <button onClick={guardarMeta} disabled={savingMeta}
                                className="w-full mt-10 py-5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2">
                                {savingMeta ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Actualizar Meta
                            </button>
                        </div>
                    </div>

                    {/* Baremos por Cliente — Grid de Cards */}
                    <div className="xl:col-span-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {clientesBaremos.map((cb) => (
                                <div key={cb._id} className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/20 relative group overflow-hidden flex flex-col justify-between">
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-xl shadow-lg transition-transform group-hover:scale-110" style={{ backgroundColor: cb.color || '#10b981' }}>
                                                {cb.cliente?.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-slate-900 tracking-tighter uppercase leading-none mb-1">{cb.cliente}</h3>
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{cb.proyecto || 'General'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => { setEditCliente(cb._id); setFormCliente(cb); setShowModalCliente(true); }} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-blue-600 transition-colors">
                                                <Edit3 size={16} />
                                            </button>
                                            <button onClick={() => eliminarCliente(cb._id, cb.cliente)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-red-500 transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 rounded-[2rem] p-6 mb-6 border border-slate-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Valor por Punto</span>
                                            <div className={`px-2 py-0.5 rounded-full text-[8px] font-black border ${cb.activo ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                                                {cb.activo ? 'VIGENTE' : 'DESACTIVADO'}
                                            </div>
                                        </div>
                                        <div className="text-3xl font-black text-slate-900 tracking-tighter flex items-center justify-center py-2">
                                            <span className="text-sm text-slate-300 mr-1 opacity-60">$</span>
                                            {cb.valor_punto?.toLocaleString('es-CL')}
                                            <span className="text-[10px] text-slate-400 ml-2 font-bold uppercase tracking-widest">{cb.moneda}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        <Calculator size={14} className="opacity-40" />
                                        <span>7.5 pts = <span className="text-slate-900">${(7.5 * cb.valor_punto).toLocaleString('es-CL')}</span></span>
                                        <div className="h-3 w-px bg-slate-200 mx-1" />
                                        <span>IVA: <span className={cb.iva_incluido ? 'text-emerald-500' : 'text-slate-600'}>{cb.iva_incluido ? 'INC.' : '+ 19%'}</span></span>
                                        {(cb.retencion > 0) && <>
                                            <div className="h-3 w-px bg-slate-200 mx-1" />
                                            <span>Ret: <span className="text-amber-500">{cb.retencion}%</span></span>
                                        </>}
                                    </div>
                                </div>
                            ))}

                            {/* Botón Nueva Tarifa Cliente */}
                            <button 
                                onClick={() => { setEditCliente(null); setFormCliente({ cliente: '', proyecto: '', valor_punto: 0, retencion: 0, moneda: 'CLP', activo: true, color: '#10b981' }); setShowModalCliente(true); }}
                                className="bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center gap-4 hover:bg-white hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 transition-all group"
                            >
                                <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                                    <Plus size={32} />
                                </div>
                                <div className="text-center">
                                    <span className="block text-sm font-black text-slate-600 group-hover:text-slate-900 uppercase tracking-tighter">Nuevo Baremo Cliente</span>
                                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Configura precio por punto</span>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ MODAL CLIENTE ═══ */}
            {showModalCliente && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">
                        <div className="bg-slate-900 p-8 text-white flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/10 rounded-2xl">
                                    {editCliente ? <Edit3 size={20} /> : <Plus size={20} />}
                                </div>
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tighter">{editCliente ? 'Editar Baremo' : 'Nuevo Baremo'}</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Valorización por Punto Cliente</p>
                                </div>
                            </div>
                            <button onClick={() => setShowModalCliente(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <form onSubmit={guardarCliente} className="p-10 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Nombre Cliente</label>
                                    <input type="text" required value={formCliente.cliente} onChange={e => setFormCliente({ ...formCliente, cliente: e.target.value.toUpperCase() })} placeholder="Ej: MOVISTAR"
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-black text-slate-800 outline-none focus:ring-4 focus:ring-slate-900/5 transition-all" />
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Proyecto (Opcional)</label>
                                    <input type="text" value={formCliente.proyecto} onChange={e => setFormCliente({ ...formCliente, proyecto: e.target.value })} placeholder="Ej: Residencial"
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-black text-slate-800 outline-none focus:ring-4 focus:ring-slate-900/5 transition-all" />
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Color</label>
                                    <div className="flex items-center gap-2">
                                        <input type="color" value={formCliente.color} onChange={e => setFormCliente({ ...formCliente, color: e.target.value })}
                                            className="w-12 h-12 rounded-xl border border-slate-100 cursor-pointer overflow-hidden p-0" />
                                        <span className="text-[10px] font-bold text-slate-400 font-mono">{formCliente.color}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Valor Punto ($)</label>
                                    <input type="number" step="0.01" required value={formCliente.valor_punto} onChange={e => setFormCliente({ ...formCliente, valor_punto: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xl font-black text-emerald-400 outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all tabular-nums" />
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Retención (%)</label>
                                    <input type="number" step="0.1" min="0" max="100" value={formCliente.retencion ?? 0} onChange={e => setFormCliente({ ...formCliente, retencion: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-amber-950 border border-amber-800 rounded-2xl p-4 text-xl font-black text-amber-400 outline-none focus:ring-4 focus:ring-amber-500/10 transition-all tabular-nums" />
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">IVA Incluido</label>
                                    <button type="button" onClick={() => setFormCliente({ ...formCliente, iva_incluido: !formCliente.iva_incluido })}
                                        className={`w-full h-[60px] flex items-center justify-center gap-3 rounded-2xl border-2 transition-all font-black text-xs uppercase
                                            ${formCliente.iva_incluido ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                        <span className={`w-3 h-3 rounded-full ${formCliente.iva_incluido ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                        {formCliente.iva_incluido ? 'Neto' : '+ IVA 19%'}
                                    </button>
                                </div>
                            </div>

                            <div className="pt-6 flex gap-3">
                                <button type="button" onClick={() => setShowModalCliente(false)} className="flex-1 py-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
                                <button type="submit" disabled={saving} className="flex-[2] bg-slate-900 hover:bg-slate-800 text-white rounded-[1.5rem] py-4 text-[11px] font-black uppercase tracking-widest shadow-xl shadow-slate-200 transition-all flex items-center justify-center gap-2">
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                                    {editCliente ? 'Guardar Cambios' : 'Crear Baremo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConfigLPU;

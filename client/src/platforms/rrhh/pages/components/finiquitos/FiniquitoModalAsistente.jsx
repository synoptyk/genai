import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, AlertCircle, CheckCircle, Calculator, UserMinus, Search } from 'lucide-react';
import { candidatosApi } from '../../../rrhhApi';
import { useIndicadores } from '../../../../../contexts/IndicadoresContext';
import SearchableSelect from '../../../../../components/SearchableSelect';

const MOTIVOS = [
    'Renuncia voluntaria (Art. 159 N°2)',
    'Mutuo acuerdo (Art. 159 N°1)',
    'Vencimiento del plazo (Art. 159 N°4)',
    'Necesidades de la empresa (Art. 161)',
    'Caso fortuito o fuerza mayor (Art. 159 N°6)',
    'Falta de probidad (Art. 160)',
    'Abandono del trabajo (Art. 160 N°4)',
    'Otro',
];

const EMPTY_DATA = {
    fechaEgreso: '',
    fechaNotificacion: '',
    causalTermino: '',
    sueldoBaseFijo: 0,
    promedioSueldoVariable: 0,
    colacion: 0,
    movilizacion: 0,
    gratificacion: 0,
    valorUF: 38500,
    diasVacacionesTomados: 0,
    diasVacacionesProgresivas: 0,
    pagarDiasProporcionales: false,
    diasTrabajadosMes: 0,
    descuentoPrestamoCaja: 0,
    descuentoPrestamoEmpresa: 0,
    descuentoAnticipos: 0,
    descuentoAfpProporcional: '',
    descuentoSaludProporcional: '',
    descuentoAfcProporcional: '',
    descuentoSeguroColectivo: 0,
    descuentoEquiposNoDevueltos: 0,
    indemnizacionVoluntaria: 0,
    aguinaldosOtros: 0,
    montoAFC: 0,
    otrosDescuentos: 0,
    otrosHaberes: 0,
    excluirAviso: false,
    observacionesReservas: '',
    procesadoEn: 'Modulo',
    notariaNombre: '',
    notariaFechaFirma: '',
    notariaGastos: 0,
    notariaPagadoPor: 'Empleador',
    notariaEstado: 'Pendiente',
};

const fmt = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

const Field = ({ label, children, note }) => (
    <div>
        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">{label}</label>
        {children}
        {note && <p className="mt-1 text-[9px] text-slate-400 font-medium">{note}</p>}
    </div>
);

const Input = ({ value, onChange, type = 'number', ...rest }) => (
    <input
        type={type}
        value={value}
        onChange={onChange}
        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 bg-white"
        {...rest}
    />
);

const FiniquitoModalAsistente = ({
    isOpen,
    onClose,
    initialTarget = null,
    isEditing = false,
    contratados = [],
    ufValue,
    onSuccess,
}) => {
    const { ufValue: contextUf } = useIndicadores();
    const currentUf = ufValue || contextUf || 38500;

    const [target, setTarget] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [data, setData] = useState({ ...EMPTY_DATA, valorUF: currentUf });
    const [calcPreview, setCalcPreview] = useState(null);
    const [calcLoading, setCalcLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [tab, setTab] = useState('datos'); // 'datos' | 'descuentos' | 'notaria'

    // Initialize when modal opens / initialTarget changes
    useEffect(() => {
        if (!isOpen) return;
        setTab('datos');
        setCalcPreview(null);

        if (initialTarget) {
            setTarget(initialTarget);
            setSearchTerm(initialTarget.fullName || '');
            if (isEditing) {
                const fd = initialTarget.finiquitoDetalle || {};
                const vacsTomadas = fd.diasVacacionesTomados || 0;
                let fechaEgresoFormateada = '';
                if (fd.fechaEgreso) fechaEgresoFormateada = new Date(fd.fechaEgreso).toISOString().split('T')[0];
                else if (initialTarget.fechaFiniquito) fechaEgresoFormateada = new Date(initialTarget.fechaFiniquito).toISOString().split('T')[0];
                setData({
                    fechaEgreso: fechaEgresoFormateada,
                    fechaNotificacion: fd.fechaNotificacion ? new Date(fd.fechaNotificacion).toISOString().split('T')[0] : '',
                    causalTermino: fd.causalTermino || initialTarget.finiquitoMotivo || '',
                    sueldoBaseFijo: fd.sueldoBaseFijo ?? (initialTarget.sueldoBase || 0),
                    promedioSueldoVariable: fd.promedioSueldoVariable || 0,
                    colacion: fd.colacion || 0,
                    movilizacion: fd.movilizacion || 0,
                    gratificacion: fd.gratificacion ?? Math.min(Math.round((initialTarget.sueldoBase || 0) * 0.25), 197917),
                    valorUF: fd.valorUF || currentUf,
                    diasVacacionesTomados: vacsTomadas,
                    diasVacacionesProgresivas: fd.diasVacacionesProgresivas || 0,
                    pagarDiasProporcionales: fd.pagarDiasProporcionales || false,
                    diasTrabajadosMes: fd.diasTrabajadosMes || 0,
                    descuentoPrestamoCaja: fd.descuentoPrestamoCaja || 0,
                    descuentoPrestamoEmpresa: fd.descuentoPrestamoEmpresa || 0,
                    descuentoAnticipos: fd.descuentoAnticipos || 0,
                    descuentoAfpProporcional: fd.descuentoAfpProporcional ?? '',
                    descuentoSaludProporcional: fd.descuentoSaludProporcional ?? '',
                    descuentoAfcProporcional: fd.descuentoAfcProporcional ?? '',
                    descuentoSeguroColectivo: fd.descuentoSeguroColectivo || 0,
                    descuentoEquiposNoDevueltos: fd.descuentoEquiposNoDevueltos || 0,
                    indemnizacionVoluntaria: fd.indemnizacionVoluntaria || 0,
                    aguinaldosOtros: fd.aguinaldosOtros || 0,
                    montoAFC: fd.descuentoAFC || 0,
                    otrosDescuentos: fd.otrosDescuentos || 0,
                    otrosHaberes: fd.otrosHaberes || 0,
                    excluirAviso: fd.excluirAviso || false,
                    observacionesReservas: fd.observacionesReservas || '',
                    procesadoEn: fd.procesadoEn || 'Modulo',
                    notariaNombre: fd.notariaNombre || '',
                    notariaFechaFirma: fd.notariaFechaFirma ? new Date(fd.notariaFechaFirma).toISOString().split('T')[0] : '',
                    notariaGastos: fd.notariaGastos || 0,
                    notariaPagadoPor: fd.notariaPagadoPor || 'Empleador',
                    notariaEstado: fd.notariaEstado || 'Pendiente',
                });
            } else {
                // New finiquito for a contratado
                const c = initialTarget;
                const vacsTomadas = (c.vacaciones || [])
                    .filter(v => v.estado === 'Aprobado' && v.tipo === 'Vacaciones')
                    .reduce((sum, v) => sum + (Number(v.diasHabiles) || 0), 0);
                const defaultGrat = Math.min(Math.round((c.sueldoBase || 0) * 0.25), 197917);
                setData({ ...EMPTY_DATA, sueldoBaseFijo: c.sueldoBase || 0, gratificacion: defaultGrat, valorUF: currentUf, diasVacacionesTomados: vacsTomadas });
            }
        } else {
            setTarget(null);
            setSearchTerm('');
            setData({ ...EMPTY_DATA, valorUF: currentUf });
        }
    }, [isOpen, initialTarget, isEditing]);

    const set = (field) => (e) => {
        const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setData(d => ({ ...d, [field]: val }));
    };

    const handleSelectCandidato = (c) => {
        setTarget(c);
        setSearchTerm(c.fullName);
        const vacsTomadas = (c.vacaciones || [])
            .filter(v => v.estado === 'Aprobado' && v.tipo === 'Vacaciones')
            .reduce((sum, v) => sum + (Number(v.diasHabiles) || 0), 0);
        const defaultGrat = Math.min(Math.round((c.sueldoBase || 0) * 0.25), 197917);
        setData({ ...EMPTY_DATA, sueldoBaseFijo: c.sueldoBase || 0, gratificacion: defaultGrat, valorUF: currentUf, diasVacacionesTomados: vacsTomadas });
        setCalcPreview(null);
    };

    // Auto-set excluirAviso for Art.161
    useEffect(() => {
        if (data.causalTermino?.includes('161') && data.fechaEgreso && data.fechaNotificacion) {
            const diff = Math.round((new Date(data.fechaEgreso) - new Date(data.fechaNotificacion)) / 86400000);
            setData(d => ({ ...d, excluirAviso: diff >= 30 }));
        }
    }, [data.fechaEgreso, data.fechaNotificacion, data.causalTermino]);

    // Reset AFC fields when causal changes away from 161
    useEffect(() => {
        if (data.causalTermino && !data.causalTermino.includes('161')) {
            setData(d => ({ ...d, montoAFC: 0, excluirAviso: true, fechaNotificacion: '' }));
        }
    }, [data.causalTermino]);

    // Debounced real-time calculation
    useEffect(() => {
        if (!target || !data.fechaEgreso || !data.causalTermino) { setCalcPreview(null); return; }
        const t = setTimeout(async () => {
            setCalcLoading(true);
            try {
                const resp = await candidatosApi.calcularFiniquito(target._id, {
                    fechaEgreso: data.fechaEgreso,
                    fechaNotificacion: data.fechaNotificacion || null,
                    causalTermino: data.causalTermino,
                    diasVacacionesTomados: Number(data.diasVacacionesTomados || 0),
                    diasVacacionesProgresivas: Number(data.diasVacacionesProgresivas || 0),
                    sueldoBaseFijo: Number(data.sueldoBaseFijo || 0),
                    promedioSueldoVariable: Number(data.promedioSueldoVariable || 0),
                    colacion: Number(data.colacion || 0),
                    movilizacion: Number(data.movilizacion || 0),
                    gratificacion: Number(data.gratificacion || 0),
                    valorUF: Number(data.valorUF || 38500),
                    montoAFC: Number(data.montoAFC || 0),
                    otrosDescuentos: Number(data.otrosDescuentos || 0),
                    otrosHaberes: Number(data.otrosHaberes || 0),
                    excluirAviso: data.excluirAviso || false,
                    pagarDiasProporcionales: data.pagarDiasProporcionales || false,
                    diasTrabajadosMes: Number(data.diasTrabajadosMes || 0),
                    descuentoPrestamoCaja: Number(data.descuentoPrestamoCaja || 0),
                    descuentoPrestamoEmpresa: Number(data.descuentoPrestamoEmpresa || 0),
                    descuentoAnticipos: Number(data.descuentoAnticipos || 0),
                    descuentoAfpProporcional: data.descuentoAfpProporcional === '' ? null : Number(data.descuentoAfpProporcional),
                    descuentoSaludProporcional: data.descuentoSaludProporcional === '' ? null : Number(data.descuentoSaludProporcional),
                    descuentoAfcProporcional: data.descuentoAfcProporcional === '' ? null : Number(data.descuentoAfcProporcional),
                    descuentoSeguroColectivo: Number(data.descuentoSeguroColectivo || 0),
                    descuentoEquiposNoDevueltos: Number(data.descuentoEquiposNoDevueltos || 0),
                    indemnizacionVoluntaria: Number(data.indemnizacionVoluntaria || 0),
                    aguinaldosOtros: Number(data.aguinaldosOtros || 0),
                });
                setCalcPreview(resp.data);
            } catch (err) {
                console.error('Error calculando:', err);
            } finally {
                setCalcLoading(false);
            }
        }, 350);
        return () => clearTimeout(t);
    }, [
        target, data.fechaEgreso, data.fechaNotificacion, data.causalTermino,
        data.diasVacacionesTomados, data.diasVacacionesProgresivas, data.sueldoBaseFijo,
        data.promedioSueldoVariable, data.colacion, data.movilizacion, data.gratificacion,
        data.valorUF, data.montoAFC, data.otrosDescuentos, data.otrosHaberes,
        data.excluirAviso, data.pagarDiasProporcionales, data.diasTrabajadosMes,
        data.descuentoPrestamoCaja, data.descuentoPrestamoEmpresa, data.descuentoAnticipos,
        data.descuentoAfpProporcional, data.descuentoSaludProporcional, data.descuentoAfcProporcional,
        data.descuentoSeguroColectivo, data.descuentoEquiposNoDevueltos,
        data.indemnizacionVoluntaria, data.aguinaldosOtros,
    ]);

    const handleGuardar = async () => {
        if (!target) return alert('Selecciona un colaborador.');
        if (!data.fechaEgreso) return alert('Ingresa la fecha de egreso.');
        if (!data.causalTermino) return alert('Selecciona la causal de término.');
        if (!calcPreview) return alert('Por favor, espera la previsualización del cálculo.');

        setSaving(true);
        try {
            const payload = {
                finiquitoDetalle: {
                    fechaIngresoReal: calcPreview.fechaIngresoReal,
                    fechaEgreso: calcPreview.fechaEgreso,
                    fechaNotificacion: calcPreview.fechaNotificacion || null,
                    warnings: calcPreview.warnings || [],
                    causalTermino: data.causalTermino,
                    sueldoBaseFijo: Number(data.sueldoBaseFijo),
                    promedioSueldoVariable: Number(data.promedioSueldoVariable),
                    colacion: Number(data.colacion),
                    movilizacion: Number(data.movilizacion),
                    gratificacion: Number(data.gratificacion),
                    valorUF: Number(data.valorUF),
                    diasVacacionesTomados: Number(data.diasVacacionesTomados),
                    diasVacacionesProgresivas: Number(data.diasVacacionesProgresivas),
                    diasVacacionesHabilesCalculados: calcPreview.feriadoProporcional?.pendientesHabiles,
                    diasVacacionesCorridosCalculados: calcPreview.feriadoProporcional?.diasCorridosCalculados,
                    montoFeriadoProporcional: calcPreview.feriadoProporcional?.monto,
                    aniosServicioCalculados: calcPreview.indemnizaciones?.aniosServicioCalculados,
                    montoIndemnizacionAnos: calcPreview.indemnizaciones?.montoIAS,
                    montoIndemnizacionAviso: calcPreview.indemnizaciones?.montoISAP,
                    descuentoAFC: calcPreview.indemnizaciones?.descuentoAFC,
                    pagarDiasProporcionales: data.pagarDiasProporcionales,
                    diasTrabajadosMes: Number(data.diasTrabajadosMes),
                    montoSueldoProporcional: calcPreview.diasProporcionales?.montoSueldoProporcional || 0,
                    montoColacionProporcional: calcPreview.diasProporcionales?.montoColacionProporcional || 0,
                    montoMovilizacionProporcional: calcPreview.diasProporcionales?.montoMovilizacionProporcional || 0,
                    montoGratificacionProporcional: calcPreview.diasProporcionales?.montoGratificacionProporcional || 0,
                    indemnizacionVoluntaria: Number(data.indemnizacionVoluntaria),
                    aguinaldosOtros: Number(data.aguinaldosOtros),
                    descuentoPrestamoCaja: Number(data.descuentoPrestamoCaja),
                    descuentoPrestamoEmpresa: Number(data.descuentoPrestamoEmpresa),
                    descuentoAnticipos: Number(data.descuentoAnticipos),
                    descuentoAfpProporcional: calcPreview.descuentosDetallados?.descuentoAfpProporcional || 0,
                    descuentoSaludProporcional: calcPreview.descuentosDetallados?.descuentoSaludProporcional || 0,
                    descuentoAfcProporcional: calcPreview.descuentosDetallados?.descuentoAfcProporcional || 0,
                    descuentoSeguroColectivo: Number(data.descuentoSeguroColectivo),
                    descuentoEquiposNoDevueltos: Number(data.descuentoEquiposNoDevueltos),
                    otrosHaberes: Number(data.otrosHaberes),
                    otrosDescuentos: Number(data.otrosDescuentos),
                    netoFiniquito: calcPreview.netoFiniquito,
                    excluirAviso: calcPreview.excluirAviso,
                    observacionesReservas: data.observacionesReservas,
                    procesadoEn: data.procesadoEn,
                    notariaNombre: data.procesadoEn === 'Notaria' ? data.notariaNombre : '',
                    notariaFechaFirma: data.procesadoEn === 'Notaria' ? data.notariaFechaFirma : null,
                    notariaGastos: data.procesadoEn === 'Notaria' ? Number(data.notariaGastos || 0) : 0,
                    notariaPagadoPor: data.procesadoEn === 'Notaria' ? data.notariaPagadoPor : 'Empleador',
                    notariaEstado: data.procesadoEn === 'Notaria' ? data.notariaEstado : 'Pendiente',
                },
            };
            await candidatosApi.guardarFiniquito(target._id, payload);
            alert(isEditing ? 'Finiquito modificado con éxito' : 'Finiquito registrado con éxito');
            onSuccess?.();
        } catch (err) {
            console.error(err);
            alert('Error al guardar el finiquito.');
        } finally {
            setSaving(false);
        }
    };

    const filteredContratados = contratados.filter(c => {
        if (!searchTerm || target) return true;
        return [c.fullName, c.rut, c.position].filter(Boolean).join(' ').toLowerCase().includes(searchTerm.toLowerCase());
    });

    if (!isOpen) return null;

    const is161 = data.causalTermino?.includes('161');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white w-full max-w-5xl max-h-[95vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-red-500 rounded-2xl text-white shadow-lg shadow-red-200">
                            <UserMinus size={18} />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-slate-800">
                                {isEditing ? 'Editar Finiquito' : 'Registrar Finiquito'}
                            </h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                {target ? target.fullName : 'Selecciona un colaborador'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Left: Form */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-5">
                        {/* Worker Selector */}
                        {!isEditing && (
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Colaborador *</label>
                                {target ? (
                                    <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                                        <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 font-black">
                                            {target.fullName?.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-slate-800 text-sm truncate">{target.fullName}</p>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase">{target.rut} · {target.position}</p>
                                        </div>
                                        <button onClick={() => { setTarget(null); setSearchTerm(''); setCalcPreview(null); }} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <SearchableSelect
                                            options={contratados.map(c => ({
                                                value: c._id,
                                                label: c.fullName,
                                                description: `${c.rut} · ${c.position}`
                                            }))}
                                            value={target ? target._id : ''}
                                            onChange={(id) => {
                                                if (!id) {
                                                    setTarget(null);
                                                    setSearchTerm('');
                                                    setCalcPreview(null);
                                                    return;
                                                }
                                                const c = contratados.find(x => x._id === id);
                                                if (c) handleSelectCandidato(c);
                                            }}
                                            placeholder="Buscar colaborador..."
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tabs */}
                        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                            {['datos', 'descuentos', 'notaria'].map(t => (
                                <button key={t} onClick={() => setTab(t)}
                                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                                    {t === 'datos' ? 'Datos Básicos' : t === 'descuentos' ? 'Haberes / Descuentos' : 'Notaría'}
                                </button>
                            ))}
                        </div>

                        {tab === 'datos' && (
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Fecha Egreso *">
                                    <Input type="date" value={data.fechaEgreso} onChange={set('fechaEgreso')} />
                                </Field>
                                <Field label="Causal de Término *">
                                    <select value={data.causalTermino} onChange={set('causalTermino')}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 bg-white">
                                        <option value="">Seleccionar causal...</option>
                                        {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </Field>
                                {is161 && (
                                    <Field label="Fecha Notificación (Art. 161)" note="Si ≥30 días antes del egreso, se excluye aviso previo">
                                        <Input type="date" value={data.fechaNotificacion} onChange={set('fechaNotificacion')} />
                                    </Field>
                                )}
                                <Field label="Sueldo Base Fijo ($)">
                                    <Input value={data.sueldoBaseFijo} onChange={set('sueldoBaseFijo')} min={0} />
                                </Field>
                                <Field label="Promedio Sueldo Variable ($)">
                                    <Input value={data.promedioSueldoVariable} onChange={set('promedioSueldoVariable')} min={0} />
                                </Field>
                                <Field label="Colación ($)">
                                    <Input value={data.colacion} onChange={set('colacion')} min={0} />
                                </Field>
                                <Field label="Movilización ($)">
                                    <Input value={data.movilizacion} onChange={set('movilizacion')} min={0} />
                                </Field>
                                <Field label="Gratificación ($)" note="Max 25% o 197.917 mensual">
                                    <Input value={data.gratificacion} onChange={set('gratificacion')} min={0} />
                                </Field>
                                <Field label="Valor UF ($)">
                                    <Input value={data.valorUF} onChange={set('valorUF')} min={0} />
                                </Field>
                                <Field label="Días Vacaciones Tomados">
                                    <Input value={data.diasVacacionesTomados} onChange={set('diasVacacionesTomados')} min={0} />
                                </Field>
                                <Field label="Días Vacaciones Progresivas">
                                    <Input value={data.diasVacacionesProgresivas} onChange={set('diasVacacionesProgresivas')} min={0} />
                                </Field>
                                <div className="col-span-2 flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <input type="checkbox" id="prop-check" checked={data.pagarDiasProporcionales} onChange={set('pagarDiasProporcionales')} className="w-4 h-4 rounded accent-violet-600" />
                                    <label htmlFor="prop-check" className="text-xs font-bold text-slate-700 cursor-pointer">Pagar días proporcionales del mes</label>
                                    {data.pagarDiasProporcionales && (
                                        <div className="ml-auto flex items-center gap-2">
                                            <span className="text-[10px] text-slate-400 font-bold">Días trabajados:</span>
                                            <input type="number" value={data.diasTrabajadosMes} onChange={set('diasTrabajadosMes')} min={0} max={31}
                                                className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-xs text-center focus:outline-none focus:ring-2 focus:ring-violet-200" />
                                        </div>
                                    )}
                                </div>
                                {is161 && (
                                    <div className="col-span-2 flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                                        <input type="checkbox" id="aviso-check" checked={data.excluirAviso} onChange={set('excluirAviso')} className="w-4 h-4 rounded accent-amber-600" />
                                        <label htmlFor="aviso-check" className="text-xs font-bold text-amber-800 cursor-pointer">Excluir indemnización por aviso previo (Art.161)</label>
                                    </div>
                                )}
                                {is161 && (
                                    <Field label="Monto AFC ($)" note="Fondo de cesantía">
                                        <Input value={data.montoAFC} onChange={set('montoAFC')} min={0} />
                                    </Field>
                                )}
                                <div className="col-span-2">
                                    <Field label="Observaciones / Reservas">
                                        <textarea value={data.observacionesReservas} onChange={set('observacionesReservas')} rows={3}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 resize-none" />
                                    </Field>
                                </div>
                            </div>
                        )}

                        {tab === 'descuentos' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 text-[9px] font-black uppercase tracking-widest text-violet-600 flex items-center gap-2 pb-1 border-b border-violet-100">
                                    ▸ Haberes Adicionales
                                </div>
                                <Field label="Indemnización Voluntaria ($)">
                                    <Input value={data.indemnizacionVoluntaria} onChange={set('indemnizacionVoluntaria')} min={0} />
                                </Field>
                                <Field label="Aguinaldos y Otros ($)">
                                    <Input value={data.aguinaldosOtros} onChange={set('aguinaldosOtros')} min={0} />
                                </Field>
                                <Field label="Otros Haberes ($)">
                                    <Input value={data.otrosHaberes} onChange={set('otrosHaberes')} min={0} />
                                </Field>
                                <div className="col-span-2 text-[9px] font-black uppercase tracking-widest text-rose-600 flex items-center gap-2 pb-1 border-b border-rose-100 mt-2">
                                    ▸ Descuentos
                                </div>
                                <Field label="Préstamo Caja ($)">
                                    <Input value={data.descuentoPrestamoCaja} onChange={set('descuentoPrestamoCaja')} min={0} />
                                </Field>
                                <Field label="Préstamo Empresa ($)">
                                    <Input value={data.descuentoPrestamoEmpresa} onChange={set('descuentoPrestamoEmpresa')} min={0} />
                                </Field>
                                <Field label="Anticipos ($)">
                                    <Input value={data.descuentoAnticipos} onChange={set('descuentoAnticipos')} min={0} />
                                </Field>
                                <Field label="Seguro Colectivo ($)">
                                    <Input value={data.descuentoSeguroColectivo} onChange={set('descuentoSeguroColectivo')} min={0} />
                                </Field>
                                <Field label="Equipos No Devueltos ($)">
                                    <Input value={data.descuentoEquiposNoDevueltos} onChange={set('descuentoEquiposNoDevueltos')} min={0} />
                                </Field>
                                <Field label="Otros Descuentos ($)">
                                    <Input value={data.otrosDescuentos} onChange={set('otrosDescuentos')} min={0} />
                                </Field>
                                <div className="col-span-2 text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 pb-1 border-b border-slate-100 mt-2">
                                    ▸ Override Descuentos Proporcionales (dejar vacío para calcular automáticamente)
                                </div>
                                <Field label="AFP Proporcional Override ($)">
                                    <Input value={data.descuentoAfpProporcional} onChange={set('descuentoAfpProporcional')} min={0} placeholder="Auto" />
                                </Field>
                                <Field label="Salud Proporcional Override ($)">
                                    <Input value={data.descuentoSaludProporcional} onChange={set('descuentoSaludProporcional')} min={0} placeholder="Auto" />
                                </Field>
                                <Field label="AFC Proporcional Override ($)">
                                    <Input value={data.descuentoAfcProporcional} onChange={set('descuentoAfcProporcional')} min={0} placeholder="Auto" />
                                </Field>
                            </div>
                        )}

                        {tab === 'notaria' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <Field label="Procesado En">
                                        <div className="flex gap-2">
                                            {['Modulo', 'Notaria'].map(opt => (
                                                <button key={opt} onClick={() => setData(d => ({ ...d, procesadoEn: opt }))}
                                                    className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 ${data.procesadoEn === opt ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-500 border-slate-200 hover:border-violet-200'}`}>
                                                    {opt === 'Modulo' ? '📁 Módulo Interno' : '🏛️ Notaría'}
                                                </button>
                                            ))}
                                        </div>
                                    </Field>
                                </div>
                                {data.procesadoEn === 'Notaria' && (
                                    <>
                                        <div className="col-span-2">
                                            <Field label="Nombre Notaría">
                                                <Input type="text" value={data.notariaNombre} onChange={set('notariaNombre')} placeholder="Ej: Notaría de Santiago" />
                                            </Field>
                                        </div>
                                        <Field label="Fecha Firma Notaría">
                                            <Input type="date" value={data.notariaFechaFirma} onChange={set('notariaFechaFirma')} />
                                        </Field>
                                        <Field label="Gastos Notariales ($)">
                                            <Input value={data.notariaGastos} onChange={set('notariaGastos')} min={0} />
                                        </Field>
                                        <Field label="Pagado Por">
                                            <select value={data.notariaPagadoPor} onChange={set('notariaPagadoPor')}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 bg-white">
                                                <option value="Empleador">Empleador</option>
                                                <option value="Trabajador">Trabajador</option>
                                                <option value="Compartido">Compartido</option>
                                            </select>
                                        </Field>
                                        <Field label="Estado Notaría">
                                            <select value={data.notariaEstado} onChange={set('notariaEstado')}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 bg-white">
                                                <option value="Pendiente">Pendiente</option>
                                                <option value="En Notaria">En Notaría</option>
                                                <option value="Firmado">Firmado</option>
                                                <option value="Rechazado">Rechazado</option>
                                            </select>
                                        </Field>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right: Calc Preview */}
                    <div className="w-72 xl:w-80 border-l border-slate-100 bg-slate-50/70 p-5 overflow-y-auto flex-shrink-0">
                        <div className="flex items-center gap-2 mb-4">
                            <Calculator size={16} className="text-violet-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Previsualización</span>
                            {calcLoading && <Loader2 size={12} className="animate-spin text-violet-500 ml-auto" />}
                        </div>

                        {!target || !data.fechaEgreso || !data.causalTermino ? (
                            <div className="text-center py-8 text-slate-300">
                                <Calculator size={32} className="mx-auto mb-3" />
                                <p className="text-[10px] font-bold">Completa los datos básicos para ver el cálculo</p>
                            </div>
                        ) : calcLoading ? (
                            <div className="flex flex-col items-center py-8 gap-3">
                                <Loader2 className="animate-spin text-violet-400" size={28} />
                                <p className="text-[10px] font-bold text-slate-400">Calculando...</p>
                            </div>
                        ) : calcPreview ? (
                            <div className="space-y-3">
                                {/* Warnings */}
                                {calcPreview.warnings?.length > 0 && (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                                        {calcPreview.warnings.map((w, i) => (
                                            <div key={i} className="flex gap-1.5 items-start">
                                                <AlertCircle size={11} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                                <span className="text-[9px] font-bold text-amber-700">{w}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Summary rows */}
                                {[
                                    { label: 'Antigüedad', val: `${calcPreview.indemnizaciones?.aniosServicioCalculados || 0} años` },
                                    { label: 'Indem. Años Servicio', val: fmt(calcPreview.indemnizaciones?.montoIAS) },
                                    { label: 'Indem. Aviso Previo', val: fmt(calcPreview.indemnizaciones?.montoISAP) },
                                    { label: 'Feriado Proporcional', val: fmt(calcPreview.feriadoProporcional?.monto) },
                                    { label: 'Días vacac. háb.', val: calcPreview.feriadoProporcional?.pendientesHabiles },
                                    { label: 'AFC Descuento', val: fmt(calcPreview.indemnizaciones?.descuentoAFC) },
                                ].map((r, i) => (
                                    <div key={i} className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0">
                                        <span className="text-[9px] font-bold text-slate-500">{r.label}</span>
                                        <span className="text-[10px] font-black text-slate-800">{r.val}</span>
                                    </div>
                                ))}

                                {calcPreview.diasProporcionales && data.pagarDiasProporcionales && (
                                    <div className="p-2.5 bg-violet-50 rounded-xl border border-violet-100 space-y-1.5">
                                        <p className="text-[8px] font-black uppercase text-violet-600 mb-1">Días Proporcionales</p>
                                        {[
                                            ['Sueldo', fmt(calcPreview.diasProporcionales.montoSueldoProporcional)],
                                            ['Colación', fmt(calcPreview.diasProporcionales.montoColacionProporcional)],
                                            ['Movilización', fmt(calcPreview.diasProporcionales.montoMovilizacionProporcional)],
                                            ['Gratificación', fmt(calcPreview.diasProporcionales.montoGratificacionProporcional)],
                                        ].map(([l, v]) => (
                                            <div key={l} className="flex justify-between">
                                                <span className="text-[9px] text-violet-500 font-bold">{l}</span>
                                                <span className="text-[9px] font-black text-violet-800">{v}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Neto */}
                                <div className={`mt-4 p-4 rounded-2xl text-center ${calcPreview.netoFiniquito >= 0 ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                                    <p className="text-[8px] font-black uppercase tracking-widest text-white/80 mb-1">NETO A PAGAR</p>
                                    <p className="text-2xl font-black text-white">{fmt(calcPreview.netoFiniquito)}</p>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-white">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-black uppercase tracking-wider hover:bg-slate-50 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={handleGuardar} disabled={saving || calcLoading || !calcPreview}
                        className="px-6 py-2.5 rounded-xl bg-red-500 text-white text-xs font-black uppercase tracking-wider hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-md shadow-red-200">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        {isEditing ? 'Guardar Cambios' : 'Registrar Finiquito'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FiniquitoModalAsistente;

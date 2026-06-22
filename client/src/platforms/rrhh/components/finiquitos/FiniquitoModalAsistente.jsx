import React, { useState, useEffect } from 'react';
import { Calculator, X, Search, CheckCircle, AlertCircle, Loader2, UserMinus } from 'lucide-react';
import { formatRut } from '../../../../../utils/rutUtils';
import * as candidatosApi from '../../api/candidatosApi';

const MOTIVOS = [
    'Renuncia voluntaria (Art. 159 N°2)',
    'Mutuo acuerdo (Art. 159 N°1)',
    'Vencimiento del plazo (Art. 159 N°4)',
    'Conclusión del trabajo o servicio (Art. 159 N°5)',
    'Necesidades de la empresa (Art. 161)',
    'Desahucio escrito del empleador (Art. 161)',
    'Falta de probidad / Acoso / Conducta inmoral (Art. 160 N°1)',
    'Negociaciones incompatibles (Art. 160 N°2)',
    'No concurrencia al trabajo (Art. 160 N°3)',
    'Abandono del trabajo (Art. 160 N°4)',
    'Incumplimiento grave de las obligaciones (Art. 160 N°7)'
];

const formatDateUTC = (dateVal) => {
    if (!dateVal) return '';
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return '';
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return \`\${day}/\${month}/\${year}\`;
    } catch (e) {
        return '';
    }
};

export default function FiniquitoModalAsistente({
    isOpen,
    onClose,
    initialTarget,
    isEditing,
    contratados,
    ufValue,
    onSuccess
}) {
    const [finiquitoTarget, setFiniquitoTarget] = useState(null);
    const [finiquitoData, setFiniquitoData] = useState({});
    const [contratadoSearch, setContratadoSearch] = useState('');
    const [calcPreview, setCalcPreview] = useState(null);
    const [calcLoading, setCalcLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialTarget) {
                setFiniquitoTarget(initialTarget);
                if (isEditing) {
                    const fd = initialTarget.finiquitoDetalle || {};
                    let fechaEgresoFormateada = '';
                    if (fd.fechaEgreso) {
                        fechaEgresoFormateada = new Date(fd.fechaEgreso).toISOString().split('T')[0];
                    } else if (initialTarget.fechaFiniquito) {
                        fechaEgresoFormateada = new Date(initialTarget.fechaFiniquito).toISOString().split('T')[0];
                    }
                    
                    setFiniquitoData({
                        fechaEgreso: fechaEgresoFormateada,
                        fechaNotificacion: fd.fechaNotificacion ? new Date(fd.fechaNotificacion).toISOString().split('T')[0] : '',
                        causalTermino: fd.causalTermino || initialTarget.finiquitoMotivo || '',
                        sueldoBaseFijo: fd.sueldoBaseFijo !== undefined ? fd.sueldoBaseFijo : (initialTarget.sueldoBase || 0),
                        promedioSueldoVariable: fd.promedioSueldoVariable || 0,
                        colacion: fd.colacion || 0,
                        movilizacion: fd.movilizacion || 0,
                        gratificacion: fd.gratificacion !== undefined ? fd.gratificacion : Math.min(Math.round((initialTarget.sueldoBase || 0) * 0.25), 197917),
                        valorUF: fd.valorUF || ufValue || 38500,
                        diasVacacionesTomados: fd.diasVacacionesTomados || 0,
                        diasVacacionesProgresivas: fd.diasVacacionesProgresivas || 0,
                        pagarDiasProporcionales: fd.pagarDiasProporcionales || false,
                        diasTrabajadosMes: fd.diasTrabajadosMes || 0,
                        descuentoPrestamoCaja: fd.descuentoPrestamoCaja || 0,
                        descuentoPrestamoEmpresa: fd.descuentoPrestamoEmpresa || 0,
                        descuentoAnticipos: fd.descuentoAnticipos || 0,
                        descuentoAfpProporcional: fd.descuentoAfpProporcional !== undefined ? fd.descuentoAfpProporcional : '',
                        descuentoSaludProporcional: fd.descuentoSaludProporcional !== undefined ? fd.descuentoSaludProporcional : '',
                        descuentoAfcProporcional: fd.descuentoAfcProporcional !== undefined ? fd.descuentoAfcProporcional : '',
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
                        notariaEstado: fd.notariaEstado || 'Pendiente'
                    });
                } else {
                    handleSelectCandidato(initialTarget);
                }
            } else {
                setFiniquitoTarget(null);
                setFiniquitoData({
                    fechaEgreso: '', fechaNotificacion: '', causalTermino: '', sueldoBaseFijo: 0, promedioSueldoVariable: 0,
                    colacion: 0, movilizacion: 0, gratificacion: 0, valorUF: ufValue || 38500, diasVacacionesTomados: 0,
                    diasVacacionesProgresivas: 0, montoAFC: 0, otrosDescuentos: 0, otrosHaberes: 0, excluirAviso: true,
                    pagarDiasProporcionales: false, diasTrabajadosMes: 0, descuentoPrestamoCaja: 0, descuentoPrestamoEmpresa: 0,
                    descuentoAnticipos: 0, descuentoAfpProporcional: '', descuentoSaludProporcional: '', descuentoAfcProporcional: '',
                    descuentoSeguroColectivo: 0, descuentoEquiposNoDevueltos: 0, indemnizacionVoluntaria: 0, aguinaldosOtros: 0,
                    procesadoEn: 'Modulo', notariaNombre: '', notariaFechaFirma: '', notariaGastos: 0, notariaPagadoPor: 'Empleador',
                    notariaEstado: 'Pendiente', observacionesReservas: ''
                });
                setContratadoSearch('');
            }
        }
    }, [isOpen, initialTarget, isEditing, ufValue]);

    const handleSelectCandidato = (c) => {
        setFiniquitoTarget(c);
        const vacsTomadas = (c.vacaciones || [])
            .filter(v => v.estado === 'Aprobado' && v.tipo === 'Vacaciones')
            .reduce((sum, v) => sum + (Number(v.diasHabiles) || 0), 0);
        const defaultGratificacion = Math.min(Math.round((c.sueldoBase || 0) * 0.25), 197917);
            
        setFiniquitoData({
            fechaEgreso: '', fechaNotificacion: '', causalTermino: '',
            sueldoBaseFijo: c.sueldoBase || 0, promedioSueldoVariable: 0, colacion: 0, movilizacion: 0,
            gratificacion: defaultGratificacion, valorUF: ufValue || 38500, diasVacacionesTomados: vacsTomadas,
            diasVacacionesProgresivas: 0, pagarDiasProporcionales: false, diasTrabajadosMes: 0,
            descuentoPrestamoCaja: 0, descuentoPrestamoEmpresa: 0, descuentoAnticipos: 0,
            descuentoAfpProporcional: '', descuentoSaludProporcional: '', descuentoAfcProporcional: '',
            descuentoSeguroColectivo: 0, descuentoEquiposNoDevueltos: 0, indemnizacionVoluntaria: 0,
            aguinaldosOtros: 0, montoAFC: 0, otrosDescuentos: 0, otrosHaberes: 0, excluirAviso: false,
            observacionesReservas: '', procesadoEn: 'Modulo', notariaNombre: '', notariaFechaFirma: '',
            notariaGastos: 0, notariaPagadoPor: 'Empleador', notariaEstado: 'Pendiente'
        });
        setContratadoSearch(c.fullName);
    };

    // Auto-calculate excluirAviso
    useEffect(() => {
        if (finiquitoData.causalTermino?.includes('161') && finiquitoData.fechaEgreso && finiquitoData.fechaNotificacion) {
            const fNotif = new Date(finiquitoData.fechaNotificacion);
            const fEgres = new Date(finiquitoData.fechaEgreso);
            fNotif.setHours(0,0,0,0);
            fEgres.setHours(0,0,0,0);
            const diffDays = Math.round((fEgres - fNotif) / (1000 * 60 * 60 * 24));
            if (diffDays >= 30) {
                setFiniquitoData(d => d.excluirAviso !== true ? { ...d, excluirAviso: true } : d);
            } else {
                setFiniquitoData(d => d.excluirAviso !== false ? { ...d, excluirAviso: false } : d);
            }
        }
    }, [finiquitoData.fechaEgreso, finiquitoData.fechaNotificacion, finiquitoData.causalTermino]);

    useEffect(() => {
        if (finiquitoData.causalTermino && !finiquitoData.causalTermino.includes('161')) {
            setFiniquitoData(d => {
                if (d.montoAFC !== 0 || d.excluirAviso !== true || d.fechaNotificacion !== '') {
                    return { ...d, montoAFC: 0, excluirAviso: true, fechaNotificacion: '' };
                }
                return d;
            });
        }
    }, [finiquitoData.causalTermino]);

    useEffect(() => {
        if (!finiquitoTarget || !finiquitoData.fechaEgreso || !finiquitoData.causalTermino) {
            setCalcPreview(null);
            return;
        }
        
        const delayDebounceFn = setTimeout(() => {
            const realizarCalculo = async () => {
                setCalcLoading(true);
                try {
                    const resp = await candidatosApi.calcularFiniquito(finiquitoTarget._id, {
                        ...finiquitoData,
                        diasVacacionesTomados: Number(finiquitoData.diasVacacionesTomados || 0),
                        diasVacacionesProgresivas: Number(finiquitoData.diasVacacionesProgresivas || 0),
                        sueldoBaseFijo: Number(finiquitoData.sueldoBaseFijo || 0),
                        promedioSueldoVariable: Number(finiquitoData.promedioSueldoVariable || 0),
                        colacion: Number(finiquitoData.colacion || 0),
                        movilizacion: Number(finiquitoData.movilizacion || 0),
                        gratificacion: Number(finiquitoData.gratificacion || 0),
                        valorUF: Number(finiquitoData.valorUF || 38500),
                        montoAFC: Number(finiquitoData.montoAFC || 0),
                        otrosDescuentos: Number(finiquitoData.otrosDescuentos || 0),
                        otrosHaberes: Number(finiquitoData.otrosHaberes || 0),
                        excluirAviso: finiquitoData.excluirAviso || false,
                        pagarDiasProporcionales: finiquitoData.pagarDiasProporcionales || false,
                        diasTrabajadosMes: Number(finiquitoData.diasTrabajadosMes || 0),
                        descuentoPrestamoCaja: Number(finiquitoData.descuentoPrestamoCaja || 0),
                        descuentoPrestamoEmpresa: Number(finiquitoData.descuentoPrestamoEmpresa || 0),
                        descuentoAnticipos: Number(finiquitoData.descuentoAnticipos || 0),
                        descuentoAfpProporcional: finiquitoData.descuentoAfpProporcional === '' ? null : Number(finiquitoData.descuentoAfpProporcional),
                        descuentoSaludProporcional: finiquitoData.descuentoSaludProporcional === '' ? null : Number(finiquitoData.descuentoSaludProporcional),
                        descuentoAfcProporcional: finiquitoData.descuentoAfcProporcional === '' ? null : Number(finiquitoData.descuentoAfcProporcional),
                        descuentoSeguroColectivo: Number(finiquitoData.descuentoSeguroColectivo || 0),
                        descuentoEquiposNoDevueltos: Number(finiquitoData.descuentoEquiposNoDevueltos || 0),
                        indemnizacionVoluntaria: Number(finiquitoData.indemnizacionVoluntaria || 0),
                        aguinaldosOtros: Number(finiquitoData.aguinaldosOtros || 0)
                    });
                    setCalcPreview(resp.data);
                } catch (err) {
                    console.error('Error calculando finiquito:', err);
                } finally {
                    setCalcLoading(false);
                }
            };
            realizarCalculo();
        }, 350);
        
        return () => clearTimeout(delayDebounceFn);
    }, [finiquitoTarget, finiquitoData]);

    const handleRegistrarFiniquito = async () => {
        if (!finiquitoTarget) return alert('Selecciona un colaborador.');
        if (!finiquitoData.fechaEgreso) return alert('Ingresa la fecha de egreso.');
        if (!finiquitoData.causalTermino) return alert('Selecciona la causal de término.');
        if (!calcPreview) return alert('Por favor, ingresa los parámetros y espera la previsualización del cálculo.');
        
        setSaving(true);
        try {
            const payload = {
                finiquitoDetalle: {
                    fechaIngresoReal: calcPreview.fechaIngresoReal,
                    fechaEgreso: calcPreview.fechaEgreso,
                    fechaNotificacion: calcPreview.fechaNotificacion || null,
                    warnings: calcPreview.warnings || [],
                    causalTermino: finiquitoData.causalTermino,
                    sueldoBaseFijo: Number(finiquitoData.sueldoBaseFijo),
                    promedioSueldoVariable: Number(finiquitoData.promedioSueldoVariable),
                    colacion: Number(finiquitoData.colacion),
                    movilizacion: Number(finiquitoData.movilizacion),
                    gratificacion: Number(finiquitoData.gratificacion),
                    valorUF: Number(finiquitoData.valorUF),
                    diasVacacionesTomados: Number(finiquitoData.diasVacacionesTomados),
                    diasVacacionesProgresivas: Number(finiquitoData.diasVacacionesProgresivas),
                    diasVacacionesHabilesCalculados: calcPreview.feriadoProporcional.pendientesHabiles,
                    diasVacacionesCorridosCalculados: calcPreview.feriadoProporcional.diasCorridosCalculados,
                    montoFeriadoProporcional: calcPreview.feriadoProporcional.monto,
                    aniosServicioCalculados: calcPreview.indemnizaciones.aniosServicioCalculados,
                    montoIndemnizacionAnos: calcPreview.indemnizaciones.montoIAS,
                    montoIndemnizacionAviso: calcPreview.indemnizaciones.montoISAP,
                    descuentoAFC: calcPreview.indemnizaciones.descuentoAFC,
                    pagarDiasProporcionales: finiquitoData.pagarDiasProporcionales,
                    diasTrabajadosMes: Number(finiquitoData.diasTrabajadosMes),
                    montoSueldoProporcional: calcPreview.diasProporcionales?.montoSueldoProporcional || 0,
                    montoColacionProporcional: calcPreview.diasProporcionales?.montoColacionProporcional || 0,
                    montoMovilizacionProporcional: calcPreview.diasProporcionales?.montoMovilizacionProporcional || 0,
                    montoGratificacionProporcional: calcPreview.diasProporcionales?.montoGratificacionProporcional || 0,
                    indemnizacionVoluntaria: Number(finiquitoData.indemnizacionVoluntaria),
                    aguinaldosOtros: Number(finiquitoData.aguinaldosOtros),
                    descuentoPrestamoCaja: Number(finiquitoData.descuentoPrestamoCaja),
                    descuentoPrestamoEmpresa: Number(finiquitoData.descuentoPrestamoEmpresa),
                    descuentoAnticipos: Number(finiquitoData.descuentoAnticipos),
                    descuentoAfpProporcional: calcPreview.descuentosDetallados?.descuentoAfpProporcional || 0,
                    descuentoSaludProporcional: calcPreview.descuentosDetallados?.descuentoSaludProporcional || 0,
                    descuentoAfcProporcional: calcPreview.descuentosDetallados?.descuentoAfcProporcional || 0,
                    descuentoSeguroColectivo: Number(finiquitoData.descuentoSeguroColectivo),
                    descuentoEquiposNoDevueltos: Number(finiquitoData.descuentoEquiposNoDevueltos),
                    otrosHaberes: Number(finiquitoData.otrosHaberes),
                    otrosDescuentos: Number(finiquitoData.otrosDescuentos),
                    netoFiniquito: calcPreview.netoFiniquito,
                    excluirAviso: calcPreview.excluirAviso,
                    observacionesReservas: finiquitoData.observacionesReservas,
                    procesadoEn: finiquitoData.procesadoEn,
                    notariaNombre: finiquitoData.procesadoEn === 'Notaria' ? finiquitoData.notariaNombre : '',
                    notariaFechaFirma: finiquitoData.procesadoEn === 'Notaria' ? finiquitoData.notariaFechaFirma : null,
                    notariaGastos: finiquitoData.procesadoEn === 'Notaria' ? Number(finiquitoData.notariaGastos || 0) : 0,
                    notariaPagadoPor: finiquitoData.procesadoEn === 'Notaria' ? finiquitoData.notariaPagadoPor : 'Empleador',
                    notariaEstado: finiquitoData.procesadoEn === 'Notaria' ? finiquitoData.notariaEstado : 'Pendiente'
                }
            };
            
            await candidatosApi.guardarFiniquito(finiquitoTarget._id, payload);
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('Error guardando finiquito:', error);
            alert('Error guardando finiquito');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const contratadosFiltrados = contratados.filter(c => {
        const term = contratadoSearch.toLowerCase();
        const cleanRut = c.rut ? c.rut.replace(/[^0-9kK]/gi, '') : '';
        const cleanSearch = contratadoSearch.replace(/[^0-9kK]/gi, '');
        return c.fullName?.toLowerCase().includes(term) || (cleanSearch && cleanRut.includes(cleanSearch));
    }).slice(0, 5);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl w-full max-w-6xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <Calculator size={18} className="text-red-500" />
                        <h3 className="text-lg font-black uppercase text-slate-800">
                            {isEditing ? \`Editar Finiquito — \${finiquitoTarget?.fullName}\` : 'Registrar y Calcular Finiquito'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Columna Izquierda: Parámetros del cálculo */}
                    <div className="lg:col-span-3 space-y-4 pr-0 lg:pr-4">
                        {!isEditing && (
                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60">
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Colaborador Contratado</label>
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={contratadoSearch}
                                        onChange={e => { setContratadoSearch(e.target.value); setFiniquitoTarget(null); }}
                                        placeholder="Buscar por nombre o RUT..."
                                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
                                    />
                                </div>
                                {contratadoSearch && !finiquitoTarget && (
                                    <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto bg-white shadow-lg z-10 relative">
                                        {contratadosFiltrados.length === 0 ? (
                                            <p className="text-xs text-slate-400 p-3">Sin resultados</p>
                                        ) : contratadosFiltrados.map(c => (
                                            <button
                                                key={c._id} type="button"
                                                onClick={() => handleSelectCandidato(c)}
                                                className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                                            >
                                                <p className="text-sm font-bold text-slate-800">{c.fullName}</p>
                                                <p className="text-[10px] text-slate-400 uppercase font-black">{c.rut} · {c.position}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {finiquitoTarget && (
                                    <div className="mt-3 flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                                        <CheckCircle size={14} className="text-emerald-500" />
                                        <span className="text-xs font-bold text-emerald-700">{finiquitoTarget.fullName} — {finiquitoTarget.rut}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {finiquitoTarget && (
                            <>
                                {/* Información Cargada */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60 text-xs">
                                    <div>
                                        <span className="block text-slate-400 font-bold uppercase text-[9px]">Ingreso Real</span>
                                        <span className="font-black text-slate-700">
                                            {finiquitoTarget.contractStartDate ? formatDateUTC(finiquitoTarget.contractStartDate) : 'No definido'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="block text-slate-400 font-bold uppercase text-[9px]">Cargo</span>
                                        <span className="font-black text-slate-700 truncate block">{finiquitoTarget.position}</span>
                                    </div>
                                    <div>
                                        <span className="block text-slate-400 font-bold uppercase text-[9px]">Tipo Contrato</span>
                                        <span className="font-black text-slate-700 block truncate uppercase">{finiquitoTarget.contractType || 'PLAZO FIJO'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-slate-400 font-bold uppercase text-[9px]">Sueldo Base</span>
                                        <span className="font-black text-slate-700">
                                            ${(finiquitoTarget.sueldoBase || 0).toLocaleString('es-CL')}
                                        </span>
                                    </div>
                                </div>

                                {/* Parámetros del Finiquito */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Parámetros de Egreso</h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Fecha de Término (Egreso)</label>
                                            <input
                                                type="date" value={finiquitoData.fechaEgreso || ''}
                                                onChange={e => setFiniquitoData(d => ({ ...d, fechaEgreso: e.target.value }))}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Causal de Término</label>
                                            <select
                                                value={finiquitoData.causalTermino || ''}
                                                onChange={e => setFiniquitoData(d => ({ ...d, causalTermino: e.target.value }))}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                            >
                                                <option value="">Seleccionar motivo...</option>
                                                {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>
                                        {finiquitoData.causalTermino?.includes('161') && (
                                            <div className="md:col-span-2">
                                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Fecha de Notificación de Despido</label>
                                                <input
                                                    type="date" value={finiquitoData.fechaNotificacion || ''}
                                                    onChange={e => setFiniquitoData(d => ({ ...d, fechaNotificacion: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Método de Legalización */}
                                    <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60 space-y-3">
                                        <label className="block text-[10px] font-black uppercase text-slate-500">Método de Legalización</label>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => setFiniquitoData(d => ({ ...d, procesadoEn: 'Modulo' }))}
                                                className={\`flex-1 py-2 px-3 rounded-xl border text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 \${
                                                    finiquitoData.procesadoEn === 'Modulo' ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }\`}>
                                                📁 Interno (Módulo GenAI)
                                            </button>
                                            <button type="button" onClick={() => setFiniquitoData(d => ({ ...d, procesadoEn: 'Notaria' }))}
                                                className={\`flex-1 py-2 px-3 rounded-xl border text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 \${
                                                    finiquitoData.procesadoEn === 'Notaria' ? 'bg-violet-600 border-violet-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }\`}>
                                                🏛️ Externo (En Notaría)
                                            </button>
                                        </div>

                                        {finiquitoData.procesadoEn === 'Notaria' && (
                                            <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-200/50">
                                                <div>
                                                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Nombre de Notaría</label>
                                                    <input type="text" value={finiquitoData.notariaNombre || ''} onChange={e => setFiniquitoData(d => ({ ...d, notariaNombre: e.target.value }))} placeholder="Ej: Notaría Ramón Valdivieso" className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-350 bg-white" />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Fecha de Firma / Legalización</label>
                                                    <input type="date" value={finiquitoData.notariaFechaFirma || ''} onChange={e => setFiniquitoData(d => ({ ...d, notariaFechaFirma: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-350 bg-white" />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Gastos de Notaría ($)</label>
                                                    <input type="number" value={finiquitoData.notariaGastos || 0} onChange={e => setFiniquitoData(d => ({ ...d, notariaGastos: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-350 bg-white" />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Gastos Asumidos Por</label>
                                                    <select value={finiquitoData.notariaPagadoPor || 'Empleador'} onChange={e => setFiniquitoData(d => ({ ...d, notariaPagadoPor: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-350 bg-white">
                                                        <option value="Empleador">Empleador (Empresa)</option>
                                                        <option value="Trabajador">Trabajador (Colaborador)</option>
                                                        <option value="Compartido">Compartido (50% / 50%)</option>
                                                    </select>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Estado de Firma / Trámite</label>
                                                    <select value={finiquitoData.notariaEstado || 'Pendiente'} onChange={e => setFiniquitoData(d => ({ ...d, notariaEstado: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-350 bg-white">
                                                        <option value="Pendiente">Pendiente (No enviado)</option>
                                                        <option value="En Notaria">En Notaría (Trámite activo)</option>
                                                        <option value="Firmado">Firmado / Legalizado</option>
                                                        <option value="Rechazado">Rechazado / Con Observaciones</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Sueldo Base ($)</label>
                                            <input type="number" value={finiquitoData.sueldoBaseFijo || 0} onChange={e => setFiniquitoData(d => ({ ...d, sueldoBaseFijo: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Prom. Variable ($)</label>
                                            <input type="number" value={finiquitoData.promedioSueldoVariable || 0} onChange={e => setFiniquitoData(d => ({ ...d, promedioSueldoVariable: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Gratificación ($)</label>
                                            <input type="number" value={finiquitoData.gratificacion || 0} onChange={e => setFiniquitoData(d => ({ ...d, gratificacion: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Valor UF del Día ($)</label>
                                            <input type="number" value={finiquitoData.valorUF || 0} onChange={e => setFiniquitoData(d => ({ ...d, valorUF: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Colación Regular ($)</label>
                                            <input type="number" value={finiquitoData.colacion || 0} onChange={e => setFiniquitoData(d => ({ ...d, colacion: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Movilización Regular ($)</label>
                                            <input type="number" value={finiquitoData.movilizacion || 0} onChange={e => setFiniquitoData(d => ({ ...d, movilizacion: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Vacs Tomadas (Días)</label>
                                            <input type="number" value={finiquitoData.diasVacacionesTomados || 0} onChange={e => setFiniquitoData(d => ({ ...d, diasVacacionesTomados: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Vacs Progresivas (Días)</label>
                                            <input type="number" value={finiquitoData.diasVacacionesProgresivas || 0} onChange={e => setFiniquitoData(d => ({ ...d, diasVacacionesProgresivas: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                        </div>
                                    </div>

                                    {/* Días Proporcionales del mes de término */}
                                    <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="flex items-center gap-2 text-xs font-black uppercase text-slate-700 cursor-pointer">
                                                <input type="checkbox" checked={finiquitoData.pagarDiasProporcionales || false} onChange={e => setFiniquitoData(d => ({ ...d, pagarDiasProporcionales: e.target.checked }))} className="rounded text-violet-600 focus:ring-violet-300" />
                                                ¿Pagar días proporcionales del mes de egreso?
                                            </label>
                                        </div>
                                        {finiquitoData.pagarDiasProporcionales && (
                                            <div className="pt-2 grid grid-cols-1 gap-3 border-t border-slate-200/50">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Días Trabajados en el Mes</label>
                                                        <input type="number" value={finiquitoData.diasTrabajadosMes || 0} onChange={e => setFiniquitoData(d => ({ ...d, diasTrabajadosMes: e.target.value }))} placeholder="Ej: 6" className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-350 bg-white" />
                                                    </div>
                                                    <div className="flex flex-col justify-end text-[11px] text-slate-500 font-bold bg-white border border-slate-100 rounded-xl p-2.5">
                                                            {calcPreview?.diasProporcionales?.totalHaberesProporcionales > 0 ? (
                                                                <div className="space-y-1">
                                                                    <div className="flex justify-between">
                                                                        <span>Sueldo Prop.:</span>
                                                                        <span>\${calcPreview.diasProporcionales.montoSueldoProporcional.toLocaleString('es-CL')}</span>
                                                                    </div>
                                                                    {calcPreview.diasProporcionales.montoGratificacionProporcional > 0 && (
                                                                        <div className="flex justify-between">
                                                                            <span>Gratif. Prop.:</span>
                                                                            <span>\${calcPreview.diasProporcionales.montoGratificacionProporcional.toLocaleString('es-CL')}</span>
                                                                        </div>
                                                                    )}
                                                                    <div className="flex justify-between font-black text-slate-700 pt-0.5 border-t border-slate-100">
                                                                        <span>Total Haberes Prop.:</span>
                                                                        <span>\${calcPreview.diasProporcionales.totalHaberesProporcionales.toLocaleString('es-CL')}</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <p className="text-center italic">Calculando haberes del mes...</p>
                                                            )}
                                                    </div>
                                                </div>

                                                {calcPreview?.diasProporcionales?.totalHaberesProporcionales > 0 && (
                                                    <div className="pt-2 border-t border-dashed border-slate-200 space-y-2">
                                                        <h5 className="text-[10px] font-black uppercase text-slate-400">Leyes Sociales s/ Días Proporcionales (Overrides)</h5>
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                            <div>
                                                                <label className="block text-[9px] font-bold text-slate-500 mb-1">AFP (Calculado: \${calcPreview.descuentosDetallados?.descuentoAfpProporcional?.toLocaleString('es-CL') || 0})</label>
                                                                <input type="number" value={finiquitoData.descuentoAfpProporcional !== null ? finiquitoData.descuentoAfpProporcional : ''} placeholder={calcPreview.descuentosDetallados?.descuentoAfpProporcional} onChange={e => setFiniquitoData(d => ({ ...d, descuentoAfpProporcional: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-350 bg-white" />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[9px] font-bold text-slate-500 mb-1">Salud (Calculado: \${calcPreview.descuentosDetallados?.descuentoSaludProporcional?.toLocaleString('es-CL') || 0})</label>
                                                                <input type="number" value={finiquitoData.descuentoSaludProporcional !== null ? finiquitoData.descuentoSaludProporcional : ''} placeholder={calcPreview.descuentosDetallados?.descuentoSaludProporcional} onChange={e => setFiniquitoData(d => ({ ...d, descuentoSaludProporcional: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-350 bg-white" />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[9px] font-bold text-slate-500 mb-1">AFC (Calculado: \${calcPreview.descuentosDetallados?.descuentoAfcProporcional?.toLocaleString('es-CL') || 0})</label>
                                                                <input type="number" value={finiquitoData.descuentoAfcProporcional !== null ? finiquitoData.descuentoAfcProporcional : ''} placeholder={calcPreview.descuentosDetallados?.descuentoAfcProporcional} onChange={e => setFiniquitoData(d => ({ ...d, descuentoAfcProporcional: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-350 bg-white" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {finiquitoData.causalTermino?.includes('161') && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-red-50/50 p-4 rounded-2xl border border-red-100/50">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-red-600 mb-1">Aportes AFC a Descontar ($)</label>
                                                <input type="number" value={finiquitoData.montoAFC || 0} onChange={e => setFiniquitoData(d => ({ ...d, montoAFC: e.target.value }))} placeholder="Cartola AFC del Empleador" className="w-full px-3 py-1.5 border border-red-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                                            </div>
                                            <div className="flex items-center pt-5">
                                                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                                                    <input type="checkbox" checked={finiquitoData.excluirAviso || false}
                                                        disabled={(() => {
                                                            if (!finiquitoData.fechaEgreso || !finiquitoData.fechaNotificacion) return false;
                                                            const fNotif = new Date(finiquitoData.fechaNotificacion);
                                                            const fEgres = new Date(finiquitoData.fechaEgreso);
                                                            fNotif.setHours(0,0,0,0);
                                                            fEgres.setHours(0,0,0,0);
                                                            return Math.round((fEgres - fNotif) / (1000 * 60 * 60 * 24)) < 30;
                                                        })()}
                                                        onChange={e => setFiniquitoData(d => ({ ...d, excluirAviso: e.target.checked }))} className="rounded text-red-500 focus:ring-red-300 disabled:opacity-50" />
                                                    Se dio aviso previo formal (30 días)
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {/* Descuentos Detallados */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Otros Descuentos Detallados</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Anticipos ($)</label>
                                                <input type="number" value={finiquitoData.descuentoAnticipos || 0} onChange={e => setFiniquitoData(d => ({ ...d, descuentoAnticipos: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Prést. Caja ($)</label>
                                                <input type="number" value={finiquitoData.descuentoPrestamoCaja || 0} onChange={e => setFiniquitoData(d => ({ ...d, descuentoPrestamoCaja: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Prést. Emp. ($)</label>
                                                <input type="number" value={finiquitoData.descuentoPrestamoEmpresa || 0} onChange={e => setFiniquitoData(d => ({ ...d, descuentoPrestamoEmpresa: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Seg. Col. ($)</label>
                                                <input type="number" value={finiquitoData.descuentoSeguroColectivo || 0} onChange={e => setFiniquitoData(d => ({ ...d, descuentoSeguroColectivo: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Equipos ($)</label>
                                                <input type="number" value={finiquitoData.descuentoEquiposNoDevueltos || 0} onChange={e => setFiniquitoData(d => ({ ...d, descuentoEquiposNoDevueltos: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Otros Haberes y Saldos Adicionales</h4>
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Indem. Vol. ($)</label>
                                                <input type="number" value={finiquitoData.indemnizacionVoluntaria || 0} onChange={e => setFiniquitoData(d => ({ ...d, indemnizacionVoluntaria: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Aguinaldos ($)</label>
                                                <input type="number" value={finiquitoData.aguinaldosOtros || 0} onChange={e => setFiniquitoData(d => ({ ...d, aguinaldosOtros: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Otros Haberes ($)</label>
                                                <input type="number" value={finiquitoData.otrosHaberes || 0} onChange={e => setFiniquitoData(d => ({ ...d, otrosHaberes: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Otros Desc. ($)</label>
                                                <input type="number" value={finiquitoData.otrosDescuentos || 0} onChange={e => setFiniquitoData(d => ({ ...d, otrosDescuentos: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Observaciones / Reservas de Derechos</label>
                                        <textarea value={finiquitoData.observacionesReservas || ''} onChange={e => setFiniquitoData(d => ({ ...d, observacionesReservas: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none" />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Columna Derecha: Preview del Cálculo Legal */}
                    <div className="lg:col-span-2 flex flex-col justify-start">
                        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl space-y-5 border border-slate-800 sticky top-0">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                    <Calculator size={14} /> Liquidación Provisoria
                                </h4>
                                {calcLoading && <Loader2 className="animate-spin text-emerald-400" size={14} />}
                            </div>

                            {!calcPreview ? (
                                <div className="py-20 text-center text-xs text-slate-500 font-bold space-y-2">
                                    <AlertCircle size={24} className="mx-auto text-slate-600 mb-2" />
                                    <p>Ingresa la fecha de término y motivo para simular el cálculo oficial de la DT.</p>
                                </div>
                            ) : (
                                <div className="space-y-4 divide-y divide-slate-800 text-xs">
                                    {calcPreview.warnings && calcPreview.warnings.length > 0 && (
                                        <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-4 space-y-2 text-[11px] text-amber-200">
                                            <div className="flex items-center gap-1.5 font-black uppercase text-amber-400 tracking-wider">
                                                <AlertCircle size={14} className="text-amber-400 animate-pulse" /> Alertas de Cumplimiento
                                            </div>
                                            <ul className="list-disc pl-4 space-y-1 text-amber-300">
                                                {calcPreview.warnings.map((w, idx) => <li key={idx}>{w}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Antigüedad Calculada</p>
                                        <p className="text-sm font-black text-slate-100">
                                            {calcPreview.antiguedad.anios} año(s), {calcPreview.antiguedad.meses} mes(es) y {calcPreview.antiguedad.dias} día(s)
                                        </p>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Total de días continuos: {calcPreview.antiguedad.diasTotales}</p>
                                    </div>

                                    <div className="pt-3">
                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Feriado Proporcional</p>
                                        <div className="space-y-1">
                                            <div className="flex justify-between"><span className="text-slate-500">Días pendientes:</span> <span className="font-black text-emerald-400">{calcPreview.feriadoProporcional.pendientesHabiles} hábiles</span></div>
                                            <div className="flex justify-between pt-1 border-t border-slate-800/40 font-black">
                                                <span>Monto Feriado Proporcional:</span> <span className="text-slate-100">\${calcPreview.feriadoProporcional.monto.toLocaleString('es-CL')}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {calcPreview.indemnizaciones.aniosServicioCalculados > 0 && (
                                        <div className="pt-3">
                                            <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Indemnizaciones Art. 161/163</p>
                                            <div className="space-y-1">
                                                <div className="flex justify-between"><span className="text-slate-500">Años de Servicio ({calcPreview.indemnizaciones.aniosServicioCalculados} años):</span> <span className="font-bold">\${calcPreview.indemnizaciones.montoIAS.toLocaleString('es-CL')}</span></div>
                                                {calcPreview.indemnizaciones.montoISAP > 0 && <div className="flex justify-between"><span className="text-slate-500">Falta de Aviso Previo:</span> <span className="font-bold">\${calcPreview.indemnizaciones.montoISAP.toLocaleString('es-CL')}</span></div>}
                                                {calcPreview.indemnizaciones.descuentoAFC > 0 && <div className="flex justify-between text-red-400"><span>Descuento AFC:</span> <span className="font-bold">-\${calcPreview.indemnizaciones.descuentoAFC.toLocaleString('es-CL')}</span></div>}
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-3 space-y-1">
                                        <div className="flex justify-between"><span className="text-slate-500">Sueldo Imponible base cálculo:</span> <span className="font-bold">\${calcPreview.valoresBase.sueldoImponible.toLocaleString('es-CL')}</span></div>
                                        {calcPreview.diasProporcionales?.totalHaberesProporcionales > 0 && (
                                            <>
                                                <div className="flex justify-between"><span className="text-slate-500">Sueldo Prop.:</span> <span className="font-bold">\${calcPreview.diasProporcionales.montoSueldoProporcional.toLocaleString('es-CL')}</span></div>
                                            </>
                                        )}
                                        {Number(finiquitoData.otrosHaberes) > 0 && <div className="flex justify-between"><span className="text-slate-500">Otros Haberes:</span> <span className="font-bold">\${Number(finiquitoData.otrosHaberes).toLocaleString('es-CL')}</span></div>}
                                        {Number(finiquitoData.otrosDescuentos) > 0 && <div className="flex justify-between text-red-400"><span>Otros Descuentos:</span> <span className="font-bold">-\${Number(finiquitoData.otrosDescuentos).toLocaleString('es-CL')}</span></div>}
                                    </div>

                                    <div className="pt-4 mt-2 border-t-2 border-slate-800">
                                        <p className="text-[10px] font-black uppercase text-emerald-500 mb-1 tracking-widest">Total a Pagar Neto</p>
                                        <p className="text-3xl font-black text-white">\${calcPreview.netoFiniquito.toLocaleString('es-CL')}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-black uppercase hover:bg-slate-350 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={handleRegistrarFiniquito} disabled={saving || !calcPreview} className="px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-60 hover:bg-red-655 transition-colors">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
                        {saving ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Confirmar Finiquito')}
                    </button>
                </div>
            </div>
        </div>
    );
}

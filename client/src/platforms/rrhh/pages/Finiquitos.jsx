import React, { useState, useEffect } from 'react';
import { FileText, Search, Loader2, Eye, Download, Upload, X, UserMinus, CheckCircle, Edit2, Calculator, AlertCircle, Calendar, Printer, Sparkles, UploadCloud, Users, Bell, Briefcase, Landmark, RefreshCw, Building2, MapPin, Archive } from 'lucide-react';
import { candidatosApi, proyectosApi } from '../rrhhApi';
import { useIndicadores } from '../../../contexts/IndicadoresContext';
import BulkUploadModal from '../../../components/BulkUploadModal';
import SearchableSelect from '../../../components/SearchableSelect';
import { formatRut } from '../../../utils/rutUtils';
import BovedaDashboard from './components/finiquitos/BovedaDashboard';
import FiniquitosTable from './components/finiquitos/FiniquitosTable';
import CartasAsistente from './components/finiquitos/CartasAsistente';
import RenunciaAsistente from './components/finiquitos/RenunciaAsistente';
import FiniquitoDetailModal from './components/finiquitos/FiniquitoDetailModal';
import FiniquitoModalAsistente from './components/finiquitos/FiniquitoModalAsistente';

const formatDateUTC = (dateVal) => {
    if (!dateVal) return '';
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return '';
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        return '';
    }
};

const formatLongDateUTC = (dateVal) => {
    if (!dateVal) return '';
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return '';
        const day = String(d.getUTCDate()).padStart(2, '0');
        const months = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        const month = months[d.getUTCMonth()];
        const year = d.getUTCFullYear();
        return `${day} de ${month} de ${year}`;
    } catch (e) {
        return '';
    }
};

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

const templateHeaders = [
    'RUT',
    'Fecha Egreso',
    'Causal Término',
    'Fecha Notificación',
    'Pagar Días Proporcionales (SI/NO)',
    'Días Trabajados Mes',
    'Vacaciones Tomadas Override',
    'Vacaciones Progresivas',
    'Valor UF',
    'Monto AFC',
    'Otros Haberes',
    'Otros Descuentos',
    'Préstamo Caja',
    'Préstamo Empresa',
    'Anticipos',
    'Indemnización Voluntaria',
    'Aguinaldos y Otros',
    'Seguro Colectivo',
    'Equipos No Devueltos',
    'AFP Proporcional Override',
    'Salud Proporcional Override',
    'AFC Proporcional Override'
];

const templateData = [
    {
        'RUT': '12.345.678-9',
        'Fecha Egreso': '2026-06-15',
        'Causal Término': 'Necesidades de la empresa (Art. 161)',
        'Fecha Notificación': '2026-05-15',
        'Pagar Días Proporcionales (SI/NO)': 'SI',
        'Días Trabajados Mes': 15,
        'Vacaciones Tomadas Override': '',
        'Vacaciones Progresivas': 0,
        'Valor UF': 38500,
        'Monto AFC': 150000,
        'Otros Haberes': 0,
        'Otros Descuentos': 0,
        'Préstamo Caja': 0,
        'Préstamo Empresa': 0,
        'Anticipos': 0,
        'Indemnización Voluntaria': 100000,
        'Aguinaldos y Otros': 50000,
        'Seguro Colectivo': 15000,
        'Equipos No Devueltos': 0,
        'AFP Proporcional Override': '',
        'Salud Proporcional Override': '',
        'AFC Proporcional Override': ''
    },
    {
        'RUT': '9.876.543-2',
        'Fecha Egreso': '2026-06-30',
        'Causal Término': 'Renuncia voluntaria (Art. 159 N°2)',
        'Fecha Notificación': '',
        'Pagar Días Proporcionales (SI/NO)': 'NO',
        'Días Trabajados Mes': 0,
        'Vacaciones Tomadas Override': 10,
        'Vacaciones Progresivas': 1,
        'Valor UF': 38500,
        'Monto AFC': 0,
        'Otros Haberes': 0,
        'Otros Descuentos': 0,
        'Préstamo Caja': 50000,
        'Préstamo Empresa': 0,
        'Anticipos': 0,
        'Indemnización Voluntaria': 0,
        'Aguinaldos y Otros': 0,
        'Seguro Colectivo': 0,
        'Equipos No Devueltos': 30000,
        'AFP Proporcional Override': '',
        'Salud Proporcional Override': '',
        'AFC Proporcional Override': ''
    }
];

const Finiquitos = () => {
    const { ufValue } = useIndicadores();
    const [candidatos, setCandidatos] = useState([]);
    const [contratados, setContratados] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProject, setFilterProject] = useState('all');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [showDetail, setShowDetail] = useState(null);
    const [showFiniquitoModal, setShowFiniquitoModal] = useState(false);
    
    // Estados Bóveda RRHH
    const [bovedaEmployees, setBovedaEmployees] = useState([]);
    const [bovedaLoading, setBovedaLoading] = useState(false);
    const [bovedaSearchTerm, setBovedaSearchTerm] = useState('');
    const [bovedaFilterCeco, setBovedaFilterCeco] = useState('');
    const [bovedaFilterProj, setBovedaFilterProj] = useState('');
    

    // Asistente de Finiquitos extendido
    const [isEditing, setIsEditing] = useState(false);
    const [finiquitoTarget, setFiniquitoTarget] = useState(null);
    const [finiquitoData, setFiniquitoData] = useState({
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
        // Campos notariales
        procesadoEn: 'Modulo',
        notariaNombre: '',
        notariaFechaFirma: '',
        notariaGastos: 0,
        notariaPagadoPor: 'Empleador',
        notariaEstado: 'Pendiente'
    });

    const [calcPreview, setCalcPreview] = useState(null);
    const [calcLoading, setCalcLoading] = useState(false);
    
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [legalFile, setLegalFile] = useState(null);
    const [contratadoSearch, setContratadoSearch] = useState('');

    // Estados agregados para Cartas de Término y Renuncia Voluntaria
    const [currentTab, setCurrentTab] = useState('boveda'); // 'boveda', 'finiquitos', 'cartas' or 'renuncias'
    const [showRenunciaModal, setShowRenunciaModal] = useState(false);

    
    // Carga Masiva Finiquitos
    const [showBulkModal, setShowBulkModal] = useState(false);
    
    const handleBulkFiniquitosUpload = async (data) => {
        try {
            const res = await candidatosApi.bulkFiniquitos(data);
            alert(`✅ Carga masiva completada: ${res.data.message}`);
            setShowBulkModal(false);
            cargarDatos();
        } catch (e) {
            if (e.response?.data?.errors?.length > 0) {
                return { errors: e.response.data.errors };
            }
            return { errors: [e.response?.data?.message || 'Error al procesar la carga masiva.'] };
        }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        setLoading(true);
        setBovedaLoading(true);
        try {
            const [finiquitadosResp, contratadosResp, proyectosResp, bovedaResp] = await Promise.all([
                candidatosApi.getFiniquitos(),
                candidatosApi.getAll({ status: 'Contratado,Activo,ACTIVO,En Terreno,Listo Terreno,Licencia Médica' }),
                proyectosApi.getAll(),
                candidatosApi.getAll({ status: 'Rechazado,Retirado,Finiquitado,Bajas/Inactivos,De Baja,DE BAJA' })
            ]);
            setCandidatos(finiquitadosResp.data || []);
            setContratados(contratadosResp.data || []);
            const projsList = proyectosResp.data || [];
            const projs = projsList.map(p => ({
                id: p._id,
                name: p.nombreProyecto || p.projectName || p._id,
            }));
            setProjects(projs);
            
            const today = new Date();
            const bovedaProcessed = (bovedaResp.data || []).map(emp => {
                const startRaw = emp.contractStartDate || emp.hiring?.contractStartDate;
                const endRaw = emp.contractEndDate || emp.hiring?.contractEndDate;
                const type = emp.contractType || emp.hiring?.contractType;

                const expiryDate = endRaw ? new Date(endRaw) : null;
                let daysToExpire = null, alerts = 0;
                if (expiryDate) {
                    daysToExpire = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                    if (daysToExpire <= 30 && daysToExpire > 0) alerts = 1;
                    if (daysToExpire <= 0) alerts = 2; // expired!
                }

                // Find project info
                const proj = projsList.find(p =>
                    p._id === emp.projectId?.toString() ||
                    p._id === emp.projectId
                );
                const projectName = proj?.nombreProyecto || proj?.projectName || emp.projectName || null;
                const ceco = proj?.centroCosto || emp.ceco || null;
                const area = proj?.area || emp.area || null;
                const depto = emp.departamento || null;
                const sede = emp.sede || null;

                return {
                    ...emp,
                    formattedStart: startRaw ? new Date(startRaw + 'T12:00:00').toLocaleDateString('es-CL') : 'S/F',
                    formattedEnd: endRaw ? new Date(endRaw + 'T12:00:00').toLocaleDateString('es-CL') : 'Indefinido',
                    contractType: type,
                    projectName, ceco, area, depto, sede,
                    daysToExpire, alerts,
                };
            });
            setBovedaEmployees(bovedaProcessed);
            
        } catch (err) {
            console.error('Error cargando datos de finiquitos', err);
        } finally {
            setLoading(false);
            setBovedaLoading(false);
        }
    };

    useEffect(() => {
        if (!loading && (contratados.length > 0 || candidatos.length > 0)) {
            const params = new URLSearchParams(window.location.search);
            const preselectedId = params.get('candidatoId');
            if (preselectedId) {
                // Primero buscar en finiquitados (para editar)
                const targetFiniquitado = candidatos.find(c => c._id === preselectedId);
                if (targetFiniquitado) {
                    handleAbrirEdicion(targetFiniquitado);
                    setShowFiniquitoModal(true);
                    
                    // Limpiar el query param de la barra de direcciones
                    const newUrl = window.location.pathname;
                    window.history.replaceState({}, document.title, newUrl);
                    return;
                }
                
                // Si no, buscar en contratados (para registrar nuevo)
                const targetContratado = contratados.find(c => c._id === preselectedId);
                if (targetContratado) {
                    handleSelectCandidato(targetContratado);
                    setShowFiniquitoModal(true);
                    
                    // Limpiar el query param de la barra de direcciones
                    const newUrl = window.location.pathname;
                    window.history.replaceState({}, document.title, newUrl);
                }
            }
        }
    }, [loading, contratados, candidatos]);

    // Debounce y cálculo automático en tiempo real
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
                        fechaEgreso: finiquitoData.fechaEgreso,
                        fechaNotificacion: finiquitoData.fechaNotificacion || null,
                        causalTermino: finiquitoData.causalTermino,
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
    }, [
        finiquitoTarget,
        finiquitoData.fechaEgreso,
        finiquitoData.fechaNotificacion,
        finiquitoData.causalTermino,
        finiquitoData.diasVacacionesTomados,
        finiquitoData.diasVacacionesProgresivas,
        finiquitoData.sueldoBaseFijo,
        finiquitoData.promedioSueldoVariable,
        finiquitoData.colacion,
        finiquitoData.movilizacion,
        finiquitoData.gratificacion,
        finiquitoData.valorUF,
        finiquitoData.montoAFC,
        finiquitoData.otrosDescuentos,
        finiquitoData.otrosHaberes,
        finiquitoData.excluirAviso,
        finiquitoData.pagarDiasProporcionales,
        finiquitoData.diasTrabajadosMes,
        finiquitoData.descuentoPrestamoCaja,
        finiquitoData.descuentoPrestamoEmpresa,
        finiquitoData.descuentoAnticipos,
        finiquitoData.descuentoAfpProporcional,
        finiquitoData.descuentoSaludProporcional,
        finiquitoData.descuentoAfcProporcional,
        finiquitoData.descuentoSeguroColectivo,
        finiquitoData.descuentoEquiposNoDevueltos,
        finiquitoData.indemnizacionVoluntaria,
        finiquitoData.aguinaldosOtros
    ]);

    // Auto-calculate excluirAviso based on notice period for Art. 161
    useEffect(() => {
        if (finiquitoData.causalTermino?.includes('161') && finiquitoData.fechaEgreso && finiquitoData.fechaNotificacion) {
            const fNotif = new Date(finiquitoData.fechaNotificacion);
            const fEgres = new Date(finiquitoData.fechaEgreso);
            fNotif.setHours(0,0,0,0);
            fEgres.setHours(0,0,0,0);
            const diffDays = Math.round((fEgres - fNotif) / (1000 * 60 * 60 * 24));
            if (diffDays >= 30) {
                setFiniquitoData(d => {
                    if (d.excluirAviso !== true) return { ...d, excluirAviso: true };
                    return d;
                });
            } else {
                setFiniquitoData(d => {
                    if (d.excluirAviso !== false) return { ...d, excluirAviso: false };
                    return d;
                });
            }
        }
    }, [finiquitoData.fechaEgreso, finiquitoData.fechaNotificacion, finiquitoData.causalTermino]);

    // Reset fields when causal Termino changes
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

    const handleSelectCandidato = (c) => {
        setFiniquitoTarget(c);
        
        // Calcular vacaciones tomadas aprobadas
        const vacsTomadas = (c.vacaciones || [])
            .filter(v => v.estado === 'Aprobado' && v.tipo === 'Vacaciones')
            .reduce((sum, v) => sum + (Number(v.diasHabiles) || 0), 0);

        const defaultGratificacion = Math.min(Math.round((c.sueldoBase || 0) * 0.25), 197917);
            
        setFiniquitoData({
            fechaEgreso: '',
            fechaNotificacion: '',
            causalTermino: '',
            sueldoBaseFijo: c.sueldoBase || 0,
            promedioSueldoVariable: 0,
            colacion: 0,
            movilizacion: 0,
            gratificacion: defaultGratificacion,
            valorUF: ufValue || 38500,
            diasVacacionesTomados: vacsTomadas,
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
            notariaEstado: 'Pendiente'
        });
        setContratadoSearch(c.fullName);
    };

    const handleAbrirEdicion = (c) => {
        setFiniquitoTarget(c);
        setIsEditing(true);
        
        const fd = c.finiquitoDetalle || {};
        
        let fechaEgresoFormateada = '';
        if (fd.fechaEgreso) {
            fechaEgresoFormateada = new Date(fd.fechaEgreso).toISOString().split('T')[0];
        } else if (c.fechaFiniquito) {
            fechaEgresoFormateada = new Date(c.fechaFiniquito).toISOString().split('T')[0];
        }
        
        setFiniquitoData({
            fechaEgreso: fechaEgresoFormateada,
            fechaNotificacion: fd.fechaNotificacion ? new Date(fd.fechaNotificacion).toISOString().split('T')[0] : '',
            causalTermino: fd.causalTermino || c.finiquitoMotivo || '',
            sueldoBaseFijo: fd.sueldoBaseFijo !== undefined ? fd.sueldoBaseFijo : (c.sueldoBase || 0),
            promedioSueldoVariable: fd.promedioSueldoVariable || 0,
            colacion: fd.colacion || 0,
            movilizacion: fd.movilizacion || 0,
            gratificacion: fd.gratificacion !== undefined ? fd.gratificacion : Math.min(Math.round((c.sueldoBase || 0) * 0.25), 197917),
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
        
        setContratadoSearch(c.fullName);
        setShowFiniquitoModal(true);
    };

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
                    
                    // Nuevas variables proporcionales y descuentos detallados
                    pagarDiasProporcionales: finiquitoData.pagarDiasProporcionales,
                    diasTrabajadosMes: Number(finiquitoData.diasTrabajadosMes),
                    montoSueldoProporcional: calcPreview.diasProporcionales?.montoSueldoProporcional || 0,
                    montoColacionProporcional: calcPreview.diasProporcionales?.montoColacionProporcional || 0,
                    montoMovilizacionProporcional: calcPreview.diasProporcionales?.montoMovilizacionProporcional || 0,
                    montoGratificacionProporcional: calcPreview.diasProporcionales?.montoGratificacionProporcional || 0,
                    
                    // Haberes Adicionales
                    indemnizacionVoluntaria: Number(finiquitoData.indemnizacionVoluntaria),
                    aguinaldosOtros: Number(finiquitoData.aguinaldosOtros),

                    // Descuentos detallados
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
                    // Campos notariales
                    procesadoEn: finiquitoData.procesadoEn,
                    notariaNombre: finiquitoData.procesadoEn === 'Notaria' ? finiquitoData.notariaNombre : '',
                    notariaFechaFirma: finiquitoData.procesadoEn === 'Notaria' ? finiquitoData.notariaFechaFirma : null,
                    notariaGastos: finiquitoData.procesadoEn === 'Notaria' ? Number(finiquitoData.notariaGastos || 0) : 0,
                    notariaPagadoPor: finiquitoData.procesadoEn === 'Notaria' ? finiquitoData.notariaPagadoPor : 'Empleador',
                    notariaEstado: finiquitoData.procesadoEn === 'Notaria' ? finiquitoData.notariaEstado : 'Pendiente'
                }
            };
            
            await candidatosApi.guardarFiniquito(finiquitoTarget._id, payload);
            
            setShowFiniquitoModal(false);
            setFiniquitoTarget(null);
            setCalcPreview(null);
            setIsEditing(false);
            setContratadoSearch('');
            setFiniquitoData({
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
                notariaEstado: 'Pendiente'
            });
            await cargarDatos();
            alert(isEditing ? 'Finiquito modificado con éxito' : 'Finiquito registrado con éxito');
        } catch (err) {
            console.error(err);
            alert('Error al guardar el finiquito.');
        } finally {
            setSaving(false);
        }
    };

    const filtered = candidatos.filter(c => {
        const matchText = [c.fullName, c.rut, c.position, c.projectName, c.projectId?.nombreProyecto]
            .filter(Boolean).join(' ').toLowerCase();
        if (searchTerm && !matchText.includes(searchTerm.toLowerCase())) return false;
        if (filterProject !== 'all' && (c.projectId?._id || c.projectId) !== filterProject) return false;
        if (filterDateFrom) {
            const dd = new Date(c.fechaFiniquito || c.updatedAt);
            if (dd < new Date(filterDateFrom)) return false;
        }
        if (filterDateTo) {
            const dd = new Date(c.fechaFiniquito || c.updatedAt);
            if (dd > new Date(filterDateTo)) return false;
        }
        return true;
    });

    const total = candidatos.length;
    const recientes = candidatos.filter(c => {
        if (!c.fechaFiniquito) return false;
        const days = (Date.now() - new Date(c.fechaFiniquito).getTime()) / (1000 * 60 * 60 * 24);
        return days <= 30;
    }).length;

    const handleUpload = async (candidatoId) => {
        if (!legalFile) return alert('Adjunta un archivo primero.');
        const formData = new FormData();
        formData.append('file', legalFile);
        try {
            setUploading(true);
            await candidatosApi.uploadDocument(candidatoId, formData);
            alert('Documento legal subido con éxito');
            await cargarDatos();
        } catch (err) {
            console.error(err);
            alert('Error subiendo documento');
        } finally {
            setUploading(false);
            setLegalFile(null);
        }
    };

    const generateFiniquitoPdf = (candidato) => {
        const fd = candidato.finiquitoDetalle || {};
        const fechaFiniquitoStr = candidato.fechaFiniquito
            ? formatLongDateUTC(candidato.fechaFiniquito)
            : formatLongDateUTC(new Date().toISOString());
        
        const fechaIngresoStr = candidato.contractStartDate
            ? formatDateUTC(candidato.contractStartDate)
            : (fd.fechaIngresoReal ? formatDateUTC(fd.fechaIngresoReal) : 'No registrada');
            
        const fechaEgresoStr = candidato.fechaFiniquito
            ? formatDateUTC(candidato.fechaFiniquito)
            : (fd.fechaEgreso ? formatDateUTC(fd.fechaEgreso) : 'No registrada');

        const projectName = candidato.projectName || candidato.projectId?.nombreProyecto || 'No asignado';
        const empresaNombre = candidato.empresaRef?.nombre || 'Empresa Empleadora';
        const causalTermino = fd.causalTermino || candidato.finiquitoMotivo || 'Necesidades de la empresa (Art. 161)';

        const aniosServicio = fd.aniosServicioCalculados || 0;
        const montoIAS = fd.montoIndemnizacionAnos || 0;
        const montoISAP = fd.montoIndemnizacionAviso || 0;
        const montoFP = fd.montoFeriadoProporcional || 0;
        const diasFP = fd.diasVacacionesCorridosCalculados || 0;
        const diasHabilesFP = fd.diasVacacionesHabilesCalculados || 0;
        const otrosHaberes = fd.otrosHaberes || 0;
        
        // Nuevos campos para desglose
        const pagarDiasProporcionales = fd.pagarDiasProporcionales || false;
        const diasTrabajadosMes = fd.diasTrabajadosMes || 0;
        const montoSueldoProporcional = fd.montoSueldoProporcional || 0;
        const montoColacionProporcional = fd.montoColacionProporcional || 0;
        const montoMovilizacionProporcional = fd.montoMovilizacionProporcional || 0;
        const montoGratificacionProporcional = fd.montoGratificacionProporcional || 0;
        const totalHaberesProporcionales = pagarDiasProporcionales ? (montoSueldoProporcional + montoColacionProporcional + montoMovilizacionProporcional + montoGratificacionProporcional) : 0;

        const indemnizacionVoluntaria = fd.indemnizacionVoluntaria || 0;
        const aguinaldosOtros = fd.aguinaldosOtros || 0;

        const descuentoAnticipos = fd.descuentoAnticipos || 0;
        const descuentoPrestamoCaja = fd.descuentoPrestamoCaja || 0;
        const descuentoPrestamoEmpresa = fd.descuentoPrestamoEmpresa || 0;
        const descuentoAfpProporcional = fd.descuentoAfpProporcional || 0;
        const descuentoSaludProporcional = fd.descuentoSaludProporcional || 0;
        const descuentoAfcProporcional = fd.descuentoAfcProporcional || 0;
        const descuentoSeguroColectivo = fd.descuentoSeguroColectivo || 0;
        const descuentoEquiposNoDevueltos = fd.descuentoEquiposNoDevueltos || 0;
        
        const descuentoAFC = fd.descuentoAFC || 0;
        const otrosDescuentos = fd.otrosDescuentos || 0;
        const netoFiniquito = fd.netoFiniquito !== undefined ? fd.netoFiniquito : 0;

        const totalHaberes = montoIAS + montoISAP + montoFP + otrosHaberes + totalHaberesProporcionales + indemnizacionVoluntaria + aguinaldosOtros;
        const totalDescuentos = descuentoAFC + otrosDescuentos + descuentoAnticipos + descuentoPrestamoCaja + descuentoPrestamoEmpresa + descuentoAfpProporcional + descuentoSaludProporcional + descuentoAfcProporcional + descuentoSeguroColectivo + descuentoEquiposNoDevueltos;

        const html = `
            <html>
            <head>
                <title>Acta de Finiquito - ${candidato.fullName}</title>
                <style>
                    body { font-family: 'Arial', sans-serif; color: #1e293b; margin: 40px; line-height: 1.5; font-size: 12px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .header h1 { font-size: 18px; font-weight: 800; margin: 0; text-transform: uppercase; color: #0f172a; }
                    .header p { font-size: 11px; margin: 5px 0 0 0; color: #64748b; font-weight: bold; }
                    .body-text { margin-bottom: 20px; text-align: justify; }
                    .table-title { font-weight: bold; margin-bottom: 8px; text-transform: uppercase; font-size: 11px; color: #334155; }
                    table { border-collapse: collapse; margin-bottom: 20px; width: 100%; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
                    th { background: #f1f5f9; font-weight: bold; font-size: 11px; }
                    .text-right { text-align: right; }
                    .font-bold { font-weight: bold; }
                    .section { margin-top: 25px; }
                    .reserva-box { border: 2px dashed #94a3b8; padding: 15px; margin-top: 25px; border-radius: 8px; background: #f8fafc; }
                    .reserva-title { font-weight: 900; font-size: 11px; text-transform: uppercase; color: #475569; margin-bottom: 6px; }
                    .firmas { display: flex; justify-content: space-between; margin-top: 60px; }
                    .firma-box { width: 45%; text-align: center; }
                    .linea { border-top: 1px solid #475569; margin-top: 50px; margin-bottom: 5px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${fd.procesadoEn === 'Notaria' ? 'Acta de Finiquito de Contrato de Trabajo (Legalizado ante Notario)' : 'Acta de Finiquito de Contrato de Trabajo'}</h1>
                    <p>${fd.procesadoEn === 'Notaria' ? `PROCESADO EN: ${fd.notariaNombre || 'NOTARÍA PÚBLICA'}` : 'DIRECCIÓN DEL TRABAJO COMPLIANT'}</p>
                </div>
                
                <div class="body-text">
                    En la ciudad de Rancagua, Chile, a ${fechaFiniquitoStr}, comparecen por una parte <strong>${empresaNombre}</strong>, en adelante "el Empleador", y por la otra don (ña) <strong>${candidato.fullName}</strong>, nacionalidad ${candidato.nationality || 'Chilena'}, cédula de identidad N° <strong>${candidato.rut}</strong>, de profesión u oficio <strong>${candidato.position || 'Colaborador'}</strong>, domiciliado(a) en ${candidato.address || 'No registrado'}, en adelante "el Trabajador", quienes dejan constancia de lo siguiente:
                </div>

                <div class="body-text">
                    <strong>PRIMERO:</strong> Las partes declaran que la relación laboral que los unía, iniciada con fecha ${fechaIngresoStr}, ha terminado con fecha ${fechaEgresoStr}, por la causal contemplada en el Código del Trabajo: <strong>"${causalTermino}"</strong>.
                </div>

                <div class="body-text">
                    <strong>SEGUNDO:</strong> El Empleador practica la liquidación de los haberes que le corresponden al Trabajador con motivo del término de su contrato de trabajo, la que arroja los siguientes conceptos e importes:
                </div>

                <div class="table-title">Desglose de Haberes e Indemnizaciones</div>
                <table>
                    <thead>
                        <tr>
                            <th>Concepto / Detalle</th>
                            <th class="text-right" style="width: 150px;">Monto ($)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${montoIAS > 0 ? `
                        <tr>
                            <td>Indemnización por Años de Servicio (${aniosServicio} año(s) calculado(s))</td>
                            <td class="text-right">$${montoIAS.toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        ${montoISAP > 0 ? `
                        <tr>
                            <td>Indemnización Sustitutiva de Aviso Previo</td>
                            <td class="text-right">$${montoISAP.toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        <tr>
                            <td>Feriado Proporcional (${diasFP} días corridos, equivalentes a ${diasHabilesFP} días hábiles)</td>
                            <td class="text-right">$${montoFP.toLocaleString('es-CL')}</td>
                        </tr>
                        ${totalHaberesProporcionales > 0 ? `
                        <tr>
                            <td>Sueldo Proporcional mes de egreso (${diasTrabajadosMes} días)</td>
                            <td class="text-right">$${montoSueldoProporcional.toLocaleString('es-CL')}</td>
                        </tr>
                        ${montoGratificacionProporcional > 0 ? `
                        <tr>
                            <td>Gratificación Proporcional mes de egreso (${diasTrabajadosMes} días)</td>
                            <td class="text-right">$${montoGratificacionProporcional.toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        ${(montoColacionProporcional + montoMovilizacionProporcional) > 0 ? `
                        <tr>
                            <td>Asignaciones Proporcionales (Colación/Movilización)</td>
                            <td class="text-right">$${(montoColacionProporcional + montoMovilizacionProporcional).toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        ` : ''}
                        ${indemnizacionVoluntaria > 0 ? `
                        <tr>
                            <td>Indemnización Voluntaria / Bono de Desvinculación</td>
                            <td class="text-right">$${indemnizacionVoluntaria.toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        ${aguinaldosOtros > 0 ? `
                        <tr>
                            <td>Aguinaldos / Bonos Pendientes</td>
                            <td class="text-right">$${aguinaldosOtros.toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        ${otrosHaberes > 0 ? `
                        <tr>
                            <td>Otros Haberes devengados a pagar</td>
                            <td class="text-right">$${otrosHaberes.toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        <tr class="font-bold">
                            <td>TOTAL HABERES</td>
                            <td class="text-right">$${totalHaberes.toLocaleString('es-CL')}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="table-title">Desglose de Descuentos</div>
                <table>
                    <thead>
                        <tr>
                            <th>Concepto / Detalle</th>
                            <th class="text-right" style="width: 150px;">Monto ($)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${descuentoAFC > 0 ? `
                        <tr>
                            <td>Descuento Aporte Empleador Seguro de Cesantía (Art. 13 Ley 19.728)</td>
                            <td class="text-right text-red-600">-$${descuentoAFC.toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        ${descuentoAnticipos > 0 ? `
                        <tr>
                            <td>Anticipo de Sueldo</td>
                            <td class="text-right text-red-600">-$${descuentoAnticipos.toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        ${descuentoPrestamoCaja > 0 ? `
                        <tr>
                            <td>Préstamo Caja de Compensación</td>
                            <td class="text-right text-red-600">-$${descuentoPrestamoCaja.toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        ${descuentoPrestamoEmpresa > 0 ? `
                        <tr>
                            <td>Préstamo Interno Empresa</td>
                            <td class="text-right text-red-600">-$${descuentoPrestamoEmpresa.toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        ${descuentoAfpProporcional > 0 ? `
                        <tr>
                            <td>Cotización AFP Proporcional</td>
                            <td class="text-right text-red-600">-$${descuentoAfpProporcional.toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        ${descuentoSaludProporcional > 0 ? `
                        <tr>
                            <td>Cotización Salud Proporcional</td>
                            <td class="text-right text-red-600">-$${descuentoSaludProporcional.toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        ${descuentoAfcProporcional > 0 ? `
                        <tr>
                            <td>Cotización AFC Proporcional</td>
                            <td class="text-right text-red-600">-$${descuentoAfcProporcional.toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        ${descuentoSeguroColectivo > 0 ? `
                        <tr>
                            <td>Seguro Colectivo / Convenio</td>
                            <td class="text-right text-red-600">-$${descuentoSeguroColectivo.toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        ${descuentoEquiposNoDevueltos > 0 ? `
                        <tr>
                            <td>Descuento por Equipos/Herramientas no Devueltos</td>
                            <td class="text-right text-red-600">-$${descuentoEquiposNoDevueltos.toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        ${otrosDescuentos > 0 ? `
                        <tr>
                            <td>Otros Descuentos autorizados</td>
                            <td class="text-right text-red-600">-$${otrosDescuentos.toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        <tr class="font-bold">
                            <td>TOTAL DESCUENTOS</td>
                            <td class="text-right">-$${totalDescuentos.toLocaleString('es-CL')}</td>
                        </tr>
                    </tbody>
                </table>

                <table>
                    <tbody>
                        <tr class="font-bold" style="font-size: 13px; background: #e2e8f0;">
                            <td>SALDO NETO A PAGAR AL TRABAJADOR</td>
                            <td class="text-right" style="color: #047857;">$${netoFiniquito.toLocaleString('es-CL')}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="body-text">
                    <strong>TERCERO:</strong> El Trabajador declara recibir del Empleador, a su entera satisfacción, la suma neta de <strong>$${netoFiniquito.toLocaleString('es-CL')}</strong> mediante transferencia bancaria o vale vista, y otorga con esto el más amplio, completo y recíproco finiquito de todas las obligaciones laborales, declarando no tener deuda pendiente alguna por concepto de remuneraciones, horas extras, feriado legal o proporcional, cotizaciones previsionales u otros.
                </div>

                <div class="reserva-box">
                    <div class="reserva-title">Reserva de Derechos del Trabajador (Espacio Legal de la DT)</div>
                    <div style="font-size: 10px; color: #64748b; margin-bottom: 20px;">
                        De conformidad con la doctrina de la Dirección del Trabajo, el trabajador conserva la facultad de consignar su reserva de derechos al estampar su firma para posteriores acciones ante tribunales.
                    </div>
                    <div style="border-bottom: 1px solid #cbd5e1; height: 16px; margin-bottom: 10px;"></div>
                    <div style="border-bottom: 1px solid #cbd5e1; height: 16px; margin-bottom: 10px;"></div>
                    <div style="border-bottom: 1px solid #cbd5e1; height: 16px;"></div>
                </div>

                ${fd.procesadoEn === 'Notaria' ? `
                <div class="reserva-box" style="border: 1px solid #cbd5e1; padding: 15px; margin-top: 25px; border-radius: 8px; background: #f8fafc;">
                    <div class="reserva-title" style="font-weight: 900; font-size: 11px; text-transform: uppercase; color: #475569; margin-bottom: 6px;">
                        Certificación de Ministro de Fe (Notario Público)
                    </div>
                    <div style="font-size: 10px; color: #334155; line-height: 1.4; text-align: justify;">
                        Autorizo las firmas de los comparecientes don/ña <strong>${candidato.fullName}</strong> y el representante legal de <strong>${empresaNombre}</strong>, quienes firman ante mí en señal de conformidad y ratificación de este documento, y después de haber pagado la suma de $${netoFiniquito.toLocaleString('es-CL')} pactada.
                    </div>
                    <div style="font-size: 9px; color: #64748b; margin-top: 8px; font-weight: bold;">
                        Fecha de legalización: ${fd.notariaFechaFirma ? new Date(fd.notariaFechaFirma).toLocaleDateString('es-CL') : '______'} | Gastos notariales: $${(fd.notariaGastos || 0).toLocaleString('es-CL')} (Pagado por ${fd.notariaPagadoPor})
                    </div>
                </div>` : ''}

                ${fd.procesadoEn === 'Notaria' ? `
                <div class="firmas" style="display: flex; justify-content: space-between; margin-top: 60px;">
                    <div class="firma-box" style="width: 30%; text-align: center;">
                        <div class="linea"></div>
                        <p class="font-bold">${candidato.fullName}</p>
                        <p>TRABAJADOR</p>
                        <p>RUT: ${candidato.rut}</p>
                    </div>
                    <div class="firma-box" style="width: 30%; text-align: center;">
                        <div class="linea"></div>
                        <p class="font-bold">${empresaNombre}</p>
                        <p>EMPLEADOR</p>
                    </div>
                    <div class="firma-box" style="width: 30%; text-align: center;">
                        <div class="linea"></div>
                        <p class="font-bold">${fd.notariaNombre || 'NOTARIO PÚBLICO'}</p>
                        <p>MINISTRO DE FE / NOTARIO</p>
                    </div>
                </div>
                ` : `
                <div class="firmas">
                    <div class="firma-box" style="width: 45%;">
                        <div class="linea"></div>
                        <p class="font-bold">${candidato.fullName}</p>
                        <p>TRABAJADOR</p>
                        <p>RUT: ${candidato.rut}</p>
                    </div>
                    <div class="firma-box" style="width: 45%;">
                        <div class="linea"></div>
                        <p class="font-bold">${empresaNombre}</p>
                        <p>EMPLEADOR</p>
                    </div>
                </div>
                `}
            </body>
            </html>
        `;
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) return alert('No se pudo abrir la ventana de impresión. Por favor, desactiva el bloqueador de popups.');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500);
    };

    const contratadosFiltrados = contratados.filter(c => {
        if (!contratadoSearch) return true;
        const q = contratadoSearch.toLowerCase();
        return [c.fullName, c.rut, c.position].filter(Boolean).join(' ').toLowerCase().includes(q);
    });



    // Bóveda Calcs
    const bovedaCecos = [...new Set(bovedaEmployees.map(e => e.ceco).filter(Boolean))];
    const bovedaFiltered = bovedaEmployees.filter(e => {
        const term = bovedaSearchTerm.toLowerCase();
        const cleanSearch = bovedaSearchTerm.replace(/[^0-9kK]/gi, '');
        const cleanRut = e.rut ? e.rut.replace(/[^0-9kK]/gi, '') : '';
        const search = !bovedaSearchTerm ||
            e.fullName?.toLowerCase().includes(term) ||
            (cleanSearch && cleanRut.includes(cleanSearch)) ||
            e.position?.toLowerCase().includes(term);
        const matchCeco = !bovedaFilterCeco || e.ceco === bovedaFilterCeco;
        const matchProj = !bovedaFilterProj || e.projectName === bovedaFilterProj || (e.projectId?.toString() === bovedaFilterProj);
        return search && matchCeco && matchProj;
    });

    return (
        <div className="w-full overflow-x-hidden relative min-h-full bg-slate-50/50 p-6 pb-20">

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-lg shadow-slate-200">
                        <FileText size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800">Finiquitos</h1>
                        <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-wider">Gestión integral de desvinculaciones y legalización</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowRenunciaModal(true)}
                        className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-colors shadow-md shadow-violet-200"
                    >
                        <Sparkles size={14} /> Procesar Renuncia (AI)
                    </button>
                    <button
                        onClick={() => setShowBulkModal(true)}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-white font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-700 transition-colors shadow-md shadow-slate-200"
                    >
                        <UploadCloud size={14} /> Carga Masiva
                    </button>
                    <button
                        onClick={() => setShowFiniquitoModal(true)}
                        className="px-4 py-2 rounded-xl bg-red-500 text-white font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-red-600 transition-colors"
                    >
                        <UserMinus size={14} /> Registrar Finiquito
                    </button>
                    <span className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-black text-xs uppercase tracking-widest">Total: {total}</span>
                    <span className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 font-black text-xs uppercase tracking-widest">Últimos 30d: {recientes}</span>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl mb-8 w-fit overflow-x-auto">
                <button
                    onClick={() => setCurrentTab('boveda')}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                        currentTab === 'boveda'
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Archive size={14} /> Dashboard Bóveda
                </button>
                <button
                    onClick={() => setCurrentTab('finiquitos')}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                        currentTab === 'finiquitos'
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <FileText size={14} /> Registro de Finiquitos
                </button>
                <button
                    onClick={() => setCurrentTab('cartas')}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                        currentTab === 'cartas'
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Printer size={14} /> Cartas de Término
                </button>
                <button
                    onClick={() => setCurrentTab('renuncias')}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                        currentTab === 'renuncias'
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Sparkles size={14} /> Bandeja de Renuncias (AI)
                </button>
            </div>

            {currentTab === 'boveda' && (
                <BovedaDashboard
                    bovedaEmployees={bovedaEmployees}
                    bovedaLoading={bovedaLoading}
                    projects={projects}
                    onOpenFiniquito={(emp) => {
                        handleAbrirEdicion(emp);
                        setShowFiniquitoModal(true);
                    }}
                />
            )}
            {currentTab === 'finiquitos' && (
                <FiniquitosTable
                    candidatos={candidatos}
                    projects={projects}
                    loading={loading}
                    onOpenDetail={(c) => setShowDetail(c)}
                    formatDateUTC={formatDateUTC}
                />
            )}

            {/* Modal: Registrar / Editar Finiquito */}
            <FiniquitoModalAsistente
                isOpen={showFiniquitoModal}
                onClose={() => { setShowFiniquitoModal(false); setFiniquitoTarget(null); setIsEditing(false); }}
                initialTarget={finiquitoTarget}
                isEditing={isEditing}
                contratados={contratados}
                ufValue={ufValue}
                onSuccess={() => { setShowFiniquitoModal(false); setFiniquitoTarget(null); setIsEditing(false); cargarDatos(); }}
            />

            {currentTab === 'cartas' && (
                <CartasAsistente
                    contratados={contratados}
                    MOTIVOS={MOTIVOS}
                />
            )}

            {currentTab === 'renuncias' && (
                <RenunciaAsistente
                    contratados={contratados}
                    onIniciarFiniquito={(matched, proposedDate, causalTermino) => {
                        handleSelectCandidato(matched);
                        setFiniquitoTarget(matched);
                        setIsEditing(false);
                        setShowFiniquitoModal(true);
                    }}
                />
            )}

            {/* Modal: Detalle */}
            <FiniquitoDetailModal
                show={showDetail}
                onClose={() => setShowDetail(null)}
                onEdit={(target) => { setShowDetail(null); handleAbrirEdicion(target); }}
                onUpload={handleUpload}
                generateFiniquitoPdf={generateFiniquitoPdf}
                legalFile={legalFile}
                setLegalFile={setLegalFile}
                uploading={uploading}
                formatDateUTC={formatDateUTC}
            />

            {/* Modal: Procesar Renuncia (AI) - Mantenido como fallback para el botón del header */}
            {showRenunciaModal && (
                <RenunciaAsistente
                    isModal
                    contratados={contratados}
                    onClose={() => setShowRenunciaModal(false)}
                    onIniciarFiniquito={(matched) => {
                        handleSelectCandidato(matched);
                        setShowRenunciaModal(false);
                        setShowFiniquitoModal(true);
                    }}
                />
            )}

            {/* Modal de Carga Masiva */}
            <BulkUploadModal
                isOpen={showBulkModal}
                onClose={() => setShowBulkModal(false)}
                onUpload={handleBulkFiniquitosUpload}
                templateHeaders={templateHeaders}
                templateData={templateData}
                title="Carga Masiva de Finiquitos"
            />
        </div>
    );
};

export default Finiquitos;

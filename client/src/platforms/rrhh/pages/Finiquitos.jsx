import React, { useState, useEffect } from 'react';
import { FileText, Search, Loader2, Eye, Download, Upload, X, UserMinus, CheckCircle, Edit2, Calculator, AlertCircle, Calendar, Printer, Sparkles, UploadCloud } from 'lucide-react';
import { candidatosApi, proyectosApi } from '../rrhhApi';
import { useIndicadores } from '../../../contexts/IndicadoresContext';
import BulkUploadModal from '../../../components/BulkUploadModal';


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
    const [currentTab, setCurrentTab] = useState('finiquitos'); // 'finiquitos', 'cartas' or 'renuncias'
    const [showRenunciaModal, setShowRenunciaModal] = useState(false);
    const [parsingRenuncia, setParsingRenuncia] = useState(false);
    const [renunciaFile, setRenunciaFile] = useState(null);
    const [parsedResult, setParsedResult] = useState(null);
    const [cartaCandidatoId, setCartaCandidatoId] = useState('');
    const [cartaSearchTerm, setCartaSearchTerm] = useState('');
    const [cartaFechaAviso, setCartaFechaAviso] = useState('');
    const [cartaFechaTermino, setCartaFechaTermino] = useState('');
    const [cartaCausal, setCartaCausal] = useState('');
    const [cartaHechos, setCartaHechos] = useState('');
    const [cartaEstadoCotizaciones, setCartaEstadoCotizaciones] = useState(true);
    
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

    const handleParseRenuncia = async () => {
        if (!renunciaFile) return alert('Por favor, selecciona un archivo.');
        setParsingRenuncia(true);
        setParsedResult(null);
        try {
            const formData = new FormData();
            formData.append('file', renunciaFile);
            
            const resp = await candidatosApi.parseRenuncia(formData);
            const { matched, proposedDate, causalTermino } = resp.data;
            
            setParsedResult({
                matched: matched || null,
                proposedDate: proposedDate || new Date().toISOString().split('T')[0],
                causalTermino: causalTermino || 'Renuncia voluntaria (Art. 159 N°2)'
            });
        } catch (err) {
            console.error(err);
            alert('Error al analizar el documento de renuncia. Asegúrate de subir un archivo PDF o imagen legible.');
        } finally {
            setParsingRenuncia(false);
        }
    };

    const generateCartaTerminoPdf = (candidato) => {
        if (!candidato) return alert('Selecciona un colaborador.');
        if (!cartaFechaTermino) return alert('Ingresa la fecha de término.');
        if (!cartaCausal) return alert('Selecciona la causal legal.');
        if (!cartaHechos) return alert('Ingresa los hechos que fundan la causal.');

        const fechaAvisoStr = cartaFechaAviso
            ? formatLongDateUTC(cartaFechaAviso)
            : formatLongDateUTC(new Date().toISOString());
            
        const fechaTerminoStr = formatLongDateUTC(cartaFechaTermino);
        
        const empresaNombre = candidato.empresaRef?.nombre || 'Empresa Empleadora';
        
        const html = `
            <html>
            <head>
                <title>Carta de Aviso de Término de Contrato - ${candidato.fullName}</title>
                <style>
                    body { font-family: 'Arial', sans-serif; color: #1e293b; margin: 50px; line-height: 1.6; font-size: 12px; }
                    .header { text-align: right; margin-bottom: 40px; font-weight: bold; color: #475569; }
                    .destinatario { margin-bottom: 30px; }
                    .destinatario p { margin: 3px 0; }
                    .titulo { text-align: center; font-size: 14px; font-weight: 800; text-transform: uppercase; margin-bottom: 30px; color: #0f172a; }
                    .cuerpo { text-align: justify; margin-bottom: 25px; }
                    .hechos-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; margin: 15px 0; border-radius: 8px; font-style: italic; }
                    .cotizaciones { margin-bottom: 30px; font-weight: bold; color: #1e293b; }
                    .firmas { display: flex; justify-content: space-between; margin-top: 80px; }
                    .firma-box { width: 45%; text-align: center; }
                    .linea { border-top: 1px solid #475569; margin-top: 60px; margin-bottom: 5px; }
                    .info-dt { font-size: 10px; color: #64748b; margin-top: 50px; border-top: 1px dashed #cbd5e1; padding-top: 10px; text-align: center; }
                </style>
            </head>
            <body>
                <div class="header">
                    Rancagua, ${fechaAvisoStr}
                </div>
                
                <div class="destinatario">
                    <p><strong>Señor(a):</strong></p>
                    <p><strong>${candidato.fullName}</strong></p>
                    <p>RUT: ${candidato.rut}</p>
                    <p>Domicilio: ${candidato.address || 'No registrado'}</p>
                    <p>Presente</p>
                </div>
                
                <div class="titulo">
                    Comunicación de Término de Relación Laboral
                </div>
                
                <div class="cuerpo">
                    Por medio de la presente, y de conformidad a lo establecido en los artículos 162 y siguientes del Código del Trabajo, venimos en comunicar a usted la decisión de esta empresa de poner término al contrato de trabajo que nos vincula, a contar del <strong>${fechaTerminoStr}</strong>.
                </div>
                
                <div class="cuerpo">
                    La causal legal en la que se fundamenta esta decisión es la del <strong>${cartaCausal}</strong>.
                </div>
                
                <div class="cuerpo">
                    <strong>Hechos en que se funda el término del contrato:</strong>
                    <div class="hechos-box">
                        ${cartaHechos.replace(/\n/g, '<br />')}
                    </div>
                </div>
                
                <div class="cotizaciones">
                    Asimismo, en cumplimiento a lo dispuesto en la Ley N° 19.631 (Ley Bustos), dejamos expresa constancia de que sus cotizaciones previsionales, de salud y del seguro de desempleo se encuentran totalmente declaradas y pagadas a los organismos correspondientes a la fecha de término de su contrato de trabajo. Adjuntamos a esta comunicación los certificados previsionales impresos correspondientes.
                </div>
                
                <div class="cuerpo">
                    Agradecemos los servicios prestados a la compañía durante la vigencia de su contrato y le solicitamos presentarse a la brevedad para realizar el pago de sus haberes previsionales y firma del correspondiente finiquito de contrato de trabajo.
                </div>
                
                <div class="firmas">
                    <div class="firma-box">
                        <div class="linea"></div>
                        <p><strong>${empresaNombre}</strong></p>
                        <p>EMPLEADOR / REPRESENTANTE LEGAL</p>
                    </div>
                    <div class="firma-box">
                        <div class="linea"></div>
                        <p><strong>${candidato.fullName}</strong></p>
                        <p>FIRMA DE RECEPCIÓN TRABAJADOR</p>
                        <p>Fecha de recepción: ____/____/________</p>
                    </div>
                </div>
                
                <div class="info-dt">
                    Nota al Empleador: De conformidad con el artículo 162 del Código del Trabajo, recuerde que debe enviar una copia exacta de esta comunicación a la Inspección del Trabajo respectiva dentro de los plazos legales contados desde la separación del trabajador (3 días hábiles para Art. 161; 6 días hábiles para causales de los Artículos 159 y 160).
                </div>
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

    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        setLoading(true);
        try {
            const [finiquitadosResp, contratadosResp, proyectosResp] = await Promise.all([
                candidatosApi.getFiniquitos(),
                candidatosApi.getAll({ status: 'Contratado' }),
                proyectosApi.getAll(),
            ]);
            setCandidatos(finiquitadosResp.data || []);
            setContratados(contratadosResp.data || []);
            const projs = (proyectosResp.data || []).map(p => ({
                id: p._id,
                name: p.nombreProyecto || p.projectName || p._id,
            }));
            setProjects(projs);
        } catch (err) {
            console.error('Error cargando datos de finiquitos', err);
        } finally {
            setLoading(false);
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

    const activeContratados = contratados.filter(c => {
        if (!cartaSearchTerm) return true;
        const q = cartaSearchTerm.toLowerCase();
        return [c.fullName, c.rut, c.position].filter(Boolean).join(' ').toLowerCase().includes(q);
    });

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-20">

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
                        onClick={() => { setParsedResult(null); setRenunciaFile(null); setShowRenunciaModal(true); }}
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
            <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl mb-8 w-fit">
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

            {currentTab === 'finiquitos' && (
                <>
                    {/* Filtros */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="md:col-span-2">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar por nombre, RUT, proyecto"
                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                        />
                    </div>
                </div>
                <div>
                    <select
                        value={filterProject}
                        onChange={e => setFilterProject(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                        <option value="all">Todos los proyectos</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div>
                    <input
                        type="date"
                        value={filterDateFrom}
                        onChange={e => setFilterDateFrom(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                </div>
                <div>
                    <input
                        type="date"
                        value={filterDateTo}
                        onChange={e => setFilterDateTo(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                </div>
            </div>

            {/* Tabla */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="animate-spin text-violet-500" size={36} />
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-20 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 font-bold text-sm">
                    No hay finiquitos registrados para estos filtros
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                                <tr>
                                    <th className="px-4 py-3">Colaborador</th>
                                    <th className="px-4 py-3">Proyecto</th>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3">Fecha Finiquito</th>
                                    <th className="px-4 py-3">Motivo</th>
                                    <th className="px-4 py-3 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(c => (
                                    <tr key={c._id} className="border-t border-slate-100 hover:bg-slate-50 transition-all">
                                        <td className="px-4 py-3">
                                            <p className="font-black text-slate-800">{c.fullName}</p>
                                            <p className="text-[10px] text-slate-400 uppercase font-bold">{c.rut}</p>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {c.projectName || c.projectId?.nombreProyecto || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1.5 items-start">
                                                <span className="text-xs font-black uppercase bg-red-100 text-red-600 px-2 py-1 rounded-full">
                                                    {c.status}
                                                </span>
                                                {c.finiquitoDetalle?.procesadoEn === 'Notaria' ? (
                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                                                        c.finiquitoDetalle?.notariaEstado === 'Firmado' 
                                                            ? 'bg-emerald-100 text-emerald-700' 
                                                            : c.finiquitoDetalle?.notariaEstado === 'En Notaria'
                                                            ? 'bg-violet-100 text-violet-700'
                                                            : c.finiquitoDetalle?.notariaEstado === 'Rechazado'
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        🏛️ Notaría: {c.finiquitoDetalle?.notariaEstado || 'Pendiente'}
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
                                                        📁 Módulo Interno
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {c.fechaFiniquito ? formatDateUTC(c.fechaFiniquito) : 'Sin fecha'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-xs max-w-[180px] truncate">
                                            {c.finiquitoMotivo || 'No informado'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end">
                                                <button
                                                    onClick={() => setShowDetail(c)}
                                                    className="h-8 px-4 rounded-xl bg-slate-900 text-white text-[10px] uppercase font-black tracking-wider flex items-center justify-center gap-1.5 hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm"
                                                >
                                                    <Eye size={14} /> Detalle / Editar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
                </>
            )}

            {/* Modal: Registrar / Editar Finiquito */}
            {showFiniquitoModal && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => { setShowFiniquitoModal(false); setFiniquitoTarget(null); setIsEditing(false); setCalcPreview(null); }}
                >
                    <div
                        className="bg-white rounded-3xl w-full max-w-6xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <Calculator size={18} className="text-red-500" />
                                <h3 className="text-lg font-black uppercase text-slate-800">
                                    {isEditing ? `Editar Finiquito — ${finiquitoTarget?.fullName}` : 'Registrar y Calcular Finiquito'}
                                </h3>
                            </div>
                            <button 
                                onClick={() => { setShowFiniquitoModal(false); setFiniquitoTarget(null); setIsEditing(false); setCalcPreview(null); }} 
                                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
                            
                            {/* Columna Izquierda: Parámetros del cálculo */}
                            <div className="lg:col-span-3 space-y-4 pr-0 lg:pr-4">
                                
                                {/* 1. Selección de Colaborador */}
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
                                                        key={c._id}
                                                        type="button"
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
                                                        type="date"
                                                        value={finiquitoData.fechaEgreso}
                                                        onChange={e => setFiniquitoData(d => ({ ...d, fechaEgreso: e.target.value }))}
                                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Causal de Término</label>
                                                    <select
                                                        value={finiquitoData.causalTermino}
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
                                                            type="date"
                                                            value={finiquitoData.fechaNotificacion || ''}
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
                                                    <button
                                                        type="button"
                                                        onClick={() => setFiniquitoData(d => ({ ...d, procesadoEn: 'Modulo' }))}
                                                        className={`flex-1 py-2 px-3 rounded-xl border text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 ${
                                                            finiquitoData.procesadoEn === 'Modulo'
                                                                ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        📁 Interno (Módulo GenAI)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFiniquitoData(d => ({ ...d, procesadoEn: 'Notaria' }))}
                                                        className={`flex-1 py-2 px-3 rounded-xl border text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 ${
                                                            finiquitoData.procesadoEn === 'Notaria'
                                                                ? 'bg-violet-600 border-violet-600 text-white shadow-sm'
                                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        🏛️ Externo (En Notaría)
                                                    </button>
                                                </div>

                                                {finiquitoData.procesadoEn === 'Notaria' && (
                                                    <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-200/50">
                                                        <div>
                                                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Nombre de Notaría</label>
                                                            <input
                                                                type="text"
                                                                value={finiquitoData.notariaNombre}
                                                                onChange={e => setFiniquitoData(d => ({ ...d, notariaNombre: e.target.value }))}
                                                                placeholder="Ej: Notaría Ramón Valdivieso"
                                                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-350 bg-white"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Fecha de Firma / Legalización</label>
                                                            <input
                                                                type="date"
                                                                value={finiquitoData.notariaFechaFirma}
                                                                onChange={e => setFiniquitoData(d => ({ ...d, notariaFechaFirma: e.target.value }))}
                                                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-350 bg-white"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Gastos de Notaría ($)</label>
                                                            <input
                                                                type="number"
                                                                value={finiquitoData.notariaGastos}
                                                                onChange={e => setFiniquitoData(d => ({ ...d, notariaGastos: e.target.value }))}
                                                                placeholder="Valor cobrado por notaría"
                                                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-350 bg-white"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Gastos Asumidos Por</label>
                                                            <select
                                                                value={finiquitoData.notariaPagadoPor}
                                                                onChange={e => setFiniquitoData(d => ({ ...d, notariaPagadoPor: e.target.value }))}
                                                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-350 bg-white"
                                                            >
                                                                <option value="Empleador">Empleador (Empresa)</option>
                                                                <option value="Trabajador">Trabajador (Colaborador)</option>
                                                                <option value="Compartido">Compartido (50% / 50%)</option>
                                                            </select>
                                                        </div>
                                                        <div className="md:col-span-2">
                                                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Estado de Firma / Trámite</label>
                                                            <select
                                                                value={finiquitoData.notariaEstado}
                                                                onChange={e => setFiniquitoData(d => ({ ...d, notariaEstado: e.target.value }))}
                                                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-350 bg-white"
                                                            >
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
                                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Sueldo Base Fijo ($)</label>
                                                    <input
                                                        type="number"
                                                        value={finiquitoData.sueldoBaseFijo}
                                                        onChange={e => setFiniquitoData(d => ({ ...d, sueldoBaseFijo: e.target.value }))}
                                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Promedio Variable ($)</label>
                                                    <input
                                                        type="number"
                                                        value={finiquitoData.promedioSueldoVariable}
                                                        onChange={e => setFiniquitoData(d => ({ ...d, promedioSueldoVariable: e.target.value }))}
                                                        placeholder="Promedio últimos 3m"
                                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Gratificación Mensual ($)</label>
                                                    <input
                                                        type="number"
                                                        value={finiquitoData.gratificacion}
                                                        onChange={e => setFiniquitoData(d => ({ ...d, gratificacion: e.target.value }))}
                                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Valor UF del Día ($)</label>
                                                    <input
                                                        type="number"
                                                        value={finiquitoData.valorUF}
                                                        onChange={e => setFiniquitoData(d => ({ ...d, valorUF: e.target.value }))}
                                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Colación Regular ($)</label>
                                                    <input
                                                        type="number"
                                                        value={finiquitoData.colacion}
                                                        onChange={e => setFiniquitoData(d => ({ ...d, colacion: e.target.value }))}
                                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Movilización Regular ($)</label>
                                                    <input
                                                        type="number"
                                                        value={finiquitoData.movilizacion}
                                                        onChange={e => setFiniquitoData(d => ({ ...d, movilizacion: e.target.value }))}
                                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Vacs Tomadas (Días)</label>
                                                    <input
                                                        type="number"
                                                        value={finiquitoData.diasVacacionesTomados}
                                                        onChange={e => setFiniquitoData(d => ({ ...d, diasVacacionesTomados: e.target.value }))}
                                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Vacs Progresivas (Días)</label>
                                                    <input
                                                        type="number"
                                                        value={finiquitoData.diasVacacionesProgresivas}
                                                        onChange={e => setFiniquitoData(d => ({ ...d, diasVacacionesProgresivas: e.target.value }))}
                                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                    />
                                                </div>
                                            </div>

                                            {/* Días Proporcionales del mes de término */}
                                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <label className="flex items-center gap-2 text-xs font-black uppercase text-slate-700 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={finiquitoData.pagarDiasProporcionales}
                                                            onChange={e => setFiniquitoData(d => ({ ...d, pagarDiasProporcionales: e.target.checked }))}
                                                            className="rounded text-violet-600 focus:ring-violet-300"
                                                        />
                                                        ¿Pagar días proporcionales del mes de egreso?
                                                    </label>
                                                </div>
                                                {finiquitoData.pagarDiasProporcionales && (
                                                    <div className="pt-2 grid grid-cols-1 gap-3 border-t border-slate-200/50">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Días Trabajados en el Mes</label>
                                                                <input
                                                                    type="number"
                                                                    value={finiquitoData.diasTrabajadosMes}
                                                                    onChange={e => setFiniquitoData(d => ({ ...d, diasTrabajadosMes: e.target.value }))}
                                                                    placeholder="Ej: 6"
                                                                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-350 bg-white"
                                                                />
                                                            </div>
                                                            <div className="flex flex-col justify-end text-[11px] text-slate-500 font-bold bg-white border border-slate-100 rounded-xl p-2.5">
                                                                 {calcPreview?.diasProporcionales?.totalHaberesProporcionales > 0 ? (
                                                                      <div className="space-y-1">
                                                                          <div className="flex justify-between">
                                                                              <span>Sueldo Prop.:</span>
                                                                              <span>${calcPreview.diasProporcionales.montoSueldoProporcional.toLocaleString('es-CL')}</span>
                                                                          </div>
                                                                          {calcPreview.diasProporcionales.montoGratificacionProporcional > 0 && (
                                                                              <div className="flex justify-between">
                                                                                  <span>Gratif. Prop.:</span>
                                                                                  <span>${calcPreview.diasProporcionales.montoGratificacionProporcional.toLocaleString('es-CL')}</span>
                                                                              </div>
                                                                          )}
                                                                          <div className="flex justify-between font-black text-slate-700 pt-0.5 border-t border-slate-100">
                                                                              <span>Total Haberes Prop.:</span>
                                                                              <span>${calcPreview.diasProporcionales.totalHaberesProporcionales.toLocaleString('es-CL')}</span>
                                                                          </div>
                                                                      </div>
                                                                 ) : (
                                                                      <p className="text-center italic">Calculando haberes del mes...</p>
                                                                 )}
                                                            </div>
                                                        </div>

                                                        {/* Descuentos Previsionales sobre los Días Proporcionales */}
                                                        {calcPreview?.diasProporcionales?.totalHaberesProporcionales > 0 && (
                                                            <div className="pt-2 border-t border-dashed border-slate-200 space-y-2">
                                                                <h5 className="text-[10px] font-black uppercase text-slate-400">Leyes Sociales s/ Días Proporcionales (Overrides)</h5>
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                                    <div>
                                                                        <label className="block text-[9px] font-bold text-slate-500 mb-1">
                                                                            AFP (Calculado: ${calcPreview.descuentosDetallados?.descuentoAfpProporcional?.toLocaleString('es-CL') || 0})
                                                                        </label>
                                                                        <input
                                                                            type="number"
                                                                            value={finiquitoData.descuentoAfpProporcional}
                                                                            placeholder={calcPreview.descuentosDetallados?.descuentoAfpProporcional}
                                                                            onChange={e => setFiniquitoData(d => ({ ...d, descuentoAfpProporcional: e.target.value }))}
                                                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-350 bg-white"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[9px] font-bold text-slate-500 mb-1">
                                                                            Salud (Calculado: ${calcPreview.descuentosDetallados?.descuentoSaludProporcional?.toLocaleString('es-CL') || 0})
                                                                        </label>
                                                                        <input
                                                                            type="number"
                                                                            value={finiquitoData.descuentoSaludProporcional}
                                                                            placeholder={calcPreview.descuentosDetallados?.descuentoSaludProporcional}
                                                                            onChange={e => setFiniquitoData(d => ({ ...d, descuentoSaludProporcional: e.target.value }))}
                                                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-350 bg-white"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[9px] font-bold text-slate-500 mb-1">
                                                                            AFC (Calculado: ${calcPreview.descuentosDetallados?.descuentoAfcProporcional?.toLocaleString('es-CL') || 0})
                                                                        </label>
                                                                        <input
                                                                            type="number"
                                                                            value={finiquitoData.descuentoAfcProporcional}
                                                                            placeholder={calcPreview.descuentosDetallados?.descuentoAfcProporcional}
                                                                            onChange={e => setFiniquitoData(d => ({ ...d, descuentoAfcProporcional: e.target.value }))}
                                                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-350 bg-white"
                                                                        />
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
                                                        <input
                                                            type="number"
                                                            value={finiquitoData.montoAFC}
                                                            onChange={e => setFiniquitoData(d => ({ ...d, montoAFC: e.target.value }))}
                                                            placeholder="Cartola AFC del Empleador"
                                                            className="w-full px-3 py-1.5 border border-red-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                                                        />
                                                    </div>
                                                    <div className="flex items-center pt-5">
                                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={finiquitoData.excluirAviso}
                                                                disabled={(() => {
                                                                    if (!finiquitoData.fechaEgreso || !finiquitoData.fechaNotificacion) return false;
                                                                    const fNotif = new Date(finiquitoData.fechaNotificacion);
                                                                    const fEgres = new Date(finiquitoData.fechaEgreso);
                                                                    fNotif.setHours(0,0,0,0);
                                                                    fEgres.setHours(0,0,0,0);
                                                                    const diffDays = Math.round((fEgres - fNotif) / (1000 * 60 * 60 * 24));
                                                                    return diffDays < 30;
                                                                })()}
                                                                onChange={e => setFiniquitoData(d => ({ ...d, excluirAviso: e.target.checked }))}
                                                                className="rounded text-red-500 focus:ring-red-300 disabled:opacity-50"
                                                            />
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
                                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Anticipos de Sueldo ($)</label>
                                                        <input
                                                            type="number"
                                                            value={finiquitoData.descuentoAnticipos}
                                                            onChange={e => setFiniquitoData(d => ({ ...d, descuentoAnticipos: e.target.value }))}
                                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Préstamo Caja ($)</label>
                                                        <input
                                                            type="number"
                                                            value={finiquitoData.descuentoPrestamoCaja}
                                                            onChange={e => setFiniquitoData(d => ({ ...d, descuentoPrestamoCaja: e.target.value }))}
                                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Préstamo Empresa ($)</label>
                                                        <input
                                                            type="number"
                                                            value={finiquitoData.descuentoPrestamoEmpresa}
                                                            onChange={e => setFiniquitoData(d => ({ ...d, descuentoPrestamoEmpresa: e.target.value }))}
                                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Seguro Colectivo ($)</label>
                                                        <input
                                                            type="number"
                                                            value={finiquitoData.descuentoSeguroColectivo}
                                                            onChange={e => setFiniquitoData(d => ({ ...d, descuentoSeguroColectivo: e.target.value }))}
                                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Equipos/Heras ($)</label>
                                                        <input
                                                            type="number"
                                                            value={finiquitoData.descuentoEquiposNoDevueltos}
                                                            onChange={e => setFiniquitoData(d => ({ ...d, descuentoEquiposNoDevueltos: e.target.value }))}
                                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Otros Haberes y Saldos Adicionales</h4>
                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Indemnización Vol. ($)</label>
                                                        <input
                                                            type="number"
                                                            value={finiquitoData.indemnizacionVoluntaria}
                                                            onChange={e => setFiniquitoData(d => ({ ...d, indemnizacionVoluntaria: e.target.value }))}
                                                            placeholder="Bono desvinculación"
                                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Aguinaldos/Bonos ($)</label>
                                                        <input
                                                            type="number"
                                                            value={finiquitoData.aguinaldosOtros}
                                                            onChange={e => setFiniquitoData(d => ({ ...d, aguinaldosOtros: e.target.value }))}
                                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Otros Haberes ($)</label>
                                                        <input
                                                            type="number"
                                                            value={finiquitoData.otrosHaberes}
                                                            onChange={e => setFiniquitoData(d => ({ ...d, otrosHaberes: e.target.value }))}
                                                            placeholder="Bonos pendientes"
                                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Otros Descuentos ($)</label>
                                                        <input
                                                            type="number"
                                                            value={finiquitoData.otrosDescuentos}
                                                            onChange={e => setFiniquitoData(d => ({ ...d, otrosDescuentos: e.target.value }))}
                                                            placeholder="Deducciones varias"
                                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Observaciones / Reservas de Derechos</label>
                                                <textarea
                                                    value={finiquitoData.observacionesReservas}
                                                    onChange={e => setFiniquitoData(d => ({ ...d, observacionesReservas: e.target.value }))}
                                                    placeholder="Consignar detalles del término de la relación contractual..."
                                                    rows={2}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
                                                />
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
                                                        {calcPreview.warnings.map((w, idx) => (
                                                            <li key={idx}>{w}</li>
                                                        ))}
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
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Días acumulados:</span>
                                                        <span className="font-bold">{calcPreview.feriadoProporcional.ganados} hábiles</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Días tomados (gozados):</span>
                                                        <span className="font-bold">{calcPreview.feriadoProporcional.tomados} hábiles</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400 font-bold">Días pendientes:</span>
                                                        <span className="font-black text-emerald-400">{calcPreview.feriadoProporcional.pendientesHabiles} hábiles</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Días corridos (proyectados):</span>
                                                        <span className="font-bold">{calcPreview.feriadoProporcional.diasCorridosCalculados} corridos</span>
                                                    </div>
                                                    <div className="flex justify-between pt-1 border-t border-slate-800/40 font-black">
                                                        <span>Monto Feriado Proporcional:</span>
                                                        <span className="text-slate-100">${calcPreview.feriadoProporcional.monto.toLocaleString('es-CL')}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {calcPreview.indemnizaciones.aniosServicioCalculados > 0 && (
                                                <div className="pt-3">
                                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Indemnizaciones Art. 161/163</p>
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">Años de Servicio ({calcPreview.indemnizaciones.aniosServicioCalculados} años):</span>
                                                            <span className="font-bold">${calcPreview.indemnizaciones.montoIAS.toLocaleString('es-CL')}</span>
                                                        </div>
                                                        {calcPreview.indemnizaciones.montoISAP > 0 && (
                                                            <div className="flex justify-between">
                                                                <span className="text-slate-500">Falta de Aviso Previo:</span>
                                                                <span className="font-bold">${calcPreview.indemnizaciones.montoISAP.toLocaleString('es-CL')}</span>
                                                            </div>
                                                        )}
                                                        {calcPreview.indemnizaciones.descuentoAFC > 0 && (
                                                            <div className="flex justify-between text-red-400">
                                                                <span>Descuento Cartola AFC Empleador:</span>
                                                                <span className="font-bold">-${calcPreview.indemnizaciones.descuentoAFC.toLocaleString('es-CL')}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="pt-3 space-y-1">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Sueldo Imponible base cálculo:</span>
                                                    <span className="font-bold">${calcPreview.valoresBase.sueldoImponible.toLocaleString('es-CL')}</span>
                                                </div>
                                                {calcPreview.valoresBase.sueldoImponible > calcPreview.valoresBase.sueldoImponibleConTope && (
                                                    <div className="flex justify-between text-amber-400 font-bold">
                                                        <span>Tope legal imponible (90 UF):</span>
                                                        <span>${calcPreview.valoresBase.sueldoImponibleConTope.toLocaleString('es-CL')}</span>
                                                    </div>
                                                )}
                                                {calcPreview.diasProporcionales?.totalHaberesProporcionales > 0 && (
                                                    <>
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">Sueldo Prop. ({calcPreview.diasProporcionales.diasTrabajadosMes}d):</span>
                                                            <span className="font-bold">${calcPreview.diasProporcionales.montoSueldoProporcional.toLocaleString('es-CL')}</span>
                                                        </div>
                                                        {calcPreview.diasProporcionales.montoGratificacionProporcional > 0 && (
                                                            <div className="flex justify-between">
                                                                <span className="text-slate-500">Gratif. Prop. ({calcPreview.diasProporcionales.diasTrabajadosMes}d):</span>
                                                                <span className="font-bold">${calcPreview.diasProporcionales.montoGratificacionProporcional.toLocaleString('es-CL')}</span>
                                                                </div>
                                                        )}
                                                        {(calcPreview.diasProporcionales.montoColacionProporcional + calcPreview.diasProporcionales.montoMovilizacionProporcional) > 0 && (
                                                            <div className="flex justify-between">
                                                                <span className="text-slate-500">Asig. Prop. ({calcPreview.diasProporcionales.diasTrabajadosMes}d):</span>
                                                                <span className="font-bold">${(calcPreview.diasProporcionales.montoColacionProporcional + calcPreview.diasProporcionales.montoMovilizacionProporcional).toLocaleString('es-CL')}</span>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                                {Number(finiquitoData.indemnizacionVoluntaria) > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Indemnización Voluntaria:</span>
                                                        <span className="font-bold text-emerald-400">${Number(finiquitoData.indemnizacionVoluntaria).toLocaleString('es-CL')}</span>
                                                    </div>
                                                )}
                                                {Number(finiquitoData.aguinaldosOtros) > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Aguinaldos/Bonos Pendientes:</span>
                                                        <span className="font-bold text-emerald-400">${Number(finiquitoData.aguinaldosOtros).toLocaleString('es-CL')}</span>
                                                    </div>
                                                )}
                                                {Number(finiquitoData.otrosHaberes) > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Otros Haberes:</span>
                                                        <span className="font-bold">${Number(finiquitoData.otrosHaberes).toLocaleString('es-CL')}</span>
                                                    </div>
                                                )}
                                                {Number(finiquitoData.descuentoAnticipos) > 0 && (
                                                    <div className="flex justify-between text-red-400">
                                                        <span>Anticipos de Sueldo:</span>
                                                        <span className="font-bold">-${Number(finiquitoData.descuentoAnticipos).toLocaleString('es-CL')}</span>
                                                    </div>
                                                )}
                                                {Number(finiquitoData.descuentoPrestamoCaja) > 0 && (
                                                    <div className="flex justify-between text-red-400">
                                                        <span>Préstamo Caja Compensación:</span>
                                                        <span className="font-bold">-${Number(finiquitoData.descuentoPrestamoCaja).toLocaleString('es-CL')}</span>
                                                    </div>
                                                )}
                                                {Number(finiquitoData.descuentoPrestamoEmpresa) > 0 && (
                                                    <div className="flex justify-between text-red-400">
                                                        <span>Préstamo Interno Empresa:</span>
                                                        <span className="font-bold">-${Number(finiquitoData.descuentoPrestamoEmpresa).toLocaleString('es-CL')}</span>
                                                    </div>
                                                )}
                                                {calcPreview.descuentosDetallados?.descuentoAfpProporcional > 0 && (
                                                    <div className="flex justify-between text-red-400">
                                                        <span>Cotiz. AFP (Prop.):</span>
                                                        <span className="font-bold">-${calcPreview.descuentosDetallados.descuentoAfpProporcional.toLocaleString('es-CL')}</span>
                                                    </div>
                                                )}
                                                {calcPreview.descuentosDetallados?.descuentoSaludProporcional > 0 && (
                                                    <div className="flex justify-between text-red-400">
                                                        <span>Cotiz. Salud (Prop.):</span>
                                                        <span className="font-bold">-${calcPreview.descuentosDetallados.descuentoSaludProporcional.toLocaleString('es-CL')}</span>
                                                    </div>
                                                )}
                                                {calcPreview.descuentosDetallados?.descuentoAfcProporcional > 0 && (
                                                    <div className="flex justify-between text-red-400">
                                                        <span>Cotiz. AFC (Prop.):</span>
                                                        <span className="font-bold">-${calcPreview.descuentosDetallados.descuentoAfcProporcional.toLocaleString('es-CL')}</span>
                                                    </div>
                                                )}
                                                {Number(finiquitoData.descuentoSeguroColectivo) > 0 && (
                                                    <div className="flex justify-between text-red-400">
                                                        <span>Seguro Colectivo:</span>
                                                        <span className="font-bold">-${Number(finiquitoData.descuentoSeguroColectivo).toLocaleString('es-CL')}</span>
                                                    </div>
                                                )}
                                                {Number(finiquitoData.descuentoEquiposNoDevueltos) > 0 && (
                                                    <div className="flex justify-between text-red-400">
                                                        <span>Equipos/Herram. No Devueltos:</span>
                                                        <span className="font-bold">-${Number(finiquitoData.descuentoEquiposNoDevueltos).toLocaleString('es-CL')}</span>
                                                    </div>
                                                )}
                                                {Number(finiquitoData.otrosDescuentos) > 0 && (
                                                    <div className="flex justify-between text-red-400">
                                                        <span>Otros Descuentos:</span>
                                                        <span className="font-bold">-${Number(finiquitoData.otrosDescuentos).toLocaleString('es-CL')}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="pt-4 flex flex-col justify-end bg-slate-950 p-4 rounded-2xl border border-slate-800">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Neto a Pagar</span>
                                                <span className="text-3xl font-black text-emerald-400 mt-1">
                                                    ${calcPreview.netoFiniquito.toLocaleString('es-CL')}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>

                        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                            <button
                                onClick={() => { setShowFiniquitoModal(false); setFiniquitoTarget(null); setIsEditing(false); setCalcPreview(null); }}
                                className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-black uppercase hover:bg-slate-350 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleRegistrarFiniquito}
                                disabled={saving || !calcPreview}
                                className="px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-60 hover:bg-red-655 transition-colors"
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
                                {saving ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Confirmar Finiquito')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cartas de Término Tab */}
            {currentTab === 'cartas' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                    {/* Left Column: List of Active Workers */}
                    <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col max-h-[750px]">
                        <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3 flex items-center gap-1.5">
                            <Search size={14} /> Colaboradores Activos
                        </h3>
                        <div className="relative mb-4">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={cartaSearchTerm}
                                onChange={e => setCartaSearchTerm(e.target.value)}
                                placeholder="Buscar colaborador por nombre, rut..."
                                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                            {activeContratados.length === 0 ? (
                                <p className="text-xs text-slate-400 p-4 text-center font-bold">No se encontraron colaboradores activos.</p>
                            ) : (
                                activeContratados.map(c => {
                                    const isSelected = c._id === cartaCandidatoId;
                                    return (
                                        <button
                                            key={c._id}
                                            onClick={() => {
                                                setCartaCandidatoId(c._id);
                                                // Pre-fill some defaults
                                                if (!cartaFechaAviso) setCartaFechaAviso(new Date().toISOString().split('T')[0]);
                                                if (!cartaFechaTermino) setCartaFechaTermino(new Date().toISOString().split('T')[0]);
                                                if (!cartaCausal) setCartaCausal('Necesidades de la empresa (Art. 161)');
                                            }}
                                            className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-start justify-between ${
                                                isSelected
                                                    ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                                                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                                            }`}
                                        >
                                            <div>
                                                <p className="font-bold text-sm leading-tight">{c.fullName}</p>
                                                <p className={`text-[10px] mt-1 font-semibold uppercase ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>{c.rut}</p>
                                                <p className={`text-[10px] uppercase font-bold mt-0.5 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`}>{c.position || 'Sin cargo'}</p>
                                            </div>
                                            {isSelected && (
                                                <span className="bg-emerald-500 text-white p-1 rounded-full text-xs">
                                                    <CheckCircle size={12} />
                                                </span>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right Column: Form for Termination Letter */}
                    <div className="lg:col-span-2 space-y-6">
                        {!cartaCandidatoId ? (
                            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 font-bold flex flex-col items-center justify-center min-h-[450px] shadow-sm">
                                <Printer size={48} className="text-slate-300 mb-4 animate-bounce" />
                                <h3 className="text-base text-slate-700 font-black mb-1">Generador de Cartas de Término</h3>
                                <p className="text-xs text-slate-400 max-w-sm">Selecciona un colaborador de la lista para redactar y formalizar la carta de desvinculación de acuerdo al artículo 162 del Código del Trabajo.</p>
                            </div>
                        ) : (
                            (() => {
                                const selectedCand = contratados.find(c => c._id === cartaCandidatoId);
                                return (
                                    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
                                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                            <div>
                                                <h3 className="text-sm font-black uppercase text-slate-800">Carta de Término Legal</h3>
                                                <p className="text-xs text-slate-400 mt-0.5">Colaborador: <span className="font-black text-slate-700">{selectedCand?.fullName}</span> · RUT: <span className="font-bold text-slate-700">{selectedCand?.rut}</span></p>
                                            </div>
                                            <button
                                                onClick={() => setCartaCandidatoId('')}
                                                className="text-xs font-black uppercase tracking-wider text-red-500 hover:underline"
                                            >
                                                Cambiar Colaborador
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Fecha de Notificación / Aviso</label>
                                                <input
                                                    type="date"
                                                    value={cartaFechaAviso}
                                                    onChange={e => setCartaFechaAviso(e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Fecha de Término Efectiva</label>
                                                <input
                                                    type="date"
                                                    value={cartaFechaTermino}
                                                    onChange={e => setCartaFechaTermino(e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Causal Legal de Desvinculación</label>
                                            <select
                                                value={cartaCausal}
                                                onChange={e => setCartaCausal(e.target.value)}
                                                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 font-bold text-slate-700"
                                            >
                                                <option value="">Selecciona una causal legal...</option>
                                                {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="block text-[10px] font-black uppercase text-slate-500">Hechos que Fundan el Término de Contrato</label>
                                                <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border border-red-100 flex items-center gap-1">
                                                    <AlertCircle size={10} /> Requerido Legalmente
                                                </span>
                                            </div>
                                            <textarea
                                                value={cartaHechos}
                                                onChange={e => setCartaHechos(e.target.value)}
                                                placeholder="Ej: Describa detalladamente los hechos específicos, fechas y circunstancias justificadoras. Para necesidades de la empresa, explique las razones económicas, tecnológicas o de reestructuración..."
                                                rows={5}
                                                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 resize-y"
                                            />
                                        </div>

                                        <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                id="cotizacionesCheck"
                                                checked={cartaEstadoCotizaciones}
                                                onChange={e => setCartaEstadoCotizaciones(e.target.checked)}
                                                className="mt-1 rounded text-emerald-600 focus:ring-emerald-300 h-4 w-4"
                                            />
                                            <label htmlFor="cotizacionesCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                                                Declaración de Cotizaciones Previsionales al Día (Ley Bustos N° 19.631)
                                                <span className="block text-[10px] font-medium text-slate-500 mt-1">
                                                    Certifico bajo fe de juramento que a la fecha de término indicada se encuentran íntegramente pagadas las cotizaciones previsionales, de salud y AFC de este colaborador.
                                                </span>
                                            </label>
                                        </div>

                                        <div className="pt-3 flex justify-end">
                                            <button
                                                onClick={() => generateCartaTerminoPdf(selectedCand)}
                                                className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-md"
                                            >
                                                <Printer size={16} /> Generar y Descargar Carta (PDF)
                                            </button>
                                        </div>
                                    </div>
                                );
                            })()
                        )}
                    </div>
                </div>
            )}

            {/* Bandeja de Renuncias Tab */}
            {currentTab === 'renuncias' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                    {/* Left Column: Drag/Drop Upload Area */}
                    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col items-center justify-center text-center min-h-[400px]">
                        <div className="bg-violet-55/60 text-violet-600 p-4 rounded-full mb-4">
                            <Sparkles size={32} />
                        </div>
                        <h3 className="text-base font-black text-slate-800 mb-1.5">Procesar Renuncia (AI)</h3>
                        <p className="text-xs text-slate-400 max-w-xs mb-6">Sube el documento de renuncia voluntaria (PDF o Imagen) firmado por el trabajador para extraer sus datos automáticamente y cargarlo en el asistente.</p>

                        <div className="w-full">
                            <label className="border-2 border-dashed border-slate-200 hover:border-violet-400 bg-slate-50/50 hover:bg-violet-50/10 rounded-2xl p-6 block cursor-pointer transition-all mb-4 text-center">
                                <Upload size={24} className="mx-auto text-slate-400 mb-2" />
                                <span className="block text-xs font-black uppercase text-slate-600 tracking-wider">
                                    {renunciaFile ? renunciaFile.name : 'Seleccionar Documento'}
                                </span>
                                <span className="block text-[10px] text-slate-400 mt-1 font-bold">PDF, PNG, JPG hasta 5MB</span>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,image/*"
                                    onChange={e => {
                                        setRenunciaFile(e.target.files[0] || null);
                                        setParsedResult(null);
                                    }}
                                />
                            </label>

                            {renunciaFile && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setRenunciaFile(null); setParsedResult(null); }}
                                        className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-black uppercase text-slate-600 tracking-wider"
                                    >
                                        Limpiar
                                    </button>
                                    <button
                                        onClick={handleParseRenuncia}
                                        disabled={parsingRenuncia}
                                        className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-violet-200 disabled:opacity-60"
                                    >
                                        {parsingRenuncia ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                        {parsingRenuncia ? 'Analizando...' : 'Analizar con IA'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: AI Extraction Review */}
                    <div className="lg:col-span-2">
                        {parsingRenuncia ? (
                            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 font-bold flex flex-col items-center justify-center min-h-[400px] shadow-sm">
                                <Loader2 size={48} className="animate-spin text-violet-600 mb-4" />
                                <h3 className="text-base text-slate-700 font-black mb-1 animate-pulse">Analizando documento...</h3>
                                <p className="text-xs text-slate-400 max-w-sm">Nuestros modelos están leyendo el archivo para detectar el RUT, nombre y la fecha de egreso declarada.</p>
                            </div>
                        ) : !parsedResult ? (
                            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 font-bold flex flex-col items-center justify-center min-h-[400px] shadow-sm">
                                <Sparkles size={48} className="text-violet-300 mb-4 animate-pulse" />
                                <h3 className="text-base text-slate-700 font-black mb-1">Resultados de la Extracción</h3>
                                <p className="text-xs text-slate-400 max-w-sm">Sube y procesa una carta de renuncia para ver la coincidencia inteligente del trabajador y la propuesta de egreso automático.</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                    <h3 className="text-sm font-black uppercase text-slate-800 flex items-center gap-1.5">
                                        <Sparkles size={16} className="text-violet-600" /> Extracción Completada
                                    </h3>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                        parsedResult.matched ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                                    }`}>
                                        {parsedResult.matched ? '✓ Trabajador Identificado' : '⚠ Coincidencia Parcial / Manual'}
                                    </span>
                                </div>

                                {parsedResult.matched ? (
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-xl bg-slate-900 text-white font-black flex items-center justify-center text-lg shadow-md uppercase">
                                            {parsedResult.matched.fullName.substring(0, 2)}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-sm font-black text-slate-800">{parsedResult.matched.fullName}</h4>
                                            <p className="text-xs text-slate-500 font-medium">RUT: <span className="font-bold">{parsedResult.matched.rut}</span> · Cargo: <span className="font-bold">{parsedResult.matched.position}</span></p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 space-y-3">
                                        <div className="flex gap-2 text-xs font-bold text-amber-700 items-start">
                                            <AlertCircle size={16} className="mt-0.5" />
                                            <div>
                                                <p>No se encontró coincidencia automática.</p>
                                                <p className="font-medium text-slate-600 mt-1">El RUT o el nombre dentro de la carta de renuncia no coinciden de forma exacta con ningún colaborador activo. Por favor, selecciónalo manualmente.</p>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Buscar y Asignar Colaborador</label>
                                            <select
                                                onChange={e => {
                                                    const cand = contratados.find(c => c._id === e.target.value);
                                                    if (cand) {
                                                        setParsedResult(prev => ({ ...prev, matched: cand }));
                                                    }
                                                }}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-300 font-bold bg-white"
                                            >
                                                <option value="">Selecciona al colaborador manualmente...</option>
                                                {contratados.map(c => (
                                                    <option key={c._id} value={c._id}>{c.fullName} ({c.rut}) · {c.position}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Fecha de Egreso Propuesta</label>
                                        <input
                                            type="date"
                                            value={parsedResult.proposedDate}
                                            onChange={e => setParsedResult(prev => ({ ...prev, proposedDate: e.target.value }))}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-350"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Causal de Término Detectada</label>
                                        <input
                                            type="text"
                                            value={parsedResult.causalTermino}
                                            disabled
                                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-500 font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                                    <button
                                        onClick={() => { setRenunciaFile(null); setParsedResult(null); }}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase rounded-xl transition-colors"
                                    >
                                        Descartar
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (!parsedResult.matched) return alert('Por favor, selecciona un colaborador.');
                                            
                                            // Iniciar finiquito
                                            handleSelectCandidato(parsedResult.matched);
                                            setFiniquitoData(d => ({
                                                ...d,
                                                fechaEgreso: parsedResult.proposedDate,
                                                causalTermino: parsedResult.causalTermino
                                            }));
                                            
                                            // Limpiar estados de renuncia
                                            setRenunciaFile(null);
                                            setParsedResult(null);
                                            
                                            // Abrir finiquito modal
                                            setShowFiniquitoModal(true);
                                        }}
                                        disabled={!parsedResult.matched}
                                        className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md shadow-violet-200 disabled:opacity-60"
                                    >
                                        <Sparkles size={14} /> Iniciar Finiquito Automatizado
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal: Detalle */}
            {showDetail && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setShowDetail(null)}
                >
                    <div
                        className="bg-white rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-lg font-black uppercase text-slate-800">Ficha de finiquito — {showDetail.fullName}</h3>
                            <button onClick={() => setShowDetail(null)} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Stepper Workflow */}
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-center">
                            <div className="flex items-center justify-between w-full max-w-3xl">
                                {/* Step 1: Registro */}
                                <div className="flex items-center flex-1">
                                    <div className="flex flex-col items-center relative">
                                        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-emerald-100">
                                            ✓
                                        </div>
                                        <span className="text-[10px] font-black uppercase text-slate-600 mt-1">Registro</span>
                                        <span className="text-[8px] font-bold text-slate-400">Borrador</span>
                                    </div>
                                    <div className="flex-1 h-1 bg-emerald-500 mx-2 -mt-4"></div>
                                </div>

                                {/* Step 2: Firma / Procesamiento */}
                                <div className="flex items-center flex-1">
                                    <div className="flex flex-col items-center relative">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-md ${
                                            (showDetail.finiquitoDetalle?.notariaEstado === 'Firmado' || showDetail.finiquitoDetalle?.procesadoEn === 'Modulo')
                                                ? 'bg-emerald-500 text-white shadow-emerald-100'
                                                : 'bg-violet-500 text-white shadow-violet-100 animate-pulse'
                                        }`}>
                                            {(showDetail.finiquitoDetalle?.notariaEstado === 'Firmado' || showDetail.finiquitoDetalle?.procesadoEn === 'Modulo') ? '✓' : '2'}
                                        </div>
                                        <span className="text-[10px] font-black uppercase text-slate-600 mt-1">Firma</span>
                                        <span className="text-[8px] font-bold text-slate-400">
                                            {showDetail.finiquitoDetalle?.procesadoEn === 'Modulo' ? 'Módulo Interno' : 'Firma Pendiente'}
                                        </span>
                                    </div>
                                    <div className={`flex-1 h-1 mx-2 -mt-4 ${
                                        (showDetail.finiquitoDetalle?.notariaEstado === 'Firmado' || showDetail.finiquitoDetalle?.procesadoEn === 'Modulo')
                                            ? 'bg-emerald-500'
                                            : showDetail.finiquitoDetalle?.procesadoEn === 'Notaria'
                                            ? 'bg-violet-300'
                                            : 'bg-slate-200'
                                    }`}></div>
                                </div>

                                {/* Step 3: En Notaría */}
                                <div className={`flex items-center flex-1 ${showDetail.finiquitoDetalle?.procesadoEn === 'Modulo' ? 'opacity-40' : ''}`}>
                                    <div className="flex flex-col items-center relative">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-md ${
                                            showDetail.finiquitoDetalle?.procesadoEn === 'Modulo'
                                                ? 'bg-slate-200 text-slate-400'
                                                : showDetail.finiquitoDetalle?.notariaEstado === 'Firmado'
                                                ? 'bg-emerald-500 text-white shadow-emerald-100'
                                                : showDetail.finiquitoDetalle?.notariaEstado === 'En Notaria'
                                                ? 'bg-violet-500 text-white shadow-violet-100 animate-pulse'
                                                : 'bg-slate-200 text-slate-500'
                                        }`}>
                                            {showDetail.finiquitoDetalle?.procesadoEn === 'Modulo' ? 'N/A' : (showDetail.finiquitoDetalle?.notariaEstado === 'Firmado' ? '✓' : '3')}
                                        </div>
                                        <span className="text-[10px] font-black uppercase text-slate-600 mt-1">Notaría</span>
                                        <span className="text-[8px] font-bold text-slate-400">
                                            {showDetail.finiquitoDetalle?.procesadoEn === 'Modulo' ? 'No aplica' : (showDetail.finiquitoDetalle?.notariaEstado || 'Pendiente')}
                                        </span>
                                    </div>
                                    <div className={`flex-1 h-1 mx-2 -mt-4 ${
                                        showDetail.finiquitoDetalle?.procesadoEn === 'Modulo'
                                            ? 'bg-slate-200'
                                            : showDetail.finiquitoDetalle?.notariaEstado === 'Firmado'
                                            ? 'bg-emerald-500'
                                            : 'bg-slate-250'
                                    }`}></div>
                                </div>

                                {/* Step 4: Legalizado / Terminado */}
                                <div className="flex items-center">
                                    <div className="flex flex-col items-center relative">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-md ${
                                            (showDetail.finiquitoDetalle?.notariaEstado === 'Firmado' || showDetail.finiquitoDetalle?.procesadoEn === 'Modulo')
                                                ? 'bg-emerald-500 text-white shadow-emerald-100'
                                                : 'bg-slate-200 text-slate-500'
                                        }`}>
                                            {(showDetail.finiquitoDetalle?.notariaEstado === 'Firmado' || showDetail.finiquitoDetalle?.procesadoEn === 'Modulo') ? '✓' : '4'}
                                        </div>
                                        <span className="text-[10px] font-black uppercase text-slate-600 mt-1">Legalizado</span>
                                        <span className="text-[8px] font-bold text-slate-400">Terminado</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                            {showDetail.finiquitoDetalle?.warnings && showDetail.finiquitoDetalle.warnings.length > 0 && (
                                <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col gap-1.5 text-xs text-amber-800">
                                    <div className="flex items-center gap-1.5 font-black uppercase text-amber-700 tracking-wider">
                                        <AlertCircle size={14} className="text-amber-500" /> Advertencias de Cumplimiento Legal (DT Chile)
                                    </div>
                                    <ul className="list-disc pl-4 space-y-1 font-medium">
                                        {showDetail.finiquitoDetalle.warnings.map((w, idx) => (
                                            <li key={idx}>{w}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <div className="space-y-3">
                                <p className="text-xs font-black uppercase text-slate-400 font-bold tracking-wider">Datos Laborales</p>
                                <div className="space-y-1 text-sm bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <p><span className="font-bold text-slate-500">Cargo:</span> <span className="font-black text-slate-700">{showDetail.position || 'N/A'}</span></p>
                                    <p><span className="font-bold text-slate-500">Contrato:</span> <span className="font-black text-slate-700 uppercase">{showDetail.contractType || 'No definido'}</span></p>
                                    <p><span className="font-bold text-slate-500">Ingreso:</span> <span className="font-black text-slate-700">{showDetail.contractStartDate ? formatDateUTC(showDetail.contractStartDate) : 'N/A'}</span></p>
                                    <p><span className="font-bold text-slate-500">Finiquito:</span> <span className="font-black text-slate-700">{showDetail.fechaFiniquito ? formatDateUTC(showDetail.fechaFiniquito) : 'N/A'}</span></p>
                                    <p><span className="font-bold text-slate-500">Motivo:</span> <span className="font-black text-slate-700">{showDetail.finiquitoMotivo || 'N/A'}</span></p>
                                    <p><span className="font-bold text-slate-500">Proyecto:</span> <span className="font-black text-slate-700">{showDetail.projectName || showDetail.projectId?.nombreProyecto || 'N/A'}</span></p>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-black uppercase text-slate-400 mb-2 font-bold tracking-wider">Documentos asociados</p>
                                <div className="space-y-2">
                                    {(showDetail.documents || [])
                                        .filter(d => d.docType?.toLowerCase().includes('finiquito') || d.docType?.toLowerCase().includes('legal'))
                                        .map((doc, i) => (
                                            <div key={i} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                                                <span className="text-xs font-bold uppercase text-slate-600">{doc.docType}</span>
                                                <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs font-black text-blue-600 hover:underline">Ver</a>
                                            </div>
                                        ))}
                                    {(!showDetail.documents || showDetail.documents.filter(d => d.docType?.toLowerCase().includes('finiquito') || d.docType?.toLowerCase().includes('legal')).length === 0) && (
                                        <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center font-bold">No hay documentos cargados.</p>
                                    )}
                                </div>
                            </div>

                            {showDetail.finiquitoDetalle ? (
                                <div className="md:col-span-2 border-t border-slate-100 pt-4 mt-2">
                                    <p className="text-xs font-black uppercase text-slate-400 mb-3 font-bold tracking-wider">Liquidación Detallada del Finiquito</p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/50">
                                        <div>
                                            <p className="text-xs text-slate-500 font-bold border-b border-slate-200 pb-1 uppercase tracking-wider">Haberes e Indemnizaciones</p>
                                            <div className="text-xs space-y-1.5 mt-2 font-medium text-slate-600">
                                                <p className="flex justify-between"><span>Años de Servicio ({showDetail.finiquitoDetalle.aniosServicioCalculados || 0} años):</span> <span className="font-bold text-slate-800">${(showDetail.finiquitoDetalle.montoIndemnizacionAnos || 0).toLocaleString('es-CL')}</span></p>
                                                <p className="flex justify-between"><span>Falta de Aviso Previo:</span> <span className="font-bold text-slate-800">${(showDetail.finiquitoDetalle.montoIndemnizacionAviso || 0).toLocaleString('es-CL')}</span></p>
                                                <p className="flex justify-between"><span>Feriado Proporcional ({showDetail.finiquitoDetalle.diasVacacionesCorridosCalculados || 0} días):</span> <span className="font-bold text-slate-800">${(showDetail.finiquitoDetalle.montoFeriadoProporcional || 0).toLocaleString('es-CL')}</span></p>
                                                {showDetail.finiquitoDetalle.pagarDiasProporcionales && (showDetail.finiquitoDetalle.diasTrabajadosMes > 0) && (
                                                    <>
                                                        <p className="flex justify-between"><span>Sueldo Proporcional ({showDetail.finiquitoDetalle.diasTrabajadosMes}d):</span> <span className="font-bold text-slate-800">${(showDetail.finiquitoDetalle.montoSueldoProporcional || 0).toLocaleString('es-CL')}</span></p>
                                                        {(showDetail.finiquitoDetalle.montoGratificacionProporcional || 0) > 0 && (
                                                            <p className="flex justify-between"><span>Gratif. Proporcional ({showDetail.finiquitoDetalle.diasTrabajadosMes}d):</span> <span className="font-bold text-slate-800">${(showDetail.finiquitoDetalle.montoGratificacionProporcional || 0).toLocaleString('es-CL')}</span></p>
                                                        )}
                                                        {((showDetail.finiquitoDetalle.montoColacionProporcional || 0) + (showDetail.finiquitoDetalle.montoMovilizacionProporcional || 0)) > 0 && (
                                                            <p className="flex justify-between"><span>Asig. Proporcionales ({showDetail.finiquitoDetalle.diasTrabajadosMes}d):</span> <span className="font-bold text-slate-800">${((showDetail.finiquitoDetalle.montoColacionProporcional || 0) + (showDetail.finiquitoDetalle.montoMovilizacionProporcional || 0)).toLocaleString('es-CL')}</span></p>
                                                        )}
                                                    </>
                                                )}
                                                {(showDetail.finiquitoDetalle.indemnizacionVoluntaria || 0) > 0 && (
                                                    <p className="flex justify-between text-emerald-700"><span>Indemnización Voluntaria:</span> <span className="font-bold text-emerald-800">${(showDetail.finiquitoDetalle.indemnizacionVoluntaria).toLocaleString('es-CL')}</span></p>
                                                )}
                                                {(showDetail.finiquitoDetalle.aguinaldosOtros || 0) > 0 && (
                                                    <p className="flex justify-between text-emerald-700"><span>Aguinaldos/Bonos Pendientes:</span> <span className="font-bold text-emerald-800">${(showDetail.finiquitoDetalle.aguinaldosOtros).toLocaleString('es-CL')}</span></p>
                                                )}
                                                <p className="flex justify-between"><span>Otros Haberes:</span> <span className="font-bold text-slate-800">${(showDetail.finiquitoDetalle.otrosHaberes || 0).toLocaleString('es-CL')}</span></p>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-bold border-b border-slate-200 pb-1 uppercase tracking-wider">Descuentos</p>
                                            <div className="text-xs space-y-1.5 mt-2 font-medium text-slate-600">
                                                <p className="flex justify-between text-red-600"><span>Cotización AFC Empleador:</span> <span className="font-bold">-${(showDetail.finiquitoDetalle.descuentoAFC || 0).toLocaleString('es-CL')}</span></p>
                                                {showDetail.finiquitoDetalle.descuentoAnticipos > 0 && (
                                                    <p className="flex justify-between text-red-600"><span>Anticipos de Sueldo:</span> <span className="font-bold">-${(showDetail.finiquitoDetalle.descuentoAnticipos).toLocaleString('es-CL')}</span></p>
                                                )}
                                                {showDetail.finiquitoDetalle.descuentoPrestamoCaja > 0 && (
                                                    <p className="flex justify-between text-red-600"><span>Préstamo Caja Compensación:</span> <span className="font-bold">-${(showDetail.finiquitoDetalle.descuentoPrestamoCaja).toLocaleString('es-CL')}</span></p>
                                                )}
                                                {showDetail.finiquitoDetalle.descuentoPrestamoEmpresa > 0 && (
                                                    <p className="flex justify-between text-red-600"><span>Préstamo Interno Empresa:</span> <span className="font-bold">-${(showDetail.finiquitoDetalle.descuentoPrestamoEmpresa).toLocaleString('es-CL')}</span></p>
                                                )}
                                                {(showDetail.finiquitoDetalle.descuentoAfpProporcional || 0) > 0 && (
                                                    <p className="flex justify-between text-red-600"><span>Cotiz. AFP Proporcional:</span> <span className="font-bold">-${(showDetail.finiquitoDetalle.descuentoAfpProporcional).toLocaleString('es-CL')}</span></p>
                                                )}
                                                {(showDetail.finiquitoDetalle.descuentoSaludProporcional || 0) > 0 && (
                                                    <p className="flex justify-between text-red-600"><span>Cotiz. Salud Proporcional:</span> <span className="font-bold">-${(showDetail.finiquitoDetalle.descuentoSaludProporcional).toLocaleString('es-CL')}</span></p>
                                                )}
                                                {(showDetail.finiquitoDetalle.descuentoAfcProporcional || 0) > 0 && (
                                                    <p className="flex justify-between text-red-600"><span>Cotiz. AFC Proporcional:</span> <span className="font-bold">-${(showDetail.finiquitoDetalle.descuentoAfcProporcional).toLocaleString('es-CL')}</span></p>
                                                )}
                                                {(showDetail.finiquitoDetalle.descuentoSeguroColectivo || 0) > 0 && (
                                                    <p className="flex justify-between text-red-600"><span>Seguro Colectivo:</span> <span className="font-bold">-${(showDetail.finiquitoDetalle.descuentoSeguroColectivo).toLocaleString('es-CL')}</span></p>
                                                )}
                                                {(showDetail.finiquitoDetalle.descuentoEquiposNoDevueltos || 0) > 0 && (
                                                    <p className="flex justify-between text-red-600"><span>Equipos/Heras. No Devueltos:</span> <span className="font-bold">-${(showDetail.finiquitoDetalle.descuentoEquiposNoDevueltos).toLocaleString('es-CL')}</span></p>
                                                )}
                                                <p className="flex justify-between text-red-600"><span>Otros Descuentos:</span> <span className="font-bold">-${(showDetail.finiquitoDetalle.otrosDescuentos || 0).toLocaleString('es-CL')}</span></p>
                                            </div>
                                        </div>
                                        <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col justify-between border border-slate-850">
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Total Neto a Pagar</p>
                                                <p className="text-2xl font-black mt-1 text-emerald-400">${(showDetail.finiquitoDetalle.netoFiniquito || 0).toLocaleString('es-CL')}</p>
                                            </div>
                                            <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-2 border-t border-slate-800 pt-2 block truncate">
                                                Causal: {showDetail.finiquitoDetalle.causalTermino?.substring(0, 32)}...
                                            </div>
                                        </div>
                                        {showDetail.finiquitoDetalle.observacionesReservas && (
                                            <div className="md:col-span-3 text-xs border-t border-slate-200 pt-2 text-slate-600 font-medium">
                                                <span className="font-bold text-slate-700">Observaciones / Reservas:</span> {showDetail.finiquitoDetalle.observacionesReservas}
                                            </div>
                                        )}
                                        {showDetail.finiquitoDetalle.procesadoEn === 'Notaria' ? (
                                            <div className="md:col-span-3 text-xs border-t border-slate-200 pt-3 mt-1 grid grid-cols-2 md:grid-cols-4 gap-3 bg-violet-50/40 p-3 rounded-xl border border-violet-100/50">
                                                <div>
                                                    <span className="block text-slate-400 font-bold uppercase text-[9px]">Lugar de Procesamiento</span>
                                                    <span className="font-black text-violet-700">🏛️ Notario Público</span>
                                                </div>
                                                <div>
                                                    <span className="block text-slate-400 font-bold uppercase text-[9px]">Nombre Notaría</span>
                                                    <span className="font-black text-slate-700">{showDetail.finiquitoDetalle.notariaNombre || 'No especificada'}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-slate-400 font-bold uppercase text-[9px]">Fecha de Firma</span>
                                                    <span className="font-black text-slate-700">
                                                        {showDetail.finiquitoDetalle.notariaFechaFirma 
                                                            ? formatDateUTC(showDetail.finiquitoDetalle.notariaFechaFirma) 
                                                            : 'Pendiente'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-slate-400 font-bold uppercase text-[9px]">Gastos Notaría</span>
                                                    <span className="font-black text-slate-700">
                                                        ${(showDetail.finiquitoDetalle.notariaGastos || 0).toLocaleString('es-CL')} 
                                                        <span className="text-[9px] font-bold text-slate-400 ml-1">({showDetail.finiquitoDetalle.notariaPagadoPor})</span>
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="md:col-span-3 text-xs border-t border-slate-200 pt-3 mt-1 grid grid-cols-1 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                                                <div>
                                                    <span className="block text-slate-400 font-bold uppercase text-[9px]">Lugar de Procesamiento</span>
                                                    <span className="font-black text-slate-600">📁 Módulo Interno (GenAI)</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            {/* Acciones principales */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    onClick={() => {
                                        const target = showDetail;
                                        setShowDetail(null);
                                        handleAbrirEdicion(target);
                                    }}
                                    className="px-4 py-2.5 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-amber-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-amber-500/10"
                                >
                                    <Edit2 size={14} /> Editar Parámetros
                                </button>
                                <button
                                    onClick={() => generateFiniquitoPdf(showDetail)}
                                    className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-blue-600/10"
                                >
                                    <FileText size={14} /> Generar Acta PDF
                                </button>
                                <a
                                    href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(showDetail, null, 2))}`}
                                    download={`finiquito-${showDetail.rut || showDetail._id}.json`}
                                    className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
                                >
                                    <Download size={14} /> Exportar JSON
                                </a>
                            </div>

                            {/* Carga de Documento */}
                            <div className="flex items-center gap-2">
                                <label className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-2 cursor-pointer transition-all shadow-sm">
                                    <Upload size={14} className="text-slate-500" />
                                    {legalFile ? `Acta: ${legalFile.name.substring(0, 15)}${legalFile.name.length > 15 ? '...' : ''}` : 'Seleccionar Acta Firmada'}
                                    <input
                                        type="file"
                                        className="hidden"
                                        onChange={e => setLegalFile(e.target.files[0] || null)}
                                        accept=".pdf,image/*"
                                    />
                                </label>
                                {legalFile && (
                                    <button
                                        onClick={() => handleUpload(showDetail._id)}
                                        disabled={uploading}
                                        className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-emerald-600/10 animate-in fade-in slide-in-from-left-2 duration-300"
                                    >
                                        {uploading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                        {uploading ? 'Subiendo...' : 'Confirmar y Subir'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Procesar Renuncia (AI) */}
            {showRenunciaModal && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => { setShowRenunciaModal(false); setRenunciaFile(null); setParsedResult(null); }}
                >
                    <div
                        className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <Sparkles size={18} className="text-violet-600" />
                                <h3 className="text-lg font-black uppercase text-slate-800">
                                    Procesar Renuncia (AI)
                                </h3>
                            </div>
                            <button 
                                onClick={() => { setShowRenunciaModal(false); setRenunciaFile(null); setParsedResult(null); }} 
                                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {parsingRenuncia ? (
                                <div className="text-center py-12 text-slate-400 font-bold flex flex-col items-center justify-center space-y-4">
                                    <Loader2 size={48} className="animate-spin text-violet-600" />
                                    <h4 className="text-base text-slate-700 font-black animate-pulse">Analizando documento con OCR/AI...</h4>
                                    <p className="text-xs text-slate-400 max-w-sm">Buscando el RUT y el nombre del colaborador en el texto, y detectando la fecha de renuncia voluntaria.</p>
                                </div>
                            ) : parsedResult ? (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Resultado de Análisis</h4>
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                            parsedResult.matched ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                            {parsedResult.matched ? '✓ Empleado Identificado' : '⚠ Identificación Manual'}
                                        </span>
                                    </div>

                                    {parsedResult.matched ? (
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-xl bg-slate-900 text-white font-black flex items-center justify-center text-lg shadow-md uppercase">
                                                {parsedResult.matched.fullName.substring(0, 2)}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-sm font-black text-slate-800">{parsedResult.matched.fullName}</h4>
                                                <p className="text-xs text-slate-500 font-medium">RUT: <span className="font-bold text-slate-700">{parsedResult.matched.rut}</span> · Cargo: <span className="font-bold text-slate-700">{parsedResult.matched.position}</span></p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 space-y-3">
                                            <div className="flex gap-2 text-xs font-bold text-amber-700 items-start">
                                                <AlertCircle size={16} className="mt-0.5" />
                                                <div>
                                                    <p>Colaborador no identificado automáticamente.</p>
                                                    <p className="font-medium text-slate-600 mt-1">El documento no contiene un RUT coincidente con colaboradores activos. Por favor, selecciona a quién corresponde:</p>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Seleccionar Colaborador Activo</label>
                                                <select
                                                    onChange={e => {
                                                        const cand = contratados.find(c => c._id === e.target.value);
                                                        if (cand) {
                                                            setParsedResult(prev => ({ ...prev, matched: cand }));
                                                        }
                                                    }}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-300 font-bold bg-white"
                                                >
                                                    <option value="">Selecciona al colaborador...</option>
                                                    {contratados.map(c => (
                                                        <option key={c._id} value={c._id}>{c.fullName} ({c.rut}) · {c.position}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Fecha de Término Detectada</label>
                                            <input
                                                type="date"
                                                value={parsedResult.proposedDate}
                                                onChange={e => setParsedResult(prev => ({ ...prev, proposedDate: e.target.value }))}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-355"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Causal Producida</label>
                                            <input
                                                type="text"
                                                value={parsedResult.causalTermino}
                                                disabled
                                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-500 font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <label className="border-2 border-dashed border-slate-200 hover:border-violet-400 bg-slate-50/50 hover:bg-violet-50/10 rounded-3xl p-10 block cursor-pointer transition-all text-center">
                                        <Upload size={36} className="mx-auto text-slate-400 mb-3" />
                                        <span className="block text-sm font-black uppercase text-slate-600 tracking-wider">
                                            {renunciaFile ? renunciaFile.name : 'Seleccionar Documento de Renuncia'}
                                        </span>
                                        <span className="block text-xs text-slate-400 mt-1.5 font-bold">Arrastra el archivo aquí o haz clic para buscar</span>
                                        <span className="block text-[10px] text-slate-400 font-medium mt-1">Soporta PDF, PNG, JPG (máx. 5MB)</span>
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept=".pdf,image/*"
                                            onChange={e => setRenunciaFile(e.target.files[0] || null)}
                                        />
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                            <button
                                onClick={() => { setShowRenunciaModal(false); setRenunciaFile(null); setParsedResult(null); }}
                                className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-black uppercase hover:bg-slate-300 transition-colors"
                            >
                                Cancelar
                            </button>
                            {renunciaFile && !parsingRenuncia && !parsedResult && (
                                <button
                                    onClick={handleParseRenuncia}
                                    className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-violet-750 transition-colors shadow-md shadow-violet-200"
                                >
                                    <Sparkles size={14} /> Procesar con IA
                                </button>
                            )}
                            {parsedResult && (
                                <>
                                    <button
                                        onClick={() => { setRenunciaFile(null); setParsedResult(null); }}
                                        className="px-4 py-2 rounded-xl bg-slate-300 text-slate-700 text-xs font-black uppercase hover:bg-slate-350 transition-colors"
                                    >
                                        Subir Otro
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (!parsedResult.matched) return alert('Por favor, selecciona un colaborador.');
                                            
                                            // Iniciar finiquito
                                            handleSelectCandidato(parsedResult.matched);
                                            setFiniquitoData(d => ({
                                                ...d,
                                                fechaEgreso: parsedResult.proposedDate,
                                                causalTermino: parsedResult.causalTermino
                                            }));
                                            
                                            // Limpiar estados de renuncia
                                            setRenunciaFile(null);
                                            setParsedResult(null);
                                            setShowRenunciaModal(false);
                                            
                                            // Abrir finiquito modal
                                            setShowFiniquitoModal(true);
                                        }}
                                        disabled={!parsedResult.matched}
                                        className="px-5 py-2.5 bg-violet-600 hover:bg-violet-755 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md shadow-violet-200 disabled:opacity-60"
                                    >
                                        <Sparkles size={14} /> Iniciar Finiquito
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
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

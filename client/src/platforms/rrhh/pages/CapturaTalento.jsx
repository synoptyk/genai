import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useCheckPermission } from '../../../hooks/useCheckPermission';
import {
    UserPlus, Search, Loader2, Users, ChevronDown, X, Check, CheckCircle,
    Clock, Edit3, Eye, GraduationCap, Briefcase, ChevronLeft,
    AlertCircle, Plus, Globe, Mail, Phone, MapPin, Building,
    Heart, Landmark, CreditCard, DollarSign, Award, Truck, ShieldCheck, Activity, Shirt,
    User, Calendar, FileText, Download, Upload, Printer, Hash, Star,
    HelpCircle, Info, ChevronRight, UserCheck, MessageCircle, Camera,
    FolderKanban, BarChart3, UserX, Waypoints, Layers, LayoutGrid, LayoutList, LogOut, Target
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { candidatosApi, proyectosApi, configApi, empresasApi, toaApi, bonosConfigApi, rrhhApi, adminApi } from '../rrhhApi';
import FichaManualPrint from './FichaManualPrint';
import { formatRut, validateRut } from '../../../utils/rutUtils';
import SearchableSelect from '../../../components/SearchableSelect';
import FichaIngresoPremium from '../../../components/FichaIngresoPremium';

const STATUS_COLORS = {
    'En Postulación': 'bg-indigo-50 text-indigo-600 border-indigo-200',
    'Postulando': 'bg-indigo-50 text-indigo-600 border-indigo-200',
    'En Entrevista': 'bg-violet-50 text-violet-600 border-violet-200',
    'En Evaluación': 'bg-sky-50 text-sky-600 border-sky-200',
    'En Acreditación': 'bg-orange-50 text-orange-600 border-orange-200',
    'En Documentación': 'bg-amber-50 text-amber-600 border-amber-200',
    'Aprobado': 'bg-teal-50 text-teal-600 border-teal-200',
    'Aprobado/No Operativo': 'bg-cyan-50 text-cyan-600 border-cyan-200',
    'Contratado': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Rechazado': 'bg-rose-50 text-rose-600 border-rose-200',
    'Retirado': 'bg-slate-50 text-slate-500 border-slate-200',
    'Finiquitado': 'bg-slate-100 text-slate-500 border-slate-300',
    'Inactivo': 'bg-amber-50 text-amber-600 border-amber-200',
    'Suspendido': 'bg-amber-50 text-amber-600 border-amber-200',
    'Bloqueado': 'bg-rose-50 text-rose-600 border-rose-200',
    'Ausente': 'bg-orange-50 text-orange-600 border-orange-200',
    'Licencia Médica': 'bg-yellow-50 text-yellow-600 border-yellow-200',
};

const STATUSES = ['POST', 'ENTR', 'APROB', 'ACRED', 'CONT', 'ACTIVO', 'INACTIVO', 'DE BAJA'];

// LISTAS DE MERCADO CHILENO
const AFPS = ['CAPITAL', 'CUPRUM', 'HABITAT', 'MODELO', 'PLANVITAL', 'PROVIDA', 'UNO'];
const ISAPRES = ['BANMÉDICA', 'COLMENA', 'CONSALUD', 'CRUZBLANCA', 'NUEVA MASVIDA', 'VIDA TRES', 'ESENCIAL'];
const BANCOS = [
    'BANCO DE CHILE', 'BANCO SANTANDER', 'BANCO BCI', 'BANCO ESTADO', 
    'BANCO SCOTIABANK', 'BANCO ITAÚ', 'BANCO BICE', 'BANCO SECURITY', 
    'BANCO FALABELLA', 'BANCO RIPLEY', 'BANCO CONSORCIO'
];
const REGIONES_CHILE = [
    { name: 'ARICA Y PARINACOTA', comunas: ['ARICA', 'CAMARONES', 'PUTRE', 'GENERAL LAGOS'] },
    { name: 'TARAPACÁ', comunas: ['IQUIQUE', 'ALTO HOSPICIO', 'POZO ALMONTE', 'CAMIÑA', 'COLCHANE', 'HUARA', 'PICA'] },
    { name: 'ANTOFAGASTA', comunas: ['ANTOFAGASTA', 'MEJILLONES', 'SIERRA GORDA', 'TALTAL', 'CALAMA', 'OLLAGÜE', 'SAN PEDRO DE ATACAMA', 'TOCOPILLA', 'MARÍA ELENA'] },
    { name: 'ATACAMA', comunas: ['COPIAPÓ', 'CALDERA', 'TIERRA AMARILLA', 'CHAÑARAL', 'DIEGO DE ALMAGRO', 'VALLENAR', 'ALTO DEL CARMEN', 'FREIRINA', 'HUASCO'] },
    { name: 'COQUIMBO', comunas: ['LA SERENA', 'COQUIMBO', 'ANDACOLLO', 'LA HIGUERA', 'PAIGUANO', 'VICUÑA', 'ILLAPEL', 'CANELA', 'LOS VILOS', 'SALAMANCA', 'OVALLE', 'COMBARBALÁ', 'MONTE PATRIA', 'PUNITAQUI', 'RÍO HURTADO'] },
    { name: 'VALPARAÍSO', comunas: ['VALPARAÍSO', 'CASABLANCA', 'CONCÓN', 'JUAN FERNÁNDEZ', 'PUCHUNCAVÍ', 'QUINTERO', 'VIÑA DEL MAR', 'ISLA DE PASCUA', 'LOS ANDES', 'CALLE LARGA', 'RINCONADA', 'SAN ESTEBAN', 'LA LIGUA', 'CABILDO', 'PAPUDO', 'PETORCA', 'ZAPALLAR', 'QUILLOTA', 'CALERA', 'HIJUELAS', 'LA CRUZ', 'NOGALES', 'SAN ANTONIO', 'ALGARROBO', 'CARTAGENA', 'EL QUISCO', 'EL TABO', 'SANTO DOMINGO', 'SAN FELIPE', 'CATEMU', 'LLAILLAY', 'PANQUEHUE', 'PUTAENDO', 'SANTA MARÍA', 'QUILPUÉ', 'LIMACHE', 'OLMUÉ', 'VILLA ALEMANA'] },
    { name: 'METROPOLITANA DE SANTIAGO', comunas: ['CERRILLOS', 'CERRO NAVIA', 'CONCHALÍ', 'EL BOSQUE', 'ESTACIÓN CENTRAL', 'HUECHURABA', 'INDEPENDENCIA', 'LA CISTERNA', 'LA FLORIDA', 'LA GRANJA', 'LA PINTANA', 'LA REINA', 'LAS CONDES', 'LO BARNECHEA', 'LO ESPEJO', 'LO PRADO', 'MACUL', 'MAIPÚ', 'ÑUÑOA', 'PEDRO AGUIRRE CERDA', 'PEÑALOLÉN', 'PROVIDENCIA', 'PUDAHUEL', 'QUILICURA', 'QUINTA NORMAL', 'RECOLETA', 'RENCA', 'SAN JOAQUÍN', 'SAN MIGUEL', 'SAN RAMÓN', 'SANTIAGO', 'VITACURA', 'PUENTE ALTO', 'PIRQUE', 'SAN JOSÉ DE MAIPO', 'COLINA', 'LAMPA', 'TILTIL', 'SAN BERNARDO', 'BUIN', 'CALERA DE TANGO', 'PAINE', 'MELIPILLA', 'CURACAVÍ', 'MARÍA PINTO', 'SAN PEDRO', 'ALHUÉ', 'TALAGANTE', 'EL MONTE', 'ISLA DE MAIPO', 'PADRE HURTADO', 'PEÑAFLOR'] },
    { name: 'LIBERTADOR GRAL. BERNARDO O\'HIGGINS', comunas: ['RANCAGUA', 'CODEGUA', 'COINCO', 'COLTAUCO', 'DOÑIHUE', 'GRANEROS', 'LAS CABRAS', 'MACHALÍ', 'MALLOA', 'MOSTAZAL', 'OLIVAR', 'PEUMO', 'PICHIDEGUA', 'QUINTA DE TILCOCO', 'RENGO', 'REQUÍNOA', 'SAN VICENTE', 'PICHILEMU', 'LA ESTRELLA', 'LITUECHE', 'MARCHIHUE', 'NAVIDAD', 'PAREDONES', 'SAN FERNANDO', 'CHÉPICA', 'CHIMBARONGO', 'LOLOL', 'NANCAGUA', 'PALMILLA', 'PERALILLO', 'PLACILLA', 'PUMANQUE', 'SANTA CRUZ'] },
    { name: 'MAULE', comunas: ['TALCA', 'CONSTITUCIÓN', 'CUREPTO', 'EMPEDRADO', 'MAULE', 'PELARCO', 'PENCAHUE', 'RÍO CLARO', 'SAN CLEMENTE', 'SAN RAFAEL', 'CAUQUENES', 'CHANCO', 'PELLUHUE', 'CURICÓ', 'HUALAÑÉ', 'LICANTÉN', 'MOLINA', 'RAUCO', 'ROMERAL', 'SAGRADA FAMILIA', 'TENO', 'VICHUQUÉN', 'LINARES', 'COLBÚN', 'LONGAVÍ', 'PARRAL', 'RETIRO', 'SAN JAVIER', 'VILLA ALEGRE', 'YERBAS BUENAS'] },
    { name: 'ÑUBLE', comunas: ['CHILLÁN', 'CHILLÁN VIEJO', 'COIHUECO', 'PINTO', 'QUILLECO', 'SAN IGNACIO', 'YUNGAY', 'QUIRIHUE', 'COBQUECURA', 'COELEMU', 'NINHUE', 'PORTEZUELO', 'RANQUIL', 'TREGUACO', 'BULNES', 'EL CARMEN', 'PEMUCO', 'SAN NICOLÁS'] },
    { name: 'BIOBÍO', comunas: ['CONCEPCIÓN', 'CORONEL', 'CHIGUAYANTE', 'FLORIDA', 'HUALQUI', 'LOTA', 'PENCO', 'SAN PEDRO DE LA PAZ', 'SANTA JUANA', 'TALCAHUANO', 'TOMÉ', 'HUALPÉN', 'LEBU', 'ARAUCO', 'CAÑETE', 'CONTULMO', 'CURANILAHUE', 'LOS ÁLAMOS', 'TIRÚA', 'LOS ÁNGELES', 'ANTUCO', 'CABRERO', 'LAJA', 'MULCHÉN', 'NACIMIENTO', 'NEGRETE', 'QUILACO', 'QUILLECO', 'SAN ROSENDO', 'SANTA BÁRBARA', 'TUCAPEL', 'YUMBEL', 'ALTO BIOBÍO'] },
    { name: 'LA ARAUCANÍA', comunas: ['TEMUCO', 'CARAHUE', 'CUNCO', 'CURARREHUE', 'FREIRE', 'GALVARINO', 'GORBEA', 'LAUTARO', 'LONCOCHE', 'MELIPEUCO', 'NUEVA IMPERIAL', 'PADRE LAS CASAS', 'PERQUENCO', 'PITRUFQUÉN', 'PUCÓN', 'SAAVEDRA', 'TEODORO SCHMIDT', 'TOLTÉN', 'VILCÚN', 'VILLARRICA', 'CHOLCHOL', 'ANGOL', 'CURACAUTÍN', 'ERCILLA', 'LONQUIMAY', 'LOS SAUCES', 'LUMACO', 'PURÉN', 'RENAICO', 'TRAIGUÉN', 'VICTORIA'] },
    { name: 'LOS RÍOS', comunas: ['VALDIVIA', 'CORRAL', 'LANCO', 'LOS LAGOS', 'MÁFIL', 'MARIQUINA', 'PAILLACO', 'PANGUIPULLI', 'LA UNIÓN', 'FUTRONO', 'LAGO RANCO', 'RÍO BUENO'] },
    { name: 'LOS LAGOS', comunas: ['PUERTO MONTT', 'CALBUCO', 'COCHAMÓ', 'FRESIA', 'FRUTILLAR', 'LOS MUERMOS', 'LLANQUIHUE', 'MAULLÍN', 'PUERTO VARAS', 'CASTRO', 'ANCUD', 'CHONCHI', 'CURACO DE VÉLEZ', 'DALCAHUE', 'PUQUELDÓN', 'QUEILÉN', 'QUELLÓN', 'QUEMCHI', 'QUINCHAO', 'OSORNO', 'PUERTO OCTAY', 'PURRANQUE', 'PUYEHUE', 'RÍO NEGRO', 'SAN JUAN DE LA COSTA', 'SAN PABLO', 'CHAITÉN', 'FUTALEUFÚ', 'HUALAIHUÉ', 'PALENA'] },
    { name: 'AYSÉN DEL GRAL. CARLOS IBÁÑEZ DEL CAMPO', comunas: ['COIHAIQUE', 'LAGO VERDE', 'AISÉN', 'CISNES', 'GUAITECAS', 'COCHRANE', 'O\'HIGGINS', 'TORTEL', 'CHILE CHICO', 'RÍO IBÁÑEZ'] },
    { name: 'MAGALLANES Y DE LA ANTÁRTICA CHILENA', comunas: ['PUNTA ARENAS', 'LAGUNA BLANCA', 'RÍO VERDE', 'SAN GREGORIO', 'CABO DE HORNOS', 'ANTÁRTICA', 'PORVENIR', 'PRIMAVERA', 'TIMAUKEL', 'NATALES', 'TORRES DEL PAINE'] }
];

const TABS = [
    { id: 'institucional', label: 'Institucional', icon: Building, color: 'indigo' },
    { id: 'personal', label: 'Personal', icon: User, color: 'violet' },
    { id: 'residencia', label: 'Residencia', icon: MapPin, color: 'sky' },
    { id: 'financiero', label: 'Financiero', icon: Landmark, color: 'emerald' },
    { id: 'dotacion', label: 'Dotación', icon: Truck, color: 'orange' },
    { id: 'expediente', label: 'Expediente Digital', icon: FileText, color: 'cyan' },
    { id: 'seguimiento', label: 'Hitos & Salida', icon: UserX, color: 'rose' }
];

const initialForm = {
    // Institucional
    projectId: '', projectName: '', position: '', ceco: '', area: '', departamento: '', sede: '', 
    idRecursoToa: '', status: 'En Postulación', fuenteCaptacion: 'Captación Directa',
    operationalStartDate: '', 
    clienteId: '', clienteNombre: '',
    contractStartDate: '',
    contractDurationDays: 30,
    nextAddendumDate: '',
    nextAddendumDescription: '',
    contractType: 'PLAZO FIJO',
    contractStep: '1ER CONTRATO',

    // Personal
    fullName: '', rut: '', email: '', phone: '', fechaNacimiento: '', nacionalidad: 'Chilena', gender: 'No Informado',
    estadoCivil: '', birthPlace: '', idExpiryDate: '',
    
    // Contacto & Domicilio
    address: '', calle: '', numero: '', deptoBlock: '', comuna: '', region: '',
    emergencyContact: '', emergencyPhone: '', emergencyEmail: '',
    
    // Laboral / Operativo
    sueldoBase: 0, 
    cantidadBonosExtraPermanentes: 0,
    requiresLicence: 'NO',
    licenceExpiryDate: '',
    educationLevel: '',
    situacionLaboralEntrevista: '',
    declaraConflictoInteres: 'NO',
    
    // Previsión & Salud
    previsionSalud: 'FONASA', isapreNombre: '', valorPlan: '', monedaPlan: 'UF',
    afp: '', pensionado: 'NO', bloodType: '', allergies: '', chronicDiseases: '',
    tieneCargas: 'NO', cantidadCargasLimitadas: 0,
    tieneDiscapacidad: 'NO', tipoDiscapacidad: '',
    
    // Financiero
    banco: '', tipoCuenta: '', numeroCuenta: '',
    
    // Dotación (Tallas)
    shirtSize: '', pantsSize: '', shoeSize: '', jacketSize: '',
    uniformSize: '', tallaGuantes: '',
    
    // Fechas Operativas y Salida
    operationalStartDate: '',
    fechaFiniquito: '',
    motivoFiniquito: '',
    
    // Multimedia
    profilePic: '', cvUrl: '',
    bonuses: [], bonosConfig: []
};

const CapturaTalento = () => {
    const { user: currentUser } = useAuth();
    const { hasPermission } = useCheckPermission();
    const [candidatos, setCandidatos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterProject, setFilterProject] = useState('ALL');
    const [filterCargo, setFilterCargo] = useState('ALL');
    const [filterClient, setFilterClient] = useState('ALL');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(initialForm);
    const [editId, setEditId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [bulkStatus, setBulkStatus] = useState('');
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);
    const [toast, setToast] = useState(null);
    const [actionMenu, setActionMenu] = useState(null); // { x, y, statusId, clientTitle, type }
    const [showCoverageModal, setShowCoverageModal] = useState(false);
    const [coverageData, setCoverageData] = useState(null);
    const [coverageMode, setCoverageMode] = useState('cargo'); // 'cargo' or 'project'
    const [selectedCandidato, setSelectedCandidato] = useState(null);
    const [activeTab, setActiveTab] = useState('institucional');
    const [viewMode, setViewMode] = useState('list');
    const [proyectos, setProyectos] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [columnFilters, setColumnFilters] = useState({});
    const [showColumnSelector, setShowColumnSelector] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState(() => {
        const saved = localStorage.getItem('rrhh_visible_columns');
        return saved ? JSON.parse(saved) : ['perfil', 'identificacion', 'asignacion', 'ubicacion', 'estado', 'acciones'];
    });

    useEffect(() => {
        localStorage.setItem('rrhh_visible_columns', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    useEffect(() => {
        if (form.contractStartDate) {
            const start = new Date(form.contractStartDate);
            if (!isNaN(start.getTime())) {
                const next = new Date(start);
                if (form.contractType === 'INDEFINIDO') {
                    next.setFullYear(next.getFullYear() + 1); // Revisión anual
                } else if (form.contractDurationDays) {
                    next.setDate(next.getDate() + parseInt(form.contractDurationDays));
                }
                const nextStr = next.toISOString().split('T')[0];
                if (form.nextAddendumDate !== nextStr) {
                    setForm(prev => ({ ...prev, nextAddendumDate: nextStr }));
                }
            }
        }
    }, [form.contractStartDate, form.contractDurationDays, form.contractType]);

    const ALL_COLUMNS = [
        { id: 'perfil', label: 'Talento / Perfil' },
        { id: 'identificacion', label: 'RUT / ID TOA' },
        { id: 'cliente', label: 'Cliente Vinculado' },
        { id: 'asignacion', label: 'Proyecto / Cargo' },
        { id: 'ubicacion', label: 'Sede / Comuna' },
        { id: 'contractual', label: 'Contrato / Duración' },
        { id: 'gestion', label: 'Hito / F. Operativa' },
        { id: 'institucional', label: 'AFP / Previsión' },
        { id: 'financiero', label: 'Banco / Cuenta' },
        { id: 'tallas', label: 'Tallas / Dotación' },
        { id: 'contacto', label: 'Contacto' },
        { id: 'estado', label: 'Estado Contratación' },
        { id: 'acciones', label: 'Acciones' }
    ];

    useEffect(() => { 
        fetchCandidatos(); 
        fetchProyectos();
        fetchClientes();
    }, []);

    useEffect(() => {
        if (form.contractStartDate && form.contractDurationDays) {
            const start = new Date(form.contractStartDate);
            if (!isNaN(start.getTime())) {
                const next = new Date(start);
                next.setDate(next.getDate() + parseInt(form.contractDurationDays || 0));
                const formatted = next.toISOString().split('T')[0];
                if (form.nextAddendumDate !== formatted) {
                    setForm(prev => ({ ...prev, nextAddendumDate: formatted }));
                }
            }
        }
    }, [form.contractStartDate, form.contractDurationDays]);

    const fetchCandidatos = async () => {
        try {
            setLoading(true);
            const res = await candidatosApi.getAll();
            setCandidatos((res.data || []).map(c => ({
                ...c,
                fullName: (c.fullName || '').trim().toUpperCase()
            })));
        } catch (err) { console.error("Error fetching candidatos:", err); }
        finally { setLoading(false); }
    };

    const fetchProyectos = async () => {
        try {
            const res = await proyectosApi.getAll();
            setProyectos(res.data || []);
        } catch (err) { console.error("Error fetching proyectos:", err); }
    };

    const fetchClientes = async () => {
        try {
            const res = await adminApi.getClientes();
            setClientes(res.data || []);
        } catch (err) { console.error("Error fetching clientes:", err); }
    };

    const handleSyncBase = async () => {
        try {
            setLoading(true);
            const res = await rrhhApi.syncBase();
            alert(`Sincronización completada: ${res.data?.stats?.sinronizados || 0} candidatos.`);
            fetchCandidatos();
        } catch (err) { alert("Error al sincronizar"); }
        finally { setLoading(false); }
    };

    const handleProyectoChange = (projId) => {
        const proj = proyectos.find(p => p._id === projId);
        if (proj) {
            setForm(prev => ({
                ...prev,
                projectId: projId,
                projectName: proj.nombreProyecto,
                ceco: proj.centroCosto || '',
                area: proj.area || ''
            }));
        }
    };

    const handleEdit = (c) => {
        const mappedData = { 
            ...initialForm, 
            ...c,
            projectId: c.projectId?._id || c.projectId || '',
            empresaRef: c.empresaRef?._id || c.empresaRef || '',
            clienteId: c.clienteId?._id || c.clienteId || '',
            clienteNombre: c.clienteNombre || (clientes.find(cl => cl._id === (c.clienteId?._id || c.clienteId))?.nombre) || '',
            fechaNacimiento: c.fechaNacimiento ? c.fechaNacimiento.split('T')[0] : '',
            contractStartDate: (c.contractStartDate || c.fechaInicioContrato) ? (c.contractStartDate || c.fechaInicioContrato).split('T')[0] : '',
            contractEndDate: c.contractEndDate ? c.contractEndDate.split('T')[0] : '',
            operationalStartDate: (c.operationalStartDate || c.fechaOperativa || c.fechaEfectivaInicio) ? (c.operationalStartDate || c.fechaOperativa || c.fechaEfectivaInicio).split('T')[0] : '',
            idExpiryDate: c.idExpiryDate ? c.idExpiryDate.split('T')[0] : '',
            licenceExpiryDate: c.licenceExpiryDate ? c.licenceExpiryDate.split('T')[0] : '',
            nextAddendumDate: (c.nextAddendumDate || c.fechaProximoHito) ? (c.nextAddendumDate || c.fechaProximoHito).split('T')[0] : '',
            fechaFiniquito: c.fechaFiniquito ? c.fechaFiniquito.split('T')[0] : '',
        };
        setForm(mappedData);
        setEditId(c._id);
        setShowForm(true);
    };

    const handleSubmit = async () => {
        try {
            setSaving(true);
            const dataToSend = { ...form, fullName: form.fullName.toUpperCase(), status: getOriginalStatus(form.status) };
            if (editId) await candidatosApi.update(editId, dataToSend);
            else await candidatosApi.create(dataToSend);
            setShowForm(false);
            setForm(initialForm);
            setEditId(null);
            fetchCandidatos();
        } catch (err) { alert("Error al guardar"); }
        finally { setSaving(false); }
    };

    const getOriginalStatus = (abb) => {
        if (abb === 'POST') return 'En Postulación';
        if (abb === 'ENTR') return 'En Entrevista';
        if (abb === 'APROB') return 'Aprobado';
        if (abb === 'ACRED') return 'En Acreditación';
        if (abb === 'CONT') return 'Contratado';
        if (abb === 'ACTIVO') return 'En Terreno';
        if (abb === 'INACTIVO') return 'Inactivo';
        if (abb === 'DE BAJA') return 'Finiquitado';
        return abb;
    };

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const handleBulkStatusUpdate = async () => {
        if (!bulkStatus || selectedIds.length === 0) return;
        const newStatusFull = getOriginalStatus(bulkStatus);
        try {
            setIsBulkUpdating(true);
            // Optimistic update — reflect in UI immediately
            setCandidatos(prev => prev.map(c =>
                selectedIds.includes(c._id) ? { ...c, status: newStatusFull } : c
            ));
            const promises = selectedIds.map(id =>
                candidatosApi.updateStatus(id, { status: newStatusFull })
            );
            await Promise.all(promises);
            showToast(`✅ ${selectedIds.length} candidatos actualizados a ${bulkStatus}`);
            setSelectedIds([]);
            setBulkStatus('');
            fetchCandidatos(); // background sync for accuracy
        } catch (err) {
            console.error("Bulk update error:", err);
            showToast('❌ Error al actualizar masivamente', 'error');
            fetchCandidatos(); // rollback via re-fetch
        } finally {
            setIsBulkUpdating(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredCandidatos.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredCandidatos.map(c => c._id));
        }
    };

    const stats = useMemo(() => {
        const counts = {};
        STATUSES.forEach(s => counts[s] = 0);
        const cargoPipeline = {};
        const projectPipeline = {};
        const clientPipeline = {};

        const getAbbreviatedStatus = (status) => {
            if (['En Postulación', 'Postulando'].includes(status)) return 'POST';
            if (['En Entrevista'].includes(status)) return 'ENTR';
            if (['Aprobado', 'En Evaluación', 'Aprobado/No Operativo'].includes(status)) return 'APROB';
            if (['En Acreditación', 'Acreditación', 'En Documentación'].includes(status)) return 'ACRED';
            if (['Contratado'].includes(status)) return 'CONT';
            if (['En Terreno', 'Listo Terreno', 'EN TERR'].includes(status)) return 'ACTIVO';
            if (['Suspendido', 'Bloqueado', 'Ausente', 'Licencia Médica', 'Inactivo', 'Suspendidos', 'bloqueados', 'Ausentes', 'Licencia medica'].includes(status)) return 'INACTIVO';
            if (['Rechazado', 'Retirado', 'Finiquitado', 'Bajas/Inactivos', 'De Baja'].includes(status)) return 'DE BAJA';
            return status;
        };

        candidatos.forEach(c => {
            const abbStatus = getAbbreviatedStatus(c.status);
            if (counts[abbStatus] !== undefined) counts[abbStatus]++;
            
            // Stats por Cargo
            const cargo = c.position || 'SIN CARGO';
            if (!cargoPipeline[cargo]) {
                cargoPipeline[cargo] = { total: 0, status: {} };
                STATUSES.forEach(s => cargoPipeline[cargo].status[s] = 0);
            }
            cargoPipeline[cargo].total++;
            if (cargoPipeline[cargo].status[abbStatus] !== undefined) cargoPipeline[cargo].status[abbStatus]++;

            // Stats por Proyecto
            const proj = c.projectName || 'SIN PROYECTO';
            if (!projectPipeline[proj]) {
                projectPipeline[proj] = { total: 0, status: {} };
                STATUSES.forEach(s => projectPipeline[proj].status[s] = 0);
            }
            projectPipeline[proj].total++;
            if (projectPipeline[proj].status[abbStatus] !== undefined) projectPipeline[proj].status[abbStatus]++;

            // Stats por Cliente
            const resolvedClient = c.clienteNombre || (clientes.find(cl => cl._id === (c.clienteId?._id || c.clienteId))?.nombre) || 'SIN CLIENTE';
            if (!clientPipeline[resolvedClient]) {
                clientPipeline[resolvedClient] = { total: 0, status: {}, specialCounts: { TEC: 0, SUP: 0 } };
                STATUSES.forEach(s => clientPipeline[resolvedClient].status[s] = 0);
            }
            clientPipeline[resolvedClient].total++;
            if (clientPipeline[resolvedClient].status[abbStatus] !== undefined) clientPipeline[resolvedClient].status[abbStatus]++;

            // Conteo Inteligente de Cargos (TEC / SUP) — SOLO SI NO ESTÁ DE BAJA
            if (abbStatus !== 'DE BAJA') {
                const cargoNorm = (c.position || '').toUpperCase();
                if (cargoNorm.includes('TECNICO TELECOMUNICACIONES')) clientPipeline[resolvedClient].specialCounts.TEC++;
                if (cargoNorm.includes('SUPERVISOR TELECOMUNICACIONES')) clientPipeline[resolvedClient].specialCounts.SUP++;
            }
        });
        return { counts, cargoPipeline, projectPipeline, clientPipeline };
    }, [candidatos, clientes]);

    const filteredCandidatos = useMemo(() => {
        return candidatos.filter(c => {
            const matchesSearch = 
                c.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.rut?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.projectName?.toLowerCase().includes(searchTerm.toLowerCase());
            
            const getAbb = (status) => {
                if (['En Postulación', 'Postulando'].includes(status)) return 'POST';
                if (['En Entrevista'].includes(status)) return 'ENTR';
                if (['Aprobado', 'En Evaluación', 'Aprobado/No Operativo'].includes(status)) return 'APROB';
                if (['En Acreditación', 'Acreditación', 'En Documentación'].includes(status)) return 'ACRED';
                if (['Contratado'].includes(status)) return 'CONT';
                if (['En Terreno', 'Listo Terreno', 'EN TERR'].includes(status)) return 'ACTIVO';
                if (['Suspendido', 'Bloqueado', 'Ausente', 'Licencia Médica', 'Inactivo', 'Suspendidos', 'bloqueados', 'Ausentes', 'Licencia medica'].includes(status)) return 'INACTIVO';
                if (['Rechazado', 'Retirado', 'Finiquitado', 'Bajas/Inactivos', 'De Baja'].includes(status)) return 'DE BAJA';
                return status;
            };

            const matchesStatus = filterStatus === 'ALL' || getAbb(c.status) === filterStatus;
            const matchesProject = filterProject === 'ALL' || c.projectName === filterProject;
            const matchesCargo = filterCargo === 'ALL' || c.position === filterCargo;
            const resolvedClient = c.clienteNombre || (clientes.find(cl => cl._id === (c.clienteId?._id || c.clienteId))?.nombre) || 'SIN CLIENTE';
            const matchesClient = filterClient === 'ALL' || resolvedClient === filterClient;

            // Filtros de Columna Dinámicos
            const matchesColPerfil = !columnFilters.perfil || c.fullName?.toLowerCase().includes(columnFilters.perfil.toLowerCase());
            const matchesColRut = !columnFilters.identificacion || c.rut?.toLowerCase().includes(columnFilters.identificacion.toLowerCase()) || c.idRecursoToa?.toLowerCase().includes(columnFilters.identificacion.toLowerCase());
            const resolvedColCliente = c.clienteNombre || (clientes.find(cl => cl._id === (c.clienteId?._id || c.clienteId))?.nombre) || '';
            const matchesColCliente = !columnFilters.cliente || resolvedColCliente.toLowerCase().includes(columnFilters.cliente.toLowerCase());
            const matchesColAsignacion = !columnFilters.asignacion || c.projectName?.toLowerCase().includes(columnFilters.asignacion.toLowerCase()) || c.position?.toLowerCase().includes(columnFilters.asignacion.toLowerCase());
            const matchesColSede = !columnFilters.ubicacion || c.sede?.toLowerCase().includes(columnFilters.ubicacion.toLowerCase()) || c.comuna?.toLowerCase().includes(columnFilters.ubicacion.toLowerCase());

            return matchesSearch && matchesStatus && matchesProject && matchesCargo && matchesClient && matchesColPerfil && matchesColRut && matchesColCliente && matchesColAsignacion && matchesColSede;
        });
    }, [candidatos, searchTerm, filterStatus, filterProject, filterCargo, filterClient, columnFilters, clientes]);

    const handleActionClick = (e, statusId, clientTitle, type) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setActionMenu({
            x: rect.left,
            y: rect.bottom + window.scrollY,
            statusId,
            clientTitle,
            type
        });
    };

    const calculateProjectSummary = (clientTitle) => {
        const isGlobal = clientTitle.includes('TOTALES');
        const clientProyects = isGlobal 
            ? proyectos 
            : proyectos.filter(p => {
                const pClient = p.clienteNombre || (clientes.find(cl => cl._id === (p.cliente?._id || p.cliente))?.nombre) || '';
                return pClient.toUpperCase().includes(clientTitle.toUpperCase()) || clientTitle.toUpperCase().includes(pClient.toUpperCase());
            });

        return clientProyects.map(p => {
            const req = (p.dotacion || []).reduce((acc, d) => acc + (d.cantidad || 0), 0);
            const rec = candidatos.filter(c => {
                const matchesProject = c.projectName === p.nombreProyecto || c.projectId === p._id || c.projectId?._id === p._id;
                const status = c.status || '';
                const isRecruited = ['En Terreno', 'Listo Terreno', 'EN TERR', 'Contratado'].includes(status);
                return matchesProject && isRecruited;
            }).length;

            const percent = req > 0 ? Math.round((rec / req) * 100) : (rec > 0 ? 100 : 0);
            
            const cargoDetails = (p.dotacion || []).map(d => {
                const cRec = candidatos.filter(c => {
                    const matchesProject = c.projectName === p.nombreProyecto || c.projectId === p._id || c.projectId?._id === p._id;
                    const matchesCargo = (c.position || '').toUpperCase() === (d.cargo || '').toUpperCase();
                    const status = c.status || '';
                    const isRecruited = ['En Terreno', 'Listo Terreno', 'EN TERR', 'Contratado'].includes(status);
                    return matchesProject && matchesCargo && isRecruited;
                }).length;
                return { cargo: d.cargo, required: d.cantidad, recruited: cRec };
            });

            return { 
                projectName: p.nombreProyecto, 
                required: req, 
                recruited: rec, 
                percent,
                details: cargoDetails
            };
        }).sort((a,b) => b.required - a.required);
    };

    const calculateCoverage = (clientTitle) => {
        const isGlobal = clientTitle.includes('TOTALES');
        const clientProyects = isGlobal 
            ? proyectos 
            : proyectos.filter(p => {
                const pClient = p.clienteNombre || (clientes.find(cl => cl._id === (p.cliente?._id || p.cliente))?.nombre) || '';
                return pClient.toUpperCase().includes(clientTitle.toUpperCase()) || clientTitle.toUpperCase().includes(pClient.toUpperCase());
            });

        const requiredByCargo = {};
        clientProyects.forEach(p => {
            (p.dotacion || []).forEach(d => {
                const cargo = (d.cargo || 'SIN CARGO').toUpperCase();
                requiredByCargo[cargo] = (requiredByCargo[cargo] || 0) + (d.cantidad || 0);
            });
        });

        const clientCandidatos = isGlobal
            ? candidatos
            : candidatos.filter(c => {
                const cClient = c.clienteNombre || (clientes.find(cl => cl._id === (c.clienteId?._id || c.clienteId))?.nombre) || '';
                return cClient.toUpperCase().includes(clientTitle.toUpperCase()) || clientTitle.toUpperCase().includes(cClient.toUpperCase());
            });

        const recruitedByCargo = {};
        clientCandidatos.forEach(c => {
            const status = c.status || '';
            const isRecruited = ['En Terreno', 'Listo Terreno', 'EN TERR', 'Contratado'].includes(status);
            if (isRecruited) {
                const cargo = (c.position || 'SIN CARGO').toUpperCase();
                recruitedByCargo[cargo] = (recruitedByCargo[cargo] || 0) + 1;
            }
        });

        const allCargos = Array.from(new Set([...Object.keys(requiredByCargo), ...Object.keys(recruitedByCargo)]));
        const details = allCargos.map(cargo => {
            const req = requiredByCargo[cargo] || 0;
            const rec = recruitedByCargo[cargo] || 0;
            const percent = req > 0 ? Math.round((rec / req) * 100) : (rec > 0 ? 100 : 0);
            return { cargo, required: req, recruited: rec, percent };
        }).sort((a,b) => b.required - a.required);

        return { 
            title: clientTitle, 
            cargoDetails: details,
            projectDetails: calculateProjectSummary(clientTitle)
        };
    };

    const handleDownloadExcel = () => {
        try {
            const excelData = filteredCandidatos.map(c => {
                const resolvedCliente = c.clienteNombre || (clientes.find(cl => cl._id === (c.clienteId?._id || c.clienteId))?.nombre) || 'N/A';
                return {
                    'NOMBRE COMPLETO': c.fullName,
                    'RUT': c.rut,
                    'EMAIL': c.email || 'N/A',
                    'TELÉFONO': c.phone || 'N/A',
                    'NACIONALIDAD': c.nationality || 'CHILENA',
                    'GÉNERO': c.gender || 'N/A',
                    'CLIENTE VINCULADO': resolvedCliente,
                    'PROYECTO': c.projectName,
                    'CECO': c.ceco || 'N/A',
                    'ÁREA': c.area || 'N/A',
                    'SEDE': c.sede || 'N/A',
                    'CARGO': c.position,
                    'ESTADO': c.status,
                    'TIPO CONTRATO': c.contractType || 'N/A',
                    'INICIO CONTRATO': c.contractStartDate ? new Date(c.contractStartDate).toLocaleDateString() : 'N/A',
                    'TÉRMINO CONTRATO': c.contractEndDate ? new Date(c.contractEndDate).toLocaleDateString() : 'N/A',
                    'PRÓXIMO HITO': c.nextAddendumDate ? new Date(c.nextAddendumDate).toLocaleDateString() : 'N/A',
                    'AFP': c.afp || 'N/A',
                    'SALUD': c.previsionSalud || 'N/A',
                    'ISAPRE': c.isapreNombre || 'N/A',
                    'VALOR PLAN': c.valorPlan || 'N/A',
                    'BANCO': c.banco || 'N/A',
                    'TIPO CUENTA': c.tipoCuenta || 'N/A',
                    'NÚMERO CUENTA': c.numeroCuenta || 'N/A',
                    'TALLA CAMISA': c.shirtSize || 'N/A',
                    'TALLA PANTALÓN': c.pantsSize || 'N/A',
                    'TALLA ZAPATOS': c.shoeSize || 'N/A'
                };
            });
            const ws = XLSX.utils.json_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Candidatos");
            XLSX.writeFile(wb, "Gestion_Talento_Completo.xlsx");
        } catch (err) { 
            console.error(err);
            showToast("❌ Error al exportar Excel", 'error'); 
        }
    };

    const renderHeader = () => (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
            <div className="flex items-center gap-5">
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white p-4 rounded-[1.8rem] shadow-2xl">
                    <UserPlus size={28} />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-800">Captura de <span className="text-indigo-600">Talento</span></h1>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Gestión Estratégica de Capital Humano</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <div className="hidden lg:flex items-center gap-3 bg-white/50 backdrop-blur-md px-6 py-4 rounded-2xl border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resultados:</span>
                    <span className="text-lg font-black text-indigo-700">{filteredCandidatos.length}</span>
                </div>

                <button 
                    onClick={handleDownloadExcel}
                    className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white px-7 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] transition-all shadow-xl shadow-emerald-100/20"
                >
                    <Download size={16} />
                    Exportar
                </button>

                <div className="h-10 w-px bg-slate-200 mx-2 hidden md:block" />

                <button onClick={handleSyncBase} className="px-6 py-4 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 shadow-sm hover:bg-slate-50">
                    <Waypoints size={16} className="text-indigo-500" /> Sincronizar
                </button>
                <button onClick={() => { setForm(initialForm); setEditId(null); setShowForm(true); }} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-2xl hover:-translate-y-1 transition-all flex items-center gap-2">
                    <Plus size={16} /> Registrar
                </button>
            </div>
        </div>
    );

    const scrollToTable = () => {
        const table = document.getElementById('main-data-table');
        if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleDashboardFilter = (status, project = 'ALL', cargo = 'ALL', client = 'ALL') => {
        setFilterStatus(status);
        // Si el título contiene "TOTALES", reseteamos los filtros de esa dimensión para mostrar el universo completo
        setFilterProject(project.includes('TOTALES') ? 'ALL' : project);
        setFilterCargo(cargo.includes('TOTALES') ? 'ALL' : cargo);
        setFilterClient(client.includes('TOTALES') ? 'ALL' : client);
        scrollToTable();
    };

    const renderStats = () => {
        const flowStages = [
            { id: 'En Postulación', label: 'Reclutamiento', icon: UserPlus, color: 'from-indigo-500 to-blue-600' },
            { id: 'En Entrevista', label: 'Entrevista', icon: MessageCircle, color: 'from-violet-500 to-purple-600' },
            { id: 'En Evaluación', label: 'Evaluación', icon: Search, color: 'from-sky-500 to-blue-600' },
            { id: 'En Acreditación', label: 'Acreditación', icon: ShieldCheck, color: 'from-orange-500 to-amber-600' },
            { id: 'En Documentación', label: 'Documentos', icon: FileText, color: 'from-amber-500 to-yellow-600' },
            { id: 'Aprobado', label: 'Listo Terreno', icon: CheckCircle, color: 'from-teal-500 to-emerald-600' },
            { id: 'Aprobado/No Operativo', label: 'No Operativo', icon: AlertCircle, color: 'from-cyan-500 to-sky-600' },
            { id: 'Contratado', label: 'En Terreno', icon: Activity, color: 'from-emerald-500 to-green-600' },
            { id: 'Finiquitado', label: 'Bajas / Inactivos', icon: LogOut, color: 'from-slate-400 to-slate-600' },
        ];

        const renderLedgerItem = (title, data, icon, type = 'client') => {
            // Entity-specific color mapping for the Master Console
            const entityColors = {
                'TOTALES': 'from-slate-900 via-indigo-950 to-slate-900 border-indigo-500/30',
                'ZENER': 'from-orange-500 to-orange-600',
                'COMFICA': 'from-sky-500 to-sky-600',
                'DEFAULT': 'from-indigo-600 to-indigo-700'
            };

            const getColor = (name) => {
                const n = name.toUpperCase();
                if (n.includes('TOTALES')) return entityColors['TOTALES'];
                if (n.includes('ZENER')) return entityColors['ZENER'];
                if (n.includes('COMFICA')) return entityColors['COMFICA'];
                return entityColors.DEFAULT;
            };

            const theme = getColor(title);

            const hubMetrics = [
                { id: 'TEC',          label: 'TEC',      tooltip: 'Técnicos Telecomunicaciones — Personal operativo en campo',               color: 'from-blue-600 to-indigo-700',  count: data.specialCounts?.TEC || 0 },
                { id: 'SUP',          label: 'SUP',      tooltip: 'Supervisores Telecomunicaciones — Personal de gestión y control',         color: 'from-violet-600 to-purple-800', count: data.specialCounts?.SUP || 0 },
                { id: 'POST',         label: 'POST',     tooltip: 'En Postulación — Candidatos en etapa de aplicación inicial',                  color: 'from-indigo-500 to-indigo-600', count: data.status['POST']    || 0 },
                { id: 'ENTR',         label: 'ENTR',     tooltip: 'En Entrevista — En proceso de evaluación presencial o virtual',              color: 'from-violet-500 to-violet-600', count: data.status['ENTR']    || 0 },
                { id: 'APROB',        label: 'APROB',    tooltip: 'Aprobado — Superaron la entrevista y evaluación técnica',                     color: 'from-teal-500 to-teal-600',    count: data.status['APROB']   || 0 },
                { id: 'ACRED',        label: 'ACRED',    tooltip: 'En Acreditación — En proceso de documentación, exámenes y EPP',            color: 'from-orange-500 to-orange-600',count: data.status['ACRED']   || 0 },
                { id: 'CONT',         label: 'CONT',     tooltip: 'Contratado — Con contrato firmado, listos para operar',                       color: 'from-emerald-500 to-emerald-600', count: data.status['CONT'] || 0 },
                { id: 'ACTIVO',       label: 'ACTIVO',   tooltip: 'Activo — Operando en terreno, ejecutando trabajos en campo',                  color: 'from-sky-500 to-sky-600',      count: data.status['ACTIVO']  || 0 },
                { id: 'INACTIVO',     label: 'INACTIVO', tooltip: 'Inactivo — Suspendidos, Bloqueados, Ausentes o Licencia Médica',            color: 'from-amber-400 to-orange-500', count: data.status['INACTIVO'] || 0 },
                { id: 'DE BAJA',      label: 'DE BAJA',  tooltip: 'De Baja — Finiquitados, retirados o rechazados',                             color: 'from-rose-500 to-rose-600',    count: data.status['DE BAJA'] || 0, isRed: true }
            ];

            const totalMetric = { id: 'total', label: 'TOTAL', tooltip: 'Total de colaboradores en la cartera', color: 'from-slate-700 to-slate-800', count: data.total };

            return (
                <div key={title} className="group bg-white rounded-[1.5rem] border border-slate-200 p-2 hover:border-indigo-400 hover:shadow-xl transition-all cursor-pointer flex items-center justify-between gap-4 w-full shadow-md overflow-hidden"
                    onClick={(e) => handleActionClick(e, 'ALL', title, type)}
                >
                    {/* TOTAL Box - Far Left - Compacted */}
                    <div className="flex flex-col items-center gap-1 w-14 relative group/metric ml-4 shrink-0">
                        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none opacity-0 group-hover/metric:opacity-100 transition-all duration-200 scale-95 group-hover/metric:scale-100">
                             <div className="bg-slate-900/95 backdrop-blur-sm text-white text-[9px] font-bold rounded-xl px-3 py-2 whitespace-nowrap shadow-2xl border border-white/10 max-w-[160px] text-center leading-snug">
                                {totalMetric.tooltip}
                             </div>
                             <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95"></div>
                        </div>
                        <div 
                            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all bg-gradient-to-br ${totalMetric.color} text-white shadow-lg hover:scale-110`}
                            onClick={(e) => handleActionClick(e, 'ALL', title, type)}
                        >
                            <span className="text-[16px] font-black">{totalMetric.count}</span>
                        </div>
                        <span className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-900">
                            {totalMetric.label}
                        </span>
                    </div>

                    {/* Entity Title Box - Narrower for better fit */}
                    <div className={`bg-gradient-to-br ${theme} text-white px-5 py-3 rounded-xl w-[220px] flex items-center justify-center text-center shadow-lg shrink-0 ${title.toUpperCase().includes('TOTALES') ? 'ring-2 ring-indigo-500/50 shadow-indigo-900/40 scale-[1.02]' : ''}`}>
                        <span className={`text-[13px] font-black uppercase tracking-tight truncate ${title.toUpperCase().includes('TOTALES') ? 'text-indigo-100' : ''}`}>{title}</span>
                    </div>

                    {/* Metric Sequence - Centered within the remaining space */}
                    <div className="flex-1 flex items-center justify-end gap-5 pr-4">
                        {/* OPERATIONAL SEGMENT (TEC / SUP) - Sync with Entity Theme */}
                        <div className={`flex items-center gap-4 px-4 py-2 bg-gradient-to-br ${theme} rounded-2xl shadow-lg relative group/ops border border-white/20`}>
                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-white px-2 text-[6px] font-black text-slate-500 uppercase tracking-widest border border-slate-100 rounded-full shadow-sm">
                                Operativa
                            </span>
                            {hubMetrics.filter(m => ['TEC', 'SUP'].includes(m.id)).map(m => (
                                <div key={m.id} className="flex flex-col items-center gap-1 w-12 relative group/metric">
                                    <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none opacity-0 group-hover/metric:opacity-100 transition-all duration-200 scale-95 group-hover/metric:scale-100">
                                        <div className="bg-slate-900/95 backdrop-blur-sm text-white text-[9px] font-bold rounded-xl px-3 py-2 whitespace-nowrap shadow-2xl border border-white/10 max-w-[160px] text-center leading-snug">
                                            {m.tooltip}
                                        </div>
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95"></div>
                                    </div>
                                    <div 
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${m.count > 0 ? `bg-white text-slate-900 shadow-md hover:scale-110` : 'bg-white/20 text-white/40 border border-white/10'}`}
                                        onClick={(e) => {
                                            if (m.count > 0) handleActionClick(e, m.id, title, type);
                                        }}
                                    >
                                        <span className="text-[14px] font-black">{m.count}</span>
                                    </div>
                                    <span className={`text-[7px] font-black uppercase tracking-[0.1em] ${m.count > 0 ? 'text-white' : 'text-white/60'}`}>
                                        {m.label}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="h-8 w-px bg-slate-200 shrink-0" />

                        {/* FLOW SEGMENT */}
                        <div className="flex items-center gap-2">
                            {hubMetrics.filter(m => !['TEC', 'SUP'].includes(m.id)).map(m => (
                                <div key={m.id} className="flex flex-col items-center gap-1 w-12 relative group/metric">
                                    <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none opacity-0 group-hover/metric:opacity-100 transition-all duration-200 scale-95 group-hover/metric:scale-100">
                                        <div className="bg-slate-900/95 backdrop-blur-sm text-white text-[9px] font-bold rounded-xl px-3 py-2 whitespace-nowrap shadow-2xl border border-white/10 max-w-[160px] text-center leading-snug">
                                            {m.tooltip}
                                        </div>
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95"></div>
                                    </div>
                                    <div 
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${m.count > 0 ? `bg-gradient-to-br ${m.color} text-white shadow-lg hover:scale-110` : 'bg-slate-100 text-slate-300 border border-slate-200'}`}
                                        onClick={(e) => {
                                            if (m.count > 0) handleActionClick(e, m.id, title, type);
                                        }}
                                    >
                                        <span className="text-[14px] font-black">{m.count}</span>
                                    </div>
                                    <span className={`text-[7px] font-black uppercase tracking-[0.1em] ${m.isRed ? 'text-rose-600' : m.count > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                                        {m.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        };

        // Calculate TOTALES RAM
        const ramTotals = Object.values(stats.clientPipeline).reduce((acc, curr) => {
            acc.total += curr.total;
            Object.keys(curr.status).forEach(k => {
                acc.status[k] = (acc.status[k] || 0) + curr.status[k];
            });
            // Sumar conteos especiales
            acc.specialCounts.TEC += curr.specialCounts?.TEC || 0;
            acc.specialCounts.SUP += curr.specialCounts?.SUP || 0;
            return acc;
        }, { total: 0, status: {}, specialCounts: { TEC: 0, SUP: 0 } });

        const companyName = typeof currentUser?.empresa === 'object' ? currentUser?.empresa?.nombre : (currentUser?.empresa || 'GENERALES');

        return (
            <React.Fragment>
                <div className="space-y-8 mb-16" id="stats-root-container">
                    <div className="flex flex-col items-center gap-4 px-4">
                        {/* Summary Header: Dinámico por Empresa */}
                        <div className="w-full max-w-6xl">
                            {renderLedgerItem(`TOTALES ${companyName}`, ramTotals, <Activity />, 'client')}
                        </div>
                        
                        <div className="h-px bg-slate-200 w-full max-w-5xl my-2 opacity-50" />

                        {/* Client Bars - Slim Version */}
                        {Object.entries(stats.clientPipeline)
                            .sort((a,b) => b[1].total - a[1].total)
                            .map(([client, data]) => (
                                <div key={client} className="w-full max-w-6xl">
                                    {renderLedgerItem(client, data, <Building />, 'client')}
                                </div>
                            ))
                        }
                    </div>
                </div>
            </React.Fragment>
        );
    };

    const renderFilters = () => (
        <div className="space-y-4">
            <div className="bg-white p-3 rounded-[2rem] border-2 border-slate-100 shadow-xl shadow-indigo-100/30 relative">
                <div className="flex flex-col lg:flex-row items-center gap-3 relative z-10">
                    <div className="relative flex-1 w-full group">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-indigo-500 group-focus-within:scale-110 transition-transform">
                            <Search size={20} />
                        </div>
                        <input 
                            type="text"
                            placeholder="BUSCAR COLABORADOR, RUT O CARGO..."
                            className="w-full pl-14 pr-6 py-3.5 bg-slate-50 rounded-[1.5rem] text-[12px] font-black text-slate-950 placeholder:text-slate-300 outline-none ring-4 ring-transparent focus:ring-indigo-50/50 transition-all border-2 border-transparent focus:border-indigo-100 uppercase"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                        {[
                            { value: filterProject, setter: setFilterProject, icon: <FolderKanban size={14} />, label: 'PROYECTO', options: Object.keys(stats.projectPipeline).sort(), color: 'emerald' },
                            { value: filterClient, setter: setFilterClient, icon: <Building2 size={14} />, label: 'CLIENTE', options: Object.keys(stats.clientPipeline).sort(), color: 'indigo' },
                            { value: filterCargo, setter: setFilterCargo, icon: <Briefcase size={14} />, label: 'CARGO', options: Object.keys(stats.cargoPipeline).sort(), color: 'violet' },
                            { value: filterStatus, setter: setFilterStatus, icon: <Activity size={14} />, label: 'ESTADO', options: STATUSES, color: 'amber' }
                        ].map((f, i) => (
                            <div key={i} className="relative group min-w-[130px] flex-1 md:flex-none">
                                <select 
                                    className={`w-full pl-10 pr-8 py-3.5 bg-slate-50 rounded-[1.2rem] text-[10px] font-black uppercase tracking-tight text-slate-700 outline-none border-2 border-transparent focus:border-${f.color}-100 ring-4 ring-transparent focus:ring-${f.color}-50/50 appearance-none cursor-pointer transition-all`}
                                    value={f.value || ""}
                                    onChange={e => f.setter(e.target.value)}
                                >
                                    <option value="ALL">{f.label}</option>
                                    {f.options.map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
                                </select>
                                <div className={`absolute left-4 top-1/2 -translate-y-1/2 text-${f.color}-500 pointer-events-none`}>
                                    {f.icon}
                                </div>
                                <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 text-${f.color}-300 pointer-events-none`} size={14} />
                            </div>
                        ))}

                    <div className="relative min-w-[130px] flex-1 md:flex-none">
                        <button 
                            onClick={() => setShowColumnSelector(!showColumnSelector)}
                            className="w-full pl-10 pr-8 py-3.5 bg-slate-50 rounded-[1.2rem] text-[10px] font-black uppercase tracking-tight text-slate-700 flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all border-2 border-transparent hover:border-slate-200 shadow-sm relative"
                        >
                            <Layers size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" />
                            Columnas
                            <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 transition-transform ${showColumnSelector ? 'rotate-180' : ''}`} size={14} />
                        </button>
                        
                        {showColumnSelector && (
                            <>
                                <div className="fixed inset-0 z-[150]" onClick={() => setShowColumnSelector(false)} />
                                <div className="absolute right-0 top-full mt-2 z-[160] w-80 bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-4 animate-in fade-in zoom-in duration-200">
                                    <div className="px-4 py-2 border-b border-slate-50 mb-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configurar Tabla</span>
                                    </div>
                                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                        {ALL_COLUMNS.map(col => (
                                            <label key={col.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-all">
                                                <input 
                                                    type="checkbox" 
                                                    className="checkbox checkbox-indigo checkbox-sm rounded-lg"
                                                    checked={visibleColumns.includes(col.id)}
                                                    onChange={() => {
                                                        const newCols = visibleColumns.includes(col.id)
                                                            ? visibleColumns.filter(c => c !== col.id)
                                                            : [...visibleColumns, col.id];
                                                        setVisibleColumns(newCols);
                                                        localStorage.setItem('rrhh_visible_columns', JSON.stringify(newCols));
                                                    }}
                                                />
                                                <span className="text-[11px] font-black text-slate-700 uppercase">{col.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    </div>
                </div>
            </div>

            {(filterStatus !== 'ALL' || filterProject !== 'ALL' || filterCargo !== 'ALL' || filterClient !== 'ALL' || searchTerm !== '') && (
                <div className="flex justify-start mt-4">
                    <button 
                        onClick={() => { setFilterStatus('ALL'); setFilterProject('ALL'); setFilterCargo('ALL'); setFilterClient('ALL'); setSearchTerm(''); }}
                        className="flex items-center gap-3 text-[10px] font-black text-rose-600 uppercase tracking-[0.2em] bg-white hover:bg-rose-50 px-5 py-2.5 rounded-full transition-all group border-2 border-rose-100 shadow-sm"
                    >
                        <X size={14} className="group-hover:rotate-90 transition-transform" />
                        Limpiar Filtros
                    </button>
                </div>
            )}
        </div>
    );

    const renderTable = () => (
        <div className="space-y-6">
            <div id="main-data-table" className="bg-white rounded-[2.8rem] shadow-2xl shadow-slate-200/40 border border-slate-100 overflow-hidden animate-in fade-in duration-700">
                {loading ? (
                    <div className="py-48 flex flex-col items-center gap-6">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-indigo-50 rounded-full animate-spin border-t-indigo-600" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Activity size={20} className="text-indigo-600 animate-pulse" />
                            </div>
                        </div>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">Sincronizando Capital Humano...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-900 text-white border-b-4 border-slate-800">
                                <tr>
                                    <th className="pl-10 pr-4 py-6 w-10">
                                        <input 
                                            type="checkbox" 
                                            className="w-5 h-5 rounded-lg accent-indigo-600 cursor-pointer"
                                            checked={selectedIds.length === filteredCandidatos.length && filteredCandidatos.length > 0}
                                            onChange={toggleSelectAll}
                                        />
                                    </th>
                                    {visibleColumns.includes('perfil') && <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[0.2em] border-r border-white/5">Colaborador</th>}
                                    {visibleColumns.includes('identificacion') && <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[0.2em] border-r border-white/5">Identificación</th>}
                                    {visibleColumns.includes('cliente') && <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[0.2em] border-r border-white/5">Cliente Vinculado</th>}
                                    {visibleColumns.includes('asignacion') && <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[0.2em] border-r border-white/5">Asignación</th>}
                                    {visibleColumns.includes('ubicacion') && <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[0.2em] border-r border-white/5">Ubicación</th>}
                                    {visibleColumns.includes('contractual') && <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[0.2em] border-r border-white/5">Contrato / Duración</th>}
                                    {visibleColumns.includes('gestion') && <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[0.2em] border-r border-white/5">Gestión / Hitos</th>}
                                    {visibleColumns.includes('institucional') && <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[0.2em] border-r border-white/5">AFP / Previsión</th>}
                                    {visibleColumns.includes('financiero') && <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[0.2em] border-r border-white/5">Financiero</th>}
                                    {visibleColumns.includes('tallas') && <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[0.2em] border-r border-white/5">Tallas</th>}
                                    {visibleColumns.includes('contacto') && <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[0.2em] border-r border-white/5">Contacto</th>}
                                    {visibleColumns.includes('estado') && <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[0.2em] border-r border-white/5">Estado Contratación</th>}
                                    {visibleColumns.includes('acciones') && <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-center">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                            {filteredCandidatos.map(c => (
                                <tr key={c._id} className={`hover:bg-slate-50/50 transition-all group ${selectedIds.includes(c._id) ? 'bg-indigo-50/30' : ''}`}>
                                    <td className="pl-10 pr-4 py-6">
                                        <input 
                                            type="checkbox" 
                                            className="w-5 h-5 rounded-lg accent-indigo-600 cursor-pointer"
                                            checked={selectedIds.includes(c._id)}
                                            onChange={() => {
                                                if (selectedIds.includes(c._id)) {
                                                    setSelectedIds(selectedIds.filter(id => id !== c._id));
                                                } else {
                                                    setSelectedIds([...selectedIds, c._id]);
                                                }
                                            }}
                                        />
                                    </td>
                                    {visibleColumns.includes('perfil') && (
                                        <td className="pl-10 pr-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className={`rounded-2xl bg-white flex items-center justify-center text-slate-300 font-bold border-2 border-slate-100 shadow-sm overflow-hidden group-hover:border-indigo-100 transition-all ${viewMode === 'compact' ? 'w-12 h-12' : 'w-16 h-16'}`}>
                                                    {c.profilePic ? <img src={c.profilePic} className="w-full h-full object-cover" alt="" /> : <User size={viewMode === 'compact' ? 20 : 28} />}
                                                </div>
                                                <div>
                                                    <div className={`font-black text-slate-950 tracking-tight leading-none mb-1.5 ${viewMode === 'compact' ? 'text-[12px]' : 'text-[15px]'}`}>{c.fullName?.toUpperCase()}</div>
                                                    <div className="flex items-center gap-2">
                                                        <Mail size={11} className="text-slate-400" />
                                                        <span className="text-[11px] font-bold text-slate-500 lowercase">{c.email || 'sin email'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    )}
                                    {visibleColumns.includes('identificacion') && (
                                        <td className="px-8 py-6">
                                            <div className="text-[12px] font-black text-slate-700 tracking-wider mb-2 font-mono bg-slate-100 px-3 py-1.5 rounded-lg w-fit border border-slate-200 shadow-sm">{c.rut}</div>
                                            <div className="inline-flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest bg-indigo-600 px-4 py-2 rounded-2xl shadow-lg shadow-indigo-200/50 transition-transform hover:scale-105">
                                                <Activity size={12} /> {c.idRecursoToa || 'SIN ID TOA'}
                                            </div>
                                        </td>
                                    )}
                                    {visibleColumns.includes('cliente') && (
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black shadow-sm">
                                                    {(c.clienteNombre || (clientes.find(cl => cl._id === (c.clienteId?._id || c.clienteId))?.nombre))?.charAt(0) || 'C'}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-black text-slate-700 uppercase leading-none">
                                                        {c.clienteNombre || (clientes.find(cl => cl._id === (c.clienteId?._id || c.clienteId))?.nombre) || 'Sin Cliente'}
                                                    </span>
                                                    <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-1">Socio Estratégico</span>
                                                </div>
                                            </div>
                                        </td>
                                    )}

                                    {visibleColumns.includes('asignacion') && (
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                    <span className="text-[11px] font-black text-slate-900 uppercase leading-none">{c.projectName || 'Sin Proyecto'}</span>
                                                </div>
                                                <div className="text-[11px] font-bold text-slate-600 uppercase leading-none mt-1">{c.position}</div>
                                                <div className="text-[9px] font-black text-white uppercase tracking-widest bg-slate-800 px-2.5 py-1.5 rounded-lg w-fit mt-2 shadow-sm">{c.ceco || 'S/C'}</div>
                                            </div>
                                        </td>
                                    )}
                                    {visibleColumns.includes('ubicacion') && (
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <MapPin size={12} className="text-rose-400" />
                                                    <span className="text-[11px] font-black text-slate-600 uppercase">{c.sede || 'N/A'}</span>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase ml-5">{c.comuna || 'Sin Comuna'}</span>
                                            </div>
                                        </td>
                                    )}
                                    {visibleColumns.includes('contractual') && (
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={12} className="text-indigo-400" />
                                                    <span className="text-[11px] font-black text-slate-600">{(c.contractStartDate || c.fechaInicioContrato) ? new Date(c.contractStartDate || c.fechaInicioContrato).toLocaleDateString() : '—'}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Clock size={12} className="text-indigo-300" />
                                                    <span className="text-[9px] font-black text-indigo-500 uppercase">{(c.contractDurationDays || c.duracionDias) ? `${c.contractDurationDays || c.duracionDias} DÍAS` : 'S/D'}</span>
                                                </div>
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter bg-slate-50 px-2 py-0.5 rounded w-fit">{c.contractType || '—'}</div>
                                            </div>
                                        </td>
                                    )}
                                    {visibleColumns.includes('gestion') && (
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col gap-2.5">
                                                <div className="inline-flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100">
                                                    <Star size={12} className="text-amber-500" />
                                                    <span className="text-[10px] font-black text-amber-600 uppercase">{(c.nextAddendumDate || c.fechaProximoHito) ? new Date(c.nextAddendumDate || c.fechaProximoHito).toLocaleDateString() : 'PENDIENTE'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 ml-1">
                                                    <Waypoints size={12} className="text-sky-400" />
                                                    <span className="text-[9px] font-black text-sky-600 uppercase">{c.operationalStartDate ? `OP: ${new Date(c.operationalStartDate).toLocaleDateString()}` : 'SIN FECHA OP'}</span>
                                                </div>
                                            </div>
                                        </td>
                                    )}
                                    {visibleColumns.includes('institucional') && (
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2">
                                                    <ShieldCheck size={12} className="text-indigo-400" />
                                                    <span className="text-[11px] font-black text-slate-700 uppercase">{c.afp || 'S/A'}</span>
                                                </div>
                                                <div className="text-[9px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded w-fit">{c.previsionSalud || 'FONASA'}</div>
                                            </div>
                                        </td>
                                    )}
                                    {visibleColumns.includes('financiero') && (
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="text-[11px] font-black text-slate-700 uppercase">{c.banco || 'S/B'}</div>
                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{c.tipoCuenta || '—'}</div>
                                                <div className="text-[10px] font-mono text-slate-400">{c.numeroCuenta || '—'}</div>
                                            </div>
                                        </td>
                                    )}
                                    {visibleColumns.includes('tallas') && (
                                        <td className="px-8 py-6">
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                <div className="flex items-center justify-between gap-2 border-b border-slate-50 pb-1">
                                                    <span className="text-[8px] font-black text-slate-300 uppercase">Polera</span>
                                                    <span className="text-[10px] font-black text-slate-700">{c.shirtSize || '—'}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2 border-b border-slate-50 pb-1">
                                                    <span className="text-[8px] font-black text-slate-300 uppercase">Pantalón</span>
                                                    <span className="text-[10px] font-black text-slate-700">{c.pantsSize || '—'}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[8px] font-black text-slate-300 uppercase">Zapatos</span>
                                                    <span className="text-[10px] font-black text-slate-700">{c.shoeSize || '—'}</span>
                                                </div>
                                            </div>
                                        </td>
                                    )}
                                    {visibleColumns.includes('contacto') && (
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2">
                                                    <Phone size={12} className="text-emerald-400" />
                                                    <span className="text-[11px] font-black text-slate-700">{c.phone || '—'}</span>
                                                </div>
                                                <div className="text-[9px] font-bold text-slate-400 truncate max-w-[150px]">{c.address || '—'}</div>
                                            </div>
                                        </td>
                                    )}
                                    {visibleColumns.includes('estado') && (
                                        <td className="px-8 py-6">
                                            <div className="relative group">
                                                <select 
                                                    value={(() => {
                                                        const s = c.status || '';
                                                        if (['En Postulación','Postulando'].includes(s)) return 'POST';
                                                        if (['En Entrevista','En Evaluación'].includes(s)) return 'ENTR';
                                                        if (['Aprobado','Aprobado/No Operativo'].includes(s)) return 'APROB';
                                                        if (['En Acreditación','Acreditación','En Documentación'].includes(s)) return 'ACRED';
                                                        if (['Contratado','Listo Terreno'].includes(s)) return 'CONT';
                                                        if (['En Terreno','EN TERR'].includes(s)) return 'ACTIVO';
                                                        if (['Suspendido', 'Bloqueado', 'Ausente', 'Licencia Médica', 'Inactivo'].includes(s)) return 'INACTIVO';
                                                        if (['Rechazado','Retirado','Finiquitado','Bajas/Inactivos', 'De Baja'].includes(s)) return 'DE BAJA';
                                                        return s;
                                                    })()}
                                                    onChange={async (e) => {
                                                        const abb = e.target.value;
                                                        const newStatus = getOriginalStatus(abb);
                                                        setCandidatos(prev => prev.map(cand =>
                                                            cand._id === c._id ? { ...cand, status: newStatus } : cand
                                                        ));
                                                        try {
                                                            await candidatosApi.updateStatus(c._id, { status: newStatus });
                                                            showToast(`✅ ${c.fullName?.split(' ')[0]} → ${abb}`);
                                                            fetchCandidatos();
                                                        } catch (err) {
                                                            showToast('❌ Error al actualizar estado', 'error');
                                                            fetchCandidatos();
                                                        }
                                                    }}
                                                    className={`appearance-none pl-4 pr-10 py-2.5 rounded-2xl border text-[9px] font-black uppercase tracking-wider cursor-pointer outline-none transition-all shadow-sm ${STATUS_COLORS[c.status] || 'bg-slate-50 text-slate-500'}`}
                                                >
                                                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                                            </div>
                                        </td>
                                    )}
                                    {visibleColumns.includes('acciones') && (
                                        <td className="px-10 py-6 text-right">
                                            <div className="flex justify-end gap-3">
                                                <button onClick={() => { setSelectedCandidato(c); }} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-100/20 rounded-2xl transition-all active:scale-95" title="Ver Ficha"><Eye size={20} /></button>
                                                <button onClick={() => handleEdit(c)} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-100 text-slate-400 hover:text-amber-600 hover:border-amber-100 hover:shadow-xl hover:shadow-amber-100/20 rounded-2xl transition-all active:scale-95" title="Editar"><Edit3 size={20} /></button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                )}
                {!loading && filteredCandidatos.length === 0 && (
                    <div className="py-32 flex flex-col items-center text-slate-300 gap-4">
                        <Users size={64} strokeWidth={1} />
                        <p className="text-[11px] font-black uppercase tracking-widest">No se encontraron candidatos</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderGrid = () => (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 animate-in fade-in duration-700">
            {filteredCandidatos.map(c => (
                <div key={c._id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all group">
                    <div className="h-2 w-full" style={{ backgroundColor: STATUS_COLORS[c.status]?.includes('text-') ? 'currentColor' : '#f1f5f9' }} />
                    <div className="p-8">
                        <div className="flex justify-between items-start mb-6">
                            <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300 border-2 border-slate-100 shadow-inner overflow-hidden">
                                {c.profilePic ? <img src={c.profilePic} className="w-full h-full object-cover" alt="" /> : <User size={32} />}
                            </div>
                            <div className={`px-4 py-2 rounded-xl border text-[8px] font-black uppercase tracking-widest ${STATUS_COLORS[c.status] || 'bg-slate-50 text-slate-500'}`}>
                                {c.status}
                            </div>
                        </div>
                        <div className="mb-6">
                            <h4 className="font-black text-slate-800 text-lg tracking-tight leading-tight mb-1">{c.fullName.toUpperCase()}</h4>
                            <p className="text-[10px] font-black text-indigo-500 tracking-[0.2em] uppercase">{c.position}</p>
                        </div>
                        <div className="space-y-3 mb-8">
                            <div className="flex items-center justify-between text-[10px]">
                                <span className="font-black text-slate-400 uppercase tracking-widest">RUT</span>
                                <span className="font-bold text-slate-600 font-mono">{c.rut}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                                <span className="font-black text-slate-400 uppercase tracking-widest">Proyecto</span>
                                <span className="font-bold text-slate-600 truncate max-w-[150px]">{c.projectName || 'N/A'}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 pt-6 border-t border-slate-50">
                            <button onClick={() => handleEdit(c)} className="flex-1 py-3 bg-slate-50 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 transition-all">Editar</button>
                            <button onClick={() => setSelectedCandidato(c)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 transition-all"><Eye size={16} /></button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    const handleFileUpload = async (type, file) => {
        if (!editId) {
            alert("⚠️ DEBE GUARDAR EL CANDIDATO PRIMERO\n\nPara vincular archivos, primero registre los datos básicos del postulante y luego use el botón de editar.");
            return;
        }
        try {
            const formData = new FormData();
            formData.append('file', file);
            setSaving(true);
            let res;
            if (type === 'profile') res = await candidatosApi.uploadProfilePic(editId, formData);
            else res = await candidatosApi.uploadCV(editId, formData);
            
            setForm(prev => ({ ...prev, [type === 'profile' ? 'profilePic' : 'cvUrl']: res.data.url }));
            alert("✅ Archivo procesado y vinculado correctamente.");
            fetchCandidatos(); // Refrescar para ver cambios
        } catch (err) {
            console.error("Error uploading:", err);
            alert("❌ Error al subir el archivo a Cloudinary.");
        } finally {
            setSaving(false);
        }
    };

    const renderForm = () => (
        <>
        <div className="bg-white rounded-[3.5rem] shadow-[0_32px_80px_rgba(15,23,42,0.15)] border border-slate-100 overflow-hidden flex flex-col h-[94vh] animate-in fade-in zoom-in-95 duration-500">
            {/* Header del Formulario */}
            <div className="px-12 py-10 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-7">
                    <button 
                        onClick={() => { setShowForm(false); setEditId(null); }} 
                        className="w-14 h-14 bg-white shadow-sm rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:shadow-md transition-all active:scale-95"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{editId ? 'Configuración de Perfil' : 'Apertura de Expediente (V3)'}</h2>
                            {editId && <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">ID: {editId.substring(0,8)}</span>}
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                            <ShieldCheck size={12} className="text-emerald-500" /> Registro seguro y validado en sistema central
                        </p>
                    </div>
                </div>
                
                {/* Tabs Flotantes */}
                <div className="flex p-1.5 bg-white shadow-xl shadow-slate-200/50 rounded-2xl overflow-x-auto no-scrollbar max-w-full">
                    {TABS.map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id)} 
                            className={`px-6 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all flex items-center gap-3 whitespace-nowrap ${activeTab === tab.id ? `bg-indigo-600 text-white shadow-lg shadow-indigo-200` : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>
            
            {/* Cuerpo del Formulario */}
            <div className="flex-1 overflow-y-auto p-14 bg-white">
                <div className="max-w-5xl mx-auto pb-10">
                    <>
                    {activeTab === 'institucional' && (() => {
                        const selectedProj = proyectos.find(p => p._id === form.projectId);
                        const availableCargos = selectedProj ? [...new Set(selectedProj.dotacion.map(d => d.cargo))] : [];
                        const availableSedes = selectedProj ? [...new Set([
                            ...(selectedProj.sedesVinculadas || []),
                            ...(selectedProj.dotacion.map(d => d.sede).filter(Boolean)),
                            selectedProj.sede
                        ].filter(Boolean))] : [];

                        return (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5">
                                        <Building2 size={14} className="text-indigo-500"/> Proyecto / Centro de Operación
                                    </label>
                                    <SearchableSelect
                                        options={proyectos.map(p => ({ label: `${p.centroCosto} - ${p.nombreProyecto}`, value: p._id }))}
                                        value={form.projectId}
                                        onChange={handleProyectoChange}
                                        placeholder="Busque el proyecto aquí..."
                                        className="w-full"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5">
                                        <Activity size={14} className="text-indigo-500"/> Identificador TOA (Obligatorio Técnicos)
                                    </label>
                                    <input 
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-black text-indigo-600 outline-none focus:border-indigo-300 focus:bg-white transition-all font-mono placeholder:text-slate-300" 
                                        value={form.idRecursoToa || ""} 
                                        onChange={e => setForm({...form, idRecursoToa: e.target.value})} 
                                        placeholder="Ej: 19169" 
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5">
                                        <Briefcase size={14} className="text-indigo-500"/> Cargo Estructural
                                    </label>
                                    <div className="relative group">
                                        <select 
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-600 outline-none focus:border-indigo-300 focus:bg-white transition-all appearance-none cursor-pointer" 
                                            value={form.position || ""} 
                                            onChange={e => {
                                                const cargo = e.target.value;
                                                const dot = selectedProj?.dotacion.find(d => d.cargo === cargo);
                                                setForm(prev => ({
                                                    ...prev,
                                                    position: cargo,
                                                    ceco: dot?.ceco || prev.ceco,
                                                    area: dot?.area || prev.area,
                                                    departamento: dot?.departamento || prev.departamento
                                                }));
                                            }}
                                            disabled={!form.projectId}
                                        >
                                            <option value="">{form.projectId ? 'Seleccionar Cargo del Proyecto...' : 'Seleccione primero un proyecto'}</option>
                                            {availableCargos.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-hover:text-indigo-500 transition-colors" size={18} />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5">
                                        <MapPin size={14} className="text-indigo-500"/> Sede de Asignación
                                    </label>
                                    <div className="relative group">
                                        <select 
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-600 outline-none focus:border-indigo-300 focus:bg-white transition-all appearance-none cursor-pointer" 
                                            value={form.sede || ""} 
                                            onChange={e => setForm({...form, sede: e.target.value})}
                                            disabled={!form.projectId}
                                        >
                                            <option value="">{form.projectId ? 'Seleccionar Sede Destino...' : 'Seleccione primero un proyecto'}</option>
                                            {availableSedes.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-hover:text-indigo-500 transition-colors" size={18} />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5">
                                        <Layers size={14} className="text-indigo-500"/> Centro de Costo (Auto)
                                    </label>
                                    <input className="w-full bg-slate-100/50 border-2 border-slate-50 rounded-2xl px-7 py-5 text-sm font-black text-slate-400 outline-none font-mono" value={form.ceco || ""} readOnly placeholder="CECO" />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5">
                                        <CheckCircle size={14} className="text-emerald-500"/> Etapa de Gestión
                                    </label>
                                    <div className="relative group">
                                        <select className="w-full bg-emerald-50/20 border-2 border-emerald-100 rounded-2xl px-7 py-5 text-sm font-black text-emerald-700 outline-none focus:border-emerald-300 focus:bg-white transition-all appearance-none cursor-pointer" 
                                            value={(() => {
                                                const s = form.status || '';
                                                if (['En Postulación','Postulando'].includes(s)) return 'POST';
                                                if (['En Entrevista','En Evaluación'].includes(s)) return 'ENTR';
                                                if (['Aprobado','Aprobado/No Operativo'].includes(s)) return 'APROB';
                                                if (['En Acreditación','Acreditación','En Documentación'].includes(s)) return 'ACRED';
                                                if (['Contratado','Listo Terreno'].includes(s)) return 'CONT';
                                                if (['En Terreno','EN TERR'].includes(s)) return 'ACTIVO';
                                                if (['Suspendido', 'Bloqueado', 'Ausente', 'Licencia Médica', 'Inactivo'].includes(s)) return 'INACTIVO';
                                                if (['Rechazado','Retirado','Finiquitado','Bajas/Inactivos', 'De Baja'].includes(s)) return 'DE BAJA';
                                                return s;
                                            })()} 
                                            onChange={e => setForm({...form, status: getOriginalStatus(e.target.value)})}
                                        >
                                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-emerald-300 pointer-events-none" size={18} />
                                    </div>
                                </div>

                                <div className="md:col-span-2 pt-10 border-t border-slate-100">
                                        <div className="flex items-center justify-between mb-8">
                                            <div className="flex flex-col gap-1">
                                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Hitos & Gestión Contractual</h3>
                                                <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                                                    <Star size={8} fill="currentColor" /> {form.contractType === 'INDEFINIDO' ? 'Régimen de Continuidad Detectado' : 'Régimen de Plazo Determinado'}
                                                </p>
                                            </div>
                                            <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200">
                                                <button 
                                                    onClick={() => setForm({...form, contractType: 'PLAZO FIJO', contractStep: '1ER CONTRATO', contractDurationDays: 30})}
                                                    className={`px-8 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${form.contractType === 'PLAZO FIJO' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    {form.contractType === 'PLAZO FIJO' && <Check size={12} />} Plazo Fijo
                                                </button>
                                                <button 
                                                    onClick={() => setForm({...form, contractType: 'INDEFINIDO', contractStep: 'INDEFINIDO', contractDurationDays: 0})}
                                                    className={`px-8 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${form.contractType === 'INDEFINIDO' ? 'bg-white text-emerald-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    {form.contractType === 'INDEFINIDO' && <Check size={12} />} Indefinido
                                                </button>
                                            </div>
                                        </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Briefcase size={12} className="text-indigo-500"/> Cliente Vinculado</label>
                                            <select 
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold text-slate-600 outline-none focus:border-indigo-300" 
                                                value={form.clienteId || ""} 
                                                onChange={e => {
                                                    const cl = clientes.find(c => c._id === e.target.value);
                                                    setForm({...form, clienteId: e.target.value, clienteNombre: cl?.nombre || ''});
                                                }}
                                            >
                                                <option value="">Seleccione Cliente...</option>
                                                {clientes.map(cl => <option key={cl._id} value={cl._id}>{cl.nombre?.toUpperCase()}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Calendar size={12} className="text-indigo-500"/> Inicio Contrato</label>
                                            <input type="date" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold text-slate-600 outline-none focus:border-indigo-300" value={form.contractStartDate?.split('T')[0] || ""} onChange={e => setForm({...form, contractStartDate: e.target.value})} />
                                        </div>
                                        
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center justify-between">
                                                <div className="flex items-center gap-2"><Activity size={12} className="text-indigo-500"/> Duración (Días)</div>
                                                {form.contractType === 'PLAZO FIJO' && (
                                                    <div className="flex gap-2">
                                                        {[30, 60, 90].map(d => (
                                                            <button key={d} onClick={() => setForm({...form, contractDurationDays: d})} className={`px-2 py-0.5 rounded-md text-[8px] font-black border transition-all ${form.contractDurationDays == d ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 text-slate-400 hover:border-indigo-300'}`}>{d}</button>
                                                        ))}
                                                    </div>
                                                )}
                                            </label>
                                            <input 
                                                type="number" 
                                                disabled={form.contractType === 'INDEFINIDO'}
                                                className={`w-full border-2 rounded-2xl px-6 py-4 text-xs font-bold outline-none transition-all ${form.contractType === 'INDEFINIDO' ? 'bg-slate-100 border-slate-50 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-600 focus:border-indigo-300'}`} 
                                                value={form.contractDurationDays} 
                                                onChange={e => setForm({...form, contractDurationDays: e.target.value})} 
                                                placeholder={form.contractType === 'INDEFINIDO' ? "N/A" : "Ej: 30"} 
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                                <CheckCircle2 size={12} className={form.contractType === 'INDEFINIDO' ? "text-emerald-500" : "text-amber-500"}/> 
                                                {form.contractType === 'INDEFINIDO' ? "Aniversario / Revisión" : "Próximo Hito (Auto)"}
                                            </label>
                                            <input 
                                                type="date" 
                                                className={`w-full border-2 rounded-2xl px-6 py-4 text-xs font-black outline-none ${form.contractType === 'INDEFINIDO' ? 'bg-emerald-50/30 border-emerald-100 text-emerald-700' : 'bg-amber-50/30 border-amber-100 text-amber-700'}`} 
                                                value={form.nextAddendumDate?.split('T')[0] || ""} 
                                                readOnly 
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Clock size={12} className="text-cyan-500"/> Fecha Operativa</label>
                                            <input type="date" className="w-full bg-cyan-50/20 border-2 border-cyan-100 rounded-2xl px-6 py-4 text-xs font-bold text-cyan-700 outline-none focus:border-cyan-300" value={form.operationalStartDate?.split('T')[0] || ""} onChange={e => setForm({...form, operationalStartDate: e.target.value})} />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Paso Contrato</label>
                                            <select 
                                                className={`w-full border-2 rounded-2xl px-6 py-4 text-xs font-bold outline-none ${form.contractType === 'INDEFINIDO' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-600'}`} 
                                                value={form.contractStep || ""} 
                                                onChange={e => setForm({...form, contractStep: e.target.value})}
                                            >
                                                {form.contractType === 'PLAZO FIJO' ? (
                                                    <>
                                                        <option value="1ER CONTRATO">1ER CONTRATO</option>
                                                        <option value="2DO CONTRATO">2DO CONTRATO</option>
                                                    </>
                                                ) : (
                                                    <option value="INDEFINIDO">INDEFINIDO</option>
                                                )}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {activeTab === 'personal' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="md:col-span-2 space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5"><User size={14} className="text-indigo-500"/> Nombre Completo (Como figura en Cédula)</label>
                                <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300 focus:bg-white transition-all" value={form.fullName || ""} onChange={e => setForm({...form, fullName: e.target.value.toUpperCase()})} placeholder="EJ: JUAN IGNACIO PÉREZ SOTO" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5"><Hash size={14} className="text-indigo-500"/> RUT / Identificador Fiscal</label>
                                <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-black text-indigo-600 outline-none focus:border-indigo-300 focus:bg-white transition-all font-mono" value={form.rut || ""} onChange={e => setForm({...form, rut: formatRut(e.target.value)})} placeholder="12.345.678-9" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5"><Mail size={14} className="text-indigo-500"/> Correo Electrónico</label>
                                <input type="email" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300 focus:bg-white transition-all" value={form.email || ""} onChange={e => setForm({...form, email: e.target.value.toLowerCase()})} placeholder="ejemplo@correo.com" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5"><Phone size={14} className="text-indigo-500"/> Teléfono Móvil</label>
                                <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300 focus:bg-white transition-all" value={form.phone || ""} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+56 9 1234 5678" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5"><Calendar size={14} className="text-indigo-500"/> Fecha de Nacimiento</label>
                                <input type="date" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300 focus:bg-white transition-all" value={form.fechaNacimiento?.split('T')[0] || ""} onChange={e => setForm({...form, fechaNacimiento: e.target.value})} />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5"><Globe size={14} className="text-indigo-500"/> Nacionalidad</label>
                                <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300 focus:bg-white transition-all" value={form.nacionalidad || ""} onChange={e => setForm({...form, nacionalidad: e.target.value})} />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5"><Waypoints size={14} className="text-indigo-500"/> Género Registrado</label>
                                <div className="relative">
                                    <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-600 outline-none focus:border-indigo-300 focus:bg-white transition-all appearance-none cursor-pointer" value={form.gender || ""} onChange={e => setForm({...form, gender: e.target.value})}>
                                        <option value="MASCULINO">MASCULINO</option>
                                        <option value="FEMENINO">FEMENINO</option>
                                        <option value="OTRO">OTRO</option>
                                        <option value="NO INFORMADO">NO INFORMADO</option>
                                    </select>
                                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5"><Heart size={14} className="text-rose-500"/> Estado Civil</label>
                                <div className="relative">
                                    <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-600 outline-none focus:border-indigo-300 focus:bg-white transition-all appearance-none cursor-pointer" value={form.estadoCivil || ""} onChange={e => setForm({...form, estadoCivil: e.target.value})}>
                                        <option value="">SELECCIONAR...</option>
                                        <option value="SOLTERO/A">SOLTERO/A</option>
                                        <option value="CASADO/A">CASADO/A</option>
                                        <option value="DIVORCIADO/A">DIVORCIADO/A</option>
                                        <option value="VIUDO/A">VIUDO/A</option>
                                        <option value="UNIÓN CIVIL">UNIÓN CIVIL</option>
                                    </select>
                                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5">Lugar de Nacimiento</label>
                                <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300" value={form.birthPlace || ""} onChange={e => setForm({...form, birthPlace: e.target.value.toUpperCase()})} placeholder="EJ: SANTIAGO, CHILE" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5">Vencimiento Cédula</label>
                                <input type="date" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300" value={form.idExpiryDate?.split('T')[0] || ""} onChange={e => setForm({...form, idExpiryDate: e.target.value})} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'residencia' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="md:col-span-2 space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5"><MapPin size={14} className="text-indigo-500"/> Dirección Completa (Referencia)</label>
                                <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300 focus:bg-white transition-all" value={form.address || ""} onChange={e => setForm({...form, address: e.target.value})} placeholder="Ej: Av. Nueva Providencia 1234, Depto 102" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Calle / Pasaje</label>
                                <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold text-slate-600 outline-none" value={form.calle || ""} onChange={e => setForm({...form, calle: e.target.value.toUpperCase()})} placeholder="EJ: AV. LAS REJAS" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Número</label>
                                    <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold text-slate-600 outline-none" value={form.numero || ""} onChange={e => setForm({...form, numero: e.target.value})} placeholder="1234" />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Depto/Block</label>
                                    <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold text-slate-600 outline-none" value={form.deptoBlock || ""} onChange={e => setForm({...form, deptoBlock: e.target.value.toUpperCase()})} placeholder="101-A" />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Región Administrativa</label>
                                <div className="relative">
                                    <select 
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-600 outline-none focus:border-indigo-300 appearance-none" 
                                        value={form.region || ""} 
                                        onChange={e => setForm({...form, region: e.target.value, comuna: ''})}
                                    >
                                        <option value="">SELECCIONAR REGIÓN...</option>
                                        {REGIONES_CHILE.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Comuna / Distrito</label>
                                <div className="relative">
                                    <select 
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-600 outline-none focus:border-indigo-300 appearance-none" 
                                        value={form.comuna || ""} 
                                        onChange={e => setForm({...form, comuna: e.target.value})}
                                        disabled={!form.region}
                                    >
                                        <option value="">SELECCIONAR COMUNA...</option>
                                        {(REGIONES_CHILE.find(r => r.name === form.region)?.comunas || []).map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                                </div>
                            </div>
                            
                            <div className="md:col-span-2 pt-12 border-t border-slate-100 mt-4">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center">
                                        <Heart size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Contacto de Seguridad</h3>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Protocolo de emergencia 24/7</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5"><User size={14}/> Nombre Completo</label>
                                        <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300 focus:bg-white transition-all" value={form.emergencyContact || ""} onChange={e => setForm({...form, emergencyContact: e.target.value.toUpperCase()})} />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5"><Phone size={14}/> Teléfono Prioritario</label>
                                        <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300 focus:bg-white transition-all" value={form.emergencyPhone || ""} onChange={e => setForm({...form, emergencyPhone: e.target.value})} />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5"><Mail size={14}/> Email Emergencia</label>
                                        <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300 transition-all" value={form.emergencyEmail || ""} onChange={e => setForm({...form, emergencyEmail: e.target.value.toLowerCase()})} placeholder="ejemplo@emergencia.com" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'financiero' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5"><ShieldCheck size={14} className="text-emerald-500"/> Sistema de Salud</label>
                                    <div className="relative">
                                        <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-600 outline-none focus:border-emerald-300 focus:bg-white transition-all appearance-none cursor-pointer" value={form.previsionSalud || ""} onChange={e => setForm({...form, previsionSalud: e.target.value})}>
                                        <option value="FONASA">FONASA</option>
                                        <option value="ISAPRE">ISAPRE</option>
                                    </select>
                                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                                </div>
                            {form.previsionSalud === 'ISAPRE' && (
                                <div className="space-y-6 animate-in zoom-in-95 md:col-span-2 bg-indigo-50/30 p-8 rounded-[2rem] border border-indigo-100/50 mb-4">
                                    <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-4">Detalle Plan Isapre</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Institución</label>
                                            <select 
                                                className="w-full bg-white border-2 border-indigo-100 rounded-xl px-5 py-3 text-xs font-bold text-slate-600 outline-none"
                                                value={form.isapreNombre || ""} 
                                                onChange={e => setForm({...form, isapreNombre: e.target.value})}
                                            >
                                                <option value="">SELECCIONAR ISAPRE...</option>
                                                {ISAPRES.map(i => <option key={i} value={i}>{i}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Valor Plan</label>
                                            <input 
                                                type="number" 
                                                className="w-full bg-white border-2 border-indigo-100 rounded-xl px-5 py-3 text-xs font-black text-indigo-600 outline-none"
                                                value={form.valorPlan || ""} 
                                                onChange={e => setForm({...form, valorPlan: e.target.value})}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Moneda</label>
                                            <select 
                                                className="w-full bg-white border-2 border-indigo-100 rounded-xl px-5 py-3 text-xs font-bold text-slate-600 outline-none"
                                                value={form.monedaPlan || ""} 
                                                onChange={e => setForm({...form, monedaPlan: e.target.value})}
                                            >
                                                <option value="UF">UF</option>
                                                <option value="PESOS">PESOS ($)</option>
                                                <option value="%">% LEGAL (7%)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5"><Award size={14} className="text-indigo-500"/> Fondo de Pensiones (AFP)</label>
                                <div className="relative">
                                    <select 
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-600 outline-none focus:border-indigo-300 appearance-none" 
                                        value={form.afp || ""} 
                                        onChange={e => setForm({...form, afp: e.target.value})}
                                    >
                                        <option value="">SELECCIONAR AFP...</option>
                                        {AFPS.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                                </div>
                            </div>
                             <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5"><DollarSign size={14} className="text-emerald-500"/> Sueldo Base Legislado</label>
                                <input type="number" className="w-full bg-emerald-50/10 border-2 border-emerald-100 rounded-2xl px-7 py-5 text-sm font-black text-emerald-700 outline-none focus:border-emerald-300 focus:bg-white transition-all font-mono" value={form.sueldoBase || ""} onChange={e => setForm({...form, sueldoBase: e.target.value})} placeholder="0" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Bonos Extra Permanente</label>
                                <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300" value={form.cantidadBonosExtraPermanentes || ""} onChange={e => setForm({...form, cantidadBonosExtraPermanentes: e.target.value})} />
                            </div>

                            <div className="md:col-span-2 pt-10 border-t border-slate-100">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8">Salud & Ficha Médica</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Grupo Sanguíneo</label>
                                        <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold text-slate-600 outline-none" value={form.bloodType || ""} onChange={e => setForm({...form, bloodType: e.target.value.toUpperCase()})} placeholder="Ej: O+" />
                                    </div>
                                    <div className="md:col-span-3 space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Alergias Conocidas</label>
                                        <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold text-slate-600 outline-none" value={form.allergies || ""} onChange={e => setForm({...form, allergies: e.target.value.toUpperCase()})} placeholder="Ej: Penicilina, Polvo..." />
                                    </div>
                                    <div className="md:col-span-4 space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Enfermedades Crónicas / Medicación</label>
                                        <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold text-slate-600 outline-none" value={form.chronicDiseases || ""} onChange={e => setForm({...form, chronicDiseases: e.target.value.toUpperCase()})} placeholder="Ej: Diabetes Tipo 2..." />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Tiene Cargas</label>
                                        <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold text-slate-600 outline-none" value={form.tieneCargas || ""} onChange={e => setForm({...form, tieneCargas: e.target.value})}>
                                            <option value="NO">NO</option>
                                            <option value="SÍ">SÍ</option>
                                        </select>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Cant. Cargas</label>
                                        <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold text-slate-600 outline-none" value={form.cantidadCargasLimitadas || ""} onChange={e => setForm({...form, cantidadCargasLimitadas: e.target.value})} />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Pensionado</label>
                                        <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold text-slate-600 outline-none" value={form.pensionado || ""} onChange={e => setForm({...form, pensionado: e.target.value})}>
                                            <option value="NO">NO</option>
                                            <option value="SÍ">SÍ</option>
                                        </select>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Discapacidad</label>
                                        <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold text-slate-600 outline-none" value={form.tieneDiscapacidad || ""} onChange={e => setForm({...form, tieneDiscapacidad: e.target.value})}>
                                            <option value="NO">NO</option>
                                            <option value="SÍ">SÍ</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-2 pt-12 border-t border-slate-100 mt-4">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center">
                                        <Landmark size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Depósito de Haberes</h3>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Información de cuenta bancaria titular</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5">Banco</label>
                                        <div className="relative">
                                            <select 
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-600 outline-none focus:border-indigo-300 appearance-none" 
                                                value={form.banco || ""} 
                                                onChange={e => setForm({...form, banco: e.target.value})}
                                            >
                                                <option value="">SELECCIONAR BANCO...</option>
                                                {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                                            </select>
                                            <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5">Tipo Cuenta</label>
                                        <select 
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-600 outline-none focus:border-indigo-300" 
                                            value={form.tipoCuenta || ""} 
                                            onChange={e => setForm({...form, tipoCuenta: e.target.value})}
                                        >
                                            <option value="">SELECCIONAR TIPO...</option>
                                            <option value="CUENTA RUT">CUENTA RUT</option>
                                            <option value="VISTA">VISTA</option>
                                            <option value="CORRIENTE">CORRIENTE</option>
                                            <option value="AHORRO">AHORRO</option>
                                        </select>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5">N° Cuenta</label>
                                        <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-black text-slate-700 outline-none focus:border-indigo-300 focus:bg-white transition-all font-mono" value={form.numeroCuenta || ""} onChange={e => setForm({...form, numeroCuenta: e.target.value})} placeholder="0000000000" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                    )}

                    {activeTab === 'dotacion' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-16">
                                {[
                                    { label: 'Talla Camisa', field: 'shirtSize', icon: Shirt, placeholder: 'S, M, L...' },
                                    { label: 'Talla Pantalón', field: 'pantsSize', icon: Shirt, placeholder: '42, 44...' },
                                    { label: 'Talla Calzado', field: 'shoeSize', icon: Truck, placeholder: '40, 41...' },
                                    { label: 'Talla Parka', field: 'jacketSize', icon: ShieldCheck, placeholder: 'M, L, XL...' },
                                    { label: 'Talla Overol', field: 'uniformSize', icon: ShieldCheck, placeholder: '48, 50, 52...' },
                                    { label: 'Talla Guantes', field: 'tallaGuantes', icon: ShieldCheck, placeholder: 'S, M, L...' },
                                ].map((t, idx) => (
                                    <div key={idx} className="space-y-3">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5">
                                            <t.icon size={12} className="text-orange-500"/> {t.label}
                                        </label>
                                        <input 
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-xs font-black text-slate-700 outline-none focus:border-orange-300 focus:bg-white transition-all text-center" 
                                            value={form[t.field] || ""} 
                                            onChange={e => setForm({...form, [t.field]: e.target.value.toUpperCase()})} 
                                            placeholder={t.placeholder} 
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="md:col-span-2 pt-10 border-t border-slate-100 mt-10">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8">Licencias & Educación</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Requiere Licencia</label>
                                        <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold text-slate-600 outline-none" value={form.requiresLicence || ""} onChange={e => setForm({...form, requiresLicence: e.target.value})}>
                                            <option value="NO">NO</option>
                                            <option value="SÍ">SÍ</option>
                                        </select>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Vencimiento Licencia</label>
                                        <input type="date" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold text-slate-600 outline-none" value={form.licenceExpiryDate?.split('T')[0] || ""} onChange={e => setForm({...form, licenceExpiryDate: e.target.value})} />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Nivel Educacional</label>
                                        <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold text-slate-600 outline-none" value={form.educationLevel || ""} onChange={e => setForm({...form, educationLevel: e.target.value.toUpperCase()})} placeholder="Ej: UNIVERSITARIO, TÉCNICO..." />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                        {activeTab === 'expediente' && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="flex items-center gap-4 mb-10 pt-10 border-t border-slate-100">
                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                                    <Upload size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mb-2">Cloudinary Integration</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Almacenamiento multimedia escalable en la nube</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Retrato de Perfil (Avatar)</label>
                                    <div className="group relative flex items-center gap-8 p-8 bg-white border-4 border-dashed border-slate-100 rounded-[2.5rem] hover:border-indigo-400/40 hover:bg-slate-50/50 transition-all duration-500">
                                        <div className="relative w-28 h-28 rounded-3xl bg-slate-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-xl">
                                            {form.profilePic ? (
                                                <img src={form.profilePic} className="w-full h-full object-cover" alt="Profile" />
                                            ) : (
                                                <User size={32} className="text-slate-300" />
                                            )}
                                            {saving && <div className="absolute inset-0 bg-indigo-600/40 backdrop-blur-sm flex items-center justify-center"><Loader2 className="text-white animate-spin" /></div>}
                                        </div>
                                        <div className="flex-1 space-y-4">
                                            <p className="text-[9px] font-bold text-slate-400 leading-relaxed uppercase tracking-wider">Formatos: JPG, PNG. Máx 2MB.<br/>Fondo neutro preferiblemente.</p>
                                            <input type="file" id="pic-upload" hidden onChange={e => e.target.files[0] && handleFileUpload('profile', e.target.files[0])} accept="image/*" />
                                            <label 
                                                htmlFor="pic-upload" 
                                                className={`inline-flex items-center gap-3 px-6 py-3.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-indigo-600 hover:shadow-xl hover:shadow-indigo-100 active:scale-95 transition-all ${!editId ? 'opacity-50 grayscale' : ''}`}
                                            >
                                                <Camera size={14} /> {form.profilePic ? 'Reemplazar Foto' : 'Subir Imagen'}
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Historial Académico / CV</label>
                                    <div className="group relative flex items-center gap-8 p-8 bg-white border-4 border-dashed border-slate-100 rounded-[2.5rem] hover:border-emerald-400/40 hover:bg-slate-50/50 transition-all duration-500">
                                        <div className="relative w-28 h-28 rounded-3xl bg-slate-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-xl">
                                            <FileText size={32} className={form.cvUrl ? "text-emerald-500" : "text-slate-300"} />
                                            {saving && <div className="absolute inset-0 bg-emerald-600/40 backdrop-blur-sm flex items-center justify-center"><Loader2 className="text-white animate-spin" /></div>}
                                        </div>
                                        <div className="flex-1 space-y-4">
                                            <p className="text-[9px] font-bold text-slate-400 leading-relaxed uppercase tracking-wider">Formatos: PDF prioritario.<br/>Máximo 5MB por archivo.</p>
                                            <input type="file" id="cv-upload" hidden onChange={e => e.target.files[0] && handleFileUpload('cv', e.target.files[0])} accept=".pdf,.doc,.docx" />
                                            <label 
                                                htmlFor="cv-upload" 
                                                className={`inline-flex items-center gap-3 px-6 py-3.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-emerald-600 hover:shadow-xl hover:shadow-emerald-100 active:scale-95 transition-all ${!editId ? 'opacity-50 grayscale' : ''}`}
                                            >
                                                <Upload size={14} /> {form.cvUrl ? 'Actualizar CV' : 'Vincular PDF'}
                                            </label>
                                            {form.cvUrl && (
                                                <a href={form.cvUrl} target="_blank" rel="noreferrer" className="block text-[9px] font-black text-emerald-600 hover:underline tracking-widest uppercase">Visualizar Documento →</a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {!editId && (
                                <div className="mt-10 p-6 bg-amber-50 border-2 border-amber-100 rounded-[2rem] flex items-center gap-4 animate-pulse">
                                    <AlertCircle className="text-amber-500" size={24} />
                                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest leading-relaxed">
                                        Nota: Por seguridad, los archivos deben subirse después de registrar los datos básicos. <br/>
                                        Guarde el perfil y luego use la opción de editar para activar Cloudinary.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'seguimiento' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="md:col-span-2 space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Situación Laboral en Entrevista</label>
                                    <textarea 
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-700 outline-none focus:border-rose-300 transition-all min-h-[100px]" 
                                        value={form.situacionLaboralEntrevista || ""} 
                                        onChange={e => setForm({...form, situacionLaboralEntrevista: e.target.value})}
                                        placeholder="Detalle la situación actual del candidato al momento de la entrevista..."
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Declara Conflicto de Interés</label>
                                    <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-600 outline-none" value={form.declaraConflictoInteres || ""} onChange={e => setForm({...form, declaraConflictoInteres: e.target.value})}>
                                        <option value="NO">NO DECLARA CONFLICTOS</option>
                                        <option value="SÍ">SÍ DECLARA CONFLICTOS</option>
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Fecha Efectiva de Inicio</label>
                                    <input type="date" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-700 outline-none" value={form.operationalStartDate?.split('T')[0] || ""} onChange={e => setForm({...form, operationalStartDate: e.target.value})} />
                                </div>

                                <div className="md:col-span-2 pt-12 border-t border-slate-100 mt-10">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center">
                                            <UserX size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Cierre de Expediente / Finiquito</h3>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Información de salida y desvinculación</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Fecha Finiquito</label>
                                            <input type="date" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-700 outline-none" value={form.fechaFiniquito?.split('T')[0] || ""} onChange={e => setForm({...form, fechaFiniquito: e.target.value})} />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Motivo Finiquito</label>
                                            <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-7 py-5 text-sm font-bold text-slate-700 outline-none" value={form.motivoFiniquito || ""} onChange={e => setForm({...form, motivoFiniquito: e.target.value.toUpperCase()})} placeholder="EJ: RENUNCIA VOLUNTARIA, TÉRMINO DE OBRA..." />
                                        </div>
                                        <div className="md:col-span-2 pt-8 border-t border-slate-50 mt-4">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="w-10 h-10 bg-cyan-50 text-cyan-500 rounded-xl flex items-center justify-center">
                                                    <Calendar size={20} />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Hito Operativo Final</h3>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Fecha en que el recurso comienza a producir</p>
                                                </div>
                                            </div>
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><CheckCircle2 size={12} className="text-cyan-500"/> Fecha Operativa de Activación</label>
                                                    <input type="date" className="w-full bg-cyan-50/20 border-2 border-cyan-100 rounded-2xl px-7 py-5 text-sm font-black text-cyan-700 outline-none focus:border-cyan-300" value={form.operationalStartDate?.split('T')[0] || ""} onChange={e => setForm({...form, operationalStartDate: e.target.value})} />
                                                </div>
                                        </div>
                                    </div>
                                </div>
                        </div>
                    </div>
                    )}
                    </>
                </div>
            </div>

            {/* Footer de Acciones */}
            <div className="px-12 py-10 border-t border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md">
                <div className="hidden md:flex items-center gap-3 text-slate-400">
                    <div className={`w-2.5 h-2.5 rounded-full ${saving ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{saving ? 'Escribiendo en MongoDB...' : 'Sistema Listo'}</span>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <button 
                        onClick={() => { setShowForm(false); setEditId(null); }} 
                        className="flex-1 md:flex-none px-12 py-5 bg-slate-100 text-slate-500 rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={saving} 
                        className="flex-1 md:flex-none px-16 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest shadow-2xl shadow-indigo-200 hover:scale-[1.03] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
                    >
                        {saving ? <Loader2 className="animate-spin" size={18} /> : editId ? 'Actualizar Expediente' : 'Finalizar Registro'}
                    </button>
                </div>
            </div>
        </div>
        </>
    );

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-10 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            {!showForm ? (
                <div className="max-w-[1600px] mx-auto animate-in fade-in duration-700">
                    {renderHeader()}
                    <div className="sticky top-0 z-[100] bg-[#F8FAFC]/90 backdrop-blur-md -mx-4 md:-mx-10 px-4 md:px-10 pt-4">
                        {renderFilters()}
                    </div>
                    {renderStats()}
                    {viewMode === 'grid' ? renderGrid() : renderTable()}
                </div>
            ) : (
                <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-4">
                    <div className="w-full max-w-[1100px]">
                        {renderForm()}
                    </div>
                </div>
            )}

            {selectedCandidato && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-2xl flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300" onClick={() => setSelectedCandidato(null)}>
                    <div className="bg-white rounded-[4rem] shadow-[0_50px_100px_rgba(0,0,0,0.3)] w-full max-w-6xl h-[92vh] overflow-hidden relative" onClick={e => e.stopPropagation()}>
                        <button 
                            onClick={() => setSelectedCandidato(null)}
                            className="absolute top-10 right-10 w-14 h-14 bg-slate-50 text-slate-400 hover:text-slate-800 rounded-2xl flex items-center justify-center z-10 transition-all active:scale-90"
                        >
                            <X size={24} />
                        </button>
                        <div className="h-full overflow-y-auto p-12 md:p-16 custom-scrollbar">
                            <FichaIngresoPremium data={selectedCandidato} />
                        </div>
                    </div>
                </div>
            )}

            {/* Barra de Acciones Masivas Flotante */}
            {selectedIds.length > 0 && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[150] w-full max-w-4xl px-4 animate-in slide-in-from-bottom-10 duration-500">
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 p-5 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex items-center justify-between gap-8">
                        <div className="flex items-center gap-6 pl-4">
                            <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-lg shadow-indigo-500/40">
                                {selectedIds.length}
                            </div>
                            <div>
                                <h4 className="text-white font-black text-sm uppercase tracking-widest">Seleccionados</h4>
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Acción Masiva en Progreso</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 flex-1 max-w-lg">
                            <select 
                                value={bulkStatus}
                                onChange={e => setBulkStatus(e.target.value)}
                                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-[11px] font-black text-white uppercase tracking-wider outline-none focus:bg-white/10 transition-all appearance-none cursor-pointer"
                            >
                                <option value="" className="text-slate-950">CAMBIAR ESTADO A...</option>
                                {STATUSES.map(s => <option key={s} value={s} className="text-slate-950">{s === 'ACTIVO' ? 'ACTIVO' : s.toUpperCase()}</option>)}
                            </select>
                            
                            <button 
                                onClick={handleBulkStatusUpdate}
                                disabled={!bulkStatus || isBulkUpdating}
                                className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:scale-[1.03] active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50 disabled:grayscale"
                            >
                                {isBulkUpdating ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                                {isBulkUpdating ? 'PROCESANDO...' : 'APLICAR CAMBIO'}
                            </button>

                            <div className="w-px h-10 bg-white/10" />

                            <button 
                                onClick={() => setSelectedIds([])}
                                className="w-12 h-12 flex items-center justify-center bg-white/5 text-white/40 hover:text-white hover:bg-white/10 rounded-2xl transition-all"
                                title="Cancelar Selección"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Action Menu Popover */}
            {actionMenu && (
                <>
                    <div className="fixed inset-0 z-[200]" onClick={() => setActionMenu(null)} />
                    <div 
                        className="fixed z-[201] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-2 w-72 animate-in fade-in zoom-in-95 duration-200"
                        style={{ top: actionMenu.y, left: actionMenu.x }}
                    >
                        <div className="px-4 py-2 border-b border-white/5 mb-1">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">{actionMenu.clientTitle}</p>
                        </div>
                        <button 
                            onClick={() => {
                                handleDashboardFilter(actionMenu.statusId, actionMenu.type === 'project' ? actionMenu.clientTitle : 'ALL', actionMenu.type === 'cargo' ? actionMenu.clientTitle : 'ALL', actionMenu.type === 'client' ? actionMenu.clientTitle : 'ALL');
                                setActionMenu(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-xl transition-all group"
                        >
                            <LayoutList size={16} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Ver Información en Tabla</span>
                        </button>
                        <button 
                            onClick={() => {
                                setCoverageData(calculateCoverage(actionMenu.clientTitle));
                                setShowCoverageModal(true);
                                setActionMenu(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-xl transition-all group"
                        >
                            <Target size={16} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Resumen Requerido vs Real</span>
                        </button>
                    </div>
                </>
            )}

            {/* Coverage Modal */}
            {showCoverageModal && coverageData && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowCoverageModal(false)} />
                    <div className="relative bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 flex flex-col max-h-[85vh]">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-8 flex items-center justify-between shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                                <Target size={120} className="text-white" />
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-1">Control de Cobertura</h3>
                                <p className="text-indigo-300 text-[10px] font-black uppercase tracking-[0.3em]">{coverageData.title}</p>
                            </div>
                            <button onClick={() => setShowCoverageModal(false)} className="w-12 h-12 flex items-center justify-center bg-white/10 text-white hover:bg-white/20 rounded-2xl transition-all relative z-10">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                            {/* Tab Switcher */}
                            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8 w-fit mx-auto shadow-inner">
                                <button 
                                    onClick={() => setCoverageMode('cargo')}
                                    className={`px-8 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${coverageMode === 'cargo' ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Por Cargo
                                </button>
                                <button 
                                    onClick={() => setCoverageMode('project')}
                                    className={`px-8 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${coverageMode === 'project' ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Por Proyecto
                                </button>
                            </div>

                            <div className="space-y-6">
                                {coverageMode === 'cargo' ? (
                                    coverageData.cargoDetails.length > 0 ? (
                                        coverageData.cargoDetails.map((item, idx) => (
                                            <div key={idx} className="bg-slate-50 rounded-3xl p-6 border border-slate-200 hover:border-indigo-200 hover:bg-white transition-all group shadow-sm hover:shadow-xl">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-md border border-slate-100 group-hover:scale-110 transition-transform">
                                                            <Activity className="text-indigo-600" size={20} />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{item.cargo}</h4>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Dotación Requerida vs Activos</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-2xl font-black text-slate-900">{item.recruited} <span className="text-slate-300 text-sm">/ {item.required}</span></div>
                                                        <div className={`text-[10px] font-black uppercase ${item.percent >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                            {item.percent}% Cobertura
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                                                    <div 
                                                        className={`h-full rounded-full shadow-lg transition-all duration-1000 ${item.percent >= 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-indigo-500 to-violet-600'}`}
                                                        style={{ width: `${Math.min(item.percent, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 italic">
                                            <Target size={48} className="mb-4 opacity-20" />
                                            <p>No se encontraron cargos requeridos.</p>
                                        </div>
                                    )
                                ) : (
                                    coverageData.projectDetails.length > 0 ? (
                                        coverageData.projectDetails.map((proj, idx) => (
                                            <div key={idx} className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm hover:shadow-2xl transition-all group mb-8">
                                                <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                                                            <FolderKanban size={20} />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{proj.projectName}</h4>
                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Resumen General del Proyecto</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xl font-black text-indigo-700">{proj.recruited} / {proj.required} <span className="text-[10px] ml-2 px-3 py-1 bg-indigo-50 rounded-full uppercase">{proj.percent}%</span></div>
                                                    </div>
                                                </div>
                                                <div className="p-6 space-y-4">
                                                    {proj.details.map((d, dIdx) => (
                                                        <div key={dIdx} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-transparent hover:border-slate-200 transition-all">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{d.cargo}</span>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase">REQUERIDO: {d.required}</span>
                                                                <div className="w-px h-3 bg-slate-200" />
                                                                <span className="text-[10px] font-black text-emerald-600 uppercase">ACTIVOS: {d.recruited}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="px-6 pb-6">
                                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-all duration-1000"
                                                            style={{ width: `${proj.percent}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 italic">
                                            <FolderKanban size={48} className="mb-4 opacity-20" />
                                            <p>No se encontraron proyectos vinculados.</p>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-between items-center px-10">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sincronizado con Módulo Proyectos</span>
                            </div>
                            <button onClick={() => setShowCoverageModal(false)} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Cerrar Reporte</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-6 right-6 z-[999] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border text-sm font-black uppercase tracking-widest transition-all animate-in slide-in-from-top-4 duration-300 ${
                    toast.type === 'error'
                        ? 'bg-rose-950/90 border-rose-500/30 text-rose-200'
                        : 'bg-slate-900/90 border-white/10 text-white'
                }`}>
                    <span className="text-base">{toast.type === 'error' ? '❌' : '✅'}</span>
                    <span>{toast.msg.replace(/^[✅❌]\s*/, '')}</span>
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}} />
        </div>
    );
};

export default CapturaTalento;

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../auth/AuthContext';
import {
    UserPlus, Search, Loader2, Users, ChevronDown, X, CheckCircle2,
    Clock, Edit3, Eye, GraduationCap, Briefcase, ChevronLeft,
    AlertCircle, Plus, Globe, Mail, Phone, MapPin, Building2,
    Heart, Landmark, CreditCard, DollarSign, Award, Truck, ShieldCheck, Activity,
    User, Calendar, FileText, Download, Upload, Printer, Hash,
    HelpCircle, Info, ChevronRight, UserCheck, MessageCircle,
    FolderKanban, BarChart3, UserX, Waypoints, Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { candidatosApi, proyectosApi, configApi, empresasApi } from '../rrhhApi';
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
    'Contratado': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Rechazado': 'bg-rose-50 text-rose-600 border-rose-200',
    'Retirado': 'bg-slate-50 text-slate-500 border-slate-200',
    'Finiquitado': 'bg-slate-100 text-slate-500 border-slate-300',
};

const STATUSES = ['En Postulación', 'En Entrevista', 'En Evaluación', 'En Acreditación', 'En Documentación', 'Aprobado', 'Contratado', 'Rechazado', 'Retirado', 'Finiquitado'];

// --- LISTAS MAESTRAS ---
const AFPS = ["CAPITAL", "CUPRUM", "HABITAT", "MODELO", "PLANVITAL", "PROVIDA", "UNO"];
const ISAPRES = ["FONASA", "BANMEDICA", "COLMENA", "CONSALUD", "CRUZ BLANCA", "NUEVA MASVIDA", "VIDA TRES"];
const ESTADO_CIVIL = ["SOLTERO", "CASADO", "DIVORCIADO", "VIUDO", "CONVIVIENTE CIVIL"];
const BANCOS = [
    "BANCO ESTADO", "BANCO DE CHILE", "SANTANDER", "BCI", "SCOTIABANK", "ITAÚ",
    "FALABELLA", "RIPLEY", "CONSORCIO", "SECURITY", "INTERNACIONAL", "BICE",
    "MERCADO PAGO", "TENPO", "MACH", "COPEC PAY", "TAPP (LOS ANDES)", "PREPAGO LOS HÉROES"
];
const TIPOS_CUENTA = ["CUENTA CORRIENTE", "CUENTA VISTA / RUT", "AHORRO"];
const TIPOS_CONTRATO = ["PLAZO FIJO", "INDEFINIDO", "POR OBRA O FAENA", "HONORARIOS"];
const TIPOS_BONOS = [
    { type: 'Movilización', isImponible: false, description: 'No imponible. Compensación por gastos de traslado.' },
    { type: 'Colación', isImponible: false, description: 'No imponible. Compensación por gastos de alimentación.' },
    { type: 'Responsabilidad', isImponible: true, description: 'Imponible. Por cargo o funciones específicas.' },
    { type: 'Puntualidad', isImponible: true, description: 'Imponible. Por cumplimiento de horarios.' },
    { type: 'Antigüedad', isImponible: true, description: 'Imponible. Por tiempo de permanencia.' },
    { type: 'Metas / Productividad', isImponible: true, description: 'Imponible. Por cumplimiento de objetivos.' },
    { type: 'Asignación de Caja', isImponible: false, description: 'No imponible. Para cubrir pérdida de dinero.' },
    { type: 'Asignación de Herramientas / Desgaste', isImponible: false, description: 'No imponible. Por uso de herramientas propias.' },
    { type: 'Viático', isImponible: false, description: 'No imponible. Gastos de alojamiento/alimentación fuera del lugar de trabajo.' },
    { type: 'Bonificación Especial', isImponible: true, description: 'Imponible. Cualquier otro pago por servicios.' }
];
const NIVELES_EDUCACIONALES = [
    "ENSEÑANZA MEDIA COMPLETA",
    "TÉCNICO NIVEL MEDIO",
    "TÉCNICO NIVEL SUPERIOR",
    "UNIVERSITARIO INCOMPLETO",
    "UNIVERSITARIO COMPLETO",
    "POSTGRADO / MAGÍSTER / DOCTORADO"
];

const NACIONALIDADES = [
    { label: "Chilena 🇨🇱", value: "Chilena" },
    { label: "Argentina 🇦🇷", value: "Argentina" },
    { label: "Boliviana 🇧🇴", value: "Boliviana" },
    { label: "Brasileña 🇧🇷", value: "Brasileña" },
    { label: "Colombiana 🇨🇴", value: "Colombiana" },
    { label: "Costarricense 🇨🇷", value: "Costarricense" },
    { label: "Cubana 🇨🇺", value: "Cubana" },
    { label: "Ecuatoriana 🇪🇨", value: "Ecuatoriana" },
    { label: "Salvadoreña 🇸🇻", value: "Salvadoreña" },
    { label: "Española 🇪🇸", value: "Española" },
    { label: "Española (Madrid) 🇪🇸", value: "Española (Madrid)" },
    { label: "Española (Barcelona) 🇪🇸", value: "Española (Barcelona)" },
    { label: "Guatemalteca 🇬🇹", value: "Guatemalteca" },
    { label: "Hondureña 🇭🇳", value: "Hondureña" },
    { label: "Mexicana 🇲🇽", value: "Mexicana" },
    { label: "Nicaragüense 🇳🇮", value: "Nicaragüense" },
    { label: "Panameña 🇵🇦", value: "Panameña" },
    { label: "Paraguaya 🇵🇾", value: "Paraguaya" },
    { label: "Peruana 🇵🇪", value: "Peruana" },
    { label: "Puertorriqueña 🇵🇷", value: "Puertorriqueña" },
    { label: "Dominicana 🇩🇴", value: "Dominicana" },
    { label: "Uruguaya 🇺🇾", value: "Uruguaya" },
    { label: "Venezolana 🇻🇪", value: "Venezolana" },
    { label: "Japonesa 🇯🇵", value: "Japonesa" },
    { label: "China 🇨🇳", value: "China" },
    { label: "Estadounidense 🇺🇸", value: "Estadounidense" }
];

const REGIONES_DE_CHILE = [
    { name: "Arica y Parinacota", communes: ["Arica", "Camarones", "Putre", "General Lagos"] },
    { name: "Tarapacá", communes: ["Iquique", "Alto Hospicio", "Pozo Almonte", "Camiña", "Colchane", "Huara", "Pica"] },
    { name: "Antofagasta", communes: ["Antofagasta", "Mejillones", "Sierra Gorda", "Taltal", "Calama", "Ollagüe", "San Pedro de Atacama", "Tocopilla", "María Elena"] },
    { name: "Atacama", communes: ["Copiapó", "Caldera", "Tierra Amarilla", "Chañaral", "Diego de Almagro", "Vallenar", "Alto del Carmen", "Freirina", "Huasco"] },
    { name: "Coquimbo", communes: ["La Serena", "Coquimbo", "Andacollo", "La Higuera", "Paiguano", "Vicuña", "Illapel", "Canela", "Los Vilos", "Salamanca", "Ovalle", "Combarbalá", "Monte Patria", "Punitaqui", "Río Hurtado"] },
    { name: "Valparaíso", communes: ["Valparaíso", "Casablanca", "Concón", "Juan Fernández", "Puchuncaví", "Quintero", "Viña del Mar", "Isla de Pascua", "Los Andes", "Calle Larga", "Rinconada", "San Esteban", "La Ligua", "Cabildo", "Papudo", "Petorca", "Zapallar", "Quillota", "Calera", "Hijuelas", "La Cruz", "Nogales", "San Antonio", "Algarrobo", "Cartagena", "El Quisco", "El Tabo", "Santo Domingo", "San Felipe", "Catemu", "Llaillay", "Panquehue", "Putaendo", "Santa María", "Quilpué", "Villa Alemana"] },
    { name: "Metropolitana de Santiago", communes: ["Santiago", "Cerrillos", "Cerro Navia", "Conchalí", "El Bosque", "Estación Central", "Huechuraba", "Independencia", "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina", "Las Condes", "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul", "Maipú", "Ñuñoa", "Pedro Aguirre Cerda", "Peñalolén", "Providencia", "Pudahuel", "Quilicura", "Quinta Normal", "Recoleta", "Renca", "San Joaquín", "San Miguel", "San Ramón", "Vitacura", "Puente Alto", "Pirque", "San José de Maipo", "Colina", "Lampa", "Tiltil", "San Bernardo", "Buin", "Calera de Tango", "Paine", "Melipilla", "Alhué", "Curacaví", "María Pinto", "San Pedro", "Talagante", "El Monte", "Isla de Maipo", "Padre Hurtado", "Peñaflor"] },
    { name: "O'Higgins", communes: ["Rancagua", "Codegua", "Coinco", "Coltauco", "Doñihue", "Graneros", "Las Cabras", "Machalí", "Malloa", "Mostazal", "Olivar", "Peumo", "Pichidegua", "Quinta de Tilcoco", "Rengo", "Requínoa", "San Vicente", "Pichilemu", "La Estrella", "Litueche", "Marchihue", "Navidad", "Paredones", "San Fernando", "Chépica", "Chimbarongo", "Lolol", "Nancagua", "Palmilla", "Peralillo", "Placilla", "Pumanque", "Santa Cruz"] },
    { name: "Maule", communes: ["Talca", "Constitución", "Curepto", "Empedrado", "Maule", "Pelarco", "Pencahue", "Río Claro", "San Clemente", "San Rafael", "Cauquenes", "Chanco", "Pelluhue", "Curicó", "Hualañé", "Licantén", "Molina", "Rauco", "Romeral", "Sagrada Familia", "Teno", "Vichuquén", "Linares", "Colbún", "Longaví", "Parral", "Retiro", "San Javier", "Villa Alegre", "Yerbas Buenas"] },
    { name: "Ñuble", communes: ["Chillán", "Bulnes", "Cobquecura", "Coelemu", "Coihueco", "Chillán Viejo", "El Carmen", "Ninhue", "Ñiquén", "Pemuco", "Pinto", "Portezuelo", "Quillón", "Quirihue", "Ránquil", "San Carlos", "San Fabián", "San Ignacio", "San Nicolás", "Treguaco", "Yungay"] },
    { name: "Biobío", communes: ["Concepción", "Coronel", "Chiguayante", "Florida", "Hualpén", "Hualqui", "Lota", "Penco", "San Pedro de la Paz", "Talcahuano", "Tomé", "Santa Juana", "Los Ángeles", "Antuco", "Cabrero", "Laja", "Mulchén", "Nacimiento", "Negrete", "Quilaco", "Quilleco", "San Rosendo", "Santa Bárbara", "Tucapel", "Yumbel", "Alto Biobío", "Lebu", "Arauco", "Cañete", "Contulmo", "Curanilahue", "Los Álamos", "Tirúa"] },
    { name: "Araucanía", communes: ["Temuco", "Carahue", "Cunco", "Curarrehue", "Freire", "Galvarino", "Gorbea", "Lautaro", "Loncoche", "Melipeuco", "Nueva Imperial", "Padre Las Casas", "Perquenco", "Pitrufquén", "Pucón", "Saavedra", "Teodoro Schmidt", "Toltén", "Vilcún", "Villarrica", "Cholchol", "Angol", "Collipulli", "Curacautín", "Ercilla", "Lonquimay", "Los Sauces", "Lumaco", "Purén", "Renaico", "Traiguén", "Victoria"] },
    { name: "Los Ríos", communes: ["Valdivia", "Corral", "Lanco", "Los Lagos", "Máfil", "Mariquina", "Paillaco", "Panguipulli", "La Unión", "Futrono", "Lago Ranco", "Río Bueno"] },
    { name: "Los Lagos", communes: ["Puerto Montt", "Calbuco", "Cochamó", "Fresia", "Frutillar", "Los Muermos", "Llanquihue", "Maullín", "Puerto Varas", "Castro", "Ancud", "Chonchi", "Curaco de Vélez", "Dalcahue", "Puqueldón", "Queilén", "Quellón", "Quemchi", "Quinchao", "Osorno", "Puerto Octay", "Purranque", "Puyehue", "Río Negro", "San Juan de la Costa", "San Pablo", "Chaitén", "Futaleufú", "Hualaihué", "Palena"] },
    { name: "Aysén", communes: ["Coyhaique", "Lago Verde", "Aysén", "Cisnes", "Guaitecas", "Cochrane", "O'Higgins", "Tortel", "Chile Chico", "Río Ibáñez"] },
    { name: "Magallanes", communes: ["Punta Arenas", "Laguna Blanca", "Río Verde", "San Gregorio", "Porvenir", "Primavera", "Timaukel", "Puerto Natales", "Torres del Paine", "Cabo de Hornos", "Antártica"] }
];

// --- HELPERS DE VALIDACIÓN ---
const calculateAge = (birthday) => {
    if (!birthday) return null;
    const ageDifMs = Date.now() - new Date(birthday).getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
};

const TABS = [
    { id: 'institucional', label: 'Institucional', icon: Landmark, color: 'amber' },
    { id: 'contacto', label: 'Contacto', icon: MapPin, color: 'sky' },
    { id: 'laboral', label: 'Laboral', icon: FileText, color: 'violet' },
    { id: 'salud', label: 'Salud & Familia', icon: Heart, color: 'rose' },
    { id: 'requisitos', label: 'Requisitos', icon: Truck, color: 'orange' }
];

const initialForm = {
    // 0. Administración y Asignación (Sec 0)
    empresaRef: '',
    projectId: '',
    projectName: '',
    departamento: '',
    area: '',
    ceco: '',
    sede: '',
    position: '',
    isDirectHire: false,
    status: 'En Postulación',
    source: 'Captación Directa',

    // 1. Identidad (Sec 1)
    fullName: '',
    rut: '',
    email: '',
    phone: '',
    fechaNacimiento: '',
    nationality: 'Chilena',
    gender: 'No Informado',
    estadoCivil: '',
    birthPlace: '',
    idExpiryDate: '',
    educationLevel: '',
    profilePic: '',
    cvUrl: '',

    // 2. Domicilio (Sec 2)
    address: '',
    calle: '',
    numero: '',
    deptoBlock: '',
    comuna: '',
    region: '',

    // 3. Contrato (Sec 3)
    contractType: 'PLAZO FIJO',
    contractStartDate: '',
    contractDurationDays: '',
    contractEndDate: '',
    nextAddendumDate: '',
    nextAddendumDescription: '',
    contractStep: 1,

    // 4. Emergencia (Sec 4)
    emergencyContact: '',
    emergencyPhone: '',
    emergencyEmail: '',

    // 5. Previsión y Salud (Sec 5)
    previsionSalud: 'FONASA',
    isapreNombre: '',
    afp: '',
    pensionado: 'NO',
    bloodType: '',
    allergies: '',
    chronicDiseases: '',
    hasDisability: false,
    tieneCargas: 'NO',
    listaCargas: [],

    // 6. Bancario (Sec 6)
    banco: '',
    tipoCuenta: '',
    numeroCuenta: '',

    // 7. Equipamiento (Sec 7)
    shirtSize: '',
    pantsSize: '',
    jacketSize: '',
    shoeSize: '',

    // 8. Remuneración (Sec 8)
    sueldoBase: '',
    bonuses: []
};

const CapturaTalento = () => {
    const { user: currentUser } = useAuth();
    const [candidatos, setCandidatos] = useState([]);
    const [proyectos, setProyectos] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [companyConfig, setCompanyConfig] = useState({ cargos: [], areas: [], cecos: [], departamentos: [], sedes: [], projectTypes: [] });
    const [globalAnalytics, setGlobalAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterCeco, setFilterCeco] = useState('');
    const [filterProyecto, setFilterProyecto] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(initialForm);
    const [editId, setEditId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [selectedCandidato, setSelectedCandidato] = useState(null);
    const [showChoiceModal, setShowChoiceModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [registrationType, setRegistrationType] = useState('postulante');
    const [activeTab, setActiveTab] = useState('institucional');
    const [cargaTemp, setCargaTemp] = useState({ rut: '', nombre: '', parentesco: '' });
    const [bonusTemp, setBonusTemp] = useState({ type: '', amount: '', description: '', isImponible: true });
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [savedCandidate, setSavedCandidate] = useState(null);
    const [showAnalyticsPanel, setShowAnalyticsPanel] = useState(false);

    useEffect(() => {
        fetchAll();
        if (currentUser?.role === 'ceo' || currentUser?.role === 'ceo_genai') {
            fetchCompanies();
        }
    }, [currentUser]);

    const fetchCompanies = async () => {
        try {
            const res = await empresasApi.getAll();
            setCompanies(res.data);
        } catch (e) {
            console.error('Error fetching companies', e);
        }
    };

    useEffect(() => {
        if (form.contractType === 'INDEFINIDO') {
            const updates = {};
            if (form.contractDurationDays !== '') updates.contractDurationDays = '';
            if (form.contractEndDate !== 'SIN TÉRMINO') updates.contractEndDate = 'SIN TÉRMINO';
            if (form.nextAddendumDate !== '') updates.nextAddendumDate = '';
            if (form.nextAddendumDescription !== 'CONTRATO VIGENTE (INDEFINIDO)') updates.nextAddendumDescription = 'CONTRATO VIGENTE (INDEFINIDO)';
            if (form.contractStep !== 3) updates.contractStep = 3;

            if (Object.keys(updates).length > 0) {
                setForm(prev => ({ ...prev, ...updates }));
            }
            return;
        }

        if (form.contractStartDate && form.contractDurationDays) {
            const start = new Date(form.contractStartDate);
            const duration = parseInt(form.contractDurationDays);
            if (!isNaN(duration)) {
                const end = new Date(start);
                end.setDate(end.getDate() + duration);
                const endDateStr = end.toISOString().split('T')[0];

                let nextDesc = '';
                if (form.contractType === 'PLAZO FIJO') {
                    nextDesc = form.contractStep === 1 ? 'SEGUNDO ANEXO PLAZO FIJO' : 'PASE A INDEFINIDO';
                } else {
                    nextDesc = 'REVISIÓN SEGÚN FAENA/HONORARIOS';
                }

                if (form.contractEndDate !== endDateStr || form.nextAddendumDescription !== nextDesc) {
                    setForm(prev => ({
                        ...prev,
                        contractEndDate: endDateStr,
                        nextAddendumDate: endDateStr,
                        nextAddendumDescription: nextDesc
                    }));
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.contractStartDate, form.contractDurationDays, form.contractType, form.contractStep]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [candRes, projRes, configRes, analyticsRes] = await Promise.all([
                candidatosApi.getAll(),
                proyectosApi.getAll(),
                configApi.get(),
                proyectosApi.getAnalyticsGlobal().catch(() => ({ data: null }))
            ]);
            setCandidatos(candRes.data);
            setProyectos(projRes.data);
            setCompanyConfig(configRes.data);
            setGlobalAnalytics(analyticsRes.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleCargaAdd = () => {
        if (cargaTemp.rut && cargaTemp.nombre) {
            setForm(prev => ({ ...prev, listaCargas: [...prev.listaCargas, cargaTemp] }));
            setCargaTemp({ rut: '', nombre: '', parentesco: '' });
        }
    };

    const handleCargaRemove = (idx) => {
        setForm(prev => ({ ...prev, listaCargas: prev.listaCargas.filter((_, i) => i !== idx) }));
    };

    const handleBonusAdd = () => {
        const isGoal = bonusTemp.type === 'Metas / Productividad';
        const isValid = isGoal ? bonusTemp.description : bonusTemp.amount;
        if (bonusTemp.type && isValid) {
            setForm(prev => ({ ...prev, bonuses: [...prev.bonuses, { ...bonusTemp }] }));
            setBonusTemp({ type: '', amount: '', description: '', isImponible: true });
        }
    };

    const handleBonusRemove = (idx) => {
        setForm(prev => ({ ...prev, bonuses: prev.bonuses.filter((_, i) => i !== idx) }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validación de RUT
        if (!validateRut(form.rut)) {
            alert('El RUT ingresado no es válido. Por favor, verifíquelo.');
            return;
        }

        setSaving(true);
        try {
            const data = { ...form };
            let res;
            if (editId) {
                res = await candidatosApi.update(editId, data);
                setSavedCandidate({ ...data, id: editId });
            } else {
                res = await candidatosApi.create(data);
                setSavedCandidate(res);
            }
            setShowSuccessModal(true);
            fetchAll();
        } catch (e) {
            alert(e.response?.data?.message || 'Error al guardar');
        } finally { setSaving(false); }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setForm(prev => ({ ...prev, profilePic: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCVChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setForm(prev => ({ ...prev, cvUrl: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleEdit = (c) => {
        setForm({
            fullName: c.fullName,
            rut: c.rut,
            email: c.email || '',
            phone: c.phone || '',
            address: c.address || '',
            ceco: c.ceco || '',
            area: c.area || '',
            sede: c.sede || '',
            projectId: typeof c.projectId === 'object' ? (c.projectId?._id || '') : (c.projectId || ''),
            projectName: c.projectName || '',
            position: c.position || '',
            departamento: c.departamento || '',
            empresaRef: typeof c.empresaRef === 'object' ? (c.empresaRef?._id || '') : (c.empresaRef || ''),
            educationLevel: c.educationLevel || '',
            status: c.status,
            source: c.source || 'Captación Directa',
            nationality: c.nationality || 'Chilena',
            birthPlace: c.birthPlace || '',
            idExpiryDate: c.idExpiryDate ? new Date(c.idExpiryDate).toISOString().split('T')[0] : '',
            cvUrl: c.cvUrl || '',
            emergencyContact: c.emergencyContact || '',
            emergencyPhone: c.emergencyPhone || '',
            emergencyEmail: c.emergencyEmail || '',
            conflictOfInterest: c.conflictOfInterest || initialForm.conflictOfInterest,
            currentWorkSituation: c.currentWorkSituation || '',
            isDirectHire: c.isDirectHire || false,
            // Información del Contrato
            contractType: c.contractType || 'PLAZO FIJO',
            contractStartDate: c.contractStartDate ? new Date(c.contractStartDate).toISOString().split('T')[0] : '',
            contractDurationDays: c.contractDurationDays || '',
            contractEndDate: c.contractEndDate ? new Date(c.contractEndDate).toISOString().split('T')[0] : '',
            nextAddendumDate: c.nextAddendumDate ? new Date(c.nextAddendumDate).toISOString().split('T')[0] : '',
            nextAddendumDescription: c.nextAddendumDescription || '',
            contractStep: c.contractStep || 1,
            // Nuevos campos unificados
            gender: c.gender || 'No Informado',
            fechaNacimiento: c.fechaNacimiento ? new Date(c.fechaNacimiento).toISOString().split('T')[0] : '',
            estadoCivil: c.estadoCivil || '',
            calle: c.calle || '',
            numero: c.numero || '',
            deptoBlock: c.deptoBlock || '',
            comuna: c.comuna || '',
            region: c.region || '',
            previsionSalud: c.previsionSalud || 'FONASA',
            isapreNombre: c.isapreNombre || '',
            valorPlan: c.valorPlan || '',
            monedaPlan: c.monedaPlan || 'UF',
            afp: c.afp || '',
            pensionado: c.pensionado || 'NO',
            bloodType: c.bloodType || '',
            allergies: c.allergies || '',
            chronicDiseases: c.chronicDiseases || '',
            hasDisability: c.hasDisability || false,
            disabilityType: c.disabilityType || '',
            tieneCargas: c.tieneCargas || 'NO',
            listaCargas: c.listaCargas || [],
            banco: c.banco || '',
            tipoCuenta: c.tipoCuenta || '',
            numeroCuenta: c.numeroCuenta || '',
            sueldoBase: c.sueldoBase || '',
            bonuses: c.bonuses || [],
            requiereLicencia: c.requiereLicencia || 'NO',
            fechaVencimientoLicencia: c.fechaVencimientoLicencia || '',
            shirtSize: c.shirtSize || '',
            pantsSize: c.pantsSize || '',
            jacketSize: c.jacketSize || '',
            shoeSize: c.shoeSize || '',
            profilePic: c.profilePic || ''
        });
        setEditId(c._id);
        setRegistrationType(c.status === 'Contratado' ? 'colaborador' : 'postulante');
        setShowForm(true);
    };

    const handleDownloadTemplate = () => {
        const headers = [
            "Nombre Completo", "RUT", "Email", "Telefono", "Nacionalidad", "Lugar Nacimiento", "F. Nacimiento",
            "Género", "Estado Civil", "Vencimiento Cedula", "Direccion", "Comuna", "Region", "CECO", "Area", "Sede",
            "Cargo", "Nivel Educativo", "Tipo Contrato", "F. Inicio Contrato", "Duracion Días",
            "Prevision Salud", "Valor Plan Salud", "Moneda Plan", "AFP", "Tiene Cargas", "Banco", "Tipo Cuenta", "N. Cuenta", "Sueldo Base",
            "Contacto Emergencia", "Telefono Emergencia", "Talla Camisa", "Talla Pantalon",
            "Talla Poleron/Chaqueta", "Talla Calzado",
            "Requiere Licencia", "Vencimiento Licencia", "Discapacidad", "Tipo Discapacidad"
        ];

        const worksheet = XLSX.utils.aoa_to_sheet([headers]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla");

        // Add dynamic help sheet for dropdowns
        const helpHeaders = ["Campo", "Opciones Permitidas (Copiar exactamente)"];
        const helpData = [
            ["Nacionalidad", NACIONALIDADES.map(n => n.value).join(", ")],
            ["Estado Civil", ESTADO_CIVIL.join(", ")],
            ["Género", "Masculino, Femenino, No Binario, No Informado"],
            ["Nivel Educativo", NIVELES_EDUCACIONALES.join(", ")],
            ["Región", REGIONES_DE_CHILE.map(r => r.name).join(", ")],
            ["CECO", companyConfig.cecos?.map(c => typeof c === 'string' ? c : c.nombre).join(", ") || "—"],
            ["Area", companyConfig.areas?.map(a => typeof a === 'string' ? a : a.nombre).join(", ") || "—"],
            ["Sede", companyConfig.sedes?.map(d => typeof d === 'string' ? d : d.nombre).join(", ") || "—"],
            ["Cargo", companyConfig.cargos?.map(c => typeof c === 'string' ? c : c.nombre).join(", ") || "—"],
            ["Tipo Contrato", TIPOS_CONTRATO.join(", ")],
            ["Prevision Salud", ISAPRES.join(", ")],
            ["Moneda Plan", "UF, CLP"],
            ["Tiene Cargas", "SI, NO"],
            ["AFP", AFPS.join(", ")],
            ["Banco", BANCOS.join(", ")],
            ["Tipo Cuenta", TIPOS_CUENTA.join(", ")],
            ["Tallas", "S, M, L, XL, XXL / 38, 40, 42..."],
            ["Requiere Licencia", "SI, NO"],
            ["Discapacidad", "SI, NO"]
        ];
        const helpSheet = XLSX.utils.aoa_to_sheet([helpHeaders, ...helpData]);
        XLSX.utils.book_append_sheet(workbook, helpSheet, "Ayuda_Valores");

        XLSX.writeFile(workbook, "Plantilla_Captura_Talento_RRHH.xlsx");
    };

    const handleExcelImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const data = evt.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);

            if (json.length === 0) {
                alert("El archivo está vacío");
                return;
            }

            const confirmImport = window.confirm(`Se cargarán ${json.length} registros. ¿Continuar?`);
            if (!confirmImport) return;

            setLoading(true);
            try {
                // Map columns to candidate fields
                const candidates = json.map(row => ({
                    fullName: row["Nombre Completo"],
                    rut: row["RUT"] ? formatRut(row["RUT"].toString()) : '',
                    email: row["Email"] || '',
                    phone: row["Telefono"] || '',
                    nationality: row["Nacionalidad"] || 'Chilena',
                    birthPlace: row["Lugar Nacimiento"] || '',
                    fechaNacimiento: row["F. Nacimiento"] || '',
                    gender: row["Género"] || 'No Informado',
                    estadoCivil: row["Estado Civil"] || '',
                    idExpiryDate: row["Vencimiento Cedula"] || '',
                    address: row["Direccion"] || '',
                    comuna: row["Comuna"] || '',
                    region: row["Region"] || '',
                    ceco: row["CECO"] || '',
                    area: row["Area"] || '',
                    sede: row["Sede"] || '',
                    position: row["Cargo"] || '',
                    educationLevel: row["Nivel Educativo"] || '',
                    contractType: row["Tipo Contrato"] || 'PLAZO FIJO',
                    contractStartDate: row["F. Inicio Contrato"] || '',
                    contractDurationDays: row["Duracion Días"] || '',
                    previsionSalud: row["Prevision Salud"] || 'FONASA',
                    valorPlan: row["Valor Plan Salud"] || '',
                    monedaPlan: row["Moneda Plan"] || 'UF',
                    afp: row["AFP"] || '',
                    tieneCargas: row["Tiene Cargas"] === 'SI' ? 'SI' : 'NO',
                    banco: row["Banco"] || '',
                    tipoCuenta: row["Tipo Cuenta"] || '',
                    numeroCuenta: row["N. Cuenta"] || '',
                    sueldoBase: row["Sueldo Base"] || '',
                    emergencyContact: row["Contacto Emergencia"] || '',
                    emergencyPhone: row["Telefono Emergencia"] || '',
                    shirtSize: row["Talla Camisa"] || '',
                    pantsSize: row["Talla Pantalon"] || '',
                    jacketSize: row["Talla Poleron/Chaqueta"] || '',
                    shoeSize: row["Talla Calzado"] || '',
                    requiereLicencia: row["Requiere Licencia"] === 'SI' ? 'SI' : 'NO',
                    fechaVencimientoLicencia: row["Vencimiento Licencia"] || '',
                    hasDisability: row["Discapacidad"] === 'SI' || row["Discapacidad"] === true,
                    disabilityType: row["Tipo Discapacidad"] || '',
                    status: 'En Postulación'
                }));

                // Batch create (backend support needed for true bulk, but sequential works for small sets)
                for (const cand of candidates) {
                    await candidatosApi.create(cand);
                }
                alert("Importación completada con éxito");
                fetchAll();
            } catch (err) {
                console.error(err);
                alert("Error durante la importación. Verifique el formato del archivo.");
            } finally {
                setLoading(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleChangeStatus = async (id, status) => {
        try {
            await candidatosApi.updateStatus(id, { status });
            fetchAll();
        } catch (e) { alert('Error al cambiar estado'); }
    };

    // ── Per-status counts (from candidatos)
    const cntPostulando = candidatos.filter(c => ['En Postulación', 'Postulando', 'En Entrevista', 'En Evaluación', 'En Acreditación', 'En Documentación', 'Aprobado'].includes(c.status)).length;
    const cntContratados = candidatos.filter(c => c.status === 'Contratado').length;
    const cntFiniquitados = candidatos.filter(c => ['Finiquitado', 'Retirado'].includes(c.status)).length;
    // from backend analytics (if available)
    const ga = globalAnalytics?.totales || null;

    const filtered = candidatos.filter(c => {
        const matchesSearch = c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.rut.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.position.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
        const matchesCeco = !filterCeco || c.ceco === filterCeco;
        const matchesProy = !filterProyecto || c.projectId?.toString() === filterProyecto ||
            c.projectName === proyectos.find(p => p._id === filterProyecto)?.nombreProyecto;
        return matchesSearch && matchesStatus && matchesCeco && matchesProy;
    });

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-20 print:hidden">
            {!showForm ? (
                <div className="animate-in fade-in duration-700">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                        <div className="flex items-center gap-4">
                            <div className="bg-amber-500 text-white p-3 rounded-2xl shadow-lg shadow-amber-200">
                                <UserPlus size={24} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Captura de <span className="text-amber-500">Talento</span></h1>
                                <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-wider">Ingreso y gestión estratégica de postulantes</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setShowChoiceModal(true); }}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-indigo-200 active:scale-95"
                        >
                            <Plus size={16} /> Nuevo Registro
                        </button>
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                        {[
                            { label: 'Total Registros', value: candidatos.length, icon: Users, color: 'indigo', sub: 'en el sistema' },
                            { label: 'En Proceso', value: cntPostulando, icon: Clock, color: 'violet', sub: 'selección activa' },
                            { label: 'Contratados', value: ga?.globalAct ?? cntContratados, icon: CheckCircle2, color: 'emerald', sub: ga ? `${ga.globalEnPermiso ?? 0} en permiso` : 'activos' },
                            { label: 'Finiquitados', value: ga?.globalFin ?? cntFiniquitados, icon: UserX, color: 'rose', sub: 'histórico salidas' },
                            { label: 'Proyectos', value: proyectos.length, icon: FolderKanban, color: 'amber', sub: `${proyectos.filter(p => p.status === 'Activo').length} activos` },
                        ].map((card, i) => {
                            const cs = {
                                indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600', num: 'text-indigo-700', border: 'border-indigo-100' },
                                violet: { bg: 'bg-violet-50', icon: 'text-violet-600', num: 'text-violet-700', border: 'border-violet-100' },
                                emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', num: 'text-emerald-700', border: 'border-emerald-100' },
                                rose: { bg: 'bg-rose-50', icon: 'text-rose-600', num: 'text-rose-700', border: 'border-rose-100' },
                                amber: { bg: 'bg-amber-50', icon: 'text-amber-600', num: 'text-amber-700', border: 'border-amber-100' },
                            }[card.color];
                            return (
                                <div key={i} className={`bg-white border ${cs.border} rounded-[2rem] p-5 shadow-sm flex items-center gap-4 group hover:shadow-md transition-all`}>
                                    <div className={`p-3.5 ${cs.bg} ${cs.icon} rounded-2xl shadow-inner`}>
                                        <card.icon size={22} />
                                    </div>
                                    <div>
                                        <div className={`text-2xl font-black ${cs.num} tracking-tighter`}>{card.value}</div>
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{card.label}</div>
                                        <div className={`text-[9px] font-bold ${cs.icon} mt-0.5`}>{card.sub}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Panel de Análisis */}
                    {globalAnalytics?.proyectos?.length > 0 && (
                        <div className="bg-white border border-indigo-100 rounded-[2rem] mb-6 overflow-hidden shadow-sm">
                            <button
                                onClick={() => setShowAnalyticsPanel(p => !p)}
                                className="w-full flex items-center justify-between px-7 py-5 hover:bg-indigo-50/40 transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <BarChart3 size={16} className="text-indigo-500" />
                                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Análisis de Reclutamiento por Proyecto</span>
                                    <span className="text-[8px] font-black bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">Vinculado a Módulo Proyectos</span>
                                </div>
                                <ChevronDown size={16} className={`text-indigo-400 transition-transform ${showAnalyticsPanel ? 'rotate-180' : ''}`} />
                            </button>
                            {showAnalyticsPanel && (
                                <div className="px-7 pb-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {globalAnalytics.proyectos.map(p => (
                                        <div key={p._id} className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <p className="font-black text-slate-900 text-sm truncate">{p.nombreProyecto}</p>
                                                    <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{p.centroCosto}</span>
                                                </div>
                                                <span className={`text-lg font-black ${p.cobertura >= 100 ? 'text-emerald-600' : p.cobertura >= 60 ? 'text-indigo-600' : 'text-amber-600'}`}>{p.cobertura}%</span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-1 mb-3">
                                                <div className="text-center bg-emerald-50 rounded-lg p-1.5">
                                                    <p className="text-xs font-black text-emerald-700">{p.activos}</p>
                                                    <p className="text-[7px] font-bold text-emerald-500 uppercase">Activos</p>
                                                </div>
                                                <div className="text-center bg-amber-50 rounded-lg p-1.5">
                                                    <p className="text-xs font-black text-amber-700">{p.enPermiso}</p>
                                                    <p className="text-[7px] font-bold text-amber-500 uppercase">Permiso</p>
                                                </div>
                                                <div className="text-center bg-indigo-50 rounded-lg p-1.5">
                                                    <p className="text-xs font-black text-indigo-700">{p.postulando}</p>
                                                    <p className="text-[7px] font-bold text-indigo-500 uppercase">Postul.</p>
                                                </div>
                                                <div className={`text-center rounded-lg p-1.5 ${p.pendientes > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                                                    <p className={`text-xs font-black ${p.pendientes > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{p.pendientes}</p>
                                                    <p className={`text-[7px] font-bold uppercase ${p.pendientes > 0 ? 'text-red-500' : 'text-emerald-500'}`}>Pend.</p>
                                                </div>
                                            </div>
                                            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${p.cobertura >= 100 ? 'bg-emerald-500' : p.cobertura >= 60 ? 'bg-indigo-500' : 'bg-amber-400'}`}
                                                    style={{ width: `${Math.min(p.cobertura, 100)}%` }}
                                                />
                                            </div>
                                            <p className="text-[8px] text-slate-400 font-bold mt-1.5">{p.activos}/{p.requerido} cubiertos · {p.pendientes} pendientes</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Toolbar */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3 items-center">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Nombre, RUT, cargo..."
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/30 outline-none"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select
                            value={filterCeco}
                            onChange={e => setFilterCeco(e.target.value)}
                            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        >
                            <option value="">Centro de Costo (CECO)</option>
                            {[...new Set(candidatos.map(c => c.ceco).filter(Boolean))].map(c =>
                                <option key={c} value={c}>{c}</option>
                            )}
                        </select>
                        <select
                            value={filterProyecto}
                            onChange={e => setFilterProyecto(e.target.value)}
                            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        >
                            <option value="">Todos los proyectos</option>
                            {proyectos.map(p =>
                                <option key={p._id} value={p._id}>{p.nombreProyecto || p.projectName} ({p.centroCosto})</option>
                            )}
                        </select>
                        <select
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-300"
                        >
                            <option value="all">Todos los estados</option>
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="flex gap-2 ml-auto">
                            <button
                                onClick={handleDownloadTemplate}
                                className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100"
                            >
                                <Download size={14} /> Plantilla
                            </button>
                            <button
                                onClick={() => setShowImportModal(true)}
                                className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100"
                            >
                                <Upload size={14} /> Importar
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="flex items-center gap-2 bg-slate-50 text-slate-600 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-slate-600 hover:text-white transition-all border border-slate-100"
                            >
                                <Printer size={14} /> Ficha Manual
                            </button>
                        </div>
                        <div className="text-xs font-black text-slate-400 uppercase tracking-wider bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 whitespace-nowrap">
                            {filtered.length} Registros
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="animate-spin text-amber-500" size={32} />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <Users size={48} className="opacity-20 mb-4" />
                                <p className="font-bold">No se encontraron postulantes</p>
                                <p className="text-xs mt-1">Haz clic en "Nuevo Postulante" para comenzar</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/50">
                                        <tr>
                                            <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Identificación y Perfil</th>
                                            <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Empresa</th>
                                            <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargo / Área</th>
                                            <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Proyecto / CECO</th>
                                            <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                                            <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Acción</th>
                                            <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Gestión</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filtered.map(c => (
                                            <tr key={c._id} className="hover:bg-slate-50/50 transition-colors group/row">
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden shadow-sm">
                                                            {c.profilePic ? <img src={c.profilePic} className="w-full h-full object-cover" alt="profile" /> : <User size={18} />}
                                                        </div>
                                                        <div>
                                                            <div className="font-black text-slate-800 text-sm uppercase">{c.fullName}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono tracking-tighter">{c.rut}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    {c.empresaRef ? (
                                                        <span className="text-[10px] font-black text-slate-700 uppercase">{c.empresaRef.nombre}</span>
                                                    ) : (
                                                        <span className="text-[10px] font-black text-rose-500 uppercase italic">Sin Empresa</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="text-sm font-bold text-slate-700">{c.position}</div>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {c.area && <span className="text-[8px] font-black text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded-md border border-violet-100 uppercase">{c.area}</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    {(() => {
                                                        const proj = proyectos.find(p => p._id === (c.projectId?._id || c.projectId));
                                                        return proj ? (
                                                            <div>
                                                                <div className="text-xs font-bold text-slate-700 truncate max-w-[160px]">{proj.nombreProyecto}</div>
                                                                <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full mt-1 inline-block">CECO: {proj.centroCosto}</span>
                                                            </div>
                                                        ) : <span className="text-slate-300">—</span>;
                                                    })()}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <select
                                                        value={c.status}
                                                        onChange={e => handleChangeStatus(c._id, e.target.value)}
                                                        className={`text-[9px] font-black uppercase border-2 rounded-xl px-3 py-1.5 ${STATUS_COLORS[c.status] || ''}`}
                                                    >
                                                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-6 py-5">
                                                    {/* Simplificado para esta versión */}
                                                    <span className="text-[10px] font-black text-slate-400">GESTIÓN ACTIVA</span>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleEdit(c)} className="p-2 text-slate-400 hover:text-amber-600"><Edit3 size={15} /></button>
                                                        <button onClick={() => setSelectedCandidato(c)} className="p-2 text-slate-400 hover:text-indigo-600"><Eye size={15} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right-8 duration-500 h-[92vh] max-h-[95vh] border border-slate-100 relative">
                    {/* Modal Header */}
                    <div className="flex-none bg-white border-b border-slate-100 shadow-xl z-[60] relative overflow-visible">
                        <div className="px-10 py-6 flex items-center justify-between transition-all duration-700 relative overflow-hidden bg-white">
                            <div className={`absolute top-0 left-0 w-full h-1.5 transition-colors duration-500 bg-${TABS.find(t => t.id === activeTab)?.color || 'indigo'}-500`} />
                            <div className="flex items-center gap-6 relative z-10">
                                <button onClick={() => setShowForm(false)} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-400"><ChevronLeft size={20} /></button>
                                <div className={`p-3 rounded-2xl shadow-xl ${registrationType === 'colaborador' ? 'bg-emerald-600 shadow-emerald-200' : 'bg-indigo-600 shadow-indigo-200'} text-white`}>
                                    <UserPlus size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black uppercase tracking-tight text-slate-800">{editId ? 'Editar Perfil' : 'Nuevo Registro'}</h2>
                                    <p className="text-slate-400 text-[8px] font-black uppercase mt-2">Captura de Talento</p>
                                </div>
                            </div>
                        </div>
                        <div className="px-10 pb-5 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
                            {TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-3 px-5 py-3 rounded-xl transition-all ${activeTab === tab.id ? `bg-${tab.color}-600 text-white shadow-lg` : 'text-slate-400 hover:bg-slate-50'}`}
                                >
                                    <tab.icon size={14} />
                                    <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Modal Body */}
                    <div className="flex-1 overflow-y-auto p-12 space-y-12 custom-scrollbar bg-white relative">
                        {/* Simplified Sections to avoid breakage, but maintaining logic */}
                        <div className="space-y-12">
                            {activeTab === 'institucional' && (
                                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                                    {/* 0. CONFIGURACIÓN ADMINISTRATIVA */}
                                    <section className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl shadow-slate-200/50 relative overflow-hidden group/sec">
                                        <div className="absolute top-0 left-0 w-2 h-full bg-slate-900 group-hover/sec:w-3 transition-all duration-500" />
                                        <div className="flex items-center gap-6 mb-12">
                                            <div className="w-16 h-16 bg-slate-900 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-slate-200 rotate-3 group-hover/sec:rotate-0 transition-transform duration-500">
                                                <FolderKanban size={32} />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">0. CONFIGURACIÓN ADMINISTRATIVA</h3>
                                                <p className="text-slate-400 text-[10px] font-black uppercase mt-2 tracking-[0.2em]">Asignación y Roles Estratégicos</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                                            <div className="group/field">
                                                <label className="label-premium">1. PROYECTO ASIGNADO</label>
                                                <select className="input-rrhh" value={form.projectId} onChange={e => {
                                                    const p = proyectos.find(pr => pr._id === e.target.value);
                                                    setForm({...form, projectId: e.target.value, projectName: p?.nombreProyecto || '', ceco: p?.centroCosto || ''});
                                                }}>
                                                    <option value="">— SELECCIONAR PROYECTO —</option>
                                                    {proyectos.map(p => <option key={p._id} value={p._id}>{p.nombreProyecto} ({p.centroCosto})</option>)}
                                                </select>
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">2. DEPARTAMENTO</label>
                                                <select className="input-rrhh" value={form.departamento} onChange={e => setForm({...form, departamento: e.target.value})}>
                                                    <option value="">— SELECCIONAR DEPTO —</option>
                                                    {companyConfig.departamentos?.map(d => <option key={d._id || d} value={d.nombre || d}>{d.nombre || d}</option>)}
                                                </select>
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">3. CARGO CENTRAL</label>
                                                <select className="input-rrhh" value={form.position} onChange={e => setForm({...form, position: e.target.value})}>
                                                    <option value="">— SELECCIONAR CARGO —</option>
                                                    {companyConfig.cargos?.map(c => <option key={c._id || c} value={c.nombre || c}>{c.nombre || c}</option>)}
                                                </select>
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">CENTRO DE COSTO (AUTO)</label>
                                                <div className="input-rrhh bg-slate-50 text-slate-400 cursor-not-allowed select-none">{form.ceco || 'Seleccionar...'}</div>
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">ÁREA OPERATIVA (AUTO)</label>
                                                <div className="input-rrhh bg-slate-50 text-slate-400 cursor-not-allowed select-none">{form.area || 'Seleccionar...'}</div>
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">4. SEDE ASIGNADA</label>
                                                <select className="input-rrhh" value={form.sede} onChange={e => setForm({...form, sede: e.target.value})}>
                                                    <option value="GLOBAL">GLOBAL</option>
                                                    {companyConfig.sedes?.map(s => <option key={s._id || s} value={s.nombre || s}>{s.nombre || s}</option>)}
                                                </select>
                                            </div>
                                            <div className="md:col-span-3 pt-6 flex items-center justify-between bg-slate-50/50 p-6 rounded-3xl border border-slate-100 italic">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-500"><Waypoints size={20} /></div>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-800 uppercase tracking-tighter">CONTRATACIÓN DIRECTA</p>
                                                        <p className="text-[10px] text-slate-400 font-bold">¿Fue captado sin intermediación externa?</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setForm({...form, isDirectHire: !form.isDirectHire})}
                                                    className={`w-16 h-8 rounded-full transition-all relative ${form.isDirectHire ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                                >
                                                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${form.isDirectHire ? 'left-9 shadow-lg shadow-indigo-200' : 'left-1'}`} />
                                                </button>
                                            </div>
                                        </div>
                                    </section>

                                    {/* 1. IDENTIDAD Y ASIGNACIÓN */}
                                    <section className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl shadow-slate-200/50 relative overflow-hidden group/sec">
                                        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500 group-hover/sec:w-3 transition-all duration-500" />
                                        <div className="flex items-center gap-6 mb-12">
                                            <div className="w-16 h-16 bg-indigo-600 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-200 -rotate-3 group-hover/sec:rotate-0 transition-transform duration-500">
                                                <UserCheck size={32} />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">1. IDENTIDAD Y ASIGNACIÓN</h3>
                                                <p className="text-slate-400 text-[10px] font-black uppercase mt-2 tracking-[0.2em]">Información personal del talento digital</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col xl:flex-row gap-16">
                                            {/* Photo Column */}
                                            <div className="flex flex-col items-center gap-6">
                                                <div className="relative group/pic cursor-pointer" onClick={() => document.getElementById('profilePicInput').click()}>
                                                    <div className="w-56 h-56 rounded-[3.5rem] bg-slate-50 border-4 border-white shadow-2xl overflow-hidden flex items-center justify-center group-hover/pic:scale-[1.02] transition-transform duration-500 relative">
                                                        {form.profilePic ? (
                                                            <img src={form.profilePic} className="w-full h-full object-cover" alt="profile" />
                                                        ) : (
                                                            <User size={80} className="text-slate-200" />
                                                        )}
                                                        <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover/pic:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                                            <Edit3 className="text-white" size={32} />
                                                        </div>
                                                    </div>
                                                    <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white rounded-3xl shadow-2xl flex items-center justify-center text-indigo-600 border border-slate-100 group-hover/pic:rotate-12 transition-transform">
                                                        <Plus size={24} />
                                                    </div>
                                                    <input id="profilePicInput" type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital ID</p>
                                                    <p className="text-[8px] text-amber-500 font-bold uppercase mt-1 italic">Requisito Obligatorio</p>
                                                </div>
                                                
                                                {/* CV Upload Mockup */}
                                                <button 
                                                    onClick={() => document.getElementById('cvInput').click()}
                                                    className="mt-4 flex flex-col items-center gap-2 p-6 bg-slate-50 hover:bg-slate-100 rounded-[2.5rem] border border-slate-100 transition-all w-full group/cv"
                                                >
                                                    <div className="p-4 bg-white rounded-2xl shadow-sm text-slate-400 group-hover/cv:text-indigo-600 group-hover/cv:scale-110 transition-all">
                                                        <FileText size={20} />
                                                    </div>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover/cv:text-indigo-600 transition-colors">Subir Curriculum Vitae</span>
                                                    {form.cvUrl && <span className="text-[8px] text-emerald-500 font-black uppercase">Archivo cargado ✓</span>}
                                                    <input id="cvInput" type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleCVChange} />
                                                </button>
                                            </div>

                                            {/* Fields Column */}
                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-10">
                                                <div className="group/field">
                                                    <label className="label-premium">RUT / ID *</label>
                                                    <input className="input-rrhh" placeholder="12.345.678-9" value={form.rut} onChange={e => setForm({...form, rut: formatRut(e.target.value)})} />
                                                </div>
                                                <div className="group/field">
                                                    <label className="label-premium">NOMBRE COMPLETO (VISUALIZACIÓN) *</label>
                                                    <input className="input-rrhh font-black uppercase" placeholder="Ej: Pedro Alfonso Martinez" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} />
                                                </div>
                                                <div className="group/field">
                                                    <label className="label-premium">F. NACIMIENTO</label>
                                                    <input className="input-rrhh" type="date" value={form.fechaNacimiento} onChange={e => setForm({...form, fechaNacimiento: e.target.value})} />
                                                </div>
                                                <div className="group/field">
                                                    <label className="label-premium">EDAD</label>
                                                    <div className="input-rrhh bg-slate-50 text-slate-400 font-black italic select-none">
                                                        {calculateAge(form.fechaNacimiento) || '--'} AÑOS
                                                    </div>
                                                </div>
                                                <div className="group/field">
                                                    <label className="label-premium">NACIONALIDAD</label>
                                                    <select className="input-rrhh" value={form.nationality} onChange={e => setForm({...form, nationality: e.target.value})}>
                                                        {NACIONALIDADES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                                                    </select>
                                                </div>
                                                <div className="group/field">
                                                    <label className="label-premium">GÉNERO</label>
                                                    <select className="input-rrhh" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                                                        <option value="Masculino">Masculino</option>
                                                        <option value="Femenino">Femenino</option>
                                                        <option value="No Binario">No Binario</option>
                                                        <option value="No Informado">No Informado</option>
                                                    </select>
                                                </div>
                                                <div className="group/field">
                                                    <label className="label-premium">ESTADO CIVIL</label>
                                                    <select className="input-rrhh" value={form.estadoCivil} onChange={e => setForm({...form, estadoCivil: e.target.value})}>
                                                        <option value="">— SELECCIONAR —</option>
                                                        {ESTADO_CIVIL.map(e => <option key={e} value={e}>{e}</option>)}
                                                    </select>
                                                </div>
                                                <div className="group/field">
                                                    <label className="label-premium">LUGAR DE NACIMIENTO</label>
                                                    <input className="input-rrhh" placeholder="EJ: SANTIAGO, CHILE" value={form.birthPlace} onChange={e => setForm({...form, birthPlace: e.target.value})} />
                                                </div>
                                                <div className="group/field">
                                                    <label className="label-premium">VENCIMIENTO CÉDULA / PASAPORTE</label>
                                                    <input className="input-rrhh" type="date" value={form.idExpiryDate} onChange={e => setForm({...form, idExpiryDate: e.target.value})} />
                                                </div>
                                                <div className="group/field md:col-span-2">
                                                    <label className="label-premium">NIVEL EDUCACIONAL</label>
                                                    <select className="input-rrhh" value={form.educationLevel} onChange={e => setForm({...form, educationLevel: e.target.value})}>
                                                        <option value="">— SELECCIONAR NIVEL —</option>
                                                        {NIVELES_EDUCACIONALES.map(n => <option key={n} value={n}>{n}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}

                            {activeTab === 'contacto' && (
                                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                                    {/* 2. CONTACTO Y DOMICILIO */}
                                    <section className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl shadow-slate-200/50 relative overflow-hidden group/sec">
                                        <div className="absolute top-0 left-0 w-2 h-full bg-sky-500 group-hover/sec:w-3 transition-all duration-500" />
                                        <div className="flex items-center gap-6 mb-12">
                                            <div className="w-16 h-16 bg-sky-600 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-sky-200 rotate-3 group-hover/sec:rotate-0 transition-transform duration-500">
                                                <MapPin size={32} />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">2. CONTACTO Y DOMICILIO</h3>
                                                <p className="text-slate-400 text-[10px] font-black uppercase mt-2 tracking-[0.2em]">Ubicación y Medios de Comunicación</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                            <div className="group/field">
                                                <label className="label-premium">CORREO ELECTRÓNICO PRINCIPAL</label>
                                                <input className="input-rrhh" placeholder="nombre@dominio.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">TELÉFONO MÓVIL</label>
                                                <input className="input-rrhh" placeholder="+56 9 1234 5678" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                                            </div>
                                            <div className="group/field md:col-span-2">
                                                <label className="label-premium">CALLE / AVENIDA / PASAJE</label>
                                                <input className="input-rrhh" placeholder="Ej: Avenida Siempre Viva" value={form.calle} onChange={e => setForm({...form, calle: e.target.value})} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-10 md:col-span-2">
                                                <div className="group/field">
                                                    <label className="label-premium">NUMERO</label>
                                                    <input className="input-rrhh" placeholder="123" value={form.numero} onChange={e => setForm({...form, numero: e.target.value})} />
                                                </div>
                                                <div className="group/field">
                                                    <label className="label-premium">BLOCK / DEPTO</label>
                                                    <input className="input-rrhh" placeholder="A-402" value={form.deptoBlock} onChange={e => setForm({...form, deptoBlock: e.target.value})} />
                                                </div>
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">REGIÓN</label>
                                                <select className="input-rrhh" value={form.region} onChange={e => setForm({...form, region: e.target.value, comuna: ''})}>
                                                    <option value="">— SELECCIONAR REGIÓN —</option>
                                                    {REGIONES_DE_CHILE.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">COMUNA</label>
                                                <select className="input-rrhh" value={form.comuna} onChange={e => setForm({...form, comuna: e.target.value})}>
                                                    <option value="">— SELECCIONAR COMUNA —</option>
                                                    {REGIONES_DE_CHILE.find(r => r.name === form.region)?.communes.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </section>

                                    {/* 4. EMERGENCIAS */}
                                    <section className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl shadow-slate-200/50 relative overflow-hidden group/sec">
                                        <div className="absolute top-0 left-0 w-2 h-full bg-rose-500 group-hover/sec:w-3 transition-all duration-500" />
                                        <div className="flex items-center gap-6 mb-12">
                                            <div className="w-16 h-16 bg-rose-600 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-rose-200 -rotate-3 group-hover/sec:rotate-0 transition-transform duration-500">
                                                <Phone size={32} />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">4. EMERGENCIAS</h3>
                                                <p className="text-slate-400 text-[10px] font-black uppercase mt-2 tracking-[0.2em]">Contactos en Caso de Urgencia</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                                            <div className="group/field">
                                                <label className="label-premium">CONTACTO DE EMERGENCIA</label>
                                                <input className="input-rrhh" placeholder="Nombre completo" value={form.emergencyContact} onChange={e => setForm({...form, emergencyContact: e.target.value})} />
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">CELULAR DE EMERGENCIA</label>
                                                <input className="input-rrhh" placeholder="+56 9 ..." value={form.emergencyPhone} onChange={e => setForm({...form, emergencyPhone: e.target.value})} />
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">CORREO ELECTRÓNICO</label>
                                                <input className="input-rrhh" placeholder="correo@emergencia.cl" value={form.emergencyEmail} onChange={e => setForm({...form, emergencyEmail: e.target.value})} />
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}

                            {activeTab === 'laboral' && (
                                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                                    {/* 3. INFORMACIÓN DEL CONTRATO */}
                                    <section className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl shadow-slate-200/50 relative overflow-hidden group/sec">
                                        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500 group-hover/sec:w-3 transition-all duration-500" />
                                        <div className="flex items-center gap-6 mb-12">
                                            <div className="w-16 h-16 bg-indigo-600 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-200 rotate-3 group-hover/sec:rotate-0 transition-transform duration-500">
                                                <Briefcase size={32} />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">3. INFORMACIÓN DEL CONTRATO</h3>
                                                <p className="text-slate-400 text-[10px] font-black uppercase mt-2 tracking-[0.2em]">Gestión de Términos y Plazos Laborales</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                                            <div className="group/field">
                                                <label className="label-premium">JORNADA CONTRACTUAL</label>
                                                <select className="input-rrhh" value={form.contractType} onChange={e => setForm({...form, contractType: e.target.value})}>
                                                    {TIPOS_CONTRATO.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">FECHA EFECTIVA INICIO</label>
                                                <input className="input-rrhh" type="date" value={form.contractStartDate} onChange={e => setForm({...form, contractStartDate: e.target.value})} />
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">DURACIÓN PACTADA (DÍAS)</label>
                                                <input className="input-rrhh" type="number" placeholder="Ej: 30" value={form.contractDurationDays} onChange={e => setForm({...form, contractDurationDays: e.target.value})} />
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">TÉRMINO PROYECTADO</label>
                                                <div className="input-rrhh bg-slate-50 text-slate-400 font-mono select-none">{form.contractEndDate || '-- / -- / --'}</div>
                                            </div>
                                            <div className="lg:col-span-3 group/field">
                                                <label className="label-premium">DESCRIPCIÓN PRÓXIMO HITO</label>
                                                <input className="input-rrhh" value={form.nextAddendumDescription} placeholder="Ej: SEGUNDO ANEXO PLAZO FIJO" readOnly />
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">SUGERENCIA DE PRÓXIMO ANEXO</label>
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Requerido</span>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    {/* 6. INFORMACIÓN BANCARIA */}
                                    <section className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl shadow-slate-200/50 relative overflow-hidden group/sec">
                                        <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500 group-hover/sec:w-3 transition-all duration-500" />
                                        <div className="flex items-center gap-6 mb-12">
                                            <div className="w-16 h-16 bg-emerald-600 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-200 -rotate-3 group-hover/sec:rotate-0 transition-transform duration-500">
                                                <Landmark size={32} />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">6. INFORMACIÓN BANCARIA</h3>
                                                <p className="text-slate-400 text-[10px] font-black uppercase mt-2 tracking-[0.2em]">Gestión de Depósitos y Nómina</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                                            <div className="group/field">
                                                <label className="label-premium">INSTITUCIÓN BANCARIA</label>
                                                <select className="input-rrhh" value={form.banco} onChange={e => setForm({...form, banco: e.target.value})}>
                                                    <option value="">— SELECCIONAR BANCO —</option>
                                                    {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                                                </select>
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">TIPO DE CUENTA</label>
                                                <select className="input-rrhh" value={form.tipoCuenta} onChange={e => setForm({...form, tipoCuenta: e.target.value})}>
                                                    <option value="">— SELECCIONAR TIPO —</option>
                                                    {TIPOS_CUENTA.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">NÚMERO DE CUENTA</label>
                                                <input className="input-rrhh" placeholder="012345678" value={form.numeroCuenta} onChange={e => setForm({...form, numeroCuenta: e.target.value})} />
                                            </div>
                                        </div>
                                    </section>

                                    {/* 8. REMUNERACIÓN Y BONOS */}
                                    <section className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl shadow-slate-200/50 relative overflow-hidden group/sec">
                                        <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500 group-hover/sec:w-3 transition-all duration-500" />
                                        <div className="flex items-center gap-6 mb-12">
                                            <div className="w-16 h-16 bg-emerald-700 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-200 rotate-3 group-hover/sec:rotate-0 transition-transform duration-500">
                                                <DollarSign size={32} />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">8. REMUNERACIÓN Y BONOS</h3>
                                                <p className="text-slate-400 text-[10px] font-black uppercase mt-2 tracking-[0.2em]">Configuración Salarial y Beneficios</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                                            <div className="group/field bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100">
                                                <label className="label-premium mb-4">SUELDO BASE LÍQUIDO</label>
                                                <div className="relative">
                                                    <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-600" size={24} />
                                                    <input className="input-rrhh pl-16 text-2xl font-black text-emerald-700 placeholder:text-slate-200 bg-white" placeholder="000.000" type="number" value={form.sueldoBase} onChange={e => setForm({...form, sueldoBase: e.target.value})} />
                                                </div>
                                                <p className="text-[9px] text-slate-400 font-bold mt-4 px-2 italic uppercase">Monto acordado para pago mensual neto.</p>
                                            </div>
                                            <div className="lg:col-span-2 group/field bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100">
                                                <label className="label-premium mb-6 uppercase flex items-center gap-2">
                                                    <Award size={14} className="text-emerald-500" /> Asignación de Bonos
                                                </label>
                                                <div className="flex gap-4 mb-8">
                                                    <select className="input-rrhh bg-white" value={bonusTemp.type} onChange={e => setBonusTemp({...bonusTemp, type: e.target.value})}>
                                                        <option value="">SELECCIONA..</option>
                                                        {TIPOS_BONOS.map(b => <option key={b.type} value={b.type}>{b.type}</option>)}
                                                    </select>
                                                    <input className="input-rrhh bg-white w-48" placeholder="Monto Valor" type="number" value={bonusTemp.amount} onChange={e => setBonusTemp({...bonusTemp, amount: e.target.value})} />
                                                    <button onClick={handleBonusAdd} className="w-16 h-16 bg-emerald-600 text-white rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 transition-transform">
                                                        <Plus size={24} />
                                                    </button>
                                                </div>
                                                <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar">
                                                    {form.bonuses.map((b, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm animate-in zoom-in-95">
                                                            <div>
                                                                <p className="text-[10px] font-black text-slate-800 uppercase">{b.type}</p>
                                                                <p className="text-[12px] font-black text-emerald-600">${parseInt(b.amount).toLocaleString()}</p>
                                                            </div>
                                                            <button onClick={() => handleBonusRemove(idx)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {form.bonuses.length === 0 && <p className="text-[9px] text-slate-300 font-bold text-center py-4 uppercase italic">Sin bonos asignados</p>}
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}

                            {activeTab === 'salud' && (
                                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                                    {/* 5. PREVISIÓN Y SALUD */}
                                    <section className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl shadow-slate-200/50 relative overflow-hidden group/sec">
                                        <div className="absolute top-0 left-0 w-2 h-full bg-rose-500 group-hover/sec:w-3 transition-all duration-500" />
                                        <div className="flex items-center gap-6 mb-12">
                                            <div className="w-16 h-16 bg-rose-600 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-rose-200 rotate-3 group-hover/sec:rotate-0 transition-transform duration-500">
                                                <Heart size={32} />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">5. PREVISIÓN Y SALUD</h3>
                                                <p className="text-slate-400 text-[10px] font-black uppercase mt-2 tracking-[0.2em]">Seguridad Social y Bienestar Físico</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                                            <div className="group/field">
                                                <label className="label-premium">SISTEMA SALUD (ISAPRE/FONASA)</label>
                                                <select className="input-rrhh" value={form.previsionSalud} onChange={e => setForm({...form, previsionSalud: e.target.value})}>
                                                    {ISAPRES.map(i => <option key={i} value={i}>{i}</option>)}
                                                </select>
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">ADMINISTRADORA AFP</label>
                                                <select className="input-rrhh" value={form.afp} onChange={e => setForm({...form, afp: e.target.value})}>
                                                    <option value="">— SELECCIONAR AFP —</option>
                                                    {AFPS.map(a => <option key={a} value={a}>{a}</option>)}
                                                </select>
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">SITUACIÓN JUBILADO</label>
                                                <select className="input-rrhh" value={form.pensionado} onChange={e => setForm({...form, pensionado: e.target.value})}>
                                                    <option value="No Jubilado">No Jubilado</option>
                                                    <option value="Jubilado Activo">Jubilado Activo</option>
                                                </select>
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">GRUPO SANGUÍNEO</label>
                                                <select className="input-rrhh" value={form.bloodType} onChange={e => setForm({...form, bloodType: e.target.value})}>
                                                    <option value="">— SELECCIONAR GRUPO —</option>
                                                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(g => <option key={g} value={g}>{g}</option>)}
                                                </select>
                                            </div>
                                            <div className="md:col-span-2 group/field">
                                                <label className="label-premium text-[9px] text-slate-400">ALERGIAS CONOCIDAS</label>
                                                <input className="input-rrhh" placeholder="Ej: Penicilina, alimentos, etc." value={form.allergies} onChange={e => setForm({...form, allergies: e.target.value})} />
                                            </div>
                                            <div className="md:col-span-2 group/field">
                                                <label className="label-premium text-[9px] text-slate-400">PATOLOGÍAS CRÓNICAS</label>
                                                <input className="input-rrhh" placeholder="Ej: Hipertensión, Diabetes..." value={form.chronicDiseases} onChange={e => setForm({...form, chronicDiseases: e.target.value})} />
                                            </div>
                                            <div className="md:col-span-2 flex items-center gap-6 p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem]">
                                                <div className={`w-14 h-8 rounded-full transition-all relative cursor-pointer ${form.hasDisability ? 'bg-rose-500' : 'bg-slate-300'}`} onClick={() => setForm({...form, hasDisability: !form.hasDisability})}>
                                                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${form.hasDisability ? 'left-7 shadow-lg shadow-rose-200' : 'left-1'}`} />
                                                </div>
                                                <span className="text-[11px] font-black text-slate-800 uppercase tracking-tighter">¿Discapacidad?</span>
                                            </div>
                                            <div className="md:col-span-2 flex flex-col group/field">
                                                <label className="label-premium text-rose-500 uppercase flex items-center gap-2">
                                                    <Users size={14} /> Gestión de Cargas Familiares
                                                </label>
                                                <div className="bg-slate-50 border border-slate-100 rounded-3xl p-4 flex items-center justify-between mt-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Cargas Actuales</span>
                                                        <span className="text-sm font-black text-slate-800 mt-1 uppercase">{form.listaCargas.length} Cargas</span>
                                                    </div>
                                                    <select className="bg-white border-2 border-slate-100 rounded-xl px-4 py-2 text-[10px] font-black uppercase text-slate-600 focus:border-rose-300 transition-colors outline-none">
                                                        <option value="SIN CARGAS">SIN CARGAS —</option>
                                                        <option value="CON CARGAS">CON CARGAS</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}

                            {activeTab === 'requisitos' && (
                                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                                    {/* 7. EQUIPAMIENTO Y TALLAS */}
                                    <section className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl shadow-slate-200/50 relative overflow-hidden group/sec">
                                        <div className="absolute top-0 left-0 w-2 h-full bg-orange-500 group-hover/sec:w-3 transition-all duration-500" />
                                        <div className="flex items-center gap-6 mb-12">
                                            <div className="w-16 h-16 bg-orange-600 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-orange-200 rotate-3 group-hover/sec:rotate-0 transition-transform duration-500">
                                                <Truck size={32} />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">7. EQUIPAMIENTO Y TALLAS</h3>
                                                <p className="text-slate-400 text-[10px] font-black uppercase mt-2 tracking-[0.2em]">Tallas para EPP y Vestimenta Corporativa</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
                                            <div className="group/field">
                                                <label className="label-premium">TALLA CAMISA</label>
                                                <input className="input-rrhh" placeholder="S / M / L.." value={form.shirtSize} onChange={e => setForm({...form, shirtSize: e.target.value})} />
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">TALLA PANTALÓN</label>
                                                <input className="input-rrhh" placeholder="42 / 44 / 46.." value={form.pantsSize} onChange={e => setForm({...form, pantsSize: e.target.value})} />
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">TALLA CHAQUETA</label>
                                                <input className="input-rrhh" placeholder="M / L / XL.." value={form.jacketSize} onChange={e => setForm({...form, jacketSize: e.target.value})} />
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">TALLA CALZADO</label>
                                                <input className="input-rrhh" placeholder="38 / 39 / 40.." value={form.shoeSize} onChange={e => setForm({...form, shoeSize: e.target.value})} />
                                            </div>
                                            
                                            {/* Licencia de Conducir */}
                                            <div className="md:col-span-2 group/field bg-orange-50/50 p-6 rounded-3xl border border-orange-100 flex items-center justify-between gap-8 mt-4">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${form.requiereLicencia === 'SI' ? 'bg-orange-600' : 'bg-slate-300'}`}>
                                                        <Truck size={24} />
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-tighter block leading-none">¿Posee Licencia?</span>
                                                        <select className="bg-transparent text-[11px] font-black text-orange-600 uppercase outline-none cursor-pointer" value={form.requiereLicencia} onChange={e => setForm({...form, requiereLicencia: e.target.value})}>
                                                            <option value="NO">NO POSEE</option>
                                                            <option value="SI">SÍ, ACTIVA</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                {form.requiereLicencia === 'SI' && (
                                                    <div className="flex-1">
                                                        <label className="text-[7px] font-black text-orange-400 uppercase tracking-widest block mb-1">Vencimiento Licencia</label>
                                                        <input type="date" className="bg-white border-2 border-orange-100 rounded-xl px-4 py-2 text-[10px] font-black text-slate-700 uppercase focus:border-orange-300 outline-none w-full" value={form.fechaVencimientoLicencia} onChange={e => setForm({...form, fechaVencimientoLicencia: e.target.value})} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}
                            <div className="mt-12 flex justify-end">
                                <button
                                    onClick={handleSubmit}
                                    disabled={saving}
                                    className="px-12 py-5 bg-orange-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl hover:-translate-y-1 transition-all"
                                >
                                    {saving ? 'Guardando...' : 'Guardar Registro'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals outside ternary */}
            {selectedCandidato && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedCandidato(null)}>
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex-1 overflow-y-auto p-10">
                            <FichaIngresoPremium data={selectedCandidato} />
                        </div>
                        <div className="p-8 border-t border-slate-100 flex justify-end">
                            <button onClick={() => setSelectedCandidato(null)} className="px-10 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {showChoiceModal && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-white/20">
                        <div className="p-10 text-center">
                            <h2 className="text-2xl font-black uppercase text-slate-800 mb-8">Seleccione Tipo de Registro</h2>
                            <div className="grid grid-cols-2 gap-6">
                                <button
                                    onClick={() => { setRegistrationType('postulante'); setShowChoiceModal(false); setShowForm(true); }}
                                    className="p-8 border-2 border-slate-100 rounded-3xl hover:border-indigo-500 transition-all"
                                >
                                    <Users size={32} className="mx-auto mb-4 text-indigo-600" />
                                    <span className="font-black text-xs uppercase text-slate-600">Postulante</span>
                                </button>
                                <button
                                    onClick={() => { setRegistrationType('colaborador'); setForm({...form, status: 'Contratado'}); setShowChoiceModal(false); setShowForm(true); }}
                                    className="p-8 border-2 border-slate-100 rounded-3xl hover:border-emerald-500 transition-all"
                                >
                                    <UserCheck size={32} className="mx-auto mb-4 text-emerald-600" />
                                    <span className="font-black text-xs uppercase text-slate-600">Colaborador</span>
                                </button>
                            </div>
                            <button onClick={() => setShowChoiceModal(false)} className="mt-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            {showImportModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden">
                        <div className="p-8 bg-indigo-600 text-white flex justify-between items-center">
                            <h3 className="font-black uppercase text-lg">Importación Masiva</h3>
                            <button onClick={() => setShowImportModal(false)}><X size={24} /></button>
                        </div>
                        <div className="p-10 text-center">
                            <p className="text-slate-600 mb-8">Seleccione el archivo Excel (.xlsx) con los registros a importar.</p>
                            <label className="block w-full bg-slate-900 text-white py-6 rounded-2xl font-black text-xs uppercase tracking-widest cursor-pointer hover:bg-black transition-all">
                                <Upload className="inline-block mr-3" size={20} /> Seleccionar Archivo
                                <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleExcelImport} />
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {showSuccessModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-xl p-12 text-center">
                        <div className="mb-8 mx-auto w-24 h-24 bg-emerald-500 text-white rounded-[2.5rem] flex items-center justify-center">
                            <CheckCircle2 size={48} />
                        </div>
                        <h3 className="text-3xl font-black text-slate-800 mb-4">Registro Exitoso</h3>
                        <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-10">El registro ha sido procesado correctamente.</p>
                        <button
                            onClick={() => { setShowSuccessModal(false); setShowForm(false); }}
                            className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest"
                        >
                            Cerrar y Continuar
                        </button>
                    </div>
                </div>
            )}

            <FichaManualPrint companyConfig={companyConfig} />
        </div>
    );
};

export default CapturaTalento;

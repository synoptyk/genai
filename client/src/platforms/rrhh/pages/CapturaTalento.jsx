import React, { useState, useEffect } from 'react';
import {
    UserPlus, Search, Loader2, Users, ChevronDown, X, CheckCircle2,
    Clock, Edit3, Eye, GraduationCap, Briefcase, ChevronLeft,
    AlertCircle, Plus, Globe, Mail, Phone, MapPin,
    Heart, Landmark, CreditCard, DollarSign, Award, Truck, ShieldCheck, Activity,
    User, Calendar, FileText, Download, Upload, Printer, Hash,
    HelpCircle, Info, ChevronRight, UserCheck, MessageCircle,
    FolderKanban, BarChart3, UserX
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { candidatosApi, proyectosApi, configApi } from '../rrhhApi';
import FichaManualPrint from './FichaManualPrint';
import { formatRut, validateRut } from '../../../utils/rutUtils';

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
const BANCOS = ["BANCO ESTADO", "BANCO DE CHILE", "SANTANDER", "BCI", "SCOTIABANK", "ITAÚ", "FALABELLA", "RIPLEY", "CONSORCIO", "SECURITY", "INTERNACIONAL", "BICE"];
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
    // 1. Identidad
    fullName: '', rut: '', email: '', phone: '', nationality: 'Chilena',
    birthPlace: '', idExpiryDate: '', gender: 'No Informado',
    fechaNacimiento: '', estadoCivil: '',
    // 2. Domicilio Detallado
    address: '', calle: '', numero: '', deptoBlock: '', comuna: '', region: '',
    // 3. Administración y Asignación
    ceco: '',
    subCeco: '',
    area: '',
    departamento: '',
    position: '', educationLevel: '',
    status: 'En Postulación', source: 'Captación Directa',
    cvUrl: '',
    // Información del Contrato
    contractType: 'PLAZO FIJO',
    contractStartDate: '',
    contractDurationMonths: '',
    contractEndDate: '',
    nextAddendumDate: '',
    nextAddendumDescription: '',
    contractStep: 1,
    // 4. Previsión y Salud
    previsionSalud: 'FONASA', isapreNombre: '', valorPlan: '', monedaPlan: 'UF',
    afp: '', pensionado: 'NO',
    bloodType: '', allergies: '', chronicDiseases: '',
    hasDisability: false, disabilityType: '',
    tieneCargas: 'NO', listaCargas: [],
    // 5. Financiero/Remuneración
    banco: '', tipoCuenta: '', numeroCuenta: '',
    sueldoBase: '', bonuses: [],
    // 6. Otros Requisitos
    requiereLicencia: 'NO', fechaVencimientoLicencia: '',
    shirtSize: '', pantsSize: '', jacketSize: '', shoeSize: '',
    // 7. Compliance y Misceláneos
    conflictOfInterest: {
        hasFamilyInCompany: false,
        relationship: '',
        employeeName: ''
    },
    currentWorkSituation: '',
    isDirectHire: false,
    profilePic: '',
    // Emergencia
    emergencyContact: '', emergencyPhone: '', emergencyEmail: ''
};

const CapturaTalento = () => {
    const [candidatos, setCandidatos] = useState([]);
    const [proyectos, setProyectos] = useState([]);
    const [companyConfig, setCompanyConfig] = useState({ cargos: [], areas: [], cecos: [], projectTypes: [] });
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
    }, []);

    useEffect(() => {
        if (form.contractType === 'INDEFINIDO') {
            const updates = {};
            if (form.contractDurationMonths !== '') updates.contractDurationMonths = '';
            if (form.contractEndDate !== 'SIN TÉRMINO') updates.contractEndDate = 'SIN TÉRMINO';
            if (form.nextAddendumDate !== '') updates.nextAddendumDate = '';
            if (form.nextAddendumDescription !== 'CONTRATO VIGENTE (INDEFINIDO)') updates.nextAddendumDescription = 'CONTRATO VIGENTE (INDEFINIDO)';
            if (form.contractStep !== 3) updates.contractStep = 3;

            if (Object.keys(updates).length > 0) {
                setForm(prev => ({ ...prev, ...updates }));
            }
            return;
        }

        if (form.contractStartDate && form.contractDurationMonths) {
            const start = new Date(form.contractStartDate);
            const duration = parseInt(form.contractDurationMonths);
            if (!isNaN(duration)) {
                const end = new Date(start);
                end.setMonth(end.getMonth() + duration);
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
    }, [form.contractStartDate, form.contractDurationMonths, form.contractType, form.contractStep]);

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
            subCeco: c.subCeco || '',
            area: c.area || '',
            departamento: c.departamento || '',
            proyectoTipo: c.proyectoTipo || '',
            projectId: c.projectId || '',
            projectName: c.projectName || '',
            position: c.position,
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
            contractDurationMonths: c.contractDurationMonths || '',
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
            "Género", "Estado Civil", "Vencimiento Cedula", "Direccion", "Comuna", "Region", "CECO", "Sub-CECO", "Area",
            "Cargo", "Nivel Educativo", "Tipo Contrato", "F. Inicio Contrato", "Duracion Meses",
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
            ["Sub-CECO", "Depende del CECO seleccionado"],
            ["Area", companyConfig.areas?.map(a => typeof a === 'string' ? a : a.nombre).join(", ") || "—"],
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
                    subCeco: row["Sub-CECO"] || '',
                    area: row["Area"] || '',
                    departamento: row["Departamento"] || '',
                    position: row["Cargo"] || '',
                    educationLevel: row["Nivel Educativo"] || '',
                    contractType: row["Tipo Contrato"] || 'PLAZO FIJO',
                    contractStartDate: row["F. Inicio Contrato"] || '',
                    contractDurationMonths: row["Duracion Meses"] || '',
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

                    {/* ── KPIs alineados con Módulo Proyectos ── */}
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

                    {/* ── Panel de Análisis por Proyecto (colapsable) ── */}
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
                        {/* CECO filter */}
                        <select
                            value={filterCeco}
                            onChange={e => setFilterCeco(e.target.value)}
                            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        >
                            <option value="">Todos los CECOs</option>
                            {[...new Set(candidatos.map(c => c.ceco).filter(Boolean))].map(c =>
                                <option key={c} value={c}>{c}</option>
                            )}
                        </select>
                        {/* Proyecto filter */}
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
                        {/* Status filter */}
                        <select
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-300"
                        >
                            <option value="all">Todos los estados</option>
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="flex gap-2 ml-auto">
                            <div className="relative group/tooltip">
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100"
                                >
                                    <Download size={14} /> Plantilla
                                </button>
                            </div>
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
                                                    <div className="text-sm font-bold text-slate-700">{c.position}</div>
                                                    <div className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">{c.area || '—'}</div>
                                                </td>
                                                {/* Enriched Proyecto column */}
                                                <td className="px-6 py-5">
                                                    {(() => {
                                                        const proj = proyectos.find(p => p._id === c.projectId?.toString() || p._id === c.projectId);
                                                        const nombre = proj?.nombreProyecto || proj?.projectName || c.projectName || null;
                                                        const ceco = proj?.centroCosto || c.ceco || null;
                                                        return nombre ? (
                                                            <div>
                                                                <div className="text-xs font-bold text-slate-700 truncate max-w-[160px]">{nombre}</div>
                                                                {ceco && <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full mt-1 inline-block">{ceco}</span>}
                                                            </div>
                                                        ) : ceco ? (
                                                            <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">{ceco}</span>
                                                        ) : (
                                                            <span className="text-slate-300 text-xs">—</span>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col gap-1.5">
                                                        <select
                                                            value={c.status}
                                                            onChange={e => handleChangeStatus(c._id, e.target.value)}
                                                            className={`text-[9px] font-black uppercase border-2 rounded-xl px-3 py-1.5 cursor-pointer outline-none transition-all appearance-none shadow-sm ${STATUS_COLORS[c.status] || 'bg-slate-50'}`}
                                                        >
                                                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                                        </select>
                                                        {c.status === 'Contratado' && (
                                                            <div className="flex items-center gap-1 text-[8px] font-black text-emerald-600 uppercase tracking-tighter ml-1">
                                                                <CheckCircle2 size={10} /> Aprobado / Oficial
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    {c.status === 'En Postulación' ? (
                                                        <button
                                                            onClick={async () => {
                                                                if (window.confirm('¿Desea enviar este candidato a validación para su contratación?')) {
                                                                    try {
                                                                        const workflow = companyConfig.approvalWorkflows?.find(w => w.module === 'Ingreso');
                                                                        const approvers = workflow?.approvers || [];

                                                                        if (approvers.length === 0) {
                                                                            alert('ADVERTENCIA: No hay aprobadores configurados para el flujo de Ingreso. Configure el flujo en el módulo de Configuración.');
                                                                            return;
                                                                        }

                                                                        const approvalChain = approvers.map(a => ({
                                                                            ...a,
                                                                            status: 'Pendiente',
                                                                            comment: '',
                                                                            updatedAt: null
                                                                        }));

                                                                        await candidatosApi.updateStatus(c._id, {
                                                                            status: 'En Postulación',
                                                                            validationRequested: true,
                                                                            approvalChain
                                                                        });
                                                                        alert('Solicitud enviada exitosamente al módulo de Aprobaciones');
                                                                        fetchAll();
                                                                    } catch (e) { alert('Error al enviar solicitud'); }
                                                                }
                                                            }}
                                                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 active:scale-95"
                                                        >
                                                            <ShieldCheck size={12} /> Solicitar Validación
                                                        </button>
                                                    ) : c.status === 'Contratado' ? (
                                                        <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-black text-[9px] uppercase tracking-widest border border-emerald-100 text-center w-fit">
                                                            Personal Activo
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] font-black text-slate-300 uppercase italic tracking-tighter">Sin acciones</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleEdit(c)} className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all shadow-sm group-hover/row:border-amber-100 border border-transparent">
                                                            <Edit3 size={15} />
                                                        </button>
                                                        <button onClick={() => setSelectedCandidato(c)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all shadow-sm group-hover/row:border-indigo-100 border border-transparent">
                                                            <Eye size={15} />
                                                        </button>
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
                    {/* Top Bar - Fixed Header Section */}
                    <div className="flex-none bg-white border-b border-slate-100 shadow-xl z-[60] relative overflow-visible">
                        <div className="px-10 py-6 flex items-center justify-between transition-all duration-700 relative overflow-hidden bg-white">
                            <div className={`absolute top-0 left-0 w-full h-1.5 transition-colors duration-500 bg-${TABS.find(t => t.id === activeTab)?.color || 'indigo'}-500`} />

                            <div className="flex items-center gap-6 relative z-10">
                                <button
                                    onClick={() => setShowForm(false)}
                                    className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-600 transition-all active:scale-95 shadow-sm group/back"
                                    title="Volver al Listado"
                                >
                                    <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                                </button>
                                <div className={`p-3 rounded-2xl shadow-xl ${registrationType === 'colaborador' ? 'bg-emerald-600 shadow-emerald-200' : 'bg-indigo-600 shadow-indigo-200'} text-white transition-all transform hover:rotate-6`}>
                                    <UserPlus size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 leading-none">
                                        {editId ? 'Editar Perfil' : registrationType === 'colaborador' ? 'Personal' : 'Nuevo Registro'}
                                    </h2>
                                    <p className="text-slate-400 text-[8px] font-black uppercase tracking-[0.2em] mt-2">Captura de Talento</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 bg-slate-50/80 backdrop-blur-sm px-5 py-2.5 rounded-2xl border border-slate-100">
                                <div className="flex flex-col gap-1 w-32">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Progreso</span>
                                        <span className={`text-[8px] font-black uppercase tracking-widest text-${TABS.find(t => t.id === activeTab)?.color || 'indigo'}-600`}>{Math.round(((TABS.findIndex(t => t.id === activeTab) + 1) / 5) * 100)}%</span>
                                    </div>
                                    <div className="w-full h-1 bg-white rounded-full overflow-hidden shadow-inner">
                                        <div
                                            className={`h-full transition-all duration-1000 ease-out bg-${TABS.find(t => t.id === activeTab)?.color || 'indigo'}-500`}
                                            style={{ width: `${((TABS.findIndex(t => t.id === activeTab) + 1) / 5) * 100}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="border-l border-slate-200 pl-5 flex flex-col items-end">
                                    <span className={`text-[9px] font-black uppercase tracking-[0.2em] text-${TABS.find(t => t.id === activeTab)?.color || 'indigo'}-600 leading-none`}>{activeTab.replace('-', ' ')}</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Paso {TABS.findIndex(t => t.id === activeTab) + 1}/5</span>
                                </div>
                            </div>
                        </div>

                        {/* Tabs integrated into the sticky block */}
                        <div className="px-10 pb-5 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
                            {TABS.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                const activeColor = tab.color;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-500 shrink-0 transform active:scale-95
                                                ${isActive
                                                ? `bg-${activeColor}-600 text-white shadow-lg shadow-${activeColor}-200`
                                                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600 border border-transparent'
                                            }`}
                                    >
                                        <Icon size={14} className={isActive ? 'text-white' : `text-${tab.color}-300`} />
                                        <span className="text-[9px] font-black uppercase tracking-widest leading-none">
                                            {tab.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>


                    {/* Modal Body - Main Content Area (Unified) */}
                    <div className="flex-1 overflow-y-auto p-12 space-y-12 custom-scrollbar bg-white relative">

                        {activeTab === 'institucional' && (
                            <div className="space-y-16 animate-in fade-in slide-in-from-right-8 duration-700">
                                {/* SECCIÓN 0: CONFIGURACIÓN ADMINISTRATIVA (NUEVA) */}
                                <section className="section-card-premium group">
                                    <div className={`flex items-center gap-3 border-b border-slate-50 pb-4 mb-2`}>
                                        <div className={`p-2 bg-amber-50 text-amber-600 rounded-xl shadow-sm transform group-hover:rotate-6 transition-transform duration-500`}><Landmark size={20} /></div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">0. Configuración Administrativa</h3>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Asignación organizacional y operativa</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                                        <div className="group/field">
                                            <label className="label-premium"><Landmark size={14} className="text-amber-500" /> Centro de Costo (CECO)</label>
                                            <select
                                                className="input-rrhh"
                                                value={form.ceco}
                                                onChange={e => setForm({ ...form, ceco: e.target.value, subCeco: '' })}
                                            >
                                                <option value="">— SELECCIONAR CENTRO —</option>
                                                {companyConfig.cecos.map(c => (
                                                    <option key={typeof c === 'string' ? c : c.nombre} value={typeof c === 'string' ? c : c.nombre}>
                                                        {typeof c === 'string' ? c : c.nombre}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="group/field">
                                            <label className="label-premium"><Landmark size={14} className="text-amber-500" /> Sub-CECO</label>
                                            <select
                                                className="input-rrhh"
                                                value={form.subCeco}
                                                onChange={e => setForm({ ...form, subCeco: e.target.value })}
                                                disabled={!form.ceco}
                                            >
                                                <option value="">— SELECCIONAR SUB-CECO —</option>
                                                {companyConfig.cecos.find(c => (typeof c === 'string' ? c : c.nombre) === form.ceco)?.subCecos?.map(sc => (
                                                    <option key={sc} value={sc}>{sc}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="group/field">
                                            <label className="label-premium"><Briefcase size={14} className="text-amber-500" /> Área Operativa</label>
                                            <select
                                                className="input-rrhh"
                                                value={form.area}
                                                onChange={e => setForm({ ...form, area: e.target.value })}
                                            >
                                                <option value="">— SELECCIONAR ÁREA —</option>
                                                {companyConfig.areas?.map(a => (
                                                    <option key={typeof a === 'string' ? a : a.nombre} value={typeof a === 'string' ? a : a.nombre}>
                                                        {typeof a === 'string' ? a : a.nombre}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="group/field">
                                            <label className="label-premium"><Landmark size={14} className="text-amber-500" /> Departamento</label>
                                            <select
                                                className="input-rrhh"
                                                value={form.departamento || ''}
                                                onChange={e => setForm({ ...form, departamento: e.target.value })}
                                            >
                                                <option value="">— SELECCIONAR DEPTO —</option>
                                                {companyConfig.departamentos?.map(d => {
                                                    const val = typeof d === 'string' ? d : d.nombre;
                                                    return <option key={val} value={val}>{val}</option>;
                                                })}
                                            </select>
                                        </div>
                                        <div className="md:col-span-3 pt-6 border-t border-slate-50 mt-4 flex items-center justify-between bg-slate-50/50 p-6 rounded-3xl group/toggle">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-white text-amber-600 rounded-xl shadow-sm"><UserCheck size={20} /></div>
                                                <div>
                                                    <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Contratación Directa</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">¿Fue captado sin intermediación externa?</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setForm(prev => ({ ...prev, isDirectHire: !prev.isDirectHire }))}
                                                className={`relative w-24 h-12 rounded-full transition-all duration-500 overflow-hidden border-2 ${form.isDirectHire ? 'bg-amber-500 border-amber-600 shadow-lg shadow-amber-200' : 'bg-slate-200 border-slate-300'}`}
                                            >
                                                <div className={`absolute top-1/2 -translate-y-1/2 transition-all duration-500 font-black text-[10px] uppercase ${form.isDirectHire ? 'right-10 text-white' : 'left-10 text-slate-400'}`}>
                                                    {form.isDirectHire ? 'SÍ' : 'NO'}
                                                </div>
                                                <div className={`absolute top-1 bg-white w-8 h-8 rounded-full shadow-md transition-all duration-500 ${form.isDirectHire ? 'left-14' : 'left-1'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </section>

                                {/* SECTION 1: IDENTIDAD Y ASIGNACIÓN */}
                                <section className="section-card-premium group/section">
                                    <div className="flex items-center gap-3 border-b border-slate-50 pb-4 mb-2">
                                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl shadow-sm transform group-hover/section:rotate-6 transition-transform duration-500"><Users size={20} /></div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">1. Identidad y Asignación</h3>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Información personal básica y perfil digital</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                                        {/* Profile Pic & CV Section */}
                                        <div className="lg:col-span-3 flex flex-col items-center gap-8 border-r border-slate-50 pr-12">
                                            <div className="relative group/avatar">
                                                <div className="w-40 h-40 rounded-[3rem] bg-slate-50 border-[6px] border-white shadow-2xl overflow-hidden flex items-center justify-center transition-all duration-500 group-hover/avatar:scale-[1.02] group-hover/avatar:rotate-2 group-hover/avatar:shadow-indigo-200/50">
                                                    {form.profilePic ? (
                                                        <img src={form.profilePic} alt="Profile" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-2">
                                                            <User size={56} className="text-slate-200" />
                                                        </div>
                                                    )}
                                                </div>
                                                <label className="absolute -bottom-2 -right-2 p-3.5 bg-indigo-600 text-white rounded-2xl shadow-xl cursor-pointer hover:bg-indigo-700 transition-all hover:scale-110 active:scale-95 border-[4px] border-white z-10">
                                                    <Plus size={18} />
                                                    <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                                                </label>
                                                <div className="absolute inset-0 rounded-[3rem] bg-indigo-600/0 group-hover/avatar:bg-indigo-600/5 transition-colors duration-500 pointer-events-none" />
                                            </div>

                                            <div className="w-full space-y-4">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Gestión Documental</p>
                                                <label className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed border-slate-100 rounded-[2rem] hover:border-indigo-300 hover:bg-indigo-50/20 transition-all cursor-pointer group/cv group-active:scale-[0.98]">
                                                    <div className={`p-3 rounded-xl transition-all duration-500 ${form.cvUrl ? 'bg-emerald-50 text-emerald-600 shadow-emerald-100' : 'bg-slate-50 text-slate-400 group-hover/cv:bg-indigo-50 group-hover/cv:text-indigo-600 shadow-sm'}`}>
                                                        <FileText size={22} />
                                                    </div>
                                                    <span className={`text-[9px] font-black uppercase tracking-widest mt-4 transition-all ${form.cvUrl ? 'text-emerald-600' : 'text-slate-400 group-hover/cv:text-indigo-600'}`}>
                                                        {form.cvUrl ? 'Currículum Cargado' : 'Subir Currículum'}
                                                    </span>
                                                    <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleCVChange} />
                                                </label>
                                            </div>
                                        </div>

                                        {/* Fields Section */}
                                        <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-4 gap-x-8 gap-y-10">
                                            {/* Row 1: RUT and Full Name */}
                                            <div className="md:col-span-1 group/field">
                                                <label className="label-premium"><Globe size={14} className="text-indigo-400" /> RUT / ID *</label>
                                                <div className="relative">
                                                    <input
                                                        required
                                                        className={`input-rrhh ${form.rut && !validateRut(form.rut) ? '!border-rose-300 !bg-rose-50/30' : ''}`}
                                                        placeholder="12.345.678-9"
                                                        value={form.rut}
                                                        onChange={e => setForm({ ...form, rut: formatRut(e.target.value) })}
                                                    />
                                                    {form.rut && validateRut(form.rut) && <CheckCircle2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500" />}
                                                </div>
                                                {form.rut && !validateRut(form.rut) && (
                                                    <span className="text-[9px] font-black text-rose-500 uppercase mt-2 ml-1 flex items-center gap-1 animate-in slide-in-from-top-1">
                                                        <AlertCircle size={10} /> RUT Inválido
                                                    </span>
                                                )}
                                            </div>
                                            <div className="md:col-span-3 group/field">
                                                <label className="label-premium"><UserPlus size={14} className="text-indigo-400" /> Nombre Completo (Visualización) *</label>
                                                <input required className="input-rrhh" placeholder="EJ: PEDRO ALFONSO MARTÍNEZ" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />
                                            </div>

                                            {/* Row 2: Birth Date, Age, Nationality, Civil State */}
                                            <div className="group/field">
                                                <label className="label-premium"><Calendar size={14} className="text-indigo-400" /> Nacimiento</label>
                                                <input type="date" className="input-rrhh" value={form.fechaNacimiento} onChange={e => setForm({ ...form, fechaNacimiento: e.target.value })} />
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">Edad</label>
                                                <div className="h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-500 text-xs tracking-widest shadow-inner">
                                                    {calculateAge(form.fechaNacimiento) || '--'} AÑOS
                                                </div>
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium"><Globe size={14} className="text-indigo-400" /> Nacionalidad</label>
                                                <select className="input-rrhh" value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })}>
                                                    {NACIONALIDADES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                                                </select>
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium">Género</label>
                                                <select className="input-rrhh" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                                                    <option value="No Informado">No Informado</option>
                                                    <option value="Masculino">Masculino</option>
                                                    <option value="Femenino">Femenino</option>
                                                    <option value="Otro">Otro</option>
                                                </select>
                                            </div>

                                            {/* Row 3: Civil State, Birth Place, ID Expiry */}
                                            <div className="group/field">
                                                <label className="label-premium"><Heart size={14} className="text-indigo-400" /> Estado Civil</label>
                                                <select className="input-rrhh" value={form.estadoCivil} onChange={e => setForm({ ...form, estadoCivil: e.target.value })}>
                                                    <option value="">Seleccione...</option>
                                                    {ESTADO_CIVIL.map(e => <option key={e} value={e}>{e}</option>)}
                                                </select>
                                            </div>
                                            <div className="md:col-span-2 group/field">
                                                <label className="label-premium"><MapPin size={14} className="text-indigo-400" /> Lugar de Nacimiento</label>
                                                <input className="input-rrhh" placeholder="EJ: SANTIAGO, CHILE" value={form.birthPlace} onChange={e => setForm({ ...form, birthPlace: e.target.value })} />
                                            </div>
                                            <div className="group/field">
                                                <label className="label-premium"><ShieldCheck size={14} className="text-indigo-500" /> Vencimiento Cédula / Pasaporte</label>
                                                <input type="date" className="input-rrhh" value={form.idExpiryDate} onChange={e => setForm({ ...form, idExpiryDate: e.target.value })} />
                                            </div>

                                            {/* Row 3: Position and Education Level Selection */}
                                            <div className="md:col-span-2">
                                                <label className="label-premium"><Briefcase size={14} className="text-indigo-500" /> {registrationType === 'colaborador' ? 'Cargo del Colaborador *' : 'Cargo a Postular *'}</label>
                                                <select required className="input-rrhh font-black uppercase text-indigo-600 bg-indigo-50/30 border-indigo-100" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}>
                                                    <option value="">— SELECCIONAR CARGO —</option>
                                                    {companyConfig.cargos.map(c => (
                                                        <option key={typeof c === 'string' ? c : c.nombre} value={typeof c === 'string' ? c : c.nombre}>
                                                            {typeof c === 'string' ? c : `${c.nombre} (${c.categoria})`}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="label-premium"><GraduationCap size={14} className="text-indigo-500" /> Nivel Educacional / Título</label>
                                                <select className="input-rrhh font-black uppercase text-indigo-600 bg-indigo-50/30 border-indigo-100" value={form.educationLevel} onChange={e => setForm({ ...form, educationLevel: e.target.value })}>
                                                    <option value="">— SELECCIONAR NIVEL —</option>
                                                    {NIVELES_EDUCACIONALES.map(n => <option key={n} value={n}>{n}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Section Navigation Buttons */}
                                <div className="mt-12 flex items-center justify-between border-t border-slate-100 pt-10">
                                    <div /> {/* Spacer */}
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('contacto')}
                                        className="flex items-center gap-3 px-10 py-5 bg-amber-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-amber-200 hover:-translate-y-1 transition-all active:scale-95 group"
                                    >
                                        Siguiente Paso
                                        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'contacto' && (
                            <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                                {/* SECTION 2: CONTACTO Y DOMICILIO */}
                                <section className="section-card-premium group/section">
                                    <div className="flex items-center gap-3 border-b border-slate-50 pb-4 mb-2 text-sky-600">
                                        <div className="p-2 bg-sky-50 text-sky-600 rounded-xl shadow-sm transform group-hover/section:rotate-6 transition-transform duration-500"><MapPin size={20} /></div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">2. Contacto y Domicilio</h3>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Ubicación y medios de comunicación</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                                        <div className="md:col-span-2 group/field">
                                            <label className="label-premium"><Mail size={14} className="text-sky-500" /> Correo Electrónico Principal</label>
                                            <input type="email" className="input-rrhh" placeholder="nombre@dominio.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                                        </div>
                                        <div className="group/field">
                                            <label className="label-premium"><Phone size={14} className="text-sky-500" /> Teléfono Móvil</label>
                                            <input className="input-rrhh" placeholder="+56 9 1234 5678" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                                        </div>
                                        <div className="md:col-span-2 group/field">
                                            <label className="label-premium"><MapPin size={14} className="text-sky-500" /> Calle / Avenida / Pasaje</label>
                                            <input className="input-rrhh" placeholder="Ej: Avenida Siempre Viva" value={form.calle} onChange={e => setForm({ ...form, calle: e.target.value })} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-6 group/field">
                                            <div>
                                                <label className="label-premium">Número</label>
                                                <input className="input-rrhh" placeholder="123" value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="label-premium">Block / Depto</label>
                                                <input className="input-rrhh" placeholder="A-402" value={form.deptoBlock} onChange={e => setForm({ ...form, deptoBlock: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="group/field">
                                            <label className="label-premium"><Globe size={14} className="text-sky-400" /> Región</label>
                                            <select className="input-rrhh" value={form.region} onChange={e => {
                                                const reg = REGIONES_DE_CHILE.find(r => r.name === e.target.value);
                                                setForm({ ...form, region: e.target.value, comuna: reg?.communes[0] || '' });
                                            }}>
                                                <option value="">— SELECCIONAR REGIÓN —</option>
                                                {REGIONES_DE_CHILE.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="group/field">
                                            <label className="label-premium"><MapPin size={14} className="text-sky-400" /> Comuna</label>
                                            <select className="input-rrhh" value={form.comuna} onChange={e => setForm({ ...form, comuna: e.target.value })}>
                                                <option value="">— SELECCIONAR COMUNA —</option>
                                                {REGIONES_DE_CHILE.find(r => r.name === form.region)?.communes.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </section>

                                {/* SECTION 4: EMERGENCIAS */}
                                <section className="section-card-premium group/section">
                                    <div className="flex items-center gap-3 border-b border-slate-50 pb-4 mb-2">
                                        <div className="p-2 bg-rose-50 text-rose-600 rounded-xl shadow-sm transform group-hover/section:rotate-6 transition-transform duration-500"><Phone size={20} /></div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">4. Emergencias</h3>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Contactos en caso de urgencia</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                                        <div className="group/field">
                                            <label className="label-premium"><User size={14} className="text-rose-400" /> Contacto de Emergencia</label>
                                            <input className="input-rrhh" placeholder="Nombre completo" value={form.emergencyContact} onChange={e => setForm({ ...form, emergencyContact: e.target.value })} />
                                        </div>
                                        <div className="group/field">
                                            <label className="label-premium"><Phone size={14} className="text-rose-400" /> Celular de Emergencia</label>
                                            <input className="input-rrhh" placeholder="+56 9 ..." value={form.emergencyPhone} onChange={e => setForm({ ...form, emergencyPhone: e.target.value })} />
                                        </div>
                                        <div className="group/field">
                                            <label className="label-premium"><Mail size={14} className="text-rose-400" /> Correo Electrónico</label>
                                            <input type="email" className="input-rrhh" placeholder="correo@emergencia.cl" value={form.emergencyEmail} onChange={e => setForm({ ...form, emergencyEmail: e.target.value })} />
                                        </div>
                                    </div>
                                </section>

                                {/* Section Navigation Buttons */}
                                <div className="mt-12 flex items-center justify-between border-t border-slate-100 pt-10">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('institucional')}
                                        className="flex items-center gap-3 px-10 py-5 bg-white border-2 border-slate-100 text-slate-400 hover:text-sky-600 hover:border-sky-100 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 group"
                                    >
                                        <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                                        Anterior
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('laboral')}
                                        className="flex items-center gap-3 px-10 py-5 bg-sky-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-sky-200 hover:-translate-y-1 transition-all active:scale-95 group"
                                    >
                                        Siguiente Paso
                                        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'laboral' && (
                            <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                                {/* SECTION 3: INFORMACIÓN DEL CONTRATO */}
                                <section className="section-card-premium group/section">
                                    <div className="flex items-center justify-between border-b border-slate-50 pb-4 mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-violet-50 text-violet-600 rounded-xl shadow-sm transform group-hover/section:rotate-6 transition-transform duration-500"><FileText size={20} /></div>
                                            <div>
                                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">3. Información del Contrato</h3>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Definición de términos y plazos laborales</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 p-1.5 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                                            <div className={`w-3.5 h-3.5 rounded-full shadow-lg transition-all duration-500 ${form.contractType === 'PLAZO FIJO' && form.contractStep === 1 ? 'bg-yellow-400 shadow-yellow-200 scale-125' : 'bg-slate-200'}`} title="Primer Plazo Fijo"></div>
                                            <div className={`w-3.5 h-3.5 rounded-full shadow-lg transition-all duration-500 ${form.contractType === 'PLAZO FIJO' && form.contractStep === 2 ? 'bg-orange-400 shadow-orange-200 scale-125' : 'bg-slate-200'}`} title="Segundo Anexo Plazo Fijo"></div>
                                            <div className={`w-3.5 h-3.5 rounded-full shadow-lg transition-all duration-500 ${form.contractType === 'INDEFINIDO' ? 'bg-emerald-500 shadow-emerald-200 scale-125' : 'bg-slate-200'}`} title="Indefinido"></div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
                                        <div className="group/field">
                                            <label className="label-premium">Esquema Contractual</label>
                                            <select className="input-rrhh !bg-violet-50/50 !border-violet-100 !text-violet-900" value={form.contractType} onChange={e => setForm({ ...form, contractType: e.target.value })}>
                                                {TIPOS_CONTRATO.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div className="group/field">
                                            <label className="label-premium"><Calendar size={14} className="text-violet-400" /> Fecha Efectiva Inicio</label>
                                            <input type="date" className="input-rrhh" value={form.contractStartDate} onChange={e => setForm({ ...form, contractStartDate: e.target.value })} />
                                        </div>
                                        <div className="group/field">
                                            <label className={`label-premium ${form.contractType === 'INDEFINIDO' ? 'opacity-40' : ''}`}><Clock size={14} className="text-violet-400" /> Duración Pactada (Meses)</label>
                                            <input
                                                type="number"
                                                className={`input-rrhh ${form.contractType === 'INDEFINIDO' ? '!bg-slate-50 !border-slate-100 cursor-not-allowed opacity-50' : ''}`}
                                                placeholder={form.contractType === 'INDEFINIDO' ? 'No aplica' : 'Ej: 3'}
                                                disabled={form.contractType === 'INDEFINIDO'}
                                                value={form.contractDurationMonths}
                                                onChange={e => setForm({ ...form, contractDurationMonths: e.target.value })}
                                            />
                                        </div>
                                        <div className="group/field">
                                            <label className="label-premium">Término proyectado</label>
                                            <div className="h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center font-black text-violet-600 text-xs tracking-widest shadow-inner">
                                                {form.contractEndDate || '-- / -- / --'}
                                            </div>
                                        </div>

                                        <div className="md:col-span-2 bg-violet-50/20 p-8 rounded-[2.5rem] border border-violet-100/50 group/next">
                                            <label className="label-premium !text-violet-700">Descripción Próximo Hito</label>
                                            <div className="flex items-center gap-4">
                                                <div className="flex-1 bg-white px-6 py-4 rounded-2xl border-2 border-dashed border-violet-100 text-[10px] font-black text-violet-600 uppercase shadow-sm">
                                                    {form.nextAddendumDescription}
                                                </div>
                                                <div className="w-40 group/field">
                                                    <label className={`text-[10px] font-black text-violet-400 uppercase mb-2 block tracking-widest ${form.contractType === 'INDEFINIDO' ? 'opacity-40' : ''}`}>Etapa Actual</label>
                                                    <select
                                                        className={`input-rrhh !h-12 !py-0 text-[10px] font-black uppercase ${form.contractType === 'INDEFINIDO' ? '!bg-slate-50 !border-slate-100 cursor-not-allowed opacity-50' : ''}`}
                                                        value={form.contractStep}
                                                        disabled={form.contractType === 'INDEFINIDO'}
                                                        onChange={e => setForm({ ...form, contractStep: parseInt(e.target.value) })}
                                                    >
                                                        <option value={1}>1º Contrato</option>
                                                        <option value={2}>2º Anexo</option>
                                                        <option value={3}>Indefinido</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="md:col-span-2 group/field">
                                            <label className="label-premium">Sugerencia de Próximo Anexo</label>
                                            <div className="h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center px-6 font-black text-slate-500 text-xs tracking-widest shadow-inner">
                                                {form.nextAddendumDate || 'NO REQUERIDO'}
                                            </div>
                                            <p className="text-[9px] text-slate-400 mt-3 italic font-bold uppercase tracking-tighter">Cálculo automático según vigencia del periodo actual.</p>
                                        </div>
                                    </div>
                                </section>


                                {/* ELIMINADAS SECCIONES EDUCACIÓN DETALLADA Y TRAYECTORIA LABORAL */}

                                {/* SECTION 6: INFORMACIÓN BANCARIA */}
                                <section className="section-card-premium group/section">
                                    <div className="flex items-center gap-3 border-b border-slate-50 pb-4 mb-2">
                                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shadow-sm transform group-hover/section:rotate-6 transition-transform duration-500"><Landmark size={20} /></div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">6. Información Bancaria</h3>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Gestión de depósitos y nómina</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                                        <div className="group/field">
                                            <label className="label-premium"><Landmark size={14} className="text-emerald-500" /> Institución Bancaria</label>
                                            <select className="input-rrhh" value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })}>
                                                <option value="">Seleccione Banco...</option>
                                                {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                                            </select>
                                        </div>
                                        <div className="group/field">
                                            <label className="label-premium"><CreditCard size={14} className="text-emerald-500" /> Tipo de Cuenta</label>
                                            <select className="input-rrhh" value={form.tipoCuenta} onChange={e => setForm({ ...form, tipoCuenta: e.target.value })}>
                                                <option value="">Seleccione...</option>
                                                {TIPOS_CUENTA.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div className="group/field">
                                            <label className="label-premium"><Hash size={14} className="text-emerald-500" /> Número de Cuenta</label>
                                            <input className="input-rrhh" placeholder="Ej: 12345678" value={form.numeroCuenta} onChange={e => setForm({ ...form, numeroCuenta: e.target.value })} />
                                        </div>
                                    </div>
                                </section>

                                {/* SECTION 8: REMUNERACIÓN Y BONOS */}
                                <section className="section-card-premium group/section">
                                    <div className="flex items-center gap-3 border-b border-slate-50 pb-4 mb-2">
                                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shadow-sm transform group-hover/section:rotate-6 transition-transform duration-500"><DollarSign size={20} /></div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">8. Remuneración y Bonos</h3>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Configuración salarial y beneficios</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                                        <div className="md:col-span-1 bg-emerald-50/20 p-8 rounded-[2.5rem] border border-emerald-100/50 h-fit group/field">
                                            <label className="label-premium !text-emerald-700 font-black"><DollarSign size={14} /> Sueldo Base Líquido</label>
                                            <div className="relative mt-2">
                                                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-2xl group-focus-within/field:scale-110 transition-transform">$</span>
                                                <input type="number" className="input-rrhh !bg-white !pl-12 !text-2xl !font-black !text-emerald-700 !h-20 shadow-sm border-2 focus:border-emerald-500" value={form.sueldoBase} onChange={e => setForm({ ...form, sueldoBase: e.target.value })} />
                                            </div>
                                            <p className="text-[9px] text-emerald-600/60 mt-3 font-bold uppercase tracking-tighter">Monto acordado para pago mensual neto.</p>
                                        </div>

                                        <div className="md:col-span-2 space-y-8">
                                            <div className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100 group/bonos">
                                                <div className="flex items-center justify-between mb-6">
                                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                                                        <Award size={18} className="text-emerald-500" /> Asignación de Bonos
                                                    </h4>
                                                    {bonusTemp.type && (
                                                        <div className="flex items-center gap-2 animate-in fade-in zoom-in text-[9px] font-black uppercase text-emerald-600 bg-white px-3 py-1 rounded-full border border-emerald-100 shadow-sm">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${bonusTemp.isImponible ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                                            {bonusTemp.isImponible ? 'Imponible' : 'No Imponible'}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                                                    <div className="group/field">
                                                        <label className="label-premium">Categoría de Bono</label>
                                                        <select
                                                            className="input-rrhh !h-14 font-black uppercase text-[10px]"
                                                            value={bonusTemp.type}
                                                            onChange={e => {
                                                                const selected = TIPOS_BONOS.find(b => b.type === e.target.value);
                                                                setBonusTemp({ ...bonusTemp, type: e.target.value, isImponible: selected?.isImponible ?? true });
                                                            }}
                                                        >
                                                            <option value="">SELECCIONE...</option>
                                                            {TIPOS_BONOS.map(b => <option key={b.type} value={b.type}>{b.type}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="flex gap-3">
                                                        <div className="flex-1 group/field">
                                                            <label className="label-premium">{bonusTemp.type === 'Metas / Productividad' ? 'Descripción de Metas' : 'Monto Valor'}</label>
                                                            {bonusTemp.type === 'Metas / Productividad' ? (
                                                                <input className="input-rrhh !h-14 !py-0 text-[11px]" placeholder="Ej: Cumplimiento 100% KPI" value={bonusTemp.description} onChange={e => setBonusTemp({ ...bonusTemp, description: e.target.value })} />
                                                            ) : (
                                                                <input type="number" className="input-rrhh !h-14 !py-0 font-black text-emerald-700" placeholder="$" value={bonusTemp.amount} onChange={e => setBonusTemp({ ...bonusTemp, amount: e.target.value })} />
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={handleBonusAdd}
                                                            className="h-14 w-14 bg-emerald-600 text-white rounded-[1.25rem] hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center shrink-0 active:scale-90"
                                                        >
                                                            <Plus size={24} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                {form.bonuses.map((b, idx) => (
                                                    <div key={idx} className="flex items-center justify-between bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all group/item animate-in slide-in-from-left-4">
                                                        <div className="flex items-center gap-5">
                                                            <div className={`p-3 rounded-2xl transition-all group-hover/item:rotate-12 ${b.isImponible ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                                <Award size={20} />
                                                            </div>
                                                            <div>
                                                                <p className="text-[11px] font-black text-slate-800 uppercase tracking-wider">{b.type}</p>
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{b.isImponible ? 'Registro Imponible' : 'Registro No Imponible'}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-6">
                                                            <span className="font-black text-slate-900 text-sm">
                                                                {b.type === 'Metas / Productividad' ? (
                                                                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 font-bold uppercase tracking-tighter max-w-[180px] truncate block">{b.description}</span>
                                                                ) : (
                                                                    `$${Number(b.amount).toLocaleString('es-CL')}`
                                                                )}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleBonusRemove(idx)}
                                                                className="p-2 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                                            >
                                                                <X size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}

                                                {form.bonuses.length > 0 && (
                                                    <div className="flex justify-between items-center px-8 py-6 bg-slate-900 rounded-[2.5rem] shadow-xl group/total overflow-hidden relative">
                                                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">Total Consolidado</span>
                                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Suma de bonificaciones activas</span>
                                                        </div>
                                                        <span className="text-2xl font-black text-white tracking-tighter relative z-10 transition-all group-hover/total:scale-110">
                                                            ${form.bonuses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0).toLocaleString('es-CL')}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Section Navigation Buttons */}
                                <div className="mt-12 flex items-center justify-between border-t border-slate-100 pt-10">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('contacto')}
                                        className="flex items-center gap-3 px-10 py-5 bg-white border-2 border-slate-100 text-slate-400 hover:text-violet-600 hover:border-violet-100 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 group"
                                    >
                                        <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                                        Anterior
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('salud')}
                                        className="flex items-center gap-3 px-10 py-5 bg-violet-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-violet-200 hover:-translate-y-1 transition-all active:scale-95 group"
                                    >
                                        Siguiente Paso
                                        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'salud' && (
                            <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                                {/* SECTION 5: PREVISIÓN Y SALUD */}
                                <section className="section-card-premium group/section">
                                    <div className="flex items-center gap-3 border-b border-slate-50 pb-4 mb-2">
                                        <div className="p-2 bg-rose-50 text-rose-600 rounded-xl shadow-sm transform group-hover/section:rotate-6 transition-transform duration-500"><ShieldCheck size={20} /></div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">5. Previsión y Salud</h3>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Seguridad social y bienestar físico</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
                                        <div className="group/field">
                                            <label className="label-premium"><Activity size={14} className="text-rose-500" /> Sistema Salud (Isapre/Fonasa)</label>
                                            <select className="input-rrhh" value={form.previsionSalud} onChange={e => setForm({ ...form, previsionSalud: e.target.value })}>
                                                {ISAPRES.map(i => <option key={i} value={i}>{i}</option>)}
                                            </select>
                                        </div>
                                        {form.previsionSalud !== 'FONASA' && (
                                            <div className="md:col-span-2 group/field">
                                                <label className="label-premium">Pactación Valor Plan</label>
                                                <div className="flex gap-4">
                                                    <div className="flex-[3]">
                                                        <input type="number" className="input-rrhh" placeholder="Monto" value={form.valorPlan} onChange={e => setForm({ ...form, valorPlan: e.target.value })} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <select className="input-rrhh font-black text-rose-600 bg-rose-50 border-rose-100" value={form.monedaPlan} onChange={e => setForm({ ...form, monedaPlan: e.target.value })}>
                                                            <option value="UF">UF</option>
                                                            <option value="CLP">$</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="group/field">
                                            <label className="label-premium"><ShieldCheck size={14} className="text-rose-500" /> Administradora AFP</label>
                                            <select className="input-rrhh" value={form.afp} onChange={e => setForm({ ...form, afp: e.target.value })}>
                                                <option value="">Seleccione AFP...</option>
                                                {AFPS.map(a => <option key={a} value={a}>{a}</option>)}
                                            </select>
                                        </div>
                                        <div className="group/field">
                                            <label className="label-premium">Situación Jubilado</label>
                                            <select className="input-rrhh" value={form.pensionado} onChange={e => setForm({ ...form, pensionado: e.target.value })}>
                                                <option value="NO">No Jubilado</option>
                                                <option value="SI">PENSIONADO</option>
                                            </select>
                                        </div>
                                        <div className="group/field">
                                            <label className="label-premium">Grupo Sanguíneo</label>
                                            <select className="input-rrhh" value={form.bloodType} onChange={e => setForm({ ...form, bloodType: e.target.value })}>
                                                <option value="">Seleccione...</option>
                                                {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div className="md:col-span-2 group/field">
                                            <label className="label-premium">Alergias Conocidas</label>
                                            <input className="input-rrhh" placeholder="Ej: Penicilina, alimentos, etc." value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} />
                                        </div>
                                        <div className="md:col-span-2 group/field">
                                            <label className="label-premium">Patologías Crónicas</label>
                                            <input className="input-rrhh" placeholder="Ej: Hipertensión, Diabetes..." value={form.chronicDiseases} onChange={e => setForm({ ...form, chronicDiseases: e.target.value })} />
                                        </div>
                                        <div className="md:col-span-1 bg-indigo-50/20 p-5 rounded-[2rem] border border-indigo-100 flex flex-col justify-center">
                                            <label className="flex items-center gap-4 cursor-pointer group/check">
                                                <input type="checkbox" className="w-6 h-6 rounded-[0.5rem] border-2 border-indigo-200 text-indigo-600 focus:ring-0 transition-all cursor-pointer bg-white" checked={form.hasDisability} onChange={e => setForm({ ...form, hasDisability: e.target.checked })} />
                                                <span className="text-[10px] font-black text-indigo-800 uppercase tracking-[0.1em] group-hover/check:text-indigo-600 transition-colors">¿Discapacidad?</span>
                                            </label>
                                        </div>
                                        {form.hasDisability && (
                                            <div className="md:col-span-1 group/field animate-in zoom-in-95 duration-300">
                                                <label className="label-premium">Detalle de Discapacidad</label>
                                                <input className="input-rrhh" placeholder="Ej: Visual, Motriz..." value={form.disabilityType} onChange={e => setForm({ ...form, disabilityType: e.target.value })} />
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-12 pt-10 border-t border-slate-50">
                                        <div className="flex items-center justify-between mb-8">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl"><Users size={18} /></div>
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Gestión de Cargas Familiares</h4>
                                            </div>
                                            <select className="input-rrhh !w-32 !h-10 !py-0 !text-[10px]" value={form.tieneCargas} onChange={e => setForm({ ...form, tieneCargas: e.target.value })}>
                                                <option value="NO">SIN CARGAS</option>
                                                <option value="SI">CON CARGAS</option>
                                            </select>
                                        </div>

                                        {form.tieneCargas === 'SI' && (
                                            <div className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100 space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                                                    <div className="group/field">
                                                        <label className="label-premium">RUT Carga</label>
                                                        <input className={`input-rrhh !h-12 !py-0 text-xs ${cargaTemp.rut && !validateRut(cargaTemp.rut) ? '!border-rose-400 !bg-rose-50 text-rose-600' : ''}`} placeholder="RUT" value={cargaTemp.rut} onChange={e => setCargaTemp({ ...cargaTemp, rut: formatRut(e.target.value) })} />
                                                    </div>
                                                    <div className="md:col-span-1 group/field">
                                                        <label className="label-premium">Nombre</label>
                                                        <input className="input-rrhh !h-12 !py-0 text-xs" placeholder="Nombre completo" value={cargaTemp.nombre} onChange={e => setCargaTemp({ ...cargaTemp, nombre: e.target.value })} />
                                                    </div>
                                                    <div className="group/field">
                                                        <label className="label-premium">F. Nac.</label>
                                                        <input type="date" className="input-rrhh !h-12 !py-0 text-xs" value={cargaTemp.fechaNacimiento || ''} onChange={e => setCargaTemp({ ...cargaTemp, fechaNacimiento: e.target.value })} />
                                                    </div>
                                                    <div className="flex gap-3">
                                                        <div className="flex-1 group/field">
                                                            <label className="label-premium">Vínculo</label>
                                                            <input className="input-rrhh !h-12 !py-0 text-xs" placeholder="Ej: Hijo" value={cargaTemp.parentesco} onChange={e => setCargaTemp({ ...cargaTemp, parentesco: e.target.value })} />
                                                        </div>
                                                        <button type="button" onClick={handleCargaAdd} className="h-12 w-12 bg-rose-500 text-white rounded-2xl hover:bg-rose-600 transition-all flex items-center justify-center shadow-lg shadow-rose-100 shrink-0"><Plus size={20} /></button>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-3 pt-2">
                                                    {form.listaCargas.map((c, idx) => (
                                                        <div key={idx} className="flex items-center gap-4 bg-white px-5 py-3 rounded-2xl border border-rose-100 shadow-sm text-xs font-bold text-slate-700 animate-in zoom-in-95 group/tag hover:border-rose-300 transition-all">
                                                            <div className="flex flex-col">
                                                                <span>{c.nombre}</span>
                                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{c.parentesco}</span>
                                                            </div>
                                                            <button type="button" onClick={() => handleCargaRemove(idx)} className="p-1.5 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><X size={16} /></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* Section Navigation Buttons */}
                                <div className="mt-12 flex items-center justify-between border-t border-slate-100 pt-10">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('laboral')}
                                        className="flex items-center gap-3 px-10 py-5 bg-white border-2 border-slate-100 text-slate-400 hover:text-rose-600 hover:border-rose-100 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 group"
                                    >
                                        <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                                        Anterior
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('requisitos')}
                                        className="flex items-center gap-3 px-10 py-5 bg-rose-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-rose-200 hover:-translate-y-1 transition-all active:scale-95 group"
                                    >
                                        Siguiente Paso
                                        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'requisitos' && (
                            <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                                {/* SECTION 7: OTROS REQUISITOS */}
                                <section className="section-card-premium group/section">
                                    <div className="flex items-center gap-3 border-b border-slate-50 pb-4 mb-2">
                                        <div className="p-2 bg-orange-50 text-orange-600 rounded-xl shadow-sm transform group-hover/section:rotate-6 transition-transform duration-500"><Truck size={20} /></div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">7. Otros Requisitos</h3>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Equipamiento y documentación vial</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
                                        <div className="md:col-span-2 grid grid-cols-2 gap-8 border-r border-slate-50 pr-8">
                                            <div className="group/field">
                                                <label className="label-premium font-black text-[10px] tracking-widest flex items-center gap-2"><Truck size={14} className="text-orange-400" /> Licencia Conducir</label>
                                                <select className="input-rrhh" value={form.requiereLicencia} onChange={e => setForm({ ...form, requiereLicencia: e.target.value })}>
                                                    <option value="NO">NO REQUERIDA</option>
                                                    <option value="SI">SI REQUERIDA</option>
                                                </select>
                                            </div>
                                            {form.requiereLicencia === 'SI' && (
                                                <div className="group/field animate-in slide-in-from-left-4 duration-300">
                                                    <label className="label-premium">Vencimiento</label>
                                                    <input type="date" className="input-rrhh" value={form.fechaVencimientoLicencia} onChange={e => setForm({ ...form, fechaVencimientoLicencia: e.target.value })} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="md:col-span-2 space-y-6">
                                            <div className="flex items-center gap-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-2">
                                                <ShieldCheck size={16} className="text-orange-400" /> Tallas de Equipamiento (EPP)
                                            </div>
                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                                <div className="group/field">
                                                    <label className="label-premium !text-[9px]">Camisa</label>
                                                    <input className="input-rrhh uppercase text-center font-black !h-12" placeholder="S/M/L" value={form.shirtSize} onChange={e => setForm({ ...form, shirtSize: e.target.value })} />
                                                </div>
                                                <div className="group/field">
                                                    <label className="label-premium !text-[9px]">Pantalón</label>
                                                    <input className="input-rrhh uppercase text-center font-black !h-12" placeholder="42/44" value={form.pantsSize} onChange={e => setForm({ ...form, pantsSize: e.target.value })} />
                                                </div>
                                                <div className="group/field">
                                                    <label className="label-premium !text-[9px]">Chaqueta</label>
                                                    <input className="input-rrhh uppercase text-center font-black !h-12" placeholder="XL" value={form.jacketSize} onChange={e => setForm({ ...form, jacketSize: e.target.value })} />
                                                </div>
                                                <div className="group/field">
                                                    <label className="label-premium !text-[9px]">Calzado</label>
                                                    <input className="input-rrhh uppercase text-center font-black !h-12" placeholder="42" value={form.shoeSize} onChange={e => setForm({ ...form, shoeSize: e.target.value })} />
                                                </div>
                                            </div>

                                            <div className="pt-6 border-t border-slate-50 mt-4 group/field">
                                                <label className="label-premium flex items-center gap-2"><Briefcase size={14} className="text-orange-400" /> Situación Laboral Actual</label>
                                                <textarea
                                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-6 text-xs text-slate-700 outline-none focus:border-orange-500 focus:bg-white transition-all font-bold placeholder:text-slate-300 resize-none h-24"
                                                    placeholder="Breve descripción de su estado laboral actual (Ej: Cesante hace 1 mes, Trabajando con aviso)..."
                                                    value={form.currentWorkSituation}
                                                    onChange={e => setForm({ ...form, currentWorkSituation: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* SECTION 9: Cumplimiento (Compliance) */}
                                <section className="section-card-premium !bg-slate-900 border-none group/compliance relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-32 -mt-32" />
                                    <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-3 relative z-10">
                                        <div className="p-2 bg-white/10 text-indigo-400 rounded-xl shadow-sm transform group-hover/compliance:rotate-6 transition-transform duration-500"><AlertCircle size={20} /></div>
                                        <div>
                                            <h3 className="text-sm font-black text-white uppercase tracking-wider">9. Cumplimiento (Compliance)</h3>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Transparencia y conflicto de interés</p>
                                        </div>
                                    </div>
                                    <div className="space-y-8 p-1 relative z-10">
                                        <div className="flex items-center justify-between bg-white/5 p-8 rounded-[3rem] border border-white/10 shadow-inner group/toggle">
                                            <div className="flex items-center gap-6">
                                                <div className="p-4 bg-white/5 rounded-2xl text-slate-500 group-hover/toggle:text-indigo-400 transition-colors"><Users size={24} /></div>
                                                <div>
                                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] block mb-2">Declaración Familiar</span>
                                                    <p className="text-sm text-slate-300 font-bold">¿Mantiene relación con personal activo de la empresa?</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 p-2 bg-black/40 rounded-[2rem] border border-white/5 shadow-2xl">
                                                <button
                                                    type="button"
                                                    onClick={() => setForm({ ...form, conflictOfInterest: { ...form.conflictOfInterest, hasFamilyInCompany: true } })}
                                                    className={`px-10 py-4 rounded-2xl text-[10px] font-black uppercase transition-all duration-300 ${form.conflictOfInterest.hasFamilyInCompany ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-transparent text-slate-600 hover:text-slate-400'}`}
                                                >
                                                    Sí, Declaro
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setForm({ ...form, conflictOfInterest: { ...form.conflictOfInterest, hasFamilyInCompany: false, relationship: '', employeeName: '' } })}
                                                    className={`px-10 py-4 rounded-2xl text-[10px] font-black uppercase transition-all duration-300 ${!form.conflictOfInterest.hasFamilyInCompany ? 'bg-slate-700 text-white shadow-lg shadow-black' : 'bg-transparent text-slate-600 hover:text-slate-400'}`}
                                                >
                                                    No tengo
                                                </button>
                                            </div>
                                        </div>

                                        {form.conflictOfInterest.hasFamilyInCompany && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in fade-in slide-in-from-top-6 duration-700">
                                                <div className="group/field">
                                                    <label className="flex items-center gap-3 text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4 ml-1">
                                                        <Plus size={16} /> Grado de Vínculo
                                                    </label>
                                                    <input className="w-full bg-white/5 border-2 border-white/10 rounded-[2rem] px-8 py-5 text-sm text-white outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold placeholder:text-slate-700" placeholder="Ej: Hermano, Cónyuge" value={form.conflictOfInterest.relationship} onChange={e => setForm({ ...form, conflictOfInterest: { ...form.conflictOfInterest, relationship: e.target.value } })} />
                                                </div>
                                                <div className="group/field">
                                                    <label className="flex items-center gap-3 text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4 ml-1">
                                                        <UserPlus size={16} /> Nombre del Colaborador
                                                    </label>
                                                    <input className="w-full bg-white/5 border-2 border-white/10 rounded-[2rem] px-8 py-5 text-sm text-white outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold placeholder:text-slate-700" placeholder="Ingrese nombre completo" value={form.conflictOfInterest.employeeName} onChange={e => setForm({ ...form, conflictOfInterest: { ...form.conflictOfInterest, employeeName: e.target.value } })} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* Section Navigation Buttons - FINAL STEP */}
                                <div className="mt-12 flex items-center justify-between border-t border-white/10 pt-10 pb-6">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('salud')}
                                        className="flex items-center gap-3 px-10 py-5 bg-white/5 border-2 border-white/10 text-slate-400 hover:text-white hover:border-white/20 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 group"
                                    >
                                        <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                                        Anterior
                                    </button>

                                    <div className="flex gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowForm(false)}
                                            className="px-10 py-5 border-2 border-white/10 text-slate-500 hover:text-rose-400 hover:border-rose-500/50 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            onClick={handleSubmit}
                                            disabled={saving}
                                            className="flex items-center gap-4 px-12 py-5 bg-orange-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl shadow-orange-950/40 hover:-translate-y-1 transition-all active:scale-95 group border-t border-white/20"
                                        >
                                            {saving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                                            {editId ? 'Sincronizar Cambios' : 'Finalizar y Guardar'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Success Post-Save Modal Premium */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center z-[100] p-4 animate-in fade-in duration-500">
                    <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-700 border border-white/20">
                        <div className="p-12 text-center relative overflow-hidden">
                            {/* Decoración de fondo */}
                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
                            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl" />

                            <div className="relative z-10">
                                <div className="mb-8 mx-auto w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-emerald-500/40 animate-bounce">
                                    <CheckCircle2 size={48} strokeWidth={2.5} />
                                </div>
                                <h3 className="text-4xl font-black text-slate-800 tracking-tighter mb-4 leading-tight">
                                    ¡OPERACIÓN <br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">EXITOSA!</span>
                                </h3>
                                <p className="text-slate-500 text-[11px] font-black uppercase tracking-[0.2em] max-w-[320px] mx-auto leading-relaxed opacity-80">
                                    El registro de <span className="text-slate-800">{savedCandidate?.fullName}</span> <br />ha sido procesado en el núcleo GenAI.
                                </p>
                            </div>
                        </div>

                        <div className="px-12 pb-12 grid grid-cols-2 gap-4 relative z-10">
                            {[
                                { icon: Printer, label: 'Imprimir Ficha', color: 'amber', action: () => window.print() },
                                { icon: Download, label: 'Descargar PDF', color: 'rose', action: () => console.log('Export PDF') },
                                {
                                    icon: MessageCircle,
                                    label: 'Enviar WhatsApp',
                                    color: 'emerald',
                                    action: () => {
                                        const text = `Hola, envío ficha de captura de talento: ${savedCandidate?.fullName}`;
                                        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                                    }
                                },
                                {
                                    icon: Mail,
                                    label: 'Enviar Correo',
                                    color: 'indigo',
                                    action: () => {
                                        window.location.href = `mailto:?subject=Ficha Talento: ${savedCandidate?.fullName}&body=Adjunto información del registro.`;
                                    }
                                }
                            ].map((btn, idx) => (
                                <button
                                    key={idx}
                                    onClick={btn.action}
                                    className="flex flex-col items-center gap-3 p-6 bg-slate-50/50 hover:bg-white hover:shadow-2xl hover:scale-[1.02] border border-slate-100/50 rounded-[2.5rem] transition-all duration-300 group"
                                >
                                    <div className={`p-4 bg-white rounded-2xl shadow-sm text-slate-400 group-hover:text-${btn.color}-500 transition-colors duration-300`}>
                                        <btn.icon size={28} strokeWidth={1.5} />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500 group-hover:text-slate-800 uppercase tracking-widest transition-colors">{btn.label}</span>
                                </button>
                            ))}

                            <button
                                onClick={() => {
                                    setShowSuccessModal(false);
                                    setShowForm(false);
                                    setEditId(null);
                                    setForm(initialForm);
                                    setSavedCandidate(null);
                                }}
                                className="col-span-2 mt-4 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all"
                            >
                                Cerrar y Continuar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QuickView Modal */}
            {
                selectedCandidato && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedCandidato(null)}>
                        <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-500" onClick={e => e.stopPropagation()}>
                            <div className={`p-8 bg-gradient-to-br ${STATUS_COLORS[selectedCandidato.status].replace('bg-', 'from-').replace('text-', 'to-')} text-white relative`}>
                                <button onClick={() => setSelectedCandidato(null)} className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-all text-white">
                                    <X size={20} />
                                </button>
                                <div className="flex items-center gap-6">
                                    <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center font-black text-3xl shadow-xl">
                                        {selectedCandidato.fullName.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-black text-2xl uppercase tracking-tighter">{selectedCandidato.fullName}</h3>
                                        <p className="text-white/80 font-bold text-sm mt-1">{selectedCandidato.position}</p>
                                        <div className="flex gap-2 mt-3">
                                            <span className="px-3 py-1 bg-white/20 rounded-lg text-[9px] font-black uppercase tracking-widest">{selectedCandidato.status}</span>
                                            <span className="px-3 py-1 bg-white/20 rounded-lg text-[9px] font-black uppercase tracking-widest">{selectedCandidato.rut}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-10 grid grid-cols-2 gap-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-50 pb-2">Información de Contacto</h4>
                                    <div className="space-y-3">
                                        <div className="flex flex-col"><span className="text-[9px] font-bold text-slate-400 uppercase">Email</span><span className="font-bold text-slate-800 break-all">{selectedCandidato.email || '—'}</span></div>
                                        <div className="flex flex-col"><span className="text-[9px] font-bold text-slate-400 uppercase">Teléfono</span><span className="font-bold text-slate-800">{selectedCandidato.phone || '—'}</span></div>
                                        <div className="flex flex-col"><span className="text-[9px] font-bold text-slate-400 uppercase">Residencia</span><span className="font-bold text-slate-800">{selectedCandidato.address || '—'}</span></div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-50 pb-2">Proceso Operativo</h4>
                                    <div className="space-y-3">
                                        <div className="flex flex-col"><span className="text-[9px] font-bold text-slate-400 uppercase">CECO</span><span className="font-bold text-slate-800">{selectedCandidato.ceco || '—'}</span></div>
                                        <div className="flex flex-col"><span className="text-[9px] font-bold text-slate-400 uppercase">Área Operativa</span><span className="font-bold text-slate-800">{selectedCandidato.area || '—'}</span></div>
                                        <div className="flex flex-col"><span className="text-[9px] font-bold text-slate-400 uppercase">Nivel Educacional</span><span className="font-bold text-slate-800">{selectedCandidato.educationLevel || '—'}</span></div>
                                        <div className="flex flex-col"><span className="text-[9px] font-bold text-slate-400 uppercase">Origen</span><span className="font-bold text-slate-800">{selectedCandidato.source}</span></div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-8 border-t border-slate-50 flex justify-end">
                                <button onClick={() => setSelectedCandidato(null)} className="px-10 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">Entendido</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Splash Choice Modal */}
            {
                showChoiceModal && (
                    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
                        <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-500 border border-white/20">
                            <div className="p-10 bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-800 text-white relative">
                                <button onClick={() => setShowChoiceModal(false)} className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all">
                                    <X size={20} />
                                </button>
                                <div className="space-y-4">
                                    <div className="p-4 bg-white/10 w-fit rounded-3xl backdrop-blur-md border border-white/10">
                                        <UserPlus size={32} />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black tracking-tight uppercase">Portal de Ingreso</h2>
                                        <p className="text-indigo-100 font-bold text-sm mt-1 uppercase tracking-widest opacity-80">Selecciona el tipo de registro estratégico</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50">
                                <button
                                    onClick={() => {
                                        setRegistrationType('postulante');
                                        setForm(initialForm);
                                        setEditId(null);
                                        setShowChoiceModal(false);
                                        setShowForm(true);
                                    }}
                                    className="group p-8 bg-white border-2 border-slate-100 rounded-[2.5rem] text-left hover:border-indigo-500 hover:shadow-2xl hover:shadow-indigo-100 transition-all flex flex-col gap-4"
                                >
                                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all w-fit shadow-sm">
                                        <Users size={24} />
                                    </div>
                                    <div>
                                        <div className="font-black text-slate-800 uppercase tracking-wider text-sm group-hover:text-indigo-700 transition-colors">Postulante Nuevo</div>
                                        <p className="text-slate-400 text-xs mt-1 font-bold group-hover:text-slate-500 transition-colors">Registro para proceso de selección y contratación.</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => {
                                        setRegistrationType('colaborador');
                                        setForm({ ...initialForm, status: 'Contratado' });
                                        setEditId(null);
                                        setShowChoiceModal(false);
                                        setShowForm(true);
                                    }}
                                    className="group p-8 bg-white border-2 border-slate-100 rounded-[2.5rem] text-left hover:border-emerald-500 hover:shadow-2xl hover:shadow-emerald-100 transition-all flex flex-col gap-4"
                                >
                                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all w-fit shadow-sm">
                                        <CheckCircle2 size={24} />
                                    </div>
                                    <div>
                                        <div className="font-black text-slate-800 uppercase tracking-wider text-sm group-hover:text-emerald-700 transition-colors">Colaborador Contratado</div>
                                        <p className="text-slate-400 text-xs mt-1 font-bold group-hover:text-slate-500 transition-colors">Ingreso directo a la nómina de activos.</p>
                                    </div>
                                </button>
                            </div>
                            <div className="p-8 border-t border-slate-100 bg-white flex justify-center">
                                <button onClick={() => setShowChoiceModal(false)} className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 transition-colors">Volver al Dashboard</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal de Instrucciones Carga Masiva */}
            {
                showImportModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300 h-fit max-h-[95vh] flex flex-col">
                            <div className="p-8 bg-indigo-600 text-white flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white/20 rounded-2xl"><HelpCircle size={32} /></div>
                                    <div>
                                        <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Guía de Carga Masiva</h2>
                                        <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mt-1">Instrucciones para la administración</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-white/20 rounded-xl transition-colors"><X size={24} /></button>
                            </div>

                            <div className="p-10 overflow-y-auto flex-1 custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-8">
                                        <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100">
                                            <h3 className="flex items-center gap-2 text-indigo-900 font-black uppercase text-xs tracking-widest mb-4"><Info size={16} /> 1. Preparación del Archivo</h3>
                                            <p className="text-slate-600 text-sm leading-relaxed mb-4">Descargue la plantilla oficial. Esta incluye campos de lista validados y el formato de columnas correcto.</p>
                                            <button onClick={handleDownloadTemplate} className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-wider hover:underline"><Download size={14} /> Descargar Plantilla Oficial</button>
                                        </div>

                                        <div className="space-y-4">
                                            <h3 className="text-slate-800 font-black uppercase text-xs tracking-widest border-b border-slate-100 pb-2">Diferencia de Carga</h3>
                                            <div className="space-y-4">
                                                <div className="flex gap-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                                                    <div className="shrink-0 w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center"><Users size={20} /></div>
                                                    <div>
                                                        <h4 className="text-blue-900 font-black text-xs uppercase">Postulantes</h4>
                                                        <p className="text-blue-700/70 text-[10px] leading-relaxed mt-1">Cargue nuevos candidatos. Deben tener mínimo Nombre, RUT y Cargo.</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-4 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                                                    <div className="shrink-0 w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center"><UserCheck size={20} /></div>
                                                    <div>
                                                        <h4 className="text-emerald-900 font-black text-xs uppercase">Colaboradores Activos</h4>
                                                        <p className="text-emerald-700/70 text-[10px] leading-relaxed mt-1">Para personal ya contratado, asegúrese de llenar todos los campos de <b>Información del Contrato</b>.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 shadow-inner">
                                            <h3 className="text-slate-800 font-black uppercase text-xs tracking-widest mb-6">Tips de Registro</h3>
                                            <ul className="space-y-4">
                                                <li className="flex items-start gap-3">
                                                    <div className="mt-1"><ChevronRight size={14} className="text-indigo-500" /></div>
                                                    <div className="text-[11px] text-slate-600"><b className="text-slate-800 uppercase">Validaciones:</b> Los nombres de Bancos, AFPs e Isapres deben ser idénticos a los de la hoja "Ayuda".</div>
                                                </li>
                                                <li className="flex items-start gap-3">
                                                    <div className="mt-1"><ChevronRight size={14} className="text-indigo-500" /></div>
                                                    <div className="text-[11px] text-slate-600"><b className="text-slate-800 uppercase">RUT Chileno:</b> Se formatea automáticamente. Puede ingresar "12345678-k" y el sistema lo corregirá.</div>
                                                </li>
                                                <li className="flex items-start gap-3">
                                                    <div className="mt-1"><ChevronRight size={14} className="text-indigo-500" /></div>
                                                    <div className="text-[11px] text-slate-600"><b className="text-slate-800 uppercase">Tallas:</b> Ingrese los 4 tipos de tallas solicitadas para el equipo de protección.</div>
                                                </li>
                                                <li className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                                                    <div className="mt-1"><AlertCircle size={14} className="text-amber-600" /></div>
                                                    <div className="text-[10px] font-bold text-amber-800 uppercase tracking-tight">
                                                        <b>Nota Administrativa:</b> Si el RUT ya existe, el sistema actualizará el registro actual en lugar de crear uno nuevo.
                                                    </div>
                                                </li>
                                            </ul>
                                        </div>

                                        <div className="pt-6">
                                            <label className="flex items-center justify-center gap-4 w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all cursor-pointer shadow-xl shadow-slate-200 group">
                                                <Upload className="group-hover:scale-110 transition-transform" size={20} /> Seleccionar Archivo y Cargar
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept=".xlsx,.xls"
                                                    onChange={(e) => {
                                                        handleExcelImport(e);
                                                        setShowImportModal(false);
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-center items-center shrink-0">
                                <button onClick={() => setShowImportModal(false)} className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-indigo-600 transition-colors">Volver al Dashboard</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Print Section (Hidden in UI) */}
            <FichaManualPrint companyConfig={companyConfig} />
        </div >
    );
};

export default CapturaTalento;

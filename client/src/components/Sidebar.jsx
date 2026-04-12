import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Truck, Activity, Settings,
  LogOut, FileText, ChevronDown, ChevronRight,
  DollarSign, UserPlus, TrendingUp, SlidersHorizontal, MapPin,
  CheckSquare, CalendarCheck, CalendarClock, BookOpen,
  History, ShieldCheck, Fingerprint,
  Plane, ShieldAlert,
  Building2, ClipboardList, Shield, HardHat, AlertTriangle,
  ClipboardCheck, BarChart3, GraduationCap, PenTool,
  Crown, Home, Globe, FolderKanban, Plug, CreditCard, Network, MessageSquare, Package, ArrowRightLeft, Tags, ShoppingCart, Landmark, Database, Calculator, Receipt,
  PanelLeftClose, PanelLeftOpen, Bell, Coins, Brain
} from 'lucide-react';


import { useAuth } from '../platforms/auth/AuthContext';
import API_URL from '../config';
import { BRAND } from '../branding/brand';

/* ═══════════════════════════════════════════════════════════════
   COLOR THEME MAP
═══════════════════════════════════════════════════════════════ */
const THEME = {
  indigo: {
    bg: 'bg-indigo-600',
    bgLight: 'bg-indigo-50',
    bgSection: 'bg-indigo-50/60',
    border: 'border-indigo-400',
    borderLeft: 'border-l-indigo-400',
    text: 'text-indigo-700',
    textLight: 'text-indigo-500',
    iconBg: 'bg-indigo-600',
    hoverBg: 'hover:bg-indigo-50',
    active: 'bg-indigo-600 text-white shadow-md shadow-indigo-200',
    activePill: 'bg-indigo-100 text-indigo-700',
    ring: 'ring-indigo-200',
    gradient: 'from-indigo-500 to-indigo-700',
    badge: 'bg-indigo-600 text-white',
    tooltip: 'from-indigo-600 to-indigo-800',
  },
  violet: {
    bg: 'bg-violet-600',
    bgLight: 'bg-violet-50',
    bgSection: 'bg-violet-50/60',
    border: 'border-violet-400',
    borderLeft: 'border-l-violet-400',
    text: 'text-violet-700',
    textLight: 'text-violet-500',
    iconBg: 'bg-violet-600',
    hoverBg: 'hover:bg-violet-50',
    active: 'bg-violet-600 text-white shadow-md shadow-violet-200',
    activePill: 'bg-violet-100 text-violet-700',
    ring: 'ring-violet-200',
    gradient: 'from-violet-500 to-violet-700',
    badge: 'bg-violet-600 text-white',
    tooltip: 'from-violet-600 to-violet-800',
  },
  rose: {
    bg: 'bg-rose-600',
    bgLight: 'bg-rose-50',
    bgSection: 'bg-rose-50/60',
    border: 'border-rose-400',
    borderLeft: 'border-l-rose-400',
    text: 'text-rose-700',
    textLight: 'text-rose-500',
    iconBg: 'bg-rose-600',
    hoverBg: 'hover:bg-rose-50',
    active: 'bg-rose-600 text-white shadow-md shadow-rose-200',
    activePill: 'bg-rose-100 text-rose-700',
    ring: 'ring-rose-200',
    gradient: 'from-rose-500 to-rose-700',
    badge: 'bg-rose-600 text-white',
    tooltip: 'from-rose-600 to-rose-800',
  },
  sky: {
    bg: 'bg-sky-600',
    bgLight: 'bg-sky-50',
    bgSection: 'bg-sky-50/60',
    border: 'border-sky-400',
    borderLeft: 'border-l-sky-400',
    text: 'text-sky-700',
    textLight: 'text-sky-500',
    iconBg: 'bg-sky-600',
    hoverBg: 'hover:bg-sky-50',
    active: 'bg-sky-600 text-white shadow-md shadow-sky-200',
    activePill: 'bg-sky-100 text-sky-700',
    ring: 'ring-sky-200',
    gradient: 'from-sky-500 to-sky-700',
    badge: 'bg-sky-600 text-white',
    tooltip: 'from-sky-600 to-sky-800',
  },
  emerald: {
    bg: 'bg-emerald-600',
    bgLight: 'bg-emerald-50',
    bgSection: 'bg-emerald-50/60',
    border: 'border-emerald-400',
    borderLeft: 'border-l-emerald-400',
    text: 'text-emerald-700',
    textLight: 'text-emerald-500',
    iconBg: 'bg-emerald-600',
    hoverBg: 'hover:bg-emerald-50',
    active: 'bg-emerald-600 text-white shadow-md shadow-emerald-200',
    activePill: 'bg-emerald-100 text-emerald-700',
    ring: 'ring-emerald-200',
    gradient: 'from-emerald-500 to-emerald-700',
    badge: 'bg-emerald-600 text-white',
    tooltip: 'from-emerald-600 to-emerald-800',
  },
  orange: {
    bg: 'bg-orange-500',
    bgLight: 'bg-orange-50',
    bgSection: 'bg-orange-50/60',
    border: 'border-orange-400',
    borderLeft: 'border-l-orange-400',
    text: 'text-orange-700',
    textLight: 'text-orange-500',
    iconBg: 'bg-orange-500',
    hoverBg: 'hover:bg-orange-50',
    active: 'bg-orange-600 text-white shadow-md shadow-orange-200',
    activePill: 'bg-orange-100 text-orange-700',
    ring: 'ring-orange-200',
    gradient: 'from-orange-500 to-orange-700',
    badge: 'bg-orange-500 text-white',
    tooltip: 'from-orange-500 to-orange-700',
  },
  amber: {
    bg: 'bg-amber-500',
    bgLight: 'bg-amber-50',
    bgSection: 'bg-amber-50/60',
    border: 'border-amber-400',
    borderLeft: 'border-l-amber-400',
    text: 'text-amber-700',
    textLight: 'text-amber-500',
    iconBg: 'bg-amber-500',
    hoverBg: 'hover:bg-amber-50',
    active: 'bg-amber-500 text-white shadow-md shadow-amber-200',
    activePill: 'bg-amber-100 text-amber-700',
    ring: 'ring-amber-200',
    gradient: 'from-amber-400 to-amber-600',
    badge: 'bg-amber-500 text-white',
    tooltip: 'from-amber-500 to-amber-700',
  },
};

/* ═══════════════════════════════════════════════════════════════
   TOOLTIP CARD — Appears to the right of the sidebar on hover
═══════════════════════════════════════════════════════════════ */
const TooltipCard = ({ title, description, features, color }) => {
  const t = THEME[color] || THEME.indigo;
  return (
    <div className={`absolute left-[calc(100%+8px)] top-0 z-[200] w-64 rounded-2xl shadow-2xl overflow-hidden pointer-events-none
      opacity-0 group-hover/parent:opacity-100 translate-x-2 group-hover/parent:translate-x-0
      transition-all duration-300 ease-out`}
      style={{ minWidth: 230 }}
    >
      <div className={`bg-gradient-to-br ${t.tooltip} p-4`}>
        <p className="text-white font-black text-xs uppercase tracking-widest">{title}</p>
        <p className="text-white/70 text-[10px] mt-1 font-medium leading-relaxed">{description}</p>
      </div>
      {features?.length > 0 && (
        <div className="bg-white p-3 space-y-1.5">
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.bg}`} />
              <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">{f}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   PARENT MODULE BUTTON
═══════════════════════════════════════════════════════════════ */
const ParentModule = ({ label, subtitle, icon: Icon, isOpen, onToggle, color = 'indigo', tooltip, isCollapsed }) => {
  const t = THEME[color] || THEME.indigo;
  return (
    <div className="relative group/parent">
      <button
        onClick={onToggle}
        className={`w-full flex items-center ${isCollapsed ? 'justify-center px-1' : 'justify-between px-3'} py-3.5 rounded-2xl transition-all duration-300 group
          ${isOpen && !isCollapsed
            ? `${t.bgLight} border-l-4 ${t.borderLeft} shadow-sm`
            : isCollapsed && isOpen
            ? `${t.bgLight} shadow-sm`
            : 'bg-white hover:bg-slate-50 border border-slate-100 hover:border-slate-200 hover:shadow-md'
          }`}
        title={isCollapsed ? label : undefined}
      >
        <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'gap-3'}`}>
          {/* Colored icon circle */}
          <div className={`${t.bg} p-2 rounded-xl shadow-sm transition-transform duration-200 group-hover:scale-110 flex-shrink-0`}>
            <Icon size={16} className="text-white" />
          </div>
          {!isCollapsed && (
            <div className="text-left min-w-0">
              <span className={`block text-[11px] font-black uppercase tracking-widest ${isOpen ? t.text : 'text-slate-700'}`}>
                {label}
              </span>
              <span className={`block text-[9px] font-bold mt-0.5 ${isOpen ? t.textLight : 'text-slate-400'}`}>
                {subtitle}
              </span>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <div className={`transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown size={14} className={isOpen ? t.text : 'text-slate-400'} />
          </div>
        )}
      </button>

      {/* Tooltip card (only when collapsed, or explicitly when Sidebar is collapsed) */}
      {(!isOpen || isCollapsed) && tooltip && (
        <TooltipCard
          title={tooltip.title}
          description={tooltip.description}
          features={tooltip.features}
          color={color}
        />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MENU LINK (leaf node inside expanded section)
═══════════════════════════════════════════════════════════════ */
const MenuLink = ({ path, icon: Icon, label, accent = 'indigo', isActive, badgeLabel = '', badgeTone = 'slate' }) => {
  const t = THEME[accent] || THEME.indigo;
  const badgeStyles = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    sky: 'bg-sky-50 text-sky-600 border-sky-100',
    slate: 'bg-slate-50 text-slate-500 border-slate-100',
  };
  return (
    <Link
      to={path}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 group relative
        ${isActive
          ? `${t.active}`
          : `text-slate-500 ${t.hoverBg} hover:${t.text}`
        }`}
    >
      <Icon size={13} className={`flex-shrink-0 ${isActive ? 'text-white' : ''}`} />
      <span className="leading-tight">{label}</span>
      {badgeLabel && !isActive && (
        <span className={`ml-auto px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-widest ${badgeStyles[badgeTone] || badgeStyles.slate}`}>
          {badgeLabel}
        </span>
      )}
      {isActive && (
        <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
      )}
    </Link>
  );
};

/* ═══════════════════════════════════════════════════════════════
   SUB-MODULE (collapsible group inside parent — level 2)
═══════════════════════════════════════════════════════════════ */
const SubModule = ({ label, icon: Icon, isOpen, onToggle, children, accent = 'indigo' }) => {
  const t = THEME[accent] || THEME.indigo;
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-200
          ${isOpen
            ? `${t.activePill} border border-current/10`
            : `text-slate-400 hover:text-slate-700 hover:bg-slate-50`
          }`}
      >
        <div className="flex items-center gap-2">
          <Icon size={12} />
          <span>{label}</span>
        </div>
        <ChevronRight size={10} className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && (
        <div className="mt-1 ml-1 pl-3 border-l-2 border-dashed border-slate-200 space-y-0.5 py-1">
          {children}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   EXPANDED SECTION WRAPPER — colored left-border section
═══════════════════════════════════════════════════════════════ */
const ExpandedSection = ({ color, children }) => {
  const t = THEME[color] || THEME.indigo;
  return (
    <div className={`mt-1 mb-3 rounded-xl border-l-4 ${t.borderLeft} ${t.bgSection} p-2 space-y-0.5`}>
      {children}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════════════════════ */
const Sidebar = ({ isMobileOpen, setIsMobileOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, auditCompany } = useAuth();

  // Sidebar global collapse state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', isCollapsed);
  }, [isCollapsed]);

  const [openSections, setOpenSections] = useState({
    admin: false, rrhh: false, relacionesLaborales: false, remuneraciones: false, prevencion: false,
    flota: false, seguimiento: false, config: false,
    tarifario: false, asistencia: false, hseOp: false,
    hseSafety: false, hseControl: false, inspecciones: false,
    logistica: false, bonosTelco: false, genai: false, conectaPortal: false,
    industriaTelecom: false, industriaMineria: false, industriaEnergia: false,
    industriaDistribucion: false, industriaConstruccion: false, industriaTransporte: false,
    industriaManufactura: false, industriaAgricola: false, industriaPesquero: false
  });

  const toggle = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  const isActive = (path) => location.pathname === path;

  const handleLogout = () => { logout(); navigate('/'); };

  // Cerrar el sidebar en móviles al cambiar de vista
  React.useEffect(() => {
    if (setIsMobileOpen) setIsMobileOpen(false);
  }, [location.pathname, setIsMobileOpen]);

  const companyPerms = auditCompany?.permisosModulos || user?.empresaRef?.permisosModulos || {};
  const individualPerms = user?.permisosModulos || {};

  const hasPermission = (bucket, permissionKey) => {
    if (!permissionKey) return false;
    const grant = bucket instanceof Map ? bucket.get(permissionKey) : bucket[permissionKey];
    return grant?.ver === true;
  };

  const hasEntries = (bucket) => {
    if (!bucket) return false;
    if (bucket instanceof Map) return bucket.size > 0;
    return Object.keys(bucket).length > 0;
  };

  const MODULE_PERMISSION_MAP = {
    admin: [
      'admin_resumen_ejecutivo', 'admin_mis_clientes', 'admin_proyectos', 'admin_aprobaciones',
      'admin_aprobaciones_compras', 'admin_pagos_bancarios', 'admin_gestion_gastos',
      'emp360_facturacion', 'emp360_tesoreria', 'emp360_biometria', 'admin_conexiones', 'admin_gestion_portales'
    ],
    rrhh: ['rrhh_captura', 'rrhh_documental', 'rrhh_contratos_anexos', 'rrhh_activos', 'rrhh_vacaciones', 'rrhh_finiquitos', 'rrhh_asistencia', 'rrhh_turnos'],
    relacionesLaborales: ['rrhh_laborales', 'emp360_beneficios', 'emp360_lms', 'emp360_evaluaciones'],
    remuneraciones: ['rrhh_nomina', 'rend_cierre_bonos', 'admin_modelos_bonificacion'],
    prevencion: ['prev_ast', 'prev_procedimientos', 'prev_charlas', 'prev_inspecciones', 'prev_acreditacion', 'prev_accidentes', 'prev_iper', 'prev_auditoria', 'prev_dashboard', 'prev_historial'],
    flota: ['flota_vehiculos', 'flota_gps'],
    operaciones: ['op_supervision', 'op_colaborador', 'op_dotacion', 'op_designaciones', 'op_gastos'],
    seguimiento: ['rend_operativo', 'op_mapa_calor', 'rend_financiero', 'rend_descarga_toa', 'dist_mis_conductores', 'dist_conecta_gps', 'ind_mineria', 'ind_energia', 'ind_construccion', 'ind_transporte', 'ind_manufactura', 'ind_agricola', 'ind_pesquero'],
    logistica: ['logistica_dashboard', 'logistica_configuracion', 'logistica_inventario', 'logistica_compras', 'logistica_proveedores', 'logistica_movimientos', 'logistica_despachos', 'logistica_historial', 'logistica_auditorias'],
    config: ['cfg_empresa', 'cfg_personal', 'admin_config_notificaciones', 'admin_sii', 'admin_previred', 'admin_dashboard_tributario'],
    genai: ['ai_asistente']
  };

  const hasAccess = (moduleKey) => {
    if (['system_admin', 'ceo'].includes(user?.role)) return true;
    const source = user?.role === 'admin' ? (hasEntries(companyPerms) ? companyPerms : individualPerms) : individualPerms;
    const keys = MODULE_PERMISSION_MAP[moduleKey] || [];
    return keys.some((k) => hasPermission(source, k));
  };

  const hasSubAccess = (subModuleKey) => {
    if (['system_admin', 'ceo'].includes(user?.role)) return true;
    const source = user?.role === 'admin' ? (hasEntries(companyPerms) ? companyPerms : individualPerms) : individualPerms;
    return hasPermission(source, subModuleKey);
  };

  /* ─ MODULE DEFINITIONS (tooltips + routes) ─ */
  const MODULES = [
    {
      key: 'admin', label: 'Administración', subtitle: 'Control Central',
      icon: Building2, color: 'indigo',
      tooltip: {
        title: 'Centro de Administración',
        description: 'Dashboard 360, proyectos, aprobaciones y gestión integral de operaciones.',
        features: ['Dashboard 360 Unificado', 'Finanzas & KPIs', 'Capital Humano & Historial', 'Rankings de Producción', 'Flota & HSE']
      }
    },
    {
      key: 'rrhh', label: 'Recursos Humanos', subtitle: 'Gestión del Talento',
      icon: Users, color: 'violet',
      tooltip: {
        title: 'Recursos Humanos',
        description: 'Reclutamiento, contratos, asistencia y bienestar del equipo.',
        features: ['Captura de Talento', 'Personal Activo', 'Vacaciones & Licencias', 'Asistencia & Turnos']
      }
    },
    {
      key: 'relacionesLaborales', label: 'Relaciones Laborales', subtitle: 'Desarrollo & Bienestar',
      icon: ShieldAlert, color: 'rose',
      tooltip: {
        title: 'Relaciones Laborales',
        description: 'Historial laboral, beneficios, capacitación y evaluaciones del talento.',
        features: ['Historia Laboral', 'Beneficios 360', 'Capacitación LMS', 'Evaluaciones 360']
      }
    },
    {
      key: 'remuneraciones', label: 'Remuneraciones', subtitle: 'Gestión de Nómina',
      icon: Calculator, color: 'emerald',
      tooltip: {
        title: 'Gestión de Remuneraciones',
        description: 'Cálculo de sueldos, modelos de bonificación y seguimiento centralizado.',
        features: ['Remu Central', 'Nómina Payroll', 'Cierre de Bonos', 'Modelos Bonificación']
      }
    },
    {
      key: 'prevencion', label: 'Prevención HSE', subtitle: 'Seguridad & Salud',
      icon: Shield, color: 'rose',
      tooltip: {
        title: 'Prevención de Riesgos',
        description: 'Gestión de seguridad operativa, accidentes, matriz IPER y auditorías HSE.',
        features: ['AST Digital', 'Inspecciones EPP', 'Matriz IPER', 'Difusión & Charlas', 'Auditoría HSE']
      }
    },
    {
      key: 'flota', label: 'Flota & GPS', subtitle: 'Logística en Tiempo Real',
      icon: Truck, color: 'sky',
      tooltip: {
        title: 'Mi Flota & GPS',
        description: 'Monitoreo GPS en tiempo real de vehículos y asignación de conductores.',
        features: ['Gestión de Vehículos', 'GPS SIMPLE', 'Asignación de Flota']
      }
    },
    {
      key: 'operaciones', label: 'Operaciones', subtitle: 'Control en Terreno',
      icon: Activity, color: 'blue',
      tooltip: {
        title: 'Operaciones',
        description: 'Portal del Supervisor para administrar dotación, GPS, vehículos y designaciones.',
        features: ['Portal Supervisión', 'Portal Colaborador', 'Dotación', 'Designaciones']
      }
    },
    {
      key: 'seguimiento', label: 'INDUSTRIA', subtitle: 'Verticales Operativas',
      icon: Activity, color: 'emerald',
      tooltip: {
        title: 'INDUSTRIA',
        description: 'Gestión por verticales: telecomunicaciones, energía, transporte y más.',
        features: ['Telecomunicaciones', 'Minería', 'Energía & Electricidad', 'Distribución', 'Construcción', 'Transporte', 'Manufactura', 'Agrícola', 'Pesquero']
      }
    },
    {
      key: 'logistica', label: 'Logística 360', subtitle: 'Gestión & Suministros',
      icon: Package, color: 'sky',
      tooltip: {
        title: 'Logística Inteligente',
        description: 'Control de inventario, almacenes y despachos inteligentes.',
        features: ['Dashboard Logístico', 'Inventario Real-time', 'Gestión Almacenes', 'Seguimiento Despachos']
      }
    },
    {
      key: 'config', label: 'Configuraciones', subtitle: 'Mantenimiento del Sistema',
      icon: Settings, color: 'orange',
      tooltip: {
        title: 'Configuraciones',
        description: 'Tarifarios de baremos, precios por cliente y parámetros de la empresa.',
        features: ['Baremos Base', 'Preciario Clientes', 'Config. Empresa']
      }
    },
    {
      key: 'comunicacion', label: 'Social Network 360', subtitle: 'Chat en Tiempo Real',
      icon: MessageSquare, color: 'indigo',
      tooltip: {
        title: 'Chat 360° Real-time',
        description: 'Comunicación instantánea, grupos de trabajo y notificaciones corporativas.',
        features: ['Chat Grupal', 'Mensajes Directos', 'Presencia 360', 'Notificaciones Instantáneas']
      }
    },
    {
      key: 'genai', label: BRAND.aiModuleLabel, subtitle: 'Inteligencia Artificial',
      icon: Brain, color: 'violet',
      tooltip: {
        title: BRAND.aiAssistantLabel,
        description: 'Predicciones, detección de anomalías y análisis inteligente de tu operación.',
        features: ['Forecast Producción 7d', 'Detección Anomalías', 'Insights RRHH', 'Chat IA Corporativo']
      }
    }
  ];

  const hasConectaPortalAccess =
    hasSubAccess('admin_sii') ||
    hasSubAccess('admin_previred') ||
    hasSubAccess('admin_conexiones') ||
    hasSubAccess('admin_dashboard_tributario');

  const [portalSignals, setPortalSignals] = useState({
    sii: { label: 'Cargando', tone: 'slate', active: false },
    previred: { label: 'Cargando', tone: 'slate', active: false },
    conexiones: { label: 'Hub', tone: 'sky', active: true },
    dashboard: { label: 'Listo', tone: 'slate', active: false }
  });

  useEffect(() => {
    if (!user?.token || !hasConectaPortalAccess) return;

    const controller = new AbortController();

    const authHeaders = { Authorization: `Bearer ${user.token}` };

    const updateSignals = async () => {
      const nextSignals = {
        sii: { label: 'No vinculado', tone: 'amber', active: false },
        previred: { label: 'No vinculado', tone: 'amber', active: false },
        conexiones: { label: 'Hub', tone: 'sky', active: true },
        dashboard: { label: 'Standby', tone: 'slate', active: false }
      };

      try {
        const tasks = [];
        if (hasSubAccess('admin_sii')) {
          tasks.push(
            fetch(`${API_URL}/api/admin/sii/status`, { headers: authHeaders, signal: controller.signal })
              .then(async (res) => ({ ok: res.ok, data: res.ok ? await res.json() : null, key: 'sii' }))
              .catch(() => ({ ok: false, data: null, key: 'sii' }))
          );
        }
        if (hasSubAccess('admin_previred')) {
          tasks.push(
            fetch(`${API_URL}/api/admin/previred/status`, { headers: authHeaders, signal: controller.signal })
              .then(async (res) => ({ ok: res.ok, data: res.ok ? await res.json() : null, key: 'previred' }))
              .catch(() => ({ ok: false, data: null, key: 'previred' }))
          );
        }

        const results = await Promise.all(tasks);

        results.forEach(({ key, ok, data }) => {
          if (key === 'sii') {
            if (!ok || !data?.hasData) {
              nextSignals.sii = { label: 'Pendiente', tone: 'amber', active: false };
            } else if (data?.rpaActivo && data?.hasCertificado) {
              nextSignals.sii = { label: 'Operativo', tone: 'emerald', active: true };
            } else if (data?.rpaActivo || data?.hasCertificado) {
              nextSignals.sii = { label: 'Parcial', tone: 'amber', active: false };
            } else {
              nextSignals.sii = { label: 'Inactivo', tone: 'rose', active: false };
            }
          }

          if (key === 'previred') {
            if (!ok) {
              nextSignals.previred = { label: 'Pendiente', tone: 'amber', active: false };
            } else if (data?.rpaActivo) {
              nextSignals.previred = { label: 'Operativo', tone: 'emerald', active: true };
            } else {
              nextSignals.previred = { label: 'Inactivo', tone: 'rose', active: false };
            }
          }
        });

        const activeLinks = [nextSignals.sii.active, nextSignals.previred.active].filter(Boolean).length;
        nextSignals.conexiones = activeLinks > 0
          ? { label: `${activeLinks} live`, tone: 'emerald', active: true }
          : { label: 'Hub', tone: 'sky', active: true };
        nextSignals.dashboard = nextSignals.sii.active
          ? { label: 'Live', tone: 'emerald', active: true }
          : { label: 'Standby', tone: 'slate', active: false };

        setPortalSignals(nextSignals);
      } catch (e) {
        setPortalSignals((prev) => ({
          ...prev,
          sii: { label: 'Error', tone: 'rose', active: false },
          previred: { label: 'Error', tone: 'rose', active: false },
          conexiones: { label: 'Hub', tone: 'sky', active: true },
          dashboard: { label: 'Standby', tone: 'slate', active: false }
        }));
      }
    };

    updateSignals();
    return () => controller.abort();
  }, [user?.token, hasConectaPortalAccess, user?.role]);

  const renderSidebarSection = (moduleKey, label, Icon, childrenRenderer) => {
    const module = MODULES.find(m => m.key === moduleKey);
    if (!module) return null; // Should not happen if MODULES is correctly defined

    const { color, tooltip, items } = module;
    const currentTooltip = tooltip || (items && items.length > 0 ? items[0] : null);

    const handleToggle = () => {
      if (isCollapsed) {
        setIsCollapsed(false); // Auto-expand sidebar
        if (!openSections[moduleKey]) {
          toggle(moduleKey); // Open this specific module
        }
      } else {
        toggle(moduleKey);
      }
    };

    return (
      <section>
        <ParentModule
          key={moduleKey}
          label={label}
          subtitle={module.subtitle}
          icon={Icon}
          isOpen={openSections[moduleKey]}
          onToggle={handleToggle}
          color={color || module.accent}
          tooltip={currentTooltip}
          isCollapsed={isCollapsed}
        />
        {openSections[moduleKey] && !isCollapsed && (
          <ExpandedSection color={color || module.accent}>
            {childrenRenderer()}
          </ExpandedSection>
        )}
      </section>
    );
  };

  return (
    <>
      {/* ── Mobile Backdrop ── */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[40] md:hidden transition-opacity"
          onClick={() => setIsMobileOpen?.(false)}
        />
      )}

      {/* ── Sidebar Container ── */}
      <div className={`fixed inset-y-0 left-0 z-[50] flex-shrink-0 transform transition-all duration-300 ease-in-out md:relative md:translate-x-0 ${isCollapsed ? 'w-[4.5rem]' : 'w-[18.5rem] md:w-72'} bg-white border-r border-slate-100 h-full flex flex-col shadow-[4px_0_30px_rgba(0,0,0,0.04)] font-sans print:hidden ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* ── HEADER ── */}
        <div className="p-4 md:p-6 pb-3 md:pb-4 border-b border-slate-100 relative">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`absolute top-6 ${isCollapsed ? 'right-5' : 'right-4'} p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors z-[100] hidden md:block bg-white shadow-sm border border-slate-100`}
            title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>

          <div className={`flex items-center ${isCollapsed ? 'flex-col justify-center mt-8 gap-2 mb-2' : 'gap-3 mb-4 md:mb-5'}`}>
            <div className="rounded-2xl shadow-lg shadow-indigo-600/20 flex-shrink-0 p-0.5">
              <img src={BRAND.logoPath} alt={BRAND.fullName} className={`${isCollapsed ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl object-cover`} />
            </div>
            {!isCollapsed && (
              <div className="min-w-0 pr-6">
                <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tighter leading-none truncate w-full">
                  {auditCompany?.nombre || user?.empresa?.nombre || 'PORTAL'}
                  {!auditCompany && !user?.empresa?.nombre && <span className="text-indigo-600"> CORPORATIVO</span>}
                </h1>
                <p className="text-[8px] font-black text-slate-400 tracking-[0.3em] mt-1 uppercase truncate">
                  {auditCompany ? 'Panel de Auditoría' : 'Plataforma Corporativa'}
                </p>
              </div>
            )}
          </div>

          {user && !isCollapsed && (
            <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl md:rounded-2xl px-3 py-2 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-slate-800 truncate">{user.name}</p>
                <p className={`text-[9px] font-bold uppercase tracking-wider truncate ${auditCompany ? 'text-amber-600' : 'text-indigo-500'}`}>
                  {auditCompany ? `Auditando: ${auditCompany.nombre}` : (user.cargo || user.empresa?.nombre || 'Portal Corporativo')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── NAV ── */}
        <div className={`sidebar-nav flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-2.5 md:px-3 py-2.5 md:py-3 pb-4 space-y-1 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>

          <div className={`flex flex-col gap-1.5 mb-3 ${isCollapsed ? 'w-full' : ''}`}>
            <Link to="/" title={isCollapsed ? "Inicio" : ""} className={`flex flex-1 items-center justify-center gap-1.5 py-3 rounded-xl text-[9px] font-black text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all uppercase tracking-wider border border-slate-100 ${isCollapsed ? 'px-1' : 'px-2.5'}`}>
              <Home size={16} /> {!isCollapsed && "Inicio"}
            </Link>
          </div>

          {/* CEO Command Center */}
          {(user?.role === 'system_admin' || user?.role === 'ceo') && (
            <div className={`relative group/parent mb-3 ${isCollapsed ? 'w-full flex justify-center' : ''}`}>
              <Link
                to="/ceo/command-center"
                title={isCollapsed ? "System Command Center" : ""}
                className={`flex items-center gap-3 py-3.5 rounded-2xl transition-all duration-200 group
                ${isCollapsed ? 'justify-center w-[44px]' : 'w-full px-3'}
                ${isActive('/ceo/command-center')
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-400/30'
                    : 'bg-amber-50 border border-amber-100 hover:border-amber-300 hover:shadow-md'}`}
              >
                <div className={`p-2 rounded-xl flex-shrink-0 ${isActive('/ceo/command-center') ? 'bg-white/20' : 'bg-amber-400 group-hover:bg-amber-500'} transition-all`}>
                  <Crown size={16} className={isActive('/ceo/command-center') ? 'text-white' : 'text-white'} />
                </div>
                {!isCollapsed && (
                  <div>
                    <span className={`block text-[11px] font-black uppercase tracking-widest ${isActive('/ceo/command-center') ? 'text-white' : 'text-amber-800'}`}>
                      System Command Center
                    </span>
                    <span className={`block text-[9px] font-bold mt-0.5 ${isActive('/ceo/command-center') ? 'text-amber-100' : 'text-amber-500'}`}>
                      God Mode · Administración Total
                    </span>
                  </div>
                )}
                {!isCollapsed && isActive('/ceo/command-center') && <div className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse" />}
              </Link>
              {!isCollapsed && (
                <TooltipCard
                  title="System Command Center"
                  description="Vista consolidada de toda la plataforma. Solo acceso Admin Maestro."
                  features={['KPIs ejecutivos', 'Control de usuarios', 'Analytics global']}
                  color="amber"
                />
              )}
            </div>
          )}

          {/* ─── MÓDULO 1: ADMINISTRACIÓN ─── */}
          {hasAccess('admin') && (
            <section>
              <ParentModule
                label={MODULES.find(m => m.key === 'admin')?.label}
                subtitle={MODULES.find(m => m.key === 'admin')?.subtitle}
                icon={MODULES.find(m => m.key === 'admin')?.icon || Building2}
                isOpen={openSections.admin}
                onToggle={() => toggle('admin')}
                color={MODULES.find(m => m.key === 'admin')?.color || 'indigo'}
                tooltip={MODULES.find(m => m.key === 'admin')?.tooltip}
                isCollapsed={isCollapsed}
              />
              {openSections.admin && (
                <ExpandedSection color="indigo">
                  {hasSubAccess('admin_resumen_ejecutivo') && <MenuLink path="/dashboard" icon={LayoutDashboard} label="Dashboard 360" accent="indigo" isActive={isActive('/dashboard')} />}
                  {hasSubAccess('admin_mis_clientes') && <MenuLink path="/administracion/mis-clientes" icon={Users} label="Mis Clientes" accent="indigo" isActive={isActive('/administracion/mis-clientes')} />}
                  {hasSubAccess('admin_proyectos') && <MenuLink path="/proyectos" icon={FolderKanban} label="Proyectos" accent="indigo" isActive={isActive('/proyectos')} />}
                  {(hasSubAccess('admin_aprobaciones') || hasSubAccess('admin_aprobaciones_compras')) && (
                    <MenuLink path="/administracion/aprobaciones" icon={CheckSquare} label="Aprobaciones 360" accent="indigo" isActive={isActive('/administracion/aprobaciones')} />
                  )}
                  
                    {(hasSubAccess('admin_pagos_bancarios') || hasSubAccess('admin_gestion_gastos') || hasSubAccess('emp360_facturacion') || hasSubAccess('emp360_tesoreria') || hasSubAccess('emp360_biometria')) && (
                      <>
                        {hasSubAccess('admin_pagos_bancarios') && <MenuLink path="/administracion/pagos-bancarios" icon={Landmark} label="Pagos Bancarios (Nómina)" accent="indigo" isActive={isActive('/administracion/pagos-bancarios')} />}
                        {hasSubAccess('admin_gestion_gastos') && <MenuLink path="/administracion/gestion-gastos" icon={Receipt} label="Gestión Rinde Gastos" accent="indigo" isActive={isActive('/administracion/gestion-gastos')} />}
                        {hasSubAccess('emp360_facturacion') && <MenuLink path="/empresa360/facturacion" icon={FileText} label="Facturación 360" accent="indigo" isActive={isActive('/empresa360/facturacion')} />}
                        {hasSubAccess('emp360_tesoreria') && <MenuLink path="/empresa360/tesoreria" icon={Landmark} label="Tesorería 360" accent="indigo" isActive={isActive('/empresa360/tesoreria')} />}
                        {hasSubAccess('emp360_biometria') && <MenuLink path="/empresa360/biometria" icon={Fingerprint} label="Biometría 360" accent="indigo" isActive={isActive('/empresa360/biometria')} />}
                      </>
                    )}
                    {hasSubAccess('admin_conexiones') && (
                      <MenuLink path="/conexiones" icon={Plug} label="Mercado Financiero" accent="indigo" isActive={isActive('/conexiones')} badgeLabel={portalSignals.conexiones.label} badgeTone={portalSignals.conexiones.tone} />
                    )}
                    {hasSubAccess('admin_gestion_portales') && (
                      <MenuLink path="/administracion/gestion-portales" icon={Settings} label="Gestión de Portales" accent="indigo" isActive={isActive('/administracion/gestion-portales')} />
                    )}

                  </ExpandedSection>
              )}
            </section>
          )}

          {/* ─── MÓDULO 2: RECURSOS HUMANOS ─── */}
          {hasAccess('rrhh') && (
            <section>
              <ParentModule
                label={MODULES.find(m => m.key === 'rrhh')?.label}
                subtitle={MODULES.find(m => m.key === 'rrhh')?.subtitle}
                icon={MODULES.find(m => m.key === 'rrhh')?.icon || Users}
                isOpen={openSections.rrhh}
                onToggle={() => toggle('rrhh')}
                color={MODULES.find(m => m.key === 'rrhh')?.color || 'violet'}
                tooltip={MODULES.find(m => m.key === 'rrhh')?.tooltip}
                isCollapsed={isCollapsed}
              />
              {openSections.rrhh && (
                <ExpandedSection color="violet">
                  {/* Group 1: Reclutamiento */}
                  {(hasSubAccess('rrhh_captura') || hasSubAccess('rrhh_documental')) && <p className="text-[8px] font-black text-violet-400 uppercase tracking-widest px-2 pt-1 pb-0.5">Reclutamiento</p>}
                  {hasSubAccess('rrhh_captura') && <MenuLink path="/rrhh/captura-talento" icon={UserPlus} label="Captura de Talento" accent="violet" isActive={isActive('/rrhh/captura-talento')} />}

                  {hasSubAccess('rrhh_documental') && <MenuLink path="/rrhh/gestion-documental" icon={FileText} label="Gestión Documental" accent="violet" isActive={isActive('/rrhh/gestion-documental')} />}
                  {hasSubAccess('rrhh_contratos_anexos') && <MenuLink path="/rrhh/contratos-anexos" icon={PenTool} label="Contratos y Anexos" accent="violet" isActive={isActive('/rrhh/contratos-anexos')} />}

                  {/* Group 2: Personal activo */}
                  {(hasSubAccess('rrhh_activos') || hasSubAccess('rrhh_nomina') || hasSubAccess('rrhh_laborales') || hasSubAccess('rrhh_vacaciones')) && <p className="text-[8px] font-black text-violet-400 uppercase tracking-widest px-2 pt-2 pb-0.5">Personal Activo</p>}
                  {hasSubAccess('rrhh_activos') && <MenuLink path="/rrhh/personal-activo" icon={ClipboardList} label="Personal Activo" accent="violet" isActive={isActive('/rrhh/personal-activo')} />}
                  {hasSubAccess('rrhh_vacaciones') && <MenuLink path="/rrhh/vacaciones-licencias" icon={Plane} label="Vacaciones & Licencias" accent="violet" isActive={isActive('/rrhh/vacaciones-licencias')} />}
                  {hasSubAccess('rrhh_finiquitos') && <MenuLink path="/rrhh/finiquitos" icon={FileText} label="Finiquitos" accent="violet" isActive={isActive('/rrhh/finiquitos')} />}

                  {/* Group 3: Asistencia — sub-module */}
                  {(hasSubAccess('rrhh_asistencia') || hasSubAccess('rrhh_turnos')) && (
                    <>
                      <p className="text-[8px] font-black text-violet-400 uppercase tracking-widest px-2 pt-2 pb-0.5">Asistencia</p>
                      <SubModule label="Asistencia & Turnos" icon={CalendarCheck} isOpen={openSections.asistencia} onToggle={() => toggle('asistencia')} accent="violet">
                        {hasSubAccess('rrhh_asistencia') && <MenuLink path="/rrhh/control-asistencia" icon={Fingerprint} label="Control Asistencia" accent="violet" isActive={isActive('/rrhh/control-asistencia')} />}
                        {hasSubAccess('rrhh_turnos') && <MenuLink path="/rrhh/turnos" icon={CalendarClock} label="Prog. de Turnos" accent="violet" isActive={isActive('/rrhh/turnos')} />}
                      </SubModule>
                    </>
                  )}
                </ExpandedSection>
              )}
            </section>
          )}

          {/* ─── MÓDULO: RELACIONES LABORALES ─── */}
          {(hasSubAccess('rrhh_laborales') || hasSubAccess('emp360_beneficios') || hasSubAccess('emp360_lms') || hasSubAccess('emp360_evaluaciones')) && (
            <section>
              <ParentModule
                label={MODULES.find(m => m.key === 'relacionesLaborales')?.label}
                subtitle={MODULES.find(m => m.key === 'relacionesLaborales')?.subtitle}
                icon={MODULES.find(m => m.key === 'relacionesLaborales')?.icon || ShieldAlert}
                isOpen={openSections.relacionesLaborales}
                onToggle={() => toggle('relacionesLaborales')}
                color={MODULES.find(m => m.key === 'relacionesLaborales')?.color || 'rose'}
                tooltip={MODULES.find(m => m.key === 'relacionesLaborales')?.tooltip}
                isCollapsed={isCollapsed}
              />
              {openSections.relacionesLaborales && (
                <ExpandedSection color="rose">
                  {hasSubAccess('rrhh_laborales') && (
                    <MenuLink path="/rrhh/relaciones-laborales" icon={ShieldAlert} label="Historia Laboral" accent="rose" isActive={isActive('/rrhh/relaciones-laborales')} />
                  )}
                  {hasSubAccess('emp360_beneficios') && (
                    <MenuLink path="/empresa360/beneficios" icon={Coins} label="Beneficios 360" accent="rose" isActive={isActive('/empresa360/beneficios')} />
                  )}
                  {hasSubAccess('emp360_lms') && (
                    <MenuLink path="/empresa360/lms" icon={GraduationCap} label="Capacitación LMS" accent="rose" isActive={isActive('/empresa360/lms')} />
                  )}
                  {hasSubAccess('emp360_evaluaciones') && (
                    <MenuLink path="/empresa360/evaluaciones" icon={ShieldCheck} label="Evaluaciones 360" accent="rose" isActive={isActive('/empresa360/evaluaciones')} />
                  )}
                </ExpandedSection>
              )}
            </section>
          )}

          {/* ─── MÓDULO: REMUNERACIONES ─── */}
          {hasAccess('remuneraciones') && (
            <section>
              <ParentModule
                label="Remuneraciones"
                subtitle="Gestión de Nómina"
                icon={DollarSign}
                isOpen={openSections.remuneraciones}
                onToggle={() => toggle('remuneraciones')}
                color="emerald"
                tooltip={MODULES.find(m => m.key === 'remuneraciones')?.tooltip}
                isCollapsed={isCollapsed}
              />
              {openSections.remuneraciones && (
                <ExpandedSection color="emerald">
                  {/* ── Resto Remuneraciones ── */}
                  {hasSubAccess('rrhh_nomina') && <MenuLink path="/rrhh/remu-central" icon={Calculator} label="Remu Central" accent="emerald" isActive={isActive('/rrhh/remu-central')} />}
                  {hasSubAccess('rrhh_nomina') && <MenuLink path="/rrhh/nomina" icon={Calculator} label="Nómina (Payroll)" accent="emerald" isActive={isActive('/rrhh/nomina')} />}
                  {hasSubAccess('rend_cierre_bonos') && <MenuLink path="/rendimiento/cierre-bonos" icon={CalendarCheck} label="Cierre de Bonos" accent="emerald" isActive={isActive('/rendimiento/cierre-bonos')} />}
                  {hasSubAccess('admin_modelos_bonificacion') && <MenuLink path="/administracion/modelos-bonificacion" icon={SlidersHorizontal} label="Modelos Bonificación" accent="emerald" isActive={isActive('/administracion/modelos-bonificacion')} />}
                </ExpandedSection>
              )}
            </section>
          )}

          {/* ─── MÓDULO 3: PREVENCIÓN DE RIESGOS ─── */}
          {hasAccess('prevencion') && (
            <section>
              <ParentModule
                label={MODULES.find(m => m.key === 'prevencion')?.label}
                subtitle={MODULES.find(m => m.key === 'prevencion')?.subtitle}
                icon={MODULES.find(m => m.key === 'prevencion')?.icon || Shield}
                isOpen={openSections.prevencion}
                onToggle={() => toggle('prevencion')}
                color={MODULES.find(m => m.key === 'prevencion')?.color || 'rose'}
                tooltip={MODULES.find(m => m.key === 'prevencion')?.tooltip}
                isCollapsed={isCollapsed}
              />
              {openSections.prevencion && (
                <ExpandedSection color="rose">
                  {(hasSubAccess('prev_ast') || hasSubAccess('prev_procedimientos') || hasSubAccess('prev_charlas') || hasSubAccess('prev_inspecciones')) && (
                    <SubModule label="Gestión Operativa" icon={HardHat} isOpen={openSections.hseOp} onToggle={() => toggle('hseOp')} accent="rose">
                      {hasSubAccess('prev_ast') && <MenuLink path="/prevencion/ast" icon={PenTool} label="Generación AST" accent="rose" isActive={isActive('/prevencion/ast')} />}
                      {hasSubAccess('prev_procedimientos') && <MenuLink path="/prevencion/procedimientos" icon={BookOpen} label="Procedimientos & PTS" accent="rose" isActive={isActive('/prevencion/procedimientos')} />}
                      {hasSubAccess('prev_charlas') && <MenuLink path="/prevencion/difusion" icon={GraduationCap} label="Difusión & Charlas" accent="rose" isActive={isActive('/prevencion/difusion')} />}
                      {hasSubAccess('prev_inspecciones') && (
                        <SubModule label="Inspecciones" icon={ClipboardList} isOpen={openSections.inspecciones} onToggle={() => toggle('inspecciones')} accent="rose">
                          <MenuLink path="/prevencion/inspecciones" icon={ShieldCheck} label="Cumplimiento Prev." accent="rose" isActive={isActive('/prevencion/inspecciones')} />
                        </SubModule>
                      )}
                    </SubModule>
                  )}

                  {(hasSubAccess('prev_acreditacion') || hasSubAccess('prev_accidentes') || hasSubAccess('prev_iper')) && (
                    <SubModule label="Seguridad & Salud" icon={ShieldCheck} isOpen={openSections.hseSafety} onToggle={() => toggle('hseSafety')} accent="rose">
                      {hasSubAccess('prev_acreditacion') && <MenuLink path="/rrhh/seguridad-ppe" icon={CheckSquare} label="Acreditación & PPE" accent="rose" isActive={isActive('/rrhh/seguridad-ppe')} />}
                      {hasSubAccess('prev_accidentes') && <MenuLink path="/prevencion/incidentes" icon={AlertTriangle} label="Investigación Accidentes" accent="rose" isActive={isActive('/prevencion/incidentes')} />}
                      {hasSubAccess('prev_iper') && <MenuLink path="/prevencion/matriz-riesgos" icon={SlidersHorizontal} label="Matriz IPER" accent="rose" isActive={isActive('/prevencion/matriz-riesgos')} />}
                    </SubModule>
                  )}

                  {(hasSubAccess('prev_auditoria') || hasSubAccess('prev_dashboard') || hasSubAccess('prev_historial')) && (
                    <SubModule label="Control & Seguimiento" icon={BarChart3} isOpen={openSections.hseControl} onToggle={() => toggle('hseControl')} accent="rose">
                      {hasSubAccess('prev_auditoria') && <MenuLink path="/prevencion/hse-audit" icon={ClipboardCheck} label="Auditoría HSE" accent="rose" isActive={isActive('/prevencion/hse-audit')} />}
                      {hasSubAccess('prev_dashboard') && <MenuLink path="/prevencion/dashboard" icon={TrendingUp} label="Dashboard HSE" accent="rose" isActive={isActive('/prevencion/dashboard')} />}
                      {hasSubAccess('prev_historial') && <MenuLink path="/prevencion/historial" icon={History} label="Historial Prev." accent="rose" isActive={isActive('/prevencion/historial')} />}
                    </SubModule>
                  )}
                </ExpandedSection>
              )}
            </section>
          )}

          {/* ─── MÓDULO 4: FLOTA & GPS ─── */}
          {hasAccess('flota') && (
            <section>
              <ParentModule
                label={MODULES.find(m => m.key === 'flota')?.label}
                subtitle={MODULES.find(m => m.key === 'flota')?.subtitle}
                icon={MODULES.find(m => m.key === 'flota')?.icon || Truck}
                isOpen={openSections.flota}
                onToggle={() => toggle('flota')}
                color={MODULES.find(m => m.key === 'flota')?.color || 'sky'}
                tooltip={MODULES.find(m => m.key === 'flota')?.tooltip}
                isCollapsed={isCollapsed}
              />
              {openSections.flota && (
                <ExpandedSection color="sky">
                  {hasSubAccess('flota_vehiculos') && <MenuLink path="/flota" icon={Truck} label="Flota de Vehículos" accent="sky" isActive={isActive('/flota')} />}
                  {hasSubAccess('flota_gps') && <MenuLink path="/monitor-gps" icon={MapPin} label="GPS SIMPLE" accent="sky" isActive={isActive('/monitor-gps')} />}
                </ExpandedSection>
              )}
            </section>
          )}

          {/* ─── MÓDULO 5: OPERACIONES ─── */}
          {hasAccess('operaciones') && (
            <section>
              <ParentModule
                label={MODULES.find(m => m.key === 'operaciones')?.label}
                subtitle={MODULES.find(m => m.key === 'operaciones')?.subtitle}
                icon={MODULES.find(m => m.key === 'operaciones')?.icon || Activity}
                isOpen={openSections.operaciones}
                onToggle={() => toggle('operaciones')}
                color={MODULES.find(m => m.key === 'operaciones')?.color || 'blue'}
                tooltip={MODULES.find(m => m.key === 'operaciones')?.tooltip}
                isCollapsed={isCollapsed}
              />
              {openSections.operaciones && (
                <ExpandedSection color="indigo">
                  {/* Portal de Supervisión - Requiere Rol apto y Permiso */}
                  {hasSubAccess('op_supervision') && (
                    <MenuLink path="/operaciones/portal-supervision" icon={ShieldCheck} label="Portal Supervisión" accent="indigo" isActive={isActive('/operaciones/portal-supervision')} />
                  )}

                  {/* Portal Colaborador - Visible si tiene permiso op_colaborador */}
                  {hasSubAccess('op_colaborador') && <MenuLink path="/operaciones/portal-colaborador" icon={Fingerprint} label="Portal Colaborador" accent="indigo" isActive={isActive('/operaciones/portal-colaborador')} />}


                  {/* Dotación Operativa */}
                  {hasSubAccess('op_dotacion') && <MenuLink path="/dotacion" icon={Users} label="Dotación" accent="indigo" isActive={isActive('/dotacion')} />}
                  {/* Designaciones */}
                  {hasSubAccess('op_designaciones') && <MenuLink path="/designaciones" icon={ClipboardCheck} label="Designaciones" accent="indigo" isActive={isActive('/designaciones')} />}

                  {/* Rinde Gastos 360 */}
                  {hasSubAccess('op_gastos') && (
                    <div className="pt-2 mt-2 border-t border-indigo-100/50">
                      <MenuLink path="/operaciones/gastos" icon={Receipt} label="Rinde Gastos 360" accent="indigo" isActive={isActive('/operaciones/gastos')} />
                    </div>
                  )}

                </ExpandedSection>
              )}
            </section>
          )}

          {/* ─── MÓDULO 6: INDUSTRIA ─── */}
          {hasAccess('seguimiento') && (
            <section>
              <ParentModule
                label={MODULES.find(m => m.key === 'seguimiento')?.label}
                subtitle={MODULES.find(m => m.key === 'seguimiento')?.subtitle}
                icon={MODULES.find(m => m.key === 'seguimiento')?.icon || Activity}
                isOpen={openSections.seguimiento}
                onToggle={() => toggle('seguimiento')}
                color={MODULES.find(m => m.key === 'seguimiento')?.color || 'emerald'}
                tooltip={MODULES.find(m => m.key === 'seguimiento')?.tooltip}
                isCollapsed={isCollapsed}
              />
              {openSections.seguimiento && (
                <ExpandedSection color="emerald">
                  <SubModule label="Telecomunicaciones" icon={Activity} isOpen={openSections.industriaTelecom} onToggle={() => toggle('industriaTelecom')} accent="sky">
                    {hasSubAccess('rend_operativo') && <MenuLink path="/rendimiento" icon={Activity} label="Panel Telecomunicaciones" accent="sky" isActive={isActive('/rendimiento')} />}
                    {hasSubAccess('op_mapa_calor') && <MenuLink path="/mapa-calor" icon={MapPin} label="Mapa de Calor" accent="sky" isActive={isActive('/mapa-calor')} />}
                    {hasSubAccess('rend_financiero') && <MenuLink path="/produccion-financiera" icon={DollarSign} label="Producción Financiera" accent="sky" isActive={isActive('/produccion-financiera')} />}
                    {hasSubAccess('rend_descarga_toa') && <MenuLink path="/descarga-toa" icon={Database} label="Descarga TOA" accent="sky" isActive={isActive('/descarga-toa')} />}
                  </SubModule>

                  {hasSubAccess('ind_mineria') && (
                    <SubModule label="Minería" icon={HardHat} isOpen={openSections.industriaMineria} onToggle={() => toggle('industriaMineria')} accent="amber">
                      <p className="text-[9px] font-black text-amber-700 uppercase tracking-wider bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 inline-block">Módulo en preparación</p>
                    </SubModule>
                  )}

                  {hasSubAccess('ind_energia') && (
                    <SubModule label="Energía & Electricidad" icon={Plug} isOpen={openSections.industriaEnergia} onToggle={() => toggle('industriaEnergia')} accent="orange">
                      <p className="text-[9px] font-black text-orange-700 uppercase tracking-wider bg-orange-50 border border-orange-100 rounded-lg px-2 py-1 inline-block">Módulo en preparación</p>
                    </SubModule>
                  )}

                  {(hasSubAccess('dist_mis_conductores') || hasSubAccess('dist_conecta_gps')) && (
                    <SubModule label="Distribución" icon={ArrowRightLeft} isOpen={openSections.industriaDistribucion} onToggle={() => toggle('industriaDistribucion')} accent="indigo">
                      {hasSubAccess('dist_mis_conductores') && <MenuLink path="/industria/distribucion/mis-conductores" icon={Users} label="Mis Conductores" accent="indigo" isActive={isActive('/industria/distribucion/mis-conductores')} />}
                      {hasSubAccess('dist_conecta_gps') && <MenuLink path="/industria/distribucion/conecta-gps" icon={MapPin} label="Conecta GPS" accent="indigo" isActive={isActive('/industria/distribucion/conecta-gps')} />}
                    </SubModule>
                  )}

                  {hasSubAccess('ind_construccion') && (
                    <SubModule label="Construcción" icon={Building2} isOpen={openSections.industriaConstruccion} onToggle={() => toggle('industriaConstruccion')} accent="rose">
                      <p className="text-[9px] font-black text-rose-700 uppercase tracking-wider bg-rose-50 border border-rose-100 rounded-lg px-2 py-1 inline-block">Módulo en preparación</p>
                    </SubModule>
                  )}

                  {hasSubAccess('ind_transporte') && (
                    <SubModule label="Transporte" icon={Truck} isOpen={openSections.industriaTransporte} onToggle={() => toggle('industriaTransporte')} accent="violet">
                      <p className="text-[9px] font-black text-violet-700 uppercase tracking-wider bg-violet-50 border border-violet-100 rounded-lg px-2 py-1 inline-block">Módulo en preparación</p>
                    </SubModule>
                  )}

                  {hasSubAccess('ind_manufactura') && (
                    <SubModule label="Manufactura" icon={Settings} isOpen={openSections.industriaManufactura} onToggle={() => toggle('industriaManufactura')} accent="emerald">
                      <p className="text-[9px] font-black text-emerald-700 uppercase tracking-wider bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1 inline-block">Módulo en preparación</p>
                    </SubModule>
                  )}

                  {hasSubAccess('ind_agricola') && (
                    <SubModule label="Agrícola" icon={Package} isOpen={openSections.industriaAgricola} onToggle={() => toggle('industriaAgricola')} accent="sky">
                      <p className="text-[9px] font-black text-sky-700 uppercase tracking-wider bg-sky-50 border border-sky-100 rounded-lg px-2 py-1 inline-block">Módulo en preparación</p>
                    </SubModule>
                  )}

                  {hasSubAccess('ind_pesquero') && (
                    <SubModule label="Pesquero" icon={Network} isOpen={openSections.industriaPesquero} onToggle={() => toggle('industriaPesquero')} accent="indigo">
                      <p className="text-[9px] font-black text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1 inline-block">Módulo en preparación</p>
                    </SubModule>
                  )}
                </ExpandedSection>
              )}
            </section>
          )}

          {hasAccess('logistica') && renderSidebarSection('logistica', 'Logística 360', Package, () => (
            <>
              <MenuLink path="/logistica" icon={LayoutDashboard} label="Dashboard Logístico" accent="sky" isActive={isActive('/logistica')} />
              <MenuLink path="/logistica/configuracion" icon={Settings} label="Configuración Maestra" accent="sky" isActive={isActive('/logistica/configuracion')} />
              <MenuLink path="/logistica/inventario" icon={Package} label="Inventario & Activos" accent="sky" isActive={isActive('/logistica/inventario')} />
              <MenuLink path="/logistica/compras" icon={ShoppingCart} label="Círculo de Compras" accent="sky" isActive={isActive('/logistica/compras')} />
              <MenuLink path="/logistica/proveedores" icon={UserPlus} label="Gestión de Proveedores" accent="sky" isActive={isActive('/logistica/proveedores')} />
              <MenuLink path="/logistica/movimientos" icon={ArrowRightLeft} label="Gestión Movimientos" accent="sky" isActive={isActive('/logistica/movimientos')} />
              <MenuLink path="/logistica/despachos" icon={Truck} label="Seguimiento Despachos" accent="sky" isActive={isActive('/logistica/despachos')} />
              <MenuLink path="/logistica/historial" icon={History} label="Historial de Movimientos" accent="sky" isActive={isActive('/logistica/historial')} />
              <MenuLink path="/logistica/auditorias" icon={Shield} label="Auditoría Inventario" accent="sky" isActive={isActive('/logistica/auditorias')} />
            </>
          ))}

          {/* ─── MÓDULO 7: CONFIGURACIONES ─── */}
          {hasAccess('config') && (
            <section>
              <ParentModule
                label={MODULES.find(m => m.key === 'config')?.label}
                subtitle={MODULES.find(m => m.key === 'config')?.subtitle}
                icon={MODULES.find(m => m.key === 'config')?.icon || Settings}
                isOpen={openSections.config}
                onToggle={() => toggle('config')}
                color={MODULES.find(m => m.key === 'config')?.color || 'orange'}
                tooltip={MODULES.find(m => m.key === 'config')?.tooltip}
                isCollapsed={isCollapsed}
              />
              {openSections.config && (
                <ExpandedSection color="orange">
                  {hasSubAccess('cfg_empresa') && <MenuLink path="/configuracion-empresa" icon={Building2} label="Config. Empresa" accent="orange" isActive={isActive('/configuracion-empresa')} />}
                  {hasSubAccess('cfg_personal') && <MenuLink path="/gestion-personal" icon={Users} label="Gestión de Personal" accent="orange" isActive={isActive('/gestion-personal')} />}
                  {hasSubAccess('admin_config_notificaciones') && (
                    <MenuLink path="/administracion/configuracion-notificaciones" icon={Bell} label="Config. Notificaciones" accent="orange" isActive={isActive('/administracion/configuracion-notificaciones')} />
                  )}

                  {(hasSubAccess('admin_sii') || hasSubAccess('admin_previred') || hasSubAccess('admin_dashboard_tributario')) && (
                    <SubModule label="Conecta Portal" icon={Globe} isOpen={openSections.conectaPortal} onToggle={() => toggle('conectaPortal')} accent="orange">
                      {hasSubAccess('admin_sii') && <MenuLink path="/administracion/sii" icon={Network} label="Portal Tributario (SII)" accent="orange" isActive={isActive('/administracion/sii')} badgeLabel={portalSignals.sii.label} badgeTone={portalSignals.sii.tone} />}
                      {hasSubAccess('admin_previred') && <MenuLink path="/administracion/previred" icon={ArrowRightLeft} label="Enlace Previred 360" accent="orange" isActive={isActive('/administracion/previred')} badgeLabel={portalSignals.previred.label} badgeTone={portalSignals.previred.tone} />}
                      {hasSubAccess('admin_dashboard_tributario') && <MenuLink path="/administracion/dashboard-tributario" icon={BarChart3} label="Dashboard Tributario" accent="orange" isActive={isActive('/administracion/dashboard-tributario')} badgeLabel={portalSignals.dashboard.label} badgeTone={portalSignals.dashboard.tone} />}
                    </SubModule>
                  )}
                </ExpandedSection>
              )}
            </section>
          )}

          {/* ─── MÓDULO GENAI360 ─── */}
          {hasAccess('genai') && (
          <section>
            <ParentModule
              label={MODULES.find(m => m.key === 'genai')?.label}
              subtitle={MODULES.find(m => m.key === 'genai')?.subtitle}
              icon={Brain}
              isOpen={openSections.genai}
              onToggle={() => toggle('genai')}
              color="violet"
              tooltip={MODULES.find(m => m.key === 'genai')?.tooltip}
              isCollapsed={isCollapsed}
            />
            {openSections.genai && !isCollapsed && (
              <ExpandedSection color="violet">
                {hasSubAccess('ai_asistente') && <MenuLink path="/ai/asistente" icon={Brain} label={BRAND.aiAssistantLabel} accent="violet" isActive={isActive('/ai/asistente')} />}
              </ExpandedSection>
            )}
          </section>
          )}

        </div>

        {/* ── FOOTER ── */}
        <div className={`border-t border-slate-100 bg-gradient-to-t from-slate-50 to-white flex-shrink-0 ${isCollapsed ? 'p-2' : 'p-4'}`}>
          {user && !isCollapsed && (
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center mb-3 truncate px-2">
              {user.email}
            </p>
          )}
          <Link
            to="/chat"
            title={isCollapsed ? 'Chat Social 360' : ''}
            className={`w-full flex items-center justify-center gap-2.5 mb-2 py-3 rounded-2xl text-[10px] font-black transition-all uppercase tracking-widest shadow-sm hover:shadow-lg
              ${isActive('/chat')
                ? 'bg-indigo-600 text-white shadow-indigo-200'
                : 'bg-white border border-indigo-100 text-indigo-600 hover:bg-indigo-50'}`}
          >
            <MessageSquare size={15} className="flex-shrink-0" />
            {!isCollapsed && <span>Chat Social 360</span>}
            {!isCollapsed && !isActive('/chat') && <span className="ml-1 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse flex-shrink-0" />}
          </Link>

          <button
            onClick={handleLogout}
            title={isCollapsed ? 'Cerrar Sesión' : ''}
            className="w-full flex items-center justify-center gap-2.5 bg-red-50 border border-red-100 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 py-3 rounded-2xl text-[10px] font-black transition-all uppercase tracking-widest shadow-sm hover:shadow-lg hover:shadow-red-200"
          >
            <LogOut size={15} className="flex-shrink-0" />
            {!isCollapsed && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Truck, Activity, Settings,
  LogOut, Zap, FileText, ChevronDown, ChevronRight,
  DollarSign, UserPlus, TrendingUp, SlidersHorizontal, MapPin,
  CheckSquare, CalendarCheck, CalendarClock, BookOpen,
  History, ShieldCheck, Fingerprint,
  Plane, ShieldAlert,
  Building2, ClipboardList, Shield, HardHat, AlertTriangle,
  ClipboardCheck, BarChart3, GraduationCap, PenTool,
  Crown, Home, Globe, FolderKanban, Plug, CreditCard
} from 'lucide-react';
import { useAuth } from '../platforms/auth/AuthContext';

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
const ParentModule = ({ label, subtitle, icon: Icon, isOpen, onToggle, color = 'indigo', tooltip }) => {
  const t = THEME[color] || THEME.indigo;
  return (
    <div className="relative group/parent">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-3 py-3.5 rounded-2xl transition-all duration-300 group
          ${isOpen
            ? `${t.bgLight} border-l-4 ${t.borderLeft} shadow-sm`
            : 'bg-white hover:bg-slate-50 border border-slate-100 hover:border-slate-200 hover:shadow-md'
          }`}
      >
        <div className="flex items-center gap-3">
          {/* Colored icon circle */}
          <div className={`${t.bg} p-2 rounded-xl shadow-sm transition-transform duration-200 group-hover:scale-110`}>
            <Icon size={16} className="text-white" />
          </div>
          <div className="text-left min-w-0">
            <span className={`block text-[11px] font-black uppercase tracking-widest ${isOpen ? t.text : 'text-slate-700'}`}>
              {label}
            </span>
            <span className={`block text-[9px] font-bold mt-0.5 ${isOpen ? t.textLight : 'text-slate-400'}`}>
              {subtitle}
            </span>
          </div>
        </div>
        <div className={`transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown size={14} className={isOpen ? t.text : 'text-slate-400'} />
        </div>
      </button>

      {/* Tooltip card (only when collapsed) */}
      {!isOpen && tooltip && (
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
const MenuLink = ({ path, icon: Icon, label, accent = 'indigo', isActive }) => {
  const t = THEME[accent] || THEME.indigo;
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
  const { user, logout } = useAuth();

  const [openSections, setOpenSections] = useState({
    admin: false, rrhh: false, prevencion: false,
    flota: false, seguimiento: false, config: false,
    tarifario: false, asistencia: false, hseOp: false,
    hseSafety: false, hseControl: false, inspecciones: false
  });

  const toggle = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  const isActive = (path) => location.pathname === path;

  const handleLogout = () => { logout(); navigate('/'); };

  // Cerrar el sidebar en móviles al cambiar de vista
  React.useEffect(() => {
    if (setIsMobileOpen) setIsMobileOpen(false);
  }, [location.pathname, setIsMobileOpen]);

  // --- CONTROL DE ACCESOS (PERMISOS GRANULARES & CONTRATO) ---
  const hasAccess = (moduleKey) => {
    // 1. CEO SIEMPRE tiene acceso total (Ojo de Dios)
    if (['ceo_genai', 'ceo'].includes(user?.role)) return true;

    // 2. Bloqueo por CONTRATO de Empresa (Techo Máximo)
    const companyPerms = user?.empresaRef?.permisosModulos;

    // Si la empresa tiene permisos definidos, verificamos que al menos una sub-capacidad correspondiente al módulo esté activa
    if (companyPerms) {
      const checkCompany = (prefix) => {
        // En base de datos se guarda como rrhh_colaboradores, prev_ast, agentetelecom_gps, etc.
        // Convertir el Map/Object de Mongo a array de llaves
        const keys = companyPerms instanceof Map ? Array.from(companyPerms.keys()) : Object.keys(companyPerms);
        return keys.some(key => key.startsWith(prefix) && (companyPerms.get ? companyPerms.get(key) : companyPerms[key])?.ver === true);
      };

      switch (moduleKey) {
        case 'admin': return true; // Todos los admins/usuarios pueden ver su inicio de módulo "admin" (dashboard, etc) si tienen login
        case 'rrhh': if (!checkCompany('rrhh_') && !checkCompany('comercial_')) return false; break; // Por si venian de comercial viejo
        case 'prevencion': if (!checkCompany('prev_')) return false; break;
        case 'flota': if (!checkCompany('flota_') && !checkCompany('agentetelecom_gps')) return false; break;
        case 'operaciones': if (!checkCompany('op_') && !checkCompany('operaciones')) return false; break;
        case 'seguimiento': if (!checkCompany('rend_') && !checkCompany('agentetelecom_tarifario') && !checkCompany('finanzas_')) return false; break;
        case 'config': if (user?.role !== 'admin') return false; break; // Solo admins configuran su empresa
      }
    }

    // 3. Fallback estricto por Roles (Si el contrato lo permite, validamos el rol del usuario)
    switch (moduleKey) {
      case 'admin': return ['admin'].includes(user?.role);
      case 'rrhh': return ['admin', 'rrhh'].includes(user?.role);
      case 'prevencion': return ['admin', 'prevencion', 'supervisor_hse'].includes(user?.role);
      case 'flota': return ['admin', 'logistica'].includes(user?.role);
      case 'operaciones': return true; // Portal Colaborador abierto a todos
      case 'seguimiento': return ['admin', 'finanzas'].includes(user?.role);
      case 'config': return ['admin'].includes(user?.role);
      default: return false;
    }
  };

  /* ─ MODULE DEFINITIONS (tooltips + routes) ─ */
  const MODULES = [
    {
      key: 'admin', label: 'Administración', subtitle: 'Control Central',
      icon: Building2, color: 'indigo',
      tooltip: {
        title: 'Centro de Administración',
        description: 'Dashboard ejecutivo, proyectos y flujos de aprobación de personal.',
        features: ['Dashboard General', 'Proyectos & CECOs', 'Aprobaciones', 'Historial Operativo']
      }
    },
    {
      key: 'rrhh', label: 'Recursos Humanos', subtitle: 'Gestión del Talento',
      icon: Users, color: 'violet',
      tooltip: {
        title: 'Recursos Humanos',
        description: 'Reclutamiento, contratos, nómina, asistencia y bienestar del equipo.',
        features: ['Captura de Talento', 'Personal Activo', 'Nómina', 'Vacaciones & Licencias', 'Asistencia & Turnos']
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
        features: ['Gestión de Vehículos', 'Monitor GPS en Vivo', 'Asignación de Flota']
      }
    },
    {
      key: 'operaciones', label: 'Operaciones', subtitle: 'Control en Terreno',
      icon: Activity, color: 'blue',
      tooltip: {
        title: 'Operaciones',
        description: 'Portal del Supervisor para administrar dotación, GPS, vehículos y rendimiento productivo.',
        features: ['Portal Supervisión', 'Portal Colaborador', 'Gestión de Portales', 'Dotación', 'Rendimiento']
      }
    },
    {
      key: 'seguimiento', label: 'Rendimiento Productivo', subtitle: 'Rendimiento & Finanzas',
      icon: Activity, color: 'emerald',
      tooltip: {
        title: 'Rendimiento Productivo',
        description: 'KPIs de producción, facturación y análisis de rendimiento del equipo.',
        features: ['Producción Operativa', 'Producción Financiera', 'Análisis Financiero']
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
    }
  ];

  const renderSidebarSection = (moduleKey, label, Icon, childrenRenderer) => {
    const module = MODULES.find(m => m.key === moduleKey);
    if (!module) return null; // Should not happen if MODULES is correctly defined

    const { color, tooltip, items } = module;
    const currentTooltip = tooltip || (items && items.length > 0 ? items[0] : null);

    return (
      <section>
        <ParentModule
          key={moduleKey}
          label={label}
          subtitle={module.subtitle}
          icon={Icon}
          isOpen={openSections[moduleKey]}
          onToggle={() => toggle(moduleKey)}
          color={color || module.accent}
          tooltip={currentTooltip}
        />
        {openSections[moduleKey] && (
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
      <div className={`fixed inset-y-0 left-0 z-[50] transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 w-72 bg-white border-r border-slate-100 h-full flex flex-col shadow-[4px_0_30px_rgba(0,0,0,0.04)] font-sans print:hidden overflow-visible ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* ── HEADER ── */}
        <div className="p-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-3 rounded-2xl shadow-lg shadow-indigo-600/20">
              <Zap className="text-white fill-white" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tighter leading-none">
                GEN<span className="text-indigo-600">AI</span>
              </h1>
              <p className="text-[8px] font-black text-slate-400 tracking-[0.3em] mt-1 uppercase">Plataforma Integral</p>
            </div>
          </div>

          {user && (
            <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl px-3 py-2.5 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-slate-800 truncate">{user.name}</p>
                <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider truncate">{user.cargo || user.empresa?.nombre || 'Gen AI'}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── NAV ── */}
        <div className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar pb-10 space-y-1 overflow-visible">

          <div className="flex flex-col gap-1.5 mb-3">
            <Link to="/" className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-3 rounded-xl text-[9px] font-black text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all uppercase tracking-wider border border-slate-100">
              <Home size={12} /> Inicio
            </Link>
            {hasAccess('admin') && (
              <Link to="/dashboard" className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-3 rounded-xl text-[9px] font-black transition-all uppercase tracking-wider border 
                ${isActive('/dashboard')
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                  : 'text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 border-slate-100'}`}>
                <LayoutDashboard size={12} /> Dashboard Ejecutivo
              </Link>
            )}
          </div>

          {/* CEO Command Center */}
          {(user?.role === 'ceo_genai' || user?.role === 'ceo') && (
            <div className="relative group/parent mb-3">
              <Link
                to="/ceo/command-center"
                className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl transition-all duration-200 group
                ${isActive('/ceo/command-center')
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-400/30'
                    : 'bg-amber-50 border border-amber-100 hover:border-amber-300 hover:shadow-md'}`}
              >
                <div className={`p-2 rounded-xl ${isActive('/ceo/command-center') ? 'bg-white/20' : 'bg-amber-400 group-hover:bg-amber-500'} transition-all`}>
                  <Crown size={16} className={isActive('/ceo/command-center') ? 'text-white' : 'text-white'} />
                </div>
                <div>
                  <span className={`block text-[11px] font-black uppercase tracking-widest ${isActive('/ceo/command-center') ? 'text-white' : 'text-amber-800'}`}>
                    CEO Command Center
                  </span>
                  <span className={`block text-[9px] font-bold mt-0.5 ${isActive('/ceo/command-center') ? 'text-amber-100' : 'text-amber-500'}`}>
                    God Mode · Administración Total
                  </span>
                </div>
                {isActive('/ceo/command-center') && <div className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse" />}
              </Link>
              <TooltipCard
                title="CEO Command Center"
                description="Vista consolidada de toda la plataforma. Solo acceso CEO."
                features={['KPIs ejecutivos', 'Control de usuarios', 'Analytics global']}
                color="amber"
              />
            </div>
          )}

          {/* ─── MÓDULO 1: ADMINISTRACIÓN ─── */}
          {hasAccess('admin') && (
            <section>
              <ParentModule
                key={MODULES[0].key}
                {...Object.fromEntries(Object.entries(MODULES[0]).filter(([k]) => k !== 'key'))}
                isOpen={openSections.admin}
                onToggle={() => toggle('admin')}
              />
              {openSections.admin && (
                <ExpandedSection color="indigo">
                  {/* Dashboard General movido al top */}
                  <MenuLink path="/proyectos" icon={FolderKanban} label="Proyectos" accent="indigo" isActive={isActive('/proyectos')} />
                  <MenuLink path="/conexiones" icon={Plug} label="Conexiones" accent="indigo" isActive={isActive('/conexiones')} />
                  <MenuLink path="/rrhh" icon={CheckSquare} label="Aprobaciones" accent="indigo" isActive={isActive('/rrhh')} />
                  <MenuLink path="/rrhh/historial" icon={History} label="Historial Operativo" accent="indigo" isActive={isActive('/rrhh/historial')} />
                </ExpandedSection>
              )}
            </section>
          )}

          {/* ─── MÓDULO 2: RECURSOS HUMANOS ─── */}
          {hasAccess('rrhh') && (
            <section>
              <ParentModule
                key={MODULES[1].key}
                {...Object.fromEntries(Object.entries(MODULES[1]).filter(([k]) => k !== 'key'))}
                isOpen={openSections.rrhh}
                onToggle={() => toggle('rrhh')}
              />
              {openSections.rrhh && (
                <ExpandedSection color="violet">
                  {/* Group 1: Reclutamiento */}
                  <p className="text-[8px] font-black text-violet-400 uppercase tracking-widest px-2 pt-1 pb-0.5">Reclutamiento</p>
                  <MenuLink path="/rrhh/captura-talento" icon={UserPlus} label="Captura de Talento" accent="violet" isActive={isActive('/rrhh/captura-talento')} />
                  <MenuLink path="/rrhh/gestion-documental" icon={FileText} label="Gestión Documental" accent="violet" isActive={isActive('/rrhh/gestion-documental')} />

                  {/* Group 2: Personal activo */}
                  <p className="text-[8px] font-black text-violet-400 uppercase tracking-widest px-2 pt-2 pb-0.5">Personal Activo</p>
                  <MenuLink path="/rrhh/personal-activo" icon={ClipboardList} label="Personal Activo" accent="violet" isActive={isActive('/rrhh/personal-activo')} />
                  <MenuLink path="/rrhh/nomina" icon={DollarSign} label="Nómina (Payroll)" accent="violet" isActive={isActive('/rrhh/nomina')} />
                  <MenuLink path="/rrhh/relaciones-laborales" icon={ShieldAlert} label="Relaciones Laborales" accent="violet" isActive={isActive('/rrhh/relaciones-laborales')} />
                  <MenuLink path="/rrhh/vacaciones-licencias" icon={Plane} label="Vacaciones & Licencias" accent="violet" isActive={isActive('/rrhh/vacaciones-licencias')} />

                  {/* Group 3: Asistencia — sub-module */}
                  <p className="text-[8px] font-black text-violet-400 uppercase tracking-widest px-2 pt-2 pb-0.5">Asistencia</p>
                  <SubModule label="Asistencia & Turnos" icon={CalendarCheck} isOpen={openSections.asistencia} onToggle={() => toggle('asistencia')} accent="violet">
                    <MenuLink path="/rrhh/control-asistencia" icon={Fingerprint} label="Control Asistencia" accent="violet" isActive={isActive('/rrhh/control-asistencia')} />
                    <MenuLink path="/rrhh/turnos" icon={CalendarClock} label="Prog. de Turnos" accent="violet" isActive={isActive('/rrhh/turnos')} />
                  </SubModule>
                </ExpandedSection>
              )}
            </section>
          )}

          {/* ─── MÓDULO 3: PREVENCIÓN DE RIESGOS ─── */}
          {hasAccess('prevencion') && (
            <section>
              <ParentModule
                key={MODULES[2].key}
                {...Object.fromEntries(Object.entries(MODULES[2]).filter(([k]) => k !== 'key'))}
                isOpen={openSections.prevencion}
                onToggle={() => toggle('prevencion')}
              />
              {openSections.prevencion && (
                <ExpandedSection color="rose">
                  <SubModule label="Gestión Operativa" icon={HardHat} isOpen={openSections.hseOp} onToggle={() => toggle('hseOp')} accent="rose">
                    <MenuLink path="/prevencion/ast" icon={PenTool} label="Generación AST" accent="rose" isActive={isActive('/prevencion/ast')} />
                    <MenuLink path="/prevencion/procedimientos" icon={BookOpen} label="Procedimientos & PTS" accent="rose" isActive={isActive('/prevencion/procedimientos')} />
                    <MenuLink path="/prevencion/difusion" icon={GraduationCap} label="Difusión & Charlas" accent="rose" isActive={isActive('/prevencion/difusion')} />
                    <SubModule label="Inspecciones" icon={ClipboardList} isOpen={openSections.inspecciones} onToggle={() => toggle('inspecciones')} accent="rose">
                      <MenuLink path="/prevencion/inspecciones" icon={ShieldCheck} label="Cumplimiento Prev." accent="rose" isActive={isActive('/prevencion/inspecciones')} />
                    </SubModule>
                  </SubModule>

                  <SubModule label="Seguridad & Salud" icon={ShieldCheck} isOpen={openSections.hseSafety} onToggle={() => toggle('hseSafety')} accent="rose">
                    <MenuLink path="/rrhh/seguridad-ppe" icon={CheckSquare} label="Acreditación & PPE" accent="rose" isActive={isActive('/rrhh/seguridad-ppe')} />
                    <MenuLink path="/prevencion/incidentes" icon={AlertTriangle} label="Investigación Accidentes" accent="rose" isActive={isActive('/prevencion/incidentes')} />
                    <MenuLink path="/prevencion/matriz-riesgos" icon={SlidersHorizontal} label="Matriz IPER" accent="rose" isActive={isActive('/prevencion/matriz-riesgos')} />
                  </SubModule>

                  <SubModule label="Control & Seguimiento" icon={BarChart3} isOpen={openSections.hseControl} onToggle={() => toggle('hseControl')} accent="rose">
                    <MenuLink path="/prevencion/hse-audit" icon={ClipboardCheck} label="Auditoría HSE" accent="rose" isActive={isActive('/prevencion/hse-audit')} />
                    <MenuLink path="/prevencion/dashboard" icon={TrendingUp} label="Dashboard HSE" accent="rose" isActive={isActive('/prevencion/dashboard')} />
                    <MenuLink path="/prevencion/historial" icon={History} label="Historial Prev." accent="rose" isActive={isActive('/prevencion/historial')} />
                  </SubModule>
                </ExpandedSection>
              )}
            </section>
          )}

          {/* ─── MÓDULO 4: FLOTA & GPS ─── */}
          {hasAccess('flota') && (
            <section>
              <ParentModule
                key={MODULES[3].key}
                {...Object.fromEntries(Object.entries(MODULES[3]).filter(([k]) => k !== 'key'))}
                isOpen={openSections.flota}
                onToggle={() => toggle('flota')}
              />
              {openSections.flota && (
                <ExpandedSection color="sky">
                  <MenuLink path="/flota" icon={Truck} label="Flota de Vehículos" accent="sky" isActive={isActive('/flota')} />
                  <MenuLink path="/monitor-gps" icon={MapPin} label="Monitor GPS" accent="sky" isActive={isActive('/monitor-gps')} />
                </ExpandedSection>
              )}
            </section>
          )}

          {/* ─── MÓDULO 5: OPERACIONES ─── */}
          {hasAccess('operaciones') && (
            <section>
              <ParentModule
                key={MODULES[4].key}
                {...Object.fromEntries(Object.entries(MODULES[4]).filter(([k]) => k !== 'key'))}
                isOpen={openSections.operaciones}
                onToggle={() => toggle('operaciones')}
                color="indigo"
              />
              {openSections.operaciones && (
                <ExpandedSection color="indigo">
                  {/* Portal de Supervisión - Solo Supervisores, Admin y CEO */}
                  {(['supervisor_hse', 'admin', 'ceo_genai', 'ceo'].includes(user?.role)) && (
                    <MenuLink path="/operaciones/portal-supervision" icon={ShieldCheck} label="Portal Supervisión" accent="indigo" isActive={isActive('/operaciones/portal-supervision')} />
                  )}

                  {/* Portal Colaborador - Visible para TODOS (Incluidos Supervisores) */}
                  <MenuLink path="/operaciones/portal-colaborador" icon={Fingerprint} label="Portal Colaborador" accent="indigo" isActive={isActive('/operaciones/portal-colaborador')} />

                  {/* Gestión de Portales - Solo Admin y CEO */}
                  {(['admin', 'ceo_genai', 'ceo'].includes(user?.role)) && (
                    <MenuLink path="/operaciones/gestion-portales" icon={Settings} label="Gestión de Portales" accent="indigo" isActive={isActive('/operaciones/gestion-portales')} />
                  )}
                </ExpandedSection>
              )}
            </section>
          )}

          {/* ─── MÓDULO 6: RENDIMIENTO PRODUCTIVO ─── */}
          {hasAccess('seguimiento') && (
            <section>
              <ParentModule
                key={MODULES[5].key}
                {...Object.fromEntries(Object.entries(MODULES[5]).filter(([k]) => k !== 'key'))}
                isOpen={openSections.seguimiento}
                onToggle={() => toggle('seguimiento')}
              />
              {openSections.seguimiento && (
                <ExpandedSection color="emerald">
                  <MenuLink path="/rendimiento" icon={Activity} label="Producción Operativa" accent="emerald" isActive={isActive('/rendimiento')} />
                  <MenuLink path="/produccion-financiera" icon={DollarSign} label="Producción Financiera" accent="emerald" isActive={isActive('/produccion-financiera')} />
                  <MenuLink path="/tarifario" icon={CreditCard} label="Tarifario & Baremos" accent="emerald" isActive={isActive('/tarifario')} />
                </ExpandedSection>
              )}
            </section>
          )}

          {/* ─── MÓDULO 7: CONFIGURACIONES ─── */}
          {hasAccess('config') && (
            <section>
              <ParentModule
                key={MODULES[6].key}
                {...Object.fromEntries(Object.entries(MODULES[6]).filter(([k]) => k !== 'key'))}
                isOpen={openSections.config}
                onToggle={() => toggle('config')}
              />
              {openSections.config && (
                <ExpandedSection color="orange">
                  <SubModule label="Tarifario Maestro" icon={FileText} isOpen={openSections.tarifario} onToggle={() => toggle('tarifario')} accent="orange">
                    <MenuLink path="/baremos" icon={SlidersHorizontal} label="Baremos Base" accent="orange" isActive={isActive('/baremos')} />
                    <MenuLink path="/tarifario" icon={FileText} label="Tarifario Clientes" accent="orange" isActive={isActive('/tarifario')} />
                  </SubModule>
                  <MenuLink path="/configuracion-empresa" icon={Building2} label="Config. Empresa" accent="orange" isActive={isActive('/configuracion-empresa')} />
                  <MenuLink path="/gestion-personal" icon={Users} label="Gestión de Personal" accent="orange" isActive={isActive('/gestion-personal')} />
                </ExpandedSection>
              )}
            </section>
          )}

        </div>

        {/* ── FOOTER ── */}
        <div className="p-4 border-t border-slate-100 bg-gradient-to-t from-slate-50 to-white">
          {user && (
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center mb-3 truncate px-2">
              {user.email}
            </p>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2.5 bg-red-50 border border-red-100 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 py-3.5 rounded-2xl text-[10px] font-black transition-all uppercase tracking-widest shadow-sm hover:shadow-lg hover:shadow-red-200"
          >
            <LogOut size={15} /> Cerrar Sesión
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
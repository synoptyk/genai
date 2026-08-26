import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Home, LogOut, Menu, Shield, Bell, Sun, Moon } from 'lucide-react';
import { useAuth } from '../platforms/auth/AuthContext';
import SecurityModal from '../platforms/auth/SecurityModal';
import NotificationsBell from './NotificationsBell';
import { BRAND } from '../branding/brand';

/**
 * AppHeader — barra superior en páginas internas.
 * Muestra: breadcrumb del módulo activo + botón Volver + email usuario.
 */

const ROUTES_LABELS = {
    '/prevencion/dashboard': 'Dashboard HSE',
    '/prevencion/ast': 'Generación AST',
    '/prevencion/hse-audit': 'Auditoría HSE',
    '/prevencion/operatividad': 'Gestión Operativa',
    '/prevencion/procedimientos': 'Procedimientos & PTS',
    '/prevencion/difusion': 'Difusión & Charlas',
    '/prevencion/incidentes': 'Investigación Accidentes',
    '/prevencion/matriz-riesgos': 'Matriz de Riesgos IPER',
    '/prevencion/historial': 'Historial Preventivo',
    '/prevencion/inspecciones': 'Inspecciones en Terreno',
    '/rrhh/captura-talento': 'Captura de Talento',
    '/rrhh/gestion-documental': 'Gestión Documental',
    '/rrhh/personal-activo': 'Personal Activo',
    '/rrhh/nomina': 'Nómina (Payroll)',
    '/rrhh/relaciones-laborales': 'Relaciones Laborales',
    '/rrhh/vacaciones-licencias': 'Vacaciones & Licencias',
    '/rrhh/control-asistencia': 'Control de Asistencia',
    '/rrhh/turnos': 'Programación de Turnos',
    '/rrhh/seguridad-ppe': 'Acreditación & PPE',
    '/rrhh/historial': 'Historial RRHH',
    '/rrhh': 'Aprobaciones',
    '/dashboard': 'Dashboard General',
    '/flota': 'Flota de Vehículos',
    '/monitor-gps': 'GPS SIMPLE',
    '/mapa-calor': 'Mapa de Calor',
    '/rendimiento': 'Telecomunicaciones',
    '/produccion-financiera': 'Producción Financiera',
    '/tarifario': 'Tarifario',
    '/ajustes': 'Configuración',
    '/configuracion-empresa': 'Configuración Empresa',
    '/gestion-personal': 'Gestión de Personal',
    '/ceo/command-center': 'CEO Command Center',
    '/operaciones/portal-supervision': 'Portal Supervisión Operaciones',
    '/conexiones': 'Mercado Financiero',
};

const AppHeader = ({ onMenuClick }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, auditCompany } = useAuth();
    const [showSecurity, setShowSecurity] = useState(false);
    const [darkMode, setDarkMode] = useState(() => {
        if (typeof document !== 'undefined') {
            return document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
        }
        return false;
    });

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [darkMode]);

    const toggleDarkMode = () => {
        setDarkMode(!darkMode);
    };

    const pageLabel = ROUTES_LABELS[location.pathname] || 'Plataforma Corporativa';
    const isHome = location.pathname === '/dashboard' || location.pathname === '/';

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <>
            <div className="bg-white px-2.5 md:px-6 py-2.5 md:py-3.5 flex items-center justify-between flex-shrink-0 print:hidden relative z-40 gap-2 md:gap-3"
              style={{borderBottom:'2px solid #e8eef8', boxShadow:'0 2px 12px rgba(13,24,84,0.06)'}}>
                {/* Left: back + breadcrumb */}
                <div className="flex items-center gap-1 sm:gap-3 flex-1 min-w-0">
                    {/* Mobile Menu Toggle */}
                    <button
                        onClick={onMenuClick}
                        className="md:hidden flex-shrink-0 flex items-center justify-center p-2 rounded-lg transition-colors"
                        style={{color:'#1565c0', background:'#e3f2fd'}}
                    >
                        <Menu size={18} />
                    </button>

                    <button
                        onClick={() => navigate('/dashboard')}
                        className="hidden sm:flex flex-shrink-0 items-center gap-2 px-2 py-1.5 rounded-xl border transition-all"
                        style={{borderColor:'#e8eef8', background:'#fafbff'}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='#c5d8f5';e.currentTarget.style.background='#e3f2fd';}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor='#e8eef8';e.currentTarget.style.background='#fafbff';}}
                        title={BRAND.fullName}
                    >
                        <img src={BRAND.logoPath} alt={BRAND.fullName} className="w-6 h-6 rounded-lg" />
                        <span className="text-[9px] font-black uppercase tracking-wider" style={{color:'#0d1854'}}>{BRAND.shortName}</span>
                    </button>

                    {!isHome && (
                        <button
                            onClick={() => navigate(-1)}
                            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-black transition-all border uppercase tracking-wide"
                            style={{color:'#8fa3c0', borderColor:'#e8eef8', background:'transparent'}}
                            onMouseEnter={e=>{e.currentTarget.style.background='#e3f2fd';e.currentTarget.style.color='#1565c0';e.currentTarget.style.borderColor='#c5d8f5';}}
                            onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='#8fa3c0';e.currentTarget.style.borderColor='#e8eef8';}}
                        >
                            <ChevronLeft size={15} /> <span className="hidden sm:inline">Volver</span>
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/prevencion/dashboard')}
                        className="flex-shrink-0 flex items-center gap-2 text-[10px] sm:text-[11px] font-black transition-colors px-1"
                        style={{color:'#b0c0d8'}}
                        onMouseEnter={e=>e.currentTarget.style.color='#1565c0'}
                        onMouseLeave={e=>e.currentTarget.style.color='#b0c0d8'}
                    >
                        <Home size={13} />
                    </button>
                    <span className="text-xs flex-shrink-0" style={{color:'#d0e0f0'}}>/</span>
                    <span className="text-[10px] sm:text-[12px] font-black uppercase tracking-wide truncate max-w-[120px] sm:max-w-none" style={{color:'#0d1854'}}>{pageLabel}</span>
                </div>

                {/* Right: user info + logout */}
                <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                    {user && (
                        <div className="flex items-center gap-2 md:gap-4">
                            <div className="hidden md:flex items-center gap-3">
                                <div className="text-right">
                                    <p className="text-[11px] font-black" style={{color:'#0d1854'}}>{user.name}</p>
                                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{color: auditCompany ? '#f59e0b' : '#00897b'}}>
                                        {auditCompany ? `⚠️ Auditando: ${auditCompany.nombre}` : (user.empresa?.nombre || 'Portal Corporativo')}
                                    </p>
                                </div>
                            </div>
                            <NotificationsBell />

                            <button 
                                onClick={() => setShowSecurity(true)}
                                className="group relative w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-lg md:rounded-xl transition-all border"
                                style={{background:'#f0f4ff', borderColor:'#d0e4f7'}}
                                title="Configurar Seguridad PIN"
                                onMouseEnter={e=>{e.currentTarget.style.background='#e3f2fd';e.currentTarget.style.borderColor='#1565c0';}}
                                onMouseLeave={e=>{e.currentTarget.style.background='#f0f4ff';e.currentTarget.style.borderColor='#d0e4f7';}}
                            >
                                <Shield size={15} style={{color:'#1565c0'}} className="group-hover:scale-110 transition-transform" />
                                {!user.loginPin && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 border-2 border-white rounded-full animate-pulse" />
                                )}
                            </button>

                            <div className="hidden sm:flex w-9 h-9 rounded-xl items-center justify-center text-white font-black text-sm shadow-lg"
                              style={{background:'linear-gradient(135deg, #1565c0, #5c35d4)'}}>
                                {user.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[10px] md:text-[11px] font-black transition-all uppercase tracking-wide"
                        style={{color:'#ef4444', borderColor:'#fecaca', border:'1px solid #fecaca', background:'#fff5f5'}}
                        onMouseEnter={e=>{e.currentTarget.style.background='#fee2e2';e.currentTarget.style.boxShadow='0 4px 12px rgba(239,68,68,0.15)';}}
                        onMouseLeave={e=>{e.currentTarget.style.background='#fff5f5';e.currentTarget.style.boxShadow='';} }
                    >
                        <LogOut size={14} /> <span className="hidden sm:inline">Salir</span>
                    </button>
                </div>
            </div>

            <SecurityModal isOpen={showSecurity} onClose={() => setShowSecurity(false)} />
        </>
    );
};

export default AppHeader;


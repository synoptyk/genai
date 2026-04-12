import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Home, LogOut, Menu, Shield, Bell } from 'lucide-react';
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

    const pageLabel = ROUTES_LABELS[location.pathname] || 'Plataforma Corporativa';
    const isHome = location.pathname === '/dashboard' || location.pathname === '/';

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <>
            <div className="bg-white border-b border-slate-100 px-3 md:px-6 py-3 md:py-4 flex items-center justify-between shadow-sm flex-shrink-0 print:hidden relative z-40 gap-3">
                {/* Left: back + breadcrumb */}
                <div className="flex items-center gap-1 sm:gap-3 flex-1 min-w-0">
                    {/* Mobile Menu Toggle */}
                    <button
                        onClick={onMenuClick}
                        className="md:hidden flex-shrink-0 flex items-center justify-center p-2 rounded-xl text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                    >
                        <Menu size={20} />
                    </button>

                    <button
                        onClick={() => navigate('/dashboard')}
                        className="hidden sm:flex flex-shrink-0 items-center gap-2 px-2 py-1.5 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all"
                        title={BRAND.fullName}
                    >
                        <img src={BRAND.logoPath} alt={BRAND.fullName} className="w-6 h-6 rounded-lg" />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{BRAND.shortName}</span>
                    </button>

                    {!isHome && (
                        <button
                            onClick={() => navigate(-1)}
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] sm:text-[11px] font-black text-slate-500 hover:bg-indigo-50 hover:text-indigo-700 transition-all border border-transparent hover:border-indigo-100 uppercase tracking-wide"
                        >
                            <ChevronLeft size={16} /> <span className="hidden sm:inline">Volver</span>
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/prevencion/dashboard')}
                        className="flex-shrink-0 flex items-center gap-2 text-[10px] sm:text-[11px] font-black text-slate-400 hover:text-indigo-600 transition-colors px-1"
                    >
                        <Home size={14} />
                    </button>
                    <span className="text-slate-300 text-xs flex-shrink-0">/</span>
                    <span className="text-[10px] sm:text-[12px] font-black text-slate-700 uppercase tracking-wide truncate max-w-[120px] sm:max-w-none">{pageLabel}</span>
                </div>

                {/* Right: user info + logout */}
                <div className="flex items-center gap-4 flex-shrink-0">
                    {user && (
                        <div className="flex items-center gap-2 md:gap-4">
                            <div className="hidden md:flex items-center gap-3">
                                <div className="text-right">
                                    <p className="text-[11px] font-black text-slate-700">{user.name}</p>
                                    <p className={`text-[9px] font-bold uppercase tracking-wider ${auditCompany ? 'text-amber-600' : 'text-slate-400'}`}>
                                        {auditCompany ? `Auditando: ${auditCompany.nombre}` : (user.empresa?.nombre || 'Portal Corporativo')}
                                    </p>
                                </div>
                            </div>
                            <NotificationsBell />

                            <button 
                                onClick={() => setShowSecurity(true)}
                                className="group relative w-9 h-9 flex items-center justify-center bg-slate-50 hover:bg-indigo-600 rounded-xl transition-all shadow-sm border border-slate-100 hover:border-indigo-500 hover:shadow-indigo-100"
                                title="Configurar Seguridad PIN"
                            >
                                <Shield size={16} className="text-slate-400 group-hover:text-white group-hover:scale-110 transition-all" />
                                {!user.loginPin && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 border-2 border-white rounded-full animate-pulse" />
                                )}
                            </button>

                            <div className="hidden sm:flex w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl items-center justify-center text-white font-black text-sm shadow-lg">
                                {user.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black text-red-500 hover:bg-red-50 hover:text-red-700 transition-all border border-transparent hover:border-red-100 uppercase tracking-wide"
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


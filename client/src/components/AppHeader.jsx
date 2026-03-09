import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Home, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../platforms/auth/AuthContext';

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
    '/monitor-gps': 'Monitor GPS',
    '/rendimiento': 'Producción Operativa',
    '/produccion-financiera': 'Producción Financiera',
    '/tarifario': 'Tarifario',
    '/ajustes': 'Configuración',
    '/configuracion-empresa': 'Configuración Empresa',
    '/gestion-personal': 'Gestión de Personal',
    '/ceo/command-center': 'CEO Command Center',
    '/operaciones/portal-supervision': 'Portal Supervisión Operaciones',
};

const AppHeader = ({ onMenuClick }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    const pageLabel = ROUTES_LABELS[location.pathname] || 'Plataforma Gen AI';
    const isHome = location.pathname === '/dashboard' || location.pathname === '/';

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="bg-white border-b border-slate-100 px-4 md:px-6 py-4 flex items-center justify-between shadow-sm flex-shrink-0 print:hidden relative z-40 gap-4">
            {/* Left: back + breadcrumb */}
            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                {/* Mobile Menu Toggle */}
                <button
                    onClick={onMenuClick}
                    className="md:hidden flex-shrink-0 flex items-center justify-center p-2 rounded-xl text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                >
                    <Menu size={20} />
                </button>

                {!isHome && (
                    <button
                        onClick={() => navigate(-1)}
                        className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black text-slate-500 hover:bg-indigo-50 hover:text-indigo-700 transition-all border border-transparent hover:border-indigo-100 uppercase tracking-wide"
                    >
                        <ChevronLeft size={16} /> <span className="hidden sm:inline">Volver</span>
                    </button>
                )}
                <button
                    onClick={() => navigate('/prevencion/dashboard')}
                    className="flex-shrink-0 flex items-center gap-2 text-[11px] font-black text-slate-400 hover:text-indigo-600 transition-colors px-2"
                >
                    <Home size={14} />
                </button>
                <span className="text-slate-300 text-sm flex-shrink-0">/</span>
                <span className="text-[12px] font-black text-slate-700 uppercase tracking-wide truncate">{pageLabel}</span>
            </div>

            {/* Right: user info + logout */}
            <div className="flex items-center gap-4 flex-shrink-0">
                {user && (
                    <div className="hidden md:flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-[11px] font-black text-slate-700">{user.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{user.empresa?.nombre || 'Gen AI'}</p>
                        </div>
                        <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg">
                            {user.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                    </div>
                )}
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black text-red-500 hover:bg-red-50 hover:text-red-700 transition-all border border-transparent hover:border-red-100 uppercase tracking-wide"
                >
                    <LogOut size={14} /> Salir
                </button>
            </div>
        </div>
    );
};

export default AppHeader;

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './platforms/auth/AuthContext';
import { IndicadoresProvider } from './contexts/IndicadoresContext';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import AppHeader from './components/AppHeader';
import GlobalChatNotification from './components/GlobalChatNotification';
import FloatingGenAI from './components/FloatingGenAI';
import ScrollToTopButton from './components/ScrollToTopButton';
import PlatformLanding from './platforms/auth/PlatformLanding';
import PlatformLogin from './platforms/auth/PlatformLogin';
import SystemCommandCenter from './platforms/auth/SystemCommandCenter';
import NotFound from './platforms/auth/NotFound';
import MisClientes from './platforms/admin/pages/MisClientes';
import IntegracionesSII from './platforms/admin/pages/IntegracionesSII';
import IntegracionPrevired from './platforms/admin/pages/IntegracionPrevired';
import NominaBancaria from './platforms/admin/pages/NominaBancaria';
import GestionRindeGastos from './platforms/admin/pages/GestionRindeGastos';
import ConfigNotificaciones from './platforms/admin/pages/ConfigNotificaciones';
import ModelosBonificacion from './platforms/admin/pages/ModelosBonificacion';
import TiposBono from './platforms/admin/pages/TiposBono';

import DashboardTributario from './platforms/finanzas/pages/DashboardTributario';
import VideoCallRoom from './platforms/comunicaciones/pages/VideoCallRoom';
import Chat360 from './platforms/comunicaciones/pages/Chat360';
import DashboardTelecom from './platforms/agentetelecom/DashboardEjecutivo';
import Flota from './platforms/agentetelecom/Flota';
import MonitorGps from './platforms/agentetelecom/MonitorGps';
import Produccion from './platforms/agentetelecom/Produccion';
import ProduccionVenta from './platforms/agentetelecom/ProduccionVenta';
import Tarifario from './platforms/agentetelecom/Tarifario';
import DescargaTOA from './platforms/agentetelecom/DescargaTOA';
import BonificacionesTelco from './platforms/agentetelecom/BonificacionesTelco';
import Ajustes from './platforms/agentetelecom/Ajustes';
import RecursosHumanos from './platforms/agentetelecom/modules/RecursosHumanos';
import Proyectos from './platforms/rrhh/pages/Proyectos';
import Conexiones from './platforms/agentetelecom/Conexiones';
import Baremos from './platforms/agentetelecom/Baremos';
import Designaciones from './platforms/agentetelecom/Designaciones';
import MapaCalor from './platforms/agentetelecom/MapaCalor';
import Dotacion from './platforms/agentetelecom/Dotacion';
import SeguridadPPE from './platforms/rrhh/pages/SeguridadPPE';
import GestionDocumental from './platforms/rrhh/pages/GestionDocumental';
import NominaRRHH from './platforms/rrhh/pages/NominaRRHH';
import RelacionesLaborales from './platforms/rrhh/pages/RelacionesLaborales';
import CapturaTalento from './platforms/rrhh/pages/CapturaTalento';
import ControlAsistencia from './platforms/rrhh/pages/ControlAsistencia';
import HistorialRRHH from './platforms/rrhh/pages/HistorialRRHH';
import PersonalActivo from './platforms/rrhh/pages/PersonalActivo';
import ProgramacionTurnos from './platforms/rrhh/pages/ProgramacionTurnos';
import VacacionesLicencias from './platforms/rrhh/pages/VacacionesLicencias';
import ConfiguracionEmpresa from './platforms/rrhh/pages/ConfiguracionEmpresa';
import GestorPersonal from './platforms/rrhh/pages/GestorPersonal';
import ContratosYAnexos from './platforms/rrhh/pages/ContratosYAnexos';
import RemuCentral from './platforms/rrhh/pages/RemuCentral';
import Finiquitos from './platforms/rrhh/pages/Finiquitos';
import PrevASTForm from './platforms/prevencion/pages/PrevASTForm';
import PrevHseConsole from './platforms/prevencion/pages/PrevHseConsole';
import PrevOperatividad from './platforms/prevencion/pages/PrevOperatividad';
import PrevProcedimientos from './platforms/prevencion/pages/PrevProcedimientos';
import PrevDifusion from './platforms/prevencion/pages/PrevDifusion';
import PrevIncidentes from './platforms/prevencion/pages/PrevIncidentes';
import PrevMatrizRiesgos from './platforms/prevencion/pages/PrevMatrizRiesgos';
import PrevDashboard from './platforms/prevencion/pages/PrevDashboard';
import PrevHistorial from './platforms/prevencion/pages/PrevHistorial';
import PrevInspecciones from './platforms/prevencion/pages/PrevInspecciones';
import PortalSupervision from './platforms/operaciones/pages/PortalSupervision';
import PortalColaborador from './platforms/operaciones/pages/PortalColaborador';
import RindeGastos from './platforms/operaciones/pages/RindeGastos';
import PortalesOperativos from './platforms/admin/pages/PortalesOperativos';
import LogisticaDashboard from './platforms/logistica/pages/LogisticaDashboard';
import Inventario from './platforms/logistica/pages/Inventario';
import Almacenes from './platforms/logistica/pages/Almacenes';
import Despachos from './platforms/logistica/pages/Despachos';
import GestionMovimientos from './platforms/logistica/pages/GestionMovimientos';
import Auditorias from './platforms/logistica/pages/Auditorias';
import GestionCategorias from './platforms/logistica/pages/GestionCategorias';
import ConfigLogistica from './platforms/logistica/pages/ConfigLogistica';
import HistorialMovimientos from './platforms/logistica/pages/HistorialMovimientos';
import Proveedores from './platforms/logistica/pages/Proveedores';
import GestionCompras from './platforms/logistica/pages/GestionCompras';
import Aprobaciones360 from './platforms/admin/pages/Aprobaciones360';
import AIAssistant from './platforms/ai/AIAssistant';
import Facturacion360 from './platforms/empresa360/pages/Facturacion360';
import Beneficios360 from './platforms/empresa360/pages/Beneficios360';
import CapacitacionLMS from './platforms/empresa360/pages/CapacitacionLMS';
import Evaluaciones360 from './platforms/empresa360/pages/Evaluaciones360';
import Biometria360 from './platforms/empresa360/pages/Biometria360';
import Tesoreria360 from './platforms/empresa360/pages/Tesoreria360';

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      const failedAuthHeader = error.config?.headers?.Authorization || '';
      const failedToken = failedAuthHeader.replace('Bearer ', '').trim();
      
      const stored = localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user');
      let currentToken = null;
      if (stored) {
         try { currentToken = JSON.parse(stored).token; } catch (e) {}
      }

      // Evita que peticiones rezagadas con token viejo destruyan la sesión nueva activa
      if (failedToken && currentToken && failedToken !== currentToken) {
          console.warn('⚠️ Se detectó un 401 rezagado: el token usado ya es diferente al guardado en la sesión activa. Se ignorará la desconexión.');
          return Promise.reject(error);
      }

      console.warn('⚠️ Sesión expirada o inválida detectada (401). Cerrando sesión...');
      localStorage.removeItem('platform_user');
      sessionStorage.removeItem('platform_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Protected Route (requires login) ──
const ProtectedRoute = ({ children, ceoOnly = false, allowRoles = null, allowPermissions = null }) => {
  const { user, loading } = useAuth();

  const hasPermissionView = (permissionKey) => {
    if (!permissionKey || !user) return false;
    if (['system_admin', 'ceo'].includes(user.role)) return true;

    const perms = user.permisosModulos || {};
    const grant = perms instanceof Map ? perms.get(permissionKey) : perms[permissionKey];
    return grant?.ver === true;
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-[#020617]">
      <div className="w-12 h-12 border-4 border-rose-100/20 border-t-rose-600 rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (ceoOnly && user.role !== 'system_admin' && user.role !== 'ceo') return <Navigate to="/operaciones/portal-colaborador" replace />;
  if (Array.isArray(allowRoles) && allowRoles.length > 0 && !allowRoles.includes(user.role)) {
    return <Navigate to="/operaciones/portal-colaborador" replace />;
  }
  if (Array.isArray(allowPermissions) && allowPermissions.length > 0) {
    const hasAnyAllowedPermission = allowPermissions.some((permissionKey) => hasPermissionView(permissionKey));
    if (!hasAnyAllowedPermission) {
      return <Navigate to="/operaciones/portal-colaborador" replace />;
    }
  }
  return children;
};

// ── App Shell: Sidebar + Content ──
const AppShell = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const mainRef = React.useRef(null);

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans overflow-hidden">
      <Sidebar isMobileOpen={isMobileMenuOpen} setIsMobileOpen={setIsMobileMenuOpen} />
      <div className="flex-1 flex flex-col h-full relative overflow-hidden min-w-0">
        <AppHeader onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
          {children}
        </main>
      </div>
      <GlobalChatNotification />
      <ScrollToTopButton scrollContainerRef={mainRef} />
    </div>
  );
};

function AppRoutes() {
  return (
    <Routes>
      {/* ── PUBLIC ROUTES ── */}
      <Route path="/" element={<PlatformLanding />} />
      <Route path="/login" element={<PlatformLogin />} />

      {/* ── CEO MODULE (protected + CEO only) ── */}
      <Route path="/ceo/command-center" element={
        <ProtectedRoute ceoOnly>
          <SystemCommandCenter />
        </ProtectedRoute>
      } />


      {/* ── APP SHELL ROUTES (protected) ── */}
      <Route path="/dashboard" element={
        <ProtectedRoute allowPermissions={['admin_resumen_ejecutivo']}>
          <AppShell><DashboardTelecom /></AppShell>
        </ProtectedRoute>
      } />
      <Route path="/rrhh" element={<ProtectedRoute allowPermissions={['rrhh_captura', 'rrhh_documental', 'rrhh_activos', 'rrhh_nomina', 'rrhh_laborales', 'rrhh_vacaciones', 'rrhh_asistencia', 'rrhh_turnos']}><AppShell><RecursosHumanos /></AppShell></ProtectedRoute>} />
      <Route path="/proyectos" element={<ProtectedRoute allowPermissions={['admin_proyectos']}><AppShell><Proyectos /></AppShell></ProtectedRoute>} />
      <Route path="/conexiones" element={<ProtectedRoute allowPermissions={['admin_conexiones']}><AppShell><Conexiones /></AppShell></ProtectedRoute>} />
      <Route path="/baremos" element={<ProtectedRoute allowPermissions={['cfg_baremos']}><AppShell><Baremos /></AppShell></ProtectedRoute>} />
      <Route path="/designaciones" element={<ProtectedRoute allowPermissions={['op_designaciones']}><AppShell><Designaciones /></AppShell></ProtectedRoute>} />
      <Route path="/mapa-calor" element={<ProtectedRoute allowPermissions={['op_mapa_calor']}><AppShell><MapaCalor /></AppShell></ProtectedRoute>} />
      <Route path="/dotacion" element={<ProtectedRoute allowPermissions={['op_dotacion']}><AppShell><Dotacion /></AppShell></ProtectedRoute>} />
      <Route path="/flota" element={<ProtectedRoute allowPermissions={['flota_vehiculos']}><AppShell><Flota /></AppShell></ProtectedRoute>} />
      <Route path="/monitor-gps" element={<ProtectedRoute allowPermissions={['flota_gps']}><AppShell><MonitorGps /></AppShell></ProtectedRoute>} />
      <Route path="/rendimiento" element={<ProtectedRoute allowPermissions={['rend_operativo']}><AppShell><Produccion /></AppShell></ProtectedRoute>} />
      <Route path="/rendimiento/cierre-bonos" element={<ProtectedRoute allowPermissions={['rend_cierre_bonos', 'rrhh_nomina']}><AppShell><BonificacionesTelco /></AppShell></ProtectedRoute>} />
      <Route path="/produccion-financiera" element={<ProtectedRoute allowPermissions={['rend_financiero']}><AppShell><ProduccionVenta /></AppShell></ProtectedRoute>} />
      <Route path="/tarifario" element={<ProtectedRoute allowPermissions={['rend_tarifario']}><AppShell><Tarifario /></AppShell></ProtectedRoute>} />
      <Route path="/descarga-toa" element={<ProtectedRoute allowPermissions={['rend_descarga_toa']}><AppShell><DescargaTOA /></AppShell></ProtectedRoute>} />
      <Route path="/config-lpu" element={<ProtectedRoute allowPermissions={['rend_config_lpu']}><AppShell><BonificacionesTelco /></AppShell></ProtectedRoute>} />
      <Route path="/ajustes" element={<ProtectedRoute allowPermissions={['cfg_empresa']}><AppShell><Ajustes /></AppShell></ProtectedRoute>} />

      {/* RRHH */}
      <Route path="/rrhh/seguridad-ppe" element={<ProtectedRoute allowPermissions={['prev_acreditacion', 'rrhh_seguridad_ppe']}><AppShell><SeguridadPPE /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/gestion-documental" element={<ProtectedRoute allowPermissions={['rrhh_documental']}><AppShell><GestionDocumental /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/nomina" element={<ProtectedRoute allowPermissions={['rrhh_nomina']}><AppShell><NominaRRHH /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/relaciones-laborales" element={<ProtectedRoute allowPermissions={['rrhh_laborales']}><AppShell><RelacionesLaborales /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/captura-talento" element={<ProtectedRoute allowPermissions={['rrhh_captura']}><AppShell><CapturaTalento /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/remu-central" element={<ProtectedRoute allowPermissions={['rrhh_nomina']}><AppShell><RemuCentral /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/control-asistencia" element={<ProtectedRoute allowPermissions={['rrhh_asistencia']}><AppShell><ControlAsistencia /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/historial" element={<Navigate to="/dashboard" replace />} />
      <Route path="/rrhh/personal-activo" element={<ProtectedRoute allowPermissions={['rrhh_activos']}><AppShell><PersonalActivo /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/turnos" element={<ProtectedRoute allowPermissions={['rrhh_turnos']}><AppShell><ProgramacionTurnos /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/vacaciones-licencias" element={<ProtectedRoute allowPermissions={['rrhh_vacaciones']}><AppShell><VacacionesLicencias /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/finiquitos" element={<ProtectedRoute allowPermissions={['rrhh_finiquitos']}><AppShell><Finiquitos /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/contratos-anexos" element={<ProtectedRoute allowPermissions={['rrhh_contratos_anexos', 'rrhh_documental']}><AppShell><ContratosYAnexos /></AppShell></ProtectedRoute>} />
      <Route path="/configuracion-empresa" element={<ProtectedRoute allowPermissions={['cfg_empresa']}><AppShell><ConfiguracionEmpresa /></AppShell></ProtectedRoute>} />
      <Route path="/gestion-personal" element={<ProtectedRoute allowPermissions={['cfg_personal']}><AppShell><GestorPersonal /></AppShell></ProtectedRoute>} />

      {/* ADMINISTRACIÓN AVANZADA */}
      <Route path="/administracion/mis-clientes" element={<ProtectedRoute allowPermissions={['admin_mis_clientes']}><AppShell><MisClientes /></AppShell></ProtectedRoute>} />
      <Route path="/administracion/mis-clientes" element={<ProtectedRoute allowPermissions={['admin_mis_clientes']}><AppShell><MisClientes /></AppShell></ProtectedRoute>} />
      <Route path="/administracion/sii" element={<ProtectedRoute allowPermissions={['admin_sii']}><AppShell><IntegracionesSII /></AppShell></ProtectedRoute>} />
      <Route path="/administracion/previred" element={<ProtectedRoute allowPermissions={['admin_previred']}><AppShell><IntegracionPrevired /></AppShell></ProtectedRoute>} />
      <Route path="/administracion/pagos-bancarios" element={<ProtectedRoute allowPermissions={['admin_pagos_bancarios']}><AppShell><NominaBancaria /></AppShell></ProtectedRoute>} />
      <Route path="/administracion/gestion-gastos" element={<ProtectedRoute allowPermissions={['admin_gestion_gastos']}><AppShell><GestionRindeGastos /></AppShell></ProtectedRoute>} />
      <Route path="/administracion/configuracion-notificaciones" element={<ProtectedRoute allowPermissions={['admin_config_notificaciones']}><AppShell><ConfigNotificaciones /></AppShell></ProtectedRoute>} />
      <Route path="/administracion/modelos-bonificacion" element={<ProtectedRoute allowPermissions={['admin_modelos_bonificacion']}><AppShell><ModelosBonificacion /></AppShell></ProtectedRoute>} />
      <Route path="/administracion/tipos-bono" element={<ProtectedRoute allowPermissions={['admin_tipos_bono']}><AppShell><TiposBono /></AppShell></ProtectedRoute>} />

      <Route path="/administracion/dashboard-tributario" element={<ProtectedRoute allowPermissions={['admin_dashboard_tributario']}><AppShell><DashboardTributario /></AppShell></ProtectedRoute>} />
      <Route path="/empresa360/facturacion" element={<ProtectedRoute allowPermissions={['emp360_facturacion']}><AppShell><Facturacion360 /></AppShell></ProtectedRoute>} />
      <Route path="/empresa360/beneficios" element={<ProtectedRoute allowPermissions={['emp360_beneficios']}><AppShell><Beneficios360 /></AppShell></ProtectedRoute>} />
      <Route path="/empresa360/lms" element={<ProtectedRoute allowPermissions={['emp360_lms']}><AppShell><CapacitacionLMS /></AppShell></ProtectedRoute>} />
      <Route path="/empresa360/evaluaciones" element={<ProtectedRoute allowPermissions={['emp360_evaluaciones']}><AppShell><Evaluaciones360 /></AppShell></ProtectedRoute>} />
      <Route path="/empresa360/biometria" element={<ProtectedRoute allowPermissions={['emp360_biometria']}><AppShell><Biometria360 /></AppShell></ProtectedRoute>} />
      <Route path="/empresa360/tesoreria" element={<ProtectedRoute allowPermissions={['emp360_tesoreria']}><AppShell><Tesoreria360 /></AppShell></ProtectedRoute>} />

      <Route path="/administracion/aprobaciones" element={<ProtectedRoute allowPermissions={['admin_aprobaciones', 'admin_aprobaciones_compras']}><AppShell><Aprobaciones360 /></AppShell></ProtectedRoute>} />
      <Route path="/administracion/aprobaciones-compras" element={<ProtectedRoute><Navigate to="/administracion/aprobaciones" replace /></ProtectedRoute>} />


      {/* PREVENCIÓN HSE */}
      <Route path="/prevencion/ast" element={<ProtectedRoute allowPermissions={['prev_ast']}><AppShell><PrevASTForm /></AppShell></ProtectedRoute>} />
      <Route path="/prevencion/hse-audit" element={<ProtectedRoute allowPermissions={['prev_auditoria']}><AppShell><PrevHseConsole /></AppShell></ProtectedRoute>} />
      <Route path="/prevencion/operatividad" element={<ProtectedRoute allowPermissions={['prev_dashboard', 'prev_historial']}><AppShell><PrevOperatividad /></AppShell></ProtectedRoute>} />
      <Route path="/prevencion/procedimientos" element={<ProtectedRoute allowPermissions={['prev_procedimientos']}><AppShell><PrevProcedimientos /></AppShell></ProtectedRoute>} />
      <Route path="/prevencion/difusion" element={<ProtectedRoute allowPermissions={['prev_charlas']}><AppShell><PrevDifusion /></AppShell></ProtectedRoute>} />
      <Route path="/prevencion/incidentes" element={<ProtectedRoute allowPermissions={['prev_accidentes']}><AppShell><PrevIncidentes /></AppShell></ProtectedRoute>} />
      <Route path="/prevencion/matriz-riesgos" element={<ProtectedRoute allowPermissions={['prev_iper']}><AppShell><PrevMatrizRiesgos /></AppShell></ProtectedRoute>} />
      <Route path="/prevencion/dashboard" element={<ProtectedRoute allowPermissions={['prev_dashboard']}><AppShell><PrevDashboard /></AppShell></ProtectedRoute>} />
      <Route path="/prevencion/historial" element={<ProtectedRoute allowPermissions={['prev_historial']}><AppShell><PrevHistorial /></AppShell></ProtectedRoute>} />
      <Route path="/prevencion/inspecciones" element={<ProtectedRoute allowPermissions={['prev_inspecciones']}><AppShell><PrevInspecciones /></AppShell></ProtectedRoute>} />

      {/* OPERACIONES */}
      <Route path="/operaciones/portal-supervision" element={<ProtectedRoute allowPermissions={['op_supervision']}><AppShell><PortalSupervision /></AppShell></ProtectedRoute>} />
      <Route path="/operaciones/portal-colaborador" element={<ProtectedRoute allowPermissions={['op_colaborador']}><AppShell><PortalColaborador /></AppShell></ProtectedRoute>} />
      <Route path="/operaciones/gastos" element={<ProtectedRoute allowPermissions={['op_gastos']}><AppShell><RindeGastos /></AppShell></ProtectedRoute>} />

      <Route path="/administracion/gestion-portales" element={
        <ProtectedRoute ceoOnly>
          <AppShell><PortalesOperativos /></AppShell>
        </ProtectedRoute>
      } />
 
      {/* LOGÍSTICA */}
      <Route path="/logistica" element={<ProtectedRoute allowPermissions={['logistica_dashboard']}><AppShell><LogisticaDashboard /></AppShell></ProtectedRoute>} />
      <Route path="/logistica/configuracion" element={<ProtectedRoute allowPermissions={['logistica_configuracion']}><AppShell><ConfigLogistica /></AppShell></ProtectedRoute>} />
      <Route path="/logistica/inventario" element={<ProtectedRoute allowPermissions={['logistica_inventario']}><AppShell><Inventario /></AppShell></ProtectedRoute>} />
      <Route path="/logistica/almacenes" element={<ProtectedRoute allowPermissions={['logistica_almacenes']}><AppShell><Almacenes /></AppShell></ProtectedRoute>} />
      <Route path="/logistica/movimientos" element={<ProtectedRoute allowPermissions={['logistica_movimientos']}><AppShell><GestionMovimientos /></AppShell></ProtectedRoute>} />
      <Route path="/logistica/despachos" element={<ProtectedRoute allowPermissions={['logistica_despachos']}><AppShell><Despachos /></AppShell></ProtectedRoute>} />
      <Route path="/logistica/historial" element={<ProtectedRoute allowPermissions={['logistica_historial']}><AppShell><HistorialMovimientos /></AppShell></ProtectedRoute>} />
      <Route path="/logistica/auditorias" element={<ProtectedRoute allowPermissions={['logistica_auditorias']}><AppShell><Auditorias /></AppShell></ProtectedRoute>} />
      <Route path="/logistica/proveedores" element={<ProtectedRoute allowPermissions={['logistica_proveedores']}><AppShell><Proveedores /></AppShell></ProtectedRoute>} />
      <Route path="/logistica/compras" element={<ProtectedRoute allowPermissions={['logistica_compras']}><AppShell><GestionCompras /></AppShell></ProtectedRoute>} />

      {/* COMUNICACIONES */}
      <Route path="/video-call/:roomId" element={<ProtectedRoute allowPermissions={['comunic_video']}><VideoCallRoom /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute allowPermissions={['social_chat']}><Chat360 /></ProtectedRoute>} />

      {/* GENAI360 — ASISTENTE DE INTELIGENCIA ARTIFICIAL */}
      <Route path="/ai/asistente" element={<ProtectedRoute><AppShell><AIAssistant /></AppShell></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  const showFloatingGenAI = process.env.NODE_ENV !== 'production' || process.env.REACT_APP_ENABLE_PUBLIC_GENAI === 'true';

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <IndicadoresProvider>
          <AppRoutes />
          {showFloatingGenAI ? <FloatingGenAI /> : null}
        </IndicadoresProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
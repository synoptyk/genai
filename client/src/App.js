import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './platforms/auth/AuthContext';
import { IndicadoresProvider } from './contexts/IndicadoresContext';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import AppHeader from './components/AppHeader';
import GlobalChatNotification from './components/GlobalChatNotification';
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
import AprobacionesCompras from './platforms/admin/pages/AprobacionesCompras';
import AIAssistant from './platforms/ai/AIAssistant';

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
const ProtectedRoute = ({ children, ceoOnly = false }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-[#020617]">
      <div className="w-12 h-12 border-4 border-rose-100/20 border-t-rose-600 rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (ceoOnly && user.role !== 'system_admin' && user.role !== 'ceo') return <Navigate to="/operaciones/portal-colaborador" replace />;
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
        <ProtectedRoute>
          <AppShell><DashboardTelecom /></AppShell>
        </ProtectedRoute>
      } />
      <Route path="/rrhh" element={<ProtectedRoute><AppShell><RecursosHumanos /></AppShell></ProtectedRoute>} />
      <Route path="/proyectos" element={<ProtectedRoute><AppShell><Proyectos /></AppShell></ProtectedRoute>} />
      <Route path="/conexiones" element={<ProtectedRoute><AppShell><Conexiones /></AppShell></ProtectedRoute>} />
      <Route path="/baremos" element={<ProtectedRoute><AppShell><Baremos /></AppShell></ProtectedRoute>} />
      <Route path="/designaciones" element={<ProtectedRoute><AppShell><Designaciones /></AppShell></ProtectedRoute>} />
      <Route path="/mapa-calor" element={<ProtectedRoute><AppShell><MapaCalor /></AppShell></ProtectedRoute>} />
      <Route path="/dotacion" element={<ProtectedRoute><AppShell><Dotacion /></AppShell></ProtectedRoute>} />
      <Route path="/flota" element={<ProtectedRoute><AppShell><Flota /></AppShell></ProtectedRoute>} />
      <Route path="/monitor-gps" element={<ProtectedRoute><AppShell><MonitorGps /></AppShell></ProtectedRoute>} />
      <Route path="/rendimiento" element={<ProtectedRoute><AppShell><Produccion /></AppShell></ProtectedRoute>} />
      <Route path="/rendimiento/cierre-bonos" element={<ProtectedRoute><AppShell><BonificacionesTelco /></AppShell></ProtectedRoute>} />
      <Route path="/produccion-financiera" element={<ProtectedRoute><AppShell><ProduccionVenta /></AppShell></ProtectedRoute>} />
      <Route path="/tarifario" element={<ProtectedRoute><AppShell><Tarifario /></AppShell></ProtectedRoute>} />
      <Route path="/descarga-toa" element={<ProtectedRoute><AppShell><DescargaTOA /></AppShell></ProtectedRoute>} />
      <Route path="/config-lpu" element={<ProtectedRoute><AppShell><BonificacionesTelco /></AppShell></ProtectedRoute>} />
      <Route path="/ajustes" element={<ProtectedRoute><AppShell><Ajustes /></AppShell></ProtectedRoute>} />

      {/* RRHH */}
      <Route path="/rrhh/seguridad-ppe" element={<ProtectedRoute><AppShell><SeguridadPPE /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/gestion-documental" element={<ProtectedRoute><AppShell><GestionDocumental /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/nomina" element={<ProtectedRoute><AppShell><NominaRRHH /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/relaciones-laborales" element={<ProtectedRoute><AppShell><RelacionesLaborales /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/captura-talento" element={<ProtectedRoute><AppShell><CapturaTalento /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/remu-central" element={<ProtectedRoute><AppShell><RemuCentral /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/control-asistencia" element={<ProtectedRoute><AppShell><ControlAsistencia /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/historial" element={<ProtectedRoute><AppShell><HistorialRRHH /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/personal-activo" element={<ProtectedRoute><AppShell><PersonalActivo /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/turnos" element={<ProtectedRoute><AppShell><ProgramacionTurnos /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/vacaciones-licencias" element={<ProtectedRoute><AppShell><VacacionesLicencias /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/finiquitos" element={<ProtectedRoute><AppShell><Finiquitos /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/contratos-anexos" element={<ProtectedRoute><AppShell><ContratosYAnexos /></AppShell></ProtectedRoute>} />
      <Route path="/configuracion-empresa" element={<ProtectedRoute><AppShell><ConfiguracionEmpresa /></AppShell></ProtectedRoute>} />
      <Route path="/gestion-personal" element={<ProtectedRoute><AppShell><GestorPersonal /></AppShell></ProtectedRoute>} />

      {/* ADMINISTRACIÓN AVANZADA */}
      <Route path="/administracion/mis-clientes" element={<ProtectedRoute><AppShell><MisClientes /></AppShell></ProtectedRoute>} />
      <Route path="/administracion/mis-clientes" element={<ProtectedRoute><AppShell><MisClientes /></AppShell></ProtectedRoute>} />
      <Route path="/administracion/sii" element={<ProtectedRoute><AppShell><IntegracionesSII /></AppShell></ProtectedRoute>} />
      <Route path="/administracion/previred" element={<ProtectedRoute><AppShell><IntegracionPrevired /></AppShell></ProtectedRoute>} />
      <Route path="/administracion/pagos-bancarios" element={<ProtectedRoute><AppShell><NominaBancaria /></AppShell></ProtectedRoute>} />
      <Route path="/administracion/gestion-gastos" element={<ProtectedRoute><AppShell><GestionRindeGastos /></AppShell></ProtectedRoute>} />
      <Route path="/administracion/configuracion-notificaciones" element={<ProtectedRoute><AppShell><ConfigNotificaciones /></AppShell></ProtectedRoute>} />
      <Route path="/administracion/modelos-bonificacion" element={<ProtectedRoute><AppShell><ModelosBonificacion /></AppShell></ProtectedRoute>} />
      <Route path="/administracion/tipos-bono" element={<ProtectedRoute><AppShell><TiposBono /></AppShell></ProtectedRoute>} />

      <Route path="/administracion/dashboard-tributario" element={<ProtectedRoute><AppShell><DashboardTributario /></AppShell></ProtectedRoute>} />

      <Route path="/administracion/aprobaciones-compras" element={<ProtectedRoute ceoOnly><AppShell><AprobacionesCompras /></AppShell></ProtectedRoute>} />


      {/* PREVENCIÓN HSE */}
      <Route path="/prevencion/ast" element={<ProtectedRoute><AppShell><PrevASTForm /></AppShell></ProtectedRoute>} />
      <Route path="/prevencion/hse-audit" element={<ProtectedRoute><AppShell><PrevHseConsole /></AppShell></ProtectedRoute>} />
      <Route path="/prevencion/operatividad" element={<ProtectedRoute><AppShell><PrevOperatividad /></AppShell></ProtectedRoute>} />
      <Route path="/prevencion/procedimientos" element={<ProtectedRoute><AppShell><PrevProcedimientos /></AppShell></ProtectedRoute>} />
      <Route path="/prevencion/difusion" element={<ProtectedRoute><AppShell><PrevDifusion /></AppShell></ProtectedRoute>} />
      <Route path="/prevencion/incidentes" element={<ProtectedRoute><AppShell><PrevIncidentes /></AppShell></ProtectedRoute>} />
      <Route path="/prevencion/matriz-riesgos" element={<ProtectedRoute><AppShell><PrevMatrizRiesgos /></AppShell></ProtectedRoute>} />
      <Route path="/prevencion/dashboard" element={<ProtectedRoute><AppShell><PrevDashboard /></AppShell></ProtectedRoute>} />
      <Route path="/prevencion/historial" element={<ProtectedRoute><AppShell><PrevHistorial /></AppShell></ProtectedRoute>} />
      <Route path="/prevencion/inspecciones" element={<ProtectedRoute><AppShell><PrevInspecciones /></AppShell></ProtectedRoute>} />

      {/* OPERACIONES */}
      <Route path="/operaciones/portal-supervision" element={<ProtectedRoute><AppShell><PortalSupervision /></AppShell></ProtectedRoute>} />
      <Route path="/operaciones/portal-colaborador" element={<ProtectedRoute><AppShell><PortalColaborador /></AppShell></ProtectedRoute>} />
      <Route path="/operaciones/gastos" element={<ProtectedRoute><AppShell><RindeGastos /></AppShell></ProtectedRoute>} />

      <Route path="/administracion/gestion-portales" element={
        <ProtectedRoute ceoOnly>
          <AppShell><PortalesOperativos /></AppShell>
        </ProtectedRoute>
      } />
 
      {/* LOGÍSTICA */}
      <Route path="/logistica" element={<ProtectedRoute><AppShell><LogisticaDashboard /></AppShell></ProtectedRoute>} />
      <Route path="/logistica/configuracion" element={<ProtectedRoute><AppShell><ConfigLogistica /></AppShell></ProtectedRoute>} />
      <Route path="/logistica/inventario" element={<ProtectedRoute><AppShell><Inventario /></AppShell></ProtectedRoute>} />
      <Route path="/logistica/almacenes" element={<ProtectedRoute><AppShell><Almacenes /></AppShell></ProtectedRoute>} />
      <Route path="/logistica/movimientos" element={<ProtectedRoute><AppShell><GestionMovimientos /></AppShell></ProtectedRoute>} />
      <Route path="/logistica/despachos" element={<ProtectedRoute><AppShell><Despachos /></AppShell></ProtectedRoute>} />
      <Route path="/logistica/historial" element={<ProtectedRoute><AppShell><HistorialMovimientos /></AppShell></ProtectedRoute>} />
      <Route path="/logistica/auditorias" element={<ProtectedRoute><AppShell><Auditorias /></AppShell></ProtectedRoute>} />
      <Route path="/logistica/proveedores" element={<ProtectedRoute><AppShell><Proveedores /></AppShell></ProtectedRoute>} />
      <Route path="/logistica/compras" element={<ProtectedRoute><AppShell><GestionCompras /></AppShell></ProtectedRoute>} />

      {/* COMUNICACIONES */}
      <Route path="/video-call/:roomId" element={<ProtectedRoute><VideoCallRoom /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><Chat360 /></ProtectedRoute>} />

      {/* GEN AI — ASISTENTE DE INTELIGENCIA ARTIFICIAL */}
      <Route path="/ai/asistente" element={<ProtectedRoute><AppShell><AIAssistant /></AppShell></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <IndicadoresProvider>
          <AppRoutes />
        </IndicadoresProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './platforms/auth/AuthContext';
import { IndicadoresProvider } from './contexts/IndicadoresContext';

// === GLOBAL COMPONENTS ===
import Sidebar from './components/Sidebar';
import AppHeader from './components/AppHeader';

// === AUTH / PUBLIC ===
import GenAiLanding from './platforms/auth/GenAiLanding';
import GenAiLogin from './platforms/auth/GenAiLogin';
import CeoCommandCenter from './platforms/auth/CeoCommandCenter';

// === PLATAFORMA: AGENTE TELECOM ===
import DashboardTelecom from './platforms/agentetelecom/DashboardSeguimiento';
import Flota from './platforms/agentetelecom/Flota';
import MonitorGps from './platforms/agentetelecom/MonitorGps';
import Produccion from './platforms/agentetelecom/Produccion';
import ProduccionVenta from './platforms/agentetelecom/ProduccionVenta';
import Tarifario from './platforms/agentetelecom/Tarifario';
import Ajustes from './platforms/agentetelecom/Ajustes';
import RecursosHumanos from './platforms/agentetelecom/modules/RecursosHumanos';
import Proyectos from './platforms/rrhh/pages/Proyectos';
import Conexiones from './platforms/agentetelecom/Conexiones';
import Baremos from './platforms/agentetelecom/Baremos';
import Designaciones from './platforms/agentetelecom/Designaciones';
import MapaCalor from './platforms/agentetelecom/MapaCalor';
import Dotacion from './platforms/agentetelecom/Dotacion';

// === PLATAFORMA: RRHH ===
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

// === PLATAFORMA: PREVENCIÓN (HSE) ===
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

// ── Protected Route (requires login) ──
const ProtectedRoute = ({ children, ceoOnly = false }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-[#020617]">
      <div className="w-12 h-12 border-4 border-rose-100/20 border-t-rose-600 rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (ceoOnly && user.role !== 'ceo_genai') return <Navigate to="/prevencion/dashboard" replace />;
  return children;
};

// ── App Shell: Sidebar + Content ──
const AppShell = ({ children }) => (
  <div className="flex h-screen bg-[#F8FAFC] font-sans overflow-hidden">
    <Sidebar />
    <div className="flex-1 flex flex-col h-full relative overflow-hidden">
      <AppHeader />
      <main className="flex-1 overflow-y-auto custom-scrollbar p-8">
        {children}
      </main>
    </div>
  </div>
);

function AppRoutes() {
  return (
    <Routes>
      {/* ── PUBLIC ROUTES ── */}
      <Route path="/" element={<GenAiLanding />} />
      <Route path="/login" element={<GenAiLogin />} />

      {/* ── CEO MODULE (protected + CEO only) ── */}
      <Route path="/ceo/command-center" element={
        <ProtectedRoute ceoOnly>
          <CeoCommandCenter />
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
      <Route path="/produccion-financiera" element={<ProtectedRoute><AppShell><ProduccionVenta /></AppShell></ProtectedRoute>} />
      <Route path="/tarifario" element={<ProtectedRoute><AppShell><Tarifario /></AppShell></ProtectedRoute>} />
      <Route path="/ajustes" element={<ProtectedRoute><AppShell><Ajustes /></AppShell></ProtectedRoute>} />

      {/* RRHH */}
      <Route path="/rrhh/seguridad-ppe" element={<ProtectedRoute><AppShell><SeguridadPPE /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/gestion-documental" element={<ProtectedRoute><AppShell><GestionDocumental /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/nomina" element={<ProtectedRoute><AppShell><NominaRRHH /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/relaciones-laborales" element={<ProtectedRoute><AppShell><RelacionesLaborales /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/captura-talento" element={<ProtectedRoute><AppShell><CapturaTalento /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/control-asistencia" element={<ProtectedRoute><AppShell><ControlAsistencia /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/historial" element={<ProtectedRoute><AppShell><HistorialRRHH /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/personal-activo" element={<ProtectedRoute><AppShell><PersonalActivo /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/turnos" element={<ProtectedRoute><AppShell><ProgramacionTurnos /></AppShell></ProtectedRoute>} />
      <Route path="/rrhh/vacaciones-licencias" element={<ProtectedRoute><AppShell><VacacionesLicencias /></AppShell></ProtectedRoute>} />
      <Route path="/configuracion-empresa" element={<ProtectedRoute><AppShell><ConfiguracionEmpresa /></AppShell></ProtectedRoute>} />

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

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
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
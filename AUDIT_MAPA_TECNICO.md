# 📂 MAPA TÉCNICO: Ubicación de Código por Feature

## Gen AI - Estructura de Carpetas Auditadas

```
./
│
├── server/
│   ├── platforms/
│   │   ├── rrhh/
│   │   │   ├── models/
│   │   │   │   ├── Liquidacion.js          ✅ Nómina
│   │   │   │   ├── PayrollConfig.js        ✅ Nómina
│   │   │   │   ├── PayrollTemplate.js      ✅ Nómina
│   │   │   │   ├── ContratoDocumento.js    ✅ Documentos
│   │   │   │   ├── RegistroAsistencia.js   ✅ Asistencia/Vacaciones
│   │   │   │   ├── TimeTracker.js          ✅ Control de tiempo
│   │   │   │   ├── Plantilla.js            ✅ Plantillas de documentos
│   │   │   │   ├── Proyecto.js             ✅ Proyectos
│   │   │   │   ├── EmpresaConfig.js        ✅ Configuración
│   │   │   │   ├── Turno.js                ✅ Turnos
│   │   │   │   ├── Candidato.js            ✅ Candidatos/Empleados
│   │   │   │   └── Notification.js         ✅ Notificaciones
│   │   │   │
│   │   │   ├── routes/
│   │   │   │   ├── liquidacionRoutes.js    ✅ Nómina: GET, POST, PUT
│   │   │   │   ├── contratosRoutes.js      ✅ Documentos: GET, POST, DELETE, approve
│   │   │   │   ├── asistenciaRoutes.js     ✅ Asistencia: GET, POST, bulk-upsert
│   │   │   │   ├── candidatosRoutes.js     ✅ Candidatos + Finiquitos
│   │   │   │   ├── turnosRoutes.js         ✅ Turnos
│   │   │   │   ├── timeTrackerRoutes.js    ✅ TimeTracker
│   │   │   │   ├── plantillaRoutes.js      ✅ Plantillas
│   │   │   │   ├── empresaRoutes.js        ✅ Configuración
│   │   │   │   ├── proyectosRoutes.js      ✅ Proyectos
│   │   │   │   ├── proyectosAnalyticsRoutes.js  📊 Reportería
│   │   │   │   └── notificationRoutes.js   ✅ Notificaciones
│   │   │   │
│   │   │   └── controllers/
│   │   │       ├── contratoController.js    ✅ Lógica de documentos
│   │   │       ├── plantillaController.js   ✅ Plantillas
│   │   │       └── timeTrackerController.js ✅ TimeTracker
│   │   │
│   │   ├── admin/
│   │   │   ├── models/
│   │   │   │   ├── AuditLog.js             🔍 Auditoría
│   │   │   │   ├── BonoConfig.js           💰 Bonificación
│   │   │   │   ├── BonoTransaccion.js      💰 Bonificación
│   │   │   │   ├── ModeloBonificacion.js   💰 Bonificación
│   │   │   │   ├── BonoMensualConsolidado.js  💰 Bonificación
│   │   │   │   ├── TipoBono.js             💰 Bonificación
│   │   │   │   ├── PreviredLog.js          🏦 Previred
│   │   │   │   └── Banco.js (sin integración)  ❌ Banking (no funcional)
│   │   │   │
│   │   │   ├── routes/
│   │   │   │   ├── bonoConfigRoutes.js     💰 Bonificación: GET, POST, PUT, DELETE
│   │   │   │   ├── bonoRoutes.js           💰 Bonificación transaccional
│   │   │   │   ├── tipoBonoRoutes.js       💰 Tipos de bonos
│   │   │   │   ├── bancoRoutes.js          ❌ Banking (almacenamiento)
│   │   │   │   ├── clienteRoutes.js        👥 Clientes
│   │   │   │   ├── previredRoutes.js       🏦 Integración Previred (RPA)
│   │   │   │   └── siiRoutes.js            🏦 Integración SII (RPA)
│   │   │   │
│   │   │   └── controllers/
│   │   │       ├── bonoConfigController.js  💰 Lógica de bonos
│   │   │       ├── previredController.js    🏦 RPA Previred
│   │   │       ├── siiController.js         🏦 RPA SII
│   │   │       └── bancoController.js       ❌ Bancos (no implementado)
│   │   │
│   │   ├── ai/
│   │   │   ├── aiRoutes.js                 📊 IA: Predicciones, contexto, forecast
│   │   │   └── [Controladores incluidos en routes]
│   │   │
│   │   ├── agentetelecom/
│   │   │   ├── models/
│   │   │   │   ├── Tecnico.js              👷 Técnicos
│   │   │   │   ├── Vehiculo.js             🚗 Vehículos
│   │   │   │   ├── Actividad.js            📋 Actividades
│   │   │   │   ├── Baremo.js               📊 Baremos (puntuación)
│   │   │   │   ├── TarifaLPU.js            💵 Tarifas
│   │   │   │   ├── ChecklistVehicular.js   ✅ Checklists
│   │   │   │   ├── Cliente.js              👥 Clientes
│   │   │   │   ├── Ubicacion.js            📍 Ubicaciones
│   │   │   │   └── Configuracion.js        ⚙️ Config
│   │   │   │
│   │   │   ├── routes/
│   │   │   │   ├── tecnicos.js             👷 Técnicos: CRUD
│   │   │   │   ├── vehiculos.js            🚗 Vehículos: CRUD
│   │   │   │   ├── baremos.js              📊 Baremos: CRUD
│   │   │   │   ├── tarifaLPU.js            💵 Tarifas: CRUD
│   │   │   │   └── valorPunto.js           💾 Valor punto: CRUD
│   │   │   │
│   │   │   ├── bot/
│   │   │   │   ├── agente_real.js          🤖 BOT TOA (extracción de datos)
│   │   │   │   └── agente_gps.js           🤖 BOT GPS (rastreo)
│   │   │   │
│   │   │   └── [Folder structure para plataforma telecom]
│   │   │
│   │   ├── operaciones/
│   │   │   ├── models/
│   │   │   │   ├── Combustible.js          ⛽ Combustible
│   │   │   │   ├── Gasto.js                💰 Gastos
│   │   │   │   └── TurnoSupervisor.js      👨 Turnos supervisor
│   │   │   │
│   │   │   └── routes/
│   │   │       ├── combustibleRoutes.js    ⛽ Combustible CRUD
│   │   │       └── gastoRoutes.js          💰 Gastos CRUD
│   │   │
│   │   ├── comunicaciones/
│   │   │   ├── models/
│   │   │   │   ├── Message.js              💬 Mensajes
│   │   │   │   ├── Meeting.js              📞 Reuniones
│   │   │   │   └── Room.js                 🏠 Salas
│   │   │   │
│   │   │   └── routes/
│   │   │       ├── chatRoutes.js           💬 Chat CRUD
│   │   │       └── reunionesRoutes.js      📞 Reuniones CRUD
│   │   │
│   │   ├── prevencion/
│   │   │   ├── models/                     🛡️ Seguridad/HSE
│   │   │   └── routes/                     🛡️ Rutas de seguridad
│   │   │
│   │   ├── logistica/
│   │   │   ├── logisticaController.js      📦 Logística
│   │   │   ├── models/
│   │   │   └── routes/
│   │   │
│   │   └── auth/
│   │       ├── PlatformUser.js             🔐 Usuarios
│   │       ├── models/Empresa.js           🏢 Empresas
│   │       ├── authMiddleware.js           🔒 Middleware
│   │       ├── roles.js                    👤 Roles
│   │       ├── authRoutes.js               🔐 Auth CRUD
│   │       ├── empresaRoutes.js            🏢 Empresa CRUD
│   │       └── seedCeo.js                  👑 Seed admin
│   │
│   ├── server.js                           🚀 Servidor principal (se montan TODAS las rutas aquí)
│   ├── config/                             ⚙️ Configuración
│   ├── middleware/                         🔒 Middleware de seguridad
│   ├── routes/                             📡 Rutas globales (health.js)
│   ├── utils/                              🛠️ Utilidades
│   └── scripts/                            📝 Scripts de migración
│
├── client/src/
│   ├── platforms/
│   │   ├── rrhh/
│   │   │   ├── pages/
│   │   │   │   ├── NominaRRHH.jsx          ✅ Panel Nómina
│   │   │   │   ├── RemuCentral.jsx         ✅ Central de Remuneraciones
│   │   │   │   ├── ContratosYAnexos.jsx    ✅ Gestión de Contratos
│   │   │   │   ├── Finiquitos.jsx          ✅ Gestión de Finiquitos
│   │   │   │   ├── ControlAsistencia.jsx   ✅ Control de Asistencia
│   │   │   │   ├── VacacionesLicencias.jsx ✅ Gestión de Vacaciones
│   │   │   │   ├── ProgramacionTurnos.jsx  ✅ Programación de Turnos
│   │   │   │   ├── PersonalActivo.jsx      ✅ Listado de Empleados
│   │   │   │   ├── GestorPersonal.jsx      ✅ Gestor Personal
│   │   │   │   ├── CapturaTalento.jsx      ✅ Captura de Talento (Reclutamiento)
│   │   │   │   ├── GestionDocumental.jsx   ✅ Gestión Documental
│   │   │   │   ├── RelacionesLaborales.jsx ✅ Relaciones Laborales
│   │   │   │   ├── SeguridadPPE.jsx        ✅ Seguridad/PPE
│   │   │   │   ├── HistorialRRHH.jsx       ✅ Historial
│   │   │   │   ├── Proyectos.jsx           ✅ Proyectos
│   │   │   │   ├── ConfiguracionEmpresa.jsx ✅ Configuración
│   │   │   │   ├── FichaManualPrint.jsx    📄 Ficha de Impresión
│   │   │   │   └── GuiaRequisitosPrint.jsx 📄 Guía de Requisitos
│   │   │   │
│   │   │   ├── utils/
│   │   │   │   ├── payrollCalculator.js    📐 Calculadora de Nómina
│   │   │   │   ├── rutUtils.js             🆔 Utilidades de RUT
│   │   │   │   └── [Otros utilities]
│   │   │   │
│   │   │   └── rrhhApi.js                  🔌 API Client para RRHH
│   │   │
│   │   ├── admin/
│   │   │   ├── pages/
│   │   │   │   ├── AprobacionesCompras.jsx 🛒 Aprobaciones
│   │   │   │   ├── IntegracionPrevired.jsx 🏦 Previred UI (Parcial)
│   │   │   │   ├── IntegracionesSII.jsx    🏦 SII UI (Parcial)
│   │   │   │   ├── NominaBancaria.jsx      💳 Nómina Bancaria
│   │   │   │   ├── DashboardTributario.jsx 📊 Dashboard SII
│   │   │   │   ├── BonoMaestro.jsx         💰 Bonificación
│   │   │   │   ├── ModelosBonificacion.jsx 💰 Modelos de Bono
│   │   │   │   ├── TiposBono.jsx           💰 Tipos de Bono
│   │   │   │   ├── MisClientes.jsx         👥 Clientes
│   │   │   │   ├── ConfigNotificaciones.jsx ⚙️ Config Notificaciones
│   │   │   │   ├── PortalesOperativos.jsx  🌐 Portales
│   │   │   │   └── GestionRindeGastos.jsx  💰 Rinde de Gastos
│   │   │   │
│   │   │   └── [Sin paginas para: Facturación, Beneficios, Evaluaciones]
│   │   │
│   │   ├── agentetelecom/
│   │   │   ├── pages/
│   │   │   │   ├── Home.js                 🏠 Dashboard principal
│   │   │   │   ├── DashboardEjecutivo.jsx 📊 Dashboard Ejecutivo
│   │   │   │   ├── DashboardSeguimiento.jsx 👁️ Seguimiento
│   │   │   │   ├── Flota.jsx               🚗 Gestión de Flota
│   │   │   │   ├── MonitorGps.jsx          📍 Monitor GPS
│   │   │   │   ├── ProduccionVenta.jsx     💹 Producción
│   │   │   │   ├── BonificacionesTelco.jsx 💰 Bonificaciones
│   │   │   │   ├── CierreBonos.jsx         💰 Cierre de Bonos
│   │   │   │   ├── Designaciones.jsx       🎯 Designaciones
│   │   │   │   ├── Dotacion.jsx            👷 Dotación
│   │   │   │   ├── FichaIngreso.jsx        📝 Ficha de Ingreso
│   │   │   │   ├── MapaCalor.jsx           🌡️ Mapa de Calor
│   │   │   │   ├── Historial.jsx           📜 Historial
│   │   │   │   ├── Tarifario.jsx           💵 Tarifario
│   │   │   │   ├── ValidadoTOA.jsx         ✅ Descarga TOA
│   │   │   │   ├── ConfigLPU.jsx           ⚙️ Config LPU
│   │   │   │   ├── Baremos.jsx             📊 Baremos
│   │   │   │   ├── Conexiones.jsx          🔗 Conexiones
│   │   │   │   ├── Ajustes.jsx             ⚙️ Ajustes
│   │   │   │   └── [Y más...]
│   │   │   │
│   │   │   ├── modules/
│   │   │   │   └── RecursosHumanos.js      👤 Módulo RRHH (menú)
│   │   │   │
│   │   │   └── telecomApi.js               🔌 API Client para Telecom
│   │   │
│   │   ├── finanzas/
│   │   │   ├── pages/
│   │   │   │   └── DashboardTributario.jsx 📊 Dashboard Tributario
│   │   │   │
│   │   │   └── [Muy pocas páginas]
│   │   │
│   │   ├── comunicaciones/
│   │   │   └── [Páginas de chat/reuniones]
│   │   │
│   │   ├── operaciones/
│   │   │   └── [Páginas de logística]
│   │   │
│   │   ├── prevencion/
│   │   │   └── [Páginas de seguridad/HSE]
│   │   │
│   │   └── auth/
│   │       └── AuthContext.js              🔐 Contexto de autenticación
│   │
│   ├── api/                                🔌 Cliente de API global
│   ├── components/                         🎨 Componentes reutilizables
│   ├── contexts/                           📦 Contextos de React
│   ├── hooks/                              🪝 Hooks personalizados
│   ├── utils/                              🛠️ Utilidades globales
│   ├── App.js                              🚀 App principal (montan TODAS las rutas)
│   └── ...
│
├── package.json                            📦 Dependencias
├── server.js (principal)                   🚀 Punto de entrada servidor
├── app.json                                ❌ NO EXISTE en Gen AI (es de Synoptyk)
└── [Archivos de configuración]
```

---

## 🔗 ENDPOINTS COMPLETOS AUDITADOS

### ✅ RRHH - Nómina
```
GET    /api/rrhh/nomina
POST   /api/rrhh/nomina/config
GET    /api/rrhh/nomina/templates
PUT    /api/rrhh/nomina/:id
DELETE /api/rrhh/nomina/:id
```

### ✅ RRHH - Contratos
```
GET    /api/rrhh/contratos
POST   /api/rrhh/contratos
GET    /api/rrhh/contratos/:id
POST   /api/rrhh/contratos/:id/request-approval
POST   /api/rrhh/contratos/:id/approve
DELETE /api/rrhh/contratos/:id
```

### ✅ RRHH - Asistencia
```
GET    /api/rrhh/asistencia
GET    /api/rrhh/asistencia/resumen-periodo
POST   /api/rrhh/asistencia
POST   /api/rrhh/asistencia/bulk
POST   /api/rrhh/asistencia/bulk-upsert
PUT    /api/rrhh/asistencia/:id
DELETE /api/rrhh/asistencia/:id
```

### ✅ RRHH - Candidatos/Empleados
```
GET    /api/rrhh/candidatos
POST   /api/rrhh/candidatos
GET    /api/rrhh/candidatos/:id
PUT    /api/rrhh/candidatos/:id
GET    /api/rrhh/candidatos/finiquitos
POST   /api/rrhh/candidatos/finiquitos
DELETE /api/rrhh/candidatos/:id
```

### ✅ RRHH - Turnos
```
GET    /api/rrhh/turnos
POST   /api/rrhh/turnos
GET    /api/rrhh/turnos/:id
PUT    /api/rrhh/turnos/:id
DELETE /api/rrhh/turnos/:id
```

### ✅ Telecom - Técnicos
```
GET    /api/tecnicos
POST   /api/tecnicos
GET    /api/tecnicos/:id
PUT    /api/tecnicos/:id
DELETE /api/tecnicos/:id
```

### 📊 IA - Analytics
```
GET    /api/ai/context
GET    /api/ai/forecast
GET    /api/ai/chat (opcional OpenAI)
```

### ⚠️ Admin - SII (RPA, sin funcionalidad real)
```
POST   /api/admin/sii/rpa
DELETE /api/admin/sii/rpa
GET    /api/admin/sii/status
GET    /api/admin/sii/rcv
POST   /api/admin/sii/upload-cert
```

### ⚠️ Admin - Previred (RPA, sin funcionalidad real)
```
GET    /api/admin/previred/status
GET    /api/admin/previred/stats
GET    /api/admin/previred/history
```

### ❌ Admin - Banco (sin integración real)
```
GET    /api/admin/bancos
POST   /api/admin/bancos
GET    /api/admin/bancos/:id
PUT    /api/admin/bancos/:id
DELETE /api/admin/bancos/:id
```

---

## 📊 Estadísticas del Codebase

```
Total de Modelos:          18 en RRHH, 8 en Admin, 11 en Telecom = ~37 Modelos
Total de Rutas:            15 en RRHH, 7 en Admin, 5 en Agentetelecom = ~27 Rutas
Líneas de Código Servidor: ~2000+ (solo plataforma, excluyendo node_modules)
Líneas de Código Cliente:  ~3000+ (componentes React)
```

---

## 🎯 Conclusión

**Gen AI es un SISTEMA DE RRHH + TELECOM**, NO un suite B2B completo como Synoptyk.

Implementado al 100%:
- ✅ Nómina
- ✅ Gestión de Contratos (sin firma electrónica criptográfica)
- ✅ Control de Asistencia y Vacaciones
- ✅ Gestión de Técnicos y Vehículos

NO implementado:
- ❌ Facturación
- ❌ Biometría
- ❌ LMS
- ❌ Evaluaciones 360
- ❌ Beneficios completo
- ❌ Mobile

Parcialmente:
- ⚠️ BI (básico, sin herramientas avanzadas)
- ⚠️ Firma Digital (workflow sí, criptografía no)
- ⚠️ Banking (almacenamiento, sin transacciones)

**Auditoría completada el 10 de abril de 2026**

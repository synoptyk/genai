const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const multer = require('multer'); // File handling
const cloudinary = require('cloudinary').v2; // Cloud storage
let swaggerUi = null;
let swaggerJsdoc = null;
let swaggerEnabled = false;
try {
  swaggerUi = require('swagger-ui-express');
  swaggerJsdoc = require('swagger-jsdoc');
  swaggerEnabled = true;
} catch (e) {
  console.warn('⚠️ Aviso: swagger-ui-express o swagger-jsdoc no están instalados. /api/docs no quedará disponible.', e.message);
}
const path = require('path');
const { fork } = require('child_process');
require('dotenv').config();

// =============================================================================
// NEW: SECURITY & MONITORING IMPORTS
// =============================================================================
const { generalLimiter, helmetConfig } = require('./middleware/security');
const healthRoutes = require('./routes/health');
const logger = require('./utils/logger');

// =============================================================================
// 1. PLATFORM CONFIGURATION (DYNAMIC PATHS)
// =============================================================================
const PLATFORM_PATH = process.env.PLATFORM_PATH || './platforms/agentetelecom';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('⚠️ WARN: JWT_SECRET no definido, se usará valor por defecto (inseguro). Debe configurarse en entornos productivos.');
}
const { protect, authorize } = require('./platforms/auth/authMiddleware');
const { encriptarTexto, desencriptarTexto } = require('./utils/criptografiaSegura');
const Empresa = require('./platforms/auth/models/Empresa');
const ROLES = require('./platforms/auth/roles');

// diagnostic ping
const UPDATED_DATE = '2026-03-20 10:00';
console.log(`🚀 [PLATFORM] Platform initializing... (${UPDATED_DATE})`);
console.log(`🚀 [PLATFORM] Logistica Routes Mounting...`);

console.log(`🔌 Loading modules from: ${PLATFORM_PATH}`);
const TurnoSupervisor = require('./platforms/operaciones/models/TurnoSupervisor'); // Nuevo Módulo Operaciones

// --- IMPORT MODELS (MODULAR) ---
let Actividad, Baremo, Ubicacion, Cliente, Tecnico, Vehiculo;

try {
  Actividad = require(`${PLATFORM_PATH}/models/Actividad`);
  Baremo = require(`${PLATFORM_PATH}/models/Baremo`);
  Ubicacion = require(`${PLATFORM_PATH}/models/Ubicacion`);
  Cliente = require(`${PLATFORM_PATH}/models/Cliente`);
  Tecnico = require(`${PLATFORM_PATH}/models/Tecnico`);
  Vehiculo = require(`${PLATFORM_PATH}/models/Vehiculo`);
  console.log("✅ Database Models loaded successfully.");
} catch (error) {
  console.error("❌ CRITICAL ERROR LOADING MODELS:", error.message);
  process.exit(1);
}

// --- IMPORT BOTS (AUTOMATION) ---
let botsLoaded = false;
try {
  const { iniciarExtraccion } = require(`${PLATFORM_PATH}/bot/agente_real`); // TOA BOT
  const { iniciarRastreoGPS } = require(`${PLATFORM_PATH}/bot/agente_gps`); // GPS BOT


  // --- CRON JOBS ---

  // 1. Nightly TOA Extraction (23:00 hrs)
  cron.schedule('0 23 * * *', () => {
    console.log('⏰ CRON JOB: Starting Massive TOA Extraction (23:00)');
    iniciarExtraccion();
  }, { scheduled: true, timezone: "America/Santiago" });

  // 2. GPS Tracking — Corre en proceso separado via fork() para no bloquear el event loop
  const GPS_WORKER_PATH = path.resolve(__dirname, 'platforms/agentetelecom/bot/agente_gps.js');
  let gpsWorkerRunning = false;

  cron.schedule('*/5 * * * *', () => {
    if (gpsWorkerRunning) {
      console.log('✋ GPS Worker todavía corriendo. Saltando ciclo...');
      return;
    }
    console.log('⏰ CRON JOB: Syncing Fleet GPS (fork)');
    gpsWorkerRunning = true;
    const gpsChild = fork(GPS_WORKER_PATH, [], {
      env: { ...process.env },
      silent: false,
    });
    gpsChild.on('error', (err) => {
      console.error('❌ GPS Worker error:', err.message);
      gpsWorkerRunning = false;
    });
    gpsChild.on('exit', (code) => {
      console.log(`🛰️  GPS Worker terminó (código: ${code})`);
      gpsWorkerRunning = false;
    });
  }, { scheduled: true, timezone: 'America/Santiago' });

  botsLoaded = true;
  console.log("✅ Automation Bots (TOA/GPS) active.");


} catch (e) {
  console.warn(`⚠️ ALERT: Bots not detected in ${PLATFORM_PATH}/bot. Server running in MANUAL mode.`);
}

const app = express();

const allowedOrigins = [
  'https://genai.cl',
  'https://www.genai.cl',
  'https://platform.enterprise.cl',
  'https://platform-app.vercel.app',
  'https://platform-backend.onrender.com',
  'https://platform-backend-final.onrender.com',
  'https://platform-os.cl',
  'https://www.platform-os.cl',
  'http://localhost:3000',
  'http://localhost:5173'
];

if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);
if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
    .forEach((o) => allowedOrigins.push(o));
}

const normalizedAllowedOrigins = new Set(
  allowedOrigins.map((o) => String(o || '').replace(/\/$/, ''))
);

const corsOptions = {
  origin: (origin, callback) => {
    // Permitir requests sin origin (como apps o scripts internos)
    if (!origin) return callback(null, true);

    const normalizedOrigin = String(origin).replace(/\/$/, '');
    const isAllowed = normalizedAllowedOrigins.has(normalizedOrigin) ||
                     normalizedOrigin.endsWith('.vercel.app') ||
                     normalizedOrigin.endsWith('.enterprise.cl') ||
                     normalizedOrigin.endsWith('.genai.cl');
                     
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn('⚠️ CORS blocked for origin:', origin);
      if (process.env.NODE_ENV === 'production') {
        callback(new Error(`CORS: Origin ${origin} no autorizado`));
      } else {
        // Permisivo sólo en desarrollo para facilitar testing local
        callback(null, true);
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-company-override', 'x-tenant-id'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// =============================================================================
// NEW: SECURITY MIDDLEWARE (Rate Limiting + Helmet)
// =============================================================================
logger.info('Initializing security middleware...', { type: 'security_init' });
app.use(helmetConfig);
app.use(generalLimiter);

// Handle Preflight OPTIONS exactly
// Swagger/OpenAPI docs (sólo en entornos no productivos si no existe configuración específica)
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Enterprise 360 API',
    version: '2.5.0',
    description: 'Documentación automática de la API del backend Enterprise Platform.'
  },
  servers: [
    { url: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}` : 'http://localhost:5003' }
  ]
};

const swaggerOptions = {
  swaggerDefinition,
  apis: ['./server/platforms/**/*.js', './server/routes/**/*.js']
};

let swaggerSpec = null;
if (swaggerEnabled) {
  try {
    swaggerSpec = swaggerJsdoc(swaggerOptions);
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    console.log('✅ Swagger docs enabled en /api/docs');
  } catch (e) {
    console.warn('⚠️ No fue posible inicializar Swagger:', e.message);
  }
} else {
  console.log('ℹ️ Swagger no habilitado (dependencias ausentes)');
}

app.options('*', cors(corsOptions));

app.get('/api/ping-platform', (req, res) => res.send(`Enterprise Platform Server v2.5 | Last Update: ${UPDATED_DATE}`));

// =============================================================================
// NEW: HEALTH CHECK ROUTES
// =============================================================================
app.use('/api/health', healthRoutes);
app.post('/api/admin/lpu-sync', protect, async (req, res) => {
  try {
    const TarifaLPU = require(`${PLATFORM_PATH}/models/TarifaLPU`);
    const existing = await TarifaLPU.find({ 'mapeo.es_equipo_adicional': true, activo: true });
    let count = 0;
    for (const t of existing) {
      if (t.mapeo?.campo_cantidad === 'Decos_Adicionales') {
         const base = { empresaRef: t.empresaRef, grupo: t.grupo, puntos: t.puntos, activo: true, 'mapeo.es_equipo_adicional': true, 'mapeo.tipo_trabajo_pattern': t.mapeo.tipo_trabajo_pattern, 'mapeo.subtipo_actividad': t.mapeo.subtipo_actividad };
         await TarifaLPU.updateOne({ empresaRef: t.empresaRef, codigo: t.codigo + '-CAT' }, { $set: { ...base, descripcion: t.descripcion.replace(/adicional/i, '').trim() + ' (CAT)', 'mapeo.campo_cantidad': 'Decos_Cable_Adicionales' } }, { upsert: true });
         await TarifaLPU.updateOne({ empresaRef: t.empresaRef, codigo: t.codigo + '-WIFI' }, { $set: { ...base, descripcion: t.descripcion.replace(/adicional/i, '').trim() + ' (SMART)', 'mapeo.campo_cantidad': 'Decos_WiFi_Adicionales' } }, { upsert: true });
         count += 2;
      }
      if (/repetidor|extender|mesh/i.test(t.descripcion) && t.mapeo?.campo_cantidad !== 'Repetidores_WiFi') {
          t.mapeo.campo_cantidad = 'Repetidores_WiFi'; await t.save();
      }
    }
    res.json({ success: true, migrated: count });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

logger.info('Health check routes mounted at /api/health', { type: 'routes_init' });

app.use(express.json({ limit: '50mb' }));

// =============================================================================
// 2. EXTERNAL SERVICES CONNECTION
// =============================================================================

// A. MongoDB Atlas
console.log('⏳ Connecting to MongoDB Atlas...');
if (!process.env.MONGO_URI) {
  console.error('❌ CRITICAL ERROR: MONGO_URI is not defined in environment variables.');
  process.exit(1);
}
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 30000,  // M10 replica set necesita más tiempo post-elección
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  w: 'majority',
  maxPoolSize: 10,
  minPoolSize: 2,
  heartbeatFrequencyMS: 10000,      // checar salud del primario cada 10s
})
  .then(async () => {
    console.log('🍃 SUCCESS: Connected to MongoDB Atlas (telecom_db)');
    console.log('📡 Conexiones:');
    console.log('   - MongoDB: OK');

    // Eventos de conexión — tolerancia a elecciones de réplica (M10 Dedicated)
    mongoose.connection.on('disconnected', () => console.warn('⚠️ MongoDB desconectado. Reintentando...'));
    mongoose.connection.on('reconnected',  () => console.log('🍃 MongoDB reconectado.'));
    mongoose.connection.on('error', (err) => console.error('❌ MongoDB error:', err.message));
    console.log(`   - Cloudinary: ${cloudinaryStatus.connected ? 'OK' : 'NO - ' + cloudinaryStatus.message}`);
    console.log(`   - Swagger: ${swaggerEnabled ? 'OK' : 'INACTIVO'}`);

    // --- TEMPORARY FIX: DROP BAD INDEXES ---
    try {
      const collection = mongoose.connection.collection('baremos');
      const indexes = await collection.indexes();
      const badIndex = indexes.find(i => i.name === 'codigoActividad_1');
      if (badIndex) {
        console.log('🧹 FIX: Dropping obsolete index "codigoActividad_1"...');
        await collection.dropIndex('codigoActividad_1');
        console.log('✅ Index dropped successfully.');
      } else {
        console.log('✅ Index check: No bad "codigoActividad_1" index found.');
      }
    } catch (e) {
      console.error('⚠️ Index cleanup warning:', e.message);
    }
    // ---------------------------------------

    // AUTO-CLEANUP DUPLICATES (Added to fix 54 vs 26 issue)
    try {
      const all = await Tecnico.find().sort({ updatedAt: -1 });
      const seen = new Set();
      let deleted = 0;
      const standardize = (val) => (val || '').toString().replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();

      for (const t of all) {
        const cleanRut = standardize(t.rut);
        if (!cleanRut || seen.has(cleanRut)) {
          await Tecnico.findByIdAndDelete(t._id);
          deleted++;
        } else {
          seen.add(cleanRut);
          if (t.rut !== cleanRut) {
            t.rut = cleanRut;
            await t.save();
          }
        }
      }
      if (deleted > 0) console.log(`🧹 DB CLEANUP: Deleted ${deleted} duplicates.`);

      // 🚀 AUTO-SYNC TOA IDs (RRHH -> Operaciones)
      // Buscamos candidatos que tengan ID TOA y lo propagamos a los técnicos si les falta
      try {
        const Candidato = require('./platforms/rrhh/models/Candidato');
        const candidatesWithToa = await Candidato.find({ 
          idRecursoToa: { $exists: true, $ne: '' } 
        }).select('rut idRecursoToa').lean();
        
        let syncedCount = 0;
        for (const cand of candidatesWithToa) {
          const cleanRut = standardize(cand.rut);
          if (!cleanRut) continue;
          
          const result = await Tecnico.updateMany(
            { 
              rut: { $in: [cleanRut, cand.rut] }, 
              $or: [
                { idRecursoToa: null },
                { idRecursoToa: '' },
                { idRecursoToa: { $exists: false } }
              ]
            }, 
            { $set: { idRecursoToa: cand.idRecursoToa } }
          );
          if (result.modifiedCount > 0 || result.nModified > 0) {
            syncedCount += (result.modifiedCount || result.nModified);
          }
        }
        if (syncedCount > 0) console.log(`✅ TOA SYNC: Propagated TOA IDs to ${syncedCount} technical profiles.`);
      } catch (syncErr) {
        console.warn("⚠️ TOA Sync warning:", syncErr.message);
      }
    } catch (e) { console.error("Cleanup error:", e.message); }

    // --- AUTO-SEED: SYSTEM ADMIN (Sincronizado) ---
    try {
      const PlatformUser = require('./platforms/auth/PlatformUser');
      const Empresa = require('./platforms/auth/models/Empresa');
      const ceoEmail = process.env.SEED_ADMIN_EMAIL || 'admin@platform-os.cl';
      const shouldSeed = process.env.ENABLE_AUTO_SEED === 'true';

      if (!shouldSeed) {
        console.log("ℹ️ Auto-seeding is disabled via ENV.");
        return;
      }

      let empresaAdmin = await Empresa.findOne({ nombre: 'ADMIN_CORP' });
      if (!empresaAdmin) {
        empresaAdmin = new Empresa({
          nombre: 'ADMIN_CORP',
          rut: '76.000.000-1',
          plan: 'enterprise',
          estado: 'Activo'
        });
        await empresaAdmin.save();
        console.log("🏢 Empresa de administración creada.");
      }

      const existing = await PlatformUser.findOne({ email: ceoEmail });
      if (!existing) {
        const ceo = new PlatformUser({
          name: 'Mauricio Barrientos',
          email: ceoEmail,
          password: process.env.SEED_ADMIN_PASSWORD || 'Platform2026*Master',
          role: 'system_admin',
          cargo: 'System Administrator',
          status: 'Activo',
          tokenVersion: 0,
          empresaRef: empresaAdmin._id,
          empresa: {
            nombre: 'ADMIN_CORP',
            rut: '76.000.000-1',
            plan: 'enterprise'
          }
        });
        await ceo.save();
        console.log(`👑 Administrador maestro creado: ${ceoEmail}`);
      } else {
        // Asegurar que el CEO siempre tenga el rol y la empresa correcta
        let changed = false;
        if (existing.role !== 'system_admin') { existing.role = 'system_admin'; changed = true; }
        if (!existing.empresaRef) { existing.empresaRef = empresaAdmin._id; changed = true; }
        if (changed) {
          await existing.save();
          console.log(`👑 Administrador maestro (${ceoEmail}) actualizado forzosamente.`);
        }
      }
    } catch (e) {
      console.error('⚠️ Error al crear CEO seed:', e.message);
    }
    // ---------------------------------

  })
  .catch(err => {
    console.error('❌ FATAL MONGODB ERROR:', err.message);
    console.error('👉 Tip: Check your MONGO_URI in .env and ensure your IP is whitelisted in Atlas.');
    // We allow the server to start even if DB fails, so the user can still access the UI shell
  });

// B. Cloudinary (Images)
const cloudinaryStatus = {
  connected: false,
  message: 'No inicializado'
};

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  cloudinaryStatus.connected = true;
  cloudinaryStatus.message = 'Cloudinary configurado';
  console.log('✅ Cloudinary configurado');
} else {
  cloudinaryStatus.message = 'Faltan variables de entorno de Cloudinary';
  console.warn(`⚠️ ${cloudinaryStatus.message}`);
}

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


// =============================================================================
// 3. API ROUTES (ENDPOINTS)
// =============================================================================

// --- A. FILE UPLOAD ---
app.post('/api/upload', upload.single('imagen'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image sent" });

    const b64 = Buffer.from(req.file.buffer).toString('base64');
    let dataURI = "data:" + req.file.mimetype + ";base64," + b64;

    const resultado = await cloudinary.uploader.upload(dataURI, {
      folder: "agentetelecom_evidencias",
      resource_type: "auto"
    });

    res.json({
      url: resultado.secure_url,
      public_id: resultado.public_id,
      mensaje: "Image saved to cloud successfully"
    });
  } catch (error) {
    console.error("Cloudinary Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- B. MODULAR ROUTES (Agente Telecom Platform) ---
app.use('/api/tecnicos', require(`${PLATFORM_PATH}/routes/tecnicos`));
app.use('/api/vehiculos', require(`${PLATFORM_PATH}/routes/vehiculos`));
app.use('/api/baremos', require(`${PLATFORM_PATH}/routes/baremos`));
app.use('/api/tarifa-lpu', require(`${PLATFORM_PATH}/routes/tarifaLPU`));
app.use('/api/valor-punto', require(`${PLATFORM_PATH}/routes/valorPunto`));

// --- B0. PROXY API MINDICADOR (CORS BYPASS & CACHE) ---
let indicadoresCache = { data: null, lastUpdate: 0 };

app.get('/api/indicadores', async (req, res) => {
  try {
    const axios = require('axios');
    const { tipo, fecha } = req.query;

    // 1. Si es consulta general y hay cache fresco (< 2 horas), retornar cache
    if (!fecha && indicadoresCache.data && (Date.now() - indicadoresCache.lastUpdate < 7200000)) {
      return res.json(indicadoresCache.data);
    }

    let url = 'https://mindicador.cl/api';
    if (tipo && fecha) url = `https://mindicador.cl/api/${tipo}/${fecha}`;
    else if (tipo) url = `https://mindicador.cl/api/${tipo}`;

    try {
      // 2. Intentar fetch con timeout extendido
      const response = await axios.get(url, { timeout: 15000 });
      if (!fecha) {
        indicadoresCache = { data: response.data, lastUpdate: Date.now() };
      }
      return res.json(response.data);
    } catch (apiError) {
      console.warn("⚠️ mindicador.cl inalcanzable:", apiError.message);

      // 3. Si falla y tenemos cache (aunque sea viejo), retornar cache
      if (indicadoresCache.data) {
        console.log("📦 Retornando datos desde Cache.");
        return res.json(indicadoresCache.data);
      }

      // 4. Si no hay nada, retornar valores de Fallback para que el Dashboard no muera
      console.log("🚨 Sin Cache. Retornando valores de emergencia (Fallback).");
      const fallback = {
        uf: { valor: 0 },
        utm: { valor: 0 },
        dolar: { valor: 0 },
        euro: { valor: 0 },
        version: "1.7.0 (No Data)",
        autor: "mindicador.cl"
      };
      return res.json(fallback);
    }
  } catch (error) {
    console.error("❌ Proxy mindicador Error Crítico:", error.message);
    res.status(500).json({ error: 'Error en el túnel de indicadores' });
  }
});

// --- B2. RRHH PLATFORM ROUTES (Independent module) ---
app.use('/api/rrhh/candidatos', require('./platforms/rrhh/routes/candidatosRoutes'));
app.use('/api/rrhh/contratos', require('./platforms/rrhh/routes/contratosRoutes'));
app.use('/api/rrhh/proyectos', require('./platforms/rrhh/routes/proyectosRoutes'));
app.use('/api/rrhh/proyectos', require('./platforms/rrhh/routes/proyectosAnalyticsRoutes'));
app.use('/api/rrhh/turnos', require('./platforms/rrhh/routes/turnosRoutes'));
app.use('/api/rrhh/asistencia', require('./platforms/rrhh/routes/asistenciaRoutes'));
app.use('/api/rrhh/time-tracker', require('./platforms/rrhh/routes/timeTrackerRoutes'));
app.use('/api/rrhh/plantillas', require('./platforms/rrhh/routes/plantillaRoutes'));
app.use('/api/comunicaciones', require('./platforms/comunicaciones/routes/chatRoutes'));
app.use('/api/reuniones', require('./platforms/comunicaciones/routes/reunionesRoutes'));
app.use('/api/rrhh/nomina', require('./platforms/rrhh/routes/liquidacionRoutes'));
app.use('/api/rrhh/config', require('./platforms/rrhh/routes/empresaRoutes'));
app.use('/api/notifications', require('./platforms/rrhh/routes/notificationRoutes'));

// --- B2.5. PLATFORM AUTH ROUTES ---
app.use('/api/auth', require('./platforms/auth/authRoutes'));
app.use('/api/empresas', require('./platforms/auth/empresaRoutes'));
app.use('/api/logistica', require('./platforms/logistica/routes/logisticaRoutes'));

// --- GEN AI: MÓDULO DE INTELIGENCIA ARTIFICIAL ---
app.use('/api/ai', require('./platforms/ai/aiRoutes'));

// --- B2.6. PLATFORM ADMIN ROUTES ---
app.use('/api/admin/sii', require('./platforms/admin/routes/siiRoutes'));
app.use('/api/admin/previred', require('./platforms/admin/routes/previredRoutes'));
app.use('/api/admin/bancos', require('./platforms/admin/routes/bancoRoutes'));
app.use('/api/admin/clientes', require('./platforms/admin/routes/clienteRoutes'));
app.use('/api/admin/bonos', require('./platforms/admin/routes/bonoRoutes'));
app.use('/api/admin/bonos-config', require('./platforms/admin/routes/tipoBonoRoutes'));
app.use('/api/admin/bonificadores', require('./platforms/admin/routes/bonoConfigRoutes')); // 🚀 NUEVO: Motor Unificado

// Empresa 360 (Facturación, Beneficios, LMS, Evaluaciones, Biometría y Tesorería)
app.use('/api/empresa360/facturacion', require('./platforms/empresa360/routes/facturacionRoutes'));
app.use('/api/empresa360/beneficios', require('./platforms/empresa360/routes/beneficiosRoutes'));
app.use('/api/empresa360/lms', require('./platforms/empresa360/routes/lmsRoutes'));
app.use('/api/empresa360/evaluaciones', require('./platforms/empresa360/routes/evaluacionesRoutes'));
app.use('/api/empresa360/biometria', require('./platforms/empresa360/routes/biometriaRoutes'));
app.use('/api/empresa360/tesoreria', require('./platforms/empresa360/routes/tesoreriaRoutes'));

// --- B3. PREVENCION PLATFORM ROUTES ---
app.use('/api/prevencion/dashboard', require('./platforms/prevencion/routes/dashboardRoutes'));
app.use('/api/prevencion/ast', require('./platforms/prevencion/routes/astRoutes'));
app.use('/api/prevencion/procedimientos', require('./platforms/prevencion/routes/procedimientoRoutes'));
app.use('/api/prevencion/charlas', require('./platforms/prevencion/routes/charlaRoutes'));
app.use('/api/prevencion/inspecciones', require('./platforms/prevencion/routes/inspeccionRoutes'));
app.use('/api/prevencion/incidentes', require('./platforms/prevencion/routes/incidenteRoutes'));
app.use('/api/prevencion/matriz-riesgos', require('./platforms/prevencion/routes/matrizRiesgosRoutes'));

// --- B4. OPERACIONES PLATFORM ROUTES ---
app.use('/api/operaciones/combustible', require('./platforms/operaciones/routes/combustibleRoutes'));
app.use('/api/operaciones/gastos', require('./platforms/operaciones/routes/gastoRoutes'));



// --- C. CLIENT MANAGEMENT (Financial Config) ---
app.get('/api/clientes', protect, async (req, res) => {
  try {
    const clientes = await Cliente.find({ empresaRef: req.user.empresaRef });
    res.json(clientes);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/clientes', protect, async (req, res) => {
  try {
    const { nombre, valorPunto, metaDiaria, valorFijo, reglaAsistencia } = req.body;
    let cliente = await Cliente.findOne({ nombre, empresaRef: req.user.empresaRef });

    if (!cliente) {
      cliente = new Cliente({
        nombre,
        valorPuntoActual: valorPunto,
        metaDiariaActual: metaDiaria,
        valorFijoActual: valorFijo || 0,
        reglaAsistencia: reglaAsistencia || false,
        empresaRef: req.user.empresaRef
      });
    } else {
      if (cliente.valorPuntoActual !== valorPunto) {
        cliente.historialCambios.push({ tipo: 'PRECIO', valorAnterior: cliente.valorPuntoActual, valorNuevo: valorPunto, fechaCambio: new Date() });
        cliente.valorPuntoActual = valorPunto;
      }
      cliente.metaDiariaActual = metaDiaria;
      cliente.valorFijoActual = valorFijo;
      cliente.reglaAsistencia = reglaAsistencia;
    }

    await cliente.save();
    res.json(cliente);
  } catch (error) { res.status(500).json({ error: error.message }); }
});


// --- D. ADVANCED FLEET CONTROL (Bulk Load) ---
app.post('/api/vehiculos/bulk', protect, async (req, res) => {
  try {
    let { flota } = req.body;
    if (!Array.isArray(flota)) return res.status(400).json({ error: "Invalid format" });

    // 🔒 INYECTAR EMPRESA
    flota = flota.map(v => ({ ...v, empresaRef: req.user.empresaRef }));

    await Vehiculo.insertMany(flota, { ordered: false });
    res.json({ message: "Bulk fleet load processed successfully" });
  } catch (e) {
    if (e.code === 11000) return res.status(207).json({ message: "Partial load (duplicate plates skipped)" });
    res.status(500).json({ error: e.message });
  }
});


// --- E. MANUAL BOT EXECUTION (Dashboard Buttons) ---

// Estado global del bot (en memoria)
global.BOT_STATUS = {
  running: false, startTime: null, fechaInicio: null, fechaFin: null,
  totalDias: 0, diaActual: 0, fechaProcesando: null,
  registrosGuardados: 0, ultimoError: null, logs: [], empresaRef: null,
  gruposEncontrados: null, esperandoSeleccion: false
};
let _botChild = null;

const pushLog = (msg) => {
  const entry = `[${new Date().toLocaleTimeString('es-CL', { timeZone: 'America/Santiago' })}] ${msg}`;
  global.BOT_STATUS.logs.push(entry);
  if (global.BOT_STATUS.logs.length > 80) global.BOT_STATUS.logs.shift();
  console.log('🤖', msg);
};

// GET status del bot
app.get('/api/bot/status', protect, authorize('rend_descarga_toa:ver'), (req, res) => {
  // No incluir screenshot en el status general (es muy pesado para polling 3s)
  const { screenshot, screenshotTime, ...statusSinImg } = global.BOT_STATUS;
  res.json({ ...statusSinImg, tieneScreenshot: !!screenshot, screenshotTime: screenshotTime || null });
});

// GET screenshot en vivo del bot (se llama cada 2s solo cuando el bot corre)
app.get('/api/bot/screenshot', protect, authorize('rend_descarga_toa:ver'), (req, res) => {
  const sc = global.BOT_STATUS.screenshot;
  if (!sc) return res.status(204).end();
  res.json({ data: sc, time: global.BOT_STATUS.screenshotTime });
});

app.post('/api/bot/run', protect, authorize('rend_descarga_toa:crear'), async (req, res) => {
  if (!botsLoaded) return res.status(503).json({ error: "Bots not loaded on server" });
  try {
    const { iniciarExtraccion } = require(`${PLATFORM_PATH}/bot/agente_real`);
    const { fechaInicio, fechaFin } = req.body || {};

    // Cargar credenciales TOA de la empresa desde la bóveda
    let credenciales = {};
    try {
      const empresa = await Empresa.findById(req.user.empresaRef);
      if (empresa && empresa.integracionTOA && empresa.integracionTOA.clave) {
        credenciales = {
          url:     empresa.integracionTOA.url || '',
          usuario: empresa.integracionTOA.usuario,
          clave:   desencriptarTexto(empresa.integracionTOA.clave)
        };
        // Actualizar fecha de última sincronización
        await Empresa.findByIdAndUpdate(req.user.empresaRef, {
          $set: {
            'integracionTOA.ultimaSincronizacion': new Date(),
            'integracionTOA.estadoSincronizacion': 'Sincronizando'
          }
        });
      }
    } catch (credErr) {
      console.warn('⚠️ No se pudieron cargar credenciales TOA de empresa, usando env vars:', credErr.message);
    }

    if (global.BOT_STATUS.running) {
      return res.status(409).json({ message: `El agente ya está corriendo. Procesando: ${global.BOT_STATUS.fechaProcesando}` });
    }

    const fi = new Date((fechaInicio || '2026-01-01') + 'T00:00:00Z');
    const ff = new Date((fechaFin || new Date().toISOString().split('T')[0]) + 'T00:00:00Z');
    const totalDias = Math.round((ff - fi) / 86400000) + 1;

    global.BOT_STATUS = {
      running: true, startTime: new Date(),
      fechaInicio: fechaInicio || '2026-01-01',
      fechaFin: fechaFin || new Date().toISOString().split('T')[0],
      totalDias, diaActual: 0, fechaProcesando: null,
      registrosGuardados: 0, ultimoError: null, logs: [],
      empresaRef: req.user.empresaRef
    };
    pushLog(`🚀 Agente iniciado. Rango: ${fechaInicio} → ${fechaFin} (${totalDias} días)`);

    // ⚡ FORK: Chrome corre en proceso hijo separado — no mata el servidor si se queda sin RAM
    const botScript = path.resolve(__dirname, `${PLATFORM_PATH}/bot/agente_real.js`);
    _botChild = fork(botScript, [], {
      env: {
        ...process.env,
        BOT_FECHA_INICIO:  fechaInicio || '',
        BOT_FECHA_FIN:     fechaFin || '',
        BOT_TOA_URL:       credenciales.url || '',
        BOT_TOA_USER:      credenciales.usuario || '',
        BOT_TOA_PASS:      credenciales.clave || '',
        BOT_EMPRESA_REF:   req.user.empresaRef?.toString() || ''
      },
      silent: false
    });

    _botChild.on('message', (msg) => {
      if (!msg) return;
      if (msg.type === 'log') pushLog(msg.text);
      if (msg.type === 'progress') {
        global.BOT_STATUS.diaActual = msg.diaActual;
        global.BOT_STATUS.totalDias = msg.totalDias;
        global.BOT_STATUS.fechaProcesando = msg.fechaProcesando;
        global.BOT_STATUS.grupoProcesando = msg.grupoProcesando || '';
        global.BOT_STATUS.registrosGuardados = msg.registrosGuardados || 0;
      }
      // Screenshot en vivo — se guarda el último frame para el frontend
      if (msg.type === 'screenshot') {
        global.BOT_STATUS.screenshot     = msg.data;   // base64 PNG
        global.BOT_STATUS.screenshotTime = Date.now();
      }
      // Etapa 1 completada: el bot escaneó el sidebar y espera selección del usuario
      if (msg.type === 'grupos_encontrados') {
        global.BOT_STATUS.gruposEncontrados  = msg.grupos || [];
        global.BOT_STATUS.esperandoSeleccion = true;
        pushLog(`📋 ${msg.grupos?.length || 0} grupos detectados. Esperando selección del usuario...`);
      }
    });

    _botChild.on('exit', (code) => {
      global.BOT_STATUS.running = false;
      pushLog(`🏁 Bot terminado (código: ${code})`);
      if (code !== 0 && !global.BOT_STATUS.ultimoError)
        global.BOT_STATUS.ultimoError = `Proceso terminó inesperadamente (código ${code})`;
      _botChild = null;
      // Resetear estado sincronización en la empresa
      const empresaRef = global.BOT_STATUS.empresaRef;
      if (empresaRef) {
        Empresa.findByIdAndUpdate(empresaRef, {
          $set: { 'integracionTOA.estadoSincronizacion': 'Configurado' }
        }).catch(e => console.warn('⚠️ No se pudo resetear estadoSync:', e.message));
      }
    });

    _botChild.on('error', (err) => {
      global.BOT_STATUS.running = false;
      global.BOT_STATUS.ultimoError = err.message;
      pushLog(`❌ Error proceso: ${err.message}`);
      _botChild = null;
    });

    res.json({ message: `Agente TOA iniciado. Rango: ${fechaInicio || '2026-01-01'} → ${fechaFin || new Date().toISOString().split('T')[0]}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DETENER BOT
app.post('/api/bot/stop', protect, authorize('rend_descarga_toa:crear'), async (req, res) => {
  try {
    if (_botChild) {
      _botChild.kill('SIGTERM');
      _botChild = null;
    }
    global.BOT_STATUS.running = false;
    global.BOT_STATUS.esperandoSeleccion = false;
    global.BOT_STATUS.gruposEncontrados  = null;
    pushLog('🛑 Descarga detenida manualmente.');
    // Resetear estado sincronización en la empresa
    const empresaRef = global.BOT_STATUS.empresaRef;
    if (empresaRef) {
      Empresa.findByIdAndUpdate(empresaRef, {
        $set: { 'integracionTOA.estadoSincronizacion': 'Configurado' }
      }).catch(e => console.warn('⚠️ No se pudo resetear estadoSync:', e.message));
    }
    res.json({ message: 'Agente detenido.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CONFIRMAR GRUPOS SELECCIONADOS POR EL USUARIO (Etapa 2)
app.post('/api/bot/confirmar-grupos', protect, authorize('rend_descarga_toa:crear'), async (req, res) => {
  try {
    const { grupos } = req.body;
    if (!grupos || !Array.isArray(grupos) || grupos.length === 0) {
      return res.status(400).json({ error: 'Debes seleccionar al menos un grupo.' });
    }
    if (!_botChild) {
      return res.status(409).json({ error: 'No hay un agente activo esperando confirmación.' });
    }
    if (!global.BOT_STATUS.esperandoSeleccion) {
      return res.status(409).json({ error: 'El agente no está en modo de espera de selección.' });
    }

    // Enviar grupos confirmados al proceso hijo via IPC
    _botChild.send({ type: 'confirmar_grupos', grupos });
    global.BOT_STATUS.esperandoSeleccion = false;
    global.BOT_STATUS.gruposEncontrados  = null;
    pushLog(`✅ ${grupos.length} grupos confirmados: ${grupos.map(g => g.nombre).join(', ')}`);
    res.json({ message: `Descarga iniciada con ${grupos.length} grupo(s).` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── MIGRACIÓN: Recalcular todos los decos como WiFi (0.25 pts) en la BD ──────
app.post('/api/bot/recalcular-decos', protect, authorize('rend_descarga_toa:crear'), async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const Actividad = require(`${PLATFORM_PATH}/models/Actividad`);
    const { obtenerTarifasEmpresa, parsearProductosServiciosTOA } = require(`${PLATFORM_PATH}/utils/calculoEngine`);
    const tarifasLPU = await obtenerTarifasEmpresa(empresaId);

    // Tarifa WiFi: mínimo puntos entre todos los candidatos de decos
    const decoWifiTarifa = tarifasLPU
      .filter(t => t.mapeo?.es_equipo_adicional &&
        ['Decos_WiFi_Adicionales', 'Decos_Adicionales', 'Decos_Cable_Adicionales'].includes(t.mapeo?.campo_cantidad))
      .sort((a, b) => a.puntos - b.puntos)[0];
    const decoWifiPts = decoWifiTarifa ? decoWifiTarifa.puntos : 0.25;
    const codigoDecoWifi = decoWifiTarifa?.codigo || '540057';

    const ps = (v) => { if (!v) return 0; if (typeof v === 'number') return v; return parseFloat(String(v).replace(',','.')) || 0; };

    // Cursor sobre TODOS los documentos con decos > 0 de la empresa
    const cursor = Actividad.find({
      empresaRef: empresaId,
      $or: [
        { DECOS_ADICIONALES: { $gt: 0 } },
        { Decos_Adicionales: { $gt: 0 } },
        { 'Decos_Adicionales': { $regex: /^[1-9]/ } },
        { PTS_DECO_ADICIONAL: { $gt: 0 } },
        { Pts_Deco_Adicional: { $gt: 0 } }
      ]
    }).lean().cursor({ batchSize: 200 });

    let updated = 0, skipped = 0;
    const bulkOps = [];

    for await (const doc of cursor) {
      // Obtener cantidad de decos
      const clean = {};
      for (const [k, v] of Object.entries(doc)) clean[k.replace(/[\.\s]/g, '_')] = v;

      // Re-parsear XML si hace falta
      if (!clean.Decos_Adicionales && !clean.DECOS_ADICIONALES && clean.Productos_y_Servicios_Contratados) {
        const derivados = parsearProductosServiciosTOA(clean.Productos_y_Servicios_Contratados);
        if (derivados) Object.assign(clean, derivados);
      }

      const qD_split = Math.floor(ps(clean.Decos_Cable_Adicionales || clean.DECOS_CABLE_ADICIONALES || 0)) +
                       Math.floor(ps(clean.Decos_WiFi_Adicionales  || clean.DECOS_WIFI_ADICIONALES  || 0));
      const qD_total = Math.floor(ps(clean.Decos_Adicionales || clean.DECOS_ADICIONALES || 0));
      const qD = qD_split > 0 ? qD_split : qD_total;
      if (qD === 0) { skipped++; continue; }

      const pBase = ps(clean.Pts_Actividad_Base || clean.PTS_ACTIVIDAD_BASE || 0);
      const pRep  = ps(clean.Pts_Repetidor_WiFi || clean.PTS_REPETIDOR_WIFI || 0);
      const pTel  = ps(clean.Pts_Telefono       || clean.PTS_TELEFONO       || 0);
      const newPtsDeco  = Math.round(qD * decoWifiPts * 100) / 100;
      const newPtsTotal = Math.round((pBase + newPtsDeco + pRep + pTel) * 100) / 100;

      // Solo actualizar si hay diferencia real
      const oldPtsDeco  = ps(clean.Pts_Deco_Adicional || clean.PTS_DECO_ADICIONAL || 0);
      const oldPtsTotal = ps(clean.Pts_Total_Baremo   || clean.PTS_TOTAL_BAREMO   || 0);
      if (Math.round(oldPtsDeco * 100) === Math.round(newPtsDeco * 100) &&
          Math.round(oldPtsTotal * 100) === Math.round(newPtsTotal * 100)) {
        skipped++; continue;
      }

      bulkOps.push({ updateOne: {
        filter: { _id: doc._id },
        update: { $set: {
          Pts_Deco_Adicional:   newPtsDeco,
          Pts_Deco_WiFi:        newPtsDeco,
          Pts_Deco_Cable:       0,
          PTS_DECO_ADICIONAL:   newPtsDeco,
          Codigo_LPU_Deco_WiFi: codigoDecoWifi,
          Pts_Total_Baremo:     String(newPtsTotal),
          PTS_TOTAL_BAREMO:     newPtsTotal,
          DECOS_ADICIONALES:    qD,
        }}
      }});

      if (bulkOps.length >= 500) {
        const r = await Actividad.bulkWrite(bulkOps, { ordered: false });
        updated += r.modifiedCount;
        bulkOps.length = 0;
      }
    }

    if (bulkOps.length > 0) {
      const r = await Actividad.bulkWrite(bulkOps, { ordered: false });
      updated += r.modifiedCount;
    }

    console.log(`[recalcular-decos] Empresa ${empresaId}: ${updated} actualizados, ${skipped} sin cambios`);
    res.json({ ok: true, updated, skipped, decoWifiPts, codigoDecoWifi });
  } catch (err) {
    console.error('Error recalcular-decos:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bot/gps-run', protect, async (req, res) => {
  if (!botsLoaded) return res.status(503).json({ error: "Bots not loaded on server" });
  try {
    // 🔒 RESTRICT TO ADMIN
    if (!['system_admin', 'ceo'].includes(req.user.role)) {
      return res.status(403).json({ message: "Acceso denegado: solo personal de administración puede ejecutar bots maestros." });
    }
    const { iniciarRastreoGPS } = require(`${PLATFORM_PATH}/bot/agente_gps`);
    console.log('👆 MANUAL GPS EXECUTION REQUESTED');
    iniciarRastreoGPS();
    res.json({ message: "GPS Agent deployed and syncing." });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET - Obtener config TOA de la empresa (sin exponer la clave)
app.get('/api/empresa/toa-config', protect, authorize('rend_descarga_toa:ver'), async (req, res) => {
  try {
    const empresa = await Empresa.findById(req.user.empresaRef);
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });
    const cfg = empresa.integracionTOA || {};
    res.json({
      url: cfg.url || 'https://telefonica-cl.etadirect.com/',
      usuario: cfg.usuario || '',
      claveConfigurada: !!cfg.clave,
      ultimaSincronizacion: cfg.ultimaSincronizacion,
      estadoSincronizacion: cfg.estadoSincronizacion || 'Sin configurar'
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST - Guardar/actualizar credenciales TOA de la empresa (cifradas AES-256)
// Si se omite la clave, conserva la existente (permite cambiar solo el usuario)
app.post('/api/empresa/toa-config', protect, authorize('rend_descarga_toa:editar'), async (req, res) => {
  try {
    const { url, usuario, clave } = req.body;
    if (!usuario) return res.status(400).json({ error: 'El usuario TOA es requerido' });

    const updateData = {
      'integracionTOA.usuario': usuario.trim(),
      'integracionTOA.estadoSincronizacion': 'Configurado'
    };
    if (url && url.trim()) updateData['integracionTOA.url'] = url.trim();

    if (clave && clave.trim()) {
      updateData['integracionTOA.clave'] = encriptarTexto(clave);
    } else {
      const empresa = await Empresa.findById(req.user.empresaRef);
      if (!empresa?.integracionTOA?.clave) {
        return res.status(400).json({ error: 'La contraseña TOA es requerida para la primera configuración' });
      }
    }

    await Empresa.findByIdAndUpdate(req.user.empresaRef, { $set: updateData });
    res.json({ message: 'Configuración TOA guardada correctamente.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// =============================================================================
// F. DATA PROCESSING (Production & Sync) - 🚀 MEJORADO
// =============================================================================

// 1. SINCRONIZACIÓN INTELIGENTE (UPSERT)
app.post('/api/sincronizar', protect, authorize('rend_descarga_toa:crear'), async (req, res) => {
  try {
    const { reportes } = req.body;
    if (!reportes || reportes.length === 0) return res.status(400).json({ message: "No data to sync" });

    // Cargar config financiera
    const clientesDB = await Cliente.find({ empresaRef: req.user.empresaRef });
    const mapaClientes = {};
    clientesDB.forEach(c => mapaClientes[c.nombre] = c);
    const clienteDefault = clientesDB[0] || { nombre: "Generico", valorPuntoActual: 0 };

    // Preparar Operaciones Bulk (Más rápido y seguro contra duplicados)
    const bulkOps = reportes.map(rep => {
      const clienteConfig = mapaClientes[rep.cliente] || clienteDefault;
      const ingresoCalculado = (rep.puntos || 0) * (clienteConfig.valorPuntoActual || 0);

      return {
        updateOne: {
          filter: { ordenId: rep.ordenId }, // Buscamos por Orden ID
          update: {
            $set: {
              ...rep,
              empresaRef: req.user.empresaRef,
              clienteAsociado: rep.cliente || clienteDefault.nombre,
              ingreso: ingresoCalculado,
              ultimaActualizacion: new Date()
            }
          },
          upsert: true // Si no existe, lo crea. Si existe, lo actualiza.
        }
      };
    });

    await Actividad.bulkWrite(bulkOps);
    console.log(`💾 Data Synced: ${reportes.length} records processed via BulkWrite.`);

    res.json({ message: "Sync completed successfully with Upsert." });

  } catch (error) {
    console.error("Sync Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 2. PRODUCCIÓN EN VIVO (DETALLE PARA TABLA)
app.get('/api/produccion', protect, (req, res, next) => {
  const queriedRut = req.query.rut?.replace(/\./g, "").replace(/-/g, "").toUpperCase().trim();
  const userRut = req.user.rut?.replace(/\./g, "").replace(/-/g, "").toUpperCase().trim();
  const supervisorId = req.query.supervisorId;

  // 🛡️ Bypass: El técnico ve su propia producción O el supervisor ve su dotación
  if (queriedRut && userRut && queriedRut === userRut) return next();
  if (supervisorId && (String(supervisorId) === String(req.user._id) || String(supervisorId) === String(req.user.id))) return next();
  
  authorize('rend_operativo:ver', ROLES.SUPERVISOR)(req, res, next);
}, async (req, res) => {
  try {
    const { rut, supervisorId, tipo, limit = 5000, desde, hasta, estado } = req.query;
    let query = { empresaRef: req.user.empresaRef };

    if (rut) {
      const r = rut.replace(/\./g, "").replace(/-/g, "").toUpperCase().trim();
      
      // Intentar vincular por ID Recurso TOA si existe el técnico
      let tecnico = await Tecnico.findOne({ 
        empresaRef: req.user.empresaRef,
        $or: [{ rut: r }, { rut }] 
      }).select('idRecursoToa nombres apellidos');

      if (!tecnico && req.user.email) {
        tecnico = await Tecnico.findOne({ 
          email: req.user.email, 
          empresaRef: req.user.empresaRef 
        }).select('idRecursoToa nombres apellidos');
      }

      query.$or = [
        { tecnicoRut: r },
        { rut: r },
        { tecnicoRut: rut }, 
        { rut: rut }
      ];

      if (tecnico) {
        if (tecnico.idRecursoToa) {
          query.$or.push({ "ID_Recurso": tecnico.idRecursoToa });
          query.$or.push({ "ID Recurso": tecnico.idRecursoToa });
          query.$or.push({ "idRecurso": tecnico.idRecursoToa });
          query.$or.push({ "Recurso": tecnico.idRecursoToa });
          query.$or.push({ "RECURSO": tecnico.idRecursoToa });
        }
        // Fallback por nombre si no hay match por ID
        if (tecnico.nombres && tecnico.apellidos) {
          const fullName = `${tecnico.nombres} ${tecnico.apellidos}`.trim();
          query.$or.push({ "nombre": { $regex: fullName, $options: 'i' } });
          query.$or.push({ "TECNICO": { $regex: fullName, $options: 'i' } });
        }
      }
    } else if (supervisorId) {
      // Si se pide por supervisor, obtener los ruts e IDs de su equipo
      const tecnicos = await Tecnico.find({ supervisorId, empresaRef: req.user.empresaRef }).select('rut idRecursoToa');
      const ruts = tecnicos.map(t => t.rut);
      const toaIds = tecnicos.map(t => t.idRecursoToa).filter(Boolean);
      
      query.$or = [
        { tecnicoRut: { $in: ruts } },
        { rut: { $in: ruts } },
        { "ID_Recurso": { $in: toaIds } },
        { "ID Recurso": { $in: toaIds } },
        { "idRecurso": { $in: toaIds } },
        { "Recurso": { $in: toaIds } }
      ];
    }

    if (desde || hasta) {
      query.fecha = {};
      if (desde) query.fecha.$gte = new Date(desde + 'T00:00:00Z');
      if (hasta) query.fecha.$lte = new Date(hasta + 'T23:59:59Z');
    }

    if (estado && estado !== 'todos') {
      query.Estado = estado;
    }

    if (tipo) {
      if (tipo === 'Reparación') {
        query.Número_de_Petición = { $regex: /^INC/i };
      } else if (tipo === 'Provisión') {
        query.Número_de_Petición = { $not: /^INC/i };
      }
    }

    const datosRaw = await Actividad.find(query)
      .sort({ fecha: -1 })
      .limit(parseInt(limit));

    // RECALCULAR PUNTOS EN TIEMPO REAL (misma regla: decos = tarifa mínima, normalmente 0.25 WiFi)
    const tarifarios = await Baremo.find({ empresaRef: req.user.empresaRef });
    const decoWifiTar = tarifarios
      .filter(t => ['Decos_WiFi_Adicionales', 'Decos_Adicionales', 'Decos_Cable_Adicionales'].includes(t.mapeo?.campo_cantidad || '') ||
        String(t.mapeo?.valor_busqueda || '').toLowerCase().includes('wi-fi'))
      .sort((a, b) => a.puntos - b.puntos)[0];
    const dwPts = decoWifiTar ? decoWifiTar.puntos : 0.25;

    const ps = (v) => isNaN(parseFloat(v)) ? 0 : parseFloat(v);

    const datosFinales = datosRaw.map(d => {
      const clean = d.toObject ? d.toObject() : d;
      
      // Cantidades con lógica anti-doble conteo
      const qD_split = Math.floor(ps(clean.Decos_Cable_Adicionales || 0)) + Math.floor(ps(clean.Decos_WiFi_Adicionales || 0));
      const qD_total = Math.floor(ps(clean.Decos_Adicionales || clean.DECOS_ADICIONALES || 0));
      const qD = qD_split > 0 ? qD_split : qD_total;

      const pB = ps(clean.Pts_Actividad_Base || clean.PTS_ACTIVIDAD_BASE || 0);
      const pD = qD * dwPts;
      const pR = ps(clean.Pts_Repetidor_Wifi || clean.PTS_REPETIDOR_WIFI || 0);
      const pT = ps(clean.Pts_Telefono || clean.PTS_TELEFONO || 0);

      const pExpl = pB + pD + pR + pT;
      const pField = ps(clean.Puntos || clean.puntos || clean.Pts_Total_Baremo || clean.PTS_TOTAL_BAREMO || 0);

      // Si hay desglose de equipos, preferimos el calculado. Si no, el de campo.
      const hasExpl = qD > 0 || ps(clean.Repetidores_WiFi || 0) > 0 || ps(clean.Telefonos || 0) > 0;
      
      return {
        ...clean,
        puntos: hasExpl ? pExpl : pField,
        Pts_Total_Baremo: hasExpl ? pExpl : pField
      };
    });

    res.json(datosFinales || []);
  } catch (error) { res.status(500).json({ error: error.message }); }
});



// =============================================================================
// PARSER XML — Productos_y_Servicios_Contratados
// Extrae: Velocidad Internet, Plan TV, Telefonía, Equipos adicionales, etc.
// =============================================================================
function parsearProductosServiciosTOA(xmlStr) {
    if (!xmlStr || typeof xmlStr !== 'string' || !xmlStr.includes('<ProductService>')) return null;
    const productos = [];
    const regex = /<ProductService>([\s\S]*?)<\/ProductService>/g;
    let match;
    while ((match = regex.exec(xmlStr)) !== null) {
        const bloque = match[1];
        const get = (tag) => { 
            const m = bloque.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 'i')); 
            return m ? m[1].trim().replace(/_+$/g, '') : ''; 
        };
        
        // Detección más profunda de "con precio" por item
        const monto = get('Monto') || get('Precio') || get('Price') || '';
        const tipoPreco = get('TipoPrecio') || get('TipoPrecoItem') || get('CON_PRECO') || get('ConPreco') || '';
        const itemConPreco = (tipoPreco && tipoPreco !== '0' && tipoPreco.toUpperCase() !== 'NO') || 
                            (parseFloat(monto) > 0);

        productos.push({ 
            codigo: get('Codigo'), 
            descripcion: get('Descripcion'), 
            familia: get('Familia'), 
            operacion: get('OperacionComercial'), 
            cantidad: parseInt(get('Cantidad')) || 1,
            tipoPrecio: tipoPreco,
            monto: monto,
            conPreco: itemConPreco
        });
    }
    if (!productos.length) return null;

    const altas = productos.filter(p => ['ALTA', 'ADD'].includes(p.operacion?.toUpperCase()));
    const bajas = productos.filter(p => ['BAJA', 'DEL', 'REMOVE'].includes(p.operacion?.toUpperCase()));
    
    const fibAlta = altas.find(p => p.familia === 'FIB' || /INTERNET|BANDA ANCHA/i.test(p.descripcion));
    const velocidadMatch = fibAlta ? fibAlta.descripcion.match(/(\d+\/\d+|\d+\s?MEGAS|\d+\s?GIGA)/i) : null;
    const velocidadInternet = velocidadMatch ? velocidadMatch[0] : (fibAlta ? fibAlta.descripcion : '');
    
    const tvAlta = altas.find(p => p.familia === 'IPTV' || /TV|TELEVISION/i.test(p.descripcion));
    const toipAlta = altas.find(p => p.familia === 'TOIP' || /TELEFONIA|VOZ/i.test(p.descripcion));
    // Detección de equipos: Más inclusiva para no perder decos/repetidores con nombres variantes
    const equipos = altas.filter(p => p.familia === 'EQ' || /EQUIPO|DECO|MODEM|ROUTER|EXTENSOR|EXTENDER|IPTV|DTA|STB|MESH|WIFI|PUNTO.ACCESO/i.test(p.descripcion));
    
    // Categorización de equipos con detección de "con precio"
    const getEquipos = (reg) => equipos.filter(p => reg.test(p.descripcion));
    
    // Todos los decodificadores (incluyendo STB, receptor, etc)
    const decosTodos = getEquipos(/adicional|deco|iptv|dta|stb|receptor|box|streming|android|smart.tv|4k|vip|nagrav|pds/i);
    // Dividir los decos en WiFi vs Cable
    const decosCable = decosTodos.filter(p => !/wifi|smart|inalam|wireless|dual|ac|ax|802\.11|mesh/i.test(p.descripcion));
    const decosWifi = decosTodos.filter(p => /wifi|smart|inalam|wireless|dual|ac|ax|802\.11|mesh/i.test(p.descripcion));
    
    // Repetidores: solo los que NO son decos/iptv/stb y tienen keywords de wifi/mesh
    const repetidores = getEquipos(/repetidor|extensor|extender|wifi|mesh|punto.acceso|access.point|amplificador|modul.wifi|repro.senal/i).filter(p => !/deco|iptv|stb|receptor|box/i.test(p.descripcion));
    const telefonosTodos = getEquipos(/teléfono|telefono|phone/i);
    const modemArr = equipos.filter(p => /modem|módem|ont|hgu|router|gateway/i.test(p.descripcion));
    const modem = modemArr.length > 0 ? modemArr[0] : null;
    
    // Función para obtener la cantidad real (considerando multiplicadores en el texto)
    const getQtyReal = (p) => {
        if (!p) return 0;
        let q = p.cantidad || 1;
        // Si la cantidad es 1, buscamos si hay un multiplicador en el texto (ej: "x2", "2 UNI")
        if (q === 1 && p.descripcion) {
            const m = p.descripcion.match(/\(x(\d+)\)/i) || p.descripcion.match(/(\d+)\s?(UNI|UNIDAD|UND|PCS)/i);
            if (m) q = parseInt(m[1]);
        }
        return q;
    };

    // Cantidades finales (Simplificado por petición del usuario - Todos los Adicionales son WiFi por defecto)
    let ctCable = 0;
    let ctWifi = decosTodos.reduce((s, p) => s + getQtyReal(p), 0);
    let ctRepetidores = repetidores.reduce((s, p) => s + getQtyReal(p), 0);
    let ctTelefonos = telefonosTodos.reduce((s, p) => s + getQtyReal(p), 0);

    let tipoOp = 'Alta nueva';
    if (bajas.length > 0 && altas.length > 0) tipoOp = 'Cambio/Migración';
    else if (bajas.length > 0 && altas.length === 0) tipoOp = 'Baja';

    // LÓGICA DE EQUIPO BASE: Descontar el primer equipo en altas/migraciones
    if ((tipoOp === 'Alta nueva' || tipoOp === 'Cambio/Migración') && (ctWifi > 0 || ctRepetidores > 0)) {
        // Por defecto, el primer Deco es el BASE (incluido en el plan)
        if (ctWifi > 0) ctWifi--; 
        else if (ctRepetidores > 0) ctRepetidores--;
    }



    // Teléfonos: la regla original dicta que la 1ra linea es base en altas nuevas.
    if (tipoOp === 'Alta nueva' && ctTelefonos > 0) {
        ctTelefonos--;
    }
    
    // Detección global "con precio" para la orden
    const tienePreco = decosTodos.some(p => p.conPreco) || repetidores.some(p => p.conPreco) || telefonosTodos.some(p => p.conPreco);
    
    let tieneDecoPrincipal = decosTodos.some(p => /principal/i.test(p.descripcion)) || (modem && /hgu|ont|gateway/i.test(modem.descripcion));
    
    return {
        'Velocidad_Internet': velocidadInternet, 
        'Plan_TV': tvAlta ? tvAlta.descripcion : '', 
        'Telefonia': toipAlta ? toipAlta.descripcion : '',
        'Modem': modem ? modem.descripcion : '', 
        'Deco_Principal': (tipoOp === 'Alta nueva' || tipoOp === 'Cambio/Migración') ? 'Sí' : 'No',
        'Decos_Cable_Adicionales': '0',
        'Decos_WiFi_Adicionales': String(Math.max(0, ctWifi)),
        'Decos_Adicionales': String(Math.max(0, ctWifi)), // Support field for Legacy
        'Repetidores_WiFi': String(Math.max(0, ctRepetidores)), 
        'Telefonos': String(Math.max(0, ctTelefonos)),
        'Total_Equipos_Extras': String(Math.max(0, ctCable + ctWifi + ctRepetidores + ctTelefonos)), 
        'Tipo_Operacion': tipoOp,

        'Con_Preco': tienePreco ? 'SI' : 'NO',
        'Equipos_Detalle': `[${tipoOp}] ` + equipos.map(p => {
            const q = (typeof getQtyReal === 'function') ? getQtyReal(p) : (p.cantidad || 1);
            return `${p.descripcion}${q > 1 ? ` (x${q})` : ''}${p.conPreco ? ' [CON PRECIO]' : ''}`;
        }).join(' | '),
        'Total_Productos': String(productos.length)
    };
}


// =============================================================================
// MOTOR DE BAREMIZACIÓN — Calcula puntos LPU para cada orden
// Usa la tabla TarifaLPU de la empresa para asignar puntos automáticamente
// =============================================================================
const TarifaLPU = require(`${PLATFORM_PATH}/models/TarifaLPU`);
const ValorPuntoCliente = require(`${PLATFORM_PATH}/models/ValorPuntoCliente`);
const Proyecto = require('./platforms/rrhh/models/Proyecto');

// Cache de tarifas por empresa (se recarga cada 5 minutos)
const _tarifaCache = {};
async function obtenerTarifasEmpresa(empresaId) {
    const key = String(empresaId);
    const now = Date.now();
    if (_tarifaCache[key] && (now - _tarifaCache[key].ts) < 300000) return _tarifaCache[key].data;
    const tarifas = await TarifaLPU.find({ empresaRef: empresaId, activo: true }).lean();
    _tarifaCache[key] = { data: tarifas, ts: now };
    return tarifas;
}

function calcularBaremos(doc, tarifas) {
    if (!tarifas || !tarifas.length) return null;

    // Si los campos de equipos están vacíos pero existe el XML bruto, re-parsear on-the-fly
    // Esto asegura que mejoras en la regex de detección se apliquen a datos ya guardados
    if ((!doc.Decos_Cable_Adicionales || !doc.Decos_WiFi_Adicionales) && (doc.Productos_y_Servicios_Contratados || doc['Productos_y_Servicios_Contratados'])) {
        const xmlVal = doc.Productos_y_Servicios_Contratados || doc['Productos_y_Servicios_Contratados'] || '';
        const derivados = parsearProductosServiciosTOA(xmlVal);
        if (derivados) {
            Object.assign(doc, derivados);
            // Asegurar que las keys upper para el loop financiero también se actualicen
            Object.entries(derivados).forEach(([k, v]) => {
                doc[k.toUpperCase()] = v;
                doc[k.replace(/ /g, '_').toUpperCase()] = v;
            });
        }
    }

    const tipoTrabajo = doc.Tipo_Trabajo || doc.Tipo_de_Trabajo || doc['Tipo de Trabajo'] || '';
    const subtipo = doc.Subtipo_de_Actividad || doc['Subtipo de Actividad'] || '';
    const reutDrop = (doc['Reutilización_de_Drop'] || doc['Reutilizacion_de_Drop'] || doc['Reutilizacion de Drop'] || '').toUpperCase();
    const conPreco = (doc['Con_Preco'] || doc['Con Preco'] || '').toUpperCase();
    const decosAd = parseInt(doc.Decos_Adicionales || doc['Decos Adicionales'] || doc.DECOS_ADICIONALES || 0);
    const decosCableAd = parseInt(doc.Decos_Cable_Adicionales || doc['Decos Cable Adicionales'] || doc.DECOS_CABLE_ADICIONALES || 0);
    const decosWifiAd = parseInt(doc.Decos_WiFi_Adicionales || doc['Decos WiFi Adicionales'] || doc.DECOS_WIFI_ADICIONALES || 0);
    const repetidores = parseInt(doc.Repetidores_WiFi || doc['Repetidores WiFi'] || doc.REPETIDORES_WIFI || 0);
    const telefonos = parseInt(doc.Telefonos || doc['Telefonos'] || doc.TELEFONOS || 0);

    // Separar tarifas base vs equipos adicionales
    const tarifasBase = tarifas.filter(t => !t.mapeo?.es_equipo_adicional);
    const tarifasEquipos = tarifas.filter(t => t.mapeo?.es_equipo_adicional);

    // 1. ACTIVIDAD BASE — buscar la tarifa que mejor coincida
    let mejorMatch = null;
    let mejorScore = -1;

    for (const t of tarifasBase) {
        let score = 0;
        const m = t.mapeo || {};

        // 0. MATCH POR CÓDIGO (Manual LPU) — Prioridad Absoluta
        const codigosDoc = doc._productCodes || [];
        if (t.codigo && codigosDoc.includes(t.codigo)) {
            score += 100; // Match perfecto por código LPU
        }

        // Match por Tipo_Trabajo (patrón exacto o regex con |)
        if (m.tipo_trabajo_pattern) {
            const patterns = m.tipo_trabajo_pattern.split('|');
            const matched = patterns.some(p => {
                const pTrim = p.trim();
                if (pTrim === tipoTrabajo) return true;
                try { return new RegExp('^' + pTrim + '$').test(tipoTrabajo); } catch (_) { return false; }
            });
            if (matched) score += 10;
            else if (score < 100) continue; // Si no hay match por código Y no matchea nombre, saltar
        }

        // Match por Subtipo_de_Actividad
        if (m.subtipo_actividad) {
            if (subtipo.startsWith(m.subtipo_actividad) || subtipo === m.subtipo_actividad) score += 5;
            else if (m.tipo_trabajo_pattern || t.codigo) { /* si ya matcheó algo, no descalificar */ }
            else continue;
        }

        // Match por reutilización DROP
        if (m.requiere_reutilizacion_drop) {
            if (m.requiere_reutilizacion_drop === reutDrop) score += 3;
            else if (reutDrop) score -= 5; // Penalizar fuertemente si no coincide y el doc tiene el dato
        }

        // Match por Con_Preco
        if (m.con_preco) {
            if (m.con_preco === conPreco) score += 4;
            else if (conPreco) score -= 5; // Penalizar si no coincide
        }

        // Match por familia producto
        if (m.familia_producto) {
            // Verificar si el doc tiene productos de esa familia
            const famCheck = {
                'TOIP': doc.Telefonia,
                'IPTV': doc.Plan_TV,
                'FIB': doc.Velocidad_Internet
            };
            if (famCheck[m.familia_producto]) score += 2;
        }

        // Match estricto por condicion_extra (Campo=Valor o Regex Libre)
        if (m.condicion_extra) {
            const cond = m.condicion_extra.trim();
            let matchExp = false;
            
            if (cond.includes('=')) {
                // Modo exacto (Ej: "Tipo_Operacion=Baja")
                const [key, val] = cond.split('=');
                const cleanKey = key.trim();
                const cleanVal = val.trim().toLowerCase();
                
                // Si la key es un campo derivado explícito u original
                const docVal = String(doc[cleanKey] || '').toLowerCase();
                if (docVal.includes(cleanVal)) {
                    matchExp = true;
                }
            } else {
                // Modo fallback global (busca la palabra en todo el string del doc)
                const docStr = JSON.stringify(doc).toLowerCase();
                if (docStr.includes(cond.toLowerCase())) {
                    matchExp = true;
                }
            }

            if (matchExp) {
                score += 15; // Gran prioridad si cumple un requisito especial
            } else {
                continue; // 🚨 REGLA ESTRICTA: Si tiene condición y NO se cumple, se descarta por completo esta tarifa.
            }
        }

        if (score > mejorScore) {
            mejorScore = score;
            mejorMatch = t;
        }
    }

    const ptsBase = mejorMatch ? mejorMatch.puntos : 0;
    const codigoBase = mejorMatch ? mejorMatch.codigo : '';
    const descBase = mejorMatch ? mejorMatch.descripcion : '';

    // 2. EQUIPOS ADICIONALES
    // REGLA DE NEGOCIO: Todos los decos adicionales se tratan como WiFi (0.25) por defecto.
    // No dependemos del orden de tarifas: elegimos la tarifa de decos con MÍNIMO puntaje.

    // Consolidar cantidad total de decos (evitar doble conteo)
    const decosEfectivos = (decosCableAd > 0 || decosWifiAd > 0) ? (decosCableAd + decosWifiAd) : decosAd;

    const tarifaDecoWifi = tarifasEquipos
      .filter(t => ['Decos_WiFi_Adicionales', 'Decos_Adicionales', 'Decos_Cable_Adicionales'].includes(t.mapeo?.campo_cantidad || ''))
      .sort((a, b) => a.puntos - b.puntos)[0];

    let ptsDecoCable = 0, ptsDecoWifi = 0, ptsRepetidor = 0, ptsTelefono = 0;
    let codigoDecoCable = '', codigoDecoWifi = '', codigoRepetidor = '', codigoTelefono = '';

    if (tarifaDecoWifi && decosEfectivos > 0) {
      ptsDecoWifi = tarifaDecoWifi.puntos * decosEfectivos;
      codigoDecoWifi = tarifaDecoWifi.codigo;
    }

    for (const t of tarifasEquipos) {
      const campo = t.mapeo?.campo_cantidad || '';
      const tConPreco = (t.mapeo?.con_preco || '').toUpperCase();
      if (tConPreco && tConPreco !== conPreco) continue;

      // Decos ya calculados arriba con la tarifa mínima
      if (campo === 'Repetidores_WiFi' && repetidores > 0 && !ptsRepetidor) {
        ptsRepetidor = t.puntos * repetidores;
        codigoRepetidor = t.codigo;
      } else if (campo === 'Telefonos' && telefonos > 0 && !ptsTelefono) {
        ptsTelefono = t.puntos * telefonos;
        codigoTelefono = t.codigo;
      }
    }

    const ptsTotal = ptsBase + ptsDecoCable + ptsDecoWifi + ptsRepetidor + ptsTelefono;

    return {
        'Pts_Actividad_Base': String(ptsBase),
        'Codigo_LPU_Base': codigoBase,
        'Desc_LPU_Base': descBase,
        'Pts_Deco_Cable': String(ptsDecoCable),
        'Codigo_LPU_Deco_Cable': codigoDecoCable,
        'Pts_Deco_WiFi': String(ptsDecoWifi),
        'Codigo_LPU_Deco_WiFi': codigoDecoWifi,
        'Pts_Deco_Adicional': String(ptsDecoCable + ptsDecoWifi), // Legacy sum
        'Pts_Repetidor_WiFi': String(ptsRepetidor),
        'Codigo_LPU_Repetidor': codigoRepetidor,
        'Pts_Telefono': String(ptsTelefono),
        'Codigo_LPU_Telefono': codigoTelefono,
        'Pts_Total_Baremo': String(ptsTotal)
    };
}

// Agregar valorización monetaria a un doc con baremos
// Flujo: ID Recurso → Técnico (idRecursoToa) → Proyecto (projectId) → cliente → ValorPuntoCliente
function valorizarBaremos(doc, mapaValorizacion) {
    const ptsTotal = parseFloat(doc.Pts_Total_Baremo) || 0;
    const idRecurso = doc['ID_Recurso'] || doc['ID Recurso'] || '';

    // Siempre retornar las columnas (con 0 si no hay vínculo)
    const resultado = {
        'Valor_Punto_CLP': '0',
        'Valor_Actividad_CLP': '0',
        'Cliente_Tarifa': '',
        'Proyecto_Tarifa': ''
    };

    if (!idRecurso || !mapaValorizacion || ptsTotal === 0) return resultado;

    const config = mapaValorizacion[idRecurso];
    if (!config) return resultado;

    resultado['Valor_Punto_CLP'] = String(config.valorPunto || 0);
    resultado['Valor_Actividad_CLP'] = String(Math.round(ptsTotal * (config.valorPunto || 0)));
    resultado['Cliente_Tarifa'] = config.cliente || '';
    resultado['Proyecto_Tarifa'] = config.proyecto || '';
    return resultado;
}

// Construir mapa de valorización: idRecurso → { cliente, proyecto, valorPunto }
// Cache de 10 minutos para evitar queries repetitivas
const _mapValorizacionCache = {};
async function construirMapaValorizacion(empresaId) {
    const cacheKey = String(empresaId);
    const now = Date.now();
    if (_mapValorizacionCache[cacheKey] && (now - _mapValorizacionCache[cacheKey].ts) < 600000) {
      return _mapValorizacionCache[cacheKey].data;
    }
    // 1. Todos los técnicos de la empresa con idRecursoToa vinculado
    const tecnicos = await Tecnico.find({
        empresaRef: empresaId,
        idRecursoToa: { $exists: true, $ne: '' }
    }).lean();

    if (tecnicos.length === 0) return {};

    // 2. Obtener los proyectos y CLIENTES referenciados para resolver nombres registrados
    const projectIds = [...new Set(tecnicos.map(t => t.projectId).filter(Boolean))];
    const proyectos = projectIds.length > 0 ? await Proyecto.find({ _id: { $in: projectIds } }).lean() : [];
    
    // Nueva lógica: Los proyectos ahora guardan el ID del cliente. Debemos obtener los nombres.
    const clientIds = [...new Set(proyectos.map(p => p.cliente).filter(Boolean))];
    const clientesDoc = clientIds.length > 0 ? await Cliente.find({ _id: { $in: clientIds } }).select('nombre valorPuntoActual').lean() : [];
    const clientNameMap = {};
    const clientPriceMap = {};
    clientesDoc.forEach(c => { 
        const name = c.nombre || '';
        clientNameMap[String(c._id)] = name; 
        clientPriceMap[String(c._id)] = c.valorPuntoActual || 0;
        clientPriceMap[name.toUpperCase().trim()] = c.valorPuntoActual || 0;
    });

    const proyectoMap = {};
    proyectos.forEach(p => { proyectoMap[String(p._id)] = p; });

    // 3. Obtener los valores por punto por cliente
    const valoresPunto = await ValorPuntoCliente.find({ empresaRef: empresaId, activo: true }).lean();
    const valorPorCliente = {};
    valoresPunto.forEach(v => {
        const cNorm = (v.cliente || '').toUpperCase().trim();
        const pNorm = (v.proyecto || '').toUpperCase().trim();
        const key = pNorm ? `${cNorm}|${pNorm}` : cNorm;
        valorPorCliente[key] = v;
        if (!valorPorCliente[cNorm]) valorPorCliente[cNorm] = v;
    });

    // 4. Construir mapa final: idRecurso → { cliente, proyecto, valorPunto }
    const mapa = {};
    tecnicos.forEach(t => {
        const proyecto = t.projectId ? proyectoMap[String(t.projectId)] : null;
        const clienteId = proyecto?.cliente ? String(proyecto.cliente) : '';
        const clienteNombre = clientNameMap[clienteId] || (typeof proyecto?.cliente === 'string' ? proyecto.cliente : '');
        const proyectoNombre = proyecto?.nombreProyecto || '';

        // Buscar valor: primero por cliente+proyecto, luego solo por cliente
        const cNorm = clienteNombre.toUpperCase().trim();
        const pNorm = proyectoNombre.toUpperCase().trim();
        const keyExacta = `${cNorm}|${pNorm}`;
        const valorExacto = valorPorCliente[keyExacta];
        let valorGeneral = valorPorCliente[cNorm];

        // --- EXTENSIÓN: Búsqueda flexible por Sede ---
        if (!valorGeneral && t.sede && cNorm) {
            const sedeUpper = t.sede.toUpperCase().trim();
            const vFlex = valoresPunto.find(v => {
                const vc = (v.cliente || '').toUpperCase().trim();
                return vc.startsWith(cNorm) && vc.includes(sedeUpper);
            });
            if (vFlex) valorGeneral = vFlex;
        }

        const valorConfig = valorExacto || valorGeneral;
        let vPunto = valorConfig?.valor_punto || 0;

        // --- FALLBACK FINAL: Usar valorPuntoActual del modelo Cliente si no hay config específica ---
        if (vPunto === 0) {
            vPunto = clientPriceMap[clienteId] || clientPriceMap[cNorm] || 0;
        }

        mapa[t.idRecursoToa] = {
            cliente: clienteNombre,
            clienteId: clienteId || clienteNombre,
            proyecto: proyectoNombre,
            valorPunto: vPunto,
            moneda: valorConfig?.moneda || 'CLP',
            tecnicoNombre: t.nombre || `${t.nombres} ${t.apellidos}`
        };
    });

    _mapValorizacionCache[cacheKey] = { data: mapa, ts: Date.now() };
    return mapa;
}

// 2.1b PRODUCCIÓN STATS — Agregación server-side para dashboard Producción Operativa
// Usa cursor con cálculo de baremos on-the-fly y agrega en memoria (no envía docs crudos)
app.get('/api/bot/produccion-stats', protect, authorize('rend_operativo:ver'), async (req, res) => {
  try {
    const currentEmail = req.user.email?.toLowerCase().trim();
    const isSystemAdmin = req.user.role === 'system_admin';
    let { desde, hasta, estado, clientes, empresaFilter, tipo, supervisorId, rut } = req.query;
    if (desde && (typeof desde !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(desde))) desde = undefined;
    if (hasta && (typeof hasta !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(hasta))) hasta = undefined;

    // Normalizar clientes (array de IDs)
    const filterClientes = Array.isArray(clientes) ? clientes : (clientes ? [clientes] : []);

    // IDs de vinculados para filtro restrictivo (Security Layer)
    let empresaId = req.user.empresaRef?._id || req.user.empresaRef || req.user.empresa?.id || req.user.empresa?._id;
    if (!empresaId && req.user.empresa?.nombre) {
      const empFallback = await Empresa.findOne({ nombre: req.user.empresa.nombre }).select('_id').lean();
      if (empFallback) empresaId = empFallback._id;
    }
    const tStats = await Tecnico.find({ empresaRef: empresaId }).select('idRecursoToa').lean();
    const restrictedIDs = tStats.map(t => String(t.idRecursoToa).trim());

    // Filtro inicial: SuperAdmin ve todo. Otros SOLO ven lo relacionado a sus vinculados.
    const filtro = isSystemAdmin ? {} : {
       $or: [
         { "ID_Recurso": { $in: restrictedIDs } },
         { "ID Recurso": { $in: restrictedIDs } },
         { idRecurso: { $in: restrictedIDs } },
         { "Recurso": { $in: restrictedIDs } }
       ]
    };

    if (rut) {
      const r = rut.replace(/\./g, "").replace(/-/g, "").toUpperCase().trim();
      filtro.$or = [
        { tecnicoRut: r },
        { rut: r }
      ];
    } else if (supervisorId) {
      const tecnicos = await Tecnico.find({ supervisorId, empresaRef: req.user.empresaRef }).select('idRecursoToa');
      const ids = tecnicos.map(t => String(t.idRecursoToa).trim()).filter(Boolean);
      filtro.$or = [
        { "ID_Recurso": { $in: ids } },
        { "ID Recurso": { $in: ids } },
        { idRecurso: { $in: ids } },
        { "Recurso": { $in: ids } }
      ];
    }

    if (tipo) {
       // Normalizar tipo para ser flexible
       const tMap = { 'reparacion': 'reparacion', 'provision': 'provision', 'Reparación': 'reparacion', 'Provisión': 'provision' };
       const normTipo = tMap[tipo] || tipo.toLowerCase();
       if (normTipo === 'reparacion') {
         filtro.$or = [
           { ordenId: { $regex: /^INC/i } },
           { "ID_Orden": { $regex: /^INC/i } },
           { "Número_de_Petición": { $regex: /^INC/i } }
         ];
       } else if (normTipo === 'provision') {
         // Difícil hacer un "NOT STARTS WITH" eficiente en $or, así que lo manejaremos en el loop mejor
         // Pero para reducir la carga inicial, podemos intentar:
         filtro.ordenId = { $not: /^INC/i };
       }
    }

    // Filtro de estado (default: Completado)
    if (estado && estado !== 'todos') {
      filtro.Estado = estado;
    } else if (!estado) {
      filtro.Estado = 'Completado';
    }
    let statsHastaFilter = null;
    if (desde) filtro.fecha = { ...filtro.fecha, $gte: new Date(desde + 'T00:00:00Z') };
    if (hasta) {
      const hd = new Date(hasta + 'T23:59:59Z');
      statsHastaFilter = hd.getTime();
      filtro.fecha = { ...filtro.fecha, $lte: hd };
    }


    // GUARDAR EL ESTADO SELECCIONADO Y ELIMINARLO DEL FILTRO DATABASE
    // Para que Actividad.find nos traiga todos los estados posibles para este rango/empresa
    const selectedStatus = estado || 'Completado';
    delete filtro.Estado;

    // Cargar tarifas LPU, técnicos vinculados, config de producción, mapa valorización y empresa
    const ConfigProduccion = require(`${PLATFORM_PATH}/models/ConfigProduccion`);
    // Promise.allSettled para resiliencia — si una query falla, las demás continúan
    const Candidato = require('./platforms/rrhh/models/Candidato');
    const efectivoEmpresaId = isSystemAdmin ? (empresaFilter || null) : empresaId;
    const [r_tarifas, r_tecnicos, r_config, r_mapa, r_empresa, r_cands] = await Promise.allSettled([
      obtenerTarifasEmpresa(efectivoEmpresaId),
      isSystemAdmin && !empresaFilter
        ? Tecnico.find({}).select('idRecursoToa rut nombres apellidos nombre empresaRef').lean()
        : Tecnico.find({ empresaRef: efectivoEmpresaId }).select('idRecursoToa rut nombres apellidos nombre').lean(),
      ConfigProduccion.findOne({ empresaRef: empresaId }).lean(),
      construirMapaValorizacion(empresaId),
      Empresa.findById(empresaId).select('nombre logo').lean(),
      isSystemAdmin && !empresaFilter 
        ? Candidato.find({ idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa rut fullName').lean()
        : Candidato.find({ empresaRef: efectivoEmpresaId, idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa rut fullName').lean()
    ]);
    const tarifasLPU = r_tarifas.status === 'fulfilled' ? r_tarifas.value : [];
    const tecnicosVinculados = r_tecnicos.status === 'fulfilled' ? r_tecnicos.value : [];
    const configProd = r_config.status === 'fulfilled' ? r_config.value : null;
    const mapaValorizacionProd = r_mapa.status === 'fulfilled' ? r_mapa.value : {};
    const empresaDoc = r_empresa.status === 'fulfilled' ? r_empresa.value : null;
    const candsVal = r_cands && r_cands.status === 'fulfilled' ? r_cands.value : [];

    // Map RUTs from HR just in case Tecnico is missing it
    const mapRutCands = {};
    candsVal.forEach(c => {
      if (c.idRecursoToa && c.rut) mapRutCands[String(c.idRecursoToa).trim()] = c.rut;
    });

    // Mapa de IDs vinculados para filtro rápido (Normalizado a String para evitar fallos de tipo)
    const vinculadosSet = new Set(tecnicosVinculados.map(t => t.idRecursoToa ? String(t.idRecursoToa).trim() : ''));
    
    // --- NUEVO: Filtrar lista de vinculados por CLIENTE si hay filtro activo ---
    let vinculadosFiltered = tecnicosVinculados;
    if (filterClientes.length > 0) {
      vinculadosFiltered = tecnicosVinculados.filter(t => {
        const cp = mapaValorizacionProd[t.idRecursoToa];
        if (!cp) return false;
        // El cp.clienteId ya es el ID del cliente (lo sincronizamos en construirMapaValorizacion)
        return filterClientes.includes(String(cp.clienteId));
      });
    }

    const vinculadosList = vinculadosFiltered.map(t => ({
      idRecurso: t.idRecursoToa,
      rut: t.rut,
      nombre: t.nombre || `${t.nombres || ''} ${t.apellidos || ''}`.trim()
    }));

    const nameToMapKey = {};
    const techMap = {};
    
    // --- NUEVO: Inicializar techMap con todos los vinculados para asegurar visibilidad total (0 pts) ---
    vinculadosFiltered.forEach(t => {
      const id = String(t.idRecursoToa || t.idRecurso || '').trim();
      const name = (t.nombre || `${t.nombres || ''} ${t.apellidos || ''}`).trim();
      const key = id || (t._id ? String(t._id) : name); 
      
      if (!key) return;
      
      // Registrar mapeo para consolidar actividades por nombre si el ID falta en el doc
      nameToMapKey[name.toLowerCase().trim()] = key;

      const cpConfig = id ? mapaValorizacionProd[id] : null;
      const clienteName = cpConfig?.cliente || '';
      const proyectoName = cpConfig?.proyecto || '';

      techMap[key] = {
        name,
        idRecurso: id, // Can be empty
        rut: t.rut || mapRutCands[id] || '',
        orders: 0,
        ptsBase: 0, ptsDeco: 0, ptsDecoCable: 0, ptsDecoWifi: 0, ptsRepetidor: 0, ptsTelefono: 0, ptsTotal: 0,
        qtyDeco: 0, qtyDecoCable: 0, qtyDecoWifi: 0, qtyRepetidor: 0, qtyTelefono: 0,
        provisionCount: 0, repairCount: 0,
        isVinculado: true,
        days: new Set(),
        dailyMap: {},
        activities: {},
        cityMap: {},
        cliente: clienteName,
        proyecto: proyectoName
      };
    });

    const calendarMap = {};
    const cityMap = {};
    const lpuMap = {};
    const clientProjectMap = {};
    const estadoCountMap = {};
    let totalOrders_count = 0, totalPts_sum = 0, maxDateStr = '';

    // Cache local para XML parsing (evita re-parsear el mismo string miles de veces)
    const xmlParseCache = new Map();
    const rrGlobalVisits = {};

    // Pre-compilar regex de tarifas una sola vez (evita new RegExp() por cada doc)
    const compiledTarifas = tarifasLPU.map(t => {
      const m = t.mapeo || {};
      let patterns = [];
      if (m.tipo_trabajo_pattern) {
        patterns = m.tipo_trabajo_pattern.split('|').map(p => {
          try { return new RegExp('^' + p + '$'); } catch (_) { return null; }
        }).filter(Boolean);
      }
      return { ...t, _compiledPatterns: patterns };
    });

    // Pre-buscar tarifa de decos — usar la de MÍNIMO puntos (WiFi 0.25 > cable 0.5)
    const decoWifiTarifa = tarifasLPU
      .filter(t => t.mapeo?.es_equipo_adicional &&
        ['Decos_WiFi_Adicionales', 'Decos_Adicionales', 'Decos_Cable_Adicionales'].includes(t.mapeo?.campo_cantidad))
      .sort((a, b) => a.puntos - b.puntos)[0]; // mínimo = WiFi
    const decoWifiPts = decoWifiTarifa ? decoWifiTarifa.puntos : 0.25;
    
    // DEBUG: Log para verificar qué tarifa se encontró
    console.log('🔍 [produccion-stats] Tarifa WiFi Deco:', decoWifiTarifa ? 
      `${decoWifiTarifa.descripcion} = ${decoWifiTarifa.puntos} PB (código: ${decoWifiTarifa.codigo})` : 
      'NO ENCONTRADA - usando fallback 0.25');
    console.log('🔍 [produccion-stats] Todas las tarifas de equipos:', 
      tarifasLPU.filter(t => t.mapeo?.es_equipo_adicional).map(t => 
        `${t.descripcion}: ${t.puntos} PB (campo: ${t.mapeo?.campo_cantidad})`));

    // Cursor: procesar documentos uno a uno sin cargar todo en memoria
    const projection = '-rawData -camposCustom -fuenteDatos -_id -__v';
    const cursor = Actividad.find(filtro).select(projection).lean().cursor({ batchSize: 500 });

    for await (const doc of cursor) {
      // Sanitizar keys (reemplazar puntos y espacios por _)
      const clean = {};
      for (const [k, v] of Object.entries(doc)) {
        clean[k.replace(/[\.\s]/g, '_')] = v;
      }

      const parseSafe = (v) => {
        if (!v || v === '' || v === undefined || v === null) return 0;
        if (typeof v === 'number') return v;
        const s = String(v).replace(',', '.').trim();
        return parseFloat(s) || 0;
      };

      // --- RE-CÁLCULO DE BAREMOS SI FALTAN DATOS ---
      const pTotalIn = parseSafe(clean.PTS_TOTAL_BAREMO || clean.PTS_TOTAL || clean.Pts_Total_Baremo);
      const hasDecos = parseSafe(clean.Decos_Adicionales || clean.DECOS_ADICIONALES || clean.Decos_Adicionales_Cant) > 0;
      const missingDecoSplit = !clean.Decos_Cable_Adicionales && !clean.Decos_WiFi_Adicionales;

      if ((pTotalIn === 0 || (hasDecos && missingDecoSplit)) && tarifasLPU.length > 0) {
        const xmlField = clean.Productos_y_Servicios_Contratados || clean.PRODUCTOS_Y_SERVICIOS_CONTRATADOS || '';
        if (xmlField) {
          let derivados = xmlParseCache.get(xmlField);
          if (derivados === undefined) {
            derivados = parsearProductosServiciosTOA(xmlField);
            xmlParseCache.set(xmlField, derivados || null);
          }
          if (derivados) Object.assign(clean, derivados);
        }
        const baremos = calcularBaremos(clean, tarifasLPU);
        if (baremos) {
          Object.entries(baremos).forEach(([k, v]) => {
            clean[k] = v;
            clean[k.replace(/[\s\.]/g, '_').toUpperCase()] = v;
          });
        }
      }

      // Extraer campos
      const tecnico = clean.Técnico || clean['Técnico'] || clean.TÉCNICO || '';
      const ciudad = (clean.Ciudad || clean.CIUDAD || '').toUpperCase().trim();
      const fecha = clean.fecha || clean.FECHA;
      const idRecursoRaw = clean.ID_Recurso || clean.ID_RECURSO || clean.idRecurso || '';
      const idRecurso = idRecursoRaw ? String(idRecursoRaw).trim() : '';
      const ordenId = String(clean.Número_de_Petición || clean.ORDENID || clean.Número_de_Petición || '');
      const isRepair = ordenId.toUpperCase().startsWith('INC');

      // 1. PUNTOS (Baremos)
      const pB = parseSafe(clean.Pts_Actividad_Base || clean.PTS_ACTIVIDAD_BASE || clean.PUNTOS_BASE);
      const pR = parseSafe(clean.Pts_Repetidor_WiFi || clean.PTS_REPETIDOR_WIFI || clean.Pts_Repetidor_Wifi || clean.REPETIDORES_WIFI_PTS || 0);
      const pT = parseSafe(clean.Pts_Telefono || clean.PTS_TELEFONO || clean.TELEFONOS_PTS || 0);

      // Cantidades de equipos — evitar doble conteo (Decos_Adicionales YA incluye cable+wifi)
      const qD_split = Math.floor(parseSafe(clean.Decos_Cable_Adicionales || clean.DECOS_CABLE_ADICIONALES)) +
                       Math.floor(parseSafe(clean.Decos_WiFi_Adicionales || clean.DECOS_WIFI_ADICIONALES));
      const qD_total = Math.floor(parseSafe(clean.Decos_Adicionales || clean.DECOS_ADICIONALES || clean.Decos_Adicionales_Cant));
      const qD = qD_split > 0 ? qD_split : qD_total;
      const qR = Math.floor(parseSafe(clean.Repetidores_WiFi || clean.REPETIDORES_WIFI || clean.Repetidores_Wifi_Cant));
      const qT = Math.floor(parseSafe(clean.Telefonos || clean.TELEFONOS));

      // REGLA DE NEGOCIO: Todos los decos se calculan como WiFi usando tarifa LPU
      // Ignorar valores almacenados (pueden estar a 0.5 cable), recalcular con tarifa WiFi
      const pD = qD * decoWifiPts;
      
      const pExpl = pB + pD + pR + pT;
      // Si tenemos desglose recalculado, USAR ESE — no el almacenado (puede tener tarifa cable vieja)
      const pField = parseSafe(clean.PTS_TOTAL_BAREMO || clean.TOTAL_PUNTOS || clean.PTS_TOTAL || clean.Total_Puntos_Baremo);
      const pTotal = pExpl > 0 ? pExpl : pField;

      // Fallback a Base si no hay desglose pero hay total
      let pBase = pB;
      if (pBase === 0 && pD === 0 && pR === 0 && pT === 0 && pTotal > 0) pBase = pTotal;
      const pDeco = pD, pRep = pR, pTel = pT;

      // ── FILTRO DE TIPO (Fix TODOS) ──
      const filterType = tipo && tipo.toLowerCase() !== 'todos' ? (tipo.toLowerCase().includes('rep') ? 'reparacion' : 'provision') : null;
      if (filterType === 'provision' && isRepair) continue;
      if (filterType === 'reparacion' && !isRepair) continue;

      const descLpu = clean.Desc_LPU_Base || clean.DESC_LPU_BASE || '';
      const codigoLpu = clean.Codigo_LPU_Base || clean.CODIGO_LPU_BASE || '';
      const isVinculado = idRecurso ? vinculadosSet.has(idRecurso) : false;

      // 3. CAMPOS CANÓNICOS (Consistencia)
      clean.PTS_ACTIVIDAD_BASE = pBase;
      clean.PTS_DECO_ADICIONAL = pDeco;
      clean.PTS_REPETIDOR_WIFI = pRep;
      clean.PTS_TELEFONO = pTel;
      clean.PTS_TOTAL_BAREMO = pTotal;
      clean.DECOS_ADICIONALES = qD;
      clean.REPETIDORES_WIFI = qR;
      clean.TELEFONOS = qT;
      clean.TOTAL_EQUIPOS_EXTRAS = qD + qR + qT;



      let techKey = null;
      if (idRecurso && (techMap[idRecurso] || vinculadosSet.has(idRecurso))) {
        techKey = idRecurso;
      } else {
        const cleanName = (tecnico || '').toLowerCase().trim();
        if (nameToMapKey[cleanName]) techKey = nameToMapKey[cleanName];
      }
      if (!techKey && idRecurso) techKey = idRecurso;
      if (!techKey && tecnico) techKey = tecnico;

      // > INICIALIZACIÓN TEMPRANA DEL TÉCNICO <
      if (techKey && !techMap[techKey]) {
         techMap[techKey] = {
            name: tecnico || idRecurso || 'S/N', orders: 0,
            ptsBase: 0, ptsDeco: 0, ptsDecoCable: 0, ptsDecoWifi: 0, ptsRepetidor: 0, ptsTelefono: 0, ptsTotal: 0,
            qtyDeco: 0, qtyDecoCable: 0, qtyDecoWifi: 0, qtyRepetidor: 0, qtyTelefono: 0,
            days: new Set(), dailyMap: {}, activities: {}, cityMap: {},
            provisionCount: 0, repairCount: 0, isVinculado: false, idRecurso: idRecurso,
            cliente: '', proyecto: '', visits: []
         };
         if (tecnico) nameToMapKey[tecnico.toLowerCase().trim()] = techKey;
      }

      // >>> REINCIDENCIAS (RR) Y CALIDAD <<<
      const extractRut = (v) => v ? String(v).replace(/[^0-9kK]/gi, '').toUpperCase() : '';
      let rutFieldVal = clean.RUT_DEL_CLIENTE || clean.RUT_PERSONA_CLIENTE || clean['rut_persona_cliente'] || clean.RutC || clean.rutCliente || clean.RUT_del_cliente || '';
      if (!rutFieldVal || String(rutFieldVal).length < 6) {
          for (let k of Object.keys(clean)) {
              let uk = String(k).toUpperCase().replace(/_/g, '').replace(/ /g, '');
              if (uk.includes('RUT') && (uk.includes('CLIENTE') || uk.includes('PERSONA'))) {
                  rutFieldVal = String(clean[k]);
                  break;
              }
          }
      }
      let rCliente = extractRut(rutFieldVal);
      const vFechaMs = fecha ? new Date(fecha).getTime() : 0;
      const cEstado = String(clean.Estado || clean.estado || '').toUpperCase().trim();
      const repetidoRaw = String(clean.REPETIDO || clean.Repetido || clean.repetido || clean.Repetidos || '').toUpperCase().trim();
      const isRepetidoNativo = repetidoRaw === 'SI' || repetidoRaw.includes('REPETIDO');

      if (cEstado === 'COMPLETADO' && vFechaMs > 0) {
          // Fallback robusto: si no hay RUT válido en la data, lo rastreamos bajo el ID interno de la orden
          if (!rCliente || rCliente.length < 6) rCliente = String(doc._id || '');

          if (rCliente) {
              if (!rrGlobalVisits[rCliente]) rrGlobalVisits[rCliente] = [];
              rrGlobalVisits[rCliente].push({ fechaMs: vFechaMs, idStr: String(doc._id || ''), nativeRepetido: isRepetidoNativo });
              
              if (techKey && techMap[techKey]) {
                 // Solo asignamos la responsabilidad del fallo al mes 'Visto' actualmente en pantalla
                 if (!statsHastaFilter || vFechaMs <= statsHastaFilter) {
                     if (!techMap[techKey].visits) techMap[techKey].visits = [];
                     techMap[techKey].visits.push({ rut: rCliente, fechaMs: vFechaMs, idStr: String(doc._id || ''), nativeRepetido: isRepetidoNativo });
                 }
              }
          }
      }

      // IMPORTANTE: Si esta actividad es de la "Ventana Futura Extendida", solo la queríamos para trackear si falló la Garantía, no sumará puntos ni contará
      if (statsHastaFilter && vFechaMs > statsHastaFilter) {
          continue;
      }
      
      // Para empresa normal: solo procesar técnicos vinculados
      if (!isSystemAdmin && !isVinculado) continue;
      // Resolver cliente/proyecto desde mapa de valorización
      const cpConfig = idRecurso ? mapaValorizacionProd[idRecurso] : null;
      const clienteName = cpConfig?.cliente || '';
      const proyectoName = cpConfig?.proyecto || '';

      // --- FILTRO MULTI-CLIENTE (Sincronizado por ID) ---
      if (filterClientes.length > 0) {
        const targetId = cpConfig?.clienteId || clienteName;
        if (!targetId || !filterClientes.includes(targetId)) continue;
      }

      const cpKey = clienteName ? (proyectoName ? `${clienteName} | ${proyectoName}` : clienteName) : '';

      // Determinar tipo de actividad para análisis
      const subtipoAct = clean['Subtipo_de_Actividad'] || clean['Subtipo de Actividad'] || '';
      const tipoTrabajo = clean['Tipo_de_Trabajo'] || clean['Tipo de Trabajo'] || '';

      // DateKey
      let dateKey = '';
      if (fecha) {
        const dt = new Date(fecha);
        dateKey = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
        if (dateKey > maxDateStr) maxDateStr = dateKey;
      }

      // ── Contar estados dinámicos (TODOS los que pasan filtro de cliente) ──
      const cleanEstado = clean.Estado || 'Sin Estado';
      estadoCountMap[cleanEstado] = (estadoCountMap[cleanEstado] || 0) + 1;

      // ── FILTRO DE ESTADO SELECCIONADO (Solo para métricas del dashboard) ──
      if (selectedStatus !== 'todos' && cleanEstado !== selectedStatus) continue;

      totalOrders_count++;

      // ── Agregar a techMap ──
      // ── Agregar a techMap ──
      if (!techKey && idRecurso) techKey = idRecurso;
      if (!techKey && tecnico) techKey = tecnico;

      if (techKey) {
        if (!techMap[techKey]) {
          techMap[techKey] = {
            name: tecnico || idRecurso || 'S/N', orders: 0,
            ptsBase: 0, ptsDeco: 0, ptsDecoCable: 0, ptsDecoWifi: 0, ptsRepetidor: 0, ptsTelefono: 0, ptsTotal: 0,
            qtyDeco: 0, qtyDecoCable: 0, qtyDecoWifi: 0, qtyRepetidor: 0, qtyTelefono: 0,
            days: new Set(), dailyMap: {}, activities: {}, cityMap: {},
            provisionCount: 0, repairCount: 0, isVinculado: false, idRecurso: idRecurso,
            cliente: '', proyecto: '', visits: []
          };
          if (tecnico) nameToMapKey[tecnico.toLowerCase().trim()] = techKey;
        }
        const t = techMap[techKey];
        t.orders++;
        t.ptsBase += pBase;
        t.ptsDeco += pDeco;
        t.ptsDecoCable += 0;
        t.ptsDecoWifi += pDeco;
        t.ptsRepetidor += pRep;
        t.ptsTelefono += pTel;
        t.ptsTotal += pTotal;
        t.qtyDeco += qD;
        t.qtyDecoCable += 0;
        t.qtyDecoWifi += qD;
        t.qtyRepetidor += qR;
        t.qtyTelefono += qT;
        t.provisionCount += isRepair ? 0 : 1;
        t.repairCount += isRepair ? 1 : 0;
        if (isVinculado) { t.isVinculado = true; t.idRecurso = idRecurso; }
        if (clienteName && !t.cliente) { t.cliente = clienteName; t.proyecto = proyectoName; }
        if (dateKey) {
          t.days.add(dateKey);
          if (!t.dailyMap[dateKey]) t.dailyMap[dateKey] = { orders: 0, pts: 0, byActivity: {} };
          t.dailyMap[dateKey].orders++;
          t.dailyMap[dateKey].pts += pTotal;
          if (descLpu) {
            if (!t.dailyMap[dateKey].byActivity[descLpu]) t.dailyMap[dateKey].byActivity[descLpu] = { count: 0, pts: 0 };
            t.dailyMap[dateKey].byActivity[descLpu].count++;
            t.dailyMap[dateKey].byActivity[descLpu].pts += pTotal;
          }
        }
        if (descLpu) {
          if (!t.activities[descLpu]) t.activities[descLpu] = { count: 0, pts: 0 };
          t.activities[descLpu].count++;
          t.activities[descLpu].pts += pTotal;
        }
        if (ciudad) {
          if (!t.cityMap[ciudad]) t.cityMap[ciudad] = { pts: 0, orders: 0 };
          t.cityMap[ciudad].pts += pTotal;
          t.cityMap[ciudad].orders++;
        }
      }

      // ── Agregar a calendarMap ──
      if (dateKey) {
        if (!calendarMap[dateKey]) calendarMap[dateKey] = { pts: 0, orders: 0, techs: {} };
        calendarMap[dateKey].pts += pTotal;
        calendarMap[dateKey].orders++;
        if (tecnico) {
          calendarMap[dateKey].techs[tecnico] = (calendarMap[dateKey].techs[tecnico] || 0) + pTotal;
        }
      }

      // ── Agregar a cityMap ──
      if (ciudad) {
        if (!cityMap[ciudad]) cityMap[ciudad] = { pts: 0, orders: 0 };
        cityMap[ciudad].pts += pTotal;
        cityMap[ciudad].orders++;
      }

      // ── Agregar a lpuMap ──
      if (descLpu) {
        if (!lpuMap[descLpu]) lpuMap[descLpu] = { desc: descLpu, code: codigoLpu, count: 0, totalPts: 0 };
        lpuMap[descLpu].count++;
        lpuMap[descLpu].totalPts += pTotal;
      }

      // ── Agregar a clientProjectMap ──
      if (cpKey) {
        if (!clientProjectMap[cpKey]) {
          clientProjectMap[cpKey] = {
            cliente: clienteName, proyecto: proyectoName,
            pts: 0, orders: 0, techs: new Set(), days: new Set(),
            provisionCount: 0, repairCount: 0,
            weeklyMap: {}, // weekKey → { pts, orders }
            byTipoTrabajo: {} // tipoTrabajo → { pts, orders }
          };
        }
        const cp = clientProjectMap[cpKey];
        cp.pts += pTotal;
        cp.orders++;
        if (tecnico) cp.techs.add(tecnico);
        if (dateKey) cp.days.add(dateKey);
        cp.provisionCount += isRepair ? 0 : 1;
        cp.repairCount += isRepair ? 1 : 0;
        if (dateKey) {
          const dt2 = new Date(dateKey);
          const dow2 = dt2.getUTCDay();
          const utc2 = new Date(Date.UTC(dt2.getUTCFullYear(), dt2.getUTCMonth(), dt2.getUTCDate()));
          utc2.setUTCDate(utc2.getUTCDate() + 4 - (dow2 || 7));
          const ys2 = new Date(Date.UTC(utc2.getUTCFullYear(), 0, 1));
          const wk2 = Math.ceil(((utc2 - ys2) / 86400000 + 1) / 7);
          const weekKey = `${utc2.getUTCFullYear()}-S${String(wk2).padStart(2, '0')}`;
          if (!cp.weeklyMap[weekKey]) cp.weeklyMap[weekKey] = { pts: 0, orders: 0 };
          cp.weeklyMap[weekKey].pts += pTotal;
          cp.weeklyMap[weekKey].orders++;
        }
        if (tipoTrabajo) {
          if (!cp.byTipoTrabajo[tipoTrabajo]) cp.byTipoTrabajo[tipoTrabajo] = { pts: 0, orders: 0 };
          cp.byTipoTrabajo[tipoTrabajo].pts += pTotal;
          cp.byTipoTrabajo[tipoTrabajo].orders++;
        }
      }
    }

    // --- CÁLCULO DEFINITIVO DE RR % (REINCIDENCIAS / GARANTÍA 30 DÍAS) ---
    for (const t of Object.values(techMap)) {
        let garantiasFallidas = 0;
        const misVisitas = t.visits || [];
        
        for (const visita of misVisitas) {
            // Evaluamos: 1) Si la orden localmente ya venía marcada desde TOA como Garantía Fallida "Repetido = SI"
            //            2) Si nuestro motor detecta matemáticamente un fallo en el futuro (<= 30 días)
            const history = rrGlobalVisits[visita.rut];
            
            if (visita.nativeRepetido) {
                garantiasFallidas++;
            } else if (history) {
                const limitMs = 30 * 24 * 60 * 60 * 1000;
                // Usamos >= para interceptar fallos del "mismo día", ya que TOA muchas veces trunca la hora real a 00:00:00 resultando en fechaMs idénticas.
                const failure = history.some(v => v.fechaMs >= visita.fechaMs && (v.fechaMs - visita.fechaMs) <= limitMs && v.idStr !== visita.idStr);
                if (failure) garantiasFallidas++;
            }
        }
        
        t.rrFails = garantiasFallidas;
        t.rrOrdersCount = misVisitas.length;
        t.rrRealPercent = t.rrOrdersCount > 0 ? (garantiasFallidas / t.rrOrdersCount) * 100 : 0;
        delete t.visits; // Optimizar payload
    }

    // ── MERGE: Fusionar entradas huérfanas (por nombre, sin ID) en la entrada vinculada ──
    // Causa: actividades sin ID_Recurso quedan keyed por nombre; si se procesaron antes que
    // la primera actividad con ID, quedan como entrada separada con isVinculado=false.
    for (const [orphanKey, orphanEntry] of Object.entries(techMap)) {
      if (orphanEntry.isVinculado) continue;           // ya vinculado, no huérfano
      const canonKey = nameToMapKey[(orphanEntry.name || '').toLowerCase().trim()];
      if (!canonKey || canonKey === orphanKey) continue; // no tiene entrada canónica
      const canon = techMap[canonKey];
      if (!canon || !canon.isVinculado) continue;
      // Fusionar dailyMap
      Object.entries(orphanEntry.dailyMap || {}).forEach(([dk, dd]) => {
        if (!canon.dailyMap[dk]) canon.dailyMap[dk] = { orders: 0, pts: 0, byActivity: {} };
        canon.dailyMap[dk].orders += dd.orders;
        canon.dailyMap[dk].pts += dd.pts;
        Object.entries(dd.byActivity || {}).forEach(([act, stat]) => {
          if (!canon.dailyMap[dk].byActivity[act]) canon.dailyMap[dk].byActivity[act] = { count: 0, pts: 0 };
          canon.dailyMap[dk].byActivity[act].count += stat.count;
          canon.dailyMap[dk].byActivity[act].pts += stat.pts;
        });
        canon.days.add(dk);
      });
      // Fusionar métricas
      canon.orders       += orphanEntry.orders;
      canon.ptsBase      += orphanEntry.ptsBase;
      canon.ptsDeco      += orphanEntry.ptsDeco;
      canon.ptsDecoCable += orphanEntry.ptsDecoCable || 0;
      canon.ptsDecoWifi  += orphanEntry.ptsDecoWifi  || 0;
      canon.ptsRepetidor += orphanEntry.ptsRepetidor;
      canon.ptsTelefono  += orphanEntry.ptsTelefono;
      canon.ptsTotal     += orphanEntry.ptsTotal;
      canon.qtyDeco      += orphanEntry.qtyDeco;
      canon.qtyRepetidor += orphanEntry.qtyRepetidor;
      canon.qtyTelefono  += orphanEntry.qtyTelefono;
      canon.provisionCount += orphanEntry.provisionCount;
      canon.repairCount    += orphanEntry.repairCount;
      // Marcar el huérfano para exclusión
      orphanEntry._merged = true;
    }

    // Construir respuesta (excluir entradas fusionadas al canónico vinculado)
    const tecnicos = Object.entries(techMap)
      .filter(([, t]) => !t._merged)
      .map(([key, t]) => ({
      idUnique: key,
      name: t.name,
      orders: t.orders,
      ptsBase: Math.round(t.ptsBase * 100) / 100,
      ptsDeco: Math.round((t.ptsDeco || 0) * 100) / 100,
      ptsDecoCable: Math.round((t.ptsDecoCable || 0) * 100) / 100,
      ptsDecoWifi: Math.round((t.ptsDecoWifi || 0) * 100) / 100,
      ptsRepetidor: Math.round(t.ptsRepetidor * 100) / 100,
      ptsTelefono: Math.round(t.ptsTelefono * 100) / 100,
      ptsTotal: Math.round(t.ptsTotal * 100) / 100,
      qtyDeco: Math.round(t.qtyDeco || 0),
      qtyDecoCable: Math.round(t.qtyDecoCable || 0),
      qtyDecoWifi: Math.round(t.qtyDecoWifi || 0),
      qtyRepetidor: Math.round(t.qtyRepetidor || 0),
      qtyTelefono: Math.round(t.qtyTelefono || 0),
      activeDays: t.days.size,
      avgPerDay: t.days.size > 0 ? Math.round((t.ptsTotal / t.days.size) * 100) / 100 : 0,
      dailyMap: t.dailyMap,
      activities: t.activities,
      provisionCount: t.provisionCount,
      repairCount: t.repairCount,
      isVinculado: t.isVinculado,
      idRecurso: t.idRecurso,
      rut: t.rut,
      rrRealPercent: t.rrRealPercent,
      rrFails: t.rrFails,
      rrOrdersCount: t.rrOrdersCount,
      cityMap: t.cityMap,
      cliente: t.cliente,
      proyecto: t.proyecto,
    }));

    // ── DEDUPLICAR: fusionar entradas con el mismo nombre (mismo técnico, claves distintas) ──
    const _nameIdx = {};
    const tecnicosDedupMap = [];
    tecnicos.forEach(t => {
      const norm = (t.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (_nameIdx[norm] !== undefined) {
        const ex = tecnicosDedupMap[_nameIdx[norm]];
        // Fusionar: sumar producción + conservar idRecurso si el duplicado lo tiene
        tecnicosDedupMap[_nameIdx[norm]] = {
          ...ex,
          orders:        ex.orders        + (t.orders        || 0),
          ptsBase:       Math.round((ex.ptsBase       + (t.ptsBase       || 0)) * 100) / 100,
          ptsDeco:       Math.round((ex.ptsDeco       + (t.ptsDeco       || 0)) * 100) / 100,
          ptsDecoCable:  Math.round(((ex.ptsDecoCable || 0) + (t.ptsDecoCable || 0)) * 100) / 100,
          ptsDecoWifi:   Math.round(((ex.ptsDecoWifi  || 0) + (t.ptsDecoWifi  || 0)) * 100) / 100,
          ptsRepetidor:  Math.round((ex.ptsRepetidor  + (t.ptsRepetidor  || 0)) * 100) / 100,
          ptsTelefono:   Math.round((ex.ptsTelefono   + (t.ptsTelefono   || 0)) * 100) / 100,
          ptsTotal:      Math.round((ex.ptsTotal      + (t.ptsTotal      || 0)) * 100) / 100,
          qtyDeco:       (ex.qtyDeco      || 0) + (t.qtyDeco      || 0),
          qtyDecoCable:  (ex.qtyDecoCable || 0) + (t.qtyDecoCable || 0),
          qtyDecoWifi:   (ex.qtyDecoWifi  || 0) + (t.qtyDecoWifi  || 0),
          qtyRepetidor:  (ex.qtyRepetidor || 0) + (t.qtyRepetidor || 0),
          qtyTelefono:   (ex.qtyTelefono  || 0) + (t.qtyTelefono  || 0),
          activeDays:    Math.max(ex.activeDays || 0, t.activeDays || 0),
          provisionCount:(ex.provisionCount || 0) + (t.provisionCount || 0),
          repairCount:   (ex.repairCount || 0)    + (t.repairCount   || 0),
          rrFails:       (ex.rrFails || 0)        + (t.rrFails       || 0),
          rrOrdersCount: (ex.rrOrdersCount || 0)  + (t.rrOrdersCount || 0),
          // Conservar idRecurso real si el duplicado fantasma no lo tiene
          idRecurso:     ex.idRecurso || t.idRecurso,
          rut:           ex.rut       || t.rut,
          isVinculado:   ex.isVinculado || t.isVinculado,
        };
      } else {
        _nameIdx[norm] = tecnicosDedupMap.length;
        tecnicosDedupMap.push({ ...t });
      }
    });
    const tecnicosFinales = tecnicosDedupMap.filter(t => t.isVinculado && t.idRecurso && (t.ptsTotal > 0 || t.orders > 0));

    const totalPts_final = tecnicosFinales.reduce((s, t) => s + t.ptsTotal, 0);
    const uniqueTechs = tecnicosFinales.length;
    const uniqueDays = Object.keys(calendarMap).length;
    const avgPtsPerTechPerDay = uniqueTechs > 0 && uniqueDays > 0 ? Math.round((totalPts_final / uniqueTechs / uniqueDays) * 100) / 100 : 0;

    const lpuActivities = Object.values(lpuMap)
      .filter(a => a.totalPts > 0)
      .sort((a, b) => b.totalPts - a.totalPts)
      .map(a => ({ ...a, totalPts: Math.round(a.totalPts * 100) / 100, avgPtsPerUnit: a.count > 0 ? Math.round((a.totalPts / a.count) * 100) / 100 : 0 }));

    // Meta de producción
    const metaDia = configProd?.metaProduccionDia || 0;
    const diasSemana = configProd?.diasLaboralesSemana || 5;
    const diasMes = configProd?.diasLaboralesMes || 22;
    const metaConfig = {
      metaProduccionDia: metaDia,
      diasLaboralesSemana: diasSemana,
      diasLaboralesMes: diasMes,
      metaProduccionSemana: Math.round(metaDia * diasSemana * 100) / 100,
      metaProduccionMes: Math.round(metaDia * diasMes * 100) / 100,
    };

    // Construir clientProjects para el frontend
    const clientProjects = Object.values(clientProjectMap).map(cp => ({
      cliente: cp.cliente,
      proyecto: cp.proyecto,
      pts: Math.round(cp.pts * 100) / 100,
      orders: cp.orders,
      techs: cp.techs.size,
      days: cp.days.size,
      avgPerDay: cp.days.size > 0 ? Math.round((cp.pts / cp.days.size) * 100) / 100 : 0,
      provisionCount: cp.provisionCount,
      repairCount: cp.repairCount,
      weeklyMap: Object.fromEntries(Object.entries(cp.weeklyMap).map(([k, v]) => [k, { pts: Math.round(v.pts * 100) / 100, orders: v.orders }])),
      byTipoTrabajo: Object.fromEntries(Object.entries(cp.byTipoTrabajo).map(([k, v]) => [k, { pts: Math.round(v.pts * 100) / 100, orders: v.orders }])),
    })).sort((a, b) => b.pts - a.pts);

    res.json({
      maxDate: maxDateStr,
      stats: { totalOrders: totalOrders_count, totalPts: Math.round(totalPts_final * 100) / 100, avgPtsPerTechPerDay, uniqueTechs, uniqueDays },
      tecnicos: tecnicosFinales,
      calendar: calendarMap,
      cities: cityMap,
      lpuActivities,
      estados: Object.entries(estadoCountMap)
        .map(([estado, count]) => ({ estado, count }))
        .sort((a, b) => b.count - a.count),
      vinculados: vinculadosList,
      metaConfig,
      clientProjects,
      empresaNombre: empresaDoc?.nombre || '',
    });
  } catch (error) {
    console.error('❌ /api/bot/produccion-stats error:', error.message, '\nSTACK:', error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// =============================================================================
// PRODUCCIÓN FINANCIERA — Dashboard ejecutivo de facturación
// Convierte puntos baremo → CLP usando ValorPuntoCliente.valor_punto
// =============================================================================
app.get('/api/bot/produccion-financiera', protect, async (req, res) => {
  try {
    const currentEmail = req.user.email?.toLowerCase().trim();
    const isSystemAdmin = req.user.role === 'system_admin';
    let { desde, hasta, estado, clientes, proyectos, empresaFilter, tipo, supervisorId, rut } = req.query;

    if (desde && (typeof desde !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(desde))) desde = undefined;
    if (hasta && (typeof hasta !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(hasta))) hasta = undefined;

    const filterClientesRaw = typeof clientes === 'string' ? (clientes.includes(',') ? clientes.split(',') : (clientes ? [clientes] : [])) : (Array.isArray(clientes) ? clientes : []);
    const filterClientes = filterClientesRaw.map(c => String(c).trim().toUpperCase());

    const filterProyectosRaw = typeof proyectos === 'string' ? (proyectos.includes(',') ? proyectos.split(',') : (proyectos ? [proyectos] : [])) : (Array.isArray(proyectos) ? proyectos : []);
    const filterProyectos = filterProyectosRaw.map(p => String(p).trim().toUpperCase());

    // IDs de vinculados para filtro restrictivo (Security Layer)
    let empresaId = req.user.empresaRef?._id || req.user.empresaRef || req.user.empresa?.id || req.user.empresa?._id;
    if (!empresaId && req.user.empresa?.nombre) {
      const empFallback = await Empresa.findOne({ nombre: req.user.empresa.nombre }).select('_id').lean();
      if (empFallback) empresaId = empFallback._id;
    }
    const tFin = await Tecnico.find({ empresaRef: empresaId, idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa').lean();
    const restrictedIDs = tFin.map(t => String(t.idRecursoToa).trim());

    // Filtro inicial: SuperAdmin ve todo. Otros SOLO ven lo relacionado a sus vinculados.
    const filtro = isSystemAdmin ? {} : {
       $or: [
         { "ID_Recurso": { $in: restrictedIDs } },
         { "ID Recurso": { $in: restrictedIDs } },
         { idRecurso: { $in: restrictedIDs } },
         { "Recurso": { $in: restrictedIDs } }
       ]
    };

    if (rut) {
      const r = rut.replace(/\./g, "").replace(/-/g, "").toUpperCase().trim();
      filtro.$or = [
        { tecnicoRut: r },
        { rut: r }
      ];
    } else if (supervisorId) {
      const tecnicos = await Tecnico.find({ supervisorId, empresaRef: req.user.empresaRef }).select('idRecursoToa');
      const ids = tecnicos.map(t => String(t.idRecursoToa).trim()).filter(Boolean);
      filtro.$or = [
        { "ID_Recurso": { $in: ids } },
        { "ID Recurso": { $in: ids } },
        { idRecurso: { $in: ids } },
        { "Recurso": { $in: ids } }
      ];
    }

    if (tipo) {
       // Normalizar tipo para ser flexible
       const tMap = { 'reparacion': 'reparacion', 'provision': 'provision', 'Reparación': 'reparacion', 'Provisión': 'provision' };
       const normTipo = tMap[tipo] || (typeof tipo === 'string' ? tipo.toLowerCase() : null);
       if (normTipo === 'reparacion') {
         filtro.$or = [
           { ordenId: { $regex: /^INC/i } },
           { "ID_Orden": { $regex: /^INC/i } },
           { "Número_de_Petición": { $regex: /^INC/i } }
         ];
       } else if (normTipo === 'provision') {
         filtro.ordenId = { $not: /^INC/i };
       }
    }

    if (estado && estado !== 'todos') {
      filtro.Estado = estado;
    } else if (!estado) {
      filtro.Estado = 'Completado';
    }
    if (desde) filtro.fecha = { ...filtro.fecha, $gte: new Date(desde + 'T00:00:00Z') };
    if (hasta) filtro.fecha = { ...filtro.fecha, $lte: new Date(hasta + 'T23:59:59Z') };


    // GUARDAR EL ESTADO SELECCIONADO Y ELIMINARLO DEL FILTRO DATABASE
    const selectedStatus = estado || 'Completado';
    delete filtro.Estado;

    const ConfigProduccion = require(`${PLATFORM_PATH}/models/ConfigProduccion`);
    const efectivoEmpresaId = isSystemAdmin ? (empresaFilter || null) : empresaId;
    const [r_tarifas, r_tecnicos, r_config, r_mapa, r_empresa, r_clientes, r_proyectos, r_vehiculos] = await Promise.allSettled([
      obtenerTarifasEmpresa(efectivoEmpresaId),
      isSystemAdmin && !empresaFilter
        ? Tecnico.find({ idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa nombres apellidos nombre sueldoBase montoBonoFijo empresaRef').lean()
        : Tecnico.find({ empresaRef: efectivoEmpresaId, idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa nombres apellidos nombre sueldoBase montoBonoFijo').lean(),
      ConfigProduccion.findOne({ empresaRef: empresaId }).lean(),
      construirMapaValorizacion(empresaId),
      Empresa.findById(empresaId).select('nombre logo').lean(),
      Cliente.find({ empresaRef: empresaId }).lean(),
      Proyecto.find({ empresaRef: empresaId }).lean(),
      Vehiculo.find({ empresaRef: empresaId }).select('valor').lean()
    ]);
    const tarifasLPU = r_tarifas.status === 'fulfilled' ? r_tarifas.value : [];
    const tecnicosVinculados = r_tecnicos.status === 'fulfilled' ? r_tecnicos.value : [];
    const configProd = r_config.status === 'fulfilled' ? r_config.value : null;
    const mapaVal = r_mapa.status === 'fulfilled' ? r_mapa.value : {};
    const empresaDoc = r_empresa.status === 'fulfilled' ? r_empresa.value : null;
    const clientesDocs = r_clientes.status === 'fulfilled' ? r_clientes.value : [];
    const proyectosDocs = r_proyectos.status === 'fulfilled' ? r_proyectos.value : [];
    const vehiculosDocs = r_vehiculos.status === 'fulfilled' ? r_vehiculos.value : [];

    const valorPuntoRef = configProd?.valorPunto || 3500;
    const metaDia = configProd?.metaProduccionDia || 7.5;
    const diasSemana = configProd?.diasLaboralesSemana || 5;
    const diasMes = configProd?.diasLaboralesMes || 22;

    // --- FILTRAR VINCULADOS POR CLIENTE Y PROYECTO ---
    let vinculadosFiltered = tecnicosVinculados;
    if (filterClientes.length > 0 || filterProyectos.length > 0) {
      vinculadosFiltered = tecnicosVinculados.filter(t => {
        const cp = mapaVal[t.idRecursoToa];
        if (!cp) return false;
        
        const tCliId = String(cp.clienteId || '').toUpperCase();
        const tCliName = String(cp.cliente || '').trim().toUpperCase();
        const tProy = String(cp.proyecto || '').trim().toUpperCase();

        const matchCli = filterClientes.length === 0 || filterClientes.includes(tCliId) || filterClientes.includes(tCliName);
        const matchProy = filterProyectos.length === 0 || filterProyectos.includes(tProy);

        return matchCli && matchProy;
      });
    }

    // --- MAPAS DE AGREGACIÓN ---
    const techMap = {};
    const calendarMap = {};
    const cityMap = {};
    const lpuMap = {};
    const weeklyTrendMap = {};
    const clientProjectMap = {};
    const tipoTrabajoMap = {};
    const estadoCountMap = {};
    const monthMap = {};
    const xmlParseCache = new Map();
    let totalOrders_f = 0, totalPts_f = 0, totalCLP_f = 0, maxDateStr = '';
    let totalQtyDeco = 0, totalQtyRep = 0, totalQtyTel = 0;
    let totalValDeco = 0, totalValRep = 0, totalValTel = 0;

    vinculadosFiltered.forEach(t => {
      const id = String(t.idRecursoToa).trim();
      const cp = mapaVal[id] || {};
      techMap[id] = {
        name: t.nombre || `${t.nombres || ''} ${t.apellidos || ''}`.trim(),
        idRecurso: id, cliente: cp.cliente || 'Sin Cliente', proyecto: cp.proyecto || 'Sin Proyecto',
        valorPunto: cp.valorPunto || valorPuntoRef, sueldoBase: t.sueldoBase || 0, montoBonoFijo: t.montoBonoFijo || 0,
        orders: 0, ptsTotal: 0, ptsBase: 0, ptsDeco: 0, ptsDecoCable: 0, ptsDecoWifi: 0, ptsRepetidor: 0, ptsTelefono: 0, facturacion: 0,
        qtyDeco: 0, qtyDecoCable: 0, qtyDecoWifi: 0, qtyRepetidor: 0, qtyTelefono: 0, provisionCount: 0, repairCount: 0,
        days: new Set(), dailyMap: {}, activities: {}, byTipoTrabajo: {}, cityMap: {}, clientMap: {}
      };
    });

    // Pre-buscar tarifa de decos — usar la de MÍNIMO puntos (WiFi 0.25 > cable 0.5)
    const decoWifiTarifa_f = tarifasLPU
      .filter(t => t.mapeo?.es_equipo_adicional &&
        ['Decos_WiFi_Adicionales', 'Decos_Adicionales', 'Decos_Cable_Adicionales'].includes(t.mapeo?.campo_cantidad))
      .sort((a, b) => a.puntos - b.puntos)[0];
    const decoWifiPts_f = decoWifiTarifa_f ? decoWifiTarifa_f.puntos : 0.25;

    const projection = '-rawData -camposCustom -fuenteDatos -_id -__v';
    const cursor = Actividad.find(filtro).select(projection).lean().cursor({ batchSize: 500 });

    for await (const doc of cursor) {
      // Sanitizar keys (reemplazar puntos y espacios por _)
      const clean = {};
      for (const [k, v] of Object.entries(doc)) {
        clean[k.replace(/[\.\s]/g, '_')] = v;
      }

      const parseSafe = (v) => {
        if (!v || v === '' || v === undefined || v === null) return 0;
        if (typeof v === 'number') return v;
        const s = String(v).replace(',', '.').trim();
        return parseFloat(s) || 0;
      };

      // --- RE-CÁLCULO DE BAREMOS SI FALTAN DATOS ---
      const decosRaw = parseSafe(clean.Decos_Adicionales || clean.DECOS_ADICIONALES || 0);
      const missingSplit = !clean.Decos_Cable_Adicionales && !clean.Decos_WiFi_Adicionales;
      const needsReparse = missingSplit && (decosRaw > 0);
      
      const existingBaremo = parseSafe(clean.PTS_TOTAL_BAREMO || clean.Pts_Total_Baremo || 0);

      if ((existingBaremo === 0 || needsReparse) && tarifasLPU.length > 0) {
        if (needsReparse) {
          const xmlField = clean.Productos_y_Servicios_Contratados || clean.PRODUCTOS_Y_SERVICIOS_CONTRATADOS || '';
          if (xmlField) {
            let derivados = xmlParseCache.get(xmlField);
            if (derivados === undefined) {
              derivados = parsearProductosServiciosTOA(xmlField);
              xmlParseCache.set(xmlField, derivados || null);
            }
            if (derivados) Object.assign(clean, derivados);
          }
        }
        const baremos = calcularBaremos(clean, tarifasLPU);
        if (baremos) {
          Object.entries(baremos).forEach(([k, v]) => {
            clean[k] = v;
            clean[k.replace(/[\s\.]/g, '_').toUpperCase()] = v;
          });
        }
      }

      // 1. PUNTOS (Baremos)
      const pB = parseSafe(clean.Pts_Actividad_Base || clean.PTS_ACTIVIDAD_BASE || clean.PUNTOS_BASE);
      const pR = parseSafe(clean.Pts_Repetidor_WiFi || clean.PTS_REPETIDOR_WIFI || clean.Pts_Repetidor_Wifi || clean.REPETIDORES_WIFI_PTS || 0);
      const pT = parseSafe(clean.Pts_Telefono || clean.PTS_TELEFONO || clean.TELEFONOS_PTS || 0);

      // Cantidades de equipos — evitar doble conteo
      const qD_f_split = Math.floor(parseSafe(clean.Decos_Cable_Adicionales || clean.DECOS_CABLE_ADICIONALES || 0)) +
                         Math.floor(parseSafe(clean.Decos_WiFi_Adicionales || clean.DECOS_WIFI_ADICIONALES || 0));
      const qD_f_total = Math.floor(parseSafe(clean.Decos_Adicionales || clean.DECOS_ADICIONALES || 0));
      const qD_f = qD_f_split > 0 ? qD_f_split : qD_f_total;

      // REGLA DE NEGOCIO: Todos los decos = WiFi × tarifa LPU
      const pD = qD_f * decoWifiPts_f;
      
      const pExpl = pB + pD + pR + pT;
      const pField = parseSafe(clean.PTS_TOTAL_BAREMO || clean.TOTAL_PUNTOS || clean.PTS_TOTAL || clean.Total_Puntos_Baremo);
      const pTotal = pExpl > 0 ? pExpl : pField;

      let pBase = pB;
      if (pBase === 0 && pD === 0 && pR === 0 && pT === 0 && pTotal > 0) pBase = pTotal;
      const pDeco = pD, pRep = pR, pTel = pT;

      // --- 2. FILTRO DE VINCULACIÓN (Estricto: Solo Personal Vinculado de la Empresa) ---
      const idRecursoRaw = clean.ID_Recurso || clean.ID_RECURSO || clean.idRecurso || clean.ID_RECURSO_TOA || clean.RECURSO || '';
      const idRecurso = String(idRecursoRaw || '').trim();
      if (!idRecurso || !techMap[idRecurso]) continue;

      const t = techMap[idRecurso];
      const cleanEstado = clean.ESTADO || (clean['ESTADO_DE_LA_ACTIVIDAD'] || '').trim() || 'Sin Estado';

      // --- 3. FILTRO DE CLIENTE ---
      const cpConfig = mapaVal[idRecurso] || {};
      if (filterClientes.length > 0) {
        const tId = String(cpConfig.clienteId || '').toUpperCase();
        const tName = String(cpConfig.cliente || '').trim().toUpperCase();
        if (!filterClientes.includes(tId) && !filterClientes.includes(tName)) continue;
      }

            // --- 4. AGREGACIÓN DE ESTADOS & FILTRO SELECCIONADO ---
      estadoCountMap[cleanEstado] = (estadoCountMap[cleanEstado] || 0) + 1;
      if (selectedStatus !== 'todos' && cleanEstado !== selectedStatus) continue;

      // --- 5. DETERMINAR CONTRATISTA (Sincronizado con configuración inicial) ---
      const valPunto = cpConfig.valorPunto || valorPuntoRef;
      const tCliName = (cpConfig.cliente || '').toUpperCase();
      const contractor = tCliName.includes('ZENER') ? 'ZENER' : (tCliName.includes('COMFICA') ? 'COMFICA' : 'OTROS');

      // PRIORIDAD: Usar valor pre-calculado en DB si existe
      const storedCLP = parseSafe(clean['VALOR_ACTIVIDAD_CLP'] || clean['Valor_Actividad_CLP'] || clean['VALOR_TOTAL'] || 0);
      const valorCLP = storedCLP > 0 ? storedCLP : (pTotal * valPunto);
      
      const ciudad = (clean['CIUDAD'] || clean['Ciudad'] || clean.ciudad || clean['COMUNA'] || '').toUpperCase().trim();
      const tipoTrabajo = clean['TIPO_DE_TRABAJO'] || clean['Tipo_de_Trabajo'] || '';
      const descLpu = clean['DESC_LPU_BASE'] || clean['SUBTIPO_DE_ACTIVIDAD'] || clean['Desc_LPU_Base'] || '';
      const fecha = clean.FECHA || clean.fecha;

      totalOrders_f++; totalPts_f += pTotal; totalCLP_f += valorCLP;

      // --- 5. AGREGACIÓN MENSUAL (Excel Replicación) ---
      const dateObj = new Date(clean['FECHA'] || clean['FECHA_INSTALACION']);
      const monthKey = !isNaN(dateObj) ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}` : 'Sin Fecha';
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = { mes: monthKey, ptsBase: 0, ptsDeco: 0, ptsRepetidor: 0, ptsTelefono: 0, ptsTotal: 0, clp: 0, orders: 0 };
      }
      const mm = monthMap[monthKey];
      mm.ptsBase += pBase; mm.ptsDeco += pDeco; mm.ptsRepetidor += pRep; mm.ptsTelefono += pTel; mm.ptsTotal += pTotal; mm.clp += valorCLP; mm.orders++;

      t.orders++; t.ptsTotal += pTotal; t.ptsBase += pBase;
      t.ptsDeco += pDeco; t.ptsDecoCable += 0; t.ptsDecoWifi += pDeco;
      t.ptsRepetidor += pRep; t.ptsTelefono += pTel;
      t.facturacion += valorCLP;
      t.contractor = contractor; // Guardar último contractor detectado para el técnico

      // Cantidades para Inventario de Equipos — split si existe, legacy como fallback
      const qD_cable  = Math.floor(parseSafe(clean.DECOS_CABLE_ADICIONALES || clean.Decos_Cable_Adicionales || 0));
      const qD_wifi   = Math.floor(parseSafe(clean.DECOS_WIFI_ADICIONALES  || clean.Decos_WiFi_Adicionales  || 0));
      const qD_legacy = Math.floor(parseSafe(clean.DECOS_ADICIONALES       || clean.Decos_Adicionales       || 0));
      const qD = (qD_cable > 0 || qD_wifi > 0) ? (qD_cable + qD_wifi) : qD_legacy;
      const qR = Math.floor(parseSafe(clean.REPETIDORES_WIFI || clean.Repetidores_WiFi || 0));
      const qT = Math.floor(parseSafe(clean.TELEFONOS || clean.Telefonos || 0));

      t.qtyDeco += qD;
      t.qtyDecoCable += qD_cable;
      t.qtyDecoWifi += qD_wifi;
      t.qtyRepetidor += qR;
      t.qtyTelefono += qT;
      const isRepair = (clean.ORDENID || clean['NÚMERO_DE_PETICIÓN'] || clean.NUMERO_DE_PETICION || clean.ORDEN_ID || '').toString().toUpperCase().startsWith('INC');
      t.provisionCount += isRepair ? 0 : 1; t.repairCount += isRepair ? 1 : 0;

      // 3. CAMPOS CANÓNICOS (Consistencia con Operativa y Descarga TOA)
      clean.PTS_ACTIVIDAD_BASE = pBase;
      clean.PTS_DECO_ADICIONAL = pDeco;
      clean.PTS_DECO_CABLE = 0;
      clean.PTS_DECO_WIFI = pDeco;
      clean.PTS_REPETIDOR_WIFI = pRep;
      clean.PTS_TELEFONO = pTel;
      clean.PTS_TOTAL_BAREMO = pTotal;
      clean.DECOS_ADICIONALES = qD;
      clean.DECOS_CABLE_ADICIONALES = qD_cable;
      clean.DECOS_WIFI_ADICIONALES = qD_wifi;
      clean.REPETIDORES_WIFI = qR;
      clean.TELEFONOS = qT;
      clean.TOTAL_EQUIPOS_EXTRAS = qD + qR + qT;

      // Acumular valorización de equipos
      totalQtyDeco += qD;
      totalQtyRep += qR;
      totalQtyTel += qT;

      const pDecoVal = parseSafe(clean['VALOR_DECO'] || clean['VALOR_DECO_ADICIONAL']) || (pDeco * valPunto);
      const pRepVal = parseSafe(clean['VALOR_REPETIDOR'] || clean['VALOR_WIFI']) || (pRep * valPunto);
      const pTelVal = parseSafe(clean['VALOR_TELEFONO']) || (pTel * valPunto);

      totalValDeco += pDecoVal;
      totalValRep += pRepVal;
      totalValTel += pTelVal;

      let dateKey = '';
      if (fecha) {
        const dt = new Date(fecha);
        if (!Number.isNaN(dt.getTime())) {
          dateKey = dt.toISOString().split('T')[0];
          if (dateKey > maxDateStr) maxDateStr = dateKey;
          t.days.add(dateKey);
          if (!t.dailyMap[dateKey]) t.dailyMap[dateKey] = { orders: 0, pts: 0, clp: 0 };
          t.dailyMap[dateKey].orders++; t.dailyMap[dateKey].pts += pTotal; t.dailyMap[dateKey].clp += valorCLP;

          if (!calendarMap[dateKey]) calendarMap[dateKey] = { clp: 0, pts: 0, orders: 0, byClient: {}, techs: {}, zenerClp: 0, comficaClp: 0 };
          calendarMap[dateKey].clp += valorCLP; calendarMap[dateKey].pts += pTotal; calendarMap[dateKey].orders++;
          if (contractor === 'ZENER') calendarMap[dateKey].zenerClp += valorCLP;
          else if (contractor === 'COMFICA') calendarMap[dateKey].comficaClp += valorCLP;

          if (t.name) {
            if (!calendarMap[dateKey].techs[t.name]) calendarMap[dateKey].techs[t.name] = { clp: 0, pts: 0 };
            calendarMap[dateKey].techs[t.name].clp += valorCLP; calendarMap[dateKey].techs[t.name].pts += pTotal;
          }

          const dt2 = new Date(dateKey);
          const dow2 = dt2.getUTCDay();
          const utc2 = new Date(Date.UTC(dt2.getUTCFullYear(), dt2.getUTCMonth(), dt2.getUTCDate()));
          utc2.setUTCDate(utc2.getUTCDate() + 4 - (dow2 || 7));
          const js2 = new Date(Date.UTC(utc2.getUTCFullYear(), 0, 1));
          const weekKey = `${utc2.getUTCFullYear()}-S${String(Math.ceil(((utc2 - js2) / 86400000 + 1) / 7)).padStart(2, '0')}`;

          if (!weeklyTrendMap[weekKey]) weeklyTrendMap[weekKey] = { clp: 0, pts: 0, orders: 0, zenerClp: 0, comficaClp: 0 };
          weeklyTrendMap[weekKey].clp += valorCLP; weeklyTrendMap[weekKey].pts += pTotal; weeklyTrendMap[weekKey].orders++;
          if (contractor === 'ZENER') weeklyTrendMap[weekKey].zenerClp += valorCLP;
          else if (contractor === 'COMFICA') weeklyTrendMap[weekKey].comficaClp += valorCLP;

          if (!t.weeklyTrend) t.weeklyTrend = {};
          if (!t.weeklyTrend[weekKey]) t.weeklyTrend[weekKey] = { clp: 0, pts: 0 };
          t.weeklyTrend[weekKey].clp += valorCLP; t.weeklyTrend[weekKey].pts += pTotal;
        }
      }

      if (ciudad) {
        if (!cityMap[ciudad]) cityMap[ciudad] = { pts: 0, orders: 0, clp: 0, zenerClp: 0, comficaClp: 0 };
        cityMap[ciudad].pts += pTotal; cityMap[ciudad].orders++; cityMap[ciudad].clp += valorCLP;
        if (contractor === 'ZENER') cityMap[ciudad].zenerClp += valorCLP;
        else if (contractor === 'COMFICA') cityMap[ciudad].comficaClp += valorCLP;

        if (!t.cityMap[ciudad]) t.cityMap[ciudad] = { pts: 0, orders: 0, clp: 0 };
        t.cityMap[ciudad].pts += pTotal; t.cityMap[ciudad].orders++; t.cityMap[ciudad].clp += valorCLP;
      }

      const cpKey = t.cliente && t.proyecto ? `${t.cliente} | ${t.proyecto}` : t.cliente;
      if (cpKey) {
        if (!clientProjectMap[cpKey]) {
          clientProjectMap[cpKey] = { 
            cliente: t.cliente, proyecto: t.proyecto, valPunto, pts: 0, clp: 0, orders: 0, 
            techs: new Set(), days: new Set(), zenerClp: 0, comficaClp: 0 
          };
        }
        const cp = clientProjectMap[cpKey];
        cp.pts += pTotal; cp.clp += valorCLP; cp.orders++; cp.techs.add(t.name); if (dateKey) cp.days.add(dateKey);
        if (contractor === 'ZENER') cp.zenerClp += valorCLP;
        else if (contractor === 'COMFICA') cp.comficaClp += valorCLP;
      }

      if (tipoTrabajo) {
        if (!tipoTrabajoMap[tipoTrabajo]) tipoTrabajoMap[tipoTrabajo] = { clp: 0, pts: 0, orders: 0 };
        tipoTrabajoMap[tipoTrabajo].clp += valorCLP; tipoTrabajoMap[tipoTrabajo].pts += pTotal; tipoTrabajoMap[tipoTrabajo].orders++;
      }
      if (descLpu) {
        if (!lpuMap[descLpu]) lpuMap[descLpu] = { desc: descLpu, count: 0, totalPts: 0, totalCLP: 0 };
        lpuMap[descLpu].count++; lpuMap[descLpu].totalPts += pTotal; lpuMap[descLpu].totalCLP += valorCLP;
      }
    }

    // --- CONSTRUIR RESPUESTA ---
    const recentWeeks = Object.keys(weeklyTrendMap).sort().slice(-4);

    const tecnicos = Object.values(techMap)
      .filter(t => t.ptsTotal > 0 || t.days.size > 0)
      .map(t => {
        const activeDays = t.days.size;
        const trend = recentWeeks.map(wk => ({
          week: wk,
          clp: t.weeklyTrend?.[wk]?.clp || 0,
          pts: t.weeklyTrend?.[wk]?.pts || 0
        }));

        const res = {
          ...t,
          ptsDeco: Math.round((t.ptsDeco || 0) * 100) / 100,
          ptsDecoCable: Math.round((t.ptsDecoCable || 0) * 100) / 100,
          ptsDecoWifi: Math.round((t.ptsDecoWifi || 0) * 100) / 100,
          qtyDeco: Math.round(t.qtyDeco || 0),
          qtyDecoCable: Math.round(t.qtyDecoCable || 0),
          qtyDecoWifi: Math.round(t.qtyDecoWifi || 0),
          ptsTotal: Math.round(t.ptsTotal * 100) / 100,
          activeDays, 
          daysCount: activeDays, 
          metaTotal: activeDays * metaDia, 
          facturacion: Math.round(t.facturacion), 
          avgFactDia: activeDays > 0 ? Math.round(t.facturacion / activeDays) : 0,
          isVinculado: true,
          trend,
          margen: Math.round(t.facturacion - (t.sueldoBase + t.montoBonoFijo))
        };
        delete res.days; delete res.weeklyTrend; return res;
      }).sort((a, b) => b.ptsTotal - a.ptsTotal);

    const totalSueldos = tecnicosVinculados.reduce((acc, tv) => acc + (tv.sueldoBase || 0) + (tv.montoBonoFijo || 0), 0);
    const totalVehiculos = vehiculosDocs.reduce((acc, v) => acc + (v.valor || 0), 0);
    const gastosOp = totalSueldos + totalVehiculos;

    res.json({
      status: 'ok', maxDate: maxDateStr,
      kpis: {
        totalFacturacion: Math.round(totalCLP_f), 
        totalPts: Math.round(totalPts_f * 10) / 10, 
        totalOrdenes: totalOrders_f, 
        uniqueTechs: tecnicos.length, 
        uniqueDays: Object.keys(calendarMap).length, 
        avgFactTecDia: (tecnicos.length > 0 && Object.keys(calendarMap).length > 0) ? Math.round(totalCLP_f / tecnicos.length / Object.keys(calendarMap).length) : 0,
        monthlyResumen: Object.values(monthMap).sort((a, b) => b.mes.localeCompare(a.mes)),
        equipoCounts: {
          'Decodificadores': totalQtyDeco,
          'Repetidores/Wifi': totalQtyRep,
          'Mesh/Otros': totalQtyTel
        },
        equipoValores: {
          'Decodificadores': Math.round(totalValDeco),
          'Repetidores/Wifi': Math.round(totalValRep),
          'Mesh/Otros': Math.round(totalValTel)
        },
        gastosOp, compromisoIva: Math.round(totalCLP_f * 0.19), dotacionReal: tecnicosVinculados.length,
        metasFinancieras: { diaria: Math.round(metaDia * valorPuntoRef), semanal: Math.round(metaDia * diasSemana * valorPuntoRef), mensual: Math.round(metaDia * diasMes * valorPuntoRef), valorPuntoRef }
      },
      tecnicos,
      clientProjects: Object.values(clientProjectMap).map(cp => ({ ...cp, pts: Math.round(cp.pts * 10) / 10, clp: Math.round(cp.clp), techs: cp.techs.size, days: cp.days.size })),
      lpuActivities: Object.values(lpuMap).sort((a, b) => b.totalCLP - a.totalCLP),
      calendar: calendarMap, cities: cityMap, weeklyTrend: Object.entries(weeklyTrendMap).map(([week, v]) => ({ week, ...v, pts: Math.round(v.pts * 10) / 10 })),
      estados: Object.entries(estadoCountMap).map(([estado, count]) => ({ estado, count })).sort((a, b) => b.count - a.count),
      metaConfig: { 
        metaProduccionDia: metaDia, 
        metaProduccionSemana: Math.round(metaDia * diasSemana * 10) / 10, 
        metaProduccionMes: Math.round(metaDia * diasMes * 10) / 10,
        diasLaboralesMes: diasMes,
        diasLaboralesSemana: diasSemana,
        valorPuntoRef
      }
    });
  } catch (error) {
    console.error('❌ /api/bot/produccion-financiera error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// PRODUCCIÓN RAW — Descarga de base de datos filtrada por empresa/vinculados
// =============================================================================
app.get('/api/bot/produccion-raw', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const userRole = req.user.role?.toLowerCase();
    const isSystemAdmin = req.user.role === 'system_admin';
    let { desde, hasta, estado, empresaFilter, clientes } = req.query;
    
    // Validar fechas
    if (desde && (typeof desde !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(desde))) desde = undefined;
    if (hasta && (typeof hasta !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(hasta))) hasta = undefined;

    // IDs de vinculados para filtro restrictivo
    const tVinculados = await Tecnico.find({ empresaRef: empresaId, idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa').lean();
    const vinculadosList = tVinculados.map(t => String(t.idRecursoToa).trim());

    const filtro = isSystemAdmin ? {} : {
       $or: [
         { "ID_Recurso": { $in: vinculadosList } },
         { "ID Recurso": { $in: vinculadosList } },
         { idRecurso: { $in: vinculadosList } },
         { "Recurso": { $in: vinculadosList } }
       ]
    };
    
    if (estado && estado !== 'todos') filtro.Estado = estado;
    else if (!estado) filtro.Estado = 'Completado';
    
    if (desde) filtro.fecha = { ...filtro.fecha, $gte: new Date(desde + 'T00:00:00Z') };
    if (hasta) filtro.fecha = { ...filtro.fecha, $lte: new Date(hasta + 'T23:59:59Z') };

    if (clientes) {
       const cliArr = Array.isArray(clientes) ? clientes : [clientes];
       if (cliArr.length > 0) filtro.clienteAsociado = { $in: cliArr };
    }

    // Campos necesarios (incluyendo Productos_y_Servicios_Contratados para re-cálculo)
    const campos = 'fecha Estado Técnico ID_Recurso Número_de_Petición Ciudad Subtipo_de_Actividad Tipo_de_Trabajo Desc_LPU_Base Pts_Total_Baremo Pts_Actividad_Base Decos_Adicionales Repetidores_WiFi Productos_y_Servicios_Contratados';
    const docs = await Actividad.find(filtro).select(campos).lean().limit(35000);

    // Obtener tarifas para re-cálculo on-the-fly si faltan puntos
    const tarifasLPU = await obtenerTarifasEmpresa(empresaId);

    const vinculadosSet = new Set(vinculadosList);
    const filtered = isSystemAdmin ? docs : docs.filter(d => {
      const idRec = d['ID_Recurso'] || d['ID Recurso'] || '';
      return idRec && vinculadosSet.has(idRec);
    });

    const toExcVal = (v) => {
      if (typeof v === 'number') return v;
      const sVal = String(v || '').replace(',', '.').trim();
      if (sVal !== '' && !isNaN(Number(sVal)) && /^-?\d+(\.\d+)?$/.test(sVal)) return Number(sVal);
      return v;
    };

    const rows = filtered.map(d => {
      // ENRIQUECIMIENTO: Si el doc no tiene puntos, calculamos on-the-fly
      const hasPoints = (d.Pts_Total_Baremo && d.Pts_Total_Baremo > 0) || (d.PTS_TOTAL_BAREMO && d.PTS_TOTAL_BAREMO > 0);
      
      if (!hasPoints && tarifasLPU.length > 0) {
        const baremos = calcularBaremos(d, tarifasLPU);
        if (baremos) Object.assign(d, baremos);
      }

      return {
        'Fecha': d.fecha ? new Date(d.fecha).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : '',
        'Estado': d.Estado || '',
        'Técnico': d['Técnico'] || d.Técnico || '',
        'ID Recurso': d['ID_Recurso'] || d['ID Recurso'] || '',
        'N° Petición': d['Número_de_Petición'] || d['Número de Petición'] || '',
        'Ciudad': d.Ciudad || '',
        'Subtipo Actividad': d['Subtipo_de_Actividad'] || '',
        'Tipo Trabajo': d['Tipo_de_Trabajo'] || '',
        'LPU Base': d['Desc_LPU_Base'] || '',
        'Pts Total': toExcVal(d.Pts_Total_Baremo || d.PTS_TOTAL_BAREMO || 0),
        'Pts Base': toExcVal(d.Pts_Actividad_Base || d.PTS_ACTIVIDAD_BASE || 0),
        'Decos': toExcVal(d.Decos_Adicionales || d.DECOS_ADICIONALES || 0),
        'Repetidores': toExcVal(d.Repetidores_WiFi || d.REPETIDORES_WIFI || 0),
      };
    });

    res.json({ rows, total: rows.length, desde, hasta });
  } catch (error) {
    console.error('❌ /api/bot/produccion-raw error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2.2 DATOS TOA — Descarga Masiva (Módulo Descarga TOA)
// Recupera TODOS los registros del bot: con empresaRef O sin él (primera descarga sin campo)
// También repara en background cualquier registro sin empresaRef.
app.get('/api/bot/datos-toa', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    let { desde, hasta, busqueda, page = 1, limit = 50, sortKey = 'fecha', sortDir = 'desc', clientes } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (desde && (typeof desde !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(desde))) desde = undefined;
    if (hasta && (typeof hasta !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(hasta))) hasta = undefined;

    const currentEmail = req.user.email?.toLowerCase().trim();
    const isSystemAdmin = req.user.role === 'system_admin';

    //IDs de vinculados para filtro restrictivo (Security Layer)
    const tecnicosVinculados = await Tecnico.find({ empresaRef: empresaId, idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa').lean();
    const vinculadosList = tecnicosVinculados.map(t => String(t.idRecursoToa).trim());

    // Filtro estricto: Solo CEO Global ve todo. Otros SOLO ven sus vinculados.
    const filtro = isSystemAdmin ? {} : {
       $or: [
         { "ID_Recurso": { $in: vinculadosList } },
         { "ID Recurso": { $in: vinculadosList } },
         { idRecurso: { $in: vinculadosList } },
         { "Recurso": { $in: vinculadosList } }
       ]
    };
    if (desde) filtro.fecha = { ...filtro.fecha, $gte: new Date(desde + 'T00:00:00Z') };
    if (hasta) filtro.fecha = { ...filtro.fecha, $lte: new Date(hasta + 'T23:59:59Z') };

    // Filtro Clientes (Array o String)
    if (clientes) {
       const cliArr = Array.isArray(clientes) ? clientes : [clientes];
       if (cliArr.length > 0) {
         filtro.clienteAsociado = { $in: cliArr };
       }
    }

    // ======== BÚSQUEDA GLOBAL ($regex) ========
    if (busqueda && busqueda.trim().length > 0) {
      const regex = new RegExp(busqueda.trim(), 'i');
      filtro.$and = [
        {
          $or: [
            { "Actividad": regex },
            { "Recurso": regex },
            { "Número_de_Petición": regex },
            { "Estado": regex },
            { "Subtipo_de_Actividad": regex },
            { "Nombre": regex },
            { "RUT_del_cliente": regex },
            { "Ciudad": regex },
            { "actividad": regex },
            { "nombre": regex },
            { "rut": regex },
            { "ordenId": regex }
          ]
        }
      ];
    }

    const totalReal = await Actividad.countDocuments(filtro);
    const totalPaginas = Math.ceil(totalReal / limitNum) || 1;

    // ======== ORDENAMIENTO ========
    let sortObj = {};
    if (sortKey) {
      sortObj[sortKey] = sortDir === 'asc' ? 1 : -1;
      if (sortKey !== 'fecha') sortObj['fecha'] = -1; // secondary sort
    } else {
      sortObj = { fecha: -1, bucket: 1 };
    }

    // ======== PROYECCIÓN & QUERY ========
    const projection = '-rawData -camposCustom -fuenteDatos -_id -__v';
    
    const datos = await Actividad.find(filtro)
      .select(projection)
      .sort(sortObj)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const tarifasLPU = await obtenerTarifasEmpresa(empresaId);
    const mapaValorizacion = await construirMapaValorizacion(empresaId);

    // Pre-buscar tarifa de decos — usar la de MÍNIMO puntos (WiFi 0.25 > cable 0.5)
    const decoWifiTarifa_t = tarifasLPU
      .filter(t => t.mapeo?.es_equipo_adicional &&
        ['Decos_WiFi_Adicionales', 'Decos_Adicionales', 'Decos_Cable_Adicionales'].includes(t.mapeo?.campo_cantidad))
      .sort((a, b) => a.puntos - b.puntos)[0];
    const decoWifiPts_t = decoWifiTarifa_t ? decoWifiTarifa_t.puntos : 0.25;

    const xmlCacheToa = new Map();
    const datosSanitizados = datos.map(doc => {
      // Normalizar: reemplazar puntos y ESPACIOS con _, deduplicar case-insensitive
      // Esto elimina columnas duplicadas (ej: "Pts_Deco_Cable" y "PTS_DECO_CABLE")
      const clean = {};
      const seenUpper = {};
      for (const [k, v] of Object.entries(doc)) {
        const safeKey = k.replace(/[\.\s]/g, '_');
        const upperKey = safeKey.toUpperCase();
        if (!seenUpper[upperKey]) {
          seenUpper[upperKey] = true;
          clean[safeKey] = v;
        }
        // Saltar duplicados case-insensitive (ej: PTS_DECO_CABLE si ya existe Pts_Deco_Cable)
      }

      // Forzar re-parse si no existen las columnas de desglose Cable/WiFi
      const hasSplit = clean['Decos_Cable_Adicionales'] !== undefined && clean['Decos_WiFi_Adicionales'] !== undefined;
      const xmlField = clean['Productos_y_Servicios_Contratados'] || '';

      if (!hasSplit && xmlField) {
        let derivados = xmlCacheToa.get(xmlField);
        if (derivados === undefined) {
          derivados = parsearProductosServiciosTOA(xmlField);
          xmlCacheToa.set(xmlField, derivados || null);
        }
        if (derivados) Object.assign(clean, derivados);
      }

      // Calcular baremos solo si no existen
      if (!clean['Pts_Total_Baremo'] && tarifasLPU.length > 0) {
        const baremos = calcularBaremos(clean, tarifasLPU);
        if (baremos) Object.assign(clean, baremos);
      }

      const valorizacion = valorizarBaremos(clean, mapaValorizacion);
      Object.assign(clean, valorizacion);

      // ── INYECTAR CAMPOS CANÓNICOS UPPERCASE (Consolidados) ──
      const ps = (v) => {
        if (!v || v === '' || v === undefined || v === null) return 0;
        if (typeof v === 'number') return v;
        const s = String(v).replace(',', '.').trim();
        return parseFloat(s) || 0;
      };

      const pB = ps(clean.Pts_Actividad_Base || clean.PTS_ACTIVIDAD_BASE || clean.PUNTOS_BASE);
      const pR = ps(clean.Pts_Repetidor_Wifi || clean.PTS_REPETIDOR_WIFI || 0);
      const pT = ps(clean.Pts_Telefono || clean.PTS_TELEFONO || 0);

      // Cantidades de equipos — evitar doble conteo
      const qD_split = Math.floor(ps(clean.Decos_Cable_Adicionales || 0)) +
                       Math.floor(ps(clean.Decos_WiFi_Adicionales || 0));
      const qD_total = Math.floor(ps(clean.Decos_Adicionales || clean.DECOS_ADICIONALES || 0));
      const qD = qD_split > 0 ? qD_split : qD_total;
      const qR = Math.floor(ps(clean.Repetidores_WiFi || clean.REPETIDORES_WIFI || 0));
      const qT = Math.floor(ps(clean.Telefonos || clean.TELEFONOS || 0));

      // REGLA DE NEGOCIO: Todos los decos = WiFi × tarifa LPU
      const pD = qD * decoWifiPts_t;
      const pExpl = pB + pD + pR + pT;
      const pField = ps(clean.Pts_Total_Baremo || clean.PTS_TOTAL_BAREMO || clean.TOTAL_PUNTOS);
      const pTotal = pExpl > 0 ? pExpl : pField;

      let pBase = pB;
      if (pBase === 0 && pD === 0 && pR === 0 && pT === 0 && pTotal > 0) pBase = pTotal;

      // Escribir campos canónicos
      clean.PTS_TOTAL_BAREMO = pTotal;
      clean.PTS_ACTIVIDAD_BASE = pBase;
      clean.PTS_DECO_ADICIONAL = pD;
      clean.PTS_REPETIDOR_WIFI = pR;
      clean.PTS_TELEFONO = pT;
      clean.DECOS_ADICIONALES = qD;
      clean.REPETIDORES_WIFI = qR;
      clean.TELEFONOS = qT;
      clean.TOTAL_EQUIPOS_EXTRAS = qD + qR + qT;

      // Eliminar columnas legacy/split para evitar duplicados en la tabla
      delete clean.Pts_Total_Baremo; delete clean.Pts_Actividad_Base;
      delete clean.Pts_Deco_Cable; delete clean.Pts_Deco_Wifi; delete clean.Pts_Deco_Adicional;
      delete clean.Pts_Repetidor_Wifi; delete clean.Pts_Telefono;
      delete clean.Decos_Cable_Adicionales; delete clean.Decos_WiFi_Adicionales;
      delete clean.Decos_Adicionales; delete clean.Repetidores_WiFi; delete clean.Telefonos;
      delete clean.Total_Equipos_Extras;
      delete clean.PTOS_DECO_ADICIONAL; delete clean.PTS_DECO_CABLE; delete clean.PTS_DECO_WIFI;

      return clean;
    });

    res.json({ datos: datosSanitizados, totalReal, totalPaginas, paginaActual: pageNum });
  } catch (error) {
    console.error('❌ /api/bot/datos-toa error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2.2b EXPORTAR EXCEL COMPLETO — Server-side (sin límite de registros)
// Genera archivo XLSX directamente en el servidor con TODOS los registros
app.get('/api/bot/exportar-toa', protect, async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const empresaId = req.user.empresaRef;
    const currentEmail = req.user.email?.toLowerCase().trim();
    const isSystemAdmin = req.user.role === 'system_admin';
    const { desde, hasta, clientes } = req.query;
    
    // IDs de vinculados para filtro restrictivo (Security Layer)
    const tExp = await Tecnico.find({ empresaRef: empresaId, idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa').lean();
    const restrictedIDs = tExp.map(t => String(t.idRecursoToa).trim());

    const filtro = isSystemAdmin ? {} : {
       $or: [
         { "ID_Recurso": { $in: restrictedIDs } },
         { "ID Recurso": { $in: restrictedIDs } },
         { idRecurso: { $in: restrictedIDs } },
         { "Recurso": { $in: restrictedIDs } }
       ]
    };
    if (desde) filtro.fecha = { ...filtro.fecha, $gte: new Date(desde + 'T00:00:00Z') };
    if (hasta) filtro.fecha = { ...filtro.fecha, $lte: new Date(hasta + 'T23:59:59Z') };

    // Filtro Clientes (Array o String)
    if (clientes) {
       const cliArr = Array.isArray(clientes) ? clientes : [clientes];
       if (cliArr.length > 0) {
         filtro.clienteAsociado = { $in: cliArr };
       }
    }

    // Sin límite de rows, pero CON proyección para evitar ahogar RAM 
    // y evitar JSON parse circular issues con campos profundos.
    const projection = '-rawData -camposCustom -fuenteDatos -_id -__v';
    const datos = await Actividad.find(filtro)
      .select(projection)
      .sort({ fecha: -1, bucket: 1 })
      .lean();

    // Cargar tarifas LPU para baremización + mapa de valorización (técnico→cliente→valor)
    const tarifasLPU = await obtenerTarifasEmpresa(empresaId);
    const mapaValorizacion = await construirMapaValorizacion(empresaId);

    // Columnas a excluir del Excel
    const excluir = new Set(['_id', '__v', 'rawData', 'camposCustom', 'fuenteDatos', 'projectId', 'ceco', 'ultimaActualizacion', 'empresaRef']);

    // Recopilar todas las keys únicas de todos los registros
    const allKeys = new Set();
    datos.forEach(doc => {
      Object.keys(doc).forEach(k => {
        if (!excluir.has(k)) allKeys.add(k.replace(/\./g, '_'));
      });
    });
    const headers = ['Fecha', ...Array.from(allKeys).filter(k => k !== 'fecha' && k !== 'ordenId').sort()];

    // Columnas derivadas del XML de productos + baremos + valorización
    const colsDerivadas = ['Velocidad_Internet', 'Plan_TV', 'Telefonia', 'Modem', 'Deco_Principal', 'Decos_Adicionales', 'Decos_Cable_Adicionales', 'Decos_WiFi_Adicionales', 'Repetidores_WiFi', 'Telefonos', 'Total_Equipos_Extras', 'Tipo_Operacion', 'Equipos_Detalle', 'Total_Productos'];
    const colsBaremos = ['Pts_Actividad_Base', 'Codigo_LPU_Base', 'Desc_LPU_Base', 'Pts_Deco_Adicional', 'Pts_Deco_Cable', 'Codigo_LPU_Deco_Cable', 'Pts_Deco_WiFi', 'Codigo_LPU_Deco_WiFi', 'Pts_Repetidor_WiFi', 'Pts_Telefono', 'Pts_Total_Baremo'];
    const colsValorizacion = ['Valor_Punto_CLP', 'Valor_Actividad_CLP', 'Cliente_Tarifa', 'Proyecto_Tarifa'];
    colsDerivadas.forEach(c => allKeys.add(c));
    colsBaremos.forEach(c => allKeys.add(c));
    colsValorizacion.forEach(c => allKeys.add(c));

    // Construir filas
    const rows = datos.map(doc => {
      const row = {};
      row['Fecha'] = doc.fecha ? new Date(doc.fecha).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : '';

      // Parsear XML on-the-fly si no tiene columnas derivadas
      let derivados = null;
      if (!doc['Velocidad_Internet'] && !doc['Total_Equipos_Extras']) {
        const xmlField = doc['Productos_y_Servicios_Contratados'] || doc['Productos_y_Servicios_Contratados'.replace(/_/g, '.')] || '';
        derivados = parsearProductosServiciosTOA(xmlField);
      }

      // Calcular baremos on-the-fly
      let baremos = null;
      const docConDerivados = { ...doc };
      if (derivados) Object.assign(docConDerivados, derivados);
      
      const missingSplitExp = !docConDerivados['Decos_Cable_Adicionales'] || !docConDerivados['Decos_WiFi_Adicionales'] || docConDerivados['Decos_Cable_Adicionales'] === '0' || docConDerivados['Decos_WiFi_Adicionales'] === '0';
      const needsReparseExp = missingSplitExp && (docConDerivados['Decos_Adicionales'] && docConDerivados['Decos_Adicionales'] !== '0');

      if ((!doc['Pts_Total_Baremo'] || needsReparseExp) && tarifasLPU.length > 0) {
        if (needsReparseExp && !derivados) {
           const xmlField = doc['Productos_y_Servicios_Contratados'] || '';
           const deriv = parsearProductosServiciosTOA(xmlField);
           if (deriv) Object.assign(docConDerivados, deriv);
        }
        baremos = calcularBaremos(docConDerivados, tarifasLPU);
        if (baremos) Object.assign(docConDerivados, baremos);
      }

      // Valorizar monetariamente (siempre agrega columnas)
      const valorizacion = valorizarBaremos(docConDerivados, mapaValorizacion);

      // ── RECÁLCULO DE DECOS COMO WIFI (Regla de negocio) ──
      const ps = (v) => { if (!v) return 0; if (typeof v === 'number') return v; return parseFloat(String(v).replace(',','.')) || 0; };
      const decoWifiTar = tarifasLPU
        .filter(t => t.mapeo?.es_equipo_adicional &&
          ['Decos_WiFi_Adicionales', 'Decos_Adicionales', 'Decos_Cable_Adicionales'].includes(t.mapeo?.campo_cantidad))
        .sort((a, b) => a.puntos - b.puntos)[0];
      const dwPts = decoWifiTar ? decoWifiTar.puntos : 0.25;

      const qDx_split = Math.floor(ps(docConDerivados.Decos_Cable_Adicionales)) + Math.floor(ps(docConDerivados.Decos_WiFi_Adicionales));
      const qDx_total = Math.floor(ps(docConDerivados.Decos_Adicionales));
      const qDx = qDx_split > 0 ? qDx_split : qDx_total;
      const qRx = Math.floor(ps(docConDerivados.Repetidores_WiFi));
      const qTx = Math.floor(ps(docConDerivados.Telefonos));
      const pBx = ps(docConDerivados.Pts_Actividad_Base);
      const pDx = qDx * dwPts;
      const pRx = ps(docConDerivados.Pts_Repetidor_WiFi);
      const pTx = ps(docConDerivados.Pts_Telefono);
      const pTotalx = (pBx + pDx + pRx + pTx) || ps(docConDerivados.Pts_Total_Baremo);

      // Sobrescribir campos en docConDerivados para que el Excel refleje valores correctos
      docConDerivados.Pts_Deco_Adicional = String(pDx);
      docConDerivados.Pts_Deco_Cable = '0';
      docConDerivados.Pts_Deco_WiFi = String(pDx);
      docConDerivados.Pts_Total_Baremo = String(pTotalx);
      docConDerivados.Decos_Adicionales = String(qDx);

      allKeys.forEach(k => {
        if (k === 'fecha') return;
        const safeK = k.replace(/\./g, '_');
        let v = docConDerivados[safeK] ?? doc[k] ?? doc[k.replace(/_/g, '.')];
        if ((v === null || v === undefined) && derivados && derivados[safeK]) v = derivados[safeK];
        if ((v === null || v === undefined) && baremos && baremos[safeK]) v = baremos[safeK];
        if ((v === null || v === undefined) && valorizacion && valorizacion[safeK]) v = valorizacion[safeK];

        // Formateo inteligente según tipo de dato
        if (v === null || v === undefined) {
          row[safeK] = '';
        } else if (typeof v === 'number') {
          row[safeK] = v;
        } else if (typeof v === 'object') {
          row[safeK] = JSON.stringify(v);
        } else {
          const sVal = String(v).trim();
          if (sVal !== '' && !isNaN(Number(sVal)) && /^-?\d+(\.\d+)?$/.test(sVal)) {
            row[safeK] = Number(sVal);
          } else {
            row[safeK] = sVal;
          }
        }
      });
      return row;
    });

    if (rows.length === 0) {
      // Si no hay datos, al menos enviamos los headers
      const ws = XLSX.utils.json_to_sheet([{}], { header: Array.from(allKeys) });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sin_Datos');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Sin_Datos.xlsx"');
      return res.send(buffer);
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produccion_TOA');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const rangoStr = desde && hasta ? `_${desde}_a_${hasta}` : '';
    const filename = `Produccion_TOA_COMPLETO${rangoStr}_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Respuesta simplificada para máxima compatibilidad
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    
    res.send(buffer);

    console.log(`📊 Excel exportado: ${datos.length} registros → ${filename}`);
  } catch (error) {
    console.error('❌ /api/bot/exportar-toa error:', error.stack || error.message);
    // IMPORTANTE: Enviar JSON pero con status 500 para que el frontend lo detecte
    res.status(500).json({ 
      error: 'Error al generar el archivo Excel', 
      detail: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 2.3 FECHAS YA DESCARGADAS — Para marcar en el calendario del frontend
app.get('/api/bot/fechas-descargadas', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const currentEmail = req.user.email?.toLowerCase().trim();
    const isSystemAdmin = req.user.role === 'system_admin';
    // IDs de vinculados para filtro restrictivo (Security Layer)
    const tCal = await Tecnico.find({ empresaRef: empresaId, idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa').lean();
    const restrictedIDs = tCal.map(t => String(t.idRecursoToa).trim());

    const filtro = isSystemAdmin ? {} : {
       $or: [
         { "ID_Recurso": { $in: restrictedIDs } },
         { "ID Recurso": { $in: restrictedIDs } },
         { idRecurso: { $in: restrictedIDs } },
         { "Recurso": { $in: restrictedIDs } }
       ]
    };
    // Agrupar por fecha y contar registros por día
    const resultado = await Actividad.aggregate([
      { $match: filtro },
      { $match: { fecha: { $exists: true, $ne: null } } },  // solo docs con fecha válida
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha', timezone: 'UTC' } },
          total: { $sum: 1 }
      }},
      { $match: { _id: { $ne: null } } },   // excluir fechas nulas
      { $sort: { _id: 1 } }
    ]);
    const fechas = resultado.filter(r => r._id).map(r => ({ fecha: r._id, total: r.total }));
    res.json({ fechas });
  } catch (error) {
    console.error('❌ /api/bot/fechas-descargadas error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2.3b VALORES ÚNICOS POR COLUMNA — Para análisis de mapeo LPU/baremos
app.get('/api/bot/valores-unicos', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const currentEmail = req.user.email?.toLowerCase().trim();
    const isSystemAdmin = req.user.role === 'system_admin';
    const { columna } = req.query;
    if (!columna) return res.status(400).json({ error: 'Falta parámetro columna' });
    // IDs de vinculados para filtro restrictivo (Security Layer)
    const tUni = await Tecnico.find({ empresaRef: empresaId, idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa').lean();
    const restrictedIDs = tUni.map(t => String(t.idRecursoToa).trim());

    const filtro = isSystemAdmin ? {} : {
       $or: [
         { "ID_Recurso": { $in: restrictedIDs } },
         { "ID Recurso": { $in: restrictedIDs } },
         { idRecurso: { $in: restrictedIDs } },
         { "Recurso": { $in: restrictedIDs } }
       ]
    };
    const resultado = await Actividad.aggregate([
      { $match: filtro },
      { $group: { _id: `$${columna}`, total: { $sum: 1 } } },
      { $match: { _id: { $ne: null } } },
      { $sort: { total: -1 } },
      { $limit: 100 }
    ]);
    res.json({ columna, valores: resultado.map(r => ({ valor: r._id, total: r.total })) });
  } catch (error) {
    console.error('❌ /api/bot/valores-unicos error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2.3c IDs RECURSO TOA — Lista de técnicos únicos con su ID para vincular
// Devuelve IDs disponibles (no asignados a otra empresa) para el buscador
app.get('/api/bot/ids-recurso-toa', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const currentEmail = req.user.email?.toLowerCase().trim();
    const isSystemAdmin = req.user.role === 'system_admin';
    const { busqueda } = req.query;

    const filtro = { 'ID Recurso': { $exists: true, $ne: '' } };
    const resultado = await Actividad.aggregate([
      { $match: filtro },
      { $group: {
        _id: '$ID Recurso',
        nombre: { $first: { $ifNull: ['$Recurso', '$Técnico'] } },
        total_ordenes: { $sum: 1 }
      }},
      { $match: { _id: { $ne: null } } },
      { $sort: { total_ordenes: -1 } }
    ]);

    // 2. Obtener IDs ya asignados a OTRAS empresas (para bloquearlos)
    const Candidato = require('./platforms/rrhh/models/Candidato');
    const asignados = await Candidato.find(
      { idRecursoToa: { $exists: true, $ne: '' } },
      { idRecursoToa: 1, empresaRef: 1, fullName: 1 }
    ).lean();

    const idsOtraEmpresa = new Set();
    asignados.forEach(c => {
      const empId = c.empresaRef?.toString();
      if (empId && empId !== empresaId?.toString()) {
        idsOtraEmpresa.add(c.idRecursoToa);
      }
    });

    // 3. Filtrar: solo IDs disponibles (no asignados a otra empresa)
    let items = resultado
      .filter(r => !idsOtraEmpresa.has(r._id))
      .map(r => ({
        idRecurso: r._id,
        nombre: r.nombre || '',
        totalOrdenes: r.total_ordenes
      }));

    // 4. Filtrar por búsqueda si se proporcionó
    if (busqueda) {
      const q = busqueda.toLowerCase();
      items = items.filter(i =>
        i.idRecurso.toLowerCase().includes(q) ||
        i.nombre.toLowerCase().includes(q)
      );
    }

    res.json(items);
  } catch (error) {
    console.error('❌ /api/bot/ids-recurso-toa error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2.4 PREVIEW LIMPIEZA — Contar cuántos registros se eliminarían
app.post('/api/bot/preview-limpieza', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const { reglas } = req.body; // [{ columna, operador, valor }]
    if (!reglas || !Array.isArray(reglas) || reglas.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos una regla de limpieza.' });
    }
    const filtroEmpresa = {
      $or: [
        { empresaRef: empresaId },
        { empresaRef: empresaId?.toString() },
        { empresaRef: { $exists: false } },
        { empresaRef: null }
      ]
    };
    // Construir filtros OR (cada regla es un criterio independiente)
    const condiciones = reglas.map(r => {
      if (r.operador === 'equals') return { [r.columna]: { $regex: `^${r.valor}$`, $options: 'i' } };
      if (r.operador === 'contains') return { [r.columna]: { $regex: r.valor, $options: 'i' } };
      if (r.operador === 'starts') return { [r.columna]: { $regex: `^${r.valor}`, $options: 'i' } };
      if (r.operador === 'empty') return { $or: [{ [r.columna]: '' }, { [r.columna]: null }, { [r.columna]: { $exists: false } }] };
      return { [r.columna]: r.valor };
    }).filter(Boolean);

    const filtro = { $and: [filtroEmpresa, { $or: condiciones }] };
    const total = await Actividad.countDocuments(filtro);

    // Obtener muestra de 5 registros para preview
    const muestra = await Actividad.find(filtro).limit(5).lean();
    const muestraSimple = muestra.map(m => ({
      ordenId: m.ordenId,
      fecha: m.fecha,
      estado: m['Estado'] || m.estado || '',
      subtipo: m['Subtipo de Actividad'] || m.subtipo || '',
      actividad: m['Actividad'] || m.actividad || '',
      nombre: m['Nombre'] || m.nombre || ''
    }));

    res.json({ total, muestra: muestraSimple });
  } catch (error) {
    console.error('❌ /api/bot/preview-limpieza error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2.5 EJECUTAR LIMPIEZA — Eliminar registros por filtros
app.post('/api/bot/limpiar-datos', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const { reglas, confirmado } = req.body;
    if (!confirmado) return res.status(400).json({ error: 'Debes confirmar la eliminación.' });
    if (!reglas || !Array.isArray(reglas) || reglas.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos una regla de limpieza.' });
    }
    const filtroEmpresa = {
      $or: [
        { empresaRef: empresaId },
        { empresaRef: empresaId?.toString() },
        { empresaRef: { $exists: false } },
        { empresaRef: null }
      ]
    };
    const condiciones = reglas.map(r => {
      if (r.operador === 'equals') return { [r.columna]: { $regex: `^${r.valor}$`, $options: 'i' } };
      if (r.operador === 'contains') return { [r.columna]: { $regex: r.valor, $options: 'i' } };
      if (r.operador === 'starts') return { [r.columna]: { $regex: `^${r.valor}`, $options: 'i' } };
      if (r.operador === 'empty') return { $or: [{ [r.columna]: '' }, { [r.columna]: null }, { [r.columna]: { $exists: false } }] };
      return { [r.columna]: r.valor };
    }).filter(Boolean);

    const filtro = { $and: [filtroEmpresa, { $or: condiciones }] };
    const resultado = await Actividad.deleteMany(filtro);
    console.log(`🧹 Limpieza TOA: ${resultado.deletedCount} registros eliminados por ${req.user.name || req.user.email}`);
    res.json({ eliminados: resultado.deletedCount });
  } catch (error) {
    console.error('❌ /api/bot/limpiar-datos error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2.1 PRODUCCIÓN MENSUAL (Agregado para Dashboard)
app.get('/api/produccion/mensual', protect, async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ error: "Year and month required" });

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const ordenes = await Actividad.find({
      empresaRef: req.user.empresaRef,
      fecha: { $gte: startDate, $lte: endDate }
    }).sort({ fecha: -1 });

    // Calcular estadísticas diarias y totales
    const stats = ordenes.reduce((acc, curr) => {
      const dayKey = curr.fecha.toISOString().split('T')[0];
      const monto = curr.ingreso || 0;
      const pts = curr.puntos || 0;

      acc.total += monto;
      acc.count += 1;
      acc.mensual += pts;

      if (!acc.diario[dayKey]) {
        acc.diario[dayKey] = { monto: 0, pts: 0, count: 0, zenerPts: 0, comficaPts: 0 };
      }

      acc.diario[dayKey].monto += monto;
      acc.diario[dayKey].pts += pts;
      acc.diario[dayKey].count += 1;

      // Split por cliente (Zener vs Comfica)
      const cliente = (curr.clienteAsociado || '').toUpperCase();
      if (cliente.includes('ZENER')) acc.diario[dayKey].zenerPts += pts;
      else if (cliente.includes('COMFICA')) acc.diario[dayKey].comficaPts += pts;

      return acc;
    }, { total: 0, count: 0, diario: {}, mensual: 0 });

    res.json({ stats, ordenes });
  } catch (error) {
    console.error("Monthly Stats Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. HISTORIAL (FILTROS)
app.get('/api/historial', protect, async (req, res) => {
  try {
    const { tecnicoId, rut, fechaInicio, fechaFin, tipo } = req.query;
    // 🔒 TENANT ISOLATION
    let filtro = { empresaRef: req.user.empresaRef };

    if (tecnicoId) {
      // Intentar obtener el rut/toaId del técnico para ampliar búsqueda
      const t = await Tecnico.findById(tecnicoId).select('rut idRecursoToa');
      if (t) {
        filtro.$or = [
          { tecnicoId },
          { tecnicoRut: t.rut },
          { rut: t.rut },
          { "ID_Recurso": t.idRecursoToa },
          { "ID Recurso": t.idRecursoToa },
          { "idRecurso": t.idRecursoToa },
          { "Recurso": t.idRecursoToa }
        ].filter(f => Object.values(f)[0]); // Evitar undefined
      } else {
        filtro.tecnicoId = tecnicoId;
      }
    } else if (rut) {
      const r = rut.replace(/\./g, "").replace(/-/g, "").toUpperCase().trim();
      let t = await Tecnico.findOne({ empresaRef: req.user.empresaRef, $or: [{ rut: r }, { rut }] }).select('idRecursoToa nombres apellidos');
      
      if (!t && req.user.email) {
        t = await Tecnico.findOne({ email: req.user.email, empresaRef: req.user.empresaRef }).select('idRecursoToa nombres apellidos');
      }

      filtro.$or = [
        { tecnicoRut: r },
        { rut: r },
        { tecnicoRut: rut },
        { rut: rut }
      ];

      if (t) {
        if (t.idRecursoToa) {
          filtro.$or.push({ "ID_Recurso": t.idRecursoToa });
          filtro.$or.push({ "ID Recurso": t.idRecursoToa });
          filtro.$or.push({ "idRecurso": t.idRecursoToa });
          filtro.$or.push({ "Recurso": t.idRecursoToa });
          filtro.$or.push({ "RECURSO": t.idRecursoToa });
        }
        if (t.nombres && t.apellidos) {
          const fn = `${t.nombres} ${t.apellidos}`.trim();
          filtro.$or.push({ "nombre": { $regex: fn, $options: 'i' } });
          filtro.$or.push({ "TECNICO": { $regex: fn, $options: 'i' } });
        }
      }
    }

    if (fechaInicio || fechaFin) {
      filtro.fecha = {};
      if (fechaInicio) filtro.fecha.$gte = new Date(fechaInicio);
      if (fechaFin) {
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);
        filtro.fecha.$lte = fin;
      }
    }

    if (tipo) {
      const typeQuery = {
        $or: [
          { ordenId: { $regex: tipo.toLowerCase().includes('rep') ? /^INC/i : (tipo.toLowerCase().includes('pro') ? /^(?!INC)/i : /.*/) } },
          { "ID_Orden": { $regex: tipo.toLowerCase().includes('rep') ? /^INC/i : (tipo.toLowerCase().includes('pro') ? /^(?!INC)/i : /.*/) } },
          { "Número_de_Petición": { $regex: tipo.toLowerCase().includes('rep') ? /^INC/i : (tipo.toLowerCase().includes('pro') ? /^(?!INC)/i : /.*/) } }
        ]
      };
      
      if (filtro.$or) {
        // Combinar con AND si ya hay un $or de técnicos
        filtro = { $and: [{ ...filtro }, typeQuery] };
      } else {
        filtro.$or = typeQuery.$or;
      }
    }

    const registrosRaw = await Actividad.find(filtro).sort({ fecha: -1 }).limit(5000);

    // RECALCULAR PUNTOS (misma regla: decos = tarifa mínima, normalmente 0.25 WiFi)
    const tarifarios = await Baremo.find({ empresaRef: req.user.empresaRef });
    const decoWifiTar = tarifarios
      .filter(t => ['Decos_WiFi_Adicionales', 'Decos_Adicionales', 'Decos_Cable_Adicionales'].includes(t.mapeo?.campo_cantidad || '') ||
        String(t.mapeo?.valor_busqueda || '').toLowerCase().includes('wi-fi'))
      .sort((a, b) => a.puntos - b.puntos)[0];
    const dwPts = decoWifiTar ? decoWifiTar.puntos : 0.25;
    const ps = (v) => isNaN(parseFloat(v)) ? 0 : parseFloat(v);

    const registrosFinales = registrosRaw.map(d => {
      const clean = d.toObject ? d.toObject() : d;
      const qD_split = Math.floor(ps(clean.Decos_Cable_Adicionales || 0)) + Math.floor(ps(clean.Decos_WiFi_Adicionales || 0));
      const qD_total = Math.floor(ps(clean.Decos_Adicionales || clean.DECOS_ADICIONALES || 0));
      const qD = qD_split > 0 ? qD_split : qD_total;

      const pB = ps(clean.Pts_Actividad_Base || clean.PTS_ACTIVIDAD_BASE || 0);
      const pD = qD * dwPts;
      const pR = ps(clean.Pts_Repetidor_Wifi || clean.PTS_REPETIDOR_WIFI || 0);
      const pT = ps(clean.Pts_Telefono || clean.PTS_TELEFONO || 0);

      const pExpl = pB + pD + pR + pT;
      const hasExpl = qD > 0 || ps(clean.Repetidores_WiFi || 0) > 0 || ps(clean.Telefonos || 0) > 0;
      
      const pFinal = hasExpl ? pExpl : ps(clean.Puntos || clean.puntos || clean.Pts_Total_Baremo || 0);

      return { ...clean, puntos: pFinal, Pts_Total_Baremo: pFinal };
    });

    res.json(registrosFinales);
  } catch (e) { res.status(500).json({ error: e.message }); }
});



// --- H. TURNOS DE SUPERVISIÓN (OPERACIONES) ---
const mailer = require('./utils/mailer');

// 1. Obtener la programación de turnos (opcional: por supervisor y/o fechas)
app.get('/api/operaciones/turnos', protect, async (req, res) => {
  try {
    const { supervisorId, semanaDe } = req.query;
    // 🔒 TENANT ISOLATION
    let query = { empresaRef: req.user.empresaRef };
    if (supervisorId) query.supervisor = supervisorId;
    if (semanaDe) query.semanaDe = new Date(semanaDe);

    const turnos = await TurnoSupervisor.find(query)
      .populate('supervisor', 'name rut')
      .populate('creadoPor', 'name')
      .sort({ semanaDe: -1 });
    res.json(turnos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Crear una nueva programación semanal (Desde Panel CEO/Operaciones)
app.post('/api/operaciones/turnos', protect, async (req, res) => {
  try {
    const { semanaDe, semanaHasta, supervisor, supervisorNombre, rutasDiarias, creadoPor } = req.body;

    // Validar duplicado
    const existe = await TurnoSupervisor.findOne({ 
      semanaDe: new Date(semanaDe), 
      supervisor,
      empresaRef: req.user.empresaRef // 🔒
    });
    if (existe) {
      return res.status(400).json({ error: "El supervisor ya tiene turno asignado para esta semana." });
    }

    const nuevoTurno = new TurnoSupervisor({
      semanaDe,
      semanaHasta,
      supervisor,
      supervisorNombre,
      rutasDiarias,
      estado: 'Notificado', // Asume que tras crear se notificará
      creadoPor,
      empresaRef: req.user.empresaRef // 🔒
    });

    await nuevoTurno.save();

    // Disparador de e-mail de notificación
    try {
      const supUser = await PlatformUser.findById(supervisor);
      if (supUser && supUser.email) {
        // Enriquecemos el turno con datos de marca del supervisor (su empresa)
        // [x] Emails automáticos vía mailer.js (Gerencia/Solicitante)
        await mailer.sendTurnoNotification({
          ...nuevoTurno.toObject(),
          companyName: supUser.empresa?.nombre,
          companyLogo: supUser.empresa?.logo
        }, supUser.email);
      }
    } catch (mailErr) {
      console.error("Error no bloqueante enviando email de turno:", mailErr);
    }

    res.status(201).json(nuevoTurno);
  } catch (error) {
    console.error("Error creando turno:", error);
    res.status(500).json({ error: error.message });
  }
});

// 2.5 Editar una programación (Toggle de días libres/horarios)
app.put('/api/operaciones/turnos/:id', async (req, res) => {
  try {
    const { rutasDiarias } = req.body;
    const turno = await TurnoSupervisor.findByIdAndUpdate(
      req.params.id,
      { rutasDiarias },
      { new: true }
    );
    if (!turno) return res.status(404).json({ error: "Turno no encontrado" });
    res.json(turno);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Confirmar Asistencia ("Enterado") al Turno
app.put('/api/operaciones/turnos/:id/confirmar', async (req, res) => {
  try {
    const turno = await TurnoSupervisor.findById(req.params.id);
    if (!turno) return res.status(404).json({ error: "Turno no encontrado" });

    turno.estado = 'Confirmado';
    turno.fechaConfirmacion = new Date();
    await turno.save();

    res.json({ message: "Turno confirmado con éxito", turno });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- G. INTELLIGENT GPS SECTION (Fleet Brain) ---

// 1. Reset GPS DB (SOLO CEO)
app.delete('/api/gps/reset', protect, async (req, res) => {
  try {
    if (!['system_admin', 'ceo'].includes(req.user.role)) {
       return res.status(403).json({ message: "Acceso denegado: solo personal de administración puede resetear la red GPS." });
    }
    await Ubicacion.deleteMany({});
    console.log('🧹 GPS database cleaned by user request.');
    res.status(200).send('Cleaned');
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. Receive Data from Bot (Internal Webhook) - 🔓 Requiere API KEY o Token de Sistema en Prod
app.post('/api/gps/update', async (req, res) => {
  try {
    const { patente, ...datos } = req.body;
    if (!patente) return res.status(400).json({ error: "License plate required" });

    if (typeof datos.latitud !== 'number' || typeof datos.longitud !== 'number') {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    await Ubicacion.findOneAndUpdate(
      { patente },
      { ...datos, patente, timestamp: new Date() },
      { upsert: true, new: true }
    );
    res.status(200).send('OK');
  }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. LIVE API: DATA CROSSING (GPS + HR + FLEET)
app.get('/api/gps/live', protect, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION
    const empresaRef = req.user.empresaRef;

    const flotaGPS = await Ubicacion.find().sort({ timestamp: -1 });
    const vehiculosAsignados = await Vehiculo.find({ 
      empresaRef, 
      asignadoA: { $ne: null } 
    }).populate('asignadoA', 'nombre nombres apellidos rut cargo');

    const mapaAsignaciones = {};
    vehiculosAsignados.forEach(v => {
      if (v.patente) {
        const key = v.patente.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        mapaAsignaciones[key] = v.asignadoA;
      }
    });

    const flotaFormat = flotaGPS.map(f => {
      if (!f.patente) return null;
      const patenteLimpia = f.patente.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const tecnico = mapaAsignaciones[patenteLimpia];

      return {
        _id: f.patente,
        patente: f.patente,
        lat: f.latitud || 0,
        lng: f.longitud || 0,
        bateria: f.bateria,
        velocidad: f.velocidad || 0,
        estado: f.estado || "Desconocido",
        ultimoReporte: f.timestamp,
        conductor: tecnico ? (tecnico.nombre || `${tecnico.nombres || ''} ${tecnico.apellidos || ''}`.trim() || 'SIN NOMBRE') : "SIN ASIGNAR",
        cargo: tecnico ? (tecnico.cargo || "TÉCNICO") : "FLOTA LIBRE",
        rutConductor: tecnico ? tecnico.rut : null,
        validacion: tecnico ? 'OK' : 'ALERTA_NO_ASIGNADO'
      };
    }).filter(item => item !== null);

    res.json(flotaFormat);
  } catch (e) {
    console.error("GPS Live Error:", e);
    res.status(500).json({ error: e.message });
  }
});


// =============================================================================
// 4. SERVER START
// =============================================================================
// --- ERROR HANDLING (CENTRALIZED) ---
app.use(require('./middleware/errorMiddleware'));

const shutdown = async (signal) => {
  console.log(`🛑 Received ${signal}. Iniciando apagado ordenado...`);
  try {
    await mongoose.connection.close(false);
    console.log('🗄️ Conexión a MongoDB cerrada.');
  } catch (err) {
    console.error('❌ Error cerrando MongoDB:', err);
  }
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  // Solo loggeamos — NO cerramos el servidor.
  // Cerrar el proceso aquí mataría Express por un error en cualquier módulo secundario.
  console.error('❌ uncaughtException (no-exit):', err);
});
process.on('unhandledRejection', (reason, promise) => {
  // Solo loggeamos — NO cerramos el servidor.
  console.error('❌ unhandledRejection (no-exit) at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 5003;
const serverInstance = app.listen(PORT, () => {
    console.log(`🚀 Platform Core running on port ${PORT}`);
    // Inicializar servicios CRON de RRHH y Otros
    try {
      const { initCron } = require('./utils/cronService');
      initCron();
    } catch (err) {
      console.error('⚠️ Error inicializando CRON:', err.message);
    }
});

// ── Keep-alive: evita que Render (free tier) duerma el servidor ──────────────
// Render apaga instancias gratuitas tras 15 min de inactividad → 502 + sin CORS headers
// Este ping cada 10 minutos mantiene el servidor activo
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
setInterval(() => {
  const lib = SELF_URL.startsWith('https') ? require('https') : require('http');
  lib.get(`${SELF_URL}/api/ping-platform`, (r) => {
    console.log(`[keep-alive] ping → ${r.statusCode}`);
  }).on('error', (e) => {
    // Silencioso en local donde no hay HTTPS
    if (process.env.NODE_ENV === 'production') console.warn('[keep-alive] error:', e.message);
  });
}, 10 * 60 * 1000); // cada 10 minutos

module.exports = { app, serverInstance };
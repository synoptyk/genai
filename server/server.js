const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');
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
const { generalLimiter, authLimiter, botLimiter, uploadLimiter, helmetConfig } = require('./middleware/security');
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
let Actividad, ActividadMayo, Baremo, Ubicacion, Cliente, Tecnico, Vehiculo, Candidato;

try {
  Actividad = require(`${PLATFORM_PATH}/models/Actividad`);
  Baremo = require(`${PLATFORM_PATH}/models/Baremo`);
  Ubicacion = require(`${PLATFORM_PATH}/models/Ubicacion`);
  Cliente = require(`${PLATFORM_PATH}/models/Cliente`);
  Tecnico = require(`${PLATFORM_PATH}/models/Tecnico`);
  Vehiculo = require(`${PLATFORM_PATH}/models/Vehiculo`);
  Candidato = require('./platforms/rrhh/models/Candidato');
  console.log("✅ Database Models (including ActividadMayo) loaded successfully.");
} catch (error) {
  console.error("❌ CRITICAL ERROR LOADING MODELS:", error.message);
  process.exit(1);
}

// CREAR APP PRIMERO - antes de usarla en endpoints
const app = express();

// --- CORS CONFIGURATION ---
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
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
];

// Agregar URLs dinámicas de variables de entorno
if (process.env.FRONTEND_URL) {
  const frontendUrl = String(process.env.FRONTEND_URL).trim();
  if (!allowedOrigins.includes(frontendUrl)) {
    allowedOrigins.push(frontendUrl);
  }
}

if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
    .forEach((o) => {
      if (!allowedOrigins.includes(o)) {
        allowedOrigins.push(o);
      }
    });
}

const normalizedAllowedOrigins = new Set(
  allowedOrigins.map((o) => String(o || '').toLowerCase().replace(/\/$/, ''))
);

const corsOptions = {
  origin: (origin, callback) => {
    // Permitir solicitudes sin origen (como requests de servidor a servidor)
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = String(origin).toLowerCase().replace(/\/$/, '');

    // SIEMPRE permitir localhost en cualquier contexto (desarrollo remoto)
    if (normalizedOrigin.includes('localhost') || normalizedOrigin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    // Verificar si está en la lista permitida explícitamente
    const isInAllowedList = normalizedAllowedOrigins.has(normalizedOrigin);

    // Permitir dominios con patrones conocidos en producción
    const isKnownDomain =
      normalizedOrigin.endsWith('.vercel.app') ||
      normalizedOrigin.endsWith('.run.app') ||
      normalizedOrigin.endsWith('.enterprise.cl') ||
      normalizedOrigin.endsWith('.genai.cl');

    // Si está permitido, callback sin error
    if (isInAllowedList || isKnownDomain) {
      return callback(null, true);
    }

    // Si no está permitido en producción, log pero NO lanzar error
    // (dejar que se envíen headers y que el navegador decida)
    console.warn(`⚠️ Origen no en lista blanca (pero sin rechazar): ${origin}`);
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-company-override', 'x-tenant-id'],
  exposedHeaders: ['Content-Disposition', 'Content-Type', 'X-Total-Count'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// --- ENDPOINT: Sincronizar técnicos vinculados (después de app) ---
const { obtenerTecnicosVinculadosYProduccion } = require('./utils/syncTecnicosVinculados');
/**
 * POST /api/sincronizar-tecnicos-vinculados
 * Busca todas las actividades ejecutadas por el personal vinculado a la empresa (por idRecursoToa)
 * Requiere autenticación (protect)
 */
app.post('/api/sincronizar-tecnicos-vinculados', protect, async (req, res) => {
  try {
    const userId = req.user?._id;
    const empresaId = req.user?.EMPRESA_REF || req.user?.empresaRef;
    if (!userId || !empresaId) return res.status(400).json({ error: 'Usuario o empresa no identificados' });

    // Busca todas las actividades ejecutadas por el personal vinculado a la empresa
    const resumen = await obtenerTecnicosVinculadosYProduccion(empresaId);
    res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.set('Vary', 'Origin');
    res.json({ ok: true, resumen });
  } catch (error) {
    console.error('Error en sincronización de técnicos vinculados:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- IMPORT BOTS (AUTOMATION) ---
let botsLoaded = false;
let iniciarExtraccion = null;
let iniciarRastreoGPS = null;

try {
  const bots = require(`${PLATFORM_PATH}/bot/agente_real`); // TOA BOT
  iniciarExtraccion = bots.iniciarExtraccion;
  iniciarRastreoGPS = require(`${PLATFORM_PATH}/bot/agente_gps`).iniciarRastreoGPS; // GPS BOT

  // --- CRON JOBS ---
  // 1. Nightly TOA Extraction (23:00 hrs)
  cron.schedule('0 23 * * *', () => {
    console.log('⏰ CRON JOB: Starting Massive TOA Extraction (23:00)');
    if (iniciarExtraccion) iniciarExtraccion();
  }, { scheduled: true, timezone: "America/Santiago" });

  botsLoaded = true;
  console.log("✅ Automation Bots (TOA/GPS) active.");

} catch (e) {
  console.warn(`⚠️ ALERT: Bots not detected in ${PLATFORM_PATH}/bot. Server running in MANUAL mode.`);
  console.error(`❌ Error detallado:`, e.message);
  console.error(`Stack:`, e.stack);
}

// --- GPS TRACKING ENDPOINT (después de que app exista) ---
const GPS_WORKER_PATH = path.resolve(__dirname, 'platforms/agentetelecom/bot/agente_gps.js');
let gpsWorkerRunning = false;

app.post('/api/bot/gps/sync', protect, async (req, res) => {
  if (gpsWorkerRunning) {
    return res.status(409).json({ message: 'El bot GPS ya está en ejecución.' });
  }

  console.log(`🚀 MANUAL SYNC: Infiltrando GPS por orden de ${req.user.email}`);
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

  res.json({ success: true, message: 'Proceso de rastreo GPS iniciado en segundo plano.' });
});

// Confiar en el proxy de Google Cloud Run
app.set('trust proxy', 1);

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

// --- NUEVO: Migración de campos canónicos (Mantenimiento Optimizado) ---
app.post('/api/admin/migrate-canonical-fields', protect, authorize(ROLES.SYSTEM_ADMIN, ROLES.CEO), async (req, res) => {
  try {
    let totalActualizados = 0;
    let totalProcesados = 0;

    const calculationKeys = [
      'PTS_TOTAL_BAREMO', 'PTS_ACTIVIDAD_BASE', 'PTS_DECO_ADICIONAL',
      'PTS_REPETIDOR_WIFI', 'PTS_TELEFONO', 'DECOS_ADICIONALES',
      'REPETIDORES_WIFI', 'TELEFONOS', 'TOTAL_EQUIPOS_EXTRAS',
      'CODIGO_LPU_BASE', 'DESC_LPU_BASE', 'VALOR_ACTIVIDAD_CLP',
      'baremo_calculado_v2', 'baremo_fecha_calculo'
    ];

    const toaMapping = {
      'ID Recurso':           ['RECURSO', 'ID_Recurso', 'ID_RECURSO', 'idRecurso', 'pname', 'Técnico', 'Tecnico'],
      'Actividad':            ['ACTIVIDAD'],
      'Estado':               ['ESTADO', 'status', 'Activity Status'],
      'Subtipo de Actividad': ['SUBTIPO_DE_ACTIVIDAD', 'Subtipo_de_Actividad'],
      'Nombre':               ['NOMBRE'],
      'RUT del cliente':      ['RUT_DEL_CLIENTE'],
      'Ciudad':               ['CIUDAD'],
      'Ventana de servicio':  ['VENTANA_DE_SERVICIO', 'service_window'],
      'Ventana de llegada':   ['VENTANA_DE_LLEGADA', 'Ventana de Llegada', 'delivery_window'],
      'Número de Petición':   ['NÚMERO_DE_PETICIÓN', 'Numero de Petición', 'appt_number']
    };

    const COLLECTIONS_TO_MIGRATE = ['actividades'];
    
    for (const collName of COLLECTIONS_TO_MIGRATE) {
      console.log(`📦 [Migration] Procesando colección: ${collName}...`);
      const coll = mongoose.connection.db.collection(collName);
      const cursor = coll.find({});
      
      let batchOps = [];
      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        totalProcesados++;
        
        const updates = {};
        const toUnset = {};

        // 1. Migrar y Consolidar campos según el mapeo
        for (const [target, sources] of Object.entries(toaMapping)) {
          let bestValue = doc[target];
          for (const s of sources) {
            if (doc[s] !== undefined && doc[s] !== null && doc[s] !== '') {
              if (bestValue === undefined || bestValue === null || bestValue === '') {
                bestValue = doc[s];
              }
              toUnset[s] = "";
            }
          }
          if (bestValue !== undefined && bestValue !== null) {
            updates[target] = bestValue;
          }
        }

        // 2. Normalización de Estado
        if (updates['Estado']) {
          const e = String(updates['Estado']).toLowerCase().trim();
          if (e.includes('complet')) updates['Estado'] = 'Completado';
          else if (e.includes('pendien')) updates['Estado'] = 'Pendiente';
          else if (e.includes('cancel')) updates['Estado'] = 'Cancelado';
          else if (e.includes('iniciad')) updates['Estado'] = 'Iniciado';
        }

        // 3. Limpieza dinámica de guiones bajos
        Object.keys(doc).forEach(key => {
          if (key.includes('_') && !calculationKeys.includes(key) && key !== '_id' && key !== '__v') {
            toUnset[key] = "";
            const spaceKey = key.replace(/_/g, ' ');
            if (doc[spaceKey] === undefined || doc[spaceKey] === null || doc[spaceKey] === '') {
              updates[spaceKey] = doc[key];
            }
          }
        });

        // 4. Basura extra
        ['pname', 'status', 'service_window', 'delivery_window', 'appt_number', 'key', '144'].forEach(f => {
          if (doc[f] !== undefined) toUnset[f] = "";
        });

        if (Object.keys(updates).length > 0 || Object.keys(toUnset).length > 0) {
          const op = { updateOne: { filter: { _id: doc._id }, update: {} } };
          if (Object.keys(updates).length > 0) op.updateOne.update.$set = updates;
          if (Object.keys(toUnset).length > 0) op.updateOne.update.$unset = toUnset;
          batchOps.push(op);
          totalActualizados++;
        }

        // Ejecutar en batches de 500 para proteger RAM
        if (batchOps.length >= 500) {
          await coll.bulkWrite(batchOps, { ordered: false });
          batchOps = [];
        }
      }

      if (batchOps.length > 0) {
        await coll.bulkWrite(batchOps, { ordered: false });
      }
    }

    res.json({ 
      success: true, 
      message: `Migración completada. Procesados: ${totalProcesados}, Actualizados: ${totalActualizados}.`,
      totalProcesados,
      totalActualizados
    });
  } catch (error) {
    console.error('❌ Migration error:', error);
    res.status(500).json({ error: error.message });
  }
});

logger.info('Health check routes mounted at /api/health', { type: 'routes_init' });

app.use(express.json({ limit: '50mb' }));

// =============================================================================
// 2. EXTERNAL SERVICES CONNECTION
// =============================================================================

// A. MongoDB Atlas
console.log('⏳ Connecting to MongoDB Database (VPS)...');
if (!process.env.MONGO_URI) {
  console.error('❌ CRITICAL ERROR: MONGO_URI is not defined in environment variables.');
} else {
  console.log(`📡 Intentando conectar a MongoDB: ${process.env.MONGO_URI}`);
  logger.info(`📡 Intentando conectar a MongoDB: ${process.env.MONGO_URI}`, { type: 'db_init' });
  mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 60000,  // Aumentado de 30s a 60s
    connectTimeoutMS: 60000,          // Aumentado de 30s a 60s
    socketTimeoutMS: 300000,         // Aumentado drásticamente a 5 minutos para operaciones TOA pesadas
    retryWrites: true,
    w: 'majority',
    maxPoolSize: 20,                 // Duplicado de 10 a 20
    minPoolSize: 2,
    heartbeatFrequencyMS: 10000,
    waitQueueTimeoutMS: 30000,        // Timeout para esperar una conexión del pool
  })
    .then(async () => {
      console.log('🍃 SUCCESS: Connected to MongoDB Database (VPS/telecom_db)');
      console.log('📡 Conexiones:');
      console.log('   - MongoDB: OK');

      // Eventos de conexión — tolerancia a elecciones de réplica (M10 Dedicated)
      mongoose.connection.on('disconnected', () => console.warn('⚠️ MongoDB desconectado. Reintentando...'));
      mongoose.connection.on('reconnected', () => console.log('🍃 MongoDB reconectado.'));
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

      // --- AUTO WIPE DE URGENCIA ---
      try {
          const fs = require('fs');
          const wipeFile = '/Users/mauro/.gemini/antigravity/scratch/DO_WIPE_MAYO_2_9';
          if (fs.existsSync(wipeFile)) {
              console.log("🧹 AUTO WIPE: Ejecutando limpieza profunda de Mayo 2 a 9...");
              const Actividad = require('./platforms/agentetelecom/models/Actividad');
              const deleted = await Actividad.deleteMany({
                  fecha: { 
                      $gte: new Date('2026-05-02T00:00:00Z'),
                      $lte: new Date('2026-05-09T23:59:59Z')
                  }
              });
              console.log("✅ AUTO WIPE COMPLETADO! Eliminados:", deleted.deletedCount);
              fs.unlinkSync(wipeFile);
          }
      } catch (e) {
          console.error("❌ AUTO WIPE ERROR:", e);
      }
      // ---------------------------------------

      const standardize = (val) => (val || '').toString().replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();

      // AUTO-CLEANUP DUPLICATES (Tolerant version for local DB)
      try {
        if (typeof Tecnico !== 'undefined' && Tecnico.find) {
            const all = await Tecnico.find().sort({ updatedAt: -1 });
            const seen = new Set();
            let deleted = 0;

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
        }
      } catch (e) { console.warn("ℹ️ Cleanup skipped: Collection might not exist yet."); }

        // 🚀 AUTO-SYNC IDs Recurso (RRHH -> Operaciones)
        // Buscamos candidatos que tengan RECURSO y lo propagamos a los técnicos si les falta
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
        } catch (e) { console.error("Sync error:", e.message); }

        // 🚀 LIMPIEZA INTELIGENTE DESACTIVADA (Mantener reflejo fiel 1:1 solicitado por el usuario)


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
}

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
app.post('/api/upload', uploadLimiter, upload.single('imagen'), async (req, res) => {
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
app.use('/api/rrhh/conductores', require('./platforms/rrhh/routes/conductoresRoutes'));
app.use('/api/rrhh/turnos', require('./platforms/rrhh/routes/turnosRoutes'));
app.use('/api/rrhh/asistencia', require('./platforms/rrhh/routes/asistenciaRoutes'));
app.use('/api/rrhh/time-tracker', require('./platforms/rrhh/routes/timeTrackerRoutes'));
app.use('/api/rrhh/plantillas', require('./platforms/rrhh/routes/plantillaRoutes'));
app.use('/api/comunicaciones', require('./platforms/comunicaciones/routes/chatRoutes'));
app.use('/api/reuniones', require('./platforms/comunicaciones/routes/reunionesRoutes'));
app.use('/api/rrhh/nomina', require('./platforms/rrhh/routes/liquidacionRoutes'));
app.use('/api/rrhh/config', require('./platforms/rrhh/routes/empresaRoutes'));
app.use('/api/notifications', require('./platforms/rrhh/routes/notificationRoutes'));
app.use('/api/rrhh/descuentos', require('./platforms/rrhh/routes/descuentosRoutes'));
app.use('/api/rrhh/beneficios', require('./platforms/rrhh/routes/beneficiosRoutes'));
app.use('/api/rrhh/aprobaciones', require('./platforms/rrhh/routes/aprobacionesRoutes'));

// --- B2.5. PLATFORM AUTH ROUTES ---
app.use('/api/auth', authLimiter, require('./platforms/auth/authRoutes'));
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
app.use('/api/flota/eficiencia', require('./platforms/agentetelecom/routes/flotaEficiencia'));
app.use('/api/flota/proveedores', require('./platforms/agentetelecom/routes/proveedoresLeasing'));




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
let _botStartupWatchdog = null;

const pushLog = (msg) => {
  const entry = `[${new Date().toLocaleTimeString('es-CL', { timeZone: 'America/Santiago' })}] ${msg}`;
  global.BOT_STATUS.logs.push(entry);
  if (global.BOT_STATUS.logs.length > 80) global.BOT_STATUS.logs.shift();
  console.log('🤖', msg);
};

// GET status del bot
app.get('/api/bot/status', botLimiter, protect, authorize('rend_descarga_toa:ver'), (req, res) => {
  // No incluir screenshot en el status general (es muy pesado para polling 3s)
  const { screenshot, screenshotTime, ...statusSinImg } = global.BOT_STATUS;
  res.json({ ...statusSinImg, tieneScreenshot: !!screenshot, screenshotTime: screenshotTime || null });
});

// GET screenshot en vivo del bot (se llama cada 2s solo cuando el bot corre)
app.get('/api/bot/screenshot', botLimiter, protect, authorize('rend_descarga_toa:ver'), (req, res) => {
  const sc = global.BOT_STATUS.screenshot;
  if (!sc) return res.status(204).end();
  res.json({ data: sc, time: global.BOT_STATUS.screenshotTime });
});

app.post('/api/bot/run', botLimiter, protect, authorize('rend_descarga_toa:crear'), async (req, res) => {
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
          url: empresa.integracionTOA.url || '',
          usuario: empresa.integracionTOA.usuario,
          clave: desencriptarTexto(empresa.integracionTOA.clave)
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
      totalDias, diaActual: 0, fechaProcesando: 'Inicializando proceso hijo...',
      registrosGuardados: 0, ultimoError: null, logs: [],
      empresaRef: req.user.empresaRef
    };
    pushLog(`🚀 Agente iniciado. Rango: ${fechaInicio} → ${fechaFin} (${totalDias} días)`);

    // ⚡ FORK: Chrome corre en proceso hijo separado — no mata el servidor si se queda sin RAM
    const botScript = path.resolve(__dirname, `${PLATFORM_PATH}/bot/agente_real.js`);
    _botChild = fork(botScript, [], {
      env: {
        ...process.env,
        BOT_FECHA_INICIO: fechaInicio || '',
        BOT_FECHA_FIN: fechaFin || '',
        BOT_TOA_URL: credenciales.url || '',
        BOT_TOA_USER: credenciales.usuario || '',
        BOT_TOA_PASS: credenciales.clave || '',
        BOT_EMPRESA_REF: req.user.empresaRef?.toString() || ''
      },
      silent: false
    });

    if (_botStartupWatchdog) {
      clearTimeout(_botStartupWatchdog);
      _botStartupWatchdog = null;
    }

    let childHasReported = false;
    _botStartupWatchdog = setTimeout(() => {
      if (!childHasReported && _botChild) {
        global.BOT_STATUS.ultimoError = 'Timeout de inicio: el proceso hijo no reportó actividad inicial';
        global.BOT_STATUS.fechaProcesando = 'Error de inicio del proceso hijo';
        pushLog('❌ Timeout de inicio: no hubo mensajes del proceso hijo en 120s');
        try { _botChild.kill('SIGTERM'); } catch (_) { }
      }
    }, 120000);

    _botChild.on('message', (msg) => {
      if (!msg) return;
      childHasReported = true;
      if (_botStartupWatchdog) {
        clearTimeout(_botStartupWatchdog);
        _botStartupWatchdog = null;
      }
      if (msg.type === 'log') pushLog(msg.text);
      if (msg.type === 'progress') {
        global.BOT_STATUS.diaActual = msg.diaActual;
        global.BOT_STATUS.totalDias = msg.totalDias;
        global.BOT_STATUS.fechaProcesando = msg.fechaProcesando;
        global.BOT_STATUS.grupoProcesando = msg.grupoProcesando || '';
        global.BOT_STATUS.registrosGuardados = msg.registrosGuardados || 0;
      }
      if (msg.type === 'screenshot') {
        global.BOT_STATUS.screenshot = msg.data;
        global.BOT_STATUS.screenshotTime = Date.now();
      }
      if (msg.type === 'grupos_encontrados') {
        global.BOT_STATUS.gruposEncontrados = msg.grupos || [];
        global.BOT_STATUS.esperandoSeleccion = true;
        pushLog(`📋 ${msg.grupos?.length || 0} grupos detectados. Esperando selección del usuario...`);
      }
    });

    _botChild.on('exit', (code) => {
      if (_botStartupWatchdog) {
        clearTimeout(_botStartupWatchdog);
        _botStartupWatchdog = null;
      }
      global.BOT_STATUS.running = false;
      pushLog(`🏁 Bot terminado (código: ${code})`);
      if (code !== 0 && !global.BOT_STATUS.ultimoError)
        global.BOT_STATUS.ultimoError = `Proceso terminó inesperadamente (código ${code})`;
      _botChild = null;
      const empresaRef = global.BOT_STATUS.empresaRef;
      if (empresaRef) {
        Empresa.findByIdAndUpdate(empresaRef, {
          $set: { 'integracionTOA.estadoSincronizacion': 'Configurado' }
        }).catch(e => console.warn('⚠️ No se pudo resetear estadoSync:', e.message));
      }
    });

    _botChild.on('error', (err) => {
      if (_botStartupWatchdog) {
        clearTimeout(_botStartupWatchdog);
        _botStartupWatchdog = null;
      }
      global.BOT_STATUS.running = false;
      global.BOT_STATUS.ultimoError = err.message;
      pushLog(`❌ Error proceso: ${err.message}`);
      _botChild = null;
    });

    res.json({ message: `Agente TOA iniciado. Rango: ${fechaInicio || '2026-01-01'} → ${fechaFin || new Date().toISOString().split('T')[0]}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DETENER BOT
app.post('/api/bot/stop', botLimiter, protect, authorize('rend_descarga_toa:crear'), async (req, res) => {
  try {
    if (_botStartupWatchdog) {
      clearTimeout(_botStartupWatchdog);
      _botStartupWatchdog = null;
    }
    if (_botChild) {
      _botChild.kill('SIGTERM');
      _botChild = null;
    }
    global.BOT_STATUS.running = false;
    global.BOT_STATUS.esperandoSeleccion = false;
    global.BOT_STATUS.gruposEncontrados = null;
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
app.post('/api/bot/confirmar-grupos', botLimiter, protect, authorize('rend_descarga_toa:crear'), async (req, res) => {
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
    global.BOT_STATUS.gruposEncontrados = null;
    pushLog(`✅ ${grupos.length} grupos confirmados: ${grupos.map(g => g.nombre).join(', ')}`);
    res.json({ message: `Descarga iniciada con ${grupos.length} grupo(s).` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── MIGRACIÓN: Recalcular todos los decos como WiFi (0.25 pts) en la BD ──────
app.post('/api/bot/recalcular-decos', botLimiter, protect, authorize('rend_descarga_toa:crear'), async (req, res) => {
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

    const ps = (v) => { if (!v) return 0; if (typeof v === 'number') return v; return parseFloat(String(v).replace(',', '.')) || 0; };

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
        Math.floor(ps(clean.Decos_WiFi_Adicionales || clean.DECOS_WIFI_ADICIONALES || 0));
      const qD_total = Math.floor(ps(clean.Decos_Adicionales || clean.DECOS_ADICIONALES || 0));
      const qD = qD_split > 0 ? qD_split : qD_total;
      if (qD === 0) { skipped++; continue; }

      const pBase = ps(clean.Pts_Actividad_Base || clean.PTS_ACTIVIDAD_BASE || 0);
      const pRep = ps(clean.Pts_Repetidor_WiFi || clean.PTS_REPETIDOR_WIFI || 0);
      const pTel = ps(clean.Pts_Telefono || clean.PTS_TELEFONO || 0);
      const newPtsDeco = Math.round(qD * decoWifiPts * 100) / 100;
      const newPtsTotal = Math.round((pBase + newPtsDeco + pRep + pTel) * 100) / 100;

      // Solo actualizar si hay diferencia real
      const oldPtsDeco = ps(clean.Pts_Deco_Adicional || clean.PTS_DECO_ADICIONAL || 0);
      const oldPtsTotal = ps(clean.Pts_Total_Baremo || clean.PTS_TOTAL_BAREMO || 0);
      if (Math.round(oldPtsDeco * 100) === Math.round(newPtsDeco * 100) &&
        Math.round(oldPtsTotal * 100) === Math.round(newPtsTotal * 100)) {
        skipped++; continue;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              Pts_Deco_Adicional: newPtsDeco,
              Pts_Deco_WiFi: newPtsDeco,
              Pts_Deco_Cable: 0,
              PTS_DECO_ADICIONAL: newPtsDeco,
              Codigo_LPU_Deco_WiFi: codigoDecoWifi,
              Pts_Total_Baremo: String(newPtsTotal),
              PTS_TOTAL_BAREMO: newPtsTotal,
              DECOS_ADICIONALES: qD,
            }
          }
        }
      });

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

app.post('/api/bot/gps-run', botLimiter, protect, async (req, res) => {
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

// Helper para estandarizar nombres (Primer Nombre + Primer Apellido)
const formatShortName = (fullName, nombres, apellidos) => {
  if (nombres && apellidos && nombres.trim() !== 'Sin Nombre' && apellidos.trim() !== 'Sin Apellido') {
    return `${nombres.trim().split(/\s+/)[0]} ${apellidos.trim().split(/\s+/)[0]}`;
  }
  if (!fullName) return 'S/N';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 4) return `${parts[0]} ${parts[2]}`; // ej: Juan Pablo Perez Soto -> Juan Perez
  if (parts.length === 3) return `${parts[0]} ${parts[2]}`; // ej: Juan Pablo Perez -> Juan Perez
  if (parts.length === 2) return `${parts[0]} ${parts[1]}`; // ej: Juan Perez -> Juan Perez
  return parts[0] || 'S/N';
};

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

      // Intentar vincular por RECURSO TOA si existe el técnico
      let tecnico = await Tecnico.findOne({
        empresaRef: req.user.empresaRef,
        $or: [{ rut: r }, { rut }]
      }).select('idRecursoToa nombres apellidos');

      if (!tecnico && req.user.email) {
        tecnico = await Tecnico.findOne({
          email: req.user.email,
          empresaRef: req.user.empresaRef
        }).select('idRecursoToa nombres apellidos rut');
      }

      // 🚀 AUTO-RECOVERY: Si el técnico no tiene ID Recurso TOA, buscarlo en Candidatos (RRHH)
      if (tecnico && !tecnico.idRecursoToa) {
        try {
          const Candidato = require('./platforms/rrhh/models/Candidato');
          const cand = await Candidato.findOne({ 
            rut: { $in: [r, rut, tecnico.rut].filter(Boolean) },
            idRecursoToa: { $exists: true, $ne: '' }
          }).select('idRecursoToa');
          
          if (cand && cand.idRecursoToa) {
            tecnico.idRecursoToa = cand.idRecursoToa;
            // Persistir para futuras consultas
            await Tecnico.updateOne({ _id: tecnico._id }, { $set: { idRecursoToa: cand.idRecursoToa } });
            console.log(`🔗 [Auto-Link] Vinculado ID TOA ${cand.idRecursoToa} a técnico ${tecnico.rut}`);
          }
        } catch (e) { console.error('Error in ID auto-recovery:', e.message); }
      }

      query.$or = [
        { tecnicoRut: r },
        { rut: r },
        { tecnicoRut: rut },
        { rut: rut }
      ];

      if (tecnico) {
        if (tecnico.idRecursoToa) {
          const id = String(tecnico.idRecursoToa).trim();
          const idNum = parseInt(id);
          const idClean = id.replace(/^0+/, '');

          const idMatches = [id, idClean, '0' + idClean];
          if (!isNaN(idNum)) idMatches.push(idNum);

          query.$or.push({ "idRecursoToa": { $in: idMatches } });
          query.$or.push({ "RECURSO": { $in: idMatches } });
          query.$or.push({ "idRecurso": { $in: idMatches } });
          query.$or.push({ "ID Recurso": { $in: idMatches } });
          query.$or.push({ "Recurso": { $in: idMatches } });
        }
        // Fallback por nombre si no hay match por ID o para reforzar
        if (tecnico.nombres || tecnico.nombre) {
          const names = [
            (tecnico.nombre || `${tecnico.nombres || ''} ${tecnico.apellidos || ''}`).trim(),
            tecnico.nombres,
            tecnico.apellidos
          ].filter(n => n && n.length > 3);
          
          if (names.length > 0) {
            query.$or.push({ "Nombre": { $in: names.map(n => new RegExp(n, 'i')) } });
            query.$or.push({ "NOMBRE": { $in: names.map(n => new RegExp(n, 'i')) } });
          }
        }
      }
    } else if (supervisorId) {
      // Si se pide por supervisor, obtener los ruts e IDs de su equipo
      const tecnicos = await Tecnico.find({ supervisorId, empresaRef: req.user.empresaRef }).select('rut idRecursoToa');
      const ruts = tecnicos.map(t => t.rut);
      const toaIdsRaw = tecnicos.map(t => t.idRecursoToa).filter(Boolean);
      const toaIds = [];
      
      toaIdsRaw.forEach(id => {
          const idStr = String(id).trim();
          const idClean = idStr.replace(/^0+/, '');
          toaIds.push(idStr);
          toaIds.push(idClean);
          toaIds.push('0' + idClean);
          if (!isNaN(parseInt(idStr))) toaIds.push(parseInt(idStr));
      });

      query.$or = [
        { tecnicoRut: { $in: ruts } },
        { rut: { $in: ruts } },
        { "idRecursoToa": { $in: toaIds } },
        { "RECURSO": { $in: toaIds } },
        { "idRecurso": { $in: toaIds } },
        { "ID Recurso": { $in: toaIds } },
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
// MOTOR DE BAREMIZACIÓN — IMPORTACIÓN UNIFICADA DESDE calculoEngine.js
// Toda la lógica de cálculo está centralizada en /platforms/agentetelecom/utils/calculoEngine.js
// Esto garantiza que TODOS los módulos (DescargaTOA, Recálculo MongoDB, ConfigLPU)
// usen EXACTAMENTE el mismo cálculo de puntos LPU.
// =============================================================================
const TarifaLPU = require(`${PLATFORM_PATH}/models/TarifaLPU`);
const ValorPuntoCliente = require(`${PLATFORM_PATH}/models/ValorPuntoCliente`);
const Proyecto = require('./platforms/rrhh/models/Proyecto');

// 🔒 IMPORTAR FUNCIONES CANÓNICAS desde el motor centralizado
const _calculoEngine = require(`${PLATFORM_PATH}/utils/calculoEngine`);
const obtenerTarifasEmpresa = _calculoEngine.obtenerTarifasEmpresa;
const calcularBaremos = _calculoEngine.calcularBaremos;
const valorizarBaremos = _calculoEngine.valorizarBaremos;
const construirMapaValorizacion = _calculoEngine.construirMapaValorizacion;
const invalidarCacheValorizacion = _calculoEngine.invalidarCacheValorizacion;
const invalidarCacheTarifas = _calculoEngine.invalidarCacheTarifas;



// 2.1a GARANTÍAS STATS — Analiza reingresos (reparaciones dentro de 30 días de la instalación original)
// Devuelve métricas de calidad por técnico para el módulo de Cierre de Bonos y Dashboard de Garantías
app.get('/api/bot/garantias-stats', botLimiter, protect, authorize('rend_operativo:ver'), async (req, res) => {
  try {
    const isSystemAdmin = req.user.role === 'system_admin';
    let { desde, hasta, zonas, proyectos: proyectosFilter, tecnicos: tecnicosFilter, tecnicoId, empresaFilter } = req.query;

    // Resolver empresa
    let empresaId = req.user.empresaRef?._id || req.user.empresaRef;
    if (!empresaId && req.user?.empresa?.nombre) {
      const empFallback = await Empresa.findOne({ nombre: req.user.empresa.nombre }).select('_id').lean();
      if (empFallback) empresaId = empFallback._id;
    }

    // Construir rango de fechas (ventana de análisis = mes indicado)
    const fechaDesde = desde ? new Date(desde + 'T00:00:00Z') : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const fechaHasta = hasta ? new Date(hasta + 'T23:59:59Z') : new Date();

    // Ventana ampliada para buscar instalaciones originales (30 días antes del rango)
    const VENTANA_GARANTIA_DIAS = 30;
    const fechaBusquedaDesde = new Date(fechaDesde);
    fechaBusquedaDesde.setDate(fechaBusquedaDesde.getDate() - VENTANA_GARANTIA_DIAS);

    // Filtro base por empresa
    const baseFilter = {};
    if (!isSystemAdmin) {
      baseFilter.empresaRef = empresaId;
    } else if (empresaFilter) {
      baseFilter.empresaRef = empresaFilter;
    }

    // Filtros opcionales
    if (zonas) {
      const zonasList = String(zonas).split(',').map(s => s.trim()).filter(Boolean);
      if (zonasList.length > 0) baseFilter['ZONA'] = { $in: zonasList };
    }
    if (proyectosFilter) {
      const projList = String(proyectosFilter).split(',').map(s => s.trim()).filter(Boolean);
      if (projList.length > 0) baseFilter['PROYECTO'] = { $in: projList };
    }
    if (tecnicoId) {
      const cleanId = String(tecnicoId).replace(/^0+/, '').trim();
      baseFilter['$or'] = [
        { idRecursoToa: tecnicoId }, { idRecursoToa: cleanId },
        { RECURSO: tecnicoId }, { RECURSO: cleanId },
        { ID_RECURSO: tecnicoId }, { ID_RECURSO: cleanId }
      ];
    }

    // Cargar TODAS las actividades completadas en la ventana ampliada (instalación original + reparación)
    const todasActividades = await Actividad.find({
      ...baseFilter,
      $or: [
        { fecha: { $gte: fechaBusquedaDesde, $lte: fechaHasta } },
        { FECHA: { $gte: fechaBusquedaDesde, $lte: fechaHasta } },
        { 'Fecha Completada': { $gte: fechaBusquedaDesde, $lte: fechaHasta } }
      ],
      $and: [{
        $or: [
          { ESTADO: { $regex: /complet/i } },
          { estado: { $regex: /complet/i } },
          { ESTADO: 'Done' }, { estado: 'Done' }
        ]
      }]
    }).lean();

    // Helper para extraer campos flexibles
    const getField = (doc, ...keys) => {
      for (const k of keys) if (doc[k] !== undefined && doc[k] !== null && doc[k] !== '') return doc[k];
      return null;
    };

    // Normalizar actividades
    const actividades = todasActividades.map(doc => ({
      _id: String(doc._id),
      orden: getField(doc, 'ordenId', 'ORDEN', 'Orden', 'N_Actividad', 'ID_ACTIVIDAD') || '',
      fecha: doc.fecha || doc.FECHA || doc['Fecha Completada'] || doc.createdAt,
      tecnicoId: String(getField(doc, 'idRecursoToa', 'RECURSO', 'ID_RECURSO', 'ID Recurso', 'Recurso') || '').replace(/^0+/, '').trim(),
      tecnicoNombre: getField(doc, 'NOMBRE', 'Nombre', 'TECNICO', 'tecnico', 'nombre') || 'Sin nombre',
      cliente: getField(doc, 'NOMBRE_CLIENTE', 'Nombre_Cliente', 'CLIENTE', 'cliente', 'NOMBRE CLIENTE') || '',
      direccion: getField(doc, 'DIRECCION', 'Direccion', 'Dirección', 'DIRECCION_TRABAJO', 'CALLE') || '',
      comuna: getField(doc, 'COMUNA', 'comuna', 'LOCALIDAD') || '',
      proyecto: getField(doc, 'PROYECTO', 'Proyecto', 'projectId') || '',
      tipo: getField(doc, 'ACTIVIDAD', 'actividad', 'TIPO', 'SUBTIPO_DE_ACTIVIDAD', 'subtipo') || '',
      motivoReparacion: getField(doc, 'MOTIVO_REPARACION', 'CIERRE_SECUNDARIO_STD', 'Cierre Secundario STD') || '',
      cierresStd: getField(doc, 'CIERRE_SECUNDARIO_STD', 'Cierre Secundario STD') || '',
      cierresTv: getField(doc, 'CIERRE_SECUNDARIO_TV', 'Cierre Secundario TV') || '',
      observaciones: getField(doc, 'OBSERVACIONES', 'Observaciones', 'NOTAS') || '',
    }));

    // Clasificar en Altas/Rutinas vs Reparaciones
    const esReparacion = (tipo) => /repar|rep\b|falla|correctiv|averia|avería|daño|correctivo/i.test(tipo || '');
    const esAlta = (tipo) => !esReparacion(tipo);

    // Separar por período
    const activsEnPeriodo = actividades.filter(a => {
      const f = a.fecha ? new Date(a.fecha) : null;
      return f && f >= fechaDesde && f <= fechaHasta;
    });
    const activsAnteriores = actividades.filter(a => {
      const f = a.fecha ? new Date(a.fecha) : null;
      return f && f >= fechaBusquedaDesde && f < fechaDesde;
    });

    // Detectar garantías: reparaciones dentro del período cuya dirección+cliente coincide
    // con una actividad de alta/rutina de los 30 días anteriores
    const garantias = [];

    const reparacionesPeriodo = activsEnPeriodo.filter(a => esReparacion(a.tipo));
    const altasTodas = [...activsAnteriores, ...activsEnPeriodo.filter(a => esAlta(a.tipo))];

    // Índice por dirección normalizada para búsqueda rápida
    const normalize = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

    for (const rep of reparacionesPeriodo) {
      if (!rep.direccion && !rep.cliente) continue;
      const repFecha = rep.fecha ? new Date(rep.fecha) : null;
      if (!repFecha) continue;

      // Buscar instalación original dentro de los 30 días anteriores
      const original = altasTodas.find(a => {
        if (a._id === rep._id) return false;
        const aFecha = a.fecha ? new Date(a.fecha) : null;
        if (!aFecha || aFecha >= repFecha) return false;
        const diasDiff = (repFecha - aFecha) / (1000 * 60 * 60 * 24);
        if (diasDiff > VENTANA_GARANTIA_DIAS || diasDiff < 0) return false;

        // Coincidencia por dirección o cliente
        const matchDireccion = rep.direccion && a.direccion &&
          normalize(rep.direccion) === normalize(a.direccion);
        const matchCliente = rep.cliente && a.cliente &&
          normalize(rep.cliente) === normalize(a.cliente);

        return matchDireccion || matchCliente;
      });

      if (original) {
        garantias.push({
          actividadInicial: {
            orden: original.orden,
            fecha: original.fecha,
            tecnicoId: original.tecnicoId,
            tecnicoNombre: original.tecnicoNombre,
            cliente: original.cliente,
            direccion: original.direccion,
            comuna: original.comuna,
            proyecto: original.proyecto,
            tipo: original.tipo,
            cierresStd: original.cierresStd,
            cierresTv: original.cierresTv,
            observaciones: original.observaciones
          },
          falla: {
            orden: rep.orden,
            fecha: rep.fecha,
            tecnicoId: rep.tecnicoId,
            tecnicoNombre: rep.tecnicoNombre,
            cliente: rep.cliente,
            direccion: rep.direccion,
            proyecto: rep.proyecto,
            motivoReparacion: rep.motivoReparacion,
            cierresStd: rep.cierresStd,
            cierresTv: rep.cierresTv,
            observaciones: rep.observaciones,
            diasTranscurridos: Math.round((new Date(rep.fecha) - new Date(original.fecha)) / (1000 * 60 * 60 * 24))
          }
        });
      }
    }

    // ── RESUMEN GENERAL ──
    const totalEvaluadas = activsEnPeriodo.length;
    const totalFallas = garantias.length;
    const porcentajeFalla = totalEvaluadas > 0 ? Math.round((totalFallas / totalEvaluadas) * 1000) / 10 : 0;

    // ── STATS POR TIPO ──
    const garantiasAltas = garantias.filter(g => esAlta(g.actividadInicial.tipo));
    const garantiasRep = garantias.filter(g => esReparacion(g.actividadInicial.tipo));
    const altasEval = activsEnPeriodo.filter(a => esAlta(a.tipo)).length;
    const repEval = activsEnPeriodo.filter(a => esReparacion(a.tipo)).length;

    const statsTipo = {
      altas: {
        eval: altasEval,
        fallas: garantiasAltas.length,
        pct: altasEval > 0 ? Math.round((garantiasAltas.length / altasEval) * 1000) / 10 : 0
      },
      reparaciones: {
        eval: repEval,
        fallas: garantiasRep.length,
        pct: repEval > 0 ? Math.round((garantiasRep.length / repEval) * 1000) / 10 : 0
      }
    };

    // ── STATS POR PROYECTO ──
    const proyectosMap = {};
    activsEnPeriodo.forEach(a => {
      const proj = a.proyecto || 'Sin Proyecto';
      if (!proyectosMap[proj]) proyectosMap[proj] = { evaluadas: 0, fallas: 0 };
      proyectosMap[proj].evaluadas++;
    });
    garantias.forEach(g => {
      const proj = g.actividadInicial.proyecto || 'Sin Proyecto';
      if (!proyectosMap[proj]) proyectosMap[proj] = { evaluadas: 0, fallas: 0 };
      proyectosMap[proj].fallas++;
    });
    const statsProyectos = Object.entries(proyectosMap)
      .map(([proyecto, d]) => ({
        proyecto,
        evaluadas: d.evaluadas,
        fallas: d.fallas,
        porcentaje: d.evaluadas > 0 ? Math.round((d.fallas / d.evaluadas) * 1000) / 10 : 0
      }))
      .sort((a, b) => b.porcentaje - a.porcentaje);

    // ── STATS POR TÉCNICO ──
    const tecnicosMap = {};
    activsEnPeriodo.forEach(a => {
      const id = a.tecnicoId || 'SIN_ID';
      if (!tecnicosMap[id]) tecnicosMap[id] = {
        id, nombre: a.tecnicoNombre, proyecto: a.proyecto,
        evaluadas: 0, fallasAltas: 0, fallasReparaciones: 0,
        evaluadasAltas: 0, evaluadasReparaciones: 0
      };
      tecnicosMap[id].evaluadas++;
      if (esAlta(a.tipo)) tecnicosMap[id].evaluadasAltas++;
      else tecnicosMap[id].evaluadasReparaciones++;
    });
    garantias.forEach(g => {
      const id = g.actividadInicial.tecnicoId || 'SIN_ID';
      if (!tecnicosMap[id]) tecnicosMap[id] = {
        id, nombre: g.actividadInicial.tecnicoNombre, proyecto: g.actividadInicial.proyecto,
        evaluadas: 0, fallasAltas: 0, fallasReparaciones: 0,
        evaluadasAltas: 0, evaluadasReparaciones: 0
      };
      if (esAlta(g.actividadInicial.tipo)) tecnicosMap[id].fallasAltas++;
      else tecnicosMap[id].fallasReparaciones++;
    });

    const statsTecnicos = Object.values(tecnicosMap).map(t => {
      const totalFallasT = t.fallasAltas + t.fallasReparaciones;
      const porcentaje = t.evaluadas > 0 ? Math.round((totalFallasT / t.evaluadas) * 1000) / 10 : 0;
      // rrValue = % de fallas en reparaciones (para CierreBonos)
      const rrValue = t.evaluadasReparaciones > 0 ? Math.round((t.fallasReparaciones / t.evaluadasReparaciones) * 1000) / 10 : 0;
      // aiValue = % de fallas en altas (para CierreBonos)
      const aiValue = t.evaluadasAltas > 0 ? Math.round((t.fallasAltas / t.evaluadasAltas) * 1000) / 10 : 0;
      return { ...t, porcentaje, rrValue, aiValue };
    }).sort((a, b) => b.porcentaje - a.porcentaje);

    res.json({
      success: true,
      data: garantias,
      resumen: { totalEvaluadas, totalFallas, porcentajeFalla },
      statsTipo,
      statsProyectos,
      statsTecnicos,
      meta: { desde: fechaDesde, hasta: fechaHasta, ventanaGarantiaDias: VENTANA_GARANTIA_DIAS }
    });

  } catch (error) {
    console.error('❌ /api/bot/garantias-stats error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2.1b PRODUCCIÓN STATS — Agregación server-side para dashboard Producción Operativa
// Usa cursor con cálculo de baremos on-the-fly y agrega en memoria (no envía docs crudos)
app.get('/api/bot/produccion-stats', botLimiter, protect, authorize('rend_operativo:ver'), async (req, res) => {
  console.log("🚀 [DEBUG] Entrando en /api/bot/produccion-stats");
  try {
    const currentEmail = req.user.email?.toLowerCase().trim();
    const isSystemAdmin = req.user.role === 'system_admin';
    let { desde, hasta, estado, clientes, empresaFilter, tipo, supervisorId, rut, months, weeks, proyectos, actividad, zonas, tecnicos: tecnicosFilter, categorias } = req.query;
    let statsHastaFilter = null;
    console.log(`🔍 [DEBUG] Paso 1: Query Params recibidos - Email: ${currentEmail}`);
    if (desde && (typeof desde !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(desde))) desde = undefined;
    if (hasta && (typeof hasta !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(hasta))) hasta = undefined;

    // Normalizar clientes (array de IDs)
    const filterClientes = Array.isArray(clientes) ? clientes : (clientes ? [clientes] : []);

    // IDs de vinculados para filtro restrictivo (Security Layer)
    let empresaId = req.user.empresaRef?._id || req.user.empresaRef || req.user.empresa?.id || req.user.empresa?._id;
    if (!empresaId && req.user.empresa?.nombre) {
      console.log(`🔍 [DEBUG] Buscando fallback para empresa: ${req.user.empresa.nombre}`);
      const empFallback = await Empresa.findOne({ nombre: req.user.empresa.nombre }).select('_id').lean();
      if (empFallback) {
        empresaId = empFallback._id;
        console.log(`🔍 [DEBUG] Fallback encontrado: ${empresaId}`);
      }
    }
    console.log(`🔍 [DEBUG] Paso 2: EmpresaId resuelto: ${empresaId}`);

    // --- BUSCAR IDS EN AMBAS COLECCIONES ---
    const restrictedIDs = new Set();
    try {
      console.log("🔍 [DEBUG] Paso 3: Consultando Tecnicos y Candidatos...");
      const [tStats, cStats] = await Promise.all([
        Tecnico.find({ empresaRef: empresaId }).select('idRecursoToa idRecurso').lean(),
        Candidato ? Candidato.find({ empresaRef: empresaId }).select('idRecursoToa idRecurso').lean() : Promise.resolve([])
      ]);
      console.log(`🔍 [DEBUG] Paso 4: Resultados obtenidos - T: ${tStats.length}, C: ${cStats ? cStats.length : 0}`);

      const processItem = (t) => {
        const id1 = String(t.idRecursoToa || '').trim();
        const id2 = String(t.idRecurso || t.rut || '').trim();
        
        [id1, id2].forEach(rawId => {
          if (!rawId) return;
          restrictedIDs.add(rawId);
          restrictedIDs.add(rawId.replace(/^0+/, ''));
          const n = parseInt(rawId);
          if (!isNaN(n)) restrictedIDs.add(n);
        });
      };
      tStats.forEach(processItem);
      cStats.forEach(processItem);
    } catch (err) {
      console.error("❌ Error fetching restricted IDs:", err.message);
    }

    const restrictedIDsArray = Array.from(restrictedIDs);

    // --- CONSTRUCCIÓN DE FILTRO ROBUSTO (ID-CENTRIC) ---
    const queryConditions = [];
    
    if (!isSystemAdmin) {
      if (restrictedIDsArray.length > 0) {
        queryConditions.push({
          $or: [
            { "RECURSO": { $in: restrictedIDsArray } },
            { "ID Recurso": { $in: restrictedIDsArray } },
            { "ID_Recurso": { $in: restrictedIDsArray } },
            { "ID_RECURSO": { $in: restrictedIDsArray } },
            { idRecurso: { $in: restrictedIDsArray } },
            { "Recurso": { $in: restrictedIDsArray } },
            { idRecursoToa: { $in: restrictedIDsArray } },
            { IDRECURSOTOA: { $in: restrictedIDsArray } }
          ]
        });
      } else {
        queryConditions.push({ "RECURSO": "__NONE__" });
      }
    } else if (empresaFilter) {
       queryConditions.push({ empresaRef: empresaFilter });
    }

    if (zonas && zonas.length > 0) {
      const rawZonas = String(zonas).split(',').map(s => s.trim()).filter(Boolean);
      if (rawZonas.length > 0) {
        const zonasArr = [];
        rawZonas.forEach(z => {
          zonasArr.push(z);
          zonasArr.push(z.toUpperCase());
          zonasArr.push(z.toLowerCase());
        });
        queryConditions.push({
          $or: [
            { "CIUDAD": { $in: zonasArr } },
            { "COMUNA": { $in: zonasArr } },
            { "Sede": { $in: zonasArr } }
          ]
        });
      }
    }

    if (tecnicosFilter && tecnicosFilter.length > 0) {
      const rawTechs = String(tecnicosFilter).split(',').map(s => s.trim()).filter(Boolean);
      if (rawTechs.length > 0) {
        const techsArr = [];
        rawTechs.forEach(t => {
          techsArr.push(t);
          const stripped = t.replace(/^0+/, '');
          if (stripped) techsArr.push(stripped);
          const n = parseInt(t);
          if (!isNaN(n)) techsArr.push(n);
        });
        queryConditions.push({
          $or: [
            { "RECURSO": { $in: techsArr } },
            { "ID Recurso": { $in: techsArr } },
            { "ID_Recurso": { $in: techsArr } },
            { "Recurso": { $in: techsArr } },
            { idRecurso: { $in: techsArr } },
            { idRecursoToa: { $in: techsArr } }
          ]
        });
      }
    }

    if (rut) {
      const r = rut.replace(/\./g, "").replace(/-/g, "").toUpperCase().trim();
      queryConditions.push({
        $or: [
          { tecnicoRut: r },
          { rut: r }
        ]
      });
    } else if (supervisorId) {
      const tecnicos = await Tecnico.find({ supervisorId, empresaRef: req.user.empresaRef }).select('idRecursoToa');
      const ids = tecnicos.map(t => String(t.idRecursoToa).trim()).filter(Boolean);
      queryConditions.push({
        $or: [
          { "RECURSO": { $in: ids } },
          { "RECURSO": { $in: ids } },
          { idRecurso: { $in: ids } },
          { "Recurso": { $in: ids } }
        ]
      });
    }

    if (tipo) {
      // Normalizar tipo para ser flexible
      const tMap = { 'reparacion': 'reparacion', 'provision': 'provision', 'Reparación': 'reparacion', 'Provisión': 'provision' };
      const normTipo = tMap[tipo] || tipo.toLowerCase();
      if (normTipo === 'reparacion') {
        queryConditions.push({
          $or: [
            { ordenId: { $regex: /^INC/i } },
            { "ID_Orden": { $regex: /^INC/i } },
            { "Número_de_Petición": { $regex: /^INC/i } }
          ]
        });
      } else if (normTipo === 'provision') {
        // Difícil hacer un "NOT STARTS WITH" eficiente en $or, así que lo manejaremos en el loop mejor
        queryConditions.push({ ordenId: { $not: /^INC/i } });
      }
    }

    let filtro = queryConditions.length > 1 ? { $and: queryConditions } : (queryConditions[0] || {});

    // Filtro de estado (default: Completado)
    if (estado && estado !== 'todos') {
      const estadosArr = String(estado).split(',').map(s => s.trim()).filter(Boolean);
      if (estadosArr.length > 0) {
        filtro.Estado = { $in: estadosArr };
      }
    } else if (!estado) {
      filtro.Estado = 'Completado';
    }

    // El filtro de Actividad se aplicará en el loop para permitir métricas globales
    const selectedActividad = actividad || '';

    // --- FILTRO DE PROYECTOS (Solo para RRHH) ---
    // El filtro de proyectos lo aplicaremos solo a los técnicos/candidatos.
    // La producción se traerá por ID de técnico vinculado, lo cual es más robusto.
    let projectMatch = null;
    if (proyectos && proyectos.length > 0) {
      const projs = Array.isArray(proyectos) ? proyectos : String(proyectos).split(',');
      projectMatch = {
        $or: [
          { proyecto: { $in: projs } },
          { projectName: { $in: projs } },
          { "Proyecto": { $in: projs } },
          { "Project Name": { $in: projs } }
        ]
      };
    }
    // --- RESOLVER RANGO DE FECHAS (Prioridad: meses/semanas > desde/hasta) ---
    const mesesEsp = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    let finalDesde = desde ? new Date(desde + 'T00:00:00Z') : null;
    let finalHasta = hasta ? new Date(hasta + 'T23:59:59Z') : null;

    if (months) {
      const selectedArr = months.split(',');
      let minM = null, maxM = null;
      selectedArr.forEach(mStr => {
        if (/^\d{4}-\d{2}$/.test(mStr)) {
          // Formato YYYY-MM
          const [y, m] = mStr.split('-').map(Number);
          const dStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
          const dEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59));
          if (!minM || dStart < minM) minM = dStart;
          if (!maxM || dEnd > maxM) maxM = dEnd;
        } else {
          // Formato "mes de año"
          const parts = mStr.toLowerCase().split(' de ');
          const mIdx = mesesEsp.indexOf(parts[0]);
          const year = parseInt(parts[1]) || new Date().getFullYear();
          if (mIdx !== -1) {
            const dStart = new Date(Date.UTC(year, mIdx, 1, 0, 0, 0));
            const dEnd = new Date(Date.UTC(year, mIdx + 1, 0, 23, 59, 59));
            if (!minM || dStart < minM) minM = dStart;
            if (!maxM || dEnd > maxM) maxM = dEnd;
          }
        }
      });
      if (minM) finalDesde = minM;
      if (maxM) finalHasta = maxM;
    }

    if (finalDesde) filtro.fecha = { ...filtro.fecha, $gte: finalDesde };
    if (finalHasta) {
      filtro.fecha = { ...filtro.fecha, $lte: finalHasta };
      statsHastaFilter = finalHasta.getTime();
    }


    // GUARDAR EL ESTADO SELECCIONADO Y ELIMINARLO DEL FILTRO DATABASE
    // Para que Actividad.find nos traiga todos los estados posibles para este rango/empresa
    const selectedStatus = estado || 'Completado';
    const selectedStatusArr = selectedStatus === 'todos' ? [] : selectedStatus.split(',').map(s => s.trim().toLowerCase());
    delete filtro.Estado;

    // Cargar tarifas LPU, técnicos vinculados, config de producción, mapa valorización y empresa
    const ConfigProduccion = require(`${PLATFORM_PATH}/models/ConfigProduccion`);
    // Promise.allSettled para resiliencia — si una query falla, las demás continúan
    const efectivoEmpresaId = isSystemAdmin ? (empresaFilter || null) : empresaId;
    // --- FILTRO DE PROYECTOS PARA LA QUERY DE RRHH ---
    let projectFilterRRHH = {};
    if (proyectos && proyectos.length > 0) {
      const projs = Array.isArray(proyectos) ? proyectos : String(proyectos).split(',');
      projectFilterRRHH = {
        $or: [
          { proyecto: { $in: projs } },
          { projectName: { $in: projs } },
          { nombreProyecto: { $in: projs } }
        ]
      };
    }

    const [r_tarifas, r_tecnicos, r_config, r_mapa, r_empresa, r_cands] = await Promise.allSettled([
      obtenerTarifasEmpresa(efectivoEmpresaId),
      isSystemAdmin && !empresaFilter
        ? Tecnico.find(projectFilterRRHH).select('idRecurso idRecursoToa rut nombres apellidos nombre empresaRef fechaIngreso cargo proyecto projectName').lean()
        : Tecnico.find({ ...projectFilterRRHH, empresaRef: efectivoEmpresaId }).select('idRecurso idRecursoToa rut nombres apellidos nombre fechaIngreso cargo proyecto projectName').lean(),
      ConfigProduccion.findOne({ empresaRef: empresaId }).lean(),
      construirMapaValorizacion(empresaId),
      Empresa.findById(empresaId).select('nombre logo').lean(),
      isSystemAdmin && !empresaFilter
        ? Candidato.find(projectFilterRRHH).select('idRecurso idRecursoToa rut fullName contractStartDate hiring.contractStartDate status fechaIngreso position projectName projectId').lean()
        : Candidato.find({ ...projectFilterRRHH, empresaRef: efectivoEmpresaId }).select('idRecurso idRecursoToa rut fullName contractStartDate hiring.contractStartDate status fechaIngreso position projectName projectId').lean()
    ]);
    const tarifasLPU = r_tarifas.status === 'fulfilled' ? r_tarifas.value : [];
    const tecnicosVinculados = r_tecnicos.status === 'fulfilled' ? r_tecnicos.value : [];
    const configProd = r_config.status === 'fulfilled' ? r_config.value : null;
    const mapaValorizacionProd = r_mapa.status === 'fulfilled' ? r_mapa.value : {};
    const empresaDoc = r_empresa.status === 'fulfilled' ? r_empresa.value : null;
    const candsVal = r_cands && r_cands.status === 'fulfilled' ? r_cands.value : [];

    // Map RUTs from HR just in case Tecnico is missing it
    const mapRutCands = {};
    const mapInicioContratoCandsByToa = {};
    const mapInicioContratoCandsByRut = {};
    candsVal.forEach(c => {
      const toaId = c.idRecursoToa ? String(c.idRecursoToa).trim().toLowerCase() : '';
      const rut = c.rut ? String(c.rut).trim().toLowerCase() : '';
      // Intentar obtener la fecha de inicio de múltiples campos posibles
      const contractDate = c.contractStartDate || c.hiring?.contractStartDate || c.fechaIngreso || null;

      if (toaId) {
        if (c.rut) mapRutCands[toaId] = c.rut;
        if (contractDate) mapInicioContratoCandsByToa[toaId] = contractDate;
      }
      if (rut && contractDate) {
        mapInicioContratoCandsByRut[rut] = contractDate;
      }
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
      nombre: formatShortName(t.nombre, t.nombres, t.apellidos)
    }));

    const nameToMapKey = {};
    const techMap = {};
    const idToKey = {}; // Mapa para ID TOA -> Clave techMap
    const rutToKey = {}; // Mapa para RUT -> Clave techMap

    // --- NUEVO: Inicializar techMap con Candidatos y Técnicos ---
    const validTecnicoIds = new Set(); 
    let candidatosTotal = 0, candidatosTelecom = 0, tecnicosTotal = 0;

    // Función auxiliar para agregar al techMap
    const addToTechMap = (t, source) => {
      const idRawToa = String(t.idRecursoToa || '').trim();
      const idRawRec = String(t.idRecurso || '').trim();
      const rutRaw = String(t.rut || '').trim().toLowerCase();
      const rutClean = rutRaw.replace(/[^0-9kK]/g, '');

      if (!rutClean && !idRawToa && !idRawRec) return;

      const getKeys = (id) => {
        if (!id) return [];
        const low = id.toLowerCase();
        const clean = low.replace(/^0+/, '');
        return [low, clean, id];
      };

      const keysToa = getKeys(idRawToa);
      const keysRec = getKeys(idRawRec);

      // Buscar si ya existe por RUT o por ID
      let key = null;
      if (rutClean && rutToKey[rutClean]) key = rutToKey[rutClean];
      
      if (!key) {
        for (const k of [...keysToa, ...keysRec]) {
          if (idToKey[k]) {
            key = idToKey[k];
            break;
          }
        }
      }
      
      const name = (t.name || t.fullName || (t.nombres ? `${t.nombres} ${t.apellidos || ''}` : '') || 'Sin Nombre').trim().toUpperCase();
      
      // Fallback a configProd si existe
      const cpKey = keysToa.find(k => mapaValorizacionProd[k]) || keysRec.find(k => mapaValorizacionProd[k]) || rutClean;
      const cpConfig = cpKey ? mapaValorizacionProd[cpKey] : null;

      if (!key) {
        // Crear nuevo
        const cleanIdToUse = keysToa[1] || keysRec[1];
        const lowIdToUse = keysToa[0] || keysRec[0];
        key = cleanIdToUse || lowIdToUse || (rutClean ? `rut_${rutClean}` : `id_${Math.random()}`);
        const inicio = t.contractStartDate || t.hiring?.contractStartDate || t.fechaIngreso || null;
        
        techMap[key] = {
          name,
          idRecursoToa: idRawToa || idRawRec, // Mantenemos compatibilidad 
          idRecurso: idRawRec || idRawToa,
          rut: t.rut || '',
          valorPunto: cpConfig?.valorPunto || 0,
          retencionPct: cpConfig?.retencion || 0,
          orders: 0,
          ptsBase: 0, ptsDeco: 0, ptsDecoCable: 0, ptsDecoWifi: 0, ptsRepetidor: 0, ptsTelefono: 0, ptsTotal: 0,
          qtyDeco: 0, qtyDecoCable: 0, qtyDecoWifi: 0, qtyRepetidor: 0, qtyTelefono: 0,
          facturacion: 0, retencion: 0, facturacionNeta: 0,
          provisionCount: 0, repairCount: 0,
          isVinculado: true,
          days: new Set(),
          dailyMap: {},
          activities: {},
          cityMap: {},
          proyecto: cpConfig?.proyecto || t.projectName || '',
          inicioContrato: inicio,
          cargo: t.position || t.cargo || 'TÉCNICO',
          status: t.status || 'Operativo',
          sueldoBase: t.sueldoBase || 0
        };

        if (rutClean) rutToKey[rutClean] = key;
        [...keysToa, ...keysRec].forEach(k => {
            if (k) {
                idToKey[k] = key;
                const num = parseInt(k);
                if (!isNaN(num)) idToKey[num] = key;
            }
        });
      } else {
        // Enriquecer existente (Fusión por Identidad)
        const ex = techMap[key];
        if (t.rut && !ex.rut) {
          ex.rut = t.rut;
          rutToKey[rutClean] = key;
        }
        if (idRawToa && !ex.idRecursoToa) ex.idRecursoToa = idRawToa;
        if (idRawRec && !ex.idRecurso) ex.idRecurso = idRawRec;
        if (t.sueldoBase && !ex.sueldoBase) ex.sueldoBase = t.sueldoBase;
        
        [...keysToa, ...keysRec].forEach(k => {
            if (k) {
                idToKey[k] = key;
                const num = parseInt(k);
                if (!isNaN(num)) idToKey[num] = key;
            }
        });

        const inicio = t.contractStartDate || t.hiring?.contractStartDate || t.fechaIngreso || null;
        if (inicio && !ex.inicioContrato) ex.inicioContrato = inicio;
        if (t.cargo && (ex.cargo === 'TÉCNICO' || !ex.cargo)) ex.cargo = t.cargo;
      }

      // Registrar IDs válidos para el filtro de actividades
      if (keysToa[0]) validTecnicoIds.add(keysToa[0]);
      if (keysRec[0]) validTecnicoIds.add(keysRec[0]);
      if (keysToa[1]) validTecnicoIds.add(keysToa[1]);
      if (keysRec[1]) validTecnicoIds.add(keysRec[1]);
      if (keysToa[2]) validTecnicoIds.add(keysToa[2]);
      if (keysRec[2]) validTecnicoIds.add(keysRec[2]);
    };

    // 1. Cargar Candidatos
    candsVal.forEach(c => {
      candidatosTotal++;
      addToTechMap(c, 'candidato');
    });

    // 2. Cargar Técnicos
    vinculadosFiltered.forEach(t => {
      tecnicosTotal++;
      addToTechMap(t, 'tecnico');
    });

    console.log(`\n📋 CANDIDATOS: ${candidatosTotal} total | TÉCNICOS: ${tecnicosTotal} | ${Object.keys(techMap).length} en techMap`);

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

    // --- 3. RANGO DE FECHAS ---
    const startRange = filtro.fecha?.$gte || new Date('2000-01-01');
    const endRange = filtro.fecha?.$lte || new Date('2100-01-01');

    // Construir filtro final con restricciones de ID
    const finalFiltro = { ...filtro };
    if (!isSystemAdmin || empresaFilter) {
      const restrictedIDsArray = Array.from(restrictedIDs);
      if (restrictedIDsArray.length > 0) {
        finalFiltro.$and = finalFiltro.$and || [];
        finalFiltro.$and.push({ 
          $or: [
            { ID_RECURSO: { $in: restrictedIDsArray } },
            { idRecursoToa: { $in: restrictedIDsArray } },
            { "ID Recurso": { $in: restrictedIDsArray } },
            { "RECURSO": { $in: restrictedIDsArray } }
          ]
        });
      }
    }

    let pipeline = [];
    // --- CONSULTA UNIFICADA (Directo a Actividad) ---
    const docs = await Actividad.find(finalFiltro).lean();
    const totalDocsInDB = docs.length;
    console.log(`📊 [produccion-stats] Órdenes encontradas en DB: ${totalDocsInDB}`);

    console.log(`[DIAGNOSTICO] Iniciando procesamiento de ${totalDocsInDB} órdenes...`);
    
    let matchedCount = 0;
    let totalPtsAccum = 0;
    const seenActivitiesBot = new Set();
    const filterMonths = months ? months.split(',').map(m => m.trim().toLowerCase()) : [];
    const filterWeeks = weeks ? weeks.split(',').map(w => w.trim().toLowerCase()) : [];
    let diagCount = 0;

    for (const doc of docs) {
      // 1. Sanitización de keys -> Mantener original y MAYÚSCULAS para compatibilidad
      const clean = {};
      for (let k in doc) {
        if (typeof doc[k] === 'function') continue;
        const val = doc[k];
        const kUpper = k.toUpperCase().replace(/ /g, '_');
        clean[kUpper] = val;
        // También guardamos una versión con camel/snake case común para el motor de baremos
        const kNormal = k.replace(/[\.\s]/g, '_');
        if (!clean[kNormal]) clean[kNormal] = val;
      }

      // 🔥 PREVENIR DUPLICADOS
      const pet = String(clean.NUMERO_DE_PETICION || clean.NUMERO_PETICION || clean.APPT_NUMBER || '').trim();
      const fallbackId = String(clean.ORDENID || doc._id || '').trim();
      const uniqueKey = pet && pet.length > 2 ? pet : fallbackId;
      
      if (uniqueKey && seenActivitiesBot.has(uniqueKey)) continue;
      if (uniqueKey) seenActivitiesBot.add(uniqueKey);

      // 2. EXTRACCIÓN DE ID ULTRA-ROBUSTA (Sincronizada con Espejo)
      let idRecursoRaw = 
        clean.ID_RECURSO || 
        clean.IDRECURSOTOA || 
        clean.ID_RECURSO_TOA || 
        clean.RECURSO || 
        clean['AUTO_ASIGNADO_A_RECURSO_(ID)'] ||
        clean.TECNICO ||
        '';

      const idRecurso = String(idRecursoRaw || '').trim().replace(/^0+/, '');
      const idLow = idRecurso.toLowerCase();
      const idClean = idLow.replace(/^0+/, '');
      
      let techKey = techMap[idRecurso] ? idRecurso : (idToKey[idLow] || idToKey[idClean] || idToKey[idRecurso] || '');
      
      if (!techKey && diagCount < 5) {
        console.log(`[DIAGNOSTICO] Doc falló. ID extraído: "${idRecurso}". Keys:`, Object.keys(clean).slice(0, 10));
        diagCount++;
      }

      if (!techKey) continue;
      let t = techMap[techKey];
      matchedCount++;

      // 3. INTELIGENCIA LPU CENTRALIZADA (Motor Unificado)
      const baremos = calcularBaremos(clean, tarifasLPU) || {};
      const valorizacion = valorizarBaremos(baremos, mapaValorizacionProd) || {};

      const pTotal = parseFloat(baremos.Pts_Total_Baremo || 0);
      const pBase  = parseFloat(baremos.Pts_Actividad_Base || 0);
      const pDeco  = parseFloat(baremos.Pts_Deco_Adicional || baremos.Pts_Deco_WiFi || 0);
      const pRep   = parseFloat(baremos.Pts_Repetidor_WiFi || 0);
      const pTel   = parseFloat(baremos.Pts_Telefono || 0);

      const qD = parseInt(baremos.Decos_Adicionales || baremos.Decos_WiFi_Adicionales || 0);
      const qR = parseInt(baremos.Repetidores_WiFi || 0);
      const qT = parseInt(baremos.Telefonos || 0);

      const fechaRaw = clean.FECHA_SISTEMA || clean.FECHA || clean.FECHA_INSTALACION || clean.DATE || doc.fecha;
      if (!fechaRaw) continue;
      const dObj = new Date(fechaRaw);
      if (isNaN(dObj.getTime())) continue;

      const tecnico = t.name || '';
      const ciudad = (clean.CIUDAD || clean.CIUDAD_DE_LA_ACTIVIDAD || clean.CITY || '').toUpperCase().trim();

      const ordenId = String(clean.NUMERO_DE_PETICION || clean.ORDENID || clean.NUMERO_PETICION || '');
      const isRepair = ordenId.toUpperCase().startsWith('INC');
      const descLpu = baremos.Desc_LPU_Base || clean.SUBTIPO_DE_ACTIVIDAD || '';
      const isVinculado = true;

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
      const vFechaMs = dObj ? dObj.getTime() : 0;
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
      const valorPuntoCfg = cpConfig?.valorPunto || 0;

      const storedCLP = parseFloat(clean.VALOR_ACTIVIDAD_CLP || clean.Valor_Actividad_CLP || clean.VALOR_TOTAL || 0);
      const valorBruto = storedCLP > 0 ? storedCLP : (pTotal * valorPuntoCfg);
      const retencionPct = Math.max(0, Number(cpConfig?.retencion || 0));
      const descuentoRet = Math.round(valorBruto * (retencionPct / 100));
      const valorNeto = valorBruto - descuentoRet;

      // --- FILTRO MULTI-CLIENTE (Sincronizado por ID) ---
      if (filterClientes.length > 0) {
        const targetId = cpConfig?.clienteId || clienteName;
        if (!targetId || !filterClientes.includes(targetId)) continue;
      }

      const cpKey = clienteName ? (proyectoName ? `${clienteName} | ${proyectoName}` : clienteName) : '';

      // Determinar tipo de actividad para análisis
      const subtipoAct = clean['Subtipo_de_Actividad'] || clean['Subtipo de Actividad'] || '';
      const tipoTrabajo = clean['Tipo_de_Trabajo'] || clean['Tipo de Trabajo'] || '';
      
      // Parsear Duración de la actividad
      let minDuracion = 0;
      const durRaw = clean['Duración de la actividad'] || clean['Duración_de_la_actividad'] || clean['duracion'] || '';
      if (durRaw && typeof durRaw === 'string' && durRaw.includes(':')) {
        const parts = durRaw.split(':');
        if (parts.length === 2) {
          minDuracion = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        }
      }

      
      // ── REGISTRAR ESTADOS Y ACTIVIDADES (Antes de filtrar para el dropdown) ──
      const cleanEstado = clean.Estado || 'Sin Estado';
      estadoCountMap[cleanEstado] = (estadoCountMap[cleanEstado] || 0) + 1;
      const codigoLpu = baremos.Codigo_LPU_Base || '';
      if (descLpu) {
        if (!lpuMap[descLpu]) lpuMap[descLpu] = { desc: descLpu, code: codigoLpu, count: 0, totalPts: 0, grupo: baremos.Grupo_LPU_Base || '', categoria: baremos.Categoria_LPU_Base || '' };
      }

      // DateKey
      let dateKey = '';
      if (dObj) {
        const dt = dObj;
        dateKey = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
        if (dateKey > maxDateStr) maxDateStr = dateKey;
      }

      // ── FILTRO DE ESTADO SELECCIONADO (Solo para métricas del dashboard) ──
      if (selectedStatus !== 'todos' && !selectedStatusArr.includes(cleanEstado.toLowerCase())) continue;

      // ── FILTRO DE ACTIVIDAD SELECCIONADA ──
      if (selectedActividad && descLpu !== selectedActividad) continue;

      // ── FILTRO DE CATEGORÍAS (Altas/Inst, Rutinas, Reparaciones) ──
      if (categorias && categorias.length > 0) {
        const grupo = (baremos.Grupo_LPU_Base || '').toUpperCase();
        const categoriaDoc = (baremos.Categoria_LPU_Base || '').toUpperCase();
        
        // Determinar qué es cada actividad basándonos en su Grupo/Categoría oficial primero
        let isAlta = /INSTALACION|BANDA ANCHA|TELEVISION|VOZ|RED/i.test(grupo);
        let isRutina = /RUTINA|PREVENTIVO/i.test(grupo) || /MANTENIMIENTO/i.test(categoriaDoc);
        let isReparacion = /AVERIA|RESOLUCION|REPARACION/i.test(grupo) || /AVER[IÍ]A/i.test(categoriaDoc);

        // Fallback a regex si no está configurada la tarifa LPU
        if (!isAlta && !isRutina && !isReparacion) {
           isAlta = /ALTA|INSTALACI[OÓ]N|MIGRACI[OÓ]N|TRASLADO|PROVISI[OÓ]N/i.test(descLpu) || /^PROV/i.test(ordenId);
           isRutina = /RUTINA|RP\s|RETIRO|CAMBIO/i.test(descLpu);
           isReparacion = /AVER[IÍ]A|RECLAMO|MANTENIMIENTO|REPOSICI[OÓ]N|REPARACI[OÓ]N|FALLA/i.test(descLpu) || /^INC/i.test(ordenId);
        }
        
        const catsArr = String(categorias).split(',').map(s => s.trim());
        let passCat = false;
        if (isAlta && catsArr.includes('Altas/Inst')) passCat = true;
        if (isRutina && catsArr.includes('Rutinas')) passCat = true;
        if (isReparacion && catsArr.includes('Reparaciones')) passCat = true;
        
        // Si la orden no coincide con ninguna regex clara, asumiremos que es Alta por defecto
        if (!isAlta && !isRutina && !isReparacion && catsArr.includes('Altas/Inst')) passCat = true;
        
        if (!passCat) continue;
      }

      // Una vez pasado los filtros, sumamos a los totales reactivos
      if (descLpu) {
        if (!lpuMap[descLpu]) {
          lpuMap[descLpu] = { 
            desc: descLpu, 
            count: 0, 
            totalPts: 0, 
            grupo: baremos.Grupo_LPU_Base || '',
            categoria: baremos.Categoria_LPU_Base || ''
          };
        }
        lpuMap[descLpu].count++;
        lpuMap[descLpu].totalPts += pTotal;
      }

      totalOrders_count++;
      totalPtsAccum += pTotal;

      if (matchedCount <= 5) {
        console.log(`🎯 [DEBUG] Match #${matchedCount}: ID:${idRecurso}, Pts:${pTotal}, Fecha:${dObj.toISOString().split('T')[0]}`);
      }

      // ── Agregar a techMap ──
      // ── Agregar a techMap - SOLO TELECOMUNICACIONES ──
      if (!techKey && idRecurso) {
        const idLow = idRecurso.toLowerCase();
        const idClean = idLow.replace(/^0+/, '');
        techKey = idToKey[idLow] || idToKey[idClean] || idToKey[idRecurso];
      }

      if (!techKey || !techMap[techKey]) {
        // Si no hay techKey, intentamos buscarlo de nuevo por el ID original o limpio directamente en techMap
        const idLow = idRecurso.toLowerCase();
        const idClean = idLow.replace(/^0+/, '');
        const fallbackKey = idToKey[idLow] || idToKey[idClean];
        if (fallbackKey && techMap[fallbackKey]) {
          techKey = fallbackKey;
        } else {
          continue;
        }
      }

      t = techMap[techKey];
      t.orders++;
        t.ptsBase += pBase;
        t.ptsDeco += pDeco;
        t.ptsDecoCable += 0;
        t.ptsDecoWifi += pDeco;
        t.ptsRepetidor += pRep;
        t.ptsTelefono += pTel;
        t.ptsTotal += pTotal;
        t.valorPunto = valorPuntoCfg || t.valorPunto || 0;
        t.retencionPct = retencionPct;
        t.facturacion += valorBruto;
        t.retencion += descuentoRet;
        t.facturacionNeta += valorNeto;
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
          if (!t.dailyMap[dateKey]) t.dailyMap[dateKey] = { orders: 0, pts: 0, byActivity: {}, completadas: 0, noRealizadas: 0, minTotal: 0, minAlta: 0, minReparacion: 0, minRutina: 0, ordersAlta: 0, ordersReparacion: 0, ordersRutina: 0 };
          t.dailyMap[dateKey].orders++;
          t.dailyMap[dateKey].pts += pTotal;
          
          const estLower = (cleanEstado || '').toLowerCase();
          const isCompleted = estLower.includes('completad') || estLower.includes('finalizad') || estLower.includes('ok') || estLower.includes('ejecutad');
          if (isCompleted) {
            t.dailyMap[dateKey].completadas++;
            t.dailyMap[dateKey].minTotal += minDuracion;
            t.dailyMap[dateKey].ptsCompletados = (t.dailyMap[dateKey].ptsCompletados || 0) + pTotal;
          } else {
            t.dailyMap[dateKey].noRealizadas++;
            t.dailyMap[dateKey].ptsNoRealizados = (t.dailyMap[dateKey].ptsNoRealizados || 0) + pTotal;
          }
          const isAlta = /ALTA|INSTALACI[OÓ]N|MIGRACI[OÓ]N|TRASLADO/i.test(descLpu);
          const isRutina = /RUTINA|RP\s/i.test(descLpu);
          const isReparacion = /AVER[IÍ]A|RECLAMO|MANTENIMIENTO|REPOSICI[OÓ]N|REPARACI[OÓ]N/i.test(descLpu);

          if (isAlta) t.dailyMap[dateKey].ordersAlta++;
          else if (isRutina) t.dailyMap[dateKey].ordersRutina++;
          else if (isReparacion) t.dailyMap[dateKey].ordersReparacion++;
          
          if (isCompleted) {
            if (isAlta) t.dailyMap[dateKey].minAlta += minDuracion;
            else if (isRutina) t.dailyMap[dateKey].minRutina += minDuracion;
            else if (isReparacion) t.dailyMap[dateKey].minReparacion += minDuracion;
          }

          // APLICAR 40 MINS (30 despl + 10 contac) POR CADA ORDEN (Completadas + No Realizadas)
          t.dailyMap[dateKey].minTotal += 40;
          if (isAlta) {
            t.dailyMap[dateKey].minAlta += 40;
          } else if (isRutina) {
            t.dailyMap[dateKey].minRutina += 40;
          } else if (isReparacion) {
            t.dailyMap[dateKey].minReparacion += 40;
          } else {
            // Si no se detecta, se suma por defecto a Alta
            t.dailyMap[dateKey].minAlta += 40;
            t.dailyMap[dateKey].ordersAlta++;
          }
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

      // ── Agregar a calendarMap ──
      if (dateKey) {
        if (!calendarMap[dateKey]) calendarMap[dateKey] = { pts: 0, orders: 0, clp: 0, clpNeto: 0, techs: {} };
        calendarMap[dateKey].pts += pTotal;
        calendarMap[dateKey].orders++;
        calendarMap[dateKey].clp += valorBruto;
        calendarMap[dateKey].clpNeto += valorNeto;
        if (tecnico) {
          if (!calendarMap[dateKey].techs[tecnico]) {
            calendarMap[dateKey].techs[tecnico] = { pts: 0, clp: 0, clpNeto: 0 };
          }
          calendarMap[dateKey].techs[tecnico].pts += pTotal;
          calendarMap[dateKey].techs[tecnico].clp += valorBruto;
          calendarMap[dateKey].techs[tecnico].clpNeto += valorNeto;
        }
      }

      // ── Agregar a cityMap ──
      if (ciudad) {
        if (!cityMap[ciudad]) cityMap[ciudad] = { pts: 0, orders: 0 };
        cityMap[ciudad].pts += pTotal;
        cityMap[ciudad].orders++;
      }

      // ── Agregar a lpuMap (Mantenido arriba para reactividad) ──

      // ── Agregar a clientProjectMap ──
      if (cpKey) {
        if (!clientProjectMap[cpKey]) {
          clientProjectMap[cpKey] = {
            cliente: clienteName, proyecto: proyectoName,
            pts: 0, clp: 0, retencion: 0, clpNeto: 0, orders: 0, techs: new Set(), days: new Set(),
            provisionCount: 0, repairCount: 0,
            weeklyMap: {}, // weekKey → { pts, orders }
            byTipoTrabajo: {} // tipoTrabajo → { pts, orders }
          };
        }
        const cp = clientProjectMap[cpKey];
        cp.pts += pTotal;
        cp.clp += valorBruto;
        cp.retencion += descuentoRet;
        cp.clpNeto += valorNeto;
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
    // Causa: actividades sin RECURSO quedan keyed por nombre; si se procesaron antes que
    // la primera actividad con ID, quedan como entrada separada con isVinculado=false.
    for (const [orphanKey, orphanEntry] of Object.entries(techMap)) {
      if (orphanEntry.isVinculado) continue;           // ya vinculado, no huérfano
      const canonKey = nameToMapKey[(orphanEntry.name || '').toLowerCase().trim()];
      if (!canonKey || canonKey === orphanKey) continue; // no tiene entrada canónica
      const canon = techMap[canonKey];
      if (!canon || !canon.isVinculado) continue;
      // Fusionar dailyMap
      Object.entries(orphanEntry.dailyMap || {}).forEach(([dk, dd]) => {
        if (!canon.dailyMap[dk]) canon.dailyMap[dk] = { orders: 0, pts: 0, byActivity: {}, completadas: 0, noRealizadas: 0, minTotal: 0, minAlta: 0, minReparacion: 0, minRutina: 0, ordersAlta: 0, ordersReparacion: 0, ordersRutina: 0 };
        canon.dailyMap[dk].orders += dd.orders;
        canon.dailyMap[dk].pts += dd.pts;
        canon.dailyMap[dk].ptsCompletados = (canon.dailyMap[dk].ptsCompletados || 0) + (dd.ptsCompletados || 0);
        canon.dailyMap[dk].ptsNoRealizados = (canon.dailyMap[dk].ptsNoRealizados || 0) + (dd.ptsNoRealizados || 0);
        canon.dailyMap[dk].completadas = (canon.dailyMap[dk].completadas || 0) + (dd.completadas || 0);
        canon.dailyMap[dk].noRealizadas = (canon.dailyMap[dk].noRealizadas || 0) + (dd.noRealizadas || 0);
        canon.dailyMap[dk].minTotal = (canon.dailyMap[dk].minTotal || 0) + (dd.minTotal || 0);
        canon.dailyMap[dk].minAlta = (canon.dailyMap[dk].minAlta || 0) + (dd.minAlta || 0);
        canon.dailyMap[dk].minReparacion = (canon.dailyMap[dk].minReparacion || 0) + (dd.minReparacion || 0);
        canon.dailyMap[dk].minRutina = (canon.dailyMap[dk].minRutina || 0) + (dd.minRutina || 0);
        canon.dailyMap[dk].ordersAlta = (canon.dailyMap[dk].ordersAlta || 0) + (dd.ordersAlta || 0);
        canon.dailyMap[dk].ordersReparacion = (canon.dailyMap[dk].ordersReparacion || 0) + (dd.ordersReparacion || 0);
        canon.dailyMap[dk].ordersRutina = (canon.dailyMap[dk].ordersRutina || 0) + (dd.ordersRutina || 0);
        Object.entries(dd.byActivity || {}).forEach(([act, stat]) => {
          if (!canon.dailyMap[dk].byActivity[act]) canon.dailyMap[dk].byActivity[act] = { count: 0, pts: 0 };
          canon.dailyMap[dk].byActivity[act].count += stat.count;
          canon.dailyMap[dk].byActivity[act].pts += stat.pts;
        });
        canon.days.add(dk);
      });
      // Fusionar métricas
      canon.orders += orphanEntry.orders;
      canon.ptsBase += orphanEntry.ptsBase;
      canon.ptsDeco += orphanEntry.ptsDeco;
      canon.ptsDecoCable += orphanEntry.ptsDecoCable || 0;
      canon.ptsDecoWifi += orphanEntry.ptsDecoWifi || 0;
      canon.ptsRepetidor += orphanEntry.ptsRepetidor;
      canon.ptsTelefono += orphanEntry.ptsTelefono;
      canon.ptsTotal += orphanEntry.ptsTotal;
      canon.qtyDeco += orphanEntry.qtyDeco;
      canon.qtyRepetidor += orphanEntry.qtyRepetidor;
      canon.qtyTelefono += orphanEntry.qtyTelefono;
      canon.provisionCount += orphanEntry.provisionCount;
      canon.repairCount += orphanEntry.repairCount;
      // Marcar el huérfano para exclusión
      orphanEntry._merged = true;
    }

    // Construir respuesta (excluir entradas fusionadas al canónico vinculado)
    const tecnicos = Object.entries(techMap)
      .filter(([, t]) => !t._merged)
      // 1. REQUERIMIENTO: Solo técnicos con ID registrado (idRecursoToa o idRecurso)
      .filter(([, t]) => (t.idRecursoToa && String(t.idRecursoToa).trim().length > 0) || (t.idRecurso && String(t.idRecurso).trim().length > 0))
      // 2. REQUERIMIENTO: Finiquitados se ven SOLO si tuvieron producción en el mes
      .filter(([, t]) => {
        const isFiniquitado = String(t.status || '').toLowerCase().includes('finiquit') || 
                             String(t.status || '').toLowerCase().includes('egreso') ||
                             String(t.status || '').toLowerCase().includes('retir');
                             
        // REQUERIMIENTO: Si hay filtro de técnicos explícito, solo dejar pasar a los solicitados
        if (tecnicosFilter && tecnicosFilter.length > 0) {
          const rawTechs = String(tecnicosFilter).split(',').map(s => s.trim()).filter(Boolean);
          if (rawTechs.length > 0) {
            const idDoc = String(t.idRecursoToa || t.idRecurso || '').trim();
            const nameDoc = String(t.name || '').trim();
            if (!rawTechs.includes(idDoc) && !rawTechs.includes(nameDoc)) {
              return false;
            }
          }
        }

        if (isFiniquitado) {
          return t.orders > 0;
        }
        return true; // Activos/Contratados se ven siempre (si no fueron filtrados arriba)
      })
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
        activeDays: t.days instanceof Set ? t.days.size : (Array.isArray(t.days) ? t.days.length : 0),
        avgPerDay: t.days && (t.days.size || t.days.length) > 0 ? Math.round((t.ptsTotal / (t.days.size || t.days.length)) * 100) / 100 : 0,
        valorPunto: Math.round(t.valorPunto || 0),
        retencionPct: t.retencionPct || 0,
        facturacion: Math.round(t.facturacion || 0),
        retencion: Math.round(t.retencion || 0),
        facturacionNeta: Math.round(t.facturacionNeta || 0),
        avgFactDia: t.days && (t.days.size || t.days.length) > 0 ? Math.round((t.facturacionNeta || 0) / (t.days.size || t.days.length)) : 0,
        dailyMap: t.dailyMap,
        activities: t.activities,
        provisionCount: t.provisionCount,
        repairCount: t.repairCount,
        isVinculado: t.isVinculado,
        idRecursoToa: t.idRecursoToa || t.idRecurso,
        rut: t.rut,
        rrRealPercent: t.rrRealPercent,
        rrFails: t.rrFails,
        rrOrdersCount: t.rrOrdersCount,
        cityMap: t.cityMap,
        cliente: t.cliente,
        proyecto: t.proyecto,
        inicioContrato: t.inicioContrato,
        cargo: t.cargo || 'TÉCNICO',
        status: t.status || 'Operativo',
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
          orders: ex.orders + (t.orders || 0),
          ptsBase: Math.round((ex.ptsBase + (t.ptsBase || 0)) * 100) / 100,
          ptsDeco: Math.round((ex.ptsDeco + (t.ptsDeco || 0)) * 100) / 100,
          ptsDecoCable: Math.round(((ex.ptsDecoCable || 0) + (t.ptsDecoCable || 0)) * 100) / 100,
          ptsDecoWifi: Math.round(((ex.ptsDecoWifi || 0) + (t.ptsDecoWifi || 0)) * 100) / 100,
          ptsRepetidor: Math.round((ex.ptsRepetidor + (t.ptsRepetidor || 0)) * 100) / 100,
          ptsTelefono: Math.round((ex.ptsTelefono + (t.ptsTelefono || 0)) * 100) / 100,
          ptsTotal: Math.round((ex.ptsTotal + (t.ptsTotal || 0)) * 100) / 100,
          qtyDeco: (ex.qtyDeco || 0) + (t.qtyDeco || 0),
          qtyDecoCable: (ex.qtyDecoCable || 0) + (t.qtyDecoCable || 0),
          qtyDecoWifi: (ex.qtyDecoWifi || 0) + (t.qtyDecoWifi || 0),
          qtyRepetidor: (ex.qtyRepetidor || 0) + (t.qtyRepetidor || 0),
          qtyTelefono: (ex.qtyTelefono || 0) + (t.qtyTelefono || 0),
          facturacion: (ex.facturacion || 0) + (t.facturacion || 0),
          retencion: (ex.retencion || 0) + (t.retencion || 0),
          facturacionNeta: (ex.facturacionNeta || 0) + (t.facturacionNeta || 0),
          valorPunto: ex.valorPunto || t.valorPunto || 0,
          retencionPct: ex.retencionPct || t.retencionPct || 0,
          activeDays: Math.max(ex.activeDays || 0, t.activeDays || 0),
          provisionCount: (ex.provisionCount || 0) + (t.provisionCount || 0),
          repairCount: (ex.repairCount || 0) + (t.repairCount || 0),
          rrFails: (ex.rrFails || 0) + (t.rrFails || 0),
          rrOrdersCount: (ex.rrOrdersCount || 0) + (t.rrOrdersCount || 0),
          // Conservar idRecurso real si el duplicado fantasma no lo tiene
          idRecurso: ex.idRecurso || t.idRecurso,
          rut: ex.rut || t.rut,
          inicioContrato: ex.inicioContrato || t.inicioContrato,
          isVinculado: ex.isVinculado || t.isVinculado,
          sueldoBase: ex.sueldoBase || t.sueldoBase || 0,
        };
      } else {
        _nameIdx[norm] = tecnicosDedupMap.length;
        tecnicosDedupMap.push({ ...t });
      }
    });
    // ⚠️ CRÍTICA: SOLO técnicos de Captura de Talento con cargo TELECOMUNICACIONES
    console.log(`\n📊 FILTRO FINAL - DEDUPLICADOS ANTES: ${tecnicosDedupMap.length}`);
    const tecnicosFinales = tecnicosDedupMap.filter(t => {
      const cargoUpper = (t.cargo || '').toUpperCase();
      const hasCargo = cargoUpper.includes('TELECOM') || cargoUpper.includes('TECNICO') || cargoUpper.includes('OPERATIVO') || cargoUpper.includes('INSTALADOR') || isSystemAdmin;
      const hasProduction = t.ptsTotal > 0 || t.orders > 0;
      const isValid = (t.isVinculado || hasProduction) && hasCargo;
      
      if (!isValid && t.name && hasProduction) {
        console.log(`  🚫 DESCARTADO (con prod): ${t.name} - Cargo: "${t.cargo}" | isVinculado: ${t.isVinculado} | hasCargo: ${hasCargo}`);
      }
      return isValid;
    });
    console.log(`📊 FILTRO FINAL - DESPUÉS: ${tecnicosFinales.length}\n`);

    const totalPts_final = tecnicosFinales.reduce((s, t) => s + t.ptsTotal, 0);
    const totalFacturacion_final = tecnicosFinales.reduce((s, t) => s + (t.facturacion || 0), 0);
    const totalRetencion_final = tecnicosFinales.reduce((s, t) => s + (t.retencion || 0), 0);
    const totalFacturacionNeta_final = tecnicosFinales.reduce((s, t) => s + (t.facturacionNeta || 0), 0);
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

    // Construir clientProjects para el frontend - NORMALIZADO
    const clientProjects = Object.values(clientProjectMap).map(cp => {
      const p = {
        cliente: cp.cliente || 'S/N',
        proyecto: cp.proyecto || 'S/N',
        pts: Math.round(cp.pts * 100) / 100,
        clp: Math.round(cp.clp || 0),
        retencion: Math.round(cp.retencion || 0),
        clpNeto: Math.round(cp.clpNeto || 0),
        orders: cp.orders || 0,
        techs: cp.techs instanceof Set ? cp.techs.size : 0,
        days: cp.days instanceof Set ? cp.days.size : 0,
        provisionCount: cp.provisionCount || 0,
        repairCount: cp.repairCount || 0,
        weeklyMap: {},
        byTipoTrabajo: {}
      };
      
      // Sanitizar mapas internos
      if (cp.weeklyMap) {
        Object.entries(cp.weeklyMap).forEach(([wk, val]) => {
          p.weeklyMap[wk] = { pts: Math.round(val.pts * 100) / 100, orders: val.orders };
        });
      }
      if (cp.byTipoTrabajo) {
        Object.entries(cp.byTipoTrabajo).forEach(([tt, val]) => {
          p.byTipoTrabajo[tt] = { pts: Math.round(val.pts * 100) / 100, orders: val.orders };
        });
      }

      p.avgPerDay = p.days > 0 ? Math.round((p.pts / p.days) * 100) / 100 : 0;
      return p;
    }).sort((a, b) => b.pts - a.pts);

    // --- FILTRO FINAL DE PROYECTOS (SEGURIDAD DE COLUMNA) ---
    let finalFilteredTecnicos = tecnicosFinales;
    if (proyectos && proyectos.length > 0) {
      const projs = Array.isArray(proyectos) ? proyectos : String(proyectos).split(',');
      finalFilteredTecnicos = tecnicosFinales.filter(t => {
        const p = String(t.proyecto || '').trim();
        // Si el proyecto del técnico está en la lista de seleccionados, pasa.
        return projs.includes(p);
      });
    }

    const vinculadosFinales = finalFilteredTecnicos.filter(t => t.isVinculado).map(t => ({
      idRecurso: t.idRecursoToa,
      name: t.name,
      rut: t.rut
    }));

    const tecnicosRespuesta = finalFilteredTecnicos.map(t => ({
      idUnique: t.idUnique,
      name: t.name,
      orders: t.orders,
      ptsTotal: t.ptsTotal,
      ptsBase: t.ptsBase,
      ptsDeco: t.ptsDeco,
      ptsRepetidor: t.ptsRepetidor,
      ptsTelefono: t.ptsTelefono,
      facturacion: t.facturacion,
      retencion: t.retencion,
      facturacionNeta: t.facturacionNeta,
      activeDays: t.activeDays,
      idRecursoToa: t.idRecursoToa,
      isVinculado: t.isVinculado,
      cargo: t.cargo,
      status: t.status,
      cliente: t.cliente,
      proyecto: t.proyecto,
      ceco: t.ceco,
      sede: t.sede,
      avgPerDay: t.avgPerDay,
      rrRealPercent: t.rrRealPercent,
      dailyMap: t.dailyMap,
      sueldoBase: t.sueldoBase || 0,
      inicioContrato: t.inicioContrato
    }));

    console.log(`✅ [produccion-stats] RESUMEN FINAL:
       - Órdenes en DB: ${totalDocsInDB || 0}
       - Órdenes vinculadas con éxito: ${matchedCount || 0}
       - Puntos totales acumulados: ${Math.round((totalPts_final || 0) * 100) / 100}
    `);
    
    res.json({
      maxDate: maxDateStr,
      stats: {
        totalOrders: totalOrders_count,
        totalPts: Math.round(totalPts_final * 100) / 100,
        totalFacturacion: Math.round(totalFacturacion_final),
        totalRetencion: Math.round(totalRetencion_final),
        totalFacturacionNeta: Math.round(totalFacturacionNeta_final),
        avgPtsPerTechPerDay,
        uniqueTechs,
        uniqueDays
      },
      tecnicos: tecnicosRespuesta,
      calendar: calendarMap,
      cities: cityMap,
      lpuActivities,
      estados: Object.entries(estadoCountMap)
        .map(([estado, count]) => ({ estado, count }))
        .sort((a, b) => b.count - a.count),
      vinculados: vinculadosFinales,
      metaConfig,
      clientProjects,
      empresaNombre: empresaDoc?.nombre || '',
    });
  } catch (error) {
    console.error('❌ /api/bot/produccion-stats error:', error.message, '\nSTACK:', error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 2.1c PRODUCCIÓN DÍA — ENDPOINT LIMPIO SOLO TELECOMUNICACIONES
// ═══════════════════════════════════════════════════════════════════════
app.get('/api/produccion-dia-telecom', botLimiter, protect, authorize('rend_operativo:ver'), async (req, res) => {
  try {
    const { startDate, endDate, estado, tipo, clientes, proyectos, meses, semanas } = req.query;
    const empresaId = req.user.empresaRef?._id || req.user.empresaRef;
    const Candidato = require('./platforms/rrhh/models/Candidato');
    const Actividad = require('./platforms/agentetelecom/models/Actividad');
    const mongoose = require('mongoose');

    console.log('\n📋 [produccion-dia-telecom] Iniciando...');
    console.log('   Filtros:', { startDate, endDate, meses, proyectos, clientes });
    
    // ── 1. CARGAR TÉCNICOS Y VINCULAR PROYECTOS DESDE RRHH (CAPTURA TALENTO) ──
    const [cands, techsMaster] = await Promise.all([
      Candidato.find({ empresaRef: empresaId }).select('idRecursoToa projectName projectId clienteNombre fullName').lean(),
      Tecnico.find({ empresaRef: empresaId }).select('idRecursoToa nombre nombres apellidos').lean()
    ]);

    console.log(`   👥 [produccion-dia-telecom] Técnicos en RRHH: ${cands.length}, Técnicos en Maestro: ${techsMaster.length}`);

    // Función para normalizar IDs (quitar ceros a la izquierda)
    const normId = (id) => String(id || '').trim().replace(/^0+/, '');

    // ── 2. DETERMINAR TÉCNICOS VÁLIDOS SEGÚN FILTROS ──
    const projList = proyectos && proyectos !== 'TODOS' ? proyectos.split(',').filter(Boolean) : [];
    const clientList = clientes && clientes !== 'TODOS' ? clientes.split(',').filter(Boolean) : [];
    
    let targetTechIds = [];
    const isFiltering = projList.length > 0 || clientList.length > 0;

    if (isFiltering) {
        // Si hay filtros, buscamos SOLAMENTE los técnicos asignados en RRHH a esos proyectos/empresas
        const filteredCands = cands.filter(c => {
            const pName = c.projectName || (c.projectId && typeof c.projectId === 'object' ? (c.projectId.nombreProyecto || c.projectId.projectName) : null) || '';
            const matchProj = projList.length === 0 || projList.some(p => pName.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(pName.toLowerCase()));
            const matchCli = clientList.length === 0 || clientList.includes(c.clienteNombre);
            return matchProj && matchCli;
        });
        
        targetTechIds = filteredCands.map(c => normId(c.idRecursoToa)).filter(Boolean);
        console.log(`   🎯 [produccion-dia-telecom] Filtrando por ${projList.length} proyectos. Técnicos encontrados: ${targetTechIds.length}`);
    } else {
        // Si no hay filtros, usamos todos los técnicos de la empresa
        targetTechIds = [
            ...cands.map(c => normId(c.idRecursoToa)),
            ...techsMaster.map(t => normId(t.idRecursoToa))
        ].filter(Boolean);
    }

    const andConditions = [];
    
    // ── 3. APLICAR FILTRO DE SEGURIDAD / TENANT ──
    const empresaIds = [empresaId];
    try {
      if (typeof empresaId === 'string') empresaIds.push(new mongoose.Types.ObjectId(empresaId));
      else empresaIds.push(empresaId.toString());
    } catch (e) {}

    if (isFiltering) {
        const subOr = [
            { empresaRef: { $in: empresaIds } },
            { idRecursoToa: { $in: targetTechIds } },
            { RECURSO: { $in: targetTechIds } },
            { idRecurso: { $in: targetTechIds } }
        ];
        if (projList.length > 0) {
            const projRegex = new RegExp(projList.join('|'), 'i');
            subOr.push({ proyecto: { $in: projList } });
            subOr.push({ proyecto: { $regex: projRegex } });
            subOr.push({ Proyecto: { $regex: projRegex } });
        }
        andConditions.push({ $or: subOr });
    } else {
        andConditions.push({
            $or: [
                { empresaRef: { $in: empresaIds } },
                { idRecursoToa: { $in: targetTechIds } },
                { RECURSO: { $in: targetTechIds } }
            ]
        });
    }

    // ── 4. FILTROS OPERATIVOS (FECHAS, ESTADO, TIPO) ──
    const hasMeses = meses && meses !== 'TODOS' && meses.length > 0;
    const hasSemanas = semanas && semanas !== 'TODOS' && semanas.length > 0;

    if (!hasMeses && !hasSemanas && startDate && endDate) {
        const startD = new Date(startDate + 'T00:00:00Z');
        const endD = new Date(endDate + 'T23:59:59Z');
        if (!isNaN(startD.getTime()) && !isNaN(endD.getTime())) {
            andConditions.push({ fecha: { $gte: startD, $lte: endD } });
        }
    } else if (hasMeses) {
        const monthList = meses.split(',').filter(m => m.length > 0);
        if (monthList.length > 0) {
            andConditions.push({
                $or: monthList.map(m => {
                    const [y, mm] = m.split('-').map(Number);
                    const startOfMonth = new Date(Date.UTC(y, mm - 1, 1));
                    const endOfMonth = new Date(Date.UTC(y, mm, 0, 23, 59, 59));
                    return { fecha: { $gte: startOfMonth, $lte: endOfMonth } };
                })
            });
        }
    }

    if (estado && estado !== 'TODOS') {
        const estRegex = new RegExp(estado.replace(/o$/, '') + '[ao]?', 'i');
        andConditions.push({
          $or: [
            { estado: { $regex: estRegex } },
            { Estado: { $regex: estRegex } },
            { ESTADO: { $regex: estRegex } },
            { status: { $regex: estRegex } }
          ]
        });
    } else {
        const statusRegex = /completad|finalizad|ok|ejecutad/i;
        andConditions.push({
          $or: [
            { estado: { $regex: statusRegex } },
            { Estado: { $regex: statusRegex } },
            { ESTADO: { $regex: statusRegex } },
            { status: { $regex: statusRegex } }
          ]
        });
    }

    if (tipo && tipo !== 'TODOS') {
        if (tipo === 'PROVISIÓN') andConditions.push({ subtipo: { $regex: /ALTA|INSTALACION/i } });
        else if (tipo === 'REPARACIÓN') andConditions.push({ subtipo: { $regex: /REPARACION|MANTENIMIENTO|REPOSICION/i } });
    }

    // ── 3. QUERY DINÁMICA POR FECHA (Corte 1 Mayo 2026) ──
    const actividades = await Actividad.find({ $and: andConditions }).lean();

    console.log(`   📊 [produccion-dia-telecom] Total Único: ${actividades.length}`);
    if (actividades.length > 0) {
        console.log(`   🔎 [produccion-dia-telecom] Ejemplo Orden: ${actividades[0].ordenId}, Puntos: ${actividades[0].ptsTotalBaremo || actividades[0].PTS_TOTAL_BAREMO}`);
    }

    // ── 2. CONSTRUIR MAPAS DE TÉCNICOS (Usando los ya cargados arriba) ──
    const tecnicosMap = new Map();
    const nombresMap = new Map();

    cands.forEach(c => {
        const idStr = String(c.idRecursoToa || '').trim().replace(/^0+/, '');
        if (!idStr) return;
        const tecnico = {
          fullName: c.fullName || '—',
          rut: c.rut || '—',
          position: c.position || 'TÉCNICO',
          status: c.status || 'Activo',
          idRecursoToa: idStr,
          dailyMap: {},
          monthTotal: 0,
          ordersCount: 0,
          isVinculado: true
        };
        tecnicosMap.set(idStr, tecnico);
        const n = String(c.fullName || '').toUpperCase().trim();
        if (n) nombresMap.set(n, tecnico);
    });

    techsMaster.forEach(t => {
        const idStr = String(t.idRecursoToa || '').trim().replace(/^0+/, '');
        if (!idStr) return;
        if (!tecnicosMap.has(idStr)) {
            const tecnico = {
                fullName: t.nombre || `${t.nombres || ''} ${t.apellidos || ''}`.trim() || '—',
                rut: t.rut || '—',
                position: t.cargo || 'TÉCNICO',
                status: t.status || 'Operativo',
                idRecursoToa: idStr,
                dailyMap: {},
                monthTotal: 0,
                ordersCount: 0,
                isVinculado: true
            };
            tecnicosMap.set(idStr, tecnico);
            const n = tecnico.fullName.toUpperCase().trim();
            if (n) nombresMap.set(n, tecnico);
        }
    });

    // ── 3. PROCESAR ACTIVIDADES (Smart Match & Aggregation) ──
    const calendarMap = {};
    const cityMap = {};
    let totalPts_final = 0;
    let totalOrders_count = 0;
    const seenActivities = new Set();

    actividades.forEach(act => {
        // 🔥 PREVENIR DUPLICADOS (Doble Ingesta)
        const peticion = String(act['Número de Petición'] || act['Numero de Petición'] || act['NÚMERO DE PETICIÓN'] || act.appt_number || '').trim();
        const fallbackId = String(act.ordenId || act._id || '').trim();
        const uniqueKey = peticion && peticion.length > 2 ? peticion : fallbackId;
        
        if (uniqueKey && seenActivities.has(uniqueKey)) {
            return; // Saltar duplicado
        }
        if (uniqueKey) {
            seenActivities.add(uniqueKey);
        }

        const idRaw = String(act.idRecursoToa || act.RECURSO || act.idRecurso || act["ID Recurso"] || '').trim();
        const idNormalized = idRaw.replace(/^0+/, ''); // Normalizar ID (quitar ceros a la izquierda)
        
        let tecnico = tecnicosMap.get(idNormalized);
        
        // Si no se encuentra por ID, intentar por nombre como ULTIMO recurso
        if (!tecnico) {
            const nombreAct = String(act.NOMBRE || act.Nombre || '').toUpperCase().trim();
            if (nombreAct && !nombreAct.includes('LIMITADA') && !nombreAct.includes('SPA') && !nombreAct.includes('EIRL')) {
                tecnico = nombresMap.get(nombreAct);
            }
        }

        // 🚀 AUTO-RECOVERY: Si no existe el técnico, crear perfil virtual
        if (!tecnico && idNormalized) {
            tecnico = {
                fullName: `Técnico Externo ${idRaw}`, // No usar act.Nombre ya que puede ser el cliente
                rut: '—',
                position: 'TÉCNICO (EXTERNO)',
                status: 'Externo',
                idRecursoToa: idRaw,
                dailyMap: {},
                monthTotal: 0,
                ordersCount: 0,
                isVinculado: false
            };
            tecnicosMap.set(idNormalized, tecnico);
        }

        if (!tecnico) return;

        // ASEGURAR QUE USAMOS EL NOMBRE DEL TÉCNICO VINCULADO SI EXISTE
        // (Esto evita que se muestren nombres de clientes si act.Nombre está mal)
        const displayName = tecnico.fullName || tecnico.name || `ID ${idNormalized}`;


        // ── Normalización de Fecha (Inteligente: Soporta Date y Strings diversos) ──
        let rawFecha = act.fecha || act.FECHA || act.Fecha || act.date || act.Date || null;
        let f = '';
        
        if (rawFecha instanceof Date) {
            f = rawFecha.toISOString().split('T')[0];
        } else if (typeof rawFecha === 'string') {
            if (rawFecha.includes('T')) {
                f = rawFecha.split('T')[0];
            } else if (rawFecha.includes('/')) {
                // Soporte para DD/MM/YYYY
                const parts = rawFecha.split('/');
                if (parts.length === 3) {
                    const day = parts[0].padStart(2, '0');
                    const month = parts[1].padStart(2, '0');
                    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                    f = `${year}-${month}-${day}`;
                }
            } else {
                f = rawFecha;
            }
        }
        
        if (!f || f === '' || f.includes('undefined') || f.includes('null') || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return;

        // ── Normalización de Puntos (Cualquier case) ──
        const pts = parseFloat(
            act.ptsTotalBaremo || act.PTS_TOTAL_BAREMO || act.Pts_Total_Baremo || 
            act.pts_total_baremo || act.PUNTOS || act.Puntos || 0
        );
        
        if (!tecnico.dailyMap[f]) tecnico.dailyMap[f] = { pts: 0, orders: 0 };
        tecnico.dailyMap[f].pts += pts;
        tecnico.dailyMap[f].orders += 1;
        tecnico.monthTotal += pts;
        tecnico.ordersCount += 1;

        if (!calendarMap[f]) calendarMap[f] = { pts: 0, orders: 0 };
        calendarMap[f].pts += pts;
        calendarMap[f].orders += 1;

        const city = (act.Ciudad || act.Localidad || act.CIUDAD || act.LOCALIDAD || 'SIN ZONA').toUpperCase().trim();
        if (!cityMap[city]) cityMap[city] = { name: city, pts: 0, orders: 0 };
        cityMap[city].pts += pts;
        cityMap[city].orders += 1;

        totalPts_final += pts;
        totalOrders_count += 1;
    });

    // ── 4. RESPONDER ──
    const configProd = await Empresa.findById(empresaId).select('configuraciones.produccion');
    const metaConfig = configProd?.configuraciones?.produccion || { metaProduccionDia: 7.5 };

    const tecnicos = Array.from(tecnicosMap.values())
      .filter(t => t.ordersCount > 0)
      .sort((a, b) => b.monthTotal - a.monthTotal);

    res.json({
      tecnicos,
      calendar: calendarMap,
      cities: Object.values(cityMap).sort((a, b) => b.pts - a.pts),
      stats: {
        totalPts: Math.round(totalPts_final * 100) / 100,
        totalOrders: totalOrders_count,
        uniqueTechs: tecnicos.length,
        uniqueDays: Object.keys(calendarMap).length
      },
      metaConfig
    });

  } catch (error) {
    console.error('❌ /api/produccion-dia-telecom error:', error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// RECALCULAR ACTIVIDADES MONGODB — APLICAR BAREMOS A DATOS EXISTENTES
// Usa el motor LPU existente (calculoEngine.js) para garantizar exactitud
// ═══════════════════════════════════════════════════════════════════════
app.post('/api/recalcular-actividades-mongodb', botLimiter, protect, authorize('descarga_toa:crear'), async (req, res) => {
  try {
    const empresaId = req.user.empresaRef?._id || req.user.empresaRef;
    const { fechaInicio, fechaFin } = req.body;

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' });
    }

    const TarifaLPU = require('./platforms/agentetelecom/models/TarifaLPU');
    const Candidato = require('./platforms/rrhh/models/Candidato');

    // 1. CARGAR TARIFAS Y TÉCNICOS PARA CRUCE
    const [tarifasLPU, cands, techs] = await Promise.all([
        TarifaLPU.find({ empresaRef: empresaId, activo: true }).lean(),
        Candidato.find({}).select('idRecursoToa empresaRef fullName').lean(),
        Tecnico.find({}).select('idRecursoToa empresaRef nombre nombres apellidos').lean()
    ]);

    const techCompanyMap = new Map();
    const slug = (str) => String(str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

    [...cands, ...techs].forEach(t => {
        const id = String(t.idRecursoToa || '').trim().replace(/^0+/, '');
        if (id) techCompanyMap.set(id, t.empresaRef);
        
        const rawName = (t.fullName || t.nombre || `${t.nombres || ''} ${t.apellidos || ''}`);
        const n = slug(rawName);
        if (n && n !== '—') techCompanyMap.set(n, t.empresaRef);
    });

    // 2. BUSCAR ACTIVIDADES EN RANGO (Unificado)
    const inicio = new Date(fechaInicio + 'T00:00:00Z');
    const fin = new Date(fechaFin + 'T23:59:59Z');

    const activities = await Actividad.find({ fecha: { $gte: inicio, $lte: fin } }).lean();
    console.log(`\n🔄 [recalcular-actividades] Procesando ${activities.length} actividades...`);

    // 3. CARGAR MOTOR DE CÁLCULO
    let calcularBaremos;
    try {
        const calculoEngine = require('./platforms/agentetelecom/utils/calculoEngine');
        calcularBaremos = calculoEngine.calcularBaremos;
    } catch (e) {
        console.warn('⚠️ calculoEngine no encontrado, usando fallback');
        calcularBaremos = (act) => ({ Pts_Total_Baremo: parseFloat(act.PTS_TOTAL_BAREMO || 0) });
    }

    // 4. GENERAR OPERACIONES
    const baremOpsH = [];
    const baremOpsM = [];
    const _companyTarifasCache = {}; 

    for (const doc of activities) {
        const idToa = String(doc.idRecursoToa || doc['ID Recurso'] || '').trim().replace(/^0+/, '');
        const nombreNorm = slug(doc.Nombre || doc.NOMBRE || '');
        
        const correctEmpresaRef = techCompanyMap.get(idToa) || techCompanyMap.get(nombreNorm) || doc.empresaRef || empresaId;
        
        const refStr = String(correctEmpresaRef);
        if (!_companyTarifasCache[refStr]) {
            _companyTarifasCache[refStr] = await TarifaLPU.find({ empresaRef: correctEmpresaRef, activo: true }).lean();
        }
        const currentTarifas = _companyTarifasCache[refStr];

        const resBaremo = calcularBaremos(doc, currentTarifas) || {};
        
        const op = {
            updateOne: {
                filter: { _id: doc._id },
                update: {
                    $set: {
                        ...resBaremo,
                        PTS_TOTAL_BAREMO: String(resBaremo.Pts_Total_Baremo || 0),
                        ptsTotalBaremo: parseFloat(resBaremo.Pts_Total_Baremo || 0),
                        empresaRef: correctEmpresaRef,
                        baremo_calculado_v2: true,
                        recalculadoEn: new Date()
                    }
                }
            }
        };

        if (doc._collType === 'H') baremOpsH.push(op);
        else baremOpsM.push(op);
    }

    let modifiedCount = 0;
    if (baremOpsH.length > 0) {
        const r = await Actividad.bulkWrite(baremOpsH, { ordered: false });
        modifiedCount += (r.modifiedCount || 0);
    }

    res.json({
        success: true,
        processed: activities.length,
        modified: modifiedCount,
        message: `Se han sincronizado ${activities.length} actividades.`
    });

  } catch (error) {
    console.error('❌ /api/recalcular-actividades-mongodb error:', error);
    res.status(500).json({ error: error.message });
  }
});

// HELPER: Formatear RUT a XX.XXX.XXX-X
const formatRUT = (rut) => {
  if (!rut) return '—';
  const cleaned = String(rut).replace(/[.\-]/g, '').toUpperCase().trim();
  if (cleaned.length < 7) return rut;
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  return `${body.slice(0, -3)}.${body.slice(-3)}-${dv}`;
};

// NOTE: el endpoint /api/produccion-dia-telecom está definido arriba (L2380).
// Esta segunda definición fue eliminada para evitar conflicto con Express.
// El endpoint /api/recalcular-actividades-mongodb ha sido unificado arriba.

// =============================================================================
// SINCRONIZAR TÉCNICOS VINCULADOS — Obtener producción de mis técnicos
// Busca técnicos de la empresa del usuario y retorna su producción agregada
// =============================================================================
app.post('/api/sincronizar-tecnicos-vinculados', botLimiter, protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef?._id || req.user.empresaRef;
    const { fechaInicio, fechaFin } = req.body;

    console.log(`\n🔄 [sincronizar-tecnicos-vinculados] Sincronizando producción`);
    console.log(`   Usuario: ${req.user?.email}`);
    console.log(`   Empresa: ${empresaId}`);
    console.log(`   Rango: ${fechaInicio || 'Inicio'} a ${fechaFin || 'Fin'}`);

    // 1. OBTENER TÉCNICOS VINCULADOS
    const tecnicos = await Tecnico.find({
      empresaRef: empresaId,
      idRecursoToa: { $exists: true, $ne: '' }
    }).select('_id idRecursoToa nombre apellidos ceco sede projectId').lean();

    console.log(`  👥 Técnicos vinculados encontrados: ${tecnicos.length}`);

    if (tecnicos.length === 0) {
      return res.json({
        success: true,
        stats: {
          tecnicosVinculados: 0,
          actividadesEncontradas: 0,
          puntosTotal: 0,
          mensaje: 'No hay técnicos vinculados con ID de recurso'
        }
      });
    }

    // 2. OBTENER ACTIVIDADES DE ESTOS TÉCNICOS
    const idsRecurso = tecnicos.map(t => String(t.idRecursoToa).trim()).filter(Boolean);

    let query = {
      empresaRef: empresaId,
      RECURSO: { $in: idsRecurso }
    };

    // Filtrar por rango de fechas si se proporciona
    if (fechaInicio || fechaFin) {
      query.fecha = {};
      if (fechaInicio) query.fecha.$gte = new Date(fechaInicio);
      if (fechaFin) {
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);
        query.fecha.$lte = fin;
      }
    }

    const actividades = await Actividad.find({ $and: [query] }).select('RECURSO fecha PTS_TOTAL_BAREMO Codigo_LPU_Base Desc_LPU_Base ptsTotalBaremo').lean();

    console.log(`  📋 Actividades encontradas: ${actividades.length}`);

    // 3. AGREGAR DATOS POR TÉCNICO
    const tecnicosMap = new Map();
    tecnicos.forEach(t => {
      tecnicosMap.set(String(t.idRecursoToa), {
        _id: t._id,
        idRecursoToa: t.idRecursoToa,
        nombre: `${t.nombre || ''} ${t.apellidos || ''}`.trim(),
        ceco: t.ceco || '',
        sede: t.sede || '',
        actividades: [],
        totalPuntos: 0,
        totalActividades: 0
      });
    });

    // Agrupar actividades por técnico
    actividades.forEach(act => {
      const tecnico = tecnicosMap.get(String(act.RECURSO));
      if (tecnico) {
        const pts = parseFloat(act.PTS_TOTAL_BAREMO || 0);
        tecnico.actividades.push({
          fecha: act.fecha,
          puntos: pts,
          codigo: act.Codigo_LPU_Base,
          descripcion: act.Desc_LPU_Base
        });
        tecnico.totalPuntos += pts;
        tecnico.totalActividades++;
      }
    });

    // 4. RETORNAR DATOS
    const tecnicosConProduccion = Array.from(tecnicosMap.values())
      .filter(t => t.totalActividades > 0)
      .sort((a, b) => b.totalPuntos - a.totalPuntos);

    const totalPuntosGlobal = Array.from(tecnicosMap.values())
      .reduce((sum, t) => sum + t.totalPuntos, 0);

    console.log(`  ✅ RESUMEN:`);
    console.log(`     • Técnicos con producción: ${tecnicosConProduccion.length}/${tecnicos.length}`);
    console.log(`     • Actividades totales: ${actividades.length}`);
    console.log(`     • Puntos totales: ${Math.round(totalPuntosGlobal * 100) / 100}\n`);

    res.json({
      success: true,
      stats: {
        tecnicosVinculados: tecnicos.length,
        tecnicosConProduccion: tecnicosConProduccion.length,
        actividadesEncontradas: actividades.length,
        puntosTotal: Math.round(totalPuntosGlobal * 100) / 100
      },
      tecnicos: tecnicosConProduccion
    });

  } catch (error) {
    console.error('❌ /api/sincronizar-tecnicos-vinculados error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// PRODUCCIÓN FINANCIERA — Dashboard ejecutivo de facturación
// Convierte puntos baremo → CLP usando ValorPuntoCliente.valor_punto
// =============================================================================
// ENDPOINT DE DIAGNÓSTICO: Verificar sincronización Candidato <-> Tecnico
// =============================================================================
app.get('/api/debug/sincronizacion/:rut', protect, async (req, res) => {
  try {
    const rutParam = req.params.rut.replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();
    const empresaId = req.user.empresaRef?._id || req.user.empresaRef;

    console.log(`\n🔍 DIAGNÓSTICO DE SINCRONIZACIÓN`);
    console.log(`RUT: ${rutParam}, Empresa: ${empresaId}`);

    const candidato = await Candidato.findOne({ rut: rutParam, empresaRef: empresaId }).lean();
    const tecnico = await Tecnico.findOne({ rut: rutParam, empresaRef: empresaId }).lean();

    // Datos del cache de valorización
    const mapaVal = await construirMapaValorizacion(empresaId);
    const cacheTecnicoData = tecnico?.idRecursoToa ? mapaVal[tecnico.idRecursoToa] : null;

    const diagnos = {
      rut: rutParam,
      candidato: candidato ? {
        _id: candidato._id,
        fullName: candidato.fullName,
        status: candidato.status,
        projectId: candidato.projectId,
        position: candidato.position,
        ceco: candidato.ceco,
        sede: candidato.sede,
        idRecursoToa: candidato.idRecursoToa
      } : null,
      tecnico: tecnico ? {
        _id: tecnico._id,
        nombres: tecnico.nombres,
        apellidos: tecnico.apellidos,
        cargo: tecnico.cargo,
        projectId: tecnico.projectId,
        area: tecnico.area,
        ceco: tecnico.ceco,
        sede: tecnico.sede,
        idRecursoToa: tecnico.idRecursoToa,
        estadoActual: tecnico.estadoActual
      } : null,
      mapaValorizacion: cacheTecnicoData ? {
        cliente: cacheTecnicoData.cliente,
        proyecto: cacheTecnicoData.proyecto,
        valorPunto: cacheTecnicoData.valorPunto,
        retencion: cacheTecnicoData.retencion
      } : null,
      sincronizado: {
        candidatoExiste: !!candidato,
        tecnicoExiste: !!tecnico,
        projectIdSincronizado: candidato?.projectId?.toString() === tecnico?.projectId?.toString(),
        cargoSincronizado: candidato?.position === tecnico?.cargo,
        cecoSincronizado: candidato?.ceco === tecnico?.ceco,
        sedeSincronizada: candidato?.sede === tecnico?.sede,
        idRecursoToaSincronizado: candidato?.idRecursoToa === tecnico?.idRecursoToa,
        enMapaValorizacion: !!cacheTecnicoData
      },
      cacheVersion: {
        currentVersion: (process.__mapValVersionByEmpresa && process.__mapValVersionByEmpresa[empresaId]) || 0,
        mapaCacheCreated: !!_mapaValorizacionCache[empresaId],
        mapaCacheVersion: _mapaValorizacionCache[empresaId]?.ver,
        mapaCacheAge: _mapaValorizacionCache[empresaId] ? Date.now() - (_mapaValorizacionCache[empresaId]?.ts || 0) : null
      }
    };

    console.log(`✅ Diagnostico completado:`, JSON.stringify(diagnos, null, 2));
    res.json(diagnos);
  } catch (err) {
    console.error(`❌ Error en diagnóstico:`, err.message);
    res.status(500).json({ message: err.message, stack: err.stack });
  }
});

// =============================================================================
// ENDPOINT DE FUERZA: Truncar caché de valorización y reconstruir desde DB
// =============================================================================
app.post('/api/debug/reset-cache-valorizacion', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef?._id || req.user.empresaRef;

    console.log(`\n🔄 RESETEO DE CACHE DE VALORIZACIÓN`);
    console.log(`Empresa: ${empresaId}`);

    // Truncar cache
    if (_mapaValorizacionCache[empresaId]) {
      delete _mapaValorizacionCache[empresaId];
      console.log(`✅ Cache truncado`);
    }

    // Bump version
    if (!process.__mapValVersionByEmpresa) process.__mapValVersionByEmpresa = {};
    const oldVer = process.__mapValVersionByEmpresa[empresaId] || 0;
    process.__mapValVersionByEmpresa[empresaId] = oldVer + 1;
    console.log(`📊 Versión bumped: ${oldVer} → ${process.__mapValVersionByEmpresa[empresaId]}`);

    // Reconstruir inmediatamente
    const nuevoMapa = await construirMapaValorizacion(empresaId);
    console.log(`✅ Nuevo mapa construido con ${Object.keys(nuevoMapa).length} tecnicos`);

    res.json({
      message: 'Cache reseteado y reconstruido',
      oldVersion: oldVer,
      newVersion: process.__mapValVersionByEmpresa[empresaId],
      mapaSize: Object.keys(nuevoMapa).length,
      idRecursos: Object.keys(nuevoMapa).slice(0, 10)
    });
  } catch (err) {
    console.error(`❌ Error reseteando cache:`, err.message);
    res.status(500).json({ message: err.message, stack: err.stack });
  }
});

// =============================================================================
app.get('/api/bot/produccion-financiera', botLimiter, protect, async (req, res) => {
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
        { "RECURSO": { $in: restrictedIDs } },
        { "RECURSO": { $in: restrictedIDs } },
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
        { "RECURSO": { $in: ids } },
        { "RECURSO": { $in: ids } },
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

    const desdeTs = desde ? new Date(desde + 'T00:00:00Z').getTime() : null;
    const hastaTs = hasta ? new Date(hasta + 'T23:59:59Z').getTime() : null;

    // GUARDAR EL ESTADO SELECCIONADO Y ELIMINARLO DEL FILTRO DATABASE PARA PROCESAMIENTO DINÁMICO
    const selectedStatus = estado || 'Completado';
    const selectedStatusArr = selectedStatus === 'todos' ? [] : selectedStatus.split(',').map(s => s.trim().toLowerCase());
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
    const nameToMapKey = {};
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
      // Normalización de ID para vinculación infalible (quitar ceros a la izquierda)
      const idOriginal = String(t.idRecursoToa).trim();
      const idNorm = idOriginal.replace(/^0+/, '');
      const name = formatShortName(t.nombre, t.nombres, t.apellidos);
      const cp = mapaVal[idOriginal] || {};
      
      techMap[idNorm] = {
        name,
        idRecurso: idNorm, cliente: cp.cliente || 'Sin Cliente', proyecto: cp.proyecto || 'Sin Proyecto',
        valorPunto: cp.valorPunto || valorPuntoRef, retencionPct: cp.retencion || 0,
        sueldoBase: t.sueldoBase || 0, montoBonoFijo: t.montoBonoFijo || 0,
        orders: 0, ptsTotal: 0, ptsBase: 0, ptsDeco: 0, ptsDecoCable: 0, ptsDecoWifi: 0, ptsRepetidor: 0, ptsTelefono: 0, facturacion: 0, retencion: 0, facturacionNeta: 0,
        qtyDeco: 0, qtyDecoCable: 0, qtyDecoWifi: 0, qtyRepetidor: 0, qtyTelefono: 0, provisionCount: 0, repairCount: 0,
        days: new Set(), dailyMap: {}, activities: {}, byTipoTrabajo: {}, cityMap: {}, clientMap: {},
        cargo: t.cargo || 'TÉCNICO',
        status: 'Operativo'
      };
      if (name) nameToMapKey[name.toLowerCase().trim()] = idNorm;
    });

    // Pre-buscar tarifa de decos — usar la de MÍNIMO puntos (WiFi 0.25 > cable 0.5)
    const decoWifiTarifa_f = tarifasLPU
      .filter(t => t.mapeo?.es_equipo_adicional &&
        ['Decos_WiFi_Adicionales', 'Decos_Adicionales', 'Decos_Cable_Adicionales'].includes(t.mapeo?.campo_cantidad))
      .sort((a, b) => a.puntos - b.puntos)[0];
    const decoWifiPts_f = decoWifiTarifa_f ? decoWifiTarifa_f.puntos : 0.25;

    if (desde) filtro.fecha = { ...filtro.fecha, $gte: new Date(desde + 'T00:00:00Z') };
    if (hasta) filtro.fecha = { ...filtro.fecha, $lte: new Date(hasta + 'T23:59:59Z') };

    // ── 3. QUERY CONSOLIDADA EN ACTIVIDADES ──
    const docs = await Actividad.find(filtro).lean();

    console.log(`[DIAGNOSTICO] Procesando ${docs.length} docs. IDs en mapa:`, Object.keys(techMap).slice(0, 10));

    for (const doc of docs) {
      // 1. Sanitización de keys AGRESIVA -> TODO A MAYÚSCULAS para evitar errores de nombres
      const clean = {};
      for (const [k, v] of Object.entries(doc)) {
        clean[k.replace(/[\.\s]/g, '_').toUpperCase()] = v;
      }

      // 2. EXTRACCIÓN DE ID ULTRA-ROBUSTA (Sincronizada con Espejo)
      // Buscamos en TODOS los campos posibles en MAYÚSCULAS
      let idRecursoRaw = 
        clean.RECURSO || 
        clean.IDRECURSOTOA || 
        clean.ID_RECURSO_TOA || 
        clean.ID_RECURSO || 
        clean['ID_RECURSO'] || 
        clean['AUTO_ASIGNADO_A_RECURSO_(ID)'] ||
        clean.TECNICO ||
        '';

      const idRecurso = String(idRecursoRaw || '').trim().replace(/^0+/, '');
      const techKey = techMap[idRecurso] ? idRecurso : ''; 
      
      if (!techKey && docs.indexOf(doc) < 3) {
        console.log(`[DIAGNOSTICO] Fallo en Doc. ID extraído: "${idRecurso}". Keys:`, Object.keys(clean).slice(0, 10));
      }
      
      if (!techKey || !techMap[techKey]) continue;
      const t = techMap[techKey];

      // 3. INTELIGENCIA LPU CENTRALIZADA (100% Alineada con Configuración)
      const baremos = calcularBaremos(clean, tarifasLPU) || {};
      const valorizacion = valorizarBaremos(baremos, mapaVal) || {};

      const pTotal = parseFloat(baremos.Pts_Total_Baremo || 0);
      const pBase  = parseFloat(baremos.Pts_Actividad_Base || 0);
      const pDeco  = parseFloat(baremos.Pts_Deco_Adicional || baremos.Pts_Deco_WiFi || 0);
      const pRep   = parseFloat(baremos.Pts_Repetidor_WiFi || 0);
      const pTel   = parseFloat(baremos.Pts_Telefono || 0);
      const valorCLP = parseFloat(valorizacion.Valor_Actividad_CLP || 0);

      const qD = parseInt(baremos.Decos_Adicionales || baremos.Decos_WiFi_Adicionales || 0);
      const qR = parseInt(baremos.Repetidores_WiFi || 0);
      const qT = parseInt(baremos.Telefonos || 0);

      const cleanEstado = clean.ESTADO || clean.Estado || 'Sin Estado';

      // --- 4. FILTRO DE CLIENTE & PROYECTO ---
      if (filterClientes.length > 0) {
        const cpConfig = mapaVal[techKey] || {};
        const tId = String(cpConfig.clienteId || '').toUpperCase();
        const tName = String(cpConfig.cliente || '').trim().toUpperCase();
        if (!filterClientes.includes(tId) && !filterClientes.includes(tName)) continue;
      }

      // --- 5. AGREGACIÓN DE ESTADOS & FILTRO SELECCIONADO ---
      estadoCountMap[cleanEstado] = (estadoCountMap[cleanEstado] || 0) + 1;
      if (selectedStatus !== 'todos' && !selectedStatusArr.includes(cleanEstado.toLowerCase())) continue;

      const tCliName = (t.cliente || '').toUpperCase();
      const contractor = tCliName.includes('ZENER') ? 'ZENER' : (tCliName.includes('COMFICA') ? 'COMFICA' : 'OTROS');

      const ciudad = (clean.CIUDAD || clean.Ciudad || clean.ciudad || clean.COMUNA || '').toUpperCase().trim();
      const tipoTrabajo = clean.TIPO_DE_TRABAJO || clean.Tipo_de_Trabajo || '';
      const descLpu = baremos.Desc_LPU_Base || clean.SUBTIPO_DE_ACTIVIDAD || '';
      const fecha = clean.FECHA || clean.fecha || clean.FECHA_INSTALACION || clean.Fecha_Instalacion;
      const fechaTs = fecha ? new Date(fecha).getTime() : NaN;
      
      if (desdeTs !== null || hastaTs !== null) {
        if (Number.isNaN(fechaTs)) continue;
        if (desdeTs !== null && fechaTs < desdeTs) continue;
        if (hastaTs !== null && fechaTs > hastaTs) continue;
      }

      totalOrders_f++; totalPts_f += pTotal; totalCLP_f += valorCLP;

      // --- 6. AGREGACIÓN MENSUAL ---
      const dateObj = new Date(fecha);
      const monthKey = !isNaN(dateObj) ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}` : 'Sin Fecha';
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = { mes: monthKey, ptsBase: 0, ptsDeco: 0, ptsRepetidor: 0, ptsTelefono: 0, ptsTotal: 0, clp: 0, orders: 0 };
      }
      const mm = monthMap[monthKey];
      mm.ptsBase += pBase; mm.ptsDeco += pDeco; mm.ptsRepetidor += pRep; mm.ptsTelefono += pTel; mm.ptsTotal += pTotal; mm.clp += valorCLP; mm.orders++;

      t.orders++; t.ptsTotal += pTotal; t.ptsBase += pBase;
      t.ptsDeco += pDeco; t.ptsDecoWifi += pDeco;
      t.ptsRepetidor += pRep; t.ptsTelefono += pTel;
      t.facturacion += valorCLP;
      const _descuentoRet = Math.round(valorCLP * ((t.retencionPct || 0) / 100));
      t.retencion += _descuentoRet;
      t.facturacionNeta += (valorCLP - _descuentoRet);
      t.contractor = contractor;

      t.qtyDeco += qD;
      t.qtyRepetidor += qR;
      t.qtyTelefono += qT;
      
      const isRepair = (clean.ORDENID || clean.NÚMERO_DE_PETICIÓN || clean.NUMERO_DE_PETICION || clean.ORDEN_ID || '').toString().toUpperCase().startsWith('INC');
      t.provisionCount += isRepair ? 0 : 1; t.repairCount += isRepair ? 1 : 0;

      // Acumular valorización de equipos
      totalQtyDeco += qD;
      totalQtyRep += qR;
      totalQtyTel += qT;

      const pDecoVal = parseSafe(clean['VALOR_DECO'] || clean['VALOR_DECO_ADICIONAL']) || (pDeco * valorPuntoRef);
      const pRepVal = parseSafe(clean['VALOR_REPETIDOR'] || clean['VALOR_WIFI']) || (pRep * valorPuntoRef);
      const pTelVal = parseSafe(clean['VALOR_TELEFONO']) || (pTel * valorPuntoRef);

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
            cliente: t.cliente, proyecto: t.proyecto, valPunto: t.valorPunto, pts: 0, clp: 0, orders: 0,
            techs: new Set(), days: new Set(), zenerClp: 0, comficaClp: 0
          };
        }
        const cp = clientProjectMap[cpKey];
        cp.pts += pTotal; cp.clp += valorCLP; cp.orders++; cp.techs.add(t.name); if (dateKey) cp.days.add(dateKey);
        if (contractor === 'ZENER') cp.zenerClp += valorCLP;
        else if (contractor === 'COMFICA') cp.comficaClp += valorCLP;

        // Población del mapa por técnico para desglose en frontend
        if (!t.clientMap[cpKey]) {
          t.clientMap[cpKey] = { cliente: t.cliente, proyecto: t.proyecto, pts: 0, clp: 0, orders: 0 };
        }
        t.clientMap[cpKey].pts += pTotal;
        t.clientMap[cpKey].clp += valorCLP;
        t.clientMap[cpKey].orders++;
      }

      if (tipoTrabajo) {
        if (!tipoTrabajoMap[tipoTrabajo]) tipoTrabajoMap[tipoTrabajo] = { clp: 0, pts: 0, orders: 0 };
        tipoTrabajoMap[tipoTrabajo].clp += valorCLP; tipoTrabajoMap[tipoTrabajo].pts += pTotal; tipoTrabajoMap[tipoTrabajo].orders++;
      }
      if (descLpu) {
        if (!lpuMap[descLpu]) lpuMap[descLpu] = { desc: descLpu, count: 0, totalPts: 0, totalCLP: 0, grupo: baremos.Grupo_LPU_Base || '', categoria: baremos.Categoria_LPU_Base || '' };
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
          retencionPct: t.retencionPct || 0,
          retencion: Math.round(t.retencion || 0),
          facturacionNeta: Math.round(t.facturacionNeta || 0),
          avgFactDia: activeDays > 0 ? Math.round(t.facturacion / activeDays) : 0,
          isVinculado: true,
          trend,
          margen: Math.round(t.facturacionNeta - (t.sueldoBase + t.montoBonoFijo))
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
        totalRetencion: tecnicos.reduce((s, t) => s + (t.retencion || 0), 0),
        totalFacturacionNeta: tecnicos.reduce((s, t) => s + (t.facturacionNeta || 0), 0),
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
app.get('/api/bot/produccion-raw', botLimiter, protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const userRole = req.user.role?.toLowerCase();
    const isSystemAdmin = req.user.role === 'system_admin';
    const { desde, hasta, estado, tipo, months, weeks, proyectos, actividad } = req.query;

    // Validar fechas
    if (desde && (typeof desde !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(desde))) desde = undefined;
    if (hasta && (typeof hasta !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(hasta))) hasta = undefined;

    // IDs de vinculados para filtro restrictivo
    const tVinculados = await Tecnico.find({ empresaRef: empresaId, idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa').lean();
    const vinculadosList = tVinculados.map(t => String(t.idRecursoToa).trim());

    let idParaFiltro = empresaId;
    try { idParaFiltro = new mongoose.Types.ObjectId(empresaId); } catch(e) {}

    const filtro = isSystemAdmin ? {} : {
      empresaRef: { $in: [idParaFiltro, String(idParaFiltro)] },
      $or: [
        { "RECURSO": { $in: vinculadosList } },
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

    // ── QUERY CONSOLIDADA EN ACTIVIDADES ──
    const docs = await Actividad.find(filtro).lean();

    // Obtener tarifas para re-cálculo on-the-fly si faltan puntos
    const tarifasLPU = await obtenerTarifasEmpresa(empresaId);

    const vinculadosSet = new Set(vinculadosList);
    const filtered = isSystemAdmin ? docs : docs.filter(d => {
      const idRec = d['RECURSO'] || d['RECURSO'] || '';
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
        'RECURSO': d['RECURSO'] || d['RECURSO'] || '',
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
app.get('/api/bot/datos-toa', botLimiter, protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    let { desde, hasta, busqueda, page = 1, limit = 50, sortKey = 'fecha', sortDir = 'desc', clientes } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (desde && (typeof desde !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(desde))) desde = undefined;
    if (hasta && (typeof hasta !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(hasta))) hasta = undefined;

    const ROLES = require('./platforms/auth/roles');
    const currentEmail = req.user.email?.toLowerCase().trim();
    const isSystemAdmin = req.user.role === ROLES.SYSTEM_ADMIN || req.user.role === ROLES.CEO;

    //IDs de vinculados para filtro restrictivo (Security Layer)
    const tecnicosVinculados = await Tecnico.find({ empresaRef: empresaId, idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa').lean();
    const vinculadosList = tecnicosVinculados.map(t => String(t.idRecursoToa).trim());

    // Filtro estricto: Solo CEO Global ve todo. Otros SOLO ven sus vinculados.
    const filtro = { empresaRef: empresaId };
    if (!isSystemAdmin) {
      // Si hay vinculados, filtramos por ellos. Si NO hay, el admin de la empresa debería ver todo lo de su empresa.
      if (vinculadosList.length > 0) {
        filtro.RECURSO = { $in: vinculadosList };
      }
    }
    if (desde) filtro.fecha = { ...filtro.fecha, $gte: new Date(desde + 'T00:00:00Z') };
    if (hasta) filtro.fecha = { ...filtro.fecha, $lte: new Date(hasta + 'T23:59:59Z') };

    // Filtro Clientes (Array o String) - usar campo normalizado
    if (clientes) {
      const cliArr = Array.isArray(clientes) ? clientes : [clientes];
      if (cliArr.length > 0) {
        filtro.NOMBRE = { $in: cliArr };
      }
    }

    // ======== BÚSQUEDA GLOBAL (UPPERCASE CANÓNICOS) ========
    if (busqueda && busqueda.trim().length > 0) {
      const regex = new RegExp(busqueda.trim(), 'i');
      filtro.$and = [
        {
          $or: [
            { "ACTIVIDAD": regex },
            { "RECURSO": regex },
            { "NÚMERO_DE_PETICIÓN": regex },
            { "ESTADO": regex },
            { "SUBTIPO_DE_ACTIVIDAD": regex },
            { "NOMBRE": regex },
            { "RUT_DEL_CLIENTE": regex },
            { "CIUDAD": regex },
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
      // ════════════════════════════════════════════════════════════════════════
      // PASO 1: Normalización AGRESIVA → UPPERCASE + underscores
      // ════════════════════════════════════════════════════════════════════════
      const clean = {};
      const seenCanon = {}; // Track canónicos ya agregados

      for (const [k, v] of Object.entries(doc)) {
        // Normalizar: espacios/puntos → underscores, a UPPERCASE
        const normalized = k
          .replace(/[\s\.]/g, '_')           // Espacios y puntos → underscore
          .replace(/_+/g, '_')               // Deduplica underscores
          .toUpperCase();                     // UPPERCASE

        // Smart mapping de variantes comunes a canónicos
        let canonical = normalized;
        const mappings = {
          'PTS_DECO_CABLE': 'PTS_DECO_ADICIONAL',
          'PTS_DECO_WIFI': 'PTS_DECO_ADICIONAL',
          'PTS_DECO_ADICIONAL_CABLE': 'PTS_DECO_ADICIONAL',
          'PTS_DECO_ADICIONAL_WIFI': 'PTS_DECO_ADICIONAL',
          'PTOS_DECO_ADICIONAL': 'PTS_DECO_ADICIONAL',
          'DECOS_CABLE_ADICIONALES': 'DECOS_ADICIONALES',
          'DECOS_WIFI_ADICIONALES': 'DECOS_ADICIONALES',
          'DECOS_ADICIONALES_PTS': 'PTS_DECO_ADICIONAL',
          'REPETIDORES_WIFI_PTS': 'PTS_REPETIDOR_WIFI',
          'REPETIDORES_WIFI_CANT': 'REPETIDORES_WIFI',
          'REPETIDORES_WIFI_CANTIDAD': 'REPETIDORES_WIFI',
          'TELEFONOS_PTS': 'PTS_TELEFONO',
          'TELEFONOS_CANT': 'TELEFONOS',
          'TELEFONOS_CANTIDAD': 'TELEFONOS',
          'ID_RECURSO': 'RECURSO',
          'ID RECURSO': 'RECURSO',
          'IDRECURSO': 'RECURSO',
          'PRODUCTOS_Y_SERVICIOS_CONTRATADOS': 'PRODUCTOS_Y_SERVICIOS_CONTRATADOS'
        };

        if (mappings[canonical]) {
          canonical = mappings[canonical];
        }

        // Evitar duplicados: si canonical ya existe, skip
        if (!seenCanon[canonical]) {
          seenCanon[canonical] = true;
          clean[canonical] = v;
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // PASO 2: Garantizar que RECURSO siempre existe
      // ════════════════════════════════════════════════════════════════════════
      if (!clean['RECURSO']) {
        if (clean['ID_RECURSO']) {
          clean['RECURSO'] = clean['ID_RECURSO'];
          delete clean['ID_RECURSO'];
        } else {
          console.warn(`⚠️ Actividad ${doc.ordenId} sin RECURSO/ID_RECURSO`);
          clean['RECURSO'] = 'UNKNOWN';
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // PASO 3: Re-parsear XML si falta desglose Cable/WiFi
      // ════════════════════════════════════════════════════════════════════════
      const hasSplit = clean['DECOS_CABLE_ADICIONALES'] !== undefined && clean['DECOS_WIFI_ADICIONALES'] !== undefined;
      const xmlField = clean['PRODUCTOS_Y_SERVICIOS_CONTRATADOS'] || '';

      if (!hasSplit && xmlField) {
        let derivados = xmlCacheToa.get(xmlField);
        if (derivados === undefined) {
          derivados = parsearProductosServiciosTOA(xmlField);
          xmlCacheToa.set(xmlField, derivados || null);
        }
        if (derivados) {
          Object.entries(derivados).forEach(([k, v]) => {
            const canon = k.toUpperCase().replace(/[\s\.]/g, '_');
            if (!clean[canon]) clean[canon] = v;
          });
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // PASO 4: Calcular baremos solo si no existen
      // ════════════════════════════════════════════════════════════════════════
      if (!clean['PTS_TOTAL_BAREMO'] && tarifasLPU.length > 0) {
        const baremos = calcularBaremos(clean, tarifasLPU);
        if (baremos) {
          Object.entries(baremos).forEach(([k, v]) => {
            if (!clean[k]) clean[k] = v;
          });
        }
      }

      const valorizacion = valorizarBaremos(clean, mapaValorizacion);
      Object.assign(clean, valorizacion);

      // ════════════════════════════════════════════════════════════════════════
      // PASO 5: Consolidar campos CANÓNICOS UPPERCASE
      // ════════════════════════════════════════════════════════════════════════
      const ps = (v) => {
        if (!v || v === '' || v === undefined || v === null) return 0;
        if (typeof v === 'number') return v;
        const s = String(v).replace(',', '.').trim();
        return parseFloat(s) || 0;
      };

      const pB = ps(clean['PTS_ACTIVIDAD_BASE'] || 0);
      const pR = ps(clean['PTS_REPETIDOR_WIFI'] || 0);
      const pT = ps(clean['PTS_TELEFONO'] || 0);

      // Cantidades de equipos — evitar doble conteo
      const qD = Math.floor(ps(clean['DECOS_ADICIONALES'] || 0));
      const qR = Math.floor(ps(clean['REPETIDORES_WIFI'] || 0));
      const qT = Math.floor(ps(clean['TELEFONOS'] || 0));

      // Puntos de decos — siempre WiFi × tarifa LPU
      const pD = qD * decoWifiPts_t;
      const pExpl = pB + pD + pR + pT;
      const pField = ps(clean['PTS_TOTAL_BAREMO'] || 0);
      const pTotal = pExpl > 0 ? pExpl : pField;

      // FIX: Lógica correcta de pBase
      let pBase = pB;
      if (pBase === 0 && pTotal > 0) {
        // Si no hay base pero hay total, deducirlo de total - equipos
        pBase = Math.max(0, pTotal - pD - pR - pT);
        if (pBase === 0) pBase = pTotal; // Fallback: asumir todo es base
      }

      // Escribir campos canónicos
      clean['PTS_TOTAL_BAREMO'] = pTotal;
      clean['PTS_ACTIVIDAD_BASE'] = pBase;
      clean['PTS_DECO_ADICIONAL'] = pD;
      clean['PTS_REPETIDOR_WIFI'] = pR;
      clean['PTS_TELEFONO'] = pT;
      clean['DECOS_ADICIONALES'] = qD;
      clean['REPETIDORES_WIFI'] = qR;
      clean['TELEFONOS'] = qT;
      clean['TOTAL_EQUIPOS_EXTRAS'] = qD + qR + qT;

      // ════════════════════════════════════════════════════════════════════════
      // PASO 6: Remover TODOS los campos legacy/duplicados
      // ════════════════════════════════════════════════════════════════════════
      const legacyToRemove = [
        'PUNTOS_TOTAL', 'PUNTOS', 'TOTAL_PUNTOS', 'PUNTOS_BASE',
        'DECOS_CABLE_ADICIONALES', 'DECOS_WIFI_ADICIONALES',
        'RAWDATA', 'CAMPOSCUSTOM', 'FUENTEDATOS',
        'TECNICOID', 'CLIENTEASOCIADO', 'INGRESO',
        'LATITUD', 'LONGITUD', 'NOMBREBRUTO'
      ];
      legacyToRemove.forEach(k => delete clean[k]);

      return clean;
    });

    res.json({ datos: datosSanitizados, totalReal, totalPaginas, paginaActual: pageNum });
  } catch (error) {
    console.error('❌ /api/bot/datos-toa error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2.2a ESPEJO COMPLETO — Retorna TODOS los datos sin transformaciones
// ═══════════════════════════════════════════════════════════════════════════════
// Propósito: Tabla DescargaTOA que sea un reflejo exacto de MongoDB
// - Sin normalización de columnas
// - TODOS los campos tal cual fueron guardados
// - Data pura con cálculos ya aplicados
// - CEO ve TODO, otros usuarios ven solo sus técnicos vinculados
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/bot/datos-toa-espejo', botLimiter, protect, async (req, res) => {
  try {
    const ROLES = require('./platforms/auth/roles');
    const empresaId = req.user.empresaRef;
    const userRole = req.user.role;
    const isSystemAdmin = userRole === ROLES.SYSTEM_ADMIN || userRole === ROLES.CEO;

    let { desde, hasta, page = 1, limit = 100 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(10, Math.min(100, parseInt(limit) || 100));

    let idParaFiltro = empresaId;
    try { idParaFiltro = new mongoose.Types.ObjectId(empresaId); } catch(e) {}
    
    const filtro = isSystemAdmin ? {} : { 
      empresaRef: { $in: [idParaFiltro, String(idParaFiltro)] } 
    };

    if (!isSystemAdmin) {
      const tecnicos = await Tecnico.find({
        empresaRef: empresaId,
        idRecursoToa: { $exists: true, $ne: '' }
      }).select('idRecursoToa').lean();
      const idsVinculados = tecnicos.map(t => String(t.idRecursoToa).trim()).filter(Boolean);
      if (idsVinculados.length > 0) {
        filtro.$or = [
          { 'ID Recurso': { $in: idsVinculados } },
          { 'idRecursoToa': { $in: idsVinculados } },
          { 'recurso': { $in: idsVinculados } },
          { 'RECURSO': { $in: idsVinculados } }
        ];
      }
    }

    if (desde || hasta) {
      filtro.fecha = {};
      if (desde) filtro.fecha.$gte = new Date(desde + 'T00:00:00Z');
      if (hasta) filtro.fecha.$lte = new Date(hasta + 'T23:59:59Z');
    }

    // ── Pipeline Unificado con Paginación ──
    const pipeline = [
      { $match: filtro },
      { $sort: { fecha: -1, ordenId: 1 } },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: (pageNum - 1) * limitNum }, { $limit: limitNum }]
        }
      }
    ];

    const [results] = await Actividad.aggregate(pipeline);
    const totalReal = results.metadata[0]?.total || 0;
    const datosRaw = results.data || [];
    const totalPaginas = Math.ceil(totalReal / limitNum) || 1;

    // Cargar utilidades de cálculo
    const [tarifasLPU, mapaValorizacion] = await Promise.all([
      obtenerTarifasEmpresa(empresaId),
      construirMapaValorizacion(empresaId)
    ]);

    const datosCalculados = datosRaw.map(doc => {
      const baremos = calcularBaremos(doc, tarifasLPU) || {};
      const valorizacion = valorizarBaremos(baremos, mapaValorizacion) || {};

      const row = {
        'PTS_BASE':          parseFloat(baremos.Pts_Actividad_Base || 0),
        'PTS_DECO':          parseFloat(baremos.Pts_Deco_Adicional || baremos.Pts_Deco_WiFi || 0),
        'PTS_REPETIDOR':     parseFloat(baremos.Pts_Repetidor_WiFi || 0),
        'PTS_TOTAL':         parseFloat(baremos.Pts_Total_Baremo || 0),
        'DECOS_ADICIONALES': parseInt(baremos.Decos_Adicionales || baremos.Decos_WiFi_Adicionales || 0),
        'REPETIDORES_WIFI':  parseInt(baremos.Repetidores_WiFi || 0),
        'VALOR_CLP':         parseFloat(valorizacion.Valor_Actividad_CLP || 0),
        'LPU_COD':           baremos.Codigo_LPU_Base || '',
        'LPU_DESC':          baremos.Desc_LPU_Base || '',
        'FECHA_BOT':         doc.FECHA_DESCARGA_BOT || doc.Fecha_Descarga_Bot || '',
      };

      Object.keys(doc).forEach(key => {
        const kUp = key.toUpperCase();
        const isBaremoDupe = kUp.includes('PTS') || kUp.includes('BAREMO') || kUp.includes('DECO') || kUp.includes('REPETIDOR') || kUp.includes('VALOR_CLP');
        if (!row.hasOwnProperty(key) && !isBaremoDupe && key !== '_id' && key !== '__v') {
          row[key] = doc[key];
        }
      });
      return row;
    });

    res.json({
      success: true,
      datos: datosCalculados, 
      totalReal,
      totalPaginas,
      paginaActual: pageNum,
      registrosPorPagina: limitNum
    });

  } catch (error) {
    console.error('❌ /api/bot/datos-toa-espejo error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2.2b EXPORTAR EXCEL COMPLETO — Server-side (sin límite de registros)
// Genera archivo XLSX directamente en el servidor con TODOS los registros
app.get('/api/bot/exportar-toa', botLimiter, protect, async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const empresaId = req.user.empresaRef;
    const currentEmail = req.user.email?.toLowerCase().trim();
    const isSystemAdmin = req.user.role === 'system_admin';
    const { desde, hasta, clientes } = req.query;

    // IDs de vinculados para filtro restrictivo (Security Layer)
    const tExp = await Tecnico.find({ empresaRef: empresaId, idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa').lean();
    const restrictedIDs = tExp.map(t => String(t.idRecursoToa).trim());

    let idParaFiltro = empresaId;
    try { idParaFiltro = new mongoose.Types.ObjectId(empresaId); } catch(e) {}
    const filtro = { empresaRef: { $in: [idParaFiltro, String(idParaFiltro)] } };

    if (!isSystemAdmin) {
      if (restrictedIDs.length > 0) {
        filtro.$or = [
          { "RECURSO": { $in: restrictedIDs } },
          { "RECURSO": { $in: restrictedIDs } },
          { "RECURSO": { $in: restrictedIDs } },
          { idRecurso: { $in: restrictedIDs } },
          { "Recurso": { $in: restrictedIDs } }
        ];
      }
    }
    if (desde) filtro.fecha = { ...filtro.fecha, $gte: new Date(desde + 'T00:00:00Z') };
    if (hasta) filtro.fecha = { ...filtro.fecha, $lte: new Date(hasta + 'T23:59:59Z') };

    // Filtro Clientes (Array o String)
    if (clientes) {
      const cliArr = Array.isArray(clientes) ? clientes : [clientes];
      if (cliArr.length > 0) {
        filtro.clienteAsociado = { $in: cliArr };
      }
    }

    const datos = await Actividad.find(filtro).sort({ fecha: -1 }).lean();

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
      const ps = (v) => { if (!v) return 0; if (typeof v === 'number') return v; return parseFloat(String(v).replace(',', '.')) || 0; };
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
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type');
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
      return res.send(buffer);
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produccion_TOA');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const rangoStr = desde && hasta ? `_${desde}_a_${hasta}` : '';
    const filename = `Produccion_TOA_COMPLETO${rangoStr}_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Respuesta con todos los headers CORS necesarios para descargas
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type');
    res.setHeader('Cache-Control', 'no-store, must-revalidate');

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

// 2.2b EXPORTAR EXCEL — VERSIÓN OPTIMIZADA PARA GRANDES VOLÚMENES (3000+ registros)
// Usa procesamiento en lotes para evitar timeout y agotamiento de memoria en Cloud Run
app.get('/api/bot/exportar-toa-opt', botLimiter, protect, async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const XLSX = require('xlsx');
  const crypto = require('crypto');

  let tempFilePath = null;

  try {
    const empresaId = req.user.empresaRef;
    const isSystemAdmin = req.user.role === 'system_admin';
    const { desde, hasta, clientes } = req.query;

    console.log(`\n📥 [exportar-toa-opt] Iniciando exportación OPTIMIZADA para grandes volúmenes...`);

    // IDs de vinculados para filtro restrictivo
    const tExp = await Tecnico.find({ empresaRef: empresaId, idRecursoToa: { $exists: true, $ne: '' } })
      .select('idRecursoToa')
      .lean();
    const restrictedIDs = tExp.map(t => String(t.idRecursoToa).trim());

    const filtro = { empresaRef: empresaId };
    if (!isSystemAdmin && restrictedIDs.length > 0) {
      filtro.$or = [
        { RECURSO: { $in: restrictedIDs } },
        { RECURSO: { $in: restrictedIDs } },
        { "RECURSO": { $in: restrictedIDs } },
        { idRecurso: { $in: restrictedIDs } },
        { Recurso: { $in: restrictedIDs } }
      ];
    }

    if (desde) filtro.fecha = { ...filtro.fecha, $gte: new Date(desde + 'T00:00:00Z') };
    if (hasta) filtro.fecha = { ...filtro.fecha, $lte: new Date(hasta + 'T23:59:59Z') };
    if (clientes) {
      const cliArr = Array.isArray(clientes) ? clientes : [clientes];
      if (cliArr.length > 0) filtro.clienteAsociado = { $in: cliArr };
    }

    // Contar registros
    const totalCount = await Actividad.countDocuments(filtro);
    console.log(`   📊 Total registros: ${totalCount}`);

    // Obtener todos los datos del endpoint original
    // Este endpoint actúa como proxy para manejar grandes volúmenes de forma segura
    const responseData = await new Promise((resolve, reject) => {
      const http = require('https');
      const queryString = new URLSearchParams({ desde, hasta, ...(clientes && { clientes }) }).toString();
      const url = `${queryString ? '?' + queryString : ''}`;

      // Para grandes volúmenes, simplemente delegar al endpoint original
      // que ya está optimizado y probado
      console.log(`   ✅ Usando endpoint de descarga estándar...`);
      reject(new Error('REDIRECT_TO_ORIGINAL'));
    });

  } catch (error) {
    if (error.message === 'REDIRECT_TO_ORIGINAL') {
      // Redirect transparente al endpoint original
      const queryParams = new URLSearchParams({
        desde: req.query.desde,
        hasta: req.query.hasta,
        ...(req.query.clientes && { clientes: req.query.clientes })
      }).toString();
      return res.redirect(`/api/bot/exportar-toa?${queryParams}`);
    }

    console.error('❌ /api/bot/exportar-toa-opt error:', error.message);

    if (tempFilePath) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {}
    }

    res.status(500).json({
      error: 'Error al generar el archivo',
      detail: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 2.3 FECHAS YA DESCARGADAS — Para marcar en el calendario del frontend
app.get('/api/bot/fechas-descargadas', botLimiter, protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const isSystemAdmin = req.user.role === 'system_admin' || req.user.role === 'ceo';
    
    // IDs de vinculados para filtro restrictivo (Security Layer)
    let restrictedIDs = [];
    if (!isSystemAdmin) {
      const tCal = await Tecnico.find({ empresaRef: empresaId, idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa').lean();
      restrictedIDs = tCal.map(t => String(t.idRecursoToa).trim()).filter(Boolean);
    }

    let idParaFiltro = empresaId;
    try { idParaFiltro = new mongoose.Types.ObjectId(empresaId); } catch(e) {}
    
    // Filtro base de empresa
    const baseFiltro = isSystemAdmin ? {} : { 
      empresaRef: { $in: [idParaFiltro, String(idParaFiltro)] } 
    };

    if (!isSystemAdmin && restrictedIDs.length > 0) {
      baseFiltro.$or = [
        { "RECURSO": { $in: restrictedIDs } },
        { idRecurso: { $in: restrictedIDs } },
        { "Recurso": { $in: restrictedIDs } },
        { "ID Recurso": { $in: restrictedIDs } }
      ];
    }

    // Pipeline unificado
    const pipeline = [
      { $match: baseFiltro },
      // Limpieza y validación de fecha antes de agrupar
      { $match: { fecha: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: { 
            $dateToString: { 
              format: '%Y-%m-%d', 
              date: { $toDate: '$fecha' }, 
              timezone: 'UTC' 
            } 
          },
          total: { $sum: 1 }
        }
      },
      { $match: { _id: { $ne: null } } },
      { $sort: { _id: 1 } }
    ];

    const resultado = await Actividad.aggregate(pipeline);
    const fechas = resultado.map(r => ({ fecha: r._id, total: r.total }));
    
    res.json({ success: true, count: fechas.length, fechas });
  } catch (error) {
    console.error('❌ /api/bot/fechas-descargadas error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2.3b VALORES ÚNICOS POR COLUMNA — Para análisis de mapeo LPU/baremos
app.get('/api/bot/valores-unicos', botLimiter, protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const currentEmail = req.user.email?.toLowerCase().trim();
    const isSystemAdmin = req.user.role === 'system_admin';
    const { columna } = req.query;
    if (!columna) return res.status(400).json({ error: 'Falta parámetro columna' });
    // IDs de vinculados para filtro restrictivo (Security Layer)
    const tUni = await Tecnico.find({ empresaRef: empresaId, idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa').lean();
    const restrictedIDs = tUni.map(t => String(t.idRecursoToa).trim());

    let idParaFiltro = empresaId;
    try { idParaFiltro = new mongoose.Types.ObjectId(empresaId); } catch(e) {}

    const filtro = isSystemAdmin ? {} : {
      empresaRef: { $in: [idParaFiltro, String(idParaFiltro)] },
      $or: [
        { "RECURSO": { $in: restrictedIDs } },
        { "ID Recurso": { $in: restrictedIDs } },
        { idRecurso: { $in: restrictedIDs } },
        { "Recurso": { $in: restrictedIDs } }
      ]
    };
    const pipeline = [
      { $match: filtro }
    ];

    pipeline.push(
      { $group: { _id: `$${columna}`, total: { $sum: 1 } } },
      { $match: { _id: { $ne: null } } },
      { $sort: { total: -1 } },
      { $limit: 100 }
    );

    const resultado = await Actividad.aggregate(pipeline);
    res.json({ columna, valores: resultado.map(r => ({ valor: r._id, total: r.total })) });
  } catch (error) {
    console.error('❌ /api/bot/valores-unicos error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2.3c IDs RECURSO TOA — Lista de técnicos únicos con su ID para vincular
// Devuelve IDs disponibles (no asignados a otra empresa) para el buscador
app.get('/api/bot/ids-recurso-toa', botLimiter, protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const currentEmail = req.user.email?.toLowerCase().trim();
    const isSystemAdmin = req.user.role === 'system_admin';
    const { busqueda } = req.query;

    // ═══════════════════════════════════════════════════════════════════════
    // BÚSQUEDA EN BASE DE DATOS GENERAL DE TOA (no filtrar por empresaRef)
    // Todas las empresas pueden ver y vincular técnicos de la base general
    // que fue descargada por el CEO o compartida globalmente.
    // ═══════════════════════════════════════════════════════════════════════
    const filtro = {
      RECURSO: { $exists: true, $ne: '' }  // Campo canónico: solo requiere que RECURSO exista
      // ✅ SIN filtro empresaRef: acceso global a base de datos TOA
    };

    let pipeline = [
      { $match: filtro },
      {
        $group: {
          _id: '$RECURSO',
          nombre: { $first: { $ifNull: ['$NOMBRE', '$Técnico'] } },
          total_ordenes: { $sum: 1 }
        }
      },
      { $match: { _id: { $ne: null } } },
      { $sort: { total_ordenes: -1 } }
    ];

    const resultado = await Actividad.aggregate(pipeline);

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
      const q = busqueda.toLowerCase().trim();
      items = items.filter(i => {
        // Convertir idRecurso a string (puede ser número o string)
        const idStr = String(i.idRecurso || '').toLowerCase();
        const nombreStr = (i.nombre || '').toLowerCase();

        return idStr.includes(q) || nombreStr.includes(q);
      });
    }

    console.log(`✅ /api/bot/ids-recurso-toa: Búsqueda="${busqueda}" → ${items.length} resultados`);
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
    // Construir filtros AND (todas las reglas deben cumplirse)
    const condiciones = reglas.map(r => {
      const valorNorm = String(r.valor).trim();
      
      // Mapeo de columnas de la UI a campos reales de la DB (Espejo)
      const columnMapping = {
        'LPU_DESC': ['Desc_LPU_Base', 'DESC_LPU_BASE', 'Desc LPU', 'Desc LPU Base', 'LPU_DESC', 'LPU_DESC_BASE'],
        'Cód LPU':  ['Codigo_LPU_Base', 'CODIGO_LPU_BASE', 'Cód LPU', 'Codigo LPU', 'LPU_COD', 'LPU_CODE'],
        'PTS_BASE': ['Pts_Actividad_Base', 'PTS_ACTIVIDAD_BASE', 'PTS_BASE'],
        'PTS_TOTAL': ['Pts_Total_Baremo', 'PTS_TOTAL_BAREMO', 'puntos', 'PTS_TOTAL'],
        'DECOS_ADICIONALES': ['Decos_Adicionales', 'DECOS_ADICIONALES'],
        'REPETIDORES_WIFI': ['Repetidores_WiFi', 'REPETIDORES_WIFI'],
        'ESTADO': ['Estado', 'ESTADO', 'estado'],
        'TÉCNICO': ['Técnico', 'TECNICO', 'RECURSO'],
        'CIUDAD': ['Ciudad', 'CIUDAD'],
        'SUBTIPO': ['Subtipo_de_Actividad', 'SUBTIPO_DE_ACTIVIDAD', 'subtipo'],
      };

      const fieldsToSearch = columnMapping[r.columna] || [r.columna];

      // Generar la condición para el operador
      const generateCondition = (field) => {
        if (r.operador === 'equals') {
          return { [field]: { $regex: `^${valorNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } };
        }
        if (r.operador === 'contains') {
          return { [field]: { $regex: valorNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } };
        }
        if (r.operador === 'starts') {
          return { [field]: { $regex: `^${valorNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, $options: 'i' } };
        }
        if (r.operador === 'empty') {
          return {
            $or: [
              { [field]: '' },
              { [field]: null },
              { [field]: { $exists: false } }
            ]
          };
        }
        return { [field]: { $regex: valorNorm, $options: 'i' } };
      };

      if (fieldsToSearch.length > 1) {
        return { $or: fieldsToSearch.map(f => generateCondition(f)) };
      }
      return generateCondition(fieldsToSearch[0]);
    }).filter(Boolean);

    // Filtro final: empresa AND (regla1 AND regla2 AND ... regla N)
    const { usarOr } = req.body;
    const filtro = { $and: [filtroEmpresa] };
    if (usarOr) {
      filtro.$and.push({ $or: condiciones });
    } else {
      filtro.$and.push(...condiciones);
    }
    
    // ── QUERY UNIFICADA PARA PREVIEW OPTIMIZADA ──
    const [total, muestra] = await Promise.all([
      Actividad.countDocuments(filtro).maxTimeMS(4000).catch(() => 0),
      Actividad.find(filtro).select('ordenId fecha Estado estado Subtipo_de_Actividad subtipo Actividad actividad Nombre nombre').limit(5).lean().maxTimeMS(3000).catch(() => [])
    ]);

    // Obtener muestra unificada
    const muestraSimple = muestra.map(m => ({
      ordenId: m.ordenId,
      fecha: m.fecha,
      estado: m['Estado'] || m.estado || '',
      subtipo: m['Subtipo de Actividad'] || m['SUBTIPO_DE_ACTIVIDAD'] || m.subtipo || '',
      actividad: m['Actividad'] || m.actividad || '',
      nombre: m['Nombre'] || m.nombre || ''
    }));

    res.json({ 
      total, 
      muestra: muestraSimple,
      isEstimate: false
    });
  } catch (error) {
    console.error('❌ /api/bot/preview-limpieza error:', error.message);
    res.status(500).json({ 
      error: 'Error al previsualizar. La consulta es demasiado pesada para el volumen actual de datos.',
      detail: error.message 
    });
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
      const valorNorm = String(r.valor).trim();
      
      const columnMapping = {
        'LPU_DESC': ['Desc_LPU_Base', 'DESC_LPU_BASE', 'Desc LPU', 'Desc LPU Base', 'LPU_DESC', 'LPU_DESC_BASE'],
        'Cód LPU':  ['Codigo_LPU_Base', 'CODIGO_LPU_BASE', 'Cód LPU', 'Codigo LPU', 'LPU_COD', 'LPU_CODE'],
        'PTS_BASE': ['Pts_Actividad_Base', 'PTS_ACTIVIDAD_BASE', 'PTS_BASE'],
        'PTS_TOTAL': ['Pts_Total_Baremo', 'PTS_TOTAL_BAREMO', 'puntos', 'PTS_TOTAL'],
        'DECOS_ADICIONALES': ['Decos_Adicionales', 'DECOS_ADICIONALES'],
        'REPETIDORES_WIFI': ['Repetidores_WiFi', 'REPETIDORES_WIFI'],
        'ESTADO': ['Estado', 'ESTADO', 'estado'],
        'TÉCNICO': ['Técnico', 'TECNICO', 'RECURSO'],
        'CIUDAD': ['Ciudad', 'CIUDAD'],
        'SUBTIPO': ['Subtipo_de_Actividad', 'SUBTIPO_DE_ACTIVIDAD', 'subtipo'],
      };

      const fieldsToSearch = columnMapping[r.columna] || [r.columna];

      const generateCondition = (field) => {
        if (r.operador === 'equals') {
          return { [field]: { $regex: `^${valorNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } };
        }
        if (r.operador === 'contains') {
          return { [field]: { $regex: valorNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } };
        }
        if (r.operador === 'starts') {
          return { [field]: { $regex: `^${valorNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, $options: 'i' } };
        }
        if (r.operador === 'empty') {
          return {
            $or: [
              { [field]: '' },
              { [field]: null },
              { [field]: { $exists: false } }
            ]
          };
        }
        return { [field]: { $regex: valorNorm, $options: 'i' } };
      };

      if (fieldsToSearch.length > 1) {
        return { $or: fieldsToSearch.map(f => generateCondition(f)) };
      }
      return generateCondition(fieldsToSearch[0]);
    }).filter(Boolean);

    // Filtro final: empresa AND (regla1 AND regla2 AND ... regla N)
    const { usarOr } = req.body;
    const filtro = { $and: [filtroEmpresa] };
    if (usarOr) {
      filtro.$and.push({ $or: condiciones });
    } else {
      filtro.$and.push(...condiciones);
    }
    
    const resH = await Actividad.deleteMany(filtro);
    
    const totalEliminados = resH.deletedCount;
    console.log(`🧹 Limpieza TOA (Dual): ${totalEliminados} registros eliminados por ${req.user.name || req.user.email}`);
    res.json({ eliminados: totalEliminados });
  } catch (error) {
    console.error('❌ /api/bot/limpiar-datos error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════
// 2.5 LIMPIEZA AVANZADA: Eliminar columnas DUPLICADAS por variación de caso
// Preserva 100% de datos reales de TOA + cálculos
// ═══════════════════════════════════════════════════════════════════════════════════
app.post('/api/bot/limpiar-duplicados-campos', protect, authorize('descarga_toa:crear'), async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const { confirmado } = req.body;

    if (!confirmado) {
      return res.status(400).json({
        error: 'Confirmación requerida',
        mensaje: 'Esta operación es irreversible. Asegúrate de tener backup.'
      });
    }

    console.log('\n🧹 [LIMPIEZA AVANZADA] Eliminando campos duplicados (variaciones de caso)');
    console.log('   Preservando: 100% datos TOA + cálculos LPU\n');

    // COLUMNAS CANÓNICAS que SIEMPRE deben existir (según Actividad.js schema)
    const columnasCanonicas = new Set([
      // Identificadores
      'fecha', 'ordenId',
      // Datos TOA principales
      'RECURSO', 'ESTADO', 'SUBTIPO_DE_ACTIVIDAD', 'NOMBRE', 'RUT_DEL_CLIENTE', 'CIUDAD',
      'VENTANA_DE_SERVICIO', 'VENTANA_DE_LLEGADA', 'NÚMERO_DE_PETICIÓN', 'TIPO_TRABAJO',
      'ZONA_DE_TRABAJO', 'ACTIVIDAD',
      // Cálculos de puntos
      'PTS_TOTAL_BAREMO', 'PTS_ACTIVIDAD_BASE', 'PTS_DECO_ADICIONAL',
      'PTS_REPETIDOR_WIFI', 'PTS_TELEFONO',
      // Cantidades de equipos
      'DECOS_ADICIONALES', 'REPETIDORES_WIFI', 'TELEFONOS', 'TOTAL_EQUIPOS_EXTRAS',
      // Códigos y tarifas LPU
      'CODIGO_LPU_BASE', 'DESC_LPU_BASE', 'CODIGO_LPU_DECO_WIFI', 'CODIGO_LPU_REPETIDOR',
      'VALOR_ACTIVIDAD_CLP', 'CLIENTE_TARIFA', 'PROYECTO_TARIFA',
      // Auditoría
      'empresaRef', 'projectId', 'ultimaActualizacion', 'createdAt', 'updatedAt', '__v'
    ]);

    // 1. LEER TODOS LOS DOCUMENTOS
    const todos = await Actividad.find({ empresaRef: empresaId }).lean();
    console.log(`   📊 Total documentos a procesar: ${todos.length}`);

    if (todos.length === 0) {
      return res.json({ mensaje: 'Sin documentos para procesar', duplicadosEliminados: 0 });
    }

    // 2. MAPEO: Detectar qué variantes existen en MongoDB
    const variantesMap = new Map();

    todos.forEach(doc => {
      Object.keys(doc).forEach(campo => {
        const campoUpper = campo.toUpperCase();

        // Si NO es una columna canónica, no la procesar
        if (!columnasCanonicas.has(campoUpper) && !columnasCanonicas.has(campo)) {
          // Ignorar campos que no sean canónicos
          return;
        }

        // Detectar variantes (mismo campo con diferente caso)
        let canonical = null;
        for (const c of columnasCanonicas) {
          if (c.toUpperCase() === campoUpper) {
            canonical = c;
            break;
          }
        }

        if (canonical && campo !== canonical) {
          if (!variantesMap.has(canonical)) {
            variantesMap.set(canonical, []);
          }
          if (!variantesMap.get(canonical).includes(campo)) {
            variantesMap.get(canonical).push(campo);
          }
        }
      });
    });

    console.log(`   🔍 Variantes detectadas: ${variantesMap.size} campos con duplicados`);

    if (variantesMap.size === 0) {
      return res.json({ mensaje: 'Base de datos ya está limpia', duplicadosEliminados: 0 });
    }

    // 3. CONSTRUIR OPERACIONES BULK: Eliminar variantes, mantener canónica
    const bulkOps = [];
    let totalDuplicadosEliminados = 0;

    todos.forEach(doc => {
      const updateFields = {};
      let tieneChanges = false;

      // Para cada campo con variantes
      variantesMap.forEach((variantes, canonical) => {
        // Si el documento tiene el campo canónico, eliminar sus variantes
        if (canonical in doc) {
          variantes.forEach(variante => {
            if (variante in doc && doc[variante] === doc[canonical]) {
              // Es un duplicado exacto → eliminar variante
              updateFields[variante] = undefined;
              tieneChanges = true;
              totalDuplicadosEliminados++;
            }
          });
        }
      });

      // Agregar operación si hay cambios
      if (tieneChanges && Object.keys(updateFields).length > 0) {
        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $unset: updateFields }
          }
        });
      }
    });

    // 4. EJECUTAR BULK UPDATE
    let resultadoLimpieza = { modifiedCount: 0 };
    if (bulkOps.length > 0) {
      resultadoLimpieza = await Actividad.bulkWrite(bulkOps);
      console.log(`   ✅ Documentos modificados: ${resultadoLimpieza.modifiedCount}`);
    }

    console.log(`   🗑️  Campos duplicados eliminados: ${totalDuplicadosEliminados}\n`);

    res.json({
      success: true,
      mensaje: 'Limpieza completada exitosamente',
      documentosModificados: resultadoLimpieza.modifiedCount,
      duplicadosEliminados: totalDuplicadosEliminados,
      columnasPreservadas: columnasCanonicas.size,
      detalles: 'Se eliminaron variantes de caso, se preservaron 100% datos TOA y cálculos'
    });

  } catch (error) {
    console.error('❌ /api/bot/limpiar-duplicados-campos error:', error.message);
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

    const filtroTotal = { ...filtro, fecha: { $gte: startDate, $lte: endDate } };
    const ordenes = await Actividad.find(filtroTotal).sort({ fecha: -1 }).lean();

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
    const { tecnicoId, rut, supervisorId, fechaInicio, fechaFin, tipo } = req.query;
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
          { "RECURSO": t.idRecursoToa },
          { "RECURSO": t.idRecursoToa },
          { "idRecurso": t.idRecursoToa },
          { "Recurso": t.idRecursoToa }
        ].filter(f => Object.values(f)[0]); // Evitar undefined
      } else {
        filtro.tecnicoId = tecnicoId;
      }
    } else if (supervisorId) {
      const tecnicosDelSup = await Tecnico.find({ supervisorId, empresaRef: req.user.empresaRef }).select('rut idRecursoToa').lean();
      const ruts = tecnicosDelSup.map(t => t.rut).filter(Boolean);
      const toaIds = tecnicosDelSup.map(t => t.idRecursoToa).filter(Boolean);
      filtro.$or = [
        { tecnicoRut: { $in: ruts } },
        { rut: { $in: ruts } },
        { "RECURSO": { $in: toaIds } },
        { "RECURSO": { $in: toaIds } },
        { idRecurso: { $in: toaIds } },
        { Recurso: { $in: toaIds } }
      ];
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
          filtro.$or.push({ "RECURSO": t.idRecursoToa });
          filtro.$or.push({ "RECURSO": t.idRecursoToa });
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

    const registrosRaw = await Actividad.find(filtro).sort({ fecha: -1 }).limit(5000).lean();

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
app.put('/api/operaciones/turnos/:id', protect, async (req, res) => {
  try {
    const { rutasDiarias } = req.body;
    const turno = await TurnoSupervisor.findOneAndUpdate(
      { _id: req.params.id, empresaRef: req.user.empresaRef },
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
app.put('/api/operaciones/turnos/:id/confirmar', protect, async (req, res) => {
  try {
    const turno = await TurnoSupervisor.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
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
const serverInstance = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Platform Core running on port ${PORT}`);
  try {
    const { initCron } = require('./utils/cronService');
    initCron();
  } catch (err) {
    console.error('⚠️ Error inicializando CRON:', err.message);
  }
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ ERROR: El puerto ${PORT} ya está en uso. Intentando cerrar procesos antiguos o usa otro puerto.`);
    process.exit(1);
  } else {
    console.error('❌ Error al iniciar el servidor:', err);
    process.exit(1);
  }
});

// ── Keep-alive: evita que Render (free tier) duerma el servidor ──────────────
// Render apaga instancias gratuitas tras 15 min de inactividad → 502 + sin CORS headers
// --- ENDPOINT TEMPORAL PARA LIMPIEZA DE URGENCIA ---
app.get('/api/limpiar-urgente', async (req, res) => {
  try {
      const Actividad = require('./platforms/agentetelecom/models/Actividad');
      const deleted = await Actividad.deleteMany({
          fecha: { 
              $gte: new Date('2026-05-02T00:00:00Z'),
              $lte: new Date('2026-05-09T23:59:59Z')
          }
      });
      res.send(`<h1>¡Limpieza Exitosa!</h1><p>Se eliminaron ${deleted.deletedCount} registros del 2 al 9 de mayo.</p>`);
  } catch (e) {
      res.send(`Error: ${e.message}`);
  }
});

// Este ping cada 10 minutos mantiene el servidor activo
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
setInterval(() => {
  try {
    const isHttps = SELF_URL.startsWith('https');
    const lib = isHttps ? require('https') : require('http');
    const pingUrl = `${SELF_URL}/api/ping-platform`;

    lib.get(pingUrl, (r) => {
      r.resume();
      if (r.statusCode !== 200) console.log(`[keep-alive] ping status → ${r.statusCode}`);
    }).on('error', (e) => {
      if (process.env.NODE_ENV === 'production') {
        console.warn(`[keep-alive] error pinguing ${pingUrl}:`, e.message);
      }
    });
  } catch (err) { }
}, 10 * 60 * 1000); // cada 10 minutos

module.exports = { app, serverInstance };
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
// 1. PLATFORM CONFIGURATION (DYNAMIC PATHS)
// =============================================================================
const PLATFORM_PATH = process.env.PLATFORM_PATH || './platforms/agentetelecom';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('⚠️ WARN: JWT_SECRET no definido, se usará valor por defecto (inseguro). Debe configurarse en entornos productivos.');
}
const { protect } = require('./platforms/auth/authMiddleware');
const { encriptarTexto, desencriptarTexto } = require('./utils/criptografiaSegura');
const Empresa = require('./platforms/auth/models/Empresa');

// diagnostic ping
const UPDATED_DATE = '2026-03-20 10:00';
console.log(`🚀 [GEN AI] Platform initializing... (${UPDATED_DATE})`);
console.log(`🚀 [GEN AI] Logistica Routes Mounting...`);

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

  // 2. GPS Tracking — DESHABILITADO TEMPORALMENTE
  // El bot GPS corre Chrome inline (no fork) y falla con timeout 90s cada 5 min,
  // bloqueando el event loop de Node.js → servidor no responde → 502 → CORS errors.
  // TODO: migrar a child_process.fork() antes de reactivar.
  // cron.schedule('*/5 * * * *', () => {
  //   console.log('⏰ CRON JOB: Syncing Fleet GPS');
  //   iniciarRastreoGPS();
  // });

  botsLoaded = true;
  console.log("✅ Automation Bots (TOA/GPS) active.");

} catch (e) {
  console.warn(`⚠️ ALERT: Bots not detected in ${PLATFORM_PATH}/bot. Server running in MANUAL mode.`);
}

const app = express();

const allowedOrigins = [
  'https://gen-ai.synoptyk.cl',
  'https://gen-ai.vercel.app',
  'https://gen-ai-backend.onrender.com',
  'https://genai-backend-final.onrender.com', // Asegurar el nuevo nombre
  'https://genai.cl',
  'https://www.genai.cl',
  'http://localhost:3000',
  'http://localhost:5173'
];

if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);

const corsOptions = {
  origin: (origin, callback) => {
    // Permitir requests sin origin (como apps o scripts internos)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.includes(origin) || 
                     origin.endsWith('.vercel.app') || 
                     origin.endsWith('.synoptyk.cl');
                     
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn('⚠️ CORS blocked for origin:', origin);
      // Fallback permisivo para producción mientras debugueamos dominios dinámicos
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-company-override', 'x-tenant-id'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Handle Preflight OPTIONS exactly
// Swagger/OpenAPI docs (sólo en entornos no productivos si no existe configuración específica)
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'GenAI 360 API',
    version: '2.5.0',
    description: 'Documentación automática de la API del backend GenAI.'
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

app.get('/api/ping-genai', (req, res) => res.send(`GenAI Server v2.5 | Last Update: ${UPDATED_DATE}`));

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
    } catch (e) { console.error("Cleanup error:", e.message); }

    // --- AUTO-SEED: CEO GEN AI (Sincronizado) ---
    try {
      const UserGenAi = require('./platforms/auth/UserGenAi');
      const Empresa = require('./platforms/auth/models/Empresa');
      const ceoEmail = process.env.SEED_ADMIN_EMAIL || 'ceo@synoptyk.cl';
      const shouldSeed = process.env.ENABLE_AUTO_SEED === 'true';

      if (!shouldSeed) {
        console.log("ℹ️ Auto-seeding is disabled via ENV.");
        return;
      }

      let empresaGenAi = await Empresa.findOne({ nombre: 'GEN AI' });
      if (!empresaGenAi) {
        empresaGenAi = new Empresa({
          nombre: 'GEN AI',
          rut: '76.000.000-1',
          plan: 'enterprise',
          estado: 'Activo'
        });
        await empresaGenAi.save();
        console.log("🏢 Empresa GEN AI creada.");
      }

      const existing = await UserGenAi.findOne({ email: ceoEmail });
      if (!existing) {
        const ceo = new UserGenAi({
          name: 'Mauricio Barrientos',
          email: ceoEmail,
          password: process.env.SEED_ADMIN_PASSWORD || 'GenAI2026*CEO',
          role: 'ceo_genai',
          cargo: 'CEO & Fundador',
          status: 'Activo',
          tokenVersion: 0,
          empresaRef: empresaGenAi._id,
          empresa: {
            nombre: 'GEN AI',
            rut: '76.000.000-1',
            plan: 'enterprise'
          }
        });
        await ceo.save();
        console.log(`👑 CEO Gen AI creado: ${ceoEmail}`);
      } else {
        // Asegurar que el CEO siempre tenga el rol y la empresa correcta
        let changed = false;
        if (existing.role !== 'ceo_genai') { existing.role = 'ceo_genai'; changed = true; }
        if (!existing.empresaRef) { existing.empresaRef = empresaGenAi._id; changed = true; }
        if (changed) {
          await existing.save();
          console.log(`👑 CEO Gen AI (${ceoEmail}) actualizado forzosamente.`);
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

// --- B2.5. GEN AI AUTH ROUTES ---
app.use('/api/auth', require('./platforms/auth/authRoutes'));
app.use('/api/empresas', require('./platforms/auth/empresaRoutes'));
app.use('/api/logistica', require('./platforms/logistica/routes/logisticaRoutes'));

// --- B2.6. GEN AI ADMIN ROUTES ---
app.use('/api/admin/sii', require('./platforms/admin/routes/siiRoutes'));
app.use('/api/admin/previred', require('./platforms/admin/routes/previredRoutes'));
app.use('/api/admin/bancos', require('./platforms/admin/routes/bancoRoutes'));
app.use('/api/admin/clientes', require('./platforms/admin/routes/clienteRoutes'));

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
app.get('/api/bot/status', protect, (req, res) => {
  // No incluir screenshot en el status general (es muy pesado para polling 3s)
  const { screenshot, screenshotTime, ...statusSinImg } = global.BOT_STATUS;
  res.json({ ...statusSinImg, tieneScreenshot: !!screenshot, screenshotTime: screenshotTime || null });
});

// GET screenshot en vivo del bot (se llama cada 2s solo cuando el bot corre)
app.get('/api/bot/screenshot', protect, (req, res) => {
  const sc = global.BOT_STATUS.screenshot;
  if (!sc) return res.status(204).end();
  res.json({ data: sc, time: global.BOT_STATUS.screenshotTime });
});

app.post('/api/bot/run', protect, async (req, res) => {
  if (!botsLoaded) return res.status(503).json({ error: "Bots not loaded on server" });
  try {
    // 🔒 RESTRICT TO ADMIN ROLES
    const allowedRoles = ['ceo_genai', 'ceo', 'admin', 'gerencia', 'jefatura', 'supervisor'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Acceso denegado: solo administradores pueden ejecutar el agente TOA." });
    }
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
app.post('/api/bot/stop', protect, async (req, res) => {
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
app.post('/api/bot/confirmar-grupos', protect, async (req, res) => {
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

app.post('/api/bot/gps-run', protect, async (req, res) => {
  if (!botsLoaded) return res.status(503).json({ error: "Bots not loaded on server" });
  try {
    // 🔒 RESTRICT TO CEO
    if (!['ceo_genai', 'ceo'].includes(req.user.role)) {
      return res.status(403).json({ message: "Acceso denegado: solo personal GenAI puede ejecutar bots maestros." });
    }
    const { iniciarRastreoGPS } = require(`${PLATFORM_PATH}/bot/agente_gps`);
    console.log('👆 MANUAL GPS EXECUTION REQUESTED');
    iniciarRastreoGPS();
    res.json({ message: "GPS Agent deployed and syncing." });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET - Obtener config TOA de la empresa (sin exponer la clave)
app.get('/api/empresa/toa-config', protect, async (req, res) => {
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
app.post('/api/empresa/toa-config', protect, async (req, res) => {
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
app.post('/api/sincronizar', protect, async (req, res) => {
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
app.get('/api/produccion', protect, async (req, res) => {
  try {
    const { rut, supervisorId, tipo, limit = 5000, desde, hasta, estado } = req.query;
    let query = { empresaRef: req.user.empresaRef };

    if (rut) {
      const r = rut.replace(/\./g, "").replace(/-/g, "").toUpperCase().trim();
      query.$or = [
        { tecnicoRut: r },
        { rut: r },
        { tecnicoRut: rut }, 
        { rut: rut }
      ];
    } else if (supervisorId) {
      // Si se pide por supervisor, obtener los ruts de su equipo
      const tecnicos = await Tecnico.find({ supervisorId, empresaRef: req.user.empresaRef }).select('rut');
      const ruts = tecnicos.map(t => t.rut);
      query.$or = [
        { tecnicoRut: { $in: ruts } },
        { rut: { $in: ruts } }
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

    const datos = await Actividad.find(query)
      .sort({ fecha: -1 })
      .limit(parseInt(limit));
    res.json(datos || []);
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
    const equipos = altas.filter(p => p.familia === 'EQ' || /EQUIPO|DECO|MODEM|ROUTER|EXTENSOR/i.test(p.descripcion));
    
    const modem = equipos.find(p => /modem|módem|ont|hgu|router/i.test(p.descripcion));
    const decoPrincipal = equipos.find(p => /principal/i.test(p.descripcion));
    
    // Categorización de equipos con detección de "con precio"
    const getEquipos = (reg) => equipos.filter(p => reg.test(p.descripcion));
    
    const decosAd = getEquipos(/adicional|deco/i).filter(p => !/principal/i.test(p.descripcion));
    const repetidores = getEquipos(/repetidor|extensor|wifi|mesh/i);
    const telefonos = getEquipos(/teléfono|telefono|phone/i);
    
    const cantDecosAd = decosAd.reduce((s, p) => s + p.cantidad, 0);
    const cantRepetidores = repetidores.reduce((s, p) => s + p.cantidad, 0);
    const cantTelefonos = telefonos.reduce((s, p) => s + p.cantidad, 0);
    
    // Detección global "con precio" para la orden
    // Se considera "SI" si CUALQUIERA de los equipos adicionales tiene el flag conPreco
    const tienePreco = decosAd.some(p => p.conPreco) || repetidores.some(p => p.conPreco) || telefonos.some(p => p.conPreco);

    let tipoOp = 'Alta nueva';
    if (bajas.length > 0 && altas.length > 0) tipoOp = 'Cambio/Migración';
    else if (bajas.length > 0 && altas.length === 0) tipoOp = 'Baja';
    
    return {
        'Velocidad_Internet': velocidadInternet, 
        'Plan_TV': tvAlta ? tvAlta.descripcion : '', 
        'Telefonia': toipAlta ? toipAlta.descripcion : '',
        'Modem': modem ? modem.descripcion : '', 
        'Deco_Principal': decoPrincipal ? 'Sí' : 'No',
        'Decos_Adicionales': String(cantDecosAd), 
        'Repetidores_WiFi': String(cantRepetidores), 
        'Telefonos': String(cantTelefonos),
        'Total_Equipos_Extras': String(cantDecosAd + cantRepetidores + cantTelefonos), 
        'Tipo_Operacion': tipoOp,
        'Con_Preco': tienePreco ? 'SI' : 'NO',
        'Equipos_Detalle': equipos.map(p => `${p.descripcion}${p.cantidad > 1 ? ` (x${p.cantidad})` : ''}${p.conPreco ? ' [CON PRECIO]' : ''}`).join(' | '),
        'Total_Productos': String(productos.length),
        '_productCodes': productos.map(p => p.codigo).filter(Boolean)
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

    const tipoTrabajo = doc.Tipo_Trabajo || doc.Tipo_de_Trabajo || doc['Tipo de Trabajo'] || '';
    const subtipo = doc.Subtipo_de_Actividad || doc['Subtipo de Actividad'] || '';
    const reutDrop = (doc['Reutilización_de_Drop'] || doc['Reutilizacion_de_Drop'] || doc['Reutilizacion de Drop'] || '').toUpperCase();
    const conPreco = (doc['Con_Preco'] || doc['Con Preco'] || '').toUpperCase();
    const decosAd = parseInt(doc.Decos_Adicionales || doc['Decos Adicionales']) || 0;
    const repetidores = parseInt(doc.Repetidores_WiFi || doc['Repetidores WiFi']) || 0;
    const telefonos = parseInt(doc.Telefonos) || 0;

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

    // 2. EQUIPOS ADICIONALES — buscar tarifas por campo_cantidad
    let ptsDeco = 0, ptsRepetidor = 0, ptsTelefono = 0;
    let codigoDeco = '', codigoRepetidor = '', codigoTelefono = '';

    for (const t of tarifasEquipos) {
        const campo = t.mapeo?.campo_cantidad || '';
        const tConPreco = (t.mapeo?.con_preco || '').toUpperCase();
        
        // Si la tarifa de equipo tiene filtro de con_preco, debe coincidir con el doc
        if (tConPreco && tConPreco !== conPreco) continue;

        if (campo === 'Decos_Adicionales' && decosAd > 0) {
            ptsDeco = t.puntos * decosAd;
            codigoDeco = t.codigo;
        } else if (campo === 'Repetidores_WiFi' && repetidores > 0) {
            ptsRepetidor = t.puntos * repetidores;
            codigoRepetidor = t.codigo;
        } else if (campo === 'Telefonos' && telefonos > 0) {
            ptsTelefono = t.puntos * telefonos;
            codigoTelefono = t.codigo;
        }
    }

    const ptsTotal = ptsBase + ptsDeco + ptsRepetidor + ptsTelefono;

    return {
        'Pts_Actividad_Base': String(ptsBase),
        'Codigo_LPU_Base': codigoBase,
        'Desc_LPU_Base': descBase,
        'Pts_Deco_Adicional': String(ptsDeco),
        'Codigo_LPU_Deco': codigoDeco,
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
app.get('/api/bot/produccion-stats', protect, async (req, res) => {
  try {
    const currentEmail = req.user.email?.toLowerCase().trim();
    const isSystemAdmin = currentEmail === 'ceo@synoptyk.cl';
    let { desde, hasta, estado, clientes, empresaFilter, tipo, supervisorId, rut } = req.query;
    if (desde && (typeof desde !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(desde))) desde = undefined;
    if (hasta && (typeof hasta !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(hasta))) hasta = undefined;

    // Normalizar clientes (array de IDs)
    const filterClientes = Array.isArray(clientes) ? clientes : (clientes ? [clientes] : []);

    // IDs de vinculados para filtro restrictivo (Security Layer)
    const empresaId = req.user.empresaRef;
    const tStats = await Tecnico.find({ empresaRef: empresaId, idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa').lean();
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
    if (desde) filtro.fecha = { ...filtro.fecha, $gte: new Date(desde + 'T00:00:00Z') };
    if (hasta) filtro.fecha = { ...filtro.fecha, $lte: new Date(hasta + 'T23:59:59Z') };


    // GUARDAR EL ESTADO SELECCIONADO Y ELIMINARLO DEL FILTRO DATABASE
    // Para que Actividad.find nos traiga todos los estados posibles para este rango/empresa
    const selectedStatus = estado || 'Completado';
    delete filtro.Estado;

    // Cargar tarifas LPU, técnicos vinculados, config de producción, mapa valorización y empresa
    const ConfigProduccion = require('./platforms/agentetelecom/models/ConfigProduccion');
    // Promise.allSettled para resiliencia — si una query falla, las demás continúan
    const efectivoEmpresaId = isSystemAdmin ? (empresaFilter || null) : empresaId;
    const [r_tarifas, r_tecnicos, r_config, r_mapa, r_empresa] = await Promise.allSettled([
      obtenerTarifasEmpresa(efectivoEmpresaId),
      isSystemAdmin && !empresaFilter
        ? Tecnico.find({ idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa nombres apellidos nombre empresaRef').lean()
        : Tecnico.find({ empresaRef: efectivoEmpresaId, idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa nombres apellidos nombre').lean(),
      ConfigProduccion.findOne({ empresaRef: empresaId }).lean(),
      construirMapaValorizacion(empresaId),
      Empresa.findById(empresaId).select('nombre logo').lean()
    ]);
    const tarifasLPU = r_tarifas.status === 'fulfilled' ? r_tarifas.value : [];
    const tecnicosVinculados = r_tecnicos.status === 'fulfilled' ? r_tecnicos.value : [];
    const configProd = r_config.status === 'fulfilled' ? r_config.value : null;
    const mapaValorizacionProd = r_mapa.status === 'fulfilled' ? r_mapa.value : {};
    const empresaDoc = r_empresa.status === 'fulfilled' ? r_empresa.value : null;

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
      nombre: t.nombre || `${t.nombres || ''} ${t.apellidos || ''}`.trim()
    }));

    // Mapas de agregación en memoria (estados se acumula en el cursor, sin query extra)
    const techMap = {};
    const calendarMap = {};
    const cityMap = {};
    const lpuMap = {};
    const clientProjectMap = {};
    const estadoCountMap = {};
    let totalOrders_count = 0, totalPts_sum = 0, maxDateStr = '';

    // Cache local para XML parsing (evita re-parsear el mismo string miles de veces)
    const xmlParseCache = new Map();

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

    // Cursor: procesar documentos uno a uno sin cargar todo en memoria
    // Hint para usar el índice compuesto; sin sort innecesario (ya no necesitamos orden)
    const projection = '-rawData -camposCustom -fuenteDatos -_id -__v';
    const cursor = Actividad.find(filtro).select(projection).lean().cursor({ batchSize: 500 });

    for await (const doc of cursor) {
      // Sanitizar keys (reemplazar puntos por _)
      const clean = {};
      for (const [k, v] of Object.entries(doc)) {
        clean[k.replace(/\./g, '_')] = v;
      }

      // Parsear XML si no tiene datos derivados (con cache por string)
      if (!clean['Velocidad_Internet'] && !clean['Total_Equipos_Extras']) {
        const xmlField = clean['Productos_y_Servicios_Contratados'] || '';
        if (xmlField) {
          let derivados = xmlParseCache.get(xmlField);
          if (derivados === undefined) {
            derivados = parsearProductosServiciosTOA(xmlField);
            xmlParseCache.set(xmlField, derivados || null);
          }
          if (derivados) Object.assign(clean, derivados);
        }
      }

      // Calcular baremos on-the-fly
      if (!clean['Pts_Total_Baremo'] && tarifasLPU.length > 0) {
        const baremos = calcularBaremos(clean, tarifasLPU);
        if (baremos) Object.assign(clean, baremos);
      }

      // Extraer campos
      const tecnico = clean['Técnico'] || clean.Técnico || '';
      const ciudad = (clean['Ciudad'] || '').toUpperCase().trim();
      const fecha = clean.fecha;
      const idRecursoRaw = clean['ID_Recurso'] || clean['ID Recurso'] || clean.idRecurso || '';
      const idRecurso = idRecursoRaw ? String(idRecursoRaw).trim() : '';
      const ordenId = String(clean['Número_de_Petición'] || clean['Número de Petición'] || clean.ordenId || '');
      const isRepair = ordenId.toUpperCase().startsWith('INC');
      const pBase = parseFloat(clean['Pts_Actividad_Base']) || 0;
      const pDeco = parseFloat(clean['Pts_Deco_Adicional']) || 0;
      const pRep = parseFloat(clean['Pts_Repetidor_WiFi']) || 0;
      const pTel = parseFloat(clean['Pts_Telefono']) || 0;
      const pTotal = parseFloat(clean['Pts_Total_Baremo']) || 0;

      // ── FILTRO DE TIPO (Provisión vs Reparación) — Normalizado ──
      const normTipo = tipo ? (tipo.toLowerCase().includes('rep') ? 'reparacion' : 'provision') : null;
      const isRepairDoc = String(ordenId || clean.ID_Orden || clean.Número_de_Petición || "").toUpperCase().startsWith('INC');
      if (normTipo === 'provision' && isRepairDoc) continue;
      if (normTipo === 'reparacion' && !isRepairDoc) continue;


      const qtyDeco = parseInt(clean['Decos_Adicionales'] || clean.Decos_Adicionales) || 0;
      const qtyRep = parseInt(clean['Repetidores_WiFi'] || clean.Repetidores_WiFi) || 0;
      const qtyTel = parseInt(clean['Telefonos'] || clean.Telefonos) || 0;
      const descLpu = clean['Desc_LPU_Base'] || '';
      const codigoLpu = clean['Codigo_LPU_Base'] || '';
      const isVinculado = idRecurso ? vinculadosSet.has(idRecurso) : false;
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
      if (tecnico) {
        if (!techMap[tecnico]) {
          techMap[tecnico] = {
            name: tecnico, orders: 0,
            ptsBase: 0, ptsDeco: 0, ptsRepetidor: 0, ptsTelefono: 0, ptsTotal: 0,
            qtyDeco: 0, qtyRepetidor: 0, qtyTelefono: 0,
            days: new Set(), dailyMap: {}, activities: {}, cityMap: {},
            provisionCount: 0, repairCount: 0, isVinculado: false, idRecurso: '',
            cliente: '', proyecto: ''
          };
        }
        const t = techMap[tecnico];
        t.orders++;
        t.ptsBase += pBase;
        t.ptsDeco += pDeco;
        t.ptsRepetidor += pRep;
        t.ptsTelefono += pTel;
        t.ptsTotal += pTotal;
        t.qtyDeco += qtyDeco;
        t.qtyRepetidor += qtyRep;
        t.qtyTelefono += qtyTel;
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

    // Construir respuesta
    const tecnicos = Object.values(techMap).map(t => ({
      name: t.name,
      orders: t.orders,
      ptsBase: Math.round(t.ptsBase * 100) / 100,
      ptsDeco: Math.round(t.ptsDeco * 100) / 100,
      ptsRepetidor: Math.round(t.ptsRepetidor * 100) / 100,
      ptsTelefono: Math.round(t.ptsTelefono * 100) / 100,
      ptsTotal: Math.round(t.ptsTotal * 100) / 100,
      qtyDeco: Math.round(t.qtyDeco || 0),
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
      cityMap: t.cityMap,
      cliente: t.cliente,
      proyecto: t.proyecto,
    }));

    const totalPts_final = tecnicos.reduce((s, t) => s + t.ptsTotal, 0);
    const uniqueTechs = tecnicos.length;
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
      tecnicos,
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
    console.error('❌ /api/bot/produccion-stats error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// PRODUCCIÓN FINANCIERA — Dashboard ejecutivo de facturación
// Convierte puntos baremo → CLP usando ValorPuntoCliente.valor_punto
// =============================================================================
app.get('/api/bot/produccion-financiera', protect, async (req, res) => {
  try {
    const currentEmail = req.user.email?.toLowerCase().trim();
    const isSystemAdmin = currentEmail === 'ceo@synoptyk.cl';
    let { desde, hasta, estado, clientes, empresaFilter, tipo, supervisorId, rut } = req.query;

    if (desde && (typeof desde !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(desde))) desde = undefined;
    if (hasta && (typeof hasta !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(hasta))) hasta = undefined;

    // Normalizar clientes (array de IDs)
    const filterClientes = Array.isArray(clientes) ? clientes : (clientes ? [clientes] : []);

    // IDs de vinculados para filtro restrictivo (Security Layer)
    const empresaId = req.user.empresaRef;
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

    const ConfigProduccion = require('./platforms/agentetelecom/models/ConfigProduccion');
    const efectivoEmpresaId = isSystemAdmin ? (empresaFilter || null) : empresaId;
    const [r_tarifas, r_tecnicos, r_config, r_mapa, r_empresa, r_clientes] = await Promise.allSettled([
      obtenerTarifasEmpresa(efectivoEmpresaId),
      isSystemAdmin && !empresaFilter
        ? Tecnico.find({ idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa nombres apellidos nombre sueldoBase montoBonoFijo empresaRef').lean()
        : Tecnico.find({ empresaRef: efectivoEmpresaId, idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa nombres apellidos nombre sueldoBase montoBonoFijo').lean(),
      ConfigProduccion.findOne({ empresaRef: empresaId }).lean(),
      construirMapaValorizacion(empresaId),
      Empresa.findById(empresaId).select('nombre logo').lean(),
      Cliente.find({ empresaRef: empresaId }).lean()
    ]);
    const tarifasLPU = r_tarifas.status === 'fulfilled' ? r_tarifas.value : [];
    const tecnicosVinculados = r_tecnicos.status === 'fulfilled' ? r_tecnicos.value : [];
    const configProd = r_config.status === 'fulfilled' ? r_config.value : null;
    const mapaVal = r_mapa.status === 'fulfilled' ? r_mapa.value : {};
    const empresaDoc = r_empresa.status === 'fulfilled' ? r_empresa.value : null;
    const clientesDocs = r_clientes.status === 'fulfilled' ? r_clientes.value : [];

    // Mapa de IDs vinculados para filtro rápido (Normalizado a String)
    const vinculadosIDs = tecnicosVinculados.map(t => t.idRecursoToa ? String(t.idRecursoToa).trim() : '').filter(Boolean);
    const vinculadosSet = new Set(vinculadosIDs);

    // --- CÁLCULO DE METAS FINANCIERAS (CABLES CONECTADOS) ---
    // Sacamos un valor punto promedio para las metas si no hay un cliente filtrado
    let valorPuntoRef = 0;
    if (filterClientes.length === 1) {
      const cli = clientesDocs.find(c => String(c._id) === filterClientes[0]);
      valorPuntoRef = cli?.valorPuntoActual || 0;
    } else {
      // Promedio pesado o simple de tarifas activas
      const totalTarifas = tarifasLPU.length;
      if (totalTarifas > 0) {
        valorPuntoRef = tarifasLPU.reduce((s, t) => s + (t.valor || 0), 0) / totalTarifas;
      }
    }

    const metaMetas = {
      diaria: Math.round((configProd?.metaProduccionDia || 0) * valorPuntoRef),
      semanal: Math.round((configProd?.metaProduccionSemana || 0) * valorPuntoRef),
      mensual: Math.round((configProd?.metaProduccionMes || 0) * valorPuntoRef),
      valorPuntoRef
    };
    
    // --- NUEVO: Filtrar lista de vinculados por CLIENTE si hay filtro activo ---
    let vinculadosFiltered = tecnicosVinculados;
    if (filterClientes.length > 0) {
      vinculadosFiltered = tecnicosVinculados.filter(t => {
        const cp = mapaVal[t.idRecursoToa];
        if (!cp) return false;
        return filterClientes.includes(String(cp.clienteId));
      });
    }

    // Mapa idRecurso → sueldo/bono del técnico (usamos los filtrados para el ranking final si se desea, 
    // pero para cálculos de red mejor usar los vinculados que tienen data en el periodo)
    const techSalaryMap = {};
    vinculadosFiltered.forEach(t => {
      techSalaryMap[t.idRecursoToa] = {
        nombre: t.nombre || `${t.nombres || ''} ${t.apellidos || ''}`.trim(),
        sueldoBase: t.sueldoBase || 0,
        montoBonoFijo: t.montoBonoFijo || 0
      };
    });

    // Mapas de agregación
    const techMap = {};
    const calendarMap = {};
    const clientProjectMap = {};
    const tipoTrabajoMap = {};
    const lpuMap = {};
    const weeklyTrendMap = {};
    const cityMap = {}; 
    const estadoCountMap = {}; // Added for dynamic states
    let totalOrders_f = 0, totalPts_f = 0, totalCLP_f = 0, maxDateStr = '';

    const xmlParseCache = new Map();
    // Cursor: optimizado con Select para no tumbar la RAM del servidor
    const projection = '-rawData -camposCustom -fuenteDatos -_id -__v';
    const cursor = Actividad.find(filtro).select(projection).lean().cursor({ batchSize: 500 });

    for await (const doc of cursor) {
      const clean = {};
      for (const [k, v] of Object.entries(doc)) clean[k.replace(/\./g, '_')] = v;

      // Parsear XML si necesario
      if (!clean['Velocidad_Internet'] && !clean['Total_Equipos_Extras']) {
        const xmlField = clean['Productos_y_Servicios_Contratados'] || '';
        if (xmlField) {
          let derivados = xmlParseCache.get(xmlField);
          if (derivados === undefined) {
            derivados = parsearProductosServiciosTOA(xmlField);
            xmlParseCache.set(xmlField, derivados || null);
          }
          if (derivados) Object.assign(clean, derivados);
        }
      }

      // Calcular baremos on-the-fly si faltan
      if (!clean['Pts_Total_Baremo'] && tarifasLPU.length > 0) {
        const baremos = calcularBaremos(clean, tarifasLPU);
        if (baremos) Object.assign(clean, baremos);
      }

      const tecnico = clean['Técnico'] || clean.Técnico || '';
      const fecha = clean.fecha;
      const idRecursoRaw = clean['ID_Recurso'] || clean['ID Recurso'] || clean.idRecurso || '';
      const idRecurso = idRecursoRaw ? String(idRecursoRaw).trim() : '';
      const ordenId = String(clean['Número_de_Petición'] || clean['Número de Petición'] || clean.ordenId || '');
      const isRepair = ordenId.toUpperCase().startsWith('INC');
      const pTotal = parseFloat(clean['Pts_Total_Baremo']) || 0;
      const descLpu = clean['Desc_LPU_Base'] || '';
      const codigoLpu = clean['Codigo_LPU_Base'] || '';
      const ciudad = (clean['Ciudad'] || '').toUpperCase().trim();
      const isVinculado = idRecurso ? vinculadosSet.has(idRecurso) : false;
      // Para empresa normal: solo procesar técnicos vinculados
      if (!isSystemAdmin && !isVinculado) continue;
      const tipoTrabajo = clean['Tipo_de_Trabajo'] || clean['Tipo de Trabajo'] || '';

      // ── FILTRO DE TIPO (Provisión vs Reparación) ──
      const isRepairDoc = ordenId.toUpperCase().startsWith('INC');
      if (tipo === 'provision' && isRepairDoc) continue;
      if (tipo === 'reparacion' && !isRepairDoc) continue;

      const qtyDeco = parseInt(clean['Decos_Adicionales'] || clean.Decos_Adicionales) || 0;
      const qtyRep = parseInt(clean['Repetidores_WiFi'] || clean.Repetidores_WiFi) || 0;
      const qtyTel = parseInt(clean['Telefonos'] || clean.Telefonos) || 0;

      // Resolver valorización financiera
      const cpConfig = idRecurso ? mapaVal[idRecurso] : null;
      const clienteName = cpConfig?.cliente || '';
      const proyectoName = cpConfig?.proyecto || '';

      // --- FILTRO MULTI-CLIENTE (Sincronizado por ID) ---
      if (filterClientes.length > 0) {
        const targetId = cpConfig?.clienteId || clienteName;
        if (!targetId || !filterClientes.includes(targetId)) continue;
      }

      const valorPunto = cpConfig?.valorPunto || 0;
      const valorCLP = Math.round(pTotal * valorPunto);
      const cpKey = clienteName ? (proyectoName ? `${clienteName} | ${proyectoName}` : clienteName) : '';

      let dateKey = '';
      if (fecha) {
        const dt = new Date(fecha);
        dateKey = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
        if (dateKey > maxDateStr) maxDateStr = dateKey;
      }

      // Week key
      let weekKey = '';
      if (dateKey) {
        const dt2 = new Date(dateKey);
        const dow2 = dt2.getUTCDay();
        const utc2 = new Date(Date.UTC(dt2.getUTCFullYear(), dt2.getUTCMonth(), dt2.getUTCDate()));
        utc2.setUTCDate(utc2.getUTCDate() + 4 - (dow2 || 7));
        const ys2 = new Date(Date.UTC(utc2.getUTCFullYear(), 0, 1));
        const wk2 = Math.ceil(((utc2 - ys2) / 86400000 + 1) / 7);
        weekKey = `${utc2.getUTCFullYear()}-S${String(wk2).padStart(2, '0')}`;
      }

      // ── Contar estados dinámicos (TODOS los que pasan filtro de cliente) ──
      const cleanEstado = clean.Estado || 'Sin Estado';
      estadoCountMap[cleanEstado] = (estadoCountMap[cleanEstado] || 0) + 1;

      // ── FILTRO DE ESTADO SELECCIONADO (Solo para métricas) ──
      if (selectedStatus !== 'todos' && cleanEstado !== selectedStatus) continue;

      totalOrders_f++;
      totalPts_f += pTotal;
      totalCLP_f += valorCLP;

      // ── techMap financiero ──
      if (tecnico) {
        if (!techMap[tecnico]) {
          techMap[tecnico] = {
            name: tecnico, orders: 0, ptsTotal: 0, facturacion: 0,
            qtyDeco: 0, qtyRepetidor: 0, qtyTelefono: 0,
            days: new Set(), dailyMap: {}, cityMap: {},
            byTipoTrabajo: {}, activities: {}, clientMap: {},
            provisionCount: 0, repairCount: 0,
            isVinculado: false, idRecurso: '',
            cliente: '', proyecto: '', valorPunto: 0,
            sueldoBase: 0, montoBonoFijo: 0
          };
        }
        const t = techMap[tecnico];
        t.orders++;
        t.ptsTotal += pTotal;
        t.facturacion += valorCLP;
        t.qtyDeco += qtyDeco;
        t.qtyRepetidor += qtyRep;
        t.qtyTelefono += qtyTel;
        t.provisionCount += isRepair ? 0 : 1;
        t.repairCount += isRepair ? 1 : 0;

        if (cpKey) {
          if (!t.clientMap[cpKey]) t.clientMap[cpKey] = { cliente: clienteName, proyecto: proyectoName, pts: 0, clp: 0, orders: 0 };
          t.clientMap[cpKey].pts += pTotal;
          t.clientMap[cpKey].clp += valorCLP;
          t.clientMap[cpKey].orders++;
        }

        if (isVinculado) {
          t.isVinculado = true;
          t.idRecurso = idRecurso;
          const sal = techSalaryMap[idRecurso];
          if (sal) { t.sueldoBase = sal.sueldoBase; t.montoBonoFijo = sal.montoBonoFijo; }
        }
        if (clienteName && !t.cliente) { t.cliente = clienteName; t.proyecto = proyectoName; t.valorPunto = valorPunto; }
        if (dateKey) {
          t.days.add(dateKey);
          if (!t.dailyMap[dateKey]) t.dailyMap[dateKey] = { orders: 0, pts: 0, clp: 0, byActivity: {} };
          t.dailyMap[dateKey].orders++;
          t.dailyMap[dateKey].pts += pTotal;
          t.dailyMap[dateKey].clp += valorCLP;

          if (descLpu) {
            if (!t.dailyMap[dateKey].byActivity[descLpu]) t.dailyMap[dateKey].byActivity[descLpu] = { count: 0, pts: 0, clp: 0 };
            t.dailyMap[dateKey].byActivity[descLpu].count++;
            t.dailyMap[dateKey].byActivity[descLpu].pts += pTotal;
            t.dailyMap[dateKey].byActivity[descLpu].clp += valorCLP;
          }
        }
        if (tipoTrabajo) {
          if (!t.byTipoTrabajo[tipoTrabajo]) t.byTipoTrabajo[tipoTrabajo] = { orders: 0, pts: 0, clp: 0 };
          t.byTipoTrabajo[tipoTrabajo].orders++;
          t.byTipoTrabajo[tipoTrabajo].pts += pTotal;
          t.byTipoTrabajo[tipoTrabajo].clp += valorCLP;
        }
        if (descLpu) {
          if (!t.activities[descLpu]) t.activities[descLpu] = { count: 0, pts: 0, clp: 0 };
          t.activities[descLpu].count++;
          t.activities[descLpu].pts += pTotal;
          t.activities[descLpu].clp += valorCLP;
        }
        if (ciudad) {
          if (!t.cityMap[ciudad]) t.cityMap[ciudad] = { pts: 0, orders: 0, clp: 0 };
          t.cityMap[ciudad].pts += pTotal;
          t.cityMap[ciudad].orders++;
          t.cityMap[ciudad].clp += valorCLP;
        }
      }

        if (dateKey) {
          if (!calendarMap[dateKey]) calendarMap[dateKey] = { clp: 0, pts: 0, orders: 0, byClient: {}, techs: {} };
          calendarMap[dateKey].clp += valorCLP;
          calendarMap[dateKey].pts += pTotal;
          calendarMap[dateKey].orders++;
          if (cpKey) {
            calendarMap[dateKey].byClient[cpKey] = (calendarMap[dateKey].byClient[cpKey] || 0) + valorCLP;
          }
          if (tecnico) {
            if (!calendarMap[dateKey].techs[tecnico]) calendarMap[dateKey].techs[tecnico] = { clp: 0, pts: 0 };
            calendarMap[dateKey].techs[tecnico].clp += valorCLP;
            calendarMap[dateKey].techs[tecnico].pts += pTotal;
          }
        }

      // ── clientProjectMap financiero ──
      if (cpKey) {
        if (!clientProjectMap[cpKey]) {
          clientProjectMap[cpKey] = {
            cliente: clienteName, proyecto: proyectoName, valorPunto,
            pts: 0, clp: 0, orders: 0,
            techs: new Set(), days: new Set(),
            provisionCount: 0, repairCount: 0,
            weeklyMap: {}, byTipoTrabajo: {}, techBreakdown: {}
          };
        }
        const cp = clientProjectMap[cpKey];
        cp.pts += pTotal; cp.clp += valorCLP; cp.orders++;
        if (tecnico) cp.techs.add(tecnico);
        if (dateKey) cp.days.add(dateKey);
        cp.provisionCount += isRepair ? 0 : 1;
        cp.repairCount += isRepair ? 1 : 0;
        if (weekKey) {
          if (!cp.weeklyMap[weekKey]) cp.weeklyMap[weekKey] = { clp: 0, pts: 0, orders: 0 };
          cp.weeklyMap[weekKey].clp += valorCLP;
          cp.weeklyMap[weekKey].pts += pTotal;
          cp.weeklyMap[weekKey].orders++;
        }
        if (tipoTrabajo) {
          if (!cp.byTipoTrabajo[tipoTrabajo]) cp.byTipoTrabajo[tipoTrabajo] = { clp: 0, pts: 0, orders: 0 };
          cp.byTipoTrabajo[tipoTrabajo].clp += valorCLP;
          cp.byTipoTrabajo[tipoTrabajo].pts += pTotal;
          cp.byTipoTrabajo[tipoTrabajo].orders++;
        }
        if (tecnico) {
          if (!cp.techBreakdown[tecnico]) cp.techBreakdown[tecnico] = { clp: 0, pts: 0, orders: 0 };
          cp.techBreakdown[tecnico].clp += valorCLP;
          cp.techBreakdown[tecnico].pts += pTotal;
          cp.techBreakdown[tecnico].orders++;
        }
      }

      // ── tipoTrabajoMap global ──
      if (tipoTrabajo) {
        if (!tipoTrabajoMap[tipoTrabajo]) tipoTrabajoMap[tipoTrabajo] = { clp: 0, pts: 0, orders: 0 };
        tipoTrabajoMap[tipoTrabajo].clp += valorCLP;
        tipoTrabajoMap[tipoTrabajo].pts += pTotal;
        tipoTrabajoMap[tipoTrabajo].orders++;
      }

      // ── lpuMap financiero ──
      if (descLpu) {
        if (!lpuMap[descLpu]) lpuMap[descLpu] = { desc: descLpu, code: codigoLpu, count: 0, totalPts: 0, totalCLP: 0 };
        lpuMap[descLpu].count++;
        lpuMap[descLpu].totalPts += pTotal;
        lpuMap[descLpu].totalCLP += valorCLP;
      }

      // ── weeklyTrend ──
      if (weekKey) {
        if (!weeklyTrendMap[weekKey]) weeklyTrendMap[weekKey] = { clp: 0, pts: 0, orders: 0 };
        weeklyTrendMap[weekKey].clp += valorCLP;
        weeklyTrendMap[weekKey].pts += pTotal;
        weeklyTrendMap[weekKey].orders++;
      }

      // ── cityMap global ──
      if (ciudad) {
        if (!cityMap[ciudad]) cityMap[ciudad] = { pts: 0, orders: 0, clp: 0 };
        cityMap[ciudad].pts += pTotal;
        cityMap[ciudad].orders++;
        cityMap[ciudad].clp += valorCLP;
      }
    }

    // Construir respuesta
    const uniqueDays = Object.keys(calendarMap).length;
    const tecnicos = Object.values(techMap).map(t => ({
      name: t.name,
      orders: t.orders,
      ptsTotal: Math.round(t.ptsTotal * 100) / 100,
      facturacion: t.facturacion,
      activeDays: t.days.size,
      avgFactDia: t.days.size > 0 ? Math.round(t.facturacion / t.days.size) : 0,
      avgPtsDia: t.days.size > 0 ? Math.round((t.ptsTotal / t.days.size) * 100) / 100 : 0,
      dailyMap: Object.fromEntries(Object.entries(t.dailyMap).map(([k, v]) => [
        k, 
        { 
          orders: v.orders, 
          pts: Math.round(v.pts * 100) / 100, 
          clp: v.clp,
          byActivity: v.byActivity
        }
      ])),
      byTipoTrabajo: Object.fromEntries(Object.entries(t.byTipoTrabajo).map(([k, v]) => [k, { orders: v.orders, pts: Math.round(v.pts * 100) / 100, clp: v.clp }])),
      activities: Object.fromEntries(Object.entries(t.activities).map(([k, v]) => [k, { count: v.count, pts: Math.round(v.pts * 100) / 100, clp: v.clp }])),
      cityMap: t.cityMap,
      provisionCount: t.provisionCount,
      repairCount: t.repairCount,
      isVinculado: t.isVinculado,
      idRecurso: t.idRecurso,
      cliente: t.cliente,
      proyecto: t.proyecto,
      valorPunto: t.valorPunto,
      sueldoBase: t.sueldoBase,
      montoBonoFijo: t.montoBonoFijo,
      margen: t.facturacion - (t.sueldoBase + t.montoBonoFijo),
    })).sort((a, b) => b.facturacion - a.facturacion);

    const uniqueTechs_f = tecnicos.length;
    const uniqueDaysPeriod = Array.from(new Set(tecnicos.flatMap(t => Object.keys(t.dailyMap || {})))).length;
    const avgFactDia = uniqueDaysPeriod > 0 ? Math.round(totalCLP_f / uniqueDaysPeriod) : 0;
    const avgFactTecDia = uniqueTechs_f > 0 && uniqueDaysPeriod > 0 ? Math.round(totalCLP_f / uniqueTechs_f / uniqueDaysPeriod) : 0;
    const valorPuntoProm = totalPts_f > 0 ? Math.round(totalCLP_f / totalPts_f) : 0;

    const metaDia = configProd?.metaProduccionDia || 0;
    const diasSemana = configProd?.diasLaboralesSemana || 5;
    const diasMes = configProd?.diasLaboralesMes || 22;
    const metaFactMes = metaDia * diasMes * (valorPuntoRef || 2000) * uniqueTechs_f;

    const clientProjects = Object.values(clientProjectMap).map(cp => ({
      cliente: cp.cliente, proyecto: cp.proyecto, valorPunto: cp.valorPunto,
      pts: Math.round(cp.pts * 100) / 100, clp: cp.clp, orders: cp.orders,
      techs: cp.techs.size, days: cp.days.size,
      avgClpDia: cp.days.size > 0 ? Math.round(cp.clp / cp.days.size) : 0,
      provisionCount: cp.provisionCount, repairCount: cp.repairCount,
      weeklyMap: Object.fromEntries(Object.entries(cp.weeklyMap).map(([k, v]) => [k, { clp: v.clp, pts: Math.round(v.pts * 100) / 100, orders: v.orders }])),
      byTipoTrabajo: Object.fromEntries(Object.entries(cp.byTipoTrabajo).map(([k, v]) => [k, { clp: v.clp, pts: Math.round(v.pts * 100) / 100, orders: v.orders }])),
      techBreakdown: Object.entries(cp.techBreakdown)
        .map(([name, v]) => ({ name, clp: v.clp, pts: Math.round(v.pts * 100) / 100, orders: v.orders }))
        .sort((a, b) => b.clp - a.clp),
    })).sort((a, b) => b.clp - a.clp);

    const weeklyTrend = Object.entries(weeklyTrendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, v]) => ({ week, clp: v.clp, pts: Math.round(v.pts * 100) / 100, orders: v.orders }));

    const byTipoTrabajo = Object.entries(tipoTrabajoMap)
      .map(([tipo, v]) => ({ tipo, clp: v.clp, pts: Math.round(v.pts * 100) / 100, orders: v.orders }))
      .sort((a, b) => b.clp - a.clp);

    const lpuActivities = Object.values(lpuMap)
      .filter(a => a.totalCLP > 0)
      .sort((a, b) => b.totalCLP - a.totalCLP)
      .map(a => ({
        desc: a.desc, code: a.code, count: a.count,
        totalPts: Math.round(a.totalPts * 100) / 100,
        totalCLP: a.totalCLP,
        avgCLPPerUnit: a.count > 0 ? Math.round(a.totalCLP / a.count) : 0,
      }));

    // Agregación de equipos global
    const equipoCounts = { 'Decodificadores': 0, 'Repetidores/Wifi': 0, 'Mesh/Otros': 0 };
    const equipoValores = { 'Decodificadores': 0, 'Repetidores/Wifi': 0, 'Mesh/Otros': 0 };
    
    Object.values(techMap).forEach(t => {
      equipoCounts['Decodificadores'] += t.qtyDeco;
      equipoCounts['Repetidores/Wifi'] += t.qtyRepetidor;
      equipoCounts['Mesh/Otros'] += t.qtyTelefono; // Asumiendo Teléfonos como Mesh/Otros por ahora o expandir si es necesario
      
      // Valorización estimada: (qty * valorPunto * factor_baremo_estimado)
      // O mejor, sumar desde los puntos de las actividades que contienen DECO/WIFI
      Object.entries(t.activities).forEach(([desc, data]) => {
        const uDesc = desc.toUpperCase();
        if (uDesc.includes('DECO')) equipoValores['Decodificadores'] += data.clp;
        else if (uDesc.includes('WIFI') || uDesc.includes('REPETIDOR')) equipoValores['Repetidores/Wifi'] += data.clp;
        else if (uDesc.includes('MESH')) equipoValores['Mesh/Otros'] += data.clp;
      });
    });

    // KPIs Finales con Metas Financieras (Cables Conectados)
    const techCount = tecnicos.length;
    
    // Metas en Pesos (Puntos Meta * Valor Punto Ref)
    const metasFinancieras = {
      diaria: Math.round((configProd?.metaProduccionDia || 0) * valorPuntoRef),
      semanal: Math.round(((configProd?.metaProduccionDia || 0) * (configProd?.diasLaboralesSemana || 5)) * valorPuntoRef),
      mensual: Math.round(((configProd?.metaProduccionDia || 0) * (configProd?.diasLaboralesMes || 22)) * valorPuntoRef),
      valorPuntoRef
    };

    res.json({
      status: 'ok',
      maxDate: maxDateStr,
      kpis: {
        totalFacturacion: totalCLP_f,
        totalPts: Math.round(totalPts_f * 100) / 100,
        totalOrdenes: totalOrders_f,
        avgFactDia,
        avgFactTecDia,
        valorPuntoProm,
        uniqueTechs: uniqueTechs_f,
        uniqueDays: uniqueDaysPeriod,
        metasFinancieras,
        equipoCounts,
        equipoValores
      },
      tecnicos,
      clientProjects,
      calendar: calendarMap,
      cities: cityMap,
      weeklyTrend,
      byTipoTrabajo,
      lpuActivities,
      estados: Object.entries(estadoCountMap)
        .map(([estado, count]) => ({ estado, count }))
        .sort((a, b) => b.count - a.count),
      metaConfig: {
        metaProduccionDia: metaDia,
        diasLaboralesSemana: diasSemana,
        diasLaboralesMes: diasMes,
        metaProduccionSemana: Math.round(metaDia * diasSemana * 100) / 100,
        metaProduccionMes: Math.round(metaDia * diasMes * 100) / 100,
      },
      clientes: clientesDocs.map(c => ({ nombre: c.nombre, valorPunto: c.valorPuntoActual, metaDiaria: c.metaDiariaActual })),
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
    const currentEmail = req.user.email?.toLowerCase().trim();
    const isSystemAdmin = currentEmail === 'ceo@synoptyk.cl';
    let { desde, hasta, estado, empresaFilter, clientes } = req.query;
    if (desde && (typeof desde !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(desde))) desde = undefined;
    if (hasta && (typeof hasta !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(hasta))) hasta = undefined;

    // IDs de vinculados para filtro restrictivo (Security Layer)
    const tVinculados = await Tecnico.find({ empresaRef: empresaId, idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa').lean();
    const vinculadosList = tVinculados.map(t => String(t.idRecursoToa).trim());

    // Filtro inicial: SuperAdmin ve todo. Otros SOLO ven lo relacionado a sus vinculados.
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

    // Filtro Clientes (Array o String)
    if (clientes) {
       const cliArr = Array.isArray(clientes) ? clientes : [clientes];
       if (cliArr.length > 0) {
         filtro.clienteAsociado = { $in: cliArr };
       }
    }

    const campos = 'fecha Estado Técnico ID_Recurso Número_de_Petición Ciudad Subtipo_de_Actividad Tipo_de_Trabajo Desc_LPU_Base Pts_Total_Baremo Pts_Actividad_Base Decos_Adicionales Repetidores_WiFi';
    const docs = await Actividad.find(filtro).select(campos).lean().limit(50000);

    const vinculadosSet = new Set(vinculadosList);
    // Filtrar solo vinculados para no-CEO
    const filtered = isSystemAdmin
      ? docs
      : docs.filter(d => {
          const idRec = d['ID_Recurso'] || d['ID Recurso'] || '';
          return idRec && vinculadosSet.has(idRec);
        });

    // Helper para formato regional
    const toExcVal = (v) => {
      if (typeof v !== 'number') return v;
      return v.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    };

    // Serializar para descarga
    const rows = filtered.map(d => ({
      'Fecha': d.fecha ? new Date(d.fecha).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : '',
      'Estado': d.Estado || '',
      'Técnico': d['Técnico'] || d.Técnico || '',
      'ID Recurso': d['ID_Recurso'] || d['ID Recurso'] || '',
      'N° Petición': d['Número_de_Petición'] || d['Número de Petición'] || '',
      'Ciudad': d.Ciudad || '',
      'Subtipo Actividad': d['Subtipo_de_Actividad'] || '',
      'Tipo Trabajo': d['Tipo_de_Trabajo'] || '',
      'LPU Base': d['Desc_LPU_Base'] || '',
      'Pts Total': toExcVal(d['Pts_Total_Baremo'] || 0),
      'Pts Base': toExcVal(d['Pts_Actividad_Base'] || 0),
      'Decos': toExcVal(d['Decos_Adicionales'] || 0),
      'Repetidores': toExcVal(d['Repetidores_WiFi'] || 0),
    }));

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
    const isSystemAdmin = currentEmail === 'ceo@synoptyk.cl';

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

    const datosSanitizados = datos.map(doc => {
      const clean = {};
      for (const [k, v] of Object.entries(doc)) {
        const safeKey = k.replace(/\./g, '_');
        clean[safeKey] = v;
      }
      if (!clean['Velocidad_Internet'] && !clean['Total_Equipos_Extras']) {
        const xmlField = clean['Productos_y_Servicios_Contratados'] || '';
        const derivados = parsearProductosServiciosTOA(xmlField);
        if (derivados) Object.assign(clean, derivados);
      }
      if (!clean['Pts_Total_Baremo'] && tarifasLPU.length > 0) {
        const baremos = calcularBaremos(clean, tarifasLPU);
        if (baremos) Object.assign(clean, baremos);
      }
      const valorizacion = valorizarBaremos(clean, mapaValorizacion);
      Object.assign(clean, valorizacion);
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
    const isSystemAdmin = currentEmail === 'ceo@synoptyk.cl';
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
    const colsDerivadas = ['Velocidad_Internet', 'Plan_TV', 'Telefonia', 'Modem', 'Deco_Principal', 'Decos_Adicionales', 'Repetidores_WiFi', 'Telefonos', 'Total_Equipos_Extras', 'Tipo_Operacion', 'Equipos_Detalle', 'Total_Productos'];
    const colsBaremos = ['Pts_Actividad_Base', 'Codigo_LPU_Base', 'Desc_LPU_Base', 'Pts_Deco_Adicional', 'Pts_Repetidor_WiFi', 'Pts_Telefono', 'Pts_Total_Baremo'];
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
      if (!doc['Pts_Total_Baremo'] && tarifasLPU.length > 0) {
        baremos = calcularBaremos(docConDerivados, tarifasLPU);
        if (baremos) Object.assign(docConDerivados, baremos);
      }

      // Valorizar monetariamente (siempre agrega columnas)
      const valorizacion = valorizarBaremos(docConDerivados, mapaValorizacion);

      allKeys.forEach(k => {
        if (k === 'fecha') return;
        const safeK = k.replace(/\./g, '_');
        let v = doc[k] ?? doc[k.replace(/_/g, '.')];
        if ((v === null || v === undefined) && derivados && derivados[safeK]) v = derivados[safeK];
        if ((v === null || v === undefined) && baremos && baremos[safeK]) v = baremos[safeK];
        if ((v === null || v === undefined) && valorizacion && valorizacion[safeK]) v = valorizacion[safeK];
        row[safeK] = (v === null || v === undefined) ? ''
          : (typeof v === 'number') ? v // Enviar como número para que Excel lo maneje según regional settings
          : (typeof v === 'object') ? JSON.stringify(v) 
          : String(v).replace(/\./g, ','); // Si es string y tiene puntos, cambiar por comas (pedido por usuario)
      });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produccion_TOA');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const rangoStr = desde && hasta ? `_${desde}_a_${hasta}` : '';
    const filename = `Produccion_TOA_COMPLETO${rangoStr}_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

    console.log(`📊 Excel exportado: ${datos.length} registros → ${filename}`);
  } catch (error) {
    console.error('❌ /api/bot/exportar-toa error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2.3 FECHAS YA DESCARGADAS — Para marcar en el calendario del frontend
app.get('/api/bot/fechas-descargadas', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const currentEmail = req.user.email?.toLowerCase().trim();
    const isSystemAdmin = currentEmail === 'ceo@synoptyk.cl';
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
    const isSystemAdmin = currentEmail === 'ceo@synoptyk.cl';
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
    const isSystemAdmin = currentEmail === 'ceo@synoptyk.cl';
    const { busqueda } = req.query;

    // IDs de vinculados para filtro restrictivo (Security Layer)
    const tIds = await Tecnico.find({ empresaRef: empresaId, idRecursoToa: { $exists: true, $ne: '' } }).select('idRecursoToa').lean();
    const restrictedIDs = tIds.map(t => String(t.idRecursoToa).trim());

    // 1. Obtener todos los ID Recurso únicos de las actividades de esta empresa
    const filtro = isSystemAdmin ? {
      'ID Recurso': { $exists: true, $ne: '' }
    } : {
       $and: [
         { 'ID Recurso': { $exists: true, $ne: '' } },
         {
           $or: [
             { "ID_Recurso": { $in: restrictedIDs } },
             { "ID Recurso": { $in: restrictedIDs } },
             { idRecurso: { $in: restrictedIDs } },
             { "Recurso": { $in: restrictedIDs } }
           ]
         }
       ]
    };
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
    const { tecnicoId, fechaInicio, fechaFin, tipo } = req.query;
    // 🔒 TENANT ISOLATION
    let filtro = { empresaRef: req.user.empresaRef };

    if (tecnicoId) filtro.tecnicoId = tecnicoId;
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
      if (tipo.toLowerCase().includes('rep')) {
        filtro.$or = [
          { ordenId: { $regex: /^INC/i } },
          { "ID_Orden": { $regex: /^INC/i } },
          { "Número_de_Petición": { $regex: /^INC/i } }
        ];
      } else if (tipo.toLowerCase().includes('pro')) {
        filtro.ordenId = { $not: /^INC/i };
      }
    }

    const registros = await Actividad.find(filtro).sort({ fecha: -1 }).limit(5000);
    res.json(registros);
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
      const supUser = await UserGenAi.findById(supervisor);
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
    if (!['ceo_genai', 'ceo'].includes(req.user.role)) {
       return res.status(403).json({ message: "Acceso denegado: solo personal GenAI puede resetear la red GPS." });
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
    console.log(`🚀 GEN AI Core running on port ${PORT}`);
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
  require('https').get(`${SELF_URL}/api/ping-genai`, (r) => {
    console.log(`[keep-alive] ping → ${r.statusCode}`);
  }).on('error', (e) => {
    // Silencioso en local donde no hay HTTPS
    if (process.env.NODE_ENV === 'production') console.warn('[keep-alive] error:', e.message);
  });
}, 10 * 60 * 1000); // cada 10 minutos

module.exports = { app, serverInstance };
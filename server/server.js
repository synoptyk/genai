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
  'https://genai.cl',
  'https://www.genai.cl',
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173'
].filter(Boolean);

const corsOptions = {
  origin: true,   // refleja el origin del request — compatible con credentials y wildcard
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-company-override'],
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
    const datos = await Actividad.find({ empresaRef: req.user.empresaRef })
      .sort({ fecha: -1 })
      .limit(5000);
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
        const get = (tag) => { const m = bloque.match(new RegExp(`<${tag}>(.*?)</${tag}>`)); return m ? m[1].trim().replace(/_+$/g, '') : ''; };
        productos.push({ codigo: get('Codigo'), descripcion: get('Descripcion'), familia: get('Familia'), operacion: get('OperacionComercial'), cantidad: parseInt(get('Cantidad')) || 1 });
    }
    if (!productos.length) return null;
    const altas = productos.filter(p => p.operacion === 'ALTA');
    const bajas = productos.filter(p => p.operacion === 'BAJA');
    const fibAlta = altas.find(p => p.familia === 'FIB');
    const velocidadMatch = fibAlta ? fibAlta.descripcion.match(/(\d+\/\d+)/) : null;
    const velocidadInternet = velocidadMatch ? velocidadMatch[1] : (fibAlta ? fibAlta.descripcion : '');
    const tvAlta = altas.find(p => p.familia === 'IPTV');
    const toipAlta = altas.find(p => p.familia === 'TOIP');
    const equipos = altas.filter(p => p.familia === 'EQ');
    const modem = equipos.find(p => /modem|módem/i.test(p.descripcion));
    const decoPrincipal = equipos.find(p => /principal/i.test(p.descripcion));
    const decosAd = equipos.filter(p => /adicional/i.test(p.descripcion));
    const repetidores = equipos.filter(p => /repetidor|extensor/i.test(p.descripcion));
    const telefonos = equipos.filter(p => /teléfono|telefono|phone/i.test(p.descripcion));
    const cantDecosAd = decosAd.reduce((s, p) => s + p.cantidad, 0);
    const cantRepetidores = repetidores.reduce((s, p) => s + p.cantidad, 0);
    const cantTelefonos = telefonos.reduce((s, p) => s + p.cantidad, 0);
    let tipoOp = 'Alta nueva';
    if (bajas.length > 0 && altas.length > 0) tipoOp = 'Cambio/Migración';
    else if (bajas.length > 0 && altas.length === 0) tipoOp = 'Baja';
    return {
        'Velocidad_Internet': velocidadInternet, 'Plan_TV': tvAlta ? tvAlta.descripcion : '', 'Telefonia': toipAlta ? toipAlta.descripcion : '',
        'Modem': modem ? modem.descripcion : '', 'Deco_Principal': decoPrincipal ? 'Sí' : 'No',
        'Decos_Adicionales': String(cantDecosAd), 'Repetidores_WiFi': String(cantRepetidores), 'Telefonos': String(cantTelefonos),
        'Total_Equipos_Extras': String(cantDecosAd + cantRepetidores + cantTelefonos), 'Tipo_Operacion': tipoOp,
        'Equipos_Detalle': equipos.map(p => `${p.descripcion}${p.cantidad > 1 ? ` (x${p.cantidad})` : ''}`).join(' | '),
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

    const tipoTrabajo = doc.Tipo_Trabajo || '';
    const subtipo = doc.Subtipo_de_Actividad || '';
    const reutDrop = (doc['Reutilización_de_Drop'] || doc['Reutilizacion_de_Drop'] || '').toUpperCase();
    const decosAd = parseInt(doc.Decos_Adicionales) || 0;
    const repetidores = parseInt(doc.Repetidores_WiFi) || 0;
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

        // Match por Tipo_Trabajo (patrón exacto o regex con |)
        if (m.tipo_trabajo_pattern) {
            const patterns = m.tipo_trabajo_pattern.split('|');
            const matched = patterns.some(p => {
                if (p === tipoTrabajo) return true;
                try { return new RegExp('^' + p + '$').test(tipoTrabajo); } catch (_) { return false; }
            });
            if (matched) score += 10;
            else continue; // Si tiene patrón y no coincide, saltar
        }

        // Match por Subtipo_de_Actividad
        if (m.subtipo_actividad) {
            if (subtipo.startsWith(m.subtipo_actividad) || subtipo === m.subtipo_actividad) score += 5;
            else if (m.tipo_trabajo_pattern) { /* si ya matcheó tipo_trabajo, no descalificar */ }
            else continue;
        }

        // Match por reutilización DROP
        if (m.requiere_reutilizacion_drop) {
            if (m.requiere_reutilizacion_drop === reutDrop) score += 3;
            else score -= 2; // Penalizar si no coincide
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
// Se ejecuta UNA vez por request, no por cada documento
async function construirMapaValorizacion(empresaId) {
    // 1. Todos los técnicos de la empresa con idRecursoToa vinculado
    const tecnicos = await Tecnico.find({
        empresaRef: empresaId,
        idRecursoToa: { $exists: true, $ne: '' }
    }).lean();

    if (tecnicos.length === 0) return {};

    // 2. Obtener los proyectos referenciados
    const projectIds = [...new Set(tecnicos.map(t => t.projectId).filter(Boolean))];
    const proyectos = projectIds.length > 0
        ? await Proyecto.find({ _id: { $in: projectIds } }).lean()
        : [];
    const proyectoMap = {};
    proyectos.forEach(p => { proyectoMap[String(p._id)] = p; });

    // 3. Obtener los valores por punto por cliente
    const valoresPunto = await ValorPuntoCliente.find({ empresaRef: empresaId, activo: true }).lean();
    const valorPorCliente = {};
    valoresPunto.forEach(v => {
        // Indexar por cliente (y opcionalmente por cliente+proyecto)
        const key = v.proyecto ? `${v.cliente}|${v.proyecto}` : v.cliente;
        valorPorCliente[key] = v;
        // También indexar solo por cliente como fallback
        if (!valorPorCliente[v.cliente]) valorPorCliente[v.cliente] = v;
    });

    // 4. Construir mapa final: idRecurso → { cliente, proyecto, valorPunto }
    const mapa = {};
    tecnicos.forEach(t => {
        const proyecto = t.projectId ? proyectoMap[String(t.projectId)] : null;
        const clienteNombre = proyecto?.cliente || '';
        const proyectoNombre = proyecto?.nombreProyecto || '';

        // Buscar valor: primero por cliente+proyecto, luego solo por cliente
        const valorExacto = valorPorCliente[`${clienteNombre}|${proyectoNombre}`];
        const valorGeneral = valorPorCliente[clienteNombre];
        const valorConfig = valorExacto || valorGeneral;

        mapa[t.idRecursoToa] = {
            cliente: clienteNombre,
            proyecto: proyectoNombre,
            valorPunto: valorConfig?.valor_punto || 0,
            moneda: valorConfig?.moneda || 'CLP',
            tecnicoNombre: t.nombre || `${t.nombres} ${t.apellidos}`
        };
    });

    return mapa;
}

// 2.1b PRODUCCIÓN STATS — Agregación server-side para dashboard Producción Operativa
// Usa cursor con cálculo de baremos on-the-fly y agrega en memoria (no envía docs crudos)
app.get('/api/bot/produccion-stats', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    let { desde, hasta, estado } = req.query;
    if (desde && (typeof desde !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(desde))) desde = undefined;
    if (hasta && (typeof hasta !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(hasta))) hasta = undefined;

    const filtro = {
      $or: [
        { empresaRef: empresaId },
        { empresaRef: empresaId?.toString() },
        { empresaRef: { $exists: false } },
        { empresaRef: null }
      ]
    };
    // Filtro de estado (default: Completado)
    if (estado && estado !== 'todos') {
      filtro.Estado = estado;
    } else if (!estado) {
      filtro.Estado = 'Completado';
    }
    if (desde) filtro.fecha = { ...filtro.fecha, $gte: new Date(desde + 'T00:00:00Z') };
    if (hasta) filtro.fecha = { ...filtro.fecha, $lte: new Date(hasta + 'T23:59:59Z') };

    // Cargar tarifas LPU, técnicos vinculados y config de producción
    const ConfigProduccion = require('./platforms/agentetelecom/models/ConfigProduccion');
    const [tarifasLPU, tecnicosVinculados, configProd] = await Promise.all([
      obtenerTarifasEmpresa(empresaId),
      Tecnico.find({ empresaRef: empresaId, idRecursoToa: { $exists: true, $ne: '' } })
        .select('idRecursoToa nombres apellidos nombre')
        .lean(),
      ConfigProduccion.findOne({ empresaRef: empresaId }).lean()
    ]);

    // Mapa de IDs vinculados para filtro rápido
    const vinculadosSet = new Set(tecnicosVinculados.map(t => t.idRecursoToa));
    const vinculadosList = tecnicosVinculados.map(t => ({
      idRecurso: t.idRecursoToa,
      nombre: t.nombre || `${t.nombres || ''} ${t.apellidos || ''}`.trim()
    }));

    // Obtener estados únicos para filtro en frontend
    const estadosAgg = await Actividad.aggregate([
      { $match: { $or: filtro.$or, fecha: filtro.fecha } },
      { $group: { _id: '$Estado', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).allowDiskUse(true);
    const estados = estadosAgg.filter(e => e._id).map(e => ({ estado: e._id, count: e.count }));

    // Mapas de agregación en memoria
    const techMap = {};
    const calendarMap = {};
    const cityMap = {};
    const lpuMap = {};
    let totalOrders = 0;

    // Cursor: procesar documentos uno a uno sin cargar todo en memoria
    const cursor = Actividad.find(filtro).sort({ fecha: -1 }).lean().cursor();

    for await (const doc of cursor) {
      // Sanitizar keys (reemplazar puntos por _)
      const clean = {};
      for (const [k, v] of Object.entries(doc)) {
        clean[k.replace(/\./g, '_')] = v;
      }

      // Parsear XML si no tiene datos derivados
      if (!clean['Velocidad_Internet'] && !clean['Total_Equipos_Extras']) {
        const xmlField = clean['Productos_y_Servicios_Contratados'] || '';
        const derivados = parsearProductosServiciosTOA(xmlField);
        if (derivados) Object.assign(clean, derivados);
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
      const idRecurso = clean['ID_Recurso'] || clean['ID Recurso'] || '';
      const ordenId = String(clean['Número_de_Petición'] || clean['Número de Petición'] || clean.ordenId || '');
      const isRepair = ordenId.toUpperCase().startsWith('INC');
      const pBase = parseFloat(clean['Pts_Actividad_Base']) || 0;
      const pDeco = parseFloat(clean['Pts_Deco_Adicional']) || 0;
      const pRep = parseFloat(clean['Pts_Repetidor_WiFi']) || 0;
      const pTel = parseFloat(clean['Pts_Telefono']) || 0;
      const pTotal = parseFloat(clean['Pts_Total_Baremo']) || 0;
      const descLpu = clean['Desc_LPU_Base'] || '';
      const codigoLpu = clean['Codigo_LPU_Base'] || '';
      const isVinculado = idRecurso ? vinculadosSet.has(idRecurso) : false;

      // DateKey
      let dateKey = '';
      if (fecha) {
        const dt = new Date(fecha);
        dateKey = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
      }

      totalOrders++;

      // ── Agregar a techMap ──
      if (tecnico) {
        if (!techMap[tecnico]) {
          techMap[tecnico] = {
            name: tecnico, orders: 0,
            ptsBase: 0, ptsDeco: 0, ptsRepetidor: 0, ptsTelefono: 0, ptsTotal: 0,
            days: new Set(), dailyMap: {}, activities: {}, cityMap: {},
            provisionCount: 0, repairCount: 0, isVinculado: false, idRecurso: ''
          };
        }
        const t = techMap[tecnico];
        t.orders++;
        t.ptsBase += pBase;
        t.ptsDeco += pDeco;
        t.ptsRepetidor += pRep;
        t.ptsTelefono += pTel;
        t.ptsTotal += pTotal;
        t.provisionCount += isRepair ? 0 : 1;
        t.repairCount += isRepair ? 1 : 0;
        if (isVinculado) { t.isVinculado = true; t.idRecurso = idRecurso; }
        if (dateKey) {
          t.days.add(dateKey);
          if (!t.dailyMap[dateKey]) t.dailyMap[dateKey] = { orders: 0, pts: 0 };
          t.dailyMap[dateKey].orders++;
          t.dailyMap[dateKey].pts += pTotal;
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
      activeDays: t.days.size,
      avgPerDay: t.days.size > 0 ? Math.round((t.ptsTotal / t.days.size) * 100) / 100 : 0,
      dailyMap: t.dailyMap,
      activities: t.activities,
      provisionCount: t.provisionCount,
      repairCount: t.repairCount,
      isVinculado: t.isVinculado,
      idRecurso: t.idRecurso,
      cityMap: t.cityMap,
    }));

    const totalPts = tecnicos.reduce((s, t) => s + t.ptsTotal, 0);
    const uniqueTechs = tecnicos.length;
    const uniqueDays = Object.keys(calendarMap).length;
    const avgPtsPerTechPerDay = uniqueTechs > 0 && uniqueDays > 0 ? Math.round((totalPts / uniqueTechs / uniqueDays) * 100) / 100 : 0;

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

    res.json({
      stats: { totalOrders, totalPts: Math.round(totalPts * 100) / 100, avgPtsPerTechPerDay, uniqueTechs, uniqueDays },
      tecnicos,
      calendar: calendarMap,
      cities: cityMap,
      lpuActivities,
      estados,
      vinculados: vinculadosList,
      metaConfig,
    });
  } catch (error) {
    console.error('❌ /api/bot/produccion-stats error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2.2 DATOS TOA — Descarga Masiva (Módulo Descarga TOA)
// Recupera TODOS los registros del bot: con empresaRef O sin él (primera descarga sin campo)
// También repara en background cualquier registro sin empresaRef.
app.get('/api/bot/datos-toa', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    let { desde, hasta } = req.query;

    // Validar que desde/hasta sean strings tipo "2026-03-01"
    if (desde && (typeof desde !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(desde))) desde = undefined;
    if (hasta && (typeof hasta !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(hasta))) hasta = undefined;

    // Query amplia: registros de esta empresa O registros sin empresa asignada (bot sin fix)
    // Comparar tanto como ObjectId como string (el bot guarda como string via env var)
    const filtro = {
      $or: [
        { empresaRef: empresaId },
        { empresaRef: empresaId?.toString() },
        { empresaRef: { $exists: false } },
        { empresaRef: null }
      ]
    };
    if (desde) filtro.fecha = { ...filtro.fecha, $gte: new Date(desde + 'T00:00:00Z') };
    if (hasta) filtro.fecha = { ...filtro.fecha, $lte: new Date(hasta + 'T23:59:59Z') };

    // Contar total real en MongoDB (sin límite)
    const totalReal = await Actividad.countDocuments(filtro);

    // Límite seguro para no reventar la memoria del servidor
    // Para dashboards de producción, usar /api/bot/produccion-stats (agregación server-side)
    const hayFiltroFecha = !!(desde || hasta);
    const limite = hayFiltroFecha ? 50000 : 10000;
    const datos = await Actividad.find(filtro)
      .sort({ fecha: -1, bucket: 1 })
      .limit(limite)
      .lean();   // objetos planos — evita que Mongoose falle con field names que tienen puntos

    // Cargar tarifas LPU para baremización + mapa de valorización (técnico→cliente→valor)
    const tarifasLPU = await obtenerTarifasEmpresa(empresaId);
    const mapaValorizacion = await construirMapaValorizacion(empresaId);

    // Sanitizar keys con puntos + parsear XML + calcular baremos + valorizar
    const datosSanitizados = datos.map(doc => {
      const clean = {};
      for (const [k, v] of Object.entries(doc)) {
        const safeKey = k.replace(/\./g, '_');
        clean[safeKey] = v;
      }
      // Si el registro no tiene columnas derivadas, parsear XML on-the-fly
      if (!clean['Velocidad_Internet'] && !clean['Total_Equipos_Extras']) {
        const xmlField = clean['Productos_y_Servicios_Contratados'] || '';
        const derivados = parsearProductosServiciosTOA(xmlField);
        if (derivados) Object.assign(clean, derivados);
      }
      // Calcular baremos on-the-fly si no están guardados
      if (!clean['Pts_Total_Baremo'] && tarifasLPU.length > 0) {
        const baremos = calcularBaremos(clean, tarifasLPU);
        if (baremos) Object.assign(clean, baremos);
      }
      // Valorizar monetariamente (siempre agrega columnas, con 0 si no hay vínculo)
      const valorizacion = valorizarBaremos(clean, mapaValorizacion);
      Object.assign(clean, valorizacion);
      return clean;
    });

    // Reparar en background: asignar empresaRef a registros huérfanos
    const huerfanos = datos.filter(d => !d.empresaRef).map(d => d._id);
    if (huerfanos.length > 0) {
      Actividad.updateMany(
        { _id: { $in: huerfanos } },
        { $set: { empresaRef: empresaId } }
      ).catch(e => console.warn('⚠️ Repair empresaRef:', e.message));
    }

    res.json({ datos: datosSanitizados, totalReal, limite, hayFiltroFecha });
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
    const { desde, hasta } = req.query;

    const filtro = {
      $or: [
        { empresaRef: empresaId },
        { empresaRef: empresaId?.toString() },
        { empresaRef: { $exists: false } },
        { empresaRef: null }
      ]
    };
    if (desde) filtro.fecha = { ...filtro.fecha, $gte: new Date(desde + 'T00:00:00Z') };
    if (hasta) filtro.fecha = { ...filtro.fecha, $lte: new Date(hasta + 'T23:59:59Z') };

    // Sin límite — trae TODOS los registros
    const datos = await Actividad.find(filtro)
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
          : (typeof v === 'object') ? JSON.stringify(v) : String(v);
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
    const filtro = {
      $or: [
        { empresaRef: empresaId },
        { empresaRef: empresaId?.toString() },
        { empresaRef: { $exists: false } },
        { empresaRef: null }
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
    const { columna } = req.query;
    if (!columna) return res.status(400).json({ error: 'Falta parámetro columna' });
    const filtro = {
      $or: [
        { empresaRef: empresaId },
        { empresaRef: empresaId?.toString() },
        { empresaRef: { $exists: false } },
        { empresaRef: null }
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
    const { busqueda } = req.query;

    // 1. Obtener todos los ID Recurso únicos de las actividades de esta empresa
    const filtro = {
      $or: [
        { empresaRef: empresaId },
        { empresaRef: empresaId?.toString() },
        { empresaRef: { $exists: false } },
        { empresaRef: null }
      ],
      'ID Recurso': { $exists: true, $ne: '' }
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
      if (r.operador === 'equals') return { [r.columna]: r.valor };
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
      if (r.operador === 'equals') return { [r.columna]: r.valor };
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
    const { tecnicoId, fechaInicio, fechaFin } = req.query;
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
const serverInstance = app.listen(PORT, () => console.log(`🚀 GEN AI Core running on port ${PORT}`));

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
/**
 * Gen AI — Módulo de Inteligencia Artificial
 * Predicciones estadísticas nativas + integración OpenAI opcional
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { protect } = require('../auth/authMiddleware');
const logger = require('../../utils/logger');

const MANUALES_DIR = path.resolve(__dirname, '../../../Material/MANUALES_TECNICOS_MODULOS');
let MANUAL_CACHE = null;
const STANDARD_CHAT_TTL_MS = 15 * 60 * 1000;
const MIN_CHAT_TTL_MS = 5 * 60 * 1000;
const MAX_CHAT_TTL_MS = 30 * 60 * 1000;
const rawTtl = Number(process.env.AI_CHAT_TTL_MS || STANDARD_CHAT_TTL_MS);
const CHAT_TTL_MS = Math.min(MAX_CHAT_TTL_MS, Math.max(MIN_CHAT_TTL_MS, Number.isFinite(rawTtl) ? rawTtl : STANDARD_CHAT_TTL_MS));
const CHAT_MAX_TURNS = Number(process.env.AI_CHAT_MAX_TURNS || 12);
const CHAT_MEMORY = new Map();

function tokenize(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

function buildManualIndex() {
  try {
    if (!fs.existsSync(MANUALES_DIR)) return [];

    const files = fs
      .readdirSync(MANUALES_DIR)
      .filter((name) => name.toLowerCase().endsWith('.md'))
      .sort();

    return files.map((file) => {
      const fullPath = path.join(MANUALES_DIR, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      const title = lines.find((l) => l.trim().startsWith('#'))?.replace(/^#+\s*/, '').trim() || file;
      const summary = lines
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
        .slice(0, 4)
        .join(' ')
        .slice(0, 420);

      return {
        file,
        title,
        content,
        summary,
        tokens: tokenize(`${title} ${summary} ${content}`)
      };
    });
  } catch (error) {
    logger.error('AI manual index error', { error: error.message });
    return [];
  }
}

function getManualIndex() {
  if (!MANUAL_CACHE) {
    MANUAL_CACHE = buildManualIndex();
  }
  return MANUAL_CACHE;
}

function rankManualsByQuery(query, limit = 3) {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];

  const manuals = getManualIndex();
  const scored = manuals
    .map((doc) => {
      const tokenSet = new Set(doc.tokens);
      let score = 0;
      qTokens.forEach((t) => {
        if (tokenSet.has(t)) score += 1;
      });
      return {
        ...doc,
        score
      };
    })
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((doc) => ({
    documento: doc.file,
    titulo: doc.title,
    relevancia: doc.score,
    resumen: doc.summary,
    extracto: doc.content.slice(0, 1100)
  }));
}

function inferIntentLabel(message = '') {
  const m = String(message || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!m) return 'general';

  const rules = {
    permisos_accesos: [
      'permiso', 'acceso', 'rol', 'ruta', 'autoriza', 'autorizacion', 'perfil', 'menu', 'módulo', 'modulo',
      'no me aparece', 'no veo', 'no puedo ver', 'no puedo editar', 'sin permiso', 'bloqueado'
    ],
    prevencion_inspecciones: [
      'inspeccion', 'hse', 'firma', 'tecnico', 'revision', 'epp', 'ast', 'iper', 'incidente',
      'no quedo guardada', 'no se guardo', 'no aparece la inspeccion', 'en terreno', 'evidencia'
    ],
    rrhh_operacion: [
      'vacacion', 'licencia', 'rrhh', 'asistencia', 'finiquito', 'permiso con goce', 'permiso sin goce',
      'solicitud', 'aprobacion vacaciones', 'dias habiles', 'inasistencia'
    ],
    logistica_operacion: [
      'logistica', 'inventario', 'almacen', 'despacho', 'compra', 'bodega', 'stock', 'herramienta', 'auditoria'
    ],
    operaciones_portales: [
      'combustible', 'portal supervisor', 'portal colaborador', 'operaciones', 'toa', 'gps', 'flota', 'produccion',
      'mi equipo', 'dotacion', 'turnos', 'checklist vehicular'
    ]
  };

  let bestLabel = 'general';
  let bestScore = 0;
  Object.entries(rules).forEach(([label, hints]) => {
    let score = 0;
    hints.forEach((hint) => {
      if (m.includes(hint)) score += hint.includes(' ') ? 2 : 1;
    });
    if (score > bestScore) {
      bestScore = score;
      bestLabel = label;
    }
  });

  return bestScore > 0 ? bestLabel : 'general';
}

function cleanupChatMemory() {
  const now = Date.now();
  for (const [key, data] of CHAT_MEMORY.entries()) {
    if (!data?.expiresAt || now > data.expiresAt) CHAT_MEMORY.delete(key);
  }
}

function getSessionMemory(req, chatSessionId) {
  cleanupChatMemory();
  if (!chatSessionId) return [];
  const key = `${String(req.user?.empresaRef || 'no-company')}:${String(req.user?._id || 'no-user')}:${chatSessionId}`;
  const found = CHAT_MEMORY.get(key);
  if (!found) return [];
  found.expiresAt = Date.now() + CHAT_TTL_MS;
  return Array.isArray(found.turns) ? found.turns : [];
}

function appendSessionMemory(req, chatSessionId, message, answer) {
  if (!chatSessionId) return;
  const key = `${String(req.user?.empresaRef || 'no-company')}:${String(req.user?._id || 'no-user')}:${chatSessionId}`;
  const current = CHAT_MEMORY.get(key) || { turns: [], expiresAt: Date.now() + CHAT_TTL_MS };
  current.turns.push({ role: 'user', text: String(message || '').slice(0, 700) });
  current.turns.push({ role: 'assistant', text: String(answer || '').slice(0, 1200) });
  if (current.turns.length > CHAT_MAX_TURNS * 2) {
    current.turns = current.turns.slice(-CHAT_MAX_TURNS * 2);
  }
  current.expiresAt = Date.now() + CHAT_TTL_MS;
  CHAT_MEMORY.set(key, current);
}

function isGreeting(text = '') {
  return /^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|ola)\b/i.test(String(text).trim());
}

function isGenAIDomainQuestion(text = '') {
  const msg = String(text || '').toLowerCase();
  if (!msg.trim()) return false;
  if (isGreeting(msg)) return true;

  const allowedHints = [
    'gen ai', 'ecosistema', 'modulo', 'módulo', 'ruta', 'permiso', 'rol', 'usuario', 'empresa',
    'rrhh', 'vacacion', 'licencia', 'finiquito', 'asistencia',
    'prevencion', 'hse', 'inspeccion', 'ast', 'iper', 'incidente',
    'operaciones', 'portal supervisor', 'portal colaborador', 'combustible',
    'logistica', 'inventario', 'almacen', 'despacho', 'compras', 'proveedor',
    'flota', 'gps', 'toa',
    'administracion', 'sii', 'previred', 'dashboard', 'aprobaciones',
    'empresa360', 'facturacion', 'tesoreria', 'biometria', 'beneficios', 'lms', 'evaluaciones',
    'chat', 'video', 'comunicaciones',
    'error', 'soporte', 'ayuda', 'configuracion', 'configuración'
  ];

  return allowedHints.some((hint) => msg.includes(hint));
}

function getRolePersona(user, contexto) {
  const role = String(user?.role || '').toLowerCase();
  const rolCtx = String(contexto?.rolUsuario || '').toLowerCase();
  const merged = `${role} ${rolCtx}`;
  if (['system_admin', 'ceo'].includes(role)) return 'executive';
  if (role === 'admin') return 'admin';
  if (/supervisor/.test(merged)) return 'supervisor';
  if (/rrhh|recursos.humanos/.test(merged)) return 'rrhh';
  if (/logistic|almacen|despacho|inventario|bodega/.test(merged)) return 'logistica';
  return 'colaborador';
}

const PERSONA_CLOSING = {
  executive: '¿Necesitas otro indicador o análisis ejecutivo?',
  admin: '¿Puedo ayudarte con otra configuración o gestión del sistema?',
  supervisor: '¿Te ayudo con algún indicador de tu equipo o proceso?',
  rrhh: '¿Hay algo más en que pueda apoyarte en la gestión de personas?',
  logistica: '¿Necesitas apoyo con algún proceso logístico u operativo?',
  colaborador: '¿Te ayudo en algo más?'
};

const PERSONA_SYSTEM_STYLE = {
  executive: 'Adopta una perspectiva ejecutiva: indicadores clave, visión estratégica y lenguaje preciso.',
  admin: 'Adopta un enfoque técnico-resolutivo: perspectiva completa del sistema y soluciones concretas.',
  supervisor: 'Adopta un enfoque operacional-analítico: métricas de equipo, rendimiento y productividad.',
  rrhh: 'Adopta un tono empático y profesional: gestión de personas, procedimientos de personal y bienestar.',
  logistica: 'Adopta un enfoque práctico y directo: operaciones, inventario, cadena de suministro y flujos.',
  colaborador: 'Responde de forma clara y simple, paso a paso, sin tecnicismos innecesarios.'
};

function humanizeResponse({ user, answer, isFirstTurn = false, persona = 'colaborador' }) {
  const name = user?.name ? String(user.name).split(' ')[0] : 'equipo';
  const greeting = isFirstTurn ? `Hola ${name}. ` : '';
  const closing = PERSONA_CLOSING[persona] || PERSONA_CLOSING.colaborador;
  return `${greeting}${answer}\n\n${closing}`;
}

function buildManualGuidedLocalAnswer(userMessage, liveCtx, fuentes) {
  const top = fuentes?.[0] || null;
  if (!top) return null;

  const base = [
    `Con base en ${top.titulo}, la recomendacion es:`,
    `${top.resumen || 'Usar el flujo estandar del modulo afectado, validar permisos (ver/crear/editar/eliminar) y confirmar ruta de acceso.'}`,
    '',
    'Checklist rapido:',
    '1. Confirma modulo y ruta exacta donde ocurre el problema.',
    '2. Valida permiso granular del usuario para la accion solicitada.',
    '3. Reproduce el caso con el mismo rol y empresa activa.',
    '4. Si persiste, escalar con mensaje de error y evidencia.',
    '',
    `Contexto operativo en vivo: ${liveCtx.totalActividades30d} actividades (30d), dotacion ${liveCtx.totalPersonal}, asistencia 7d ${liveCtx.tasaAsistencia7d ?? 'N/D'}%.`
  ];

  if (/inspeccion|hse|firma|tecnico|revision/i.test(userMessage)) {
    base.push('', 'Nota HSE:', 'Si falta firma del tecnico en inspeccion, registrar observacion automatica y mover a estado En Revision para regularizacion.');
  }

  return base.join('\n');
}

function buildSmartLocalFallbackAnswer(userMessage, liveCtx, intentLabel, fuentes) {
  const top = fuentes?.[0] || null;
  const resumenFuente = top
    ? `Fuente sugerida: ${top.titulo} (${top.documento}).`
    : 'Fuente sugerida: revisa el módulo correspondiente en el ecosistema Gen AI.';

  const recomendaciones = {
    permisos_accesos: 'Recomendación: valida rol del usuario, permiso granular (ver/crear/editar/eliminar) y ruta exacta.',
    prevencion_inspecciones: 'Recomendación: confirma estado de inspección (En Revisión/Aprobado/Rechazado), firma del técnico y evidencia adjunta.',
    rrhh_operacion: 'Recomendación: verifica solicitud, cadena de aprobación y estado en RRHH antes de escalar.',
    logistica_operacion: 'Recomendación: valida stock, trazabilidad por técnico y último movimiento de inventario.',
    operaciones_portales: 'Recomendación: revisa vínculo usuario-equipo-supervisor y permisos del portal operativo.',
    general: 'Recomendación: indícame módulo exacto, ruta, acción realizada y mensaje de error para darte pasos concretos.'
  };

  return [
    `Entendido. Te apoyo en este caso dentro del ecosistema Gen AI.`,
    recomendaciones[intentLabel] || recomendaciones.general,
    `Contexto en vivo: ${liveCtx.totalActividades30d} actividades (30d), dotación ${liveCtx.totalPersonal}, asistencia 7d ${liveCtx.tasaAsistencia7d ?? 'N/D'}%.`,
    resumenFuente,
    `Si quieres, te doy el paso a paso exacto para: "${String(userMessage || '').slice(0, 120)}".`
  ].join('\n');
}

router.get('/support/sources', protect, async (_req, res) => {
  try {
    if (!_req.user?.empresaRef) {
      return res.status(403).json({ ok: false, message: 'El asistente requiere usuario asociado a una empresa.' });
    }
    const manuals = getManualIndex().map((doc) => ({ documento: doc.file, titulo: doc.title, resumen: doc.summary }));
    res.json({ ok: true, total: manuals.length, manuals });
  } catch (err) {
    logger.error('AI support/sources error', { error: err.message });
    res.status(500).json({ ok: false, message: 'No se pudieron cargar las fuentes de conocimiento.' });
  }
});

async function buildLiveAIContext(user) {
  const mongoose = require('mongoose');
  let Actividad, Tecnico, RegistroAsistencia;

  try { Actividad = mongoose.model('Actividad'); } catch (_) { Actividad = require('../agentetelecom/models/Actividad'); }
  try { Tecnico = mongoose.model('Tecnico'); } catch (_) { Tecnico = require('../agentetelecom/models/Tecnico'); }
  try { RegistroAsistencia = mongoose.model('RegistroAsistencia'); } catch (_) { RegistroAsistencia = require('../rrhh/models/RegistroAsistencia'); }

  const empresaRef = user.empresaRef;
  const makeEmpresaMatch = (field = 'empresaRef') => {
    if (!empresaRef) return { [field]: { $exists: true } };
    const val = String(empresaRef);
    const cond = [{ [field]: val }];
    if (mongoose.Types.ObjectId.isValid(val)) cond.push({ [field]: new mongoose.Types.ObjectId(val) });
    return { $or: cond };
  };

  const hace30 = new Date(Date.now() - 30 * 86400000);
  const hace7 = new Date(Date.now() - 7 * 86400000);

  const [prodAgg, totalActivos, asistencia7d] = await Promise.all([
    Actividad.aggregate([
      { $match: { ...makeEmpresaMatch('empresaRef'), fecha: { $gte: hace30 } } },
      {
        $group: {
          _id: null,
          totalActividades30d: { $sum: 1 },
          totalPuntos30d: { $sum: { $ifNull: ['$PTS_TOTAL_BAREMO', { $ifNull: ['$Pts_Total_Baremo', 0] }] } }
        }
      }
    ]),
    Tecnico.countDocuments({ ...makeEmpresaMatch('empresaRef') }),
    RegistroAsistencia.aggregate([
      { $match: { ...makeEmpresaMatch('empresaRef'), fecha: { $gte: hace7 } } },
      {
        $group: {
          _id: null,
          presentes: { $sum: { $cond: [{ $eq: ['$estado', 'Presente'] }, 1, 0] } },
          total: { $sum: 1 }
        }
      }
    ])
  ]);

  const p = prodAgg?.[0] || { totalActividades30d: 0, totalPuntos30d: 0 };
  const a = asistencia7d?.[0] || { presentes: 0, total: 0 };
  const tasaAsistencia = a.total > 0 ? Math.round((a.presentes / a.total) * 100) : null;

  return {
    totalActividades30d: p.totalActividades30d || 0,
    totalPuntos30d: Math.round((p.totalPuntos30d || 0) * 100) / 100,
    promedioActividadesDia30d: Math.round(((p.totalActividades30d || 0) / 30) * 100) / 100,
    totalPersonal: totalActivos || 0,
    tasaAsistencia7d: tasaAsistencia
  };
}

// ─── Helpers estadísticos ────────────────────────────────────────────────────

/**
 * Calcula media móvil simple de los últimos `window` valores de un array.
 */
function movingAverage(series, window = 3) {
  if (!series || series.length < window) return series;
  return series.map((_, i) => {
    if (i < window - 1) return null;
    const slice = series.slice(i - window + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / window;
  }).filter(v => v !== null);
}

/**
 * Proyecta los próximos `steps` valores usando regresión lineal simple.
 */
function linearForecast(series, steps = 7) {
  const n = series.length;
  if (n < 2) return Array(steps).fill(series[0] || 0);
  const meanX = (n - 1) / 2;
  const meanY = series.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  series.forEach((y, x) => {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  });
  const slope = den !== 0 ? num / den : 0;
  const intercept = meanY - slope * meanX;
  return Array.from({ length: steps }, (_, i) => {
    const val = slope * (n + i) + intercept;
    return Math.max(0, Math.round(val * 100) / 100);
  });
}

/**
 * Detecta anomalías: valores que superan media ± 2σ
 */
function detectAnomalies(series) {
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  const std = Math.sqrt(series.reduce((acc, v) => acc + (v - mean) ** 2, 0) / series.length);
  return series.map((v, i) => ({
    index: i,
    value: v,
    isAnomaly: Math.abs(v - mean) > 2 * std,
    zScore: std > 0 ? ((v - mean) / std).toFixed(2) : 0,
  })).filter(p => p.isAnomaly);
}

// ─── GET /api/ai/insights/produccion ────────────────────────────────────────

router.get('/insights/produccion', protect, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    // Usar el modelo Actividad del agente telecom para sacar datos de producción
    let Actividad;
    try {
      Actividad = mongoose.model('Actividad');
    } catch (e) {
      Actividad = require('../agentetelecom/models/Actividad');
    }

    const empresaRef = req.user.empresaRef;

    // Agrupar actividades por día (últimos 30 días)
    const hace30 = new Date();
    hace30.setDate(hace30.getDate() - 30);

    const dailyData = await Actividad.aggregate([
      {
        $match: {
          empresaRef: empresaRef
            ? new mongoose.Types.ObjectId(String(empresaRef))
            : { $exists: true },
          fecha: { $gte: hace30 },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha' } },
          totalActividades: { $sum: 1 },
          totalPuntos: { $sum: { $ifNull: ['$puntosTotales', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const fechas = dailyData.map(d => d._id);
    const serieActividades = dailyData.map(d => d.totalActividades);
    const seriePuntos = dailyData.map(d => d.totalPuntos);

    const forecastActividades = linearForecast(serieActividades, 7);
    const forecastPuntos = linearForecast(seriePuntos, 7);
    const anomaliasActividades = detectAnomalies(serieActividades);
    const maActividades = movingAverage(serieActividades, 5);

    // Tendencia: pendiente de regresión
    const n = serieActividades.length;
    const meanX = (n - 1) / 2;
    const meanY = serieActividades.reduce((a, b) => a + b, 0) / (n || 1);
    let slopeNum = 0, slopeDen = 0;
    serieActividades.forEach((y, x) => {
      slopeNum += (x - meanX) * (y - meanY);
      slopeDen += (x - meanX) ** 2;
    });
    const tendencia = slopeDen > 0 ? slopeNum / slopeDen : 0;

    res.json({
      ok: true,
      resumen: {
        totalActividades30d: serieActividades.reduce((a, b) => a + b, 0),
        totalPuntos30d: seriePuntos.reduce((a, b) => a + b, 0),
        promedioDiario: n > 0 ? Math.round(serieActividades.reduce((a, b) => a + b, 0) / n) : 0,
        tendencia: tendencia > 0.5 ? 'subiendo' : tendencia < -0.5 ? 'bajando' : 'estable',
        pendienteDiaria: Math.round(tendencia * 100) / 100,
        anomaliasDetectadas: anomaliasActividades.length,
      },
      historico: {
        fechas,
        actividades: serieActividades,
        puntos: seriePuntos,
        mediaMovil5d: maActividades,
      },
      forecast: {
        descripcion: 'Proyección próximos 7 días (regresión lineal)',
        actividades: forecastActividades,
        puntos: forecastPuntos,
      },
      anomalias: anomaliasActividades,
    });
  } catch (err) {
    logger.error('AI insights/produccion error', { error: err.message });
    res.status(500).json({ ok: false, message: 'Error al calcular insights de producción', error: err.message });
  }
});

// ─── GET /api/ai/insights/rrhh ────────────────────────────────────────────────

router.get('/insights/rrhh', protect, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    let Tecnico, RegistroAsistencia;

    try { Tecnico = mongoose.model('Tecnico'); } catch (e) { Tecnico = require('../agentetelecom/models/Tecnico'); }
    try { RegistroAsistencia = mongoose.model('RegistroAsistencia'); } catch (e) { RegistroAsistencia = require('../rrhh/models/RegistroAsistencia'); }

    const empresaRef = req.user.empresaRef;
    const matchBase = empresaRef ? { empresaRef: new mongoose.Types.ObjectId(String(empresaRef)) } : {};

    const [totalActivos, hace14, hace30] = await Promise.all([
      Tecnico.countDocuments({ ...matchBase, activo: true }),
      Tecnico.countDocuments({ ...matchBase, activo: true, updatedAt: { $gte: new Date(Date.now() - 14 * 86400000) } }),
      Tecnico.countDocuments({ ...matchBase, createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } }),
    ]);

    // Asistencia últimos 7 días
    const asistencia7d = await RegistroAsistencia.aggregate([
      {
        $match: {
          ...matchBase,
          fecha: { $gte: new Date(Date.now() - 7 * 86400000) },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha' } },
          presentes: { $sum: { $cond: [{ $eq: ['$estado', 'Presente'] }, 1, 0] } },
          ausentes: { $sum: { $cond: [{ $ne: ['$estado', 'Presente'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const tasaAsistencia = asistencia7d.length > 0
      ? asistencia7d.reduce((acc, d) => acc + d.presentes / Math.max(1, d.presentes + d.ausentes), 0) / asistencia7d.length
      : null;

    res.json({
      ok: true,
      dotacion: {
        totalActivos,
        incorporados30d: hace30,
        actividadReciente14d: hace14,
        tasaRetencion: totalActivos > 0 ? Math.round((hace14 / totalActivos) * 100) : 100,
      },
      asistencia: {
        datos7d: asistencia7d,
        tasaPromedioAsistencia: tasaAsistencia !== null ? Math.round(tasaAsistencia * 100) : null,
        alerta: tasaAsistencia !== null && tasaAsistencia < 0.8 ? 'Asistencia baja — revisar dotación' : null,
      },
    });
  } catch (err) {
    logger.error('AI insights/rrhh error', { error: err.message });
    res.status(500).json({ ok: false, message: 'Error al calcular insights RRHH', error: err.message });
  }
});

// ─── POST /api/ai/chat ────────────────────────────────────────────────────────
// Si OPENAI_API_KEY está configurado, usa GPT. Si no, responde con análisis local.

router.post('/chat', protect, async (req, res) => {
  const { mensaje, contexto } = req.body;

  if (!mensaje || typeof mensaje !== 'string' || mensaje.trim().length === 0) {
    return res.status(400).json({ ok: false, message: 'El campo `mensaje` es requerido.' });
  }

  // Sanitizar entrada
  const mensajeLimpio = mensaje.trim().slice(0, 2000);

  if (!req.user?.empresaRef || (req.user?.status && req.user.status !== 'Activo')) {
    return res.status(403).json({
      ok: false,
      message: 'Asistente disponible solo para usuarios activos y asociados a una empresa.'
    });
  }

  if (!isGenAIDomainQuestion(mensajeLimpio)) {
    const respuestaFueraDominio = humanizeResponse({
      user: req.user,
      isFirstTurn: true,
      answer: 'Puedo ayudarte solo con soporte del ecosistema Gen AI: modulos, rutas, permisos, errores operativos y procedimientos internos por empresa.'
    });
    return res.json({ ok: true, modo: 'local', intentLabel: 'out_of_scope', respuesta: respuestaFueraDominio, fuentes: [] });
  }

  try {
    const liveCtx = await buildLiveAIContext(req.user);
    const fuentes = rankManualsByQuery(mensajeLimpio, 3);
    const intentLabel = inferIntentLabel(mensajeLimpio);
    const chatSessionId = contexto?.chatSessionId || null;
    const sessionTurns = getSessionMemory(req, chatSessionId);
    const isFirstTurn = sessionTurns.length === 0;
    const persona = getRolePersona(req.user, contexto);

    if (process.env.OPENAI_API_KEY) {
      // ── Modo OpenAI ──────────────────────────────────────────────────────
      const axios = require('axios');
      const personaStyle = PERSONA_SYSTEM_STYLE[persona] || PERSONA_SYSTEM_STYLE.colaborador;
      const systemPrompt = `Eres el asistente de IA del ecosistema Enterprise Platform Gen AI. 
Tu rol es analizar datos operacionales, responder preguntas sobre producción, RRHH, logística y prevención, y actuar como mesa de ayuda del ecosistema.
Responde siempre en español. ${personaStyle}
    Contexto operativo en vivo: ${JSON.stringify(liveCtx)}.
  ${contexto ? `Contexto adicional del usuario: ${String(contexto).slice(0, 500)}` : ''}
  ${fuentes.length > 0 ? `Base de conocimiento de manuales relevantes: ${JSON.stringify(fuentes.map((f) => ({ documento: f.documento, titulo: f.titulo, resumen: f.resumen })).slice(0, 3))}` : ''}
  ${sessionTurns.length > 0 ? `Historial temporal de la sesión actual (mantener continuidad): ${JSON.stringify(sessionTurns.slice(-8))}` : ''}`;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: mensajeLimpio },
          ],
          max_tokens: 800,
          temperature: 0.4,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const raw = response.data.choices?.[0]?.message?.content || 'Sin respuesta del modelo.';
      const payloadSources = fuentes.map(({ documento, titulo, relevancia }) => ({ documento, titulo, relevancia }));
      const respuesta = humanizeResponse({ user: req.user, answer: raw, isFirstTurn, persona });
      appendSessionMemory(req, chatSessionId, mensajeLimpio, respuesta);
      return res.json({ ok: true, modo: 'openai', respuesta, tokens: response.data.usage, intentLabel, fuentes: payloadSources, sessionMemory: { ttlMs: CHAT_TTL_MS } });
    } else {
      // ── Modo análisis local (sin API key) ────────────────────────────────
      const lower = mensajeLimpio.toLowerCase();
      let respuesta = '';

      const respuestaManual = buildManualGuidedLocalAnswer(mensajeLimpio, liveCtx, fuentes);

      if (lower.includes('produccion') || lower.includes('producción') || lower.includes('actividad')) {
        respuesta = `Producción en vivo (30 días): ${liveCtx.totalActividades30d} actividades, ${liveCtx.totalPuntos30d} puntos, promedio ${liveCtx.promedioActividadesDia30d} actividades/día. Revisa Insights de Producción para tendencia y proyección.`;
      } else if (lower.includes('rrhh') || lower.includes('personal') || lower.includes('dotacion') || lower.includes('asistencia') || intentLabel === 'rrhh_operacion') {
        respuesta = `RRHH en vivo: dotación ${liveCtx.totalPersonal} personas y asistencia 7d ${liveCtx.tasaAsistencia7d ?? 'N/D'}%. ${liveCtx.tasaAsistencia7d !== null && liveCtx.tasaAsistencia7d < 80 ? 'Alerta: asistencia bajo 80%.' : 'Sin alerta crítica de asistencia.'}`;
      } else if (lower.includes('gps') || lower.includes('flota') || lower.includes('vehiculo') || intentLabel === 'operaciones_portales') {
        respuesta = 'El rastreo GPS de flota está activo y sincroniza cada 5 minutos de forma automática. Visita **Flota & GPS → Monitor GPS** para ver posiciones en tiempo real.';
      } else if (lower.includes('toa') || lower.includes('extracci')) {
        respuesta = 'El Bot TOA ejecuta extracción masiva de órdenes de trabajo cada noche a las 23:00 (hora Santiago). Los datos quedan disponibles en el módulo de Producción al día siguiente.';
      } else if (lower.includes('sii') || lower.includes('tributario') || lower.includes('factura')) {
        respuesta = 'La integración con el SII permite consultar y gestionar documentación tributaria directamente desde la plataforma. Accede desde **Administración → Dashboard Tributario**.';
      } else if (lower.includes('prevenci') || lower.includes('ast') || lower.includes('riesgo') || intentLabel === 'prevencion_inspecciones') {
        respuesta = 'El módulo HSE cubre AST digital, inspecciones, incidentes, matriz IPER y charlas de seguridad. Para anomalías en indicadores de seguridad, revisa **Prevención → Dashboard HSE**.';
      } else if (intentLabel === 'permisos_accesos') {
        respuesta = 'Para incidencias de acceso, valida primero rol, permisos granulares y ruta de menú del usuario. Si indicas módulo y acción exacta (ver/crear/editar/eliminar), te doy el paso a paso de corrección.';
      } else if (intentLabel === 'logistica_operacion') {
        respuesta = 'Para logística, revisa trazabilidad de inventario por técnico, stock disponible y último movimiento de bodega. Si me compartes técnico, recurso y fecha, te indico dónde validar y aprobar.';
      } else if (respuestaManual) {
        respuesta = respuestaManual;
      } else {
        respuesta = buildSmartLocalFallbackAnswer(mensajeLimpio, liveCtx, intentLabel, fuentes);
      }

      const payloadSources = fuentes.map(({ documento, titulo, relevancia }) => ({ documento, titulo, relevancia }));

      const finalRespuesta = humanizeResponse({ user: req.user, answer: respuesta, isFirstTurn, persona });
      appendSessionMemory(req, chatSessionId, mensajeLimpio, finalRespuesta);

      return res.json({ ok: true, modo: 'local', respuesta: finalRespuesta, intentLabel, contextoVivo: liveCtx, fuentes: payloadSources, sessionMemory: { ttlMs: CHAT_TTL_MS } });
    }
  } catch (err) {
    logger.error('AI chat error', { error: err.message });
    // No exponer detalles de error interno al cliente
    res.status(500).json({ ok: false, message: 'Error al procesar la consulta al asistente de IA.' });
  }
});

// ─── GET /api/ai/health ──────────────────────────────────────────────────────
router.get('/health', protect, (req, res) => {
  cleanupChatMemory();
  const manuales = getManualIndex();
  res.json({
    ok: true,
    status: 'online',
    timestamp: new Date().toISOString(),
    uptimeSegundos: Math.floor(process.uptime()),
    modoIA: process.env.OPENAI_API_KEY ? 'openai' : 'local',
    manualesIndexados: manuales.length,
    sesionesActivas: CHAT_MEMORY.size,
    sessionConfig: {
      ttlMs: CHAT_TTL_MS,
      ttlMin: Math.round(CHAT_TTL_MS / 60000),
      maxTurns: CHAT_MAX_TURNS
    }
  });
});

module.exports = router;

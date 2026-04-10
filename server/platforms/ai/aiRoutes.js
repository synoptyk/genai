/**
 * Gen AI — Módulo de Inteligencia Artificial
 * Predicciones estadísticas nativas + integración OpenAI opcional
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../auth/authMiddleware');
const logger = require('../../utils/logger');

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

  try {
    const liveCtx = await buildLiveAIContext(req.user);

    if (process.env.OPENAI_API_KEY) {
      // ── Modo OpenAI ──────────────────────────────────────────────────────
      const axios = require('axios');
      const systemPrompt = `Eres el asistente de IA del ecosistema Enterprise Platform Gen AI. 
Tu rol es analizar datos operacionales, responder preguntas sobre producción, RRHH, logística y prevención.
Responde siempre en español, de forma clara y concisa. 
    Contexto operativo en vivo: ${JSON.stringify(liveCtx)}.
    ${contexto ? `Contexto adicional del usuario: ${String(contexto).slice(0, 500)}` : ''}`;

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

      const respuesta = response.data.choices?.[0]?.message?.content || 'Sin respuesta del modelo.';
      return res.json({ ok: true, modo: 'openai', respuesta, tokens: response.data.usage });
    } else {
      // ── Modo análisis local (sin API key) ────────────────────────────────
      const lower = mensajeLimpio.toLowerCase();
      let respuesta = '';

      if (lower.includes('produccion') || lower.includes('producción') || lower.includes('actividad')) {
        respuesta = `Producción en vivo (30 días): ${liveCtx.totalActividades30d} actividades, ${liveCtx.totalPuntos30d} puntos, promedio ${liveCtx.promedioActividadesDia30d} actividades/día. Revisa Insights de Producción para tendencia y proyección.`;
      } else if (lower.includes('rrhh') || lower.includes('personal') || lower.includes('dotacion') || lower.includes('asistencia')) {
        respuesta = `RRHH en vivo: dotación ${liveCtx.totalPersonal} personas y asistencia 7d ${liveCtx.tasaAsistencia7d ?? 'N/D'}%. ${liveCtx.tasaAsistencia7d !== null && liveCtx.tasaAsistencia7d < 80 ? 'Alerta: asistencia bajo 80%.' : 'Sin alerta crítica de asistencia.'}`;
      } else if (lower.includes('gps') || lower.includes('flota') || lower.includes('vehiculo')) {
        respuesta = 'El rastreo GPS de flota está activo y sincroniza cada 5 minutos de forma automática. Visita **Flota & GPS → Monitor GPS** para ver posiciones en tiempo real.';
      } else if (lower.includes('toa') || lower.includes('extracci')) {
        respuesta = 'El Bot TOA ejecuta extracción masiva de órdenes de trabajo cada noche a las 23:00 (hora Santiago). Los datos quedan disponibles en el módulo de Producción al día siguiente.';
      } else if (lower.includes('sii') || lower.includes('tributario') || lower.includes('factura')) {
        respuesta = 'La integración con el SII permite consultar y gestionar documentación tributaria directamente desde la plataforma. Accede desde **Administración → Dashboard Tributario**.';
      } else if (lower.includes('prevenci') || lower.includes('ast') || lower.includes('riesgo')) {
        respuesta = 'El módulo HSE cubre AST digital, inspecciones, incidentes, matriz IPER y charlas de seguridad. Para anomalías en indicadores de seguridad, revisa **Prevención → Dashboard HSE**.';
      } else {
        respuesta = 'Entendido. Para obtener análisis más detallados, configura tu `OPENAI_API_KEY` en el servidor para activar el asistente GPT completo. Actualmente operando en **modo local** con análisis estadístico nativo.';
      }

      return res.json({ ok: true, modo: 'local', respuesta, contextoVivo: liveCtx });
    }
  } catch (err) {
    logger.error('AI chat error', { error: err.message });
    // No exponer detalles de error interno al cliente
    res.status(500).json({ ok: false, message: 'Error al procesar la consulta al asistente de IA.' });
  }
});

module.exports = router;

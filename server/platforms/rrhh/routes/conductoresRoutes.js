const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const Conductor = require('../models/Conductor');
const Candidato = require('../models/Candidato');
const Proyecto = require('../models/Proyecto');
const { protect } = require('../../auth/authMiddleware');
const ROLES = require('../../auth/roles');

const isHighLevel = (role) => [ROLES.SYSTEM_ADMIN, ROLES.CEO, ROLES.CEO_GENAI, ROLES.GERENCIA, ROLES.ADMIN].includes(String(role || '').toLowerCase());

const haversineKm = (a, b) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
};

const splitRouteSessions = (points, maxGapMs = 30 * 60 * 1000) => {
  if (!Array.isArray(points) || points.length === 0) return [];

  const sessions = [];
  let current = [points[0]];

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const prevTs = new Date(prev.timestamp).getTime();
    const currTs = new Date(curr.timestamp).getTime();
    const gap = currTs - prevTs;

    if (gap > maxGapMs) {
      sessions.push(current);
      current = [curr];
    } else {
      current.push(curr);
    }
  }

  if (current.length) sessions.push(current);
  return sessions;
};

const summarizeSession = (conductor, points, idx) => {
  const sorted = [...points].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const start = sorted[0];
  const end = sorted[sorted.length - 1];

  let distanceKm = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    distanceKm += haversineKm(sorted[i - 1], sorted[i]);
  }

  const moving = sorted.filter((p) => Number(p.velocidad || 0) > 3);
  const avgSpeed = moving.length
    ? moving.reduce((acc, p) => acc + Number(p.velocidad || 0), 0) / moving.length
    : 0;
  const maxSpeed = sorted.reduce((max, p) => Math.max(max, Number(p.velocidad || 0)), 0);

  const durationMin = Math.max(
    0,
    Math.round((new Date(end.timestamp).getTime() - new Date(start.timestamp).getTime()) / 60000)
  );

  return {
    id: `${conductor._id}-${new Date(start.timestamp).toISOString()}-${idx}`,
    conductor: {
      _id: conductor._id,
      nombre: conductor.nombre,
      patente: conductor.patente || '',
    },
    startAt: start.timestamp,
    endAt: end.timestamp,
    durationMin,
    pointsCount: sorted.length,
    distanceKm: Number(distanceKm.toFixed(2)),
    avgSpeed: Number(avgSpeed.toFixed(1)),
    maxSpeed: Number(maxSpeed.toFixed(1)),
    startPoint: { lat: start.lat, lng: start.lng },
    endPoint: { lat: end.lat, lng: end.lng },
    path: sorted.slice(0, 800).map((p) => ({
      lat: p.lat,
      lng: p.lng,
      velocidad: Number(p.velocidad || 0),
      timestamp: p.timestamp,
    })),
  };
};

// ─── ENDPOINTS LOOKUP (antes de /:id para evitar colisiones) ────────────────
router.get('/lookup/candidatos', protect, async (req, res) => {
  try {
    const empresaRef = req.user.empresaRef || req.user.empresa;
    const candidatos = await Candidato.find(
      { empresaRef, status: { $in: ['Contratado', 'Activo'] } },
      { nombre: 1, rut: 1, telefono: 1, email: 1, cargo: 1 }
    ).sort({ nombre: 1 });
    res.json(candidatos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/lookup/proyectos', protect, async (req, res) => {
  try {
    const empresaRef = req.user.empresaRef || req.user.empresa;
    const proyectos = await Proyecto.find(
      { empresaRef, estado: { $in: ['Activo', 'En Ejecución', 'Planificación'] } },
      { nombreProyecto: 1, centroCosto: 1 }
    ).sort({ nombreProyecto: 1 });
    res.json(proyectos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Ingesta GPS pública por token (desde celular del conductor) ─────────────
router.post('/live/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Token inválido.' });

    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    const velocidad = Number(req.body?.velocidad || 0);
    const heading = req.body?.heading != null ? Number(req.body.heading) : null;
    const bateria = req.body?.bateria != null ? Number(req.body.bateria) : null;
    const signal = req.body?.signal != null ? Number(req.body.signal) : null;
    const precision = req.body?.precision != null ? Number(req.body.precision) : null;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'Lat/Lng inválidos.' });
    }

    const conductor = await Conductor.findOne({ gpsToken: token, gpsActivo: true });
    if (!conductor) {
      return res.status(404).json({ error: 'Conductor no encontrado o GPS desactivado.' });
    }

    conductor.ultimaPosicion = {
      lat,
      lng,
      velocidad: Number.isFinite(velocidad) ? velocidad : 0,
      heading: Number.isFinite(heading) ? heading : null,
      bateria: Number.isFinite(bateria) ? bateria : null,
      signal: Number.isFinite(signal) ? signal : null,
      precision: Number.isFinite(precision) ? precision : null,
      timestamp: new Date(),
    };

    conductor.gpsHistorial.push(conductor.ultimaPosicion);
    // Mantener una ventana razonable para no inflar el documento (aprox. 2-4 dias segun frecuencia)
    if (conductor.gpsHistorial.length > 5000) {
      conductor.gpsHistorial = conductor.gpsHistorial.slice(-5000);
    }

    await conductor.save();
    res.json({ ok: true, timestamp: conductor.ultimaPosicion.timestamp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/historial-rutas', protect, async (req, res) => {
  try {
    const userEmpresaRef = req.user.empresaRef || req.user.empresa;
    const maxHighLevel = isHighLevel(req.user.role);

    const fromDate = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const toDate = req.query.to ? new Date(req.query.to) : new Date();
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ error: 'Rango de fechas inválido.' });
    }

    const limit = Math.min(Math.max(Number(req.query.limit || 150), 1), 300);
    const minDistanceKm = Math.max(Number(req.query.minDistanceKm || 0), 0);

    const filter = maxHighLevel
      ? {}
      : { empresaRef: userEmpresaRef };

    if (maxHighLevel && req.query.empresaRef) {
      filter.empresaRef = req.query.empresaRef;
    }
    if (req.query.conductorId) {
      filter._id = req.query.conductorId;
    }

    const conductores = await Conductor.find(filter, {
      nombre: 1,
      patente: 1,
      gpsHistorial: 1,
      empresaRef: 1,
    }).sort({ nombre: 1 });

    const routes = [];
    for (const conductor of conductores) {
      const points = (conductor.gpsHistorial || [])
        .filter((p) => p?.timestamp)
        .filter((p) => {
          const ts = new Date(p.timestamp);
          return ts >= fromDate && ts <= toDate;
        })
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      if (points.length < 2) continue;

      const sessions = splitRouteSessions(points);
      sessions.forEach((sessionPoints, idx) => {
        if (sessionPoints.length < 2) return;
        const route = summarizeSession(conductor, sessionPoints, idx);
        if (route.distanceKm >= minDistanceKm) routes.push(route);
      });
    }

    routes.sort((a, b) => new Date(b.endAt) - new Date(a.endAt));
    const trimmed = routes.slice(0, limit);

    const totalDistanceKm = trimmed.reduce((acc, r) => acc + Number(r.distanceKm || 0), 0);
    const avgDurationMin = trimmed.length
      ? Math.round(trimmed.reduce((acc, r) => acc + Number(r.durationMin || 0), 0) / trimmed.length)
      : 0;
    const uniqueDrivers = new Set(trimmed.map((r) => String(r.conductor?._id || ''))).size;

    res.json({
      window: { from: fromDate, to: toDate },
      summary: {
        totalRoutes: trimmed.length,
        totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
        avgDurationMin,
        activeDrivers: uniqueDrivers,
      },
      routes: trimmed,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/trayecto', protect, async (req, res) => {
  try {
    const empresaRef = req.user.empresaRef || req.user.empresa;
    const query = isHighLevel(req.user.role)
      ? { _id: req.params.id }
      : { _id: req.params.id, empresaRef };

    const conductor = await Conductor.findOne(query, {
      nombre: 1,
      patente: 1,
      gpsHistorial: 1,
      ultimaPosicion: 1,
      empresaRef: 1
    });
    if (!conductor) return res.status(404).json({ error: 'Conductor no encontrado' });

    const now = new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(new Date().setHours(8, 0, 0, 0));
    const to = req.query.to ? new Date(req.query.to) : now;

    const points = (conductor.gpsHistorial || [])
      .filter((p) => p?.timestamp && new Date(p.timestamp) >= from && new Date(p.timestamp) <= to)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let distanceKm = 0;
    for (let i = 1; i < points.length; i += 1) {
      distanceKm += haversineKm(points[i - 1], points[i]);
    }

    const moving = points.filter((p) => Number(p.velocidad || 0) > 3);
    const avgSpeed = moving.length
      ? moving.reduce((acc, p) => acc + Number(p.velocidad || 0), 0) / moving.length
      : 0;

    res.json({
      conductor: {
        _id: conductor._id,
        nombre: conductor.nombre,
        patente: conductor.patente,
      },
      window: { from, to },
      summary: {
        points: points.length,
        distanceKm: Number(distanceKm.toFixed(2)),
        avgSpeed: Number(avgSpeed.toFixed(1)),
      },
      points,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/live/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    const conductor = await Conductor.findOne({ gpsToken: token }, { nombre: 1, patente: 1, gpsActivo: 1, ultimaPosicion: 1 });
    if (!conductor) return res.status(404).json({ error: 'Token no válido.' });
    res.json(conductor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CRUD autenticado ─────────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const empresaRef = req.user.empresaRef || req.user.empresa;
    const filter = isHighLevel(req.user.role) && req.query.empresaRef
      ? { empresaRef: req.query.empresaRef }
      : { empresaRef };

    const conductores = await Conductor.find(filter)
      .populate('candidatoRef', 'nombre rut telefono email status cargo')
      .populate('proyectoRef', 'nombreProyecto centroCosto')
      .sort({ createdAt: -1 });

    res.json(conductores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const empresaRef = req.user.empresaRef || req.user.empresa;
    const data = {
      ...req.body,
      empresaRef,
      creadoPor: req.user.nombre || req.user.email,
      gpsToken: req.body?.gpsToken || crypto.randomBytes(24).toString('hex'),
    };
    const conductor = await Conductor.create(data);
    res.status(201).json(conductor);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Ya existe un conductor con ese RUT en esta empresa.' });
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const empresaRef = req.user.empresaRef || req.user.empresa;
    const query = isHighLevel(req.user.role) ? { _id: req.params.id } : { _id: req.params.id, empresaRef };
    const c = await Conductor.findOne(query)
      .populate('candidatoRef', 'nombre rut telefono email status cargo')
      .populate('proyectoRef', 'nombreProyecto centroCosto');
    if (!c) return res.status(404).json({ error: 'Conductor no encontrado' });
    res.json(c);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const empresaRef = req.user.empresaRef || req.user.empresa;
    const query = isHighLevel(req.user.role) ? { _id: req.params.id } : { _id: req.params.id, empresaRef };
    const c = await Conductor.findOneAndUpdate(query, req.body, { new: true, runValidators: true });
    if (!c) return res.status(404).json({ error: 'Conductor no encontrado' });
    res.json(c);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/gps', protect, async (req, res) => {
  try {
    const { gpsActivo } = req.body;
    const empresaRef = req.user.empresaRef || req.user.empresa;
    const query = isHighLevel(req.user.role) ? { _id: req.params.id } : { _id: req.params.id, empresaRef };

    const conductor = await Conductor.findOne(query);
    if (!conductor) return res.status(404).json({ error: 'Conductor no encontrado' });

    conductor.gpsActivo = Boolean(gpsActivo);
    if (!conductor.gpsToken) conductor.gpsToken = crypto.randomBytes(24).toString('hex');
    if (!conductor.gpsActivo) conductor.ultimaPosicion = null;

    await conductor.save();
    res.json(conductor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/gps-token', protect, async (req, res) => {
  try {
    const empresaRef = req.user.empresaRef || req.user.empresa;
    const query = isHighLevel(req.user.role) ? { _id: req.params.id } : { _id: req.params.id, empresaRef };
    const conductor = await Conductor.findOne(query);
    if (!conductor) return res.status(404).json({ error: 'Conductor no encontrado' });
    conductor.gpsToken = crypto.randomBytes(24).toString('hex');
    await conductor.save();
    res.json({ ok: true, gpsToken: conductor.gpsToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const empresaRef = req.user.empresaRef || req.user.empresa;
    const query = isHighLevel(req.user.role) ? { _id: req.params.id } : { _id: req.params.id, empresaRef };
    const c = await Conductor.findOneAndDelete(query);
    if (!c) return res.status(404).json({ error: 'Conductor no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

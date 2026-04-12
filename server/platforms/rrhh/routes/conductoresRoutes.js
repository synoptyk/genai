const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const router = express.Router();
const Conductor = require('../models/Conductor');
const RutaGuiada = require('../models/RutaGuiada');
const Candidato = require('../models/Candidato');
const Proyecto = require('../models/Proyecto');
const { protect } = require('../../auth/authMiddleware');
const ROLES = require('../../auth/roles');

const isHighLevel = (role) => [ROLES.SYSTEM_ADMIN, ROLES.CEO, ROLES.CEO_GENAI, ROLES.GERENCIA, ROLES.ADMIN].includes(String(role || '').toLowerCase());
const GEO_CACHE = new Map();
const GEO_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_GUIDED_STOPS = 20;
const GUIDED_ROUTE_STATUSES = ['PLANIFICADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA'];
const GUIDED_STOP_DONE_STATUSES = ['ENTREGADO', 'CERRADO'];

const haversineKm = (a, b) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
};

const roundCoord = (value, decimals = 4) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(decimals));
};

const getGeoCacheKey = (lat, lng) => {
  const rLat = roundCoord(lat, 4);
  const rLng = roundCoord(lng, 4);
  if (rLat == null || rLng == null) return null;
  return `${rLat},${rLng}`;
};

const parseGeoAddress = (payload) => {
  const address = payload?.address || {};
  const comuna =
    address.city_district ||
    address.suburb ||
    address.town ||
    address.city ||
    address.municipality ||
    '';

  return {
    direccion: String(payload?.display_name || '').trim(),
    comuna: String(comuna || '').trim(),
    region: String(address.state || address.region || '').trim(),
    pais: String(address.country || '').trim(),
  };
};

const reverseGeocode = async (lat, lng) => {
  const key = getGeoCacheKey(lat, lng);
  const now = Date.now();
  if (key && GEO_CACHE.has(key)) {
    const cached = GEO_CACHE.get(key);
    if (now - cached.savedAt < GEO_CACHE_TTL_MS) return cached.value;
    GEO_CACHE.delete(key);
  }

  const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
    params: {
      lat,
      lon: lng,
      format: 'jsonv2',
      addressdetails: 1,
      'accept-language': 'es',
      zoom: 18,
    },
    headers: {
      'User-Agent': 'GENAI360-ConectaGPS/1.0 (operaciones@synoptyk.com)',
    },
    timeout: 8000,
  });

  const parsed = parseGeoAddress(response?.data || {});
  if (key) GEO_CACHE.set(key, { savedAt: now, value: parsed });
  return parsed;
};

const forwardGeocode = async (query) => {
  const normalized = String(query || '').trim();
  if (!normalized) throw new Error('Dirección vacía.');

  const response = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: {
      q: normalized,
      format: 'jsonv2',
      addressdetails: 1,
      limit: 1,
      'accept-language': 'es',
      countrycodes: 'cl',
    },
    headers: {
      'User-Agent': 'GENAI360-RutasGuiadas/1.0 (operaciones@synoptyk.com)',
    },
    timeout: 9000,
  });

  const first = Array.isArray(response?.data) ? response.data[0] : null;
  if (!first?.lat || !first?.lon) throw new Error(`No se pudo geocodificar: ${normalized}`);
  return {
    lat: Number(first.lat),
    lng: Number(first.lon),
    ...parseGeoAddress(first),
  };
};

const toCoords = (point) => ({ lat: Number(point?.lat), lng: Number(point?.lng) });

const isFiniteCoord = (point) => Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng));

const parseStopInput = (stop, idx) => ({
  sequence: idx + 1,
  clienteNombre: String(stop?.clienteNombre || '').trim(),
  direccion: String(stop?.direccion || '').trim(),
  comuna: String(stop?.comuna || '').trim(),
  region: String(stop?.region || '').trim(),
  contactoNombre: String(stop?.contactoNombre || '').trim(),
  contactoTelefono: String(stop?.contactoTelefono || '').trim(),
  notas: String(stop?.notas || '').trim(),
  lat: Number(stop?.lat),
  lng: Number(stop?.lng),
});

const geocodeStop = async (stop, idx) => {
  const parsed = parseStopInput(stop, idx);
  if (!parsed.direccion) throw new Error(`La parada ${idx + 1} no tiene dirección.`);

  if (isFiniteCoord(parsed)) {
    let reverse = { direccion: parsed.direccion, comuna: parsed.comuna, region: parsed.region, pais: '' };
    try {
      reverse = await reverseGeocode(parsed.lat, parsed.lng);
    } catch (_) {}
    return {
      ...parsed,
      direccionNormalizada: reverse.direccion || parsed.direccion,
      comuna: parsed.comuna || reverse.comuna || '',
      region: parsed.region || reverse.region || '',
      pais: reverse.pais || '',
      status: 'PENDIENTE',
      etaMin: 0,
      distanceFromPreviousKm: 0,
    };
  }

  const query = [parsed.direccion, parsed.comuna, parsed.region].filter(Boolean).join(', ');
  const geo = await forwardGeocode(query);
  return {
    ...parsed,
    lat: geo.lat,
    lng: geo.lng,
    direccionNormalizada: geo.direccion || parsed.direccion,
    comuna: parsed.comuna || geo.comuna || '',
    region: parsed.region || geo.region || '',
    pais: geo.pais || '',
    status: 'PENDIENTE',
    etaMin: 0,
    distanceFromPreviousKm: 0,
  };
};

const resolveOrigin = async (conductor, payloadOrigin, firstStop) => {
  const originMode = String(payloadOrigin?.mode || 'DRIVER_CURRENT').toUpperCase() === 'MANUAL' ? 'MANUAL' : 'DRIVER_CURRENT';

  if (originMode === 'MANUAL') {
    const rawAddress = String(payloadOrigin?.direccion || payloadOrigin?.label || '').trim();
    if (isFiniteCoord(payloadOrigin)) {
      let reverse = { direccion: rawAddress, comuna: '', region: '' };
      try {
        reverse = await reverseGeocode(Number(payloadOrigin.lat), Number(payloadOrigin.lng));
      } catch (_) {}
      return {
        mode: 'MANUAL',
        label: String(payloadOrigin?.label || reverse.direccion || rawAddress || 'Origen manual').trim(),
        direccion: String(rawAddress || reverse.direccion || '').trim(),
        comuna: String(reverse.comuna || payloadOrigin?.comuna || '').trim(),
        region: String(reverse.region || payloadOrigin?.region || '').trim(),
        lat: Number(payloadOrigin.lat),
        lng: Number(payloadOrigin.lng),
      };
    }
    if (rawAddress) {
      const geo = await forwardGeocode([rawAddress, payloadOrigin?.comuna, payloadOrigin?.region].filter(Boolean).join(', '));
      return {
        mode: 'MANUAL',
        label: String(payloadOrigin?.label || geo.direccion || rawAddress).trim(),
        direccion: rawAddress,
        comuna: geo.comuna || '',
        region: geo.region || '',
        lat: geo.lat,
        lng: geo.lng,
      };
    }
  }

  if (isFiniteCoord(conductor?.ultimaPosicion)) {
    return {
      mode: 'DRIVER_CURRENT',
      label: String(conductor?.ultimaPosicion?.direccion || conductor?.nombre || 'Ubicación actual').trim(),
      direccion: String(conductor?.ultimaPosicion?.direccion || '').trim(),
      comuna: String(conductor?.ultimaPosicion?.comuna || '').trim(),
      region: String(conductor?.ultimaPosicion?.region || '').trim(),
      lat: Number(conductor.ultimaPosicion.lat),
      lng: Number(conductor.ultimaPosicion.lng),
    };
  }

  return {
    mode: 'DRIVER_CURRENT',
    label: 'Primera parada como origen',
    direccion: String(firstStop?.direccionNormalizada || firstStop?.direccion || '').trim(),
    comuna: String(firstStop?.comuna || '').trim(),
    region: String(firstStop?.region || '').trim(),
    lat: Number(firstStop?.lat),
    lng: Number(firstStop?.lng),
  };
};

const greedyOrderFromDurations = (origin, stops, durations) => {
  const orderedIndexes = [];
  const visited = new Set();
  let currentNode = 0;

  while (orderedIndexes.length < stops.length) {
    let nextNode = -1;
    let bestCost = Number.POSITIVE_INFINITY;

    for (let idx = 0; idx < stops.length; idx += 1) {
      if (visited.has(idx)) continue;
      const matrixNode = idx + 1;
      const cost = Number(durations?.[currentNode]?.[matrixNode]);
      const fallback = haversineKm(currentNode === 0 ? origin : stops[currentNode - 1], stops[idx]) * 60;
      const effectiveCost = Number.isFinite(cost) ? cost : fallback;
      if (effectiveCost < bestCost) {
        bestCost = effectiveCost;
        nextNode = idx;
      }
    }

    if (nextNode === -1) break;
    visited.add(nextNode);
    orderedIndexes.push(nextNode);
    currentNode = nextNode + 1;
  }

  return orderedIndexes;
};

const optimizeGuidedRoute = async (origin, stops) => {
  if (!stops.length) {
    return {
      orderedStops: [],
      totalDistanceKm: 0,
      totalDurationMin: 0,
      polyline: [],
    };
  }

  const nodes = [origin, ...stops];
  const coords = nodes.map((node) => `${node.lng},${node.lat}`).join(';');
  let durations = null;
  let route = null;

  try {
    const tableResponse = await axios.get(`https://router.project-osrm.org/table/v1/driving/${coords}`, {
      params: { annotations: 'duration,distance' },
      timeout: 10000,
    });
    durations = tableResponse?.data?.durations || null;
  } catch (_) {}

  const orderedIndexes = greedyOrderFromDurations(origin, stops, durations);
  const orderedStops = orderedIndexes.map((idx) => ({ ...stops[idx] }));
  const routeNodes = [origin, ...orderedStops];
  const routeCoords = routeNodes.map((node) => `${node.lng},${node.lat}`).join(';');

  try {
    if (routeNodes.length >= 2) {
      const routeResponse = await axios.get(`https://router.project-osrm.org/route/v1/driving/${routeCoords}`, {
        params: {
          overview: 'full',
          geometries: 'geojson',
          steps: false,
        },
        timeout: 12000,
      });
      route = routeResponse?.data?.routes?.[0] || null;
    }
  } catch (_) {}

  let elapsedMin = 0;
  orderedStops.forEach((stop, idx) => {
    const previousNode = idx === 0 ? origin : orderedStops[idx - 1];
    const legDistanceKm = route?.legs?.[idx]?.distance != null
      ? route.legs[idx].distance / 1000
      : haversineKm(previousNode, stop);
    const legDurationMin = route?.legs?.[idx]?.duration != null
      ? Math.round(route.legs[idx].duration / 60)
      : Math.max(2, Math.round((legDistanceKm / 35) * 60));

    elapsedMin += legDurationMin;
    stop.sequence = idx + 1;
    stop.etaMin = elapsedMin;
    stop.distanceFromPreviousKm = Number(legDistanceKm.toFixed(2));
    stop.status = idx === 0 ? 'PENDIENTE' : 'PENDIENTE';
  });

  const totalDistanceKm = route?.distance != null
    ? Number((route.distance / 1000).toFixed(2))
    : Number(orderedStops.reduce((acc, stop) => acc + Number(stop.distanceFromPreviousKm || 0), 0).toFixed(2));
  const totalDurationMin = route?.duration != null
    ? Math.round(route.duration / 60)
    : elapsedMin;
  const polyline = route?.geometry?.coordinates?.map((pair) => [pair[1], pair[0]]) || routeNodes.map((node) => [node.lat, node.lng]);

  return {
    orderedStops,
    totalDistanceKm,
    totalDurationMin,
    polyline,
  };
};

const enrichGuidedRoute = (routeDoc) => {
  const route = typeof routeDoc?.toObject === 'function' ? routeDoc.toObject() : routeDoc;
  const stops = Array.isArray(route?.stops) ? route.stops : [];
  const currentStopIndex = stops.findIndex((stop) => stop.status === 'EN_CURSO');
  const nextPendingIndex = stops.findIndex((stop) => stop.status === 'PENDIENTE');
  const effectiveIndex = currentStopIndex >= 0 ? currentStopIndex : nextPendingIndex;
  const completedStops = stops.filter((stop) => GUIDED_STOP_DONE_STATUSES.includes(stop.status)).length;
  const totalStops = stops.length;

  return {
    ...route,
    currentStopIndex: effectiveIndex >= 0 ? effectiveIndex : totalStops,
    currentStop: effectiveIndex >= 0 ? stops[effectiveIndex] : null,
    completedStops,
    totalStops,
    progressPct: totalStops ? Math.round((completedStops / totalStops) * 100) : 0,
  };
};

const buildRouteQuery = (req, extra = {}) => {
  const empresaRef = req.user.empresaRef || req.user.empresa;
  if (isHighLevel(req.user.role)) return { ...extra };
  return { empresaRef, ...extra };
};

const findPublicActiveRoute = async (conductorId) => {
  const active = await RutaGuiada.findOne({
    conductorRef: conductorId,
    estado: { $in: ['EN_CURSO', 'PLANIFICADA'] },
  })
    .populate('conductorRef', 'nombre patente ultimaPosicion gpsActivo')
    .sort({ estado: 1, createdAt: -1 });

  return active;
};

const advanceGuidedStop = async (route, stopId, nextStatus, completionNote = '') => {
  const stopIndex = route.stops.findIndex((stop) => String(stop._id) === String(stopId));
  if (stopIndex < 0) throw new Error('Parada no encontrada.');

  const stop = route.stops[stopIndex];
  if (GUIDED_STOP_DONE_STATUSES.includes(stop.status)) throw new Error('La parada ya fue cerrada.');
  if (!['ENTREGADO', 'CERRADO'].includes(nextStatus)) throw new Error('Estado de cierre inválido.');

  stop.status = nextStatus;
  stop.completedAt = new Date();
  stop.completionNote = String(completionNote || '').trim();

  const nextPending = route.stops.find((candidate) => candidate.status === 'PENDIENTE');
  if (nextPending) {
    nextPending.status = 'EN_CURSO';
    nextPending.startedAt = nextPending.startedAt || new Date();
    route.currentStopIndex = route.stops.findIndex((candidate) => String(candidate._id) === String(nextPending._id));
    route.estado = 'EN_CURSO';
  } else {
    route.currentStopIndex = route.stops.length;
    route.estado = 'COMPLETADA';
    route.completedAt = new Date();
  }

  await route.save();
  return route;
};

const shouldRefreshAddress = (prevPos, nextPos) => {
  if (!prevPos) return true;
  if (!prevPos.direccion && !prevPos.comuna) return true;
  const movedKm = haversineKm(prevPos, nextPos);
  if (movedKm >= 0.15) return true;
  const prevTs = prevPos.timestamp ? new Date(prevPos.timestamp).getTime() : 0;
  const elapsedMs = prevTs ? (Date.now() - prevTs) : Number.MAX_SAFE_INTEGER;
  return elapsedMs > 20 * 60 * 1000;
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
      direccion: p.direccion || '',
      comuna: p.comuna || '',
      region: p.region || '',
      timestamp: p.timestamp,
    })),
    startLocation: {
      direccion: start.direccion || '',
      comuna: start.comuna || '',
      region: start.region || '',
    },
    endLocation: {
      direccion: end.direccion || '',
      comuna: end.comuna || '',
      region: end.region || '',
    },
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

    const previousPosition = conductor.ultimaPosicion;
    let geoData = {
      direccion: previousPosition?.direccion || '',
      comuna: previousPosition?.comuna || '',
      region: previousPosition?.region || '',
      pais: previousPosition?.pais || '',
    };

    if (shouldRefreshAddress(previousPosition, { lat, lng })) {
      try {
        geoData = await reverseGeocode(lat, lng);
      } catch (_) {
        // Si falla el geocoder, mantenemos el dato previo sin interrumpir ingesta GPS.
      }
    }

    conductor.ultimaPosicion = {
      lat,
      lng,
      velocidad: Number.isFinite(velocidad) ? velocidad : 0,
      heading: Number.isFinite(heading) ? heading : null,
      direccion: geoData.direccion || '',
      comuna: geoData.comuna || '',
      region: geoData.region || '',
      pais: geoData.pais || '',
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

router.get('/rutas-guiadas', protect, async (req, res) => {
  try {
    const query = buildRouteQuery(req);
    if (req.query.conductorId) query.conductorRef = req.query.conductorId;
    if (req.query.estado && GUIDED_ROUTE_STATUSES.includes(String(req.query.estado).toUpperCase())) {
      query.estado = String(req.query.estado).toUpperCase();
    }

    const rows = await RutaGuiada.find(query)
      .populate('conductorRef', 'nombre patente ultimaPosicion gpsActivo')
      .sort({ updatedAt: -1 })
      .limit(80);

    res.json(rows.map(enrichGuidedRoute));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/rutas-guiadas', protect, async (req, res) => {
  try {
    const empresaRef = req.user.empresaRef || req.user.empresa;
    const conductor = await Conductor.findOne(buildRouteQuery(req, { _id: req.body?.conductorId }));
    if (!conductor) return res.status(404).json({ error: 'Conductor no encontrado.' });

    const rawStops = Array.isArray(req.body?.stops) ? req.body.stops.slice(0, MAX_GUIDED_STOPS) : [];
    if (rawStops.length === 0) return res.status(400).json({ error: 'Debes ingresar al menos una dirección.' });

    const geocodedStops = [];
    for (let idx = 0; idx < rawStops.length; idx += 1) {
      geocodedStops.push(await geocodeStop(rawStops[idx], idx));
    }

    const origin = await resolveOrigin(conductor, req.body?.origin, geocodedStops[0]);
    const optimized = await optimizeGuidedRoute(origin, geocodedStops);

    const route = await RutaGuiada.create({
      empresaRef,
      conductorRef: conductor._id,
      nombreRuta: String(req.body?.nombreRuta || `Ruta ${conductor.nombre}`).trim(),
      estado: 'PLANIFICADA',
      origen: origin,
      stops: optimized.orderedStops,
      totalDistanceKm: optimized.totalDistanceKm,
      totalDurationMin: optimized.totalDurationMin,
      polyline: optimized.polyline,
      currentStopIndex: 0,
      notas: String(req.body?.notas || '').trim(),
      createdBy: req.user.nombre || req.user.email || 'Sistema',
      optimizedAt: new Date(),
    });

    const populated = await RutaGuiada.findById(route._id).populate('conductorRef', 'nombre patente ultimaPosicion gpsActivo');
    res.status(201).json(enrichGuidedRoute(populated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/rutas-guiadas/:routeId', protect, async (req, res) => {
  try {
    const route = await RutaGuiada.findOne(buildRouteQuery(req, { _id: req.params.routeId }))
      .populate('conductorRef', 'nombre patente ultimaPosicion gpsActivo');
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada.' });
    res.json(enrichGuidedRoute(route));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/rutas-guiadas/:routeId/iniciar', protect, async (req, res) => {
  try {
    const route = await RutaGuiada.findOne(buildRouteQuery(req, { _id: req.params.routeId }))
      .populate('conductorRef', 'nombre patente ultimaPosicion gpsActivo');
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada.' });
    if (route.estado === 'CANCELADA') return res.status(400).json({ error: 'La ruta está cancelada.' });

    const currentIdx = route.stops.findIndex((stop) => stop.status === 'EN_CURSO');
    if (currentIdx < 0) {
      const nextIdx = route.stops.findIndex((stop) => stop.status === 'PENDIENTE');
      if (nextIdx >= 0) {
        route.stops[nextIdx].status = 'EN_CURSO';
        route.stops[nextIdx].startedAt = route.stops[nextIdx].startedAt || new Date();
        route.currentStopIndex = nextIdx;
      }
    }
    route.estado = 'EN_CURSO';
    route.startedAt = route.startedAt || new Date();
    await route.save();

    const fresh = await RutaGuiada.findById(route._id).populate('conductorRef', 'nombre patente ultimaPosicion gpsActivo');
    res.json(enrichGuidedRoute(fresh));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/rutas-guiadas/:routeId/stops/:stopId', protect, async (req, res) => {
  try {
    const route = await RutaGuiada.findOne(buildRouteQuery(req, { _id: req.params.routeId }))
      .populate('conductorRef', 'nombre patente ultimaPosicion gpsActivo');
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada.' });

    const updated = await advanceGuidedStop(route, req.params.stopId, String(req.body?.status || '').toUpperCase(), req.body?.completionNote);
    const fresh = await RutaGuiada.findById(updated._id).populate('conductorRef', 'nombre patente ultimaPosicion gpsActivo');
    res.json(enrichGuidedRoute(fresh));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/live/:token/ruta-actual', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    const conductor = await Conductor.findOne({ gpsToken: token }, { nombre: 1, patente: 1, gpsActivo: 1, ultimaPosicion: 1 });
    if (!conductor) return res.status(404).json({ error: 'Token no válido.' });

    const route = await findPublicActiveRoute(conductor._id);
    if (!route) return res.json({ conductor, route: null });

    res.json({ conductor, route: enrichGuidedRoute(route) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/live/:token/ruta-actual/iniciar', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    const conductor = await Conductor.findOne({ gpsToken: token }, { _id: 1, nombre: 1, patente: 1, gpsActivo: 1, ultimaPosicion: 1 });
    if (!conductor) return res.status(404).json({ error: 'Token no válido.' });

    const route = await findPublicActiveRoute(conductor._id);
    if (!route) return res.status(404).json({ error: 'No hay ruta activa asignada.' });
    if (route.estado !== 'PLANIFICADA' && route.estado !== 'EN_CURSO') {
      return res.status(400).json({ error: 'La ruta ya no puede iniciarse.' });
    }

    const currentIdx = route.stops.findIndex((stop) => stop.status === 'EN_CURSO');
    if (currentIdx < 0) {
      const nextIdx = route.stops.findIndex((stop) => stop.status === 'PENDIENTE');
      if (nextIdx >= 0) {
        route.stops[nextIdx].status = 'EN_CURSO';
        route.stops[nextIdx].startedAt = route.stops[nextIdx].startedAt || new Date();
        route.currentStopIndex = nextIdx;
      }
    }
    route.estado = 'EN_CURSO';
    route.startedAt = route.startedAt || new Date();
    await route.save();

    const fresh = await RutaGuiada.findById(route._id).populate('conductorRef', 'nombre patente ultimaPosicion gpsActivo');
    res.json({ ok: true, route: enrichGuidedRoute(fresh) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/live/:token/ruta-actual/stops/:stopId', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    const conductor = await Conductor.findOne({ gpsToken: token }, { _id: 1, nombre: 1, patente: 1, gpsActivo: 1, ultimaPosicion: 1 });
    if (!conductor) return res.status(404).json({ error: 'Token no válido.' });

    const route = await findPublicActiveRoute(conductor._id);
    if (!route) return res.status(404).json({ error: 'No hay ruta activa asignada.' });

    const updated = await advanceGuidedStop(route, req.params.stopId, String(req.body?.status || '').toUpperCase(), req.body?.completionNote);
    const fresh = await RutaGuiada.findById(updated._id).populate('conductorRef', 'nombre patente ultimaPosicion gpsActivo');
    res.json({ ok: true, route: enrichGuidedRoute(fresh) });
  } catch (err) {
    res.status(400).json({ error: err.message });
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
      points: points.map((p) => ({
        ...(typeof p.toObject === 'function' ? p.toObject() : p),
        direccion: p.direccion || '',
        comuna: p.comuna || '',
        region: p.region || '',
      })),
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

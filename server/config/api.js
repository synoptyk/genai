/**
 * API Configuration & Versioning
 * Centraliza configuración de API para mejor mantenimiento
 */

const API_VERSION = 'v1';
const API_PREFIX = `/api/${API_VERSION}`;

// Endpoints deprecados (para migración gradual)
const DEPRECATED_ENDPOINTS = [
  // Ejemplo: { path: '/api/old-endpoint', replacement: '/api/v1/new-endpoint', sunset: '2026-06-01' }
];

// Límites de payload
const PAYLOAD_LIMITS = {
  json: '50mb',
  urlencoded: '50mb',
  multipart: '100mb',
};

// Timeouts por tipo de operación
const TIMEOUTS = {
  default: 30000, // 30s
  upload: 120000, // 2min
  bot: 300000, // 5min
  report: 180000, // 3min
};

// Configuración de paginación
const PAGINATION = {
  defaultLimit: 20,
  maxLimit: 100,
  defaultPage: 1,
};

// Configuración de caché (si se implementa en el futuro)
const CACHE = {
  enabled: process.env.CACHE_ENABLED === 'true',
  ttl: parseInt(process.env.CACHE_TTL) || 300, // 5 minutos
};

module.exports = {
  API_VERSION,
  API_PREFIX,
  DEPRECATED_ENDPOINTS,
  PAYLOAD_LIMITS,
  TIMEOUTS,
  PAGINATION,
  CACHE,
};

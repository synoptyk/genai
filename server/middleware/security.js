/**
 * Security & Rate Limiting Configuration
 * 
 * NOTA IMPORTANTE (Cloud Run):
 * En Google Cloud Run todas las requests comparten la IP del load balancer interno.
 * Por eso el generalLimiter se configura con skip para:
 *   - Endpoints con JWT válido (usuario autenticado — el abuso real es muy improbable)
 *   - Endpoints de streaming SSE (/stream/)
 *   - Endpoints públicos de caché (/indicadores, /health, /ping)
 * Solo /api/auth/* tiene rate limit estricto (previene brute force de login).
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// =============================================================================
// HELPER: Inyectar headers CORS en cualquier respuesta de error de rate limit
// =============================================================================
const corsHandler = (req, res, message) => {
  const origin = req.headers.origin || req.headers.referer || '*';
  res.setHeader('Access-Control-Allow-Origin', origin.startsWith('http') ? origin.replace(/\/$/, '') : '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, x-company-override, x-tenant-id');
  res.setHeader('Vary', 'Origin');
  res.status(429).json({ error: 'Too many requests', message });
};

// =============================================================================
// RUTAS EXCLUIDAS DEL RATE LIMIT GENERAL
// Incluye: preflights (OPTIONS), endpoints públicos, SSE, y requests autenticados
// =============================================================================
const SKIP_RATE_LIMIT_PATHS = [
  '/api/indicadores',
  '/api/health',
  '/api/ping',
  '/api/ping-platform',
  '/api/bot/',
  '/api/admin/'
];

const skipGeneralLimiter = (req) => {
  // SIEMPRE excluir preflight OPTIONS de navegadores
  if (req.method === 'OPTIONS') return true;

  const path = req.path || req.originalUrl || '';

  // Siempre excluir SSE streams
  if (path.includes('/stream/') || path.includes('/events')) return true;

  // Excluir endpoints públicos y de gestión
  if (SKIP_RATE_LIMIT_PATHS.some(p => path.startsWith(p))) return true;

  // Excluir requests autenticados con JWT o headers de sesión
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) return true;

  // Excluir si viene con token en query
  if (req.query && req.query.token) return true;

  return false;
};

// =============================================================================
// RATE LIMITING CONFIGURATION
// =============================================================================

// General API limiter — permisivo para soportar SPAs y proxies de Cloud Run
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50000, // Alto para soportar múltiples usuarios concurrentes tras el Load Balancer
  skip: skipGeneralLimiter,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Rate limit (general) para IP ${req.ip} en ${req.path}`);
    corsHandler(req, res, 'Has excedido el límite de solicitudes. Inténtalo más tarde.');
  },
});

// Auth endpoints — protege login de ataques de fuerza bruta
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  skip: (req) => req.method === 'OPTIONS',
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    console.warn(`🔐 Auth rate limit para IP ${req.ip}`);
    corsHandler(req, res, 'Demasiados intentos de autenticación. Espera 15 minutos.');
  },
});

// Bot endpoints — para automatización TOA/GPS
const botLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 50000,
  skip: (req) => {
    if (req.method === 'OPTIONS') return true;
    const authHeader = req.headers.authorization || '';
    return authHeader.startsWith('Bearer ') || (req.query && req.query.token);
  },
  handler: (req, res) => {
    console.warn(`🤖 Bot rate limit para IP ${req.ip} en ${req.path}`);
    corsHandler(req, res, 'Too many bot requests. Please slow down.');
  },
});

// Upload endpoints
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 200,
  skip: (req) => req.method === 'OPTIONS',
  handler: (req, res) => {
    corsHandler(req, res, 'Has excedido el límite de uploads por hora.');
  },
});

// =============================================================================
// HELMET SECURITY HEADERS
// =============================================================================

const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://maps.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https://api.openclaw.ai"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "same-origin" },
});

// =============================================================================
// ERROR HANDLER FOR RATE LIMITING
// =============================================================================

const rateLimitErrorHandler = (err, req, res, next) => {
  if (err && err.status === 429) {
    console.warn(`⚠️ Rate limit error para IP: ${req.ip}`);
    return corsHandler(req, res, 'Too many requests. Please try again later.');
  }
  next(err);
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  generalLimiter,
  authLimiter,
  botLimiter,
  uploadLimiter,
  helmetConfig,
  rateLimitErrorHandler,
};

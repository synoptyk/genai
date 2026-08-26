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
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.status(429).json({ error: 'Too many requests', message });
};

// =============================================================================
// RUTAS EXCLUIDAS DEL RATE LIMIT GENERAL
// Incluye: endpoints públicos, SSE, y cualquier request con JWT (autenticado)
// =============================================================================
const SKIP_RATE_LIMIT_PATHS = [
  '/api/indicadores',
  '/api/health',
  '/api/ping',
  '/api/ping-platform',
];

const skipGeneralLimiter = (req) => {
  const path = req.path || '';

  // Siempre excluir SSE streams (son long-lived connections)
  if (path.includes('/stream/')) return true;

  // Excluir endpoints públicos de caché
  if (SKIP_RATE_LIMIT_PATHS.some(p => path.startsWith(p))) return true;

  // Excluir requests con JWT válido (usuario autenticado)
  // No verificamos el token aquí para evitar overhead — solo chequeamos su presencia
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) return true;

  // Excluir requests con token en query string (usado por SSE/EventSource)
  if (req.query && req.query.token) return true;

  return false;
};

// =============================================================================
// RATE LIMITING CONFIGURATION
// =============================================================================

// General API limiter — solo aplica a requests no autenticados y no excluidos
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'production' ? 500 : 5000, // Bajo — solo llegan requests no-auth aquí
  skip: skipGeneralLimiter,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Rate limit (general) para IP ${req.ip} en ${req.path}`);
    corsHandler(req, res, 'Has excedido el límite de solicitudes. Inténtalo más tarde.');
  },
});

// Auth endpoints — estricto para prevenir brute force de login/register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'production' ? 30 : 200,
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again after 15 minutes.',
  },
  skipSuccessfulRequests: true, // No cuenta logins exitosos
  handler: (req, res) => {
    console.warn(`🔐 Auth rate limit para IP ${req.ip}`);
    corsHandler(req, res, 'Demasiados intentos de autenticación. Espera 15 minutos.');
  },
});

// Bot endpoints — para automatización TOA/GPS
const botLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: process.env.NODE_ENV === 'production' ? 5000 : 20000,
  skip: (req) => {
    // Skip si tiene JWT (request autenticado)
    const authHeader = req.headers.authorization || '';
    return authHeader.startsWith('Bearer ');
  },
  handler: (req, res) => {
    console.warn(`🤖 Bot rate limit para IP ${req.ip} en ${req.path}`);
    corsHandler(req, res, 'Too many bot requests. Please slow down.');
  },
});

// Upload endpoints — límite bajo para archivos grandes
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 50, // 50 uploads por hora por IP
  message: {
    error: 'Upload limit exceeded',
    message: 'You have exceeded the upload limit for this hour.',
  },
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

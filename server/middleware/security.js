/**
 * Security & Rate Limiting Configuration
 * Agrega protección básica sin romper funcionalidad existente
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// =============================================================================
// RATE LIMITING CONFIGURATION
// =============================================================================

// General API limiter - previene abuso básico
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 1000 requests en dev, 100 en prod
  message: { 
    error: 'Too many requests', 
    message: 'You have exceeded the request limit. Please try again later.' 
  },
  standardHeaders: true, // Retorna info en headers `RateLimit-*`
  legacyHeaders: false, // Desactiva headers `X-RateLimit-*`
});

// Auth endpoints - más estricto para login/register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'production' ? 20 : 200, // 200 en dev, 20 en prod
  message: { 
    error: 'Too many authentication attempts', 
    message: 'Please try again after 15 minutes.' 
  },
  skipSuccessfulRequests: true, // No cuenta requests exitosos (200-299)
});

// Bot endpoints - límite más alto para automatización
const botLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: process.env.NODE_ENV === 'production' ? 50 : 500, // 500 en dev, 50 en prod
  message: { 
    error: 'Bot rate limit exceeded', 
    message: 'Too many bot requests. Please slow down.' 
  },
});

// Upload endpoints - límite bajo para archivos grandes
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // 10 uploads por hora
  message: { 
    error: 'Upload limit exceeded', 
    message: 'You have exceeded the upload limit for this hour.' 
  },
});

// =============================================================================
// HELMET SECURITY HEADERS
// =============================================================================

// Configuración de Helmet - seguridad de headers HTTP
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
  crossOriginEmbedderPolicy: false, // Necesario para algunas funcionalidades de React
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000, // 1 año
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
  if (err instanceof rateLimit.RateLimitError) {
    console.warn(`⚠️ Rate limit exceeded for IP: ${req.ip}`);
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(err.resetTime / 1000) || 900,
    });
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

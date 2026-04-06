/**
 * Global Error Handler Middleware
 * Manejo centralizado de errores con logging apropiado
 */

const logger = require('../utils/logger');

// Error handler asíncrono (wraps async functions)
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Error handler global
const errorHandler = (err, req, res, next) => {
  // Logging del error
  logger.api.error(req.method, req.originalUrl, err, req.user?.id);

  // Error de validación de Mongoose
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      error: 'Validation Error',
      details: errors,
    });
  }

  // Error de duplicado (MongoDB)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      error: 'Duplicate Value',
      message: `A record with this ${field} already exists`,
    });
  }

  // Error de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid Token',
      message: 'The provided authentication token is invalid',
    });
  }

  // Token expirado
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token Expired',
      message: 'Your session has expired. Please login again.',
    });
  }

  // Error de Cast (MongoDB ID inválido)
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID',
      message: `The provided ID is not valid: ${err.value}`,
    });
  }

  // Error de multer (upload)
  if (err.name === 'MulterError') {
    return res.status(400).json({
      error: 'Upload Error',
      message: err.message,
    });
  }

  // Error de Puppeteer (bots)
  if (err.message && err.message.includes('puppeteer')) {
    logger.bot.error('Puppeteer', err);
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'The automation service is temporarily unavailable',
    });
  }

  // Error por defecto (500)
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  // En desarrollo, mostrar stack trace
  const response = {
    error: err.name || 'Internal Error',
    message,
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

// 404 Handler (rutas no encontradas)
const notFoundHandler = (req, res, next) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.status(404).json({
    error: 'Not Found',
    message: `The requested resource '${req.originalUrl}' was not found`,
    path: req.originalUrl,
  });
};

module.exports = {
  asyncHandler,
  errorHandler,
  notFoundHandler,
};

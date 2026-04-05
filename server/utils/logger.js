/**
 * Winston Logger - Logging Estructurado
 * Reemplaza console.log para mejor monitoreo y debugging
 */

const winston = require('winston');
const path = require('path');

// Formateo personalizado para logs legibles
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
  })
);

// Colores para consola
const coloredFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.simple()
);

// Crear logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { 
    service: 'genai-backend',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Consola (con colores en dev)
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? customFormat : coloredFormat,
    }),
    
    // Archivo de errores (rotación diaria)
    new winston.transports.DailyRotateFile({
      filename: path.join(process.cwd(), 'logs', 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d', // Mantener 14 días
    }),
    
    // Archivo combinado (rotación diaria)
    new winston.transports.DailyRotateFile({
      filename: path.join(process.cwd(), 'logs', 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
});

// =============================================================================
// STREAM PARA MORGAN (HTTP LOGGING)
// =============================================================================

const stream = {
  write: (message) => {
    logger.info(message.trim(), { type: 'http' });
  },
};

// =============================================================================
// HELPERS PARA LOGGING ESPECÍFICO
// =============================================================================

// Logging de base de datos
logger.db = {
  query: (query, time) => {
    logger.debug('Database Query', { query, time_ms: time, type: 'db_query' });
  },
  error: (error, query) => {
    logger.error('Database Error', { error: error.message, query, type: 'db_error' });
  },
  connection: (status) => {
    logger.info(`MongoDB ${status}`, { type: 'db_connection' });
  },
};

// Logging de autenticación
logger.auth = {
  login: (userId, ip) => {
    logger.info(`User ${userId} logged in`, { userId, ip, type: 'auth_login' });
  },
  logout: (userId, ip) => {
    logger.info(`User ${userId} logged out`, { userId, ip, type: 'auth_logout' });
  },
  failed: (username, ip, reason) => {
    logger.warn(`Failed login attempt for ${username}`, { username, ip, reason, type: 'auth_failed' });
  },
  tokenRefresh: (userId) => {
    logger.debug(`Token refreshed for user ${userId}`, { userId, type: 'token_refresh' });
  },
};

// Logging de bots/automation
logger.bot = {
  start: (botName) => {
    logger.info(`Bot ${botName} started`, { botName, type: 'bot_start' });
  },
  complete: (botName, duration, records) => {
    logger.info(`Bot ${botName} completed`, { botName, duration_ms: duration, records, type: 'bot_complete' });
  },
  error: (botName, error) => {
    logger.error(`Bot ${botName} error`, { botName, error: error.message, type: 'bot_error' });
  },
  cron: (jobName) => {
    logger.info(`Cron job triggered: ${jobName}`, { jobName, type: 'cron_trigger' });
  },
};

// Logging de API
logger.api = {
  request: (method, url, ip, userId) => {
    logger.debug(`${method} ${url}`, { method, url, ip, userId, type: 'api_request' });
  },
  response: (method, url, status, duration) => {
    logger.debug(`${method} ${url} - ${status}`, { method, url, status, duration_ms: duration, type: 'api_response' });
  },
  error: (method, url, error, userId) => {
    logger.error(`${method} ${url} error`, { method, url, error: error.message, userId, type: 'api_error' });
  },
  rateLimit: (ip, endpoint) => {
    logger.warn(`Rate limit exceeded`, { ip, endpoint, type: 'rate_limit' });
  },
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = logger;
module.exports.stream = stream;

/**
 * Environment Variable Validator
 * Valida y normaliza variables de entorno de forma segura
 * Nunca expone secretos en logs o errores
 */

const path = require('path');

/**
 * Variables requeridas en producción
 */
const REQUIRED_VARS_PROD = [
  'MONGO_URI',
  'JWT_SECRET',
  'NODE_ENV'
];

/**
 * Variables recomendadas pero opcionales
 */
const OPTIONAL_VARS = [
  'GEMINI_API_KEY',
  'GROQ_API_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_EMAIL',
  'SMTP_PASSWORD',
  'GOOGLE_MAIL_CLIENT_ID',
  'GOOGLE_MAIL_CLIENT_SECRET',
  'TOA_URL',
  'TOA_USER_REAL',
  'TOA_PASS_REAL',
  'GPS_URL',
  'GPS_USER',
  'GPS_PASS'
];

/**
 * Valida que las variables requeridas estén definidas
 * @throws {Error} Si una variable requerida falta
 */
function validateRequired() {
  const isProduction = process.env.NODE_ENV === 'production';
  const requiredVars = isProduction ? REQUIRED_VARS_PROD : [];

  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    const errorMsg = `CRITICAL: Missing required environment variables: ${missing.join(', ')}`;
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }
}

/**
 * Valida que los secretos tengan longitud mínima
 */
function validateSecretStrength() {
  const secrets = {
    JWT_SECRET: process.env.JWT_SECRET,
    MONGO_URI: process.env.MONGO_URI,
  };

  if (secrets.JWT_SECRET && secrets.JWT_SECRET.length < 32) {
    console.warn('⚠️ WARNING: JWT_SECRET should be at least 32 characters long for production');
  }

  if (secrets.MONGO_URI && !secrets.MONGO_URI.includes('mongodb')) {
    throw new Error('Invalid MONGO_URI format');
  }
}

/**
 * Obtiene un valor de entorno con validación
 * @param {string} varName - Nombre de la variable
 * @param {*} defaultValue - Valor por defecto
 * @param {object} options - Opciones adicionales
 * @returns {*} Valor de la variable o default
 */
function getEnv(varName, defaultValue = undefined, options = {}) {
  const value = process.env[varName];

  // Si la variable no existe
  if (!value) {
    if (defaultValue === undefined && options.required) {
      throw new Error(`Required environment variable not found: ${varName}`);
    }
    return defaultValue;
  }

  // Validaciones opcionales
  if (options.type === 'number') {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) {
      throw new Error(`Invalid number for ${varName}: ${value}`);
    }
    return numValue;
  }

  if (options.type === 'boolean') {
    return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
  }

  if (options.type === 'url') {
    try {
      new URL(value);
      return value;
    } catch {
      throw new Error(`Invalid URL for ${varName}: ${value}`);
    }
  }

  return value;
}

/**
 * Obtiene un resumen de variables de entorno (sin exponer secretos)
 */
function getSafeEnvSummary() {
  const summary = {
    nodeEnv: process.env.NODE_ENV || 'development',
    mongoConfigured: !!process.env.MONGO_URI,
    jwtConfigured: !!process.env.JWT_SECRET,
    geminiEnabled: !!process.env.GEMINI_API_KEY,
    groqEnabled: !!process.env.GROQ_API_KEY,
    cloudinaryEnabled: !!process.env.CLOUDINARY_CLOUD_NAME,
    smtpConfigured: !!process.env.SMTP_HOST,
    googleMailConfigured: !!process.env.GOOGLE_MAIL_CLIENT_ID,
  };

  return summary;
}

/**
 * Valida y prepara el entorno al startup
 */
function initializeEnvironment() {
  try {
    console.log('🔐 Validating environment variables...');

    validateRequired();
    validateSecretStrength();

    const summary = getSafeEnvSummary();
    console.log('✅ Environment validation passed');
    console.log('📋 Active integrations:', summary);

    return true;
  } catch (error) {
    console.error('❌ Environment validation failed:', error.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    return false;
  }
}

/**
 * Sanitiza un valor para que no sea logeado accidentalmente
 */
function maskSecret(value) {
  if (!value || typeof value !== 'string') return '[redacted]';
  if (value.length <= 4) return '[redacted]';
  return value.substring(0, 2) + '[redacted]' + value.substring(value.length - 2);
}

module.exports = {
  getEnv,
  getSafeEnvSummary,
  initializeEnvironment,
  validateRequired,
  validateSecretStrength,
  maskSecret,
};

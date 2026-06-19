/**
 * Secrets Manager
 * Gestiona encriptación y desencriptación de datos sensibles
 * Utiliza algoritmo AES-256 con crypto nativo de Node.js
 */

const crypto = require('crypto');

/**
 * Clave de encriptación derivada de JWT_SECRET
 * En producción, esta clave debe ser rotada periódicamente
 */
function getEncryptionKey() {
  const jwtSecret = process.env.JWT_SECRET;
  
  if (!jwtSecret) {
    throw new Error('JWT_SECRET required for secrets encryption');
  }

  // Generar una clave de 32 bytes (256 bits) derivada del JWT_SECRET
  return crypto
    .createHash('sha256')
    .update(jwtSecret)
    .digest();
}

/**
 * Encripta un valor sensible
 * @param {string} text - Texto a encriptar
 * @returns {string} IV:encryptedData (en formato hex, separado por dos puntos)
 */
function encrypt(text) {
  try {
    if (!text) return null;

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16); // 16 bytes para AES

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Retorna: IV:encryptedData
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('❌ Encryption failed:', error.message);
    throw error;
  }
}

/**
 * Desencripta un valor previamente encriptado
 * @param {string} encryptedData - Dato encriptado en formato IV:encryptedData
 * @returns {string} Texto desencriptado
 */
function decrypt(encryptedData) {
  try {
    if (!encryptedData) return null;

    const key = getEncryptionKey();
    
    // Extraer IV y datos encriptados
    const [ivHex, encrypted] = encryptedData.split(':');
    
    if (!ivHex || !encrypted) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('❌ Decryption failed:', error.message);
    throw error;
  }
}

/**
 * Genera un token JWT con secreto
 * @param {object} payload - Datos a incluir en el token
 * @param {number} expiresIn - Segundos para expirar (default: 30 días)
 * @returns {string} Token JWT
 */
function generateJWT(payload, expiresIn = 30 * 24 * 60 * 60) {
  const jwt = require('jsonwebtoken');
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn,
    algorithm: 'HS256'
  });
}

/**
 * Verifica un token JWT
 * @param {string} token - Token a verificar
 * @returns {object} Payload descodificado
 * @throws {Error} Si el token es inválido o expiró
 */
function verifyJWT(token) {
  const jwt = require('jsonwebtoken');
  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ['HS256']
  });
}

/**
 * Genera un hash criptográfico para un valor
 * Útil para verificar integridad sin almacenar el valor original
 * @param {string} value - Valor a hashear
 * @returns {string} Hash SHA-256 en hex
 */
function hash(value) {
  return crypto
    .createHash('sha256')
    .update(String(value))
    .digest('hex');
}

/**
 * Verifica que un valor coincida con su hash
 * @param {string} value - Valor a verificar
 * @param {string} hashValue - Hash esperado
 * @returns {boolean} True si coinciden
 */
function verifyHash(value, hashValue) {
  return hash(value) === hashValue;
}

/**
 * Genera un token de sesión aleatorio
 * @returns {string} Token aleatorio seguro
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Valida un formato de email básico
 * @param {string} email - Email a validar
 * @returns {boolean} True si es válido
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email).toLowerCase());
}

/**
 * Sanitiza un string para prevenir inyecciones
 * @param {string} input - Input a sanitizar
 * @returns {string} String sanitizado
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;

  // Remover caracteres de control y limitar espacios
  return input
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .substring(0, 1000); // Límite de longitud
}

module.exports = {
  encrypt,
  decrypt,
  generateJWT,
  verifyJWT,
  hash,
  verifyHash,
  generateSessionToken,
  isValidEmail,
  sanitizeInput,
};

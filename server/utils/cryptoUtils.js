const crypto = require('crypto');

// Utilizamos el JWT_SECRET como llave base (o una variable dedicada)
const ENCRYPTION_KEY = process.env.JWT_SECRET || 'a-very-secure-fallback-key-32chr!'; // Must be 32 bytes for aes-256-cbc
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // Para AES, esto siempre es 16

/**
 * Obtiene una llave de 32 bytes garantizada.
 */
function getKey() {
    return crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
}

/**
 * Encripta un texto plano.
 * @param {string} text - El texto a encriptar.
 * @returns {string} El texto encriptado en formato hex (iv:content).
 */
function encryptText(text) {
    if (!text) return text;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (err) {
        console.error('Error encrypting text:', err);
        throw new Error('Error al cifrar el contenido de seguridad.');
    }
}

/**
 * Desencripta un texto previamente encriptado.
 * @param {string} text - El texto encriptado en formato hex (iv:content).
 * @returns {string} El texto desencriptado.
 */
function decryptText(text) {
    if (!text) return text;
    try {
        const textParts = text.split(':');
        if (textParts.length !== 2) return text; // Si no tiene el formato, asumimos que no está encriptado (fallback)
        
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
        
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (err) {
        console.error('Error decrypting text:', err);
        return null; // Retornamos nulo si falla la decodificación
    }
}

module.exports = {
    encryptText,
    decryptText
};

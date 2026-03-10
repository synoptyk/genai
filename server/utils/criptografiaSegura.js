const crypto = require('crypto');
require('dotenv').config();

// Obtenemos la llave criptográfica maestra desde las Variables de Entorno.
// Proveemos un Fallback estático seguro de 32 caracteres para que no se arruinen las bóvedas al reiniciar el servidor en desarrollo
const ENCRYPTION_KEY = process.env.SII_ENCRYPTION_KEY || '6f634b3f8db11c2a1b9b1836f6dc04e2';
const IV_LENGTH = 16; // AES block size is 16 bytes

/**
 * Encripta un texto en plano (Ej. Clave Tributaria, Password PFX) usando AES-256-CBC
 * @param {String} text - Texto plano a encriptar
 * @returns {String} - Hash en formato iv:texto_cifrado (Hex)
 */
function encriptarTexto(text) {
    if (!text) return null;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (error) {
        console.error("Error Criptográfico al encriptar texto:", error);
        throw new Error('No se pudo encriptar el valor para la base de datos segura.');
    }
}

/**
 * Desencripta un valor almacenado en la Base de Datos para ser inyectado al Robot Scraper (Puppeteer)
 * @param {String} text - Hash en formato iv:texto_cifrado (Hex)
 * @returns {String} - Texto original desencriptado
 */
function desencriptarTexto(text) {
    if (!text) return null;
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        // En lugar de arrojar un stack-trace enorme, arrojamos un error controlado
        throw new Error('La llave actual no puede desencriptar la bóveda. Posible cambio de entorno criptográfico.');
    }
}

module.exports = {
    encriptarTexto,
    desencriptarTexto
};

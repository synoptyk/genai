/**
 * Utilidades de RUT para el Servidor (CommonJS)
 */

/**
 * Formatea un RUT agregando puntos y guión (Ej: 12.345.678-9)
 * @param {string} value - El valor actual
 * @returns {string} - El RUT formateado
 */
const formatRUT = (value) => {
    if (!value) return '';

    // Solo mantener números y la letra K
    let cleanRut = value.replace(/[^0-9kK]/g, '').toUpperCase();

    if (cleanRut.length === 0) return '';

    if (cleanRut.indexOf('K') !== -1 && cleanRut.indexOf('K') !== cleanRut.length - 1) {
        cleanRut = cleanRut.replace(/K/g, ''); 
    }

    if (cleanRut.length <= 1) return cleanRut;

    const body = cleanRut.slice(0, -1);
    const dv = cleanRut.slice(-1);

    let formatBody = '';
    for (let i = body.length; i > 0; i -= 3) {
        let chunk = body.slice(Math.max(0, i - 3), i);
        formatBody = formatBody ? chunk + '.' + formatBody : chunk;
    }

    return `${formatBody}-${dv}`;
};

/**
 * Valida un RUT (Módulo 11)
 */
const validateRUT = (rut) => {
    if (!rut) return false;
    const cleanRut = rut.replace(/[^0-9kK]/g, '').toUpperCase();
    if (cleanRut.length < 7) return false;

    const body = cleanRut.slice(0, -1);
    const dv = cleanRut.slice(-1);

    let sum = 0;
    let multiplier = 2;

    for (let i = body.length - 1; i >= 0; i--) {
        sum += parseInt(body[i]) * multiplier;
        multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const mod11 = 11 - (sum % 11);
    let expectedDv = mod11 === 11 ? '0' : mod11 === 10 ? 'K' : mod11.toString();

    return expectedDv === dv;
};

module.exports = {
    formatRUT,
    validateRUT
};

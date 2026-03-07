// Utilidades para Formatear y Validar RUT Chileno

/**
 * Formatea un RUT agregando puntos y guión (Ej: 12.345.678-9)
 * @param {string} value - El valor actual del input
 * @returns {string} - El RUT formateado
 */
export const formatRut = (value) => {
    if (!value) return '';

    // Solo mantener números y la letra K (mayúscula o minúscula)
    let cleanRut = value.replace(/[^0-9kK]/g, '').toUpperCase();

    // Si no queda nada, retornar vacío
    if (cleanRut.length === 0) return '';

    // Si la K está en alguna parte que no sea el final, la podamos (solo debe haber una K al final)
    if (cleanRut.indexOf('K') !== -1 && cleanRut.indexOf('K') !== cleanRut.length - 1) {
        cleanRut = cleanRut.replace(/K/g, ''); // Quitamos todas las K intermedias
    }

    if (cleanRut.length <= 1) return cleanRut;

    // Separar cuerpo del dígito verificador
    const body = cleanRut.slice(0, -1);
    const dv = cleanRut.slice(-1);

    // Agregar puntos al cuerpo
    let formatBody = '';
    for (let i = body.length; i > 0; i -= 3) {
        let chunk = body.slice(Math.max(0, i - 3), i);
        if (formatBody) {
            formatBody = chunk + '.' + formatBody;
        } else {
            formatBody = chunk;
        }
    }

    return `${formatBody}-${dv}`;
};

/**
 * Valida un RUT utilizando el algoritmo de Módulo 11
 * @param {string} rut - El RUT formateado o sin formato
 * @returns {boolean} - true si es válido, false si es inválido
 */
export const validateRut = (rut) => {
    if (!rut) return false;

    // Limpiar string
    const cleanRut = rut.replace(/[^0-9kK]/g, '').toUpperCase();
    if (cleanRut.length < 7) return false;

    const body = cleanRut.slice(0, -1);
    const dv = cleanRut.slice(-1);

    // Calcular dígito verificador esperado
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

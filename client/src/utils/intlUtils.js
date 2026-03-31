/**
 * Internationalization Utilities for Platform
 * Defines rules for TaxIDs (RUT, DNI, NIT) and Phone Prefixes by Country.
 */

export const COUNTRIES = [
    { code: 'CL', name: 'Chile', prefix: '+56', flag: '🇨🇱', taxIdName: 'RUT', placeholder: '12.345.678-9' },
    { code: 'PE', name: 'Perú', prefix: '+51', flag: '🇵🇪', taxIdName: 'DNI/RUC', placeholder: '12345678' },
    { code: 'CO', name: 'Colombia', prefix: '+57', flag: '🇨🇴', taxIdName: 'NIT/CC', placeholder: '123456789-0' },
    { code: 'AR', name: 'Argentina', prefix: '+54', flag: '🇦🇷', taxIdName: 'CUIT/CUIL', placeholder: '20-12345678-9' },
    { code: 'MX', name: 'México', prefix: '+52', flag: '🇲🇽', taxIdName: 'RFC', placeholder: 'ABCD123456H78' },
    { code: 'ES', name: 'España', prefix: '+34', flag: '🇪🇸', taxIdName: 'NIF/NIE', placeholder: '12345678A' },
    { code: 'US', name: 'USA', prefix: '+1', flag: '🇺🇸', taxIdName: 'SSN/EIN', placeholder: '12-3456789' },
];

/**
 * Validates Tax ID based on country logic
 */
export const validateTaxId = (id, countryCode) => {
    if (!id) return false;
    const cleanId = id.replace(/[\.\-]/g, '').toUpperCase().trim();

    switch (countryCode) {
        case 'CL':
            return validateChileanRut(id);
        case 'PE':
            return /^\d{8,11}$/.test(cleanId);
        case 'CO':
            return /^\d{8,12}$/.test(cleanId);
        default:
            return cleanId.length >= 5;
    }
};

/**
 * Specific logic for Chilean RUT (Modulo 11)
 */
function validateChileanRut(rut) {
    if (!rut || rut.length < 8) return false;
    const cleanRut = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();
    if (cleanRut.length < 8) return false;

    const dv = cleanRut.slice(-1);
    const body = cleanRut.slice(0, -1);

    let sum = 0;
    let multiplier = 2;

    for (let i = body.length - 1; i >= 0; i--) {
        sum += parseInt(body[i]) * multiplier;
        multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const expectedDv = 11 - (sum % 11);
    const dvChar = expectedDv === 11 ? '0' : expectedDv === 10 ? 'K' : expectedDv.toString();

    return dv === dvChar;
}

/**
 * Formats a phone number given the prefix and number
 */
export const formatPhone = (prefix, number) => {
    if (!number) return '';
    const cleanNumber = number.replace(/\D/g, '');
    return `${prefix} ${cleanNumber}`;
};

const cleanRut = (value) => {
    if (!value) return '';
    return value.toString().replace(/[^0-9kK]/g, '').toUpperCase().trim();
};

const formatRut = (value) => {
    if (!value) return '';
    let clean = cleanRut(value);
    if (clean.length === 0) return '';
    if (clean.indexOf('K') !== -1 && clean.indexOf('K') !== clean.length - 1) {
        clean = clean.replace(/K/g, ''); 
    }
    if (clean.length <= 1) return clean;
    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);
    return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
};

module.exports = { formatRut, cleanRut, formatRUT: formatRut, cleanRUT: cleanRut };

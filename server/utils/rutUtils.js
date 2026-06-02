const formatRut = (value) => {
    if (!value) return '';

    let cleanRut = value.toString().replace(/[^0-9kK]/g, '').toUpperCase();
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
        if (formatBody) {
            formatBody = chunk + '.' + formatBody;
        } else {
            formatBody = chunk;
        }
    }

    return `${formatBody}-${dv}`;
};

module.exports = { formatRut };

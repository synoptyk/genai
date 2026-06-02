const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config(); // Uses .env in current directory (server/)

const Candidato = require('../platforms/rrhh/models/Candidato');
const PlatformUser = require('../platforms/auth/PlatformUser');

// formatRut function logic translated to Node
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

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log('MongoDB Connected. Starting RUT Normalization...');
    let candUpdated = 0;
    let usersUpdated = 0;

    try {
        const candidatos = await Candidato.find({ rut: { $exists: true, $ne: '' } });
        for (let c of candidatos) {
            const formatted = formatRut(c.rut);
            if (formatted !== c.rut) {
                c.rut = formatted;
                await c.save();
                candUpdated++;
            }
        }
        console.log(`Candidatos updated: ${candUpdated}`);

        const users = await PlatformUser.find({ rut: { $exists: true, $ne: '' } });
        for (let u of users) {
            const formatted = formatRut(u.rut);
            if (formatted !== u.rut) {
                u.rut = formatted;
                await u.save();
                usersUpdated++;
            }
        }
        console.log(`Users updated: ${usersUpdated}`);

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
        console.log('Done.');
    }
}).catch(err => {
    console.error('Error connecting to DB:', err);
});

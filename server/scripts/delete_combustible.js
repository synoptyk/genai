const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ConsumoCombustible = require('../platforms/agentetelecom/models/ConsumoCombustible');

async function clearCombustible() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const result = await ConsumoCombustible.deleteMany({});
        console.log(`Se eliminaron ${result.deletedCount} registros de combustible mal cargados.`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

clearCombustible();

require('dotenv').config();
const mongoose = require('mongoose');
const TarifaLPU = require('./platforms/agentetelecom/models/TarifaLPU');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Fix WiFi Tariffs
    await TarifaLPU.updateMany(
        { 'mapeo.condicion_extra': 'WiFi', 'mapeo.campo_cantidad': 'Decos_Adicionales' },
        { 
            $set: { 
                'mapeo.campo_cantidad': 'Decos_WiFi_Adicionales',
                'mapeo.condicion_extra': ''
            } 
        }
    );
    
    // Fix Generic (Cable) Tariffs
    await TarifaLPU.updateMany(
        { descripcion: 'Decodificador Adicional en Alta TV', 'mapeo.campo_cantidad': 'Decos_Adicionales' },
        { 
            $set: { 
                'mapeo.campo_cantidad': 'Decos_Cable_Adicionales'
            } 
        }
    );

    console.log("Tarifas actualizadas");
    process.exit(0);
}
run().catch(console.error);

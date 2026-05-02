
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../server/.env') });

const ActividadSchema = new mongoose.Schema({}, { strict: false, collection: 'actividads' });
const Actividad = mongoose.model('Actividad', ActividadSchema);

async function migrate() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) throw new Error('MONGODB_URI no found');
        
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const docs = await Actividad.find({});
        console.log(`Found ${docs.length} documents to process`);

        let updatedCount = 0;

        for (const doc of docs) {
            const raw = doc.toObject();
            const updates = {};
            const toUnset = {};

            // 1. RECURSO (ID del técnico)
            const recurso = raw.RECURSO || raw['ID Recurso'] || raw.ID_Recurso || raw.ID_RECURSO || raw.idRecurso || raw.pname || raw.Técnico || raw.Tecnico;
            if (recurso) {
                updates.RECURSO = recurso;
            }

            // 2. ESTADO
            const estado = raw.ESTADO || raw.Estado || raw.status || raw['Activity Status'];
            if (estado) {
                let normEstado = estado;
                const e = String(estado).toLowerCase().trim();
                if (e.includes('complet')) normEstado = 'Completado';
                else if (e.includes('pendien')) normEstado = 'Pendiente';
                else if (e.includes('cancel')) normEstado = 'Cancelado';
                else if (e.includes('iniciad')) normEstado = 'Iniciado';
                updates.ESTADO = normEstado;
            }

            // 3. ACTIVIDAD
            const actividad = raw.ACTIVIDAD || raw.Actividad;
            if (actividad) updates.ACTIVIDAD = actividad;

            // 4. SUBTIPO_DE_ACTIVIDAD
            const subtipo = raw.SUBTIPO_DE_ACTIVIDAD || raw['Subtipo de Actividad'] || raw.Subtipo_de_Actividad;
            if (subtipo) updates.SUBTIPO_DE_ACTIVIDAD = subtipo;

            // 5. OTROS CAMPOS CANÓNICOS
            if (raw.Nombre) updates.NOMBRE = raw.Nombre;
            if (raw['RUT del cliente']) updates.RUT_DEL_CLIENTE = raw['RUT del cliente'];
            if (raw.Ciudad) updates.CIUDAD = raw.Ciudad;
            if (raw['Ventana de servicio']) updates.VENTANA_DE_SERVICIO = raw['Ventana de servicio'];
            if (raw['Ventana de Llegada']) updates.VENTANA_DE_LLEGADA = raw['Ventana de Llegada'];
            if (raw['Número de Petición'] || raw['Numero de Petición']) updates.NÚMERO_DE_PETICIÓN = raw['Número de Petición'] || raw['Numero de Petición'];

            // 6. LIMPIEZA DE CAMPOS ANTIGUOS/REPETIDOS
            const fieldsToRemove = [
                'ID Recurso', 'ID_Recurso', 'ID_RECURSO', 'idRecurso', 'pname', 'Técnico', 'Tecnico',
                'Estado', 'status', 'Activity Status',
                'Actividad',
                'Subtipo de Actividad', 'Subtipo_de_Actividad',
                'Nombre',
                'RUT del cliente',
                'Ventana de servicio', 'service_window',
                'Ventana de Llegada', 'delivery_window',
                'Número de Petición', 'Numero de Petición', 'appt_number',
                'Numero orden', 'Número', 'Numero', 'Agencia', 'Comuna', 'Direccion', 'Intervalo de tiempo'
            ];

            fieldsToRemove.forEach(f => {
                if (raw[f] !== undefined) toUnset[f] = "";
            });

            if (Object.keys(updates).length > 0 || Object.keys(toUnset).length > 0) {
                const op = {};
                if (Object.keys(updates).length > 0) op.$set = updates;
                if (Object.keys(toUnset).length > 0) op.$unset = toUnset;
                
                await Actividad.updateOne({ _id: doc._id }, op);
                updatedCount++;
            }
        }

        console.log(`Migration complete. Updated ${updatedCount} documents.`);
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();

/**
 * 🚀 SCRIPT DE MIGRACIÓN: ESTANDARIZACIÓN Y AUTOGENERACIÓN DE SKUs
 * -------------------------------------------------------------
 * Este script lee la base de datos de MongoDB y actualiza todos los activos 
 * que tengan SKU vacío o incorrecto al nuevo formato secuencial 'PRD-XXXXX'
 * respetando el Multi-tenancy (se calcula la secuencia de forma independiente por Empresa).
 * 
 * Uso:
 *   $ node migrar_skus.js [--force-all]
 * 
 * Parámetros opcionales:
 *   --force-all : Si se especifica, reescribirá absolutamente TODOS los SKUs de la base de datos.
 *                 Si NO se especifica, solo actualizará los activos que no tengan SKU o tengan SKU vacío.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("❌ ERROR: No se encontró la variable MONGO_URI en el archivo .env del servidor.");
    process.exit(1);
}

// 1. Definición del Esquema Producto (Reducido para migración segura)
const ProductoSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    sku: { type: String, trim: true },
    empresaRef: { type: mongoose.Schema.Types.ObjectId, required: true },
    tipo: { type: String, default: 'Activo' }
}, { collection: 'productos' });

const Producto = mongoose.model('ProductoMigration', ProductoSchema);

async function run() {
    console.log("🔌 Conectando a MongoDB en Google Cloud...");
    try {
        await mongoose.connect(MONGO_URI);
        console.log("✅ Conexión establecida correctamente.");
    } catch (e) {
        console.error("❌ Error de conexión:", e.message);
        process.exit(1);
    }

    const forceAll = process.argv.includes('--force-all');
    console.log(`\n⚙️  Modo de Migración seleccionado: ${forceAll ? '🔥 REESCRITURA MASIVA (--force-all)' : '🛡️  COMPLETAR VACÍOS (Por Defecto)'}`);

    try {
        // Obtener todos los productos
        const productos = await Producto.find({});
        console.log(`📦 Encontrados en total: ${productos.length} productos/activos en catálogo.`);

        // Agrupar por empresaRef para calcular la secuencia correcta
        const productosPorEmpresa = {};
        for (const p of productos) {
            const empId = String(p.empresaRef);
            if (!productosPorEmpresa[empId]) {
                productosPorEmpresa[empId] = [];
            }
            productosPorEmpresa[empId].push(p);
        }

        const empresas = Object.keys(productosPorEmpresa);
        console.log(`🏢 Empresas activas identificadas: ${empresas.length}\n`);

        let totalActualizados = 0;

        for (const empId of empresas) {
            console.log(`-----------------------------------------------------`);
            console.log(`🏢 Procesando activos para Empresa ID: ${empId}`);
            
            const activosEmpresa = productosPorEmpresa[empId];
            
            // Ordenar por fecha de creación física para mantener coherencia en la secuencia (usamos _id)
            activosEmpresa.sort((a, b) => a._id.getTimestamp() - b._id.getTimestamp());

            let correlativo = 1;
            
            for (const p of activosEmpresa) {
                const tieneSkuValido = p.sku && p.sku.trim().length > 0;
                
                // Si ya tiene SKU válido y no estamos forzando reescritura, simplemente avanzamos el contador y mantenemos el actual
                if (tieneSkuValido && !forceAll) {
                    // Si el SKU sigue el formato PRD-XXXXX, podemos intentar extraer el correlativo para no chocar
                    const match = p.sku.match(/^PRD-(\d+)$/i);
                    if (match) {
                        const num = parseInt(match[1], 10);
                        if (num >= correlativo) {
                            correlativo = num + 1;
                        }
                    }
                    continue;
                }

                // Generar nuevo SKU secuencial
                const nuevoSku = `PRD-${correlativo.toString().padStart(5, '0')}`;
                console.log(`   ✨ Actualizando: "${p.nombre}" | SKU anterior: "${p.sku || 'N/A'}" ➡️  Nuevo SKU: "${nuevoSku}"`);
                
                p.sku = nuevoSku;
                await p.save();
                
                correlativo++;
                totalActualizados++;
            }
        }

        console.log(`-----------------------------------------------------`);
        console.log(`\n🎉 ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!`);
        console.log(`✅ Total de activos actualizados: ${totalActualizados}`);

    } catch (err) {
        console.error("❌ Error durante la migración:", err.message);
    } finally {
        await mongoose.disconnect();
        console.log("🔌 Desconectado de MongoDB.");
    }
}

run();

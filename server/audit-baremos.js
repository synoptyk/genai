#!/usr/bin/env node
'use strict';

/**
 * SCRIPT DE AUDITORÍA: Baremos TOA vs Cálculos
 *
 * Verifica que los cálculos de baremos en MongoDB sean correctos
 * Compara Pts_Total_Baremo guardado vs recalculado con el motor unificado
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Actividad = require('./platforms/agentetelecom/models/Actividad');
const TarifaLPU = require('./platforms/agentetelecom/models/TarifaLPU');
const { calcularBaremos } = require('./platforms/agentetelecom/utils/calculoEngine');

const MONGO_URI = process.env.MONGO_URI;

async function auditarBaremos() {
    try {
        console.log('🔍 AUDITORÍA DE BAREMOS TOA\n');

        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Conectado a MongoDB\n');

        const empresaRef = null; // TODO: agregar parámetro si es multi-empresa

        // Obtener tarifas
        const tarifas = await TarifaLPU.find({ activo: true }).lean();
        console.log(`📋 Tarifas cargadas: ${tarifas.length}\n`);

        if (tarifas.length === 0) {
            console.warn('⚠️ No hay tarifas cargadas. Abortando auditoría.');
            await mongoose.disconnect();
            process.exit(1);
        }

        // Auditar actividades
        const cursor = Actividad.find({}, null, { batchSize: 500 }).lean().cursor();

        let totalDocs = 0;
        let desviaciones = [];
        let reparacionesSinDecos = 0;
        let instalacionesConDecos = 0;
        let baremosCorrectos = 0;
        let baremosIncorrectos = 0;

        console.log('📊 Auditando actividades...\n');

        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
            totalDocs++;

            if (totalDocs % 100 === 0) {
                process.stdout.write(`  [${totalDocs}] `);
            }
            if (totalDocs % 1000 === 0) {
                console.log('');
            }

            // Recalcular
            const recalculado = calcularBaremos(doc, tarifas);
            if (!recalculado) continue;

            const guardado = parseFloat(doc.Pts_Total_Baremo || 0);
            const calculado = parseFloat(recalculado.Pts_Total_Baremo || 0);

            // Determinar si es reparación
            const esReparacion = recalculado.categoria &&
                                recalculado.categoria.toUpperCase().includes('REPARACIÓN|AVERÍA|RESOLUCIÓN');

            // Determinar si tiene decos
            const tieneDecos = (parseFloat(recalculado.Pts_Deco_WiFi || 0) > 0) ||
                              (parseFloat(recalculado.Pts_Repetidor_WiFi || 0) > 0);

            // Validaciones
            if (esReparacion && tieneDecos) {
                desviaciones.push({
                    ordenId: doc.ordenId,
                    tipo: 'REPARACIÓN CON DECOS',
                    guardado,
                    calculado,
                    tipoTrabajo: doc.Tipo_Trabajo,
                    subtipo: doc.Subtipo_de_Actividad
                });
                baremosIncorrectos++;
            } else if (guardado !== calculado) {
                desviaciones.push({
                    ordenId: doc.ordenId,
                    tipo: 'DESVIACIÓN DE PUNTOS',
                    guardado,
                    calculado,
                    diferencia: calculado - guardado,
                    tipoTrabajo: doc.Tipo_Trabajo,
                    subtipo: doc.Subtipo_de_Actividad
                });
                baremosIncorrectos++;
            } else {
                baremosCorrectos++;
            }

            // Estadísticas
            if (esReparacion && !tieneDecos) reparacionesSinDecos++;
            if (!esReparacion && tieneDecos) instalacionesConDecos++;
        }

        console.log('\n\n✅ AUDITORÍA COMPLETADA\n');
        console.log('═'.repeat(70));
        console.log('📈 RESULTADOS:');
        console.log('═'.repeat(70));
        console.log(`  Total documentos auditados: ${totalDocs}`);
        console.log(`  ✅ Baremos correctos: ${baremosCorrectos} (${((baremosCorrectos/totalDocs)*100).toFixed(1)}%)`);
        console.log(`  ❌ Baremos incorrectos: ${baremosIncorrectos} (${((baremosIncorrectos/totalDocs)*100).toFixed(1)}%)`);
        console.log('');
        console.log('📋 VALIDACIONES:');
        console.log(`  ✅ Reparaciones sin decos: ${reparacionesSinDecos}`);
        console.log(`  ✅ Instalaciones con decos: ${instalacionesConDecos}`);

        if (desviaciones.length > 0) {
            console.log('\n⚠️ DESVIACIONES ENCONTRADAS:');
            console.log('═'.repeat(70));

            const tipos = {};
            for (const d of desviaciones) {
                tipos[d.tipo] = (tipos[d.tipo] || 0) + 1;
            }

            for (const [tipo, count] of Object.entries(tipos)) {
                console.log(`\n  ${tipo}: ${count}`);
                const ejemplos = desviaciones.filter(d => d.tipo === tipo).slice(0, 3);
                for (const ex of ejemplos) {
                    if (ex.diferencia !== undefined) {
                        console.log(`    - ${ex.ordenId}: guardado=${ex.guardado}, calculado=${ex.calculado}, diff=${ex.diferencia.toFixed(2)}`);
                    } else {
                        console.log(`    - ${ex.ordenId}: ${ex.tipoTrabajo} / ${ex.subtipo}`);
                    }
                }
            }
        }

        console.log('\n');

        if (baremosIncorrectos === 0) {
            console.log('🎉 AUDITORÍA EXITOSA - Todos los baremos son correctos');
        } else {
            console.log(`⚠️ REQUIERE CORRECCIÓN - ${baremosIncorrectos} baremos incorrectos detectados`);
            console.log('\n💡 Próximos pasos:');
            console.log('   1. Ejecutar descargas nuevas de TOA para recalcular');
            console.log('   2. Bot recalculará automáticamente (flag baremo_calculado_v2)');
            console.log('   3. Re-ejecutar esta auditoría para verificar correcciones');
        }

        console.log('\n');

    } catch (error) {
        console.error('❌ ERROR en auditoría:', error.message);
        process.exit(1);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('🔒 Desconectado de MongoDB');
        }
        process.exit(0);
    }
}

auditarBaremos();

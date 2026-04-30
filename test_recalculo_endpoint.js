#!/usr/bin/env node

/**
 * Script de prueba para verificar que el endpoint /api/recalcular-actividades-mongodb
 * funciona correctamente con los datos de Ram Ingeniería
 */

const http = require('http');

// Simular un POST al endpoint
function testEndpoint() {
    console.log('🧪 Prueba de endpoint /api/recalcular-actividades-mongodb');
    console.log('=========================================================\n');

    const data = JSON.stringify({
        fechaInicio: '2026-03-01',
        fechaFin: '2026-04-30'
    });

    const options = {
        hostname: 'localhost',
        port: 5003,
        path: '/api/recalcular-actividades-mongodb',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
            'Authorization': 'Bearer TEST_TOKEN' // Necesitará token real
        }
    };

    console.log(`📍 Endpoint: http://${options.hostname}:${options.port}${options.path}`);
    console.log(`📅 Rango: 2026-03-01 a 2026-04-30`);
    console.log(`\n⏳ Esperando respuesta...\n`);

    const req = http.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
            responseData += chunk;
        });

        res.on('end', () => {
            console.log(`✅ Status: ${res.statusCode}`);
            console.log('📦 Respuesta:\n');
            try {
                const parsed = JSON.parse(responseData);
                console.log(JSON.stringify(parsed, null, 2));
                
                if (parsed.success && parsed.stats) {
                    console.log('\n✨ Estadísticas principales:');
                    console.log(`   • Recalculadas: ${parsed.stats.recalculadas}`);
                    console.log(`   • Con puntos: ${parsed.stats.totalConPuntos}/${parsed.stats.totalActividades}`);
                    console.log(`   • Cobertura: ${parsed.stats.porcentajeCobertura}%`);
                    console.log(`   • 💰 PUNTOS TOTALES: ${parsed.stats.totalPuntos}`);
                }
            } catch (e) {
                console.log(responseData);
            }
        });
    });

    req.on('error', (e) => {
        console.error(`❌ Error: ${e.message}`);
        console.error('\n⚠️  Asegúrate que:');
        console.error('   1. El servidor está corriendo en puerto 5003');
        console.error('   2. Tienes un token de autenticación válido');
        console.error('   3. MongoDB está accesible');
    });

    req.write(data);
    req.end();
}

// Ejecutar
testEndpoint();

#!/usr/bin/env node
'use strict';

// Test script para probar el bot de TOA
const path = require('path');
const fs = require('fs');

// Cargar variables de entorno
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match && !process.env[match[1]]) {
            process.env[match[1]] = match[2];
        }
    });
}

// Conectar a MongoDB
const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI;

async function runTest() {
    try {
        console.log('\n🚀 INICIANDO PRUEBA DEL BOT TOA\n');
        console.log('📝 Configuración:');
        console.log('  MONGO_URI:', MONGO_URI ? '✅ Configurado' : '❌ NO configurado');
        console.log('  TOA_URL:', process.env.TOA_URL || 'Por defecto');
        console.log('  BOT_TOA_USER:', process.env.BOT_TOA_USER ? '✅' : process.env.TOA_USER_REAL ? '✅ (TOA_USER_REAL)' : '❌');
        console.log('  BOT_TOA_PASS:', process.env.BOT_TOA_PASS ? '✅' : process.env.TOA_PASS_REAL ? '✅ (TOA_PASS_REAL)' : '❌');

        // Usar credenciales reales si están disponibles
        if (!process.env.BOT_TOA_USER && process.env.TOA_USER_REAL) {
            process.env.BOT_TOA_USER = process.env.TOA_USER_REAL;
        }
        if (!process.env.BOT_TOA_PASS && process.env.TOA_PASS_REAL) {
            process.env.BOT_TOA_PASS = process.env.TOA_PASS_REAL;
        }

        // Conectar MongoDB
        console.log('\n📊 Conectando a MongoDB...');
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            connectTimeoutMS: 10000,
            serverSelectionTimeoutMS: 10000
        });
        console.log('✅ Conectado a MongoDB');

        // Importar y ejecutar bot
        const { iniciarExtraccion } = require('./platforms/agentetelecom/bot/agente_real');

        // Usar fecha de hoy o ayer
        const hoy = new Date();
        const ayer = new Date(hoy);
        ayer.setDate(ayer.getDate() - 1);

        const fechaTest = ayer.toISOString().split('T')[0];
        console.log(`\n🧪 Ejecutando bot para fecha: ${fechaTest}\n`);
        console.log('═'.repeat(70));

        // Ejecutar bot (modo único día)
        await iniciarExtraccion(fechaTest);

        console.log('═'.repeat(70));
        console.log('\n✅ PRUEBA COMPLETADA');

    } catch (error) {
        console.error('\n❌ ERROR EN PRUEBA:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('🔒 Desconectado de MongoDB');
        }
        process.exit(0);
    }
}

runTest();

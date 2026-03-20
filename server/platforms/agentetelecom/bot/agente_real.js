'use strict';

// =============================================================================
// TOA AGENTE v7 — SIN CHROME, SIN PUPPETEER
//
// Login via HTTP puro (axios) → no consume RAM → funciona en Render free tier
//
// Flujo:
//   1. GET login page → extraer campos ocultos
//   2. POST credenciales → recoger cookies de sesión
//   3. GET dashboard → extraer CSRF token del HTML
//   4. Enviar grupos conocidos al frontend → esperar selección del usuario
//   5. Para cada fecha × grupo: POST al Grid API con cookies + CSRF
//   6. Guardar en MongoDB con upsert
// =============================================================================

const axios    = require('axios');
const https    = require('https');
const mongoose = require('mongoose');
const path     = require('path');
const Actividad = require('../models/Actividad');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const TOA_URL  = process.env.TOA_URL || 'https://telefonica-cl.etadirect.com/';
const TOA_HOST = new URL(TOA_URL).hostname;

// Grupos conocidos de TOA (fallback si el scan no detecta más)
const GRUPOS_CONOCIDOS = [
    { id: '3840', nombre: 'COMFICA',        visible: true },
    { id: '3841', nombre: 'ZENER RM',       visible: true },
    { id: '3842', nombre: 'ZENER RANCAGUA', visible: true }
];

// =============================================================================
// PUNTO DE ENTRADA
// =============================================================================
const iniciarExtraccion = async (fechaInicio = null, fechaFin = null, credenciales = {}) => {
    process.env.BOT_ACTIVE_LOCK = 'TOA';

    const fechasAProcesar = [];
    if (fechaInicio && fechaFin) {
        let c = new Date(fechaInicio + 'T00:00:00Z');
        const fin = new Date(fechaFin + 'T00:00:00Z');
        while (c <= fin) { fechasAProcesar.push(c.toISOString().split('T')[0]); c.setUTCDate(c.getUTCDate() + 1); }
    } else if (fechaInicio) {
        fechasAProcesar.push(fechaInicio);
    } else {
        let c = new Date(Date.UTC(2026, 0, 1));
        const fin = new Date(); fin.setUTCHours(0, 0, 0, 0);
        while (c <= fin) { fechasAProcesar.push(c.toISOString().split('T')[0]); c.setUTCDate(c.getUTCDate() + 1); }
    }

    const modo       = fechaInicio && fechaFin ? 'RANGO' : fechaInicio ? 'DÍA ÚNICO' : 'BACKFILL';
    const empresaRef = process.env.BOT_EMPRESA_REF || null;

    const reportar = (msg, extra = {}) => {
        console.log('BOT', msg);
        if (process.send) process.send({ type: 'log', text: msg, ...extra });
        else if (global.BOT_STATUS) {
            global.BOT_STATUS.logs = global.BOT_STATUS.logs || [];
            global.BOT_STATUS.logs.push(`[${new Date().toLocaleTimeString('es-CL')}] ${msg}`);
            if (global.BOT_STATUS.logs.length > 100) global.BOT_STATUS.logs.shift();
        }
    };

    reportar(`🚀 [${modo}] ${fechasAProcesar[0]} → ${fechasAProcesar[fechasAProcesar.length - 1]} (${fechasAProcesar.length} días)`);

    try {
        // ── FASE 1: Login HTTP (sin Chrome) ───────────────────────────────────
        const { sessionCookies, csrfToken, gridUrl } = await loginHTTP(
            credenciales.usuario || process.env.BOT_TOA_USER || '',
            credenciales.clave   || process.env.BOT_TOA_PASS  || '',
            reportar
        );

        reportar(`✅ Login OK. Cookies: ${sessionCookies.split(';').length} | CSRF: ${csrfToken ? 'OK' : 'no encontrado'}`);

        // ── FASE 2: Detectar grupos disponibles ───────────────────────────────
        // Usar los grupos conocidos + cualquier grupo adicional del dashboard
        const gruposDetectados = [...GRUPOS_CONOCIDOS];

        // Enviar lista al frontend y esperar selección
        if (process.send) {
            process.send({ type: 'grupos_encontrados', grupos: gruposDetectados });
        } else if (global.BOT_STATUS) {
            global.BOT_STATUS.gruposEncontrados  = gruposDetectados;
            global.BOT_STATUS.esperandoSeleccion = true;
        }

        reportar(`📋 ${gruposDetectados.length} grupos disponibles. Esperando selección...`);

        const gruposSeleccionados = await esperarConfirmacion(120000, reportar);
        reportar(`✅ ${gruposSeleccionados.length} grupo(s) confirmado(s) por el usuario`);

        if (gruposSeleccionados.length === 0) {
            throw new Error('No se seleccionó ningún grupo para descargar');
        }

        // ── FASE 3: Extracción ────────────────────────────────────────────────
        reportar(`\n📡 EXTRAYENDO: ${fechasAProcesar.length} días × ${gruposSeleccionados.length} grupos`);
        let totalGuardados = 0;
        let gridUrlFinal = gridUrl || (TOA_URL + '?m=Grid&a=get&itype=manage&output=ajax');

        for (let i = 0; i < fechasAProcesar.length; i++) {
            const fecha = fechasAProcesar[i];

            if (process.send) {
                process.send({ type: 'progress', diaActual: i + 1, totalDias: fechasAProcesar.length, fechaProcesando: fecha });
            } else if (global.BOT_STATUS) {
                global.BOT_STATUS.diaActual       = i + 1;
                global.BOT_STATUS.fechaProcesando = fecha;
            }

            if (i % 5 === 0 || i === fechasAProcesar.length - 1) {
                reportar(`📅 [${i + 1}/${fechasAProcesar.length}] ${fecha}`);
            }

            for (const grupo of gruposSeleccionados) {
                if (!grupo.id) { reportar(`  ⚠️ ${grupo.nombre}: sin ID de bucket, omitiendo`); continue; }
                try {
                    const [yyyy, mm, dd] = fecha.split('-');
                    const fechaFmt = `${mm}/${dd}/${yyyy}`; // MM/DD/YYYY
                    const postBody = `date=${encodeURIComponent(fechaFmt)}&gid=${grupo.id}`;

                    const resultado = await gridAPICall(gridUrlFinal, postBody, sessionCookies, csrfToken);

                    if (resultado.error) {
                        reportar(`  ⚠️ ${grupo.nombre} ${fecha}: ${resultado.error}`);
                        // Si la sesión expiró, intentar re-login
                        if (resultado.error.includes('401') || resultado.error.includes('403')) {
                            reportar('  🔄 Sesión expirada — re-logueando...');
                            try {
                                const relog = await loginHTTP(
                                    credenciales.usuario || process.env.BOT_TOA_USER || '',
                                    credenciales.clave   || process.env.BOT_TOA_PASS  || '',
                                    reportar
                                );
                                Object.assign({ sessionCookies, csrfToken }, relog);
                                reportar('  ✅ Re-login OK');
                            } catch (e) { reportar(`  ❌ Re-login fallido: ${e.message}`); }
                        }
                        continue;
                    }

                    const rows = resultado.activitiesRows || [];
                    if (rows.length > 0) {
                        const guardados = await guardarActividades(rows, grupo.nombre, fecha, parseInt(grupo.id), empresaRef);
                        totalGuardados += guardados;
                        reportar(`  💾 ${grupo.nombre}: ${rows.length} actividades → ${guardados} guardadas`);
                    }

                    await new Promise(r => setTimeout(r, 400));
                } catch (err) {
                    reportar(`  ❌ ${grupo.nombre}: ${err.message}`);
                }
            }
        }

        reportar(`\n🏁 COMPLETADO. Total: ${totalGuardados} registros guardados.`);
        if (process.send)      process.send({ type: 'log', text: '🏁 COMPLETADO', completed: true });
        if (global.BOT_STATUS) { global.BOT_STATUS.running = false; global.BOT_STATUS.esperandoSeleccion = false; }

    } catch (error) {
        const msg = error.message || 'Error desconocido';
        reportar(`❌ ERROR FATAL: ${msg}`);
        console.error('ERROR FATAL:', error);
        if (global.BOT_STATUS) { global.BOT_STATUS.ultimoError = msg; global.BOT_STATUS.running = false; global.BOT_STATUS.esperandoSeleccion = false; }
    } finally {
        process.env.BOT_ACTIVE_LOCK = 'OFF';
    }
};

// =============================================================================
// LOGIN HTTP — Sin Chrome, sin RAM
// =============================================================================
async function loginHTTP(usuario, clave, reportar) {
    if (!usuario) throw new Error('LOGIN_FAILED: usuario TOA no configurado');
    if (!clave)   throw new Error('LOGIN_FAILED: contraseña TOA no configurada');

    reportar(`🔐 Login HTTP: usuario="${usuario}" (${clave.length} chars clave)`);

    const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: false });
    const cookieJar  = new Map();

    const baseHeaders = {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection':      'keep-alive'
    };

    const parseCookies = (setCookieHeaders) => {
        if (!setCookieHeaders) return;
        const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
        arr.forEach(cookie => {
            const [kv] = cookie.split(';');
            const idx  = kv.indexOf('=');
            if (idx > 0) cookieJar.set(kv.substring(0, idx).trim(), kv.substring(idx + 1).trim());
        });
    };

    const getCookies = () => Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

    // ── PASO 1: GET login page ────────────────────────────────────────────────
    reportar('   [1/3] GET login page...');
    const loginPageRes = await axios.get(TOA_URL, {
        httpsAgent,
        maxRedirects: 15,
        validateStatus: () => true,
        headers: baseHeaders,
        timeout: 30000
    });
    parseCookies(loginPageRes.headers['set-cookie']);
    reportar(`   Login page status: ${loginPageRes.status}, cookies: ${cookieJar.size}`);

    const html = typeof loginPageRes.data === 'string' ? loginPageRes.data : '';

    // Extraer campos ocultos del formulario
    const hiddenFields = {};
    const hiddenRe = /<input[^>]+type=["']?hidden["']?[^>]*>/gi;
    let m;
    while ((m = hiddenRe.exec(html)) !== null) {
        const nameM  = m[0].match(/name=["']([^"']+)["']/);
        const valueM = m[0].match(/value=["']([^"']*)['"]/);
        if (nameM) hiddenFields[nameM[1]] = valueM ? valueM[1] : '';
    }

    // Detectar URL de acción del formulario
    const formActionM = html.match(/<form[^>]+action=["']([^"'?]+)[^"']*["']/i);
    const formAction  = formActionM
        ? (formActionM[1].startsWith('http') ? formActionM[1] : `https://${TOA_HOST}${formActionM[1]}`)
        : TOA_URL;

    reportar(`   Form action: ${formAction} | Hidden fields: ${Object.keys(hiddenFields).join(',') || 'ninguno'}`);

    // ── PASO 2: POST credenciales ─────────────────────────────────────────────
    reportar('   [2/3] POST credenciales...');
    const formBody = new URLSearchParams({ ...hiddenFields, username: usuario, password: clave });

    const loginRes = await axios.post(formAction, formBody.toString(), {
        httpsAgent,
        maxRedirects: 15,
        validateStatus: () => true,
        headers: {
            ...baseHeaders,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie':        getCookies(),
            'Origin':        `https://${TOA_HOST}`,
            'Referer':       TOA_URL
        },
        timeout: 30000
    });
    parseCookies(loginRes.headers['set-cookie']);
    reportar(`   POST status: ${loginRes.status}, cookies: ${cookieJar.size}`);

    const loginHtml = typeof loginRes.data === 'string' ? loginRes.data : '';
    if (loginHtml.includes('incorrectos') || loginHtml.includes('incorrecto') || loginHtml.includes('Invalid credential')) {
        throw new Error('LOGIN_FAILED: Usuario o contraseña incorrectos');
    }
    if (loginRes.status >= 400) {
        throw new Error(`LOGIN_FAILED: HTTP ${loginRes.status}`);
    }

    // ── PASO 3: GET dashboard → extraer CSRF ─────────────────────────────────
    reportar('   [3/3] GET dashboard → extraer CSRF...');
    const dashRes = await axios.get(TOA_URL, {
        httpsAgent,
        maxRedirects: 15,
        validateStatus: () => true,
        headers: { ...baseHeaders, 'Cookie': getCookies(), 'Referer': TOA_URL },
        timeout: 30000
    });
    parseCookies(dashRes.headers['set-cookie']);

    const dashHtml = typeof dashRes.data === 'string' ? dashRes.data : '';
    reportar(`   Dashboard status: ${dashRes.status}, size: ${dashHtml.length} chars, cookies: ${cookieJar.size}`);

    // Detectar si el login fue exitoso (dashboard cargado vs login page devuelta)
    const esLoginPage = dashHtml.includes('<input') && dashHtml.includes('password') && dashHtml.length < 50000;
    if (esLoginPage) {
        throw new Error('LOGIN_FAILED: El servidor devolvió la página de login — credenciales incorrectas o cuenta bloqueada');
    }

    // Extraer CSRF token
    let csrfToken = '';
    const csrfPatterns = [
        /window\.CSRFSecureToken\s*=\s*["']([^"']{10,})["']/,
        /CSRFSecureToken["']?\s*[:=]\s*["']([^"']{10,})["']/,
        /"csrfToken"\s*:\s*"([^"]{10,})"/,
        /csrf[_-]?token["']?\s*[:=]\s*["']([^"']{10,})["']/i,
        /name="__RequestVerificationToken"[^>]+value="([^"]{10,})"/i,
        /"X-OFS-CSRF-SECURE"\s*:\s*"([^"]{10,})"/
    ];
    for (const pat of csrfPatterns) {
        const match = dashHtml.match(pat);
        if (match) { csrfToken = match[1]; reportar(`   CSRF encontrado (patrón: ${pat.source.substring(0, 30)}...)`); break; }
    }
    if (!csrfToken) reportar('   ⚠️ CSRF no encontrado en HTML (se intentará sin él)');

    // Detectar URL del Grid API en los scripts del dashboard
    let gridUrl = TOA_URL + '?m=Grid&a=get&itype=manage&output=ajax';
    const gridUrlMatch = dashHtml.match(/["'](https?:\/\/[^"']*m=Grid[^"']*output=ajax[^"']*)["']/);
    if (gridUrlMatch) { gridUrl = gridUrlMatch[1]; reportar(`   Grid URL: ${gridUrl.substring(0, 60)}...`); }

    const sessionCookies = getCookies();
    reportar(`   ✅ Login completado. Cookies: ${cookieJar.size} | CSRF: ${csrfToken ? 'encontrado' : 'no'}`);

    return { sessionCookies, csrfToken, gridUrl };
}

// =============================================================================
// GRID API — Llamada directa a Oracle TOA
// =============================================================================
async function gridAPICall(url, postBody, sessionCookies, csrfToken) {
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    try {
        const headers = {
            'Content-Type':     'application/x-www-form-urlencoded',
            'Cookie':           sessionCookies,
            'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept':           'application/json, text/javascript, */*; q=0.01',
            'Accept-Language':  'es-CL,es;q=0.9',
            'Referer':          TOA_URL,
            'Origin':           `https://${TOA_HOST}`,
            ...(csrfToken ? { 'X-OFS-CSRF-SECURE': csrfToken } : {})
        };

        const res = await axios.post(url, postBody, {
            httpsAgent,
            headers,
            timeout:        30000,
            validateStatus: () => true
        });

        if (res.status >= 400) {
            return { error: `HTTP ${res.status}`, activitiesRows: [] };
        }

        const data = typeof res.data === 'object' ? res.data : JSON.parse(res.data);
        return data;
    } catch (e) {
        return { error: e.message, activitiesRows: [] };
    }
}

// =============================================================================
// ESPERAR CONFIRMACIÓN DEL USUARIO (IPC del proceso padre)
// =============================================================================
function esperarConfirmacion(timeoutMs, reportar) {
    return new Promise((resolve, reject) => {
        reportar(`⏳ Esperando selección de grupos (máx. ${timeoutMs / 1000}s)...`);
        const timer = setTimeout(() => reject(new Error(`Timeout ${timeoutMs / 1000}s`)), timeoutMs);

        if (process.send) {
            const handler = (msg) => {
                if (msg && msg.type === 'confirmar_grupos') {
                    clearTimeout(timer);
                    process.removeListener('message', handler);
                    resolve(msg.grupos || []);
                }
            };
            process.on('message', handler);
        } else {
            const poll = setInterval(() => {
                if (global.BOT_STATUS && global.BOT_STATUS.gruposConfirmados) {
                    clearTimeout(timer); clearInterval(poll);
                    const g = global.BOT_STATUS.gruposConfirmados;
                    delete global.BOT_STATUS.gruposConfirmados;
                    resolve(g);
                }
            }, 1000);
        }
    });
}

// =============================================================================
// GUARDAR ACTIVIDADES EN MONGODB
// =============================================================================
async function guardarActividades(rows, empresa, fecha, bucketId, empresaRef) {
    const ops = rows.map(row => {
        const ordenId = row.key || row['144'] || row.appt_number ||
            `${empresa}_${fecha}_${JSON.stringify(row).length}`;
        const doc = {
            ordenId, empresa, bucket: empresa, bucketId,
            fecha: new Date(fecha + 'T00:00:00Z'),
            recurso:              row.pname             || '',
            'Número de Petición': row.appt_number       || row['144'] || '',
            'Estado':             row.astatus            || '',
            'Subtipo de Actividad': row.aworktype        || '',
            'Ventana de servicio':  row.service_window   || '',
            'Ventana de Llegada':   row.delivery_window  || '',
            'Nombre':             row.cname              || '',
            'RUT del cliente':    row.customer_number    || row['362'] || '',
            telefono:             (row.cphone || '').replace(/<[^>]+>/g, '').trim(),
            'Ciudad':             row.ccity || row.cstate || '',
            latitud:              row.acoord_y ? String(row.acoord_y) : null,
            longitud:             row.acoord_x ? String(row.acoord_x) : null,
            camposCustom: Object.fromEntries(Object.entries(row).filter(([k]) => /^\d+$/.test(k))),
            rawData: row,
            ultimaActualizacion: new Date(),
            ...(empresaRef ? { empresaRef } : {})
        };
        return { updateOne: { filter: { ordenId }, update: { $set: doc }, upsert: true } };
    }).filter(op => op.updateOne.filter.ordenId && String(op.updateOne.filter.ordenId).length > 2);

    if (ops.length === 0) return 0;
    const result = await Actividad.bulkWrite(ops, { ordered: false });
    return (result.upsertedCount || 0) + (result.modifiedCount || 0);
}

// =============================================================================
// EXPORTS + EJECUCIÓN DIRECTA
// =============================================================================
module.exports = { iniciarExtraccion };

if (require.main === module) {
    const credenciales = { usuario: process.env.BOT_TOA_USER || '', clave: process.env.BOT_TOA_PASS || '' };
    mongoose.connect(process.env.MONGO_URI)
        .then(() => { console.log('✅ MongoDB'); return iniciarExtraccion(process.env.BOT_FECHA_INICIO || null, process.env.BOT_FECHA_FIN || null, credenciales); })
        .catch(err => { console.error('❌ MongoDB:', err.message); process.exit(1); });
}

'use strict';

// =============================================================================
// TOA AGENTE v5 — Estrategia Grid API + Chrome efímero
//
// Flujo:
//   1. Login con Puppeteer (Chrome headless ~30s)
//   2. Interceptar primer XHR Grid para capturar template
//   3. Extraer cookies de sesión + CSRF token
//   4. CERRAR Chrome (ya no se necesita — libera RAM en Render)
//   5. Para cada fecha × bucket: llamar al API de TOA con Node.js https
//   6. Guardar en MongoDB con upsert
//
// Buckets (data-group-id del sidebar TOA):
//   COMFICA=3840  |  ZENER RANCAGUA=3842  |  ZENER RM=3841
// =============================================================================

const puppeteer = require('puppeteer');
const mongoose  = require('mongoose');
const path      = require('path');
const https     = require('https');
const http      = require('http');
const Actividad = require('../models/Actividad');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const TOA_URL = process.env.TOA_URL || 'https://telefonica-cl.etadirect.com/';

const BUCKET_IDS = {
    'COMFICA':        3840,
    'ZENER RANCAGUA': 3842,
    'ZENER RM':       3841
};

// =============================================================================
// PUNTO DE ENTRADA
// =============================================================================
const iniciarExtraccion = async (fechaInicio = null, fechaFin = null, credenciales = {}) => {
    process.env.BOT_ACTIVE_LOCK = 'TOA';

    // Construir lista de fechas
    const fechasAProcesar = [];
    if (fechaInicio && fechaFin) {
        let cursor = new Date(fechaInicio + 'T00:00:00Z');
        const fin  = new Date(fechaFin   + 'T00:00:00Z');
        while (cursor <= fin) {
            fechasAProcesar.push(cursor.toISOString().split('T')[0]);
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
    } else if (fechaInicio) {
        fechasAProcesar.push(fechaInicio);
    } else {
        let cursor = new Date(Date.UTC(2026, 0, 1));
        const hoy  = new Date();
        hoy.setUTCHours(0, 0, 0, 0);
        while (cursor <= hoy) {
            fechasAProcesar.push(cursor.toISOString().split('T')[0]);
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
    }

    const modo       = fechaInicio && fechaFin ? 'RANGO' : fechaInicio ? 'DÍA ÚNICO' : 'BACKFILL';
    const empresaRef = process.env.BOT_EMPRESA_REF || null;

    const reportar = (msg, extra = {}) => {
        console.log('BOT', msg);
        if (process.send) {
            process.send({ type: 'log', text: msg, ...extra });
        } else if (global.BOT_STATUS) {
            global.BOT_STATUS.logs = global.BOT_STATUS.logs || [];
            global.BOT_STATUS.logs.push(`[${new Date().toLocaleTimeString('es-CL')}] ${msg}`);
            if (global.BOT_STATUS.logs.length > 100) global.BOT_STATUS.logs.shift();
        }
    };

    reportar(`🚀 [${modo}] ${fechasAProcesar[0]} → ${fechasAProcesar[fechasAProcesar.length - 1]} (${fechasAProcesar.length} días)`);

    let browser        = null;
    let sessionCookies = '';
    let csrfToken      = '';
    let gridTemplate   = null;

    try {
        // ── FASE 1: Login con Chrome (~30s) ───────────────────────────────────
        reportar('🌐 Lanzando Chrome headless...');
        browser = await puppeteer.launch({
            headless: 'new',
            defaultViewport: { width: 1920, height: 1080 },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--no-first-run',
                '--no-zygote',
                '--disable-extensions',
                '--window-size=1920,1080',
                '--disable-blink-features=AutomationControlled',
                '--disable-sync',
                '--disable-translate',
                '--disable-plugins',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-dev-shm-usage',
                '--disk-cache-size=1',
                '--media-cache-size=1'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        );
        page.on('dialog', async d => { try { await d.accept(); } catch (e) {} });

        // Interceptar requests: bloquear recursos innecesarios para ahorrar RAM
        // (imágenes, CSS, fuentes, media no afectan la funcionalidad de la API)
        await page.setRequestInterception(true);
        page.on('request', req => {
            try {
                const rt  = req.resourceType();
                const url = req.url();

                // Bloquear recursos pesados que no se necesitan para el login ni la API
                if (['image', 'stylesheet', 'font', 'media', 'other'].includes(rt)) {
                    req.abort();
                    return;
                }

                // Capturar el template Grid XHR
                if (!gridTemplate && req.method() === 'POST' &&
                    url.includes('m=Grid') && url.includes('output=ajax')) {
                    const body = req.postData() || '';
                    if (body.length > 20) {
                        gridTemplate = { url, headers: req.headers(), postData: body };
                        reportar(`✅ Template Grid capturado (${body.length} chars)`);
                    }
                }

                req.continue();
            } catch (e) {
                try { req.continue(); } catch (_) {}
            }
        });

        // Login
        reportar('🔐 Iniciando sesión TOA...');
        await loginAtomico(page, credenciales, reportar);
        reportar('✅ Login OK.');

        // Esperar un poco para que cargue el dashboard
        await new Promise(r => setTimeout(r, 3000));

        // Si no se capturó el template en el login, hacer click en COMFICA
        if (!gridTemplate) {
            reportar('🖱️ Disparando Grid XHR (click COMFICA)...');
            const clickOk = await page.evaluate(() => {
                const el = document.querySelector('[data-group-id="3840"]');
                if (el) { el.click(); return 'data-group-id'; }
                const items = Array.from(document.querySelectorAll(
                    '.edt-favorite-item, [class*="resource-groups"], span, li, div, a'
                ));
                const found = items.find(e => {
                    const r = e.getBoundingClientRect();
                    return r.left < 450 && r.width > 0 && r.height > 0 &&
                           e.innerText && e.innerText.trim().toUpperCase().includes('COMFICA');
                });
                if (found) { found.click(); return 'text'; }
                return null;
            });
            reportar(clickOk ? `Click COMFICA via: ${clickOk}` : '⚠️ Click COMFICA fallido — esperando...');

            for (let i = 0; i < 15 && !gridTemplate; i++) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        if (!gridTemplate) {
            throw new Error(
                'No se capturó el template del Grid API. ' +
                'Verifica que COMFICA sea visible en el sidebar de TOA.'
            );
        }

        reportar(`📝 Template: ${gridTemplate.postData.substring(0, 80)}...`);

        // Extraer cookies y CSRF token antes de cerrar Chrome
        reportar('🍪 Extrayendo cookies de sesión...');
        const rawCookies = await page.cookies();
        sessionCookies = rawCookies.map(c => `${c.name}=${c.value}`).join('; ');
        reportar(`Cookies: ${rawCookies.length} cookies`);

        csrfToken = await page.evaluate(() =>
            window.CSRFSecureToken || window.csrf_token || ''
        ).catch(() => '');

        if (!csrfToken) {
            csrfToken = gridTemplate.headers['x-ofs-csrf-secure'] || '';
            reportar('⚠️ CSRF no en window — usando header capturado');
        } else {
            reportar(`🔑 CSRF: ${csrfToken.substring(0, 20)}...`);
        }

        // CERRAR Chrome — ya no se necesita
        await browser.close();
        browser = null;
        reportar('✅ Chrome cerrado. Extracción continúa en Node.js puro.');

        // ── FASE 2: Extraer datos con https (sin Chrome) ──────────────────────
        let totalGuardados = 0;

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

            for (const [empresa, bucketId] of Object.entries(BUCKET_IDS)) {
                try {
                    let postData = gridTemplate.postData;

                    // Reemplazar fecha — detectar formato del template
                    const fechaFormateada = formatearFechaParaTOA(fecha, postData);
                    postData = postData.replace(/date=[^&\s]+/, `date=${encodeURIComponent(fechaFormateada)}`);

                    // Reemplazar gid / rid
                    if (/gid=\d+/.test(postData)) {
                        postData = postData.replace(/gid=\d+/, `gid=${bucketId}`);
                    } else if (/rid=\d+/.test(postData)) {
                        postData = postData.replace(/rid=\d+/, `rid=${bucketId}`);
                    } else {
                        postData += `&gid=${bucketId}`;
                    }

                    const resultado = await httpPost(gridTemplate.url, postData, sessionCookies, csrfToken);

                    if (resultado.error) {
                        reportar(`  ⚠️ ${empresa}: ${resultado.error}`);
                        continue;
                    }

                    const rows = resultado.activitiesRows || [];
                    if (rows.length > 0) {
                        const guardados = await guardarActividades(rows, empresa, fecha, bucketId, empresaRef);
                        totalGuardados += guardados;
                        reportar(`  💾 ${empresa}: ${rows.length} actividades, ${guardados} guardadas`);
                    }

                    await new Promise(r => setTimeout(r, 300));

                } catch (err) {
                    reportar(`  ❌ ${empresa}: ${err.message}`);
                }
            }
        }

        reportar(`\n🏁 COMPLETADO. Total guardados: ${totalGuardados} registros.`);
        if (process.send)      process.send({ type: 'log', text: '🏁 COMPLETADO', completed: true });
        if (global.BOT_STATUS) global.BOT_STATUS.running = false;

    } catch (error) {
        const errMsg = error.message || 'Error desconocido';
        reportar(`❌ ERROR FATAL: ${errMsg}`);
        console.error('ERROR FATAL:', error);
        if (global.BOT_STATUS) {
            global.BOT_STATUS.ultimoError = errMsg;
            global.BOT_STATUS.running     = false;
        }
    } finally {
        process.env.BOT_ACTIVE_LOCK = 'OFF';
        if (browser) {
            await browser.close().catch(() => {});
        }
    }
};

// =============================================================================
// DETECCIÓN Y FORMATEO DE FECHA PARA TOA
// =============================================================================
function formatearFechaParaTOA(fechaISO, postDataOrigen) {
    const [yyyy, mm, dd] = fechaISO.split('-');
    const match = postDataOrigen.match(/date=([^&\s]+)/);
    if (!match) return `${mm}/${dd}/${yyyy}`;

    const fechaActual = decodeURIComponent(match[1]);
    const partes = fechaActual.split('/');
    if (partes.length !== 3) {
        if (/-/.test(fechaActual)) return fechaISO; // YYYY-MM-DD
        return `${mm}/${dd}/${yyyy}`;
    }
    // Detectar DD/MM/YYYY vs MM/DD/YYYY
    if (parseInt(partes[0]) > 12) return `${dd}/${mm}/${yyyy}`;
    return `${mm}/${dd}/${yyyy}`;
}

// =============================================================================
// HTTP POST — Llamada directa al API de TOA usando cookies de sesión
// =============================================================================
function httpPost(url, body, cookieString, csrfToken) {
    return new Promise((resolve, reject) => {
        const parsed  = new URL(url);
        const isHttps = parsed.protocol === 'https:';
        const options = {
            hostname: parsed.hostname,
            port:     parsed.port || (isHttps ? 443 : 80),
            path:     parsed.pathname + parsed.search,
            method:   'POST',
            headers: {
                'Content-Type':     'application/x-www-form-urlencoded',
                'Content-Length':   Buffer.byteLength(body),
                'Cookie':           cookieString,
                'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'X-Requested-With': 'XMLHttpRequest',
                'Accept':           'application/json, text/javascript, */*; q=0.01',
                'Accept-Language':  'es-CL,es;q=0.9',
                'Referer':          TOA_URL,
                ...(csrfToken ? { 'X-OFS-CSRF-SECURE': csrfToken } : {})
            }
        };

        const lib = isHttps ? https : http;
        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    resolve({ error: `HTTP ${res.statusCode}`, activitiesRows: [] });
                    return;
                }
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ error: `JSON parse: ${e.message}`, activitiesRows: [] });
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Timeout 30s en request TOA'));
        });
        req.write(body);
        req.end();
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
            ordenId,
            empresa,
            bucket:          empresa,
            fecha:           new Date(fecha + 'T00:00:00Z'),
            bucketId,

            // Técnico
            recurso:         row.pname           || '',
            // Orden
            'Número de Petición': row.appt_number || row['144'] || '',
            'Estado':        row.astatus          || '',
            'Subtipo de Actividad': row.aworktype || '',
            // Ventanas
            'Ventana de servicio': row.service_window  || '',
            'Ventana de Llegada':  row.delivery_window || '',
            // Cliente
            'Nombre':        row.cname            || '',
            'RUT del cliente': row.customer_number || row['362'] || '',
            telefono:        (row.cphone || '').replace(/<[^>]+>/g, '').trim(),
            // Ubicación
            'Ciudad':        row.ccity   || row.cstate || '',
            latitud:         row.acoord_y ? String(row.acoord_y) : null,
            longitud:        row.acoord_x ? String(row.acoord_x) : null,
            // Campos custom numéricos
            camposCustom: Object.fromEntries(
                Object.entries(row).filter(([k]) => /^\d+$/.test(k))
            ),
            rawData: row,
            ultimaActualizacion: new Date(),
            ...(empresaRef ? { empresaRef } : {})
        };

        return {
            updateOne: {
                filter: { ordenId: doc.ordenId },
                update: { $set: doc },
                upsert: true
            }
        };
    }).filter(op => op.updateOne.filter.ordenId && String(op.updateOne.filter.ordenId).length > 2);

    if (ops.length === 0) return 0;
    const result = await Actividad.bulkWrite(ops, { ordered: false });
    return (result.upsertedCount || 0) + (result.modifiedCount || 0);
}

// =============================================================================
// LOGIN TOA — ElementHandle.type() genera eventos de teclado reales
// (Oracle JET/KnockoutJS ignora element.value = x)
// =============================================================================
async function loginAtomico(page, credenciales = {}, reportar = console.log) {
    const usuario = credenciales.usuario || process.env.BOT_TOA_USER || '';
    const clave   = credenciales.clave   || process.env.BOT_TOA_PASS  || '';

    if (!usuario) throw new Error('LOGIN_FAILED: usuario TOA no configurado');
    if (!clave)   throw new Error('LOGIN_FAILED: contraseña TOA no configurada');

    reportar(`Login: usuario="${usuario}" (${clave.length} chars clave)`);

    await page.goto(TOA_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await new Promise(r => setTimeout(r, 2000));

    reportar('Esperando formulario login...');
    await page.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));

    // Helper: llenar campo con click triple + Delete + type (necesario para Oracle JET/KnockoutJS)
    const llenarCampo = async (field, valor) => {
        await field.click({ clickCount: 3 });
        await page.keyboard.press('Delete');
        await new Promise(r => setTimeout(r, 150));
        await field.type(valor, { delay: 50 });
        await new Promise(r => setTimeout(r, 300));
    };

    // Campo usuario — intentar selectores específicos primero, luego fallback
    reportar(`Llenando usuario (${usuario})...`);
    let userField = await page.$('input#username, input[name="username"]').catch(() => null);
    if (!userField) {
        userField = await page.$(
            'input:not([type="password"]):not([type="checkbox"]):not([type="hidden"]):not([type="submit"])'
        ).catch(() => null);
    }
    if (!userField) throw new Error('LOGIN_FAILED: campo usuario no encontrado');
    await llenarCampo(userField, usuario);

    // Campo contraseña
    reportar('Llenando contraseña...');
    const passField = await page.$('input[type="password"]').catch(() => null);
    if (!passField) throw new Error('LOGIN_FAILED: campo contraseña no encontrado');
    await llenarCampo(passField, clave);

    // Verificar que quedaron llenos
    const verificacion = await page.evaluate(() => {
        const u = document.querySelector('input#username, input[name="username"], input:not([type="password"]):not([type="checkbox"]):not([type="hidden"])');
        const p = document.querySelector('input[type="password"]');
        return { user: u ? u.value : '(vacío)', pass: p ? p.value.length : 0 };
    });
    reportar(`Campos: usuario="${verificacion.user}" pass=${verificacion.pass} chars`);

    // Click "Iniciar"
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button, input[type="submit"]'))
            .find(b => /iniciar|sign in|login/i.test(b.textContent || b.value || '') && b.offsetParent !== null);
        if (btn) btn.click();
        else document.querySelectorAll('button')[0]?.click();
    });
    reportar('Click Iniciar (1er intento)');

    // Polling del resultado — cada 1.5s hasta 37.5s
    let estado = 'timeout';
    for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 1500));
        try {
            const result = await page.evaluate(() => {
                const txt = (document.body && document.body.innerText) || '';
                if (document.querySelector('oj-navigation-list') ||
                    document.querySelector('[role="tree"]') ||
                    txt.includes('Consola de despacho') || txt.includes('COMFICA') ||
                    txt.includes('ZENER') || txt.includes('Buscar en actividades'))
                    return 'dashboard';
                if (document.querySelector('input[type="checkbox"]') &&
                    (txt.includes('superado') || txt.includes('sesiones') || txt.includes('Suprimir')))
                    return 'checkpoint';
                if (txt.includes('incorrectos') || txt.includes('incorrecto') || txt.includes('Invalid'))
                    return 'credenciales_incorrectas';
                return null;
            });
            if (result) { estado = result; break; }
        } catch (e) { /* contexto destruido durante navegación — ignorar */ }
    }

    reportar(`Estado post-click: ${estado}`);

    if (estado === 'credenciales_incorrectas') {
        const errTOA = await page.evaluate(() => {
            const m = (document.body.innerText || '').match(/[^\n]*(?:incorrectos?|Invalid)[^\n]*/i);
            return m ? m[0].trim() : '';
        }).catch(() => '');
        throw new Error(`LOGIN_FAILED: ${errTOA || 'Entorno, nombre de usuario o contraseña incorrectos'}`);
    }

    if (estado === 'dashboard') {
        reportar('✅ Dashboard cargado (sin checkpoint).');
        await new Promise(r => setTimeout(r, 2000));
        return;
    }

    // Checkpoint: sesiones simultáneas
    if (estado === 'checkpoint') {
        reportar('⚠️ Checkpoint — marcando "Suprimir sesión más antigua"...');
        const cb = await page.$('input[type="checkbox"]');
        if (cb) {
            await cb.evaluate(el => el.scrollIntoView({ block: 'center' }));
            await new Promise(r => setTimeout(r, 300));
            await cb.click();
            await new Promise(r => setTimeout(r, 300));
            await cb.evaluate(el => {
                if (!el.checked) {
                    el.checked = true;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
            await new Promise(r => setTimeout(r, 500));
        }

        // Re-llenar campos
        const passField2 = await page.$('input[type="password"]');
        if (passField2) {
            await passField2.click({ clickCount: 3 });
            await page.keyboard.press('Delete');
            await passField2.type(clave, { delay: 40 });
            await new Promise(r => setTimeout(r, 300));
        }

        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button'))
                .find(b => /iniciar/i.test(b.textContent) && b.offsetParent !== null);
            if (btn) btn.click();
        });
        reportar('Click Iniciar (2do intento)');
    }

    // Esperar dashboard hasta 90s
    reportar('Esperando dashboard...');
    const ok = await page.waitForFunction(() => {
        const txt = (document.body && document.body.innerText) || '';
        return !!(document.querySelector('oj-navigation-list') ||
                  document.querySelector('[role="tree"]') ||
                  txt.includes('Consola de despacho') || txt.includes('COMFICA') ||
                  txt.includes('ZENER') || txt.includes('Buscar en actividades'));
    }, { timeout: 90000 }).then(() => true).catch(() => false);

    if (ok) {
        reportar('✅ Dashboard cargado.');
        await new Promise(r => setTimeout(r, 2000));
    } else {
        reportar('⚠️ Dashboard no confirmado tras 90s. Continuando de todas formas...');
    }
}

// =============================================================================
// EXPORTS + EJECUCIÓN DIRECTA
// =============================================================================
module.exports = { iniciarExtraccion };

if (require.main === module) {
    const fechaInicioEnv = process.env.BOT_FECHA_INICIO || null;
    const fechaFinEnv    = process.env.BOT_FECHA_FIN    || null;
    const credenciales   = {
        usuario: process.env.BOT_TOA_USER || '',
        clave:   process.env.BOT_TOA_PASS || ''
    };
    mongoose.connect(process.env.MONGO_URI)
        .then(() => {
            console.log('✅ MongoDB conectado. Iniciando bot...');
            return iniciarExtraccion(fechaInicioEnv, fechaFinEnv, credenciales);
        })
        .catch(err => {
            console.error('❌ MongoDB:', err.message);
            process.exit(1);
        });
}

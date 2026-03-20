'use strict';

// =============================================================================
// AGENTE TOA v4 — Login con Chrome → cerrar Chrome → extraer vía axios
//
// Flujo:
//   1. Login con Puppeteer (Chrome headless ~30 segundos)
//   2. Interceptar el primer XHR Grid → capturar template
//   3. Extraer cookies de sesión + CSRF token del browser
//   4. CERRAR Chrome (ya no se necesita)
//   5. Para cada fecha × empresa: llamar a la API de TOA con axios
//      usando las cookies y CSRF capturados
//   6. Guardar en MongoDB con upsert
//
// Ventaja vs v3: Chrome sólo vive ~30 segundos en lugar de toda la sesión.
// En Render free tier (512MB RAM), esto evita que Chrome consuma la RAM
// mientras Express sigue respondiendo durante la extracción.
// =============================================================================

const puppeteer  = require('puppeteer');
const mongoose   = require('mongoose');
const path       = require('path');
const https      = require('https');
const http       = require('http');
const Actividad  = require('../models/Actividad');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const TOA_URL = process.env.TOA_URL || 'https://telefonica-cl.etadirect.com/';

// IDs de los buckets principales en TOA (data-group-id del sidebar DOM)
const BUCKET_IDS = {
    'COMFICA':        3840,
    'ZENER RANCAGUA': 3842,
    'ZENER RM':       3841
};

// =============================================================================
// ENTRADA PRINCIPAL
// =============================================================================
const iniciarExtraccion = async (fechaInicio = null, fechaFin = null, credenciales = {}) => {
    process.env.BOT_ACTIVE_LOCK = 'TOA';

    // ── Construir lista de fechas ─────────────────────────────────────────────
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
        const fin  = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
        while (cursor <= fin) {
            fechasAProcesar.push(cursor.toISOString().split('T')[0]);
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
    }

    const modo       = fechaInicio && fechaFin ? 'RANGO' : fechaInicio ? 'DÍA ÚNICO' : 'BACKFILL';
    const empresaRef = process.env.BOT_EMPRESA_REF || null;

    // ── Helper IPC + global.BOT_STATUS ───────────────────────────────────────
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

    reportar(`[${modo}] ${fechasAProcesar[0]} → ${fechasAProcesar[fechasAProcesar.length - 1]} (${fechasAProcesar.length} dias)`);

    let browser;
    // Datos extraídos del browser que usaremos con axios
    let sessionCookies = '';    // string "k=v; k2=v2" para el header Cookie
    let csrfToken      = '';    // valor de window.CSRFSecureToken
    let gridTemplate   = null;  // { url, headers, postData }

    try {
        // ── FASE 1: Login con Chrome (solo ~30s) ──────────────────────────────
        reportar('Lanzando Chrome headless...');
        browser = await puppeteer.launch({
            headless: 'new',
            defaultViewport: { width: 1280, height: 800 },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--no-first-run',
                '--no-zygote',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-sync',
                '--disable-translate',
                '--disable-plugins',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--blink-settings=imagesEnabled=false',
                '--js-flags=--max-old-space-size=256',
                '--window-size=1280,800'
            ]
        });

        const page = await browser.newPage();
        page.on('dialog', async d => await d.accept());
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        );

        // ── Interceptar el primer Grid request para capturar el template ───────
        await page.setRequestInterception(true);

        page.on('request', request => {
            const url = request.url();
            if (url.includes('Grid') && url.includes('ajax') && request.method() === 'POST') {
                if (!gridTemplate) {
                    gridTemplate = {
                        url:      request.url(),
                        headers:  request.headers(),
                        postData: request.postData() || ''
                    };
                    reportar(`Template Grid capturado (${gridTemplate.postData.length} chars)`);
                }
            }
            request.continue();
        });

        // ── Login ─────────────────────────────────────────────────────────────
        reportar('Iniciando sesion TOA...');
        await loginAtomico(page, credenciales, reportar);
        reportar('Login OK.');

        // ── Disparar primer Grid request haciendo click en COMFICA ────────────
        reportar('Disparando primer Grid request (click COMFICA)...');
        await new Promise(r => setTimeout(r, 3000));

        const clickedOk = await page.evaluate(() => {
            const byGroupId = document.querySelector('[data-group-id="3840"]');
            if (byGroupId) { byGroupId.click(); return true; }
            const items = document.querySelectorAll('.edt-favorite-item, [class*="resource-groups"]');
            for (const el of items) {
                if (el.textContent.trim().startsWith('COMFICA')) { el.click(); return true; }
            }
            return false;
        });

        if (!clickedOk) {
            reportar('AVISO: click COMFICA fallido — intentando por texto...');
            await page.evaluate(() => {
                const all = document.querySelectorAll('*');
                for (const el of all) {
                    if (el.childElementCount === 0 && el.textContent.trim() === 'COMFICA') {
                        el.click(); return;
                    }
                }
            });
        }

        // Esperar hasta 15s que se capture el template
        for (let i = 0; i < 15 && !gridTemplate; i++) {
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!gridTemplate) {
            throw new Error(
                'No se capturó el template del Grid API. ' +
                'El dashboard puede no haber cargado o el click COMFICA falló.'
            );
        }

        reportar(`Template capturado: ${gridTemplate.postData.substring(0, 80)}...`);

        // ── Extraer cookies + CSRF token antes de cerrar Chrome ───────────────
        reportar('Extrayendo credenciales de sesión...');
        const rawCookies = await page.cookies();
        sessionCookies = rawCookies.map(c => `${c.name}=${c.value}`).join('; ');
        reportar(`Cookies de sesion: ${rawCookies.length} cookies`);

        csrfToken = await page.evaluate(() => {
            return window.CSRFSecureToken || window.csrf_token || '';
        }).catch(() => '');

        if (csrfToken) {
            reportar(`CSRF token: ${csrfToken.substring(0, 20)}...`);
        } else {
            reportar('AVISO: CSRF token no encontrado en window — se usará el del header capturado');
            csrfToken = gridTemplate.headers['x-ofs-csrf-secure'] || '';
        }

        // ── CERRAR Chrome — no se necesita más ────────────────────────────────
        await browser.close();
        browser = null;
        reportar('✅ Chrome cerrado. Extracción continúa en Node.js puro.');

        // ── FASE 2: Extraer datos con axios (sin Chrome) ──────────────────────
        let totalGuardados = 0;

        for (let i = 0; i < fechasAProcesar.length; i++) {
            const fecha = fechasAProcesar[i];

            if (process.send) {
                process.send({ type: 'progress', diaActual: i + 1, totalDias: fechasAProcesar.length, fechaProcesando: fecha });
            } else if (global.BOT_STATUS) {
                global.BOT_STATUS.diaActual       = i + 1;
                global.BOT_STATUS.fechaProcesando = fecha;
            }

            reportar(`[${i + 1}/${fechasAProcesar.length}] Procesando: ${fecha}`);

            for (const [empresa, bucketId] of Object.entries(BUCKET_IDS)) {
                try {
                    // Modificar fecha y gid en el template capturado
                    let postData = gridTemplate.postData;
                    const fechaSlash = fecha.replace(/-/g, '/');
                    postData = postData.replace(/date=[^&\s]+/, `date=${encodeURIComponent(fechaSlash)}`);

                    if (/gid=\d+/.test(postData)) {
                        postData = postData.replace(/gid=\d+/, `gid=${bucketId}`);
                    } else if (/rid=\d+/.test(postData)) {
                        postData = postData.replace(/rid=\d+/, `rid=${bucketId}`);
                    } else {
                        postData += `&gid=${bucketId}`;
                    }

                    // Llamada HTTP directa con cookies de sesión
                    const resultado = await httpPost(gridTemplate.url, postData, sessionCookies, csrfToken);

                    if (resultado.error) {
                        reportar(`  ${empresa}: ERROR ${resultado.error}`);
                        continue;
                    }

                    const rows = resultado.activitiesRows || [];
                    reportar(`  ${empresa}: ${rows.length} actividades`);

                    if (rows.length > 0) {
                        const guardados = await guardarActividades(rows, empresa, fecha, bucketId, empresaRef);
                        totalGuardados += guardados;
                        reportar(`    Guardado: ${guardados} registros`);
                    }

                    // Pausa mínima entre requests para no saturar TOA
                    await new Promise(r => setTimeout(r, 300));

                } catch (err) {
                    reportar(`  ${empresa}: ERROR — ${err.message}`);
                }
            }
        }

        reportar(`✅ DESCARGA COMPLETADA. Total guardados: ${totalGuardados} registros.`);
        if (process.send)      process.send({ type: 'log', text: 'COMPLETADO', completed: true });
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
// HTTP POST — Llamada directa al API de TOA usando cookies de sesión
// Reemplaza el page.evaluate(fetch()) del v3. Chrome ya no está activo.
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
                'Content-Type':         'application/x-www-form-urlencoded',
                'Content-Length':       Buffer.byteLength(body),
                'Cookie':               cookieString,
                'User-Agent':           'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'X-Requested-With':     'XMLHttpRequest',
                'Accept':               'application/json, text/javascript, */*; q=0.01',
                'Accept-Language':      'es-CL,es;q=0.9',
                'Referer':              TOA_URL,
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
                    resolve({ error: `JSON parse error: ${e.message}`, activitiesRows: [] });
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
    if (!mongoose.connection.readyState) {
        await mongoose.connect(process.env.MONGO_URI);
    }

    const ops = rows.map(row => {
        const ordenId = row.key || row['144'] || row.appt_number || `${empresa}_${fecha}_${JSON.stringify(row).length}`;

        const doc = {
            ordenId,
            empresa,
            fecha:           new Date(fecha + 'T00:00:00Z'),
            bucketId,

            // Técnico
            tecnico:         row.pname        || '',

            // Orden
            numeroOrden:     row.appt_number  || row['144'] || '',
            estado:          row.astatus      || '',
            tipoTrabajo:     row.aworktype    || '',

            // Ventanas
            ventanaServicio: row.service_window  || '',
            ventanaLlegada:  row.delivery_window || '',
            timeSlot:        row.time_slot       || '',

            // Cliente
            nombreCliente:   row.cname           || '',
            rutCliente:      row.customer_number || row['362'] || '',
            telefono:        (row.cphone || '').replace(/<[^>]+>/g, '').trim(),
            celular:         (row.ccell  || '').replace(/<[^>]+>/g, '').trim(),
            email:           row.cemail          || '',

            // Ubicación
            ciudad:          row.ccity    || row.cstate || '',
            direccion:       row['272']   || '',
            coordX:          row.acoord_x || '',
            coordY:          row.acoord_y || '',
            zona:            row.aworkzone || '',

            // Métricas
            duracion:        row.length  || '',
            viaje:           row.travel  || '',
            puntos:          row.apoints || '',

            // Custom fields numéricos
            camposCustom: Object.fromEntries(
                Object.entries(row).filter(([k]) => /^\d+$/.test(k))
            ),

            rawData: row,

            ...(empresaRef ? { empresaRef } : {})
        };

        return {
            updateOne: {
                filter: { ordenId: doc.ordenId, empresa: doc.empresa, fecha: doc.fecha },
                update: { $set: doc },
                upsert: true
            }
        };
    });

    if (ops.length === 0) return 0;
    const result = await Actividad.bulkWrite(ops, { ordered: false });
    return result.upsertedCount + result.modifiedCount;
}

// =============================================================================
// LOGIN ATOMICO TOA
// =============================================================================
async function loginAtomico(page, credenciales = {}, reportar = console.log) {
    const usuario = credenciales.usuario || process.env.BOT_TOA_USER || '';
    const clave   = credenciales.clave   || process.env.BOT_TOA_PASS  || '';

    if (!usuario) throw new Error('LOGIN_FAILED: usuario TOA no configurado');
    if (!clave)   throw new Error('LOGIN_FAILED: contraseña TOA no configurada');

    reportar(`Login: usuario="${usuario}" (${clave.length} chars clave)`);

    await page.goto(TOA_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await new Promise(r => setTimeout(r, 3000));

    // Cerrar dialog de timeout de sesión
    const hayTimeout = await page.evaluate(() => {
        const txt = document.body.innerText || '';
        return txt.includes('Timeout de sesión') || txt.includes('desconectado por motivos');
    });
    if (hayTimeout) {
        reportar('AVISO: Timeout de sesion — cerrando...');
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button'))
                .find(b => /cerrar sesión/i.test(b.textContent));
            if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 5000));
    }

    reportar('Esperando formulario login...');
    await page.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));

    // Helper: llenar campo con click triple + type (necesario para Oracle JET)
    const llenarCampo = async (field, valor) => {
        await field.click({ clickCount: 3 });
        await page.keyboard.press('Delete');
        await new Promise(r => setTimeout(r, 150));
        await field.type(valor, { delay: 50 });
        await new Promise(r => setTimeout(r, 300));
    };

    // Usuario
    const userField = await page.$('input#username, input[name="username"]').catch(() => null);
    if (userField) {
        reportar(`Llenando usuario (${usuario})...`);
        await llenarCampo(userField, usuario);
    } else {
        throw new Error('LOGIN_FAILED: campo usuario no encontrado');
    }

    // Contraseña
    reportar('Llenando contraseña...');
    const passField = await page.$('input#password, input[name="password"]').catch(() => null);
    if (passField) {
        await llenarCampo(passField, clave);
    } else {
        throw new Error('LOGIN_FAILED: campo contraseña no encontrado');
    }

    // Verificar
    const camposOk = await page.evaluate(() => {
        const u = document.querySelector('input#username, input[name="username"]');
        const p = document.querySelector('input#password, input[name="password"]');
        return { user: u ? u.value : '(vacío)', pass: p ? p.value.length : 0 };
    });
    reportar(`Campos: usuario="${camposOk.user}" pass=${camposOk.pass} chars`);

    // Click Iniciar
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
            .find(b => /iniciar/i.test(b.textContent) && b.offsetParent !== null);
        if (btn) btn.click();
    });
    reportar('Click Iniciar (1er intento)');
    await new Promise(r => setTimeout(r, 8000));

    const getEstado = () => page.evaluate(() => {
        const txt = document.body.innerText || '';
        if (document.querySelector('input[type="checkbox"]') &&
            (txt.includes('superado') || txt.includes('sesiones') || txt.includes('Suprimir')))
            return 'checkpoint';
        if (txt.includes('Consola de despacho') || txt.includes('COMFICA') ||
            txt.includes('ZENER') || txt.includes('Buscar en actividades') ||
            document.querySelector('[role="tree"]'))
            return 'dashboard';
        if (txt.includes('incorrectos') || txt.includes('incorrecto') || txt.includes('Invalid'))
            return 'credenciales_incorrectas';
        return 'login_or_unknown';
    });

    let estado = await getEstado();
    reportar(`Estado post-click: ${estado}`);

    if (estado === 'credenciales_incorrectas') {
        const errTOA = await page.evaluate(() => {
            const m = (document.body.innerText || '').match(/[^\n]*(?:incorrectos?|Invalid)[^\n]*/i);
            return m ? m[0].trim() : '';
        }).catch(() => '');
        throw new Error(`LOGIN_FAILED: ${errTOA || 'Entorno, nombre de usuario o contraseña incorrectos'}`);
    }

    if (estado === 'dashboard') {
        reportar('Dashboard cargado OK.');
        await new Promise(r => setTimeout(r, 3000));
        return;
    }

    // Checkpoint: sesiones simultáneas
    if (estado === 'checkpoint') {
        reportar('Checkpoint sesiones — marcando "Suprimir sesion"...');
        await page.evaluate(() => {
            const cb = document.querySelector('input[type="checkbox"]');
            if (cb) {
                cb.scrollIntoView();
                cb.click();
                if (!cb.checked) {
                    cb.checked = true;
                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });
        await new Promise(r => setTimeout(r, 1000));

        const pw2 = await page.$('input[type="password"]');
        if (pw2) {
            await pw2.click({ clickCount: 3 });
            await page.keyboard.press('Backspace');
            await pw2.type(clave, { delay: 40 });
        }
        await new Promise(r => setTimeout(r, 500));

        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button'))
                .find(b => /iniciar/i.test(b.textContent) && b.offsetParent !== null);
            if (btn) btn.click();
        });
        reportar('Click Iniciar (2do intento)...');
    }

    // Esperar dashboard hasta 90s
    reportar('Esperando dashboard...');
    const ok = await page.waitForFunction(() => {
        const txt = document.body.innerText || '';
        return txt.includes('Consola de despacho') || txt.includes('COMFICA') ||
               txt.includes('ZENER') || txt.includes('Buscar en actividades') ||
               !!document.querySelector('[role="tree"]');
    }, { timeout: 90000 }).then(() => true).catch(() => false);

    if (ok) {
        reportar('Dashboard cargado OK.');
        await new Promise(r => setTimeout(r, 3000));
    } else {
        reportar('AVISO: Dashboard no confirmado tras 90s. Continuando...');
    }
}

// =============================================================================
// EXPORTS
// =============================================================================
if (require.main === module) {
    const fechaInicio  = process.env.BOT_FECHA_INICIO || null;
    const fechaFin     = process.env.BOT_FECHA_FIN    || null;
    const credenciales = {
        usuario: process.env.BOT_TOA_USER || '',
        clave:   process.env.BOT_TOA_PASS || ''
    };
    iniciarExtraccion(fechaInicio, fechaFin, credenciales)
        .then(() => process.exit(0))
        .catch(e => { console.error(e); process.exit(1); });
} else {
    module.exports = { iniciarExtraccion };
}

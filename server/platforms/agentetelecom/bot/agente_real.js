'use strict';

// =============================================================================
// AGENTE TOA v3 — Descarga vía API interna (sin UI scraping)
//
// Flujo:
//   1. Login con Puppeteer (ya probado y funcional)
//   2. Interceptar el primer XHR POST al endpoint Grid de TOA
//      → Capturamos el body exacto (cookies, CSRF, params) que TOA usa
//   3. Reutilizar ese body para CADA fecha × empresa
//      → Sólo cambiamos "date" y "gid" en el body
//   4. La respuesta JSON tiene activitiesRows[] con todos los campos
//   5. Guardar en MongoDB con upsert por ordenId+fecha+empresa
//
// Ventajas vs scraping:
//   - Sin Oracle JET, sin CSS selectors, sin scroll de grid
//   - Una sola llamada HTTP por empresa×día (vs 650+ celdas antes)
//   - Datos estructurados JSON directo desde la API de TOA
//   - 10x más rápido y 100% confiable
// =============================================================================

const puppeteer  = require('puppeteer');
const mongoose   = require('mongoose');
const path       = require('path');
const Actividad  = require('../models/Actividad');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const TOA_URL = process.env.TOA_URL || 'https://telefonica-cl.etadirect.com/';

// IDs de los buckets principales en TOA (data-group-id del sidebar DOM)
// Confirmados inspeccionando el DOM en vivo
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

    reportar(`[${modo}] ${fechasAProcesar[0]} -> ${fechasAProcesar[fechasAProcesar.length - 1]} (${fechasAProcesar.length} dias)`);

    let browser;
    try {
        reportar('Lanzando Chrome headless...');
        browser = await puppeteer.launch({
            headless: 'new',
            defaultViewport: { width: 1920, height: 1080 },
            args: [
                '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                '--no-first-run', '--no-zygote', '--disable-extensions',
                '--window-size=1920,1080', '--disable-blink-features=AutomationControlled'
            ]
        });

        const page = await browser.newPage();
        page.on('dialog', async d => await d.accept());
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        );

        // ── Interceptar requests para capturar el template del Grid API ────────
        await page.setRequestInterception(true);
        let gridTemplate = null; // { url, headers, postData }

        page.on('request', request => {
            const url = request.url();
            if (url.includes('Grid') && url.includes('ajax') && request.method() === 'POST') {
                if (!gridTemplate) {
                    gridTemplate = {
                        url:      request.url(),
                        headers:  request.headers(),
                        postData: request.postData() || ''
                    };
                    reportar(`Template Grid capturado OK (${gridTemplate.postData.length} chars)`);
                }
            }
            request.continue();
        });

        // ── Login ─────────────────────────────────────────────────────────────
        reportar('Iniciando sesion TOA...');
        await loginAtomico(page, credenciales, reportar);
        reportar('Login OK.');

        // ── Disparar el primer Grid request haciendo click en COMFICA ─────────
        reportar('Capturando template API — click COMFICA...');
        await new Promise(r => setTimeout(r, 3000));

        // Click en COMFICA para que TOA haga su primer Grid request
        const clickedOk = await page.evaluate(() => {
            const byGroupId = document.querySelector('[data-group-id="3840"]');
            if (byGroupId) { byGroupId.click(); return true; }
            // Fallback: buscar por texto
            const items = document.querySelectorAll('.edt-favorite-item, [class*="resource-groups"]');
            for (const el of items) {
                if (el.textContent.trim().startsWith('COMFICA')) { el.click(); return true; }
            }
            return false;
        });

        if (!clickedOk) {
            reportar('AVISO: No se pudo clickear COMFICA via data-group-id. Intentando fallback...');
            // Fallback: esperar a que aparezca y hacer click por texto
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
                'No se capturó el template del Grid API de TOA. ' +
                'El dashboard puede no haber cargado correctamente o el click en COMFICA falló.'
            );
        }

        reportar(`Template: ${gridTemplate.postData.substring(0, 100)}`);

        // ── Bucle principal: fecha × empresa ──────────────────────────────────
        let totalGuardados = 0;

        for (let i = 0; i < fechasAProcesar.length; i++) {
            const fecha = fechasAProcesar[i];

            if (process.send) {
                process.send({ type: 'progress', diaActual: i + 1, totalDias: fechasAProcesar.length, fechaProcesando: fecha });
            } else if (global.BOT_STATUS) {
                global.BOT_STATUS.diaActual       = i + 1;
                global.BOT_STATUS.fechaProcesando = fecha;
            }

            reportar(`[${i + 1}/${fechasAProcesar.length}] Fecha: ${fecha}`);

            for (const [empresa, bucketId] of Object.entries(BUCKET_IDS)) {
                try {
                    // Construir body modificando fecha y gid en el template
                    let postData = gridTemplate.postData;

                    // Reemplazar fecha (TOA usa YYYY/MM/DD con barras)
                    const fechaSlash = fecha.replace(/-/g, '/');
                    postData = postData.replace(/date=[^&\s]+/, `date=${encodeURIComponent(fechaSlash)}`);

                    // Reemplazar gid (group ID del bucket)
                    if (/gid=\d+/.test(postData)) {
                        postData = postData.replace(/gid=\d+/, `gid=${bucketId}`);
                    } else if (/rid=\d+/.test(postData)) {
                        postData = postData.replace(/rid=\d+/, `rid=${bucketId}`);
                    } else {
                        postData += `&gid=${bucketId}`;
                    }

                    // Ejecutar la llamada desde el contexto del browser
                    // (tiene cookies de sesión y CSRF token activos)
                    const resultado = await page.evaluate(
                        async (apiUrl, headers, body) => {
                            const res = await fetch(apiUrl, {
                                method:      'POST',
                                headers:     { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
                                body,
                                credentials: 'include'
                            });
                            if (!res.ok) return { error: `HTTP ${res.status}`, activitiesRows: [] };
                            return res.json();
                        },
                        gridTemplate.url,
                        gridTemplate.headers,
                        postData
                    );

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

                } catch (err) {
                    reportar(`  ${empresa}: ERROR — ${err.message}`);
                }
            }
        }

        reportar(`DESCARGA COMPLETADA. Total guardados: ${totalGuardados} registros.`);
        if (process.send)      process.send({ type: 'log', text: 'COMPLETADO', completed: true });
        if (global.BOT_STATUS) global.BOT_STATUS.running = false;

    } catch (error) {
        const errMsg = error.message || 'Error desconocido';
        reportar(`ERROR FATAL: ${errMsg}`);
        console.error('ERROR FATAL:', error);
        if (global.BOT_STATUS) {
            global.BOT_STATUS.ultimoError = errMsg;
            global.BOT_STATUS.running     = false;
        }
    } finally {
        process.env.BOT_ACTIVE_LOCK = 'OFF';
        if (browser) {
            await new Promise(r => setTimeout(r, 2000));
            await browser.close().catch(() => {});
        }
    }
};

// =============================================================================
// GUARDAR ACTIVIDADES EN MONGODB
// Mapea la respuesta JSON de la API de TOA al modelo Actividad
// =============================================================================
async function guardarActividades(rows, empresa, fecha, bucketId, empresaRef) {
    if (!mongoose.connection.readyState) {
        await mongoose.connect(process.env.MONGO_URI);
    }

    const ops = rows.map(row => {
        // La API de TOA retorna campos con nombre (service_window, pname, etc.)
        // y campos numéricos (144, 272, 362...) que son custom fields
        const ordenId = row.key || row['144'] || row.appt_number || `${empresa}_${fecha}_${JSON.stringify(row).length}`;

        const doc = {
            ordenId,
            empresa,
            fecha:           new Date(fecha + 'T00:00:00Z'),
            bucketId,

            // Técnico / Resource
            tecnico:         row.pname        || '',

            // Identificación de la orden
            numeroOrden:     row.appt_number  || row['144'] || '',
            estado:          row.astatus      || '',
            tipoTrabajo:     row.aworktype    || '',

            // Ventanas de tiempo
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

            // Métricas operativas
            duracion:        row.length || '',
            viaje:           row.travel || '',
            puntos:          row.apoints || '',

            // Campos custom numéricos de TOA (conservar para análisis)
            camposCustom: Object.fromEntries(
                Object.entries(row).filter(([k]) => /^\d+$/.test(k))
            ),

            // Raw completo para trazabilidad
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
// Flujo confirmado por inspección en vivo del DOM:
//   1. goto TOA_URL
//   2. Cerrar dialog "Timeout de sesión" si existe
//   3. Llenar input#username + input#password con click triple + type
//   4. Click "Iniciar" (1er intento)
//   5. Esperar 8s → detectar estado: dashboard | checkpoint | credenciales_incorrectas
//   6. Si checkpoint: marcar checkbox → re-llenar password → click Iniciar 2do
//   7. Esperar dashboard hasta 90s
// =============================================================================
async function loginAtomico(page, credenciales = {}, reportar = console.log) {
    const usuario = credenciales.usuario || process.env.BOT_TOA_USER || '';
    const clave   = credenciales.clave   || process.env.BOT_TOA_PASS  || '';

    if (!usuario) throw new Error('LOGIN_FAILED: usuario TOA no configurado');
    if (!clave)   throw new Error('LOGIN_FAILED: contraseña TOA no configurada');

    reportar(`Login: usuario="${usuario}" (${clave.length} chars clave)`);

    await page.goto(TOA_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await new Promise(r => setTimeout(r, 3000));

    // Cerrar dialog de timeout de sesión si existe
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

    // Esperar campo de contraseña
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

    // Llenar usuario
    const userField = await page.$('input#username, input[name="username"]').catch(() => null);
    if (userField) {
        reportar(`Llenando usuario (${usuario})...`);
        await llenarCampo(userField, usuario);
    } else {
        throw new Error('LOGIN_FAILED: campo usuario no encontrado en formulario TOA');
    }

    // Llenar contraseña
    reportar('Llenando contraseña...');
    const passField = await page.$('input#password, input[name="password"]').catch(() => null);
    if (passField) {
        await llenarCampo(passField, clave);
    } else {
        throw new Error('LOGIN_FAILED: campo contraseña no encontrado en formulario TOA');
    }

    // Verificar campos
    const camposOk = await page.evaluate(() => {
        const u = document.querySelector('input#username, input[name="username"]');
        const p = document.querySelector('input#password, input[name="password"]');
        return { user: u ? u.value : '(vacío)', pass: p ? p.value.length : 0 };
    });
    reportar(`Campos verificados: usuario="${camposOk.user}" pass=${camposOk.pass} chars`);

    // Click "Iniciar" primer intento
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
            .find(b => /iniciar/i.test(b.textContent) && b.offsetParent !== null);
        if (btn) btn.click();
    });
    reportar('Click Iniciar (1er intento)');
    await new Promise(r => setTimeout(r, 8000));

    // Detectar estado
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
        reportar('AVISO: Checkpoint sesiones — marcando "Suprimir sesion"...');
        await page.evaluate(() => {
            const cb = document.querySelector('input[type="checkbox"]');
            if (cb) { cb.scrollIntoView(); cb.click(); if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); } }
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
    const fechaInicio = process.env.BOT_FECHA_INICIO || null;
    const fechaFin    = process.env.BOT_FECHA_FIN    || null;
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

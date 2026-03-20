const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const path = require('path');
const Actividad = require('../models/Actividad');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

// =============================================================================
// TOA AGENTE v5 — Estrategia Grid API
//
// Flujo:
//   1. Login con teclado real (ElementHandle.type → Oracle JET/KnockoutJS)
//   2. Activar request interception ANTES del dashboard para capturar Grid XHR
//   3. Repetir ese request para cada fecha × bucket (sin navegar la UI)
//
// Buckets (data-group-id en el sidebar TOA):
//   COMFICA=3840  |  ZENER RANCAGUA=3842  |  ZENER RM=3841
// =============================================================================

const BUCKETS = [
    { nombre: 'COMFICA',        gid: 3840 },
    { nombre: 'ZENER RANCAGUA', gid: 3842 },
    { nombre: 'ZENER RM',       gid: 3841 }
];

// -----------------------------------------------------------------------------
// PUNTO DE ENTRADA
// -----------------------------------------------------------------------------
const iniciarExtraccion = async (fechaManual = null, rangoFin = null, credenciales = {}) => {
    process.env.BOT_ACTIVE_LOCK = 'TOA';

    // Construir lista de fechas
    const fechas = [];
    if (fechaManual && rangoFin) {
        let cur = new Date(fechaManual + 'T00:00:00Z');
        const end = new Date(rangoFin + 'T00:00:00Z');
        while (cur <= end) {
            fechas.push(cur.toISOString().split('T')[0]);
            cur.setUTCDate(cur.getUTCDate() + 1);
        }
    } else if (fechaManual) {
        fechas.push(fechaManual);
    } else {
        // Backfill desde 2026-01-01 hasta hoy
        let cur = new Date(Date.UTC(2026, 0, 1));
        const end = new Date();
        end.setUTCHours(0, 0, 0, 0);
        while (cur <= end) {
            fechas.push(cur.toISOString().split('T')[0]);
            cur.setUTCDate(cur.getUTCDate() + 1);
        }
    }

    const totalDias   = fechas.length;
    const empresaRef  = process.env.BOT_EMPRESA_REF || null;
    const modo        = fechaManual && rangoFin ? 'RANGO' : fechaManual ? 'DÍA' : 'BACKFILL';

    const reportar = (msg, extra = {}) => {
        const entry = `[${new Date().toLocaleTimeString('es-CL')}] ${msg}`;
        console.log('🤖', msg);
        if (process.send) process.send({ type: 'log', text: entry, ...extra });
    };

    reportar(`🚀 [${modo}] ${fechas[0]} → ${fechas[fechas.length - 1]} (${totalDias} días)`);

    let browser;
    try {
        // ----- Lanzar Chrome -----
        reportar('🌐 Iniciando Chrome...');
        browser = await puppeteer.launch({
            headless: true,
            defaultViewport: { width: 1920, height: 1080 },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--no-first-run',
                '--no-zygote',
                '--disable-extensions',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1920,1080'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        );
        page.on('dialog', async d => { try { await d.accept(); } catch (e) {} });

        // ----- Activar interception ANTES del login para no perderse el primer Grid XHR -----
        let gridTemplate = null;
        await page.setRequestInterception(true);
        page.on('request', req => {
            try {
                const url = req.url();
                if (
                    !gridTemplate &&
                    req.method() === 'POST' &&
                    url.includes('m=Grid') &&
                    url.includes('output=ajax')
                ) {
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

        // ----- Login -----
        reportar('🔐 Iniciando sesión TOA...');
        await loginAtomico(page, credenciales, reportar);
        reportar('✅ Login completado. Esperando dashboard...');

        // ----- Esperar dashboard completamente cargado -----
        const dashOk = await esperarDashboard(page, 60000);
        if (dashOk) {
            reportar('✅ Dashboard cargado.');
        } else {
            reportar('⚠️ Dashboard no confirmado, esperando 15s adicionales...');
            await new Promise(r => setTimeout(r, 15000));
        }

        // ----- Si no captamos el template en el login, clicar COMFICA para dispararlo -----
        if (!gridTemplate) {
            reportar('🖱️ Disparando Grid XHR al hacer click en COMFICA...');
            await page.evaluate(() => {
                // Intento 1: data-group-id
                const el = document.querySelector('[data-group-id="3840"]');
                if (el) { el.click(); return; }
                // Intento 2: texto en sidebar
                const items = Array.from(document.querySelectorAll('span,li,div,a'));
                const found = items.find(e => {
                    const r = e.getBoundingClientRect();
                    return r.left < 450 && r.width > 0 && r.height > 0 &&
                           e.innerText && e.innerText.trim().toUpperCase().includes('COMFICA');
                });
                if (found) found.click();
            });

            // Esperar hasta 20 segundos
            for (let i = 0; i < 20 && !gridTemplate; i++) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        // Desactivar interception — ya no la necesitamos
        await page.setRequestInterception(false);

        if (!gridTemplate) {
            throw new Error(
                'No se capturó el template del Grid API. ' +
                'Verifica que COMFICA (gid=3840) esté visible en el sidebar de TOA.'
            );
        }

        reportar(`📝 PostData muestra: ${gridTemplate.postData.substring(0, 180)}`);

        // ----- Bucle principal: fechas × buckets -----
        let totalGuardados = 0;

        for (let di = 0; di < fechas.length; di++) {
            const fecha = fechas[di];

            if (process.send) {
                process.send({ type: 'progress', diaActual: di + 1, fechaProcesando: fecha });
            }

            if (di % 5 === 0 || di === fechas.length - 1) {
                reportar(`📅 [${di + 1}/${totalDias}] ${fecha}`);
            }

            for (const bucket of BUCKETS) {
                const rows = await llamarGridAPI(page, gridTemplate, fecha, bucket.gid, reportar);

                if (rows === null) {
                    // Error de API — loguear y continuar
                    reportar(`⚠️ Sin respuesta [${bucket.nombre}/${fecha}]`);
                    continue;
                }

                if (rows.length === 0) continue; // Normal — sin actividades ese día

                const guardados = await guardarRegistros(rows, fecha, bucket.nombre, empresaRef, reportar);
                totalGuardados += guardados;

                if (guardados > 0) {
                    reportar(`💾 [${bucket.nombre}] ${fecha}: +${guardados} registros`);
                }

                // Pequeño delay para no saturar la sesión
                await new Promise(r => setTimeout(r, 400));
            }
        }

        reportar(`\n🏁 ¡COMPLETADO! ${totalGuardados} registros guardados.`);
        if (process.send) process.send({ type: 'log', text: '🏁 COMPLETADO', completed: true });

    } catch (err) {
        const msg = err.message || 'Error desconocido';
        reportar(`❌ ERROR FATAL: ${msg}`);
        console.error('❌ ERROR FATAL:', err);
        if (process.send) process.send({ type: 'log', text: `❌ ERROR FATAL: ${msg}`, error: true });
    } finally {
        process.env.BOT_ACTIVE_LOCK = 'OFF';
        if (browser) {
            try { await browser.close(); } catch (e) {}
        }
    }
};

// =============================================================================
// LLAMAR GRID API — Repetir el template capturado con nueva fecha y gid
// =============================================================================
async function llamarGridAPI(page, template, fechaISO, gid, reportar) {
    try {
        // Construir nuevo postData
        let postData = template.postData;

        // Reemplazar gid
        postData = postData.replace(/gid=\d+/, `gid=${gid}`);

        // Reemplazar fecha en el formato que usa TOA
        const fechaFormateada = formatearFechaParaTOA(fechaISO, template.postData);
        if (fechaFormateada) {
            postData = postData.replace(/date=[^&\s]+/, `date=${encodeURIComponent(fechaFormateada)}`);
        }

        // Ejecutar fetch desde el contexto del browser (lleva cookies de sesión)
        const resultado = await page.evaluate(async (url, headers, body) => {
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body,
                    credentials: 'include'
                });
                if (!res.ok) return { ok: false, status: res.status };
                const data = await res.json();
                return { ok: true, data };
            } catch (e) {
                return { ok: false, error: e.message };
            }
        }, template.url, template.headers, postData);

        if (!resultado.ok) {
            if (resultado.status === 401 || resultado.status === 403) {
                reportar(`⚠️ Sesión expirada (HTTP ${resultado.status}) — abortando`);
                throw new Error('SESSION_EXPIRED');
            }
            return null;
        }

        return resultado.data.activitiesRows || [];

    } catch (e) {
        if (e.message === 'SESSION_EXPIRED') throw e;
        reportar(`❌ llamarGridAPI: ${e.message}`);
        return null;
    }
}

// =============================================================================
// DETECCIÓN Y FORMATEO DE FECHA PARA TOA
// =============================================================================
function extraerFechaDePostData(postData) {
    const match = postData.match(/date=([^&\s]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

function formatearFechaParaTOA(fechaISO, postDataOrigen) {
    const [yyyy, mm, dd] = fechaISO.split('-');
    const fechaEnTemplate = extraerFechaDePostData(postDataOrigen);

    if (!fechaEnTemplate) return `${mm}/${dd}/${yyyy}`; // Formato USA por defecto

    const partes = fechaEnTemplate.split('/');
    if (partes.length !== 3) {
        // Podría ser YYYY-MM-DD
        if (/-/.test(fechaEnTemplate)) return fechaISO;
        return `${mm}/${dd}/${yyyy}`;
    }

    // Detectar si es DD/MM/YYYY o MM/DD/YYYY
    if (parseInt(partes[0]) > 12) return `${dd}/${mm}/${yyyy}`; // DD/MM/YYYY
    if (parseInt(partes[1]) > 12) return `${mm}/${dd}/${yyyy}`; // MM/DD/YYYY
    return `${mm}/${dd}/${yyyy}`; // Ambiguo → USA
}

// =============================================================================
// GUARDAR REGISTROS EN MONGODB
// =============================================================================
async function guardarRegistros(rows, fechaISO, bucketNombre, empresaRef, reportar) {
    const registros = rows.map(row => {
        const doc = {
            ordenId:              String(row.appt_number || row.key || '').trim(),
            fecha:                new Date(`${fechaISO}T12:00:00.000Z`),
            bucket:               bucketNombre,
            recurso:              row.pname            || '',
            'Número de Petición': row.appt_number      || '',
            'Estado':             row.astatus           || '',
            'Ventana de servicio':  row.service_window || '',
            'Ventana de Llegada':   row.delivery_window || '',
            'Nombre':             row.cname             || '',
            'RUT del cliente':    row.customer_number   || '',
            'Subtipo de Actividad': row.aworktype       || '',
            'Ciudad':             row.ccity             || '',
            latitud:  row.acoord_y != null ? String(row.acoord_y) : null,
            longitud: row.acoord_x != null ? String(row.acoord_x) : null,
            ultimaActualizacion: new Date()
        };

        // Incluir todos los demás campos que devuelva la API
        Object.entries(row).forEach(([k, v]) => {
            if (!(k in doc) && v !== null && v !== undefined && v !== '') {
                doc[k] = v;
            }
        });

        if (empresaRef) doc.empresaRef = empresaRef;
        return doc;
    }).filter(r => r.ordenId && r.ordenId.length > 2);

    if (registros.length === 0) return 0;

    try {
        const ops = registros.map(r => ({
            updateOne: {
                filter: { ordenId: r.ordenId },
                update: { $set: r },
                upsert: true
            }
        }));
        const result = await Actividad.bulkWrite(ops, { ordered: false });
        return (result.upsertedCount || 0) + (result.modifiedCount || 0);
    } catch (e) {
        reportar(`❌ MongoDB [${bucketNombre}/${fechaISO}]: ${e.message}`);
        return 0;
    }
}

// =============================================================================
// LOGIN TOA — Usa ElementHandle.type() para generar eventos de teclado reales.
// Oracle JET / KnockoutJS ignora element.value = x; requiere keydown/keypress/keyup.
// =============================================================================
async function loginAtomico(page, credenciales, reportar) {
    const usuario = credenciales.usuario || process.env.BOT_TOA_USER || process.env.TOA_USER_REAL;
    const clave   = credenciales.clave   || process.env.BOT_TOA_PASS  || process.env.TOA_PASS_REAL;
    const toaUrl  = process.env.TOA_URL  || 'https://telefonica-cl.etadirect.com/';

    if (!usuario || !clave) throw new Error('LOGIN_FAILED: No hay credenciales configuradas');

    reportar(`Login: usuario="${usuario}" (${clave.length} chars clave)`);

    // 1. Navegar a TOA
    await page.goto(toaUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 2. Esperar formulario
    await page.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    reportar('Esperando formulario login...');

    // 3. Llenar usuario con teclado real
    reportar(`Llenando usuario (${usuario})...`);
    const userInput = await page.$(
        'input:not([type="password"]):not([type="checkbox"]):not([type="hidden"]):not([type="submit"])'
    );
    if (!userInput) throw new Error('LOGIN_FAILED: Campo usuario no encontrado');
    await userInput.click({ clickCount: 3 });
    await new Promise(r => setTimeout(r, 200));
    await userInput.type(usuario, { delay: 50 });
    await new Promise(r => setTimeout(r, 300));

    // 4. Llenar contraseña con teclado real
    reportar('Llenando contraseña...');
    const passInput = await page.$('input[type="password"]');
    if (!passInput) throw new Error('LOGIN_FAILED: Campo contraseña no encontrado');
    await passInput.click({ clickCount: 3 });
    await new Promise(r => setTimeout(r, 200));
    await passInput.type(clave, { delay: 50 });
    await new Promise(r => setTimeout(r, 300));

    // 5. Verificar que los campos tienen valor
    const usuarioLlenado = await userInput.evaluate(el => el.value).catch(() => '');
    const passLen        = await passInput.evaluate(el => el.value.length).catch(() => 0);
    reportar(`Campos: usuario="${usuarioLlenado}" pass=${passLen} chars`);

    // 6. Primer click en "Iniciar"
    await clickBotonIniciar(page);
    reportar('Click Iniciar (1er intento)');

    // 7. Polling del resultado (más robusto que Promise.race con eventos de Puppeteer)
    let estado = 'timeout';
    for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 1500));
        try {
            const result = await page.evaluate(() => {
                if (
                    document.querySelector('oj-navigation-list') ||
                    document.querySelector('[role="tree"]')
                ) return 'dashboard';

                if (document.querySelector('input[type="checkbox"]')) return 'checkpoint';

                const body = (document.body && document.body.innerText) || '';
                if (
                    body.includes('Entorno, nombre de usuario') ||
                    body.includes('incorrectos') ||
                    body.includes('invalid credentials') ||
                    body.includes('nombre de usuario o contraseña')
                ) return 'credenciales_incorrectas';

                return null;
            });
            if (result) { estado = result; break; }
        } catch (e) {
            // Contexto destruido durante navegación — ignorar y seguir
        }
    }

    reportar(`Estado post-click: ${estado}`);

    // ----- Ramas del resultado -----
    if (estado === 'dashboard') {
        reportar('✅ Login directo (sin checkpoint).');
        return;
    }

    if (estado === 'credenciales_incorrectas') {
        throw new Error('LOGIN_FAILED: Entorno, nombre de usuario o contraseña incorrectos');
    }

    if (estado === 'checkpoint') {
        reportar('⚠️ Checkpoint — marcando "Suprimir sesión más antigua"...');

        const cb = await page.$('input[type="checkbox"]');
        if (cb) {
            await cb.evaluate(el => el.scrollIntoView({ block: 'center' }));
            await new Promise(r => setTimeout(r, 300));
            await cb.click();
            await new Promise(r => setTimeout(r, 300));
            // Forzar checked via JS por si el click no activó el binding
            await cb.evaluate(el => {
                if (!el.checked) {
                    el.checked = true;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
            await new Promise(r => setTimeout(r, 500));
        }

        // Re-llenar campos (Oracle JET los puede limpiar al hacer el checkpoint)
        const userInput2 = await page.$(
            'input:not([type="password"]):not([type="checkbox"]):not([type="hidden"]):not([type="submit"])'
        );
        const passInput2 = await page.$('input[type="password"]');

        if (userInput2) {
            await userInput2.click({ clickCount: 3 });
            await new Promise(r => setTimeout(r, 150));
            await userInput2.type(usuario, { delay: 40 });
            await new Promise(r => setTimeout(r, 200));
        }
        if (passInput2) {
            await passInput2.click({ clickCount: 3 });
            await new Promise(r => setTimeout(r, 150));
            await passInput2.type(clave, { delay: 40 });
            await new Promise(r => setTimeout(r, 200));
        }

        await clickBotonIniciar(page);
        reportar('Click Iniciar (2do intento)');

        const ok = await esperarDashboard(page, 70000);
        if (ok) {
            reportar('✅ Login completado con checkpoint.');
        } else {
            reportar('⚠️ Dashboard no confirmado tras checkpoint — continuando de todas formas...');
            await new Promise(r => setTimeout(r, 15000));
        }
        return;
    }

    // TIMEOUT: continuar igual, el dashboard puede seguir cargando
    reportar('⚠️ Timeout esperando estado de login. Continuando...');
    await new Promise(r => setTimeout(r, 15000));
}

// =============================================================================
// HELPERS
// =============================================================================
async function clickBotonIniciar(page) {
    const coords = await page.evaluate(() => {
        const btn = (
            Array.from(document.querySelectorAll('button, input[type="submit"]'))
                .find(b => /iniciar|sign in|login|entrar/i.test(b.textContent || b.value || ''))
        ) || document.querySelector('button[type="submit"]')
          || document.querySelectorAll('button')[0];

        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    });

    if (coords) {
        await page.mouse.move(coords.x, coords.y);
        await page.mouse.down();
        await new Promise(r => setTimeout(r, 150));
        await page.mouse.up();
    } else {
        await page.keyboard.press('Enter');
    }
    await new Promise(r => setTimeout(r, 400));
}

function esperarDashboard(page, timeout) {
    return page.waitForFunction(() => {
        return !!(
            document.querySelector('oj-navigation-list') ||
            document.querySelector('.oj-navigation-list') ||
            document.querySelector('[role="tree"]')
        );
    }, { timeout }).then(() => true).catch(() => false);
}

// =============================================================================
// EXPORTS + EJECUCIÓN DIRECTA (fork o CLI)
// =============================================================================
module.exports = { iniciarExtraccion };

if (require.main === module) {
    const creds = {
        usuario: process.env.BOT_TOA_USER || process.env.TOA_USER_REAL,
        clave:   process.env.BOT_TOA_PASS  || process.env.TOA_PASS_REAL
    };
    mongoose.connect(process.env.MONGO_URI)
        .then(() => {
            console.log('✅ MongoDB conectado. Iniciando bot...');
            return iniciarExtraccion(
                process.env.BOT_FECHA_INICIO || null,
                process.env.BOT_FECHA_FIN    || null,
                creds
            );
        })
        .catch(err => {
            console.error('❌ MongoDB:', err.message);
            process.exit(1);
        });
}

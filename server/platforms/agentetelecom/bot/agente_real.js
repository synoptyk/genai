'use strict';

// =============================================================================
// TOA AGENTE v6 — DOS ETAPAS
//
// ETAPA 1 (Scan):
//   1. Login con Chrome headless
//   2. Escanear sidebar → detectar todos los grupos/buckets con su nombre + ID
//   3. Clicar el primer grupo encontrado → capturar template Grid XHR
//   4. Extraer cookies de sesión + CSRF token
//   5. Cerrar Chrome (libera RAM)
//   6. Enviar lista de grupos al servidor → esperar selección del usuario (120s)
//
// ETAPA 2 (Extracción):
//   7. Recibir grupos seleccionados por el usuario via IPC
//   8. Para cada fecha × grupo: llamar al Grid API con Node.js https (sin Chrome)
//   9. Guardar en MongoDB con upsert
// =============================================================================

const puppeteer = require('puppeteer');
const mongoose  = require('mongoose');
const path      = require('path');
const https     = require('https');
const http      = require('http');
const Actividad = require('../models/Actividad');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const TOA_URL = process.env.TOA_URL || 'https://telefonica-cl.etadirect.com/';

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

    let browser      = null;
    let gridTemplate = null;
    let sessionCookies = '';
    let csrfToken    = '';

    try {
        // ── ETAPA 1: Chrome → login → scan → capturar template ────────────────
        reportar('🌐 Lanzando Chrome (modo ligero)...');
        browser = await puppeteer.launch({
            headless: 'new',
            defaultViewport: { width: 1280, height: 800 },
            args: [
                '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                '--no-first-run', '--no-zygote', '--disable-extensions',
                '--disable-blink-features=AutomationControlled',
                '--disable-gpu', '--disable-software-rasterizer',
                '--disable-sync', '--disable-translate', '--disable-plugins',
                '--disk-cache-size=1', '--media-cache-size=1',
                '--window-size=1280,800'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        page.on('dialog', async d => { try { await d.accept(); } catch (_) {} });

        // Interceptar: bloquear assets pesados + capturar Grid XHR
        await page.setRequestInterception(true);
        page.on('request', req => {
            try {
                const rt  = req.resourceType();
                const url = req.url();
                // Bloquear recursos visuales innecesarios para ahorrar RAM
                if (['image', 'stylesheet', 'font', 'media', 'other'].includes(rt)) {
                    req.abort(); return;
                }
                // Capturar el primer POST al Grid API como template
                if (!gridTemplate && req.method() === 'POST' &&
                    url.includes('m=Grid') && url.includes('output=ajax')) {
                    const body = req.postData() || '';
                    if (body.length > 10) {
                        gridTemplate = { url, headers: req.headers(), postData: body };
                        reportar(`✅ Template Grid capturado (${body.length} chars)`);
                    }
                }
                req.continue();
            } catch (e) { try { req.continue(); } catch (_) {} }
        });

        // Login
        reportar('🔐 Iniciando sesión TOA...');
        await loginAtomico(page, credenciales, reportar);
        reportar('✅ Login OK — escaneando sidebar...');
        await new Promise(r => setTimeout(r, 4000)); // Esperar que cargue el dashboard

        // ── SCAN: detectar todos los grupos del sidebar ────────────────────────
        const gruposEncontrados = await scanearSidebar(page, reportar);
        reportar(`📋 ${gruposEncontrados.length} grupos detectados en el sidebar`);

        // Si no se capturó el template, hacer click en el primer grupo con ID
        if (!gridTemplate && gruposEncontrados.length > 0) {
            const primerConId = gruposEncontrados.find(g => g.id);
            if (primerConId) {
                reportar(`🖱️ Disparando Grid XHR (click en "${primerConId.nombre}")...`);
                await page.evaluate((gid) => {
                    const el = document.querySelector(`[data-group-id="${gid}"]`);
                    if (el) el.click();
                }, primerConId.id);
            } else {
                // Sin IDs: intentar click en el primer ítem visible del sidebar
                reportar('🖱️ Sin data-group-id — intentando click en primer ítem...');
                await page.evaluate(() => {
                    const sels = ['oj-navigation-list li', '[role="treeitem"]', '[class*="nav-item"]'];
                    for (const sel of sels) {
                        const el = document.querySelector(sel);
                        if (el) { el.click(); return; }
                    }
                });
            }

            for (let i = 0; i < 15 && !gridTemplate; i++) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        // Extraer cookies + CSRF ANTES de cerrar Chrome
        reportar('🍪 Extrayendo cookies de sesión...');
        const rawCookies = await page.cookies();
        sessionCookies = rawCookies.map(c => `${c.name}=${c.value}`).join('; ');
        reportar(`   ${rawCookies.length} cookies extraídas`);

        csrfToken = await page.evaluate(() =>
            window.CSRFSecureToken || window.csrf_token || ''
        ).catch(() => '');

        if (!csrfToken && gridTemplate) {
            csrfToken = gridTemplate.headers['x-ofs-csrf-secure'] || '';
        }
        if (csrfToken) reportar(`🔑 CSRF: ${csrfToken.substring(0, 20)}...`);
        else reportar('⚠️ CSRF no encontrado (puede que no sea necesario)');

        // CERRAR Chrome — ya no se necesita
        await browser.close(); browser = null;
        reportar('✅ Chrome cerrado — esperando selección de grupos...');

        // ── Enviar lista al frontend y esperar confirmación del usuario ──────────
        if (process.send) {
            process.send({ type: 'grupos_encontrados', grupos: gruposEncontrados });
        } else if (global.BOT_STATUS) {
            global.BOT_STATUS.gruposEncontrados  = gruposEncontrados;
            global.BOT_STATUS.esperandoSeleccion = true;
        }

        // Esperar hasta 120 segundos a que el usuario confirme los grupos
        const gruposSeleccionados = await esperarConfirmacion(120000, reportar);
        reportar(`✅ ${gruposSeleccionados.length} grupos confirmados por el usuario`);

        if (gruposSeleccionados.length === 0) {
            throw new Error('El usuario no seleccionó ningún grupo para descargar');
        }

        if (!gridTemplate) {
            throw new Error('No se capturó el template Grid. Intenta de nuevo.');
        }

        // ── ETAPA 2: Extracción con Node.js https (sin Chrome) ────────────────
        reportar(`\n📡 ETAPA 2: Extrayendo ${fechasAProcesar.length} días × ${gruposSeleccionados.length} grupos...`);
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

            for (const grupo of gruposSeleccionados) {
                if (!grupo.id) { reportar(`  ⚠️ ${grupo.nombre}: sin ID de bucket, omitiendo`); continue; }
                try {
                    let postData = gridTemplate.postData;
                    const fechaFmt = formatearFechaParaTOA(fecha, postData);
                    postData = postData.replace(/date=[^&\s]+/, `date=${encodeURIComponent(fechaFmt)}`);
                    if (/gid=\d+/.test(postData)) postData = postData.replace(/gid=\d+/, `gid=${grupo.id}`);
                    else if (/rid=\d+/.test(postData)) postData = postData.replace(/rid=\d+/, `rid=${grupo.id}`);
                    else postData += `&gid=${grupo.id}`;

                    const resultado = await httpPost(gridTemplate.url, postData, sessionCookies, csrfToken);
                    if (resultado.error) { reportar(`  ⚠️ ${grupo.nombre}: ${resultado.error}`); continue; }

                    const rows = resultado.activitiesRows || [];
                    if (rows.length > 0) {
                        const guardados = await guardarActividades(rows, grupo.nombre, fecha, grupo.id, empresaRef);
                        totalGuardados += guardados;
                        reportar(`  💾 ${grupo.nombre}: ${rows.length} actividades → ${guardados} guardadas`);
                    }

                    await new Promise(r => setTimeout(r, 300));
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
        if (browser) await browser.close().catch(() => {});
    }
};

// =============================================================================
// SCAN DEL SIDEBAR TOA
// =============================================================================
async function scanearSidebar(page, reportar) {
    reportar('🔍 Escaneando sidebar para grupos y buckets...');

    const grupos = await page.evaluate(() => {
        const encontrados = [];
        const vistosIds   = new Set();
        const vistosNom   = new Set();

        // ── Método 1: data-group-id (más confiable) ──
        document.querySelectorAll('[data-group-id]').forEach(el => {
            const gid = el.getAttribute('data-group-id');
            if (!gid || vistosIds.has(gid)) return;
            vistosIds.add(gid);

            // Extraer nombre del label interno
            const labelEl = el.querySelector('[class*="label"], [class*="title"], [aria-label], span');
            const nombre  = (labelEl?.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || el.textContent)
                ?.trim().replace(/\s+/g, ' ').slice(0, 80) || `Grupo ${gid}`;

            const rect = el.getBoundingClientRect();
            encontrados.push({ id: gid, nombre, visible: rect.width > 0 && rect.height > 0 });
        });

        // ── Método 2: Oracle JET treeitem sin data-group-id ──
        if (encontrados.length === 0) {
            const selectorsPrueba = [
                'oj-navigation-list [role="treeitem"]',
                '[class*="oj-navigationlist"] li[class*="item"]',
                '[class*="oj-treeview"] li',
                '[role="tree"] [role="treeitem"]',
                'li[class*="edt-favorite"]',
                '[class*="resource-group"]',
                '[class*="sidebar"] li'
            ];
            for (const sel of selectorsPrueba) {
                document.querySelectorAll(sel).forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;
                    const texto = (el.textContent || '').trim().replace(/\s+/g, ' ');
                    if (!texto || texto.length < 2 || texto.length > 100 || vistosNom.has(texto)) return;
                    vistosNom.add(texto);
                    encontrados.push({ id: null, nombre: texto, visible: true });
                });
                if (encontrados.length > 0) break;
            }
        }

        // ── Método 3: cualquier elemento con texto en la franja izquierda (<350px) ──
        if (encontrados.length === 0) {
            const todos = Array.from(document.querySelectorAll('li, div[class*="item"], span[class*="item"]'));
            todos.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.left > 350 || rect.width < 50 || rect.height < 15) return;
                const texto = (el.textContent || '').trim().replace(/\s+/g, ' ');
                if (!texto || texto.length < 3 || texto.length > 80 || vistosNom.has(texto)) return;
                // Filtrar elementos que son contenedores con demasiado texto
                if (texto.split(' ').length > 8) return;
                vistosNom.add(texto);
                encontrados.push({ id: null, nombre: texto, visible: true });
            });
        }

        return encontrados.slice(0, 30); // máximo 30
    });

    grupos.forEach((g, i) => {
        reportar(`   [${i + 1}] ${g.visible ? '👁' : '○'} "${g.nombre}" ${g.id ? `(ID: ${g.id})` : '(sin ID)'}`);
    });

    return grupos;
}

// =============================================================================
// ESPERAR CONFIRMACIÓN DEL USUARIO (via IPC del proceso padre)
// =============================================================================
function esperarConfirmacion(timeoutMs, reportar) {
    return new Promise((resolve, reject) => {
        reportar(`⏳ Esperando que el usuario seleccione los grupos (máx. ${timeoutMs / 1000}s)...`);

        const timer = setTimeout(() => {
            reject(new Error(`Timeout ${timeoutMs / 1000}s: no se recibió selección de grupos`));
        }, timeoutMs);

        // Si estamos en modo fork, esperar mensaje IPC del padre
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
            // Modo standalone: polling de global.BOT_STATUS.gruposConfirmados
            const poll = setInterval(() => {
                if (global.BOT_STATUS && global.BOT_STATUS.gruposConfirmados) {
                    clearTimeout(timer);
                    clearInterval(poll);
                    const grupos = global.BOT_STATUS.gruposConfirmados;
                    delete global.BOT_STATUS.gruposConfirmados;
                    resolve(grupos);
                }
            }, 1000);
        }
    });
}

// =============================================================================
// FORMATEAR FECHA PARA TOA (detecta formato del template)
// =============================================================================
function formatearFechaParaTOA(fechaISO, postDataOrigen) {
    const [yyyy, mm, dd] = fechaISO.split('-');
    const match = postDataOrigen.match(/date=([^&\s]+)/);
    if (!match) return `${mm}/${dd}/${yyyy}`;
    const f = decodeURIComponent(match[1]);
    if (/-/.test(f)) return fechaISO;
    const partes = f.split('/');
    if (partes.length !== 3) return `${mm}/${dd}/${yyyy}`;
    return parseInt(partes[0]) > 12 ? `${dd}/${mm}/${yyyy}` : `${mm}/${dd}/${yyyy}`;
}

// =============================================================================
// HTTP POST — Grid API con cookies de sesión (sin Chrome)
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
                'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'X-Requested-With': 'XMLHttpRequest',
                'Accept':           'application/json, text/javascript, */*; q=0.01',
                'Referer':          TOA_URL,
                ...(csrfToken ? { 'X-OFS-CSRF-SECURE': csrfToken } : {})
            }
        };
        const lib = isHttps ? https : http;
        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 400) { resolve({ error: `HTTP ${res.statusCode}`, activitiesRows: [] }); return; }
                try { resolve(JSON.parse(data)); } catch (e) { resolve({ error: `JSON: ${e.message}`, activitiesRows: [] }); }
            });
        });
        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout 30s')); });
        req.write(body); req.end();
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
// LOGIN TOA — teclado real para Oracle JET/KnockoutJS
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

    const llenarCampo = async (field, valor) => {
        await field.click({ clickCount: 3 });
        await page.keyboard.press('Delete');
        await new Promise(r => setTimeout(r, 150));
        await field.type(valor, { delay: 50 });
        await new Promise(r => setTimeout(r, 300));
    };

    reportar(`Llenando usuario (${usuario})...`);
    let userField = await page.$('input#username, input[name="username"]').catch(() => null);
    if (!userField) {
        userField = await page.$('input:not([type="password"]):not([type="checkbox"]):not([type="hidden"]):not([type="submit"])').catch(() => null);
    }
    if (!userField) throw new Error('LOGIN_FAILED: campo usuario no encontrado');
    await llenarCampo(userField, usuario);

    reportar('Llenando contraseña...');
    const passField = await page.$('input[type="password"]').catch(() => null);
    if (!passField) throw new Error('LOGIN_FAILED: campo contraseña no encontrado');
    await llenarCampo(passField, clave);

    const verificacion = await page.evaluate(() => {
        const u = document.querySelector('input#username, input[name="username"], input:not([type="password"]):not([type="checkbox"]):not([type="hidden"])');
        const p = document.querySelector('input[type="password"]');
        return { user: u ? u.value : '(vacío)', pass: p ? p.value.length : 0 };
    });
    reportar(`Campos: usuario="${verificacion.user}" pass=${verificacion.pass} chars`);

    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button, input[type="submit"]'))
            .find(b => /iniciar|sign in|login/i.test(b.textContent || b.value || '') && b.offsetParent !== null);
        if (btn) btn.click();
        else document.querySelectorAll('button')[0]?.click();
    });
    reportar('Click Iniciar (1er intento)');

    // Polling hasta 37.5s
    let estado = 'timeout';
    for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 1500));
        try {
            const s = await page.evaluate(() => {
                const txt = document.body?.innerText || '';
                if (document.querySelector('oj-navigation-list,[role="tree"]') ||
                    txt.includes('Consola de despacho') || txt.includes('COMFICA') ||
                    txt.includes('ZENER') || txt.includes('Buscar en actividades')) return 'dashboard';
                if (document.querySelector('input[type="checkbox"]') &&
                    (txt.includes('sesiones') || txt.includes('Suprimir'))) return 'checkpoint';
                if (txt.includes('incorrectos') || txt.includes('incorrecto') || txt.includes('Invalid')) return 'credenciales_incorrectas';
                return null;
            });
            if (s) { estado = s; break; }
        } catch (_) {}
    }
    reportar(`Estado post-click: ${estado}`);

    if (estado === 'credenciales_incorrectas') {
        const errTOA = await page.evaluate(() => {
            const m = (document.body.innerText || '').match(/[^\n]*(?:incorrectos?|Invalid)[^\n]*/i);
            return m ? m[0].trim() : '';
        }).catch(() => '');
        throw new Error(`LOGIN_FAILED: ${errTOA || 'Usuario o contraseña incorrectos'}`);
    }

    if (estado === 'dashboard') {
        reportar('✅ Dashboard cargado (sin checkpoint).');
        await new Promise(r => setTimeout(r, 2000)); return;
    }

    if (estado === 'checkpoint') {
        reportar('⚠️ Checkpoint — marcando "Suprimir sesión más antigua"...');
        const cb = await page.$('input[type="checkbox"]');
        if (cb) {
            await cb.evaluate(el => { el.scrollIntoView({ block: 'center' }); });
            await new Promise(r => setTimeout(r, 300));
            await cb.click();
            await cb.evaluate(el => { if (!el.checked) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); } });
            await new Promise(r => setTimeout(r, 500));
        }
        const pf2 = await page.$('input[type="password"]');
        if (pf2) { await pf2.click({ clickCount: 3 }); await page.keyboard.press('Delete'); await pf2.type(clave, { delay: 40 }); await new Promise(r => setTimeout(r, 300)); }
        await page.evaluate(() => { Array.from(document.querySelectorAll('button')).find(b => /iniciar/i.test(b.textContent) && b.offsetParent !== null)?.click(); });
        reportar('Click Iniciar (2do intento)');
    }

    reportar('Esperando dashboard...');
    await page.waitForFunction(() => {
        const txt = document.body?.innerText || '';
        return !!(document.querySelector('oj-navigation-list,[role="tree"]') ||
            txt.includes('Consola de despacho') || txt.includes('COMFICA') || txt.includes('ZENER'));
    }, { timeout: 90000 }).catch(() => reportar('⚠️ Dashboard no confirmado — continuando...'));

    await new Promise(r => setTimeout(r, 2000));
}

// =============================================================================
// EXPORTS + EJECUCIÓN DIRECTA
// =============================================================================
module.exports = { iniciarExtraccion };

if (require.main === module) {
    const credenciales = { usuario: process.env.BOT_TOA_USER || '', clave: process.env.BOT_TOA_PASS || '' };
    mongoose.connect(process.env.MONGO_URI)
        .then(() => { console.log('✅ MongoDB conectado'); return iniciarExtraccion(process.env.BOT_FECHA_INICIO || null, process.env.BOT_FECHA_FIN || null, credenciales); })
        .catch(err => { console.error('❌ MongoDB:', err.message); process.exit(1); });
}

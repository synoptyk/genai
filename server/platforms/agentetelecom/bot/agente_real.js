'use strict';

// =============================================================================
// TOA AGENTE v8
//
// ETAPA 1 — Chrome breve (~30s):
//   Login → capturar Grid XHR template → escanear ÁRBOL COMPLETO del sidebar
//   → extraer cookies + CSRF → CERRAR Chrome inmediatamente
//
// ETAPA 2 — Node.js HTTP (sin Chrome):
//   Mostrar árbol al usuario → esperar selección → extraer con Node.js
//
// Requiere Render Starter (1 GB RAM). Chrome cierra en < 30s.
// =============================================================================

const puppeteer  = require('puppeteer');
const mongoose   = require('mongoose');
const path       = require('path');
const https      = require('https');
const http       = require('http');
const Actividad  = require('../models/Actividad');
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

    let browser = null;

    try {
        // ── ETAPA 1: Chrome breve (< 30s) ─────────────────────────────────────
        reportar('🌐 Lanzando Chrome (sesión breve, < 30s)...');

        browser = await puppeteer.launch({
            headless: 'new',
            defaultViewport: { width: 1280, height: 900 },
            args: [
                '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                '--no-first-run', '--no-zygote', '--disable-extensions',
                '--disable-blink-features=AutomationControlled',
                '--disable-gpu', '--disable-software-rasterizer',
                '--disk-cache-size=1', '--media-cache-size=1',
                '--window-size=1280,900'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        page.on('dialog', async d => { try { await d.accept(); } catch (_) {} });

        // Interceptar: bloquear solo imágenes/media para ahorrar RAM sin romper Oracle JET
        let gridTemplate = null;
        await page.setRequestInterception(true);
        page.on('request', req => {
            try {
                const rt = req.resourceType();
                if (['image', 'media'].includes(rt)) { req.abort(); return; }
                if (!gridTemplate && req.method() === 'POST') {
                    const url = req.url();
                    if (url.includes('m=Grid') && url.includes('output=ajax')) {
                        const body = req.postData() || '';
                        if (body.length > 5) {
                            gridTemplate = { url, headers: req.headers(), postData: body };
                            reportar(`✅ Template Grid capturado (${body.length} chars)`);
                        }
                    }
                }
                req.continue();
            } catch (e) { try { req.continue(); } catch (_) {} }
        });

        // LOGIN
        reportar('🔐 Iniciando sesión TOA...');
        await loginAtomico(page, credenciales, reportar);
        reportar('✅ Login OK → escaneando árbol del sidebar...');

        // Esperar que Oracle JET cargue el sidebar (máx 20s)
        await page.waitForFunction(() => {
            const txt = document.body?.innerText || '';
            return !!(
                document.querySelector('[data-group-id]') ||
                document.querySelector('oj-navigation-list') ||
                document.querySelector('[role="tree"]') ||
                txt.includes('COMFICA') || txt.includes('ZENER') || txt.includes('CHILE')
            );
        }, { timeout: 20000 }).catch(() => reportar('⚠️ Sidebar no confirmado — escaneando igual'));

        await new Promise(r => setTimeout(r, 2000));

        // ESCANEAR ÁRBOL COMPLETO del sidebar
        reportar('🔍 Escaneando árbol completo de TOA...');
        const arbol = await escanearArbol(page, reportar);
        reportar(`📋 Árbol escaneado: ${arbol.length} grupos raíz, ${contarNodos(arbol)} nodos totales`);

        // Si no capturó template, click en primer grupo con ID
        if (!gridTemplate) {
            const primerConId = encontrarPrimeroConId(arbol);
            if (primerConId) {
                reportar(`🖱️ Capturando Grid XHR (click en "${primerConId.nombre}")...`);
                await page.evaluate(gid => {
                    const el = document.querySelector(`[data-group-id="${gid}"]`);
                    if (el) el.click();
                }, primerConId.id);
                for (let i = 0; i < 10 && !gridTemplate; i++) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }

        // Extraer cookies + CSRF
        reportar('🍪 Extrayendo sesión...');
        const rawCookies = await page.cookies();
        const sessionCookies = rawCookies.map(c => `${c.name}=${c.value}`).join('; ');

        let csrfToken = await page.evaluate(() =>
            window.CSRFSecureToken || window.csrf_token || ''
        ).catch(() => '');

        if (!csrfToken && gridTemplate) {
            csrfToken = gridTemplate.headers['x-ofs-csrf-secure'] || '';
        }

        reportar(`   Cookies: ${rawCookies.length} | CSRF: ${csrfToken ? csrfToken.substring(0, 15) + '...' : 'no encontrado'}`);

        // CERRAR Chrome — misión cumplida
        await browser.close(); browser = null;
        reportar('✅ Chrome cerrado. Continuando sin navegador.');

        if (!gridTemplate) {
            reportar('⚠️ Sin template Grid — se usará formato base. Puede que las llamadas fallen.');
        }

        // ── ETAPA 2: Mostrar árbol al usuario ─────────────────────────────────
        const gruposParaMostrar = arbol.length > 0 ? arbol : GRUPOS_FALLBACK;

        if (process.send) {
            process.send({ type: 'grupos_encontrados', grupos: aplanarArbol(gruposParaMostrar) });
        } else if (global.BOT_STATUS) {
            global.BOT_STATUS.gruposEncontrados  = aplanarArbol(gruposParaMostrar);
            global.BOT_STATUS.esperandoSeleccion = true;
        }

        const gruposSeleccionados = await esperarConfirmacion(120000, reportar);
        reportar(`✅ ${gruposSeleccionados.length} grupo(s) confirmados`);

        if (gruposSeleccionados.length === 0) {
            throw new Error('No se seleccionó ningún grupo');
        }

        // ── ETAPA 3: Extracción con Node.js HTTP ───────────────────────────────
        reportar(`\n📡 Extrayendo ${fechasAProcesar.length} días × ${gruposSeleccionados.length} grupos...`);
        const apiUrl = gridTemplate?.url || (TOA_URL + '?m=Grid&a=get&itype=manage&output=ajax');
        let totalGuardados = 0;

        for (let i = 0; i < fechasAProcesar.length; i++) {
            const fecha = fechasAProcesar[i];

            if (process.send) {
                process.send({ type: 'progress', diaActual: i + 1, totalDias: fechasAProcesar.length, fechaProcesando: fecha });
            } else if (global.BOT_STATUS) {
                global.BOT_STATUS.diaActual = i + 1;
                global.BOT_STATUS.fechaProcesando = fecha;
            }

            if (i % 5 === 0 || i === fechasAProcesar.length - 1) {
                reportar(`📅 [${i + 1}/${fechasAProcesar.length}] ${fecha}`);
            }

            for (const grupo of gruposSeleccionados) {
                if (!grupo.id) { reportar(`  ⚠️ ${grupo.nombre}: sin ID`); continue; }
                try {
                    let postBody;
                    if (gridTemplate) {
                        const [yyyy, mm, dd] = fecha.split('-');
                        const fechaFmt = detectarFormatoFecha(gridTemplate.postData, mm, dd, yyyy);
                        postBody = gridTemplate.postData
                            .replace(/date=[^&\s]+/, `date=${encodeURIComponent(fechaFmt)}`)
                            .replace(/gid=\d+/, `gid=${grupo.id}`)
                            .replace(/rid=\d+/, `rid=${grupo.id}`);
                    } else {
                        const [yyyy, mm, dd] = fecha.split('-');
                        postBody = `date=${encodeURIComponent(`${mm}/${dd}/${yyyy}`)}&gid=${grupo.id}`;
                    }

                    const resultado = await httpPost(apiUrl, postBody, sessionCookies, csrfToken);

                    if (resultado.error) {
                        reportar(`  ⚠️ ${grupo.nombre}: ${resultado.error}`);
                        continue;
                    }

                    const rows = resultado.activitiesRows || [];
                    if (rows.length > 0) {
                        const guardados = await guardarActividades(rows, grupo.nombre, fecha, parseInt(grupo.id) || 0, empresaRef);
                        totalGuardados += guardados;
                        reportar(`  💾 ${grupo.nombre}: ${rows.length} actividades → ${guardados} guardadas`);
                    }

                    await new Promise(r => setTimeout(r, 350));
                } catch (err) {
                    reportar(`  ❌ ${grupo.nombre}: ${err.message}`);
                }
            }
        }

        reportar(`\n🏁 COMPLETADO. Total: ${totalGuardados} registros guardados.`);
        if (process.send) process.send({ type: 'log', text: '🏁 COMPLETADO', completed: true });
        if (global.BOT_STATUS) { global.BOT_STATUS.running = false; global.BOT_STATUS.esperandoSeleccion = false; }

    } catch (error) {
        const msg = error.message || 'Error desconocido';
        reportar(`❌ ERROR FATAL: ${msg}`);
        console.error(error);
        if (global.BOT_STATUS) { global.BOT_STATUS.ultimoError = msg; global.BOT_STATUS.running = false; global.BOT_STATUS.esperandoSeleccion = false; }
    } finally {
        process.env.BOT_ACTIVE_LOCK = 'OFF';
        if (browser) await browser.close().catch(() => {});
    }
};

// =============================================================================
// GRUPOS FALLBACK (si Chrome no puede escanear)
// =============================================================================
const GRUPOS_FALLBACK = [
    { id: '3840', nombre: 'COMFICA',        nivel: 0, padre: null, visible: true },
    { id: '3841', nombre: 'ZENER RM',       nivel: 0, padre: null, visible: true },
    { id: '3842', nombre: 'ZENER RANCAGUA', nivel: 0, padre: null, visible: true }
];

// =============================================================================
// ESCANEAR ÁRBOL COMPLETO DEL SIDEBAR
// =============================================================================
async function escanearArbol(page, reportar) {
    const nodos = await page.evaluate(() => {
        const resultado = [];
        const vistosId  = new Set();
        const vistosNom = new Set();

        // ── Intentar leer la estructura tree de Oracle JET ──────────────────
        const walkTree = (el, nivel, padreId) => {
            if (!el) return;
            const children = Array.from(el.children || []);
            children.forEach(child => {
                const gid = child.getAttribute('data-group-id') ||
                            child.getAttribute('data-id') ||
                            child.querySelector('[data-group-id]')?.getAttribute('data-group-id');

                const textEl = child.querySelector(
                    '[class*="label"], [class*="title"], .oj-navigationlist-item-label, span:not([class*="icon"])'
                ) || child;
                const texto = (textEl.textContent || '').trim().replace(/\s+/g, ' ').replace(/\d+$/, '').trim();

                if (!texto || texto.length < 2 || texto.length > 80) {
                    walkTree(child, nivel, padreId);
                    return;
                }

                const key = gid || texto;
                if (vistosId.has(key) || vistosNom.has(texto)) return;
                vistosId.add(key);
                vistosNom.add(texto);

                const rect = child.getBoundingClientRect();
                const visible = rect.width > 0 && rect.height > 0;

                resultado.push({ id: gid || null, nombre: texto, nivel, padre: padreId, visible });
                walkTree(child, nivel + 1, gid || texto);
            });
        };

        // Probar selectores de árbol Oracle JET
        const treeSelectors = [
            'oj-navigation-list',
            '[role="tree"]',
            '[class*="oj-navigationlist"]',
            'nav[class*="sidebar"]',
            '[class*="edt-sidebar"]',
            '[class*="resource-tree"]'
        ];

        let treeEl = null;
        for (const sel of treeSelectors) {
            treeEl = document.querySelector(sel);
            if (treeEl && treeEl.children.length > 0) break;
        }

        if (treeEl) {
            walkTree(treeEl, 0, null);
        }

        // Si no encontramos nada con tree walk, usar flat scan con data-group-id
        if (resultado.length === 0) {
            document.querySelectorAll('[data-group-id]').forEach(el => {
                const gid  = el.getAttribute('data-group-id');
                if (!gid || vistosId.has(gid)) return;
                vistosId.add(gid);
                const labelEl = el.querySelector('[class*="label"], span') || el;
                const nombre  = (labelEl.textContent || '').trim().replace(/\s+/g, ' ').replace(/\d+$/, '').trim().slice(0, 80);
                if (!nombre) return;
                const rect = el.getBoundingClientRect();
                resultado.push({ id: gid, nombre, nivel: 0, padre: null, visible: rect.width > 0 });
            });
        }

        // Último recurso: buscar texto conocido en toda la página
        if (resultado.length === 0) {
            const conocidos = ['COMFICA', 'ZENER', 'CHILE', 'RANCAGUA'];
            document.querySelectorAll('li, div, span, a').forEach(el => {
                const txt = (el.textContent || '').trim().replace(/\s+/g, ' ');
                if (!conocidos.some(k => txt.toUpperCase().includes(k))) return;
                if (txt.length > 60 || vistosNom.has(txt)) return;
                const rect = el.getBoundingClientRect();
                if (rect.left > 400 || rect.width === 0) return;
                const gid = el.getAttribute('data-group-id') || null;
                vistosNom.add(txt);
                resultado.push({ id: gid, nombre: txt, nivel: 0, padre: null, visible: true });
            });
        }

        return resultado.slice(0, 60);
    });

    nodos.forEach(n => {
        const indent = '  '.repeat(n.nivel);
        reportar(`   ${indent}${n.visible ? '📁' : '○'} "${n.nombre}" ${n.id ? `(ID: ${n.id})` : '(sin ID)'}`);
    });

    return nodos;
}

// Aplanar árbol para enviar al frontend (mantiene nivel para indentación)
function aplanarArbol(nodos) {
    return nodos.map(n => ({
        id:      n.id     || null,
        nombre:  n.nombre || '',
        nivel:   n.nivel  || 0,
        padre:   n.padre  || null,
        visible: n.visible !== false
    }));
}

function contarNodos(nodos) { return nodos.length; }

function encontrarPrimeroConId(nodos) {
    return nodos.find(n => n.id);
}

// =============================================================================
// LOGIN TOA
// =============================================================================
async function loginAtomico(page, credenciales = {}, reportar = console.log) {
    const usuario = credenciales.usuario || process.env.BOT_TOA_USER || '';
    const clave   = credenciales.clave   || process.env.BOT_TOA_PASS  || '';
    if (!usuario) throw new Error('LOGIN_FAILED: usuario no configurado');
    if (!clave)   throw new Error('LOGIN_FAILED: contraseña no configurada');

    reportar(`Login: usuario="${usuario}" (${clave.length} chars)`);
    await page.goto(TOA_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await new Promise(r => setTimeout(r, 2000));

    await page.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));

    const llenar = async (field, valor) => {
        await field.click({ clickCount: 3 });
        await page.keyboard.press('Delete');
        await new Promise(r => setTimeout(r, 100));
        await field.type(valor, { delay: 40 });
        await new Promise(r => setTimeout(r, 200));
    };

    reportar(`Llenando usuario (${usuario})...`);
    let uF = await page.$('input#username, input[name="username"]').catch(() => null);
    if (!uF) uF = await page.$('input:not([type="password"]):not([type="checkbox"]):not([type="hidden"])').catch(() => null);
    if (!uF) throw new Error('LOGIN_FAILED: campo usuario no encontrado');
    await llenar(uF, usuario);

    reportar('Llenando contraseña...');
    const pF = await page.$('input[type="password"]');
    if (!pF) throw new Error('LOGIN_FAILED: campo contraseña no encontrado');
    await llenar(pF, clave);

    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button, input[type="submit"]'))
            .find(b => /iniciar|sign in|login/i.test((b.textContent || b.value || '').trim()) && b.offsetParent !== null);
        if (btn) btn.click();
        else document.querySelector('button')?.click();
    });
    reportar('Click Iniciar');

    let estado = 'timeout';
    for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 1500));
        try {
            const s = await page.evaluate(() => {
                const txt = document.body?.innerText || '';
                if (document.querySelector('oj-navigation-list,[role="tree"]') ||
                    txt.includes('Consola de despacho') || txt.includes('COMFICA') ||
                    txt.includes('ZENER') || txt.includes('CHILE')) return 'dashboard';
                if (document.querySelector('input[type="checkbox"]') &&
                    (txt.includes('sesiones') || txt.includes('Suprimir'))) return 'checkpoint';
                if (txt.includes('incorrectos') || txt.includes('incorrecto') || txt.includes('Invalid')) return 'credenciales_incorrectas';
                return null;
            });
            if (s) { estado = s; break; }
        } catch (_) {}
    }
    reportar(`Estado: ${estado}`);

    if (estado === 'credenciales_incorrectas') {
        throw new Error('LOGIN_FAILED: Usuario o contraseña incorrectos');
    }

    if (estado === 'checkpoint') {
        reportar('⚠️ Checkpoint — marcando Suprimir sesión...');
        const cb = await page.$('input[type="checkbox"]');
        if (cb) {
            await cb.evaluate(el => el.scrollIntoView({ block: 'center' }));
            await new Promise(r => setTimeout(r, 200));
            await cb.click();
            await cb.evaluate(el => { if (!el.checked) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); } });
            await new Promise(r => setTimeout(r, 400));
        }
        const pF2 = await page.$('input[type="password"]');
        if (pF2) { await pF2.click({ clickCount: 3 }); await pF2.type(clave, { delay: 40 }); await new Promise(r => setTimeout(r, 200)); }
        await page.evaluate(() => {
            Array.from(document.querySelectorAll('button')).find(b => /iniciar/i.test(b.textContent) && b.offsetParent !== null)?.click();
        });
        reportar('Click Iniciar (2do)');

        await page.waitForFunction(() => {
            const txt = document.body?.innerText || '';
            return !!(document.querySelector('oj-navigation-list,[role="tree"]') ||
                txt.includes('COMFICA') || txt.includes('ZENER') || txt.includes('CHILE'));
        }, { timeout: 60000 }).catch(() => {});
    }

    await new Promise(r => setTimeout(r, 1500));
}

// =============================================================================
// DETECTAR FORMATO DE FECHA DEL TEMPLATE
// =============================================================================
function detectarFormatoFecha(postData, mm, dd, yyyy) {
    const m = postData.match(/date=([^&\s]+)/);
    if (!m) return `${mm}/${dd}/${yyyy}`;
    const f = decodeURIComponent(m[1]);
    if (/-/.test(f)) return `${yyyy}-${mm}-${dd}`;
    const partes = f.split('/');
    if (partes.length !== 3) return `${mm}/${dd}/${yyyy}`;
    return parseInt(partes[0]) > 12 ? `${dd}/${mm}/${yyyy}` : `${mm}/${dd}/${yyyy}`;
}

// =============================================================================
// HTTP POST — Grid API
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
            res.on('data', c => { data += c; });
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
// ESPERAR CONFIRMACIÓN DEL USUARIO
// =============================================================================
function esperarConfirmacion(timeoutMs, reportar) {
    return new Promise((resolve, reject) => {
        reportar(`⏳ Esperando selección (máx. ${timeoutMs / 1000}s)...`);
        const timer = setTimeout(() => reject(new Error('Timeout esperando selección')), timeoutMs);
        if (process.send) {
            const h = (msg) => {
                if (msg?.type === 'confirmar_grupos') {
                    clearTimeout(timer);
                    process.removeListener('message', h);
                    resolve(msg.grupos || []);
                }
            };
            process.on('message', h);
        } else {
            const poll = setInterval(() => {
                if (global.BOT_STATUS?.gruposConfirmados) {
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
// GUARDAR ACTIVIDADES
// =============================================================================
async function guardarActividades(rows, empresa, fecha, bucketId, empresaRef) {
    const ops = rows.map(row => {
        const ordenId = row.key || row['144'] || row.appt_number || `${empresa}_${fecha}_${JSON.stringify(row).length}`;
        const doc = {
            ordenId, empresa, bucket: empresa, bucketId,
            fecha: new Date(fecha + 'T00:00:00Z'),
            recurso: row.pname || '',
            'Número de Petición': row.appt_number || row['144'] || '',
            'Estado': row.astatus || '',
            'Subtipo de Actividad': row.aworktype || '',
            'Ventana de servicio': row.service_window || '',
            'Ventana de Llegada': row.delivery_window || '',
            'Nombre': row.cname || '',
            'RUT del cliente': row.customer_number || row['362'] || '',
            telefono: (row.cphone || '').replace(/<[^>]+>/g, '').trim(),
            'Ciudad': row.ccity || row.cstate || '',
            latitud: row.acoord_y ? String(row.acoord_y) : null,
            longitud: row.acoord_x ? String(row.acoord_x) : null,
            camposCustom: Object.fromEntries(Object.entries(row).filter(([k]) => /^\d+$/.test(k))),
            rawData: row,
            ultimaActualizacion: new Date(),
            ...(empresaRef ? { empresaRef } : {})
        };
        return { updateOne: { filter: { ordenId }, update: { $set: doc }, upsert: true } };
    }).filter(op => String(op.updateOne.filter.ordenId).length > 2);

    if (!ops.length) return 0;
    const r = await Actividad.bulkWrite(ops, { ordered: false });
    return (r.upsertedCount || 0) + (r.modifiedCount || 0);
}

// =============================================================================
// EXPORTS
// =============================================================================
module.exports = { iniciarExtraccion };

if (require.main === module) {
    const cred = { usuario: process.env.BOT_TOA_USER || '', clave: process.env.BOT_TOA_PASS || '' };
    mongoose.connect(process.env.MONGO_URI)
        .then(() => iniciarExtraccion(process.env.BOT_FECHA_INICIO || null, process.env.BOT_FECHA_FIN || null, cred))
        .catch(err => { console.error(err.message); process.exit(1); });
}

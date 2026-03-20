'use strict';

// =============================================================================
// TOA AGENTE v11 — CHROME LOCAL (2GB RAM) + SCAN INTELIGENTE COMPLETO
//
// MODO A (por defecto, Render Estándar 2GB): Chrome LOCAL headless
//   → login completo → CSRF real → scan TODA la estructura TOA
//   → descarga datos reales con CSRF válido
//
// MODO B (con BROWSERLESS_KEY): Chrome remoto vía Browserless.io
//   → igual que Modo A pero Chrome corre en sus servidores
//
// MODO C (SKIP_CHROME=true): HTTP puro sin Chrome
//   → sin CSRF → grupos conocidos como fallback
// =============================================================================

const axios    = require('axios');
const https    = require('https');
const http     = require('http');
const mongoose = require('mongoose');
const path     = require('path');
const Actividad = require('../models/Actividad');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const TOA_URL  = process.env.TOA_URL || 'https://telefonica-cl.etadirect.com/';
const TOA_HOST = (() => { try { return new URL(TOA_URL).hostname; } catch (_) { return 'telefonica-cl.etadirect.com'; } })();

// Grupos conocidos como fallback si el scan no descubre nada
const GRUPOS_FALLBACK = [
    { id: '3840', nombre: 'COMFICA',        nivel: 0, padre: null, esFavorito: true },
    { id: '3841', nombre: 'ZENER RM',       nivel: 0, padre: null, esFavorito: true },
    { id: '3842', nombre: 'ZENER RANCAGUA', nivel: 0, padre: null, esFavorito: true }
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
        console.log('[BOT]', msg);
        if (process.send) process.send({ type: 'log', text: msg, ...extra });
        else if (global.BOT_STATUS) {
            global.BOT_STATUS.logs = global.BOT_STATUS.logs || [];
            global.BOT_STATUS.logs.push(`[${new Date().toLocaleTimeString('es-CL')}] ${msg}`);
            if (global.BOT_STATUS.logs.length > 200) global.BOT_STATUS.logs.shift();
        }
    };

    reportar(`🚀 TOA Bot v11 | Modo: ${modo} | ${fechasAProcesar.length} días`);
    reportar(`   Rango: ${fechasAProcesar[0]} → ${fechasAProcesar[fechasAProcesar.length - 1]}`);

    // Determinar modo de operación
    const usarChrome = process.env.SKIP_CHROME !== 'true';
    const usarBrowserless = !!process.env.BROWSERLESS_KEY;
    if (usarBrowserless)     reportar('🌐 MODO B: Chrome remoto (Browserless.io)');
    else if (usarChrome)     reportar('🖥️  MODO A: Chrome LOCAL (Render 2GB RAM)');
    else                     reportar('📡 MODO C: HTTP puro (sin Chrome)');

    try {
        let sessionCookies, csrfToken, gridUrl, grupos;

        if (usarChrome) {
            // ── MODO A/B: Chrome (local o remoto) ────────────────────────────
            const r = await loginYScanConChrome(credenciales, reportar, usarBrowserless);
            sessionCookies = r.sessionCookies;
            csrfToken      = r.csrfToken;
            gridUrl        = r.gridUrl;
            grupos         = r.grupos;
        } else {
            // ── MODO C: HTTP puro ─────────────────────────────────────────────
            reportar('🔐 Login HTTP (sin Chrome)...');
            const r = await loginHTTP(credenciales, reportar);
            sessionCookies = r.sessionCookies;
            csrfToken      = r.csrfToken;
            gridUrl        = r.gridUrl;
            grupos         = await descubrirGruposHTTP(gridUrl, sessionCookies, csrfToken, reportar);
        }

        reportar(`✅ Login OK | CSRF: ${csrfToken ? '✅ ' + csrfToken.substring(0,16) + '...' : '⚠️ sin CSRF'}`);
        reportar(`📋 Grupos descubiertos: ${grupos.length}`);
        grupos.forEach(g => reportar(`   ${'  '.repeat(g.nivel||0)}${g.esFavorito ? '⭐' : '📁'} ${g.nombre} [ID:${g.id || '?'}]`));

        // ── Enviar grupos al frontend ─────────────────────────────────────────
        if (process.send) {
            process.send({ type: 'grupos_encontrados', grupos });
        } else if (global.BOT_STATUS) {
            global.BOT_STATUS.gruposEncontrados  = grupos;
            global.BOT_STATUS.esperandoSeleccion = true;
        }

        const gruposSeleccionados = await esperarConfirmacion(180000, reportar);
        reportar(`✅ Usuario confirmó ${gruposSeleccionados.length} grupo(s)`);

        if (!gruposSeleccionados.length) throw new Error('No se seleccionó ningún grupo');

        // ── Prueba de conectividad antes de extraer ───────────────────────────
        reportar('🧪 Verificando Grid API...');
        const hoy = new Date();
        const testFmt = `${String(hoy.getUTCMonth()+1).padStart(2,'0')}/${String(hoy.getUTCDate()).padStart(2,'0')}/${hoy.getUTCFullYear()}`;
        const gTest   = gruposSeleccionados.find(g => g.id) || gruposSeleccionados[0];
        if (gTest?.id) {
            const testBody = `date=${encodeURIComponent(testFmt)}&gid=${gTest.id}`;
            const testRes  = await httpPost(gridUrl, testBody, sessionCookies, csrfToken);
            if (testRes._raw) reportar(`   API preview: ${testRes._raw.substring(0, 200)}`);
            if (testRes.error) {
                reportar(`   ⚠️ API test: ${testRes.error}`);
                if (!csrfToken) reportar('   ⚠️ Sin CSRF — si la extracción da 0 registros, configura BROWSERLESS_KEY en Render');
            } else {
                reportar(`   ✅ API responde: ${testRes.activitiesRows?.length ?? 0} filas (hoy, ${gTest.nombre})`);
            }
        }

        // ── Extracción ────────────────────────────────────────────────────────
        reportar(`\n📡 Iniciando extracción: ${fechasAProcesar.length} días × ${gruposSeleccionados.length} grupo(s)`);
        let totalGuardados = 0;
        let fechaFormatoFinal = 'MM/DD/YYYY'; // se ajusta automáticamente

        for (let i = 0; i < fechasAProcesar.length; i++) {
            const fecha = fechasAProcesar[i];
            const [yyyy, mm, dd] = fecha.split('-');

            if (process.send) process.send({ type: 'progress', diaActual: i+1, totalDias: fechasAProcesar.length, fechaProcesando: fecha });
            else if (global.BOT_STATUS) { global.BOT_STATUS.diaActual = i+1; global.BOT_STATUS.fechaProcesando = fecha; }

            const mostrarLog = (i % 10 === 0 || i === fechasAProcesar.length - 1);
            if (mostrarLog) reportar(`📅 [${i+1}/${fechasAProcesar.length}] ${fecha}`);

            for (const grupo of gruposSeleccionados) {
                if (!grupo.id) { reportar(`  ⚠️ ${grupo.nombre}: sin ID, saltando`); continue; }
                try {
                    const fechaFmt1 = `${mm}/${dd}/${yyyy}`; // MM/DD/YYYY
                    const fechaFmt2 = `${dd}/${mm}/${yyyy}`; // DD/MM/YYYY

                    let resultado = await httpPost(gridUrl, `date=${encodeURIComponent(fechaFmt1)}&gid=${grupo.id}`, sessionCookies, csrfToken);

                    // Si 0 rows, probar formato inverso
                    if (!resultado.error && !(resultado.activitiesRows?.length)) {
                        const res2 = await httpPost(gridUrl, `date=${encodeURIComponent(fechaFmt2)}&gid=${grupo.id}`, sessionCookies, csrfToken);
                        if (!res2.error && (res2.activitiesRows?.length || 0) > 0) {
                            resultado = res2;
                            if (fechaFormatoFinal !== 'DD/MM/YYYY') { fechaFormatoFinal = 'DD/MM/YYYY'; reportar(`   ℹ️ Formato fecha: DD/MM/YYYY`); }
                        }
                    }

                    if (resultado.error) {
                        if (mostrarLog) reportar(`  ❌ ${grupo.nombre}: ${resultado.error}${resultado._raw ? ' → ' + resultado._raw.substring(0,100) : ''}`);
                        continue;
                    }

                    const rows = resultado.activitiesRows || [];
                    if (rows.length > 0) {
                        const guardados = await guardarActividades(rows, grupo.nombre, fecha, parseInt(grupo.id), empresaRef);
                        totalGuardados += guardados;
                        if (process.send) process.send({ type: 'log', text: `  💾 ${grupo.nombre} ${fecha}: ${rows.length} → ${guardados} guardados` });
                        else if (global.BOT_STATUS) {
                            global.BOT_STATUS.registrosGuardados = (global.BOT_STATUS.registrosGuardados || 0) + guardados;
                        }
                    }

                    await new Promise(r => setTimeout(r, 300));
                } catch (err) {
                    reportar(`  ❌ ${grupo.nombre} ${fecha}: ${err.message}`);
                }
            }
        }

        reportar(`\n🏁 COMPLETADO. Total: ${totalGuardados} registros guardados.`);
        if (process.send) process.send({ type: 'log', text: `🏁 COMPLETADO. Total: ${totalGuardados} registros.`, completed: true });
        if (global.BOT_STATUS) { global.BOT_STATUS.running = false; global.BOT_STATUS.esperandoSeleccion = false; }

    } catch (error) {
        const msg = error.message || 'Error desconocido';
        reportar(`❌ ERROR FATAL: ${msg}`);
        console.error(error);
        if (process.send) process.send({ type: 'log', text: `❌ ERROR: ${msg}`, completed: true });
        if (global.BOT_STATUS) { global.BOT_STATUS.ultimoError = msg; global.BOT_STATUS.running = false; global.BOT_STATUS.esperandoSeleccion = false; }
    } finally {
        process.env.BOT_ACTIVE_LOCK = 'OFF';
    }
};

// =============================================================================
// MODO A/B: LOGIN + SCAN COMPLETO CON CHROME
// - Modo A: Chrome LOCAL (Render Estándar 2GB RAM) — puppeteer.launch()
// - Modo B: Chrome REMOTO (Browserless.io)         — puppeteer.connect()
// Usa page.evaluate() para llamadas API desde el contexto autenticado del browser
// =============================================================================
async function loginYScanConChrome(credenciales, reportar, usarBrowserless = false) {
    const puppeteer = require('puppeteer');
    const usuario   = credenciales.usuario || process.env.BOT_TOA_USER || '';
    const clave     = credenciales.clave   || process.env.BOT_TOA_PASS  || '';
    if (!usuario) throw new Error('LOGIN_FAILED: usuario no configurado');
    if (!clave)   throw new Error('LOGIN_FAILED: contraseña no configurada');

    let browser;
    if (usarBrowserless) {
        reportar(`🌐 Conectando a Browserless.io...`);
        browser = await puppeteer.connect({
            browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_KEY}&timeout=120000`,
            defaultViewport: { width: 1366, height: 768 }
        });
    } else {
        reportar(`🖥️  Lanzando Chrome local (headless)...`);
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-default-apps',
                '--mute-audio',
                '--window-size=1366,768'
            ],
            defaultViewport: { width: 1366, height: 768 },
            timeout: 60000
        });
    }

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        page.on('dialog', async d => { try { await d.dismiss(); } catch(_) {} });

        // Capturar Grid XHR template
        let gridTemplate = null;
        await page.setRequestInterception(true);
        page.on('request', req => {
            try {
                const rt = req.resourceType();
                if (['image', 'media', 'font'].includes(rt)) { req.abort(); return; }
                if (!gridTemplate && req.method() === 'POST') {
                    const u = req.url();
                    if (u.includes('m=Grid') && u.includes('output=ajax')) {
                        const b = req.postData() || '';
                        if (b.length > 5) {
                            gridTemplate = { url: u, headers: req.headers(), postData: b };
                            reportar('✅ Grid XHR template capturado');
                        }
                    }
                }
                req.continue();
            } catch(e) { try { req.continue(); } catch(_) {} }
        });

        // ── Ir a TOA ─────────────────────────────────────────────────────────
        reportar('🔗 Navegando a TOA...');
        await page.goto(TOA_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(r => setTimeout(r, 3000));

        // Esperar formulario login
        await page.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 })
            .catch(() => reportar('⚠️ No encontré input[type=password], continúo igual'));

        // ── Llenar formulario ─────────────────────────────────────────────────
        reportar(`   Escribiendo usuario: ${usuario}`);
        const llenar = async (sel, val) => {
            const f = await page.$(sel);
            if (!f) return false;
            await f.click({ clickCount: 3 });
            await page.keyboard.press('Delete');
            await new Promise(r => setTimeout(r, 200));
            await f.type(val, { delay: 50 });
            return true;
        };

        const usuSelectors = [
            'input#username', 'input[name="username"]',
            'input[autocomplete="username"]', 'input[type="text"]:not([type="hidden"])'
        ];
        for (const sel of usuSelectors) {
            if (await llenar(sel, usuario)) { reportar(`   Usuario OK (${sel})`); break; }
        }
        await llenar('input[type="password"]', clave);

        // Click login
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, input[type=submit]'));
            const loginBtn = btns.find(b => /iniciar|login|sign.?in|entrar/i.test(b.textContent + b.value));
            if (loginBtn) loginBtn.click();
            else if (btns.length) btns[0].click();
        });
        reportar('   Click en botón de login...');

        // ── Esperar dashboard ─────────────────────────────────────────────────
        reportar('⏳ Esperando dashboard TOA...');
        await page.waitForFunction(() => {
            const t = document.body?.innerText || '';
            const hasContent = t.includes('COMFICA') || t.includes('ZENER') || t.includes('CHILE') ||
                !!document.querySelector('[data-group-id]') ||
                t.includes('Dispatch') || t.includes('dispatch') || t.length > 5000;
            return hasContent;
        }, { timeout: 90000 }).catch(() => reportar('⚠️ Timeout esperando dashboard (continúo)'));

        await new Promise(r => setTimeout(r, 4000));

        const dashTitle = await page.title().catch(() => '');
        reportar(`   Dashboard: "${dashTitle}"`);

        // ── SCAN INTELIGENTE: llamadas API desde dentro del browser ──────────
        reportar('🔍 Escaneando estructura TOA...');

        const scanResult = await page.evaluate(async (toaUrl) => {
            const csrf = window.CSRFSecureToken || window.csrfToken || '';
            const baseUrl = window.location.origin + '/';

            const apiCall = async (path, bodyStr = '') => {
                try {
                    const resp = await fetch(baseUrl + path, {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'X-Requested-With': 'XMLHttpRequest',
                            'Accept': 'application/json, */*',
                            ...(csrf ? { 'X-OFS-CSRF-SECURE': csrf } : {})
                        },
                        body: bodyStr
                    });
                    const text = await resp.text();
                    try { return { ok: true, data: JSON.parse(text), status: resp.status }; }
                    catch (e) { return { ok: false, raw: text.substring(0, 500), status: resp.status }; }
                } catch (e) { return { ok: false, error: e.message }; }
            };

            // Intentar múltiples endpoints para descubrir la estructura
            const endpoints = [
                { name: 'Resource.getTree',    path: '?m=Resource&a=getTree&output=ajax',    body: '' },
                { name: 'Resource.list',        path: '?m=Resource&a=list&output=ajax',        body: '' },
                { name: 'Bucket.list',          path: '?m=Bucket&a=list&output=ajax',          body: '' },
                { name: 'Group.list',           path: '?m=Group&a=list&output=ajax',           body: '' },
                { name: 'Resource.getChildren', path: '?m=Resource&a=getChildren&output=ajax', body: 'pid=0' },
                { name: 'AdminBucket.list',     path: '?m=AdminBucket&a=list&output=ajax',     body: '' },
                { name: 'WorkOrder.getBuckets', path: '?m=WorkOrder&a=getBuckets&output=ajax', body: '' },
            ];

            const apiResults = {};
            for (const ep of endpoints) {
                apiResults[ep.name] = await apiCall(ep.path, ep.body);
                await new Promise(r => setTimeout(r, 300));
            }

            // Escanear DOM en busca de grupos/buckets
            const domGroups = [];
            const seen = new Set();

            // Selector amplio para elementos con IDs de grupo
            const groupSelectors = [
                '[data-group-id]', '[data-bucket-id]', '[data-gid]',
                '[data-id][class*="group"]', '[data-id][class*="bucket"]',
                '[class*="tree-node"]', '[class*="treeNode"]', '[class*="resource-group"]'
            ];

            for (const sel of groupSelectors) {
                document.querySelectorAll(sel).forEach(el => {
                    const id = el.getAttribute('data-group-id') ||
                               el.getAttribute('data-bucket-id') ||
                               el.getAttribute('data-gid') ||
                               el.getAttribute('data-id');
                    if (!id || seen.has(id)) return;
                    seen.add(id);
                    const nombre = (el.querySelector('[class*="label"], [class*="name"]')?.textContent ||
                                   el.textContent || '').trim().split('\n')[0].trim();
                    if (nombre && nombre.length > 0 && nombre.length < 100) {
                        domGroups.push({ id, nombre, selector: sel });
                    }
                });
            }

            // Buscar en el texto del sidebar/nav
            const sidebarEl = document.querySelector('[class*="sidebar"], [class*="nav"], [class*="tree"], [role="tree"]');
            const sidebarText = sidebarEl?.innerText || document.body.innerText || '';
            const sidebarLines = sidebarText.split('\n')
                .map(l => l.trim())
                .filter(l => l.length > 2 && l.length < 60)
                .slice(0, 50);

            // Obtener texto completo del body para análisis
            const bodyText = document.body?.innerText?.substring(0, 3000) || '';

            return {
                csrf: csrf ? '✅ ' + csrf.substring(0, 20) + '...' : '❌ no encontrado',
                csrfRaw: csrf,
                apiResults,
                domGroups,
                sidebarLines,
                bodyText,
                url: window.location.href
            };
        }, TOA_URL);

        reportar(`   CSRF en página: ${scanResult.csrf}`);
        reportar(`   URL actual: ${scanResult.url}`);
        reportar(`   Grupos en DOM: ${scanResult.domGroups.length}`);

        // Log resultados de API
        for (const [ep, res] of Object.entries(scanResult.apiResults)) {
            if (res.ok && res.data) {
                reportar(`   📡 ${ep}: HTTP ${res.status} → JSON OK`);
                // Log primeras 200 chars del JSON
                const preview = JSON.stringify(res.data).substring(0, 200);
                reportar(`      ${preview}`);
            } else if (res.raw) {
                reportar(`   📡 ${ep}: HTTP ${res.status} → raw: ${res.raw.substring(0, 100)}`);
            } else if (res.error) {
                reportar(`   📡 ${ep}: ❌ ${res.error}`);
            }
        }

        // Log grupos encontrados en DOM
        if (scanResult.domGroups.length) {
            reportar('   Grupos en DOM:');
            scanResult.domGroups.forEach(g => reportar(`     ${g.nombre} [ID:${g.id}]`));
        }

        // Sidebar lines
        if (scanResult.sidebarLines?.length) {
            reportar('   Sidebar TOA:');
            scanResult.sidebarLines.slice(0, 20).forEach(l => reportar(`     ${l}`));
        }

        // ── Construir lista de grupos desde API y DOM ─────────────────────────
        let grupos = extraerGruposDeResultadoScan(scanResult, reportar);

        // Si no se encontraron grupos vía API, intentar expandir sidebar con clicks
        if (grupos.length === 0) {
            reportar('🖱️ Intentando expandir sidebar con clicks...');
            grupos = await expandirSidebarYScanear(page, reportar);
        }

        // Fallback a conocidos si aún 0
        if (grupos.length === 0) {
            reportar('⚠️ Sin grupos por API/DOM → usando grupos conocidos');
            grupos = GRUPOS_FALLBACK;
        }

        // ── Obtener cookies y CSRF ────────────────────────────────────────────
        const rawCookies     = await page.cookies();
        const sessionCookies = rawCookies.map(c => `${c.name}=${c.value}`).join('; ');
        const csrfToken      = scanResult.csrfRaw || gridTemplate?.headers?.['x-ofs-csrf-secure'] || '';

        reportar(`   Cookies obtenidas: ${rawCookies.length}`);
        reportar(`   Grid template: ${gridTemplate ? '✅' : '⚠️ no capturado'}`);

        const cerrarBrowser = () => usarBrowserless
            ? browser.disconnect().catch(() => {})
            : browser.close().catch(() => {});

        await cerrarBrowser();
        return {
            sessionCookies,
            csrfToken,
            gridUrl: gridTemplate?.url || (TOA_URL + '?m=Grid&a=get&itype=manage&output=ajax'),
            grupos
        };

    } catch (e) {
        const cerrarBrowser = () => usarBrowserless
            ? browser.disconnect().catch(() => {})
            : browser.close().catch(() => {});
        await cerrarBrowser();
        throw e;
    }
}

// =============================================================================
// EXPANDIR SIDEBAR CON CLICKS Y ESCANEAR
// =============================================================================
async function expandirSidebarYScanear(page, reportar) {
    const grupos = [];
    const seen   = new Set();

    try {
        // Esperar y hacer scroll en sidebar
        await new Promise(r => setTimeout(r, 2000));

        // Click en todos los arrows/expandibles del sidebar
        const expanded = await page.evaluate(() => {
            const results = [];
            // Buscar elementos expandibles
            const expandibles = document.querySelectorAll(
                '[class*="expand"], [class*="arrow"], [class*="toggle"], [class*="disclosure"], ' +
                '[aria-expanded="false"], [class*="tree-item"], .oj-tree-icon'
            );
            let clicked = 0;
            expandibles.forEach(el => {
                if (el.offsetParent !== null) { // visible
                    try { el.click(); clicked++; } catch(_) {}
                }
            });
            return { clicked };
        });
        reportar(`   Clicks expandir: ${expanded.clicked}`);
        await new Promise(r => setTimeout(r, 3000));

        // Re-escanear DOM después de expandir
        const afterExpand = await page.evaluate(() => {
            const items = [];
            const seen = new Set();
            const selectors = ['[data-group-id]', '[data-bucket-id]', '[data-gid]', '[data-id]'];
            for (const sel of selectors) {
                document.querySelectorAll(sel).forEach(el => {
                    const id = el.getAttribute('data-group-id') || el.getAttribute('data-bucket-id') ||
                               el.getAttribute('data-gid') || el.getAttribute('data-id');
                    if (!id || seen.has(id)) return;
                    seen.add(id);
                    const nombre = (el.textContent || '').trim().split('\n')[0].trim();
                    if (nombre && nombre.length < 80) items.push({ id, nombre });
                });
            }
            return items;
        });

        afterExpand.forEach(g => {
            if (!seen.has(g.id)) {
                seen.add(g.id);
                grupos.push({ id: g.id, nombre: g.nombre, nivel: 0, padre: null });
            }
        });

        if (grupos.length) reportar(`   Grupos tras expandir: ${grupos.length}`);

        // También hacer screenshot para debug
        const ssBuffer = await page.screenshot({ type: 'jpeg', quality: 50, fullPage: false }).catch(() => null);
        if (ssBuffer) reportar(`   📸 Screenshot tomado (${ssBuffer.length} bytes) — sidebar visible`);

    } catch (e) {
        reportar(`   ⚠️ Error expandiendo sidebar: ${e.message}`);
    }

    return grupos;
}

// =============================================================================
// EXTRAER GRUPOS DEL RESULTADO DE SCAN
// =============================================================================
function extraerGruposDeResultadoScan(scanResult, reportar) {
    const grupos = [];
    const seen   = new Set();

    const agregar = (id, nombre, nivel = 0, padre = null, esFavorito = false) => {
        const key = String(id);
        if (seen.has(key) || !nombre || nombre.length < 1) return;
        seen.add(key);
        grupos.push({ id: key, nombre: nombre.trim(), nivel, padre, esFavorito });
    };

    // 1. Desde DOM groups
    scanResult.domGroups?.forEach(g => agregar(g.id, g.nombre, 0));

    // 2. Desde API results — intentar parsear diferentes estructuras
    for (const [endpoint, res] of Object.entries(scanResult.apiResults || {})) {
        if (!res.ok || !res.data) continue;
        const data = res.data;

        // Estructura tipo { items: [...] }
        const lists = [data.items, data.groups, data.buckets, data.resources, data.rows, data.data];
        for (const list of lists) {
            if (!Array.isArray(list)) continue;
            list.forEach(item => {
                const id     = item.id || item.gid || item.group_id || item.bucket_id || item.rid;
                const nombre = item.name || item.label || item.title || item.n || item.group_name;
                const nivel  = item.level || item.depth || 0;
                const padre  = item.parent_id || item.pid || item.parent;
                if (id && nombre) agregar(String(id), nombre, nivel, padre ? String(padre) : null);
            });
        }

        // Estructura árbol recursivo
        const procesarArbol = (nodos, nivel = 0, padre = null) => {
            if (!Array.isArray(nodos)) return;
            nodos.forEach(n => {
                const id     = n.id || n.gid;
                const nombre = n.name || n.label || n.n;
                if (id && nombre) agregar(String(id), nombre, nivel, padre);
                const hijos  = n.children || n.items || n.nodes || n.sub;
                if (hijos) procesarArbol(hijos, nivel + 1, String(id));
            });
        };
        procesarArbol(data.tree || data.nodes || data.children || (Array.isArray(data) ? data : null));
    }

    // 3. Grupos hardcoded conocidos siempre disponibles (con sus IDs reales)
    // Agregar si no fueron encontrados por API
    GRUPOS_FALLBACK.forEach(g => agregar(g.id, g.nombre, g.nivel, g.padre, g.esFavorito));

    // Ordenar por nivel, luego nombre
    grupos.sort((a, b) => (a.nivel - b.nivel) || a.nombre.localeCompare(b.nombre));

    return grupos;
}

// =============================================================================
// MODO B: LOGIN HTTP — Sin Chrome
// =============================================================================
async function loginHTTP(credenciales, reportar) {
    const usuario = credenciales.usuario || process.env.BOT_TOA_USER || '';
    const clave   = credenciales.clave   || process.env.BOT_TOA_PASS  || '';
    if (!usuario) throw new Error('LOGIN_FAILED: usuario no configurado');
    if (!clave)   throw new Error('LOGIN_FAILED: contraseña no configurada');

    reportar(`   Usuario: "${usuario}" | Clave: ${clave.length} chars`);

    const agent  = new https.Agent({ rejectUnauthorized: false, keepAlive: false });
    const jar    = new Map();
    const hdrs   = {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'es-CL,es;q=0.9'
    };

    const addCookies  = (h) => { const v = Array.from(jar.entries()).map(([k,v])=>`${k}=${v}`).join('; '); return v ? { ...h, Cookie: v } : h; };
    const parseCookies = (sc) => { if (!sc) return; (Array.isArray(sc)?sc:[sc]).forEach(c => { const [kv] = c.split(';'); const i = kv.indexOf('='); if (i>0) jar.set(kv.substring(0,i).trim(), kv.substring(i+1).trim()); }); };

    // GET login
    reportar('   [1/4] GET login page...');
    const pg = await axios.get(TOA_URL, { httpsAgent: agent, maxRedirects: 15, validateStatus: ()=>true, headers: hdrs, timeout: 30000 });
    parseCookies(pg.headers['set-cookie']);
    reportar(`   Status: ${pg.status} | Size: ${String(pg.data||'').length} | Cookies: ${jar.size}`);

    // Extraer campos hidden
    const html = String(pg.data || '');
    const hidden = {};
    let m; const re = /<input[^>]+type=["']?hidden["']?[^>]*>/gi;
    while ((m = re.exec(html)) !== null) {
        const nm = m[0].match(/name=["']([^"']+)["']/);
        const vl = m[0].match(/value=["']([^"']*)['"]/);
        if (nm) hidden[nm[1]] = vl ? vl[1] : '';
    }
    if (Object.keys(hidden).length) reportar(`   Hidden: ${Object.keys(hidden).join(', ')}`);

    const formAction = (() => {
        const a = html.match(/<form[^>]+action=["']([^"'?]+)['"]/i);
        if (!a) return TOA_URL;
        return a[1].startsWith('http') ? a[1] : `https://${TOA_HOST}${a[1]}`;
    })();
    reportar(`   Form action: ${formAction}`);

    // POST credenciales
    reportar('   [2/4] POST credenciales...');
    const body = new URLSearchParams({ ...hidden, username: usuario, password: clave });
    const pr = await axios.post(formAction, body.toString(), {
        httpsAgent: agent, maxRedirects: 15, validateStatus: ()=>true, timeout: 30000,
        headers: addCookies({ ...hdrs, 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': `https://${TOA_HOST}`, 'Referer': TOA_URL })
    });
    parseCookies(pr.headers['set-cookie']);
    reportar(`   POST status: ${pr.status} | Cookies: ${jar.size}`);

    const loginHtml = String(pr.data || '');
    if (/incorrectos?|Invalid.credential|wrong.password/i.test(loginHtml)) throw new Error('LOGIN_FAILED: Usuario o contraseña incorrectos');
    if (pr.status >= 400) throw new Error(`LOGIN_FAILED: HTTP ${pr.status}`);

    // GET dashboard
    reportar('   [3/4] GET dashboard...');
    const dr = await axios.get(TOA_URL, { httpsAgent: agent, maxRedirects: 15, validateStatus: ()=>true, timeout: 30000, headers: addCookies({ ...hdrs, 'Referer': TOA_URL }) });
    parseCookies(dr.headers['set-cookie']);
    const dashHtml = String(dr.data || '');
    reportar(`   Dashboard: ${dr.status} | Size: ${dashHtml.length} | Cookies: ${jar.size}`);
    reportar(`   Cookie names: ${Array.from(jar.keys()).join(', ')}`);

    // Buscar CSRF en HTML
    let csrfToken = '';
    const csrfPats = [
        /window\.CSRFSecureToken\s*=\s*["']([^"']{8,})["']/,
        /CSRFSecureToken["']?\s*[:=]\s*["']([^"']{8,})["']/,
        /"csrfToken"\s*:\s*"([^"]{8,})"/,
        /csrf[_-]?token["']?\s*[:=]\s*["']([^"']{8,})["']/i,
        /X-OFS-CSRF-SECURE["']\s*:\s*["']([^"']{8,})["']/i,
        /name="__RequestVerificationToken"[^>]+value="([^"]{8,})"/i,
        /data-csrf=["']([^"']{8,})["']/i,
        /"_csrf"\s*:\s*"([^"]{8,})"/
    ];
    for (const p of csrfPats) { const x = dashHtml.match(p); if (x) { csrfToken = x[1]; reportar(`   CSRF en HTML: ${csrfToken.substring(0,20)}...`); break; } }

    // Buscar en cookies
    if (!csrfToken) {
        csrfToken = extraerCSRFDeCookies(Array.from(jar.entries()).map(([k,v])=>`${k}=${v}`).join('; '));
        if (csrfToken) reportar(`   CSRF desde cookie: ${csrfToken.substring(0,20)}...`);
    }

    if (!csrfToken) reportar('   ⚠️ CSRF no encontrado en HTML ni cookies (Oracle JET lo inyecta vía JS)');

    // Intentar GET de endpoint ligero para obtener CSRF
    reportar('   [4/4] Intentando endpoints ligeros para CSRF...');
    const lightEndpoints = ['?m=Auth&a=getToken&output=ajax', '?m=Session&a=get&output=ajax'];
    for (const ep of lightEndpoints) {
        try {
            const lr = await axios.get(TOA_URL + ep, { httpsAgent: agent, validateStatus: ()=>true, timeout: 10000, headers: addCookies({ ...hdrs, 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }) });
            parseCookies(lr.headers['set-cookie']);
            const lBody = String(lr.data || '');
            if (lBody.includes('csrf') || lBody.includes('token')) {
                reportar(`   ${ep} → ${lBody.substring(0, 100)}`);
                for (const p of csrfPats) { const x = lBody.match(p); if (x) { csrfToken = x[1]; break; } }
            }
        } catch (_) {}
    }

    const sessionCookies = Array.from(jar.entries()).map(([k,v])=>`${k}=${v}`).join('; ');
    const gridUrl = TOA_URL + '?m=Grid&a=get&itype=manage&output=ajax';

    if (!csrfToken) reportar('   ⚠️ Sin CSRF → Grid API probablemente retornará 0 rows. Considera usar BROWSERLESS_KEY.');
    else            reportar(`   ✅ CSRF: ${csrfToken.substring(0,20)}...`);

    return { sessionCookies, csrfToken, gridUrl };
}

// =============================================================================
// MODO B: DESCUBRIR GRUPOS VÍA HTTP
// =============================================================================
async function descubrirGruposHTTP(gridUrl, sessionCookies, csrfToken, reportar) {
    reportar('🔍 Descubriendo grupos (HTTP)...');
    const grupos = [];
    const seen   = new Set();

    const agent = new https.Agent({ rejectUnauthorized: false });
    const hdrs  = {
        'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept':           'application/json, text/javascript, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie':           sessionCookies,
        ...(csrfToken ? { 'X-OFS-CSRF-SECURE': csrfToken } : {})
    };

    const endpointsBusqueda = [
        { url: TOA_URL + '?m=Resource&a=getTree&output=ajax',    method: 'GET'  },
        { url: TOA_URL + '?m=Resource&a=list&output=ajax',        method: 'GET'  },
        { url: TOA_URL + '?m=Bucket&a=list&output=ajax',          method: 'GET'  },
        { url: TOA_URL + '?m=Group&a=list&output=ajax',           method: 'GET'  },
        { url: TOA_URL + '?m=Resource&a=getChildren&pid=0&output=ajax', method: 'POST', body: 'pid=0' },
        { url: TOA_URL + '?m=AdminResource&a=getBuckets&output=ajax', method: 'GET' }
    ];

    for (const ep of endpointsBusqueda) {
        try {
            const opts = ep.method === 'GET'
                ? { httpsAgent: agent, validateStatus: ()=>true, timeout: 15000, headers: hdrs }
                : { httpsAgent: agent, validateStatus: ()=>true, timeout: 15000, headers: { ...hdrs, 'Content-Type': 'application/x-www-form-urlencoded' } };

            const resp = ep.method === 'GET'
                ? await axios.get(ep.url, opts)
                : await axios.post(ep.url, ep.body || '', opts);

            const data = resp.data;
            reportar(`   ${ep.url.split('?')[1]}: HTTP ${resp.status}`);

            if (resp.status === 200 && data && typeof data === 'object') {
                // Intentar extraer grupos
                const lists = [data.items, data.groups, data.buckets, data.resources, data.rows, data.data, Array.isArray(data) ? data : null];
                for (const list of lists) {
                    if (!Array.isArray(list)) continue;
                    list.forEach(item => {
                        const id     = item.id || item.gid || item.group_id || item.bucket_id;
                        const nombre = item.name || item.label || item.n || item.group_name;
                        if (id && nombre && !seen.has(String(id))) {
                            seen.add(String(id));
                            grupos.push({ id: String(id), nombre, nivel: item.level || 0, padre: item.parent_id ? String(item.parent_id) : null });
                            reportar(`   ✅ Grupo: ${nombre} [${id}]`);
                        }
                    });
                }
            } else if (resp.status === 200 && typeof data === 'string' && data.length > 10) {
                reportar(`   Raw: ${String(data).substring(0, 150)}`);
            }

        } catch (err) {
            reportar(`   ⚠️ ${ep.url.split('?')[1]}: ${err.message}`);
        }
        await new Promise(r => setTimeout(r, 500));
    }

    // Siempre incluir los conocidos
    GRUPOS_FALLBACK.forEach(g => {
        if (!seen.has(g.id)) {
            seen.add(g.id);
            grupos.push(g);
        }
    });

    if (grupos.length) reportar(`📋 Total grupos: ${grupos.length}`);
    return grupos;
}

// =============================================================================
// EXTRAER CSRF DESDE COOKIES
// =============================================================================
function extraerCSRFDeCookies(cookieString) {
    const patterns = [
        /OFS-CSRF[^=]*=([^;]{8,})/,
        /csrf[_-]?token[^=]*=([^;]{8,})/i,
        /XSRF[^=]*=([^;]{8,})/i,
        /security[^=]*=([^;]{20,})/i
    ];
    for (const p of patterns) { const m = cookieString.match(p); if (m) return m[1]; }
    return '';
}

// =============================================================================
// HTTP POST — Grid API
// =============================================================================
function httpPost(url, body, cookieString, csrfToken) {
    return new Promise((resolve, reject) => {
        try {
            const parsed  = new URL(url);
            const isHttps = parsed.protocol === 'https:';
            const opts = {
                hostname: parsed.hostname,
                port:     parsed.port || (isHttps ? 443 : 80),
                path:     parsed.pathname + parsed.search,
                method:   'POST',
                headers: {
                    'Content-Type':     'application/x-www-form-urlencoded',
                    'Content-Length':   Buffer.byteLength(body),
                    'Cookie':           cookieString || '',
                    'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept':           'application/json, text/javascript, */*; q=0.01',
                    'Referer':          TOA_URL,
                    ...(csrfToken ? { 'X-OFS-CSRF-SECURE': csrfToken } : {})
                }
            };
            const lib = isHttps ? https : http;
            const req = lib.request(opts, res => {
                let data = '';
                res.on('data', c => { data += c; });
                res.on('end', () => {
                    if (res.statusCode >= 400) {
                        resolve({ error: `HTTP ${res.statusCode}`, activitiesRows: [], _raw: data.substring(0, 300) });
                        return;
                    }
                    try { resolve(JSON.parse(data)); }
                    catch(e) { resolve({ error: `JSON: ${e.message}`, activitiesRows: [], _raw: data.substring(0, 300) }); }
                });
            });
            req.on('error', reject);
            req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout 30s')); });
            req.write(body);
            req.end();
        } catch(e) { reject(e); }
    });
}

// =============================================================================
// ESPERAR CONFIRMACIÓN
// =============================================================================
function esperarConfirmacion(timeoutMs, reportar) {
    return new Promise((resolve, reject) => {
        reportar(`⏳ Esperando selección del usuario (máx. ${Math.round(timeoutMs/1000)}s)...`);
        const timer = setTimeout(() => reject(new Error('Timeout: usuario no confirmó grupos')), timeoutMs);

        if (process.send) {
            const h = msg => {
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
                    clearTimeout(timer);
                    clearInterval(poll);
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
        const ordenId = row.key || row['144'] || row.appt_number || `${empresa}_${fecha}_${Math.random().toString(36).slice(2)}`;
        const doc = {
            ordenId, empresa, bucket: empresa, bucketId,
            fecha: new Date(fecha + 'T00:00:00Z'),
            recurso:                 row.pname    || '',
            'Número de Petición':    row.appt_number || row['144'] || '',
            'Estado':                row.astatus  || '',
            'Subtipo de Actividad':  row.aworktype || '',
            'Ventana de servicio':   row.service_window  || '',
            'Ventana de Llegada':    row.delivery_window || '',
            'Nombre':                row.cname    || '',
            'RUT del cliente':       row.customer_number || row['362'] || '',
            telefono:               (row.cphone   || '').replace(/<[^>]+>/g, '').trim(),
            'Ciudad':                row.ccity    || row.cstate || '',
            latitud:                 row.acoord_y ? String(row.acoord_y) : null,
            longitud:                row.acoord_x ? String(row.acoord_x) : null,
            camposCustom:            Object.fromEntries(Object.entries(row).filter(([k]) => /^\d+$/.test(k))),
            rawData:                 row,
            ultimaActualizacion:     new Date(),
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

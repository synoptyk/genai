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
// Estrategia principal: INTERCEPTAR XHR — cuando TOA carga cada grupo en
// el sidebar, hace POST con gid=XXXX → capturamos TODOS los IDs automáticamente.
// Luego navegamos/clickeamos el sidebar para triggear los XHR de cada carpeta.
// =============================================================================
async function loginYScanConChrome(credenciales, reportar, usarBrowserless = false) {
    const puppeteer = require('puppeteer');
    const usuario   = credenciales.usuario || process.env.BOT_TOA_USER || '';
    const clave     = credenciales.clave   || process.env.BOT_TOA_PASS  || '';
    if (!usuario) throw new Error('LOGIN_FAILED: usuario no configurado');
    if (!clave)   throw new Error('LOGIN_FAILED: contraseña no configurada');

    const cerrar = (b) => usarBrowserless ? b.disconnect().catch(()=>{}) : b.close().catch(()=>{});

    let browser;
    if (usarBrowserless) {
        reportar(`🌐 Conectando a Browserless.io...`);
        browser = await puppeteer.connect({
            browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_KEY}&timeout=180000`,
            defaultViewport: { width: 1366, height: 900 }
        });
    } else {
        reportar(`🖥️  Lanzando Chrome local headless (2GB RAM disponibles)...`);
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox', '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', '--disable-gpu',
                '--no-first-run', '--disable-extensions',
                '--disable-background-networking', '--mute-audio',
                '--window-size=1366,900'
            ],
            defaultViewport: { width: 1366, height: 900 },
            timeout: 60000
        });
    }

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        page.on('dialog', async d => { try { await d.dismiss(); } catch(_) {} });

        // ── INTERCEPCIÓN COMPLETA: requests + responses ───────────────────────
        // Capturamos gid de los requests Y nombres de grupo de las responses
        const gruposXHR = new Map();   // gid → { id, nombre, nivel, padre }
        let   gridUrl   = TOA_URL + '?m=Grid&a=get&itype=manage&output=ajax';
        let   csrfXHR   = '';

        await page.setRequestInterception(true);

        // Interceptar REQUESTS: extraer gid y CSRF
        page.on('request', req => {
            try {
                const rt = req.resourceType();
                if (['image', 'media', 'font'].includes(rt)) { req.abort(); return; }

                const url  = req.url();
                const meth = req.method();
                const body = req.postData() || '';
                const hdrs = req.headers() || {};

                // Capturar CSRF del header (lo usa TOA en cada XHR)
                if (!csrfXHR && hdrs['x-ofs-csrf-secure']) {
                    csrfXHR = hdrs['x-ofs-csrf-secure'];
                    reportar(`🔑 CSRF capturado de request: ${csrfXHR.substring(0,20)}...`);
                }

                // Capturar Grid API calls y extraer gid
                if (meth === 'POST' && url.includes('output=ajax')) {
                    if (url.includes('m=Grid')) gridUrl = url;
                    const gidMatches = [...body.matchAll(/(?:^|&)gid=(\d+)/g)];
                    gidMatches.forEach(m => {
                        const gid = m[1];
                        if (!gruposXHR.has(gid)) {
                            gruposXHR.set(gid, { id: gid, nombre: `Grupo_${gid}`, nivel: 0, padre: null });
                            reportar(`   📡 XHR request → gid=${gid} (${url.split('?')[1]?.substring(0,40)})`);
                        }
                    });
                }

                req.continue();
            } catch(e) { try { req.continue(); } catch(_) {} }
        });

        // Interceptar RESPONSES: extraer nombres de grupo del JSON que TOA devuelve
        page.on('response', async resp => {
            try {
                const url = resp.url();
                if (!url.includes('output=ajax')) return;

                const text = await resp.text().catch(()=>'');
                if (!text || text.length < 10) return;

                let data;
                try { data = JSON.parse(text); } catch(_) { return; }

                // Buscar nombre de grupo en la respuesta JSON
                const gname = data.gname || data.group_name || data.bucket_name ||
                              data.name   || data.label      || data.title;
                const gid   = data.gid   || data.group_id   || data.bucket_id;

                if (gid && gname && gruposXHR.has(String(gid))) {
                    const g = gruposXHR.get(String(gid));
                    if (g.nombre.startsWith('Grupo_')) {
                        g.nombre = gname;
                        reportar(`   ✅ Nombre obtenido de response: gid=${gid} → "${gname}"`);
                    }
                }

                // También buscar en arrays dentro del JSON (ej: lista de grupos)
                const listas = [data.items, data.groups, data.buckets, data.rows, data.data];
                listas.forEach(lista => {
                    if (!Array.isArray(lista)) return;
                    lista.forEach(item => {
                        const iid   = String(item.gid || item.id || item.group_id || item.bucket_id || '');
                        const iname = item.gname || item.name || item.label || item.group_name || '';
                        if (iid && iname && iid.length >= 3) {
                            if (!gruposXHR.has(iid)) {
                                gruposXHR.set(iid, { id: iid, nombre: iname, nivel: 0, padre: null });
                                reportar(`   ✅ Grupo desde response JSON: ${iname} [${iid}]`);
                            } else if (gruposXHR.get(iid).nombre.startsWith('Grupo_')) {
                                gruposXHR.get(iid).nombre = iname;
                            }
                        }
                    });
                });
            } catch(_) {}
        });

        // ── NAVEGAR A TOA ────────────────────────────────────────────────────
        reportar('🔗 Navegando a TOA...');
        await page.goto(TOA_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(r => setTimeout(r, 3000));

        // Esperar campo password
        await page.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 })
            .catch(() => reportar('⚠️ No encontré input password, continúo...'));

        // ── LOGIN ─────────────────────────────────────────────────────────────
        reportar(`   Llenando credenciales (usuario: ${usuario})...`);
        const llenar = async (sel, val) => {
            const f = await page.$(sel);
            if (!f) return false;
            await f.click({ clickCount: 3 });
            await page.keyboard.press('Delete');
            await new Promise(r => setTimeout(r, 150));
            await f.type(val, { delay: 40 });
            return true;
        };

        for (const sel of ['input#username','input[name="username"]','input[autocomplete="username"]','input[type="text"]']) {
            if (await llenar(sel, usuario)) break;
        }
        await llenar('input[type="password"]', clave);

        await page.evaluate(() => {
            const btns = [...document.querySelectorAll('button, input[type=submit]')];
            const btn  = btns.find(b => /iniciar|login|sign.?in|entrar/i.test((b.textContent||'')+(b.value||'')));
            (btn || btns[0])?.click();
        });
        reportar('   Click login...');

        // ── ESPERAR DASHBOARD (TOA Oracle JET es lento) ───────────────────────
        reportar('⏳ Esperando dashboard TOA (puede tardar 20-40s)...');
        await page.waitForFunction(() => {
            const txt = document.body?.innerText || '';
            return txt.includes('COMFICA') || txt.includes('ZENER') || txt.includes('CHILE') ||
                   txt.includes('Dispatch') || txt.length > 8000 ||
                   !!document.querySelector('[class*="treeview"],[class*="tree-view"],[role="tree"]');
        }, { timeout: 90000 }).catch(() => reportar('⚠️ Timeout dashboard, continúo...'));

        // Esperar carga completa de Oracle JET
        reportar('   Esperando carga completa Oracle JET...');
        await new Promise(r => setTimeout(r, 8000));

        const title = await page.title().catch(()=>'');
        const url   = page.url();   // síncrono en Puppeteer moderno
        reportar(`   Título: "${title}" | URL: ${url}`);

        // ── EXTRAER CSRF ──────────────────────────────────────────────────────
        const csrfJS = await page.evaluate(() =>
            window.CSRFSecureToken || window.csrfToken || window._csrf ||
            document.querySelector('[name=csrf_token]')?.value || ''
        ).catch(()=>'');

        const csrfToken = csrfJS || csrfXHR || '';
        reportar(`🔑 CSRF: ${csrfToken ? '✅ ' + csrfToken.substring(0,20)+'...' : '❌ no encontrado'}`);

        // ── VOLCADO DE HTML DEL SIDEBAR ────────────────────────────────────────
        reportar('🔍 Analizando DOM del sidebar TOA...');
        const domInfo = await page.evaluate(() => {
            // Obtener TODO el HTML del sidebar/nav/tree para análisis
            const sidebarCandidates = [
                document.querySelector('[class*="sidebar"]'),
                document.querySelector('[class*="treeview"]'),
                document.querySelector('[class*="tree-view"]'),
                document.querySelector('[role="tree"]'),
                document.querySelector('[class*="nav-tree"]'),
                document.querySelector('[class*="resource-tree"]'),
                document.querySelector('nav'),
                document.querySelector('[id*="sidebar"]'),
                document.querySelector('[id*="tree"]')
            ].filter(Boolean);

            const sidebarEl  = sidebarCandidates[0] || document.body;
            const sidebarHTML = sidebarEl.innerHTML?.substring(0, 8000) || '';
            const sidebarText = sidebarEl.innerText || '';

            // Buscar TODOS los atributos data-* que contienen números (posibles IDs)
            const allDataAttrs = new Set();
            document.querySelectorAll('*').forEach(el => {
                [...el.attributes].forEach(attr => {
                    if (attr.name.startsWith('data-') && /^\d+$/.test(attr.value) && attr.value.length >= 3) {
                        allDataAttrs.add(`${attr.name}=${attr.value} (${el.tagName}.${el.className?.split(' ')[0]||''})`);
                    }
                });
            });

            // Buscar elementos con texto de grupos conocidos y sus padres
            const grupoTextos = ['COMFICA','ZENER','CHILE','Gerencia','SSPP','Torre','Bucket','Eliminados','Prueba'];
            const encontrados = [];
            document.querySelectorAll('*').forEach(el => {
                const txt = el.textContent?.trim() || '';
                if (grupoTextos.some(g => txt.startsWith(g)) && txt.length < 80 && el.children.length === 0) {
                    // Buscar ID en el elemento o sus ancestros
                    let idEncontrado = '';
                    let cur = el;
                    for (let i = 0; i < 8 && cur; i++, cur = cur.parentElement) {
                        const allAttrs = [...(cur.attributes||[])].map(a=>`${a.name}=${a.value}`).join(' ');
                        if (/\d{3,}/.test(allAttrs)) { idEncontrado = allAttrs.substring(0,200); break; }
                    }
                    encontrados.push({ texto: txt, attrs: idEncontrado });
                }
            });

            return {
                sidebarHTML,
                sidebarText: sidebarText.substring(0, 2000),
                allDataAttrs: [...allDataAttrs].slice(0, 50),
                encontrados: encontrados.slice(0, 30),
                bodyText: document.body.innerText.substring(0, 3000)
            };
        }).catch(e => ({ error: e.message }));

        // Log todo el análisis DOM
        reportar(`   Sidebar HTML primeros 500 chars: ${domInfo.sidebarHTML?.substring(0,500) || 'N/A'}`);
        reportar(`   Sidebar TEXT: ${domInfo.sidebarText?.substring(0,500) || 'N/A'}`);

        if (domInfo.allDataAttrs?.length) {
            reportar(`   data-* numéricos encontrados (${domInfo.allDataAttrs.length}):`);
            domInfo.allDataAttrs.slice(0,20).forEach(a => reportar(`     ${a}`));
        }

        if (domInfo.encontrados?.length) {
            reportar(`   Elementos con nombre de grupo (${domInfo.encontrados.length}):`);
            domInfo.encontrados.forEach(e => reportar(`     "${e.texto}" → ${e.attrs || 'sin ID'}`));
        }

        // ── NAVEGAR EL SIDEBAR: click en cada ítem para triggear XHR ─────────
        reportar('🖱️  Navegando sidebar TOA (click en grupos para capturar gid por XHR)...');

        const clicksHechos = await page.evaluate(async () => {
            const delay = ms => new Promise(r => setTimeout(r, ms));
            let clicks = 0;

            // Selectores específicos de Oracle JET treeview
            const treeSelectors = [
                '.oj-treeview-item-content',
                '.oj-tree-item a',
                '[class*="oj-tree"] [class*="item"]',
                '[class*="treeview"] [class*="node"]',
                '[class*="tree-item"]',
                '[class*="sidebar"] li',
                '[class*="sidebar"] a',
                '[class*="nav"] li > a',
                '[role="treeitem"]',
                '[class*="resource"] li',
                '[class*="group"] li'
            ];

            for (const sel of treeSelectors) {
                const items = [...document.querySelectorAll(sel)];
                for (const item of items) {
                    if (item.offsetParent !== null && item.offsetWidth > 0) {
                        try { item.click(); clicks++; await delay(400); } catch (_) {}
                    }
                }
                if (clicks > 0) break; // Usar el primer selector que funcione
            }

            // Si no encontramos con selectores específicos, click en texto de grupos
            if (clicks === 0) {
                const allElements = [...document.querySelectorAll('span, a, li, div')];
                const gruposTexto = ['COMFICA','ZENER','CHILE','Gerencia','SSPP','Torre'];
                for (const el of allElements) {
                    const txt = el.textContent?.trim() || '';
                    if (gruposTexto.some(g => txt.startsWith(g)) && txt.length < 60 && el.offsetParent !== null) {
                        try { el.click(); clicks++; await delay(500); } catch(_) {}
                    }
                }
            }

            return clicks;
        });

        reportar(`   Clicks en sidebar: ${clicksHechos}`);
        await new Promise(r => setTimeout(r, 5000)); // Esperar XHR respuestas

        // ── EXPANDIR CARPETAS Y REPETIR ───────────────────────────────────────
        reportar('📂 Expandiendo subcarpetas...');
        const clicksExpand = await page.evaluate(async () => {
            const delay = ms => new Promise(r => setTimeout(r, ms));
            let clicks = 0;
            const expandSelectors = [
                '.oj-treeview-expand-icon', '.oj-tree-icon.oj-collapsed',
                '[class*="expand"]', '[aria-expanded="false"]',
                '[class*="arrow"][class*="collapsed"]', '[class*="toggle"]',
                '[class*="disclosure"]'
            ];
            for (const sel of expandSelectors) {
                const items = [...document.querySelectorAll(sel)];
                for (const item of items) {
                    if (item.offsetParent !== null) {
                        try { item.click(); clicks++; await delay(300); } catch(_) {}
                    }
                }
            }
            return clicks;
        });

        reportar(`   Clicks expandir: ${clicksExpand}`);
        await new Promise(r => setTimeout(r, 5000));

        // ── SEGUNDO ROUND DE CLICKS (ahora con subcarpetas visibles) ─────────
        const clicks2 = await page.evaluate(async () => {
            const delay = ms => new Promise(r => setTimeout(r, ms));
            let clicks = 0;
            const all = [...document.querySelectorAll('.oj-treeview-item-content, [role="treeitem"], [class*="tree-item"]')];
            for (const el of all) {
                if (el.offsetParent !== null) {
                    try { el.click(); clicks++; await delay(400); } catch(_) {}
                }
            }
            return clicks;
        });
        reportar(`   Segundo round clicks: ${clicks2}`);
        await new Promise(r => setTimeout(r, 4000));

        // ── OBTENER TEXTO COMPLETO DE SIDEBAR DESPUÉS DE EXPANDIR ────────────
        const sidebarFinal = await page.evaluate(() => {
            const candidates = [
                document.querySelector('[class*="treeview"]'),
                document.querySelector('[role="tree"]'),
                document.querySelector('[class*="sidebar"]'),
                document.querySelector('[class*="nav"]'),
                document.body
            ];
            const el = candidates.find(c => c && c.innerText?.length > 100) || document.body;
            return el.innerText?.substring(0, 5000) || '';
        }).catch(()=>'');

        reportar('📋 Contenido sidebar TOA (texto completo):');
        sidebarFinal.split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 1 && l.length < 100)
            .slice(0, 60)
            .forEach(l => reportar(`  │ ${l}`));

        // ── CONSTRUIR LISTA DE GRUPOS ─────────────────────────────────────────
        // 1. Desde XHR interceptados
        const gruposDesdeXHR = [...gruposXHR.values()];

        // 2. Intentar obtener nombres desde el sidebar text
        const nombresSidebar = sidebarFinal.split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 2 && l.length < 80 && !/^[\d\s\-_]+$/.test(l));

        // 3. Mapear nombres a IDs XHR por posición/texto si es posible
        gruposDesdeXHR.forEach(g => {
            // Si el nombre genérico (Grupo_XXXX) corresponde a un nombre del sidebar, usarlo
            const idx = gruposDesdeXHR.indexOf(g);
            if (nombresSidebar[idx]) g.nombre = nombresSidebar[idx];
        });

        // 4. Siempre incluir grupos conocidos con sus IDs reales
        const seenIds = new Set(gruposDesdeXHR.map(g => g.id));
        GRUPOS_FALLBACK.forEach(g => { if (!seenIds.has(g.id)) gruposDesdeXHR.push(g); });

        reportar(`\n📊 RESUMEN SCAN:`);
        reportar(`   Grupos por XHR: ${gruposXHR.size}`);
        reportar(`   Total grupos: ${gruposDesdeXHR.length}`);
        gruposDesdeXHR.forEach(g => reportar(`   ${'  '.repeat(g.nivel||0)}📁 ${g.nombre} [gid:${g.id}]`));

        // ── TEST DIRECTO DE LA GRID API DESDE LA PÁGINA ───────────────────────
        reportar('\n🧪 Probando Grid API directamente desde browser (con CSRF real)...');
        const gridTestResult = await page.evaluate(async (testGid, csrf) => {
            const fechaHoy = new Date();
            const mm = String(fechaHoy.getMonth()+1).padStart(2,'0');
            const dd = String(fechaHoy.getDate()).padStart(2,'0');
            const yyyy = fechaHoy.getFullYear();
            const fechas = [`${mm}/${dd}/${yyyy}`, `${dd}/${mm}/${yyyy}`];

            const resultados = [];
            for (const fecha of fechas) {
                try {
                    const resp = await fetch(`${window.location.origin}/?m=Grid&a=get&itype=manage&output=ajax`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'X-Requested-With': 'XMLHttpRequest',
                            'Accept': 'application/json',
                            ...(csrf ? { 'X-OFS-CSRF-SECURE': csrf } : {})
                        },
                        body: `date=${encodeURIComponent(fecha)}&gid=${testGid}`
                    });
                    const text = await resp.text();
                    let rows = 0;
                    try { rows = JSON.parse(text)?.activitiesRows?.length || 0; } catch(_) {}
                    resultados.push({ fecha, status: resp.status, rows, raw: text.substring(0, 300) });
                } catch(e) {
                    resultados.push({ fecha, error: e.message });
                }
            }
            return resultados;
        }, GRUPOS_FALLBACK[0]?.id || '3840', csrfToken).catch(e => [{ error: e.message }]);

        gridTestResult.forEach(r => {
            if (r.error) reportar(`   ❌ Grid test error: ${r.error}`);
            else reportar(`   Grid ${r.fecha}: HTTP ${r.status} | rows: ${r.rows} | raw: ${r.raw?.substring(0,150)}`);
        });

        // ── OBTENER COOKIES ───────────────────────────────────────────────────
        const rawCookies     = await page.cookies();
        const sessionCookies = rawCookies.map(c => `${c.name}=${c.value}`).join('; ');
        reportar(`   Cookies obtenidas: ${rawCookies.length} | CSRF final: ${csrfToken ? '✅' : '❌'}`);

        await cerrar(browser);
        return { sessionCookies, csrfToken, gridUrl, grupos: gruposDesdeXHR };

    } catch (e) {
        await cerrar(browser);
        throw e;
    }
}

// (funciones obsoletas eliminadas — scan ahora usa solo XHR interception + DOM text)

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

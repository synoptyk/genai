'use strict';

// =============================================================================
// TOA AGENTE v13 — SESIÓN ÚNICA: Chrome abierto durante todo el proceso
//
// PROBLEMA ANTERIOR: SESSION_DESTROYED porque cerrábamos Chrome después del
// scan y luego intentábamos usar las cookies en HTTP → TOA destruye la sesión.
//
// SOLUCIÓN: Chrome se abre UNA VEZ y permanece abierto hasta terminar.
//   Fase 1: Login + Scan del sidebar (captura gid por XHR interception)
//   Fase 2: Esperar selección del usuario (Chrome sigue abierto)
//   Fase 3: Extracción via page.evaluate(fetch()) — misma sesión activa
//   Fase 4: Cierre de Chrome
//
// Modo A (default): Chrome LOCAL headless (Render Estándar 2GB)
// Modo B (BROWSERLESS_KEY): Chrome remoto vía Browserless.io
// Modo C (SKIP_CHROME=true): HTTP puro (sin sesión real, solo grupos conocidos)
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

    // Construir lista de fechas
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

    reportar(`🚀 TOA Bot v13 | ${modo} | ${fechasAProcesar.length} días`);
    reportar(`   ${fechasAProcesar[0]} → ${fechasAProcesar[fechasAProcesar.length - 1]}`);

    const usarChrome     = process.env.SKIP_CHROME !== 'true';
    const usarBrowserless = !!process.env.BROWSERLESS_KEY;

    if (usarBrowserless) reportar('🌐 Chrome remoto (Browserless.io)');
    else if (usarChrome) reportar('🖥️  Chrome LOCAL (2GB RAM)');
    else                 reportar('📡 HTTP puro (sin Chrome)');

    let browser = null;
    let page    = null;

    try {
        let grupos, csrfToken, gridUrl;

        if (usarChrome) {
            // ── Iniciar Chrome y hacer login ──────────────────────────────────
            const session = await iniciarSesionChrome(credenciales, reportar, usarBrowserless);
            browser    = session.browser;
            page       = session.page;
            grupos     = session.grupos;
            csrfToken  = session.csrfToken;
            gridUrl    = session.gridUrl;
            // ⚠️ Chrome NO se cierra aquí — permanece abierto para la extracción
        } else {
            // ── HTTP puro (sin sesión real) ───────────────────────────────────
            reportar('🔐 Login HTTP...');
            const r = await loginHTTP(credenciales, reportar);
            grupos    = await descubrirGruposHTTP(r.gridUrl, r.sessionCookies, r.csrfToken, reportar);
            csrfToken = r.csrfToken;
            gridUrl   = r.gridUrl;
        }

        reportar(`📋 Grupos: ${grupos.length} — ${grupos.map(g=>g.nombre).join(', ')}`);

        // ── Enviar grupos al frontend para selección ──────────────────────────
        if (process.send) process.send({ type: 'grupos_encontrados', grupos });
        else if (global.BOT_STATUS) {
            global.BOT_STATUS.gruposEncontrados  = grupos;
            global.BOT_STATUS.esperandoSeleccion = true;
        }

        const gruposSeleccionados = await esperarConfirmacion(180000, reportar);
        reportar(`✅ ${gruposSeleccionados.length} grupo(s) confirmados`);
        if (!gruposSeleccionados.length) throw new Error('No se seleccionó ningún grupo');

        // ── Extracción ────────────────────────────────────────────────────────
        reportar(`\n📡 Extrayendo ${fechasAProcesar.length} días × ${gruposSeleccionados.length} grupo(s)...`);
        reportar(usarChrome ? '   (vía Chrome — sesión activa)' : '   (vía HTTP)');

        let totalGuardados = 0;

        for (let i = 0; i < fechasAProcesar.length; i++) {
            const fecha = fechasAProcesar[i];
            const [yyyy, mm, dd] = fecha.split('-');

            if (process.send) process.send({ type: 'progress', diaActual: i+1, totalDias: fechasAProcesar.length, fechaProcesando: fecha });
            else if (global.BOT_STATUS) { global.BOT_STATUS.diaActual = i+1; global.BOT_STATUS.fechaProcesando = fecha; }

            if (i % 5 === 0 || i === fechasAProcesar.length - 1) reportar(`📅 [${i+1}/${fechasAProcesar.length}] ${fecha}`);

            for (const grupo of gruposSeleccionados) {
                if (!grupo.id) { reportar(`  ⚠️ ${grupo.nombre}: sin ID`); continue; }
                try {
                    let rows = [];

                    if (usarChrome && page) {
                        // ── Extracción desde browser (sesión activa) ──────────
                        rows = await extraerViaChrome(page, fecha, grupo.id, csrfToken, gridUrl, reportar);
                    } else {
                        // ── Extracción HTTP ───────────────────────────────────
                        const fechaFmt = `${mm}/${dd}/${yyyy}`;
                        const body     = `date=${encodeURIComponent(fechaFmt)}&gid=${grupo.id}`;
                        const res      = await httpPost(gridUrl, body, '', csrfToken);
                        if (!res.error) rows = res.activitiesRows || [];
                        else reportar(`  ⚠️ ${grupo.nombre}: ${res.error}`);
                    }

                    if (rows.length > 0) {
                        const guardados = await guardarActividades(rows, grupo.nombre, fecha, parseInt(grupo.id), empresaRef);
                        totalGuardados += guardados;
                        reportar(`  💾 ${grupo.nombre} ${fecha}: ${rows.length} actividades → ${guardados} guardadas`);
                        if (process.send) process.send({ type: 'log', text: `  💾 ${grupo.nombre} ${fecha}: ${guardados}` });
                        if (global.BOT_STATUS) global.BOT_STATUS.registrosGuardados = (global.BOT_STATUS.registrosGuardados||0) + guardados;
                    }

                    await new Promise(r => setTimeout(r, 400));
                } catch (err) {
                    reportar(`  ❌ ${grupo.nombre} ${fecha}: ${err.message}`);
                }
            }
        }

        reportar(`\n🏁 COMPLETADO. Total: ${totalGuardados} registros guardados.`);
        if (process.send) process.send({ type: 'log', text: `🏁 COMPLETADO. ${totalGuardados} registros.`, completed: true });
        if (global.BOT_STATUS) { global.BOT_STATUS.running = false; global.BOT_STATUS.esperandoSeleccion = false; }

    } catch (error) {
        const msg = error.message || 'Error desconocido';
        reportar(`❌ ERROR FATAL: ${msg}`);
        console.error(error);
        if (process.send) process.send({ type: 'log', text: `❌ ERROR: ${msg}`, completed: true });
        if (global.BOT_STATUS) { global.BOT_STATUS.ultimoError = msg; global.BOT_STATUS.running = false; global.BOT_STATUS.esperandoSeleccion = false; }
    } finally {
        // Cerrar Chrome al final (éxito o error)
        if (browser) {
            try {
                const usarBrowserless = !!process.env.BROWSERLESS_KEY;
                usarBrowserless ? await browser.disconnect() : await browser.close();
                reportar('🔒 Chrome cerrado.');
            } catch(_) {}
        }
        process.env.BOT_ACTIVE_LOCK = 'OFF';
    }
};

// =============================================================================
// INICIAR SESIÓN CHROME — login + scan sidebar
// Retorna { browser, page, grupos, csrfToken, gridUrl }
// ⚠️ NO cierra el browser — la sesión se mantiene para la extracción
// =============================================================================
async function iniciarSesionChrome(credenciales, reportar, usarBrowserless = false) {
    const puppeteer = require('puppeteer');
    const usuario   = credenciales.usuario || process.env.BOT_TOA_USER || '';
    const clave     = credenciales.clave   || process.env.BOT_TOA_PASS  || '';
    if (!usuario) throw new Error('LOGIN_FAILED: usuario no configurado');
    if (!clave)   throw new Error('LOGIN_FAILED: contraseña no configurada');

    // Lanzar Chrome
    let browser;
    if (usarBrowserless) {
        reportar('🌐 Conectando Browserless.io...');
        browser = await puppeteer.connect({
            browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_KEY}&timeout=600000`,
            defaultViewport: { width: 1366, height: 900 }
        });
    } else {
        reportar('🖥️  Lanzando Chrome local...');
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

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    page.on('dialog', async d => { try { await d.dismiss(); } catch(_) {} });

    // ── INTERCEPTAR XHR: capturar gid y CSRF ─────────────────────────────────
    const gruposXHR = new Map();
    let   gridUrl   = TOA_URL + '?m=Grid&a=get&itype=manage&output=ajax';
    let   csrfXHR   = '';

    await page.setRequestInterception(true);

    page.on('request', req => {
        try {
            const rt = req.resourceType();
            if (['image', 'media', 'font'].includes(rt)) { req.abort(); return; }

            const url  = req.url();
            const meth = req.method();
            const body = req.postData() || '';
            const hdrs = req.headers() || {};

            // Capturar CSRF de cualquier XHR
            if (!csrfXHR && hdrs['x-ofs-csrf-secure']) {
                csrfXHR = hdrs['x-ofs-csrf-secure'];
                reportar(`🔑 CSRF capturado (XHR header): ${csrfXHR.substring(0,20)}...`);
            }

            // Capturar gid de llamadas al Grid
            if (meth === 'POST' && url.includes('output=ajax')) {
                if (url.includes('m=Grid')) gridUrl = url;
                for (const m of body.matchAll(/(?:^|&)gid=(\d+)/g)) {
                    const gid = m[1];
                    if (!gruposXHR.has(gid)) {
                        gruposXHR.set(gid, { id: gid, nombre: `Grupo_${gid}`, nivel: 0, padre: null });
                        reportar(`   📡 XHR gid=${gid} capturado`);
                    }
                }
            }
            req.continue();
        } catch(e) { try { req.continue(); } catch(_) {} }
    });

    // Capturar nombres de grupos desde las respuestas
    page.on('response', async resp => {
        try {
            const url = resp.url();
            if (!url.includes('output=ajax')) return;
            const text = await resp.text().catch(()=>'');
            if (!text || text.length < 5) return;
            let data; try { data = JSON.parse(text); } catch(_) { return; }

            // Nombre del grupo en el objeto raíz
            const gid   = String(data.gid || data.group_id || data.bucket_id || '');
            const gname = data.gname || data.group_name || data.bucket_name || data.name || '';
            if (gid && gname && gruposXHR.has(gid) && gruposXHR.get(gid).nombre.startsWith('Grupo_')) {
                gruposXHR.get(gid).nombre = gname;
                reportar(`   ✅ Nombre de response: gid=${gid} → "${gname}"`);
            }

            // Arrays dentro del JSON
            [data.items, data.groups, data.buckets, data.rows, data.data].forEach(lista => {
                if (!Array.isArray(lista)) return;
                lista.forEach(item => {
                    const iid   = String(item.gid || item.id || item.group_id || '');
                    const iname = item.gname || item.name || item.label || item.group_name || '';
                    if (iid && iname && iid.length >= 3) {
                        if (!gruposXHR.has(iid)) {
                            gruposXHR.set(iid, { id: iid, nombre: iname, nivel: 0, padre: null });
                            reportar(`   ✅ Grupo desde array: ${iname} [${iid}]`);
                        } else if (gruposXHR.get(iid).nombre.startsWith('Grupo_')) {
                            gruposXHR.get(iid).nombre = iname;
                        }
                    }
                });
            });
        } catch(_) {}
    });

    // ── NAVEGAR A TOA ─────────────────────────────────────────────────────────
    reportar('🔗 Navegando a TOA...');
    await page.goto(TOA_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    // Esperar campo password
    await page.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 })
        .catch(() => reportar('⚠️ Campo password no visible, continúo...'));

    // ── LOGIN ─────────────────────────────────────────────────────────────────
    reportar(`   Usuario: ${usuario}`);
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

    // ── ESPERAR DASHBOARD ─────────────────────────────────────────────────────
    reportar('⏳ Esperando dashboard TOA (puede tardar 30-90s)...');
    await page.waitForFunction(() => {
        const txt = document.body?.innerText || '';
        return txt.includes('COMFICA') || txt.includes('ZENER') || txt.includes('CHILE') ||
               txt.includes('Dispatch') || txt.length > 5000 ||
               !!document.querySelector('[class*="treeview"],[role="tree"],[class*="sidebar"]') ||
               !!window.CSRFSecureToken;
    }, { timeout: 120000 }).catch(() => reportar('⚠️ Timeout 120s — continúo con lo disponible'));

    await new Promise(r => setTimeout(r, 5000));

    const dashTitle = await page.title().catch(()=>'');
    const dashUrl   = page.url();
    reportar(`   Título: "${dashTitle}" | URL: ${dashUrl}`);

    // ── ESPERAR CSRF (Oracle JET lo setea asincrónicamente) ───────────────────
    reportar('🔑 Esperando CSRF token de Oracle JET (máx 30s)...');
    const csrfJS = await page.evaluate(() => {
        return new Promise((resolve) => {
            // Ya disponible
            if (window.CSRFSecureToken) { resolve(window.CSRFSecureToken); return; }
            // Polling cada 500ms por hasta 30s
            let intentos = 0;
            const t = setInterval(() => {
                const csrf = window.CSRFSecureToken || window.csrfToken || window._csrf || '';
                if (csrf) { clearInterval(t); resolve(csrf); }
                else if (++intentos > 60) { clearInterval(t); resolve(''); }
            }, 500);
        });
    }).catch(() => '');

    const csrfToken = csrfJS || csrfXHR || '';
    reportar(`🔑 CSRF: ${csrfToken ? '✅ ' + csrfToken.substring(0,30) + '...' : '❌ no encontrado — los fetch retornarán SESSION_DESTROYED'}`);

    // ── LEER SIDEBAR (solo lectura DOM — sin clicks que puedan navegar) ───────
    reportar('🔍 Leyendo sidebar TOA...');
    const sidebarTexto = await page.evaluate(() => {
        const cands = [
            document.querySelector('[class*="treeview"]'),
            document.querySelector('[role="tree"]'),
            document.querySelector('[class*="sidebar"]'),
            document.querySelector('[class*="nav"]'),
            document.body
        ];
        const el = cands.find(c => c && (c.innerText||'').length > 50) || document.body;
        return (el.innerText || '').substring(0, 4000);
    }).catch(()=>'');

    reportar('📋 Sidebar TOA (texto leído):');
    sidebarTexto.split('\n')
        .map(l => l.trim()).filter(l => l.length > 1 && l.length < 100)
        .slice(0, 50).forEach(l => reportar(`  │ ${l}`));

    // ── USAR TOA's PROPIA FUNCIÓN AJAX (desde dentro del browser) ─────────────
    // Esto garantiza que la sesión y CSRF siempre son correctos
    reportar('🔑 Verificando que la sesión funciona con Grid API...');
    const csrfFinal = csrfToken;
    const urlActual = page.url();
    reportar(`   URL actual: ${urlActual}`);

    // Prueba directa: llamar Grid API desde el browser (misma sesión)
    const testGid = GRUPOS_FALLBACK[0].id;
    const hoy = new Date().toISOString().split('T')[0];
    const testDebug = await page.evaluate(async (url, gid, csrf) => {
        const [y,m,d] = (new Date().toISOString().split('T')[0]).split('-');
        const fechas  = [`${m}/${d}/${y}`, `${d}/${m}/${y}`];
        const results = [];
        for (const fecha of fechas) {
            try {
                const r = await fetch(url, {
                    method: 'POST', credentials: 'include',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'application/json',
                        ...(csrf ? { 'X-OFS-CSRF-SECURE': csrf } : {})
                    },
                    body: `date=${encodeURIComponent(fecha)}&gid=${gid}`
                });
                const txt  = await r.text();
                let rows = 0; let errorNo = '';
                try { const j = JSON.parse(txt); rows = j.activitiesRows?.length || 0; errorNo = j.errorNo || ''; } catch(_) {}
                results.push({ fecha, status: r.status, rows, errorNo, raw: txt.substring(0, 200) });
            } catch(e) { results.push({ fecha, error: e.message }); }
        }
        // También reportar el CSRF actual desde window
        return { results, csrfWindow: window.CSRFSecureToken || '', url: window.location.href };
    }, gridUrl, testGid, csrfFinal).catch(e => ({ results: [{ error: e.message }], csrfWindow: '', url: '' }));

    reportar(`   CSRF en window ahora: ${testDebug.csrfWindow ? '✅ ' + testDebug.csrfWindow.substring(0,20)+'...' : '❌ vacío'}`);
    reportar(`   URL en browser: ${testDebug.url}`);
    testDebug.results.forEach(r => {
        if (r.error) reportar(`   ❌ Grid test: ${r.error}`);
        else reportar(`   Grid ${r.fecha}: HTTP ${r.status} | rows: ${r.rows} | errorNo: "${r.errorNo}" | raw: ${r.raw?.substring(0,120)}`);
    });

    // Si CSRF está vacío en window pero lo tenemos de XHR, usarlo
    const csrfFinalVerificado = testDebug.csrfWindow || csrfFinal || csrfXHR || '';
    if (csrfFinalVerificado !== csrfFinal) {
        reportar(`🔑 CSRF actualizado desde window: ${csrfFinalVerificado.substring(0,20)}...`);
    }

    // ── CONSTRUIR LISTA DE GRUPOS ─────────────────────────────────────────────
    const gruposDesdeXHR = [...gruposXHR.values()];
    const seenIds = new Set(gruposDesdeXHR.map(g => g.id));
    GRUPOS_FALLBACK.forEach(g => { if (!seenIds.has(g.id)) gruposDesdeXHR.push(g); });

    reportar(`\n📊 SCAN COMPLETADO:`);
    reportar(`   XHR interceptados: ${gruposXHR.size}`);
    reportar(`   Total grupos: ${gruposDesdeXHR.length}`);
    gruposDesdeXHR.forEach(g => reportar(`   📁 ${g.nombre} [gid:${g.id}]`));
    reportar(`   CSRF final: ${csrfFinalVerificado ? '✅ listo' : '❌ no disponible'}`);

    return { browser, page, grupos: gruposDesdeXHR, csrfToken: csrfFinalVerificado, gridUrl };
}

// =============================================================================
// EXTRACCIÓN DE DATOS VÍA CHROME (sesión activa)
// Usa fetch() desde dentro del browser — mismo session, CSRF incluido
// =============================================================================
async function extraerViaChrome(page, fechaISO, gid, csrfToken, gridUrl, reportar) {
    const [yyyy, mm, dd] = fechaISO.split('-');
    const fechaFmt1 = `${mm}/${dd}/${yyyy}`; // MM/DD/YYYY
    const fechaFmt2 = `${dd}/${mm}/${yyyy}`; // DD/MM/YYYY

    const intentar = async (fechaFmt) => {
        return page.evaluate(async (url, body, csrf) => {
            try {
                const resp = await fetch(url, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type':     'application/x-www-form-urlencoded',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept':           'application/json, */*',
                        ...(csrf ? { 'X-OFS-CSRF-SECURE': csrf } : {})
                    },
                    body: body
                });
                const text = await resp.text();
                try {
                    const data = JSON.parse(text);
                    if (data.errorNo) return { error: data.errorNo, rows: [], raw: text.substring(0,200) };
                    return { rows: data.activitiesRows || [], raw: text.substring(0,100) };
                } catch(e) {
                    return { error: 'JSON parse error', rows: [], raw: text.substring(0,300) };
                }
            } catch(e) {
                return { error: e.message, rows: [] };
            }
        }, gridUrl, `date=${encodeURIComponent(fechaFmt)}&gid=${gid}`, csrfToken);
    };

    let resultado = await intentar(fechaFmt1).catch(e => ({ error: e.message, rows: [] }));

    if (resultado.error) {
        // Si hay error, reportar y retornar vacío
        if (resultado.error !== 'NO_DATA') {
            reportar && reportar(`   ⚠️ ${gid} ${fechaISO}: ${resultado.error}${resultado.raw ? ' | '+resultado.raw.substring(0,100) : ''}`);
        }
        return [];
    }

    // Si 0 rows, probar formato DD/MM/YYYY
    if (resultado.rows.length === 0) {
        const r2 = await intentar(fechaFmt2).catch(()=>({ rows:[] }));
        if (r2.rows.length > 0) resultado = r2;
    }

    return resultado.rows || [];
}

// =============================================================================
// MODO HTTP: Login sin Chrome
// =============================================================================
async function loginHTTP(credenciales, reportar) {
    const usuario = credenciales.usuario || process.env.BOT_TOA_USER || '';
    const clave   = credenciales.clave   || process.env.BOT_TOA_PASS  || '';
    if (!usuario) throw new Error('LOGIN_FAILED: usuario no configurado');
    if (!clave)   throw new Error('LOGIN_FAILED: contraseña no configurada');

    const agent  = new https.Agent({ rejectUnauthorized: false, keepAlive: false });
    const jar    = new Map();
    const hdrs   = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html,*/*' };
    const addCk  = (h) => { const v = [...jar.entries()].map(([k,v])=>`${k}=${v}`).join('; '); return v ? {...h, Cookie:v} : h; };
    const parseCk = (sc) => { if (!sc) return; (Array.isArray(sc)?sc:[sc]).forEach(c => { const [kv]=c.split(';'); const i=kv.indexOf('='); if (i>0) jar.set(kv.substring(0,i).trim(), kv.substring(i+1).trim()); }); };

    reportar('   [1] GET login...');
    const pg = await axios.get(TOA_URL, { httpsAgent:agent, maxRedirects:15, validateStatus:()=>true, headers:hdrs, timeout:30000 });
    parseCk(pg.headers['set-cookie']);

    const html   = String(pg.data||'');
    const hidden = {};
    let m; const re = /<input[^>]+type=["']?hidden["']?[^>]*>/gi;
    while ((m=re.exec(html))!==null) {
        const nm=m[0].match(/name=["']([^"']+)["']/); const vl=m[0].match(/value=["']([^"']*)['"]/);
        if (nm) hidden[nm[1]] = vl ? vl[1] : '';
    }

    const action = (() => { const a=html.match(/<form[^>]+action=["']([^"'?]+)['"]/i); if (!a) return TOA_URL; return a[1].startsWith('http')?a[1]:`https://${TOA_HOST}${a[1]}`; })();

    reportar('   [2] POST credenciales...');
    const body = new URLSearchParams({ ...hidden, username:usuario, password:clave });
    const pr = await axios.post(action, body.toString(), {
        httpsAgent:agent, maxRedirects:15, validateStatus:()=>true, timeout:30000,
        headers: addCk({ ...hdrs, 'Content-Type':'application/x-www-form-urlencoded', 'Origin':`https://${TOA_HOST}`, 'Referer':TOA_URL })
    });
    parseCk(pr.headers['set-cookie']);
    if (/incorrectos?|Invalid.credential/i.test(String(pr.data||''))) throw new Error('LOGIN_FAILED: Credenciales incorrectas');
    if (pr.status >= 400) throw new Error(`LOGIN_FAILED: HTTP ${pr.status}`);

    reportar('   [3] GET dashboard...');
    const dr = await axios.get(TOA_URL, { httpsAgent:agent, maxRedirects:15, validateStatus:()=>true, timeout:30000, headers:addCk({...hdrs,'Referer':TOA_URL}) });
    parseCk(dr.headers['set-cookie']);

    let csrfToken = '';
    const csrfPats = [/window\.CSRFSecureToken\s*=\s*["']([^"']{8,})["']/,/CSRFSecureToken["']?\s*[:=]\s*["']([^"']{8,})["']/,/"csrfToken"\s*:\s*"([^"]{8,})"/];
    for (const p of csrfPats) { const x=String(dr.data||'').match(p); if (x) { csrfToken=x[1]; break; } }

    reportar(`   Login OK | Cookies: ${jar.size} | CSRF: ${csrfToken ? '✅' : '❌'}`);
    return {
        sessionCookies: [...jar.entries()].map(([k,v])=>`${k}=${v}`).join('; '),
        csrfToken,
        gridUrl: TOA_URL + '?m=Grid&a=get&itype=manage&output=ajax'
    };
}

// =============================================================================
// MODO HTTP: Descubrir grupos via REST
// =============================================================================
async function descubrirGruposHTTP(gridUrl, sessionCookies, csrfToken, reportar) {
    reportar('🔍 Descubriendo grupos (HTTP)...');
    const grupos = [];
    const seen   = new Set();
    const agent  = new https.Agent({ rejectUnauthorized: false });
    const hdrs   = { 'User-Agent':'Mozilla/5.0','Accept':'application/json','X-Requested-With':'XMLHttpRequest','Cookie':sessionCookies,...(csrfToken?{'X-OFS-CSRF-SECURE':csrfToken}:{}) };

    for (const ep of ['?m=Resource&a=list&output=ajax','?m=Bucket&a=list&output=ajax','?m=Group&a=list&output=ajax']) {
        try {
            const r = await axios.get(TOA_URL + ep, { httpsAgent:agent, validateStatus:()=>true, timeout:15000, headers:hdrs });
            if (r.status===200 && r.data && typeof r.data==='object') {
                [r.data.items,r.data.groups,r.data.buckets,r.data.rows].forEach(lista => {
                    if (!Array.isArray(lista)) return;
                    lista.forEach(item => {
                        const id=String(item.gid||item.id||''); const nombre=item.name||item.label||'';
                        if (id && nombre && !seen.has(id)) { seen.add(id); grupos.push({id,nombre,nivel:0,padre:null}); reportar(`   ✅ ${nombre} [${id}]`); }
                    });
                });
            }
        } catch(_) {}
    }
    GRUPOS_FALLBACK.forEach(g => { if (!seen.has(g.id)) { seen.add(g.id); grupos.push(g); } });
    return grupos;
}

// =============================================================================
// HTTP POST — Grid API (solo para modo HTTP)
// =============================================================================
function httpPost(url, body, cookieString, csrfToken) {
    return new Promise((resolve, reject) => {
        try {
            const parsed  = new URL(url);
            const isHttps = parsed.protocol === 'https:';
            const opts = {
                hostname: parsed.hostname, port: parsed.port||(isHttps?443:80),
                path: parsed.pathname + parsed.search, method: 'POST',
                headers: {
                    'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body),
                    'Cookie':cookieString||'','User-Agent':'Mozilla/5.0','X-Requested-With':'XMLHttpRequest',
                    'Accept':'application/json','Referer':TOA_URL,...(csrfToken?{'X-OFS-CSRF-SECURE':csrfToken}:{})
                }
            };
            const req = (isHttps?https:http).request(opts, res => {
                let data=''; res.on('data',c=>data+=c);
                res.on('end',()=>{
                    if (res.statusCode>=400) { resolve({error:`HTTP ${res.statusCode}`,activitiesRows:[],_raw:data.substring(0,200)}); return; }
                    try { resolve(JSON.parse(data)); } catch(e) { resolve({error:`JSON`,activitiesRows:[],_raw:data.substring(0,300)}); }
                });
            });
            req.on('error',reject);
            req.setTimeout(30000,()=>{req.destroy();reject(new Error('Timeout 30s'));});
            req.write(body); req.end();
        } catch(e) { reject(e); }
    });
}

// =============================================================================
// ESPERAR CONFIRMACIÓN DEL USUARIO
// =============================================================================
function esperarConfirmacion(timeoutMs, reportar) {
    return new Promise((resolve, reject) => {
        reportar(`⏳ Esperando selección del usuario (máx. ${Math.round(timeoutMs/1000)}s)...`);
        const timer = setTimeout(() => reject(new Error('Timeout: usuario no confirmó')), timeoutMs);
        if (process.send) {
            const h = msg => { if (msg?.type==='confirmar_grupos') { clearTimeout(timer); process.removeListener('message',h); resolve(msg.grupos||[]); } };
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
// GUARDAR ACTIVIDADES EN MONGODB
// =============================================================================
async function guardarActividades(rows, empresa, fecha, bucketId, empresaRef) {
    const ops = rows.map(row => {
        const ordenId = row.key || row['144'] || row.appt_number || `${empresa}_${fecha}_${Math.random().toString(36).slice(2)}`;
        const doc = {
            ordenId, empresa, bucket: empresa, bucketId,
            fecha: new Date(fecha + 'T00:00:00Z'),
            recurso:                row.pname        || '',
            'Número de Petición':   row.appt_number  || row['144'] || '',
            'Estado':               row.astatus       || '',
            'Subtipo de Actividad': row.aworktype     || '',
            'Ventana de servicio':  row.service_window  || '',
            'Ventana de Llegada':   row.delivery_window || '',
            'Nombre':               row.cname         || '',
            'RUT del cliente':      row.customer_number || row['362'] || '',
            telefono:              (row.cphone        || '').replace(/<[^>]+>/g,'').trim(),
            'Ciudad':               row.ccity         || row.cstate || '',
            latitud:                row.acoord_y      ? String(row.acoord_y) : null,
            longitud:               row.acoord_x      ? String(row.acoord_x) : null,
            camposCustom:           Object.fromEntries(Object.entries(row).filter(([k])=>/^\d+$/.test(k))),
            rawData: row, ultimaActualizacion: new Date(),
            ...(empresaRef ? { empresaRef } : {})
        };
        return { updateOne: { filter: { ordenId }, update: { $set: doc }, upsert: true } };
    }).filter(op => String(op.updateOne.filter.ordenId).length > 2);

    if (!ops.length) return 0;
    const r = await Actividad.bulkWrite(ops, { ordered: false });
    return (r.upsertedCount||0) + (r.modifiedCount||0);
}

// =============================================================================
// EXPORTS
// =============================================================================
module.exports = { iniciarExtraccion };

if (require.main === module) {
    const cred = { usuario: process.env.BOT_TOA_USER||'', clave: process.env.BOT_TOA_PASS||'' };
    mongoose.connect(process.env.MONGO_URI)
        .then(() => iniciarExtraccion(process.env.BOT_FECHA_INICIO||null, process.env.BOT_FECHA_FIN||null, cred))
        .catch(err => { console.error(err.message); process.exit(1); });
}

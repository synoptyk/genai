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

const TOA_URL  = process.env.BOT_TOA_URL || process.env.TOA_URL || 'https://telefonica-cl.etadirect.com/';
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
            global.BOT_STATUS.logs.push(`[${new Date().toLocaleTimeString('es-CL', { timeZone: 'America/Santiago' })}] ${msg}`);
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
        let grupos, csrfToken, gridUrl, csrfHeaderName;

        if (usarChrome) {
            // ── Iniciar Chrome y hacer login ──────────────────────────────────
            const session = await iniciarSesionChrome(credenciales, reportar, usarBrowserless);
            browser        = session.browser;
            page           = session.page;
            grupos         = session.grupos;
            csrfToken      = session.csrfToken;
            gridUrl        = session.gridUrl;
            csrfHeaderName = session.csrfHeaderName || 'X-OFS-CSRF-SECURE';
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
                        rows = await extraerViaChrome(page, fecha, grupo.id, csrfToken, gridUrl, reportar, csrfHeaderName);
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
                if (_screenshotInterval) { clearInterval(_screenshotInterval); _screenshotInterval = null; }
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

    // ── SCREENSHOTS EN VIVO — enviar frame al servidor cada 1.5s ─────────────
    let _screenshotInterval = null;
    if (process.send) {
        _screenshotInterval = setInterval(async () => {
            try {
                const b64 = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 60 });
                process.send({ type: 'screenshot', data: b64 });
            } catch (_) {}
        }, 1500);
    }

    // ── INYECCIÓN ANTES DE CUALQUIER SCRIPT ──────────────────────────────────
    // evaluateOnNewDocument corre ANTES que el JS de Oracle JET/TOA
    // Esto nos permite interceptar el CSRF en el momento exacto que TOA lo setea
    await page.evaluateOnNewDocument(() => {
        // Anti-detección headless
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.chrome = { runtime: {} };

        // ── Interceptar XHR para capturar CSRF ───────────────────────────────
        const origOpen      = XMLHttpRequest.prototype.open;
        const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
        const origSend      = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this.__toa_url = url;
            this.__toa_method = method;
            return origOpen.apply(this, [method, url, ...rest]);
        };

        XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
            // Loguear TODOS los headers para descubrir el nombre real del CSRF
            if (!window.__xhrHeaders) window.__xhrHeaders = {};
            window.__xhrHeaders[name] = String(value || '').substring(0, 60);

            // Capturar token CSRF (solo headers que contengan "csrf")
            if (/csrf/i.test(name) && value && value.length > 8) {
                window.__csrfCaptured = value;
                window.__csrfHeaderName = name;
            }
            return origSetHeader.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function(body) {
            // Capturar gid de llamadas al Grid
            if (this.__toa_method === 'POST' && this.__toa_url &&
                this.__toa_url.includes('output=ajax') && typeof body === 'string') {
                const m = body.match(/(?:^|&)gid=(\d+)/);
                if (m) {
                    if (!window.__toaGids) window.__toaGids = {};
                    window.__toaGids[m[1]] = true;
                }
                if (this.__toa_url.includes('m=Grid')) {
                    window.__gridUrl = this.__toa_url;
                }
            }
            return origSend.apply(this, arguments);
        };

        // ── También interceptar fetch() por si TOA lo usa ────────────────────
        const origFetch = window.fetch;
        window.fetch = function(url, opts) {
            try {
                const headers = opts && opts.headers ? opts.headers : {};
                const h = headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers;
                for (const [k, v] of Object.entries(h)) {
                    if (/csrf|ofs-csrf/i.test(k)) window.__csrfCaptured = v;
                }
                if (opts && opts.method === 'POST' && typeof opts.body === 'string' &&
                    String(url).includes('output=ajax')) {
                    const m = opts.body.match(/(?:^|&)gid=(\d+)/);
                    if (m) { if (!window.__toaGids) window.__toaGids = {}; window.__toaGids[m[1]] = true; }
                    if (String(url).includes('m=Grid')) window.__gridUrl = String(url);
                }
            } catch(_) {}
            return origFetch.apply(this, arguments);
        };
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    page.on('dialog', async d => { try { await d.dismiss(); } catch(_) {} });

    // ── CDP: captura de red a NIVEL BROWSER (ve TODO incluyendo service workers) ──
    const gruposXHR  = new Map();
    let   gridUrl    = TOA_URL + '?m=Grid&a=get&itype=manage&output=ajax';
    let   csrfXHR    = '';
    // Correlacionar click → gid: { name, ts } del último click físico en sidebar
    let   pendingClick = null;

    const cdp = await page.target().createCDPSession();
    await cdp.send('Network.enable');

    // requestWillBeSentExtraInfo → headers COMPLETOS incluyendo los que añade Chrome
    const esHeaderCSRF = (k) => /csrf/i.test(k);

    cdp.on('Network.requestWillBeSentExtraInfo', ({ headers }) => {
        // Buscar CSRF en TODOS los headers que llegan al servidor
        for (const [k, v] of Object.entries(headers || {})) {
            if (esHeaderCSRF(k) && v && v.length > 8) {
                if (!csrfXHR) reportar(`🔑 CSRF (CDP ExtraInfo): ${k}=${v.substring(0,30)}...`);
                csrfXHR = v;
            }
        }
    });

    // requestWillBeSent → capturar gid del body y gridUrl
    cdp.on('Network.requestWillBeSent', ({ requestId, request }) => {
        try {
            const url  = request.url || '';
            const body = request.postData || '';
            // Headers que JS setea via setRequestHeader
            for (const [k, v] of Object.entries(request.headers || {})) {
                if (esHeaderCSRF(k) && v && v.length > 8) {
                    if (!csrfXHR) reportar(`🔑 CSRF (CDP Request): ${k}=${v.substring(0,30)}...`);
                    csrfXHR = v;
                }
            }
            if (request.method === 'POST' && url.includes('output=ajax')) {
                if (url.includes('m=Grid')) gridUrl = url;
                for (const m of body.matchAll(/(?:^|&)gid=(\d+)/g)) {
                    const gid = m[1];
                    // Correlacionar con el último click físico (si fue reciente < 3s)
                    const nombre = (pendingClick && Date.now() - pendingClick.ts < 3000 && pendingClick.name)
                        ? pendingClick.name : `Grupo_${gid}`;
                    if (pendingClick && Date.now() - pendingClick.ts < 3000) pendingClick = null;
                    if (!gruposXHR.has(gid)) {
                        gruposXHR.set(gid, { id: gid, nombre, nivel: 0, padre: null });
                        reportar(`   📡 gid=${gid} → "${nombre}" (CDP)`);
                    } else if (gruposXHR.get(gid).nombre.startsWith('Grupo_') && nombre !== `Grupo_${gid}`) {
                        gruposXHR.get(gid).nombre = nombre;
                        reportar(`   ✏️  gid=${gid} renombrado → "${nombre}"`);
                    }
                }
            }
        } catch(_) {}
    });

    // Bloquear imágenes/fuentes para ahorrar RAM (via interception)
    await page.setRequestInterception(true);
    page.on('request', req => {
        try {
            const rt = req.resourceType();
            if (['image', 'media', 'font'].includes(rt)) { req.abort(); return; }
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

    // ==========================================================================
    // AGENTE REACTIVO — actúa como humano: observa la pantalla y reacciona
    // Loop: leer estado → decidir acción → ejecutar → esperar → repetir
    // ==========================================================================
    reportar(`   Usuario: ${usuario}`);

    // Función reutilizable: llenar un campo
    const llenar = async (sel, val) => {
        const f = await page.$(sel).catch(()=>null);
        if (!f) return false;
        await f.click({ clickCount: 3 }).catch(()=>{});
        await page.keyboard.press('Delete').catch(()=>{});
        await new Promise(r => setTimeout(r, 150));
        await f.type(val, { delay: 40 }).catch(()=>{});
        return true;
    };

    // Función reutilizable: hacer login
    const hacerLogin = async () => {
        reportar('   → Llenando credenciales...');
        let ok = false;
        for (const sel of ['input#username','input[name="username"]','input[autocomplete="username"]','input[type="text"]']) {
            if (await llenar(sel, usuario)) { ok = true; break; }
        }
        if (!ok) { reportar('   ⚠️ No encontré campo usuario'); return; }
        await llenar('input[type="password"]', clave);
        await new Promise(r => setTimeout(r, 300));
        await page.evaluate(() => {
            const btns = [...document.querySelectorAll('button,input[type=submit]')];
            const btn = btns.find(b => /iniciar|login|sign.?in|entrar/i.test((b.textContent||'')+(b.value||'')));
            (btn || btns[0])?.click();
        });
        reportar('   → Click "Iniciar sesión" enviado');
    };

    // Función reutilizable: leer estado de la pantalla
    const leerPantalla = async () => {
        return page.evaluate(() => {
            const txt  = document.body?.innerText || '';
            const url  = window.location.href;
            const csrf = window.__csrfCaptured || '';
            return {
                tieneFormLogin:  !!document.querySelector('input[type="password"]'),
                tieneSesionMax:  /máximo de sesiones|Se ha superado|maximum.*session/i.test(txt),
                tieneDashboard:  txt.includes('COMFICA') || txt.includes('ZENER') ||
                                 txt.includes('Consola de despacho') || txt.includes('Dispatch') ||
                                 txt.includes('Consola') && txt.includes('despacho'),
                tieneErrorCred:  /credenciales|contraseña incorrecta|invalid.*credential/i.test(txt),
                tieneCsrf:       !!csrf,
                url,
                titulo:          document.title,
                resumen:         txt.substring(0, 120).replace(/\n+/g,' ')
            };
        }).catch(() => ({ tieneFormLogin:false, tieneSesionMax:false, tieneDashboard:false,
                          tieneErrorCred:false, tieneCsrf:false, url:'', titulo:'', resumen:'' }));
    };

    // Función reutilizable: click REAL de mouse en cualquier texto visible
    // Usa page.mouse.click(x, y) — genera evento físico que Oracle JET/KnockoutJS sí responde
    const clickTexto = async (patron) => {
        // 1. Obtener coordenadas del elemento desde el DOM
        const coords = await page.evaluate((pat) => {
            const re = new RegExp(pat, 'i');
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                if (re.test(node.textContent || '')) {
                    // Navegar hacia arriba hasta encontrar un elemento con dimensiones reales
                    let el = node.parentElement;
                    for (let i = 0; i < 10 && el && el !== document.body; i++) {
                        const r = el.getBoundingClientRect();
                        if (r.width > 0 && r.height > 0) {
                            return {
                                x: r.left + r.width / 2,
                                y: r.top + r.height / 2,
                                tag: el.tagName,
                                texto: (el.innerText || node.textContent || '').substring(0, 60)
                            };
                        }
                        el = el.parentElement;
                    }
                }
            }
            return null;
        }, patron.source || String(patron)).catch(() => null);

        if (!coords) return { ok: false };

        // 2. Click físico real en las coordenadas — Oracle JET responde a esto
        await page.mouse.click(coords.x, coords.y).catch(() => {});
        return { ok: true, tag: coords.tag, texto: coords.texto, x: coords.x.toFixed(0), y: coords.y.toFixed(0) };
    };

    // ── LOOP AGENTE REACTIVO ──────────────────────────────────────────────────
    const loopStart = Date.now();
    let estado = 'INICIO';
    let intentosLogin = 0;
    let intentosSuprimir = 0;

    reportar('🤖 Agente reactivo iniciado — observando pantalla...');

    while (Date.now() - loopStart < 180000) {
        // Si CDP ya capturó el CSRF, salir inmediatamente
        if (csrfXHR) { reportar('✅ CSRF capturado vía CDP — dashboard activo'); break; }

        await new Promise(r => setTimeout(r, 2500));

        const p = await leerPantalla();
        const estadoActual = p.tieneCsrf || p.tieneDashboard ? 'DASHBOARD'
                           : p.tieneSesionMax                ? 'SESION_MAX'
                           : p.tieneErrorCred                ? 'ERROR_CRED'
                           : p.tieneFormLogin                ? 'LOGIN_FORM'
                           : 'CARGANDO';

        if (estadoActual !== estado) {
            reportar(`   [pantalla] ${estado} → ${estadoActual} | ${p.titulo} | ${p.resumen}`);
            estado = estadoActual;
        }

        // ── ACCIONES según lo que ve en pantalla ──────────────────────────
        if (estadoActual === 'DASHBOARD') {
            reportar('✅ Dashboard TOA cargado');
            if (csrfXHR) { reportar('   ✅ CSRF ya capturado'); break; }
            // Esperar hasta 10s para que TOA emita XHR con CSRF
            reportar('   ⏳ Esperando CSRF de TOA (hasta 10s)...');
            for (let i = 0; i < 5 && !csrfXHR; i++) {
                await new Promise(r => setTimeout(r, 2000));
                if (csrfXHR) reportar('   ✅ CSRF capturado');
            }
            break;
        }

        if (estadoActual === 'SESION_MAX') {
            intentosSuprimir++;
            if (intentosSuprimir > 8) {
                reportar('❌ Demasiados intentos de suprimir sesión (8 máx.) — abortando');
                break;
            }
            reportar(`   → Sesiones máximas (intento ${intentosSuprimir}/8) — marcando checkbox Suprimir...`);

            // Paso 1a: Marcar checkbox via JS (más confiable para Oracle JET)
            const cbJs = await page.evaluate(() => {
                const cb = document.querySelector('input[type="checkbox"]');
                if (!cb) return false;
                if (!cb.checked) {
                    cb.click();
                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                }
                return cb.checked;
            }).catch(() => false);
            reportar(`   → Checkbox JS: ${cbJs ? '✅ marcado' : '⚠️ no encontrado por JS'}`);

            // Paso 1b: También hacer click físico en "Suprimir" (doble garantía)
            const r = await clickTexto(/suprimir/);
            reportar(`   → ${r.ok ? `mouse.click(${r.x},${r.y}) en "${r.texto}"` : 'Click físico no encontrado'}`);
            await new Promise(r2 => setTimeout(r2, 800));

            // Paso 2: Buscar y clickar el botón submit del formulario de login
            // IMPORTANTE: NO usar clickTexto(/iniciar/) porque encuentra el ENCABEZADO "Iniciar sesión"
            // a y≈90 (arriba de la página) en lugar del botón submit real
            reportar('   → Paso 2: click en botón submit del formulario...');
            const btnCoords = await page.evaluate(() => {
                const btns = [...document.querySelectorAll('button, input[type="submit"]')]
                    .filter(el => el.offsetParent !== null);
                const btn = btns.find(b => /iniciar|login|sign.?in|entrar/i.test((b.textContent||'')+(b.value||'')))
                         || btns[0];
                if (!btn) return null;
                const r = btn.getBoundingClientRect();
                return { x: r.left + r.width/2, y: r.top + r.height/2,
                         txt: (btn.textContent||btn.value||'').trim().substring(0,30) };
            }).catch(() => null);

            if (btnCoords) {
                reportar(`   → mouse.click(${Math.round(btnCoords.x)},${Math.round(btnCoords.y)}) en "${btnCoords.txt}"`);
                await page.mouse.click(btnCoords.x, btnCoords.y).catch(() => {});
            } else {
                reportar('   ⚠️ No encontré botón submit — usando hacerLogin() como fallback');
                await hacerLogin();
            }

            await new Promise(r2 => setTimeout(r2, 5000));
            continue;
        }

        if (estadoActual === 'ERROR_CRED') {
            reportar('❌ Credenciales incorrectas — verificar usuario/clave en Configuración');
            break;
        }

        if (estadoActual === 'LOGIN_FORM') {
            if (intentosLogin < 3) {
                intentosLogin++;
                await hacerLogin();
                await new Promise(r => setTimeout(r, 3000));
            } else {
                reportar('⚠️ Login enviado 3 veces sin éxito — revisando...');
                break;
            }
            continue;
        }

        // CARGANDO — esperar
        if (Date.now() - loopStart > 60000) {
            reportar(`⚠️ 60s cargando sin reconocer estado — ${p.resumen}`);
            break;
        }
    }

    await new Promise(r => setTimeout(r, 2000));

    const dashTitle = await page.title().catch(()=>'');
    const dashUrl   = page.url();
    reportar(`   Título: "${dashTitle}"`);
    reportar(`   URL: ${dashUrl}`);

    // ── LEER ESTADO: CDP + interceptor JS ────────────────────────────────────
    const pageData = await page.evaluate(() => {
        return {
            csrfJS:      window.__csrfCaptured || window.CSRFSecureToken || '',
            csrfHdrName: window.__csrfHeaderName || '',
            allHdrKeys:  Object.keys(window.__xhrHeaders || {}),
            allHdrVals:  window.__xhrHeaders || {},
            gidsJS:      Object.keys(window.__toaGids || {}),
            gridUrlJS:   window.__gridUrl || '',
            url:         window.location.href,
            pageText:    (document.body?.innerText||'').substring(0,400)
        };
    }).catch(()=>({ csrfJS:'', allHdrKeys:[], gidsJS:[], gridUrlJS:'', url:'', pageText:'' }));

    // Combinar: CDP tiene prioridad (más confiable), luego JS interceptor
    const csrfCombinado = csrfXHR || pageData.csrfJS || '';
    const csrfHeaderName = pageData.csrfHdrName || 'X-OFS-CSRF-SECURE';

    reportar(`   URL: ${pageData.url}`);
    reportar(`🔑 CSRF-CDP: ${csrfXHR ? '✅ '+csrfXHR.substring(0,25)+'...' : '❌'}`);
    reportar(`🔑 CSRF-JS:  ${pageData.csrfJS ? '✅ '+pageData.csrfJS.substring(0,25)+'...' : '❌'}`);
    reportar(`   Headers XHR: ${JSON.stringify(pageData.allHdrKeys)}`);
    reportar(`   Header vals: ${JSON.stringify(pageData.allHdrVals).substring(0,300)}`);
    reportar(`   GIDs capturados: [${[...new Set([...pageData.gidsJS, ...(gruposXHR.size?[...gruposXHR.keys()]:[])])].join(', ')}]`);

    // Cookies
    const cookies = await page.cookies().catch(()=>[]);
    reportar(`   Cookies: ${cookies.map(c=>c.name+'='+c.value.substring(0,12)).join(' | ')}`);
    // Solo buscar cookies que realmente sean CSRF (no confundir con X_OFS_LP que es load balancer)
    const csrfFromCookie = cookies.find(c => /csrf/i.test(c.name));

    if (pageData.gridUrlJS) gridUrl = pageData.gridUrlJS;

    pageData.gidsJS.forEach(gid => {
        if (!gruposXHR.has(gid)) {
            gruposXHR.set(gid, { id: gid, nombre: `Grupo_${gid}`, nivel: 0, padre: null });
        }
    });

    // ── EXPLORAR SIDEBAR con clicks FÍSICOS (Oracle JET ignora eventos sintéticos) ──
    reportar('🖱️  Explorando sidebar con clicks físicos...');
    await new Promise(r => setTimeout(r, 3000)); // Esperar que TOA cargue el árbol

    // Helper: obtener SOLO items del árbol de grupos (excluir filas de actividades)
    // Filas de actividades tienen: "Pulse para ver" y/o patrón "(X/Y)"
    const obtenerItemsSidebar = () => page.evaluate(() => {
        return [...document.querySelectorAll('[role="treeitem"]')]
            .filter(el => el.offsetParent !== null)
            .map(el => {
                const r = el.getBoundingClientRect();
                const txt = (el.innerText || el.textContent || '').trim().split('\n')[0].trim();
                return { x: r.left + r.width/2, y: r.top + r.height/2,
                         text: txt.substring(0, 60), left: Math.round(r.left) };
            })
            .filter(item =>
                item.x > 0 && item.y > 0 && item.y < 900
                && item.text.length > 1
                && !item.text.toLowerCase().includes('pulse')   // excluir filas de actividades
                && !/\(\d+\/\d+\)/.test(item.text)             // excluir "(0/7)" = progreso técnico
            );
    }).catch(() => []);

    // Paso 0: expandir la carpeta raíz "CHILE" primero
    reportar('   → Buscando carpeta CHILE...');
    const chileClick = await clickTexto(/^\s*chile\s*$/);
    if (chileClick.ok) {
        reportar(`   ✅ CHILE en (${chileClick.x}, ${chileClick.y}) — expandiendo...`);
        await new Promise(r => setTimeout(r, 2000));
    } else {
        reportar('   ⚠️ "CHILE" no encontrado — buscando grupos directamente...');
    }

    // Ronda 1: clicar items del sidebar (sin filas de actividades)
    const items1 = await obtenerItemsSidebar();
    reportar(`   Ronda 1: ${items1.length} items de grupos (sin técnicos)`);
    for (const item of items1) {
        reportar(`     📂 "${item.text}" (x=${item.left})`);
        pendingClick = { name: item.text, ts: Date.now() };
        await page.mouse.click(item.x, item.y).catch(() => {});
        await new Promise(r => setTimeout(r, 600));
    }
    await new Promise(r => setTimeout(r, 2000));

    // Ronda 2: expandir nodos colapsados [aria-expanded=false] — también filtrando actividades
    const expandibles = await page.evaluate(() => {
        return [...document.querySelectorAll('[aria-expanded="false"]')]
            .filter(el => el.offsetParent !== null)
            .map(el => {
                const r = el.getBoundingClientRect();
                const txt = (el.innerText || el.textContent || '').trim().split('\n')[0].trim();
                return { x: r.left + r.width/2, y: r.top + r.height/2, text: txt.substring(0,40), left: Math.round(r.left) };
            })
            .filter(item => item.x > 0 && item.y > 0 && item.y < 900
                            && !item.text.toLowerCase().includes('pulse')
                            && !/\(\d+\/\d+\)/.test(item.text));
    }).catch(() => []);
    reportar(`   Ronda 2 (expandir): ${expandibles.length} nodos colapsados`);
    for (const item of expandibles) {
        reportar(`     🔽 "${item.text}" (x=${item.left})`);
        pendingClick = { name: item.text, ts: Date.now() };
        await page.mouse.click(item.x, item.y).catch(() => {});
        await new Promise(r => setTimeout(r, 700));
    }
    await new Promise(r => setTimeout(r, 2000));

    // Ronda 3: clicar los items nuevos tras expansión
    const items3 = await obtenerItemsSidebar();
    const yaClickeados = new Set(items1.map(i => `${Math.round(i.x)},${Math.round(i.y)}`));
    const nuevos3 = items3.filter(i => !yaClickeados.has(`${Math.round(i.x)},${Math.round(i.y)}`));
    reportar(`   Ronda 3 (nuevos): ${nuevos3.length} items tras expansión`);
    for (const item of nuevos3) {
        reportar(`     📂 "${item.text}" (x=${item.left})`);
        pendingClick = { name: item.text, ts: Date.now() };
        await page.mouse.click(item.x, item.y).catch(() => {});
        await new Promise(r => setTimeout(r, 500));
    }
    await new Promise(r => setTimeout(r, 2000));

    // Leer gids + nombres del sidebar completo
    const sidebarFinal = await page.evaluate(() => {
        const gids = window.__toaGids ? Object.keys(window.__toaGids) : [];
        const gridUrl = window.__gridUrl || '';
        const csrf    = window.__csrfCaptured || '';

        // Texto del sidebar con nombres de grupos
        const sideSels = ['[role="tree"]','[class*="treeview"]','[class*="sidebar"]','[class*="nav-panel"]'];
        let sideText = '';
        for (const s of sideSels) {
            const el = document.querySelector(s);
            if (el && (el.innerText||'').length > 20) { sideText = el.innerText; break; }
        }
        if (!sideText) sideText = (document.body?.innerText||'').substring(0,3000);

        // Extraer pares nombre→gid del DOM
        const pares = [];
        const treeSels = ['[role="treeitem"]','[class*="oj-treeview-item"]'];
        for (const s of treeSels) {
            document.querySelectorAll(s).forEach(el => {
                const txt = (el.innerText||el.textContent||'').trim().split('\n')[0].trim();
                if (txt && txt.length > 1 && txt.length < 80) pares.push(txt);
            });
            if (pares.length > 0) break;
        }

        return { gids, gridUrl, csrf, sideText: sideText.substring(0,3000), pares };
    }).catch(()=>({ gids:[], gridUrl:'', csrf:'', sideText:'', pares:[] }));

    // Actualizar CSRF si el interceptor capturó algo durante los clicks
    const csrfFinal = csrfCombinado || sidebarFinal.csrf ||
                      (csrfFromCookie ? csrfFromCookie.value : '') || '';
    if (sidebarFinal.gridUrl) gridUrl = sidebarFinal.gridUrl;

    reportar(`   GIDs post-exploración: [${sidebarFinal.gids.join(', ')}]`);
    reportar(`   CSRF final: ${csrfFinal ? '✅ ' + csrfFinal.substring(0,25)+'...' : '❌'}`);

    // Agregar nuevos gids
    sidebarFinal.gids.forEach(gid => {
        if (!gruposXHR.has(gid)) {
            gruposXHR.set(gid, { id: gid, nombre: `Grupo_${gid}`, nivel: 0, padre: null });
        }
    });

    // Leer texto del sidebar para asignar nombres a los gids
    reportar('📋 Texto del sidebar:');
    sidebarFinal.sideText.split('\n')
        .map(l=>l.trim()).filter(l=>l.length>1 && l.length<80)
        .slice(0,50).forEach(l => reportar(`  │ ${l}`));

    reportar(`   Items DOM del árbol: ${sidebarFinal.pares.slice(0,20).join(' | ')}`);

    // ── PRUEBA DE GRID API ────────────────────────────────────────────────────
    if (csrfFinal) {
        reportar('🧪 Probando Grid API con CSRF...');
        const testResult = await page.evaluate(async (url, csrf, hdr) => {
            const [y,m,d] = new Date().toISOString().split('T')[0].split('-');
            return new Promise(resolve => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', url, true);
                xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                xhr.setRequestHeader('X-PLATFORM', '1');
                xhr.setRequestHeader('X-OA', '2');
                if (csrf) xhr.setRequestHeader(hdr, csrf);
                xhr.withCredentials = true;
                xhr.onload = () => {
                    try {
                        const j = JSON.parse(xhr.responseText);
                        resolve({ ok: !j.errorNo, rows: j.activitiesRows?.length||0,
                                  err: j.errorNo||'', raw: xhr.responseText.substring(0,150) });
                    } catch(_) { resolve({ ok:false, err:'JSON', raw:xhr.responseText.substring(0,150) }); }
                };
                xhr.onerror = () => resolve({ ok:false, err:'network' });
                xhr.send(`date=${encodeURIComponent(`${m}/${d}/${y}`)}&gid=3840`);
            });
        }, gridUrl, csrfFinal, csrfHeaderName || 'X-OFS-CSRF-SECURE').catch(()=>null);

        if (testResult) {
            reportar(testResult.ok
                ? `   ✅ Grid API OK: ${testResult.rows} filas hoy`
                : `   ⚠️ Grid test: ${testResult.err} | ${testResult.raw}`);
        }
    } else {
        reportar('   ⚠️ Sin CSRF — busca en los headers de arriba cuál es el nombre real');
    }

    // ── CONSTRUIR LISTA FINAL DE GRUPOS ──────────────────────────────────────
    const gruposDesdeXHR = [...gruposXHR.values()];
    const seenIds = new Set(gruposDesdeXHR.map(g => g.id));
    GRUPOS_FALLBACK.forEach(g => { if (!seenIds.has(g.id)) gruposDesdeXHR.push(g); });

    reportar(`\n📊 SCAN: ${gruposDesdeXHR.length} grupos | CSRF: ${csrfFinal ? '✅' : '❌'}`);
    gruposDesdeXHR.forEach(g => reportar(`   📁 ${g.nombre} [gid:${g.id}]`));

    return { browser, page, grupos: gruposDesdeXHR, csrfToken: csrfFinal, gridUrl,
             csrfHeaderName };
}

// =============================================================================
// EXTRACCIÓN DE DATOS VÍA CHROME (sesión activa)
//
// Estrategia en cascada:
// 1. window.oj.ajax()  — AJAX nativo de Oracle JET (incluye CSRF automático)
// 2. window.$.ajax()   — jQuery (si está disponible)
// 3. fetch() con CSRF  — último recurso
// =============================================================================
async function extraerViaChrome(page, fechaISO, gid, csrfToken, gridUrl, reportar, csrfHeaderName = 'X-OFS-CSRF-SECURE') {
    const [yyyy, mm, dd] = fechaISO.split('-');
    const fechaFmt1 = `${mm}/${dd}/${yyyy}`; // MM/DD/YYYY
    const fechaFmt2 = `${dd}/${mm}/${yyyy}`; // DD/MM/YYYY

    const intentar = async (fechaFmt) => {
        return page.evaluate(async (apiUrl, bodyStr, csrf, csrfHdr) => {
            // Leer CSRF fresco desde window (interceptor pudo haberlo actualizado)
            const csrfFresh = window.__csrfCaptured || window.CSRFSecureToken || csrf || '';
            const headerName = csrfHdr || 'X-OFS-CSRF-SECURE';

            // Usar XHR directamente (más fiel al comportamiento de TOA)
            return new Promise((resolve) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', apiUrl, true);
                xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                xhr.setRequestHeader('Accept', 'application/json');
                xhr.setRequestHeader('X-PLATFORM', '1');
                xhr.setRequestHeader('X-OA', '2');
                if (csrfFresh) xhr.setRequestHeader(headerName, csrfFresh);
                xhr.withCredentials = true;
                xhr.timeout = 30000;
                xhr.onload = () => {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        if (data.errorNo) resolve({ method:'xhr', error: data.errorNo, rows:[], raw: xhr.responseText.substring(0,200) });
                        else resolve({ method:'xhr', rows: data.activitiesRows||[], raw: '' });
                    } catch(_) {
                        resolve({ method:'xhr', error:'JSON', rows:[], raw: xhr.responseText.substring(0,300) });
                    }
                };
                xhr.onerror = () => resolve({ method:'xhr', error:'Network error', rows:[] });
                xhr.ontimeout = () => resolve({ method:'xhr', error:'Timeout', rows:[] });
                xhr.send(bodyStr);
            });
        }, gridUrl, `date=${encodeURIComponent(fechaFmt)}&gid=${gid}`, csrfToken, csrfHeaderName);
    };

    let res = await intentar(fechaFmt1).catch(e => ({ error: e.message, rows:[] }));

    // Si SESSION_DESTROYED: la sesión del Grid no está inicializada.
    // Intentar inicializarla llamando sin fecha (solo gid) y luego reintentar.
    if (res.error === 'SESSION_DESTROYED') {
        reportar && reportar(`   🔄 SESSION_DESTROYED → inicializando grid gid=${gid}...`);
        await page.evaluate(async (apiUrl, gid, csrf, hdr) => {
            return new Promise(resolve => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', apiUrl, true);
                xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                xhr.setRequestHeader('Accept', 'application/json, text/javascript, */*; q=0.01');
                xhr.setRequestHeader('X-PLATFORM', '1');
                xhr.setRequestHeader('X-OA', '2');
                const csrfFresh = window.__csrfCaptured || window.CSRFSecureToken || csrf || '';
                if (csrfFresh) xhr.setRequestHeader(hdr || 'X-OFS-CSRF-SECURE', csrfFresh);
                xhr.withCredentials = true;
                xhr.onload = resolve;
                xhr.onerror = resolve;
                xhr.send(`gid=${gid}`); // sin fecha = inicializar con fecha actual
            });
        }, gridUrl, gid, csrfToken, csrfHeaderName).catch(() => {});
        await new Promise(r => setTimeout(r, 1000));
        res = await intentar(fechaFmt1).catch(e => ({ error: e.message, rows:[] }));
    }

    if (res.error) {
        // Probar formato DD/MM/YYYY
        const res2 = await intentar(fechaFmt2).catch(()=>({ rows:[] }));
        if (!res2.error && res2.rows.length > 0) res = res2;
        else if (res.error && res.error !== 'NO_DATA') {
            reportar && reportar(`   ⚠️ gid=${gid} ${fechaISO} [${res.method||'?'}]: ${res.error}${res.raw?' | '+res.raw.substring(0,100):''}`);
            return [];
        }
    }

    return res.rows || [];
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

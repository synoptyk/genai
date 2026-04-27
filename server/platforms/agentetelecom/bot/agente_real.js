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
const fs       = require('fs');
const os       = require('os');
const Actividad = require('../models/Actividad');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const toText = (value) => (value === null || value === undefined ? '' : String(value));
const clipText = (value, max = 60) => toText(value).substring(0, max);

const TOA_URL  = process.env.BOT_TOA_URL || process.env.TOA_URL || 'https://telefonica-cl.etadirect.com/';
const TOA_HOST = (() => { try { return new URL(TOA_URL).hostname; } catch (_) { return 'telefonica-cl.etadirect.com'; } })();

// Grupos de producción REALES — solo estos 3 tienen actividades en TOA
// Torre de Control, 2020Eliminados, Bucket_Prueba, etc. NO tienen datos útiles
const GRUPOS_PRODUCCION = [
    { id: '3840', nombre: 'COMFICA',        nivel: 0, padre: null, esFavorito: true },
    { id: '3842', nombre: 'ZENER RANCAGUA', nivel: 0, padre: null, esFavorito: true },
    { id: '3841', nombre: 'ZENER RM',       nivel: 0, padre: null, esFavorito: true }
];
const GRUPOS_FALLBACK = GRUPOS_PRODUCCION;

// Evitar que un error no capturado mate el proceso
process.on('unhandledRejection', (err) => {
    console.error('[BOT] unhandledRejection:', err?.message || err);
});
process.on('uncaughtException', (err) => {
    console.error('[BOT] uncaughtException:', err?.message || err);
});

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
        while (c <= fin) { 
            if (c.getUTCDay() !== 0) fechasAProcesar.push(c.toISOString().split('T')[0]); 
            c.setUTCDate(c.getUTCDate() + 1); 
        }
    } else if (fechaInicio) {
        const c = new Date(fechaInicio + 'T00:00:00Z');
        if (c.getUTCDay() !== 0) fechasAProcesar.push(fechaInicio);
    } else {
        let c = new Date(Date.UTC(2026, 0, 1));
        const fin = new Date(); fin.setUTCHours(0, 0, 0, 0);
        while (c <= fin) { 
            if (c.getUTCDay() !== 0) fechasAProcesar.push(c.toISOString().split('T')[0]); 
            c.setUTCDate(c.getUTCDate() + 1); 
        }
    }

    const modo       = fechaInicio && fechaFin ? 'RANGO' : fechaInicio ? 'DÍA ÚNICO' : 'BACKFILL';
    const empresaRef = process.env.BOT_EMPRESA_REF || null;

    const reportar = (msg, extra = {}) => {
        try {
            console.log('[BOT]', msg);
            if (process.send) process.send({ type: 'log', text: msg, ...extra });
            else if (global.BOT_STATUS) {
                global.BOT_STATUS.logs = global.BOT_STATUS.logs || [];
                global.BOT_STATUS.logs.push(`[${new Date().toLocaleTimeString('es-CL', { timeZone: 'America/Santiago' })}] ${msg}`);
                if (global.BOT_STATUS.logs.length > 200) global.BOT_STATUS.logs.shift();
            }
        } catch (_) { /* nunca crashear por un log */ }
    };

    reportar(`🚀 TOA Bot v13 | ${modo} | ${fechasAProcesar.length} días`);
    reportar(`   ${fechasAProcesar[0]} → ${fechasAProcesar[fechasAProcesar.length - 1]}`);
    if (process.send) {
        process.send({
            type: 'progress',
            grupoProcesando: 'INICIO',
            diaActual: 0,
            totalDias: fechasAProcesar.length,
            fechaProcesando: 'Inicializando sesión TOA...'
        });
    }

    const usarChrome     = process.env.SKIP_CHROME !== 'true';
    const usarBrowserless = !!process.env.BROWSERLESS_KEY;

    if (usarBrowserless) reportar('🌐 Chrome remoto (Browserless.io)');
    else if (usarChrome) reportar('🖥️  Chrome LOCAL (2GB RAM)');
    else                 reportar('📡 HTTP puro (sin Chrome)');

    let browser = null;
    let page    = null;
    let _screenshotInterval = null; // referencia al interval de screenshots

    try {
        let grupos, csrfToken, gridUrl, csrfHeaderName;

        if (usarChrome) {
            // ── Iniciar Chrome y hacer login ──────────────────────────────────
            if (process.send) {
                process.send({
                    type: 'progress',
                    grupoProcesando: 'LOGIN',
                    diaActual: 0,
                    totalDias: fechasAProcesar.length,
                    fechaProcesando: 'Abriendo Chrome y autenticando...'
                });
            }
            const sessionTimeoutMs = Number(process.env.BOT_SESSION_TIMEOUT_MS || 180000);
            const session = await Promise.race([
                iniciarSesionChrome(credenciales, reportar, usarBrowserless),
                new Promise((_, reject) => setTimeout(() => reject(new Error(`LOGIN_TIMEOUT: sesión TOA excedió ${Math.round(sessionTimeoutMs / 1000)}s`)), sessionTimeoutMs))
            ]);
            browser        = session.browser;
            page           = session.page;
            grupos         = session.grupos;
            csrfToken      = session.csrfToken;
            gridUrl        = session.gridUrl;
            csrfHeaderName = session.csrfHeaderName || 'X-OFS-CSRF-SECURE';
            _screenshotInterval = session._screenshotInterval;
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

        // Los 3 grupos se procesan automáticamente — no se espera confirmación
        const gruposSeleccionados = grupos;

        // ══════════════════════════════════════════════════════════════════════
        // EXTRACCIÓN — NAVEGACIÓN HUMANA COMPLETA
        // Por cada grupo: sidebar → filtros → vista lista → calendario → leer tabla
        // ══════════════════════════════════════════════════════════════════════
        let totalGuardados = 0;

        if (usarChrome && page) {
            reportar(`\n📡 Extracción automática — ${gruposSeleccionados.length} grupos × ${fechasAProcesar.length} días`);

            // ── Helper: click REAL de mouse en cualquier texto visible ────────
            // Prefiere elementos PEQUEÑOS (más específicos) para evitar clicks en contenedores grandes
            const clickTexto = async (patron, opts = {}) => {
                const coords = await page.evaluate((pat, options) => {
                    const re = new RegExp(pat, 'i');
                    const maxX = options.maxX || 99999;  // limitar zona horizontal
                    const maxY = options.maxY || 99999;
                    const minY = options.minY || 0;
                    const candidates = [];
                    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                    let node;
                    while ((node = walker.nextNode())) {
                        if (re.test(node.textContent || '')) {
                            let el = node.parentElement;
                            for (let i = 0; i < 10 && el && el !== document.body; i++) {
                                const r = el.getBoundingClientRect();
                                if (r.width > 0 && r.height > 0 && r.x < maxX && r.y >= minY && r.y < maxY) {
                                    candidates.push({
                                        x: r.left + r.width / 2, y: r.top + r.height / 2,
                                        area: r.width * r.height,
                                        tag: el.tagName, texto: (el.innerText || '').substring(0, 60)
                                    });
                                    break; // no seguir subiendo
                                }
                                el = el.parentElement;
                            }
                        }
                    }
                    if (!candidates.length) return null;
                    // Preferir el elemento más pequeño (más específico)
                    candidates.sort((a, b) => a.area - b.area);
                    return candidates[0];
                }, patron.source || String(patron), opts).catch(() => null);
                if (!coords) return { ok: false };
                await page.mouse.click(coords.x, coords.y).catch(() => {});
                return { ok: true, tag: coords.tag, texto: coords.texto, x: Math.round(coords.x), y: Math.round(coords.y) };
            };

            // ── Helper: click en grupo del SIDEBAR (zona izquierda, x < 500) ────
            const clickGrupoSidebar = async (nombre) => {
                const coords = await page.evaluate((name) => {
                    const re = new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
                    const candidates = [];
                    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                    let node;
                    while ((node = walker.nextNode())) {
                        const txt = (node.textContent || '').trim();
                        if (re.test(txt)) {
                            let el = node.parentElement;
                            for (let i = 0; i < 8 && el && el !== document.body; i++) {
                                const r = el.getBoundingClientRect();
                                // Solo sidebar: x < 500, y > 200 (debajo del toolbar)
                                if (r.width > 0 && r.height > 0 && r.x < 500 && r.y > 200) {
                                    candidates.push({
                                        x: r.left + r.width / 2, y: r.top + r.height / 2,
                                        area: r.width * r.height, tag: el.tagName, txt
                                    });
                                    break;
                                }
                                el = el.parentElement;
                            }
                        }
                    }
                    if (!candidates.length) return null;
                    // Preferir el más pequeño (más específico)
                    candidates.sort((a, b) => a.area - b.area);
                    return candidates[0];
                }, nombre).catch(() => null);

                if (!coords) return { ok: false };
                reportar(`   → Sidebar: "${coords.txt}" en (${Math.round(coords.x)}, ${Math.round(coords.y)}) [${coords.tag}]`);
                await page.mouse.click(coords.x, coords.y).catch(() => {});
                return { ok: true, x: Math.round(coords.x), y: Math.round(coords.y) };
            };

            // ── Helper: esperar respuesta AJAX con activitiesRows ──────────────
            // ⚠️ CRÍTICO: resolve() SIEMPRE debe ejecutarse — si no, el bot se cuelga
            const esperarGrid = (timeout = 15000) => new Promise(resolve => {
                let settled = false;
                let ajaxCount = 0;

                const safeResolve = (val) => {
                    if (settled) return;
                    settled = true;
                    try { page.removeListener('response', handler); } catch(_) {}
                    resolve(val);
                };

                // Timer de seguridad — SIEMPRE resuelve
                const timer = setTimeout(() => {
                    reportar(`   → Grid timeout (${timeout/1000}s) — ${ajaxCount} AJAX vistas, ninguna con activitiesRows`);
                    safeResolve(null);
                }, timeout);

                // Timer de emergencia — por si el primer timer falla
                const emergencia = setTimeout(() => { safeResolve(null); }, timeout + 5000);

                const handler = async (resp) => {
                    try {
                        if (settled) return;
                        const url = resp.url();
                        if (!url.includes('output=ajax')) return;
                        ajaxCount++;
                        const ct = resp.headers()['content-type'] || '';
                        if (!ct.includes('json') && !ct.includes('javascript')) return;
                        const text = await resp.text().catch(() => '');
                        if (!text || text.length < 20) return;
                        const data = JSON.parse(text);
                        const keys = Object.keys(data).slice(0, 10).join(',');
                        reportar(`   → AJAX: ${text.length}B keys=[${keys}]`);
                        if (data.activitiesRows !== undefined) {
                            clearTimeout(timer); clearTimeout(emergencia);
                            safeResolve(data.activitiesRows || []);
                        }
                    } catch(_) {}
                };
                page.on('response', handler);
            });

            // ── Helper: leer fecha actual mostrada en TOA ────────────────────
            const leerFechaTOA = async () => {
                return page.evaluate(() => {
                    const text = document.body.innerText;
                    const m = text.match(/(\d{4})\/(\d{2})\/(\d{2})/);
                    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
                }).catch(() => null);
            };

            // ── Helper: click flecha izquierda (día anterior) — CLICK FÍSICO ──
            const clickFlechaIzq = async () => {
                // Buscar coordenadas de la flecha < (NO usar el.click — Oracle JET lo ignora)
                const coords = await page.evaluate(() => {
                    const els = [...document.querySelectorAll('a, button, [role="button"], span, oj-button')];
                    for (const el of els) {
                        const txt = (el.textContent || '').trim();
                        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                        if ((txt === '‹' || txt === '<' || txt === '◀' || txt === '❮') ||
                            /previous|anterior|prev/i.test(aria)) {
                            const r = el.getBoundingClientRect();
                            if (r.width > 0 && r.height > 0 && r.y < 250) {
                                return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
                            }
                        }
                    }
                    // Fallback: buscar la fecha y clickear 25px a su izquierda
                    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                    let n;
                    while ((n = walker.nextNode())) {
                        if (/\d{4}\/\d{2}\/\d{2}/.test(n.textContent)) {
                            const r = n.parentElement.getBoundingClientRect();
                            return { x: r.left - 25, y: r.top + r.height / 2 };
                        }
                    }
                    return null;
                }).catch(() => null);

                if (coords) {
                    await page.mouse.click(coords.x, coords.y).catch(() => {});
                }
                return !!coords;
            };

            // ── Helper: activar Vista de Lista (botón con tooltip "Vista de lista") ──
            const activarVistaLista = async () => {
                reportar('📋 Activando Vista de Lista...');

                // En TOA el toolbar tiene: Vista ▼ | 🔽filtro | ⏰ | ≡lista | 🗺️ | 📅
                // El botón "Vista de lista" tiene title="Vista de lista"
                const listaCoords = await page.evaluate(() => {
                    // Buscar TODOS los elementos con title o aria-label
                    const all = [...document.querySelectorAll('*')];
                    for (const el of all) {
                        const title = (el.getAttribute('title') || '').toLowerCase();
                        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                        const combined = title + ' ' + aria;
                        // Match exacto: "vista de lista" o "list view" o simplemente "lista"
                        if (/vista de lista|list view/i.test(combined) ||
                            (combined.includes('lista') && !combined.includes('filtro'))) {
                            const r = el.getBoundingClientRect();
                            if (r.width > 0 && r.height > 0 && r.y < 300) {
                                return { x: r.left + r.width/2, y: r.top + r.height/2,
                                         src: 'title:"' + (title || aria) + '"' };
                            }
                        }
                    }

                    // Fallback: buscar los iconos de vista agrupados en el toolbar
                    // Son los iconos a la derecha del filtro (embudo), en la barra superior
                    // El botón de lista es el 2do icono del grupo (después del reloj)
                    const viewBtns = [];
                    for (const el of all) {
                        const title = (el.getAttribute('title') || '').toLowerCase();
                        if (!title) continue;
                        const r = el.getBoundingClientRect();
                        // Botones de vista: están en el toolbar (y < 250), son pequeños
                        if (r.width > 10 && r.width < 80 && r.height > 10 && r.height < 80 &&
                            r.y > 50 && r.y < 250 && r.x > 600) {
                            if (/vista|view|time|list|map|calendar|línea|gantt/i.test(title)) {
                                viewBtns.push({ x: r.left + r.width/2, y: r.top + r.height/2,
                                                title, rx: r.x });
                            }
                        }
                    }
                    // Si encontramos grupo de botones vista, el de lista es el que tiene "list" o "lista"
                    const listBtn = viewBtns.find(b => /list|lista/i.test(b.title));
                    if (listBtn) return { x: listBtn.x, y: listBtn.y, src: 'viewGroup:"' + listBtn.title + '"' };

                    // Si hay botones de vista pero ninguno dice "lista", tomar el 2do (suele ser lista)
                    if (viewBtns.length >= 2) {
                        viewBtns.sort((a, b) => a.rx - b.rx);
                        return { x: viewBtns[1].x, y: viewBtns[1].y,
                                 src: 'viewGroup[1]:"' + viewBtns[1].title + '"' };
                    }

                    return null;
                }).catch(() => null);

                if (listaCoords) {
                    reportar(`   → 🖱️ Vista Lista en (${Math.round(listaCoords.x)}, ${Math.round(listaCoords.y)}) [${listaCoords.src}]`);
                    await page.mouse.click(listaCoords.x, listaCoords.y).catch(() => {});
                    await new Promise(r => setTimeout(r, 3000)); // esperar cambio de vista + carga Grid
                    return true;
                }

                reportar('   → ⚠️ Botón Vista Lista no encontrado — listando todos los titles del toolbar:');
                // Debug: mostrar qué títulos existen en el toolbar
                const titles = await page.evaluate(() => {
                    return [...document.querySelectorAll('*')]
                        .filter(el => {
                            const r = el.getBoundingClientRect();
                            return r.y > 50 && r.y < 250 && r.x > 500 && el.getAttribute('title');
                        })
                        .map(el => `"${el.getAttribute('title')}" @(${Math.round(el.getBoundingClientRect().x)},${Math.round(el.getBoundingClientRect().y)})`)
                        .slice(0, 15);
                }).catch(() => []);
                reportar(`   → Titles toolbar: ${titles.join(' | ') || 'ninguno'}`);
                return false;
            };

            // ── Helper: abrir Filtros y marcar "Todos los datos de hijos" ────
            // FLUJO CORRECTO (confirmado por usuario):
            //   1. Después de hacer click en ≡ (Vista de Lista)...
            //   2. Click en botón "Vista ▼" del toolbar → abre panel Filtros
            //   3. Marcar checkbox "Todos los datos de hijos"
            //   4. Click "Aplicar"  → aparece botón "Acciones" con datos cargados
            const aplicarFiltros = async () => {
                reportar('🔧 Abriendo panel Filtros via botón "Vista"...');

                // PASO A: Click en "Vista ▼" (el dropdown button que abre el panel de filtros)
                // En TOA toolbar: ← fecha → | ≡(filtro-icon) | Vista ▼ | Acciones ▼ | iconos
                // El botón "Vista" tiene texto "Vista" y un dropdown arrow ▼
                const vistaCoords = await page.evaluate(() => {
                    const all = [...document.querySelectorAll('*')];
                    const candidates = [];
                    for (const el of all) {
                        const txt = (el.textContent || '').trim();
                        const r = el.getBoundingClientRect();
                        if (r.width <= 0 || r.height <= 0 || r.y > 250 || r.y < 30) continue;
                        // Buscar elemento con texto exacto "Vista" en el toolbar
                        if (/^Vista$/i.test(txt) && r.x > 300) {
                            candidates.push({
                                x: r.left + r.width/2, y: r.top + r.height/2,
                                area: r.width * r.height,
                                tag: el.tagName,
                                title: el.getAttribute('title') || ''
                            });
                        }
                    }
                    if (!candidates.length) return null;
                    // Preferir el más pequeño y específico
                    candidates.sort((a, b) => a.area - b.area);
                    return candidates[0];
                }).catch(() => null);

                let panelAbierto = false;

                if (vistaCoords) {
                    reportar(`   🖱️ Click "Vista" [${vistaCoords.tag}] en (${Math.round(vistaCoords.x)}, ${Math.round(vistaCoords.y)})`);
                    await page.mouse.click(vistaCoords.x, vistaCoords.y);
                    await new Promise(r => setTimeout(r, 2000));
                    panelAbierto = true;
                } else {
                    reportar('   ⚠️ Botón "Vista" no encontrado — listando toolbar:');
                    const toolbarInfo = await page.evaluate(() => {
                        return [...document.querySelectorAll('*')]
                            .filter(el => {
                                const r = el.getBoundingClientRect();
                                return r.y > 30 && r.y < 250 && r.width > 5 && r.height > 5 && r.x > 300;
                            })
                            .map(el => {
                                const r = el.getBoundingClientRect();
                                return `[${el.tagName}] "${(el.textContent||'').trim().substring(0,20)}" title="${el.getAttribute('title')||''}" @(${Math.round(r.x)},${Math.round(r.y)}) ${Math.round(r.width)}x${Math.round(r.height)}`;
                            })
                            .filter((v, i, a) => a.indexOf(v) === i)
                            .slice(0, 20);
                    }).catch(() => []);
                    toolbarInfo.forEach(i => reportar(`      ${i}`));

                    // Fallback: clickTexto "Vista"
                    const r = await clickTexto(/^Vista$/i, { minY: 30, maxY: 250 });
                    if (r.ok) {
                        reportar(`   → clickTexto "Vista" OK en (${r.x},${r.y})`);
                        await new Promise(r => setTimeout(r, 2000));
                        panelAbierto = true;
                    }
                }

                // Verificar que el panel de filtros se abrió (debe aparecer "Todos los datos de hijos")
                const panelVisible = await page.evaluate(() => {
                    return /todos los datos de hijos/i.test(document.body.innerText || '');
                }).catch(() => false);

                if (!panelVisible) {
                    reportar('   → ⚠️ Panel Filtros no visible. Reintentando...');
                    if (vistaCoords) {
                        await page.mouse.click(vistaCoords.x, vistaCoords.y);
                        await new Promise(r => setTimeout(r, 2000));
                    }
                } else {
                    reportar('   ✅ Panel Filtros abierto');
                }

                // PASO B: Marcar checkbox "Todos los datos de hijos"
                reportar('   ☑️ Buscando checkbox "Todos los datos de hijos"...');
                let checkboxMarcado = false;

                const cbCoords = await page.evaluate(() => {
                    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                    let node;
                    while ((node = walker.nextNode())) {
                        if (/todos los datos/i.test(node.textContent)) {
                            let el = node.parentElement;
                            for (let t = 0; t < 8 && el; t++) {
                                const cb = el.querySelector('input[type="checkbox"], [role="checkbox"]');
                                if (cb) {
                                    const r = cb.getBoundingClientRect();
                                    if (r.width > 0 && r.height > 0) {
                                        return { x: r.left + r.width/2, y: r.top + r.height/2,
                                                 checked: cb.checked || cb.getAttribute('aria-checked') === 'true',
                                                 src: 'checkbox' };
                                    }
                                }
                                el = el.parentElement;
                            }
                            // Click en el label/texto directamente (Oracle JET a veces usa labels clickeables)
                            const lbl = node.parentElement;
                            if (lbl) {
                                const r = lbl.getBoundingClientRect();
                                if (r.width > 0 && r.height > 0) {
                                    return { x: r.left - 15, y: r.top + r.height/2,
                                             checked: false, src: 'label-offset' };
                                }
                            }
                        }
                    }
                    return null;
                }).catch(() => null);

                if (cbCoords && !cbCoords.checked) {
                    reportar(`   → Click checkbox [${cbCoords.src}] en (${Math.round(cbCoords.x)}, ${Math.round(cbCoords.y)})`);
                    await page.mouse.click(cbCoords.x, cbCoords.y);
                    await new Promise(r => setTimeout(r, 1000));

                    // Verificar que se marcó
                    const isNowChecked = await page.evaluate(() => {
                        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                        let node;
                        while ((node = walker.nextNode())) {
                            if (/todos los datos/i.test(node.textContent)) {
                                let el = node.parentElement;
                                for (let t = 0; t < 8 && el; t++) {
                                    const cb = el.querySelector('input[type="checkbox"], [role="checkbox"]');
                                    if (cb && (cb.checked || cb.getAttribute('aria-checked') === 'true')) return true;
                                    el = el.parentElement;
                                }
                            }
                        }
                        return false;
                    }).catch(() => false);

                    if (isNowChecked) {
                        reportar('   → ✅ Checkbox marcado correctamente');
                        checkboxMarcado = true;
                    } else {
                        reportar('   → ⚠️ Checkbox no se marcó en el intento 1, reintentando...');
                        await page.mouse.click(cbCoords.x, cbCoords.y);
                        await new Promise(r => setTimeout(r, 1500));
                        checkboxMarcado = true;
                    }
                } else if (cbCoords?.checked) {
                    reportar('   → ✅ Checkbox ya estaba marcado');
                    checkboxMarcado = true;
                } else {
                    reportar('   → ⚠️ Checkbox específico no encontrado, buscando cualquier checkbox visible...');
                    const anyCb = await page.evaluate(() => {
                        const cbs = [...document.querySelectorAll('input[type="checkbox"], [role="checkbox"]')];
                        for (const cb of cbs) {
                            const r = cb.getBoundingClientRect();
                            if (r.width > 0 && r.height > 0 && r.y > 100 && r.y < 500 && !cb.checked) {
                                return { x: r.left + r.width/2, y: r.top + r.height/2 };
                            }
                        }
                        return null;
                    }).catch(() => null);
                    if (anyCb) {
                        reportar(`   → Checkbox genérico en (${Math.round(anyCb.x)}, ${Math.round(anyCb.y)})`);
                        await page.mouse.click(anyCb.x, anyCb.y);
                        await new Promise(r => setTimeout(r, 1000));
                        checkboxMarcado = true;
                    }
                }

                if (!checkboxMarcado) {
                    reportar('   ⚠️ ADVERTENCIA: No se pudo marcar el checkbox "Todos los datos de hijos"');
                }

                // PASO C: Click en botón "Aplicar"
                reportar('   → Buscando botón "Aplicar"...');

                const aplicarCoords = await page.evaluate(() => {
                    const candidates = [];
                    const all = [...document.querySelectorAll('*')];
                    for (const el of all) {
                        const txt = (el.textContent || '').trim();
                        const val = (el.value || '');
                        if (/^aplicar$/i.test(txt) || /^apply$/i.test(txt) || /^aplicar$/i.test(val)) {
                            const r = el.getBoundingClientRect();
                            if (r.width > 0 && r.height > 0 && r.y > 50) {
                                candidates.push({
                                    x: r.left + r.width/2, y: r.top + r.height/2,
                                    area: r.width * r.height,
                                    txt: txt.substring(0, 20),
                                    tag: el.tagName
                                });
                            }
                        }
                    }
                    if (!candidates.length) return null;
                    candidates.sort((a, b) => a.area - b.area);
                    return candidates[0];
                }).catch(() => null);

                if (aplicarCoords) {
                    reportar(`   → 🖱️ Aplicar [${aplicarCoords.tag}] "${aplicarCoords.txt}" en (${Math.round(aplicarCoords.x)}, ${Math.round(aplicarCoords.y)})`);
                    await page.mouse.click(aplicarCoords.x, aplicarCoords.y).catch(() => {});
                } else {
                    reportar('   → Aplicar no encontrado, usando clickTexto...');
                    const r = await clickTexto(/^aplicar$/i);
                    reportar(`   → clickTexto aplicar: ${r.ok ? `OK en (${r.x},${r.y})` : 'NO ENCONTRADO'}`);
                }

                // PASO D: Esperar carga de datos (TOA tarda con "todos los datos de hijos")
                reportar('   → ⏳ Esperando carga de datos...');
                let datosVerificados = false;
                let intentosVerificacion = 0;
                const maxIntentosVerificacion = 3;

                while (!datosVerificados && intentosVerificacion < maxIntentosVerificacion) {
                    intentosVerificacion++;
                    await new Promise(r => setTimeout(r, 8000));

                    // Verificar datos cargados
                    const dataCargada = await page.evaluate(() => {
                        const txt = document.body.innerText || '';
                        const sinDatos = /no hay elementos|no items|no data/i.test(txt);
                        const tieneAcciones = /acciones/i.test(txt);
                        const tablaVisible = /actividad|técnico|ventana|número|estado/i.test(txt);
                        return { sinDatos, tieneAcciones, tablaVisible };
                    }).catch(() => ({ sinDatos: true, tieneAcciones: false, tablaVisible: false }));

                    if (dataCargada.tieneAcciones && !dataCargada.sinDatos) {
                        reportar('   → ✅ Datos cargados — "Acciones" visible');
                        datosVerificados = true;
                    } else if (dataCargada.tablaVisible && !dataCargada.sinDatos) {
                        reportar('   → ✅ Datos cargados — columnas visibles');
                        datosVerificados = true;
                    } else if (dataCargada.sinDatos) {
                        reportar(`   → ⚠️ Tabla vacía [intento ${intentosVerificacion}/${maxIntentosVerificacion}]...`);
                        if (intentosVerificacion < maxIntentosVerificacion) {
                            reportar('   → Esperando más tiempo...');
                            // No rellamar aplicarFiltros, solo esperar
                        }
                    } else {
                        reportar(`   → Datos probablemente cargados [intento ${intentosVerificacion}/${maxIntentosVerificacion}]`);
                        datosVerificados = true;
                    }
                }

                if (!datosVerificados) {
                    reportar('   ⚠️ ADVERTENCIA: No se pudo verificar que los datos se cargaron correctamente');
                }
            };

            // ══════════════════════════════════════════════════════════════════
            // FLUJO CORRECTO SEGÚN TOA:
            // 1. CHILE
            // 2. Fecha
            // 3. Menú "Vista" → "Todos los datos de hijos" → "Aplicar"
            // 4. Click botón "Vista de lista" (el MEDIO de los 3)
            // 5. Click "Acciones" → "Exportar"
            // ══════════════════════════════════════════════════════════════════

            // ── PASO 1: Click en CHILE en el sidebar ─────────────────────────────
            reportar('\n📂 PASO 1: Seleccionar CHILE en sidebar...');
            try {
                const chileClick = await clickGrupoSidebar('CHILE');
                if (!chileClick.ok) {
                    reportar('   → Sidebar falló, intentando clickTexto...');
                    await clickTexto(/^CHILE$/i, { maxX: 500 });
                }
                await new Promise(r => setTimeout(r, 3000));
                const headerCheck = await page.evaluate(() => (document.body?.innerText || '').substring(0, 300)).catch(() => '');
                reportar(headerCheck.includes('CHILE') ? '   ✅ CHILE confirmado' : '   ⚠️ CHILE puede estar seleccionado');
            } catch (e) {
                reportar(`   ⚠️ Error seleccionando CHILE: ${e.message}`);
            }

            // ── PASO 2: Aplicar filtros "Todos los datos de hijos" — PRIMERO, ANTES DE VISTA DE LISTA ──
            reportar('\n📋 PASO 2: Aplicar filtros "Todos los datos de hijos" via menú Vista...');
            try {
                await aplicarFiltros();
                reportar('   ✅ Filtros aplicados — esperando carga completa...');
                await new Promise(r => setTimeout(r, 3000));

                // Verificación final
                const verificacion = await page.evaluate(() => {
                    const txt = document.body.innerText || '';
                    const tieneAcciones = /acciones/i.test(txt);
                    const sinElementos = /no hay elementos/i.test(txt);
                    return { tieneAcciones, sinElementos };
                }).catch(() => ({ tieneAcciones: false, sinElementos: true }));

                if (verificacion.tieneAcciones && !verificacion.sinElementos) {
                    reportar('   ✅ Botón "Acciones" detectado — datos cargados correctamente');
                } else if (verificacion.sinElementos) {
                    reportar('   ⚠️ "No hay elementos" — reintentando filtros...');
                    await aplicarFiltros();
                    await new Promise(r => setTimeout(r, 8000));
                } else {
                    reportar('   → Continuando...');
                }
            } catch (e) {
                reportar(`   ⚠️ Error Filtros: ${e.message}`);
            }

                        // ── PASO 3: CRÍTICO - Activar "Vista de lista" (botón MEDIO de los 3) ──
            reportar('\n📋 PASO 3: 🔴 CRÍTICO - Click en botón Vista de lista (MEDIO de los 3)...');
            let vistaListaActivada = false;
            try {
                reportar('   → Buscando 3 botones en esquina superior DERECHA...');
                const activarVistaLista = await page.evaluate(() => {
                    const all = [...document.querySelectorAll('*')];
                    const windowWidth = window.innerWidth;
                    const candidates = [];

                    // BÚSQUEDA EXHAUSTIVA: zona EXACTA de los 3 botones
                    for (const el of all) {
                        const r = el.getBoundingClientRect();

                        // Zona ESPECÍFICA (esquina superior derecha)
                        if (r.y > 160 && r.y < 195 &&
                            r.x > (windowWidth - 180) &&
                            r.width > 15 && r.width < 55 &&
                            r.height > 15 && r.height < 55) {

                            candidates.push({
                                x: r.left + r.width/2,
                                y: r.top + r.height/2,
                                x_left: r.left,
                                width: r.width,
                                height: r.height,
                                txt: (el.textContent || '').trim()
                            });
                        }
                    }

                    // Ordenar por posición X (izquierda a derecha)
                    candidates.sort((a, b) => a.x_left - b.x_left);

                    // RETORNAR EL DEL MEDIO
                    if (candidates.length >= 3) {
                        return candidates[1];  // ÍNDICE 1 = BOTÓN DEL MEDIO
                    } else if (candidates.length > 0) {
                        return candidates[0];
                    }
                    return null;
                }).catch(() => null);

                if (!activarVistaLista) {
                    reportar('   ⚠️ No se encontraron botones. Listando TODO en esquina derecha:');
                    const debug = await page.evaluate(() => {
                        const result = [];
                        const windowWidth = window.innerWidth;
                        for (const el of document.querySelectorAll('*')) {
                            const r = el.getBoundingClientRect();
                            if (r.x > (windowWidth - 250) && r.y > 150 && r.y < 250 && r.width > 5) {
                                result.push({
                                    tag: el.tagName,
                                    txt: (el.textContent || '').trim().substring(0, 15),
                                    x: Math.round(r.left),
                                    y: Math.round(r.top),
                                    w: Math.round(r.width),
                                    h: Math.round(r.height)
                                });
                            }
                        }
                        return result;
                    }).catch(() => []);
                    debug.forEach((b, i) => reportar(`      [${i}] ${b.tag} "${b.txt}" @(${b.x},${b.y}) ${b.w}x${b.h}`));
                    vistaListaActivada = false;
                    return false;
                }

                // CLICK EN BOTÓN ENCONTRADO
                reportar(`   ✅ Botón encontrado @(${Math.round(activarVistaLista.x)}, ${Math.round(activarVistaLista.y)}) ${activarVistaLista.width}x${activarVistaLista.height}`);
                reportar('   → CLICK en Vista de lista...');
                await page.mouse.click(activarVistaLista.x, activarVistaLista.y);
                await new Promise(r => setTimeout(r, 5000));

                const check = await page.evaluate(() => {
                    const txt = document.body.innerText || '';
                    return /acciones/i.test(txt);
                }).catch(() => false);

                if (check) {
                    reportar('   ✅✅✅ ÉXITO: Vista activada - Botón "Acciones" VISIBLE');
                    vistaListaActivada = true;
                } else {
                    reportar('   ⚠️ Sin cambio visible - reintentando...');
                    await page.mouse.click(activarVistaLista.x, activarVistaLista.y);
                    await new Promise(r => setTimeout(r, 5000));
                    vistaListaActivada = true;
                }

            } catch (e) {
                reportar(`   ⚠️ Error PASO 3: ${e.message}`);
            }

            if (!vistaListaActivada) {
                reportar('   🔴 CRÍTICO: Vista de lista NO se activó - descarga fallará sin botón Acciones');
            }


            // ── Configurar directorio de descarga para Puppeteer ────────────
            const downloadDir = path.join(os.tmpdir(), 'toa-exports-' + Date.now());
            fs.mkdirSync(downloadDir, { recursive: true });
            const cdpSession = await page.target().createCDPSession();
            await cdpSession.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: downloadDir
            });
            reportar(`   📁 Directorio de descarga: ${downloadDir}`);

            // ── Helper: parsear CSV ─────────────────────────────────────────
            const parsearCSV = (csvText) => {
                const lines = csvText.split('\n').filter(l => l.trim());
                if (lines.length < 2) return [];
                // Parsear header (puede tener comillas)
                const parseRow = (line) => {
                    const result = [];
                    let current = '';
                    let inQuotes = false;
                    for (let i = 0; i < line.length; i++) {
                        const ch = line[i];
                        if (ch === '"') {
                            if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
                            else inQuotes = !inQuotes;
                        } else if (ch === ',' && !inQuotes) {
                            result.push(current.trim());
                            current = '';
                        } else {
                            current += ch;
                        }
                    }
                    result.push(current.trim());
                    return result;
                };
                const headers = parseRow(lines[0]);
                const rows = [];
                for (let i = 1; i < lines.length; i++) {
                    const vals = parseRow(lines[i]);
                    if (vals.length < 3) continue; // saltar líneas vacías
                    const row = {};
                    headers.forEach((h, idx) => { if (h) row[h] = vals[idx] || ''; });
                    rows.push(row);
                }
                return rows;
            };

            // ── Helper: esperar archivo descargado ──────────────────────────
            const esperarDescarga = async (dir, timeoutMs = 45000) => {
                const inicio = Date.now();
                let lastCheckTime = 0;
                while (Date.now() - inicio < timeoutMs) {
                    const files = fs.readdirSync(dir).filter(f => !f.endsWith('.crdownload') && !f.startsWith('.'));
                    if (files.length > 0) {
                        reportar(`   → 📥 Archivo encontrado después de ${Date.now() - inicio}ms: ${files[0]}`);
                        return path.join(dir, files[0]);
                    }
                    // Log cada 5 segundos
                    if (Date.now() - lastCheckTime > 5000) {
                        const elapsed = Math.round((Date.now() - inicio) / 1000);
                        reportar(`   ⏳ Esperando descarga... (${elapsed}s/${Math.round(timeoutMs / 1000)}s)`);
                        lastCheckTime = Date.now();
                    }
                    await new Promise(r => setTimeout(r, 500));
                }
                reportar(`   ⚠️ Timeout esperando descarga después de ${timeoutMs}ms`);
                return null;
            };

            // ── Helper: click en Acciones → Exportar ────────────────────────
            const clickExportar = async () => {
                // 1. Buscar botón "Acciones" en la toolbar (zona media-derecha)
                reportar('   → 🔍 Buscando botón "Acciones" en toolbar...');
                let accionesCoords = null;
                let reintentos = 0;
                const maxReintentos = 2;

                while (!accionesCoords && reintentos < maxReintentos) {
                    accionesCoords = await page.evaluate(() => {
                        const candidates = [];
                        const all = [...document.querySelectorAll('*')];

                        for (const el of all) {
                            const txt = (el.textContent || '').trim();
                            const r = el.getBoundingClientRect();

                            // Buscar "Acciones" en toolbar (altura 150-230, ancho flexible)
                            // Ampliar rango Y y ancho para mayor cobertura
                            if (/acciones/i.test(txt) && r.y > 150 && r.y < 230 && r.width > 20 && r.width < 200) {
                                candidates.push({
                                    x: r.left + r.width/2,
                                    y: r.top + r.height/2,
                                    txt: txt.substring(0, 20),
                                    area: r.width * r.height,
                                    priority: /^Acciones$/i.test(txt) ? 100 : 50
                                });
                            }
                        }

                        if (candidates.length > 0) {
                            // Preferir el más específico (priority alto, área pequeña)
                            candidates.sort((a, b) => (b.priority - a.priority) || (a.area - b.area));
                            return candidates[0];
                        }
                        return null;
                    }).catch(() => null);

                    if (!accionesCoords) {
                        reintentos++;
                        if (reintentos < maxReintentos) {
                            reportar(`   ⏳ Reintentando buscar "Acciones" (${reintentos}/${maxReintentos})...`);
                            await new Promise(r => setTimeout(r, 2000));
                        }
                    }
                }

                if (!accionesCoords) {
                    reportar('   ⚠️ Botón "Acciones" NO ENCONTRADO. Buscando en toda la página...');
                    const accionesDebug = await page.evaluate(() => {
                        const items = [];
                        // Buscar TODOS los elementos que contienen "Acciones"
                        for (const el of document.querySelectorAll('*')) {
                            if (/acciones/i.test(el.textContent || '')) {
                                const r = el.getBoundingClientRect();
                                if (r.width > 0 && r.height > 0) {
                                    items.push({
                                        tag: el.tagName,
                                        txt: (el.textContent || '').trim().substring(0, 30),
                                        x: Math.round(r.left),
                                        y: Math.round(r.top),
                                        w: Math.round(r.width),
                                        h: Math.round(r.height)
                                    });
                                }
                            }
                        }
                        return items;
                    }).catch(() => []);
                    reportar(`   Elementos con "Acciones" (${accionesDebug.length} encontrados):`);
                    accionesDebug.slice(0, 10).forEach((item, i) => {
                        reportar(`      [${i}] ${item.tag} "${item.txt}" @(${item.x},${item.y}) ${item.w}x${item.h}`);
                    });
                    return false;
                }

                reportar(`   ✅ Botón "Acciones" encontrado en (${Math.round(accionesCoords.x)}, ${Math.round(accionesCoords.y)})`);
                await page.mouse.click(accionesCoords.x, accionesCoords.y).catch(() => {});
                await new Promise(r => setTimeout(r, 2500));

                // 2. Buscar "Exportar" en el menú desplegable
                reportar('   → 🔍 Buscando opción "Exportar" en menú...');
                const exportarCoords = await page.evaluate(() => {
                    const candidates = [];
                    const all = [...document.querySelectorAll('*')];

                    for (const el of all) {
                        const txt = (el.textContent || '').trim();
                        const r = el.getBoundingClientRect();

                        // Buscar "Exportar" en zona de menú desplegable
                        if (/^exportar$/i.test(txt) && r.y > 200 && r.y < 600 && r.width > 30 && r.width < 200) {
                            candidates.push({
                                x: r.left + r.width/2,
                                y: r.top + r.height/2,
                                txt: txt.substring(0, 20),
                                area: r.width * r.height
                            });
                        }
                    }

                    if (candidates.length > 0) {
                        candidates.sort((a, b) => a.area - b.area);
                        return candidates[0];
                    }
                    return null;
                }).catch(() => null);

                if (!exportarCoords) {
                    reportar('   ⚠️ Opción "Exportar" NO ENCONTRADA. Elementos en zona menú:');
                    const menuDebug = await page.evaluate(() => {
                        const items = [];
                        for (const el of document.querySelectorAll('*')) {
                            const r = el.getBoundingClientRect();
                            if (r.y > 200 && r.y < 600 && r.width > 20 && r.width < 200 && r.height > 20) {
                                items.push({
                                    tag: el.tagName,
                                    txt: (el.textContent || '').trim().substring(0, 25),
                                    x: Math.round(r.left),
                                    y: Math.round(r.top),
                                    w: Math.round(r.width),
                                    h: Math.round(r.height)
                                });
                            }
                        }
                        return items;
                    }).catch(() => []);
                    reportar('   Elementos encontrados en menú:');
                    menuDebug.slice(0, 15).forEach((item, i) => {
                        reportar(`      [${i}] ${item.tag} "${item.txt}" @(${item.x},${item.y}) ${item.w}x${item.h}`);
                    });
                    // Cerrar menú
                    await page.mouse.click(600, 400).catch(() => {});
                    return false;
                }

                reportar(`   ✅ "Exportar" encontrado en (${Math.round(exportarCoords.x)}, ${Math.round(exportarCoords.y)})`);
                await page.mouse.click(exportarCoords.x, exportarCoords.y).catch(() => {});
                await new Promise(r => setTimeout(r, 1500));
                reportar('   ✅ Exportar clickeado');
                return true;
            };

            // ── Helper: seleccionar fecha vía calendario popup ──────────────
            const navegarFechaCalendario = async (fechaISO) => {
                const [yyyy, mm, dd] = fechaISO.split('-');
                const diaNum = parseInt(dd, 10);
                const mesNum = parseInt(mm, 10);
                const anioNum = parseInt(yyyy, 10);

                reportar('   → Abriendo calendario...');
                const fechaTextCoords = await page.evaluate(() => {
                    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                    let node;
                    while ((node = walker.nextNode())) {
                        if (/\d{4}\/\d{2}\/\d{2}/.test(node.textContent)) {
                            let el = node.parentElement;
                            for (let i = 0; i < 5 && el; i++) {
                                const r = el.getBoundingClientRect();
                                if (r.width > 0 && r.height > 0 && r.y < 250)
                                    return { x: r.left + r.width/2, y: r.top + r.height/2 };
                                el = el.parentElement;
                            }
                        }
                    }
                    return null;
                }).catch(() => null);

                if (!fechaTextCoords) { reportar('   → ⚠️ Fecha no encontrada'); return false; }
                await page.mouse.click(fechaTextCoords.x, fechaTextCoords.y).catch(() => {});
                await new Promise(r => setTimeout(r, 1500));

                // Verificar calendario abierto
                const calOk = await page.evaluate(() => {
                    const txt = document.body.innerText || '';
                    return /\bL\b.*\bM\b.*\bJ\b.*\bV\b.*\bS\b.*\bD\b/i.test(txt) ||
                           document.querySelector('[class*="calendar"], [class*="datepicker"], .oj-datepicker') !== null;
                }).catch(() => false);
                if (!calOk) { reportar('   → ⚠️ Calendario no abierto'); return false; }
                reportar('   → ✅ Calendario abierto');

                // Navegar mes si es necesario
                const mesCalActual = await page.evaluate(() => {
                    const txt = document.body.innerText || '';
                    const meses = { enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12,
                                    january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12 };
                    for (const [nombre, num] of Object.entries(meses)) {
                        const m = txt.match(new RegExp(nombre + '\\s+(\\d{4})', 'i'));
                        if (m) return { mes: num, anio: parseInt(m[1]) };
                    }
                    return null;
                }).catch(() => null);

                if (mesCalActual) {
                    const mesesDiff = (anioNum - mesCalActual.anio) * 12 + (mesNum - mesCalActual.mes);
                    const direction = mesesDiff < 0 ? /anterior|prev/i : /siguiente|next/i;
                    const arrow = mesesDiff < 0 ? '<' : '>';
                    for (let m = 0; m < Math.abs(mesesDiff); m++) {
                        const coords = await page.evaluate((dir, arr) => {
                            for (const el of [...document.querySelectorAll('*')]) {
                                const t = (el.getAttribute('title') || '') + ' ' + (el.getAttribute('aria-label') || '');
                                const txt = (el.textContent || '').trim();
                                if (new RegExp(dir, 'i').test(t) || txt === arr || txt === '‹' || txt === '›') {
                                    const r = el.getBoundingClientRect();
                                    if (r.width > 0 && r.y > 150 && r.y < 500) return { x: r.left + r.width/2, y: r.top + r.height/2 };
                                }
                            }
                            return null;
                        }, direction.source, arrow).catch(() => null);
                        if (coords) { await page.mouse.click(coords.x, coords.y).catch(() => {}); await new Promise(r => setTimeout(r, 500)); }
                    }
                }

                // Click en el día
                const diaCoords = await page.evaluate((dia) => {
                    const candidates = [];
                    // Restringir la búsqueda sólo dentro de elementos con clase de calendario explícito,
                    // o dar la máxima prioridad si están dentro de un gridcell / td
                    for (const el of [...document.querySelectorAll('.oj-datepicker, [class*="calendar"], [class*="datepicker"], td, [role="gridcell"], a, span, div')]) {
                        if ((el.textContent || '').trim() === String(dia)) {
                            const r = el.getBoundingClientRect();
                            if (r.width > 0 && r.y > 150 && r.y < 650 && r.x > 350) {
                                // Aumentamos artificialmente el peso (área) si el elemento es dudoso como un div lejano,
                                // o favorecemos si vemos que viene de una tabla (calendario típico)
                                let peso = r.width * r.height;
                                if (el.tagName.toLowerCase() === 'td' || el.getAttribute('role') === 'gridcell' || el.closest('table')) {
                                    peso -= 1000; // Prioriza TDs fuertemente, es seguro que es el calendario y no una actividad volando.
                                } else if (el.closest('.oj-datepicker') || el.closest('[class*="calendar"]')) {
                                    peso -= 2000; // Prioridad Máxima si está dentro del contenedor del calendario
                                }
                                candidates.push({ x: r.left + r.width/2, y: r.top + r.height/2, area: peso });
                            }
                        }
                    }
                    if (!candidates.length) return null;
                    // Sort menor área ponderada primero
                    candidates.sort((a, b) => a.area - b.area);
                    return candidates[0];
                }, diaNum).catch(() => null);

                if (diaCoords) {
                    await page.mouse.click(diaCoords.x, diaCoords.y).catch(() => {});
                    await new Promise(r => setTimeout(r, 3000));
                    reportar(`   → ✅ Navegado a día ${diaNum}`);
                    return true;
                }
                reportar(`   → ⚠️ Día ${diaNum} no encontrado`);
                return false;
            };

            // ══════════════════════════════════════════════════════════════════
            // 4. EXTRACCIÓN POR FECHAS — CHILE → Exportar CSV → MongoDB
            // ══════════════════════════════════════════════════════════════════
            reportar(`\n📅 PASO 4: Extracción de ${fechasAProcesar.length} fecha(s) via CSV Export`);

            for (let fi = 0; fi < fechasAProcesar.length; fi++) {
                const fecha = fechasAProcesar[fi];
                reportar(`\n${'═'.repeat(50)}`);
                reportar(`📅 [${fi+1}/${fechasAProcesar.length}] Fecha: ${fecha}`);
                reportar(`${'═'.repeat(50)}`);

                if (process.send) process.send({
                    type: 'progress',
                    grupoProcesando: 'CHILE',
                    diaActual: fi + 1,
                    totalDias: fechasAProcesar.length,
                    fechaProcesando: fecha
                });

                try {
                    // ── PASO 7: Seleccionar fecha configurada ──────────────────────
                    reportar(`\n📅 PASO 7: Navegando a fecha ${fecha}...`);
                    let paso7Exito = false;
                    let fechaActual = await leerFechaTOA();
                    const fechaFmt = fecha.replace(/-/g, '/');
                    reportar(`   → Fecha actual: ${fechaActual}, objetivo: ${fechaFmt}`);

                    if (!fechaActual || !fechaActual.includes(fechaFmt)) {
                        reportar('   → Abriendo calendario...');
                        const navOk = await navegarFechaCalendario(fecha);
                        if (!navOk) {
                            reportar(`   ⚠️ No se pudo navegar a ${fecha}`);
                            // Intentar una segunda vez
                            await new Promise(r => setTimeout(r, 2000));
                            const nav2Ok = await navegarFechaCalendario(fecha);
                            if (!nav2Ok) {
                                reportar(`   🔴 Navegación de fecha falló dos veces, saltando ${fecha}...`);
                                continue;
                            }
                        }
                        paso7Exito = true;
                    } else {
                        reportar('   ✅ Ya en la fecha correcta');
                        paso7Exito = true;
                    }
                    await new Promise(r => setTimeout(r, 2000));

                    if (!paso7Exito) {
                        reportar(`   🔴 PASO 7 falló para ${fecha}`);
                        continue;
                    }

                    // ── PASO 8: Aplicar filtros "Todos los datos de hijos" (para cada fecha) ──
                    reportar(`\n🔧 PASO 8: Aplicar filtros — "Todos los datos de hijos"...`);
                    let paso8Exito = false;
                    try {
                        await aplicarFiltros();
                        reportar('   ✅ Filtros aplicados');
                        await new Promise(r => setTimeout(r, 3000));

                        // Verificar que los filtros se aplicaron correctamente
                        const verificacion = await page.evaluate(() => {
                            const txt = document.body.innerText || '';
                            return {
                                tieneAcciones: /acciones/i.test(txt),
                                sinElementos: /no hay elementos|sin datos/i.test(txt)
                            };
                        }).catch(() => ({ tieneAcciones: false, sinElementos: true }));

                        if (verificacion.tieneAcciones && !verificacion.sinElementos) {
                            reportar('   ✅✅ Botón "Acciones" visible — filtros correctos');
                            paso8Exito = true;
                        } else if (verificacion.sinElementos) {
                            reportar('   ⚠️ Sin datos para esta fecha — continuando...');
                            paso8Exito = true; // Continuar aunque no haya datos
                        } else {
                            reportar('   → Botón "Acciones" no detectado, pero continuando...');
                            paso8Exito = true;
                        }
                    } catch (e) {
                        reportar(`   ⚠️ Error en PASO 8: ${e.message}`);
                        paso8Exito = false;
                    }

                    // ── PASO 9: Click en Vista de lista (botón MEDIO de los 3) ──────
                    reportar(`\n📋 PASO 9: Activando Vista de lista (botón MEDIO en esquina superior DERECHA)...`);
                    let paso9Exito = false;
                    try {
                        let activarVL = null;
                        let reintentosPaso9 = 0;
                        const maxReintosPaso9 = 2;

                        while (!activarVL && reintentosPaso9 < maxReintosPaso9) {
                            activarVL = await page.evaluate(() => {
                                const candidates = [];
                                const all = [...document.querySelectorAll('*')];
                                const windowWidth = window.innerWidth;

                                // Buscar en esquina superior DERECHA (últimos ~200px de ancho)
                                for (const el of all) {
                                    const r = el.getBoundingClientRect();
                                    if (r.y > 160 && r.y < 210 &&  // altura exacta de la toolbar
                                        r.x > (windowWidth - 200) && // esquina derecha
                                        r.width > 15 && r.width < 50 &&
                                        r.height > 15 && r.height < 50) {

                                        const txt = (el.textContent || '').trim();
                                        candidates.push({
                                            x: r.left + r.width/2,
                                            y: r.top + r.height/2,
                                            x_pos: r.left,
                                            txt: txt.substring(0, 5)
                                        });
                                    }
                                }

                                // Ordenar por posición X y retornar el del MEDIO
                                if (candidates.length > 0) {
                                    candidates.sort((a, b) => a.x_pos - b.x_pos);
                                    return candidates.length >= 3 ? candidates[1] : candidates[0];
                                }
                                return null;
                            }).catch(() => null);

                            if (!activarVL) {
                                reintentosPaso9++;
                                if (reintentosPaso9 < maxReintosPaso9) {
                                    reportar(`   ⏳ Reintentando buscar Vista de lista (${reintentosPaso9}/${maxReintosPaso9})...`);
                                    await new Promise(r => setTimeout(r, 2000));
                                }
                            }
                        }

                        if (activarVL) {
                            reportar(`   🖱️ Click Vista de lista en (${Math.round(activarVL.x)}, ${Math.round(activarVL.y)})`);
                            await page.mouse.click(activarVL.x, activarVL.y).catch(() => {});
                            await new Promise(r => setTimeout(r, 5000));
                            reportar('   ✅ Vista de lista activada');
                            paso9Exito = true;
                        } else {
                            reportar('   ⚠️ Botón Vista de lista no encontrado después de reintentos');
                        }
                    } catch (e) {
                        reportar(`   ⚠️ Error PASO 9: ${e.message}`);
                    }

                    if (!paso9Exito) {
                        reportar('   🔴 ADVERTENCIA: PASO 9 falló — Acciones no aparecerá');
                    }

                    // ── PASO 10: Limpiar directorio y exportar ─────────────────────
                    reportar(`\n📥 PASO 10: Exportar datos...`);
                    const existingFiles = fs.readdirSync(downloadDir);
                    existingFiles.forEach(f => { try { fs.unlinkSync(path.join(downloadDir, f)); } catch(_) {} });

                    // Verificar si la fecha ya tiene datos en MongoDB
                    try {
                        const yaExiste = await Actividad.countDocuments({
                            empresa: 'CHILE',
                            fecha: new Date(fecha + 'T00:00:00Z')
                        });
                        reportar(`   → 🔍 ${fecha} tiene ${yaExiste} registros — actualizando...`);
                    } catch(e) {
                        reportar(`   → ℹ️ No pude verificar existencia: ${e.message}`);
                    }

                    // Click en Acciones → Exportar (con reintentos)
                    let exportOk = false;
                    let reintentosExport = 0;
                    const maxReintentosExport = 2;

                    while (!exportOk && reintentosExport < maxReintentosExport) {
                        exportOk = await clickExportar();
                        if (!exportOk) {
                            reintentosExport++;
                            if (reintentosExport < maxReintentosExport) {
                                reportar(`   ⏳ Reintentando exportar (${reintentosExport}/${maxReintentosExport})...`);
                                await new Promise(r => setTimeout(r, 3000));
                            }
                        }
                    }

                    if (!exportOk) {
                        reportar(`   🔴 No se pudo exportar para ${fecha} después de ${maxReintentosExport} intentos`);
                        continue;
                    }

                    // Esperar a que se descargue el archivo
                    reportar('   → ⏳ Esperando descarga del CSV...');
                    const csvFile = await esperarDescarga(downloadDir, 45000);
                    if (!csvFile) {
                        reportar('   → 🔴 Timeout esperando descarga del CSV para ' + fecha);
                        continue;
                    }
                    reportar(`   → 📄 Archivo descargado: ${path.basename(csvFile)}`);

                    // Leer y parsear el CSV
                    let csvContent;
                    try {
                        csvContent = fs.readFileSync(csvFile, 'utf-8');
                    } catch (e) {
                        csvContent = fs.readFileSync(csvFile, 'latin1');
                    }
                    const rows = parsearCSV(csvContent);
                    reportar(`   → 📊 ${rows.length} filas parseadas del CSV`);
                    if (rows.length > 0) {
                        const campos = Object.keys(rows[0]);
                        reportar(`   → Campos (${campos.length}): ${campos.slice(0, 8).join(', ')}...`);
                    }

                    // Guardar en MongoDB
                    if (rows.length > 0) {
                        try {
                            const guardados = await guardarActividades(rows, 'CHILE', fecha, 0, empresaRef);
                            totalGuardados += guardados;
                            reportar(`   → 💾 CHILE ${fecha}: ${rows.length} actividades (CSV) → ${guardados} guardadas en MongoDB`);
                        } catch (e) {
                            reportar(`   → ❌ Error guardando: ${e.message}`);
                        }
                    } else {
                        reportar(`   → ⚠️ CSV vacío para ${fecha}`);
                    }

                    // Borrar archivo temporal
                    try { fs.unlinkSync(csvFile); } catch(_) {}
                    reportar(`   → 🗑️ CSV temporal eliminado`);
                } catch (e) {
                    reportar(`   ⚠️ Error en PASO 7-10: ${e.message}`);
                }
            }

            // Limpiar directorio temporal
            try { fs.rmdirSync(downloadDir, { recursive: true }); } catch(_) {}
            reportar(`\n✅ CHILE — extracción completada (${totalGuardados} registros guardados)`);

        } else {
            // ── Extracción HTTP (fallback sin Chrome) ────────────────────────
            reportar(`\n📡 Extrayendo ${fechasAProcesar.length} días × ${gruposSeleccionados.length} grupo(s) (HTTP)...`);
            for (let i = 0; i < fechasAProcesar.length; i++) {
                const fecha = fechasAProcesar[i];
                const [yyyy, mm, dd] = fecha.split('-');
                if (process.send) process.send({ type: 'progress', diaActual: i+1, totalDias: fechasAProcesar.length, fechaProcesando: fecha });
                if (i % 5 === 0) reportar(`📅 [${i+1}/${fechasAProcesar.length}] ${fecha}`);
                for (const grupo of gruposSeleccionados) {
                    if (!grupo.id) continue;
                    try {
                        const fechaFmt = `${mm}/${dd}/${yyyy}`;
                        const body = `date=${encodeURIComponent(fechaFmt)}&gid=${grupo.id}`;
                        const res = await httpPost(gridUrl, body, '', csrfToken);
                        const rows = res.activitiesRows || [];
                        if (rows.length > 0) {
                            const g = await guardarActividades(rows, grupo.nombre, fecha, parseInt(grupo.id), empresaRef);
                            totalGuardados += g;
                            reportar(`  💾 ${grupo.nombre} ${fecha}: ${rows.length} → ${g} guardadas`);
                        }
                    } catch (err) { reportar(`  ❌ ${grupo.nombre} ${fecha}: ${err.message}`); }
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
        reportar('🖥️  Lanzando Chrome local (modo bajo consumo)...');
        browser = await puppeteer.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1280,1024',
                '--single-process',
                '--no-zygote',
                '--renderer-process-limit=1',
                '--no-first-run',
                '--js-flags=--max-old-space-size=256',
                '--disable-blink-features=AutomationControlled'
            ],
            timeout: 90000
        });
        reportar('✅ Chrome lanzado correctamente');
    }

    const page = await browser.newPage();

    // ── SCREENSHOTS EN VIVO — enviar frame al servidor cada 1.5s ─────────────
    const enviarScreenshotDebug = async (etapa) => {
        if (!process.send) return;
        try {
            const b64 = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 55 });
            process.send({ type: 'screenshot', data: b64, stage: etapa || 'debug' });
        } catch (_) {}
    };

    let _screenshotInterval = null;
    if (process.send) {
        _screenshotInterval = setInterval(async () => {
            try {
                const b64 = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 40 });
                process.send({ type: 'screenshot', data: b64 });
            } catch (_) {}
        }, 4000);
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
            window.__xhrHeaders[name] = String(value ?? '').substring(0, 60);

            // Capturar token CSRF (solo headers que contengan "csrf")
            const headerValue = String(value ?? '');
            if (/csrf/i.test(name) && headerValue.length > 8) {
                window.__csrfCaptured = headerValue;
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
                    if (/csrf|ofs-csrf/i.test(k)) window.__csrfCaptured = String(v ?? '');
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
            const headerValue = toText(v);
            if (esHeaderCSRF(k) && headerValue.length > 8) {
                if (!csrfXHR) reportar(`🔑 CSRF (CDP ExtraInfo): ${k}=${clipText(headerValue,30)}...`);
                csrfXHR = headerValue;
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
                const headerValue = toText(v);
                if (esHeaderCSRF(k) && headerValue.length > 8) {
                    if (!csrfXHR) reportar(`🔑 CSRF (CDP Request): ${k}=${clipText(headerValue,30)}...`);
                    csrfXHR = headerValue;
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
    reportar(`🔗 Navegando a TOA: ${TOA_URL}`);
    try {
        await page.goto(TOA_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
        reportar('   ✅ Página cargada (DOM)');
    } catch (e) {
        reportar(`   ⚠️ Error en navegación inicial: ${e.message}. Reintentando con networkidle2...`);
        await page.goto(TOA_URL, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
    }
    await new Promise(r => setTimeout(r, 4000));

    // ⚠️ Resetear CSRF capturado durante la carga inicial — NO es válido para el dashboard
    // TOA envía headers/cookies con "csrf" al cargar la página de login, pero eso no significa
    // que estemos logueados. Solo aceptaremos CSRF DESPUÉS de confirmar que estamos en el dashboard.
    csrfXHR = '';
    reportar('   ℹ️ CSRF reseteado (carga inicial no cuenta)');

    // Esperar campo password
    await page.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 })
        .catch(() => reportar('⚠️ Campo password no visible, continúo...'));

    // ==========================================================================
    // AGENTE REACTIVO — actúa como humano: observa la pantalla y reacciona
    // Loop: leer estado → decidir acción → ejecutar → esperar → repetir
    // ==========================================================================
    reportar(`   Usuario: ${usuario}`);

    const obtenerFrames = () => {
        const main = page.mainFrame();
        return [main, ...page.frames().filter(f => f !== main)];
    };

    const encontrarFrameLogin = async () => {
        const frames = obtenerFrames();
        let mejor = null;
        for (const frame of frames) {
            try {
                const meta = await frame.evaluate(() => {
                    const roots = [document];
                    const stack = [document.documentElement];
                    while (stack.length) {
                        const el = stack.pop();
                        if (!el) continue;
                        if (el.shadowRoot) roots.push(el.shadowRoot);
                        const kids = el.children || [];
                        for (let i = 0; i < kids.length; i++) stack.push(kids[i]);
                    }
                    const visible = (el) => {
                        if (!el || el.disabled || el.readOnly) return false;
                        const r = el.getBoundingClientRect();
                        const cs = window.getComputedStyle(el);
                        return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
                    };
                    const collect = (sel) => roots.flatMap(root => [...root.querySelectorAll(sel)]).filter(visible);
                    const pass = collect('input[type="password"]');
                    if (!pass.length) return null;
                    const user = collect('input#username,input[name="username"],input[name="userName"],input[name="login"],input[id*="user" i],input[name*="user" i],input[type="email"],input[type="text"]');
                    return {
                        href: window.location.href,
                        title: document.title || '',
                        passCount: pass.length,
                        userCount: user.length
                    };
                }).catch(() => null);
                if (!meta) continue;
                const score = (meta.userCount > 0 ? 10 : 0) + (meta.passCount > 0 ? 5 : 0);
                if (!mejor || score > mejor.score) mejor = { frame, meta, score };
            } catch (_) {}
        }
        if (mejor) {
            reportar(`   → Frame login detectado: ${clipText(mejor.meta.href || 'sin-url', 80)} | ${clipText(mejor.meta.title || 'sin-title', 40)} | user:${mejor.meta.userCount} pass:${mejor.meta.passCount}`);
            return mejor.frame;
        }
        reportar('   ⚠️ No detecté frame con password visible, uso mainFrame');
        return page.mainFrame();
    };

    const convertirCoordsAPage = async (frame, x, y) => {
        let px = x;
        let py = y;
        let actual = frame;
        while (actual && actual !== page.mainFrame()) {
            const frameEl = await actual.frameElement().catch(() => null);
            if (!frameEl) return null;
            const box = await frameEl.boundingBox().catch(() => null);
            if (!box) return null;
            px += box.x;
            py += box.y;
            actual = actual.parentFrame();
        }
        return { x: px, y: py };
    };

    const buscarPuntoVisible = async (frame, selectores) => {
        return frame.evaluate((sels) => {
            const roots = [document];
            const stack = [document.documentElement];
            while (stack.length) {
                const el = stack.pop();
                if (!el) continue;
                if (el.shadowRoot) roots.push(el.shadowRoot);
                const kids = el.children || [];
                for (let i = 0; i < kids.length; i++) stack.push(kids[i]);
            }
            const visible = (el) => {
                if (!el || el.disabled || el.readOnly) return false;
                const rect = el.getBoundingClientRect();
                const cs = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
            };
            for (const selector of sels) {
                for (const root of roots) {
                    const cand = root.querySelector(selector);
                    if (!visible(cand)) continue;
                    const r = cand.getBoundingClientRect();
                    return { selector, x: r.left + r.width / 2, y: r.top + r.height / 2 };
                }
            }
            return null;
        }, selectores).catch(() => null);
    };

    const resolverElementoVisible = async (frame, selectores) => {
        const h = await frame.evaluateHandle((sels) => {
            const roots = [document];
            const stack = [document.documentElement];
            while (stack.length) {
                const el = stack.pop();
                if (!el) continue;
                if (el.shadowRoot) roots.push(el.shadowRoot);
                const kids = el.children || [];
                for (let i = 0; i < kids.length; i++) stack.push(kids[i]);
            }
            const visible = (el) => {
                if (!el || el.disabled || el.readOnly) return false;
                const rect = el.getBoundingClientRect();
                const cs = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
            };
            for (const selector of sels) {
                for (const root of roots) {
                    const cand = root.querySelector(selector);
                    if (visible(cand)) return cand;
                }
            }
            return null;
        }, selectores).catch(() => null);
        if (!h) return null;
        const el = h.asElement ? h.asElement() : null;
        if (!el) {
            await h.dispose().catch(() => {});
            return null;
        }
        return { handle: h, element: el };
    };

    const llenar = async (frame, selectores, val) => {
        for (const sel of selectores) {
            const target = await resolverElementoVisible(frame, [sel]);
            if (target?.element) {
                const el = target.element;
                await el.click({ clickCount: 3, delay: 25 }).catch(() => {});
                await page.keyboard.press('Backspace').catch(() => {});
                await el.type(val, { delay: 55 }).catch(async () => {
                    await page.keyboard.type(val, { delay: 55 }).catch(() => {});
                });
                await frame.evaluate((node) => {
                    node.dispatchEvent(new Event('input', { bubbles: true }));
                    node.dispatchEvent(new Event('change', { bubbles: true }));
                }, el).catch(() => {});
                await target.handle.dispose().catch(() => {});
                await new Promise(r => setTimeout(r, 120));
                const ok = await frame.evaluate((selector) => {
                    const roots = [document];
                    const stack = [document.documentElement];
                    while (stack.length) {
                        const e = stack.pop();
                        if (!e) continue;
                        if (e.shadowRoot) roots.push(e.shadowRoot);
                        const kids = e.children || [];
                        for (let i = 0; i < kids.length; i++) stack.push(kids[i]);
                    }
                    for (const root of roots) {
                        const node = root.querySelector(selector);
                        if (!node) continue;
                        return String(node.value || '').length;
                    }
                    return 0;
                }, sel).catch(() => 0);
                if (ok > 0) return { ok: true, selector: sel, length: ok };
            }

            const punto = await buscarPuntoVisible(frame, [sel]);
            if (!punto) continue;
            const pagePoint = await convertirCoordsAPage(frame, punto.x, punto.y);
            if (!pagePoint) continue;
            await page.mouse.click(pagePoint.x, pagePoint.y, { clickCount: 3 }).catch(() => {});
            await page.keyboard.press('Backspace').catch(() => {});
            await page.keyboard.type(val, { delay: 55 }).catch(() => {});
            await new Promise(r => setTimeout(r, 120));
            const ok = await frame.evaluate((selector) => {
                const roots = [document];
                const stack = [document.documentElement];
                while (stack.length) {
                    const el = stack.pop();
                    if (!el) continue;
                    if (el.shadowRoot) roots.push(el.shadowRoot);
                    const kids = el.children || [];
                    for (let i = 0; i < kids.length; i++) stack.push(kids[i]);
                }
                for (const root of roots) {
                    const node = root.querySelector(selector);
                    if (!node) continue;
                    return String(node.value || '').length;
                }
                return 0;
            }, sel).catch(() => 0);
            if (ok > 0) return { ok: true, selector: sel, length: ok };
        }
        return { ok: false, selector: '', length: 0 };
    };

    const resolverSubmitLogin = async (frame) => {
        const h = await frame.evaluateHandle(() => {
            const roots = [document];
            const stack = [document.documentElement];
            while (stack.length) {
                const el = stack.pop();
                if (!el) continue;
                if (el.shadowRoot) roots.push(el.shadowRoot);
                const kids = el.children || [];
                for (let i = 0; i < kids.length; i++) stack.push(kids[i]);
            }
            const visible = (el) => {
                if (!el || el.disabled) return false;
                const rect = el.getBoundingClientRect();
                const cs = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
            };
            const rx = /(iniciar|iniciar sesión|login|log in|sign.?in|entrar|acceder|ingresar|autenticar|enviar)/i;
            let best = null;
            let bestScore = -1;
            for (const root of roots) {
                const all = root.querySelectorAll('button,input[type="submit"],input[type="button"],[role="button"],a[role="button"]');
                for (const el of all) {
                    if (!visible(el)) continue;
                    const text = ((el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || el.title || '') + '').trim();
                    const t = text.toLowerCase();
                    let score = 0;
                    if (rx.test(text)) score += 100;
                    if (t.includes('oracle') || t.includes('field') || t.includes('service')) score += 15;
                    if (el.tagName === 'INPUT' && (el.type || '').toLowerCase() === 'submit') score += 50;
                    if (el.tagName === 'BUTTON') score += 25;
                    if ((el.type || '').toLowerCase() === 'button') score += 15;
                    if (t.includes('iniciar') || t.includes('login') || t.includes('sign') || t.includes('entrar')) score += 30;
                    if (el.closest('form')) score += 20;
                    const r = el.getBoundingClientRect();
                    if (r.top < 650) score += 3;
                    if (score > bestScore) { bestScore = score; best = el; }
                }
            }
            return best;
        }).catch(() => null);
        if (!h) return null;
        const el = h.asElement ? h.asElement() : null;
        if (!el) {
            await h.dispose().catch(() => {});
            return null;
        }
        return { handle: h, element: el };
    };

    const hacerLogin = async () => {
        await page.bringToFront().catch(() => {});
        const frame = await encontrarFrameLogin();
        const frameUrl = frame.url ? frame.url() : '';
        reportar(`   → Llenando credenciales en frame: ${clipText(frameUrl || 'main', 80)}`);
        await enviarScreenshotDebug('login_inicio');

        const userFill = await llenar(frame, [
            'input#username','input[name="username"]','input[name="userName"]','input[name="login"]',
            'input[id*="user" i]','input[name*="user" i]','input[autocomplete="username"]',
            'input[type="email"]','input[type="text"]'
        ], usuario);
        if (!userFill.ok) {
            reportar('   ⚠️ No encontré campo usuario visible en ningún selector');
            await enviarScreenshotDebug('login_user_no_encontrado');
            return;
        }

        const passFill = await llenar(frame, [
            'input#password', 'input[name="password"]', 'input[name="passwd"]',
            'input[id*="pass" i]', 'input[type="password"]',
            'input[placeholder*="contraseña" i]', 'input[aria-label*="contraseña" i]',
            'oj-input-password input'
        ], clave);
        reportar(`   → Usuario selector: ${userFill.selector} (${userFill.length})`);
        reportar(`   → Password ${passFill.ok ? 'OK' : 'NO detectado'}`);
        if (!passFill.ok) {
            await enviarScreenshotDebug('login_pass_no_encontrado');
            return;
        }
        await enviarScreenshotDebug('login_campos_completados');

        const passTarget = await resolverElementoVisible(frame, [
            'input#password','input[name="password"]','input[name="passwd"]','input[id*="pass" i]','input[type="password"]'
        ]);
        if (passTarget?.element) {
            await passTarget.element.click({ delay: 20 }).catch(() => {});
            await passTarget.handle.dispose().catch(() => {});
            reportar('   → Password enfocado para submit por botón');
        }

        let submitTarget = await resolverSubmitLogin(frame);
        if (submitTarget?.element) {
            await submitTarget.element.click({ delay: 25 }).catch(() => {});
            await submitTarget.handle.dispose().catch(() => {});
            reportar('   → Click en submit semántico');
        } else {
            const btnPoint = await buscarPuntoVisible(frame, [
                'button[type="submit"]','input[type="submit"]','button[name*="login" i]','button[id*="login" i]','button','input[type="button"]'
            ]);
            if (btnPoint) {
                const p = await convertirCoordsAPage(frame, btnPoint.x, btnPoint.y);
                if (p) {
                    await page.mouse.click(p.x, p.y).catch(() => {});
                    reportar(`   → Click físico en submit (${Math.round(p.x)}, ${Math.round(p.y)})`);
                } else {
                    await page.keyboard.press('Enter').catch(() => {});
                    reportar('   → Submit por Enter (sin coords)');
                }
            } else {
                await page.keyboard.press('Enter').catch(() => {});
                reportar('   → Submit por Enter (sin botón visible)');
            }
        }

        await new Promise(r => setTimeout(r, 1800));
        const postSubmit = await leerPantalla();
        if (postSubmit.tieneFormLogin && !postSubmit.tieneDashboard && !postSubmit.tieneSesionMax && !postSubmit.tieneErrorCred) {
            const jsSubmit = await frame.evaluate(() => {
                const p = document.querySelector('input[type="password"]');
                const f = p?.form || p?.closest('form');
                if (!f) return false;
                if (typeof f.requestSubmit === 'function') f.requestSubmit();
                else f.submit();
                return true;
            }).catch(() => false);
            if (jsSubmit) reportar('   → Reintento submit por form.requestSubmit()');
        }
        reportar('   → Click "Iniciar sesión" enviado');
        await enviarScreenshotDebug('login_submit_enviado');
    };

    const leerPantalla = async () => {
        const frames = obtenerFrames();
        let tieneFormLogin = false;
        let tieneSesionMax = false;
        let tieneDashboard = false;
        let tieneErrorCred = false;
        let resumen = '';
        let titulo = '';
        let url = page.url();
        for (const frame of frames) {
            const fUrl = frame.url ? frame.url() : '';
            const p = await Promise.race([
                frame.evaluate(() => {
                    const txt = document.body?.innerText || '';
                    return {
                        form: !!document.querySelector('input[type="password"]'),
                        sesion: /máximo de sesiones|Se ha superado|maximum.*session/i.test(txt),
                        dash: txt.includes('COMFICA') || txt.includes('ZENER') || txt.includes('Consola de despacho') || txt.includes('Dispatch') || (txt.includes('Consola') && txt.includes('despacho')),
                        err: /credenciales|contraseña incorrecta|invalid.*credential/i.test(txt),
                        txt: txt.substring(0, 120).replace(/\n+/g,' '),
                        title: document.title || '',
                        href: window.location.href
                    };
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('FRAME_EVAL_TIMEOUT')), 8000))
            ]).catch((err) => {
                if (err.message !== 'FRAME_EVAL_TIMEOUT') {
                    // console.error(`Error evaluando frame ${fUrl}:`, err.message);
                }
                return null;
            });
            if (!p) continue;
            tieneFormLogin = tieneFormLogin || p.form;
            tieneSesionMax = tieneSesionMax || p.sesion;
            tieneDashboard = tieneDashboard || p.dash;
            tieneErrorCred = tieneErrorCred || p.err;
            if (!resumen && p.txt) resumen = p.txt;
            if (!titulo && p.title) titulo = p.title;
            if (p.href) url = p.href;
        }
        return { tieneFormLogin, tieneSesionMax, tieneDashboard, tieneErrorCred, tieneCsrf: !!csrfXHR, url, titulo, resumen };
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
    let lastStatusLog = Date.now();

    reportar('🤖 Agente reactivo iniciado — observando pantalla...');

    while (Date.now() - loopStart < 180000) {
        // Si CDP capturó CSRF, verificar que REALMENTE estemos en el dashboard
        // (TOA envía CSRF en headers incluso en la página de login)
        if (csrfXHR) {
            const pCheck = await leerPantalla();
            if (pCheck.tieneDashboard) {
                reportar('✅ CSRF capturado vía CDP + dashboard confirmado');
                estado = 'DASHBOARD';
                break;
            }
            // CSRF capturado pero aún en login — seguir esperando
        }

        await new Promise(r => setTimeout(r, 2500));

        const p = await leerPantalla();
        const estadoActual = p.tieneDashboard              ? 'DASHBOARD'
                           : p.tieneSesionMax                ? 'SESION_MAX'
                           : p.tieneErrorCred                ? 'ERROR_CRED'
                           : p.tieneFormLogin                ? 'LOGIN_FORM'
                           : 'CARGANDO';

        if (estadoActual !== estado) {
            reportar(`   [pantalla] ${estado} → ${estadoActual} | ${(p.titulo || '').substring(0, 30)} | ${(p.resumen || '').substring(0, 50)}`);
            estado = estadoActual;
            lastStatusLog = Date.now();
        } else if (Date.now() - lastStatusLog > 20000) {
            // Loguear estado actual cada 20s si no cambia
            reportar(`   ... sigo en ${estadoActual} | ${(p.titulo || '').substring(0, 30)}`);
            lastStatusLog = Date.now();
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
            reportar(`   → Sesiones máximas (intento ${intentosSuprimir}/8) — marcando checkbox...`);
            const frameSesionMax = await encontrarFrameLogin();

            // Paso 1: Marcar checkbox
            let cbOk = false;
            const cbPoint = await buscarPuntoVisible(frameSesionMax, ['input[type="checkbox"]']);
            if (cbPoint) {
                const p = await convertirCoordsAPage(frameSesionMax, cbPoint.x, cbPoint.y);
                if (p) {
                    await page.mouse.click(p.x, p.y).catch(() => {});
                    cbOk = true;
                    reportar(`   → ✅ click físico checkbox (${Math.round(p.x)}, ${Math.round(p.y)})`);
                }
            }

            if (!cbOk) {
                const cbForced = await frameSesionMax.evaluate(() => {
                    const cb = document.querySelector('input[type="checkbox"]');
                    if (!cb) return false;
                    cb.checked = true;
                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                    cb.dispatchEvent(new Event('click', { bubbles: true }));
                    return true;
                }).catch(() => false);
                if (cbForced) reportar('   → Forzado checkbox via JS en frame');
            }

            // Paso 2: Re-llenar contraseña
            await llenar(frameSesionMax, [
                'input#password','input[name="password"]','input[name="passwd"]','input[id*="pass" i]','input[type="password"]'
            ], clave);

            // Paso 3: Enviar formulario
            const btnSesion = await buscarPuntoVisible(frameSesionMax, [
                'button[type="submit"]','input[type="submit"]','button[name*="login" i]','button[id*="login" i]','button','input[type="button"]'
            ]);
            if (btnSesion) {
                const p = await convertirCoordsAPage(frameSesionMax, btnSesion.x, btnSesion.y);
                if (p) {
                    await page.mouse.click(p.x, p.y).catch(() => {});
                    reportar(`   → ✅ submit físico (${Math.round(p.x)}, ${Math.round(p.y)})`);
                } else {
                    await page.bringToFront().catch(() => {});
                    await page.keyboard.press('Enter').catch(() => {});
                    reportar('   → Submit por Enter');
                }
            } else {
                await page.bringToFront().catch(() => {});
                await page.keyboard.press('Enter').catch(() => {});
                reportar('   → Submit por Enter (sin botón visible)');
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

    // ── VERIFICACIÓN POST-LOGIN: asegurar que estamos en el dashboard ─────
    const postLogin = await leerPantalla();
    if (postLogin.tieneFormLogin && !postLogin.tieneDashboard) {
        reportar('❌ Login NO completado — aún en página de login');
        reportar(`   URL: ${postLogin.url}`);
        reportar(`   Resumen: ${postLogin.resumen}`);
        throw new Error('LOGIN_FAILED: No se pudo acceder al dashboard de TOA después de múltiples intentos');
    }

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
    reportar(`🔑 CSRF-CDP: ${csrfXHR ? '✅ '+clipText(csrfXHR,25)+'...' : '❌'}`);
    reportar(`🔑 CSRF-JS:  ${pageData.csrfJS ? '✅ '+clipText(pageData.csrfJS,25)+'...' : '❌'}`);
    reportar(`   Headers XHR: ${JSON.stringify(pageData.allHdrKeys)}`);
    reportar(`   Header vals: ${clipText(JSON.stringify(pageData.allHdrVals),300)}`);
    reportar(`   GIDs capturados: [${[...new Set([...pageData.gidsJS, ...(gruposXHR.size?[...gruposXHR.keys()]:[])])].join(', ')}]`);

    // Cookies
    const cookies = await page.cookies().catch(()=>[]);
    const cookiesInfo = (Array.isArray(cookies) ? cookies : []).map(c => `${toText(c?.name)}=${clipText(c?.value,12)}`).join(' | ');
    reportar(`   Cookies: ${cookiesInfo}`);
    // Solo buscar cookies que realmente sean CSRF (no confundir con X_OFS_LP que es load balancer)
    const csrfFromCookie = (Array.isArray(cookies) ? cookies : []).find(c => /csrf/i.test(toText(c?.name)));

    if (pageData.gridUrlJS) gridUrl = pageData.gridUrlJS;

    pageData.gidsJS.forEach(gid => {
        if (!gruposXHR.has(gid)) {
            gruposXHR.set(gid, { id: gid, nombre: `Grupo_${gid}`, nivel: 0, padre: null });
        }
    });

    // ── GRUPOS DE PRODUCCIÓN (fijos) ─────────────────────────────────────────
    // Con Option A (intercepción pura) NO necesitamos gids ni explorar sidebar.
    // Solo clickeamos el NOMBRE del grupo en el sidebar durante la extracción.
    // Esto evita que el bot baje hasta "Torre de Control" u otros grupos vacíos.
    const csrfFinal = csrfCombinado || (csrfFromCookie ? csrfFromCookie.value : '') || '';

    reportar(`\n📊 Login OK — ${GRUPOS_PRODUCCION.length} grupos de producción configurados`);
    GRUPOS_PRODUCCION.forEach(g => reportar(`   📁 ${g.nombre}`));

    return { browser, page, grupos: GRUPOS_PRODUCCION, csrfToken: csrfFinal, gridUrl,
             csrfHeaderName, _screenshotInterval };
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
            reportar && reportar(`   ⚠️ gid=${gid} ${fechaISO} [${res.method||'?'}]: ${res.error}${res.raw?' | '+clipText(res.raw,100):''}`);
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
// =============================================================================
// GUARDAR ACTIVIDADES EN MONGODB
// =============================================================================

// Sanitiza claves para MongoDB: reemplaza puntos y $ que no están permitidos en field names
const sanitizarClave = (k) => String(k)
    .replace(/\./g, '_')          // puntos → guion bajo
    .replace(/^\$/, '_')          // $ al inicio → guion bajo
    .replace(/\s+/g, '_')         // espacios → guion bajo
    .replace(/_+/g, '_')          // múltiples guiones bajos → uno
    .replace(/^_+|_+$/g, '')      // trim guiones bajos extremos
    || 'campo_sin_nombre';

// =============================================================================
// PARSER XML — Productos_y_Servicios_Contratados
// Extrae columnas derivadas: equipos, velocidad, plan TV, telefonía, etc.
// =============================================================================
function parsearProductosServicios(xmlStr) {
    if (!xmlStr || typeof xmlStr !== 'string' || !xmlStr.includes('<ProductService>')) return null;

    const productos = [];
    const regex = /<ProductService>([\s\S]*?)<\/ProductService>/g;
    let match;
    while ((match = regex.exec(xmlStr)) !== null) {
        const bloque = match[1];
        const get = (tag) => {
            const m = bloque.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
            return m ? m[1].trim().replace(/_+$/g, '') : '';
        };
        productos.push({
            codigo: get('Codigo'),
            descripcion: get('Descripcion'),
            familia: get('Familia'),
            operacion: get('OperacionComercial'),
            cantidad: parseInt(get('Cantidad')) || 1
        });
    }

    if (!productos.length) return null;

    // --- Derivar columnas ---
    const altas = productos.filter(p => p.operacion === 'ALTA');
    const bajas = productos.filter(p => p.operacion === 'BAJA');

    // Velocidad Internet: familia FIB con ALTA
    const fibAlta = altas.find(p => p.familia === 'FIB');
    const velocidadMatch = fibAlta ? fibAlta.descripcion.match(/(\d+\/\d+)/) : null;
    const velocidadInternet = velocidadMatch ? velocidadMatch[1] : (fibAlta ? fibAlta.descripcion : '');

    // Plan TV: familia IPTV con ALTA
    const tvAlta = altas.find(p => p.familia === 'IPTV');
    const planTV = tvAlta ? tvAlta.descripcion : '';

    // Telefonía: familia TOIP con ALTA
    const toipAlta = altas.find(p => p.familia === 'TOIP');
    const telefonia = toipAlta ? toipAlta.descripcion : '';

    // Equipos (familia EQ)
    const equipos = altas.filter(p => p.familia === 'EQ' || /EQUIPO|DECO|MODEM|ROUTER|EXTENSOR|EXTENDER|IPTV|DTA|STB|MESH|WIFI|PUNTO.ACCESO/i.test(p.descripcion));
    
    // Categorización de equipos
    const getEquipos = (reg) => equipos.filter(p => reg.test(p.descripcion));
    const decosTodos = getEquipos(/adicional|deco|iptv|dta|stb|receptor|box|streming|android|smart.tv|4k/i);
    const decosCable = decosTodos.filter(p => !/wifi|smart|inalam|wireless|dual|ac|ax|802\.11|mesh/i.test(p.descripcion));
    const decosWifi = decosTodos.filter(p => /wifi|smart|inalam|wireless|dual|ac|ax|802\.11|mesh/i.test(p.descripcion));
    
    const repetidores = getEquipos(/repetidor|extensor|extender|wifi|mesh|punto.acceso|access.point|amplificador|modul.wifi|repro.senal/i).filter(p => !/deco|iptv|stb|receptor|box/i.test(p.descripcion));
    const telefonos = getEquipos(/teléfono|telefono|phone/i);
    const modemArr = equipos.filter(p => /modem|módem|ont|hgu|router|gateway/i.test(p.descripcion));
    const modem = modemArr.length > 0 ? modemArr[0] : null;

    let ctCable = decosCable.reduce((s, p) => s + p.cantidad, 0);
    let ctWifi = decosWifi.reduce((s, p) => s + p.cantidad, 0);
    let ctRepetidores = repetidores.reduce((s, p) => s + p.cantidad, 0);
    let ctTelefonos = telefonos.reduce((s, p) => s + p.cantidad, 0);

    // Tipo de operación
    let tipoOperacion = 'Alta nueva';
    if (bajas.length > 0 && altas.length > 0) tipoOperacion = 'Cambio/Migración';
    else if (bajas.length > 0 && altas.length === 0) tipoOperacion = 'Baja';

    // LÓGICA DE EQUIPO BASE INCLUIDO
    let tieneDecoPrincipal = decosTodos.some(p => /principal/i.test(p.descripcion)) || modem?.descripcion?.toLowerCase().includes('hgu');
    const totalEquiposBaseYExtras = ctCable + ctWifi + ctRepetidores;

    if ((tipoOperacion === 'Alta nueva' || tipoOperacion === 'Cambio/Migración') && totalEquiposBaseYExtras > 0) {
        if (tieneDecoPrincipal) {
            if (decosCable.some(p => /principal/i.test(p.descripcion)) && ctCable > 0) ctCable--;
            else if (decosWifi.some(p => /principal/i.test(p.descripcion)) && ctWifi > 0) ctWifi--;
            else if (ctCable > 0) ctCable--; 
            else if (ctWifi > 0) ctWifi--;
        } else {
            if (ctCable > 0) ctCable--;
            else if (ctWifi > 0) ctWifi--;
            else if (ctRepetidores > 0) ctRepetidores--;
        }
    }

    if (tipoOperacion === 'Alta nueva' && ctTelefonos > 0) {
        ctTelefonos--;
    }

    // Lista de todos los equipos (texto legible)
    const listaEquipos = equipos.map(p => `${p.descripcion}${p.cantidad > 1 ? ` (x${p.cantidad})` : ''}`).join(' | ');

    return {
        'Velocidad_Internet': velocidadInternet,
        'Plan_TV': planTV,
        'Telefonia': telefonia,
        'Modem': modem ? modem.descripcion : '',
        'Deco_Principal': (tieneDecoPrincipal || (tipoOperacion === 'Alta nueva' && totalEquiposBaseYExtras > 0)) ? 'Sí' : 'No',
        'Decos_Cable_Adicionales': String(Math.max(0, ctCable)),
        'Decos_WiFi_Adicionales': String(Math.max(0, ctWifi)),
        'Decos_Adicionales': String(Math.max(0, ctCable + ctWifi)),
        'Repetidores_WiFi': String(Math.max(0, ctRepetidores)),
        'Telefonos': String(Math.max(0, ctTelefonos)),
        'Total_Equipos_Extras': String(Math.max(0, ctCable + ctWifi + ctRepetidores + ctTelefonos)),
        'Tipo_Operacion': tipoOperacion,
        'Equipos_Detalle': listaEquipos,
        'Total_Productos': String(productos.length)
    };
}

async function guardarActividades(rows, empresa, fecha, bucketId, empresaRef) {
    const ops = rows.map(row => {
        // ordenId: buscar en múltiples campos posibles (CSV, XHR, DOM)
        const ordenId = row['Número de Petición'] || row['Numero de Petición']
            || row['Numero orden'] || row.appt_number || row.key || row['144']
            || `${empresa}_${fecha}_${Math.random().toString(36).slice(2)}`;

        const doc = {
            ordenId, empresa, bucket: empresa, bucketId,
            fecha: new Date(fecha + 'T00:00:00Z'),
            'Estado':               row['Estado'] || row['ESTADO'] || row['status'] || row['Activity Status'] || '',
            'Técnico':              row['Técnico']    || row['Tecnico']    || row.pname || '',
            'ID Recurso':           row['ID Recurso'] || row['ID_Recurso'] || row['ID_RECURSO'] || '',
            'Ventana de servicio':  row['Ventana de servicio']  || row.service_window  || '',
            'Ventana de Llegada':   row['Ventana de Llegada']   || row.delivery_window || '',
            'Número de Petición':   row['Número de Petición']   || row['Numero de Petición'] || row.appt_number || '',
            'Numero orden':         row['Numero orden']         || '',
            'Send day before confirmation alert': row['Send day before confirmation alert'] || '',
            'Direccion Polar X':    row['Direccion Polar X']    || '',
            'Direccion Polar Y':    row['Direccion Polar Y']    || '',
            'Puntos Valor Actividad': row['Puntos Valor Actividad'] || '',
            'Número':               row['Número']               || row['Numero'] || '',
            'Agencia':              row['Agencia']              || '',
            'Comuna':               row['Comuna']               || '',
            'Direccion':            row['Direccion']            || '',
            'Intervalo de tiempo':  row['Intervalo de tiempo']  || '',
            'Ciudad':               row['Ciudad']               || row.ccity || '',
            latitud:                row['Direccion Polar Y']    || (row.acoord_y ? String(row.acoord_y) : '') || '',
            longitud:               row['Direccion Polar X']    || (row.acoord_x ? String(row.acoord_x) : '') || '',
            fuenteDatos:            'CSV',
            ultimaActualizacion:    new Date(),
            ...(empresaRef ? { empresaRef } : {})
        };

        // Normalizar Estado (sentence case para coincidir con filtros de server.js)
        if (doc['Estado']) {
            const e = String(doc['Estado']).toLowerCase().trim();
            if (e.includes('complet')) doc['Estado'] = 'Completado';
            else if (e.includes('pendien')) doc['Estado'] = 'Pendiente';
            else if (e.includes('cancel')) doc['Estado'] = 'Cancelado';
            else if (e.includes('iniciad')) doc['Estado'] = 'Iniciado';
        }

        // Copiar TODOS los campos del CSV, sanitizando nombres de campo
        for (const [k, v] of Object.entries(row)) {
            const safeKey = sanitizarClave(k);
            if (v && String(v).length > 0 && !doc[safeKey]) {
                doc[safeKey] = String(v);
            }
        }

        // ── Parsear Productos_y_Servicios_Contratados (XML embebido) ──
        const xmlField = row['Productos_y_Servicios_Contratados']
            || row['Productos y Servicios Contratados']
            || doc['Productos_y_Servicios_Contratados']
            || '';
        const derivados = parsearProductosServicios(xmlField);
        if (derivados) {
            Object.assign(doc, derivados);
        }

        return { updateOne: { filter: { ordenId }, update: { $set: doc }, upsert: true } };
    }).filter(op => String(op.updateOne.filter.ordenId).length > 2);

    if (!ops.length) return 0;
    const r = await Actividad.bulkWrite(ops, { ordered: false });
    const guardados = (r.upsertedCount||0) + (r.modifiedCount||0);

    // ── Baremización post-guardado: calcular puntos LPU ──
    // Se hace después del bulkWrite para tener los datos ya en la BD
    if (empresaRef && guardados > 0) {
        try {
            const TarifaLPU = require('../models/TarifaLPU');
            const tarifas = await TarifaLPU.find({ empresaRef, activo: true }).lean();
            if (tarifas.length > 0) {
                const ordenIds = ops.map(op => op.updateOne.filter.ordenId);
                const docs = await Actividad.find({ ordenId: { $in: ordenIds } }).lean();
                const baremOps = [];
                for (const doc of docs) {
                    // Solo saltar si ya tiene baremos calculados (> 0)
                    if (doc.Pts_Total_Baremo && doc.Pts_Total_Baremo !== '0') continue; 
                    const baremos = calcularBaremosBot(doc, tarifas);
                    if (baremos && baremos.Pts_Total_Baremo !== '0') {
                        baremOps.push({ updateOne: { filter: { _id: doc._id }, update: { $set: baremos } } });
                    }
                }
                if (baremOps.length > 0) {
                    await Actividad.bulkWrite(baremOps, { ordered: false });
                }
            }
        } catch (e) { /* Baremización es best-effort, no falla la descarga */ }
    }

    return guardados;
}

// Motor de baremización para el bot (misma lógica que server.js)
function calcularBaremosBot(doc, tarifas) {
    const tipoTrabajo = doc.Tipo_Trabajo || '';
    const subtipo = doc.Subtipo_de_Actividad || '';
    const reutDrop = (doc['Reutilización_de_Drop'] || doc['Reutilizacion_de_Drop'] || '').toUpperCase();
    const decosAd = parseInt(doc.Decos_Adicionales) || 0;
    const decosCableAd = parseInt(doc.Decos_Cable_Adicionales) || 0;
    const decosWifiAd = parseInt(doc.Decos_WiFi_Adicionales) || 0;
    const repetidores = parseInt(doc.Repetidores_WiFi) || 0;
    const telefonos = parseInt(doc.Telefonos) || 0;

    const tarifasBase = tarifas.filter(t => !t.mapeo?.es_equipo_adicional);
    const tarifasEquipos = tarifas.filter(t => t.mapeo?.es_equipo_adicional);

    let mejorMatch = null, mejorScore = -1;
    for (const t of tarifasBase) {
        let score = 0;
        const m = t.mapeo || {};
        if (m.tipo_trabajo_pattern) {
            const patterns = m.tipo_trabajo_pattern.split('|');
            const matched = patterns.some(p => {
                if (p === tipoTrabajo) return true;
                try { return new RegExp('^' + p + '$').test(tipoTrabajo); } catch (_) { return false; }
            });
            if (matched) score += 10; else continue;
        }
        if (m.subtipo_actividad) {
            if (subtipo.startsWith(m.subtipo_actividad) || subtipo === m.subtipo_actividad) score += 5;
            else if (m.tipo_trabajo_pattern) { } else continue;
        }
        if (m.requiere_reutilizacion_drop) {
            if (m.requiere_reutilizacion_drop === reutDrop) score += 3; else score -= 2;
        }
        if (m.familia_producto) {
            const famCheck = { 'TOIP': doc.Telefonia, 'IPTV': doc.Plan_TV, 'FIB': doc.Velocidad_Internet };
            if (famCheck[m.familia_producto]) score += 2;
        }
        
        // Match estricto por condicion_extra
        if (m.condicion_extra) {
            const cond = m.condicion_extra.trim();
            let matchExp = false;
            if (cond.includes('=')) {
                const [key, val] = cond.split('=');
                const docVal = String(doc[key.trim()] || '').toLowerCase();
                if (docVal.includes(val.trim().toLowerCase())) matchExp = true;
            } else {
                const docStr = JSON.stringify(doc).toLowerCase();
                if (docStr.includes(cond.toLowerCase())) matchExp = true;
            }

            if (matchExp) {
                score += 15;
            } else {
                continue; // DESCARTA LA TARIFA SI NO SE CUMPLE
            }
        }

        if (score > mejorScore) { mejorScore = score; mejorMatch = t; }
    }

    const ptsBase = mejorMatch ? mejorMatch.puntos : 0;
    const decosEfectivos = (decosCableAd > 0 || decosWifiAd > 0) ? (decosCableAd + decosWifiAd) : decosAd;
    const tarifaDecoWifi = tarifasEquipos
        .filter(t => ['Decos_WiFi_Adicionales', 'Decos_Adicionales', 'Decos_Cable_Adicionales'].includes(t.mapeo?.campo_cantidad || ''))
        .sort((a, b) => a.puntos - b.puntos)[0];

    let ptsDecoCable = 0, ptsDecoWifi = 0, ptsRepetidor = 0, ptsTelefono = 0;
    if (tarifaDecoWifi && decosEfectivos > 0) {
        ptsDecoWifi = tarifaDecoWifi.puntos * decosEfectivos;
    }

    for (const t of tarifasEquipos) {
        const campo = t.mapeo?.campo_cantidad || '';
        if (campo === 'Repetidores_WiFi' && repetidores > 0 && !ptsRepetidor) ptsRepetidor = t.puntos * repetidores;
        else if (campo === 'Telefonos' && telefonos > 0 && !ptsTelefono) ptsTelefono = t.puntos * telefonos;
    }

    const ptsTotal = ptsBase + ptsDecoCable + ptsDecoWifi + ptsRepetidor + ptsTelefono;

    return {
        'Pts_Actividad_Base': String(ptsBase),
        'Codigo_LPU_Base': mejorMatch ? mejorMatch.codigo : '',
        'Desc_LPU_Base': mejorMatch ? mejorMatch.descripcion : '',
        'Pts_Deco_Cable': String(ptsDecoCable),
        'Pts_Deco_WiFi': String(ptsDecoWifi),
        'Pts_Deco_Adicional': String(ptsDecoCable + ptsDecoWifi), // Legacy sum support
        'Pts_Repetidor_WiFi': String(ptsRepetidor),
        'Pts_Telefono': String(ptsTelefono),
        'Pts_Total_Baremo': String(ptsTotal)
    };
}

// =============================================================================
// EXPORTS
// =============================================================================
module.exports = { iniciarExtraccion };

if (require.main === module) {
    const cred = {
        url: process.env.BOT_TOA_URL || '',
        usuario: process.env.BOT_TOA_USER || '',
        clave: process.env.BOT_TOA_PASS || ''
    };
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!mongoUri) {
        const msg = '❌ MONGODB_URI/MONGO_URI no configurado en proceso hijo';
        if (process.send) process.send({ type: 'log', text: msg });
        console.error(msg);
        process.exit(1);
    }

    if (process.send) process.send({ type: 'log', text: '🚀 Proceso hijo iniciado: conectando MongoDB...' });

    mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 })
        .then(() => {
            if (process.send) process.send({ type: 'log', text: '✅ MongoDB child OK' });
            return iniciarExtraccion(process.env.BOT_FECHA_INICIO || null, process.env.BOT_FECHA_FIN || null, cred);
        })
        .catch(err => {
            const msg = `❌ MongoDB child error: ${err.message}`;
            if (process.send) process.send({ type: 'log', text: msg });
            console.error(msg);
            process.exit(1);
        });
}

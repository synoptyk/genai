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
            const session = await iniciarSesionChrome(credenciales, reportar, usarBrowserless);
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
                    reportar('   → ✅ Checkbox marcado');
                } else if (cbCoords?.checked) {
                    reportar('   → ✅ Checkbox ya estaba marcado');
                } else {
                    reportar('   → ⚠️ Checkbox no encontrado, buscando cualquier checkbox visible...');
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
                    }
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
                await new Promise(r => setTimeout(r, 8000));

                // Verificar datos cargados
                const dataCargada = await page.evaluate(() => {
                    const txt = document.body.innerText || '';
                    const sinDatos = /no hay elementos|no items|no data/i.test(txt);
                    const tieneAcciones = /acciones/i.test(txt);
                    return { sinDatos, tieneAcciones };
                }).catch(() => ({ sinDatos: true, tieneAcciones: false }));

                if (dataCargada.tieneAcciones && !dataCargada.sinDatos) {
                    reportar('   → ✅ Datos cargados — "Acciones" visible');
                } else if (dataCargada.sinDatos) {
                    reportar('   → ⚠️ Tabla vacía tras Aplicar — esperando 8s más...');
                    await new Promise(r => setTimeout(r, 8000));
                } else {
                    reportar('   → ✅ Filtros aplicados');
                }
            };

            // ══════════════════════════════════════════════════════════════════
            // ESTRATEGIA: CHILE → Filtros → Vista Lista → Fecha → Exportar CSV
            // ══════════════════════════════════════════════════════════════════

            // ── 1. Click en CHILE en el sidebar ─────────────────────────────
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

            // ── 2. Click "Vista de lista" (≡ tres líneas) — PRIMERO ─────────
            // ORDEN CRÍTICO: Primero activar Vista de Lista, LUEGO abrir Filtros via "Vista ▼"
            reportar('\n📋 PASO 2: Activando Vista de lista (≡)...');
            try {
                const vlCoords = await page.evaluate(() => {
                    const all = [...document.querySelectorAll('*')];
                    for (const el of all) {
                        const title = (el.getAttribute('title') || '').toLowerCase();
                        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                        if (/vista de lista|list view/i.test(title + ' ' + aria)) {
                            const r = el.getBoundingClientRect();
                            if (r.width > 0 && r.height > 0 && r.y < 300)
                                return { x: r.left + r.width/2, y: r.top + r.height/2, src: title || aria };
                        }
                    }
                    return null;
                }).catch(() => null);
                if (vlCoords) {
                    reportar(`   🖱️ Vista de lista en (${Math.round(vlCoords.x)}, ${Math.round(vlCoords.y)}) [${vlCoords.src}]`);
                    await page.mouse.click(vlCoords.x, vlCoords.y).catch(() => {});
                    await new Promise(r => setTimeout(r, 3000));
                    reportar('   ✅ Vista de lista activada');
                } else {
                    reportar('   ⚠️ Botón Vista de lista no encontrado — continuando');
                }
            } catch (e) {
                reportar(`   ⚠️ Error Vista de lista: ${e.message}`);
            }

            // ── 3. Click "Vista ▼" → Filtros → "Todos los datos de hijos" → Aplicar ──
            reportar('\n📋 PASO 3: Aplicar filtros "Todos los datos de hijos" via menú Vista...');
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
            const esperarDescarga = async (dir, timeoutMs = 30000) => {
                const inicio = Date.now();
                while (Date.now() - inicio < timeoutMs) {
                    const files = fs.readdirSync(dir).filter(f => !f.endsWith('.crdownload') && !f.startsWith('.'));
                    if (files.length > 0) return path.join(dir, files[0]);
                    await new Promise(r => setTimeout(r, 500));
                }
                return null;
            };

            // ── Helper: click en Acciones → Exportar ────────────────────────
            const clickExportar = async () => {
                // 1. Click en "Acciones"
                reportar('   → Click en "Acciones"...');
                const accionesCoords = await page.evaluate(() => {
                    const all = [...document.querySelectorAll('*')];
                    for (const el of all) {
                        const txt = (el.textContent || '').trim();
                        if (/^Acciones$/i.test(txt) || /^Actions$/i.test(txt)) {
                            const r = el.getBoundingClientRect();
                            if (r.width > 0 && r.height > 0 && r.y < 250 && r.x > 500) {
                                return { x: r.left + r.width/2, y: r.top + r.height/2, txt };
                            }
                        }
                    }
                    return null;
                }).catch(() => null);

                if (!accionesCoords) {
                    reportar('   → ⚠️ Botón "Acciones" no encontrado');
                    return false;
                }
                await page.mouse.click(accionesCoords.x, accionesCoords.y).catch(() => {});
                reportar(`   → 🖱️ Click Acciones en (${Math.round(accionesCoords.x)}, ${Math.round(accionesCoords.y)})`);
                await new Promise(r => setTimeout(r, 1500));

                // 2. Click en "Exportar" del menú desplegable
                reportar('   → Click en "Exportar"...');
                const exportarCoords = await page.evaluate(() => {
                    const all = [...document.querySelectorAll('*')];
                    for (const el of all) {
                        const txt = (el.textContent || '').trim();
                        if (/^Exportar$/i.test(txt) || /^Export$/i.test(txt)) {
                            const r = el.getBoundingClientRect();
                            if (r.width > 0 && r.height > 0 && r.y > 150) {
                                return { x: r.left + r.width/2, y: r.top + r.height/2, txt };
                            }
                        }
                    }
                    return null;
                }).catch(() => null);

                if (!exportarCoords) {
                    reportar('   → ⚠️ Opción "Exportar" no encontrada en menú');
                    // Cerrar menú haciendo click en otro lugar
                    await page.mouse.click(400, 400).catch(() => {});
                    return false;
                }
                await page.mouse.click(exportarCoords.x, exportarCoords.y).catch(() => {});
                reportar(`   → 🖱️ Click Exportar en (${Math.round(exportarCoords.x)}, ${Math.round(exportarCoords.y)})`);
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
                    for (const el of [...document.querySelectorAll('td, a, span, div, [role="gridcell"]')]) {
                        if ((el.textContent || '').trim() === String(dia)) {
                            const r = el.getBoundingClientRect();
                            if (r.width > 0 && r.y > 200 && r.y < 600 && r.x > 400)
                                candidates.push({ x: r.left + r.width/2, y: r.top + r.height/2, area: r.width * r.height });
                        }
                    }
                    if (!candidates.length) return null;
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

                // 4a. Verificar si la fecha ya tiene datos en MongoDB → saltar
                try {
                    const yaExiste = await Actividad.countDocuments({
                        empresa: 'CHILE',
                        fecha: new Date(fecha + 'T00:00:00Z')
                    });
                    if (yaExiste > 0) {
                        reportar(`   → ⏭️ ${fecha} ya tiene ${yaExiste} registros en MongoDB — saltando`);
                        if (process.send) process.send({
                            type: 'progress',
                            grupoProcesando: 'CHILE',
                            diaActual: fi + 1,
                            totalDias: fechasAProcesar.length,
                            fechaProcesando: fecha,
                            saltado: true
                        });
                        continue;
                    }
                } catch(e) {
                    reportar(`   → ⚠️ No pude verificar existencia en MongoDB: ${e.message}`);
                }

                // 4b. Navegar a la fecha
                let fechaActual = await leerFechaTOA();
                const fechaFmt = fecha.replace(/-/g, '/');
                if (!fechaActual || !fechaActual.includes(fechaFmt)) {
                    const navOk = await navegarFechaCalendario(fecha);
                    if (!navOk) {
                        reportar(`   → ⚠️ No se pudo navegar a ${fecha}, saltando...`);
                        continue;
                    }
                } else {
                    reportar('   → ✅ Ya estamos en la fecha correcta');
                }
                await new Promise(r => setTimeout(r, 2000)); // esperar que cargue la vista

                // 4b. Limpiar directorio de descarga
                const existingFiles = fs.readdirSync(downloadDir);
                existingFiles.forEach(f => { try { fs.unlinkSync(path.join(downloadDir, f)); } catch(_) {} });

                // 4c. Click en Acciones → Exportar
                const exportOk = await clickExportar();
                if (!exportOk) {
                    reportar(`   → ⚠️ No se pudo exportar para ${fecha}`);
                    continue;
                }

                // 4d. Esperar a que se descargue el archivo
                reportar('   → ⏳ Esperando descarga del CSV...');
                const csvFile = await esperarDescarga(downloadDir, 30000);
                if (!csvFile) {
                    reportar('   → ⚠️ Timeout esperando descarga del CSV');
                    continue;
                }
                reportar(`   → 📄 Archivo descargado: ${path.basename(csvFile)}`);

                // 4e. Leer y parsear el CSV
                let csvContent;
                try {
                    csvContent = fs.readFileSync(csvFile, 'utf-8');
                } catch (e) {
                    // Intentar con latin1 si UTF-8 falla
                    csvContent = fs.readFileSync(csvFile, 'latin1');
                }
                const rows = parsearCSV(csvContent);
                reportar(`   → 📊 ${rows.length} filas parseadas del CSV`);
                if (rows.length > 0) {
                    const campos = Object.keys(rows[0]);
                    reportar(`   → Campos (${campos.length}): ${campos.slice(0, 8).join(', ')}...`);
                }

                // 4f. Guardar en MongoDB
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

                // 4g. Borrar archivo temporal
                try { fs.unlinkSync(csvFile); } catch(_) {}
                reportar(`   → 🗑️ CSV temporal eliminado`);
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
            headless: 'new',
            args: [
                '--no-sandbox', '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', '--disable-gpu',
                '--no-first-run', '--disable-extensions',
                '--disable-background-networking', '--mute-audio',
                '--window-size=1280,800',
                // Flags para reducir uso de RAM en plan Starter (512MB)
                '--single-process',
                '--no-zygote',
                '--disable-features=site-per-process,VizDisplayCompositor,TranslateUI',
                '--renderer-process-limit=1',
                '--js-flags=--max-old-space-size=256',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
            ],
            defaultViewport: { width: 1280, height: 800 },
            timeout: 60000
        });
    }

    const page = await browser.newPage();

    // ── SCREENSHOTS EN VIVO — enviar frame al servidor cada 1.5s ─────────────
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
        // Si CDP capturó CSRF, verificar que REALMENTE estemos en el dashboard
        // (TOA envía CSRF en headers incluso en la página de login)
        if (csrfXHR) {
            const pCheck = await leerPantalla();
            if (pCheck.tieneDashboard) {
                reportar('✅ CSRF capturado vía CDP + dashboard confirmado');
                break;
            }
            // CSRF capturado pero aún en login — seguir esperando
        }

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
            reportar(`   → Sesiones máximas (intento ${intentosSuprimir}/8) — marcando checkbox...`);

            // Paso 1: Click FÍSICO directo sobre el <input type="checkbox"> via Puppeteer
            // page.click() hace un mouse click REAL en las coordenadas del elemento
            // (NO usar clickTexto que clickea el TEXTO a x=693, NO el cuadrado del checkbox)
            let cbOk = false;
            try {
                await page.click('input[type="checkbox"]');
                cbOk = true;
                reportar('   → ✅ page.click("input[type=checkbox]") — checkbox clickeado');
            } catch (e1) {
                reportar(`   → ⚠️ page.click falló: ${e1.message.substring(0,40)}`);
                // Fallback: buscar coordenadas del checkbox y hacer mouse.click
                const cbCoords = await page.evaluate(() => {
                    const cb = document.querySelector('input[type="checkbox"]');
                    if (!cb) return null;
                    const r = cb.getBoundingClientRect();
                    // Si el checkbox tiene tamaño 0 (oculto), buscar su label/parent
                    if (r.width < 2 || r.height < 2) {
                        const label = cb.closest('label') || cb.parentElement;
                        if (label) { const lr = label.getBoundingClientRect(); return { x: lr.left + 12, y: lr.top + lr.height/2 }; }
                    }
                    return { x: r.left + r.width/2, y: r.top + r.height/2 };
                }).catch(() => null);
                if (cbCoords) {
                    await page.mouse.click(cbCoords.x, cbCoords.y);
                    cbOk = true;
                    reportar(`   → ✅ mouse.click(${Math.round(cbCoords.x)},${Math.round(cbCoords.y)}) en checkbox`);
                } else {
                    reportar('   → ❌ No encontré checkbox en la página');
                }
            }
            await new Promise(r2 => setTimeout(r2, 1000));

            // Verificar si quedó marcado
            const checked = await page.evaluate(() => {
                const cb = document.querySelector('input[type="checkbox"]');
                return cb ? cb.checked : false;
            }).catch(() => false);
            reportar(`   → Estado checkbox: ${checked ? '☑️ MARCADO' : '☐ SIN MARCAR'}`);

            // Si no se marcó, intentar JS forzado
            if (!checked) {
                await page.evaluate(() => {
                    const cb = document.querySelector('input[type="checkbox"]');
                    if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); cb.dispatchEvent(new Event('click', { bubbles: true })); }
                }).catch(() => {});
                reportar('   → Forzado checkbox via JS (cb.checked = true)');
                await new Promise(r2 => setTimeout(r2, 500));
            }

            // Paso 2: Re-llenar la contraseña (TOA la borra al mostrar el diálogo de sesiones)
            reportar('   → Paso 2: re-llenando contraseña...');
            await llenar('input[type="password"]', clave);
            await new Promise(r2 => setTimeout(r2, 300));

            // Paso 3: Click en botón submit "Iniciar"
            reportar('   → Paso 3: click en botón submit del formulario...');
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
                reportar('   ⚠️ No encontré botón — usando hacerLogin() completo');
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
    const equipos = altas.filter(p => p.familia === 'EQ');
    const modem = equipos.find(p => /modem|módem/i.test(p.descripcion));
    const decoPrincipal = equipos.find(p => /principal/i.test(p.descripcion));
    const decosAdicionales = equipos.filter(p => /adicional/i.test(p.descripcion));
    const repetidores = equipos.filter(p => /repetidor|extensor|extenso/i.test(p.descripcion));
    const telefonos = equipos.filter(p => /teléfono|telefono|phone/i.test(p.descripcion));

    const cantDecosAd = decosAdicionales.reduce((s, p) => s + p.cantidad, 0);
    const cantRepetidores = repetidores.reduce((s, p) => s + p.cantidad, 0);
    const cantTelefonos = telefonos.reduce((s, p) => s + p.cantidad, 0);
    const totalEquiposExtras = cantDecosAd + cantRepetidores + cantTelefonos;

    // Tipo de operación
    let tipoOperacion = 'Alta nueva';
    if (bajas.length > 0 && altas.length > 0) tipoOperacion = 'Cambio/Migración';
    else if (bajas.length > 0 && altas.length === 0) tipoOperacion = 'Baja';

    // Lista de todos los equipos (texto legible)
    const listaEquipos = equipos.map(p => `${p.descripcion}${p.cantidad > 1 ? ` (x${p.cantidad})` : ''}`).join(' | ');

    return {
        'Velocidad_Internet': velocidadInternet,
        'Plan_TV': planTV,
        'Telefonia': telefonia,
        'Modem': modem ? modem.descripcion : '',
        'Deco_Principal': decoPrincipal ? 'Sí' : 'No',
        'Decos_Adicionales': String(cantDecosAd),
        'Repetidores_WiFi': String(cantRepetidores),
        'Telefonos': String(cantTelefonos),
        'Total_Equipos_Extras': String(totalEquiposExtras),
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

        // Documento base con campos conocidos (sin puntos en keys)
        const doc = {
            ordenId, empresa, bucket: empresa, bucketId,
            fecha: new Date(fecha + 'T00:00:00Z'),
            'Técnico':              row['Técnico']    || row['Tecnico']    || row.pname || '',
            'ID Recurso':           row['ID Recurso'] || '',
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
                    if (doc.Pts_Total_Baremo) continue; // ya tiene baremos
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
    let ptsDeco = 0, ptsRepetidor = 0, ptsTelefono = 0;
    for (const t of tarifasEquipos) {
        const campo = t.mapeo?.campo_cantidad || '';
        if (campo === 'Decos_Adicionales' && decosAd > 0) ptsDeco = t.puntos * decosAd;
        else if (campo === 'Repetidores_WiFi' && repetidores > 0) ptsRepetidor = t.puntos * repetidores;
        else if (campo === 'Telefonos' && telefonos > 0) ptsTelefono = t.puntos * telefonos;
    }

    return {
        'Pts_Actividad_Base': String(ptsBase),
        'Codigo_LPU_Base': mejorMatch ? mejorMatch.codigo : '',
        'Desc_LPU_Base': mejorMatch ? mejorMatch.descripcion : '',
        'Pts_Deco_Adicional': String(ptsDeco),
        'Pts_Repetidor_WiFi': String(ptsRepetidor),
        'Pts_Telefono': String(ptsTelefono),
        'Pts_Total_Baremo': String(ptsBase + ptsDeco + ptsRepetidor + ptsTelefono)
    };
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

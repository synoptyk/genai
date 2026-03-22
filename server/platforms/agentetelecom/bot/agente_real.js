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
            const aplicarFiltros = async () => {
                reportar('🔧 Abriendo filtros...');

                // Click en icono de filtro (embudo) — buscar coordenadas, click FÍSICO
                const filtroCoords = await page.evaluate(() => {
                    const btns = [...document.querySelectorAll('a, button, [role="button"], oj-button, [class*="oj-button"], span, div')];
                    for (const b of btns) {
                        const t = (b.getAttribute('title') || b.getAttribute('aria-label') || '').toLowerCase();
                        if (/filtro|filter/i.test(t)) {
                            const r = b.getBoundingClientRect();
                            if (r.width > 0 && r.y < 250 && r.y > 50) {
                                return { x: r.left + r.width/2, y: r.top + r.height/2 };
                            }
                        }
                    }
                    return null;
                }).catch(() => null);

                if (filtroCoords) {
                    reportar(`   🖱️ Filtro en (${Math.round(filtroCoords.x)}, ${Math.round(filtroCoords.y)})`);
                    await page.mouse.click(filtroCoords.x, filtroCoords.y);
                } else {
                    reportar('   → Buscando texto "Filtros"...');
                    await clickTexto(/filtros/i);
                }
                await new Promise(r => setTimeout(r, 2000));

                // Marcar checkbox "Todos los datos de hijos" — usar page.click para checkbox
                reportar('   ☑️ Activando "Todos los datos de hijos"...');
                const cbCoords = await page.evaluate(() => {
                    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                    let node;
                    while ((node = walker.nextNode())) {
                        if (/todos los datos/i.test(node.textContent)) {
                            let el = node.parentElement;
                            for (let t = 0; t < 5 && el; t++) {
                                const cb = el.querySelector('input[type="checkbox"]');
                                if (cb) {
                                    const r = cb.getBoundingClientRect();
                                    return { x: r.left + r.width/2, y: r.top + r.height/2, checked: cb.checked };
                                }
                                el = el.parentElement;
                            }
                        }
                    }
                    return null;
                }).catch(() => null);

                if (cbCoords && !cbCoords.checked) {
                    await page.mouse.click(cbCoords.x, cbCoords.y);
                    reportar('   → ✅ Checkbox marcado');
                } else if (cbCoords?.checked) {
                    reportar('   → ✅ Checkbox ya estaba marcado');
                } else {
                    reportar('   → ⚠️ Checkbox no encontrado');
                }
                await new Promise(r => setTimeout(r, 500));

                // Click en botón "Aplicar" — click FÍSICO
                reportar('   → Click en Aplicar...');

                const aplicarCoords = await page.evaluate(() => {
                    // Buscar botón que diga "Aplicar" (puede ser "Aplicar", "APLICAR", etc.)
                    const btns = [...document.querySelectorAll('button, [role="button"], a, oj-button, [class*="oj-button"], span[class*="button"]')];
                    for (const b of btns) {
                        const txt = (b.textContent || '').trim();
                        if (/aplicar/i.test(txt) && txt.length < 20) {
                            const r = b.getBoundingClientRect();
                            if (r.width > 0 && r.height > 0) {
                                return { x: r.left + r.width/2, y: r.top + r.height/2, txt };
                            }
                        }
                    }
                    return null;
                }).catch(() => null);

                if (aplicarCoords) {
                    await page.mouse.click(aplicarCoords.x, aplicarCoords.y).catch(() => {});
                    reportar(`   → 🖱️ Aplicar en (${Math.round(aplicarCoords.x)}, ${Math.round(aplicarCoords.y)}) "${aplicarCoords.txt}"`);
                } else {
                    reportar('   → Aplicar no encontrado por selector, usando clickTexto...');
                    const r = await clickTexto(/aplicar/i);
                    reportar(`   → clickTexto aplicar: ${r.ok ? `OK en (${r.x},${r.y})` : 'NO ENCONTRADO'}`);
                }

                // Esperar a que se cierre el dropdown de filtros
                await new Promise(r => setTimeout(r, 1500));
                reportar('   → ✅ Filtros aplicados');
            };

            // ══════════════════════════════════════════════════════════════════
            // ITERAR POR CADA GRUPO: COMFICA → ZENER RANCAGUA → ZENER RM
            // ══════════════════════════════════════════════════════════════════
            let diasGlobal = 0;
            const totalDiasGlobal = fechasAProcesar.length * gruposSeleccionados.length;

            // DIAGNÓSTICO: solo procesar grupo 1 (COMFICA) para analizar la pantalla
            const maxGruposDiag = 1; // cambiar a gruposSeleccionados.length cuando se reactive
            for (let gi = 0; gi < maxGruposDiag; gi++) {
                const grupo = gruposSeleccionados[gi];
                const grupoNombre = grupo.nombre || grupo;
                reportar(`\n${'═'.repeat(60)}`);
                reportar(`📂 [${gi + 1}/${gruposSeleccionados.length}] ${grupoNombre}`);
                reportar(`${'═'.repeat(60)}`);

                // ── 1. Click en el grupo en el SIDEBAR (zona izquierda) ──────
                try {
                    reportar(`🖱️ Click en "${grupoNombre}" en sidebar...`);
                    const sidebarClick = await clickGrupoSidebar(grupoNombre);
                    if (!sidebarClick.ok) {
                        reportar(`   → Sidebar falló, intentando clickTexto genérico...`);
                        await clickTexto(new RegExp(grupoNombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), { maxX: 500 });
                    }
                    await new Promise(r => setTimeout(r, 3000)); // esperar carga

                    // Verificar que se seleccionó el grupo correcto
                    const headerActual = await page.evaluate(() => {
                        // Leer texto del header de la consola
                        const h = document.querySelector('h1, h2, [class*="header"], [class*="title"]');
                        return (document.body?.innerText || '').substring(0, 300);
                    }).catch(() => '');
                    if (headerActual.includes(grupoNombre)) {
                        reportar(`   ✅ Grupo "${grupoNombre}" confirmado en pantalla`);
                    } else {
                        reportar(`   ⚠️ Header no muestra "${grupoNombre}" — puede estar seleccionado igual`);
                    }
                } catch (e) {
                    reportar(`   ⚠️ Error al seleccionar grupo: ${e.message}`);
                    continue; // saltar a siguiente grupo
                }

                // ── 2. Aplicar Filtros "Todos los datos de hijos" ────────────
                // Se aplican ANTES de cambiar a vista lista para que el Grid
                // ya incluya todos los hijos cuando se active la vista
                try {
                    reportar('   📋 Iniciando aplicarFiltros...');
                    await aplicarFiltros();
                    reportar('   📋 aplicarFiltros completado');
                } catch (e) {
                    reportar(`   ⚠️ Error Filtros: ${e.message} — continuando...`);
                }

                // ── 3. DIAGNÓSTICO: analizar la pantalla SIN hacer click ──────
                let rowsInicial = null;
                try {
                    reportar('🔍 ═══ DIAGNÓSTICO DE PANTALLA ═══');
                    const diagnostico = await page.evaluate(() => {
                        const result = {};

                        // 1. Texto del header/título
                        result.titulo = document.title;
                        result.h1 = [...document.querySelectorAll('h1, h2, h3')].map(h =>
                            h.innerText.trim().substring(0, 80)).filter(Boolean).slice(0, 5);

                        // 2. Todos los elementos con title/aria-label en la zona toolbar (y < 250)
                        result.toolbar = [...document.querySelectorAll('*')]
                            .filter(el => {
                                const t = el.getAttribute('title') || el.getAttribute('aria-label');
                                if (!t) return false;
                                const r = el.getBoundingClientRect();
                                return r.y > 30 && r.y < 250 && r.width > 0;
                            })
                            .map(el => {
                                const r = el.getBoundingClientRect();
                                return {
                                    title: el.getAttribute('title') || el.getAttribute('aria-label'),
                                    tag: el.tagName,
                                    x: Math.round(r.x), y: Math.round(r.y),
                                    w: Math.round(r.width), h: Math.round(r.height)
                                };
                            })
                            .slice(0, 25);

                        // 3. Botones visibles en pantalla
                        result.botones = [...document.querySelectorAll('button, [role="button"], oj-button')]
                            .filter(el => {
                                const r = el.getBoundingClientRect();
                                return r.width > 0 && r.height > 0 && r.y < 800;
                            })
                            .map(el => {
                                const r = el.getBoundingClientRect();
                                return {
                                    text: (el.textContent || '').trim().substring(0, 40),
                                    title: el.getAttribute('title') || '',
                                    x: Math.round(r.x), y: Math.round(r.y),
                                    w: Math.round(r.width), h: Math.round(r.height)
                                };
                            })
                            .slice(0, 30);

                        // 4. Links/anchors visibles
                        result.links = [...document.querySelectorAll('a')]
                            .filter(el => {
                                const r = el.getBoundingClientRect();
                                return r.width > 0 && r.height > 0 && r.y < 800;
                            })
                            .map(el => {
                                const r = el.getBoundingClientRect();
                                return {
                                    text: (el.textContent || '').trim().substring(0, 40),
                                    title: el.getAttribute('title') || '',
                                    x: Math.round(r.x), y: Math.round(r.y)
                                };
                            })
                            .slice(0, 30);

                        // 5. Tablas en la página
                        result.tablas = [...document.querySelectorAll('table')].map(t => {
                            const r = t.getBoundingClientRect();
                            const headers = [...t.querySelectorAll('th')].map(th => th.innerText.trim().substring(0, 30));
                            const rowCount = t.querySelectorAll('tr').length;
                            return { headers, rows: rowCount, x: Math.round(r.x), y: Math.round(r.y),
                                     w: Math.round(r.width), h: Math.round(r.height) };
                        });

                        // 6. Texto visible principal (primeros 800 chars)
                        result.textoVisible = (document.body?.innerText || '').substring(0, 800);

                        // 7. Sidebar items
                        result.sidebar = [...document.querySelectorAll('*')]
                            .filter(el => {
                                const r = el.getBoundingClientRect();
                                return r.x < 400 && r.y > 200 && r.width > 0 && r.height > 10 && r.height < 40;
                            })
                            .map(el => (el.innerText || '').trim())
                            .filter(t => t.length > 2 && t.length < 50)
                            .filter((v, i, a) => a.indexOf(v) === i) // unique
                            .slice(0, 20);

                        // 8. Iconos/imágenes con título
                        result.iconos = [...document.querySelectorAll('img, svg, [class*="icon"]')]
                            .filter(el => {
                                const r = el.getBoundingClientRect();
                                return r.width > 0 && r.y < 300 && r.y > 50;
                            })
                            .map(el => {
                                const r = el.getBoundingClientRect();
                                return {
                                    title: el.getAttribute('title') || el.getAttribute('alt') || el.getAttribute('aria-label') || '',
                                    cls: (el.className || '').toString().substring(0, 60),
                                    x: Math.round(r.x), y: Math.round(r.y),
                                    w: Math.round(r.width), h: Math.round(r.height)
                                };
                            })
                            .filter(i => i.title || i.cls)
                            .slice(0, 20);

                        return result;
                    }).catch(e => ({ error: e.message }));

                    // Reportar todo el diagnóstico
                    reportar(`   📄 Título: ${diagnostico.titulo}`);
                    reportar(`   📄 H1/H2/H3: ${(diagnostico.h1 || []).join(' | ')}`);

                    reportar(`\n   🔧 TOOLBAR (${(diagnostico.toolbar || []).length} elementos con title):`);
                    (diagnostico.toolbar || []).forEach(t => {
                        reportar(`      → [${t.tag}] title="${t.title}" @(${t.x},${t.y}) ${t.w}×${t.h}`);
                    });

                    reportar(`\n   🔘 BOTONES (${(diagnostico.botones || []).length}):`);
                    (diagnostico.botones || []).forEach(b => {
                        reportar(`      → "${b.text}" title="${b.title}" @(${b.x},${b.y}) ${b.w}×${b.h}`);
                    });

                    reportar(`\n   🔗 LINKS (${(diagnostico.links || []).length}):`);
                    (diagnostico.links || []).slice(0, 15).forEach(l => {
                        reportar(`      → "${l.text}" title="${l.title}" @(${l.x},${l.y})`);
                    });

                    if ((diagnostico.tablas || []).length > 0) {
                        reportar(`\n   📊 TABLAS (${diagnostico.tablas.length}):`);
                        diagnostico.tablas.forEach(t => {
                            reportar(`      → ${t.rows} filas, headers=[${t.headers.join(',')}] @(${t.x},${t.y}) ${t.w}×${t.h}`);
                        });
                    } else {
                        reportar(`\n   📊 TABLAS: ninguna encontrada`);
                    }

                    reportar(`\n   🖼️ ICONOS toolbar (${(diagnostico.iconos || []).length}):`);
                    (diagnostico.iconos || []).forEach(i => {
                        reportar(`      → title="${i.title}" cls="${i.cls}" @(${i.x},${i.y}) ${i.w}×${i.h}`);
                    });

                    reportar(`\n   📁 SIDEBAR: ${(diagnostico.sidebar || []).join(' | ')}`);

                    reportar(`\n   📝 TEXTO VISIBLE (primeros 400 chars):`);
                    const textoLineas = (diagnostico.textoVisible || '').split('\n').filter(Boolean).slice(0, 15);
                    textoLineas.forEach(l => reportar(`      ${l.substring(0, 100)}`));

                    reportar('🔍 ═══ FIN DIAGNÓSTICO ═══\n');

                } catch (e) {
                    reportar(`   ⚠️ Error diagnóstico: ${e.message}`);
                }

                // ── 4. CLICK "Vista de lista" (botón del medio del grupo de vistas) ──
                reportar('\n📋 PASO 4: Click en "Vista de lista"...');
                try {
                    // Buscar el botón con title="Vista de lista"
                    const vistaListaCoords = await page.evaluate(() => {
                        // Método 1: buscar por title exacto
                        const all = [...document.querySelectorAll('*')];
                        for (const el of all) {
                            const title = (el.getAttribute('title') || '').toLowerCase();
                            if (/vista de lista/i.test(title)) {
                                const r = el.getBoundingClientRect();
                                if (r.width > 0 && r.height > 0 && r.y < 300) {
                                    return { x: r.left + r.width/2, y: r.top + r.height/2,
                                             src: 'title="' + el.getAttribute('title') + '"',
                                             tag: el.tagName };
                                }
                            }
                        }
                        // Método 2: buscar grupo de view buttons y tomar el del medio
                        // Los view buttons están a la derecha de "Vista" en el toolbar
                        const viewBtns = [];
                        for (const el of all) {
                            const title = el.getAttribute('title') || '';
                            if (!title) continue;
                            const r = el.getBoundingClientRect();
                            if (r.y > 50 && r.y < 250 && r.x > 700 && r.width > 10 && r.width < 80 && r.height > 10 && r.height < 60) {
                                if (/vista|view|time|list|map|calendar|línea|gantt|mapa|calendario/i.test(title)) {
                                    viewBtns.push({ x: r.left + r.width/2, y: r.top + r.height/2,
                                                    title, rx: r.x, tag: el.tagName });
                                }
                            }
                        }
                        if (viewBtns.length >= 3) {
                            viewBtns.sort((a, b) => a.rx - b.rx);
                            // El del medio (index 1 de 3)
                            const mid = viewBtns[Math.floor(viewBtns.length / 2)];
                            return { x: mid.x, y: mid.y, src: 'medio:"' + mid.title + '"', tag: mid.tag };
                        }
                        if (viewBtns.length >= 2) {
                            viewBtns.sort((a, b) => a.rx - b.rx);
                            return { x: viewBtns[1].x, y: viewBtns[1].y, src: 'btn[1]:"' + viewBtns[1].title + '"', tag: viewBtns[1].tag };
                        }
                        return null;
                    }).catch(() => null);

                    if (vistaListaCoords) {
                        reportar(`   → 🖱️ Encontrado: [${vistaListaCoords.tag}] ${vistaListaCoords.src} en (${Math.round(vistaListaCoords.x)}, ${Math.round(vistaListaCoords.y)})`);
                        await page.mouse.click(vistaListaCoords.x, vistaListaCoords.y).catch(() => {});
                        reportar('   → ⏳ Esperando 4s para que cargue la vista de lista...');
                        await new Promise(r => setTimeout(r, 4000));
                    } else {
                        reportar('   → ⚠️ Botón "Vista de lista" NO encontrado');
                    }
                } catch (e) {
                    reportar(`   → ⚠️ Error: ${e.message}`);
                }

                // ── 5. DIAGNÓSTICO POST-VISTA LISTA: qué se ve ahora ────────
                reportar('\n🔍 ═══ DIAGNÓSTICO POST-VISTA LISTA ═══');
                try {
                    const postDiag = await page.evaluate(() => {
                        const result = {};

                        // Headers de tabla (columnas visibles)
                        result.tableHeaders = [...document.querySelectorAll('th, [role="columnheader"]')]
                            .map(th => {
                                const r = th.getBoundingClientRect();
                                return { text: th.innerText.trim().substring(0, 40), x: Math.round(r.x), y: Math.round(r.y) };
                            })
                            .filter(h => h.text);

                        // Filas de la tabla
                        result.tableRows = [...document.querySelectorAll('tr, [role="row"]')]
                            .slice(0, 15) // primeras 15 filas
                            .map(tr => {
                                const cells = [...tr.querySelectorAll('td, [role="cell"], [role="gridcell"]')];
                                return cells.map(c => c.innerText.trim().substring(0, 30)).filter(Boolean);
                            })
                            .filter(r => r.length > 0);

                        // Texto completo visible
                        result.textoVisible = (document.body?.innerText || '').substring(0, 1200);

                        // Verificar si hay columnas tipo "Actividad", "Recurso", etc.
                        const bodyText = document.body?.innerText || '';
                        result.tieneColumnas = {
                            actividad: /Actividad/i.test(bodyText),
                            recurso: /Recurso/i.test(bodyText),
                            ventanaServicio: /Ventana de servicio/i.test(bodyText),
                            numeroPeticion: /Número de Petición/i.test(bodyText),
                            estado: /Estado/i.test(bodyText)
                        };

                        return result;
                    }).catch(e => ({ error: e.message }));

                    // Reportar columnas detectadas
                    if (postDiag.tableHeaders && postDiag.tableHeaders.length > 0) {
                        reportar(`   📊 COLUMNAS DE TABLA (${postDiag.tableHeaders.length}):`);
                        postDiag.tableHeaders.forEach(h => {
                            reportar(`      → "${h.text}" @(${h.x},${h.y})`);
                        });
                    } else {
                        reportar('   📊 No se detectaron headers de tabla (th/columnheader)');
                    }

                    // Reportar filas
                    if (postDiag.tableRows && postDiag.tableRows.length > 0) {
                        reportar(`\n   📋 FILAS DE TABLA (${postDiag.tableRows.length}):`);
                        postDiag.tableRows.slice(0, 5).forEach((row, i) => {
                            reportar(`      Fila ${i}: ${row.join(' | ')}`);
                        });
                        if (postDiag.tableRows.length > 5) {
                            reportar(`      ... y ${postDiag.tableRows.length - 5} filas más`);
                        }
                    } else {
                        reportar('   📋 No se detectaron filas de tabla');
                    }

                    // Columnas clave
                    const cols = postDiag.tieneColumnas || {};
                    reportar(`\n   ✅ Columnas clave detectadas:`);
                    reportar(`      Actividad: ${cols.actividad ? '✅' : '❌'}`);
                    reportar(`      Recurso: ${cols.recurso ? '✅' : '❌'}`);
                    reportar(`      Ventana de servicio: ${cols.ventanaServicio ? '✅' : '❌'}`);
                    reportar(`      Número de Petición: ${cols.numeroPeticion ? '✅' : '❌'}`);
                    reportar(`      Estado: ${cols.estado ? '✅' : '❌'}`);

                    // Texto visible
                    reportar(`\n   📝 TEXTO VISIBLE (primeros 600 chars):`);
                    const lineas = (postDiag.textoVisible || '').split('\n').filter(Boolean).slice(0, 20);
                    lineas.forEach(l => reportar(`      ${l.substring(0, 120)}`));

                } catch (e) {
                    reportar(`   ⚠️ Error diagnóstico post-vista: ${e.message}`);
                }

                reportar('\n🔍 ═══ FIN DIAGNÓSTICO POST-VISTA LISTA ═══');
                reportar(`   📅 Fecha TOA: ${await leerFechaTOA() || 'desconocida'}`);
                reportar(`✅ ${grupoNombre} — diagnóstico completado`);
            }

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

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
            const clickTexto = async (patron) => {
                const coords = await page.evaluate((pat) => {
                    const re = new RegExp(pat, 'i');
                    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                    let node;
                    while ((node = walker.nextNode())) {
                        if (re.test(node.textContent || '')) {
                            let el = node.parentElement;
                            for (let i = 0; i < 10 && el && el !== document.body; i++) {
                                const r = el.getBoundingClientRect();
                                if (r.width > 0 && r.height > 0) {
                                    return { x: r.left + r.width / 2, y: r.top + r.height / 2,
                                             tag: el.tagName, texto: (el.innerText || '').substring(0, 60) };
                                }
                                el = el.parentElement;
                            }
                        }
                    }
                    return null;
                }, patron.source || String(patron)).catch(() => null);
                if (!coords) return { ok: false };
                await page.mouse.click(coords.x, coords.y).catch(() => {});
                return { ok: true, tag: coords.tag, texto: coords.texto, x: Math.round(coords.x), y: Math.round(coords.y) };
            };

            // ── Helper: esperar que la tabla se actualice (interceptar Grid response) ──
            const esperarGrid = (timeout = 20000) => new Promise(resolve => {
                let settled = false;
                const timer = setTimeout(() => {
                    if (!settled) { settled = true; page.removeListener('response', handler); resolve(null); }
                }, timeout);
                const handler = async (resp) => {
                    try {
                        if (settled) return;
                        const url = resp.url();
                        if (!url.includes('output=ajax')) return;
                        const ct = resp.headers()['content-type'] || '';
                        if (!ct.includes('json') && !ct.includes('javascript')) return;
                        const text = await resp.text().catch(() => '');
                        if (!text || text.length < 20) return;
                        const data = JSON.parse(text);
                        if (data.activitiesRows !== undefined) {
                            settled = true; clearTimeout(timer);
                            page.removeListener('response', handler);
                            resolve(data.activitiesRows || []);
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

            // ── Helper: click flecha izquierda (día anterior) ────────────────
            const clickFlechaIzq = async () => {
                const ok = await page.evaluate(() => {
                    const els = [...document.querySelectorAll('a, button, [role="button"], span, oj-button')];
                    for (const el of els) {
                        const txt = (el.textContent || '').trim();
                        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                        if ((txt === '‹' || txt === '<' || txt === '◀' || txt === '❮') ||
                            /previous|anterior|prev/i.test(aria)) {
                            const r = el.getBoundingClientRect();
                            if (r.width > 0 && r.height > 0 && r.y < 250) {
                                el.click(); return true;
                            }
                        }
                    }
                    return false;
                }).catch(() => false);
                if (!ok) {
                    const ac = await page.evaluate(() => {
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
                    if (ac) await page.mouse.click(ac.x, ac.y).catch(()=>{});
                }
            };

            // ── Helper: activar vista de lista (icono 3 rayitas) ─────────────
            // En TOA toolbar: "Vista" [reloj] [3-rayitas] [mapa] [calendario]
            // IMPORTANTE: usar page.mouse.click() — el.click() NO funciona en Oracle JET
            const activarVistaLista = async () => {
                reportar('📋 Cambiando a Vista de Lista...');

                // Obtener coordenadas del icono (NO hacer click dentro de evaluate)
                const coords = await page.evaluate(() => {
                    // 1. Buscar por title="Vista de lista"
                    const sels = 'a, button, [role="button"], oj-button, [role="tab"], [class*="oj-button"], span, div';
                    for (const el of document.querySelectorAll(sels)) {
                        const title = (el.getAttribute('title') || '');
                        if (/vista de lista|list view/i.test(title)) {
                            const r = el.getBoundingClientRect();
                            if (r.width > 0 && r.height > 0 && r.y < 300) {
                                return { x: r.left + r.width/2, y: r.top + r.height/2, method: 'title' };
                            }
                        }
                    }
                    // 2. Calcular posición relativa al texto "Vista"
                    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                    let n;
                    while ((n = walker.nextNode())) {
                        if (/^Vista$/i.test((n.textContent || '').trim())) {
                            const el = n.parentElement;
                            const r = el.getBoundingClientRect();
                            if (r.y < 300 && r.width > 0) {
                                // El icono de lista es el 2do después de "Vista"
                                return { x: r.right + 52, y: r.top + r.height / 2, method: 'vista-offset' };
                            }
                        }
                    }
                    return null;
                }).catch(() => null);

                if (coords) {
                    reportar(`   🖱️ Vista Lista encontrada en (${Math.round(coords.x)}, ${Math.round(coords.y)}) [${coords.method}]`);
                    // Click FÍSICO con mouse — Oracle JET solo responde a esto
                    await page.mouse.click(coords.x, coords.y);
                } else {
                    reportar('   ⚠️ No encontré icono — click fijo (1243, 179)');
                    await page.mouse.click(1243, 179);
                }
                await new Promise(r => setTimeout(r, 2500));

                // Verificar si cambió a vista de lista
                const tieneTabla = await page.evaluate(() => {
                    const ths = document.querySelectorAll('th, [role="columnheader"]');
                    return ths.length > 2;
                }).catch(() => false);

                if (!tieneTabla) {
                    // Si no cambió, cerrar cualquier popup que se haya abierto
                    reportar('   ⚠️ No detecto tabla — cerrando popup si hay...');
                    const cerrado = await page.evaluate(() => {
                        // Buscar botones OK/Cancelar/Cerrar en popups
                        const btns = [...document.querySelectorAll('button, [role="button"]')];
                        for (const b of btns) {
                            const t = (b.textContent || '').trim().toLowerCase();
                            if (t === 'cancelar' || t === 'cancel' || t === 'cerrar' || t === 'close') {
                                b.click();
                                return true;
                            }
                        }
                        // Presionar Escape
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27 }));
                        return false;
                    }).catch(() => false);
                    if (cerrado) await new Promise(r => setTimeout(r, 1000));

                    // Intentar con Escape de Puppeteer
                    await page.keyboard.press('Escape').catch(()=>{});
                    await new Promise(r => setTimeout(r, 1000));

                    // Reintentar click con offset diferente
                    reportar('   🔄 Reintentando click Vista Lista...');
                    const retry = await page.evaluate(() => {
                        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                        let n;
                        while ((n = walker.nextNode())) {
                            if (/^Vista$/i.test((n.textContent || '').trim())) {
                                const el = n.parentElement;
                                const r = el.getBoundingClientRect();
                                if (r.y < 300 && r.width > 0) {
                                    return { x: r.right + 52, y: r.top + r.height / 2 };
                                }
                            }
                        }
                        return null;
                    }).catch(() => null);
                    if (retry) {
                        await page.mouse.click(retry.x, retry.y);
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }

                const tieneTabla2 = await page.evaluate(() => {
                    return document.querySelectorAll('th, [role="columnheader"]').length > 2;
                }).catch(() => false);
                reportar(tieneTabla2 ? '   ✅ Vista de Lista activada — tabla visible' : '   ⚠️ Vista lista: tabla no detectada, continuando...');
            };

            // ── Helper: abrir Filtros y marcar "Todos los datos de hijos" ────
            const aplicarFiltros = async () => {
                reportar('🔧 Abriendo filtros...');
                // Click en el icono de filtro (embudo) en la toolbar
                const filt1 = await page.evaluate(() => {
                    // Buscar por aria-label o title que contenga "filtro"
                    const btns = [...document.querySelectorAll('a, button, [role="button"], oj-button, [class*="oj-button"]')];
                    for (const b of btns) {
                        const t = (b.getAttribute('title') || b.getAttribute('aria-label') || '').toLowerCase();
                        if (/filtro|filter/i.test(t)) {
                            const r = b.getBoundingClientRect();
                            if (r.width > 0 && r.y < 250) { b.click(); return true; }
                        }
                    }
                    return false;
                }).catch(() => false);
                if (!filt1) {
                    // Fallback: click en texto "Filtros" si existe
                    await clickTexto(/filtros/i);
                }
                await new Promise(r => setTimeout(r, 1500));

                // Marcar checkbox "Todos los datos de hijos"
                reportar('   ☑️ Activando "Todos los datos de hijos"...');
                const cbResult = await page.evaluate(() => {
                    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                    let node;
                    while ((node = walker.nextNode())) {
                        if (/todos los datos/i.test(node.textContent)) {
                            let el = node.parentElement;
                            for (let t = 0; t < 5 && el; t++) {
                                const cb = el.querySelector('input[type="checkbox"]');
                                if (cb) {
                                    if (!cb.checked) cb.click();
                                    return { found: true, checked: true };
                                }
                                el = el.parentElement;
                            }
                            node.parentElement.click();
                            return { found: true, clicked: true };
                        }
                    }
                    return { found: false };
                }).catch(() => ({ found: false }));
                reportar(`   → ${cbResult.found ? '✅ Checkbox marcado' : '⚠️ No encontrado'}`);
                await new Promise(r => setTimeout(r, 500));

                // Click en botón Aplicar
                reportar('   → Click en Aplicar...');
                const pGrid = esperarGrid(20000);
                await clickTexto(/^aplicar$/i);
                const rows = await pGrid;
                reportar(`   → ${rows ? `✅ ${rows.length} actividades` : '⚠️ Sin respuesta (timeout)'}`);
                return rows;
            };

            // ── Helper: leer todas las columnas de la tabla en vista lista ───
            const leerTablaLista = async () => {
                return page.evaluate(() => {
                    // Leer headers de la tabla
                    const headers = [];
                    document.querySelectorAll('th, [role="columnheader"]').forEach(th => {
                        const txt = (th.innerText || th.textContent || '').trim();
                        if (txt && txt.length > 0 && txt.length < 100) headers.push(txt);
                    });

                    // Leer filas de la tabla
                    const rows = [];
                    const trList = document.querySelectorAll('tbody tr, [role="row"]');
                    trList.forEach(tr => {
                        // Saltar headers
                        if (tr.querySelector('th') || tr.getAttribute('role') === 'columnheader') return;
                        const cells = tr.querySelectorAll('td, [role="gridcell"], [role="cell"]');
                        if (cells.length < 2) return;
                        const row = {};
                        cells.forEach((cell, idx) => {
                            const val = (cell.innerText || cell.textContent || '').trim();
                            const key = headers[idx] || `col_${idx}`;
                            if (val) row[key] = val;
                        });
                        if (Object.keys(row).length > 1) rows.push(row);
                    });

                    return { headers, rows, count: rows.length };
                }).catch(() => ({ headers: [], rows: [], count: 0 }));
            };

            // ══════════════════════════════════════════════════════════════════
            // ITERAR POR CADA GRUPO: COMFICA → ZENER RANCAGUA → ZENER RM
            // ══════════════════════════════════════════════════════════════════
            let diasGlobal = 0;
            const totalDiasGlobal = fechasAProcesar.length * gruposSeleccionados.length;
            let vistaListaActivada = false;
            let filtrosAplicados = false;

            for (let gi = 0; gi < gruposSeleccionados.length; gi++) {
                const grupo = gruposSeleccionados[gi];
                const grupoNombre = grupo.nombre || grupo;
                reportar(`\n${'═'.repeat(60)}`);
                reportar(`📂 [${gi + 1}/${gruposSeleccionados.length}] ${grupoNombre}`);
                reportar(`${'═'.repeat(60)}`);

                // ── 1. Click en el grupo en el sidebar ───────────────────────
                try {
                    reportar(`🖱️ Click en "${grupoNombre}"...`);
                    const escGrupo = grupoNombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    await clickTexto(new RegExp(escGrupo, 'i'));
                    await new Promise(r => setTimeout(r, 3000)); // esperar carga
                } catch (e) {
                    reportar(`   ⚠️ Error al seleccionar grupo: ${e.message}`);
                    continue; // saltar a siguiente grupo
                }

                // ── 2. Activar Vista de Lista (solo la primera vez) ──────────
                if (!vistaListaActivada) {
                    try {
                        await activarVistaLista();
                        vistaListaActivada = true;
                    } catch (e) {
                        reportar(`   ⚠️ Error Vista Lista: ${e.message} — continuando...`);
                    }
                }

                // ── 3. Aplicar Filtros "Todos los datos de hijos" ────────────
                let rowsInicial = null;
                try {
                    rowsInicial = await aplicarFiltros();
                    filtrosAplicados = true;
                } catch (e) {
                    reportar(`   ⚠️ Error Filtros: ${e.message} — continuando...`);
                }

                // Leer fecha actual de TOA
                let fechaActual = await leerFechaTOA();
                reportar(`   📅 Fecha TOA: ${fechaActual || 'desconocida'}`);

                // Guardar datos del día actual si está en el rango
                if (rowsInicial && rowsInicial.length > 0 && fechaActual && fechasAProcesar.includes(fechaActual)) {
                    // También leer la tabla visible para capturar todas las columnas
                    const tablaVisible = await leerTablaLista();
                    if (tablaVisible.count > 0) {
                        reportar(`   📊 Tabla: ${tablaVisible.count} filas × ${tablaVisible.headers.length} columnas`);
                        reportar(`   📊 Columnas: ${tablaVisible.headers.join(' | ')}`);
                    }
                    // Guardar datos del XHR interceptado (tiene más campos que la tabla visible)
                    const g = await guardarActividades(rowsInicial, grupoNombre, fechaActual, 0, empresaRef);
                    totalGuardados += g;
                    reportar(`   💾 ${fechaActual}: ${rowsInicial.length} act. → ${g} guardadas`);
                    diasGlobal++;
                }

                // ── 4. Navegar fecha por fecha con flecha < ──────────────────
                const fechaTOADate = fechaActual ? new Date(fechaActual + 'T12:00:00Z') : new Date();
                const fechaMinDate = new Date(fechasAProcesar[0] + 'T12:00:00Z');
                const maxClicks = Math.ceil((fechaTOADate - fechaMinDate) / 86400000);

                if (maxClicks > 0) {
                    reportar(`📅 Navegando ${maxClicks} día(s) atrás...`);
                }

                for (let d = 1; d <= maxClicks; d++) {
                    const fechaEsperada = new Date(fechaTOADate);
                    fechaEsperada.setUTCDate(fechaEsperada.getUTCDate() - d);
                    const fechaISO = fechaEsperada.toISOString().split('T')[0];

                    if (!fechasAProcesar.includes(fechaISO)) continue;
                    diasGlobal++;

                    if (process.send) process.send({
                        type: 'progress',
                        diaActual: diasGlobal,
                        totalDias: totalDiasGlobal,
                        fechaProcesando: fechaISO,
                        grupoProcesando: grupoNombre
                    });

                    // Click flecha < y esperar Grid response
                    const promGrid = esperarGrid(15000);
                    await clickFlechaIzq();
                    const rows = await promGrid;

                    if (rows && rows.length > 0) {
                        const g = await guardarActividades(rows, grupoNombre, fechaISO, 0, empresaRef);
                        totalGuardados += g;
                        reportar(`   💾 ${fechaISO}: ${rows.length} act. → ${g} guardadas`);
                        if (global.BOT_STATUS) global.BOT_STATUS.registrosGuardados = totalGuardados;
                    } else {
                        if (d <= 3 || d % 10 === 0) reportar(`   📅 ${fechaISO}: ${rows ? '0 actividades' : 'sin respuesta'}`);
                    }

                    await new Promise(r => setTimeout(r, 500));
                }

                reportar(`✅ ${grupoNombre} completado — ${totalGuardados} registros acumulados`);
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

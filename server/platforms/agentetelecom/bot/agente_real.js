const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const path = require('path');
const Actividad = require('../models/Actividad');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

// =============================================================================
// 🤖 AGENTE TOA — Descarga completa de producción sin filtros
// Guarda TODAS las filas de las 3 carpetas (COMFICA, ZENER RANCAGUA, ZENER RM)
// con TODAS las columnas tal como vienen de TOA.
// =============================================================================

const iniciarExtraccion = async (fechaManual = null, rangoFin = null, credenciales = {}) => {
    process.env.BOT_ACTIVE_LOCK = "TOA";

    // ── Construir lista de fechas a procesar ──────────────────────────────────
    const fechasAProcesar = [];

    if (fechaManual && rangoFin) {
        // MODO RANGO
        let cursor = new Date(fechaManual + 'T00:00:00Z');
        const fin   = new Date(rangoFin   + 'T00:00:00Z');
        while (cursor <= fin) {
            const yyyy = cursor.getUTCFullYear();
            const mm   = String(cursor.getUTCMonth() + 1).padStart(2, '0');
            const dd   = String(cursor.getUTCDate()).padStart(2, '0');
            fechasAProcesar.push(`${yyyy}-${mm}-${dd}`);
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
    } else if (fechaManual) {
        // MODO DÍA ÚNICO
        fechasAProcesar.push(fechaManual);
    } else {
        // MODO BACKFILL: 01-01-2026 → hoy
        let cursor = new Date(Date.UTC(2026, 0, 1));
        const hoy  = new Date();
        const fin  = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
        while (cursor <= fin) {
            const yyyy = cursor.getUTCFullYear();
            const mm   = String(cursor.getUTCMonth() + 1).padStart(2, '0');
            const dd   = String(cursor.getUTCDate()).padStart(2, '0');
            fechasAProcesar.push(`${yyyy}-${mm}-${dd}`);
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
    }

    const modo = fechaManual && rangoFin ? 'RANGO' : fechaManual ? 'DÍA ÚNICO' : 'BACKFILL COMPLETO';
    console.log(`🤖 AGENTE TOA [${modo}]: ${fechasAProcesar[0]} → ${fechasAProcesar[fechasAProcesar.length - 1]} (${fechasAProcesar.length} días)`);

    // ── Helper IPC / log ──────────────────────────────────────────────────────
    const reportar = (msg, extra = {}) => {
        console.log('🤖', msg);
        if (process.send) {
            process.send({ type: 'log', text: msg, ...extra });
        } else if (global.BOT_STATUS) {
            global.BOT_STATUS.logs = global.BOT_STATUS.logs || [];
            global.BOT_STATUS.logs.push(`[${new Date().toLocaleTimeString('es-CL')}] ${msg}`);
            if (global.BOT_STATUS.logs.length > 80) global.BOT_STATUS.logs.shift();
        }
    };

    let browser;
    try {
        reportar('🌐 Lanzando Chrome headless...');
        browser = await puppeteer.launch({
            headless: true,
            defaultViewport: { width: 1920, height: 1080 },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--disable-extensions',
                '--window-size=1920,1080'
            ]
        });
        reportar('✅ Chrome iniciado.');

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

        reportar('🔐 Iniciando sesión en TOA...');
        await loginAtomico(page, credenciales);
        reportar('✅ Login exitoso. Esperando dashboard...');

        await page.waitForFunction(() => {
            return document.querySelector('.oj-navigation-list') !== null
                || document.querySelector('.oj-datagrid-cell') !== null;
        }, { timeout: 45000 }).catch(() => reportar('⚠️ Timeout dashboard, continuando...'));
        await new Promise(r => setTimeout(r, 2000));

        // ── Bucle de días ──────────────────────────────────────────────────────
        for (let i = 0; i < fechasAProcesar.length; i++) {
            const fechaTarget = fechasAProcesar[i];

            if (process.send) {
                process.send({ type: 'progress', diaActual: i + 1, fechaProcesando: fechaTarget });
            } else if (global.BOT_STATUS) {
                global.BOT_STATUS.diaActual    = i + 1;
                global.BOT_STATUS.fechaProcesando = fechaTarget;
            }

            reportar(`📅 [${i + 1}/${fechasAProcesar.length}] Procesando: ${fechaTarget}`);
            await procesarVistaChile(page, fechaTarget);
            await new Promise(r => setTimeout(r, 3000));
        }

        reportar('🏁 PROCESO MASIVO COMPLETADO.');
        if (global.BOT_STATUS) global.BOT_STATUS.running = false;

    } catch (error) {
        const errMsg = error.message || 'Error desconocido';
        reportar(`❌ ERROR FATAL: ${errMsg}`);
        if (global.BOT_STATUS) {
            global.BOT_STATUS.ultimoError = errMsg;
            global.BOT_STATUS.running     = false;
        }
        console.error('❌ ERROR FATAL:', errMsg);
    } finally {
        process.env.BOT_ACTIVE_LOCK = "OFF";
        if (browser) {
            console.log('🔒 Cerrando Chrome en 5s...');
            await new Promise(r => setTimeout(r, 5000));
            await browser.close();
        }
    }
};

// =============================================================================
// 🇨🇱 PROCESO POR CARPETA (COMFICA / ZENER RANCAGUA / ZENER RM)
// =============================================================================
async function procesarVistaChile(page, fechaTarget) {
    const BUCKETS = ['COMFICA', 'ZENER RANCAGUA', 'ZENER RM'];

    console.log(`\n📂 MULTI-BUCKET (${BUCKETS.join(' | ')})`);

    for (const bucket of BUCKETS) {
        try {
            console.log(`\n>>> BUCKET: [${bucket}] <<<`);

            const acceso = await encontrarYClicarSidebar(page, bucket);
            if (!acceso) {
                console.log(`   ⚠️ Carpeta '${bucket}' no encontrada. Saltando...`);
                continue;
            }

            console.log(`   🔓 ${bucket} seleccionado. Pausa de carga (5s)...`);
            await new Promise(r => setTimeout(r, 5000));

            // Configurar vista "Todos los datos de hijos" para ver columnas completas
            await configurarVisualizacionQuirurgica(page);

            // Navegar a la fecha y extraer
            await extraerYGuardarDia(page, fechaTarget, bucket);

        } catch (e) {
            console.error(`   ❌ Error en bucket ${bucket}: ${e.message}`);
        }

        await new Promise(r => setTimeout(r, 2000));
    }
}

// =============================================================================
// 👁️ CONFIGURAR VISTA "TODOS LOS DATOS DE HIJOS"
// =============================================================================
async function configurarVisualizacionQuirurgica(page) {
    console.log("   ⚙️ Configurando vista completa...");
    try {
        // Vista de lista
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, div[role="button"]'));
            const btn = btns.find(b =>
                (b.title && b.title.toLowerCase().includes('lista')) ||
                (b.getAttribute('aria-label') && b.getAttribute('aria-label').toLowerCase().includes('lista'))
            );
            if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 2000));

        // Abrir menú "Vista"
        const menuAbierto = await page.evaluate(() => {
            const el = Array.from(document.querySelectorAll('button, span.oj-button-text'))
                .find(e => e.innerText.trim() === 'Vista' && e.offsetParent !== null);
            if (el) { el.click(); return true; }
            return false;
        });

        if (!menuAbierto) { console.log("      ⚠️ Botón 'Vista' no encontrado."); return; }

        await new Promise(r => setTimeout(r, 2000));

        // Click en checkbox "Todos los datos de hijos"
        const coords = await page.evaluate(() => {
            const target = Array.from(document.querySelectorAll('*'))
                .filter(el => el.children.length === 0 && el.innerText && el.innerText.includes('Todos los datos de hijos'))
                .find(el => {
                    const r = el.getBoundingClientRect();
                    return r.width > 0 && r.height > 0;
                });
            if (!target) return null;
            const rect = target.getBoundingClientRect();
            return { x: rect.x, y: rect.y, height: rect.height };
        });

        if (coords) {
            await page.mouse.move(coords.x - 20, coords.y + (coords.height / 2));
            await page.mouse.down();
            await new Promise(r => setTimeout(r, 150));
            await page.mouse.up();
        }

        await new Promise(r => setTimeout(r, 1500));

        // Aplicar
        const aplico = await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button, span'))
                .find(b => b.innerText.trim() === 'Aplicar' && b.offsetParent !== null);
            if (btn) { btn.click(); return true; }
            return false;
        });

        if (aplico) {
            await page.waitForFunction(() => {
                const overlay  = document.querySelector('.oj-conveyorbelt-overlay');
                const spinner  = document.querySelector('.oj-progress-circle-indeterminate');
                const cells    = document.querySelectorAll('.oj-datagrid-cell');
                return !overlay && !spinner && cells.length > 0;
            }, { timeout: 30000 }).catch(() => {});
            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (e) {
        console.log("   ⚠️ Error configurando vista: " + e.message);
    }
}

// =============================================================================
// 📅 NAVEGAR A FECHA Y GUARDAR TODAS LAS FILAS
// =============================================================================
async function extraerYGuardarDia(page, fechaTarget, bucket) {
    const fechaLog = (typeof fechaTarget === 'string')
        ? fechaTarget
        : fechaTarget.toISOString().split('T')[0];

    // Navegar a la fecha correcta
    let intentos = 0;
    while (intentos < 30) {
        const fechaEnPantalla = await page.evaluate(() => {
            const inp = document.querySelector('.oj-inputdatetime-input');
            if (inp && inp.value) return inp.value;
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let node;
            while (node = walker.nextNode()) {
                if (/\d{4}\/\d{2}\/\d{2}/.test(node.nodeValue)) return node.nodeValue.trim();
            }
            return null;
        });

        if (fechaEnPantalla) {
            const detectada = fechaEnPantalla.replace(/\//g, '-').split(' ')[0];
            if (detectada === fechaLog) break;

            const dActual = new Date(detectada);
            const dTarget = new Date(fechaLog);
            if (dActual > dTarget)      await clicDiaAnterior(page);
            else if (dActual < dTarget) await clicDiaSiguiente(page);
            await new Promise(r => setTimeout(r, 4000));
        } else {
            console.log("      ⚠️ No pude leer fecha, intentando igual...");
            await new Promise(r => setTimeout(r, 2000));
        }
        intentos++;
    }

    // Esperar estabilización
    await page.waitForFunction(() => {
        return !document.querySelector('.oj-conveyorbelt-overlay')
            && !document.querySelector('.oj-progress-circle-indeterminate');
    }, { timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    // Extraer tabla completa
    console.log(`      📥 [${bucket}] Extrayendo tabla...`);
    let rawData = await extraerTablaCruda(page, fechaLog);

    if (!rawData || rawData.length === 0) {
        console.log(`      ⚠️ Tabla vacía, reintentando en 5s...`);
        await new Promise(r => setTimeout(r, 5000));
        rawData = await extraerTablaCruda(page, fechaLog);
    }

    if (!rawData || rawData.length === 0) {
        console.log(`      💤 [${bucket}] Sin registros para ${fechaLog}.`);
        return;
    }

    // ── Guardar TODAS las filas directamente en MongoDB ───────────────────────
    // No se filtra, no se cruza con técnicos internos.
    // Se guardan con todas las columnas tal como vienen de TOA.
    const registros = rawData.map(fila => {
        // Normalizar fecha a mediodía UTC para evitar desfase horario
        let fechaSafe = fila.fecha || fechaLog;
        if (fechaSafe && fechaSafe.length === 10 && !fechaSafe.includes('T')) {
            fechaSafe = `${fechaSafe}T12:00:00.000Z`;
        }
        return {
            ...fila,
            fecha:              fechaSafe,
            bucket:             bucket,
            cliente:            fila.cliente || 'Movistar',
            ultimaActualizacion: new Date()
        };
    }).filter(r => r.ordenId && r.ordenId.length > 2);

    if (registros.length === 0) {
        console.log(`      ⚠️ [${bucket}] Ninguna fila tiene ordenId válido.`);
        return;
    }

    try {
        const bulkOps = registros.map(r => ({
            updateOne: {
                filter: { ordenId: r.ordenId },
                update: { $set: r },
                upsert: true
            }
        }));
        const result = await Actividad.bulkWrite(bulkOps, { ordered: false });
        console.log(`      ✅ [${bucket}] GUARDADO: ${registros.length} registros (${result.upsertedCount} nuevos, ${result.modifiedCount} actualizados)`);
    } catch (e) {
        console.error(`      ❌ [${bucket}] Error MongoDB: ${e.message}`);
    }
}

// =============================================================================
// 🔭 BUSCADOR EN SIDEBAR (FAVORITOS)
// =============================================================================
async function encontrarYClicarSidebar(page, texto) {
    console.log(`      🔎 Buscando sidebar: '${texto}'...`);

    try {
        await page.evaluate(() => {
            const tree = document.querySelector('oj-navigation-list, [role="tree"]');
            if (tree) tree.scrollIntoView({ block: 'start', behavior: 'instant' });
        });
        await new Promise(r => setTimeout(r, 1000));
    } catch (e) {}

    for (let i = 0; i < 3; i++) {
        const coords = await page.evaluate((txt) => {
            const el = Array.from(document.querySelectorAll('span, a, div, li')).find(e => {
                const t = e.innerText ? e.innerText.trim() : '';
                const coincide = t === txt || t === `★ ${txt}` || (t.includes(txt) && t.length < txt.length + 5);
                if (!coincide) return false;
                const rect = e.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && rect.left < 450;
            });
            if (!el) return { encontrado: false };
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const rect = el.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, encontrado: true };
        }, texto);

        if (coords.encontrado) {
            await page.mouse.move(coords.x, coords.y);
            await new Promise(r => setTimeout(r, 200));
            await page.mouse.down();
            await new Promise(r => setTimeout(r, 100));
            await page.mouse.up();
            await new Promise(r => setTimeout(r, 5000));
            return true;
        }

        console.log(`      ⚠️ Intento ${i + 1}: '${texto}' no encontrado.`);
        await new Promise(r => setTimeout(r, 2000));
    }
    return false;
}

// =============================================================================
// 🕸️ SCRAPER DE TABLA — V3 (Headers + Geometría) + V2 fallback
// =============================================================================
async function extraerTablaCruda(page, fechaISO) {
    return await page.evaluate((fecha) => {
        // ── ESTRATEGIA V3: Headers + posición geométrica ───────────────────
        let headerCells = Array.from(document.querySelectorAll('.oj-datagrid-header-cell'));
        if (headerCells.length === 0)
            headerCells = Array.from(document.querySelectorAll('[role="columnheader"]'));

        if (headerCells.length > 0) {
            const headers = headerCells.map(h => {
                const rect = h.getBoundingClientRect();
                return {
                    text:   h.innerText.trim(),
                    left:   rect.left,
                    right:  rect.right,
                    center: rect.left + rect.width / 2
                };
            }).filter(h => h.text.length > 0);

            const dataCells = Array.from(document.querySelectorAll('.oj-datagrid-cell'));
            const mapaFilas = new Map();
            dataCells.forEach(celda => {
                const rect = celda.getBoundingClientRect();
                const y = Math.round(rect.top / 5) * 5;
                if (!mapaFilas.has(y)) mapaFilas.set(y, []);
                mapaFilas.get(y).push({ rect, text: celda.innerText.trim() });
            });

            const resultados = [];
            mapaFilas.forEach(celdas => {
                const fila = { fecha, origen: 'TOA_V3' };
                celdas.forEach(celda => {
                    const cx = celda.rect.left + celda.rect.width / 2;
                    let header = headers.find(h => cx >= h.left && cx <= h.right);
                    if (!header) {
                        header = headers.reduce((p, c) =>
                            Math.abs(c.center - cx) < Math.abs(p.center - cx) ? c : p
                        , headers[0]);
                        if (Math.abs(header.center - cx) > 100) header = null;
                    }
                    if (header) {
                        const key = header.text.replace(/\./g, '_').trim();
                        fila[key] = celda.text;
                    }
                });

                // Mapear campos estándar
                fila.ordenId    = fila['Número orden'] || fila['Numero orden']
                               || fila['Petición']     || fila['ID']
                               || fila['Orden']        || '';
                fila.nombreBruto = fila['Recurso']      || fila['Nombre recurso']
                                || fila['Técnico']      || fila['Nombre'] || '';
                fila.actividad  = fila['Subtipo de Actividad'] || fila['Tipo Trabajo']
                               || fila['Actividad']    || '';

                const lat = fila['Direccion Polar Y'] || fila['Latitud'];
                const lon = fila['Direccion Polar X'] || fila['Longitud'];
                if (lat) fila.latitud  = lat.replace(',', '.');
                if (lon) fila.longitud = lon.replace(',', '.');

                if (fila.ordenId && fila.ordenId.length > 3) resultados.push(fila);
            });

            if (resultados.length > 0) return resultados;
        }

        // ── ESTRATEGIA V2: Regex sobre texto plano (fallback) ─────────────
        const celdas = Array.from(document.querySelectorAll('.oj-datagrid-cell'));
        if (celdas.length === 0) return [];

        const mapaFilasV2 = new Map();
        celdas.forEach(celda => {
            const rect = celda.getBoundingClientRect();
            const y = Math.round(rect.top / 5) * 5;
            if (!mapaFilasV2.has(y)) mapaFilasV2.set(y, []);
            mapaFilasV2.get(y).push({ x: rect.left, texto: celda.innerText.trim() });
        });

        const resultadosV2 = [];
        mapaFilasV2.forEach(items => {
            items.sort((a, b) => a.x - b.x);
            const texto = items.map(i => i.texto).join(' ');

            const matchOrden = texto.match(/(INC\d+|WO-\d+|REQ\d+|12\d{8})/);
            if (!matchOrden) return;

            const ordenId    = matchOrden[0];
            const matchCoords = texto.match(/(-33\.\d+).*?(-70\.\d+)|(-70\.\d+).*?(-33\.\d+)/);

            resultadosV2.push({
                origen:          'TOA_V2',
                fecha,
                ordenId,
                nombreBruto:     '',
                actividad:       '',
                dataRawCompleta: texto,
                latitud:         matchCoords ? (matchCoords[1] || matchCoords[4]) : null,
                longitud:        matchCoords ? (matchCoords[2] || matchCoords[3]) : null
            });
        });

        return resultadosV2;

    }, fechaISO);
}

// =============================================================================
// ⏪ ⏩ NAVEGACIÓN DE FECHAS
// =============================================================================
async function clicDiaAnterior(page) {
    const coords = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, div[role="button"], a, span'));
        let target = btns.find(el => {
            const t = (el.title || el.ariaLabel || '').toLowerCase();
            return t.includes('previous') || t.includes('anterior') || t.includes('atras');
        });
        if (!target) {
            const iconos = Array.from(document.querySelectorAll('span.oj-button-icon'));
            target = iconos.find(i => {
                const r = i.getBoundingClientRect();
                return r.top < 200 && r.width > 0;
            });
            if (target?.parentElement) target = target.parentElement;
        }
        if (!target) return { encontrado: false };
        const rect = target.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, encontrado: true };
    });

    if (coords?.encontrado) {
        await page.mouse.move(coords.x, coords.y);
        await new Promise(r => setTimeout(r, 200));
        await page.mouse.down();
        await new Promise(r => setTimeout(r, 100));
        await page.mouse.up();
    } else {
        await page.keyboard.press('ArrowLeft');
    }
}

async function clicDiaSiguiente(page) {
    const coords = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, div[role="button"], a, span'));
        let target = btns.find(el => {
            const t = (el.title || el.ariaLabel || '').toLowerCase();
            return t.includes('next') || t.includes('siguiente') || t.includes('adelante');
        });
        if (!target) {
            const iconos = Array.from(document.querySelectorAll('span.oj-button-icon'));
            target = iconos.find(i => {
                const r = i.getBoundingClientRect();
                return r.top < 200 && r.width > 0;
            });
            if (target?.parentElement) target = target.parentElement;
        }
        if (!target) return { encontrado: false };
        const rect = target.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, encontrado: true };
    });

    if (coords?.encontrado) {
        await page.mouse.move(coords.x, coords.y);
        await new Promise(r => setTimeout(r, 200));
        await page.mouse.down();
        await new Promise(r => setTimeout(r, 100));
        await page.mouse.up();
    } else {
        await page.keyboard.press('ArrowRight');
    }
}

// =============================================================================
// 🔐 LOGIN — Flujo completo TOA (con checkbox "Suprimir sesión" incluido)
// =============================================================================
async function loginAtomico(page, credenciales = {}) {
    const usuario = credenciales.usuario || process.env.BOT_TOA_USER || process.env.TOA_USER_REAL;
    const clave   = credenciales.clave   || process.env.BOT_TOA_PASS  || process.env.TOA_PASS_REAL;
    const toaUrl  = process.env.TOA_URL  || 'https://telefonica-cl.etadirect.com/';

    // Llenar input vía DOM (evita problemas de nodos detachados de Oracle JET)
    const llenarInput = async (selector, valor) => {
        await page.evaluate((sel, val) => {
            const el = document.querySelector(sel);
            if (!el) return;
            el.focus();
            el.value = val;
            el.dispatchEvent(new Event('input',  { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        }, selector, valor);
    };

    // ── PASO 1: Cargar página ─────────────────────────────────────────────────
    console.log('🌐 Navegando a TOA...');
    try {
        await page.goto(toaUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    } catch (e) {
        throw new Error('TIMEOUT_PORTAL_TOA');
    }

    try {
        await page.waitForSelector('input[type="password"]', { visible: true, timeout: 25000 });
    } catch (e) {
        throw new Error('TIMEOUT_LOGIN_INPUTS');
    }
    await new Promise(r => setTimeout(r, 3000)); // Oracle JET necesita inicializarse

    // ── PASO 2: Llenar usuario y contraseña ──────────────────────────────────
    await page.evaluate((usr) => {
        const campos = Array.from(document.querySelectorAll('input')).filter(el => {
            const s = window.getComputedStyle(el);
            return el.type !== 'password' && el.type !== 'checkbox' && el.type !== 'hidden'
                && s.display !== 'none' && s.visibility !== 'hidden';
        });
        if (campos[0]) {
            campos[0].focus();
            campos[0].value = usr;
            campos[0].dispatchEvent(new Event('input',  { bubbles: true }));
            campos[0].dispatchEvent(new Event('change', { bubbles: true }));
        }
    }, usuario);

    await new Promise(r => setTimeout(r, 500));
    await llenarInput('input[type="password"]', clave);
    await new Promise(r => setTimeout(r, 500));

    // ── PASO 3: Click "Iniciar" ───────────────────────────────────────────────
    const clickedBtn = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        const btn  = btns.find(b => /iniciar|sign in|login|entrar/i.test(b.textContent || b.value || ''))
                  || btns.find(b => b.type === 'submit')
                  || btns[0];
        if (btn) { btn.click(); return true; }
        return false;
    });
    if (!clickedBtn) await page.keyboard.press('Enter');

    console.log('   ⏳ Esperando respuesta de TOA...');
    await new Promise(r => setTimeout(r, 7000));

    // ── PASO 4: Detectar checkbox "Suprimir sesión duplicada" ────────────────
    const estadoPagina = await page.evaluate(() => {
        const cb = document.querySelector('input[type="checkbox"]');
        return {
            tieneCheckbox: !!cb,
            checkboxMarcado: cb ? cb.checked : false
        };
    });

    if (estadoPagina.tieneCheckbox) {
        console.log('⚠️ Sesión duplicada detectada — marcando checkbox "Suprimir sesión"...');

        await page.evaluate(() => {
            const cb = document.querySelector('input[type="checkbox"]');
            if (cb && !cb.checked) cb.click();
        });
        await new Promise(r => setTimeout(r, 2000));

        // TOA requiere re-ingresar la contraseña después del checkbox
        await llenarInput('input[type="password"]', clave);
        await new Promise(r => setTimeout(r, 1000));

        // Segundo click en "Iniciar"
        const clicked2 = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
            const btn  = btns.find(b => /iniciar|sign in|login|entrar/i.test(b.textContent || b.value || ''))
                      || btns.find(b => b.type === 'submit')
                      || btns[0];
            if (btn) { btn.click(); return true; }
            return false;
        });
        if (!clicked2) await page.keyboard.press('Enter');

        console.log('   ⏳ Esperando tras suprimir sesión...');
        await new Promise(r => setTimeout(r, 7000));
    }

    // ── PASO 5: Esperar dashboard ─────────────────────────────────────────────
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    console.log('✅ Login completado.');
}

// =============================================================================
module.exports = { iniciarExtraccion };

// Entry point cuando se ejecuta como proceso hijo (fork) o directo
if (require.main === module) {
    const credencialesEnv = {
        usuario: process.env.BOT_TOA_USER || process.env.TOA_USER_REAL,
        clave:   process.env.BOT_TOA_PASS || process.env.TOA_PASS_REAL
    };
    const fi = process.env.BOT_FECHA_INICIO || null;
    const ff = process.env.BOT_FECHA_FIN    || null;

    console.log('🔌 Conectando a MongoDB Atlas...');
    mongoose.connect(process.env.MONGO_URI)
        .then(() => {
            console.log('✅ Atlas conectado. Iniciando bot...');
            iniciarExtraccion(fi, ff, credencialesEnv);
        })
        .catch(err => {
            console.error('❌ Error de conexión Atlas:', err.message);
            process.exit(1);
        });
}

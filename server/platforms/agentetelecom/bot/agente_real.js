const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const path = require('path');
const Actividad = require('../models/Actividad');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

// =============================================================================
// 🤖 AGENTE TOA — Flujo: Bucket → Técnico → Fechas
// Por cada carpeta (COMFICA / ZENER RANCAGUA / ZENER RM):
//   - Expande la carpeta en el sidebar
//   - Obtiene la lista de técnicos bajo ella
//   - Por cada técnico: navega cada fecha y extrae su tabla
// =============================================================================

const iniciarExtraccion = async (fechaManual = null, rangoFin = null, credenciales = {}) => {
    process.env.BOT_ACTIVE_LOCK = "TOA";

    // ── Construir lista de fechas ─────────────────────────────────────────────
    const fechasAProcesar = [];
    if (fechaManual && rangoFin) {
        let cursor = new Date(fechaManual + 'T00:00:00Z');
        const fin   = new Date(rangoFin   + 'T00:00:00Z');
        while (cursor <= fin) {
            fechasAProcesar.push(cursor.toISOString().split('T')[0]);
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
    } else if (fechaManual) {
        fechasAProcesar.push(fechaManual);
    } else {
        let cursor = new Date(Date.UTC(2026, 0, 1));
        const hoy  = new Date();
        const fin  = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
        while (cursor <= fin) {
            fechasAProcesar.push(cursor.toISOString().split('T')[0]);
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
    }

    const modo = fechaManual && rangoFin ? 'RANGO' : fechaManual ? 'DÍA ÚNICO' : 'BACKFILL';
    const empresaRef = process.env.BOT_EMPRESA_REF || null;

    // ── Helper IPC ────────────────────────────────────────────────────────────
    const reportar = (msg, extra = {}) => {
        console.log('🤖', msg);
        if (process.send) {
            process.send({ type: 'log', text: msg, ...extra });
        } else if (global.BOT_STATUS) {
            global.BOT_STATUS.logs = global.BOT_STATUS.logs || [];
            global.BOT_STATUS.logs.push(`[${new Date().toLocaleTimeString('es-CL')}] ${msg}`);
            if (global.BOT_STATUS.logs.length > 100) global.BOT_STATUS.logs.shift();
        }
    };

    reportar(`🚀 [${modo}] ${fechasAProcesar[0]} → ${fechasAProcesar[fechasAProcesar.length - 1]} (${fechasAProcesar.length} días)`);

    let browser;
    try {
        reportar('🌐 Lanzando Chrome headless...');
        browser = await puppeteer.launch({
            headless: true,
            defaultViewport: { width: 1920, height: 1080 },
            args: [
                '--no-sandbox', '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas',
                '--disable-gpu', '--no-first-run', '--no-zygote',
                '--disable-extensions', '--window-size=1920,1080'
            ]
        });

        const page = await browser.newPage();

        // Interceptar diálogos de descarga (para no quedar bloqueados)
        page.on('dialog', async dialog => {
            console.log(`📢 Dialog: ${dialog.message()}`);
            await dialog.accept();
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

        // ── Login ─────────────────────────────────────────────────────────────
        reportar('🔐 Iniciando sesión TOA...');
        await loginAtomico(page, credenciales);
        reportar('✅ Login OK. Esperando dashboard...');

        const dashboardOk = await page.waitForFunction(() => {
            return document.querySelector('oj-navigation-list') !== null
                || document.querySelector('.oj-navigation-list') !== null
                || document.querySelector('[role="tree"]') !== null;
        }, { timeout: 90000 }).then(() => true).catch(() => false);

        if (dashboardOk) {
            reportar('✅ Dashboard cargado.');
            await new Promise(r => setTimeout(r, 3000));
        } else {
            reportar('⚠️ Dashboard no confirmado, esperando 20s adicionales...');
            await new Promise(r => setTimeout(r, 20000));
        }

        // ── Bucle principal: Bucket → Técnico → Fechas ────────────────────────
        const BUCKETS = ['COMFICA', 'ZENER RANCAGUA', 'ZENER RM'];

        for (const bucket of BUCKETS) {
            reportar(`\n📂 ── CARPETA: ${bucket} ──`);

            // 1. Expandir carpeta en sidebar
            const bucketAbierto = await encontrarYClicarSidebar(page, bucket, reportar);
            if (!bucketAbierto) {
                reportar(`⚠️ Carpeta '${bucket}' no encontrada. Saltando.`);
                continue;
            }
            await new Promise(r => setTimeout(r, 4000));

            // 2. Obtener lista de técnicos bajo esta carpeta
            const tecnicos = await obtenerTecnicosDelBucket(page, bucket, reportar);

            if (tecnicos.length === 0) {
                reportar(`⚠️ No se encontraron técnicos en '${bucket}'. Saltando.`);
                continue;
            }

            reportar(`👥 ${tecnicos.length} técnicos: ${tecnicos.map(t => t.nombre).join(' | ')}`);

            // 3. Por cada técnico
            for (const tecnico of tecnicos) {
                reportar(`\n👤 TÉCNICO: ${tecnico.nombre}`);

                // Clickear técnico en sidebar
                await page.mouse.move(tecnico.x, tecnico.y);
                await new Promise(r => setTimeout(r, 200));
                await page.mouse.down();
                await new Promise(r => setTimeout(r, 100));
                await page.mouse.up();
                await new Promise(r => setTimeout(r, 4000));

                // Configurar vista (una vez por técnico)
                await configurarVisualizacionQuirurgica(page, reportar);

                // 4. Por cada fecha
                for (let i = 0; i < fechasAProcesar.length; i++) {
                    const fecha = fechasAProcesar[i];

                    if (process.send) {
                        process.send({ type: 'progress', diaActual: i + 1, fechaProcesando: fecha });
                    } else if (global.BOT_STATUS) {
                        global.BOT_STATUS.diaActual = i + 1;
                        global.BOT_STATUS.fechaProcesando = fecha;
                    }

                    // Loguear cada 5 fechas para no saturar el terminal
                    if (i % 5 === 0 || i === fechasAProcesar.length - 1) {
                        reportar(`📅 [${i + 1}/${fechasAProcesar.length}] ${fecha} — ${tecnico.nombre}`);
                    }

                    await extraerYGuardarDia(page, fecha, bucket, tecnico.nombre, empresaRef, reportar);
                    await new Promise(r => setTimeout(r, 1500));
                }

                reportar(`✅ Técnico ${tecnico.nombre} completado.`);
            }

            reportar(`✅ Carpeta ${bucket} completada.`);
        }

        reportar('\n🏁 ¡DESCARGA MASIVA COMPLETADA!');
        if (process.send) process.send({ type: 'log', text: '🏁 COMPLETADO', completed: true });
        if (global.BOT_STATUS) global.BOT_STATUS.running = false;

    } catch (error) {
        const errMsg = error.message || 'Error desconocido';
        reportar(`❌ ERROR FATAL: ${errMsg}`);
        console.error('❌ ERROR FATAL:', error);
        if (global.BOT_STATUS) {
            global.BOT_STATUS.ultimoError = errMsg;
            global.BOT_STATUS.running = false;
        }
    } finally {
        process.env.BOT_ACTIVE_LOCK = "OFF";
        if (browser) {
            console.log('🔒 Cerrando Chrome...');
            await new Promise(r => setTimeout(r, 5000));
            await browser.close();
        }
    }
};

// =============================================================================
// 👥 OBTENER TÉCNICOS BAJO UNA CARPETA
// Después de expandir el bucket, busca los sub-ítems que son técnicos.
// Técnicos tienen formato "NOMBRE (X/Y)" — la barra los distingue de carpetas "(X)".
// =============================================================================
async function obtenerTecnicosDelBucket(page, bucketName, reportar) {
    await new Promise(r => setTimeout(r, 2000));

    const tecnicos = await page.evaluate((bucket) => {
        const normalizar = (s) => s
            .replace(/\(\d+\/\d+\)/g, '')
            .replace(/\(\d+\)/g, '')
            .replace(/[★☆*]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();

        // Buscar el elemento del bucket en el sidebar
        const todosLosItems = Array.from(document.querySelectorAll(
            'li[role="treeitem"], oj-navigation-list li, [role="tree"] li, ' +
            'oj-navigation-list span, [role="tree"] span'
        ));

        // Fallback: cualquier elemento de texto en la columna izquierda
        const itemsSidebar = todosLosItems.length > 0
            ? todosLosItems
            : Array.from(document.querySelectorAll('span, div, a, li')).filter(e => {
                const rect = e.getBoundingClientRect();
                return rect.left < 400 && rect.width > 10 && rect.height > 5;
            });

        const bucketNorm = normalizar(bucket);
        let bucketRect = null;

        // Encontrar el elemento del bucket por texto
        for (const el of itemsSidebar) {
            const t = el.innerText ? el.innerText.trim() : '';
            if (!t) continue;
            const norm = normalizar(t);
            if (norm === bucketNorm || norm.startsWith(bucketNorm)) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && rect.left < 400) {
                    bucketRect = rect;
                    break;
                }
            }
        }

        if (!bucketRect) return [];

        // Buscar elementos que estén DEBAJO del bucket y más INDENTADOS
        // y que tengan texto con patrón de técnico: "NOMBRE (X/Y)"
        const tecnicos = [];
        const elementosConTexto = Array.from(document.querySelectorAll('span, div, a, li'))
            .filter(e => {
                const rect = e.getBoundingClientRect();
                const t = e.innerText ? e.innerText.trim() : '';
                return rect.width > 0 && rect.height > 5
                    && rect.left < 450
                    && rect.top > bucketRect.top + 5  // Debajo del bucket
                    && t.length > 5
                    && /\(\d+\/\d+\)/.test(t);         // Tiene patrón (X/Y) = técnico
            });

        // Ordenar por posición vertical
        elementosConTexto.sort((a, b) =>
            a.getBoundingClientRect().top - b.getBoundingClientRect().top
        );

        // Tomar sólo los que están en la "columna" del bucket (antes de llegar al siguiente bucket)
        for (const el of elementosConTexto) {
            const rect = el.getBoundingClientRect();
            const rawText = el.innerText.trim();
            const nombre = normalizar(rawText);

            if (nombre.length < 3) continue;
            if (tecnicos.some(t => t.nombre === nombre)) continue; // no duplicar

            tecnicos.push({
                nombre,
                rawText,
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            });
        }

        return tecnicos;
    }, bucketName);

    if (tecnicos.length > 0) {
        reportar(`   🔍 Técnicos encontrados: ${tecnicos.map(t => t.rawText).join(', ')}`);
    } else {
        // Debug: mostrar qué hay en el sidebar si no encontró técnicos
        const debugItems = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('span, li, div'))
                .filter(e => {
                    const rect = e.getBoundingClientRect();
                    const t = e.innerText ? e.innerText.trim() : '';
                    return rect.left < 400 && rect.width > 0 && rect.height > 0 && t.length > 3 && t.length < 80;
                })
                .map(e => e.innerText.trim())
                .filter((v, i, a) => a.indexOf(v) === i)
                .slice(0, 20);
        });
        reportar(`   ⚠️ Sin técnicos. Items sidebar: ${debugItems.join(' | ')}`);
    }

    return tecnicos;
}

// =============================================================================
// 👁️ CONFIGURAR VISTA "TODOS LOS DATOS DE HIJOS"
// =============================================================================
async function configurarVisualizacionQuirurgica(page, reportar) {
    try {
        // Vista de lista
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button, div[role="button"]'))
                .find(b => b.title?.toLowerCase().includes('lista') || b.getAttribute('aria-label')?.toLowerCase().includes('lista'));
            if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 1500));

        // Abrir menú Vista
        const menuAbierto = await page.evaluate(() => {
            const el = Array.from(document.querySelectorAll('button, span.oj-button-text'))
                .find(e => e.innerText.trim() === 'Vista' && e.offsetParent !== null);
            if (el) { el.click(); return true; }
            return false;
        });

        if (!menuAbierto) return;
        await new Promise(r => setTimeout(r, 1500));

        // Click en checkbox "Todos los datos de hijos"
        const coords = await page.evaluate(() => {
            const target = Array.from(document.querySelectorAll('*'))
                .filter(el => el.children.length === 0
                    && el.innerText
                    && el.innerText.includes('Todos los datos de hijos'))
                .find(el => {
                    const r = el.getBoundingClientRect();
                    return r.width > 0 && r.height > 0;
                });
            if (!target) return null;
            const rect = target.getBoundingClientRect();
            return { x: rect.x, y: rect.y, height: rect.height };
        });

        if (coords) {
            await page.mouse.move(coords.x - 20, coords.y + coords.height / 2);
            await page.mouse.down();
            await new Promise(r => setTimeout(r, 150));
            await page.mouse.up();
            await new Promise(r => setTimeout(r, 1000));
        }

        // Aplicar
        const aplico = await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button, span'))
                .find(b => b.innerText.trim() === 'Aplicar' && b.offsetParent !== null);
            if (btn) { btn.click(); return true; }
            return false;
        });

        if (aplico) {
            await page.waitForFunction(() => {
                return !document.querySelector('.oj-conveyorbelt-overlay')
                    && !document.querySelector('.oj-progress-circle-indeterminate');
            }, { timeout: 20000 }).catch(() => {});
            await new Promise(r => setTimeout(r, 1500));
        }
    } catch (e) {
        if (reportar) reportar('⚠️ Error configurando vista: ' + e.message);
    }
}

// =============================================================================
// 📅 NAVEGAR A FECHA Y GUARDAR TODAS LAS FILAS DEL TÉCNICO
// =============================================================================
async function extraerYGuardarDia(page, fechaTarget, bucket, tecnicoNombre, empresaRef, reportar) {
    const fechaLog = typeof fechaTarget === 'string'
        ? fechaTarget
        : fechaTarget.toISOString().split('T')[0];

    // Navegar hasta la fecha correcta
    let intentos = 0;
    while (intentos < 35) {
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
            if (dActual > dTarget) await clicDiaAnterior(page);
            else                   await clicDiaSiguiente(page);
            await new Promise(r => setTimeout(r, 2500));
        } else {
            await new Promise(r => setTimeout(r, 1500));
        }
        intentos++;
    }

    // Esperar estabilización de tabla
    await page.waitForFunction(() => {
        return !document.querySelector('.oj-conveyorbelt-overlay')
            && !document.querySelector('.oj-progress-circle-indeterminate');
    }, { timeout: 10000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1000));

    // Extraer
    let rawData = await extraerTablaCruda(page, fechaLog);
    if (!rawData || rawData.length === 0) {
        await new Promise(r => setTimeout(r, 3000));
        rawData = await extraerTablaCruda(page, fechaLog);
    }

    if (!rawData || rawData.length === 0) return;

    // Guardar — agregar nombre del técnico (no está en la tabla per-técnico)
    const registros = rawData.map(fila => {
        let fechaSafe = fila.fecha || fechaLog;
        if (fechaSafe.length === 10) fechaSafe = `${fechaSafe}T12:00:00.000Z`;
        const doc = {
            ...fila,
            fecha:               fechaSafe,
            bucket,
            recurso:             tecnicoNombre,  // técnico TOA
            cliente:             fila.cliente || 'Movistar',
            ultimaActualizacion: new Date()
        };
        if (empresaRef) doc.empresaRef = empresaRef;
        return doc;
    }).filter(r => r.ordenId && r.ordenId.length > 2);

    if (registros.length === 0) return;

    try {
        const bulkOps = registros.map(r => ({
            updateOne: {
                filter: { ordenId: r.ordenId },
                update: { $set: r },
                upsert: true
            }
        }));
        const result = await Actividad.bulkWrite(bulkOps, { ordered: false });
        if (result.upsertedCount > 0 || result.modifiedCount > 0) {
            const msg = `💾 [${bucket}/${tecnicoNombre}] ${fechaLog}: ${result.upsertedCount} nuevos, ${result.modifiedCount} actualizados`;
            console.log(msg);
            if (reportar) reportar(msg);
        }
    } catch (e) {
        console.error(`❌ MongoDB: ${e.message}`);
        if (reportar) reportar(`❌ MongoDB [${bucket}]: ${e.message}`);
    }
}

// =============================================================================
// 🔭 BUSCADOR EN SIDEBAR — matching flexible (ignora paréntesis y estrellas)
// =============================================================================
async function encontrarYClicarSidebar(page, texto, reportar) {
    // Esperar sidebar Oracle JET
    await page.waitForFunction(() => {
        return document.querySelector('oj-navigation-list, [role="tree"]') !== null;
    }, { timeout: 30000 }).catch(() => {
        if (reportar) reportar('⚠️ Sidebar no detectado, intentando igual...');
    });

    try {
        await page.evaluate(() => {
            const tree = document.querySelector('oj-navigation-list, [role="tree"]');
            if (tree) tree.scrollIntoView({ block: 'start', behavior: 'instant' });
        });
        await new Promise(r => setTimeout(r, 2000));
    } catch (e) {}

    // Debug: mostrar items del sidebar
    const itemsVisibles = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('span, a, div, li'))
            .filter(e => {
                const t = e.innerText ? e.innerText.trim() : '';
                const rect = e.getBoundingClientRect();
                return t.length > 2 && t.length < 60 && rect.width > 0 && rect.height > 0 && rect.left < 450;
            })
            .map(e => e.innerText.trim())
            .filter((v, i, a) => a.indexOf(v) === i)
            .slice(0, 25);
    });
    if (reportar) reportar(`🔍 Sidebar: ${itemsVisibles.join(' | ')}`);

    for (let i = 0; i < 5; i++) {
        const coords = await page.evaluate((txt) => {
            const normalizar = (s) => s
                .replace(/\(\d+\/\d+\)/g, '')
                .replace(/\(\d+\)/g, '')
                .replace(/[★☆*]/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .toUpperCase();

            const txtNorm = normalizar(txt);
            const el = Array.from(document.querySelectorAll('span, a, div, li')).find(e => {
                const raw = e.innerText ? e.innerText.trim() : '';
                if (!raw || raw.length > 80) return false;
                const norm = normalizar(raw);
                if (!norm.includes(txtNorm) && !txtNorm.includes(norm)) return false;
                const rect = e.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && rect.left < 450;
            });
            if (!el) return { encontrado: false };
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const rect = el.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, encontrado: true, texto: el.innerText.trim() };
        }, texto);

        if (coords.encontrado) {
            if (reportar) reportar(`📍 Encontrado "${coords.texto}" → clickeando`);
            await page.mouse.move(coords.x, coords.y);
            await new Promise(r => setTimeout(r, 200));
            await page.mouse.down();
            await new Promise(r => setTimeout(r, 100));
            await page.mouse.up();
            await new Promise(r => setTimeout(r, 4000));
            return true;
        }

        if (reportar) reportar(`⏳ Intento ${i + 1}/5 buscando '${texto}'...`);
        await new Promise(r => setTimeout(r, 4000));
    }
    return false;
}

// =============================================================================
// 🕸️ SCRAPER DE TABLA — V3 (Headers + Geometría) + V2 fallback
// =============================================================================
async function extraerTablaCruda(page, fechaISO) {
    return await page.evaluate((fecha) => {
        // ── V3: Headers geométricos ────────────────────────────────────────────
        let headerCells = Array.from(document.querySelectorAll('.oj-datagrid-header-cell'));
        if (!headerCells.length) headerCells = Array.from(document.querySelectorAll('[role="columnheader"]'));

        if (headerCells.length > 0) {
            const headers = headerCells.map(h => {
                const r = h.getBoundingClientRect();
                return { text: h.innerText.trim(), left: r.left, right: r.right, center: r.left + r.width / 2 };
            }).filter(h => h.text);

            const mapaFilas = new Map();
            Array.from(document.querySelectorAll('.oj-datagrid-cell')).forEach(celda => {
                const r = celda.getBoundingClientRect();
                const y = Math.round(r.top / 5) * 5;
                if (!mapaFilas.has(y)) mapaFilas.set(y, []);
                mapaFilas.get(y).push({ rect: r, text: celda.innerText.trim() });
            });

            const resultados = [];
            mapaFilas.forEach(celdas => {
                const fila = { fecha, origen: 'TOA_V3' };
                celdas.forEach(celda => {
                    const cx = celda.rect.left + celda.rect.width / 2;
                    let hdr = headers.find(h => cx >= h.left && cx <= h.right);
                    if (!hdr) hdr = headers.reduce((p, c) => Math.abs(c.center - cx) < Math.abs(p.center - cx) ? c : p, headers[0]);
                    if (hdr && Math.abs(hdr.center - cx) <= 120) {
                        fila[hdr.text.replace(/\./g, '_').trim()] = celda.text;
                    }
                });

                fila.ordenId    = fila['Número orden'] || fila['Numero orden'] || fila['Petición'] || fila['ID'] || fila['Orden'] || '';
                fila.actividad  = fila['Subtipo de Actividad'] || fila['Tipo Trabajo'] || fila['Actividad'] || '';
                const lat = fila['Direccion Polar Y'] || fila['Latitud'];
                const lon = fila['Direccion Polar X'] || fila['Longitud'];
                if (lat) fila.latitud  = lat.replace(',', '.');
                if (lon) fila.longitud = lon.replace(',', '.');

                if (fila.ordenId && fila.ordenId.length > 3) resultados.push(fila);
            });

            if (resultados.length > 0) return resultados;
        }

        // ── V2: Regex fallback ─────────────────────────────────────────────────
        const celdas = Array.from(document.querySelectorAll('.oj-datagrid-cell'));
        if (!celdas.length) return [];

        const mapaFilasV2 = new Map();
        celdas.forEach(c => {
            const r = c.getBoundingClientRect();
            const y = Math.round(r.top / 5) * 5;
            if (!mapaFilasV2.has(y)) mapaFilasV2.set(y, []);
            mapaFilasV2.get(y).push({ x: r.left, texto: c.innerText.trim() });
        });

        const resultadosV2 = [];
        mapaFilasV2.forEach(items => {
            items.sort((a, b) => a.x - b.x);
            const texto = items.map(i => i.texto).join(' ');
            const m = texto.match(/(INC\d+|WO-\d+|REQ\d+|12\d{8})/);
            if (!m) return;
            const mc = texto.match(/(-33\.\d+).*?(-70\.\d+)|(-70\.\d+).*?(-33\.\d+)/);
            resultadosV2.push({
                origen: 'TOA_V2', fecha,
                ordenId: m[0], actividad: '', dataRawCompleta: texto,
                latitud: mc ? (mc[1] || mc[4]) : null,
                longitud: mc ? (mc[2] || mc[3]) : null
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
        let t = btns.find(el => /(previous|anterior|atras)/i.test(el.title || el.ariaLabel || ''));
        if (!t) {
            const iconos = Array.from(document.querySelectorAll('span.oj-button-icon'));
            t = iconos.find(i => { const r = i.getBoundingClientRect(); return r.top < 200 && r.width > 0; });
            if (t?.parentElement) t = t.parentElement;
        }
        if (!t) return { ok: false };
        const r = t.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, ok: true };
    });
    if (coords?.ok) {
        await page.mouse.move(coords.x, coords.y);
        await page.mouse.down(); await new Promise(r => setTimeout(r, 100)); await page.mouse.up();
    } else {
        await page.keyboard.press('ArrowLeft');
    }
}

async function clicDiaSiguiente(page) {
    const coords = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, div[role="button"], a, span'));
        let t = btns.find(el => /(next|siguiente|adelante)/i.test(el.title || el.ariaLabel || ''));
        if (!t) {
            const iconos = Array.from(document.querySelectorAll('span.oj-button-icon'));
            t = iconos.find(i => { const r = i.getBoundingClientRect(); return r.top < 200 && r.width > 0; });
            if (t?.parentElement) t = t.parentElement;
        }
        if (!t) return { ok: false };
        const r = t.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, ok: true };
    });
    if (coords?.ok) {
        await page.mouse.move(coords.x, coords.y);
        await page.mouse.down(); await new Promise(r => setTimeout(r, 100)); await page.mouse.up();
    } else {
        await page.keyboard.press('ArrowRight');
    }
}

// =============================================================================
// 🔐 LOGIN COMPLETO TOA — espera activa por resultado real en cada paso
// Flujo TOA:
//   1. Llenar usuario + contraseña → click Iniciar
//   2. TOA muestra checkpoint: "Bienvenido a [user]" + checkbox + contraseña
//   3. Marcar checkbox + re-ingresar contraseña → click Iniciar
//   4. Dashboard carga
// =============================================================================
async function loginAtomico(page, credenciales = {}) {
    const usuario = credenciales.usuario || process.env.BOT_TOA_USER || process.env.TOA_USER_REAL;
    const clave   = credenciales.clave   || process.env.BOT_TOA_PASS  || process.env.TOA_PASS_REAL;
    const toaUrl  = process.env.TOA_URL  || 'https://telefonica-cl.etadirect.com/';

    // ── Helper: detectar estado de la página ─────────────────────────────────
    const detectarEstado = async (timeout = 30000) => {
        return await page.waitForFunction(() => {
            // Dashboard cargado
            if (document.querySelector('oj-navigation-list') ||
                document.querySelector('.oj-navigation-list') ||
                document.querySelector('[role="tree"]')) return 'dashboard';
            // Checkpoint de sesión duplicada (checkbox visible)
            const cb = document.querySelector('input[type="checkbox"]');
            if (cb) return 'checkpoint';
            return false;
        }, { timeout }).then(h => h.jsonValue()).catch(() => 'timeout');
    };

    // ── Helper: click físico en botón "Iniciar" ───────────────────────────────
    const clickIniciar = async () => {
        const coords = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
            const btn  = btns.find(b => /iniciar|sign in|login|entrar/i.test(b.textContent || b.value || ''))
                      || btns.find(b => b.type === 'submit')
                      || btns[0];
            if (!btn) return null;
            const r = btn.getBoundingClientRect();
            return r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
        });
        if (coords) {
            await page.mouse.move(coords.x, coords.y);
            await new Promise(r => setTimeout(r, 200));
            await page.mouse.down();
            await new Promise(r => setTimeout(r, 150));
            await page.mouse.up();
        } else {
            await page.keyboard.press('Enter');
        }
    };

    // ── Helper: llenar campo con foco + valor + eventos ───────────────────────
    const llenarCampo = async (selector, valor) => {
        await page.evaluate((sel, val) => {
            const el = document.querySelector(sel);
            if (!el) return;
            el.focus();
            // Limpiar y establecer valor
            el.value = '';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.value = val;
            el.dispatchEvent(new Event('input',  { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        }, selector, valor);
        await new Promise(r => setTimeout(r, 300));
    };

    // ── PASO 1: Cargar página ────────────────────────────────────────────────
    console.log('🌐 Cargando TOA...');
    try {
        await page.goto(toaUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    } catch (e) { throw new Error('TIMEOUT_PORTAL_TOA'); }

    await page.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 })
        .catch(() => { throw new Error('TIMEOUT_LOGIN_INPUTS'); });
    await new Promise(r => setTimeout(r, 3000));

    // ── PASO 2: Llenar formulario de login ───────────────────────────────────
    console.log('📝 Llenando credenciales...');
    // Usuario: primer input visible que no sea password ni checkbox
    await page.evaluate((usr) => {
        const campos = Array.from(document.querySelectorAll('input')).filter(el => {
            const s = window.getComputedStyle(el);
            return el.type !== 'password' && el.type !== 'checkbox' && el.type !== 'hidden'
                && s.display !== 'none' && s.visibility !== 'hidden';
        });
        if (campos[0]) {
            campos[0].focus(); campos[0].value = usr;
            campos[0].dispatchEvent(new Event('input',  { bubbles: true }));
            campos[0].dispatchEvent(new Event('change', { bubbles: true }));
        }
    }, usuario);
    await new Promise(r => setTimeout(r, 500));
    await llenarCampo('input[type="password"]', clave);

    // ── PASO 3: Click Iniciar y esperar resultado ─────────────────────────────
    console.log('🖱️ Click Iniciar (1er intento)...');
    await clickIniciar();

    const estado1 = await detectarEstado(30000);
    console.log(`   → Estado tras 1er click: ${estado1}`);

    if (estado1 === 'dashboard') {
        console.log('✅ Login directo exitoso.');
        return;
    }

    // ── PASO 4: Manejar checkpoint de sesión duplicada ────────────────────────
    // TOA muestra: "Bienvenido a [usuario]" + checkbox + campo contraseña + "Iniciar"
    if (estado1 === 'checkpoint' || estado1 === 'timeout') {
        const hayCheckbox = await page.evaluate(() => !!document.querySelector('input[type="checkbox"]'));

        if (hayCheckbox) {
            console.log('⚠️ Checkpoint sesión duplicada — marcando checkbox y reingresando clave...');

            // Marcar checkbox con click físico
            const cbCoords = await page.evaluate(() => {
                const cb = document.querySelector('input[type="checkbox"]');
                if (!cb) return null;
                const r = cb.getBoundingClientRect();
                return r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
            });
            if (cbCoords) {
                await page.mouse.move(cbCoords.x, cbCoords.y);
                await page.mouse.down();
                await new Promise(r => setTimeout(r, 150));
                await page.mouse.up();
            } else {
                await page.evaluate(() => {
                    const cb = document.querySelector('input[type="checkbox"]');
                    if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
                });
            }
            await new Promise(r => setTimeout(r, 1500));

            // Re-ingresar contraseña en el campo del checkpoint
            await llenarCampo('input[type="password"]', clave);
            await new Promise(r => setTimeout(r, 500));

            console.log('🖱️ Click Iniciar (2do intento tras checkpoint)...');
            await clickIniciar();

            // Esperar dashboard con más tiempo (TOA puede tardar en cargar)
            const estado2 = await detectarEstado(60000);
            console.log(`   → Estado tras 2do click: ${estado2}`);

            if (estado2 === 'dashboard') {
                console.log('✅ Login exitoso tras checkpoint.');
                return;
            }

            // Si aún hay checkpoint, intentar una vez más
            const hayCheckbox2 = await page.evaluate(() => !!document.querySelector('input[type="checkbox"]'));
            if (hayCheckbox2) {
                console.log('⚠️ Checkpoint persiste — 3er intento...');
                await page.evaluate(() => {
                    const cb = document.querySelector('input[type="checkbox"]');
                    if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
                });
                await new Promise(r => setTimeout(r, 1000));
                await llenarCampo('input[type="password"]', clave);
                await new Promise(r => setTimeout(r, 500));
                await clickIniciar();
                await detectarEstado(60000);
            }
        }

        // Verificación final: ¿estamos en el dashboard?
        const enDashboard = await page.evaluate(() => {
            return !!(document.querySelector('oj-navigation-list') ||
                      document.querySelector('.oj-navigation-list') ||
                      document.querySelector('[role="tree"]'));
        });
        if (enDashboard) {
            console.log('✅ Login verificado — dashboard detectado.');
        } else {
            console.log('⚠️ Login: dashboard no detectado, pero continuando...');
        }
    }

    console.log('✅ loginAtomico completado.');
}

// =============================================================================
module.exports = { iniciarExtraccion };

if (require.main === module) {
    const credencialesEnv = {
        usuario: process.env.BOT_TOA_USER || process.env.TOA_USER_REAL,
        clave:   process.env.BOT_TOA_PASS  || process.env.TOA_PASS_REAL
    };
    mongoose.connect(process.env.MONGO_URI)
        .then(() => {
            console.log('✅ MongoDB conectado. Iniciando bot...');
            iniciarExtraccion(
                process.env.BOT_FECHA_INICIO || null,
                process.env.BOT_FECHA_FIN    || null,
                credencialesEnv
            );
        })
        .catch(err => { console.error('❌ MongoDB:', err.message); process.exit(1); });
}

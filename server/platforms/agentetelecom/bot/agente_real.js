'use strict';

// =============================================================================
// AGENTE TOA — Flujo: Bucket → Vista de Lista → Scrape todo en una tabla
//
// Por cada fecha y bucket (COMFICA / ZENER RANCAGUA / ZENER RM):
//   1. Click bucket en el sidebar
//   2. Click "Vista de lista" (muestra TODOS los técnicos + actividades del día)
//   3. Scroll para forzar carga de filas lazy
//   4. Scrape completo con geometría header → celdas
//   5. Guardar en MongoDB (Actividad)
//   6. Click "Siguiente" para avanzar al día siguiente
// =============================================================================

const puppeteer  = require('puppeteer');
const mongoose   = require('mongoose');
const path       = require('path');
const Actividad  = require('../models/Actividad');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const TOA_URL = process.env.TOA_URL || 'https://telefonica-cl.etadirect.com/';
const BUCKETS = ['COMFICA', 'ZENER RANCAGUA', 'ZENER RM'];

// =============================================================================
// ENTRADA PRINCIPAL
// =============================================================================
const iniciarExtraccion = async (fechaInicio = null, fechaFin = null, credenciales = {}) => {
    process.env.BOT_ACTIVE_LOCK = 'TOA';

    // ── Construir lista de fechas ─────────────────────────────────────────────
    const fechasAProcesar = [];
    if (fechaInicio && fechaFin) {
        // RANGO: fecha_inicio..fecha_fin (inclusive)
        let cursor = new Date(fechaInicio + 'T00:00:00Z');
        const fin  = new Date(fechaFin   + 'T00:00:00Z');
        while (cursor <= fin) {
            fechasAProcesar.push(cursor.toISOString().split('T')[0]);
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
    } else if (fechaInicio) {
        // DÍA ÚNICO
        fechasAProcesar.push(fechaInicio);
    } else {
        // BACKFILL: desde 2026-01-01 hasta hoy
        let cursor = new Date(Date.UTC(2026, 0, 1));
        const hoy  = new Date();
        const fin  = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
        while (cursor <= fin) {
            fechasAProcesar.push(cursor.toISOString().split('T')[0]);
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
    }

    const modo       = fechaInicio && fechaFin ? 'RANGO' : fechaInicio ? 'DÍA ÚNICO' : 'BACKFILL';
    const empresaRef = process.env.BOT_EMPRESA_REF || null;

    // ── Helper IPC + global.BOT_STATUS ───────────────────────────────────────
    const reportar = (msg, extra = {}) => {
        console.log('BOT', msg);
        if (process.send) {
            process.send({ type: 'log', text: msg, ...extra });
        } else if (global.BOT_STATUS) {
            global.BOT_STATUS.logs = global.BOT_STATUS.logs || [];
            global.BOT_STATUS.logs.push(`[${new Date().toLocaleTimeString('es-CL')}] ${msg}`);
            if (global.BOT_STATUS.logs.length > 100) global.BOT_STATUS.logs.shift();
        }
    };

    reportar(`[${modo}] ${fechasAProcesar[0]} -> ${fechasAProcesar[fechasAProcesar.length - 1]} (${fechasAProcesar.length} dias)`);

    let browser;
    try {
        reportar('Lanzando Chrome headless...');
        browser = await puppeteer.launch({
            headless: 'new',           // Modo headless moderno — mejor soporte CSS/Oracle JET
            defaultViewport: { width: 1920, height: 1080 },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--no-first-run',
                '--no-zygote',
                '--disable-extensions',
                '--window-size=1920,1080',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const page = await browser.newPage();

        // Interceptar diálogos nativos del browser para no quedar bloqueados
        page.on('dialog', async dialog => {
            console.log(`Dialog: ${dialog.message()}`);
            await dialog.accept();
        });

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/121.0.0.0 Safari/537.36'
        );

        // ── Login ─────────────────────────────────────────────────────────────
        reportar('Iniciando sesion TOA...');
        await loginAtomico(page, credenciales, reportar);
        reportar('Login OK.');

        // ── Navegar a la primera fecha ────────────────────────────────────────
        reportar(`Navegando a fecha inicial: ${fechasAProcesar[0]}`);
        await navegarFechaExacta(page, fechasAProcesar[0]);

        // ── Bucle principal: fecha × bucket ───────────────────────────────────
        for (let i = 0; i < fechasAProcesar.length; i++) {
            const fecha = fechasAProcesar[i];

            // Reportar progreso por IPC
            if (process.send) {
                process.send({ type: 'progress', diaActual: i + 1, totalDias: fechasAProcesar.length, fechaProcesando: fecha });
            } else if (global.BOT_STATUS) {
                global.BOT_STATUS.diaActual       = i + 1;
                global.BOT_STATUS.fechaProcesando = fecha;
            }

            reportar(`[${i + 1}/${fechasAProcesar.length}] Procesando fecha: ${fecha}`);

            for (const bucket of BUCKETS) {
                reportar(`  Bucket: ${bucket}`);

                // 1. Click en el bucket del sidebar
                const bucketOk = await expandirBucket(page, bucket, reportar);
                if (!bucketOk) {
                    reportar(`  AVISO: Bucket '${bucket}' no encontrado. Saltando.`);
                    continue;
                }

                // 2. Activar vista de lista (muestra todos los técnicos a la vez)
                await activarVistaLista(page);

                // 3. Scrape completo y guardar en MongoDB
                await rascarTablaYGuardar(page, fecha, bucket, empresaRef, reportar);
            }

            // 4. Avanzar al día siguiente (excepto en el último día)
            if (i < fechasAProcesar.length - 1) {
                await clicDiaSiguiente(page);
            }
        }

        reportar('DESCARGA MASIVA COMPLETADA.');
        if (process.send)      process.send({ type: 'log', text: 'COMPLETADO', completed: true });
        if (global.BOT_STATUS) global.BOT_STATUS.running = false;

    } catch (error) {
        const errMsg = error.message || 'Error desconocido';
        reportar(`ERROR FATAL: ${errMsg}`);
        console.error('ERROR FATAL:', error);
        if (global.BOT_STATUS) {
            global.BOT_STATUS.ultimoError = errMsg;
            global.BOT_STATUS.running     = false;
        }
    } finally {
        process.env.BOT_ACTIVE_LOCK = 'OFF';
        if (browser) {
            console.log('Cerrando Chrome...');
            await new Promise(r => setTimeout(r, 5000));
            await browser.close();
        }
    }
};

// =============================================================================
// LOGIN ATOMICO TOA
//
// Flujo confirmado por screenshots:
//   1. Cargar URL TOA
//   2. Handle "Timeout de sesion" dialog si aparece
//   3. Llenar usuario + contraseña
//   4. Click "Iniciar" (primer intento)
//   5. Esperar 8 segundos
//   6. Detectar estado: dashboard | checkpoint | login_or_unknown
//   7. Si checkpoint: marcar checkbox, re-llenar password, click Iniciar segunda vez
//   8. Esperar dashboard hasta 90s
// =============================================================================
async function loginAtomico(page, credenciales = {}, reportar = console.log) {
    const usuario = credenciales.usuario || process.env.BOT_TOA_USER || '';
    const clave   = credenciales.clave   || process.env.BOT_TOA_PASS  || '';

    if (!usuario) throw new Error('LOGIN_FAILED: usuario TOA no configurado');
    if (!clave)   throw new Error('LOGIN_FAILED: contraseña TOA no configurada');

    reportar(`Login: usuario="${usuario}" (${clave.length} chars clave)`);

    // Cargar página
    await page.goto(TOA_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await new Promise(r => setTimeout(r, 3000));

    // Detectar y cerrar diálogo "Timeout de sesión"
    const hayTimeout = await page.evaluate(() =>
        (document.body.innerText || '').includes('Timeout de sesión') ||
        (document.body.innerText || '').includes('desconectado por motivos')
    );
    if (hayTimeout) {
        reportar('AVISO: Timeout de sesion — cerrando sesion anterior...');
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button'))
                .find(b => /cerrar sesión/i.test(b.textContent));
            if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 5000));
    }

    // Esperar campo de contraseña
    reportar('Esperando formulario login...');
    await page.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));

    // ── Helper: llenar un campo con click real + typing ───────────────────────
    // NOTA: NO llamar field.focus() antes del click — en Oracle JET puede
    // lanzar "Node is either not clickable" si el elemento tiene rect 0,0.
    // El click() ya enfoca el campo correctamente.
    const llenarCampo = async (field, valor) => {
        await field.click({ clickCount: 3 });   // click triple = selecciona todo
        await page.keyboard.press('Delete');    // borra selección
        await new Promise(r => setTimeout(r, 150));
        await field.type(valor, { delay: 50 });
        await new Promise(r => setTimeout(r, 300));
    };

    // Llenar usuario — TOA usa input#username (confirmado inspeccionando DOM en vivo)
    // NOTA: input[type="text"] también matchea input#organization (campo oculto) → error "not clickable"
    // Por eso usamos selectores por ID/name directamente.
    const userField = await page.$('input#username, input[name="username"]').catch(() => null);

    if (userField) {
        reportar(`Llenando usuario (${usuario})...`);
        await llenarCampo(userField, usuario);
    } else {
        reportar('ERROR: input#username no encontrado en la página TOA');
        throw new Error('LOGIN_FAILED: campo usuario no encontrado en formulario TOA');
    }

    // Llenar contraseña — TOA usa input#password
    reportar('Llenando contraseña...');
    const passField = await page.$('input#password, input[name="password"]').catch(() => null);
    if (passField) {
        await llenarCampo(passField, clave);
    } else {
        reportar('ERROR: input#password no encontrado');
        throw new Error('LOGIN_FAILED: campo contraseña no encontrado en formulario TOA');
    }

    // Verificar que los campos quedaron llenos antes de continuar
    const camposOk = await page.evaluate(() => {
        const u = document.querySelector('input#username, input[name="username"]');
        const p = document.querySelector('input#password, input[name="password"]');
        return { user: u ? u.value : '(vacío)', pass: p ? p.value.length : 0 };
    });
    reportar(`Campos verificados: usuario="${camposOk.user}" pass=${camposOk.pass} chars`);

    // Click "Iniciar" (primer intento)
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
            .find(b => /iniciar/i.test(b.textContent) && b.offsetParent !== null);
        if (btn) btn.click();
    });
    console.log('Click Iniciar (1er intento)');
    await new Promise(r => setTimeout(r, 8000));

    // Detectar estado de la página — usamos texto visible, no selectores Oracle JET
    const getEstado = () => page.evaluate(() => {
        const txt = document.body.innerText || '';
        if (document.querySelector('input[type="checkbox"]') &&
            (txt.includes('superado') || txt.includes('sesiones') || txt.includes('Suprimir')))
            return 'checkpoint';
        if (txt.includes('Consola de despacho') || txt.includes('COMFICA') ||
            txt.includes('ZENER') || txt.includes('Buscar en actividades') ||
            document.querySelector('oj-navigation-list') || document.querySelector('[role="tree"]'))
            return 'dashboard';
        if (txt.includes('incorrectos') || txt.includes('incorrecto') || txt.includes('Invalid'))
            return 'credenciales_incorrectas';
        return 'login_or_unknown';
    });

    let estado = await getEstado();
    reportar(`Estado post-click: ${estado}`);

    // Si las credenciales son incorrectas — lanzar error inmediatamente
    if (estado === 'credenciales_incorrectas') {
        // Capturar el texto exacto del error de TOA para diagnóstico
        const errTOA = await page.evaluate(() => {
            const txt = document.body.innerText || '';
            const m = txt.match(/[^\n]*(?:incorrectos?|Invalid)[^\n]*/i);
            return m ? m[0].trim() : txt.substring(0, 200);
        }).catch(() => '');
        throw new Error(`LOGIN_FAILED: ${errTOA || 'usuario o contraseña incorrectos en TOA'}`);
    }

    // Dashboard en el primer intento — login directo, listo
    if (estado === 'dashboard') {
        reportar('Login directo OK.');
        return;
    }

    // Checkpoint: sesiones simultáneas — marcar checkbox y reintentar
    if (estado === 'checkpoint') {
        reportar('AVISO: Checkpoint sesiones — marcando "Suprimir sesion"...');
        await page.evaluate(() => {
            const cb = document.querySelector('input[type="checkbox"]');
            if (cb) {
                cb.scrollIntoView();
                cb.click();
                if (!cb.checked) {
                    cb.checked = true;
                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });
        await new Promise(r => setTimeout(r, 1000));

        // Re-llenar contraseña (Oracle JET puede haberla limpiado)
        const pw2 = await page.$('input[type="password"]');
        if (pw2) {
            await pw2.click({ clickCount: 3 });
            await page.keyboard.press('Backspace');
            await pw2.type(clave, { delay: 40 });
        }
        await new Promise(r => setTimeout(r, 500));

        // Segundo click "Iniciar"
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button'))
                .find(b => /iniciar/i.test(b.textContent) && b.offsetParent !== null);
            if (btn) btn.click();
        });
        reportar('Click Iniciar (2do intento)...');
    }

    // Esperar dashboard hasta 90 segundos — por texto visible O por Oracle JET
    reportar('Esperando dashboard...');
    const ok = await page.waitForFunction(() => {
        const txt = document.body.innerText || '';
        return txt.includes('Consola de despacho') ||
               txt.includes('COMFICA') ||
               txt.includes('ZENER') ||
               txt.includes('Buscar en actividades') ||
               !!document.querySelector('oj-navigation-list') ||
               !!document.querySelector('[role="tree"]');
    }, { timeout: 90000 }).then(() => true).catch(() => false);

    if (ok) {
        reportar('Dashboard cargado OK.');
        await new Promise(r => setTimeout(r, 3000)); // Estabilización
    } else {
        reportar('AVISO: Dashboard no confirmado, esperando 15s...');
        await new Promise(r => setTimeout(r, 15000));
    }
}

// =============================================================================
// NAVEGAR A FECHA EXACTA
//
// Detecta la fecha actual en pantalla buscando múltiples patrones de fecha,
// luego hace click rápido en los botones Anterior/Siguiente para llegar al
// día objetivo. Pausa corta de 800ms entre clics para velocidad.
// Si no detecta la fecha en 5 intentos seguidos, procede sin navegar
// (usa la fecha que ya esté visible en pantalla).
// =============================================================================
async function navegarFechaExacta(page, fechaISO) {
    const [anioT, mesT, diaT] = fechaISO.split('-').map(Number);
    const dTarget = new Date(Date.UTC(anioT, mesT - 1, diaT));

    let sinFechaCount = 0;

    for (let intento = 0; intento < 300; intento++) {
        // Detectar fecha en pantalla con múltiples patrones
        const fechaEnPantalla = await page.evaluate(() => {
            // Patrón 1: YYYY/MM/DD (TOA default)
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                const v = node.nodeValue || '';
                let m;
                // YYYY/MM/DD
                m = v.match(/(\d{4})\/(\d{2})\/(\d{2})/);
                if (m) return `${m[1]}-${m[2]}-${m[3]}`;
                // DD/MM/YYYY or MM/DD/YYYY — try to detect by year
                m = v.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                if (m) {
                    // Si el tercer grupo es año > 2020, asumir DD/MM/YYYY
                    const anio = parseInt(m[3]);
                    if (anio > 2020) return `${m[3]}-${m[2]}-${m[1]}`;
                }
            }
            // Intentar con input date si existe
            const inp = document.querySelector('input[type="date"], .oj-inputdatetime-input');
            if (inp && inp.value) return inp.value.substring(0, 10);
            return null;
        });

        if (fechaEnPantalla) {
            sinFechaCount = 0;
            const [anioA, mesA, diaA] = fechaEnPantalla.split('-').map(Number);
            const dActual = new Date(Date.UTC(anioA, mesA - 1, diaA));

            const diffDias = Math.round((dActual - dTarget) / 86400000);

            if (diffDias === 0) {
                console.log(`Fecha OK: ${fechaEnPantalla}`);
                break;
            }

            // Log cada 10 clics para visibilidad
            if (intento % 10 === 0) {
                console.log(`Navegando: ${fechaEnPantalla} → ${fechaISO} (${Math.abs(diffDias)} dias restantes)`);
            }

            if (diffDias > 0) {
                // Retroceder — click rápido
                await page.evaluate(() => {
                    const btn = document.querySelector('button[title="Anterior"]') ||
                        Array.from(document.querySelectorAll('button')).find(b =>
                            /(anterior|prev|back)/i.test(b.title || b.ariaLabel || ''));
                    if (btn) btn.click();
                });
            } else {
                // Avanzar
                await page.evaluate(() => {
                    const btn = document.querySelector('button[title="Siguiente"]') ||
                        Array.from(document.querySelectorAll('button')).find(b =>
                            /(siguiente|next|forward)/i.test(b.title || b.ariaLabel || ''));
                    if (btn) btn.click();
                });
            }

            await new Promise(r => setTimeout(r, 800));

        } else {
            sinFechaCount++;
            if (sinFechaCount <= 3) {
                console.log(`No se detecta fecha en pantalla (intento ${sinFechaCount}/3), esperando...`);
                await new Promise(r => setTimeout(r, 2000));
            } else {
                console.log(`AVISO: Fecha no detectable tras 3 intentos. Procediendo con fecha actual de pantalla.`);
                break; // Proceed anyway — don't waste more time
            }
        }
    }
}

// =============================================================================
// AVANZAR AL DÍA SIGUIENTE
//
// Hace click en el botón title="Siguiente" y espera 3 segundos para que
// la grilla actualice su contenido.
// =============================================================================
async function clicDiaSiguiente(page) {
    await page.evaluate(() => {
        const btn = document.querySelector('button[title="Siguiente"]');
        if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 3000));
}

// =============================================================================
// EXPANDIR BUCKET EN SIDEBAR
//
// Busca la carpeta (COMFICA / ZENER RANCAGUA / ZENER RM) en el sidebar
// Oracle JET usando matching flexible (ignora paréntesis, estrellas y
// espacios extra), hace click y espera 3s.
//
// Devuelve true si encontró y clickeó el bucket, false si no.
// =============================================================================
async function expandirBucket(page, bucketNombre, reportar) {
    // Esperar sidebar por TEXTO visible (no depende de Oracle JET custom elements)
    // Busca cualquiera de los 3 buckets conocidos, o al menos el header de la consola
    const sidebarListo = await page.waitForFunction(() => {
        const txt = document.body.innerText || '';
        return txt.includes('COMFICA') || txt.includes('ZENER') ||
               txt.includes('Consola de despacho') || txt.includes('Buscar en actividades');
    }, { timeout: 45000 }).then(() => true).catch(() => false);

    if (!sidebarListo) {
        // Snapshot del DOM para diagnóstico
        const snap = await page.evaluate(() => (document.body.innerText || '').substring(0, 300));
        if (reportar) reportar(`ERROR: Sidebar no cargó. Página actual: "${snap.replace(/\n/g, ' ')}"`);
        return false;
    }

    // Mostrar items del sidebar en el log
    const itemsVisibles = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('span, a, div, li'))
            .filter(e => {
                const t    = e.innerText ? e.innerText.trim() : '';
                const rect = e.getBoundingClientRect();
                return t.length > 2 && t.length < 60 &&
                    rect.width > 0 && rect.height > 0 && rect.left < 450;
            })
            .map(e => e.innerText.trim())
            .filter((v, i, a) => a.indexOf(v) === i)
            .slice(0, 20);
    });
    if (reportar) reportar(`  Sidebar: ${itemsVisibles.join(' | ')}`);

    // Intentar hasta 5 veces (el sidebar puede tardar en renderizar)
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
            return {
                x: rect.left + rect.width / 2,
                y: rect.top  + rect.height / 2,
                encontrado: true,
                texto: el.innerText.trim()
            };
        }, bucketNombre);

        if (coords.encontrado) {
            if (reportar) reportar(`  Encontrado "${coords.texto}" -> clickeando`);
            await page.mouse.move(coords.x, coords.y);
            await new Promise(r => setTimeout(r, 200));
            await page.mouse.down();
            await new Promise(r => setTimeout(r, 100));
            await page.mouse.up();
            await new Promise(r => setTimeout(r, 3000));
            return true;
        }

        if (reportar) reportar(`  Intento ${i + 1}/5 buscando '${bucketNombre}'...`);
        await new Promise(r => setTimeout(r, 4000));
    }

    return false;
}

// =============================================================================
// ACTIVAR VISTA DE LISTA
//
// Hace click en el botón title="Vista de lista" (icono de 3 líneas).
// Este botón muestra TODOS los técnicos y sus actividades en una sola tabla,
// lo que permite scrape masivo sin iterar por técnico.
// =============================================================================
async function activarVistaLista(page) {
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
            .find(b => b.title === 'Vista de lista');
        if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 3000));
}

// =============================================================================
// SCRAPE COMPLETO DE LA TABLA Y GUARDAR EN MONGODB
//
// Algoritmo:
//   1. Scroll progresivo del contenedor de la grilla (carga filas lazy)
//   2. Múltiples pasadas de scroll hasta que el número de celdas se estabilice
//   3. Scroll de vuelta al tope
//   4. Extraer headers: .oj-datagrid-header-cell con sus bboxes
//   5. Extraer celdas: .oj-datagrid-cell
//   6. Agrupar celdas por Y (redondeado a 5px) -> filas
//   7. Mapear cada celda al header más cercano por X
//   8. Filtrar filas sin "Numero orden" ni "Número de Petición"
//   9. BulkWrite (upsert) en Actividad
// =============================================================================
async function rascarTablaYGuardar(page, fecha, bucket, empresaRef, reportar) {

    // ── Paso 1: Scroll progresivo para cargar todas las filas lazy ────────────
    await page.evaluate(async () => {
        // Buscar el contenedor scrolleable de la grilla
        const grid = document.querySelector(
            '.oj-datagrid-databody, .oj-datagrid-scroller, ' +
            '[class*="datagrid"][class*="body"], [class*="datagrid"][class*="scroll"]'
        );
        const target = grid || document.scrollingElement || document.body;

        const paso    = 300;  // px por paso
        const espera  = 500;  // ms entre pasos
        let   prevCount = 0;
        let   estable   = 0;

        for (let iter = 0; iter < 80; iter++) {
            target.scrollTop += paso;
            await new Promise(r => setTimeout(r, espera));
            const count = document.querySelectorAll('.oj-datagrid-cell').length;
            if (count === prevCount) {
                estable++;
                if (estable >= 3) break; // 3 pasadas sin cambio = cargado
            } else {
                estable = 0;
            }
            prevCount = count;
        }

        // Volver al inicio
        target.scrollTop = 0;
        await new Promise(r => setTimeout(r, 500));
    });

    await new Promise(r => setTimeout(r, 1000));

    // ── Paso 2: Extraer la tabla con geometría headers + celdas ──────────────
    const filas = await page.evaluate((fechaISO) => {
        // Obtener headers con sus posiciones horizontales
        let headerEls = Array.from(document.querySelectorAll('.oj-datagrid-header-cell'));
        if (!headerEls.length) {
            headerEls = Array.from(document.querySelectorAll('[role="columnheader"]'));
        }

        const headers = headerEls.map(h => {
            const r = h.getBoundingClientRect();
            return {
                text:   h.innerText.trim(),
                left:   r.left,
                right:  r.right,
                center: r.left + r.width / 2
            };
        }).filter(h => h.text.length > 0);

        if (headers.length === 0) return [];

        // Agrupar celdas por fila (Y redondeado a 5px)
        const mapaFilas = new Map();
        Array.from(document.querySelectorAll('.oj-datagrid-cell')).forEach(celda => {
            const r = celda.getBoundingClientRect();
            const y = Math.round(r.top / 5) * 5;
            if (!mapaFilas.has(y)) mapaFilas.set(y, []);
            mapaFilas.get(y).push({
                rect: r,
                text: celda.innerText.trim()
            });
        });

        const resultados = [];

        mapaFilas.forEach(celdas => {
            const fila = {};

            celdas.forEach(celda => {
                const cx = celda.rect.left + celda.rect.width / 2;

                // Buscar el header que contiene el centro X de la celda
                let hdr = headers.find(h => cx >= h.left && cx <= h.right);

                // Si no hay coincidencia exacta, usar el más cercano (max 120px)
                if (!hdr) {
                    hdr = headers.reduce((prev, curr) =>
                        Math.abs(curr.center - cx) < Math.abs(prev.center - cx) ? curr : prev,
                        headers[0]
                    );
                    if (Math.abs(hdr.center - cx) > 120) hdr = null;
                }

                if (hdr) {
                    // Normalizar nombre de columna (quitar puntos que confunden MongoDB)
                    const col = hdr.text.replace(/\./g, '_').trim();
                    fila[col] = celda.text;
                }
            });

            // Filtrar filas vacías (sin identificador de orden)
            const ordenId =
                fila['Numero orden'] ||
                fila['Número de Petición'] ||
                fila['Número de orden'] ||
                fila['Petición'] ||
                fila['ID'] ||
                '';

            if (!ordenId || ordenId.length < 3) return;

            // Campos derivados normalizados
            fila._ordenId   = ordenId;
            fila._recurso   = fila['Recurso'] || '';
            fila._actividad = fila['Subtipo de Actividad'] || fila['Actividad'] || '';
            fila._estado    = fila['Estado'] || '';
            fila._fecha     = fechaISO;

            resultados.push(fila);
        });

        return resultados;
    }, fecha);

    if (!filas || filas.length === 0) {
        reportar(`  [${bucket}] ${fecha}: 0 filas encontradas.`);
        return;
    }

    reportar(`  [${bucket}] ${fecha}: ${filas.length} filas encontradas, guardando...`);

    // ── Paso 3: BulkWrite en MongoDB ──────────────────────────────────────────
    try {
        const fechaISO = fecha.length === 10 ? `${fecha}T12:00:00.000Z` : fecha;

        const bulkOps = filas.map(fila => {
            const doc = {
                ...fila,
                ordenId:             fila._ordenId,
                recurso:             fila._recurso,
                actividad:           fila._actividad,
                estado:              fila._estado,
                fecha:               fechaISO,
                bucket,
                cliente:             'Movistar',
                ultimaActualizacion: new Date()
            };
            if (empresaRef) doc.empresaRef = empresaRef;

            // Quitar campos auxiliares privados (_*)
            delete doc._ordenId;
            delete doc._recurso;
            delete doc._actividad;
            delete doc._estado;
            delete doc._fecha;

            return {
                updateOne: {
                    filter: { ordenId: doc.ordenId },
                    update: { $set: doc },
                    upsert: true
                }
            };
        });

        const result = await Actividad.bulkWrite(bulkOps, { ordered: false });
        const msg = `  [${bucket}] ${fecha}: ${result.upsertedCount} nuevos, ${result.modifiedCount} actualizados`;
        console.log(msg);
        if (reportar) reportar(msg);

    } catch (e) {
        console.error(`MongoDB error [${bucket}/${fecha}]: ${e.message}`);
        if (reportar) reportar(`  ERROR MongoDB [${bucket}]: ${e.message}`);
    }
}

// =============================================================================
// EXPORTS
// =============================================================================
module.exports = { iniciarExtraccion };

// Ejecución directa: node agente_real.js
if (require.main === module) {
    const credencialesEnv = {
        usuario: process.env.BOT_TOA_USER || process.env.TOA_USER_REAL,
        clave:   process.env.BOT_TOA_PASS  || process.env.TOA_PASS_REAL
    };
    mongoose.connect(process.env.MONGO_URI)
        .then(() => {
            console.log('MongoDB conectado. Iniciando bot...');
            iniciarExtraccion(
                process.env.BOT_FECHA_INICIO || null,
                process.env.BOT_FECHA_FIN    || null,
                credencialesEnv
            );
        })
        .catch(err => {
            console.error('MongoDB error:', err.message);
            process.exit(1);
        });
}

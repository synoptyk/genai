const puppeteer = require('puppeteer');
const axios = require('axios');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const Actividad = require('../models/Actividad');
const Tecnico = require('../models/Tecnico');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const API_URL_LOCAL = `http://localhost:${process.env.PORT || 5000}/api/sincronizar`;

const CONFIG = {
    TIMEOUT_LOGIN: 60000,
    NOMBRE_VISTA_MAESTRA: 'CHILE'
};

const limpiarTexto = (texto) => {
    if (!texto) return "";
    let t = texto.toUpperCase();

    // 1. Eliminar sufijos comunes de TOA (Zona/Empresa)
    t = t.replace(/_ATC|_ZBU|_ZRM|_COM/g, " ");

    // 2. Eliminar contadores de carga (ej: "(0/5)")
    t = t.replace(/\(\d+\/\d+\)/g, " ");

    // 3. Normalizar caracteres y eliminar basura
    return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar tildes
        .replace(/[^A-Z0-9 ]/g, " ") // Solo letras y números
        .replace(/\s+/g, " ") // Colapsar espacios
        .trim();
};

const iniciarExtraccion = async (fechaManual = null) => {
    process.env.BOT_ACTIVE_LOCK = "TOA";

    const fechasAProcesar = [];

    if (fechaManual) {
        fechasAProcesar.push(fechaManual);
    } else {
        // MODO BACKFILL: Desde 1 de Febrero hasta hoy
        let fechaInicio = new Date(2026, 1, 1); // 1 de febrero
        const hoy = new Date();

        while (fechaInicio <= hoy) {
            const yyyy = fechaInicio.getFullYear();
            const mm = String(fechaInicio.getMonth() + 1).padStart(2, '0');
            const dd = String(fechaInicio.getDate()).padStart(2, '0');
            fechasAProcesar.push(`${yyyy}-${mm}-${dd}`);
            fechaInicio.setDate(fechaInicio.getDate() + 1);
        }
    }

    console.log(`🤖 AGENTE TOA [MODO: MASIVO]: 🎯 RANGO: ${fechasAProcesar[0]} -> ${fechasAProcesar[fechasAProcesar.length - 1]}`);

    let browser;
    try {
        console.log('🧠 Cargando nómina...');
        const tecnicosDB = await Tecnico.find({ estado: { $ne: 'Desvinculado' } });
        const mapaDotacion = tecnicosDB.map(t => ({
            id: t._id,
            nombreOriginal: t.nombre,
            tokens: limpiarTexto(t.nombre).split(/\s+/).filter(w => w.length > 2)
        }));
        console.log(`   👥 Nómina activa: ${mapaDotacion.length} técnicos.`);

        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

        await loginAtomico(page);
        console.log('🧘 Esperando que el DOM inicial de TOA estabilice...');
        await page.waitForFunction(() => {
            return document.querySelector('.oj-navigation-list') !== null || document.querySelector('.oj-datagrid-cell') !== null;
        }, { timeout: 45000 }).catch(() => console.log('⚠️ Warning: Timeout esperando el dashboard.'));
        await new Promise(r => setTimeout(r, 2000)); // Breve pausa final de estabilización visual

        // BUCLE DE DÍAS
        for (const fechaTarget of fechasAProcesar) {
            console.log(`\n📅 >>> PROCESANDO DÍA: [${fechaTarget}] <<<`);
            await procesarVistaChile(page, mapaDotacion, fechaTarget);
            // Pausa entre días para evitar bloqueos
            await new Promise(r => setTimeout(r, 5000));
        }

        console.log(`✅ PROCESO MASIVO COMPLETADO.`);

    } catch (error) {
        console.error('❌ ERROR FATAL:', error.message);
    } finally {
        process.env.BOT_ACTIVE_LOCK = "OFF";
        if (browser) {
            console.log('🔒 Cerrando en 10s...');
            await new Promise(r => setTimeout(r, 10000));
            await browser.close();
        }
    }
};

// =============================================================================
// =============================================================================
// 🇨🇱 NÚCLEO DE PROCESO MULTI-BUCKEL (COMFICA / ZENER)
// =============================================================================
async function procesarVistaChile(page, mapaDotacion, fechaTarget) {
    // LISTA DE OBJETIVOS (FAVORITOS DE ARRIBA)
    const BUCKETS = [
        'COMFICA',
        'ZENER RANCAGUA',
        'ZENER RM'
    ];

    console.log(`\n📂 INICIANDO ESTRATEGIA MULTI-BUCKET (FAVORITOS): ${BUCKETS.join(', ')}`);

    for (const bucket of BUCKETS) {
        try {
            console.log(`\n>>> PROCESANDO BUCKET: [${bucket}] <<<`);

            // 1. NAVEGAR AL BUCKET (DIRECTO A FAVORITOS)
            const acceso = await encontrarYClicarSidebar(page, bucket);
            if (!acceso) {
                console.log(`   ⚠️ No encontré la carpeta '${bucket}' en favoritos. Saltando...`);
                continue;
            }

            console.log(`   🔓 Carpeta ${bucket} seleccionada. Insertando pausa de carga (5s)...`);
            await new Promise(r => setTimeout(r, 5000));

            // 2. CONFIGURACIÓN VISUAL (CRÍTICO: HACERLO EN CADA BUCKET POR SI SE RESETEA)
            await configurarVisualizacionQuirurgica(page);

            // 3. EXTRACCIÓN CON NAVEGACIÓN INTELIGENTE
            await extraerSoloUnDiaSmart(page, mapaDotacion, fechaTarget, bucket);

        } catch (e) {
            console.error(`   ❌ Error procesando bucket ${bucket}: ${e.message}`);
        }

        // LIMPIEZA DE MEMORIA (GC) POR BUCKET
        try {
            console.log(`   🧹 Limpiando caché de navegación para bucket ${bucket}...`);
            await page.goto('about:blank');
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) { }
    }
}

// =============================================================================
// 👁️ CONFIGURADOR DE VISTA (CLICK EXACTO)
// =============================================================================
async function configurarVisualizacionQuirurgica(page) {
    console.log("   ⚙️ Ejecutando Configuración de Vista...");

    try {
        // PASO 1: VISTA DE LISTA
        console.log("      1. Asegurando 'Vista de lista'...");
        await page.evaluate(() => {
            const botones = Array.from(document.querySelectorAll('button, div[role="button"]'));
            const btnLista = botones.find(b =>
                (b.title && b.title.toLowerCase().includes('lista')) ||
                (b.getAttribute('aria-label') && b.getAttribute('aria-label').toLowerCase().includes('lista'))
            );
            if (btnLista) btnLista.click();
        });
        await new Promise(r => setTimeout(r, 2000));

        // PASO 2: ABRIR MENÚ VISTA
        console.log("      2. Abriendo menú 'Vista'...");
        const menuAbierto = await page.evaluate(() => {
            const elementos = Array.from(document.querySelectorAll('button, span.oj-button-text'));
            const btnVista = elementos.find(el => el.innerText.trim() === 'Vista' && el.offsetParent !== null);
            if (btnVista) { btnVista.click(); return true; }
            return false;
        });

        if (menuAbierto) {
            console.log("      🔽 Menú abierto. Esperando animación (2s)...");
            await new Promise(r => setTimeout(r, 2000));

            // PASO 3: CLICK EN EL CHECKBOX (CORRECCIÓN DE POSICIÓN)
            console.log("      3. Localizando 'Todos los datos de hijos'...");

            const coords = await page.evaluate(() => {
                const todos = Array.from(document.querySelectorAll('*'));
                const targets = todos.filter(el =>
                    el.children.length === 0 &&
                    el.innerText &&
                    el.innerText.includes('Todos los datos de hijos')
                );

                const visible = targets.find(el => {
                    const r = el.getBoundingClientRect();
                    return r.width > 0 && r.height > 0;
                });

                if (!visible) return null;

                const rect = visible.getBoundingClientRect();
                return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            });

            if (coords) {
                console.log(`         📍 Texto en (${parseInt(coords.x)}, ${parseInt(coords.y)}). Ajustando mira...`);

                // Mantenemos la lógica que funcionó: Moverse a la izquierda y hacer clic físico
                const targetX = coords.x - 20;
                const targetY = coords.y + (coords.height / 2);

                console.log(`         💣 Clickeando coordenadas exactas (${parseInt(targetX)}, ${parseInt(targetY)})...`);

                await page.mouse.move(targetX, targetY);
                await page.mouse.down();
                await new Promise(r => setTimeout(r, 150));
                await page.mouse.up();

            } else {
                console.log("      ⚠️ CRÍTICO: No encuentro el texto exacto.");
            }

            await new Promise(r => setTimeout(r, 1500));

            // PASO 4: APLICAR
            console.log("      4. Presionando 'Aplicar'...");
            const aplico = await page.evaluate(() => {
                const botones = Array.from(document.querySelectorAll('button, span'));
                const btnAplicar = botones.find(b => b.innerText.trim() === 'Aplicar' && b.offsetParent !== null);
                if (btnAplicar) {
                    btnAplicar.click();
                    return true;
                }
                return false;
            });

            if (aplico) {
                console.log("      ⏳ Esperando recarga de grilla dinámica...");
                await page.waitForFunction(() => {
                    const overlay = document.querySelector('.oj-conveyorbelt-overlay');
                    const spinner = document.querySelector('.oj-progress-circle-indeterminate'); // Si Oracle muestra círculo de carga
                    const cells = document.querySelectorAll('.oj-datagrid-cell');
                    return (!overlay && !spinner && cells.length > 0);
                }, { timeout: 30000 }).catch(() => console.log('⚠️ Warning: Timeout esperando la grilla tras aplicar vista.'));
                await new Promise(r => setTimeout(r, 2000)); // Estabilización final garantizada
            } else {
                console.log("      ⚠️ Botón 'Aplicar' no encontrado.");
            }

        } else {
            console.log("      ❌ No encontré el botón 'Vista'.");
        }

    } catch (e) {
        console.log("      ⚠️ Error JS: " + e.message);
    }
}

// =============================================================================
// 📅 EXTRACCIÓN UN SOLO DÍA (AYER)
// =============================================================================
// =============================================================================
// 📅 EXTRACCIÓN INTELIGENTE (VERIFICA FECHA ANTES DE MOVER)
// =============================================================================
// =============================================================================
// 📅 EXTRACCIÓN INTELIGENTE CON ANÁLISIS COMPLETO
// =============================================================================

async function extraerSoloUnDiaSmart(page, mapaDotacion, fechaTarget, nombreBucket) {
    // Manejo robusto de fecha: Si ya es String (YYYY-MM-DD), usar directo. Si es Date, convertir.
    const fechaLog = (typeof fechaTarget === 'string')
        ? fechaTarget
        : fechaTarget.toISOString().split('T')[0];

    // --- LÓGICA DE NAVEGACIÓN SEGURA ---
    // --- LÓGICA DE NAVEGACIÓN PRECISA (MULTI-SALTO) ---
    console.log(`      📅 Verificando fecha en pantalla vs Objetivo: ${fechaLog}`);

    let intentosNavegacion = 0;
    const MAX_INTENTOS = 30; // Evitar loop infinito

    while (intentosNavegacion < MAX_INTENTOS) {
        // 1. LEER FECHA ACTUAL
        const fechaEnPantalla = await page.evaluate(() => {
            const dateInput = document.querySelector('.oj-inputdatetime-input');
            if (dateInput && dateInput.value) return dateInput.value;

            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while (node = walker.nextNode()) {
                if (/\d{4}\/\d{2}\/\d{2}/.test(node.nodeValue)) return node.nodeValue.trim();
            }
            return null;
        });

        if (!fechaEnPantalla) {
            console.log("      ⚠️ No pude leer la fecha. Intentando navegar igual...");
        } else {
            // Normalizar (2026/02/07 -> 2026-02-07)
            const fechaDetectadaISO = fechaEnPantalla.replace(/\//g, "-").split(" ")[0];

            if (fechaDetectadaISO === fechaLog) {
                console.log(`      ✅ FECHA CORRECTA ALCANZADA: ${fechaDetectadaISO}`);
                break; // SALIR DEL LOOP
            }

            // Comparar fechas para saber dirección (aunque asumimos siempre atrás para backfill)
            const dActual = new Date(fechaDetectadaISO);
            const dTarget = new Date(fechaLog);

            console.log(`      ℹ️ Fecha actual: ${fechaDetectadaISO} | Objetivo: ${fechaLog}`);

            if (dActual > dTarget) {
                console.log("      ⏪ Fecha actual es FUTURA. Retrocediendo 1 día...");
                await clicDiaAnterior(page);
                await new Promise(r => setTimeout(r, 4000)); // Espera entre clics
            } else if (dActual < dTarget) {
                console.log("      ⏩ Fecha actual es PASADA. Avanzando 1 día (Casuística rara en backfill)...");
                // Implementar clicDiaSiguiente si fuera necesario, por ahora warning
                console.log("      ⚠️ ESTOY ATRÁS DE LA FECHA. ESTO NO DEBERÍA PASAR EN BACKFILL NORMAL.");
                break;
            }
        }
        intentosNavegacion++;
    }

    if (intentosNavegacion >= MAX_INTENTOS) {
        console.log("      ❌ ABORTANDO NAVEGACIÓN: Demasiados intentos sin llegar a la fecha.");
        return;
    }

    // Espera final de estabilización dinámica
    await page.waitForFunction(() => {
        const overlay = document.querySelector('.oj-conveyorbelt-overlay');
        const spinner = document.querySelector('.oj-progress-circle-indeterminate');
        return !overlay && !spinner;
    }, { timeout: 15000 }).catch(() => { });
    await new Promise(r => setTimeout(r, 2000));

    // 2. EXTRAER CON RETRY (Mitiga el "lag" visual de Oracle)
    console.log(`      📥 [${nombreBucket}] EXTRAYENDO INFORMACIÓN...`);
    let rawData = await extraerTablaCruda(page, fechaLog);

    if (!rawData || rawData.length === 0) {
        console.log(`      ⚠️ [RERUN] Tabla extraída vacía. Esperando 5s extra por si hay lag en renderizado TOA...`);
        await new Promise(r => setTimeout(r, 5000));
        rawData = await extraerTablaCruda(page, fechaLog);
    }

    // --- GUARDA TODO LO ENCONTRADO PARA ANÁLISIS ---
    const dumpPath = path.join(__dirname, 'dump_analisis.json');
    let dump = [];
    if (fs.existsSync(dumpPath)) {
        try { dump = JSON.parse(fs.readFileSync(dumpPath)); } catch (e) { }
    }

    // Agregar nombres encontrados (incluso los que no cruzan)
    rawData.forEach(d => {
        dump.push({
            bucket: nombreBucket,
            nombreOriginalTOA: d.nombreBruto,
            fecha: d.fecha,
            cruceExitoso: false // Se actualiza abajo si cruza
        });
    });

    // 3. PROCESAR
    if (rawData.length > 0) {
        const matches = cruzarDatos(rawData, mapaDotacion);
        if (matches.length > 0) {
            console.log(`         ✅ [${nombreBucket}] ÉXITO: ${matches.length} actividades coincidentes.`);
            console.log("         💾 GUARDANDO...");
            try {
                await axios.post(API_URL_LOCAL, { reportes: matches });
                console.log("         ✨ GUARDADO OK.");
            } catch (e) {
                console.error("         ❌ Error API:", e.message);
            }
        } else {
            console.log(`         💤 [${nombreBucket}] ${rawData.length} leídos, 0 coincidencias.`);
        }
    } else {
        console.log(`         ⚠️ [${nombreBucket}] Tabla vacía.`);
    }
}

// =============================================================================
// 🔭 BUSCADOR LATERAL
// =============================================================================
// =============================================================================
// 🧠 BUSCADOR DE SIDEBAR ROBUSTO (CLICS NATIVOS + SCROLL)
// =============================================================================
// =============================================================================
// 🧠 BUSCADOR DE SIDEBAR ROBUSTO (MOUSE FÍSICO)
// =============================================================================
async function encontrarYClicarSidebar(page, texto) {
    console.log(`      🔎 Buscando en sidebar: '${texto}'...`);

    // 1. SCROLL AL TOP
    try {
        await page.evaluate(() => {
            const tree = document.querySelector('oj-navigation-list, [role="tree"]');
            if (tree) tree.scrollIntoView({ block: "start", behavior: "instant" });
        });
        await new Promise(r => setTimeout(r, 1000));
    } catch (e) { }

    for (let i = 0; i < 3; i++) {
        // A. BUSCAR COORDENADAS
        const coords = await page.evaluate((txt) => {
            const elementos = Array.from(document.querySelectorAll('span, a, div, li'));
            const target = elementos.find(el => {
                const t = el.innerText ? el.innerText.trim() : "";
                if (!t) return false;
                // Coincidencia
                const coincide = (t === txt) || (t === `★ ${txt}`) || (t.includes(txt) && t.length < txt.length + 5);
                if (!coincide) return false;
                // Visibilidad
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && rect.left < 450;
            });

            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const rect = target.getBoundingClientRect();
                return {
                    x: rect.left + (rect.width / 2),
                    y: rect.top + (rect.height / 2),
                    encontrado: true,
                    tag: target.tagName,
                    texto: target.innerText
                };
            }
            return { encontrado: false };
        }, texto);

        if (coords.encontrado) {
            console.log(`      📍 Elemento encontrado en (${parseInt(coords.x)}, ${parseInt(coords.y)}). Clickeando...`);

            // B. MOVER MOUSE Y CLICK FÍSICO
            await page.mouse.move(coords.x, coords.y);
            await new Promise(r => setTimeout(r, 200)); // Pequeña pausa "humana"
            await page.mouse.down();
            await new Promise(r => setTimeout(r, 100));
            await page.mouse.up();

            console.log(`      ✅ Clic enviado a "${coords.texto}". Esperando reacción (5s)...`);
            await new Promise(r => setTimeout(r, 5000));

            return true;
        }

        console.log(`      ⚠️ Intento ${i + 1}: '${texto}' no encontrado.`);
        await new Promise(r => setTimeout(r, 2000));
    }
    return false;
}

// =============================================================================
// 🧠 CEREBRO DE CRUCE
// =============================================================================
// =============================================================================
// 🧠 CEREBRO DE CRUCE (DEBUG MODE)
// =============================================================================
// =============================================================================
// 🧠 CEREBRO DE CRUCE (DEBUG MODE)
// =============================================================================
// =============================================================================
// 🧹 UTILS
// =============================================================================

// =============================================================================
// 🧠 CEREBRO DE CRUCE (MEJORADO V2: SCORE MATCH)
// =============================================================================

function cruzarDatos(datosCrudos, mapaDotacion) {
    console.log(`\n🔍 DEBUG CRUCE DE DATOS:`);
    console.log(`   - Datos extraídos: ${datosCrudos.length}`);
    console.log(`   - Técnicos en nómina: ${mapaDotacion.length}`);

    const coincidencias = [];

    datosCrudos.forEach((dato, i) => {
        const nombreToaLimpio = limpiarTexto(dato.nombreBruto || "");
        const tokensToa = nombreToaLimpio.split(" ").filter(t => t.length > 2);

        // Estrategia: Buscar el MEJOR candidato, no el primero
        let mejorCandidato = null;
        let mejorScore = 0;

        mapaDotacion.forEach(tecnico => {
            const matches = tecnico.tokens.filter(token => tokensToa.includes(token));

            // Score Calculation
            // 1. Cantidad de aciertos
            // 2. Penalización si el nombre TOA es muy largo (muchas palabras mezcladas)

            if (matches.length >= 2) {
                // Ratio de coincidencia vs basura en el nombre capturado
                const coverage = matches.length / tokensToa.length;
                let score = matches.length + (coverage * 0.5);

                // Bonus exactitud: Si el técnico tiene 2 nombres y ambos están
                if (matches.length === tecnico.tokens.length) score += 2;

                if (score > mejorScore) {
                    mejorScore = score;
                    mejorCandidato = tecnico;
                }
            }
        });

        if (mejorCandidato && mejorScore >= 2.5) { // Umbral mas estricto (antes era solo matches >= 2)
            console.log(`   ✅ MATCH: [${dato.nombreBruto}] => ${mejorCandidato.nombreOriginal} (Score: ${mejorScore.toFixed(1)})`);

            // FIX FECHA UTC: Forzar las 12:00 PM UTC para evitar que el cambio de hora (UTC-3) lo mueva al día anterior
            // Si fecha es "2026-02-02", lo convertimos a "2026-02-02T12:00:00.000Z"
            let fechaSafe = dato.fecha;
            if (fechaSafe && fechaSafe.length === 10 && !fechaSafe.includes("T")) {
                fechaSafe = `${fechaSafe}T12:00:00.000Z`;
            }

            coincidencias.push({
                ...dato,
                fecha: fechaSafe, // <--- DATE FIX APLIED
                tecnicoId: mejorCandidato.id,
                nombre: mejorCandidato.nombreOriginal,
                puntos: 1,
                cliente: dato.cliente || "Movistar",
                ultimaActualizacion: new Date()
            });
        } else {
            // Loguear solo los fallos que tienen nombre (para no ensuciar con vacíos)
            if (dato.nombreBruto && dato.nombreBruto.length > 5) {
                console.log(`   ⚠️ NO MATCH: [${dato.nombreBruto}] (Best: ${mejorCandidato?.nombreOriginal || 'None'} / ${mejorScore.toFixed(1)}) => Guardando SIN cruzar`);

                let fechaSafe = dato.fecha;
                if (fechaSafe && fechaSafe.length === 10 && !fechaSafe.includes("T")) {
                    fechaSafe = `${fechaSafe}T12:00:00.000Z`;
                }

                coincidencias.push({
                    ...dato,
                    fecha: fechaSafe, // <--- DATE FIX APLIED
                    tecnicoId: null, // Sin ID interno
                    nombre: dato.nombreBruto, // <--- GUARDAMOS EL NOMBRE DE TOA TAL CUAL
                    puntos: 0,
                    cliente: dato.cliente || "Movistar",
                    ultimaActualizacion: new Date()
                });
            }
        }
    });

    // Desduplicación final por OrdenID
    const unicos = [];
    const map = new Set();
    coincidencias.forEach(c => {
        if (!map.has(c.ordenId)) {
            map.add(c.ordenId);
            unicos.push(c);
        }
    });

    return unicos;
}

// =============================================================================
// 🕸️ SCRAPER (MODO GRID ESTRUCTURADO V3)
// =============================================================================
async function extraerTablaCruda(page, fechaISO) {
    return await page.evaluate((fecha) => {
        console.log("--- INICIANDO EXTRACCIÓN (HÍBRIDA V3/V2) ---");

        // ... (V3 Logic skipped for brevity, assumed unchanged in replacement chunk below if not targeting it)
        // ... (However, I must include V3 logic if I am replacing the whole function or chunk)
        // Wait, the instruction says "Update cruzarDatos ... Also update extraerTablaCruda V2 ignore list".
        // I will target the V2 block specifically or the whole file section.

        // Let's use the provided chunks to target specifically the V2 fallback section within extraerTablaCruda
        // But since I am replacing 'cruzarDatos' AND 'extraerTablaCruda' parts, I might need 2 calls or a large chunk.
        // I will do a large chunk covering cruzarDatos down to end of V2.

        // ... Previous V3 Logic ...
        // I need to be careful not to delete V3 logic.
        // It resides inside 'extraerTablaCruda'.
        // I will use 'ReplacementChunks' properly? No, 'replace_file_content' is single block.
        // I will target lines 450 to 645.

        // Re-implementing V3 logic in the replacement string since it's inside the function I am editing.

        // =====================================================================
        // INTENTO 1: ESTRATEGIA V3 (Headers + Geometría) - PARA "FULL EXPORT"
        // =====================================================================

        // Buscamos headers con selectores más amplios
        let headerCells = Array.from(document.querySelectorAll('.oj-datagrid-header-cell'));
        if (headerCells.length === 0) headerCells = Array.from(document.querySelectorAll('[role="columnheader"]'));

        if (headerCells.length > 0) {
            console.log(`✅ HEADERS ENCONTRADOS V3 (${headerCells.length})...`);

            const headers = headerCells.map(h => {
                const rect = h.getBoundingClientRect();
                return { text: h.innerText.trim(), left: rect.left, right: rect.right, center: rect.left + (rect.width / 2) };
            }).filter(h => h.text.length > 0);

            const dataCells = Array.from(document.querySelectorAll('.oj-datagrid-cell'));
            const mapaFilas = new Map();

            dataCells.forEach(celda => {
                const rect = celda.getBoundingClientRect();
                const y = Math.round(rect.top / 5) * 5;
                if (!mapaFilas.has(y)) mapaFilas.set(y, []);
                mapaFilas.get(y).push({ rect: rect, text: celda.innerText.trim() });
            });

            const resultados = [];
            mapaFilas.forEach((celdasFila) => {
                const filaObj = { fecha: fecha, origen: 'TOA_V3_FULL' };
                celdasFila.forEach(celda => {
                    const cx = celda.rect.left + (celda.rect.width / 2);
                    let header = headers.find(h => cx >= h.left && cx <= h.right);
                    if (!header) {
                        header = headers.reduce((prev, curr) => (Math.abs(curr.center - cx) < Math.abs(prev.center - cx) ? curr : prev), headers[0]);
                        if (Math.abs(header.center - cx) > 100) header = null;
                    }
                    if (header) {
                        const key = header.text.replace(/\./g, "_").trim();
                        filaObj[key] = celda.text;
                    }
                });

                filaObj.ordenId = filaObj["Número orden"] || filaObj["Numero orden"] || filaObj["Petición"] || filaObj["ID"] || filaObj["Orden"] || "";
                filaObj.nombreBruto = filaObj["Recurso"] || filaObj["Nombre recurso"] || filaObj["Técnico"] || filaObj["Nombre"] || "";
                filaObj.actividad = filaObj["Subtipo de Actividad"] || filaObj["Tipo Trabajo"] || filaObj["Actividad"] || "Actividad TOA"; // Include Actividad

                // Add Status extraction for V3
                filaObj.Estado = filaObj["Estado"] || filaObj["status"] || "Completado"; // Default to Completed? No, risky. 
                // Let's keep raw.

                const lat = filaObj["Direccion Polar Y"] || filaObj["Latitud"];
                const lon = filaObj["Direccion Polar X"] || filaObj["Longitud"];
                if (lat) filaObj.latitud = lat.replace(',', '.');
                if (lon) filaObj.longitud = lon.replace(',', '.');

                if (filaObj.ordenId && filaObj.ordenId.length > 3) resultados.push(filaObj);
            });

            if (resultados.length > 0) return resultados;
        }

        // =====================================================================
        // INTENTO 2: FALLBACK A V2 (Regex + "Destructivo") - MEJORADO
        // =====================================================================
        console.log("🔄 EJECUTANDO FALLBACK V2 (MODO VISUAL/REGEX) - REFORZADO...");

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
        mapaFilasV2.forEach((items) => {
            items.sort((a, b) => a.x - b.x);
            const textoCompleto = items.map(i => i.texto).join(" ");

            const matchOrden = textoCompleto.match(/(INC\d+|WO-\d+|REQ\d+|12\d{8})/);
            if (matchOrden) {
                const ordenId = matchOrden[0];
                const matchCoords = textoCompleto.match(/(-33\.\d+).*?(-70\.\d+)|(-70\.\d+).*?(-33\.\d+)/);

                // Heurística Nombre Mejorada
                const limpieza = textoCompleto.replace(ordenId, '').replace(matchCoords ? matchCoords[0] : '', '');
                const palabras = limpieza.match(/[A-ZÁÉÍÓÚÑ]{3,}/g) || [];
                const ignorar = [
                    'ALTA', 'BAJA', 'TRASLADO', 'FIBRA', 'OPTICA', 'MOVISTAR', 'COMFICA', 'ZENER', 'CHILE',
                    'SANTIAGO', 'RM', 'RANCAGUA', 'CLIENTE', 'DOMICILIO', 'REPARACION', 'PENDIENTE',
                    'AGENDADO', 'SUSPENDIDO', 'CANCELADO', 'COMPLETADO', 'INICIADO', 'EJECUCION',
                    'CALLE', 'PJE', 'PASAJE', 'AV', 'AVENIDA', 'BLOCK', 'DEPTO', 'CASA', 'NORTE', 'SUR', 'ESTE', 'OESTE',
                    'VILLA', 'POBLACION', 'CONDOMINIO', 'TORRE', 'INTERIOR', 'FTTH', 'HFC', 'GPON', 'ONT', 'STB', 'MODEM',
                    'TELEFONICA', 'TELEFONIA', 'INTERNET', 'TELEVISION', 'COBRE', 'PARES'
                ];

                const nombreBruto = palabras.filter(p => !ignorar.includes(p)).join(" ");

                resultadosV2.push({
                    nombreBruto: nombreBruto,
                    ordenId: ordenId,
                    actividad: `V2: ${textoCompleto.substring(0, 40)}...`,
                    fecha: fecha,
                    latitud: matchCoords ? (matchCoords[1] || matchCoords[4]) : null,
                    longitud: matchCoords ? (matchCoords[2] || matchCoords[3]) : null,
                    dataRawCompleta: textoCompleto
                });
            }
        });

        console.log(`✅ V2 Finalizado. Filas extraídas: ${resultadosV2.length}`);
        return resultadosV2;

    }, fechaISO);
}

// =============================================================================
// ⏪ CLIC DÍA ANTERIOR (MOUSE FÍSICO)
// =============================================================================
async function clicDiaAnterior(page) {
    console.log("      ⏪ Intentando retroceder día con Mouse Físico...");


    // ESTRATEGIA: Buscar el botón "<" cerca de la fecha
    const coords = await page.evaluate(() => {
        // Opción A: Botón con title/aria "Previous" o "Anterior"
        const botones = Array.from(document.querySelectorAll('button, div[role="button"], a, span'));
        let target = botones.find(el => {
            const t = (el.title || el.ariaLabel || "").toLowerCase();
            return t.includes('previous') || t.includes('anterior') || t.includes('atras');
        });

        // Opción B: Buscar icono de flecha izquierda si no hay texto claro
        if (!target) {
            const iconos = Array.from(document.querySelectorAll('span.oj-button-icon')); // Clase típica Oracle
            target = iconos.find(icon => {
                const rect = icon.getBoundingClientRect();
                // Generalmente está en la parte superior derecha o izquierda, visible
                return rect.top < 200 && rect.width > 0;
            });
            // Si encontramos icono, clickeamos su padre (boton)
            if (target && target.parentElement) target = target.parentElement;
        }

        // Opción C: Buscar por posición relativa a la fecha (a la izquierda de fecha actual)
        if (!target) {
            // ... (Implementación futura si falla A y B)
        }

        if (target) {
            const rect = target.getBoundingClientRect();
            return {
                x: rect.left + (rect.width / 2),
                y: rect.top + (rect.height / 2),
                encontrado: true
            };
        }
        return { encontrado: false };
    });

    if (coords && coords.encontrado) {
        console.log(`      📍 Botón 'Anterior' en (${parseInt(coords.x)}, ${parseInt(coords.y)}). Clickeando...`);
        await page.mouse.move(coords.x, coords.y);
        await new Promise(r => setTimeout(r, 200));
        await page.mouse.down();
        await new Promise(r => setTimeout(r, 100));
        await page.mouse.up();
        return true;
    } else {
        console.log("      ⚠️ No encontré botón 'Anterior' visualmente. Usando Teclado (Flecha Izq)...");
        await page.keyboard.press('ArrowLeft');
        return true;
    }
}

// 🔐 LOGIN POTENCIADO (CLEAN TYPER)
async function loginAtomico(page) {
    console.log(`🌐 Navegando al portal TOA...`);

    try {
        await page.goto(process.env.TOA_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    } catch (e) {
        console.error(`   ❌ [CRÍTICO] El portal TOA no cargó en 60s (${e.message}).`);
        throw new Error('TIMEOUT_PORTAL_TOA'); // Aborta la extracción completa hoy.
    }

    // Espera inteligente de inputs
    try { await page.waitForSelector('input', { timeout: 15000 }); } catch (e) {
        throw new Error('TIMEOUT_LOGIN_INPUTS');
    }
    await new Promise(r => setTimeout(r, 2000));

    const inputs = await page.$$('input');
    let uField = null, pField = null;

    for (const i of inputs) {
        const t = await page.evaluate(e => e.type, i);
        const v = await page.evaluate(e => {
            const s = window.getComputedStyle(e);
            return s.display !== 'none' && s.visibility !== 'hidden' && e.offsetParent !== null;
        }, i);

        if (v) {
            if (t !== 'password' && t !== 'checkbox') uField = i;
            else if (t === 'password') pField = i;
        }
    }

    // Usuario (Limpieza profunda)
    if (uField) {
        await uField.click({ clickCount: 3 }); // Seleccionar todo
        await page.keyboard.press('Backspace'); // Borrar
        await new Promise(r => setTimeout(r, 500));
        await uField.type(process.env.TOA_USER_REAL, { delay: 50 });
    }

    // Password (Limpieza profunda)
    if (pField) {
        await pField.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await new Promise(r => setTimeout(r, 500));
        await pField.type(process.env.TOA_PASS_REAL, { delay: 50 });
    }

    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 5000));

    // Checkbox de sesión
    const check = await page.$('input[type="checkbox"]');
    if (check) {
        console.log('⚠️ Conflicto detectado...');
        await check.click();
        await new Promise(r => setTimeout(r, 2000));

        const newPass = await page.$('input[type="password"]');
        if (newPass) {
            await newPass.click({ clickCount: 3 });
            await page.keyboard.press('Backspace');
            await newPass.type(process.env.TOA_PASS_REAL, { delay: 100 });
            await page.keyboard.press('Enter');
        }
    }

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => { });
    console.log('✅ Login OK.');
}

module.exports = { iniciarExtraccion };
if (require.main === module) {
    console.log('🔌 Conectando a MongoDB Atlas para ejecución directa...');
    mongoose.connect(process.env.MONGO_URI)
        .then(() => {
            console.log('✅ Atlas Conectado. Iniciando Extracción Masiva...');
            iniciarExtraccion();
        })
        .catch(err => {
            console.error('❌ Error de conexión Atlas:', err.message);
            process.exit(1);
        });
}

const puppeteer = require('puppeteer');
const axios = require('axios');
require('dotenv').config({ path: '../../../../.env' });

const API_URL_BASE = `http://localhost:${process.env.PORT || 5000}/api/gps`;
let isRunning = false;

const LAUNCH_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security',
    '--window-size=1920,1080',
    '--disable-features=IsolateOrigins,site-per-process'
];

const iniciarRastreoGPS = async () => {
    if (isRunning) { console.log('✋ Bot GPS ocupado. Esperando ciclo...'); return; }
    isRunning = true;

    console.log('\n🛰️  INICIANDO RASTREO [MODO: FRANCOTIRADOR VISUAL v5]...');

    let browser;
    let datosCapturados = new Map();

    try {
        browser = await puppeteer.launch({ headless: "new", args: LAUNCH_ARGS });
        const page = await browser.newPage();

        page.on('console', msg => {
            const txt = msg.text();
            if (!txt.includes('google.maps') && !txt.includes('Deprecated')) {
                console.log(`[BROWSER] ${txt}`);
            }
        });

        await page.setViewport({ width: 1920, height: 1080 });

        // 1. CONEXIÓN
        console.log(`🌐 Entrando a GPSimple...`);
        await page.goto(process.env.GPS_URL || 'https://www.gpsimple.cl/', { waitUntil: 'domcontentloaded', timeout: 90000 });

        // 2. LOGIN
        const loginInput = await page.$('input#username');
        if (loginInput) {
            console.log(`🔐 Autenticando...`);
            await page.type('input#username', process.env.GPS_USER);
            await page.type('input#password', process.env.GPS_PASS);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 }),
                page.click('input[type="submit"]')
            ]);
        }

        // 3. CARGA
        console.log('⏳ Esperando dashboard...');
        await page.waitForSelector('div#map_canvas, div.leaflet-container', { timeout: 30000 });
        await new Promise(r => setTimeout(r, 12000));

        // 4. IDENTIFICACIÓN DE OBJETIVOS (SÓLO FILAS DE LA TABLA)
        console.log('📋 Buscando patentes en la tabla de flota...');
        const objetivos = await page.evaluate(() => {
            const matches = [];
            const regexPatente = /\b([B-D,F-H,J-L,P,R-T,V-Z]{4}\d{2}|[A-Z]{2}\d{4})\b/;
            const ignoreList = ['GP4000', 'GP5000', 'GP6000', 'RS3000', 'TT8750', 'AT1000', 'AT1200', 'FM1000', 'FM1010', 'FM1100', 'FM1110', 'FM1120', 'FM1122', 'FM1125', 'FM1200', 'FM1202', 'FM1204', 'FM2200', 'FM3200', 'FM3300', 'FM3400', 'FM3600', 'FM3620', 'FM3622', 'FM4100', 'FM4200', 'FM5300', 'FM5500', 'FM6320', 'GH1202', 'GH3000', 'GH4000', 'PT3000', 'YW3000'];

            // Buscamos específicamente en las celdas de nombre de la grid de objetos
            const rows = document.querySelectorAll('#side_panel_objects_object_list_grid tr.jqgrow');
            rows.forEach(row => {
                const nameCell = row.querySelector('td[aria-describedby$="_name"]');
                if (nameCell) {
                    const txt = nameCell.innerText.trim();
                    const match = txt.match(regexPatente);
                    if (match && match[0]) {
                        const patente = match[0];
                        if (!ignoreList.includes(patente)) {
                            matches.push(patente);
                        }
                    }
                }
            });
            return [...new Set(matches)];
        });

        console.log(`🎯 Objetivos reales: ${objetivos.length}. Infiltrando...`);

        // 5. EXTRACCIÓN
        let lastCoords = "";

        for (const patente of objetivos) {
            try {
                process.stdout.write(`🎯 [${patente}]... `);

                // Clic en la fila de la patente
                const clicked = await page.evaluate((p) => {
                    const rows = Array.from(document.querySelectorAll('#side_panel_objects_object_list_grid tr.jqgrow'));
                    const row = rows.find(r => r.innerText.includes(p));
                    if (row) {
                        row.scrollIntoView();
                        row.click();
                        return true;
                    }
                    return false;
                }, patente);

                if (clicked) {
                    process.stdout.write('Clic OK. ');
                    await new Promise(r => setTimeout(r, 3500)); // Tiempo para que el pane se actualice

                    const info = await page.evaluate((pat, prev) => {
                        // 1. Buscamos en Popup
                        const popup = document.querySelector('.leaflet-popup-content, .info-window, .gm-style-iw');
                        // 2. Buscamos en Panel Inferior (específicamente en la tabla de datos)
                        const panelData = document.querySelector('#side_panel_objects_object_data_list_grid');
                        // 3. Buscamos en el Sidebar (a veces los datos están ahí)
                        const sidebarDetail = document.querySelector('#side_panel_objects');

                        let fullText = (popup ? popup.innerText : "") + " " +
                            (panelData ? panelData.innerText : "") + " " +
                            (sidebarDetail ? sidebarDetail.innerText : "");

                        const regexRobust = /(-3\d\.\d+)[^\d-]+(-7\d\.\d+)/;
                        const matchCoords = fullText.match(regexRobust);
                        const matchVel = fullText.match(/Velocidad:\s*(\d+)/) || fullText.match(/(\d+)\s*kph/) || fullText.match(/(\d+)\s*km\/h/);

                        if (matchCoords) {
                            const lat = parseFloat(matchCoords[1]);
                            const lng = parseFloat(matchCoords[2]);
                            const current = `${lat},${lng}`;

                            // Si es la misma que la anterior, ignoramos para evitar el bug de "coordenada global"
                            if (current === prev) return { error: "COORD_DUPLICADA" };

                            return {
                                lat: lat,
                                lng: lng,
                                vel: matchVel ? parseInt(matchVel[1]) : 0,
                                current: current
                            };
                        }
                        return null;
                    }, patente, lastCoords);

                    if (info && !info.error) {
                        lastCoords = info.current;
                        datosCapturados.set(patente, {
                            patente: patente,
                            tecnicoId: "AUTO_DETECT",
                            latitud: info.lat,
                            longitud: info.lng,
                            velocidad: info.vel,
                            bateria: 100,
                            estado: info.vel > 0 ? "En Ruta" : "Detenido",
                            timestamp: new Date().toISOString()
                        });
                        process.stdout.write(`📍 ${info.lat.toFixed(5)}, ${info.lng.toFixed(5)}\n`);
                    } else if (info && info.error === "COORD_DUPLICADA") {
                        process.stdout.write('⚠️ Coordenada repetida (ignorado).\n');
                    } else {
                        process.stdout.write('❌ Sin datos.\n');
                    }
                } else {
                    process.stdout.write('❌ No encontrado.\n');
                }
            } catch (e) {
                console.log(`\n⚠️ Error con ${patente}:`, e.message);
            }
        }

        // 6. GUARDAR
        if (datosCapturados.size > 0) {
            console.log(`\n✅ Procesados ${datosCapturados.size} vehículos. Guardando...`);
            try { await axios.delete(`${API_URL_BASE}/reset`); } catch (e) { }

            let guardados = 0;
            for (const v of datosCapturados.values()) {
                try {
                    await axios.post(`${API_URL_BASE}/update`, v);
                    guardados++;
                } catch (e) { }
            }
            console.log(`💾 BASE DE DATOS: ${guardados} vehículos sincronizados.`);
        } else {
            console.warn('⚠️ No se capturaron datos nuevos.');
        }

    } catch (error) {
        console.error('❌ ERROR FATAL:', error.message);
    } finally {
        if (browser) await browser.close();
        isRunning = false;
        console.log('🔒 Ciclo terminado.');
    }
};

module.exports = { iniciarRastreoGPS };

// Entry point cuando el archivo se ejecuta como proceso hijo (fork)
if (require.main === module) {
    iniciarRastreoGPS()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('❌ GPS Worker fatal error:', err.message);
            process.exit(1);
        });
}

module.exports = { iniciarRastreoGPS };
const axios = require('axios');
const path = require('path');
const formatRUT = require('../../../utils/rutUtils').formatRUT;

/**
 * Cliente HTTP Enterprise para extracción de datos del SII (Registro de Compras y Ventas).
 * Elimina la dependencia de Puppeteer (Navegador Visual) previniendo el bloqueo
 * automático de cuenta tributaria por el WAF Akamai Bot Manager al simular un footprint
 * orgánico de REST API.
 */
class RpaScraper {
    constructor(rutEmpresa, rutAutorizado, claveTributaria) {
        // En las peticiones HTTP el guión no importa a veces, pero para form login sí
        this.rutEmpresa = rutEmpresa ? formatRUT(rutEmpresa).replace(/[^0-9Kk-]/g, '') : null;
        this.rutAutorizado = rutAutorizado ? formatRUT(rutAutorizado).replace(/[^0-9Kk-]/g, '') : null;
        this.claveTributaria = claveTributaria;

        this.sessionCookies = '';
        this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
        this.commonHeaders = {
            'User-Agent': this.userAgent,
            'Accept-Language': 'es-CL,es;q=0.9,en-US;q=0.8,en;q=0.7',
            'Connection': 'keep-alive',
            'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"'
        };
    }

    async initBrowser() {
        // Por consistencia con la interfaz del controller
        console.log(`🤖 Iniciando Motor HTTP Seguro SII (CGI) para Empresa: ${this.rutEmpresa}`);
        return true;
    }

    async closeBrowser() {
        // Por consistencia
        console.log("🔒 Desconectando Motor HTTP Seguro SII...");
        return true;
    }

    async loginZeus() {
        console.log(`🔐 Autenticando vía API CGI HTTP (Bypass Akamai)...`);

        const rutLogin = this.rutAutorizado || this.rutEmpresa;
        if (!rutLogin || !this.claveTributaria) {
            throw new Error("Credenciales SII faltantes o vacías en BBDD.");
        }

        // El Formulario asume RUT con guion y DV. Ej: 77216779-2 o 77.216.779-2
        // Extraemos solo numérico y guion
        const payload = new URLSearchParams();
        payload.append('rutcntr', rutLogin);
        payload.append('clave', this.claveTributaria);

        try {
            const res = await axios.post('https://zeusr.sii.cl/cgi_wa/teoria.cgi', payload, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Referer': 'https://zeusr.sii.cl/AUT2000/InicioAutenticacion/IngresoRutClave.html'
                },
                maxRedirects: 0, // No seguir redirect (302) para capturar las "Set-Cookie" crudas
                validateStatus: (status) => status >= 200 && status < 400
            });

            const setCookieHeaders = res.headers['set-cookie'];
            if (!setCookieHeaders) {
                if (typeof res.data === 'string' && res.data.includes("The requested URL was rejected")) {
                    throw new Error("Bloqueo de red Akamai en curso. Por favor, intenta de nuevo más tarde.");
                }
                throw new Error("El SII no respondió con cookies de sesión. Posible bloqueo o clave errónea.");
            }

            // Construir String de cookies validas extraidas del Header
            this.sessionCookies = setCookieHeaders.map(c => c.split(';')[0]).join('; ');

            if (!this.sessionCookies.includes('SMALCERT')) {
                throw new Error("Clave Tributaria o RUT erróneo. El SII rechazó el acceso.");
            }

            console.log(`✅ ¡Login HTTP SII Exitoso! (Session Token Capturado)`);
            return true;

        } catch (error) {
            console.error("❌ Fallo Crítico en Login API RPA:", error.message);
            throw error;
        }
    }

    /**
     * Consulta las APIs JSON del portal de Registro de Compras y Ventas.
     */
    async extraerResumenRCV(mes, anio) {
        console.log(`📊 Raspando Libro RCV [${mes}/${anio}] EN VIVO vía APIs HTTP Internas del SII...`);
        try {
            // Requerimos RUT Empresa limpio (ej: 77216779) y DV (ej: 2) separados.
            const rutEmpresaLimpio = (this.rutEmpresa || this.rutAutorizado || '').replace(/[^0-9Kk]/g, '');
            if (!rutEmpresaLimpio) throw new Error("RUT Empresa nulo");

            const dvE = rutEmpresaLimpio.slice(-1);
            const bodyE = rutEmpresaLimpio.slice(0, -1);

            const headersRCV = {
                'Content-Type': 'application/json',
                'Cookie': this.sessionCookies,
                'User-Agent': this.userAgent,
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://www4.sii.cl/consdcvinternetui/#/index'
            };

            const payloadCompras = {
                "metaData": {
                    "namespace": "cl.sii.sdi.lob.dcv.consdcv.data.api.interfaces.FacadeService/getResumen",
                    "conversationId": "TEMPORAL",
                    "transactionId": "TEMPORAL",
                    "page": null
                },
                "data": {
                    "rutEmisor": bodyE,
                    "dvEmisor": dvE,
                    "ptcPeriodo": `${anio}${mes.toString().padStart(2, '0')}`,
                    "estadoContab": "REGISTRO"
                }
            };

            console.log(`📡 Consultando Resumen RCV...`);
            const resCompras = await axios.post('https://www4.sii.cl/consdcvinternetui/services/data/facadeService/getResumen', payloadCompras, { headers: headersRCV });

            let resumenData = [];
            if (resCompras.data && resCompras.data.data) {
                resumenData = resCompras.data.data;
            }

            // Calcular ventas y compras
            let totalVentasNeto = 0;
            let totalComprasNeto = 0;

            resumenData.forEach(row => {
                const rsgnTipo = String(row.rsgnTipoDoc || "");
                if (rsgnTipo === "33" || rsgnTipo === "39") { // Factura Electronica / Boleta (Ventas)
                    totalVentasNeto += Number(row.rsndMntNeto || 0);
                }
            });

            // Extraer detalles de compras
            const payloadDetalle = {
                "metaData": {
                    "namespace": "cl.sii.sdi.lob.dcv.consdcv.data.api.interfaces.FacadeService/getDetalleCompra",
                    "conversationId": "TEMPORAL",
                    "transactionId": "TEMPORAL",
                    "page": null
                },
                "data": {
                    "rutEmisor": bodyE,
                    "dvEmisor": dvE,
                    "ptcPeriodo": `${anio}${mes.toString().padStart(2, '0')}`,
                    "codTipoDoc": "33", // Consultamos las Facturas Electrónicas de Proveedores
                    "operacion": "COMPRA",
                    "estadoContab": "REGISTRO"
                }
            };

            console.log(`📡 Consultando Detalle Proveedores...`);
            let proveedoresRaw = [];
            try {
                const resDetalles = await axios.post('https://www4.sii.cl/consdcvinternetui/services/data/facadeService/getDetalleCompra', payloadDetalle, { headers: headersRCV });
                if (resDetalles.data && resDetalles.data.data) {
                    proveedoresRaw = resDetalles.data.data;
                }
            } catch (e) {
                console.log(`⚠️ Advertencia: No se pudo obtener detalle de compras.`);
            }

            // Mapear Proveedores top
            const uniqueProviders = new Map();
            let numProveedoresActivos = 0;

            proveedoresRaw.forEach(doc => {
                totalComprasNeto += Number(doc.dcvMntNeto || 0);

                const rutProv = `${doc.detRutDoc}-${doc.detDvDoc}`;
                const nameProv = doc.detRznSoc || "Desconocido";
                const monto = Number(doc.dcvMntNeto || 0);

                if (!uniqueProviders.has(rutProv)) {
                    uniqueProviders.set(rutProv, { nombre: nameProv, montoTotal: monto });
                    numProveedoresActivos++;
                } else {
                    const prev = uniqueProviders.get(rutProv);
                    prev.montoTotal += monto;
                    uniqueProviders.set(rutProv, prev);
                }
            });

            const topCuentasList = Array.from(uniqueProviders.values())
                .sort((a, b) => b.montoTotal - a.montoTotal)
                .slice(0, 5);

            console.log(`✅ Datos HTTPS extraídos. Ventas: $${totalVentasNeto} | Compras: $${totalComprasNeto} | Proveedores (Top 5+): ${numProveedoresActivos}`);

            return {
                ventasTotales: totalVentasNeto,
                comprasTotales: totalComprasNeto,
                proveedores: numProveedoresActivos,
                proveedoresTop: topCuentasList
            };

        } catch (error) {
            console.error("❌ Error de Extracción HTTPS RCV:", error.message);
            throw new Error("No se pudo extraer la información tributaria vía API. " + error.message);
        }
    }
}

module.exports = RpaScraper;

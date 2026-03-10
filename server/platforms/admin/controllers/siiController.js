const Empresa = require('../../auth/models/Empresa');
const { encriptarTexto, desencriptarTexto } = require('../../../utils/criptografiaSegura');
const SiiRpaService = require('../services/RpaScraper');

// Singleton Lock: Evita que móltiples peticiones simultáneas lancen N robots Puppeteer en paralelo
let rpaEnEjecucion = false;
let ultimoResultadoCache = null;
let ultimaEjecucion = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de cache

/**
 * Devuelve el cuerpo contable del RCV consumiendo a través de SiiRpaService
 */
exports.obtenerDatosRCV = async (req, res) => {
    try {
        if (!req.user || !req.user.empresaRef) {
            return res.status(401).json({ error: 'Contexto de compañía referencial no hallado.' });
        }

        const empresa = await Empresa.findById(req.user.empresaRef).select('integracionSII rut nombre');

        // Simulamos el delay de Puppeteer (Raspando web oficial)
        await new Promise(r => setTimeout(r, 1200));

        // Si un robot ya está en ejecución y tenemos cache reciente, lo devolvemos inmediatamente
        if (rpaEnEjecucion && ultimoResultadoCache && (Date.now() - ultimaEjecucion) < CACHE_TTL_MS) {
            console.log('📦 RPA en curso: devolviendo caché previo al cliente.');
            return res.json(ultimoResultadoCache);
        }

        let rpaStatus = false;
        let dataRPA = null;
        let rpaError = null;

        if (empresa && empresa.integracionSII && empresa.integracionSII.rpaActivo) {
            rpaStatus = true;
            if (!rpaEnEjecucion) {
                rpaEnEjecucion = true;
                try {
                    // Obtenemos credenciales en vivo
                    const claveOriginal = desencriptarTexto(empresa.integracionSII.claveTributaria);
                    const rutAutorizado = empresa.integracionSII.rutAutorizado || empresa.integracionSII.rutEmpresa || empresa.rut || '';
                    const rutEmpresa = empresa.integracionSII.rutEmpresa || empresa.rut || 'sin-rut';

                    // Instanciamos el Motor HTTP
                    const rpa = new SiiRpaService(rutEmpresa, rutAutorizado, claveOriginal);

                    await rpa.initBrowser();
                    await rpa.loginZeus();

                    const mesActual = new Date().getMonth() + 1;
                    const anioActual = new Date().getFullYear();

                    // Ejecutamos la extracción
                    dataRPA = await rpa.extraerResumenRCV(String(mesActual).padStart(2, '0'), anioActual);

                    await rpa.closeBrowser();

                } catch (robotError) {
                    console.error("Fallo durante el rastreo del Robot:", robotError.message);
                    rpaError = robotError.message;

                    if (robotError.message.includes('desencriptar la bóveda') || robotError.message.includes('bad decrypt')) {
                        empresa.integracionSII.rpaActivo = false;
                        empresa.integracionSII.claveTributaria = '';
                        await empresa.save();
                        console.log("⚠️ Bóveda SII limpiada automáticamente. Se requiere reingreso de credenciales.");
                    }
                    rpaStatus = false;
                } finally {
                    rpaEnEjecucion = false;
                }
            } // fin if (!rpaEnEjecucion)
        } // fin if rpaActivo

        // Estructurador: Si el RPA no trajo data o está inactivo, devolvemos 0s reales
        const chartData = rpaStatus && dataRPA ? dataRPA.chartData : [];
        const resumen = rpaStatus && dataRPA ? dataRPA.resumen : {
            ventasNetas: 0, comprasNetas: 0, ivaDebito: 0,
            ivaCredito: 0, ivaAPagar: 0, ppm: 0, totalPagarF29: 0
        };
        const documentos = rpaStatus && dataRPA ? dataRPA.documentos : [];
        const topProveedores = rpaStatus && dataRPA ? dataRPA.topProveedores : [];
        const distribucionGastos = rpaStatus && dataRPA ? dataRPA.distribucionGastos : [];

        const responsePayload = {
            isRealData: rpaStatus && !!dataRPA,
            rpaError: rpaError,
            chartData,
            resumen,
            documentos,
            topProveedores,
            distribucionGastos
        };

        // Guardar en caché si el RPA entregó datos
        if (rpaStatus && dataRPA) {
            ultimoResultadoCache = responsePayload;
            ultimaEjecucion = Date.now();
        }

        return res.status(200).json(responsePayload);

    } catch (error) {
        rpaEnEjecucion = false;
        console.error("Error obteniendo RCV del Robot:", error);
        res.status(500).json({ error: 'Hubo un problema de conexión con el raspador web del Bot.' });
    }
};

/**
 * Recibe credenciales desde IntegracionesSII.jsx y las guarda en modo Cifrado dentro de la Empresa
 */
exports.guardarCredencialesRPA = async (req, res) => {
    try {
        const { rutEmpresa, rutAutorizado, claveTributaria } = req.body;

        // Asume usuario alojado en req.user desde el token JWT
        if (!req.user || !req.user.empresaRef) {
            return res.status(401).json({ error: 'Compañía de usuario no detectada.' });
        }

        // Buscar a la empresa
        const empresa = await Empresa.findById(req.user.empresaRef);
        if (!empresa) {
            return res.status(404).json({ error: 'Empresa no encontrada.' });
        }

        // Encriptar la contraseña (Si hay actualización)
        let claveCifrada = empresa.integracionSII?.claveTributaria;

        // Solo encriptamos de nuevo si en el body venía un campo texto para actualizarla
        if (claveTributaria && claveTributaria.trim() !== '') {
            claveCifrada = encriptarTexto(claveTributaria);
        }

        // Actualizar bóveda SII
        empresa.integracionSII = {
            ...empresa.integracionSII,
            rutEmpresa: rutEmpresa || empresa.integracionSII?.rutEmpresa,
            rutAutorizado: rutAutorizado,
            claveTributaria: claveCifrada,
            rpaActivo: true, // Queda preactivado al configurar credenciales iniciales
            estadoSincronizacion: 'Pendiente'
        };

        // MOCK/PRUEBA fue eliminado para prevenir bloqueos Anti-Bot de Akamai WAF.
        // Iniciar un Chromium instántaneamente y cerrarlo levanta red flags en los WAF gubernamentales.

        await empresa.save();

        res.status(200).json({
            success: true,
            message: 'Bóveda Criptográfica actualizada. Las credenciales fueron aseguradas usando cifrado nivel AES-256.',
            rpaActivo: true
        });

    } catch (error) {
        console.error("Error guardando credenciales RPA:", error);
        res.status(500).json({ error: 'Error interno conectando con bóveda de seguridad.' });
    }
};

/**
 * Reset / Eliminar Credenciales del RPA
 */
exports.resetCredencialesRPA = async (req, res) => {
    try {
        if (!req.user || !req.user.empresaRef) {
            return res.status(401).json({ error: 'Contexto de compañía no hallado.' });
        }

        const empresa = await Empresa.findById(req.user.empresaRef);
        if (!empresa) {
            return res.status(404).json({ error: 'Empresa no encontrada en MongoDB.' });
        }

        if (empresa.integracionSII) {
            empresa.integracionSII.rutEmpresa = '';
            empresa.integracionSII.rutAutorizado = '';
            empresa.integracionSII.claveTributaria = ''; // Changed from claveTributariaHex to claveTributaria
            empresa.integracionSII.rpaActivo = false;
            empresa.integracionSII.estadoSincronizacion = 'Sin configurar';
            await empresa.save();
        }

        res.status(200).json({ success: true, message: 'Credenciales del SII eliminadas correctamente.' });
    } catch (error) {
        console.error("Error reseteando credenciales RPA:", error);
        res.status(500).json({ error: 'Error interno eliminando credenciales.' });
    }
};

/**
 * Retorna el estado global de la sincronización tributaria sin exponer claves.
 */
exports.estadoIntegracion = async (req, res) => {
    try {
        if (!req.user || !req.user.empresaRef) {
            return res.status(401).json({ error: 'Contexto de compañía no hallado.' });
        }

        const empresa = await Empresa.findById(req.user.empresaRef).select('integracionSII');

        if (!empresa || !empresa.integracionSII) {
            return res.status(200).json({
                hasData: false,
                rpaActivo: false
            });
        }

        const s = empresa.integracionSII;

        // Devolvemos objetos limpios al Front
        res.status(200).json({
            hasData: true,
            rpaActivo: s.rpaActivo,
            rutEmpresa: s.rutEmpresa,
            rutAutorizado: s.rutAutorizado,
            estadoSincronizacion: s.estadoSincronizacion,
            ultimaSincronizacion: s.ultimaSincronizacion,
            hasCertificado: !!s.certificadoDigitalPath // Booleano ciego para UI
        });

    } catch (error) {
        console.error("Error obteniendo Estado de Integración SII:", error);
        res.status(500).json({ error: 'Error recabando información.', traceback: error.message, stack: error.stack });
    }
};

/**
 * Módulo para manejo temporal de Certificado DTE
 */
exports.subirCertificado = async (req, res) => {
    try {
        const file = req.file;
        const { password } = req.body;

        if (!file || !password) {
            return res.status(400).json({ error: 'Se requiere el Archivo PFX y su Contraseña.' });
        }

        const empresa = await Empresa.findById(req.user.empresaRef);
        if (!empresa) {
            return res.status(404).json({ error: 'Empresa no encontrada.' });
        }

        // Almacenamos el Path Relativo/Seguro
        if (!empresa.integracionSII) {
            empresa.integracionSII = { rpaActivo: false, estadoSincronizacion: 'Pendiente' };
        }

        empresa.integracionSII.certificadoDigitalPath = file.path;
        empresa.integracionSII.certificadoPassword = encriptarTexto(password);
        
        await empresa.save();

        res.status(200).json({
            success: true,
            message: 'Certificado PFX asegurado en la Bóveda.',
            filename: file.filename
        });

    } catch (error) {
        console.error("Error asegurando Certificado PFX:", error);
        res.status(500).json({ error: 'Hubo un error cargando el certificado al baúl de contención.' });
    }
}

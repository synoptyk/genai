const Liquidacion = require('../../rrhh/models/Liquidacion');
const Candidato = require('../../rrhh/models/Candidato');
const Empresa = require('../../auth/models/Empresa');
const { encriptarTexto } = require('../../../utils/criptografiaSegura');
const PreviredLog = require('../models/PreviredLog');
const crypto = require('crypto');
const { logAction } = require('../../../utils/auditLogger');

exports.getPreviredHistory = async (req, res) => {
    try {
        const empresaId = req.user.empresaRef;
        const logs = await PreviredLog.find({ empresaRef: empresaId })
            .sort({ fecha: -1 })
            .limit(20)
            .lean();
        res.json(logs);
    } catch (error) {
        next(error);
    }
};

exports.getPreviredStatus = async (req, res) => {
    try {
        const empresa = await Empresa.findById(req.user.empresaRef).select('integracionPrevired');
        if (!empresa || !empresa.integracionPrevired) {
            return res.json({
                rpaActivo: false,
                rutEmpresa: '',
                rutAutorizado: ''
            });
        }
        res.json({
            rpaActivo: empresa.integracionPrevired.rpaActivo,
            rutEmpresa: empresa.integracionPrevired.rutEmpresa,
            rutAutorizado: empresa.integracionPrevired.rutAutorizado
        });
    } catch (error) {
        next(error);
    }
};

exports.saveRPACredentials = async (req, res) => {
    try {
        const { rutEmpresa, rutAutorizado, clavePrevired } = req.body;
        const empresa = await Empresa.findById(req.user.empresaRef);
        
        if (!empresa) return res.status(404).json({ message: "Empresa no encontrada" });

        empresa.integracionPrevired = {
            rpaActivo: true,
            rutEmpresa,
            rutAutorizado,
            clavePrevired: encriptarTexto(clavePrevired),
            ultimaSincronizacion: new Date(),
            estadoSincronizacion: 'Ok'
        };

        await empresa.save();
        await logAction(req, 'Previred', 'SAVE_CREDENTIALS', { rutEmpresa, rutAutorizado });
        res.json({ message: "Credenciales de Previred vinculadas correctamente" });
    } catch (error) {
        next(error);
    }
};

exports.disconnectRPACredentials = async (req, res) => {
    try {
        const empresa = await Empresa.findById(req.user.empresaRef);
        if (!empresa) return res.status(404).json({ message: "Empresa no encontrada" });

        empresa.integracionPrevired = {
            rpaActivo: false,
            rutEmpresa: '',
            rutAutorizado: '',
            clavePrevired: '',
            estadoSincronizacion: 'Sin configurar'
        };

        await empresa.save();
        res.json({ message: "Robot de Previred desconectado correctamente" });
    } catch (error) {
        res.status(500).json({ message: "Error al desconectar Previred" });
    }
};

exports.exportPreviredFile = async (req, res) => {
    try {
        const { periodo } = req.query;
        const empresaId = req.user.empresaRef;

        const liquidaciones = await Liquidacion.find({ 
            periodo,
            empresaRef: empresaId 
        });

        if (!liquidaciones || liquidaciones.length === 0) {
            return res.status(404).json({ message: "No hay liquidaciones para el periodo solicitado" });
        }

        let content = "";
        liquidaciones.forEach(liq => {
            const rut = liq.rutTrabajador.replace(/\./g, '').replace(/-/g, '');
            const dv = rut.slice(-1);
            const rutBody = rut.slice(0, -1).padStart(9, '0');
            
            const nombre = (liq.nombreTrabajador || '').padEnd(30, ' ').substring(0, 30);
            const imponible = Math.round(liq.haberes?.totImponible || 0).toString().padStart(10, '0');
            const afp = (liq.descuentos?.afp?.nombre || 'PROVIDA').padEnd(15, ' ').substring(0, 15);
            
            content += `${rutBody};${dv};${nombre};${imponible};${afp};0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0\n`;
        });

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=PREVIRED_NOMINA_${periodo}.txt`);
        
        // Log the action
        await PreviredLog.create({
            empresaRef: empresaId,
            userRef: req.user._id,
            periodo,
            tipo: 'NOMINA',
            metadata: { recordCount: liquidaciones.length, fileName: `PREVIRED_NOMINA_${periodo}.txt` }
        });

        await logAction(req, 'Previred', 'EXPORT_NOMINA', { periodo, recordCount: liquidaciones.length });
        res.status(200).send(content);

    } catch (error) {
        next(error);
    }
};

exports.exportMovimientos = async (req, res) => {
    try {
        const { periodo } = req.query;
        const empresaId = req.user.empresaRef;

        // Buscamos trabajadores contratados o finiquitados en este periodo
        // Para esta demo, simulamos movimientos mas buscados: Altas y Bajas
        const liquidaciones = await Liquidacion.find({ periodo, empresaRef: empresaId });
        
        let content = "";
        liquidaciones.forEach(liq => {
            const rut = liq.rutTrabajador.replace(/\./g, '').replace(/-/g, '');
            const dv = rut.slice(-1);
            const rutBody = rut.slice(0, -1).padStart(9, '0');
            
            // Tipo Movimiento: 1=Contratación, 2=Finiquito, 3=Licencia, etc.
            // Simulamos: si no tiene liquidación previa es Alta (simplificado)
            const tipoMov = "01"; 
            const fechaDesde = "01".padStart(2, '0');
            const fechaHasta = "30".padStart(2, '0');

            content += `${rutBody};${dv};${tipoMov};${fechaDesde};${fechaHasta};01;00;00;00;00\n`;
        });

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=PREVIRED_MOVIMIENTOS_${periodo}.txt`);

        // Log the action
        await PreviredLog.create({
            empresaRef: empresaId,
            userRef: req.user._id,
            periodo,
            tipo: 'MOVIMIENTOS',
            metadata: { recordCount: liquidaciones.length, fileName: `PREVIRED_MOVIMIENTOS_${periodo}.txt` }
        });

        await logAction(req, 'Previred', 'EXPORT_MOVIMIENTOS', { periodo, recordCount: liquidaciones.length });
        res.status(200).send(content);
    } catch (error) {
        next(error);
    }
};

exports.exportHonorarios = async (req, res) => {
    try {
        const { periodo } = req.query;
        const empresaId = req.user.empresaRef;

        // Simulamos búsqueda de boletas de honorarios
        // En un caso real buscaríamos en el modelo BoletaHonorario
        const mockBoletas = [
            { rut: '18223445-1', nombre: 'JUAN PEREZ', monto: 500000, retencion: 65000 },
            { rut: '12445667-2', nombre: 'ANNA SMITH', monto: 800000, retencion: 104000 },
        ];
        
        let content = "";
        mockBoletas.forEach(b => {
            const rut = b.rut.replace(/\./g, '').replace(/-/g, '');
            const dv = rut.slice(-1);
            const rutBody = rut.slice(0, -1).padStart(9, '0');
            content += `${rutBody};${dv};${b.nombre.padEnd(30, ' ')};${b.monto.toString().padStart(10, '0')};${b.retencion.toString().padStart(10, '0')}\n`;
        });

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=PREVIRED_HONORARIOS_${periodo}.txt`);

        await PreviredLog.create({
            empresaRef: empresaId,
            userRef: req.user._id,
            periodo,
            tipo: 'HONORARIOS',
            metadata: { recordCount: mockBoletas.length, fileName: `PREVIRED_HONORARIOS_${periodo}.txt` }
        });

        await logAction(req, 'Previred', 'EXPORT_HONORARIOS', { periodo, recordCount: mockBoletas.length });
        res.status(200).send(content);
    } catch (error) {
        next(error);
    }
};

exports.getPreviredStats = async (req, res) => {
    try {
        const empresaId = req.user.empresaRef;
        const now = new Date();
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
        const currentYear = now.getFullYear();
        const period = `${currentMonth}-${currentYear}`;

        const count = await Liquidacion.countDocuments({ empresaRef: empresaId, periodo: period });
        const lastLogs = await PreviredLog.find({ empresaRef: empresaId }).sort({ fecha: -1 }).limit(5);

        res.json({
            count,
            period,
            lastLogs,
            nextDeadline: `13 de ${new Intl.DateTimeFormat('es-CL', { month: 'long' }).format(now)}`
        });
    } catch (error) {
        next(error);
    }
};

exports.seedSampleData = async (req, res) => {
    try {
        const { periodo } = req.query;
        const empresaId = req.user.empresaRef;

        const trabajadores = await Candidato.find({ status: { $ne: 'Rechazado' } }).limit(10);
        if (trabajadores.length === 0) {
            return res.status(404).json({ message: "No hay trabajadores en la base de datos para generar muestras." });
        }

        const liquidaciones = trabajadores.map(t => ({
            periodo,
            empresaRef: empresaId,
            trabajadorId: t._id,
            nombreTrabajador: t.fullName || t.nombre,
            rutTrabajador: t.rut,
            cargo: t.position || 'Colaborador',
            haberes: {
                sueldoBase: 600000,
                gratificacion: 150000,
                totImponible: 750000,
                totHaberes: 800000
            },
            descuentos: {
                afp: { nombre: t.afp || 'MODELO', monto: 84000, tasa: 11.27 },
                salud: { nombre: t.previsionSalud || 'FONASA', monto: 52500 },
                totDescuentos: 140000
            },
            sueldoLiquido: 660000
        }));

        await Liquidacion.insertMany(liquidaciones);
        res.json({ message: `${liquidaciones.length} liquidaciones generadas para el periodo ${periodo}` });
    } catch (error) {
        res.status(500).json({ message: "Error al generar datos de muestra" });
    }
};

exports.preFlightCheck = async (req, res) => {
    try {
        const { periodo } = req.query;
        const empresaId = req.user.empresaRef;

        const liquidaciones = await Liquidacion.find({ periodo, empresaRef: empresaId });
        const alerts = [];

        if (liquidaciones.length === 0) {
            alerts.push({ type: 'error', msg: 'Crítico: No existen liquidaciones procesadas para este periodo.' });
        } else {
            alerts.push({ type: 'success', msg: `${liquidaciones.length} colaboradores validados correctamente para el archivo Versión 58.` });
            
            // Regla 1: RUTs Inválidos
            const invalidRuts = liquidaciones.filter(l => !l.rutTrabajador || l.rutTrabajador.length < 8);
            if (invalidRuts.length > 0) {
                alerts.push({ type: 'error', msg: `Error: ${invalidRuts.length} registros tienen el RUT incompleto o mal formateado.` });
            }

            // Regla 2: AFPs faltantes (Previred requiere AFP para casi todos los contratos)
            const sinAFP = liquidaciones.filter(l => !l.descuentos?.afp?.nombre);
            if (sinAFP.length > 0) {
                alerts.push({ type: 'warning', msg: `Advertencia: ${sinAFP.length} colaboradores no tienen AFP asignada (se usará AFP Provida por defecto).` });
            }

            // Regla 3: Montos imponibles en cero
            const imponibleCero = liquidaciones.filter(l => (l.haberes?.totImponible || 0) <= 0);
            if (imponibleCero.length > 0) {
                alerts.push({ type: 'warning', msg: `Info: ${imponibleCero.length} liquidaciones tienen monto imponible $0 (posible licencia o permiso sin goce).` });
            }

            // Regla 4: Salud (Fonasa/Isapre)
            const sinSalud = liquidaciones.filter(l => !l.descuentos?.salud?.nombre);
            if (sinSalud.length > 0) {
                alerts.push({ type: 'error', msg: `Crítico: ${sinSalud.length} registros no tienen institución de salud definida.` });
            }
        }

        res.json({ alerts });
    } catch (error) {
        next(error);
    }
};

const Inspeccion = require('../models/Inspeccion');
const AST = require('../models/AST'); // Para generar alertas en HSE
const mailer = require('../../../utils/mailer');

// GET todas
exports.getInspecciones = async (req, res) => {
    try {
        const { tipo, estado } = req.query;
        // 🔒 FILTRO POR EMPRESA
        const filter = { empresaRef: req.user.empresaRef };
        if (tipo) filter.tipo = tipo;
        if (estado) filter.estado = estado;
        const items = await Inspeccion.find(filter).sort({ createdAt: -1 });
        res.json(items);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// GET by ID
exports.getInspeccionById = async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const item = await Inspeccion.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!item) return res.status(404).json({ error: 'No encontrado o sin acceso' });
        res.json(item);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// POST crear
exports.createInspeccion = async (req, res) => {
    try {
        const data = { ...req.body, empresaRef: req.user.empresaRef };

        // --- LÓGICA DE ALERTAS INTELIGENTES para EPP ---
        if (data.tipo === 'epp' && data.itemsEpp) {
            const itemsDeficientes = data.itemsEpp.filter(item => !item.tiene || item.condicion === 'Malo');
            if (itemsDeficientes.length > 0) {
                data.alertaHse = true;
                data.resultado = 'No Conforme';
                const detalles = itemsDeficientes.map(i => `${i.nombre}: ${!i.tiene ? 'Ausente' : 'Condición: Malo'}`).join(' | ');
                data.detalleAlerta = `EPP DEFICIENTE - Trabajador: ${data.nombreTrabajador} (${data.rutTrabajador}). Problemas: ${detalles}`;

                // Crear alerta como AST especial para que aparezca en la Consola HSE
                await AST.create({
                    ot: data.ot || 'ALERTA-EPP',
                    empresa: data.empresa,
                    empresaRef: req.user.empresaRef, // 🔒 PROPAGACIÓN
                    gps: data.gps || '0,0',
                    nombreTrabajador: data.nombreTrabajador,
                    rutTrabajador: data.rutTrabajador,
                    cargoTrabajador: data.cargoTrabajador || 'N/A',
                    estado: 'En Revisión',
                    controlMedidas: `[ALERTA AUTOMÁTICA] Inspección EPP No Conforme. ${data.detalleAlerta}`,
                    riesgosSeleccionados: ['epp_deficiente'],
                    eppVerificado: [],
                    aptitud: 'No',
                    firmaColaborador: null
                });
            } else {
                data.resultado = 'Conforme';
            }
        }

        // --- LÓGICA DE ALERTAS para Cumplimiento ---
        if (data.tipo === 'cumplimiento-prevencion' && data.cumplimiento) {
            const c = data.cumplimiento;
            const noConformes = [];
            if (!c.tieneAst) noConformes.push('Sin AST');
            if (!c.tienePts) noConformes.push('Sin PTS');
            if (!c.tieneEpp) noConformes.push('Sin EPP');
            if (!c.inductionRealizada) noConformes.push('Sin Inducción');
            if (noConformes.length > 0) {
                data.alertaHse = true;
                data.resultado = 'No Conforme';
                data.detalleAlerta = `INCUMPLIMIENTO PREVENTIVO - Trabajador: ${data.nombreTrabajador}. Faltas: ${noConformes.join(', ')}`;

                await AST.create({
                    ot: data.ot || 'ALERTA-CUMPLIMIENTO',
                    empresa: data.empresa,
                    empresaRef: req.user.empresaRef, // 🔒 PROPAGACIÓN
                    gps: data.gps || '0,0',
                    nombreTrabajador: data.nombreTrabajador,
                    rutTrabajador: data.rutTrabajador,
                    cargoTrabajador: data.cargoTrabajador || 'N/A',
                    estado: 'En Revisión',
                    controlMedidas: `[ALERTA AUTOMÁTICA] Incumplimiento Preventivo. ${data.detalleAlerta}`,
                    riesgosSeleccionados: ['incumplimiento_normativa'],
                    eppVerificado: [],
                    aptitud: 'No',
                    firmaColaborador: null
                });
            } else {
                data.resultado = 'Conforme';
            }
        }

        const inspeccion = await Inspeccion.create(data);

        // Enviar email ejecutivo (no bloqueante)
        mailer.sendInspeccionEmail(inspeccion.toObject()).catch(err =>
            console.error('Error enviando email inspección:', err.message)
        );

        res.status(201).json(inspeccion);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// PUT actualizar
exports.updateInspeccion = async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const item = await Inspeccion.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            req.body,
            { new: true }
        );
        if (!item) return res.status(404).json({ error: 'No encontrado o sin acceso' });
        res.json(item);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// DELETE
exports.deleteInspeccion = async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const item = await Inspeccion.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!item) return res.status(404).json({ error: 'No encontrado o sin acceso' });
        res.json({ message: 'Eliminado' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

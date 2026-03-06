const AST = require('../models/AST');
const RiesgoIPER = require('../models/RiesgoIPER');
const Hallazgo = require('../models/Hallazgo');
const { sendASTEmail } = require('../../../utils/mailer');

exports.getASTs = async (req, res) => {
    try {
        const { estado } = req.query;
        // 🔒 FILTRO POR EMPRESA
        const query = { empresaRef: req.user.empresaRef };
        if (estado) query.estado = estado;

        const asts = await AST.find(query).sort({ createdAt: -1 });
        res.json(asts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getASTById = async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const ast = await AST.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!ast) return res.status(404).json({ message: 'AST no encontrada o sin acceso' });
        res.json(ast);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createAST = async (req, res) => {
    try {
        // 🔒 INYECTAR EMPRESA
        const ast = new AST({
            ...req.body,
            empresaRef: req.user.empresaRef
        });
        await ast.save();

        // ── LÓGICA DE BLINDAJE: Detección de Riesgos Críticos (🔒 FILTRO POR EMPRESA) ──
        if (ast.riesgosSeleccionados?.length > 0) {
            const riesgosEnIper = await RiesgoIPER.find({
                riesgo: { $in: ast.riesgosSeleccionados },
                clasificacion: 'Crítico',
                empresaRef: req.user.empresaRef // 🔒 FILTRO POR EMPRESA
            });

            if (riesgosEnIper.length > 0) {
                // Crear Hallazgo Automático
                const descripciones = riesgosEnIper.map(r => r.riesgo).join(', ');
                const hallazgo = new Hallazgo({
                    astRef: ast._id,
                    empresaRef: req.user.empresaRef, // 🔒 INYECTAR EMPRESA
                    descripcion: `ALERTA CRÍTICA: Se reportaron los siguientes peligros de alto riesgo en terreno: ${descripciones}`,
                    prioridad: 'Crítica',
                    responsable: 'HSE CORPORATIVO',
                    estado: 'Abierto'
                });
                await hallazgo.save();

                // Marcar AST como con hallazgo para el frontend
                ast.comentariosHse = `HALLAZGO CRÍTICO GENERADO: ${descripciones}. Mantenga vigilancia constante.`;
                await ast.save();
            }
        }

        // ── ENVÍO DE EMAIL AL TRABAJADOR (Espera activa para asegurar entrega) ──
        try {
            // Intentamos obtener datos de marca extendidos de la empresa
            const Empresa = require('../../auth/models/Empresa');
            const empDoc = await Empresa.findOne({ nombre: ast.empresa });

            await sendASTEmail({
                ...ast.toObject(),
                companyName: empDoc?.nombre || ast.empresa,
                companyLogo: empDoc?.logo
            });
        } catch (err) {
            console.error('🔴 AST: Error en envío de email:', err.message);
        }

        res.status(201).json(ast);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateAST = async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const ast = await AST.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            req.body,
            { new: true }
        );
        if (!ast) return res.status(404).json({ message: 'AST no encontrada o sin acceso' });
        res.json(ast);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteAST = async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const ast = await AST.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!ast) return res.status(404).json({ message: 'AST no encontrada o sin acceso' });
        res.json({ message: 'AST eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

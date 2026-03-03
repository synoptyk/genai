const AST = require('../models/AST');
const RiesgoIPER = require('../models/RiesgoIPER');
const Hallazgo = require('../models/Hallazgo');
const { sendASTEmail } = require('../../../utils/mailer');

exports.getASTs = async (req, res) => {
    try {
        const { estado } = req.query;
        const query = estado ? { estado } : {};
        const asts = await AST.find(query).sort({ createdAt: -1 });
        res.json(asts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getASTById = async (req, res) => {
    try {
        const ast = await AST.findById(req.params.id);
        if (!ast) return res.status(404).json({ message: 'AST no encontrada' });
        res.json(ast);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createAST = async (req, res) => {
    try {
        const ast = new AST(req.body);
        await ast.save();

        // ── LÓGICA DE BLINDAJE: Detección de Riesgos Críticos ──
        if (ast.riesgosSeleccionados?.length > 0) {
            const riesgosEnIper = await RiesgoIPER.find({
                riesgo: { $in: ast.riesgosSeleccionados },
                clasificacion: 'Crítico'
            });

            if (riesgosEnIper.length > 0) {
                // Crear Hallazgo Automático
                const descripciones = riesgosEnIper.map(r => r.riesgo).join(', ');
                const hallazgo = new Hallazgo({
                    astRef: ast._id,
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

        // ── ENVÍO DE EMAIL AL TRABAJADOR (sin bloquear la respuesta) ──
        sendASTEmail(ast).catch(err =>
            console.warn('⚠️ AST: Email no enviado:', err.message)
        );

        res.status(201).json(ast);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateAST = async (req, res) => {
    try {
        const ast = await AST.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!ast) return res.status(404).json({ message: 'AST no encontrada' });
        res.json(ast);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteAST = async (req, res) => {
    try {
        const ast = await AST.findByIdAndDelete(req.params.id);
        if (!ast) return res.status(404).json({ message: 'AST no encontrada' });
        res.json({ message: 'AST eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const ContratoDocumento = require('../models/ContratoDocumento');
const EmpresaConfig = require('../models/EmpresaConfig');
const mailer = require('../../../utils/mailer');
const mongoose = require('mongoose');

const contratoController = {
    getAll: async (req, res) => {
        try {
            const filter = { empresaRef: req.user.empresaRef };
            const documentos = await ContratoDocumento.find(filter)
                .populate('candidatoRef', 'fullName rut')
                .populate('plantillaRef', 'nombre')
                .sort({ updatedAt: -1 });
            res.json(documentos);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    getById: async (req, res) => {
        try {
            const documento = await ContratoDocumento.findOne({ 
                _id: req.params.id, 
                empresaRef: req.user.empresaRef 
            }).populate('candidatoRef').populate('plantillaRef');
            
            if (!documento) return res.status(404).json({ message: 'Documento no encontrado' });
            res.json(documento);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    create: async (req, res) => {
        try {
            const nuevoDoc = new ContratoDocumento({
                ...req.body,
                empresaRef: req.user.empresaRef,
                solicitadoPor: {
                    name: req.user.name,
                    email: req.user.email,
                    timestamp: new Date()
                }
            });
            const saved = await nuevoDoc.save();
            res.status(201).json(saved);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    requestApproval: async (req, res) => {
        try {
            const doc = await ContratoDocumento.findOne({ 
                _id: req.params.id, 
                empresaRef: req.user.empresaRef 
            });
            if (!doc) return res.status(404).json({ message: 'Documento no encontrado' });

            // 1. Obtener flujo de la empresa
            const config = await EmpresaConfig.findOne({ empresaRef: req.user.empresaRef });
            if (!config) return res.status(400).json({ message: 'No hay configuración de empresa definida' });

            const typeKey = doc.tipo === 'Contrato' ? 'Contrato' : 'Anexo';
            const workflow = config.approvalWorkflows.find(w => w.module === typeKey);

            if (!workflow || !workflow.approvers || workflow.approvers.length === 0) {
                return res.status(400).json({ message: `No hay un flujo de aprobación configurado para ${typeKey}` });
            }

            // 2. Poblar approvalChain
            doc.approvalChain = workflow.approvers.map(app => ({
                id: app.id?.toString(),
                name: app.name,
                email: app.email,
                position: app.position,
                status: 'Pendiente',
                updatedAt: new Date()
            }));

            doc.estado = 'Pendiente de Aprobación';
            await doc.save();

            // 3. Notificar a los aprobadores
            const emails = doc.approvalChain.map(a => a.email).join(', ');
            await mailer.sendContractApprovalEmail(doc, emails);

            res.json(doc);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    approve: async (req, res) => {
        try {
            const { comment } = req.body;
            const doc = await ContratoDocumento.findOne({ 
                _id: req.params.id, 
                empresaRef: req.user.empresaRef 
            });
            if (!doc) return res.status(404).json({ message: 'Documento no encontrado' });

            // Encontrar el paso del usuario actual en la cadena
            // Nota: En un entorno real compararíamos emails o IDs. 
            // Aquí buscaremos el primer "Pendiente" que coincida con el email del usuario logueado.
            const approverStep = doc.approvalChain.find(a => a.email === req.user.email && a.status === 'Pendiente');
            
            if (!approverStep) {
                return res.status(403).json({ message: 'Usted no tiene autorizaciones pendientes para este documento' });
            }

            approverStep.status = 'Aprobado';
            approverStep.comment = comment;
            approverStep.updatedAt = new Date();

            // Revisar si todos aprobaron
            const allApproved = doc.approvalChain.every(a => a.status === 'Aprobado');
            if (allApproved) {
                doc.estado = 'Aprobado';
                // Aquí se podría disparar la generación del PDF final o firma digital avanzada
            }

            await doc.save();
            res.json(doc);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    remove: async (req, res) => {
        try {
            const doc = await ContratoDocumento.findOneAndDelete({ 
                _id: req.params.id, 
                empresaRef: req.user.empresaRef 
            });
            if (!doc) return res.status(404).json({ message: 'Documento no encontrado' });
            res.json({ message: 'Documento eliminado' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
};

module.exports = contratoController;

const Inspeccion = require('../models/Inspeccion');
const AST = require('../models/AST'); // Para generar alertas en HSE
const mailer = require('../../../utils/mailer');
const logger = require('../../../utils/logger');
const PlatformUser = require('../../auth/PlatformUser');
const Notification = require('../../rrhh/models/Notification');
const cloudinary = require('cloudinary').v2;

const isImageDataUri = (value) => typeof value === 'string' && value.startsWith('data:image');

const safeUploadImage = async (dataUri, folder) => {
    try {
        const result = await cloudinary.uploader.upload(dataUri, {
            folder,
            resource_type: 'image'
        });
        return result?.secure_url || null;
    } catch (error) {
        logger.error('Inspeccion cloudinary upload error', { error: error.message, folder });
        return null;
    }
};

const persistInspeccionMedia = async (rawData, empresaRef) => {
    const data = {
        ...rawData,
        inspector: { ...(rawData.inspector || {}) },
        firmaColaborador: { ...(rawData.firmaColaborador || {}) }
    };
    const cfg = cloudinary.config();
    if (!cfg?.cloud_name) return data;
    const folder = `prevencion_inspecciones/${String(empresaRef || 'sin_empresa')}`;

    if (Array.isArray(data.fotoEvidencia)) {
        const fotos = await Promise.all(data.fotoEvidencia.map(async (foto) => {
            if (!isImageDataUri(foto)) return foto;
            return await safeUploadImage(foto, `${folder}/evidencia`);
        }));
        data.fotoEvidencia = fotos.filter(Boolean);
    }

    if (isImageDataUri(data?.inspector?.firma)) {
        const inspectorUrl = await safeUploadImage(data.inspector.firma, `${folder}/firmas/inspector`);
        if (inspectorUrl) data.inspector.firma = inspectorUrl;
    }

    if (isImageDataUri(data?.firmaColaborador?.firma)) {
        const colaboradorUrl = await safeUploadImage(data.firmaColaborador.firma, `${folder}/firmas/colaborador`);
        if (colaboradorUrl) data.firmaColaborador.firma = colaboradorUrl;
    }

    return data;
};

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
        logger.error('Inspeccion getAll error', { error: e.message });
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
        logger.error('Inspeccion getById error', { error: e.message, id: req.params.id });
        res.status(500).json({ error: e.message });
    }
};

// POST crear
exports.createInspeccion = async (req, res) => {
    try {
        const mediaPersistida = await persistInspeccionMedia(req.body, req.user.empresaRef);
        const data = {
            ...mediaPersistida,
            empresaRef: req.user.empresaRef,
            empresa: mediaPersistida.empresa || req.user.empresa || String(req.user.empresaRef || ''),
            creadoPor: req.user.name || req.user.email || String(req.user._id),
            supervisorRef: req.user._id
        };

        const faltaFirmaTecnico = !data?.firmaColaborador?.firma;
        if (faltaFirmaTecnico) {
            const obsFirmaPendiente = 'OBSERVACION AUTOMATICA: TECNICO SIN FIRMA. INSPECCION ENVIADA A REVISION PARA REGULARIZAR Y FIRMAR.';
            data.estado = 'En Revisión';
            data.observaciones = [data.observaciones, obsFirmaPendiente].filter(Boolean).join(' | ');
        }

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

        // Notificación interna a jefatura/gerencia para trazabilidad 360
        try {
            const destinatarios = await PlatformUser.find({
                empresaRef: req.user.empresaRef,
                role: { $in: ['jefatura', 'gerencia', 'admin', 'ceo', 'system_admin'] },
                status: 'Activo'
            }).select('email');

            for (const dest of destinatarios) {
                if (!dest.email) continue;
                await Notification.create({
                    userEmail: dest.email,
                    title: 'Nueva inspección pendiente de revisión',
                    message: `${inspeccion.tipo} · ${inspeccion.nombreTrabajador} (${inspeccion.rutTrabajador})`,
                    type: 'approval',
                    link: '/administracion/aprobaciones',
                    empresaRef: req.user.empresaRef,
                    metadata: {
                        module: 'OPERACIONES',
                        action: 'InspeccionPendiente',
                        inspeccionId: inspeccion._id
                    }
                });
            }
        } catch (notifyErr) {
            logger.error('Inspeccion notify executives error', { error: notifyErr.message, inspeccionId: inspeccion._id });
        }

        // Enviar email ejecutivo (no bloqueante)
        mailer.sendInspeccionEmail(inspeccion.toObject()).catch(err =>
            console.error('Error enviando email inspección:', err.message)
        );

        res.status(201).json(inspeccion);
    } catch (e) {
        logger.error('Inspeccion create error', {
            error: e.message,
            user: req.user?._id,
            empresa: req.user?.empresaRef,
            payload_rut: req.body?.rutTrabajador,
            payload_tipo: req.body?.tipo
        });
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
        logger.error('Inspeccion update error', { error: e.message, id: req.params.id, user: req.user?._id });
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
        logger.error('Inspeccion delete error', { error: e.message, id: req.params.id, user: req.user?._id });
        res.status(500).json({ error: e.message });
    }
};

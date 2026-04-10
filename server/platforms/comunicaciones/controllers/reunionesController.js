const Meeting = require('../models/Meeting');
const PlatformUser = require('../../auth/PlatformUser');
const { sendMeetingInvitationEmail } = require('../../../utils/mailer');
const mongoose = require('mongoose');
const { randomUUID: uuidv4 } = require('crypto');
const ROLES = require('../../auth/roles');

const roleOf = (u) => String(u?.role || '').toLowerCase();
const isSystemAdmin = (u) => roleOf(u) === ROLES.SYSTEM_ADMIN;
const isManagerRole = (u) => [ROLES.SYSTEM_ADMIN, ROLES.CEO, ROLES.CEO_GENAI, ROLES.ADMIN, ROLES.GERENCIA].includes(roleOf(u));
const isSupervisorRole = (u) => roleOf(u) === ROLES.SUPERVISOR;
const isTecnicoRole = (u) => roleOf(u) === ROLES.TECNICO;

function buildVisibilityQuery(user) {
    const query = { _id: { $ne: user._id } };
    if (!isSystemAdmin(user)) query.empresaRef = user.empresaRef;
    if (isTecnicoRole(user)) {
        query.role = { $in: [ROLES.SUPERVISOR] };
    } else if (isSupervisorRole(user)) {
        query.role = { $in: [ROLES.TECNICO, ROLES.ADMINISTRATIVO, ROLES.GERENCIA, ROLES.ADMIN, ROLES.CEO, ROLES.CEO_GENAI, ROLES.SUPERVISOR] };
    }
    return query;
}

// 1. Obtener Reuniones (donde el usuario es organizador o participante, filtrado por empresa)
exports.getMeetings = async (req, res) => {
    try {
        const user = req.user;
        let query = {
            $or: [
                { organizerRef: user._id },
                { participants: user._id }
            ]
        };

        // Si no es admin global, aislar por empresaRef
        if (user.role !== 'system_admin') {
            query.empresaRef = user.empresaRef;
        }

        const meetings = await Meeting.find(query)
            .populate('organizerRef', 'name cargo email avatar')
            .populate('participants', 'name cargo email avatar')
            .sort({ date: 1, startTime: 1 });

        res.json(meetings);
    } catch (error) {
        console.error("Error getMeetings:", error);
        res.status(500).json({ error: error.message });
    }
};

// 2. Programar una Nueva Reunión
exports.createMeeting = async (req, res) => {
    try {
        const { title, description, date, startTime, duration, participants } = req.body;
        const user = req.user;

        const visibilityQuery = buildVisibilityQuery(user);
        const requestedParticipants = Array.isArray(participants) ? participants.map(String) : [];
        if (requestedParticipants.length > 0) {
            const allowedCount = await PlatformUser.countDocuments({
                ...visibilityQuery,
                _id: { $in: requestedParticipants }
            });
            if (allowedCount !== requestedParticipants.length && !isManagerRole(user)) {
                return res.status(403).json({ error: 'Incluyes participantes fuera de tu alcance de comunicación.' });
            }
        }

        // Unique ID para la videollamada sala
        const roomId = uuidv4();

        // Validar participantes y agregarse a sí mismo
        const finalParticipants = [...new Set([...(participants || []), user._id.toString()])];

        const newMeeting = new Meeting({
            title,
            description,
            date,
            startTime,
            duration,
            organizerRef: user._id,
            participants: finalParticipants,
            roomId,
            empresaRef: user.empresaRef
        });

        await newMeeting.save();

        const populatedMeeting = await Meeting.findById(newMeeting._id)
            .populate('organizerRef', 'name cargo email')
            .populate('participants', 'name cargo email');

        // Disparar Notificaciones por Correo Asíncronamente
        const guestEmails = populatedMeeting.participants
            .filter(p => String(p._id) !== String(user._id))
            .map(p => p.email)
            .filter(Boolean);

        if (guestEmails.length > 0) {
            sendMeetingInvitationEmail(populatedMeeting, guestEmails.join(', ')).catch(console.error);
        }

        res.status(201).json(populatedMeeting);
    } catch (error) {
        console.error("Error createMeeting:", error);
        res.status(500).json({ error: error.message });
    }
};

// 3. Modificar Reunión
exports.updateMeeting = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const meeting = await Meeting.findById(id);
        if (!meeting) return res.status(404).json({ error: 'Reunión no encontrada' });

        if (String(meeting.organizerRef) !== String(user._id) && user.role !== 'system_admin') {
            return res.status(403).json({ error: 'No autorizado para modificar' });
        }

        const updated = await Meeting.findByIdAndUpdate(id, req.body, { new: true })
            .populate('organizerRef', 'name cargo email avatar')
            .populate('participants', 'name cargo email avatar');

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 4. Cancelar Reunión
exports.cancelMeeting = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const meeting = await Meeting.findById(id);
        if (!meeting) return res.status(404).json({ error: 'Reunión no encontrada' });

        if (String(meeting.organizerRef) !== String(user._id) && user.role !== 'system_admin') {
            return res.status(403).json({ error: 'No autorizado para eliminar' });
        }

        await Meeting.findByIdAndDelete(id);
        // Opcionalmente: enviar e-mail de cancelación aquí
        
        res.json({ success: true, message: 'Reunión cancelada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

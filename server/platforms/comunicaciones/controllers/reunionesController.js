const Meeting = require('../models/Meeting');
const PlatformUser = require('../../auth/PlatformUser');
const { sendMeetingInvitationEmail } = require('../../../utils/mailer');
const mongoose = require('mongoose');
const { randomUUID: uuidv4 } = require('crypto');
const ROLES = require('../../auth/roles');

const roleOf = (u) => String(u?.role || '').toLowerCase();
const isSystemAdmin = (u) => roleOf(u) === ROLES.SYSTEM_ADMIN;
const cargoOf = (u) => String(u?.cargo || '').toLowerCase();
const isManagerRole = (u) => [ROLES.SYSTEM_ADMIN, ROLES.CEO, ROLES.CEO_GENAI, ROLES.ADMIN, ROLES.GERENCIA].includes(roleOf(u));
const isManagerCargo = (u) => /(geren|ceo|director|administrador\s*maestro|usuario\s*maestro|admin\s*maestro)/i.test(cargoOf(u));
const isManagerPrincipal = (u) => isManagerRole(u) || isManagerCargo(u);
const isSupervisorRole = (u) => roleOf(u) === ROLES.SUPERVISOR;
const isSupervisorCargo = (u) => /(supervisor|jefe\s*de\s*terreno)/i.test(cargoOf(u));
const isSupervisorPrincipal = (u) => isSupervisorRole(u) || isSupervisorCargo(u);
const isTecnicoRole = (u) => [ROLES.TECNICO, ROLES.OPERATIVO].includes(roleOf(u));
const isTecnicoCargo = (u) => /(tecnico|t[eé]cnico|operativo)/i.test(cargoOf(u));
const isTecnicoPrincipal = (u) => isTecnicoRole(u) || isTecnicoCargo(u);
const isAdministrativoPrincipal = (u) => [ROLES.ADMINISTRATIVO, ROLES.RRHH, ROLES.AUDITOR, ROLES.JEFATURA].includes(roleOf(u));

function classifyUser(u) {
    if (isManagerPrincipal(u)) return 'manager';
    if (isSupervisorPrincipal(u)) return 'supervisor';
    if (isTecnicoPrincipal(u)) return 'tecnico';
    if (isAdministrativoPrincipal(u)) return 'administrativo';
    return 'other';
}

function canUserContact(viewer, target) {
    if (!target) return false;
    const v = classifyUser(viewer);
    const t = classifyUser(target);
    if (v === 'manager') return true;
    if (v === 'supervisor') return ['tecnico', 'administrativo', 'manager', 'supervisor'].includes(t);
    if (v === 'tecnico') return t === 'supervisor';
    return ['supervisor', 'administrativo'].includes(t);
}

function buildVisibilityQuery(user) {
    const query = { _id: { $ne: user._id } };
    if (!isSystemAdmin(user)) query.empresaRef = user.empresaRef;
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

        let meetings = await Meeting.find(query)
            .populate('organizerRef', 'name cargo email avatar')
            .populate('participants', 'name cargo email avatar')
            .sort({ date: 1, startTime: 1 });

        if (!isManagerPrincipal(user)) {
            meetings = meetings.filter(m => {
                const others = (m.participants || []).filter(p => String(p._id || p) !== String(user._id));
                const organizer = m.organizerRef && String(m.organizerRef._id || m.organizerRef) !== String(user._id)
                    ? [m.organizerRef]
                    : [];
                return [...others, ...organizer].every(p => canUserContact(user, p));
            });
        }

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
            const targetUsers = await PlatformUser.find({
                ...visibilityQuery,
                _id: { $in: requestedParticipants }
            }).select('role cargo empresaRef').lean();
            if (targetUsers.length !== requestedParticipants.length && !isManagerPrincipal(user)) {
                return res.status(403).json({ error: 'Incluyes participantes fuera de tu alcance de comunicación.' });
            }
            if (!isManagerPrincipal(user)) {
                const hasForbidden = targetUsers.some(u => !canUserContact(user, u));
                if (hasForbidden) {
                    return res.status(403).json({ error: 'Incluyes participantes fuera de tu alcance de comunicación.' });
                }
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

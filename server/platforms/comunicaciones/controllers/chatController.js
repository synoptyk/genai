const Message = require('../models/Message');
const Room = require('../models/Room');
const PlatformUser = require('../../auth/PlatformUser');
const ChatStatus = require('../models/ChatStatus');
const ChatAnnouncement = require('../models/ChatAnnouncement');
const mongoose = require('mongoose');
const ROLES = require('../../auth/roles');

// Memoria volátil para conexiones activas (SSE)
let clients = [];

const roleOf = (u) => String(u?.role || '').toLowerCase();
const cargoOf = (u) => String(u?.cargo || '').toLowerCase();
const isSystemAdmin = (u) => roleOf(u) === ROLES.SYSTEM_ADMIN;

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
    if (!u) return 'other';
    const role = String(u.role || '').toLowerCase();
    const cargo = String(u.cargo || '').toLowerCase();

    const isManager = ['system_admin', 'ceo', 'ceo_genai', 'admin', 'gerencia'].includes(role) || /(geren|ceo|director|administrador|jefatura\s*general)/i.test(cargo);
    const isSupervisor = role === 'supervisor' || /(supervisor|jefe\s*de\s*terreno|jefe)/i.test(cargo);
    const isTecnico = ['tecnico', 'operativo'].includes(role) || /(tecnico|t[eé]cnico|operativo|conductor|chofer|maestro|ayudante|guardia|operador)/i.test(cargo);
    const isAdmin = ['administrativo', 'rrhh', 'auditor', 'jefatura'].includes(role);

    if (isManager) return 'manager';
    if (isSupervisor) return 'supervisor';
    if (isTecnico) return 'tecnico';
    if (isAdmin) return 'administrativo';
    return 'tecnico'; // Tratamos al resto como técnico por seguridad
}

function canUserContact(viewer, target) {
    if (!viewer || !target) return false;
    const v = classifyUser(viewer);
    const t = classifyUser(target);

    if (v === 'manager') return true;
    if (v === 'supervisor') return ['tecnico', 'administrativo', 'manager', 'supervisor'].includes(t);
    
    // Tecnicos/operativos solo pueden ver a supervisores y otros tecnicos/administrativos. NUNCA a managers.
    if (v === 'tecnico') return ['tecnico', 'supervisor', 'administrativo'].includes(t);

    return ['supervisor', 'administrativo', 'tecnico'].includes(t);
}

function buildBaseVisibilityQuery(user) {
    const query = { _id: { $ne: user._id } };
    if (!isSystemAdmin(user)) query.empresaRef = user.empresaRef;
    return query;
}

// 1. Obtener historial de una sala (roomId)
exports.getMessages = async (req, res) => {
    try {
        const { roomId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = 50;
        const user = req.user;

        // Verificar si la sala existe y si el usuario tiene acceso
        let room = null;
        if (mongoose.Types.ObjectId.isValid(roomId)) {
            room = await Room.findById(roomId);
        }
        
        if (!room) {
            // Caso especial para salas hardcoded previas o soporte
            const empRef = user.empresaRef?._id || user.empresaRef;
            const isManualCompanyRoom = roomId === `company_${empRef}`;
            
            if (roomId !== 'soporte_genai' && !isManualCompanyRoom) {
                return res.status(404).json({ error: 'Sala no encontrada.' });
            }
            if (isManualCompanyRoom && isTecnicoPrincipal(user)) {
                return res.status(403).json({ error: 'Los técnicos no pueden acceder al chat global de empresa.' });
            }
        } else {
            // Aislamiento: El usuario debe ser miembro o ser de la misma empresa para salas públicas
            const isMember = room.members.some(id => id.toString() === user._id.toString());
            if (!isMember && room.empresaRef !== user.empresaRef && user.role !== 'system_admin') {
                return res.status(403).json({ error: 'Acceso denegado a esta sala.' });
            }

            if (room.type === 'company' && isTecnicoPrincipal(user)) {
                return res.status(403).json({ error: 'Los técnicos no pueden acceder al chat global de empresa.' });
            }

            if (!isManagerPrincipal(user) && ['direct', 'group'].includes(room.type)) {
                const others = room.members.filter(id => String(id) !== String(user._id));
                if (others.length > 0) {
                    const participants = await PlatformUser.find({ _id: { $in: others } }).select('role cargo empresaRef').lean();
                    const hasForbidden = participants.some(p => !canUserContact(user, p));
                    if (hasForbidden) {
                        return res.status(403).json({ error: 'Esta sala incluye participantes fuera de tu alcance de comunicación.' });
                    }
                }
            }
        }

        const messages = await Message.find({ roomId })
            .populate('senderRef', 'name cargo role isOnline avatar')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json(messages.reverse());
    } catch (error) {
        console.error("Error getMessages:", error);
        res.status(500).json({ error: error.message });
    }
};

// 2. Enviar un nuevo mensaje a una sala específica
exports.sendMessage = async (req, res) => {
    try {
        const { roomId, text, type } = req.body;
        const user = req.user;

        // Validacion de aislamiento
        let roomObj = null;
        if (mongoose.Types.ObjectId.isValid(roomId)) {
            const room = await Room.findById(roomId);
            roomObj = room;
            if (!room) return res.status(404).json({ error: 'Sala no existe.' });
            const isMember = room.members.some(id => id.toString() === user._id.toString());
            if (!isMember && user.role !== 'system_admin') {
                return res.status(403).json({ error: 'No eres miembro de este grupo.' });
            }
        } else {
            const empRef = user.empresaRef?._id || user.empresaRef;
            const isManualCompanyRoom = roomId === `company_${empRef}`;
            if (roomId !== 'soporte_genai' && !isManualCompanyRoom && user.role !== 'system_admin') {
                return res.status(403).json({ error: 'Acceso denegado a esta sala.' });
            }
            if (isManualCompanyRoom && isTecnicoPrincipal(user)) {
                return res.status(403).json({ error: 'Los técnicos no pueden escribir en el chat global de empresa.' });
            }
        }

        if (roomObj) {
            if (roomObj.type === 'company' && isTecnicoPrincipal(user)) {
                return res.status(403).json({ error: 'Los técnicos no pueden escribir en el chat global de empresa.' });
            }
            if (!isManagerPrincipal(user) && ['direct', 'group'].includes(roomObj.type)) {
                const others = roomObj.members.filter(id => String(id) !== String(user._id));
                if (others.length > 0) {
                    const participants = await PlatformUser.find({ _id: { $in: others } }).select('role cargo empresaRef').lean();
                    const hasForbidden = participants.some(p => !canUserContact(user, p));
                    if (hasForbidden) {
                        return res.status(403).json({ error: 'No puedes escribir en una sala con participantes fuera de tu alcance.' });
                    }
                }
            }
        }

        const newMsg = new Message({
            roomId,
            senderRef: user._id,
            empresaRef: user.empresaRef,
            text,
            type: type || 'text',
            isReadBy: [user._id]
        });

        await newMsg.save();

        // Broadcast vía SSE a todos los interesados (mismo roomId o contexto empresa)
        const populatedMsg = await Message.findById(newMsg._id).populate('senderRef', 'name cargo role isOnline avatar');
        
        // Notificar a los clientes conectados
        clients.forEach(client => {
            // Regla 1: Notificar si están en la misma sala (Chat Abierto)
            if (client.roomId === roomId || client.userId === roomId) {
                client.res.write(`data: ${JSON.stringify({ type: 'new_message', data: populatedMsg })}\n\n`);
            }
            
            // Regla 2: Notificación global (App-wide Toast)
            if (client.roomId === 'global') {
                let canSee = false;
                if (roomObj) {
                    const isMember = roomObj.members.some(id => id.toString() === client.userId.toString());
                    const isCompanyMatch = roomObj.type === 'company' && String(roomObj.empresaRef) === String(client.empresaRef);
                    if (isMember || isCompanyMatch || client.role === 'system_admin') {
                        canSee = true;
                    }
                } else {
                    const isManualCompanyRoom = roomId === `company_${client.empresaRef}`;
                    if (isManualCompanyRoom || roomId === 'soporte_genai') canSee = true;
                }

                if (canSee) {
                    client.res.write(`data: ${JSON.stringify({ type: 'global_notification', data: populatedMsg, roomName: roomObj ? roomObj.name : 'Soporte / Empresa' })}\n\n`);
                }
            }
        });

        res.status(201).json(populatedMsg);
    } catch (error) {
        console.error("Error sendMessage:", error);
        res.status(500).json({ error: error.message });
    }
};

// 3. Marcar mensajes de una sala como leídos
exports.markAsRead = async (req, res) => {
    try {
        const { roomId } = req.body;
        const userId = req.user._id;

        await Message.updateMany(
            { roomId, 'isReadBy': { $ne: userId } },
            { $push: { isReadBy: userId } }
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 4. Endpoint SSE para Real-time Streaming
exports.stream = (req, res) => {
    const { roomId } = req.params;
    const userId = req.user._id;

    // Headers para SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    const newClient = {
        id: Date.now(),
        userId,
        roomId,
        res
    };

    clients.push(newClient);
    console.log(`🔌 Cliente SSE Conectado: ${userId} en sala ${roomId}. Total: ${clients.length}`);

    // Enviar heartbeat para mantener conexión
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 30000);

    // Limpieza al desconectar
    req.on('close', () => {
        clearInterval(heartbeat);
        clients = clients.filter(c => c.id !== newClient.id);
        console.log(`❌ Cliente SSE Desconectado: ${userId}. Restantes: ${clients.length}`);
    });
};

// 4b. Endpoint SSE Global (Notificaciones en toda la app)
exports.globalStream = (req, res) => {
    const userId = req.user._id;

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    const newClient = {
        id: Date.now(),
        userId,
        empresaRef: req.user.empresaRef,
        role: req.user.role,
        roomId: 'global',
        res
    };

    clients.push(newClient);
    console.log(`🔌 Cliente SSE Global Conectado: ${userId}. Total: ${clients.length}`);

    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 30000);

    req.on('close', () => {
        clearInterval(heartbeat);
        clients = clients.filter(c => c.id !== newClient.id);
        console.log(`❌ Cliente SSE Global Desconectado: ${userId}. Restantes: ${clients.length}`);
    });
};
// 5. Listar salas del usuario
exports.getRooms = async (req, res) => {
    try {
        const user = req.user;
        const empRef = user.empresaRef?._id || user.empresaRef;
        
        // Buscar salas existentes
        let rooms = await Room.find({
            $or: [
                { members: user._id },
                { empresaRef: user.empresaRef, type: 'company' },
                { type: 'support' }
            ]
        }).populate('lastMessage').sort({ updatedAt: -1 });

        // Auto-siembra: Si no hay salas de empresa o soporte, asegurarlas
        const hasCompany = rooms.some(r => r.type === 'company');
        const hasSupport = rooms.some(r => r.type === 'support');

        if (!hasCompany || !hasSupport) {
            if (!hasCompany) {
                const companyRoom = new Room({
                    name: `COMUNIDAD ${user.empresa?.nombre?.toUpperCase() || 'EMPRESA'}`,
                    type: 'company',
                    empresaRef: empRef,
                    members: [user._id]
                });
                await companyRoom.save();
                rooms.push(companyRoom);
            }
            if (!hasSupport) {
                const supportRoom = new Room({
                    name: 'Soporte GENAI360 Global',
                    type: 'support',
                    empresaRef: 'GENAI_GLOBAL',
                    members: [user._id]
                });
                await supportRoom.save();
                rooms.push(supportRoom);
            }
        }

        // Filtrar salas no permitidas por matriz de visibilidad (incluye salas legacy)
        const memberIds = [...new Set(
            rooms.flatMap(r => (r.members || []).map(id => String(id))).filter(Boolean)
        )];
        const membersMapArr = memberIds.length > 0
            ? await PlatformUser.find({ _id: { $in: memberIds } }).select('role cargo').lean()
            : [];
        const memberMap = new Map(membersMapArr.map(u => [String(u._id), u]));

        rooms = rooms.filter(room => {
            if (isManagerPrincipal(user)) return true;
            if (room.type === 'support') return true;
            if (room.type === 'company' && isTecnicoPrincipal(user)) return false;
            if (!['direct', 'group'].includes(room.type)) return true;

            const others = (room.members || []).filter(id => String(id) !== String(user._id));
            if (others.length === 0) return true;
            return others.every(id => canUserContact(user, memberMap.get(String(id))));
        });

        res.json(rooms);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 6. Crear una nueva sala/grupo
exports.createRoom = async (req, res) => {
    try {
        const { name, description, type, members } = req.body;
        const user = req.user;

        const visibilityQuery = buildBaseVisibilityQuery(user);
        const requestedMembers = Array.isArray(members) ? members.map(String) : [];
        if (requestedMembers.length > 0) {
            const requestedUsers = await PlatformUser.find({
                ...visibilityQuery,
                _id: { $in: requestedMembers }
            }).select('role cargo empresaRef').lean();

            if (requestedUsers.length !== requestedMembers.length && !isManagerPrincipal(user)) {
                return res.status(403).json({ error: 'Incluyes usuarios fuera de tu alcance de comunicación.' });
            }
            if (!isManagerPrincipal(user)) {
                const hasForbidden = requestedUsers.some(u => !canUserContact(user, u));
                if (hasForbidden) {
                    return res.status(403).json({ error: 'Incluyes usuarios fuera de tu alcance de comunicación.' });
                }
            }
        }

        // Si es chat directo, verificar existencia previa
        if (type === 'direct' && members.length === 1) {
            const targetId = members[0];
            const existing = await Room.findOne({
                type: 'direct',
                members: { $all: [user._id, targetId], $size: 2 }
            });
            if (existing) return res.json(existing);
        }

        // Asegurar que el creador esté en los miembros
        const finalMembers = [...new Set([...members, user._id.toString()])];

        const newRoom = new Room({
            name,
            description,
            type: type || 'group',
            members: finalMembers,
            createdBy: user._id,
            empresaRef: user.empresaRef
        });

        await newRoom.save();
        res.status(201).json(newRoom);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 7. Obtener contactos (Misma empresa para mortales, Global para CEO)
exports.getContacts = async (req, res) => {
    try {
        const user = req.user;
        const query = buildBaseVisibilityQuery(user);

        let contacts = await PlatformUser.find(query)
            .select('name cargo email avatar isOnline empresaRef role')
            .sort({ isOnline: -1, name: 1 });

        contacts = contacts.filter(c => canUserContact(user, c));

        res.json(contacts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 8. Buscar usuarios para invitar (mismo RUT empresa solamente o global para CEO)
exports.searchUsers = async (req, res) => {
    try {
        const { q } = req.query;
        const user = req.user;

        const baseVisibility = buildBaseVisibilityQuery(user);
        let query = {
            ...baseVisibility,
            $or: [
                { name: { $regex: q || '', $options: 'i' } },
                { email: { $regex: q || '', $options: 'i' } },
                { cargo: { $regex: q || '', $options: 'i' } }
            ]
        };

        let users = await PlatformUser.find(query)
            .select('name cargo email avatar isOnline role empresaRef')
            .limit(20);

        users = users.filter(u => canUserContact(user, u));

        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 9. Enviar notificación en tiempo real a un usuario específico a través de SSE
exports.notifyUser = (userId, payload) => {
    const targetUserIdStr = String(userId);
    let sentCount = 0;
    clients.forEach(client => {
        if (String(client.userId) === targetUserIdStr) {
            try {
                client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
                sentCount++;
            } catch (err) {
                console.error(`[SSE Notify] Error writing to client ${client.id}:`, err);
            }
        }
    });
    console.log(`🔌 [SSE Notify] Notificación del tipo "${payload.type}" enviada a usuario ${targetUserIdStr}. Conexiones activas notificadas: ${sentCount}`);
    return sentCount > 0;
};

// ================= ESTADOS (STATUS) =================

exports.getStatuses = async (req, res) => {
    try {
        const user = req.user;
        const empRef = user.empresaRef || user._id; // Fallback

        // Find statuses that have not expired
        let statuses = await ChatStatus.find({
            empresaRef: empRef,
            expiresAt: { $gt: new Date() }
        }).populate('userRef', 'name avatar role cargo').sort({ createdAt: -1 });

        // Filter by canUserContact
        statuses = statuses.filter(s => s.userRef && canUserContact(user, s.userRef));

        res.json(statuses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createStatus = async (req, res) => {
    try {
        const user = req.user;
        const { type, content, mediaUrl, backgroundColor } = req.body;
        
        // 24 hours from now
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const newStatus = new ChatStatus({
            userRef: user._id,
            empresaRef: user.empresaRef || user._id,
            type: type || 'text',
            content,
            mediaUrl,
            backgroundColor: backgroundColor || '#4f46e5',
            expiresAt,
            viewers: []
        });

        await newStatus.save();
        
        // Optional: We could notify all clients that there's a new status
        // But statuses are typically polled or requested when opening the tab
        res.status(201).json(newStatus);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.markStatusViewed = async (req, res) => {
    try {
        const { id } = req.params;
        const status = await ChatStatus.findByIdAndUpdate(id, {
            $addToSet: { viewers: req.user._id }
        }, { new: true });
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ================= COMUNICADOS (ANNOUNCEMENTS) =================

exports.getAnnouncements = async (req, res) => {
    try {
        const user = req.user;
        const empRef = user.empresaRef || user._id;

        const limit = parseInt(req.query.limit) || 20;

        const announcements = await ChatAnnouncement.find({ empresaRef: empRef })
            .populate('authorRef', 'name avatar role cargo')
            .sort({ createdAt: -1 })
            .limit(limit);

        res.json(announcements);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createAnnouncement = async (req, res) => {
    try {
        const user = req.user;
        const c = classifyUser(user);
        
        if (c === 'tecnico') {
            return res.status(403).json({ error: 'No tienes permisos para crear comunicados corporativos.' });
        }

        const { title, content, mediaUrl, priority } = req.body;

        const ann = new ChatAnnouncement({
            authorRef: user._id,
            empresaRef: user.empresaRef || user._id,
            title,
            content,
            mediaUrl,
            priority: priority || 'normal'
        });

        await ann.save();
        await ann.populate('authorRef', 'name avatar role cargo');

        // Notificar a todos los usuarios de la empresa
        const payload = {
            type: 'global_notification',
            data: {
                _id: ann._id,
                text: `Nuevo comunicado: ${title}`,
                senderName: 'Empresa 360',
                createdAt: new Date(),
                isAnnouncement: true
            }
        };

        // Notify all connected clients in the same company
        let sentCount = 0;
        const targetEmpStr = String(ann.empresaRef);
        clients.forEach(client => {
            if (String(client.empresaRef || client.userId) === targetEmpStr || isSystemAdmin({role: 'system_admin'})) {
                try {
                    client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
                    sentCount++;
                } catch (e) {}
            }
        });
        console.log(`[SSE] Comunicado enviado a ${sentCount} clientes.`);

        res.status(201).json(ann);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

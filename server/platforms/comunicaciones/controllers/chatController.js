const Message = require('../models/Message');
const Room = require('../models/Room');
const PlatformUser = require('../../auth/PlatformUser');
const mongoose = require('mongoose');

// Memoria volátil para conexiones activas (SSE)
let clients = [];

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
        } else {
            // Aislamiento: El usuario debe ser miembro o ser de la misma empresa para salas públicas
            const isMember = room.members.some(id => id.toString() === user._id.toString());
            if (!isMember && room.empresaRef !== user.empresaRef && user.role !== 'system_admin') {
                return res.status(403).json({ error: 'Acceso denegado a esta sala.' });
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
                    name: 'Soporte GenAI Global',
                    type: 'support',
                    empresaRef: 'GENAI_GLOBAL',
                    members: [user._id]
                });
                await supportRoom.save();
                rooms.push(supportRoom);
            }
        }

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
        let query = { _id: { $ne: user._id } };

        // Si no es CEO, filtrar por su empresa
        if (user.role !== 'system_admin') {
            query.empresaRef = user.empresaRef;
        }

        const contacts = await PlatformUser.find(query)
            .select('name cargo email avatar isOnline empresaRef role')
            .sort({ isOnline: -1, name: 1 });

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

        let query = {
            _id: { $ne: user._id },
            $or: [
                { name: { $regex: q || '', $options: 'i' } },
                { email: { $regex: q || '', $options: 'i' } },
                { cargo: { $regex: q || '', $options: 'i' } }
            ]
        };

        if (user.role !== 'system_admin') {
            query.empresaRef = user.empresaRef;
        }

        const users = await PlatformUser.find(query)
            .select('name cargo email avatar isOnline role empresaRef')
            .limit(20);

        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

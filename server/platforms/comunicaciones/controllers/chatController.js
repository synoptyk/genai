const Message = require('../models/Message');

// 1. Obtener historial de una sala (roomId)
exports.getMessages = async (req, res) => {
    try {
        const { roomId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = 50;
        const user = req.user;

        // Regla de Aislamiento: El roomId general es "soporte_genai". Los demas son prefixos_con_RUT
        if (roomId !== 'soporte_genai') {
            if (!roomId.includes(user.empresaRef) && user.role !== 'ceo_genai') {
                return res.status(403).json({ error: 'Acceso denegado a esta sala.' });
            }
        }

        const messages = await Message.find({ roomId })
            .populate('senderRef', 'name cargo role isOnline avatar')
            .sort({ createdAt: -1 }) // Los más recientes primero
            .skip((page - 1) * limit)
            .limit(limit);

        res.json(messages.reverse()); // Devolver en orden cronológico para el chat
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

        // Validacion de aislamiento similar
        if (roomId !== 'soporte_genai' && !roomId.includes(user.empresaRef) && user.role !== 'ceo_genai') {
            return res.status(403).json({ error: 'Acceso denegado a esta sala.' });
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

        // Devolvemos el mensaje con la ref poblada para inyectar directo a la UI
        const populatedMsg = await Message.findById(newMsg._id).populate('senderRef', 'name cargo role isOnline avatar');

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

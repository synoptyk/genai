const Empresa = require('./models/Empresa');

// GET /api/auth/configuracion-notificaciones
exports.getNotificacionConfig = async (req, res) => {
    try {
        const empresa = await Empresa.findById(req.user.empresaRef).select('configuracionNotificaciones');
        if (!empresa) return res.status(404).json({ message: 'Empresa no encontrada' });
        
        res.json(empresa.configuracionNotificaciones || {});
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener configuración', error: error.message });
    }
};

// PUT /api/auth/configuracion-notificaciones
exports.updateNotificacionConfig = async (req, res) => {
    try {
        // Solo permitir a CEO o ADMIN
        if (!['system_admin', 'ceo', 'admin'].includes(req.user.role)) {
            return res.status(403).json({ message: 'No tienes permisos para editar esta configuración' });
        }

        const empresa = await Empresa.findById(req.user.empresaRef);
        if (!empresa) return res.status(404).json({ message: 'Empresa no encontrada' });

        const { ...configs } = req.body;

        // Actualizar dinámicamente cada sección enviada
        Object.keys(configs).forEach(key => {
            const currentSection = empresa.configuracionNotificaciones.get(key) || {};
            empresa.configuracionNotificaciones.set(key, { ...currentSection, ...configs[key] });
        });

        await empresa.save();

        res.json({ message: 'Configuración actualizada con éxito', config: empresa.configuracionNotificaciones });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar configuración', error: error.message });
    }
};

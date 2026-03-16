const AuditLog = require('../platforms/admin/models/AuditLog');

/**
 * Logs a system action for audit purposes.
 */
exports.logAction = async (req, modulo, accion, detalles = {}) => {
    try {
        if (!req.user || !req.user.empresaRef) return;

        await AuditLog.create({
            empresaRef: req.user.empresaRef,
            userRef: req.user._id,
            modulo,
            accion,
            metodo: req.method,
            url: req.originalUrl,
            detalles,
            ip: req.ip || req.connection.remoteAddress
        });
    } catch (error) {
        console.error("Failed to create audit log:", error);
    }
};

import { useAuth } from '../platforms/auth/AuthContext';

/**
 * Hook para verificar permisos granulares en el frontend.
 * Soporta bypass para administradores y CEO.
 */
export const useCheckPermission = () => {
    const { user } = useAuth();

    /**
     * Verifica si el usuario tiene un permiso específico.
     * @param {string} moduleKey - Identificador del módulo (ej: 'rrhh_captura')
     * @param {string} action - Acción a verificar ('ver', 'crear', 'editar', 'suspender', 'eliminar')
     * @returns {boolean}
     */
    const hasPermission = (moduleKey, action = 'ver') => {
        if (!user) return false;

        // 1. Bypass absoluto para Roles de Máximo Nivel
        const role = String(user.role || '').toLowerCase();
        if (['system_admin', 'ceo'].includes(role)) return true;

        // 2. Para Admins de Empresa, generalmente tienen acceso total a sus módulos,
        // pero podemos restringirlos si el sistema evoluciona a un modelo más estricto.
        // Por ahora, permitimos bypass para 'admin'.
        if (role === 'admin') return true;

        // 3. Verificación Granular
        const indPerms = user.permisosModulos || {};
        // Manejar tanto Map como Objeto plano (dependiendo de la serialización del estado)
        const p = (typeof indPerms.get === 'function') 
            ? indPerms.get(moduleKey) 
            : indPerms[moduleKey];

        return p && p[action] === true;
    };

    return { hasPermission };
};

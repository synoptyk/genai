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

        // 2. Verificación granular (incluye admins con fallback controlado)
        const indPerms = user.permisosModulos || {};
        // Manejar tanto Map como Objeto plano (dependiendo de la serialización del estado)
        const p = (typeof indPerms.get === 'function') 
            ? indPerms.get(moduleKey) 
            : indPerms[moduleKey];

        // Compatibilidad entre matrices que usan 'bloquear' y otras que usan 'suspender'.
        const normalizedAction = action === 'bloquear' ? 'suspender' : action;
        const fallbackAction = action === 'suspender' ? 'bloquear' : null;

        // Si existe configuración explícita, se respeta estrictamente.
        if (p !== undefined) {
            return p?.[action] === true || p?.[normalizedAction] === true || (fallbackAction ? p?.[fallbackAction] === true : false);
        }

        // Fallback legacy para admin cuando no existe entrada explícita.
        if (role === 'admin') return true;

        return false;
    };

    return { hasPermission };
};

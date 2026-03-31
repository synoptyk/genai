import axios from 'axios';
import API_URL from '../../config';

const logisticaApi = axios.create({
    baseURL: `${API_URL}/api/logistica`
});

logisticaApi.interceptors.request.use((config) => {
    // 1. Obtener Token de genai_user
    const storedUser = localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user');
    if (storedUser) {
        try {
            const userData = JSON.parse(storedUser);
            if (userData.token) {
                config.headers.Authorization = `Bearer ${userData.token}`;
            }
        } catch (e) {
            console.error("Error parsing platform_user for token", e);
        }
    }

    // 2. Obtener Contexto de Auditoría (CEO/Admin)
    const storedContext = sessionStorage.getItem('platform_audit_context');
    if (storedContext) {
        try {
            const auditData = JSON.parse(storedContext);
            if (auditData._id) {
                config.headers['x-company-override'] = auditData._id;
            }
        } catch (e) {
            console.error("Error parsing platform_audit_context", e);
        }
    }

    return config;
}, (error) => {
    return Promise.reject(error);
});

// Interceptor de Respuesta para manejar 401 (Sesión expirada)
logisticaApi.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
            const failedAuthHeader = error.config?.headers?.Authorization || '';
            const failedToken = failedAuthHeader.replace('Bearer ', '').trim();
            const stored = localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user');
            let currentToken = null;
            if (stored) { try { currentToken = JSON.parse(stored).token; } catch (e) {} }

            if (failedToken && currentToken && failedToken !== currentToken) {
                console.warn('⚠️ [Logística API] Se ignoró un 401 rezagado.');
                return Promise.reject(error);
            }

            console.warn('⚠️ [Logística API] Sesión expirada detectada (401).');
            localStorage.removeItem('platform_user');
            sessionStorage.removeItem('platform_user');
            window.location.href = '/login?expired=true';
        }
        return Promise.reject(error);
    }
);

export default logisticaApi;

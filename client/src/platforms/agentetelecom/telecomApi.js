import axios from 'axios';
import API_URL from '../../config';

const API_BASE = `${API_URL}/api`;

export const telecomApi = axios.create({ baseURL: API_BASE });

// ─── Auth interceptor: JWT & Audit Context automático ───────────────────────
telecomApi.interceptors.request.use(config => {
    try {
        const stored = localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user');
        const auditContext = sessionStorage.getItem('platform_audit_context');

        if (stored) {
            const user = JSON.parse(stored);
            if (user?.token) config.headers.Authorization = `Bearer ${user.token}`;
        }

        if (auditContext) {
            const audit = JSON.parse(auditContext);
            if (audit?._id) config.headers['x-company-override'] = audit._id;
        }
    } catch (e) { }
    return config;
});

telecomApi.interceptors.response.use(
    res => res,
    err => {
        if (err.response?.status === 401) {
            const failedAuthHeader = err.config?.headers?.Authorization || '';
            const failedToken = failedAuthHeader.replace('Bearer ', '').trim();
            
            const stored = localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user');
            let currentToken = null;
            if (stored) {
               try { currentToken = JSON.parse(stored).token; } catch (e) {}
            }

            if (failedToken && currentToken && failedToken !== currentToken) {
                console.warn('⚠️ [telecomApi] Se ignoró un 401 rezagado.');
                return Promise.reject(err);
            }

            console.warn('Sesión de Telecom no autorizada (401) - Redirigiendo a login');
            localStorage.removeItem('platform_user');
            sessionStorage.removeItem('platform_user');
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

export default telecomApi;

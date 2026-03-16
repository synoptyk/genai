import axios from 'axios';
import API_URL from '../../config';

const API_BASE = `${API_URL}/api`;

export const telecomApi = axios.create({ baseURL: API_BASE });

// ─── Auth interceptor: JWT & Audit Context automático ───────────────────────
telecomApi.interceptors.request.use(config => {
    try {
        const stored = localStorage.getItem('genai_user') || sessionStorage.getItem('genai_user');
        const auditContext = sessionStorage.getItem('genai_audit_context');

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
            // Podríamos redirigir o limpiar sesión, pero por ahora solo propagamos
            console.warn('Sesión de Telecom no autorizada (401)');
        }
        return Promise.reject(err);
    }
);

export default telecomApi;

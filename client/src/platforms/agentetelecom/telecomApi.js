import axios from 'axios';
import API_URL, { API_FALLBACK_URL } from '../../config';

const API_BASE = `${API_URL}/api`;
const FALLBACK_BASE = `${String(API_FALLBACK_URL || '').replace(/\/$/, '')}/api`;

export const telecomApi = axios.create({ baseURL: API_BASE, timeout: 60000 });

let baseUrlSwitched = false;
const isTransientNetworkError = (err) => {
    const code = String(err?.code || '').toLowerCase();
    const message = String(err?.message || '').toLowerCase();
    return !err?.response && (
        code.includes('err_network') ||
        code.includes('econnaborted') ||
        message.includes('network error') ||
        message.includes('err_network_changed') ||
        message.includes('quic') ||
        message.includes('timeout')
    );
};

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
    async err => {
        const cfg = err?.config || {};

        if (isTransientNetworkError(err)) {
            cfg.__retryCount = Number(cfg.__retryCount || 0);
            if (cfg.__retryCount < 2) {
                cfg.__retryCount += 1;
                await new Promise(r => setTimeout(r, 500 * cfg.__retryCount));
                return telecomApi(cfg);
            }
            if (!baseUrlSwitched && FALLBACK_BASE && FALLBACK_BASE !== telecomApi.defaults.baseURL) {
                telecomApi.defaults.baseURL = FALLBACK_BASE;
                baseUrlSwitched = true;
                cfg.baseURL = FALLBACK_BASE;
                cfg.__retryCount = 1;
                return telecomApi(cfg);
            }
        }

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

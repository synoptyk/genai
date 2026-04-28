import axios from 'axios';
import API_URL, { API_FALLBACK_URL } from '../config';

const api = axios.create({
    baseURL: API_URL
});

let baseUrlSwitched = false;
const shouldSwitchToFallback = (error) => {
    if (baseUrlSwitched) return false;
    const code = error?.code;
    const message = String(error?.message || '').toLowerCase();
    const response = error?.response;
    return !response && (code === 'ERR_NETWORK' || message.includes('network error') || message.includes('err_network_changed'));
};

// Interceptor para inyectar Token JWT
api.interceptors.request.use(config => {
    try {
        const stored = localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user');
        if (stored) {
            const user = JSON.parse(stored);
            if (user?.token) {
                config.headers.Authorization = `Bearer ${user.token}`;
            }
        }
    } catch (e) {
        console.error("Error in Axios Interceptor:", e);
    }
    return config;
});

api.interceptors.response.use(
    response => response,
    error => {
        if (shouldSwitchToFallback(error) && API_FALLBACK_URL && API_FALLBACK_URL !== api.defaults.baseURL) {
            api.defaults.baseURL = API_FALLBACK_URL;
            baseUrlSwitched = true;
            console.warn(`⚠️ [api.js] Cambio automático de API baseURL a fallback: ${API_FALLBACK_URL}`);
        }
        if (error.response?.status === 401) {
            // No redirigir si ya estamos en login
            if (!window.location.pathname.includes('/login')) {
                const failedAuthHeader = error.config?.headers?.Authorization || '';
                const failedToken = failedAuthHeader.replace('Bearer ', '').trim();

                const stored = localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user');
                let currentToken = null;
                if (stored) {
                   try { currentToken = JSON.parse(stored).token; } catch (e) {}
                }

                if (failedToken && currentToken && failedToken !== currentToken) {
                    console.warn('⚠️ [api.js] Se ignoró un 401 rezagado.');
                    return Promise.reject(error);
                }

                localStorage.removeItem('platform_user');
                sessionStorage.removeItem('platform_user');
                window.location.href = '/login?expired=true';
            }
        }
        return Promise.reject(error);
    }
);

export default api;

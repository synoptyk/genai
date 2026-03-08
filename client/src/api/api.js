import axios from 'axios';
import API_URL from '../config';

const api = axios.create({
    baseURL: API_URL
});

// Interceptor para inyectar Token JWT
api.interceptors.request.use(config => {
    try {
        const stored = localStorage.getItem('genai_user') || sessionStorage.getItem('genai_user');
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

// Interceptor para manejar errores 401 (Sesión expirada)
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            // No redirigir si ya estamos en login
            if (!window.location.pathname.includes('/login')) {
                localStorage.removeItem('genai_user');
                sessionStorage.removeItem('genai_user');
                window.location.href = '/login?expired=true';
            }
        }
        return Promise.reject(error);
    }
);

export default api;

import axios from 'axios';
import API_URL from '../../config';

const API_BASE = `${API_URL}/api/operaciones`;

export const operacionesApi = axios.create({
    baseURL: API_BASE
});

// Interceptor para inyectar Token JWT
operacionesApi.interceptors.request.use(config => {
    try {
        const stored = localStorage.getItem('genai_user') || sessionStorage.getItem('genai_user');
        if (stored) {
            const user = JSON.parse(stored);
            if (user?.token) {
                config.headers.Authorization = `Bearer ${user.token}`;
            }
        }
    } catch (e) {
        console.error("Error in Operations API Interceptor:", e);
    }
    return config;
});

export default operacionesApi;

import axios from 'axios';
import API_URL from '../../config';

const API_BASE = `${API_URL}/api/comunicaciones`;
const API_BASE_LOGISTICA = `${API_URL}/api/logistica`; // Define base URL for logisticaApi

export const comunicacionesApi = axios.create({ baseURL: API_BASE });
export const logisticaApi = axios.create({ baseURL: API_BASE_LOGISTICA }); // Initialize logisticaApi

comunicacionesApi.interceptors.request.use(config => {
    try {
        const stored = localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user');
        if (stored) {
            const user = JSON.parse(stored);
            if (user?.token) config.headers.Authorization = `Bearer ${user.token}`;
        }
    } catch (e) { }
    return config;
});

// Interceptor para manejar errores 401 (Sesión expirada)
comunicacionesApi.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
            const failedAuthHeader = error.config?.headers?.Authorization || '';
            const failedToken = failedAuthHeader.replace('Bearer ', '').trim();
            const stored = localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user');
            let currentToken = null;
            if (stored) { try { currentToken = JSON.parse(stored).token; } catch (e) {} }

            if (failedToken && currentToken && failedToken !== currentToken) {
                console.warn('⚠️ [Comunicaciones API] Se ignoró un 401 rezagado.');
                return Promise.reject(error);
            }

            console.warn('⚠️ [Comunicaciones API] Sesión expirada detectada (401).');
            localStorage.removeItem('platform_user');
            sessionStorage.removeItem('platform_user');
            window.location.href = '/login?expired=true';
        }
        return Promise.reject(error);
    }
);

export const chatApi = {
    getMessages: (roomId, params) => comunicacionesApi.get(`/${roomId}/messages`, { params }),
    sendMessage: (data) => comunicacionesApi.post('/send', data),
    markAsRead: (data) => comunicacionesApi.post('/read', data),
    
    // Rutas dinámicas
    getRooms: () => comunicacionesApi.get('/rooms/list'),
    createRoom: (data) => comunicacionesApi.post('/rooms/create', data),
    searchUsers: (query) => comunicacionesApi.get(`/users/search?q=${query}`),
    getContacts: () => comunicacionesApi.get('/users/contacts'),
};

export const reunionesApi = {
    getAll: () => comunicacionesApi.get(`${API_URL}/api/reuniones`),
    create: (data) => comunicacionesApi.post(`${API_URL}/api/reuniones/create`, data),
    update: (id, data) => comunicacionesApi.put(`${API_URL}/api/reuniones/${id}`, data),
    delete: (id) => comunicacionesApi.delete(`${API_URL}/api/reuniones/${id}`),
};

import axios from 'axios';
import API_URL from '../../config';

const API_BASE = `${API_URL}/api/comunicaciones`;

export const comunicacionesApi = axios.create({ baseURL: API_BASE });

comunicacionesApi.interceptors.request.use(config => {
    try {
        const stored = localStorage.getItem('genai_user') || sessionStorage.getItem('genai_user');
        if (stored) {
            const user = JSON.parse(stored);
            if (user?.token) config.headers.Authorization = `Bearer ${user.token}`;
        }
    } catch (e) { }
    return config;
});

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

import axios from 'axios';

const API_BASE = 'http://localhost:5001/api/prevencion';

export const prevencionApi = axios.create({ baseURL: API_BASE });

// ─── Auth interceptor: JWT automático ───────────────────────────────────────
prevencionApi.interceptors.request.use(config => {
    const token = localStorage.getItem('genai_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});
prevencionApi.interceptors.response.use(
    res => res,
    err => {
        if (err.response?.status === 401) {
            localStorage.removeItem('genai_token');
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

export const astApi = {
    getAll: (params) => prevencionApi.get('/ast', { params }),
    getById: (id) => prevencionApi.get(`/ast/${id}`),
    create: (data) => prevencionApi.post('/ast', data),
    update: (id, data) => prevencionApi.put(`/ast/${id}`, data),
    remove: (id) => prevencionApi.delete(`/ast/${id}`),
};

export const procedimientosApi = {
    getAll: () => prevencionApi.get('/procedimientos'),
    getById: (id) => prevencionApi.get(`/procedimientos/${id}`),
    create: (data) => prevencionApi.post('/procedimientos', data),
    update: (id, data) => prevencionApi.put(`/procedimientos/${id}`, data),
    remove: (id) => prevencionApi.delete(`/procedimientos/${id}`),
};

export const charlasApi = {
    getAll: () => prevencionApi.get('/charlas'),
    getById: (id) => prevencionApi.get(`/charlas/${id}`),
    create: (data) => prevencionApi.post('/charlas', data),
    update: (id, data) => prevencionApi.put(`/charlas/${id}`, data),
    remove: (id) => prevencionApi.delete(`/charlas/${id}`),
};

export const inspeccionesApi = {
    getAll: (params) => prevencionApi.get('/inspecciones', { params }),
    getById: (id) => prevencionApi.get(`/inspecciones/${id}`),
    create: (data) => prevencionApi.post('/inspecciones', data),
    update: (id, data) => prevencionApi.put(`/inspecciones/${id}`, data),
    remove: (id) => prevencionApi.delete(`/inspecciones/${id}`),
};

// ── NUEVO: Incidentes (Hallazgo model) ──────────────────────────────────────
export const incidentesApi = {
    getAll: (params) => prevencionApi.get('/incidentes', { params }),
    getById: (id) => prevencionApi.get(`/incidentes/${id}`),
    create: (data) => prevencionApi.post('/incidentes', data),
    update: (id, data) => prevencionApi.put(`/incidentes/${id}`, data),
    remove: (id) => prevencionApi.delete(`/incidentes/${id}`),
};

// ── NUEVO: Matriz de Riesgos (RiesgoIPER model) ─────────────────────────────
export const matrizRiesgosApi = {
    getAll: (params) => prevencionApi.get('/matriz-riesgos', { params }),
    getById: (id) => prevencionApi.get(`/matriz-riesgos/${id}`),
    create: (data) => prevencionApi.post('/matriz-riesgos', data),
    update: (id, data) => prevencionApi.put(`/matriz-riesgos/${id}`, data),
    remove: (id) => prevencionApi.delete(`/matriz-riesgos/${id}`),
};

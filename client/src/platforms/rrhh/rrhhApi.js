import axios from 'axios';

const API_BASE = 'http://localhost:5001/api/rrhh';

export const rrhhApi = axios.create({ baseURL: API_BASE });

// ─── Auth interceptor: JWT automático ───────────────────────────────────────
rrhhApi.interceptors.request.use(config => {
    const token = localStorage.getItem('genai_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});
rrhhApi.interceptors.response.use(
    res => res,
    err => {
        if (err.response?.status === 401) {
            localStorage.removeItem('genai_token');
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);
export const candidatosApi = {
    getAll: (params) => rrhhApi.get('/candidatos', { params }),
    getById: (id) => rrhhApi.get(`/candidatos/${id}`),
    create: (data) => rrhhApi.post('/candidatos', data),
    update: (id, data) => rrhhApi.put(`/candidatos/${id}`, data),
    updateStatus: (id, data) => rrhhApi.put(`/candidatos/${id}/status`, data),
    updateInterview: (id, data) => rrhhApi.put(`/candidatos/${id}/interview`, data),
    updateHiring: (id, data) => rrhhApi.put(`/candidatos/${id}/hiring`, data),
    updateAccreditation: (id, data) => rrhhApi.put(`/candidatos/${id}/accreditation`, data),
    addNote: (id, data) => rrhhApi.post(`/candidatos/${id}/notes`, data),
    addTest: (id, data) => rrhhApi.post(`/candidatos/${id}/tests`, data),
    addVacacion: (id, data) => rrhhApi.post(`/candidatos/${id}/vacaciones`, data),
    updateVacacion: (id, vacId, data) => rrhhApi.put(`/candidatos/${id}/vacaciones/${vacId}`, data),
    addAmonestacion: (id, data) => rrhhApi.post(`/candidatos/${id}/amonestaciones`, data),
    addFelicitacion: (id, data) => rrhhApi.post(`/candidatos/${id}/felicitaciones`, data),
    uploadDocument: (id, formData) => rrhhApi.post(`/candidatos/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    remove: (id) => rrhhApi.delete(`/candidatos/${id}`),
};

export const proyectosApi = {
    getAll: () => rrhhApi.get('/proyectos'),
    getById: (id) => rrhhApi.get(`/proyectos/${id}`),
    create: (data) => rrhhApi.post('/proyectos', data),
    update: (id, data) => rrhhApi.put(`/proyectos/${id}`, data),
    remove: (id) => rrhhApi.delete(`/proyectos/${id}`),
    getAnalytics: (id) => rrhhApi.get(`/proyectos/${id}/analytics`),
    getAnalyticsGlobal: () => rrhhApi.get('/proyectos/analytics/global'),
};

export const turnosApi = {
    getAll: () => rrhhApi.get('/turnos'),
    create: (data) => rrhhApi.post('/turnos', data),
    update: (id, data) => rrhhApi.put(`/turnos/${id}`, data),
    asignar: (id, data) => rrhhApi.put(`/turnos/${id}/asignar`, data),
    remove: (id) => rrhhApi.delete(`/turnos/${id}`),
};

export const asistenciaApi = {
    getAll: (params) => rrhhApi.get('/asistencia', { params }),
    create: (data) => rrhhApi.post('/asistencia', data),
    bulkCreate: (registros) => rrhhApi.post('/asistencia/bulk', { registros }),
    update: (id, data) => rrhhApi.put(`/asistencia/${id}`, data),
    remove: (id) => rrhhApi.delete(`/asistencia/${id}`),
};

export const configApi = {
    get: () => rrhhApi.get('/config'),
    update: (data) => rrhhApi.put('/config', data),
};

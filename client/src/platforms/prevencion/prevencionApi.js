import axios from 'axios';
import API_URL from '../../config';

const prevencionApi = axios.create({
    baseURL: `${API_URL}/api/prevencion`
});

prevencionApi.interceptors.request.use((config) => {
    const storedUser = localStorage.getItem('genai_user') || sessionStorage.getItem('genai_user');
    if (storedUser) {
        try {
            const userData = JSON.parse(storedUser);
            if (userData.token) {
                config.headers.Authorization = `Bearer ${userData.token}`;
            }
        } catch (e) {
            console.error("Error parsing genai_user for token", e);
        }
    }

    const storedContext = sessionStorage.getItem('genai_audit_context');
    if (storedContext) {
        try {
            const auditData = JSON.parse(storedContext);
            if (auditData._id) {
                config.headers['x-company-override'] = auditData._id;
            }
        } catch (e) {
            console.error("Error parsing genai_audit_context", e);
        }
    }

    return config;
}, (error) => {
    return Promise.reject(error);
});

const createService = (path) => ({
    getAll: (params) => prevencionApi.get(path, { params }),
    getById: (id) => prevencionApi.get(`${path}/${id}`),
    create: (data) => prevencionApi.post(path, data),
    update: (id, data) => prevencionApi.put(`${path}/${id}`, data),
    delete: (id) => prevencionApi.delete(`${path}/${id}`)
});

export const astApi = createService('/ast');
export const charlasApi = createService('/charlas');
export const incidentesApi = createService('/incidentes');
export const inspeccionesApi = createService('/inspecciones');
export const matrizRiesgosApi = createService('/matriz-riesgos');
export const procedimientosApi = createService('/procedimientos');

export default prevencionApi;

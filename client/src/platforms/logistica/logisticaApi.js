import axios from 'axios';
import API_URL from '../../config';

const logisticaApi = axios.create({
    baseURL: `${API_URL}/api/logistica`
});

logisticaApi.interceptors.request.use((config) => {
    // 1. Obtener Token de genai_user
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

    // 2. Obtener Contexto de Auditoría (CEO/Admin)
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

export default logisticaApi;

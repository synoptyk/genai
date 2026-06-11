import axios from 'axios';
import API_URL from '../../config';


const API_BASE = `${API_URL}/api/rrhh`;

export const rrhhApi = axios.create({ baseURL: API_BASE });

// ─── Auth interceptor: JWT automático ───────────────────────────────────────
rrhhApi.interceptors.request.use(config => {
    try {
        const stored = localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user');
        if (stored) {
            const user = JSON.parse(stored);
            if (user?.token) {
                config.headers.Authorization = `Bearer ${user.token}`;
            } else {
                console.warn('rrhhApi: no token found for request', config.url);
            }
        } else {
            console.warn('rrhhApi: no platform_user in localStorage/sessionStorage; request may fail', config.url);
        }
    } catch (e) {
        console.error('rrhhApi request interceptor error', e);
    }
    return config;
});
rrhhApi.interceptors.response.use(
    res => res,
    err => {
        if (err.response?.status === 401) {
            const failedAuthHeader = err.config?.headers?.Authorization || '';
            const failedToken = failedAuthHeader.replace('Bearer ', '').trim();
            const stored = localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user');
            let currentToken = null;
            if (stored) { try { currentToken = JSON.parse(stored).token; } catch (e) {} }

            if (failedToken && currentToken && failedToken !== currentToken) {
                console.warn('⚠️ [rrhhApi] Se ignoró un 401 rezagado.');
                return Promise.reject(err);
            }

            localStorage.removeItem('platform_user');
            sessionStorage.removeItem('platform_user');
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
    getFiniquitos: async (params = {}) => {
        try {
            return await rrhhApi.get('/candidatos/finiquitos', { params });
        } catch (error) {
            if (error.response?.status === 404) {
                // Fallback a ruta general si el endpoint especializado no existe
                return rrhhApi.get('/candidatos', { params: { status: 'Finiquitado', ...params } });
            }
            throw error;
        }
    },
    updateAccreditation: (id, data) => rrhhApi.put(`/candidatos/${id}/accreditation`, data),
    addNote: (id, data) => rrhhApi.post(`/candidatos/${id}/notes`, data),
    addTest: (id, data) => rrhhApi.post(`/candidatos/${id}/tests`, data),
    addVacacion: (id, data) => rrhhApi.post(`/candidatos/${id}/vacaciones`, data),
    updateVacacion: (id, vacId, data) => rrhhApi.put(`/candidatos/${id}/vacaciones/${vacId}`, data),
    addAmonestacion: (id, data) => rrhhApi.post(`/candidatos/${id}/amonestaciones`, data),
    addFelicitacion: (id, data) => rrhhApi.post(`/candidatos/${id}/felicitaciones`, data),
    uploadDocument: (id, formData) => rrhhApi.post(`/candidatos/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    uploadProfilePic: (id, formData) => rrhhApi.post(`/candidatos/${id}/profile-pic`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    uploadCV: (id, formData) => rrhhApi.post(`/candidatos/${id}/cv`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    updateDocumentStatus: (id, docId, status, extra = {}) => rrhhApi.put(`/candidatos/${id}/documents/${docId}`, { status, ...extra }),
    bulkCreate: (candidatos) => rrhhApi.post('/candidatos/bulk', { candidatos }),
    remove: (id) => rrhhApi.delete(`/candidatos/${id}`),
    syncBase: () => rrhhApi.post('/candidatos/sincronizar-base'),
    parseCV: (formData) => rrhhApi.post('/candidatos-ai/parse-cv', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const liquidacionesApi = {
    getAll: () => rrhhApi.get('/nomina'),
    generar: (data) => rrhhApi.post('/nomina/generar', data),
    getOne: (id) => rrhhApi.get(`/nomina/${id}`),
    update: (id, data) => rrhhApi.put(`/nomina/${id}`, data),
    delete: (id) => rrhhApi.delete(`/nomina/${id}`),
    preview: (data) => rrhhApi.post('/nomina/preview', data)
};

export const descuentosApi = {
    getTipos: () => rrhhApi.get('/descuentos/tipos'),
    createTipo: (data) => rrhhApi.post('/descuentos/tipos', data),
    updateTipo: (id, data) => rrhhApi.put(`/descuentos/tipos/${id}`, data),
    getTransacciones: (periodo) => rrhhApi.get(`/descuentos/transacciones/${periodo}`),
    saveTransacciones: (candidatoId, periodo, data) => rrhhApi.post(`/descuentos/transacciones/${candidatoId}/${periodo}`, data),
    uploadExcel: (periodo, data) => rrhhApi.post(`/descuentos/upload/${periodo}`, data)
};

export const beneficiosApi = {
    getTipos: () => rrhhApi.get('/beneficios/tipos'),
    createTipo: (data) => rrhhApi.post('/beneficios/tipos', data),
    updateTipo: (id, data) => rrhhApi.put(`/beneficios/tipos/${id}`, data),
    getTransacciones: (periodo) => rrhhApi.get(`/beneficios/transacciones/${periodo}`),
    saveTransacciones: (candidatoId, periodo, data) => rrhhApi.post(`/beneficios/transacciones/${candidatoId}/${periodo}`, data),
    uploadExcel: (periodo, data) => rrhhApi.post(`/beneficios/upload/${periodo}`, data)
};

export const aprobacionesRrhhApi = {
    getPendientes: () => rrhhApi.get('/aprobaciones/pendientes'),
    updateBeneficio: (id, data) => rrhhApi.put(`/aprobaciones/beneficios/${id}/estado`, data),
    updateDescuento: (id, data) => rrhhApi.put(`/aprobaciones/descuentos/${id}/estado`, data),
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
    getAll:            (params)    => rrhhApi.get('/asistencia', { params }),
    getResumenPeriodo: (month, year) => rrhhApi.get('/asistencia/resumen-periodo', { params: { month, year } }),
    create:            (data)      => rrhhApi.post('/asistencia', data),
    bulkCreate:        (registros) => rrhhApi.post('/asistencia/bulk', { registros }),
    bulkUpsert:        (registros, onlyInsertNew = false) => rrhhApi.post('/asistencia/bulk-upsert', { registros, onlyInsertNew }),
    update:            (id, data)  => rrhhApi.put(`/asistencia/${id}`, data),
    remove:            (id)        => rrhhApi.delete(`/asistencia/${id}`),
    syncToa:           (month, year) => rrhhApi.post('/asistencia/sync-toa', { month, year }),
};

export const configApi = {
    get: () => rrhhApi.get('/config'),
    update: (data) => rrhhApi.put('/config', data),
};

export const plantillasApi = {
    getAll: () => rrhhApi.get('/plantillas'),
    getById: (id) => rrhhApi.get(`/plantillas/${id}`),
    create: (data) => rrhhApi.post('/plantillas', data),
    update: (id, data) => rrhhApi.put(`/plantillas/${id}`, data),
    remove: (id) => rrhhApi.delete(`/plantillas/${id}`),
};

export const notificacionesApi = {
    getAll: () => rrhhApi.get('/notificaciones'),
    markAsRead: (id) => rrhhApi.put(`/notificaciones/${id}/read`),
    firmar: (id, data) => rrhhApi.post(`/notificaciones/${id}/firmar`, data),
    rechazar: (id, data) => rrhhApi.post(`/notificaciones/${id}/rechazar`, data)
};

export const nominaApi = {
    guardarLote: (liquidaciones) => rrhhApi.post('/nomina/guardar-lote', { liquidaciones }),
    getHistorial: (params) => rrhhApi.get('/nomina/historial', { params }),
};

export const contratosApi = {
    getAll: () => rrhhApi.get('/contratos'),
    getById: (id) => rrhhApi.get(`/contratos/${id}`),
    create: (data) => rrhhApi.post('/contratos', data),
    requestApproval: (id) => rrhhApi.post(`/contratos/${id}/request-approval`),
    approve: (id, data) => rrhhApi.post(`/contratos/${id}/approve`, data),
    remove: (id) => rrhhApi.delete(`/contratos/${id}`),
};
export const empresasApi = {
    getAll: () => {
        const stored = localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user');
        let token = '';
        if (stored) {
            try {
                const user = JSON.parse(stored);
                token = user?.token || '';
            } catch (e) { }
        }
        return axios.get(`${API_URL}/api/empresas`, {
            headers: { Authorization: `Bearer ${token}` }
        });
    }
};

// API genérica (base /api) para endpoints cross-platform como TOA
const genApi = axios.create({ baseURL: `${API_URL}/api` });
genApi.interceptors.request.use(config => {
    try {
        const stored = localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user');
        if (stored) {
            const user = JSON.parse(stored);
            if (user?.token) config.headers.Authorization = `Bearer ${user.token}`;
        }
    } catch (e) { }
    return config;
});

export const adminApi = {
    getClientes: async () => {
        try {
            return await genApi.get('/admin/clientes');
        } catch (error) {
            // Fallback de solo lectura para perfiles operativos/supervisión sin permiso granular cfg_clientes:ver.
            if (error?.response?.status === 403 || error?.response?.status === 404) {
                return genApi.get('/clientes');
            }
            throw error;
        }
    },
};

export const toaApi = {
    getIdsRecurso: (busqueda) => genApi.get('/bot/ids-recurso-toa', { params: { busqueda } }),
};

export const telecomAsistenciaApi = {
    getProduccionStats: (params) => genApi.get('/bot/produccion-stats', { params }),
};

export const bonosApi = {
    getClosure: (year, month) => genApi.get(`/admin/bonos/closure/${year}/${month}`),
};

export const bonosConfigApi = {
    getAll: () => genApi.get('/admin/bonificadores'),
    getById: (id) => genApi.get(`/admin/bonificadores/${id}`),
    create: (data) => genApi.post('/admin/bonificadores', data),
    update: (id, data) => genApi.put(`/admin/bonificadores/${id}`, data),
    delete: (id) => genApi.delete(`/admin/bonificadores/${id}`),
    migrateLegacy: () => genApi.post('/admin/bonificadores/migrate-legacy-data'),
};
export const bonificadoresApi = bonosConfigApi;

export const modelosBonificacionApi = {
    getAll: () => genApi.get('/admin/bonos'),
};

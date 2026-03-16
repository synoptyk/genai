import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import API_URL from '../../config';

import axios from 'axios';

const API_BASE = `${API_URL}/api`;
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [auditCompany, setAuditCompany] = useState(null);
    const [loading, setLoading] = useState(true);
    const heartbeatInterval = useRef(null);

    useEffect(() => {
        const storedContext = sessionStorage.getItem('genai_audit_context');
        if (storedContext) setAuditCompany(JSON.parse(storedContext));
    }, []);

    useEffect(() => {
        if (auditCompany) sessionStorage.setItem('genai_audit_context', JSON.stringify(auditCompany));
        else sessionStorage.removeItem('genai_audit_context');
    }, [auditCompany]);

    useEffect(() => {
        const stored = localStorage.getItem('genai_user') || sessionStorage.getItem('genai_user');
        if (stored) {
            try { setUser(JSON.parse(stored)); }
            catch { localStorage.removeItem('genai_user'); }
        }
        setLoading(false);
    }, []);

    // ⏱️ TIME TRACKER: Latido de sesión (Heartbeat) - Solo Administrativos
    useEffect(() => {
        if (!user || (user.role !== 'administrativo' && user.role !== 'admin')) {
            if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
            return;
        }

        const sendHeartbeat = async () => {
            try {
                // Enviar pulso de 60 segundos de trabajo
                await axios.post(`${API_BASE}/rrhh/time-tracker/heartbeat`,
                    { segundosIncremental: 60 },
                    { headers: { Authorization: `Bearer ${user.token}` } }
                );
            } catch (err) {
                console.warn('Fallo al registrar tiempo:', err.message);
            }
        };

        // Enviar un latido cada 60 segundos
        heartbeatInterval.current = setInterval(sendHeartbeat, 60000);

        return () => {
            if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
        };
    }, [user]);

    const login = async (email, password, remember = false) => {
        const { data } = await axios.post(`${API_BASE}/auth/login`, { email, password });
        if (remember) localStorage.setItem('genai_user', JSON.stringify(data));
        else sessionStorage.setItem('genai_user', JSON.stringify(data));
        setUser(data);
        return data;
    };

    const register = async (payload) => {
        const { data } = await axios.post(`${API_BASE}/auth/register`, payload);
        // Solo auto-loguear si no hay un usuario activo (para registro de empresa nueva)
        if (!user) {
            sessionStorage.setItem('genai_user', JSON.stringify(data));
            setUser(data);
        }
        return data;
    };

    const logout = () => {
        localStorage.removeItem('genai_user');
        sessionStorage.removeItem('genai_user');
        setUser(null);
    };

    const authHeader = () => {
        const headers = user?.token ? { Authorization: `Bearer ${user.token}` } : {};
        if (auditCompany?._id) {
            headers['x-company-override'] = auditCompany._id;
        }
        return headers;
    };

    return (
        <AuthContext.Provider value={{ 
            user, auditCompany, setAuditCompany, 
            loading, login, register, logout, authHeader, API_BASE 
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;

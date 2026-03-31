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
        const storedContext = sessionStorage.getItem('platform_audit_context');
        if (storedContext) setAuditCompany(JSON.parse(storedContext));
    }, []);

    useEffect(() => {
        if (auditCompany) sessionStorage.setItem('platform_audit_context', JSON.stringify(auditCompany));
        else sessionStorage.removeItem('platform_audit_context');
    }, [auditCompany]);

    useEffect(() => {
        const stored = localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user');
        if (stored) {
            try { setUser(JSON.parse(stored)); }
            catch { localStorage.removeItem('platform_user'); }
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
        
        // Si el backend requiere PIN, no guardamos sesión todavía y retornamos data para que GenAiLogin lo maneje
        if (data.requirePin) return data;

        localStorage.removeItem('platform_user');
        sessionStorage.removeItem('platform_user');

        if (remember) localStorage.setItem('platform_user', JSON.stringify(data));
        else sessionStorage.setItem('platform_user', JSON.stringify(data));
        setUser(data);
        return data;
    };

    const verifyPin = async (email, pin, remember = false) => {
        const { data } = await axios.post(`${API_BASE}/auth/verify-pin`, { email, pin });
        
        localStorage.removeItem('platform_user');
        sessionStorage.removeItem('platform_user');

        if (remember) localStorage.setItem('platform_user', JSON.stringify(data));
        else sessionStorage.setItem('platform_user', JSON.stringify(data));
        setUser(data);
        return data;
    };

    const setupPin = async (pin) => {
        const { data } = await axios.post(`${API_BASE}/auth/setup-pin`, { pin }, { headers: authHeader() });
        // Actualizamos el usuario local para reflejar que ahora tiene PIN (si es necesario)
        const updatedUser = { ...user, loginPin: pin };
        setUser(updatedUser);
        
        // Update whichever storage contains the user
        if (localStorage.getItem('platform_user')) {
            localStorage.setItem('platform_user', JSON.stringify(updatedUser));
        } else {
            sessionStorage.setItem('platform_user', JSON.stringify(updatedUser));
        }
        return data;
    };

    const resetUserPin = async (userId) => {
        const { data } = await axios.post(`${API_BASE}/auth/users/${userId}/reset-pin`, {}, { headers: authHeader() });
        return data;
    };

    const register = async (payload) => {
        const { data } = await axios.post(`${API_BASE}/auth/register`, payload);
        // Solo auto-loguear si no hay un usuario activo (para registro de empresa nueva)
        if (!user) {
            localStorage.removeItem('platform_user');
            sessionStorage.removeItem('platform_user');
            sessionStorage.setItem('platform_user', JSON.stringify(data));
            setUser(data);
        }
        return data;
    };

    const logout = () => {
        localStorage.removeItem('platform_user');
        sessionStorage.removeItem('platform_user');
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
            loading, login, verifyPin, setupPin, resetUserPin, register, logout, authHeader, API_BASE 
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import API_URL from '../../config';

import axios from 'axios';

const API_BASE = `${API_URL}/api`;
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const heartbeatInterval = useRef(null);

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

    const authHeader = () => user?.token ? { Authorization: `Bearer ${user.token}` } : {};

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, authHeader, API_BASE }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;

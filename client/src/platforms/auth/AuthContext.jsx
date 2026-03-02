import React, { createContext, useContext, useState, useEffect } from 'react';
import API_URL from '../../config';

import axios from 'axios';

const API_BASE = `${API_URL}/api`;
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem('genai_user') || sessionStorage.getItem('genai_user');
        if (stored) {
            try { setUser(JSON.parse(stored)); }
            catch { localStorage.removeItem('genai_user'); }
        }
        setLoading(false);
    }, []);

    const login = async (email, password, remember = false) => {
        const { data } = await axios.post(`${API_BASE}/auth/login`, { email, password });
        if (remember) localStorage.setItem('genai_user', JSON.stringify(data));
        else sessionStorage.setItem('genai_user', JSON.stringify(data));
        setUser(data);
        return data;
    };

    const register = async (payload) => {
        const { data } = await axios.post(`${API_BASE}/auth/register`, payload);
        sessionStorage.setItem('genai_user', JSON.stringify(data));
        setUser(data);
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

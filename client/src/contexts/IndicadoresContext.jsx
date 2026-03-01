/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  INDICADORES CONTEXT — Fuente Única de Verdad                       ║
 * ║  Fetch centralizado desde mindicador.cl (API Banco Central Chile)   ║
 * ║  Todos los módulos consumen desde aquí: UF, UTM, Dólar, etc.       ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const IndicadoresContext = createContext(null);

// ─── Fetch con retry (hasta 3 intentos) ──────────────────────────────────────
const fetchWithRetry = async (url, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const r = await fetch(url);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return await r.json();
        } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(res => setTimeout(res, 800 * (i + 1)));
        }
    }
};

// ─── Proveedor ────────────────────────────────────────────────────────────────
export const IndicadoresProvider = ({ children }) => {
    const [indicadores, setIndicadores] = useState({
        uf: null,   // { valor, fecha, codigo }
        utm: null,
        dolar: null,
        euro: null,
        ipc: null,
        tpm: null,
        libraCobre: null,
    });
    const [status, setStatus] = useState('idle');   // idle | loading | ok | error
    const [lastSync, setLastSync] = useState(null);
    const [loading, setLoading] = useState(true);

    // ── Cargar indicadores ─────────────────────────────────────────────
    const fetchIndicadores = useCallback(async () => {
        setLoading(true);
        setStatus('loading');
        try {
            // Fetch general (todos los indicadores del día)
            const data = await fetchWithRetry('https://mindicador.cl/api');

            // UTM por fecha exacta para mayor precisión
            const hoy = (() => {
                const n = new Date();
                return `${String(n.getDate()).padStart(2, '0')}-${String(n.getMonth() + 1).padStart(2, '0')}-${n.getFullYear()}`;
            })();

            let utmExacta = null;
            try {
                const utmRes = await fetchWithRetry(`https://mindicador.cl/api/utm/${hoy}`);
                utmExacta = utmRes?.serie?.[0] || null;
            } catch { /* usa UTM del fetch general */ }

            setIndicadores({
                uf: data?.uf || null,
                utm: utmExacta || data?.utm || null,
                dolar: data?.dolar || null,
                euro: data?.euro || null,
                ipc: data?.ipc || null,
                tpm: data?.tpm || null,
                libraCobre: data?.libra_cobre || null,
            });
            setStatus('ok');
            setLastSync(new Date());
        } catch (err) {
            console.error('[IndicadoresContext] Error fetching:', err);
            setStatus('error');
        } finally {
            setLoading(false);
        }
    }, []);

    // Carga inicial + refresh automático cada 2 horas
    useEffect(() => {
        fetchIndicadores();
        const timer = setInterval(fetchIndicadores, 2 * 60 * 60 * 1000);
        return () => clearInterval(timer);
    }, [fetchIndicadores]);

    // ── Valores derivados de uso frecuente (siempre disponibles) ──────
    const ufValue = indicadores.uf?.valor || 38_500;
    const utmValue = indicadores.utm?.valor || 67_500;
    const usdValue = indicadores.dolar?.valor || null;
    const eurValue = indicadores.euro?.valor || null;
    const ipcValue = indicadores.ipc?.valor || null;

    // Params object listos para pasar a payrollCalculator.js
    const params = { ufValue, utmValue };

    const value = {
        // Objetos completos (incluyen fecha, codigo, etc.)
        indicadores,

        // Valores escalares de uso directo
        ufValue,
        utmValue,
        usdValue,
        eurValue,
        ipcValue,

        // Para pasar directo al motor de cálculo
        params,

        // Estado
        status,
        loading,
        lastSync,

        // Forzar refresh
        refetch: fetchIndicadores,
    };

    return (
        <IndicadoresContext.Provider value={value}>
            {children}
        </IndicadoresContext.Provider>
    );
};

// ─── Hook de consumo ─────────────────────────────────────────────────────────
export const useIndicadores = () => {
    const ctx = useContext(IndicadoresContext);
    if (!ctx) throw new Error('useIndicadores debe usarse dentro de <IndicadoresProvider>');
    return ctx;
};

export default IndicadoresContext;

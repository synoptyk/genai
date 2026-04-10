import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Brain, Send, TrendingUp, TrendingDown, Minus,
  AlertTriangle, BarChart3, Users, Zap, RefreshCw,
  MessageSquare, ChevronDown, ChevronUp
} from 'lucide-react';
import API_URL from '../../config';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const authHeader = () => {
  const stored = localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user');
  if (!stored) return {};
  try { return { Authorization: `Bearer ${JSON.parse(stored).token}` }; } catch { return {}; }
};

// ─── Sub-componentes ──────────────────────────────────────────────────────────

const StatCard = ({ label, value, sub, icon: Icon, color = 'indigo' }) => {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber:   'bg-amber-50 text-amber-700 border-amber-100',
    rose:    'bg-rose-50 text-rose-700 border-rose-100',
  };
  return (
    <div className={`rounded-2xl border p-4 flex items-start gap-3 ${colors[color]}`}>
      <div className={`p-2 rounded-xl bg-white/60 flex-shrink-0`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</p>
        <p className="text-2xl font-black leading-tight">{value ?? '—'}</p>
        {sub && <p className="text-[10px] font-semibold opacity-70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};

const TendenciaChip = ({ tendencia }) => {
  if (!tendencia) return null;
  const map = {
    subiendo: { icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50 border-emerald-200', label: 'Subiendo' },
    bajando:  { icon: TrendingDown, color: 'text-rose-600 bg-rose-50 border-rose-200', label: 'Bajando' },
    estable:  { icon: Minus, color: 'text-amber-600 bg-amber-50 border-amber-200', label: 'Estable' },
  };
  const t = map[tendencia] || map.estable;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${t.color}`}>
      <t.icon size={11} />
      {t.label}
    </span>
  );
};

const ForecastBar = ({ value, max, label }) => (
  <div className="flex items-center gap-2 text-[10px]">
    <span className="w-16 text-right text-slate-500 font-semibold shrink-0">{label}</span>
    <div className="flex-1 bg-slate-100 rounded-full h-2">
      <div
        className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
        style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }}
      />
    </div>
    <span className="w-8 font-black text-slate-700">{value}</span>
  </div>
);

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AIAssistant() {
  const [prodData, setProdData] = useState(null);
  const [rrhhData, setRrhhData] = useState(null);
  const [loadingProd, setLoadingProd] = useState(false);
  const [loadingRrhh, setLoadingRrhh] = useState(false);
  const [chat, setChat] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [openSection, setOpenSection] = useState('prod');
  const chatEndRef = useRef(null);

  const toggleSection = (key) => setOpenSection(prev => prev === key ? null : key);

  const fetchInsights = async () => {
    setLoadingProd(true);
    setLoadingRrhh(true);
    try {
      const [rProd, rRrhh] = await Promise.all([
        axios.get(`${API_URL}/api/ai/insights/produccion`, { headers: authHeader() }),
        axios.get(`${API_URL}/api/ai/insights/rrhh`, { headers: authHeader() }),
      ]);
      setProdData(rProd.data);
      setRrhhData(rRrhh.data);
    } catch (err) {
      console.error('AI insights error:', err.message);
    } finally {
      setLoadingProd(false);
      setLoadingRrhh(false);
    }
  };

  useEffect(() => {
    fetchInsights();
    setChat([{ role: 'assistant', text: '¡Hola! Soy el Asistente de IA de Gen AI. Puedo ayudarte a analizar producción, RRHH, logística y prevención. ¿En qué te puedo ayudar hoy?' }]);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  const sendMessage = async () => {
    const msg = inputMsg.trim();
    if (!msg || sendingMsg) return;
    setInputMsg('');
    setChat(prev => [...prev, { role: 'user', text: msg }]);
    setSendingMsg(true);
    try {
      const { data } = await axios.post(
        `${API_URL}/api/ai/chat`,
        { mensaje: msg },
        { headers: { ...authHeader(), 'Content-Type': 'application/json' } }
      );
      setChat(prev => [...prev, { role: 'assistant', text: data.respuesta, modo: data.modo }]);
    } catch {
      setChat(prev => [...prev, { role: 'assistant', text: 'Error al contactar al asistente. Intenta nuevamente.', isError: true }]);
    } finally {
      setSendingMsg(false);
    }
  };

  const maxForecast = prodData
    ? Math.max(...(prodData.forecast?.actividades || [1]), 1)
    : 1;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-violet-600 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-violet-200">
            <Brain className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Asistente Gen AI</h1>
            <p className="text-[11px] text-slate-500 font-semibold">Predicciones · Anomalías · Análisis Inteligente</p>
          </div>
        </div>
        <button
          onClick={fetchInsights}
          disabled={loadingProd || loadingRrhh}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700 text-[11px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={loadingProd ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* ── Sección: Producción ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <button
          onClick={() => toggleSection('prod')}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-indigo-600" />
            <span className="font-black text-slate-800 text-sm uppercase tracking-widest">Insights de Producción</span>
            {prodData && <TendenciaChip tendencia={prodData.resumen?.tendencia} />}
            {prodData?.resumen?.anomaliasDetectadas > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[9px] font-black uppercase">
                <AlertTriangle size={9} />
                {prodData.resumen.anomaliasDetectadas} anomalía{prodData.resumen.anomaliasDetectadas !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {openSection === 'prod' ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </button>

        {openSection === 'prod' && (
          <div className="px-6 pb-6 space-y-5 border-t border-slate-50">
            {loadingProd ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            ) : prodData ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
                  <StatCard label="Actividades (30d)" value={prodData.resumen.totalActividades30d.toLocaleString()} icon={Zap} color="indigo" />
                  <StatCard label="Promedio diario" value={prodData.resumen.promedioDiario} sub="actividades / día" icon={BarChart3} color="emerald" />
                  <StatCard label="Puntos (30d)" value={prodData.resumen.totalPuntos30d.toLocaleString()} icon={TrendingUp} color="amber" />
                  <StatCard label="Anomalías" value={prodData.resumen.anomaliasDetectadas} sub="días fuera de rango" icon={AlertTriangle} color={prodData.resumen.anomaliasDetectadas > 0 ? 'rose' : 'emerald'} />
                </div>

                {prodData.forecast?.actividades?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Proyección — próximos 7 días</p>
                    <div className="space-y-2">
                      {prodData.forecast.actividades.map((v, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() + i + 1);
                        return (
                          <ForecastBar
                            key={i}
                            value={v}
                            max={maxForecast}
                            label={d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' })}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {prodData.anomalias?.length > 0 && (
                  <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
                    <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest mb-2">Días con comportamiento anómalo detectado</p>
                    <div className="space-y-1">
                      {prodData.anomalias.map((a, i) => (
                        <p key={i} className="text-[11px] text-rose-600 font-semibold">
                          Día {a.index + 1}: {a.value} actividades (z-score: {a.zScore})
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400 py-4 text-center">No hay datos disponibles aún.</p>
            )}
          </div>
        )}
      </div>

      {/* ── Sección: RRHH ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <button
          onClick={() => toggleSection('rrhh')}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Users size={16} className="text-violet-600" />
            <span className="font-black text-slate-800 text-sm uppercase tracking-widest">Insights de RRHH</span>
            {rrhhData?.asistencia?.alerta && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-[9px] font-black uppercase">
                <AlertTriangle size={9} /> Alerta asistencia
              </span>
            )}
          </div>
          {openSection === 'rrhh' ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </button>

        {openSection === 'rrhh' && (
          <div className="px-6 pb-6 space-y-5 border-t border-slate-50">
            {loadingRrhh ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-violet-100 border-t-violet-600 rounded-full animate-spin" />
              </div>
            ) : rrhhData ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
                  <StatCard label="Personal activo" value={rrhhData.dotacion.totalActivos} icon={Users} color="indigo" />
                  <StatCard label="Incorporados (30d)" value={rrhhData.dotacion.incorporados30d} icon={TrendingUp} color="emerald" />
                  <StatCard label="Tasa retención" value={`${rrhhData.dotacion.tasaRetencion}%`} icon={BarChart3} color="amber" />
                  <StatCard
                    label="Asistencia (7d)"
                    value={rrhhData.asistencia.tasaPromedioAsistencia !== null ? `${rrhhData.asistencia.tasaPromedioAsistencia}%` : 'N/D'}
                    sub={rrhhData.asistencia.alerta || 'Sin alertas'}
                    icon={AlertTriangle}
                    color={rrhhData.asistencia.alerta ? 'rose' : 'emerald'}
                  />
                </div>

                {rrhhData.asistencia.alerta && (
                  <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
                    <p className="text-[12px] text-amber-800 font-semibold">{rrhhData.asistencia.alerta}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400 py-4 text-center">No hay datos disponibles aún.</p>
            )}
          </div>
        )}
      </div>

      {/* ── Chat IA ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col" style={{ minHeight: 420 }}>
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-50">
          <MessageSquare size={15} className="text-indigo-600" />
          <span className="font-black text-slate-800 text-sm uppercase tracking-widest">Chat Asistente IA</span>
          <span className="ml-auto text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-violet-50 text-violet-600">
            {process.env.REACT_APP_AI_MODE === 'openai' ? 'GPT-4o mini' : 'Análisis Local'}
          </span>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ maxHeight: 320 }}>
          {chat.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[12px] leading-relaxed font-medium
                ${msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : msg.isError
                  ? 'bg-rose-50 text-rose-700 border border-rose-100 rounded-bl-sm'
                  : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-bl-sm'
                }`}
              >
                {msg.text}
                {msg.modo === 'local' && (
                  <span className="block text-[9px] opacity-50 mt-1 font-black uppercase">modo análisis local</span>
                )}
              </div>
            </div>
          ))}
          {sendingMsg && (
            <div className="flex justify-start">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-bl-sm px-4 py-2.5">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-50 px-4 py-3 flex gap-2">
          <input
            type="text"
            value={inputMsg}
            onChange={e => setInputMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Pregunta sobre producción, RRHH, flota..."
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-[12px] text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
            maxLength={500}
          />
          <button
            onClick={sendMessage}
            disabled={sendingMsg || !inputMsg.trim()}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

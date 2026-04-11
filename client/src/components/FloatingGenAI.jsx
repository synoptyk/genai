import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { X, Send, Sparkles, Minimize2, Maximize2, BookOpen } from 'lucide-react';
import API_URL from '../config';
import { useAuth } from '../platforms/auth/AuthContext';

const HIDE_ON_PATHS = ['/login'];
const STANDARD_SESSION_TIMEOUT_MS = 15 * 60 * 1000;

const createSessionId = () => `fg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const FloatingGenAI = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatSessionId, setChatSessionId] = useState(createSessionId);
  const [sessionTimeoutMs, setSessionTimeoutMs] = useState(STANDARD_SESSION_TIMEOUT_MS);
  const [lastActivityAt, setLastActivityAt] = useState(Date.now());
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hola. Soy tu asistente GENAI360 de soporte operativo. Estoy aqui para ayudarte paso a paso con permisos, rutas, errores y flujos de cada modulo.',
      fuentes: []
    }
  ]);
  const endRef = useRef(null);

  const shouldShow = useMemo(() => {
    if (!user?.token) return false;
    if (location.pathname === '/') return false;
    return !HIDE_ON_PATHS.includes(location.pathname);
  }, [location.pathname, user?.token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!open) return;
      const expired = Date.now() - lastActivityAt > sessionTimeoutMs;
      if (!expired) return;

      setChatSessionId(createSessionId());
      setMessages([
        {
          role: 'assistant',
          text: 'Tu sesion de chat expiro por inactividad. Iniciamos una nueva sesion temporal. ¿En que te puedo ayudar ahora?',
          fuentes: []
        }
      ]);
      setLastActivityAt(Date.now());
    }, 30000);

    return () => clearInterval(timer);
  }, [lastActivityAt, open, sessionTimeoutMs]);

  useEffect(() => {
    if (!user?.name) return;
    setMessages([
      {
        role: 'assistant',
        text: `Hola ${user.name}. Soy GENAI360 Support. Preguntame cualquier cosa del ecosistema y te guio con una respuesta clara y accionable.`,
        fuentes: []
      }
    ]);
  }, [user?.name]);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${user?.token || ''}` }), [user?.token]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setSending(true);

    try {
      const { data } = await axios.post(
        `${API_URL}/api/ai/chat`,
        {
          mensaje: text,
          contexto: {
            modo: 'floating_support',
            rutaActual: location.pathname,
            rolUsuario: user?.role || null,
            nombreUsuario: user?.name || null,
            chatSessionId
          }
        },
        { headers: { ...authHeaders, 'Content-Type': 'application/json' } }
      );

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data?.respuesta || 'No pude generar una respuesta en este momento.',
          fuentes: data?.fuentes || []
        }
      ]);
      if (data?.sessionMemory?.ttlMs && Number.isFinite(Number(data.sessionMemory.ttlMs))) {
        setSessionTimeoutMs(Number(data.sessionMemory.ttlMs));
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'No pude conectar con el asistente. Intenta de nuevo en unos segundos.',
          isError: true,
          fuentes: []
        }
      ]);
    } finally {
      setSending(false);
    }

    setLastActivityAt(Date.now());
  };

  if (!shouldShow) return null;

  return (
    <>
      {open && (
        <div className={`fixed z-[80] bottom-24 right-5 ${expanded ? 'w-[min(92vw,560px)]' : 'w-[min(92vw,420px)]'} bg-white border border-slate-200 rounded-3xl shadow-2xl shadow-slate-900/20 overflow-hidden`}>
          <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-indigo-900 to-indigo-600 text-white flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-white/10 border border-white/20">
              <img src="/genai-assistant-logo.png" alt="GENAI360" className="w-7 h-7 object-cover rounded-lg" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-widest truncate">GENAI360 Support</p>
              <p className="text-[10px] font-semibold text-indigo-100 truncate">Asistente humano + memoria temporal</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setExpanded((v) => !v);
                setLastActivityAt(Date.now());
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title={expanded ? 'Contraer' : 'Expandir'}
            >
              {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setChatSessionId(createSessionId());
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="Cerrar"
            >
              <X size={14} />
            </button>
          </div>

          <div className="max-h-[52vh] overflow-y-auto px-4 py-3 bg-slate-50/40 space-y-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[86%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed font-medium ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : msg.isError ? 'bg-rose-50 text-rose-700 border border-rose-100 rounded-bl-sm' : 'bg-white text-slate-700 border border-slate-100 rounded-bl-sm shadow-sm'}`}>
                  {msg.text}

                  {Array.isArray(msg.fuentes) && msg.fuentes.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                        <BookOpen size={10} /> Fuentes
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {msg.fuentes.slice(0, 3).map((f, i) => (
                          <span key={`${f.documento}-${i}`} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-black uppercase tracking-wider">
                            {f.documento.replace('.md', '')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          <div className="px-3 py-2 border-t border-slate-100 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tips:</span>
              <button
                type="button"
                onClick={() => setInput('No puedo acceder a un modulo, como reviso permisos y ruta?')}
                className="text-[9px] px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-bold"
              >
                Permisos
              </button>
              <button
                type="button"
                onClick={() => setInput('Dame pasos para soporte de inspecciones HSE sin firma de tecnico')}
                className="text-[9px] px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-bold"
              >
                Inspecciones
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Escribe tu consulta de soporte..."
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-[12px] text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-200"
                maxLength={700}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Enviar"
              >
                <Send size={14} />
              </button>
              <Link
                to="/ai/asistente"
                className="p-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                title="Abrir asistente completo"
              >
                <Sparkles size={14} />
              </Link>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) {
              setChatSessionId(createSessionId());
              setLastActivityAt(Date.now());
            }
            return next;
          });
        }}
        className="fixed z-[79] bottom-6 right-5 w-16 h-16 rounded-[1.35rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-2xl shadow-indigo-900/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
        title="Asistente GENAI360"
      >
        <span className="absolute inset-0 rounded-[1.35rem] bg-gradient-to-br from-cyan-300/35 via-violet-300/20 to-fuchsia-300/35 animate-pulse" />
        <span className="absolute -inset-2 rounded-[1.8rem] border border-indigo-300/60 animate-ping" />
        <span className="absolute -inset-4 rounded-[2.2rem] bg-indigo-400/10 blur-xl" />
        {open ? (
          <X size={18} className="relative z-10" />
        ) : (
          <img src="/genai-assistant-logo.png" alt="GENAI360 Assistant" className="relative z-10 w-11 h-11 object-cover rounded-xl border border-white/30 shadow-lg" />
        )}
      </button>
    </>
  );
};

export default FloatingGenAI;

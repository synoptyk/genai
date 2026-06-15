import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Mail, Send, Inbox, Trash2, Star, RefreshCw, Plus, X,
    ChevronDown, Search, AlertCircle, CheckCircle,
    Reply, ArrowLeft, Eye, EyeOff, Loader2,
    Shield, Lock, Globe, Server, AtSign, Wifi,
    Sparkles, Edit3, Briefcase, Zap, Command,
    Maximize2, Minimize2, Paperclip, MoreVertical
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5003';

const api = async (path, opts = {}) => {
    const user = JSON.parse(localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user') || '{}');
    const res = await fetch(`${API_URL}/api/webmail${path}`, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
            ...(opts.headers || {}),
        },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || 'Error de servidor');
    }
    return res.json();
};

// ─── Preset IMAP/SMTP providers ─────────────────────────────────────────────
const PROVIDERS = [
    { name: 'Gmail', domain: 'gmail.com', imapHost: 'imap.gmail.com', imapPort: 993, smtpHost: 'smtp.gmail.com', smtpPort: 587, smtpSecure: false, note: 'Conexión 1-Clic segura con Google (Recomendado)' },
    { name: 'Outlook / Microsoft 365', domain: 'outlook.com', imapHost: 'outlook.office365.com', imapPort: 993, smtpHost: 'smtp.office365.com', smtpPort: 587, smtpSecure: false, note: 'Conexión 1-Clic segura con Microsoft (Recomendado)' },
    { name: 'Yahoo', domain: 'yahoo.com', imapHost: 'imap.mail.yahoo.com', imapPort: 993, smtpHost: 'smtp.mail.yahoo.com', smtpPort: 465, smtpSecure: true },
    { name: 'Zoho Mail', domain: 'zoho.com', imapHost: 'imap.zoho.com', imapPort: 993, smtpHost: 'smtp.zoho.com', smtpPort: 465, smtpSecure: true },
    { name: 'Otro Servidor', domain: null, imapHost: '', imapPort: 993, smtpHost: '', smtpPort: 465, smtpSecure: true },
];

// ─── Avatar ──────────────────────────────────────────────────────────────────
const Avatar = ({ name, email, size = 10, className = "" }) => {
    const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
        : (email || '?')[0].toUpperCase();
    const colors = ['from-violet-500 to-fuchsia-600', 'from-blue-500 to-cyan-600', 'from-emerald-400 to-teal-600',
        'from-rose-500 to-orange-500', 'from-amber-400 to-yellow-600', 'from-indigo-500 to-blue-600'];
    const idx = (name || email || '').charCodeAt(0) % colors.length;
    return (
        <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br ${colors[idx]} flex items-center justify-center text-white font-black text-[10px] flex-shrink-0 shadow-sm border border-white/20 ${className}`}>
            {initials}
        </div>
    );
};

// ─── Add Account Modal ────────────────────────────────────────────────────────
const AddAccountModal = ({ onClose, onAdded }) => {
    const [step, setStep] = useState(1);
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [form, setForm] = useState({
        email: '', displayName: '', imapHost: '', imapPort: 993, imapSecure: true, imapUser: '', imapPassword: '',
        smtpHost: '', smtpPort: 465, smtpSecure: true, smtpUser: '', smtpPassword: '', signature: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPass, setShowPass] = useState(false);

    const selectProvider = (p) => {
        setSelectedProvider(p);
        const isOAuth = p.name.toLowerCase().includes('gmail') || p.name.toLowerCase().includes('outlook');
        if (isOAuth) {
            setStep(3); // Ir a la pantalla de OAuth
        } else {
            setForm(f => ({
                ...f, imapHost: p.imapHost, imapPort: p.imapPort, imapSecure: true,
                smtpHost: p.smtpHost, smtpPort: p.smtpPort, smtpSecure: p.smtpSecure !== false,
            }));
            setStep(2); // Formulario IMAP/SMTP manual
        }
    };

    const handleOAuth = () => {
        setLoading(true);
        setError('');
        const user = JSON.parse(localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user') || '{}');
        const token = user.token;
        if (!token) {
            setError('Falta el token de sesión. Vuelve a iniciar sesión en la plataforma.');
            setLoading(false);
            return;
        }

        const providerPath = selectedProvider.name.toLowerCase().includes('gmail') ? 'google' : 'microsoft';
        const url = `${API_URL}/api/webmail/auth/${providerPath}?token=${token}`;
        
        // Abrir popup centrado
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        const popup = window.open(url, 'Conectar Cuenta', `width=${width},height=${height},top=${top},left=${left}`);

        if (!popup) {
            setError('El popup de inicio de sesión fue bloqueado por tu navegador. Por favor, actívalo e intenta de nuevo.');
            setLoading(false);
            return;
        }

        const handleMessage = (event) => {
            if (event.origin !== API_URL) return;

            if (event.data?.type === 'OAUTH_SUCCESS') {
                window.removeEventListener('message', handleMessage);
                setLoading(false);
                onAdded({ email: event.data.email });
                onClose();
            } else if (event.data?.type === 'OAUTH_ERROR') {
                window.removeEventListener('message', handleMessage);
                setLoading(false);
                setError(event.data.error || 'Error en la autenticación');
            }
        };

        window.addEventListener('message', handleMessage);
        
        const checkClosed = setInterval(() => {
            if (popup.closed) {
                clearInterval(checkClosed);
                window.removeEventListener('message', handleMessage);
                setLoading(false);
            }
        }, 1000);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const account = await api('/accounts', { method: 'POST', body: JSON.stringify(form) });
            onAdded(account);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const inp = 'w-full px-4 py-3 bg-slate-50/50 border border-slate-200/60 rounded-2xl text-sm text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all placeholder:text-slate-400 backdrop-blur-sm';

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={onClose} />
            <div className="relative w-full max-w-xl bg-white/90 backdrop-blur-xl border border-white rounded-[2rem] shadow-2xl overflow-hidden ring-1 ring-slate-900/5">
                <div className="relative p-6 overflow-hidden">
                    {/* Decorative bg */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    
                    <div className="flex items-center justify-between relative z-10 mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
                                <Mail size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight">Agregar Cuenta</h2>
                                <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest">
                                    {step === 1 ? 'Selecciona tu proveedor' : 'Configuración de acceso'}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {step === 1 && (
                        <div className="grid grid-cols-1 gap-3 relative z-10">
                            {PROVIDERS.map(p => (
                                <button key={p.name} onClick={() => selectProvider(p)}
                                    className="flex items-center gap-4 p-4 bg-white hover:bg-indigo-50/50 border border-slate-200/60 hover:border-indigo-200 rounded-2xl transition-all text-left group shadow-sm hover:shadow-md">
                                    <div className="w-12 h-12 bg-slate-50 group-hover:bg-white rounded-xl flex items-center justify-center transition-colors">
                                        <Globe size={20} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-black text-slate-800 group-hover:text-indigo-700">{p.name}</p>
                                        {p.note && <p className="text-[10px] text-amber-600 font-bold mt-1 flex items-center gap-1"><Shield size={10}/> {p.note}</p>}
                                    </div>
                                    <ChevronDown size={18} className="text-slate-300 -rotate-90 group-hover:text-indigo-500 transition-all group-hover:translate-x-1" />
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 relative z-10">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Correo Electrónico</label>
                                    <input type="email" required placeholder="tu@empresa.com" value={form.email}
                                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inp} />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Nombre a mostrar</label>
                                    <input type="text" placeholder="Juan Pérez" value={form.displayName}
                                        onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} className={inp} />
                                </div>
                            </div>

                            <div className="bg-slate-50/50 border border-slate-100 rounded-[1.5rem] p-4 space-y-4">
                                <div>
                                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Server size={12} /> IMAP (Recepción)
                                    </p>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="col-span-2">
                                            <input type="text" required placeholder="imap.host.com" value={form.imapHost}
                                                onChange={e => setForm(f => ({ ...f, imapHost: e.target.value }))} className={inp} />
                                        </div>
                                        <input type="number" placeholder="Puerto" value={form.imapPort}
                                            onChange={e => setForm(f => ({ ...f, imapPort: Number(e.target.value) }))} className={inp} />
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-slate-200/60">
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Send size={12} /> SMTP (Envío)
                                    </p>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="col-span-2">
                                            <input type="text" required placeholder="smtp.host.com" value={form.smtpHost}
                                                onChange={e => setForm(f => ({ ...f, smtpHost: e.target.value }))} className={inp} />
                                        </div>
                                        <input type="number" placeholder="Puerto" value={form.smtpPort}
                                            onChange={e => setForm(f => ({ ...f, smtpPort: Number(e.target.value) }))} className={inp} />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50/50 border border-slate-100 rounded-[1.5rem] p-4">
                                <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Lock size={12} /> Credenciales de Seguridad
                                </p>
                                <div className="space-y-3">
                                    <input type="text" placeholder="Usuario (vacío = usar correo)" value={form.imapUser}
                                        autoComplete="username"
                                        onChange={e => setForm(f => ({ ...f, imapUser: e.target.value, smtpUser: e.target.value }))} className={inp} />
                                    <div className="relative">
                                        <input
                                            type={showPass ? 'text' : 'password'}
                                            required
                                            placeholder="Contraseña o App Password"
                                            value={form.imapPassword}
                                            autoComplete={showPass ? 'off' : 'current-password'}
                                            onChange={e => setForm(f => ({ ...f, imapPassword: e.target.value, smtpPassword: e.target.value }))}
                                            className={inp}
                                        />
                                        <button type="button" onClick={() => setShowPass(p => !p)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                            {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-start gap-3 p-4 bg-rose-50/80 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold animate-pulse">
                                    <AlertCircle size={18} className="flex-shrink-0 mt-0.5 text-rose-500" />
                                    <span className="leading-snug">{error}</span>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setStep(1)}
                                    className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                                    Volver
                                </button>
                                <button type="submit" disabled={loading}
                                    className="flex-[2] py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                    {loading ? 'Validando...' : 'Conectar Cuenta Segura'}
                                </button>
                            </div>
                        </form>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 relative z-10 p-4 text-center">
                            <div className="mx-auto w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center shadow-inner">
                                {selectedProvider.name.toLowerCase().includes('gmail') ? (
                                    <Globe size={32} className="text-rose-500" />
                                ) : (
                                    <Globe size={32} className="text-blue-500" />
                                )}
                            </div>
                            
                            <div className="space-y-2">
                                <h3 className="text-lg font-black text-slate-800">
                                    Conectar con {selectedProvider.name}
                                </h3>
                                <p className="text-slate-500 text-xs leading-relaxed max-w-sm mx-auto">
                                    Inicia sesión de forma segura usando tu cuenta de {selectedProvider.name}. No almacenaremos tu contraseña; solo un token de acceso seguro encriptado de grado corporativo.
                                </p>
                            </div>

                            {error && (
                                <div className="flex items-start gap-3 p-4 bg-rose-50/80 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold text-left animate-pulse">
                                    <AlertCircle size={18} className="flex-shrink-0 mt-0.5 text-rose-500" />
                                    <span className="leading-snug">{error}</span>
                                </div>
                            )}

                            <div className="flex flex-col gap-3 pt-2">
                                <button type="button" onClick={handleOAuth} disabled={loading}
                                    className={`w-full py-4 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:shadow-lg transition-all flex items-center justify-center gap-2 ${
                                        selectedProvider.name.toLowerCase().includes('gmail')
                                            ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:shadow-rose-500/20'
                                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-blue-500/20'
                                    }`}>
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                                    {selectedProvider.name.toLowerCase().includes('gmail') ? 'Conectar con Google' : 'Conectar con Microsoft'}
                                </button>
                                <button type="button" onClick={() => setStep(1)}
                                    className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest transition-all">
                                    Volver
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Compose Modal (GenAI Powered) ────────────────────────────────────────────
const ComposeModal = ({ account, onClose, replyTo = null }) => {
    const [form, setForm] = useState({
        to: replyTo?.from?.address || '',
        cc: '',
        subject: replyTo ? `Re: ${replyTo.subject}` : '',
        html: replyTo ? `<br/><br/><div style="border-left: 2px solid #cbd5e1; padding-left: 10px; color: #475569;"><b>De:</b> ${replyTo.from?.name || replyTo.from?.address} &lt;${replyTo.from?.address}&gt;<br/><b>Asunto:</b> ${replyTo.subject}<br/><br/>${replyTo.textBody?.replace(/\n/g, '<br/>') || ''}</div>` : '',
    });
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    
    // GenAI Drafting
    const [aiPrompt, setAiPrompt] = useState('');
    const [drafting, setDrafting] = useState(false);

    const handleSend = async () => {
        if (!form.to.trim()) return setError('El destinatario es requerido');
        setSending(true);
        setError('');
        try {
            await api(`/send/${account._id}`, { method: 'POST', body: JSON.stringify(form) });
            setSent(true);
            setTimeout(onClose, 1500);
        } catch (err) {
            setError(err.message);
        } finally {
            setSending(false);
        }
    };

    const handleGenerateDraft = async () => {
        if (!aiPrompt.trim()) return;
        setDrafting(true);
        try {
            const res = await api('/ai/draft', { 
                method: 'POST', 
                body: JSON.stringify({ 
                    instruction: aiPrompt, 
                    originalText: replyTo ? replyTo.textBody : null 
                }) 
            });
            // Combine new draft with existing signature/reply history
            setForm(f => ({ ...f, html: res.draft + (replyTo ? f.html : '') }));
            setAiPrompt(''); // clear prompt after success
        } catch (err) {
            setError('Error generando borrador con IA: ' + err.message);
        } finally {
            setDrafting(false);
        }
    };

    const inp = 'w-full px-5 py-3 bg-transparent border-b border-slate-100 text-[13px] text-slate-800 focus:outline-none focus:border-indigo-400 focus:bg-indigo-50/30 transition-colors placeholder:text-slate-400 font-medium';

    return (
        <div className="fixed inset-0 z-[998] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm">
            <div className="w-full max-w-3xl bg-white rounded-[2rem] shadow-2xl flex flex-col overflow-hidden ring-1 ring-slate-900/10"
                style={{ height: '85vh' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white/50 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center">
                            <Edit3 size={16} className="text-indigo-600" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest text-slate-700">
                            {replyTo ? 'Responder' : 'Nuevo Mensaje'}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-xl transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Compose Area */}
                    <div className="flex-[2] flex flex-col border-r border-slate-100 bg-white">
                        <div className="flex flex-col flex-shrink-0">
                            <div className="flex items-center">
                                <span className="w-16 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest px-4">Para</span>
                                <input type="email" placeholder="destinatario@empresa.com" value={form.to}
                                    onChange={e => setForm(f => ({ ...f, to: e.target.value }))} className={inp} />
                            </div>
                            <div className="flex items-center">
                                <span className="w-16 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest px-4">CC</span>
                                <input type="text" placeholder="copia@empresa.com" value={form.cc}
                                    onChange={e => setForm(f => ({ ...f, cc: e.target.value }))} className={inp} />
                            </div>
                            <div className="flex items-center">
                                <span className="w-16 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest px-4">Asunto</span>
                                <input type="text" placeholder="Asunto del correo" value={form.subject}
                                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className={inp} />
                            </div>
                        </div>

                        {/* Editor */}
                        <div className="flex-1 p-6 relative group">
                            <textarea
                                className="w-full h-full text-sm text-slate-700 focus:outline-none resize-none placeholder:text-slate-300 font-medium leading-relaxed"
                                placeholder="Escribe tu mensaje aquí... o pídele a Gemini que lo redacte por ti en el panel derecho 👉"
                                value={form.html}
                                onChange={e => setForm(f => ({ ...f, html: e.target.value }))}
                            />
                        </div>
                    </div>

                    {/* AI Sidebar */}
                    <div className="w-72 bg-gradient-to-b from-indigo-50/50 to-white flex flex-col p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md">
                                <Sparkles size={16} className="text-white" />
                            </div>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">GenAI Assistant</h3>
                        </div>

                        <div className="flex-1 flex flex-col gap-4">
                            <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                                Deja que la Inteligencia Artificial redacte por ti. Describe qué quieres decir.
                            </p>
                            
                            <textarea
                                className="w-full h-32 px-4 py-3 bg-white border border-indigo-100 rounded-2xl text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all resize-none shadow-inner"
                                placeholder='Ej: "Dile amablemente que el proyecto se retrasa una semana por revisión de QA, pero que está quedando perfecto."'
                                value={aiPrompt}
                                onChange={e => setAiPrompt(e.target.value)}
                            />

                            <button onClick={handleGenerateDraft} disabled={drafting || !aiPrompt.trim()}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2">
                                {drafting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                                {drafting ? 'Redactando...' : 'Generar Borrador'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                            <Paperclip size={18} />
                        </button>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">De: {account.email}</p>
                    </div>
                    {error && <p className="text-xs text-rose-600 font-bold bg-rose-50 px-3 py-1 rounded-lg">{error}</p>}
                    <button onClick={handleSend} disabled={sending || sent}
                        className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-60">
                        {sent ? <CheckCircle size={18} /> : sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        {sent ? '¡Enviado!' : sending ? 'Enviando...' : 'Enviar Mensaje'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Email Detail View (GenAI Powered) ────────────────────────────────────────
const EmailDetail = ({ email, onBack, onReply, onDelete, accountId }) => {
    const [summary, setSummary] = useState(null);
    const [summarizing, setSummarizing] = useState(false);
    const fromName = email.from?.name || email.from?.address || 'Desconocido';

    const handleSummarize = async () => {
        setSummarizing(true);
        try {
            const res = await api('/ai/summarize', {
                method: 'POST',
                body: JSON.stringify({ text: email.textBody || email.htmlBody })
            });
            setSummary(res.summary);
        } catch (e) {
            console.error("Error AI:", e);
        } finally {
            setSummarizing(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white relative">
            <div className="flex items-center gap-4 px-6 py-5 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
                <button onClick={onBack} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-black text-slate-900 truncate tracking-tight">{email.subject}</h2>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                            {email.folder || 'INBOX'}
                        </span>
                        <p className="text-[11px] text-slate-400 font-bold">
                            {new Date(email.date).toLocaleString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleSummarize} disabled={summarizing}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 hover:from-violet-500/20 hover:to-fuchsia-500/20 text-violet-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                        {summarizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        IA Resumir
                    </button>
                    <button onClick={() => onReply(email)}
                        className="w-10 h-10 flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-all">
                        <Reply size={18} />
                    </button>
                    <button onClick={() => onDelete(email.uid)}
                        className="w-10 h-10 flex items-center justify-center hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all">
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* Email Header Info */}
                <div className="px-8 py-6 border-b border-slate-50 flex items-start gap-5">
                    <Avatar name={fromName} email={email.from?.address} size={14} className="text-base" />
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <p className="text-base font-black text-slate-900">{fromName}</p>
                                <span className="text-[11px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">&lt;{email.from?.address}&gt;</span>
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2 font-medium flex gap-2">
                            <span className="font-bold">Para:</span> {email.to?.map(t => t.address).join(', ')}
                        </p>
                        {email.cc && email.cc.length > 0 && (
                            <p className="text-[11px] text-slate-500 mt-1 font-medium flex gap-2">
                                <span className="font-bold">CC:</span> {email.cc?.map(t => t.address).join(', ')}
                            </p>
                        )}
                    </div>
                </div>

                {/* AI Summary Banner */}
                {summary && (
                    <div className="mx-8 mt-6 p-5 bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 rounded-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Sparkles size={64} className="text-violet-500" />
                        </div>
                        <h3 className="text-[10px] font-black text-violet-700 uppercase tracking-widest flex items-center gap-2 mb-3">
                            <Zap size={12} /> Resumen Generado por Gemini AI
                        </h3>
                        <div className="prose prose-sm prose-violet relative z-10" dangerouslySetInnerHTML={{ __html: summary.replace(/\n/g, '<br/>') }} />
                    </div>
                )}

                {/* Body Content */}
                <div className="p-8">
                    {email.htmlBody ? (
                        <div
                            className="prose prose-slate max-w-none text-[14px] leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: email.htmlBody }}
                        />
                    ) : (
                        <pre className="text-[14px] text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                            {email.textBody || '(Sin contenido)'}
                        </pre>
                    )}

                    {/* Attachments */}
                    {email.attachments?.length > 0 && (
                        <div className="mt-10 pt-6 border-t border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Paperclip size={12} /> Archivos Adjuntos ({email.attachments.length})
                            </p>
                            <div className="flex flex-wrap gap-3">
                                {email.attachments.map((att, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl max-w-xs hover:border-indigo-300 transition-colors cursor-pointer group">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                            <Briefcase size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-slate-700 truncate">{att.filename || 'Archivo Adjunto'}</p>
                                            <p className="text-[10px] text-slate-400 font-bold">{(att.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Message Row ──────────────────────────────────────────────────────────────
const MessageRow = ({ msg, isSelected, onClick }) => {
    const fromName = msg.from?.name || msg.from?.address || 'Desconocido';

    return (
        <button onClick={onClick}
            className={`w-full text-left flex items-start gap-4 px-5 py-4 transition-all border-b group relative overflow-hidden
                ${isSelected ? 'bg-indigo-50/80 border-b-indigo-100' : 'border-b-slate-50 hover:bg-slate-50/80'}
                ${!msg.seen ? 'bg-white' : 'bg-slate-50/30'}`}>
            
            {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />}

            <Avatar name={fromName} email={msg.from?.address} size={10} className={!msg.seen ? 'ring-2 ring-indigo-500 ring-offset-2' : ''} />
            
            <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <p className={`text-[13px] truncate ${!msg.seen ? 'font-black text-slate-900' : 'font-bold text-slate-600'}`}>
                        {fromName}
                    </p>
                    <span className={`text-[10px] flex-shrink-0 ${!msg.seen ? 'font-black text-indigo-600' : 'font-bold text-slate-400'}`}>
                        {new Date(msg.date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                    </span>
                </div>
                <p className={`text-[12px] truncate ${!msg.seen ? 'font-bold text-slate-800' : 'font-medium text-slate-500'}`}>
                    {msg.subject}
                </p>
            </div>
            
            {msg.flagged && <Star size={14} className="text-amber-400 fill-amber-400 flex-shrink-0 mt-2" />}
        </button>
    );
};

// ─── MAIN Webmail Component (Outlook 10.0 Edition) ────────────────────────────
const Webmail = () => {
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [selectedFolder, setSelectedFolder] = useState('INBOX');
    const [folders, setFolders] = useState([]);
    const [messages, setMessages] = useState([]);
    const [selectedMsg, setSelectedMsg] = useState(null);
    const [emailDetail, setEmailDetail] = useState(null);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showCompose, setShowCompose] = useState(false);
    const [replyTarget, setReplyTarget] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [alert, setAlert] = useState(null);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [imapError, setImapError] = useState(null);

    const showAlert = (msg, type = 'success') => {
        setAlert({ msg, type });
        setTimeout(() => setAlert(null), 4000);
    };

    // Load accounts
    useEffect(() => {
        api('/accounts').then(data => {
            setAccounts(data);
            if (data.length > 0) setSelectedAccount(data[0]);
        }).catch(e => console.error("Accounts err", e))
          .finally(() => setLoadingAccounts(false));
    }, []);

    // Load folders when account changes
    useEffect(() => {
        if (!selectedAccount) return;
        api(`/folders/${selectedAccount._id}`).then(data => setFolders(data)).catch(() => {});
    }, [selectedAccount]);

    // Load messages
    const loadMessages = useCallback(async () => {
        if (!selectedAccount) return;
        setLoadingMessages(true);
        setImapError(null);
        try {
            const data = await api(`/messages/${selectedAccount._id}?folder=${encodeURIComponent(selectedFolder)}&page=${page}&limit=30`);
            setMessages(data.messages || []);
            setTotal(data.total || 0);
        } catch (e) {
            setImapError(e.message);
            setMessages([]);
        } finally {
            setLoadingMessages(false);
        }
    }, [selectedAccount, selectedFolder, page]);

    useEffect(() => {
        setSelectedMsg(null);
        setEmailDetail(null);
        loadMessages();
    }, [loadMessages]);

    const openMessage = async (msg) => {
        setSelectedMsg(msg.uid);
        setLoadingDetail(true);
        try {
            const detail = await api(`/message/${selectedAccount._id}/${msg.uid}?folder=${encodeURIComponent(selectedFolder)}`);
            detail.uid = msg.uid; // attach uid for actions
            detail.folder = selectedFolder;
            setEmailDetail(detail);
            // mark as read locally
            setMessages(prev => prev.map(m => m.uid === msg.uid ? { ...m, seen: true } : m));
        } catch (e) {
            showAlert(e.message, 'error');
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleDelete = async (uid) => {
        try {
            await api(`/message/${selectedAccount._id}/${uid}?folder=${encodeURIComponent(selectedFolder)}`, { method: 'DELETE' });
            setMessages(prev => prev.filter(m => m.uid !== uid));
            if(emailDetail?.uid === uid) setEmailDetail(null);
            showAlert('Mensaje eliminado correctamente');
        } catch (e) {
            showAlert(e.message, 'error');
        }
    };

    const deleteAccount = async (accId) => {
        if(!window.confirm("¿Seguro que deseas eliminar esta cuenta de Genai Mail?")) return;
        try {
            await api(`/accounts/${accId}`, { method: 'DELETE' });
            const remaining = accounts.filter(a => a._id !== accId);
            setAccounts(remaining);
            setSelectedAccount(remaining[0] || null);
            setImapError(null);
            showAlert('Cuenta desvinculada');
        } catch (e) {
            showAlert(e.message, 'error');
        }
    };

    const folderIcons = {
        INBOX: <Inbox size={16} />,
        Sent: <Send size={16} />,
        Trash: <Trash2 size={16} />,
        Junk: <AlertCircle size={16} />
    };

    const filteredMessages = messages.filter(m =>
        !searchTerm || m.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.from?.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.from?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const unread = messages.filter(m => !m.seen).length;

    return (
        <div className="h-screen flex flex-col bg-slate-100/50 overflow-hidden font-sans">
            {/* Global Alert */}
            {alert && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[999] px-6 py-3 rounded-full shadow-2xl text-[13px] font-black uppercase tracking-widest flex items-center gap-3 animate-in fade-in slide-in-from-top-4"
                     style={{ backgroundColor: alert.type === 'error' ? '#ef4444' : '#10b981', color: 'white' }}>
                    {alert.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
                    {alert.msg}
                </div>
            )}

            {/* Application Top Bar */}
            <div className="flex items-center gap-4 px-6 py-3 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm flex-shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Sparkles className="text-white" size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            Genai <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-fuchsia-500">MAIL</span>
                            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest">v10.0</span>
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Client Edition Powered by AI
                        </p>
                    </div>
                </div>

                <div className="flex-1" />

                {/* Account Switcher */}
                {accounts.length > 0 && (
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-full pl-3 pr-2 py-1.5 shadow-inner">
                        <AtSign size={14} className="text-slate-400" />
                        <select value={selectedAccount?._id || ''}
                            onChange={e => setSelectedAccount(accounts.find(a => a._id === e.target.value))}
                            className="text-xs font-bold text-slate-700 bg-transparent focus:outline-none cursor-pointer max-w-[200px] truncate">
                            {accounts.map(a => <option key={a._id} value={a._id}>{a.email}</option>)}
                        </select>
                        <button onClick={() => deleteAccount(selectedAccount._id)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-rose-100 text-slate-300 hover:text-rose-500 transition-colors ml-2" title="Desvincular cuenta">
                            <Trash2 size={12} />
                        </button>
                    </div>
                )}

                <div className="w-px h-8 bg-slate-200 mx-2" />

                <button onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all">
                    <Plus size={16} /> <span className="hidden md:inline">Añadir Cuenta</span>
                </button>

                {selectedAccount && (
                    <button onClick={() => { setShowCompose(true); setReplyTarget(null); }}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-md hover:shadow-indigo-500/30">
                        <Edit3 size={16} /> Nuevo
                    </button>
                )}
            </div>

            {/* Zero State */}
            {!loadingAccounts && accounts.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-indigo-50/50 to-white">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
                        <div className="w-32 h-32 bg-white rounded-[2.5rem] flex items-center justify-center shadow-2xl relative z-10 border border-slate-100">
                            <Mail size={56} className="text-indigo-600" />
                        </div>
                    </div>
                    <div className="text-center max-w-md relative z-10">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4">Bienvenido a Genai Mail</h2>
                        <p className="text-slate-500 text-[15px] leading-relaxed font-medium">El cliente de correo más potente e inteligente. Conecta tu buzón corporativo y deja que nuestra IA organice, resuma y redacte por ti.</p>
                    </div>
                    <button onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[13px] uppercase tracking-widest hover:scale-105 transition-all shadow-2xl shadow-slate-900/20 relative z-10">
                        <Command size={18} /> Conectar mi cuenta de trabajo
                    </button>
                    <div className="flex items-center gap-8 text-[11px] font-black text-slate-400 uppercase tracking-widest mt-8">
                        <span className="flex items-center gap-2"><Shield size={16} className="text-emerald-500"/> Encriptación AES-256</span>
                        <span className="flex items-center gap-2"><Globe size={16} className="text-blue-500"/> Soporte Universal</span>
                    </div>
                </div>
            )}

            {/* Main Layout (3 Panes) */}
            {accounts.length > 0 && (
                <div className="flex flex-1 overflow-hidden relative z-10">
                    
                    {/* Pane 1: Folders (Sidebar) */}
                    <div className="w-64 flex-shrink-0 bg-slate-50 border-r border-slate-200/80 flex flex-col pt-4 overflow-y-auto">
                        <div className="px-5 mb-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-2">Carpetas Principales</p>
                            <div className="space-y-1">
                                {['INBOX', 'Sent', 'Trash'].map(f => {
                                    const label = f === 'INBOX' ? 'Bandeja de Entrada' : f === 'Sent' ? 'Enviados' : 'Papelera';
                                    return (
                                        <button key={f}
                                            onClick={() => { setSelectedFolder(f); setPage(1); }}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-[12px] font-bold group
                                                ${selectedFolder === f ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'}`}>
                                            <span className={`${selectedFolder === f ? 'text-white' : 'text-slate-400 group-hover:text-indigo-600'}`}>
                                                {folderIcons[f] || <Mail size={16} />}
                                            </span>
                                            <span className="flex-1 text-left truncate">{label}</span>
                                            {f === 'INBOX' && unread > 0 && (
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${selectedFolder === f ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
                                                    {unread}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="px-5 mt-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-2">Todas las Carpetas</p>
                            <div className="space-y-0.5">
                                {folders.filter(f => !['INBOX', 'Sent', 'Trash', 'Drafts'].includes(f.name)).slice(0, 15).map(f => (
                                    <button key={f.path}
                                        onClick={() => { setSelectedFolder(f.path); setPage(1); }}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-[11px] font-bold
                                            ${selectedFolder === f.path ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-200/50'}`}>
                                        <ChevronDown size={12} className="-rotate-90 text-slate-300" />
                                        <span className="flex-1 text-left truncate">{f.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1" />
                        <div className="p-4 mt-4 border-t border-slate-200/60">
                            <button onClick={loadMessages} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest shadow-sm">
                                <RefreshCw size={14} className={loadingMessages ? 'animate-spin text-indigo-500' : ''} />
                                {loadingMessages ? 'Sincronizando...' : 'Actualizar Buzón'}
                            </button>
                        </div>
                    </div>

                    {/* Pane 2: Message List */}
                    <div className="w-96 flex-shrink-0 flex flex-col border-r border-slate-200/80 bg-white relative z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
                        {/* Search Bar */}
                        <div className="p-4 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
                            <div className="relative group">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                <input type="text" placeholder="Buscar correos..." value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-medium text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 focus:bg-white transition-all placeholder:text-slate-400" />
                            </div>
                        </div>

                        {/* Connection Error Banner */}
                        {imapError && (
                            <div className="m-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                                <AlertCircle size={18} className="text-rose-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-[11px] font-black text-rose-800 uppercase tracking-widest mb-1">Error de Sincronización</p>
                                    <p className="text-[11px] text-rose-600 font-medium leading-relaxed">{imapError}</p>
                                    {selectedAccount?.imapHost?.includes('gmail') && selectedAccount?.authType !== 'oauth2' && (
                                        <div className="mt-3 p-3 bg-white/60 rounded-xl border border-rose-100">
                                            <p className="text-[10px] text-slate-700 font-bold">💡 Gmail requiere <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-indigo-600 underline">Contraseña de Aplicación</a>. No uses tu clave habitual.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* List */}
                        <div className="flex-1 overflow-y-auto bg-slate-50/30">
                            {loadingMessages ? (
                                <div className="flex flex-col items-center justify-center h-40 gap-4">
                                    <Loader2 className="animate-spin text-indigo-500" size={32} />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Descargando...</p>
                                </div>
                            ) : filteredMessages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-4">
                                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                                        <Inbox size={24} className="text-slate-300" />
                                    </div>
                                    <p className="text-xs font-bold uppercase tracking-widest">Buzón Vacío</p>
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    {filteredMessages.map(msg => (
                                        <MessageRow key={msg.uid} msg={msg}
                                            isSelected={selectedMsg === msg.uid}
                                            onClick={() => openMessage(msg)} />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Pagination Footer */}
                        {total > 30 && (
                            <div className="p-3 border-t border-slate-100 bg-white flex items-center justify-between text-[11px] font-black text-slate-500 uppercase tracking-widest shadow-[0_-4px_10px_-5px_rgba(0,0,0,0.05)]">
                                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                                    className="px-4 py-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">Anterior</button>
                                <span className="bg-slate-100 px-3 py-1 rounded-md">Pág {page}</span>
                                <button disabled={messages.length < 30} onClick={() => setPage(p => p + 1)}
                                    className="px-4 py-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">Siguiente</button>
                            </div>
                        )}
                    </div>

                    {/* Pane 3: Email Reader */}
                    <div className="flex-1 bg-slate-50 flex flex-col relative">
                        {loadingDetail ? (
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
                                <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-3xl shadow-2xl border border-slate-100">
                                    <Loader2 className="animate-spin text-indigo-600" size={40} />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Desencriptando Mensaje...</p>
                                </div>
                            </div>
                        ) : emailDetail ? (
                            <EmailDetail
                                accountId={selectedAccount._id}
                                email={emailDetail}
                                onBack={() => { setEmailDetail(null); setSelectedMsg(null); }}
                                onReply={(msg) => { setReplyTarget(msg); setShowCompose(true); }}
                                onDelete={handleDelete}
                            />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center bg-white gap-6">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-fuchsia-500/20 blur-3xl rounded-full" />
                                    <img src="https://cdn-icons-png.flaticon.com/512/3296/3296464.png" alt="Mail Open" className="w-32 h-32 opacity-40 grayscale relative z-10" />
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-black text-slate-800 tracking-tight mb-2">Ningún mensaje seleccionado</p>
                                    <p className="text-xs font-bold text-slate-400">Selecciona un correo en el panel izquierdo para leerlo.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modals */}
            {showAddModal && (
                <AddAccountModal onClose={() => setShowAddModal(false)}
                    onAdded={async (acc) => {
                        try {
                            const data = await api('/accounts');
                            setAccounts(data);
                            const newAcc = data.find(a => a.email === acc.email) || data[data.length - 1] || null;
                            setSelectedAccount(newAcc);
                            showAlert('Cuenta de correo conectada exitosamente');
                        } catch (err) {
                            console.error('Error reloading accounts:', err);
                            showAlert('Cuenta conectada, por favor actualiza la página.', 'error');
                        }
                    }} />
            )}
            {showCompose && selectedAccount && (
                <ComposeModal account={selectedAccount} replyTo={replyTarget}
                    onClose={() => { setShowCompose(false); setReplyTarget(null); }} />
            )}
        </div>
    );
};

export default Webmail;

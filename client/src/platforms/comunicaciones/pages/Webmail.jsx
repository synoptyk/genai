import React, { useState, useEffect, useCallback } from 'react';
import {
    Mail, Send, Inbox, Trash2, Star, RefreshCw, Plus, X,
    ChevronDown, Search, AlertCircle, CheckCircle,
    Reply, ArrowLeft, Eye, EyeOff, Loader2,
    Shield, Lock, Globe, Server, AtSign, Wifi
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
    { name: 'Gmail', domain: 'gmail.com', imapHost: 'imap.gmail.com', imapPort: 993, smtpHost: 'smtp.gmail.com', smtpPort: 587, smtpSecure: false, note: 'Requiere contraseña de aplicación (2FA)' },
    { name: 'Outlook / Hotmail', domain: 'outlook.com', imapHost: 'outlook.office365.com', imapPort: 993, smtpHost: 'smtp.office365.com', smtpPort: 587, smtpSecure: false },
    { name: 'Yahoo', domain: 'yahoo.com', imapHost: 'imap.mail.yahoo.com', imapPort: 993, smtpHost: 'smtp.mail.yahoo.com', smtpPort: 465, smtpSecure: true },
    { name: 'Zoho Mail', domain: 'zoho.com', imapHost: 'imap.zoho.com', imapPort: 993, smtpHost: 'smtp.zoho.com', smtpPort: 465, smtpSecure: true },
    { name: 'Otro / Servidor propio', domain: null, imapHost: '', imapPort: 993, smtpHost: '', smtpPort: 465, smtpSecure: true },
];

// ─── Avatar ──────────────────────────────────────────────────────────────────
const Avatar = ({ name, email, size = 8 }) => {
    const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
        : (email || '?')[0].toUpperCase();
    const colors = ['from-violet-500 to-indigo-600', 'from-sky-500 to-blue-600', 'from-emerald-500 to-teal-600',
        'from-rose-500 to-pink-600', 'from-amber-500 to-orange-600'];
    const idx = (name || email || '').charCodeAt(0) % colors.length;
    return (
        <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br ${colors[idx]} flex items-center justify-center text-white font-black text-xs flex-shrink-0`}>
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
        setForm(f => ({
            ...f, imapHost: p.imapHost, imapPort: p.imapPort, imapSecure: true,
            smtpHost: p.smtpHost, smtpPort: p.smtpPort, smtpSecure: p.smtpSecure !== false,
        }));
        setStep(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const account = await api('/accounts', { method: 'POST', body: JSON.stringify(form) });
            if (account.connectionWarning) {
                // Saved but connection test failed — warn user (e.g. Gmail App Password needed)
                onAdded(account);
                onClose();
            } else {
                onAdded(account);
                onClose();
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const inp = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-all placeholder:text-slate-400';

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                                <Mail size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black uppercase tracking-widest">Agregar Cuenta</h2>
                                <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest">
                                    {step === 1 ? 'Selecciona tu proveedor' : 'Configuración de acceso'}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    {step === 1 && (
                        <div className="grid grid-cols-1 gap-3">
                            {PROVIDERS.map(p => (
                                <button key={p.name} onClick={() => selectProvider(p)}
                                    className="flex items-center gap-4 p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl transition-all text-left group">
                                    <div className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center shadow-sm">
                                        <Globe size={18} className="text-indigo-500" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-black text-slate-800 group-hover:text-indigo-700">{p.name}</p>
                                        {p.note && <p className="text-[10px] text-amber-600 font-bold mt-0.5">{p.note}</p>}
                                    </div>
                                    <ChevronDown size={16} className="text-slate-400 -rotate-90 group-hover:text-indigo-500" />
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleSubmit} className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Correo</label>
                                    <input type="email" required placeholder="tu@empresa.com" value={form.email}
                                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inp} />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Nombre a mostrar</label>
                                    <input type="text" placeholder="Juan Pérez" value={form.displayName}
                                        onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} className={inp} />
                                </div>
                            </div>

                            <div className="border-t border-slate-100 pt-4">
                                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Server size={12} /> Servidor IMAP (Recepción)
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

                            <div className="border-t border-slate-100 pt-4">
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Send size={12} /> Servidor SMTP (Envío)
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

                            <div className="border-t border-slate-100 pt-4">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Lock size={12} /> Credenciales
                                </p>
                                <div className="space-y-2">
                                    <input type="text" placeholder="Usuario (dejar vacío = usar correo)" value={form.imapUser}
                                        autoComplete="username"
                                        onChange={e => setForm(f => ({ ...f, imapUser: e.target.value, smtpUser: e.target.value }))} className={inp} />
                                    <div className="relative">
                                        <input
                                            type={showPass ? 'text' : 'password'}
                                            required
                                            placeholder="Contraseña"
                                            value={form.imapPassword}
                                            autoComplete={showPass ? 'off' : 'current-password'}
                                            onChange={e => setForm(f => ({ ...f, imapPassword: e.target.value, smtpPassword: e.target.value }))}
                                            className={inp}
                                        />
                                        <button type="button" onClick={() => setShowPass(p => !p)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-xs font-bold">
                                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setStep(1)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                                    Atrás
                                </button>
                                <button type="submit" disabled={loading}
                                    className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                    {loading ? 'Conectando...' : 'Conectar Cuenta'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Compose Modal ────────────────────────────────────────────────────────────
const ComposeModal = ({ account, onClose, replyTo = null }) => {
    const [form, setForm] = useState({
        to: replyTo?.from?.address || '',
        cc: '',
        subject: replyTo ? `Re: ${replyTo.subject}` : '',
        html: replyTo ? `<br/><br/>---<br/><b>De:</b> ${replyTo.from?.address}<br/><b>Asunto:</b> ${replyTo.subject}<br/>` : '',
    });
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

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

    const inp = 'w-full px-4 py-2.5 bg-transparent border-b border-slate-100 text-sm text-slate-800 focus:outline-none focus:border-indigo-300 transition-colors placeholder:text-slate-400';

    return (
        <div className="fixed inset-0 z-[998] flex items-end justify-end p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-lg bg-white rounded-[2rem] shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
                style={{ maxHeight: '85vh' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
                    <span className="text-sm font-black uppercase tracking-widest">
                        {replyTo ? 'Responder' : 'Nuevo Correo'}
                    </span>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-xl transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Fields */}
                <div className="flex flex-col">
                    <input type="email" placeholder="Para..." value={form.to}
                        onChange={e => setForm(f => ({ ...f, to: e.target.value }))} className={inp} />
                    <input type="text" placeholder="CC..." value={form.cc}
                        onChange={e => setForm(f => ({ ...f, cc: e.target.value }))} className={inp} />
                    <input type="text" placeholder="Asunto..." value={form.subject}
                        onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className={inp} />
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden">
                    <textarea
                        className="w-full h-full min-h-[200px] px-5 py-4 text-sm text-slate-700 focus:outline-none resize-none placeholder:text-slate-400"
                        placeholder="Escribe tu mensaje aquí..."
                        value={form.html}
                        onChange={e => setForm(f => ({ ...f, html: e.target.value }))}
                    />
                </div>

                {/* Error */}
                {error && <p className="px-5 py-2 text-xs text-rose-600 font-bold bg-rose-50">{error}</p>}

                {/* Send */}
                <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-[10px] text-slate-400 font-bold">Desde: {account.email}</p>
                    <button onClick={handleSend} disabled={sending || sent}
                        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-60 shadow-lg shadow-indigo-200">
                        {sent ? <CheckCircle size={16} /> : sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        {sent ? '¡Enviado!' : sending ? 'Enviando...' : 'Enviar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Email Detail View ────────────────────────────────────────────────────────
const EmailDetail = ({ email, onBack, onReply }) => {
    const fromName = email.from?.name || email.from?.address || 'Desconocido';

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-100 bg-white">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                    <ArrowLeft size={18} />
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-black text-slate-900 truncate">{email.subject}</h2>
                    <p className="text-[10px] text-slate-400 font-bold">
                        {new Date(email.date).toLocaleString('es-CL')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => onReply(email)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                        <Reply size={14} /> Responder
                    </button>
                </div>
            </div>

            <div className="px-6 py-5 border-b border-slate-100 flex items-start gap-4 bg-slate-50/50">
                <Avatar name={fromName} email={email.from?.address} size={10} />
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <p className="text-sm font-black text-slate-900">{fromName}</p>
                        <span className="text-[10px] text-slate-400 font-bold">&lt;{email.from?.address}&gt;</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 font-bold">
                        Para: {email.to?.map(t => t.address).join(', ')}
                    </p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {email.htmlBody ? (
                    <div
                        className="prose prose-sm max-w-none text-slate-700"
                        dangerouslySetInnerHTML={{ __html: email.htmlBody }}
                    />
                ) : (
                    <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">
                        {email.textBody || '(Sin contenido)'}
                    </pre>
                )}
            </div>
        </div>
    );
};

// ─── Message Row ──────────────────────────────────────────────────────────────
const MessageRow = ({ msg, isSelected, onClick }) => {
    const fromName = msg.from?.name || msg.from?.address || 'Desconocido';

    return (
        <button onClick={onClick}
            className={`w-full text-left flex items-start gap-4 px-5 py-4 hover:bg-indigo-50/60 transition-all border-b border-slate-50 group
                ${isSelected ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''}
                ${!msg.seen ? 'bg-white' : 'bg-slate-50/50'}`}>
            <Avatar name={fromName} email={msg.from?.address} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs truncate ${!msg.seen ? 'font-black text-slate-900' : 'font-bold text-slate-600'}`}>
                        {fromName}
                    </p>
                    <span className="text-[9px] text-slate-400 font-bold flex-shrink-0">
                        {new Date(msg.date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                    </span>
                </div>
                <p className={`text-[11px] truncate mt-0.5 ${!msg.seen ? 'font-black text-slate-800' : 'font-bold text-slate-500'}`}>
                    {msg.subject}
                </p>
            </div>
            {msg.flagged && <Star size={14} className="text-amber-400 fill-amber-400 flex-shrink-0 mt-1" />}
        </button>
    );
};

// ─── MAIN Webmail Component ───────────────────────────────────────────────────
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
    const [imapError, setImapError] = useState(null); // error de conexión IMAP para cuenta activa

    const showAlert = (msg, type = 'success') => {
        setAlert({ msg, type });
        setTimeout(() => setAlert(null), 3500);
    };

    // Load accounts
    useEffect(() => {
        api('/accounts').then(data => {
            setAccounts(data);
            if (data.length > 0) setSelectedAccount(data[0]);
        }).catch(e => showAlert(e.message, 'error'))
          .finally(() => setLoadingAccounts(false));
    }, []);

    // Load folders when account changes
    useEffect(() => {
        if (!selectedAccount) return;
        api(`/folders/${selectedAccount._id}`).then(data => {
            setFolders(data);
        }).catch(() => {});
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
        setSelectedMsg(msg._id || msg.uid);
        setLoadingDetail(true);
        try {
            const detail = await api(`/message/${selectedAccount._id}/${msg.uid}?folder=${encodeURIComponent(selectedFolder)}`);
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
            setEmailDetail(null);
            showAlert('Mensaje eliminado');
        } catch (e) {
            showAlert(e.message, 'error');
        }
    };

    const deleteAccount = async (accId) => {
        try {
            await api(`/accounts/${accId}`, { method: 'DELETE' });
            const remaining = accounts.filter(a => a._id !== accId);
            setAccounts(remaining);
            setSelectedAccount(remaining[0] || null);
            setImapError(null);
            showAlert('Cuenta eliminada');
        } catch (e) {
            showAlert(e.message, 'error');
        }
    };

    const toggleStar = async (msg) => {
        const newVal = !msg.flagged;
        try {
            await api(`/message/${selectedAccount._id}/${msg.uid}/flag`, {
                method: 'PATCH',
                body: JSON.stringify({ folder: selectedFolder, flag: '\\Flagged', value: newVal })
            });
            setMessages(prev => prev.map(m => m.uid === msg.uid ? { ...m, flagged: newVal } : m));
        } catch (e) { }
    };

    const folderIcons = {
        INBOX: <Inbox size={14} />,
        Sent: <Send size={14} />,
        Trash: <Trash2 size={14} />,
        Starred: <Star size={14} />,
    };

    const filteredMessages = messages.filter(m =>
        !searchTerm || m.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.from?.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.from?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const unread = messages.filter(m => !m.seen).length;

    return (
        <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
            {/* Alert */}
            {alert && (
                <div className={`fixed top-4 right-4 z-[999] px-5 py-3 rounded-2xl shadow-xl text-sm font-bold flex items-center gap-2 ${alert.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
                    {alert.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
                    {alert.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-4 px-6 py-4 bg-white border-b border-slate-100 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                        <Mail className="text-white" size={20} />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                            Genai <span className="text-indigo-600">MAIL</span>
                        </h1>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            Correo Corporativo Integrado
                        </p>
                    </div>
                </div>

                <div className="flex-1" />

                {/* Account selector */}
                {accounts.length > 0 && (
                    <div className="flex items-center gap-2">
                        <AtSign size={14} className="text-slate-400" />
                        <select value={selectedAccount?._id || ''}
                            onChange={e => setSelectedAccount(accounts.find(a => a._id === e.target.value))}
                            className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                            {accounts.map(a => <option key={a._id} value={a._id}>{a.displayName || a.email}</option>)}
                        </select>
                    </div>
                )}

                <button onClick={() => { setShowAddModal(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-indigo-100">
                    <Plus size={14} /> Agregar Cuenta
                </button>

                {selectedAccount && (
                    <button onClick={() => { setShowCompose(true); setReplyTarget(null); }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-indigo-200">
                        <Plus size={14} /> Redactar
                    </button>
                )}
            </div>

            {/* No accounts state */}
            {!loadingAccounts && accounts.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center gap-6">
                    <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-[2rem] flex items-center justify-center">
                        <Mail size={48} className="text-indigo-400" />
                    </div>
                    <div className="text-center">
                        <h2 className="text-2xl font-black text-slate-900 mb-2">Conecta tu correo corporativo</h2>
                        <p className="text-slate-500 text-sm max-w-sm">Agrega tu cuenta de correo IMAP/SMTP y gestiona todo desde aquí sin salir de la plataforma.</p>
                    </div>
                    <button onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:opacity-90 transition-all shadow-2xl shadow-indigo-200">
                        <Plus size={20} /> Agregar Primera Cuenta
                    </button>
                    <div className="flex items-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <span className="flex items-center gap-1"><Shield size={12} /> Seguro</span>
                        <span className="flex items-center gap-1"><Lock size={12} /> Cifrado</span>
                        <span className="flex items-center gap-1"><Wifi size={12} /> IMAP / SMTP</span>
                    </div>
                </div>
            )}

            {/* Main layout */}
            {accounts.length > 0 && (
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar: Folders */}
                    <div className="w-48 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col py-3 overflow-y-auto">
                        {/* Core folders */}
                        {['INBOX', 'Sent', 'Trash', 'Junk'].map(f => {
                            const label = f === 'INBOX' ? 'Bandeja' : f === 'Sent' ? 'Enviados' : f === 'Trash' ? 'Papelera' : 'Spam';
                            return (
                                <button key={f}
                                    onClick={() => { setSelectedFolder(f); setPage(1); }}
                                    className={`flex items-center gap-3 px-4 py-2.5 text-left transition-all text-[11px] font-bold
                                        ${selectedFolder === f ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-500' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                                    {folderIcons[f] || <Mail size={14} />}
                                    <span className="flex-1">{label}</span>
                                    {f === 'INBOX' && unread > 0 && (
                                        <span className="bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{unread}</span>
                                    )}
                                </button>
                            );
                        })}

                        {/* Extra folders from server */}
                        {folders.filter(f => !['INBOX', 'Sent', 'Trash', 'Junk', 'Drafts'].includes(f.name)).slice(0, 10).map(f => (
                            <button key={f.path}
                                onClick={() => { setSelectedFolder(f.path); setPage(1); }}
                                className={`flex items-center gap-3 px-4 py-2.5 text-left transition-all text-[11px] font-bold
                                    ${selectedFolder === f.path ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-500' : 'text-slate-500 hover:bg-slate-50'}`}>
                                <Mail size={13} />
                                <span className="flex-1 truncate">{f.name}</span>
                            </button>
                        ))}

                        <div className="flex-1" />
                        <button onClick={loadMessages} className="flex items-center gap-2 mx-3 mb-2 px-3 py-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest">
                            <RefreshCw size={13} className={loadingMessages ? 'animate-spin' : ''} /> Actualizar
                        </button>
                    </div>

                    {/* Message list */}
                    <div className="w-80 flex-shrink-0 flex flex-col border-r border-slate-100 bg-white overflow-hidden">
                        {/* Search */}
                        <div className="p-3 border-b border-slate-100">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="text" placeholder="Buscar..." value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-slate-400" />
                            </div>
                        </div>

                        {/* IMAP Error inline banner */}
                        {imapError && (
                            <div className="mx-3 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-2xl">
                                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Error de Conexión IMAP</p>
                                <p className="text-[10px] text-amber-600 font-bold mb-2">{imapError}</p>
                                {selectedAccount?.imapHost?.includes('gmail') && (
                                    <p className="text-[9px] text-amber-500 font-bold">
                                        ⚠️ Gmail requiere <b>Contraseña de Aplicación</b>. Ve a myaccount.google.com → Seguridad → Verificación en 2 pasos → Contraseñas de aplicación.
                                    </p>
                                )}
                                <button onClick={() => deleteAccount(selectedAccount._id)}
                                    className="mt-2 text-[9px] font-black text-rose-600 hover:text-rose-700 uppercase tracking-widest">
                                    Eliminar esta cuenta
                                </button>
                            </div>
                        )}

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto">
                            {loadingMessages ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="animate-spin text-indigo-500" size={32} />
                                </div>
                            ) : filteredMessages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                    <Inbox size={40} className="mb-3 opacity-40" />
                                    <p className="text-xs font-bold">Sin mensajes</p>
                                </div>
                            ) : (
                                filteredMessages.map(msg => (
                                    <MessageRow key={msg.uid} msg={msg}
                                        isSelected={selectedMsg === msg.uid}
                                        onClick={() => openMessage(msg)} />
                                ))
                            )}
                        </div>

                        {/* Pagination */}
                        {total > 30 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                                    className="disabled:opacity-30 hover:text-indigo-600">Anterior</button>
                                <span>Pág {page}</span>
                                <button disabled={messages.length < 30} onClick={() => setPage(p => p + 1)}
                                    className="disabled:opacity-30 hover:text-indigo-600">Siguiente</button>
                            </div>
                        )}
                    </div>

                    {/* Email content */}
                    <div className="flex-1 bg-white overflow-hidden">
                        {loadingDetail ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="animate-spin text-indigo-500" size={40} />
                            </div>
                        ) : emailDetail ? (
                            <EmailDetail
                                email={emailDetail}
                                onBack={() => { setEmailDetail(null); setSelectedMsg(null); }}
                                onReply={(msg) => { setReplyTarget(msg); setShowCompose(true); }}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                                <div className="w-16 h-16 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center">
                                    <Mail size={32} className="text-indigo-300" />
                                </div>
                                <p className="text-sm font-bold">Selecciona un correo para leerlo</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modals */}
            {showAddModal && (
                <AddAccountModal onClose={() => setShowAddModal(false)}
                    onAdded={(acc) => { setAccounts(p => [...p, acc]); setSelectedAccount(acc); showAlert('Cuenta conectada exitosamente'); }} />
            )}
            {showCompose && selectedAccount && (
                <ComposeModal account={selectedAccount} replyTo={replyTarget}
                    onClose={() => { setShowCompose(false); setReplyTarget(null); }} />
            )}
        </div>
    );
};

export default Webmail;

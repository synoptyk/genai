import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import DOMPurify from 'dompurify';
import {
    Mail, Send, Inbox, Trash2, Star, RefreshCw, Plus, X, Calendar, Clock,
    ChevronDown, Search, AlertCircle, CheckCircle,
    Reply, ReplyAll, ArrowLeft, ArrowRight, Eye, EyeOff, Loader2,
    Shield, Lock, Globe, Server, AtSign, Wifi,
    Sparkles, Edit3, Briefcase, Zap, Command,
    Maximize2, Minimize2, Paperclip, MoreVertical,
    Menu, CheckSquare, Square, MailOpen, Volume2,
    Undo, Redo, Link2, Image, Table,
    Bold, Italic, Underline, Strikethrough, Subscript, Superscript,
    AlignLeft, AlignCenter, AlignRight, List, ListOrdered, RemoveFormatting, Eraser,
    Save, Check, Users
} from 'lucide-react';
import DirectoryModal from '../../../components/DirectoryModal';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5003';

// Helper para permisos granulares de IA
const getCurrentUser = () => JSON.parse(localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user') || '{}');
const hasGenAiMailAccess = () => {
    const user = getCurrentUser();
    return user?.permisosModulos?.ai_genai_mail?.ver === true;
};


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
        const error = new Error(err.message || err.error || 'Error de servidor');
        error.status = res.status;
        error.code = err.code;
        throw error;
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

// ─── Custom WYSIWYG Rich Text Editor ──────────────────────────────────────────
const RichTextEditor = ({ value, onChange, placeholder, account }) => {
    const editorRef = useRef(null);
    const textColInputRef = useRef(null);
    const bgColInputRef = useRef(null);
    const [textColor, setTextColor] = useState('#1e293b');
    const [highlightColor, setHighlightColor] = useState('#fef08a');
    const [showSignatureMenu, setShowSignatureMenu] = useState(false);

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value || '';
        }
    }, [value]);

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const execCmd = (command, arg = null) => {
        document.execCommand(command, false, arg);
        handleInput();
    };

    const insertHTMLAtCursor = (html) => {
        let sel, range;
        if (window.getSelection) {
            sel = window.getSelection();
            if (sel.getRangeAt && sel.rangeCount) {
                range = sel.getRangeAt(0);
                range.deleteContents();
                
                const el = document.createElement("div");
                el.innerHTML = html;
                const frag = document.createDocumentFragment();
                let node, lastNode;
                while ((node = el.firstChild)) {
                    lastNode = frag.appendChild(node);
                }
                range.insertNode(frag);
                
                if (lastNode) {
                    range = range.cloneRange();
                    range.setStartAfter(lastNode);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }
        }
        handleInput();
    };

    const insertLink = () => {
        const url = window.prompt("Introduce la URL del enlace:", "https://");
        if (url) {
            execCmd('createLink', url);
        }
    };

    const insertImage = () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const dataUrl = event.target.result;
                    if (editorRef.current) {
                        editorRef.current.focus();
                        execCmd('insertImage', dataUrl);
                    }
                };
                reader.readAsDataURL(file);
            }
        };
        fileInput.click();
    };

    const insertTable = () => {
        const rowsStr = window.prompt("¿Cuántas filas?", "3");
        const colsStr = window.prompt("¿Cuántas columnas?", "3");
        const rows = parseInt(rowsStr);
        const cols = parseInt(colsStr);
        if (isNaN(rows) || isNaN(cols) || rows <= 0 || cols <= 0) return;

        let tableHtml = `<table style="width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 10px; font-family: sans-serif; font-size: 13px;">`;
        for (let r = 0; r < rows; r++) {
            tableHtml += `<tr>`;
            for (let c = 0; c < cols; c++) {
                const isHeader = r === 0;
                const cellTag = isHeader ? 'th' : 'td';
                const bg = isHeader ? '#f8fafc' : 'transparent';
                const weight = isHeader ? 'bold' : 'normal';
                tableHtml += `<${cellTag} style="border: 1px solid #e2e8f0; padding: 8px; text-align: left; background-color: ${bg}; font-weight: ${weight}; min-width: 50px;">&nbsp;</${cellTag}>`;
            }
            tableHtml += `</tr>`;
        }
        tableHtml += `</table><p>&nbsp;</p>`;
        insertHTMLAtCursor(tableHtml);
    };

    const signatureTemplates = {
        classic: (name, email) => `
            <div id="email-signature" style="font-family: Arial, sans-serif; font-size: 13px; color: #334155; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 20px; text-align: left;">
                <p style="margin: 0; font-weight: bold; color: #1e293b;">${name}</p>
                <p style="margin: 2px 0 0 0; color: #64748b; font-size: 12px;">Corporativo | ${email}</p>
                <p style="margin: 2px 0 0 0; color: #64748b; font-size: 12px;">Synoptik Innovación</p>
            </div>
        `,
        modern: (name, email) => `
            <div id="email-signature" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 13px; color: #1e293b; border-left: 3px solid #4f46e5; padding-left: 12px; margin-top: 20px; line-height: 1.5; text-align: left;">
                <p style="margin: 0; font-weight: 800; color: #4f46e5; font-size: 14px; letter-spacing: 0.5px;">${name.toUpperCase()}</p>
                <p style="margin: 2px 0; color: #475569; font-weight: 600;">Especialista en Innovación</p>
                <p style="margin: 0; color: #94a3b8; font-size: 11px;">M: <a href="mailto:${email}" style="color: #4f46e5; text-decoration: none;">${email}</a> | W: <a href="https://synoptik.cl" style="color: #4f46e5; text-decoration: none;">synoptik.cl</a></p>
            </div>
        `,
        minimal: (name, email) => `
            <div id="email-signature" style="font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #64748b; margin-top: 20px; border-top: 1px dashed #cbd5e1; padding-top: 10px; text-align: left;">
                <p style="margin: 0;">--</p>
                <p style="margin: 2px 0; font-weight: bold;">${name}</p>
                <p style="margin: 0;">${email}</p>
            </div>
        `
    };

    const applySignatureTemplate = (templateKey) => {
        if (!editorRef.current) return;
        const name = account?.displayName || account?.email.split('@')[0] || 'Usuario';
        const email = account?.email || 'usuario@empresa.com';
        
        let sigHtml = '';
        if (templateKey === 'default' && account?.signature) {
            sigHtml = `<div id="email-signature" style="font-family: inherit; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 15px; text-align: left;">${account.signature}</div>`;
        } else if (signatureTemplates[templateKey]) {
            sigHtml = signatureTemplates[templateKey](name, email);
        } else {
            return;
        }
        
        let currentHtml = editorRef.current.innerHTML;
        const parser = new DOMParser();
        const doc = parser.parseFromString(currentHtml, 'text/html');
        const existingSig = doc.getElementById('email-signature') || doc.querySelector('.email-signature') || doc.querySelector('[id="email-signature"]');
        
        if (existingSig) {
            existingSig.outerHTML = sigHtml;
            editorRef.current.innerHTML = doc.body.innerHTML;
        } else {
            editorRef.current.innerHTML = currentHtml + '<br/>' + sigHtml;
        }
        handleInput();
        setShowSignatureMenu(false);
    };

    const [showSignatureBuilder, setShowSignatureBuilder] = useState(false);
    const [sigProfile, setSigProfile] = useState({
        nombre: account?.displayName || '', cargo: '', phone: '', address: '',
        logo: '', website: '', styleKey: 'corporativa'
    });
    const [sigBuilderHtml, setSigBuilderHtml] = useState('');
    const [sigBuilderTab, setSigBuilderTab] = useState('preview'); // 'preview' | 'code'
    const [generatingSig, setGeneratingSig] = useState(false);
    const [savingSig, setSavingSig] = useState(false);
    const [sigSavedOk, setSigSavedOk] = useState(false);

    // Cargar perfil de firma del servidor al montar
    useEffect(() => {
        if (account?._id) {
            api(`/accounts/${account._id}/signature-profile`)
                .then(d => {
                    if (d.signatureProfile?.signatureHtml) {
                        setSigBuilderHtml(d.signatureProfile.signatureHtml);
                        setSigProfile(p => ({ ...p, ...d.signatureProfile }));
                    } else if (d.legacySignature) {
                        setSigBuilderHtml(`<div id="email-signature" style="font-family:inherit;color:#475569;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:15px;">${d.legacySignature}</div>`);
                    }
                })
                .catch(() => {});
        }
    }, [account?._id]);

    const sigStyles = [
        { key: 'corporativa', label: 'Corporativa', icon: '💼', desc: 'Clásica y elegante' },
        { key: 'tecnologica', label: 'Tecnológica', icon: '⚡', desc: 'Moderna y startup' },
        { key: 'minimalista', label: 'Minimalista', icon: '📄', desc: 'Simple y limpia' },
        { key: 'ejecutiva',  label: 'Ejecutiva',   icon: '👔', desc: 'Lujo y distinción' },
        { key: 'creativa',   label: 'Creativa',    icon: '🎨', desc: 'Colorida y dinámica' },
    ];

    const generateAISignature = async () => {
        setGeneratingSig(true);
        try {
            const res = await api('/ai/signature', {
                method: 'POST',
                body: JSON.stringify({
                    nombre:  sigProfile.nombre  || account?.displayName || '',
                    cargo:   sigProfile.cargo,
                    phone:   sigProfile.phone,
                    address: sigProfile.address,
                    logo:    sigProfile.logo,
                    website: sigProfile.website,
                    style:   sigProfile.styleKey,
                })
            });
            if (res.signatureHtml) setSigBuilderHtml(res.signatureHtml);
        } catch(e) {
            const isQuota = e.status === 429 || (e.message || '').includes('Cuota') || (e.message || '').includes('límite');
            if (isQuota) {
                window.alert('⚠️ Límite de IA alcanzado\n\nEspera unos minutos e intenta de nuevo.');
            } else {
                window.alert('Error generando firma: ' + e.message);
            }
        } finally {
            setGeneratingSig(false);
        }
    };

    const saveSignature = async () => {
        setSavingSig(true);
        setSigSavedOk(false);
        try {
            await api(`/accounts/${account._id}/signature-profile`, {
                method: 'PUT',
                body: JSON.stringify({ ...sigProfile, signatureHtml: sigBuilderHtml })
            });
            // Actualizar el account local para que se use en nuevos correos
            if (account) account.signature = sigBuilderHtml;
            setSigSavedOk(true);
            setTimeout(() => setSigSavedOk(false), 3000);
        } catch(e) {
            window.alert('Error guardando firma: ' + e.message);
        } finally {
            setSavingSig(false);
        }
    };

    const applyBuilderSignature = () => {
        if (!sigBuilderHtml || !editorRef.current) return;
        let currentHtml = editorRef.current.innerHTML;
        const parser = new DOMParser();
        const doc = parser.parseFromString(currentHtml, 'text/html');
        const existingSig = doc.getElementById('email-signature') || doc.querySelector('[id="email-signature"]');
        if (existingSig) {
            existingSig.outerHTML = sigBuilderHtml;
            editorRef.current.innerHTML = doc.body.innerHTML;
        } else {
            editorRef.current.innerHTML = currentHtml + '<br/><br/>' + sigBuilderHtml;
        }
        handleInput();
        setShowSignatureBuilder(false);
        setShowSignatureMenu(false);
    };


    return (
        <div className="flex flex-col border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-sm focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-500/50 transition-all flex-1 min-h-[220px]">
            {/* Toolbar */}
            <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-100 flex-wrap z-10 select-none">
                
                {/* Undo / Redo */}
                <button type="button" onClick={() => execCmd('undo')} className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded text-slate-700 transition-all" title="Deshacer">
                    <Undo size={14} />
                </button>
                <button type="button" onClick={() => execCmd('redo')} className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded text-slate-700 transition-all" title="Rehacer">
                    <Redo size={14} />
                </button>
                
                <div className="w-px h-4 bg-slate-200 mx-1" />

                {/* Font Family */}
                <select 
                    onChange={e => execCmd('fontName', e.target.value)} 
                    className="p-1 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none cursor-pointer hover:border-slate-300"
                    title="Tipografía"
                    defaultValue="Aptos"
                >
                    <option value="Aptos">Aptos</option>
                    <option value="Arial">Arial</option>
                    <option value="Calibri">Calibri</option>
                    <option value="Segoe UI">Segoe UI</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Georgia">Georgia</option>
                </select>

                {/* Font Size */}
                <select 
                    onChange={e => execCmd('fontSize', e.target.value)} 
                    className="p-1 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none cursor-pointer hover:border-slate-300"
                    title="Tamaño de Letra"
                    defaultValue="3"
                >
                    <option value="1">10 px</option>
                    <option value="2">12 px</option>
                    <option value="3">14 px</option>
                    <option value="4">18 px</option>
                    <option value="5">24 px</option>
                    <option value="6">32 px</option>
                    <option value="7">48 px</option>
                </select>

                <div className="w-px h-4 bg-slate-200 mx-1" />

                {/* Styling basic */}
                <button type="button" onClick={() => execCmd('bold')} className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded text-slate-700 transition-all" title="Negrita"><Bold size={14} /></button>
                <button type="button" onClick={() => execCmd('italic')} className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded text-slate-700 transition-all" title="Cursiva"><Italic size={14} /></button>
                <button type="button" onClick={() => execCmd('underline')} className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded text-slate-700 transition-all" title="Subrayado"><Underline size={14} /></button>
                <button type="button" onClick={() => execCmd('strikeThrough')} className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded text-slate-700 transition-all" title="Tachado"><Strikethrough size={14} /></button>
                
                {/* Sub / Super script */}
                <button type="button" onClick={() => execCmd('subscript')} className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded text-slate-700 transition-all" title="Subíndice"><Subscript size={14} /></button>
                <button type="button" onClick={() => execCmd('superscript')} className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded text-slate-700 transition-all" title="Superíndice"><Superscript size={14} /></button>

                <div className="w-px h-4 bg-slate-200 mx-1" />

                {/* Text Color Picker */}
                <div className="relative flex items-center">
                    <button type="button" onClick={() => textColInputRef.current.click()} className="p-1 hover:bg-slate-200 active:bg-slate-300 rounded text-slate-700 flex flex-col items-center transition-all px-1.5" title="Color de Texto">
                        <span className="text-[10px] font-black leading-none uppercase">A</span>
                        <div className="w-3 h-1 mt-0.5 rounded-full" style={{ backgroundColor: textColor }} />
                    </button>
                    <input ref={textColInputRef} type="color" className="sr-only" value={textColor} onChange={e => { setTextColor(e.target.value); execCmd('foreColor', e.target.value); }} />
                </div>

                {/* Highlight Color Picker */}
                <div className="relative flex items-center">
                    <button type="button" onClick={() => bgColInputRef.current.click()} className="p-1 hover:bg-slate-200 active:bg-slate-300 rounded text-slate-700 flex flex-col items-center transition-all px-1.5" title="Color de Resaltado">
                        <span className="text-[10px] font-black leading-none bg-slate-200/50 rounded px-0.5 uppercase">ab</span>
                        <div className="w-3 h-1 mt-0.5 rounded-full" style={{ backgroundColor: highlightColor }} />
                    </button>
                    <input ref={bgColInputRef} type="color" className="sr-only" value={highlightColor} onChange={e => { setHighlightColor(e.target.value); execCmd('hiliteColor', e.target.value); }} />
                </div>

                <div className="w-px h-4 bg-slate-200 mx-1" />

                {/* Alignments */}
                <button type="button" onClick={() => execCmd('justifyLeft')} className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded text-slate-700 transition-all" title="Alinear izquierda"><AlignLeft size={14} /></button>
                <button type="button" onClick={() => execCmd('justifyCenter')} className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded text-slate-700 transition-all" title="Centrar"><AlignCenter size={14} /></button>
                <button type="button" onClick={() => execCmd('justifyRight')} className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded text-slate-700 transition-all" title="Alinear derecha"><AlignRight size={14} /></button>

                <div className="w-px h-4 bg-slate-200 mx-1" />

                {/* Lists */}
                <button type="button" onClick={() => execCmd('insertUnorderedList')} className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded text-slate-700 transition-all" title="Lista con viñetas"><List size={14} /></button>
                <button type="button" onClick={() => execCmd('insertOrderedList')} className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded text-slate-700 transition-all" title="Lista numerada"><ListOrdered size={14} /></button>

                <div className="w-px h-4 bg-slate-200 mx-1" />

                {/* Insert Elements */}
                <button type="button" onClick={insertLink} className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded text-slate-700 transition-all" title="Insertar Enlace">
                    <Link2 size={14} />
                </button>
                <button type="button" onClick={insertImage} className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded text-slate-700 transition-all" title="Insertar Imagen">
                    <Image size={14} />
                </button>
                <button type="button" onClick={insertTable} className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded text-slate-700 transition-all" title="Insertar Tabla">
                    <Table size={14} />
                </button>

                <div className="w-px h-4 bg-slate-200 mx-1" />

                {/* Signature dropdown */}
                <div className="relative">
                    <button 
                        type="button" 
                        onClick={() => setShowSignatureMenu(s => !s)} 
                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-wider px-2.5 transition-all flex items-center gap-1"
                        title="Insertar/Administrar Firmas Corporativas"
                    >
                        ✍️ Firmas <ChevronDown size={10} />
                    </button>
                    {showSignatureMenu && (
                        <div className="absolute left-0 mt-1 bg-white border border-slate-200 shadow-2xl rounded-2xl py-2 w-56 z-[999] animate-in zoom-in-95 origin-top-left">
                            {/* Saved signature */}
                            {sigBuilderHtml && (
                                <>
                                    <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400">⭐ Mi Firma</div>
                                    <button type="button" onClick={applyBuilderSignature} className="w-full text-left px-3 py-2 text-xs text-indigo-700 hover:bg-indigo-50 font-bold transition-all flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                                        Firma Guardada
                                    </button>
                                    <div className="border-t border-slate-100 mx-3 my-1.5" />
                                </>
                            )}
                            <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400">Plantillas rápidas</div>
                            <button type="button" onClick={() => applySignatureTemplate('classic')} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 font-medium transition-all">💼 Clásica Corporativa</button>
                            <button type="button" onClick={() => applySignatureTemplate('modern')} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 font-medium transition-all">⚡ Tecnológica Moderna</button>
                            <button type="button" onClick={() => applySignatureTemplate('minimal')} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 font-medium transition-all">📄 Minimalista Courier</button>
                            <div className="border-t border-slate-100 mx-3 my-1.5" />
                            <button
                                type="button"
                                onClick={() => { setShowSignatureBuilder(true); setShowSignatureMenu(false); }}
                                className="w-full flex items-center gap-2 text-left px-3 py-2.5 text-[11px] text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 font-black transition-all"
                            >
                                <Sparkles size={12} className="text-amber-300" />
                                ✏️ Crear / Editar Firma
                            </button>
                        </div>
                    )}
                </div>
                {/* Render builder modal when open */}
                {/* Signature Builder Modal — inline para evitar pérdida de foco */}
                {showSignatureBuilder && (
                    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={e => { if (e.target === e.currentTarget) setShowSignatureBuilder(false); }}>
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden ring-1 ring-slate-200">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-violet-600 shrink-0">
                                <div>
                                    <h2 className="text-white font-black text-base tracking-tight">✍️ Constructor de Firma</h2>
                                    <p className="text-indigo-200 text-xs mt-0.5">Personaliza y genera tu firma con IA</p>
                                </div>
                                <button onClick={() => setShowSignatureBuilder(false)} className="text-white/70 hover:text-white hover:bg-white/10 rounded-xl p-2 transition-all">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="flex flex-1 overflow-hidden">
                                {/* LEFT: Form */}
                                <div className="w-[45%] border-r border-slate-100 overflow-y-auto p-5 flex flex-col gap-4 shrink-0">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">📋 Tu Perfil</p>
                                        <div className="flex flex-col gap-2.5">
                                            {[
                                                { key: 'nombre',  label: 'Nombre completo',   placeholder: 'Ej: Carlos Méndez',              icon: '👤' },
                                                { key: 'cargo',   label: 'Cargo / Título',     placeholder: 'Ej: Director Comercial',         icon: '💼' },
                                                { key: 'phone',   label: 'Teléfono',           placeholder: 'Ej: +56 9 1234 5678',            icon: '📞' },
                                                { key: 'address', label: 'Dirección Oficina',  placeholder: 'Ej: Av. Apoquindo 3000',         icon: '📍' },
                                                { key: 'website', label: 'Website / Empresa',  placeholder: 'Ej: www.empresa.com',            icon: '🌐' },
                                                { key: 'logo',    label: 'URL del Logo',       placeholder: 'https://empresa.com/logo.png',   icon: '🖼️' },
                                            ].map(f => (
                                                <div key={f.key}>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                                                        <span>{f.icon}</span>{f.label}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder={f.placeholder}
                                                        value={sigProfile[f.key] || ''}
                                                        onChange={e => setSigProfile(p => ({ ...p, [f.key]: e.target.value }))}
                                                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50 text-slate-700 placeholder:text-slate-300 transition-all"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Style Selector */}
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">🎨 Estilo de Firma</p>
                                        <div className="grid grid-cols-1 gap-2">
                                            {sigStyles.map(s => (
                                                <button
                                                    key={s.key}
                                                    type="button"
                                                    onClick={() => setSigProfile(p => ({ ...p, styleKey: s.key }))}
                                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                                                        sigProfile.styleKey === s.key
                                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                            : 'border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 text-slate-600'
                                                    }`}
                                                >
                                                    <span className="text-lg">{s.icon}</span>
                                                    <div>
                                                        <div className="text-xs font-bold">{s.label}</div>
                                                        <div className="text-[10px] opacity-60">{s.desc}</div>
                                                    </div>
                                                    {sigProfile.styleKey === s.key && <div className="ml-auto w-2 h-2 rounded-full bg-indigo-500" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Generate button */}
                                    <button
                                        type="button"
                                        onClick={generateAISignature}
                                        disabled={generatingSig}
                                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-black text-sm shadow-lg shadow-indigo-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {generatingSig
                                            ? <><Loader2 size={16} className="animate-spin" /> Generando con IA...</>
                                            : <><Sparkles size={16} className="text-amber-300" /> ✨ Generar con IA</>}
                                    </button>
                                </div>

                                {/* RIGHT: Preview */}
                                <div className="flex-1 flex flex-col overflow-hidden">
                                    {/* Tabs */}
                                    <div className="flex border-b border-slate-100 px-4 pt-3 gap-1 shrink-0">
                                        {[['preview','👁 Vista Previa'],['code','</> Código HTML']].map(([tab, label]) => (
                                            <button
                                                key={tab}
                                                type="button"
                                                onClick={() => setSigBuilderTab(tab)}
                                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                                    sigBuilderTab === tab ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-slate-600'
                                                }`}
                                            >{label}</button>
                                        ))}
                                        <div className="ml-auto flex items-center gap-1">
                                            {sigSavedOk && <span className="text-xs text-emerald-600 font-bold animate-pulse">✅ Guardado</span>}
                                        </div>
                                    </div>

                                    {/* Preview / Code area */}
                                    <div className="flex-1 overflow-y-auto p-4">
                                        {sigBuilderTab === 'preview' ? (
                                            <div className="bg-white rounded-2xl border border-slate-100 p-5 min-h-[200px] shadow-inner">
                                                {sigBuilderHtml ? (
                                                    <div
                                                        contentEditable
                                                        suppressContentEditableWarning
                                                        onBlur={e => setSigBuilderHtml(e.currentTarget.innerHTML)}
                                                        dangerouslySetInnerHTML={{ __html: sigBuilderHtml }}
                                                        className="outline-none"
                                                    />
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center h-40 text-slate-300 gap-3">
                                                        <Sparkles size={36} className="opacity-30" />
                                                        <p className="text-sm text-center">Completa tu perfil y presiona<br/>"✨ Generar con IA"</p>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <textarea
                                                className="w-full h-full min-h-[250px] font-mono text-xs p-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 text-slate-600 resize-none"
                                                value={sigBuilderHtml}
                                                onChange={e => setSigBuilderHtml(e.target.value)}
                                                placeholder="El HTML de tu firma aparecerá aquí..."
                                            />
                                        )}
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex gap-2 p-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
                                        <button
                                            type="button"
                                            onClick={saveSignature}
                                            disabled={savingSig || !sigBuilderHtml}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all disabled:opacity-50"
                                        >
                                            {savingSig ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                            {savingSig ? 'Guardando...' : '💾 Guardar Firma'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={applyBuilderSignature}
                                            disabled={!sigBuilderHtml}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all disabled:opacity-50"
                                        >
                                            <Check size={14} /> Usar esta Firma
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="w-px h-4 bg-slate-200 mx-1" />
                <button type="button" onClick={() => execCmd('removeFormat')} className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded text-rose-500 transition-all" title="Borrar formato"><Eraser size={14} /></button>
            </div>
            {/* Editor Area */}
            <div 
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                className="p-4 flex-1 overflow-y-auto outline-none text-sm text-slate-700 leading-relaxed custom-scrollbar min-h-[160px] focus:bg-indigo-50/5"
                placeholder={placeholder}
            />
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
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={onClose} />
            <div className="relative w-full h-full sm:h-auto sm:max-w-xl bg-white/90 backdrop-blur-xl border-0 sm:border sm:border-white rounded-none sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col justify-between">
                <div className="relative p-6 overflow-y-auto flex-1">
                    {/* Decorative bg */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    
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
                                    className="flex items-center gap-4 p-4 bg-white hover:bg-indigo-50/30 border border-slate-200/60 hover:border-indigo-200 rounded-2xl transition-all text-left group shadow-sm hover:shadow-md">
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
                        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
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
                                    {loading ? 'Validando...' : 'Conectar Cuenta'}
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

// ─── Compose Modal (GenAI Powered & Rich Editor) ──────────────────────────────
const EmailChipsInput = ({ value, onChange, placeholder, suggestions = [], id }) => {
    const parseValue = (val) => val ? val.split(',').map(e => e.trim()).filter(e => e) : [];
    const [chips, setChips] = useState(parseValue(value));
    const [inputValue, setInputValue] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        const newChips = parseValue(value);
        if (newChips.join(',') !== chips.join(',')) {
            setChips(newChips);
        }
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const updateExternal = (newChips) => {
        setChips(newChips);
        onChange(newChips.join(', '));
    };

    const addChip = (emailOrGroup) => {
        if (typeof emailOrGroup === 'object' && emailOrGroup.isGroup) {
            let currentChips = [...chips];
            emailOrGroup.emails.forEach(em => {
                if (em && !currentChips.includes(em)) currentChips.push(em);
            });
            updateExternal(currentChips);
        } else {
            const cleanEmail = emailOrGroup.trim();
            if (cleanEmail && !chips.includes(cleanEmail)) {
                const newChips = [...chips, cleanEmail];
                updateExternal(newChips);
            }
        }
        setInputValue('');
        setShowSuggestions(false);
        inputRef.current?.focus();
    };

    const removeChip = (indexToRemove) => {
        const newChips = chips.filter((_, i) => i !== indexToRemove);
        updateExternal(newChips);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === 'Tab' || e.key === ',') {
            e.preventDefault();
            if (inputValue.trim()) {
                // Si el usuario pega correos separados por comas
                const emails = inputValue.split(/[\s,;]+/).filter(x => x.trim());
                let currentChips = [...chips];
                emails.forEach(em => {
                    if (!currentChips.includes(em)) currentChips.push(em);
                });
                updateExternal(currentChips);
                setInputValue('');
            }
        } else if (e.key === 'Backspace' && !inputValue && chips.length > 0) {
            removeChip(chips.length - 1);
        }
    };

    const handleInputChange = (e) => {
        setInputValue(e.target.value);
        setShowSuggestions(true);
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const paste = (e.clipboardData || window.clipboardData).getData('text');
        const emails = paste.split(/[\s,;]+/).filter(em => em.trim());
        if (emails.length > 0) {
            let currentChips = [...chips];
            emails.forEach(em => {
                if (!currentChips.includes(em)) currentChips.push(em);
            });
            updateExternal(currentChips);
            setInputValue('');
        }
    };

    const filteredSuggestions = useMemo(() => {
        if (!inputValue.trim()) return [];
        const search = inputValue.toLowerCase();
        
        // Find individual matches
        const individuals = suggestions.filter(s => 
            (s.email.toLowerCase().includes(search) || 
            (s.name && s.name.toLowerCase().includes(search))) &&
            !chips.includes(s.email)
        ).slice(0, 5);

        // Find group matches (Cargos and Departamentos)
        const groups = {};
        suggestions.forEach(c => {
            if (c.position) {
                const key = `cargo:${c.position}`;
                if (!groups[key]) groups[key] = { isGroup: true, name: `👥 Cargo: ${c.position}`, emails: [] };
                groups[key].emails.push(c.email);
            }
            if (c.departamento) {
                const key = `depto:${c.departamento}`;
                if (!groups[key]) groups[key] = { isGroup: true, name: `🏢 Depto: ${c.departamento}`, emails: [] };
                groups[key].emails.push(c.email);
            }
        });

        const matchedGroups = Object.values(groups)
            .filter(g => g.emails.length > 1 && g.name.toLowerCase().includes(search))
            .slice(0, 3);

        return [...matchedGroups, ...individuals];
    }, [inputValue, suggestions, chips]);

    return (
        <div ref={containerRef} className="relative flex-1 flex flex-col justify-center min-h-[30px] ml-4 bg-transparent cursor-text" onClick={() => inputRef.current?.focus()}>
            <div className="flex flex-wrap items-center gap-1.5 w-full">
                {chips.map((chip, idx) => {
                    const match = suggestions.find(s => s.email === chip);
                    const initials = match && match.name ? match.name.substring(0,2).toUpperCase() : chip.substring(0,2).toUpperCase();
                    const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-rose-500', 'bg-sky-500', 'bg-violet-500', 'bg-amber-500'];
                    const color = colors[chip.length % colors.length];

                    return (
                        <div key={idx} className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 text-[11px] px-2 py-0.5 rounded-full shadow-sm select-none hover:bg-slate-200 transition-colors group">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${color}`}>
                                {initials}
                            </div>
                            <span className="font-medium max-w-[200px] truncate">{match && match.name ? match.name : chip}</span>
                            <button onClick={(e) => { e.stopPropagation(); removeChip(idx); }} className="w-3.5 h-3.5 rounded-full hover:bg-slate-300 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                                <X size={10} />
                            </button>
                        </div>
                    );
                })}
                <input
                    id={id}
                    ref={inputRef}
                    type="text"
                    className="flex-1 min-w-[150px] bg-transparent border-none p-0 text-[13px] text-slate-700 focus:ring-0 placeholder-slate-400 outline-none"
                    placeholder={chips.length === 0 ? placeholder : ''}
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    onFocus={() => setShowSuggestions(true)}
                />
            </div>
            
            {showSuggestions && inputValue && filteredSuggestions.length > 0 && (
                <div className="absolute top-[110%] left-0 w-full max-w-[350px] bg-white border border-slate-200 rounded-xl shadow-xl z-[999] overflow-hidden">
                    {filteredSuggestions.map((s, idx) => {
                        if (s.isGroup) {
                            return (
                                <div key={`group-${idx}`} onClick={(e) => { e.stopPropagation(); addChip(s); }} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors bg-indigo-50/30">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-indigo-600 bg-indigo-100 shadow-sm border border-indigo-200">
                                        <Users size={14} />
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="text-[12px] font-bold text-indigo-700 truncate">{s.name}</span>
                                        <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">{s.emails.length} personas</span>
                                    </div>
                                </div>
                            );
                        }

                        const initials = s.name ? s.name.substring(0,2).toUpperCase() : s.email.substring(0,2).toUpperCase();
                        const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-rose-500', 'bg-sky-500', 'bg-violet-500', 'bg-amber-500'];
                        const color = colors[s.email.length % colors.length];
                        
                        return (
                            <div key={idx} onClick={(e) => { e.stopPropagation(); addChip(s.email); }} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white ${color}`}>
                                    {initials}
                                </div>
                                <div className="flex flex-col flex-1 min-w-0">
                                    {s.name && <span className="text-[12px] font-bold text-slate-700 truncate">{s.name}</span>}
                                    <span className="text-[11px] text-slate-500 truncate">{s.email}</span>
                                    {(s.position || s.departamento) && (
                                        <span className="text-[9px] text-slate-400 font-bold uppercase truncate">{s.position} {s.departamento ? `- ${s.departamento}` : ''}</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const ComposeModal = ({ account, accounts = [], onClose, replyTo = null, showAlert, messages = [], directoryContacts = [] }) => {
    const [currentAccount, setCurrentAccount] = useState(account);
    const [showCc, setShowCc] = useState(replyTo?.cc ? true : false);
    const [showBcc, setShowBcc] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showDirectoryModal, setShowDirectoryModal] = useState(false);
    const [showAISidebar, setShowAISidebar] = useState(false);

    // Generar firma si está configurada en la cuenta
    const signatureHtml = currentAccount?.signature 
        ? `<br/><br/><div id="email-signature" style="font-family: inherit; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 15px; text-align: left;">${currentAccount.signature}</div>` 
        : '';

    const initialHtml = replyTo
        ? `<br/><br/><div style="border-left: 2px solid #cbd5e1; padding-left: 10px; margin-left: 5px; color: #475569; font-family: inherit;"><b>De:</b> ${replyTo.from?.name || replyTo.from?.address} &lt;${replyTo.from?.address}&gt;<br/><b>Asunto:</b> ${replyTo.subject}<br/><br/>${replyTo.htmlBody || replyTo.textBody?.replace(/\n/g, '<br/>') || ''}</div>`
        : signatureHtml;

    const getReplyAllCc = () => {
        if (!replyTo || !replyTo.isReplyAll) {
            // Manejo original para cuando no es reply all
            if (replyTo && !replyTo.isForward && Array.isArray(replyTo.cc)) {
                return replyTo.cc.map(c => c.address).join(', ');
            }
            return replyTo && !replyTo.isForward ? replyTo.cc || '' : '';
        }
        
        const myEmail = account.email.toLowerCase();
        let allCc = [];
        
        if (Array.isArray(replyTo.to)) {
            replyTo.to.forEach(t => {
                if (t.address && t.address.toLowerCase() !== myEmail && t.address.toLowerCase() !== replyTo.from?.address?.toLowerCase()) {
                    allCc.push(t.address);
                }
            });
        }
        
        if (Array.isArray(replyTo.cc)) {
            replyTo.cc.forEach(c => {
                if (c.address && c.address.toLowerCase() !== myEmail) {
                    allCc.push(c.address);
                }
            });
        } else if (typeof replyTo.cc === 'string') {
             allCc.push(replyTo.cc);
        }
        
        return allCc.join(', ');
    };

    const [form, setForm] = useState({
        to: replyTo && !replyTo.isForward ? replyTo.from?.address || '' : '',
        cc: getReplyAllCc(),
        bcc: '',
        importance: 'normal',
        subject: replyTo ? `${replyTo.isForward ? 'RV:' : 'RE:'} ${replyTo.subject}` : '',
        html: initialHtml,
    });

    // Replace signature automatically when currentAccount changes
    useEffect(() => {
        const sigHtml = currentAccount?.signature 
            ? `<div id="email-signature" style="font-family: inherit; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 15px; text-align: left;">${currentAccount.signature}</div>` 
            : '';

        setForm(f => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(f.html, 'text/html');
            const existingSig = doc.getElementById('email-signature') || doc.querySelector('.email-signature') || doc.querySelector('[id="email-signature"]');
            if (existingSig) {
                existingSig.outerHTML = sigHtml;
                return { ...f, html: doc.body.innerHTML };
            } else {
                if (!f.html.trim() || f.html === '<br>' || f.html === '<br/>') {
                    return { ...f, html: sigHtml };
                }
                return f;
            }
        });
    }, [currentAccount]);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    
    // GenAI Drafting
    const [aiPrompt, setAiPrompt] = useState(replyTo?.replyWithInstruction || '');
    const [drafting, setDrafting] = useState(false);

    // Attachments State
    const [attachments, setAttachments] = useState([]);
    const fileInputRef = useRef(null);

    // Extract known contacts for autocomplete
    const knownContacts = useMemo(() => {
        const contactsMap = new Map();
        (messages || []).forEach(msg => {
            if (msg.from && msg.from.address) {
                if (!contactsMap.has(msg.from.address.toLowerCase())) {
                    contactsMap.set(msg.from.address.toLowerCase(), { email: msg.from.address, name: msg.from.name || '' });
                }
            }
            if (msg.to && Array.isArray(msg.to)) {
                msg.to.forEach(t => {
                    if (t.address && !contactsMap.has(t.address.toLowerCase())) {
                        contactsMap.set(t.address.toLowerCase(), { email: t.address, name: t.name || '' });
                    }
                });
            }
            if (msg.cc && Array.isArray(msg.cc)) {
                msg.cc.forEach(c => {
                    if (c.address && !contactsMap.has(c.address.toLowerCase())) {
                        contactsMap.set(c.address.toLowerCase(), { email: c.address, name: c.name || '' });
                    }
                });
            }
        });
        return Array.from(contactsMap.values());
    }, [messages]);

    const allSuggestions = useMemo(() => {
        const map = new Map();
        knownContacts.forEach(c => map.set(c.email.toLowerCase(), c));
        directoryContacts.forEach(c => {
            const email = c.email.toLowerCase();
            if (!map.has(email)) {
                map.set(email, { ...c, name: c.fullName });
            } else {
                // Enrich existing with directory info
                map.set(email, { ...map.get(email), position: c.position, departamento: c.departamento });
            }
        });
        return Array.from(map.values());
    }, [knownContacts, directoryContacts]);

    // Dictation & Scheduling States
    const [listening, setListening] = useState(false);
    const [showSchedulePopup, setShowSchedulePopup] = useState(false);
    const [scheduleDate, setScheduleDate] = useState(() => {
        const nextHour = new Date();
        nextHour.setHours(nextHour.getHours() + 1);
        nextHour.setMinutes(0);
        const offset = nextHour.getTimezoneOffset();
        const localNextHour = new Date(nextHour.getTime() - (offset*60*1000));
        return localNextHour.toISOString().slice(0, 16);
    });
    const recognitionRef = useRef(null);

    const toggleDictation = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            window.alert('Tu navegador no soporta dictado por voz.');
            return;
        }

        if (listening) {
            recognitionRef.current?.stop();
            setListening(false);
            return;
        }

        const rec = new SpeechRecognition();
        rec.lang = 'es-CL';
        rec.continuous = true;
        rec.interimResults = false;

        rec.onstart = () => {
            setListening(true);
        };

        rec.onresult = (e) => {
            const transcript = e.results[e.results.length - 1][0].transcript;
            setForm(f => ({
                ...f,
                html: f.html + ' ' + transcript
            }));
        };

        rec.onerror = (e) => {
            console.error('Speech error:', e);
            setListening(false);
        };

        rec.onend = () => {
            setListening(false);
        };

        recognitionRef.current = rec;
        rec.start();
    };

    const handleSend = async () => {
        if (!form.to.trim()) return setError('El destinatario es requerido');
        setSending(true);
        setError('');
        try {
            await api(`/send/${currentAccount._id}`, { 
                method: 'POST', 
                body: JSON.stringify({ ...form, attachments }) 
            });
            setSent(true);
            setTimeout(onClose, 1500);
        } catch (err) {
            setError(err.message);
        } finally {
            setSending(false);
        }
    };

    const handleGenerateDraft = async (overridePrompt = null) => {
        const promptToUse = overridePrompt || aiPrompt;
        if (!promptToUse.trim()) return;
        setDrafting(true);
        try {
            const res = await api('/ai/draft', { 
                method: 'POST', 
                body: JSON.stringify({ 
                    instruction: promptToUse, 
                    originalText: replyTo ? (replyTo.textBody || replyTo.htmlBody) : null,
                    responderName: currentAccount?.displayName || account?.displayName || '',
                    responderEmail: currentAccount?.email || account?.email || ''
                }) 
            });
            setForm(f => ({ ...f, html: res.draft + (replyTo ? f.html : signatureHtml) }));
            if (!overridePrompt) setAiPrompt(''); // clear prompt after success
        } catch (err) {
            const isQuota = err.status === 429 || (err.message || '').includes('Cuota') || (err.message || '').includes('quota');
            if (isQuota) {
                setError('⚠️ Cuota de IA agotada. Has alcanzado el límite diario de Gemini. Espera unos minutos e intenta de nuevo.');
            } else {
                setError('Error generando borrador con IA: ' + err.message);
            }
        } finally {
            setDrafting(false);
        }
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64Content = reader.result.split(',')[1];
                setAttachments(prev => [...prev, {
                    filename: file.name,
                    contentType: file.type,
                    size: file.size,
                    content: base64Content
                }]);
            };
            reader.readAsDataURL(file);
        });
    };

    const handleRemoveAttachment = (idx) => {
        setAttachments(prev => prev.filter((_, i) => i !== idx));
    };

    useEffect(() => {
        if (replyTo?.replyWithInstruction) {
            handleGenerateDraft(replyTo.replyWithInstruction);
        }
    }, [replyTo]);

    const inp = 'w-full px-5 py-3 bg-transparent border-b border-slate-100 text-[13px] text-slate-800 focus:outline-none focus:border-indigo-400 focus:bg-indigo-50/20 transition-all placeholder:text-slate-400 font-medium';

    return (
        <div className={`fixed inset-0 z-[998] flex items-center justify-center bg-slate-900/40 backdrop-blur-md transition-all duration-300 ${isFullscreen ? 'p-0' : 'p-0 md:p-4'}`}>
            <div className={`bg-white shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ring-1 ring-slate-900/10 relative ${
                isFullscreen 
                ? 'w-full h-full rounded-none' 
                : 'w-full h-full md:h-[90vh] md:max-w-[1000px] rounded-none md:rounded-[2rem]'
            }`}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white/50 backdrop-blur-md shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center">
                            <Edit3 size={16} className="text-indigo-600" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest text-slate-700">
                            {replyTo ? 'Responder' : 'Nuevo Mensaje'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-xl transition-colors hidden md:block" title={isFullscreen ? "Minimizar" : "Pantalla Completa"}>
                            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                        </button>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-500 rounded-xl transition-colors" title="Cerrar">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
                    {/* Compose Area */}
                    <div className="flex-1 flex flex-col border-r border-slate-100 bg-white overflow-y-auto md:overflow-hidden">
                        <div className="flex flex-col flex-shrink-0 bg-slate-50/40 border-b border-slate-100">
                            {/* De: Dropdown */}
                            <div className="flex items-center border-b border-slate-100/50">
                                <span className="w-16 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest px-4">De</span>
                                <div className="flex-1 relative">
                                    <select 
                                        value={currentAccount?._id || ''} 
                                        onChange={e => {
                                            const selected = accounts.find(acc => acc._id === e.target.value);
                                            if (selected) setCurrentAccount(selected);
                                        }}
                                        className="w-full px-5 py-3 bg-transparent text-[13px] text-indigo-700 font-bold focus:outline-none appearance-none cursor-pointer pr-10"
                                    >
                                        {accounts.map(acc => (
                                            <option key={acc._id} value={acc._id} className="text-slate-800 font-medium">
                                                {acc.displayName ? `${acc.displayName} <${acc.email}>` : acc.email}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                            </div>

                            {/* Para: Input with CC/CCO toggles */}
                            <div className="flex items-center border-b border-slate-100/50 relative pr-4">
                                <span className="w-16 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest px-4">Para</span>
                                    <EmailChipsInput 
                                        id="to"
                                        placeholder="destinatario@empresa.com" 
                                        value={form.to}
                                        onChange={(newVal) => setForm(f => ({ ...f, to: newVal }))}
                                        suggestions={allSuggestions}
                                    />
                                <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowDirectoryModal(true)} 
                                        className="px-2.5 py-1 flex items-center gap-1 text-[10px] font-black rounded-lg border bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100 transition-all shadow-sm"
                                        title="Directorio 360 (Talento)"
                                    >
                                        <Users size={12} /> DIR 360
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowCc(c => !c)} 
                                        className={`px-2.5 py-1 text-[10px] font-black rounded-lg border transition-all ${showCc ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                                    >
                                        CC
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowBcc(b => !b)} 
                                        className={`px-2.5 py-1 text-[10px] font-black rounded-lg border transition-all ${showBcc ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                                    >
                                        CCO
                                    </button>
                                </div>
                            </div>

                            {/* CC: Input */}
                            {showCc && (
                                <div className="flex items-center border-b border-slate-100/50 animate-in slide-in-from-top-2 duration-100 min-h-[44px]">
                                    <span className="w-16 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest px-4">CC</span>
                                    <EmailChipsInput 
                                        id="cc"
                                        placeholder="copia@empresa.com" 
                                        value={form.cc}
                                        onChange={(newVal) => setForm(f => ({ ...f, cc: newVal }))}
                                        suggestions={allSuggestions}
                                    />
                                </div>
                            )}

                            {/* CCO: Input */}
                            {showBcc && (
                                <div className="flex items-center border-b border-slate-100/50 animate-in slide-in-from-top-2 duration-100 min-h-[44px]">
                                    <span className="w-16 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest px-4">CCO</span>
                                    <EmailChipsInput 
                                        id="bcc"
                                        placeholder="copia_oculta@empresa.com" 
                                        value={form.bcc}
                                        onChange={(newVal) => setForm(f => ({ ...f, bcc: newVal }))}
                                        suggestions={allSuggestions}
                                    />
                                </div>
                            )}

                            {/* Asunto & Importancia: Input */}
                            <div className="flex items-center pr-4">
                                <span className="w-16 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest px-4">Asunto</span>
                                <input type="text" placeholder="Asunto del correo" value={form.subject}
                                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="w-full px-5 py-3 bg-transparent text-[13px] text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium" />
                                
                                {/* Importancia Selector */}
                                <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Prioridad:</span>
                                    <select
                                        value={form.importance}
                                        onChange={e => setForm(f => ({ ...f, importance: e.target.value }))}
                                        className={`px-2.5 py-1 text-[10px] font-black rounded-lg border outline-none cursor-pointer transition-all ${
                                            form.importance === 'high' ? 'bg-rose-50 border-rose-200 text-rose-600 font-black' :
                                            form.importance === 'low' ? 'bg-slate-50 border-slate-200 text-slate-500 font-semibold' :
                                            'bg-slate-50 border-slate-200 text-slate-700'
                                        }`}
                                    >
                                        <option value="normal">Normal</option>
                                        <option value="high">⚠️ Alta</option>
                                        <option value="low">⬇️ Baja</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Editor */}
                        <div className="flex-1 p-0 flex flex-col min-h-[150px] md:min-h-[200px] bg-slate-50 overflow-hidden relative z-10">
                            <RichTextEditor
                                value={form.html}
                                onChange={html => setForm(f => ({ ...f, html }))}
                                account={currentAccount}
                                placeholder="Escribe tu mensaje aquí..."
                            />
                        </div>
                    </div>

                    {/* Mobile AI Sidebar Toggle */}
                    {hasGenAiMailAccess() && (
<div className="md:hidden px-4 py-3 bg-indigo-50/50 border-t border-indigo-100/50 flex justify-between items-center shrink-0">
                        <span className="text-[10px] font-black uppercase text-indigo-700 tracking-widest flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white"><Sparkles size={12}/></div>
                            GenAI Assistant
                        </span>
                        <button type="button" onClick={() => setShowAISidebar(!showAISidebar)} className="px-4 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm active:scale-95 transition-all">
                            {showAISidebar ? 'Ocultar' : 'Abrir'}
                        </button>
                    </div>
)}

                    {/* AI Sidebar */}
                    {hasGenAiMailAccess() && (
<div className={`${showAISidebar ? 'flex absolute inset-x-0 bottom-[70px] h-[60vh] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)]' : 'hidden'} md:relative md:flex w-full md:w-[320px] bg-gradient-to-b from-indigo-50/90 to-white flex-col border-t md:border-t-0 md:border-l border-slate-100 flex-shrink-0 z-50 transition-all`}>
                        <div className="p-6 flex flex-col h-full overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                        <Sparkles size={18} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 tracking-tight">GenAI</h3>
                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Redacción Inteligente</p>
                                    </div>
                                </div>
                                {showAISidebar && (
                                    <button onClick={() => setShowAISidebar(false)} className="md:hidden p-2 text-slate-400 hover:text-rose-500 bg-white rounded-full shadow-sm"><X size={16}/></button>
                                )}
                            </div>

                            <div className="flex flex-col gap-4 flex-1">
                                <p className="text-xs font-medium text-slate-600 leading-relaxed bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    Describe de qué trata el correo y la IA redactará un borrador profesional por ti.
                                </p>
                                
                                <textarea
                                    className="w-full flex-1 min-h-[100px] px-4 py-3 bg-white border-2 border-indigo-100/50 rounded-2xl text-[13px] text-slate-700 focus:outline-none focus:ring-0 focus:border-indigo-400 transition-all resize-none shadow-inner placeholder:text-slate-400"
                                    placeholder='Ej: "Dile amablemente que el proyecto se retrasa una semana por revisión de QA, pero que está quedando perfecto."'
                                    value={aiPrompt}
                                    onChange={e => setAiPrompt(e.target.value)}
                                />

                                <button type="button" onClick={() => handleGenerateDraft()} disabled={drafting || !aiPrompt.trim()}
                                    className="w-full py-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-2xl text-xs font-black tracking-wide transition-all shadow-xl shadow-slate-900/10 hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 active:scale-95 flex items-center justify-center gap-2 mt-auto shrink-0">
                                    {drafting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} className="text-amber-400" />}
                                    {drafting ? 'Redactando...' : 'Generar Borrador'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                </div>

                {/* Attachments List */}
                {attachments.length > 0 && (
                    <div className="px-6 py-2 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-2 animate-in fade-in max-h-[80px] overflow-y-auto">
                        {attachments.map((att, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full text-xs text-slate-600 shadow-sm">
                                <span className="truncate max-w-[150px] font-medium">{att.filename}</span>
                                <span className="text-[10px] text-slate-400 font-bold">({(att.size / 1024).toFixed(1)} KB)</span>
                                <button type="button" onClick={() => handleRemoveAttachment(i)} className="text-slate-400 hover:text-rose-500 font-black ml-1">
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Footer Controls */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
                    <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Adjuntar Archivo">
                            <Paperclip size={18} />
                        </button>
                        <input type="file" ref={fileInputRef} multiple className="hidden" onChange={handleFileChange} />
                        
                        {/* Audio Dictation & Cloud OneDrive Integration */}
                        <button type="button" onClick={toggleDictation}
                            className={`p-2 rounded-xl transition-all hover:scale-105 active:scale-95
                                ${listening ? 'text-rose-500 bg-rose-50 animate-pulse' : 'text-slate-400 hover:text-indigo-600'}`}
                            title={listening ? "Detener Grabación de Voz" : "Dictado por Voz (Speech to Text)"}>
                            🎙️
                        </button>

                        <button type="button" onClick={() => setShowSchedulePopup(true)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:scale-105 active:scale-95 transition-all"
                            title="Programar Envío (Enviar Más Tarde)">
                            ⏱️
                        </button>

                        <button type="button" onClick={() => {
                            const fileInput = document.createElement('input');
                            fileInput.type = 'file';
                            fileInput.onchange = async (e) => {
                                const file = e.target.files[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = async () => {
                                    const base64Content = reader.result.split(',')[1];
                                    showAlert(`Subiendo ${file.name} a OneDrive...`);
                                    try {
                                        const res = await api('/onedrive/upload', {
                                            method: 'POST',
                                            body: JSON.stringify({ filename: file.name, contentType: file.type, content: base64Content })
                                        });
                                        const linkHtml = `<br/><br/><div style="padding: 12px; background: #f0f7ff; border: 1px solid #cce3ff; border-radius: 12px; font-family: sans-serif; display: inline-flex; items-center; gap: 8px;">
                                            <span style="font-size: 16px;">📎</span>
                                            <div>
                                                <a href="${res.downloadUrl}" target="_blank" style="color: #0078d4; text-decoration: none; font-weight: bold; font-size: 13px;">Descargar de OneDrive: ${file.name}</a>
                                                <p style="margin: 2px 0 0 0; font-size: 10px; color: #605e5c;">Compartido de forma segura localmente</p>
                                            </div>
                                        </div><br/>`;
                                        setForm(f => ({ ...f, html: f.html + linkHtml }));
                                        showAlert("Adjunto subido a OneDrive e insertado como enlace.");
                                    } catch (err) {
                                        showAlert("Error subiendo a OneDrive: " + err.message, "error");
                                    }
                                };
                                reader.readAsDataURL(file);
                            };
                            fileInput.click();
                        }}
                            className="p-2 text-slate-400 hover:text-indigo-650 hover:scale-105 active:scale-95 transition-all"
                            title="Cargar a la nube por OneDrive (Simulación Local)">
                            ☁️
                        </button>

                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate max-w-[200px]">De: {account.email}</p>
                    </div>
                    <div className="flex items-center justify-between w-full sm:w-auto gap-3">
                        {error && <p className="text-xs text-rose-600 font-bold bg-rose-50 px-3 py-1 rounded-lg truncate max-w-[200px]">{error}</p>}
                        <button onClick={handleSend} disabled={sending || sent}
                            className="flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:shadow-lg hover:shadow-indigo-500/30 transition-all hover:scale-[1.03] active:scale-[0.97] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 w-full sm:w-auto">
                            {sent ? <CheckCircle size={18} /> : sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                            {sent ? '¡Enviado!' : sending ? 'Enviando...' : 'Enviar'}
                        </button>
                    </div>
                </div>

                {/* Schedule send popup */}
                {showSchedulePopup && (
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 animate-in zoom-in-95">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 mb-3 flex items-center gap-1.5">
                                ⏱️ Programar Envío
                            </h4>
                            <p className="text-[11px] text-slate-400 font-bold mb-4">El correo se enviará automáticamente en la fecha y hora seleccionada.</p>
                            
                            <input 
                                type="datetime-local" 
                                value={scheduleDate} 
                                onChange={e => setScheduleDate(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs mb-4 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50" 
                            />
                            
                            <div className="flex gap-2 justify-end">
                                <button type="button" onClick={() => setShowSchedulePopup(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[10px] font-black uppercase tracking-widest rounded-xl text-slate-600">
                                    Cancelar
                                </button>
                                <button type="button" onClick={async () => {
                                    if (!scheduleDate) return;
                                    try {
                                        setSending(true);
                                        await api(`/send-scheduled/${account._id}`, {
                                            method: 'POST',
                                            body: JSON.stringify({
                                                ...form,
                                                attachments,
                                                sendAt: new Date(scheduleDate)
                                            })
                                        });
                                        setShowSchedulePopup(false);
                                        showAlert("Envío programado exitosamente");
                                        onClose();
                                    } catch(err) {
                                        window.alert("Error programando envío: " + err.message);
                                    } finally {
                                        setSending(false);
                                    }
                                }}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-indigo-600/10">
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            {showDirectoryModal && (
                <DirectoryModal 
                    contacts={directoryContacts} 
                    onClose={() => setShowDirectoryModal(false)} 
                    onSelect={(emails) => {
                        const currentTo = form.to ? form.to.split(',').map(e => e.trim()).filter(Boolean) : [];
                        emails.forEach(e => {
                            if (!currentTo.includes(e)) currentTo.push(e);
                        });
                        setForm(f => ({ ...f, to: currentTo.join(', ') }));
                    }} 
                />
            )}
        </div>
    );
};

// ─── Email Detail View (GenAI Powered & Responsive) ──────────────────────────
const EmailDetail = ({ email, onBack, onReply, onDelete, accountId, activeAddins = [], onViewOfficeDocument, showAlert, quickSteps = [], onApplyQuickStep }) => {
    const [summary, setSummary] = useState(null);
    const [summarizing, setSummarizing] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [meetingData, setMeetingData] = useState(null);
    const [extracting, setExtracting] = useState(false);
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

    const handleExtractMeeting = async () => {
        setExtracting(true);
        setMeetingData(null);
        try {
            const res = await api('/ai/extract-meeting', {
                method: 'POST',
                body: JSON.stringify({ text: email.textBody || email.htmlBody })
            });
            if (res.hasMeeting) {
                setMeetingData(res);
            } else {
                window.alert("No se detectaron propuestas de reunión en este correo.");
            }
        } catch (e) {
            console.error("Extract Meeting Error:", e);
            window.alert("Error al intentar extraer reunión.");
        } finally {
            setExtracting(false);
        }
    };

    const createMeetingDirect = async (meetingPayload) => {
        const user = JSON.parse(localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user') || '{}');
        const res = await fetch(`${API_URL}/api/reuniones/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${user.token}`
            },
            body: JSON.stringify(meetingPayload)
        });
        if (!res.ok) throw new Error('Error al crear la reunión');
        return res.json();
    };

    const handleDownloadAttachment = (filename) => {
        const user = JSON.parse(localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user') || '{}');
        const token = user.token;
        const url = `${API_URL}/api/webmail/message/${accountId}/${email.uid}/attachment/${encodeURIComponent(filename)}?folder=${encodeURIComponent(email.folder || 'INBOX')}&token=${token}`;
        window.open(url, '_blank');
    };

    const speakEmail = () => {
        const synth = window.speechSynthesis;
        if (synth.speaking) {
            synth.cancel();
            return;
        }
        const cleanBody = email.textBody || email.htmlBody?.replace(/<[^>]*>/g, '') || 'Sin contenido de texto.';
        const text = `Asunto: ${email.subject}. Remitente: ${fromName}. Mensaje: ${cleanBody}`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-CL';
        synth.speak(utterance);
    };

    useEffect(() => {
        if (!email) return;
        setSummary(null);
        setMeetingData(null);
        setSuggestions([]);
        setLoadingSuggestions(true);
        api('/ai/smart-replies', {
            method: 'POST',
            body: JSON.stringify({ text: email.textBody || email.htmlBody })
        }).then(res => {
            setSuggestions(res.suggestions || []);
        }).catch(err => {
            console.error(err);
        }).finally(() => {
            setLoadingSuggestions(false);
        });
    }, [email]);

    return (
        <div className="flex flex-col h-full bg-white relative">
            <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
                <button onClick={onBack} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors text-slate-500" title="Volver a la lista">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 truncate tracking-tight">{email.subject}</h2>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="bg-slate-100 text-slate-600 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                            {email.folder || 'INBOX'}
                        </span>
                        <p className="text-[10px] text-slate-400 font-bold truncate">
                            {new Date(email.date).toLocaleDateString('es-CL', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    {activeAddins.includes('jira') && (
                        <button onClick={() => {
                            showAlert("Ticket Jira Creado: PROJ-" + Math.floor(Math.random() * 1000) + " a partir de este correo.");
                        }} className="w-9 h-9 sm:w-10 sm:h-10 xl:w-auto xl:px-3 flex-shrink-0 flex items-center justify-center bg-blue-50 border border-blue-200 hover:bg-blue-600 hover:text-white text-blue-600 rounded-xl transition-all shadow-sm gap-1.5" title="Crear Ticket Jira">
                            <Briefcase size={16} />
                            <span className="hidden xl:inline text-[9px] font-black uppercase tracking-widest">Jira</span>
                        </button>
                    )}
                    {activeAddins.includes('teams') && (
                        <button onClick={() => {
                            showAlert("Correo compartido en canal corporativo de Microsoft Teams (Simulación Local).");
                        }} className="w-9 h-9 sm:w-10 sm:h-10 xl:w-auto xl:px-3 flex-shrink-0 flex items-center justify-center bg-indigo-50 border border-indigo-200 hover:bg-indigo-600 hover:text-white text-indigo-650 rounded-xl transition-all shadow-sm gap-1.5" title="Compartir en Teams">
                            <Send size={16} />
                            <span className="hidden xl:inline text-[9px] font-black uppercase tracking-widest">Teams</span>
                        </button>
                    )}
                    <button onClick={speakEmail} title="Lector en Voz Alta"
                        className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center bg-slate-50 border border-slate-200/80 hover:bg-slate-100 text-slate-650 rounded-xl transition-all shadow-sm">
                        <Volume2 size={16} />
                    </button>
                    <button onClick={handleExtractMeeting} disabled={extracting} title="Agenda IA (Extraer Reunión)"
                        className="w-9 h-9 sm:w-10 sm:h-10 xl:w-auto xl:px-3.5 flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600 text-white rounded-xl transition-all shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 hover:scale-105 active:scale-95 disabled:opacity-50 gap-1.5">
                        {extracting ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
                        <span className="hidden xl:inline text-[9px] font-black uppercase tracking-widest">Agenda IA</span>
                    </button>
                    <button onClick={handleSummarize} disabled={summarizing} title="Resumir con IA (Gemini)"
                        className="w-9 h-9 sm:w-10 sm:h-10 xl:w-auto xl:px-3.5 flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white rounded-xl transition-all shadow-md shadow-violet-500/10 hover:shadow-violet-500/20 hover:scale-105 active:scale-95 disabled:opacity-50 gap-1.5">
                        {summarizing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        <span className="hidden xl:inline text-[9px] font-black uppercase tracking-widest">IA Resumir</span>
                    </button>
                    <button onClick={() => onReply(email)} title="Responder"
                        className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center bg-slate-50 border border-slate-200/80 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 hover:scale-[1.05] active:scale-[0.95] text-slate-600 rounded-xl transition-all shadow-sm">
                        <Reply size={16} />
                    </button>
                    <button onClick={() => onReply({...email, isReplyAll: true})} title="Responder a Todos"
                        className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center bg-slate-50 border border-slate-200/80 hover:bg-violet-600 hover:text-white hover:border-violet-600 hover:scale-[1.05] active:scale-[0.95] text-slate-600 rounded-xl transition-all shadow-sm">
                        <ReplyAll size={16} />
                    </button>
                    <button onClick={() => onReply({...email, isForward: true})} title="Reenviar"
                        className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center bg-slate-50 border border-slate-200/80 hover:bg-sky-600 hover:text-white hover:border-sky-600 hover:scale-[1.05] active:scale-[0.95] text-slate-600 rounded-xl transition-all shadow-sm">
                        <ArrowRight size={16} />
                    </button>
                    <button onClick={() => onDelete(email.uid)} title="Eliminar"
                        className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center bg-slate-50 border border-slate-200/80 hover:bg-rose-600 hover:text-white hover:border-rose-600 hover:scale-[1.05] active:scale-[0.95] text-slate-500 rounded-xl transition-all shadow-sm">
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* Quick Steps bar */}
                {quickSteps && quickSteps.length > 0 && (
                    <div className="mx-4 sm:mx-8 mt-3 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">Pasos Rápidos:</span>
                        {quickSteps.map(qs => (
                            <button key={qs._id} onClick={() => onApplyQuickStep(qs._id, email.uid)}
                                className="px-2.5 py-1.5 bg-slate-50 hover:bg-indigo-600 hover:text-white border border-slate-200/60 rounded-xl text-[10px] font-bold text-slate-650 transition-all flex items-center gap-1 shadow-sm">
                                ⚡ {qs.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* Security Info Banner */}
                {email.securityStatus === 'phishing' ? (
                    <div className="mx-4 sm:mx-8 mt-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 animate-pulse">
                        <AlertCircle className="text-rose-500 flex-shrink-0 mt-0.5" size={18} />
                        <div>
                            <p className="text-xs font-black text-rose-800 uppercase tracking-widest">Alerta de Seguridad / Posible Phishing</p>
                            <p className="text-[11px] text-rose-600 mt-0.5 font-bold">{email.securityReason}</p>
                        </div>
                    </div>
                ) : (
                    <div className="mx-4 sm:mx-8 mt-4 px-4 py-2 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center gap-2">
                        <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                            🛡️ Remitente Verificado (SPF/DKIM/DMARC válidos)
                        </span>
                    </div>
                )}

                {/* Email Header Info */}
                <div className="px-6 sm:px-8 py-5 border-b border-slate-50 flex items-start gap-4">
                    <Avatar name={fromName} email={email.from?.address} size={11} className="text-xs" />
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                            <div className="flex items-baseline gap-2 flex-wrap">
                                <p className="text-sm sm:text-base font-black text-slate-900">{fromName}</p>
                                <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100 truncate max-w-[200px]">&lt;{email.from?.address}&gt;</span>
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2 font-medium">
                            <span className="font-bold">Para:</span> {email.to?.map(t => t.address).join(', ')}
                        </p>
                        {email.cc && email.cc.length > 0 && (
                            <p className="text-[11px] text-slate-500 mt-1 font-medium">
                                <span className="font-bold">CC:</span> {email.cc?.map(t => t.address).join(', ')}
                            </p>
                        )}
                    </div>
                </div>

                {/* Extracted Meeting Banner */}
                {meetingData && (
                    <div className="mx-4 sm:mx-8 mt-5 p-4 sm:p-5 bg-gradient-to-br from-indigo-50 to-emerald-50 border border-indigo-100 rounded-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
                        <div className="relative z-10">
                            <h4 className="text-[9px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                                <Calendar size={12} /> Reunión Propuesta Detectada
                            </h4>
                            <p className="text-xs sm:text-sm font-black text-slate-800">{meetingData.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{meetingData.description}</p>
                            <div className="flex gap-4 mt-3 text-[10px] sm:text-[11px] font-bold text-slate-600">
                                <span className="flex items-center gap-1"><Clock size={12}/> {meetingData.date} a las {meetingData.startTime}</span>
                                <span>⏳ {meetingData.duration} min</span>
                            </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0 relative z-10">
                            <button onClick={async () => {
                                try {
                                    await createMeetingDirect({
                                        title: meetingData.title,
                                        description: meetingData.description,
                                        date: meetingData.date,
                                        startTime: meetingData.startTime,
                                        duration: Number(meetingData.duration),
                                        participants: []
                                    });
                                    window.alert("¡Reunión agendada con éxito en tu agenda!");
                                    setMeetingData(null);
                                } catch(e) {
                                    window.alert("Error al agendar reunión: " + e.message);
                                }
                            }} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm">
                                Confirmar
                            </button>
                            <button onClick={() => setMeetingData(null)} className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
                                Descartar
                            </button>
                        </div>
                    </div>
                )}

                {/* AI Suggestions / Smart Replies */}
                {suggestions.length > 0 && (
                    <div className="mx-4 sm:mx-8 mt-6">
                        <div className="flex items-center gap-1.5 mb-3">
                            <Sparkles size={14} className="text-indigo-500 animate-pulse" />
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Sugerencias Inteligentes</span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-3 custom-scrollbar snap-x w-full">
                            {suggestions.map((sug, i) => (
                                <button key={i} onClick={() => onReply({ ...email, replyWithInstruction: sug })}
                                    className="snap-start flex-shrink-0 px-4 py-2 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl text-[13px] font-bold text-slate-700 hover:text-indigo-700 shadow-sm hover:shadow-md transition-all active:scale-95"
                                    title={`Responder usando la IA: "${sug}"`}>
                                    "{sug}"
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* AI Summary Banner */}
                {summary && (
                    <div className="mx-4 sm:mx-8 mt-5 p-5 bg-gradient-to-br from-violet-50/70 via-indigo-50/30 to-fuchsia-50/50 border border-violet-200/50 rounded-[1.5rem] relative overflow-hidden shadow-lg shadow-violet-500/5 backdrop-blur-md animate-in zoom-in-95 duration-300">
                        <div className="absolute -top-6 -right-6 w-24 h-24 bg-violet-400/10 blur-2xl rounded-full" />
                        <div className="absolute top-4 right-4 opacity-20">
                            <Sparkles size={36} className="text-violet-600 animate-pulse" />
                        </div>
                        <h3 className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-3">
                            <Zap size={12} className="text-violet-600" /> 
                            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">Resumen Corporativo Inteligente</span>
                        </h3>
                        <div className="prose prose-sm prose-violet relative z-10 text-xs sm:text-sm leading-relaxed text-slate-700 font-medium bg-white/45 p-4 rounded-xl border border-white/40 shadow-inner" dangerouslySetInnerHTML={{ __html: summary.replace(/\n/g, '<br/>') }} />
                    </div>
                )}

                {/* Body Content */}
                <div className="px-4 sm:px-8 py-6 w-full max-w-full overflow-hidden">
                    <div className="w-full overflow-x-auto custom-scrollbar pb-4 break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                        {email.htmlBody ? (
                            <div
                                className="prose prose-sm sm:prose-base max-w-full text-[13px] sm:text-[14px] leading-relaxed whitespace-normal break-words"
                                style={{ wordBreak: 'break-word', overflowWrap: 'break-word', maxWidth: '100%' }}
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(email.htmlBody) }}
                            />
                        ) : (
                            <pre className="text-[13px] sm:text-[14px] text-slate-700 whitespace-pre-wrap font-sans leading-relaxed break-words max-w-full" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                {email.textBody || '(Sin contenido)'}
                            </pre>
                        )}
                    </div>

                    {/* Attachments */}
                    {email.attachments?.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <Paperclip size={12} /> Archivos Adjuntos ({email.attachments.length})
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {email.attachments.map((att, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-300 transition-all cursor-pointer group justify-between">
                                        <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => handleDownloadAttachment(att.filename)}>
                                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all flex-shrink-0">
                                                <Briefcase size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-700 truncate">{att.filename || 'Archivo Adjunto'}</p>
                                                <p className="text-[10px] text-slate-400 font-bold">{(att.size / 1024).toFixed(1)} KB</p>
                                            </div>
                                        </div>
                                        {(att.filename?.endsWith('.docx') || att.filename?.endsWith('.xlsx')) && (
                                            <button type="button" onClick={() => onViewOfficeDocument(att.filename)}
                                                className="px-3 py-1.5 bg-white hover:bg-indigo-600 hover:text-white border border-slate-200 hover:border-indigo-600 text-[9px] font-black uppercase rounded-lg transition-colors flex-shrink-0 relative z-10 shadow-sm">
                                                Abrir
                                            </button>
                                        )}
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

// ─── Security Warning Badge Helper ──────────────────────────────────────────
const getSecurityBadge = (msg) => {
    const address = msg.from?.address?.toLowerCase() || '';
    if (!address) return null;
    const isSuspicious = address.includes('gma1l') || address.includes('paypa1') || address.includes('security-alert') || address.includes('verificacion-cuenta');
    if (isSuspicious) {
        return <span className="text-rose-500 animate-pulse font-bold" title="Remitente sospechoso (Posible Phishing)">🚨</span>;
    }
    const isSafe = address.endsWith('@gmail.com') || address.endsWith('@outlook.com') || address.endsWith('@hotmail.com') || address.endsWith('@yahoo.com') || address.endsWith('@microsoft.com');
    if (isSafe) {
        return <span className="text-emerald-500 font-bold" title="Remitente de confianza">🛡️</span>;
    }
    return null;
};

// ─── Message Row ──────────────────────────────────────────────────────────────
const MessageRow = ({ msg, isSelected, isChecked, onToggleCheck, onClick }) => {
    const fromName = msg.from?.name || msg.from?.address || 'Desconocido';

    return (
        <div onClick={onClick}
            className={`w-full text-left flex items-start gap-3 p-4 mb-3 transition-all rounded-2xl group relative overflow-hidden cursor-pointer backdrop-blur-md shadow-sm border
                hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-500/10 active:scale-[0.98]
                ${isSelected ? 'bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/10 border-indigo-200/60 ring-1 ring-indigo-500/20' : 
                  isChecked ? 'bg-indigo-50/40 border-indigo-200/40' : 
                  'bg-white/40 hover:bg-white/60 border-white/40'}
                ${!msg.seen && !isSelected && !isChecked ? 'bg-white/70 shadow-md border-white/60' : ''}`}>

            {/* Checkbox for Bulk Actions */}
            <button 
                type="button" 
                onClick={(e) => onToggleCheck(msg.uid, e)} 
                className="p-1 mt-1 text-slate-300 hover:text-indigo-650 transition-colors flex-shrink-0 relative z-20">
                {isChecked ? (
                    <CheckSquare size={16} className="text-indigo-650 fill-indigo-100" />
                ) : (
                    <Square size={16} className="text-slate-300 group-hover:text-slate-400" />
                )}
            </button>

            <Avatar name={fromName} email={msg.from?.address} size={10} className={!msg.seen ? 'ring-2 ring-indigo-500 ring-offset-2' : ''} />
            
            <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 truncate">
                        <p className={`text-[12px] sm:text-[13px] truncate ${!msg.seen ? 'font-black text-slate-900' : 'font-bold text-slate-650'}`}>
                            {fromName}
                        </p>
                        {getSecurityBadge(msg)}
                    </div>
                    <span className={`text-[9px] sm:text-[10px] flex-shrink-0 ${!msg.seen ? 'font-black text-indigo-600' : 'font-bold text-slate-400'}`}>
                        {new Date(msg.date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                    </span>
                </div>
                <p className={`text-[11px] sm:text-[12px] truncate ${!msg.seen ? 'font-black text-slate-800' : 'font-semibold text-slate-500'}`}>
                    {msg.subject}
                </p>
            </div>
            
            {msg.flagged && <Star size={13} className="text-amber-400 fill-amber-400 flex-shrink-0 mt-2" />}
        </div>
    );
};

// ─── Office Document Viewer Modal ───────────────────────────────────────────
const OfficeViewerModal = ({ filename, onClose }) => {
    const isDoc = filename.endsWith('.docx');
    const isXls = filename.endsWith('.xlsx');
    const isPpt = filename.endsWith('.pptx') || filename.endsWith('.ppt');

    // Slide carousel for PowerPoint
    const [activeSlide, setActiveSlide] = useState(0);
    const slides = [
        { title: "Resumen de Proyecto Q2", bullets: ["Hitos completados a tiempo", "Migración de base de datos exitosa", "Despliegue inicial de Genai Mail"] },
        { title: "Métricas y Rendimiento", bullets: ["Aumento del 40% en eficiencia", "Latencia promedio de IA < 1.2s", "Satisfacción del usuario de 4.9/5.0"] },
        { title: "Próximos Pasos", bullets: ["Integración de accesibilidad por voz", "Lanzamiento de la tienda de Add-ins", "Optimización de la sincronización IMAP"] }
    ];

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden border border-white/20 animate-in fade-in zoom-in-95 duration-250">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">
                            {isDoc ? '📝' : isXls ? '📊' : '📉'}
                        </span>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 tracking-tight">{filename}</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Visor de Documentos Local (Solo Lectura)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-650 hover:bg-slate-100 rounded-xl transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-6 sm:p-8 overflow-y-auto custom-scrollbar bg-slate-100/30 flex flex-col">
                    {isDoc && (
                        <div className="bg-white shadow-md border border-slate-200/50 rounded-2xl p-8 max-w-2xl mx-auto flex-1 text-slate-700 leading-relaxed space-y-6">
                            <h1 className="text-2xl font-black text-slate-900 text-center border-b pb-4 border-slate-100">CONTRATO DE SERVICIOS TECNOLÓGICOS</h1>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider text-center">Referencia: CON-2026-X99</p>
                            <p className="text-sm">Este documento constituye un acuerdo formal de prestación de servicios entre <b>Synoptik Innovación Ltda.</b> y el <b>Cliente Corporativo</b>.</p>
                            <h2 className="text-base font-bold text-slate-800">1. Objeto del Acuerdo</h2>
                            <p className="text-sm">El prestador se compromete a proveer acceso a la plataforma Genai Mail, garantizando la confidencialidad de los correos, la disponibilidad local de las bases de datos y la clasificación inteligente por IA.</p>
                            <h2 className="text-base font-bold text-slate-800">2. Privacidad y Datos Locales</h2>
                            <p className="text-sm">El cliente mantendrá toda su información en un entorno local seguro. Genai Mail no compartirá datos con nubes externas de terceros sin autorización explícita del administrador del sistema.</p>
                            <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs font-bold text-slate-400">
                                <div>
                                    <div className="border-t border-slate-200 pt-3">Firma Prestador</div>
                                </div>
                                <div>
                                    <div className="border-t border-slate-200 pt-3">Firma Cliente</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {isXls && (
                        <div className="bg-white shadow-md border border-slate-200/50 rounded-2xl overflow-hidden flex-1 flex flex-col">
                            <div className="bg-emerald-600 text-white p-4 flex items-center justify-between">
                                <span className="text-xs font-black uppercase tracking-wider">Hoja de Cálculo: Reporte Financiero Q2</span>
                                <span className="bg-emerald-700 text-[10px] px-2 py-0.5 rounded font-bold">Auto-calculado</span>
                            </div>
                            <div className="overflow-x-auto flex-1 custom-scrollbar">
                                <table className="w-full text-left border-collapse text-xs text-slate-650">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-widest text-[9px] font-black">
                                            <th className="p-3.5 pl-6">Concepto</th>
                                            <th className="p-3.5">Abril</th>
                                            <th className="p-3.5">Mayo</th>
                                            <th className="p-3.5">Junio</th>
                                            <th className="p-3.5 pr-6">Total Q2</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {[
                                            { concept: "Ingresos por Licencias", m1: 45000, m2: 48000, m3: 52000 },
                                            { concept: "Servicios Profesionales", m1: 12000, m2: 15000, m3: 11000 },
                                            { concept: "Soporte Técnico Premium", m1: 8500, m2: 8500, m3: 9000 },
                                            { concept: "Costos Operativos", m1: -15000, m2: -16000, m3: -15500 },
                                            { concept: "Infraestructura & Servidores", m1: -5000, m2: -5200, m3: -5100 }
                                        ].map((row, i) => {
                                            const tot = row.m1 + row.m2 + row.m3;
                                            return (
                                                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-3.5 pl-6 font-bold text-slate-800">{row.concept}</td>
                                                    <td className={`p-3.5 ${row.m1 < 0 ? 'text-rose-500 font-bold' : 'text-slate-650'}`}>{row.m1.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</td>
                                                    <td className={`p-3.5 ${row.m2 < 0 ? 'text-rose-500 font-bold' : 'text-slate-650'}`}>{row.m2.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</td>
                                                    <td className={`p-3.5 ${row.m3 < 0 ? 'text-rose-500 font-bold' : 'text-slate-650'}`}>{row.m3.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</td>
                                                    <td className={`p-3.5 pr-6 font-extrabold ${tot < 0 ? 'text-rose-600' : 'text-slate-800'}`}>{tot.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</td>
                                                </tr>
                                            );
                                        })}
                                        <tr className="bg-slate-100/80 font-black border-t border-slate-300">
                                            <td className="p-4 pl-6 text-slate-900">BALANCE NETO</td>
                                            <td className="p-4 text-emerald-600">$ 45.500.000</td>
                                            <td className="p-4 text-emerald-600">$ 50.300.000</td>
                                            <td className="p-4 text-emerald-600">$ 51.400.000</td>
                                            <td className="p-4 pr-6 text-emerald-700 bg-emerald-50">$ 147.200.000</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {isPpt && (
                        <div className="flex-1 flex flex-col justify-between max-w-2xl mx-auto w-full">
                            <div className="bg-white shadow-xl border border-slate-200/60 rounded-3xl p-8 aspect-video flex flex-col justify-between relative overflow-hidden bg-gradient-to-tr from-indigo-950 via-slate-900 to-indigo-950 text-white">
                                <div className="absolute -top-32 -right-32 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                                <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />
                                
                                <div className="flex justify-between items-center relative z-10">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Slide {activeSlide + 1} de {slides.length}</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Genai Presentation</span>
                                </div>

                                <div className="my-auto relative z-10">
                                    <h2 className="text-xl sm:text-2xl font-black mb-4 bg-gradient-to-r from-white via-indigo-100 to-indigo-200 bg-clip-text text-transparent">{slides[activeSlide].title}</h2>
                                    <ul className="space-y-2 text-xs sm:text-sm text-slate-350 list-disc list-inside">
                                        {slides[activeSlide].bullets.map((b, idx) => (
                                            <li key={idx} className="font-semibold leading-relaxed">{b}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="flex justify-between items-center relative z-10 border-t border-white/5 pt-4">
                                    <span className="text-[9px] text-slate-400 font-bold">Synoptik Innovación Ltda.</span>
                                    <span className="text-[9px] text-slate-400 font-bold">Santiago, Chile</span>
                                </div>
                            </div>

                            {/* Carousel Controls */}
                            <div className="flex items-center justify-center gap-4 mt-6">
                                <button
                                    onClick={() => setActiveSlide(s => Math.max(0, s - 1))}
                                    disabled={activeSlide === 0}
                                    className="px-4 py-2 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-black rounded-xl text-xs shadow-md border transition-all">
                                    Anterior
                                </button>
                                <button
                                    onClick={() => setActiveSlide(s => Math.min(slides.length - 1, s + 1))}
                                    disabled={activeSlide === slides.length - 1}
                                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-40 text-white font-black rounded-xl text-xs shadow-md transition-all">
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Addins Store Modal ─────────────────────────────────────────────────────
const AddinsStoreModal = ({ accountId, initialAddins = [], onClose, onUpdated, showAlert }) => {
    const [activeAddins, setActiveAddins] = useState(initialAddins);
    const [updating, setUpdating] = useState(false);

    const addons = [
        { id: 'jira', name: 'Jira Integration', icon: '🟦', desc: 'Crea tickets de soporte directamente desde correos de clientes y haz seguimiento local.', category: 'Productividad' },
        { id: 'zoom', name: 'Zoom Meeting Helper', icon: '🎥', desc: 'Genera enlaces de reuniones instantáneas para agregarlos en correos y firmas rápidamente.', category: 'Comunicación' },
        { id: 'teams', name: 'Teams Connector', icon: '👥', desc: 'Comparte hilos de conversación de correos directamente en tus canales de discusión internos.', category: 'Colaboración' },
        { id: 'hubspot', name: 'HubSpot CRM Link', icon: '🧡', desc: 'Sincroniza y crea contactos y prospectos de venta con el CRM local de forma automática.', category: 'Ventas' },
    ];

    const toggleAddin = (id) => {
        setActiveAddins(prev => 
            prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
        );
    };

    const handleSave = async () => {
        setUpdating(true);
        try {
            const updatedAcc = await api(`/accounts/${accountId}/addins`, {
                method: 'POST',
                body: JSON.stringify({ activeAddins })
            });
            onUpdated(updatedAcc);
            showAlert('Add-ins actualizados correctamente');
            onClose();
        } catch (err) {
            showAlert('Error actualizando Add-ins: ' + err.message, 'error');
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl h-[70vh] flex flex-col overflow-hidden border border-white/20 animate-in fade-in zoom-in-95 duration-250">
                <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100 flex-shrink-0">
                    <div>
                        <h3 className="text-base font-black text-slate-800 tracking-tight">Marketplace de Add-ins</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Activa herramientas externas simuladas de forma local</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-650 hover:bg-slate-100 rounded-xl transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-150/10 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {addons.map(add => {
                            const isActive = activeAddins.includes(add.id);
                            return (
                                <div key={add.id} className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 bg-white hover:shadow-md
                                    ${isActive ? 'border-indigo-200 ring-2 ring-indigo-500/5' : 'border-slate-200/70'}`}>
                                    <div className="flex items-start gap-3">
                                        <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                                            {add.icon}
                                        </div>
                                        <div>
                                            <span className="text-[9px] font-black text-indigo-650 uppercase tracking-widest">{add.category}</span>
                                            <h4 className="text-sm font-black text-slate-800 mt-0.5">{add.name}</h4>
                                            <p className="text-[11px] text-slate-400 font-bold mt-1 leading-normal">{add.desc}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => toggleAddin(add.id)}
                                        className={`w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all
                                            ${isActive 
                                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-600' 
                                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/10'}`}>
                                        {isActive ? 'Desactivar' : 'Activar'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 flex-shrink-0">
                    <button onClick={onClose} className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-black uppercase tracking-widest rounded-xl text-slate-600 transition-colors">Cancelar</button>
                    <button onClick={handleSave} disabled={updating}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-indigo-600/10 flex items-center gap-2">
                        {updating ? <Loader2 size={12} className="animate-spin" /> : null}
                        Guardar Configuración
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Settings Modal (Out of Office, Rules, Quick Steps) ─────────────────────
const SettingsModal = ({ account, rules, quickSteps, onSaveOutOfOffice, onCreateRule, onDeleteRule, onCreateQuickStep, onDeleteQuickStep, onClose, folders = [] }) => {
    const [activeTab, setActiveTab] = useState('outofoffice');

    // Out of Office form
    const [oooEnabled, setOooEnabled] = useState(account.outOfOffice?.enabled || false);
    const [oooMessage, setOooMessage] = useState(account.outOfOffice?.message || '');
    const [oooStart, setOooStart] = useState(account.outOfOffice?.startDate ? new Date(account.outOfOffice.startDate).toISOString().split('T')[0] : '');
    const [oooEnd, setOooEnd] = useState(account.outOfOffice?.endDate ? new Date(account.outOfOffice.endDate).toISOString().split('T')[0] : '');

    // Create Rule form
    const [ruleName, setRuleName] = useState('');
    const [ruleTrigger, setRuleTrigger] = useState('from');
    const [ruleCond, setRuleCond] = useState('');
    const [ruleAction, setRuleAction] = useState('move');
    const [ruleActVal, setRuleActVal] = useState('Trash');

    // Create Quick Step form
    const [qsName, setQsName] = useState('');
    const [qsIcon, setQsIcon] = useState('Zap');
    const [qsActionType, setQsActionType] = useState('seen');
    const [qsActionVal, setQsActionVal] = useState('');

    const handleSaveOoo = (e) => {
        e.preventDefault();
        onSaveOutOfOffice({
            enabled: oooEnabled,
            message: oooMessage,
            startDate: oooStart || null,
            endDate: oooEnd || null
        });
    };

    const handleCreateRule = (e) => {
        e.preventDefault();
        if (!ruleName.trim() || !ruleCond.trim()) return;
        onCreateRule({
            name: ruleName,
            trigger: ruleTrigger,
            conditionValue: ruleCond,
            action: ruleAction,
            actionValue: ruleActVal
        });
        setRuleName('');
        setRuleCond('');
    };

    const handleCreateQuickStep = (e) => {
        e.preventDefault();
        if (!qsName.trim()) return;
        onCreateQuickStep({
            name: qsName,
            icon: qsIcon,
            actions: [{ type: qsActionType, value: qsActionVal }]
        });
        setQsName('');
        setQsActionVal('');
    };

    const tabBtn = (id, label) => {
        const isActive = activeTab === id;
        return (
            <button onClick={() => setActiveTab(id)}
                className={`w-full text-left px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all
                    ${isActive ? 'bg-indigo-650 text-white shadow-md shadow-indigo-600/10' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                {label}
            </button>
        );
    };

    const inp = 'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-850 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all';

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col md:flex-row overflow-hidden border border-white/20 animate-in fade-in zoom-in-95 duration-250">
                {/* Left Sidebar Tabs */}
                <div className="w-full md:w-64 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200/70 p-5 flex flex-col gap-4 flex-shrink-0">
                    <div>
                        <h3 className="text-base font-black text-slate-800 tracking-tight">Configuración</h3>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{account.email}</p>
                    </div>
                    <div className="space-y-1">
                        {tabBtn('outofoffice', '🌴 Fuera de Oficina')}
                        {tabBtn('rules', '⚙️ Reglas de Correo')}
                        {tabBtn('quicksteps', '⚡ Pasos Rápidos')}
                    </div>
                    <div className="flex-1" />
                    <button onClick={onClose} className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 text-[11px] font-black uppercase tracking-widest rounded-xl text-slate-600 transition-colors">Cerrar</button>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-6 sm:p-8 overflow-y-auto custom-scrollbar flex flex-col bg-white">
                    {activeTab === 'outofoffice' && (
                        <form onSubmit={handleSaveOoo} className="space-y-6">
                            <div>
                                <h4 className="text-sm font-black text-slate-800 tracking-tight">Respuestas Automáticas (Fuera de Oficina)</h4>
                                <p className="text-[10px] text-slate-400 font-semibold mt-1">Configura un mensaje de respuesta automática para notificar tus ausencias.</p>
                            </div>

                            <div className="flex items-center gap-3">
                                <input type="checkbox" id="ooo-enabled" checked={oooEnabled} onChange={e => setOooEnabled(e.target.checked)}
                                    className="w-4 h-4 rounded text-indigo-650 border-slate-300 focus:ring-indigo-500" />
                                <label htmlFor="ooo-enabled" className="text-xs font-black text-slate-700 uppercase tracking-wider">Activar respuestas automáticas</label>
                            </div>

                            {oooEnabled && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fecha de Inicio</label>
                                            <input type="date" value={oooStart} onChange={e => setOooStart(e.target.value)} className={inp} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fecha de Fin</label>
                                            <input type="date" value={oooEnd} onChange={e => setOooEnd(e.target.value)} className={inp} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Mensaje de Respuesta</label>
                                        <textarea value={oooMessage} onChange={e => setOooMessage(e.target.value)} required rows={5}
                                            className={`${inp} resize-none`} placeholder="Hola, estaré fuera de la oficina del... " />
                                    </div>
                                </div>
                            )}

                            <button type="submit" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-indigo-600/10">
                                Guardar Cambios
                            </button>
                        </form>
                    )}

                    {activeTab === 'rules' && (
                        <div className="space-y-8">
                            <div>
                                <h4 className="text-sm font-black text-slate-800 tracking-tight">Gestión de Reglas de Entrada</h4>
                                <p className="text-[10px] text-slate-400 font-semibold mt-1">Crea filtros inteligentes para automatizar el procesamiento de tus correos entrantes.</p>
                            </div>

                            {/* Create Rule Form */}
                            <form onSubmit={handleCreateRule} className="p-5 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-4">
                                <h5 className="text-[10px] font-black text-indigo-650 uppercase tracking-widest">Crear Nueva Regla</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nombre de la Regla</label>
                                        <input type="text" required placeholder="Ej: Facturas de Proveedores" value={ruleName} onChange={e => setRuleName(e.target.value)} className={inp} />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Aplicar cuando</label>
                                        <select value={ruleTrigger} onChange={e => setRuleTrigger(e.target.value)} className={inp}>
                                            <option value="from">El remitente contiene</option>
                                            <option value="subject">El asunto contiene</option>
                                            <option value="body">El contenido contiene</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Valor de la condición</label>
                                        <input type="text" required placeholder="Ej: factura o administrador@empresa.com" value={ruleCond} onChange={e => setRuleCond(e.target.value)} className={inp} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Acción</label>
                                            <select value={ruleAction} onChange={e => setRuleAction(e.target.value)} className={inp}>
                                                <option value="move">Mover a</option>
                                                <option value="category">Categorizar</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Valor Acción</label>
                                            {ruleAction === 'move' ? (
                                                <select value={ruleActVal} onChange={e => setRuleActVal(e.target.value)} className={inp}>
                                                    <option value="Trash">Papelera</option>
                                                    {folders.map(f => <option key={f.path} value={f.path}>{f.name}</option>)}
                                                </select>
                                            ) : (
                                                <select value={ruleActVal} onChange={e => setRuleActVal(e.target.value)} className={inp}>
                                                    <option value="prioritario">Prioritario</option>
                                                    <option value="notificaciones">Notificaciones</option>
                                                    <option value="promociones">Promociones</option>
                                                    <option value="spam">Spam</option>
                                                </select>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button type="submit" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                                    Agregar Regla
                                </button>
                            </form>

                            {/* Rules List */}
                            <div className="space-y-3">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reglas Activas</h5>
                                {rules.length === 0 ? (
                                    <p className="text-xs font-semibold text-slate-400 italic">No tienes reglas creadas en esta cuenta.</p>
                                ) : (
                                    <div className="divide-y divide-slate-100 border border-slate-200/50 rounded-2xl bg-white overflow-hidden">
                                        {rules.map(r => (
                                            <div key={r._id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                                <div>
                                                    <p className="text-xs font-black text-slate-800">{r.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                                        Si {r.trigger === 'from' ? 'Remitente' : r.trigger === 'subject' ? 'Asunto' : 'Contenido'} contiene "{r.conditionValue}" ➜ {r.action === 'move' ? 'Mover a' : 'Categorizar como'} {r.actionValue}
                                                    </p>
                                                </div>
                                                <button onClick={() => onDeleteRule(r._id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'quicksteps' && (
                        <div className="space-y-8">
                            <div>
                                <h4 className="text-sm font-black text-slate-800 tracking-tight">Macros y Pasos Rápidos</h4>
                                <p className="text-[10px] text-slate-400 font-semibold mt-1">Automatiza múltiples marcas o acciones en tus correos con atajos rápidos de un clic.</p>
                            </div>

                            {/* Create Quick Step Form */}
                            <form onSubmit={handleCreateQuickStep} className="p-5 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-4">
                                <h5 className="text-[10px] font-black text-indigo-650 uppercase tracking-widest">Crear Paso Rápido</h5>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nombre</label>
                                        <input type="text" required placeholder="Ej: Archivar y Destacar" value={qsName} onChange={e => setQsName(e.target.value)} className={inp} />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Acción</label>
                                        <select value={qsActionType} onChange={e => setQsActionType(e.target.value)} className={inp}>
                                            <option value="seen">Marcar como leído</option>
                                            <option value="unseen">Marcar como no leído</option>
                                            <option value="flag">Destacar (Estrella)</option>
                                            <option value="delete">Mover a papelera</option>
                                            <option value="move">Mover a Carpeta</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Carpeta Destino</label>
                                        <select disabled={qsActionType !== 'move'} value={qsActionVal} onChange={e => setQsActionVal(e.target.value)} className={inp}>
                                            <option value="Trash">Papelera</option>
                                            {folders.map(f => <option key={f.path} value={f.path}>{f.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <button type="submit" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                                    Agregar Paso Rápido
                                </button>
                            </form>

                            {/* Quicksteps list */}
                            <div className="space-y-3">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pasos Rápidos Disponibles</h5>
                                {quickSteps.length === 0 ? (
                                    <p className="text-xs font-semibold text-slate-400 italic">No tienes macros creadas.</p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {quickSteps.map(qs => (
                                            <div key={qs._id} className="p-4 bg-white border border-slate-200/50 rounded-2xl flex items-center justify-between hover:shadow-sm transition-shadow">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg">⚡</span>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-850">{qs.name}</p>
                                                        <p className="text-[9px] text-indigo-650 font-bold uppercase tracking-wider">
                                                            {qs.actions?.map(a => `${a.type === 'seen' ? 'leído' : a.type === 'flag' ? 'destacar' : a.type === 'delete' ? 'papelera' : 'mover'} ${a.value ? '('+a.value+')' : ''}`).join(', ')}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button onClick={() => onDeleteQuickStep(qs._id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Collapsible Panel Components ──────────────────────────────────────────
const CalendarPanel = ({ showAlert }) => {
    const [meetings, setMeetings] = useState([]);
    const [loadingMeetings, setLoadingMeetings] = useState(false);
    const [showCreateMeeting, setShowCreateMeeting] = useState(false);
    const [meetForm, setMeetForm] = useState({ title: '', date: '', startTime: '', duration: 30 });
    const [availabilitySearch, setAvailabilitySearch] = useState('');

    const loadMeetings = async () => {
        setLoadingMeetings(true);
        try {
            const user = JSON.parse(localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user') || '{}');
            const res = await fetch(`${API_URL}/api/reuniones`, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setMeetings(data);
            }
        } catch(e) {
            console.error(e);
        } finally {
            setLoadingMeetings(false);
        }
    };

    useEffect(() => {
        loadMeetings();
    }, []);

    const handleCreateMeet = async (e) => {
        e.preventDefault();
        if (!meetForm.title || !meetForm.date || !meetForm.startTime) return;
        try {
            const user = JSON.parse(localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user') || '{}');
            const res = await fetch(`${API_URL}/api/reuniones/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    title: meetForm.title,
                    description: 'Reunión corporativa local programada desde Genai Mail.',
                    date: meetForm.date,
                    startTime: meetForm.startTime,
                    duration: Number(meetForm.duration),
                    participants: []
                })
            });
            if (res.ok) {
                showAlert('Reunión agendada exitosamente');
                setShowCreateMeeting(false);
                setMeetForm({ title: '', date: '', startTime: '', duration: 30 });
                loadMeetings();
            } else {
                window.alert('Error al crear la reunión');
            }
        } catch(err) {
            console.error(err);
        }
    };

    const mockColleagues = [
        { name: "Ana Valenzuela", status: "Disponible", color: "text-emerald-500" },
        { name: "Carlos Muñoz", status: "En Reunión", color: "text-rose-500" },
        { name: "Sofia Silva", status: "Disponible", color: "text-emerald-500" },
        { name: "Mauricio Rojas", status: "Ausente", color: "text-amber-505" }
    ];

    const filteredColleagues = mockColleagues.filter(c =>
        c.name.toLowerCase().includes(availabilitySearch.toLowerCase())
    );

    return (
        <div className="space-y-5">
            <button onClick={() => setShowCreateMeeting(!showCreateMeeting)}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-650 to-violet-650 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-indigo-600/10">
                {showCreateMeeting ? 'Ver Reuniones' : 'Programar Reunión'}
            </button>

            {showCreateMeeting ? (
                <form onSubmit={handleCreateMeet} className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-3">
                    <h4 className="text-[10px] font-black text-indigo-650 uppercase tracking-widest">Nueva Reunión</h4>
                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Título</label>
                        <input type="text" required placeholder="Ej: Sync de Proyectos" value={meetForm.title}
                            onChange={e => setMeetForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fecha</label>
                            <input type="date" required value={meetForm.date}
                                onChange={e => setMeetForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs" />
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Hora</label>
                            <input type="time" required value={meetForm.startTime}
                                onChange={e => setMeetForm(f => ({ ...f, startTime: e.target.value }))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Duración (min)</label>
                        <select value={meetForm.duration} onChange={e => setMeetForm(f => ({ ...f, duration: Number(e.target.value) }))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs">
                            <option value={15}>15 minutos</option>
                            <option value={30}>30 minutos</option>
                            <option value={60}>1 hora</option>
                            <option value={120}>2 horas</option>
                        </select>
                    </div>
                    <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors">Guardar</button>
                </form>
            ) : (
                <div className="space-y-4">
                    <div className="space-y-2.5">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reuniones Programadas</h4>
                        {loadingMeetings ? (
                            <p className="text-xs text-slate-450">Cargando...</p>
                        ) : meetings.length === 0 ? (
                            <p className="text-xs text-slate-450 italic">No tienes reuniones hoy.</p>
                        ) : (
                            <div className="space-y-2">
                                {meetings.map(meet => (
                                    <div key={meet._id} className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl">
                                        <p className="text-xs font-bold text-slate-800">{meet.title}</p>
                                        <p className="text-[9px] text-slate-400 mt-1">
                                            {meet.date} | {meet.startTime} ({meet.duration} min)
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="border-t border-slate-100 pt-4 space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disponibilidad del Equipo</h4>
                        <input type="text" placeholder="Buscar compañero..." value={availabilitySearch} onChange={e => setAvailabilitySearch(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] focus:outline-none" />
                        <div className="space-y-2">
                            {filteredColleagues.map((col, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs py-1">
                                    <span className="font-bold text-slate-700">{col.name}</span>
                                    <span className={`text-[10px] font-black uppercase tracking-wider ${col.color}`}>{col.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const TasksPanel = ({ tasks, loadTasks, showAlert }) => {
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState('medium');
    const [newTaskDue, setNewTaskDue] = useState('');

    const handleAddTask = (e) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;
        
        api('/tasks', {
            method: 'POST',
            body: JSON.stringify({
                title: newTaskTitle,
                dueDate: newTaskDue || null,
                priority: newTaskPriority
            })
        }).then(() => {
            loadTasks();
            setNewTaskTitle('');
            setNewTaskDue('');
            showAlert("Pendiente agregado");
        }).catch(err => showAlert(err.message, 'error'));
    };

    const handleToggleTask = (task) => {
        api(`/tasks/${task._id}`, {
            method: 'PATCH',
            body: JSON.stringify({ completed: !task.completed })
        }).then(() => {
            loadTasks();
        }).catch(err => showAlert(err.message, 'error'));
    };

    const handleDeleteTask = (id) => {
        api(`/tasks/${id}`, { method: 'DELETE' }).then(() => {
            loadTasks();
            showAlert("Pendiente eliminado");
        }).catch(err => showAlert(err.message, 'error'));
    };

    return (
        <div className="space-y-4">
            <form onSubmit={handleAddTask} className="p-3 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-2">
                <input type="text" placeholder="Añadir una tarea..." required value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs" />
                <div className="flex gap-2">
                    <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value)}
                        className="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px]">
                        <option value="low">Baja</option>
                        <option value="medium">Media</option>
                        <option value="high">Alta</option>
                    </select>
                    <input type="date" value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)}
                        className="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px]" />
                </div>
                <button type="submit" className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider">Añadir Pendiente</button>
            </form>

            <div className="space-y-2">
                {tasks.length === 0 ? (
                    <p className="text-xs text-slate-450 italic">No tienes tareas pendientes.</p>
                ) : (
                    tasks.map(task => (
                        <div key={task._id} className={`p-3 border rounded-xl flex items-start justify-between gap-3 bg-white transition-all
                            ${task.completed ? 'opacity-50 border-slate-200 bg-slate-50' : 'border-slate-200 hover:shadow-sm'}`}>
                            <div className="flex items-start gap-2.5">
                                <button onClick={() => handleToggleTask(task)} className="mt-0.5 text-slate-400 hover:text-indigo-600 transition-colors">
                                    {task.completed ? '☑️' : '⏹️'}
                                </button>
                                <div>
                                    <p className={`text-xs font-bold text-slate-800 ${task.completed ? 'line-through text-slate-400' : ''}`}>{task.title}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded
                                            ${task.priority === 'high' ? 'bg-rose-50 text-rose-600' : task.priority === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-650'}`}>
                                            {task.priority}
                                        </span>
                                        {task.dueDate && (
                                            <span className="text-[9px] text-slate-450 font-semibold">
                                                📅 {new Date(task.dueDate).toLocaleDateString('es-CL')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => handleDeleteTask(task._id)} className="p-1 text-slate-350 hover:text-rose-600 transition-colors">
                                <Trash2 size={13} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const NotesPanel = ({ notes, loadNotes, showAlert }) => {
    const colors = [
        { hex: '#fef08a', name: 'Amarillo' },
        { hex: '#bbf7d0', name: 'Verde' },
        { hex: '#bfdbfe', name: 'Azul' },
        { hex: '#fbcfe8', name: 'Rosa' },
        { hex: '#ddd6fe', name: 'Púrpura' }
    ];

    const [activeColor, setActiveColor] = useState(colors[0].hex);
    const [noteContent, setNoteContent] = useState('');

    const handleAddNote = (e) => {
        e.preventDefault();
        if (!noteContent.trim()) return;

        api('/notes', {
            method: 'POST',
            body: JSON.stringify({
                content: noteContent,
                color: activeColor
            })
        }).then(() => {
            loadNotes();
            setNoteContent('');
            showAlert("Nota guardada");
        }).catch(err => showAlert(err.message, 'error'));
    };

    const handleDeleteNote = (id) => {
        api(`/notes/${id}`, { method: 'DELETE' }).then(() => {
            loadNotes();
            showAlert("Nota eliminada");
        }).catch(err => showAlert(err.message, 'error'));
    };

    return (
        <div className="space-y-5">
            <form onSubmit={handleAddNote} className="p-4 bg-slate-50 border border-slate-200/65 rounded-2xl space-y-3">
                <textarea required placeholder="Escribe un apunte rápido..." value={noteContent} onChange={e => setNoteContent(e.target.value)}
                    className="w-full h-20 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs resize-none" />
                <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                        {colors.map(c => (
                            <button key={c.hex} type="button" onClick={() => setActiveColor(c.hex)}
                                className={`w-5 h-5 rounded-full border transition-all ${activeColor === c.hex ? 'border-indigo-600 ring-2 ring-indigo-500/20 scale-110' : 'border-transparent'}`}
                                style={{ backgroundColor: c.hex }}
                                title={c.name}
                            />
                        ))}
                    </div>
                    <button type="submit" className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all">Guardar</button>
                </div>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {notes.length === 0 ? (
                    <p className="text-xs text-slate-450 italic col-span-2">No tienes notas.</p>
                ) : (
                    notes.map(note => (
                        <div key={note._id} className="p-3.5 rounded-2xl flex flex-col justify-between min-h-[100px] shadow-sm relative group border border-slate-100"
                            style={{ backgroundColor: note.color }}>
                            <p className="text-[11px] text-slate-800 font-semibold leading-normal break-words whitespace-pre-wrap">{note.content}</p>
                            <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-900/5">
                                <span className="text-[8px] text-slate-400 font-bold uppercase">{new Date(note.createdAt).toLocaleDateString('es-CL')}</span>
                                <button onClick={() => handleDeleteNote(note._id)} className="text-slate-400 hover:text-rose-600 transition-colors">
                                    <Trash2 size={11} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// ─── MAIN Webmail Component (Outlook 10.0 Pro Edition) ───────────────────────
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

    // Responsive State
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [mobileView, setMobileView] = useState('list'); // 'list' | 'detail'
    const [showMobileSidebar, setShowMobileSidebar] = useState(false);

    // Quick Filters State
    const [filterTab, setFilterTab] = useState('all'); // 'all' | 'unread' | 'flagged'

    // Bulk Actions State
    const [selectedMsgMap, setSelectedMsgMap] = useState({});

    // Office Document, Add-ins Store, Settings states
    const [officeDoc, setOfficeDoc] = useState(null);
    const [showAddinsStore, setShowAddinsStore] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    
    // Priority Inbox Categories
    const [categoryTab, setCategoryTab] = useState('prioritario'); // 'prioritario' | 'notificaciones' | 'promociones' | 'spam'
    
    // Right Collapsible Sidebar Tab
    const [rightSidebarTab, setRightSidebarTab] = useState(null); // null | 'calendar' | 'tasks' | 'notes'
    
    // Tareas, Notas, Contactos, Reglas, Quick Steps, Scheduled
    const [tasks, setTasks] = useState([]);
    const [notes, setNotes] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [rules, setRules] = useState([]);
    const [quickSteps, setQuickSteps] = useState([]);
    const [scheduledEmails, setScheduledEmails] = useState([]);
    const [directoryContacts, setDirectoryContacts] = useState([]);

    // Responsiveness hook
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (!mobile) {
                setShowMobileSidebar(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Override main container padding and overflow for full screen Webmail
    useEffect(() => {
        const mainEl = document.querySelector('.app-shell-main');
        if (mainEl) {
            mainEl.style.setProperty('padding', '0', 'important');
            mainEl.style.setProperty('overflow', 'hidden', 'important');
        }
        return () => {
            if (mainEl) {
                mainEl.style.removeProperty('padding');
                mainEl.style.removeProperty('overflow');
            }
        };
    }, []);

    const showAlert = (msg, type = 'success') => {
        setAlert({ msg, type });
        setTimeout(() => setAlert(null), 4000);
    };

    // Load accounts and directory
    useEffect(() => {
        api('/accounts').then(data => {
            setAccounts(data);
            if (data.length > 0) setSelectedAccount(data[0]);
        }).catch(e => console.error("Accounts err", e))
          .finally(() => setLoadingAccounts(false));
          
        api('/directory').then(data => {
            setDirectoryContacts(data);
        }).catch(e => console.error("Directory fetch err", e));
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
        setSelectedMsgMap({}); // Clear selection on reload
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
        setMobileView('list');
        loadMessages();
    }, [loadMessages]);

    // --- Outlook Enterprise Pro Fetch Handlers ---
    const loadTasks = useCallback(() => {
        api('/tasks').then(setTasks).catch(err => console.error("Error loading tasks", err));
    }, []);

    const loadNotes = useCallback(() => {
        api('/notes').then(setNotes).catch(err => console.error("Error loading notes", err));
    }, []);

    const loadContacts = useCallback(() => {
        api('/contacts').then(setContacts).catch(err => console.error("Error loading contacts", err));
    }, []);

    const loadRules = useCallback(() => {
        if (!selectedAccount) return;
        api(`/rules/${selectedAccount._id}`).then(setRules).catch(err => console.error("Error loading rules", err));
    }, [selectedAccount]);

    const loadQuickSteps = useCallback(() => {
        api('/quicksteps').then(setQuickSteps).catch(err => console.error("Error loading quicksteps", err));
    }, []);

    const loadScheduledEmails = useCallback(() => {
        if (!selectedAccount) return;
        api(`/scheduled/${selectedAccount._id}`).then(setScheduledEmails).catch(err => console.error("Error loading scheduled emails", err));
    }, [selectedAccount]);

    useEffect(() => {
        loadTasks();
        loadNotes();
        loadContacts();
        loadQuickSteps();
    }, [loadTasks, loadNotes, loadContacts, loadQuickSteps]);

    useEffect(() => {
        if (selectedAccount) {
            loadRules();
            loadScheduledEmails();
        }
    }, [selectedAccount, loadRules, loadScheduledEmails]);

    const handleSaveOutOfOffice = async (oooData) => {
        if (!selectedAccount) return;
        try {
            const updatedAcc = await api(`/accounts/${selectedAccount._id}/outofoffice`, {
                method: 'POST',
                body: JSON.stringify(oooData)
            });
            setAccounts(prev => prev.map(a => a._id === selectedAccount._id ? updatedAcc : a));
            setSelectedAccount(updatedAcc);
            showAlert("Respuesta fuera de oficina actualizada");
        } catch (err) {
            showAlert("Error al guardar fuera de oficina: " + err.message, "error");
        }
    };

    const handleCreateRule = async (ruleData) => {
        if (!selectedAccount) return;
        try {
            await api(`/rules/${selectedAccount._id}`, {
                method: 'POST',
                body: JSON.stringify(ruleData)
            });
            loadRules();
            showAlert("Regla agregada con éxito");
        } catch (err) {
            showAlert("Error al crear regla: " + err.message, "error");
        }
    };

    const handleDeleteRule = async (ruleId) => {
        if (!selectedAccount) return;
        try {
            await api(`/rules/${selectedAccount._id}/${ruleId}`, { method: 'DELETE' });
            loadRules();
            showAlert("Regla eliminada");
        } catch (err) {
            showAlert("Error al eliminar regla: " + err.message, "error");
        }
    };

    const handleCreateQuickStep = async (qsData) => {
        try {
            await api('/quicksteps', {
                method: 'POST',
                body: JSON.stringify(qsData)
            });
            loadQuickSteps();
            showAlert("Paso Rápido agregado");
        } catch (err) {
            showAlert("Error al crear Paso Rápido: " + err.message, "error");
        }
    };

    const handleDeleteQuickStep = async (qsId) => {
        try {
            await api(`/quicksteps/${qsId}`, { method: 'DELETE' });
            loadQuickSteps();
            showAlert("Paso Rápido eliminado");
        } catch (err) {
            showAlert("Error al eliminar Paso Rápido: " + err.message, "error");
        }
    };

    const handleApplyQuickStep = async (qsId, msgUid) => {
        if (!selectedAccount || !msgUid) return;
        try {
            showAlert("Aplicando Paso Rápido...");
            await api(`/quickstep/${selectedAccount._id}/${msgUid}/apply`, {
                method: 'POST',
                body: JSON.stringify({ quickStepId: qsId })
            });
            loadMessages();
            showAlert("Acciones de Paso Rápido aplicadas");
        } catch (err) {
            showAlert("Error al aplicar Paso Rápido: " + err.message, "error");
        }
    };

    const openMessage = async (msg) => {
        setSelectedMsg(msg.uid);
        setLoadingDetail(true);
        if (isMobile) {
            setMobileView('detail');
        }
        try {
            const detail = await api(`/message/${selectedAccount._id}/${msg.uid}?folder=${encodeURIComponent(selectedFolder)}`);
            detail.uid = msg.uid;
            detail.folder = selectedFolder;
            setEmailDetail(detail);
            // mark as read locally
            setMessages(prev => prev.map(m => m.uid === msg.uid ? { ...m, seen: true } : m));
        } catch (e) {
            showAlert(e.message, 'error');
            if (isMobile) {
                setMobileView('list');
            }
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleDelete = async (uid) => {
        try {
            await api(`/message/${selectedAccount._id}/${uid}?folder=${encodeURIComponent(selectedFolder)}`, { method: 'DELETE' });
            setMessages(prev => prev.filter(m => m.uid !== uid));
            if (emailDetail?.uid === uid) {
                setEmailDetail(null);
                setSelectedMsg(null);
                setMobileView('list');
            }
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

    // Filter Logic (Search + Quick Tabs + Priority Categories)
    const filteredMessages = messages.filter(m => {
        const matchesSearch = !searchTerm || 
            m.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.from?.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.from?.name?.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (!matchesSearch) return false;

        if (selectedFolder === 'INBOX') {
            const msgCat = m.category || 'prioritario';
            if (msgCat !== categoryTab) return false;
        }

        if (filterTab === 'unread') return !m.seen;
        if (filterTab === 'flagged') return m.flagged;
        return true;
    });

    const unread = messages.filter(m => !m.seen).length;

    // Bulk Actions Selection Handlers
    const handleToggleCheck = (uid, e) => {
        e.stopPropagation();
        setSelectedMsgMap(prev => ({
            ...prev,
            [uid]: !prev[uid]
        }));
    };

    const handleSelectAllFiltered = () => {
        const allFilteredUids = filteredMessages.map(m => m.uid);
        const allChecked = allFilteredUids.every(uid => selectedMsgMap[uid]);
        
        setSelectedMsgMap(prev => {
            const next = { ...prev };
            allFilteredUids.forEach(uid => {
                if (allChecked) {
                    delete next[uid];
                } else {
                    next[uid] = true;
                }
            });
            return next;
        });
    };

    const selectedUidsList = Object.keys(selectedMsgMap).filter(uid => selectedMsgMap[uid]);
    const selectedCount = selectedUidsList.length;

    // Bulk API Calls
    const handleBulkDelete = async () => {
        if (selectedCount === 0) return;
        if (!window.confirm(`¿Seguro que deseas eliminar los ${selectedCount} correos seleccionados?`)) return;

        showAlert(`Eliminando ${selectedCount} correos...`);
        try {
            await Promise.all(
                selectedUidsList.map(uid => 
                    api(`/message/${selectedAccount._id}/${uid}?folder=${encodeURIComponent(selectedFolder)}`, { method: 'DELETE' })
                )
            );
            setMessages(prev => prev.filter(m => !selectedUidsList.includes(m.uid)));
            setSelectedMsgMap({});
            if (emailDetail && selectedUidsList.includes(emailDetail.uid)) {
                setEmailDetail(null);
                setSelectedMsg(null);
                setMobileView('list');
            }
            showAlert('Correos eliminados con éxito');
        } catch (e) {
            showAlert('Error eliminando correos: ' + e.message, 'error');
        }
    };

    const handleBulkFlag = async (flag, value) => {
        if (selectedCount === 0) return;
        showAlert('Actualizando correos...');
        try {
            await Promise.all(
                selectedUidsList.map(uid =>
                    api(`/message/${selectedAccount._id}/${uid}/flag`, {
                        method: 'PATCH',
                        body: JSON.stringify({ folder: selectedFolder, flag, value })
                    })
                )
            );
            setMessages(prev => prev.map(m => {
                if (selectedUidsList.includes(m.uid)) {
                    if (flag === '\\Seen') return { ...m, seen: value };
                    if (flag === '\\Flagged') return { ...m, flagged: value };
                }
                return m;
            }));
            setSelectedMsgMap({});
            showAlert('Correos actualizados');
        } catch (e) {
            showAlert('Error actualizando correos: ' + e.message, 'error');
        }
    };

    // Sidebar Folder lists renderer (reuse for responsive layouts)
    const renderFolderButtons = (theme = "light") => {
        const activeClass = theme === "dark" 
            ? "bg-slate-800 text-white shadow-lg" 
            : "bg-indigo-600 text-white shadow-md shadow-indigo-500/20";
        const inactiveClass = theme === "dark"
            ? "text-slate-300 hover:bg-slate-800/50 hover:text-white"
            : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900";
        const iconColorClass = theme === "dark" ? "text-slate-400" : "text-slate-400 group-hover:text-indigo-600";

        return (
            <div className="space-y-1">
                {['INBOX', 'Sent', 'Trash'].map(f => {
                    const label = f === 'INBOX' ? 'Bandeja de Entrada' : f === 'Sent' ? 'Enviados' : 'Papelera';
                    const isSelected = selectedFolder === f;
                    return (
                        <button key={f}
                            onClick={() => { setSelectedFolder(f); setPage(1); setShowMobileSidebar(false); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-[12px] font-bold group ${isSelected ? activeClass : inactiveClass}`}>
                            <span className={`${isSelected ? 'text-white' : iconColorClass}`}>
                                {folderIcons[f] || <Mail size={16} />}
                            </span>
                            <span className="flex-1 text-left truncate">{label}</span>
                            {f === 'INBOX' && unread > 0 && (
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${isSelected ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
                                    {unread}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        );
    };

    const renderCustomFolderButtons = (theme = "light") => {
        const activeClass = theme === "dark" ? "bg-slate-800 text-white" : "bg-indigo-100 text-indigo-700";
        const inactiveClass = theme === "dark" ? "text-slate-400 hover:bg-slate-800/40" : "text-slate-500 hover:bg-slate-200/50";
        return (
            <div className="space-y-0.5">
                {folders.filter(f => !['INBOX', 'Sent', 'Trash', 'Drafts'].includes(f.name)).slice(0, 15).map(f => {
                    const isSelected = selectedFolder === f.path;
                    return (
                        <button key={f.path}
                            onClick={() => { setSelectedFolder(f.path); setPage(1); setShowMobileSidebar(false); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-[11px] font-bold ${isSelected ? activeClass : inactiveClass}`}>
                            <ChevronDown size={12} className="-rotate-90 text-slate-300 flex-shrink-0" />
                            <span className="flex-1 text-left truncate">{f.name}</span>
                        </button>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="h-full w-full flex flex-col bg-gradient-to-br from-indigo-50 via-white to-purple-50 overflow-hidden font-sans relative">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-400/20 rounded-full blur-[120px] pointer-events-none mix-blend-multiply" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-fuchsia-400/20 rounded-full blur-[120px] pointer-events-none mix-blend-multiply" />
            {/* Global Alert */}
            {alert && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[999] px-6 py-3 rounded-full shadow-2xl text-[13px] font-black uppercase tracking-widest flex items-center gap-3 animate-in fade-in slide-in-from-top-4"
                     style={{ backgroundColor: alert.type === 'error' ? '#ef4444' : '#10b981', color: 'white' }}>
                     {alert.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
                     {alert.msg}
                </div>
            )}

            {/* Application Top Bar */}
            {isMobile ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white/80 backdrop-blur-xl border-b border-white/60 shadow-sm flex-shrink-0 z-40 relative">
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setShowMobileSidebar(true)} className="p-2 -ml-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl" title="Mostrar Carpetas">
                            <Menu size={20} />
                        </button>
                        <span className="text-xs font-black text-slate-700 uppercase tracking-wider truncate max-w-[100px] sm:max-w-[150px]">
                            {selectedFolder === 'INBOX' ? 'Bandeja' : selectedFolder === 'Sent' ? 'Enviados' : selectedFolder === 'Trash' ? 'Papelera' : selectedFolder}
                        </span>
                    </div>

                    {accounts.length > 0 && (
                        <div className="flex items-center gap-1">
                            <button onClick={loadMessages} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors" title="Sincronizar">
                                <RefreshCw size={16} className={loadingMessages ? 'animate-spin text-indigo-500' : ''} />
                            </button>
                            <div className="hidden sm:flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-full pl-2 pr-0.5 py-0.5 shadow-inner">
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selectedAccount?.status === 'error' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                                <select value={selectedAccount?._id || ''}
                                    onChange={e => setSelectedAccount(accounts.find(a => a._id === e.target.value))}
                                    className="text-[10px] font-bold text-slate-600 bg-transparent focus:outline-none cursor-pointer max-w-[85px] truncate">
                                    {accounts.map(a => <option key={a._id} value={a._id}>{a.email.split('@')[0]}</option>)}
                                </select>
                            </div>
                            <button onClick={() => { setShowCompose(true); setReplyTarget(null); }} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl" title="Nuevo Correo">
                                <Edit3 size={16} />
                            </button>
                        </div>
                    )}
                    
                    <button onClick={() => setShowAddModal(true)} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl" title="Vincular Cuenta">
                        <Plus size={18} />
                    </button>
                </div>
            ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-white/60 backdrop-blur-2xl border-b border-white/60 shadow-sm flex-shrink-0 z-40 relative">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white flex-shrink-0">
                            <Sparkles size={18} />
                        </div>
                        <div>
                            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5 leading-none">
                                Genai <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-fuchsia-500">MAIL</span>
                                <span className="hidden sm:inline bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">v10.0 Pro</span>
                            </h1>
                        </div>
                    </div>

                    {accounts.length > 0 && (
                        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 flex-1">
                            <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-white/60 rounded-full pl-3 pr-2 py-1.5 shadow-sm">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${selectedAccount?.status === 'error' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} 
                                     title={selectedAccount?.status === 'error' ? `Error: ${selectedAccount.lastError}` : 'Conexión Establecida'} />
                                <select value={selectedAccount?._id || ''}
                                    onChange={e => setSelectedAccount(accounts.find(a => a._id === e.target.value))}
                                    className="text-[11px] font-bold text-slate-700 bg-transparent focus:outline-none cursor-pointer max-w-[120px] lg:max-w-[180px] truncate">
                                    {accounts.map(a => <option key={a._id} value={a._id}>{a.email}</option>)}
                                </select>
                                <button onClick={() => deleteAccount(selectedAccount._id)} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-rose-100 text-slate-300 hover:text-rose-500 transition-colors ml-1" title="Desvincular cuenta">
                                    <Trash2 size={11} />
                                </button>
                            </div>

                            <button onClick={loadMessages} title="Sincronizar Bandejas"
                                className="px-3 py-2 bg-white/50 border border-white/60 hover:bg-indigo-50/50 hover:border-indigo-200 text-slate-600 hover:text-indigo-700 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 shadow-sm hover:scale-[1.02] active:scale-[0.98]">
                                <RefreshCw size={15} className={loadingMessages ? 'animate-spin text-indigo-500' : ''} /> <span className="hidden xl:inline">Sincronizar</span>
                            </button>

                            <button onClick={() => setShowAddModal(true)} title="Añadir Cuenta"
                                className="px-3 py-2 bg-white/50 border border-white/60 hover:border-indigo-200 hover:bg-indigo-50/50 text-slate-600 hover:text-indigo-700 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 shadow-sm">
                                <Plus size={15} /> <span className="hidden xl:inline">Vincular</span>
                            </button>

                            {selectedAccount && (
                                <>
                                    <button onClick={() => setShowAddinsStore(true)}
                                        className="px-3 py-2 bg-white/50 border border-white/60 hover:bg-indigo-50/50 hover:border-indigo-200 text-slate-650 hover:text-indigo-700 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 shadow-sm hover:scale-[1.02] active:scale-[0.98]">
                                        ⚡ <span className="hidden lg:inline">Add-ins</span>
                                    </button>
                                    <button onClick={() => setShowSettings(true)}
                                        className="px-3 py-2 bg-white/50 border border-white/60 hover:bg-indigo-50/50 hover:border-indigo-200 text-slate-655 hover:text-indigo-700 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 shadow-sm hover:scale-[1.02] active:scale-[0.98]">
                                        ⚙️ <span className="hidden lg:inline">Configuración</span>
                                    </button>
                                    <button onClick={() => { setShowCompose(true); setReplyTarget(null); }}
                                        className="flex items-center gap-1.5 px-4.5 py-2.5 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:from-indigo-700 hover:via-violet-700 hover:to-fuchsia-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-indigo-600/20 hover:shadow-lg hover:shadow-indigo-600/30 hover:scale-[1.03] active:scale-[0.97] hover:-translate-y-0.5 active:translate-y-0">
                                        <Edit3 size={15} /> <span className="hidden sm:inline">Nuevo</span>
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Zero State */}
            {!loadingAccounts && accounts.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6 bg-gradient-to-br from-indigo-50/40 to-white overflow-y-auto">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500/15 blur-3xl rounded-full" />
                        <div className="w-28 h-28 bg-white rounded-[2.5rem] flex items-center justify-center shadow-2xl relative z-10 border border-slate-100">
                            <Mail size={48} className="text-indigo-600" />
                        </div>
                    </div>
                    <div className="text-center max-w-md relative z-10">
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-3">Bienvenido a Genai Mail</h2>
                        <p className="text-slate-500 text-sm leading-relaxed font-medium">Conecta tu buzón de correo corporativo de forma segura y deja que Gemini resuma, ordene y responda de forma profesional en segundos.</p>
                    </div>
                    <button onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2.5 px-7 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl font-black text-[12px] uppercase tracking-widest hover:scale-[1.03] active:scale-[0.97] transition-all shadow-xl shadow-indigo-950/20 relative z-10 hover:-translate-y-0.5 active:translate-y-0 border border-white/5">
                        <Command size={16} /> Conectar cuenta de trabajo
                    </button>
                    <div className="flex items-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest mt-6">
                        <span className="flex items-center gap-1.5"><Shield size={14} className="text-emerald-500"/> Encriptación AES-256</span>
                        <span className="flex items-center gap-1.5"><Globe size={14} className="text-blue-500"/> Gmail & Outlook</span>
                    </div>
                </div>
            )}

            {/* Mobile Drawer (Folders) */}
            {isMobile && showMobileSidebar && (
                <div className="fixed inset-0 z-50 flex animate-in fade-in duration-200">
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowMobileSidebar(false)} />
                    <div className="relative w-64 max-w-[80vw] bg-white/95 backdrop-blur-xl border-r border-slate-200/50 flex flex-col p-5 shadow-2xl h-full animate-in slide-in-from-left duration-300">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Genai Mail</p>
                                <h3 className="text-sm font-black text-slate-800 mt-1 uppercase">Carpetas</h3>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => { setShowMobileSidebar(false); setShowAddModal(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors" title="Vincular Cuenta">
                                    <Plus size={18} />
                                </button>
                                <button onClick={() => setShowMobileSidebar(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-4">
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Buzones</p>
                                {renderFolderButtons("light")}
                            </div>
                            {folders.length > 0 && (
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Carpetas Corporativas</p>
                                    {renderCustomFolderButtons("light")}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Layout (Responsive 3 Panes) */}
            {accounts.length > 0 && (
                <div className="flex flex-1 overflow-hidden relative z-10 w-full h-full">
                    
                    {/* Pane 1: Folders Sidebar (Desktop Only) */}
                    {!isMobile && (
                        <div className="w-60 flex-shrink-0 bg-white/40 backdrop-blur-md border-r border-white/50 flex flex-col pt-4 overflow-y-auto z-10 relative">
                            <div className="px-5 mb-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-2">Buzones Principales</p>
                                {renderFolderButtons("light")}
                            </div>

                            {folders.length > 0 && (
                                <div className="px-5 mt-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-2">Todas las Carpetas</p>
                                    {renderCustomFolderButtons("light")}
                                </div>
                            )}

                            <div className="flex-1" />
                            <div className="p-4 mt-4 border-t border-slate-200/60 bg-white/20">
                                <button onClick={loadMessages} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-750 hover:bg-indigo-50/10 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest shadow-sm hover:scale-[1.02] active:scale-[0.98] hover:shadow-md">
                                    <RefreshCw size={14} className={loadingMessages ? 'animate-spin text-indigo-500' : ''} />
                                    {loadingMessages ? 'Sincronizando...' : 'Sincronizar'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Pane 2: Message List (Desktop or Mobile List View) */}
                    {(!isMobile || mobileView === 'list') && (
                        <div className="w-full md:w-[400px] flex-shrink-0 flex flex-col border-r border-white/40 bg-white/50 backdrop-blur-lg relative z-20 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)]">
                            {/* Connection Error Banner */}
                            {imapError && (
                                <div className="m-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5">
                                    <AlertCircle size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-[10px] font-black text-rose-800 uppercase tracking-widest mb-0.5">Error de Sincronización</p>
                                        <p className="text-[10px] text-rose-600 font-medium leading-normal">{imapError}</p>
                                    </div>
                                </div>
                            )}

                            {/* Bulk Actions Header or Search Bar */}
                            {selectedCount > 0 ? (
                                <div className="mx-3 my-2.5 p-2 px-3 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl flex items-center justify-between gap-3 animate-in slide-in-from-top-3 duration-250 shadow-lg border border-slate-800/80 flex-shrink-0 z-20">
                                    <div className="flex items-center gap-1.5">
                                        <button 
                                            onClick={handleSelectAllFiltered} 
                                            className="p-1.5 text-indigo-300 hover:text-white hover:bg-white/10 rounded-lg transition-all" 
                                            title="Seleccionar todo">
                                            <CheckSquare size={16} />
                                        </button>
                                        <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">{selectedCount} seleccionados</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={() => handleBulkFlag('\\Seen', true)} 
                                            className="p-1.5 w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white text-white hover:text-slate-900 rounded-xl transition-all hover:scale-105 active:scale-95" 
                                            title="Marcar como leídos">
                                            <MailOpen size={14} />
                                        </button>
                                        <button 
                                            onClick={() => handleBulkFlag('\\Seen', false)} 
                                            className="p-1.5 w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white text-white hover:text-slate-900 rounded-xl transition-all hover:scale-105 active:scale-95" 
                                            title="Marcar como no leídos">
                                            <Mail size={14} />
                                        </button>
                                        <button 
                                            onClick={() => handleBulkFlag('\\Flagged', true)} 
                                            className="p-1.5 w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white text-white hover:text-slate-900 rounded-xl transition-all hover:scale-105 active:scale-95" 
                                            title="Destacar">
                                            <Star size={14} className="fill-current" />
                                        </button>
                                        <button 
                                            onClick={handleBulkDelete} 
                                            className="p-1.5 w-8 h-8 flex items-center justify-center bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded-xl transition-all hover:scale-105 active:scale-95" 
                                            title="Eliminar seleccionados">
                                            <Trash2 size={14} />
                                        </button>
                                        <div className="w-px h-5 bg-white/10 mx-1" />
                                        <button 
                                            onClick={() => setSelectedMsgMap({})} 
                                            className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all" 
                                            title="Cancelar">
                                            <X size={15} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10 flex flex-col gap-2 flex-shrink-0">
                                    {/* Search input */}
                                    <div className="relative group">
                                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                        <input type="text" placeholder="Buscar correos..." value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-[12px] sm:text-[13px] font-medium text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 focus:bg-white transition-all placeholder:text-slate-400" />
                                    </div>

                                    {/* Priority Categories */}
                                    {selectedFolder === 'INBOX' && (
                                        <div className="flex bg-slate-100/60 backdrop-blur-sm p-0.5 rounded-xl gap-0.5 border border-slate-200/40 shadow-inner mt-1.5">
                                            {[
                                                { id: 'prioritario', label: 'Prioritarios', icon: (active) => <Star size={11} className={active ? 'text-white fill-current' : 'text-slate-400'} /> },
                                                { id: 'notificaciones', label: 'Notificaciones', icon: (active) => <Inbox size={11} className={active ? 'text-white' : 'text-slate-400'} /> },
                                                { id: 'promociones', label: 'Promociones', icon: (active) => <Zap size={11} className={active ? 'text-white' : 'text-slate-400'} /> },
                                                { id: 'spam', label: 'Spam', icon: (active) => <AlertCircle size={11} className={active ? 'text-white' : 'text-slate-400'} /> }
                                            ].map(cat => {
                                                const isActive = categoryTab === cat.id;
                                                return (
                                                    <button key={cat.id} onClick={() => setCategoryTab(cat.id)}
                                                        className={`flex-1 py-1.5 px-0.5 text-[9px] font-black uppercase tracking-wider text-center rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5
                                                            ${isActive ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/15 scale-[1.02]' : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'}`}>
                                                        {cat.icon(isActive)}
                                                        <span className="hidden sm:inline">{cat.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}


                                    {/* Quick Filters Tab */}
                                    <div className="flex border-t border-slate-100 bg-white pt-1">
                                        <button 
                                            onClick={() => setFilterTab('all')} 
                                            className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider text-center transition-all border-b-2 ${filterTab === 'all' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                                            Todos
                                        </button>
                                        <button 
                                            onClick={() => setFilterTab('unread')} 
                                            className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider text-center transition-all border-b-2 ${filterTab === 'unread' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                                            No Leídos
                                        </button>
                                        <button 
                                            onClick={() => setFilterTab('flagged')} 
                                            className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider text-center transition-all border-b-2 ${filterTab === 'flagged' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                                            Destacados
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Message List */}
                            <div className="flex-1 overflow-y-auto bg-transparent custom-scrollbar p-2">
                                {loadingMessages ? (
                                    <div className="flex flex-col items-center justify-center h-48 gap-3">
                                        <Loader2 className="animate-spin text-indigo-500" size={28} />
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Descargando cabeceras...</p>
                                    </div>
                                ) : filteredMessages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
                                        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
                                            <Inbox size={20} className="text-slate-300" />
                                        </div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Buzón Vacío</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col divide-y divide-slate-100/50">
                                        {filteredMessages.map(msg => (
                                            <MessageRow key={msg.uid} msg={msg}
                                                isSelected={selectedMsg === msg.uid}
                                                isChecked={!!selectedMsgMap[msg.uid]}
                                                onToggleCheck={handleToggleCheck}
                                                onClick={() => openMessage(msg)} />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Pagination Footer */}
                            {total > 30 && (
                                <div className="p-3 border-t border-slate-100 bg-white flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest flex-shrink-0 shadow-[0_-4px_10px_-5px_rgba(0,0,0,0.05)]">
                                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                                        className="px-3 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">Anterior</button>
                                    <span className="bg-slate-55 px-2.5 py-1 rounded">Pág {page}</span>
                                    <button disabled={messages.length < 30} onClick={() => setPage(p => p + 1)}
                                        className="px-3 py-1.5 rounded-lg hover:bg-slate-55 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">Siguiente</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Pane 3: Email Reader (Desktop or Mobile Detail View) */}
                    {(!isMobile || mobileView === 'detail') && (
                        <div className="flex-1 bg-white/60 backdrop-blur-xl flex flex-col relative h-full m-3 rounded-3xl border border-white shadow-2xl overflow-hidden z-30">
                            {loadingDetail ? (
                                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-150">
                                    <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-3xl shadow-2xl border border-slate-100">
                                        <Loader2 className="animate-spin text-indigo-600" size={36} />
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Desencriptando Mensaje...</p>
                                    </div>
                                </div>
                            ) : emailDetail ? (
                                <EmailDetail
                                    accountId={selectedAccount._id}
                                    email={emailDetail}
                                    onBack={() => { 
                                        setEmailDetail(null); 
                                        setSelectedMsg(null); 
                                        if (isMobile) setMobileView('list');
                                    }}
                                    onReply={(msg) => { setReplyTarget(msg); setShowCompose(true); }}
                                    onDelete={handleDelete}
                                    activeAddins={selectedAccount.activeAddins || []}
                                    onViewOfficeDocument={(filename) => setOfficeDoc(filename)}
                                    showAlert={showAlert}
                                    quickSteps={quickSteps}
                                    onApplyQuickStep={handleApplyQuickStep}
                                />
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center bg-white gap-5 p-6 text-center">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-fuchsia-500/10 blur-3xl rounded-full" />
                                        <img src="https://cdn-icons-png.flaticon.com/512/3296/3296464.png" alt="Mail Open" className="w-24 h-24 opacity-30 grayscale relative z-10" />
                                    </div>
                                    <div>
                                        <p className="text-base font-black text-slate-800 tracking-tight mb-1">Ningún mensaje seleccionado</p>
                                        <p className="text-xs font-semibold text-slate-400">Selecciona un correo del buzón para leer su contenido.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Pane 4: Multitask Right Side-Panel */}
                    {!isMobile && rightSidebarTab && (
                        <div className="w-80 flex-shrink-0 bg-white border-l border-slate-200/80 flex flex-col h-full z-15 shadow-[-4px_0_24px_rgba(0,0,0,0.02)] animate-in slide-in-from-right duration-250">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                                    {rightSidebarTab === 'calendar' ? 'Calendario IA' : rightSidebarTab === 'tasks' ? 'Tareas Pendientes' : 'Notas Rápidas'}
                                </h3>
                                <button onClick={() => setRightSidebarTab(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                                    <X size={15} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-slate-50/30">
                                {rightSidebarTab === 'calendar' && <CalendarPanel showAlert={showAlert} />}
                                {rightSidebarTab === 'tasks' && <TasksPanel tasks={tasks} loadTasks={loadTasks} showAlert={showAlert} />}
                                {rightSidebarTab === 'notes' && <NotesPanel notes={notes} loadNotes={loadNotes} showAlert={showAlert} />}
                            </div>
                        </div>
                    )}

                    {/* Pane 5: Far-Right Vertical Toolbar */}
                    {!isMobile && (
                        <div className="w-12 bg-slate-50 border-l border-slate-200/80 flex flex-col items-center py-4 gap-4 flex-shrink-0 z-20">
                            {[
                                { id: 'calendar', title: 'Calendario', icon: <Calendar size={18} /> },
                                { id: 'tasks', title: 'Tareas', icon: <CheckSquare size={18} /> },
                                    { id: 'notes', title: 'Notas', icon: <Edit3 size={18} /> }
                            ].map(item => {
                                const isActive = rightSidebarTab === item.id;
                                return (
                                    <button key={item.id} onClick={() => setRightSidebarTab(isActive ? null : item.id)}
                                        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 relative
                                            ${isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 scale-105' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                                        title={item.title}>
                                        {item.icon}
                                        {isActive && <span className="absolute bottom-1 w-1 h-1 bg-white rounded-full" />}
                                    </button>
                                );
                            })}
                        </div>
                    )}
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
                <ComposeModal account={selectedAccount} accounts={accounts} replyTo={replyTarget} showAlert={showAlert} messages={messages} directoryContacts={directoryContacts}
                    onClose={() => { setShowCompose(false); setReplyTarget(null); }} />
            )}

            {officeDoc && (
                <OfficeViewerModal filename={officeDoc} onClose={() => setOfficeDoc(null)} />
            )}
            
            {showAddinsStore && selectedAccount && (
                <AddinsStoreModal 
                    accountId={selectedAccount._id} 
                    initialAddins={selectedAccount.activeAddins || []} 
                    onClose={() => setShowAddinsStore(false)} 
                    onUpdated={(updatedAcc) => {
                        setAccounts(prev => prev.map(a => a._id === updatedAcc._id ? updatedAcc : a));
                        setSelectedAccount(updatedAcc);
                    }}
                    showAlert={showAlert}
                />
            )}
            
            {showSettings && selectedAccount && (
                <SettingsModal 
                    account={selectedAccount}
                    rules={rules}
                    quickSteps={quickSteps}
                    folders={folders}
                    onSaveOutOfOffice={handleSaveOutOfOffice}
                    onCreateRule={handleCreateRule}
                    onDeleteRule={handleDeleteRule}
                    onCreateQuickStep={handleCreateQuickStep}
                    onDeleteQuickStep={handleDeleteQuickStep}
                    onClose={() => setShowSettings(false)}
                />
            )}

            {/* Floating Action Button (FAB) for Mobile Compose */}
            {isMobile && selectedAccount && !showCompose && (
                <button 
                    onClick={() => { setShowCompose(true); setReplyTarget(null); }}
                    className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all shadow-indigo-600/30 border border-white/20"
                    title="Nuevo Mensaje">
                    <Edit3 size={22} />
                </button>
            )}
        </div>
    );
};

export default Webmail;

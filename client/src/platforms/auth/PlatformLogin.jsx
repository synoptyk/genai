import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Lock, Mail, Loader2, Eye, EyeOff, Zap, ArrowRight,
    Activity, ShieldCheck, TrendingUp, Layers, BrainCircuit,
    Building2, User, UserPlus, CheckCircle2, Globe,
    Network, ChevronLeft
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { formatRut, validateRut } from '../../utils/rutUtils';
import { BRAND } from '../../branding/brand';
import axios from 'axios';

const PLATFORM_AREAS = [
    { icon: Activity, label: 'Control Operativo', desc: 'KPIs en Tiempo Real', tag: '99.9%', colorHex: '#00bcd4', bgGradient: 'linear-gradient(135deg, #00bcd4, #0284c7)' },
    { icon: ShieldCheck, label: 'Control Preventivo', desc: 'AST, EPP & HSE', tag: '-74%', colorHex: '#00897b', bgGradient: 'linear-gradient(135deg, #00897b, #10b981)' },
    { icon: TrendingUp, label: 'Control Productivo', desc: 'Eficiencia por Proceso', tag: '+43%', colorHex: '#f59e0b', bgGradient: 'linear-gradient(135deg, #d97706, #f59e0b)' },
    { icon: Layers, label: 'Áreas de Soporte', desc: 'Flota, Logística, RRHH', tag: '360°', colorHex: '#10b981', bgGradient: 'linear-gradient(135deg, #10b981, #059669)' },
    { icon: BrainCircuit, label: 'Asistente IA Enterprise', desc: 'Inteligencia Autónoma', tag: 'AI v8', colorHex: '#00bcd4', bgGradient: 'linear-gradient(135deg, #00bcd4, #5c35d4)' },
    { icon: Network, label: 'Integraciones Cloud', desc: 'SII, SAP & Ecosistema', tag: 'Sync', colorHex: '#f59e0b', bgGradient: 'linear-gradient(135deg, #f59e0b, #00bcd4)' },
];

const PlatformLogin = () => {
    const navigate = useNavigate();
    const [remember, setRemember] = useState(false);
    const { login, register, verifyPin, API_BASE } = useAuth();
    const [mode, setMode] = useState('login'); // login, register, pin, forgot-password
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // PIN state
    const [pin, setPin] = useState('');
    const [pendingEmail, setPendingEmail] = useState('');

    // Login / Forgot state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [forgotEmail, setForgotEmail] = useState('');

    // Register state
    const [regName, setRegName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');

    const hasPermission = (bag, key) => {
        if (!bag || !key) return false;
        const grant = bag instanceof Map ? bag.get(key) : bag[key];
        return grant?.ver === true;
    };
    const [regEmpresa, setRegEmpresa] = useState('');
    const [regRut, setRegRut] = useState('');
    const [regCargo, setRegCargo] = useState('');
    const countries = BRAND.countries?.join(', ') || 'LATAM';

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await login(email, password, remember);
            
            if (data.requirePin) {
                setPendingEmail(email);
                setMode('pin');
                setLoading(false);
                return;
            }

            handleLoginRedirect(data);
        } catch (err) {
            setError(err.response?.data?.message || 'Credenciales incorrectas. Por favor verifica tus datos.');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);
        try {
            const { data } = await axios.post(`${API_BASE}/auth/forgot-password`, { email: forgotEmail });
            setSuccessMsg(data.message);
        } catch (err) {
            setError(err.response?.data?.message || 'Error al enviar el correo.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyPin = async (val) => {
        setError('');
        setLoading(true);
        try {
            const data = await verifyPin(pendingEmail, val, remember);
            handleLoginRedirect(data);
        } catch (err) {
            setError(err.response?.data?.message || 'PIN incorrecto. Intenta de nuevo.');
            setPin('');
        } finally {
            setLoading(false);
        }
    };

    const handleLoginRedirect = (data) => {
        if (data.role === 'system_admin' || data.role === 'ceo') {
            navigate('/ceo/command-center');
        } else {
            const permissionSource = data.role === 'admin'
                ? (data?.empresaRef?.permisosModulos || data?.permisosModulos || {})
                : (data?.permisosModulos || {});

            const landingByPriority = [
                { key: 'op_supervision', path: '/operaciones/portal-supervision' },
                { key: 'op_colaborador', path: '/operaciones/portal-colaborador' },
                { key: 'admin_resumen_ejecutivo', path: '/dashboard' },
                { key: 'rrhh_captura', path: '/rrhh/captura-talento' },
                { key: 'rrhh_documental', path: '/rrhh/gestion-documental' },
                { key: 'rrhh_activos', path: '/rrhh/personal-activo' },
                { key: 'flota_vehiculos', path: '/flota' },
                { key: 'rend_operativo', path: '/rendimiento' },
                { key: 'logistica_dashboard', path: '/logistica' },
                { key: 'ai_asistente', path: '/ai/asistente' },
                { key: 'cfg_empresa', path: '/configuracion-empresa' }
            ];

            const firstAllowed = landingByPriority.find(({ key }) => hasPermission(permissionSource, key));
            if (!firstAllowed) {
                setError('Tu cuenta no tiene módulos habilitados. Solicita al CEO activar permisos para tu empresa/usuario en System Command Center.');
                return;
            }
            navigate(firstAllowed.path);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await register({
                name: regName, email: regEmail, password: regPassword,
                cargo: regCargo,
                empresa: { nombre: regEmpresa, rut: regRut }
            });
            navigate('/configuracion-empresa');
        } catch (err) {
            setError(err.response?.data?.message || 'Error en el registro. Intente de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-white font-sans antialiased relative overflow-hidden">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                body { font-family: 'Inter', sans-serif; }
                .gradient-panel {
                  background: linear-gradient(150deg, #022b3a 0%, #004d40 45%, #0b1a30 100%);
                }
                .btn-primary {
                  background: linear-gradient(135deg, #00bcd4 0%, #00897b 100%);
                  color: #ffffff;
                  font-weight: 800;
                  transition: all 0.3s ease;
                }
                .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 35px rgba(0,188,212,0.45); }
                .btn-white { background: #f0fdfa; border: 1px solid #ccfbf1; transition: all 0.2s ease; }
                .btn-white:hover { background: #e0f2f1; border-color: #00897b; color: #00695c; transform: translateY(-1px); }
                .input-style { width: 100%; padding: 14px 20px; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 14px; color: #0f172a; font-size: 14px; font-weight: 600; outline: none; transition: all 0.2s ease; }
                .input-style::placeholder { color: #94a3b8; font-weight: 500; }
                .input-style:focus { border-color: #00bcd4; background: white; box-shadow: 0 0 0 4px rgba(0,188,212,0.12); }
                .input-icon { padding-left: 48px !important; }
                .label-style { display: block; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #00838f; margin-bottom: 8px; margin-left: 4px; }
                .area-card { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
                .area-card:hover { transform: translateY(-3px); background: rgba(0,188,212,0.15) !important; border-color: #00bcd4 !important; }
                .bg-mesh { background-image: radial-gradient(circle at 1px 1px, rgba(0,188,212,0.15) 1px, transparent 0); background-size: 32px 32px; }
            `}</style>

            {/* ── LEFT: BRAND PANEL (CELESTE, VERDE, DORADO PREDOMINANTES - 100% MAX CONTRAST) ─────────────────────────────────────── */}
            <div className="hidden lg:flex lg:w-[48%] bg-mesh flex-col p-12 xl:p-14 relative overflow-hidden justify-between"
              style={{ background: 'linear-gradient(150deg, #061024 0%, #0a1738 50%, #040c1e 100%)' }}>
                {/* Ambient glow spots in Celeste, Verde & Dorado */}
                <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full blur-[110px] pointer-events-none" style={{background:'rgba(0, 188, 212, 0.28)'}} />
                <div className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full blur-[110px] pointer-events-none" style={{background:'rgba(16, 185, 129, 0.25)'}} />
                <div className="absolute top-1/2 left-1/3 w-[320px] h-[320px] rounded-full blur-[90px] pointer-events-none" style={{background:'rgba(245, 158, 11, 0.2)'}} />

                {/* Logo top bar */}
                <div className="relative z-10">
                    <button onClick={() => navigate('/')} className="flex items-center gap-3 group text-left">
                        <div className="p-1 rounded-2xl bg-white/10 border border-white/20 shadow-lg group-hover:scale-105 transition-transform"
                          style={{boxShadow:'0 0 24px rgba(0,188,212,0.5)'}}>
                            <img src={BRAND.logoPath} alt={BRAND.fullName} className="w-10 h-10 rounded-xl object-cover" />
                        </div>
                        <div>
                            <span className="text-xl font-black tracking-tight text-white block leading-none">
                                {BRAND.productName}<span style={{color:'#00e5ff'}}> by {BRAND.companyName}</span>
                            </span>
                            <span className="text-[9px] font-extrabold uppercase tracking-[0.25em] block mt-1" style={{color:'#00bcd4'}}>
                                {BRAND.platformLabel}
                            </span>
                        </div>
                    </button>
                </div>

                {/* Main copy */}
                <div className="relative z-10 my-auto py-6">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full w-fit mb-6"
                      style={{background:'rgba(0,188,212,0.15)', border:'1px solid rgba(0,188,212,0.4)', backdropFilter:'blur(10px)'}}>
                        <div className="w-2 h-2 rounded-full animate-pulse" style={{background:'#10b981', boxShadow:'0 0 10px #10b981'}} />
                        <span className="text-[9px] font-black uppercase tracking-widest text-cyan-200">{BRAND.platformLabelLatam}</span>
                    </div>

                    <h2 className="text-3xl xl:text-4xl font-black leading-[1.12] mb-4 tracking-tight text-white">
                        Todo tu mundo<br />
                        <span style={{background:'linear-gradient(135deg, #00e5ff 0%, #10b981 50%, #ffc107 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text'}}>
                            operativo en una sola plataforma.
                        </span>
                    </h2>

                    <p className="text-sm text-slate-300 leading-relaxed mb-8 max-w-md font-semibold">
                        Control Operativo · Preventivo · Productivo.<br />
                        Flota, Logística, RRHH, Empresa360 y Aprobaciones.<br />
                        Diseñado para operaciones exigentes en {countries}.
                    </p>

                    {/* Platform areas grid: 6 solid dark cards for maximum text contrast */}
                    <div className="grid grid-cols-2 gap-3">
                        {PLATFORM_AREAS.map((area, i) => (
                            <div key={i} className="area-card p-3 rounded-2xl flex items-center justify-between gap-2 shadow-md"
                              style={{background:'#0c1733', border:'1px solid rgba(0,188,212,0.3)'}}>
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md"
                                      style={{background: area.bgGradient}}>
                                        <area.icon size={15} className="text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-black text-white leading-tight truncate">{area.label}</p>
                                        <p className="text-[9px] font-bold text-slate-300 truncate mt-0.5">{area.desc}</p>
                                    </div>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider text-white flex-shrink-0"
                                  style={{background: area.colorHex}}>
                                    {area.tag}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Stats bottom strip: Verde, Celeste, Dorado */}
                <div className="relative z-10 pt-6" style={{borderTop:'1px solid rgba(0,188,212,0.25)'}}>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-2xl font-black tracking-tight" style={{color:'#10b981'}}>100%</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5 text-slate-300">Módulos Activos</p>
                        </div>
                        <div>
                            <p className="text-2xl font-black tracking-tight" style={{color:'#00e5ff'}}>360°</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5 text-slate-300">Visibilidad Total</p>
                        </div>
                        <div>
                            <p className="text-2xl font-black tracking-tight" style={{color:'#ffc107'}}>+43%</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5 text-slate-300">Eficiencia Operativa</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── RIGHT: FORM PANEL ─────────────────────────────────────── */}
            <div className="flex-1 flex flex-col justify-center p-3 sm:p-6 md:p-14 lg:p-16 bg-white relative">
                {/* Mobile logo */}
                <div className="flex lg:hidden items-center gap-2 sm:gap-3 mb-6 sm:mb-10">
                    <img src={BRAND.logoPath} alt={BRAND.fullName} className="w-8 sm:w-9 h-8 sm:h-9 rounded-xl" />
                     <span className="text-sm sm:text-lg font-black" style={{color:'#0d1854'}}>{BRAND.productName}<span style={{color:'#00bcd4'}}> by {BRAND.companyName}</span></span>
                </div>

                <div className="w-full max-w-[400px] mx-auto px-2 sm:px-0">
                    {/* Back to landing */}
                    <button onClick={() => navigate('/')} className="flex items-center gap-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-colors mb-6 sm:mb-8"
                      style={{color:'#8fa3c0'}}
                      onMouseEnter={e=>e.currentTarget.style.color='#1565c0'}
                      onMouseLeave={e=>e.currentTarget.style.color='#8fa3c0'}>
                        <ChevronLeft size={14} /> Volver al inicio
                    </button>

                    {/* Header */}
                    <div className="mb-8 sm:mb-10">
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-1 sm:mb-2">
                            {mode === 'login' ? 'Convierte cada área en una sola operación coordinada.' : 'Empieza a operar con estándar ejecutivo en LATAM'}
                        </h1>
                        <p className="text-xs sm:text-sm font-medium text-slate-500">
                            {mode === 'login'
                                ? 'Acceso seguro, visibilidad total y ejecución trazable en tiempo real.'
                                : 'Registra tu empresa y activa una operación 360° desde el primer día.'
                            }
                        </p>
                        <div className="h-1 w-10 sm:w-12 rounded-full mt-3 sm:mt-5" style={{background:'linear-gradient(90deg, #1565c0, #00bcd4)'}} />
                    </div>

                    {/* Success alert */}
                    {successMsg && (
                        <div className="mb-6 p-4 bg-emerald-50 border-2 border-emerald-100 rounded-2xl flex items-start gap-3">
                            <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-emerald-600 text-[10px] font-black"><CheckCircle2 size={12}/></span>
                            </div>
                            <p className="text-emerald-700 text-[12px] font-semibold leading-relaxed">{successMsg}</p>
                        </div>
                    )}

                    {/* Error alert */}
                    {error && (
                        <div className="mb-6 p-4 bg-rose-50 border-2 border-rose-100 rounded-2xl flex items-start gap-3">
                            <div className="w-5 h-5 bg-rose-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-rose-600 text-[10px] font-black">!</span>
                            </div>
                            <p className="text-rose-700 text-[12px] font-semibold leading-relaxed">{error}</p>
                        </div>
                    )}

                    {/* ── LOGIN FORM ── */}
                    {mode === 'login' ? (
                        <div className="space-y-4">
                            <div className="space-y-3 sm:space-y-5">
                                <div className="rounded-2xl bg-slate-100/70 border border-slate-200 p-3 sm:p-4">
                                     <p className="text-[9px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 sm:mb-3">Acceda rápido con el ecosistema corporativo</p>
                                    <div className="flex flex-col gap-2 sm:gap-3">
                                        <button type="button" onClick={() => alert('SSO no implementado (mock)')} className="w-full btn-white px-3 py-2 sm:py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2">
                                            <ShieldCheck size={14} /> Iniciar con SSO
                                        </button>
                                        <button type="button" onClick={() => alert('Funcionalidad de OAuth no implementada')} className="w-full btn-white px-3 py-2 sm:py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2">
                                            <Globe size={14} /> Iniciar con Credenciales Corporativas
                                        </button>
                                    </div>
                                </div>

                                <div className="text-center text-[11px] sm:text-[12px] text-slate-400 font-semibold">
                                    O usa tu correo electrónico y contraseña habituales
                                </div>
                            </div>

                            <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
                            <div>
                                <label className="label-style text-xs sm:text-sm">Correo Electrónico o RUT</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="text" value={email} onChange={e => setEmail(e.target.value)}
                                        className="input-style input-icon text-sm py-3 sm:py-4"
                                        placeholder="correo@empresa.cl o RUT (ej. 12.345.678-9)" required
                                        autoComplete="username"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label-style text-xs sm:text-sm">Contraseña</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                                        className="input-style input-icon pr-14 text-sm py-3 sm:py-4"
                                        placeholder="••••••••" required
                                        autoComplete="current-password"
                                    />
                                    <button type="button" onClick={() => setShowPass(!showPass)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors">
                                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 sm:gap-2.5 cursor-pointer">
                                    <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                                        className="w-4 h-4 rounded" style={{accentColor:'#1565c0'}} />
                                    <span className="text-[10px] sm:text-[12px] font-semibold text-slate-500">Mantener sesión</span>
                                </label>
                                <button type="button" onClick={() => { setMode('forgot-password'); setError(''); setSuccessMsg(''); }} className="text-[10px] sm:text-[12px] font-bold underline underline-offset-2" style={{color:'#1565c0'}}>
                                    Olvidé mi contraseña
                                </button>
                            </div>

                            <button type="submit" disabled={loading}
                                className="btn-primary w-full text-white py-3 sm:py-4 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 sm:gap-3 shadow-lg disabled:opacity-60"
                                style={{boxShadow:'0 10px 25px rgba(21,101,192,0.25)'}}>
                                 {loading ? <Loader2 className="animate-spin" size={18} /> : <span className="flex items-center gap-2 sm:gap-3">Ingresar a la Plataforma <ArrowRight size={16} /></span>}
                            </button>

                            {/* Trust indicators */}
                            <div className="flex items-center justify-center gap-3 sm:gap-5 pt-2">
                                {[
                                    [ShieldCheck, 'SSL 256bit'],
                                    [Globe, 'Cloud Seguro'],
                                    [CheckCircle2, 'Multi-empresa'],
                                ].map(([Icon, label], i) => (
                                    <div key={i} className="flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold text-slate-400">
                                        <Icon size={11} className="text-emerald-500" /> {label}
                                    </div>
                                ))}
                            </div>
                        </form>
                        </div>
                    ) : mode === 'pin' ? (
                        /* ── PIN FORM (Keypad) ── */
                        <div className="space-y-6 sm:space-y-10">
                            <div className="text-center">
                                <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] mb-3 sm:mb-4" style={{color:'#1565c0'}}>Seguridad de Acceso</p>
                                <div className="flex justify-center gap-3 sm:gap-5">
                                    {[1, 2, 3, 4].map(dot => (
                                        <div key={dot} className={`w-3 sm:w-4 h-3 sm:h-4 rounded-full border-2 transition-all duration-300`}
                                          style={pin.length >= dot ? {background:'#1565c0', borderColor:'#1565c0', transform:'scale(1.25)', boxShadow:'0 4px 12px rgba(21,101,192,0.3)'} : {borderColor:'#cbd5e1', background:'white'}} />
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-[240px] sm:max-w-[280px] mx-auto">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'back', 0, 'check'].map((key, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        disabled={loading}
                                        onClick={() => {
                                            if (key === 'back') setPin(pin.slice(0, -1));
                                            else if (key === 'check') { if (pin.length === 4) handleVerifyPin(pin); }
                                            else {
                                                if (pin.length < 4) {
                                                    const newVal = pin + key;
                                                    setPin(newVal);
                                                    if (newVal.length === 4) handleVerifyPin(newVal);
                                                }
                                            }
                                        }}
                                        className={`h-12 sm:h-16 rounded-2xl flex items-center justify-center text-lg sm:text-xl font-bold transition-all active:scale-95 ${
                                            key === 'check' ? 'text-white shadow-lg' : 
                                            key === 'back' ? 'bg-slate-50 text-slate-400' : 
                                            'bg-slate-50 text-slate-700 hover:bg-white hover:shadow-md border border-transparent hover:border-slate-100'
                                        }`}
                                        style={key === 'check' ? {background:'linear-gradient(135deg, #1565c0, #5c35d4)'} : {}}
                                    >
                                        {key === 'back' ? <ChevronLeft size={18} /> : key === 'check' ? <CheckCircle2 size={18} /> : key}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => { setMode('login'); setPin(''); }}
                                className="w-full text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                            >
                                Cancelar e intentar login
                            </button>
                        </div>
                    ) : mode === 'forgot-password' ? (
                        /* ── FORGOT PASSWORD FORM ── */
                        <form onSubmit={handleForgotPassword} className="space-y-4 sm:space-y-6">
                            <div className="text-center mb-6">
                                <p className="text-[10px] sm:text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-2 sm:mb-3">Recuperar Acceso</p>
                                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                                    Ingresa el correo electrónico o RUT asociado a tu cuenta y te enviaremos un enlace para restablecer tu contraseña.
                                </p>
                            </div>

                            <div>
                                <label className="label-style text-xs sm:text-sm">Correo Electrónico o RUT</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="text" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                                        className="input-style input-icon text-sm py-3 sm:py-4"
                                        placeholder="correo@empresa.cl o RUT (ej. 12.345.678-9)" required
                                    />
                                </div>
                            </div>

                            <button type="submit" disabled={loading}
                                className="btn-primary w-full text-white py-3 sm:py-4 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 sm:gap-3 shadow-lg shadow-indigo-200 disabled:opacity-60">
                                {loading ? <Loader2 className="animate-spin" size={18} /> : <span className="flex items-center gap-2 sm:gap-3">Enviar Correo <ArrowRight size={16} /></span>}
                            </button>

                            <button type="button" onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                                className="w-full text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors mt-4">
                                Cancelar y Volver
                            </button>
                        </form>
                    ) : (
                        /* ── REGISTER FORM ── */
                        <form onSubmit={handleRegister} className="space-y-3 sm:space-y-4">
                            <div className="grid grid-cols-1 gap-3 sm:gap-4">
                                <div>
                                    <label className="label-style text-xs sm:text-sm">Nombre Completo</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                        <input type="text" value={regName} onChange={e => setRegName(e.target.value)}
                                            className="input-style input-icon text-xs sm:text-sm py-2 sm:py-3" placeholder="Nombre y Apellido" required />
                                    </div>
                                </div>
                                <div>
                                    <label className="label-style text-xs sm:text-sm">Email Corporativo</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                        <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                                            className="input-style input-icon text-xs sm:text-sm py-2 sm:py-3" placeholder="admin@empresa.cl" required 
                                            autoComplete="email" />
                                    </div>
                                </div>
                                <div>
                                    <label className="label-style text-xs sm:text-sm">Nombre Empresa</label>
                                    <div className="relative">
                                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                        <input type="text" value={regEmpresa} onChange={e => setRegEmpresa(e.target.value)}
                                            className="input-style input-icon text-xs sm:text-sm py-2 sm:py-3" placeholder="Mi Empresa S.A." required />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <label className="label-style text-xs sm:text-sm">RUT Empresa</label>
                                        <input type="text" value={regRut} onChange={e => setRegRut(formatRut(e.target.value))}
                                            className={`input-style text-xs sm:text-sm py-2 sm:py-3 ${regRut && !validateRut(regRut) ? '!border-rose-400 !bg-rose-50 !text-rose-600' : ''}`} placeholder="77.555.444-3" />
                                        {regRut && !validateRut(regRut) && <p className="text-[8px] sm:text-[9px] text-rose-500 font-bold mt-0.5 ml-1 uppercase tracking-tighter">RUT Inválido</p>}
                                    </div>
                                    <div>
                                        <label className="label-style text-xs sm:text-sm">Cargo</label>
                                        <input type="text" value={regCargo} onChange={e => setRegCargo(e.target.value)}
                                            className="input-style text-xs sm:text-sm py-2 sm:py-3" placeholder="Gerente, Jefe..." />
                                    </div>
                                </div>
                                <div>
                                    <label className="label-style text-xs sm:text-sm">Contraseña</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                        <input type={showPass ? 'text' : 'password'} value={regPassword} onChange={e => setRegPassword(e.target.value)}
                                            className="input-style input-icon pr-11 text-xs sm:text-sm py-2 sm:py-3" placeholder="••••••••" required 
                                            autoComplete="new-password" />
                                        <button type="button" onClick={() => setShowPass(!showPass)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600">
                                            {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <button type="submit" disabled={loading}
                                className="btn-primary w-full text-white py-3 sm:py-4 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 sm:gap-3 shadow-lg shadow-indigo-200 disabled:opacity-60 mt-2 sm:mt-3">
                                {loading ? <Loader2 className="animate-spin" size={16} /> : <span className="flex items-center gap-2 sm:gap-3">Crear Cuenta <UserPlus size={16} /></span>}
                            </button>
                        </form>
                    )}

                    {/* Toggle */}
                    {mode === 'login' || mode === 'register' ? (
                        <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-slate-100 text-center">
                            <p className="text-xs sm:text-sm text-slate-400 font-medium mb-2 sm:mb-3">
                                {mode === 'login' ? '¿Tu empresa aún no tiene acceso?' : '¿Ya tienes una cuenta?'}
                            </p>
                            <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccessMsg(''); }}
                                className="text-[11px] sm:text-[13px] font-black transition-colors underline underline-offset-4 flex items-center gap-1 sm:gap-2 mx-auto"
                                style={{color:'#1565c0', textDecorationColor:'#c5d8f5'}}>
                                {mode === 'login' ? <span className="flex items-center gap-1 sm:gap-2"><UserPlus size={12} /> Solicitar Acceso Corporativo</span> : <span className="flex items-center gap-1 sm:gap-2"><ArrowRight size={12} /> Iniciar Sesión</span>}
                            </button>
                        </div>
                    ) : null}

                    {/* Footer note */}
                     <p className="text-center text-[9px] sm:text-[10px] text-slate-300 font-medium mt-6 sm:mt-10">{BRAND.loginFooter}</p>
                </div>
            </div>
        </div>
    );
};

export default PlatformLogin;

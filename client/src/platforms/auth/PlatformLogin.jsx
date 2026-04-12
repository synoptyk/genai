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

const PLATFORM_AREAS = [
    { icon: Activity, label: 'Control Operativo', color: 'indigo' },
    { icon: ShieldCheck, label: 'Control Preventivo', color: 'rose' },
    { icon: TrendingUp, label: 'Control Productivo', color: 'emerald' },
    { icon: Layers, label: 'Áreas de Soporte', color: 'amber' },
    { icon: BrainCircuit, label: 'Asistente IA Enterprise', color: 'violet' },
    { icon: Network, label: 'Integraciones', color: 'sky' },
];

const colorMap = {
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-600' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-600' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-600' },
    sky: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
};

const PlatformLogin = () => {
    const navigate = useNavigate();
    const [remember, setRemember] = useState(false);
    const { login, register, verifyPin } = useAuth();
    const [mode, setMode] = useState('login'); // login, register, pin
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');

    // PIN state
    const [pin, setPin] = useState('');
    const [pendingEmail, setPendingEmail] = useState('');

    // Login state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Register state
    const [regName, setRegName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
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

    const handleVerifyPin = async (val) => {
        // val es el pin de 4 digitos
        setError('');
        setLoading(true);
        try {
            const data = await verifyPin(pendingEmail, val, remember);
            handleLoginRedirect(data);
        } catch (err) {
            setError(err.response?.data?.message || 'PIN incorrecto. Intenta de nuevo.');
            setPin(''); // Reset local pin
        } finally {
            setLoading(false);
        }
    };

    const handleLoginRedirect = (data) => {
        if (data.role === 'system_admin' || data.role === 'ceo') {
            navigate('/ceo/command-center');
        } else if (data.role === 'admin') {
            navigate('/configuracion-empresa');
        } else if (data.role === 'supervisor_hse') {
            navigate('/operaciones/portal-supervision');
        } else {
            navigate('/operaciones/portal-colaborador');
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
            // El administrador que acaba de registrar su empresa va a su dashboard o configuraciones
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
                .gradient-panel { background: linear-gradient(145deg, #e7eefc 0%, #ebe5ff 35%, #def4ff 100%); }
                .btn-primary { background: linear-gradient(135deg, #4f46e5, #7c3aed); transition: all 0.3s ease; }
                .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(79,70,229,0.35); }
                .btn-white { background: white; transition: all 0.3s ease; }
                .btn-white:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(79,70,229,0.15); }
                .input-style { width: 100%; padding: 14px 20px; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 14px; color: #0f172a; font-size: 14px; font-weight: 600; outline: none; transition: all 0.2s ease; }
                .input-style::placeholder { color: #94a3b8; font-weight: 500; }
                .input-style:focus { border-color: #6366f1; background: white; box-shadow: 0 0 0 4px rgba(99,102,241,0.08); }
                .input-icon { padding-left: 48px !important; }
                .label-style { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6366f1; margin-bottom: 8px; margin-left: 4px; }
                .area-card { transition: all 0.2s ease; }
                .area-card:hover { transform: translateY(-2px); }
                .bg-mesh { background-image: radial-gradient(circle at 1px 1px, rgba(99,102,241,0.08) 1px, transparent 0); background-size: 32px 32px; }
            `}</style>

            {/* ── LEFT: BRAND PANEL ─────────────────────────────────────── */}
            <div className="hidden lg:flex lg:w-[48%] gradient-panel bg-mesh flex-col p-14 relative overflow-hidden">
                {/* Decorative circles */}
                <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-indigo-200/30 rounded-full blur-3xl" />
                <div className="absolute -top-32 -right-32 w-[400px] h-[400px] bg-violet-200/30 rounded-full blur-3xl" />

                {/* Logo */}
                <div className="relative z-10">
                    <button onClick={() => navigate('/')} className="flex items-center gap-2 sm:gap-3 group">
                        <img src={BRAND.logoPath} alt={BRAND.fullName} className="w-10 sm:w-11 h-10 sm:h-11 rounded-xl shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform" />
                        <div>
                            <span className="text-base sm:text-lg md:text-xl font-black tracking-tight text-slate-900">{BRAND.productName}<span className="text-indigo-600"> by {BRAND.companyName}</span></span>
                            <p className="text-[7px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] block -mt-0.5">{BRAND.platformLabel}</p>
                        </div>
                    </button>
                </div>

                {/* Main copy */}
                <div className="relative z-10 flex-1 flex flex-col justify-center">
                    <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white border border-indigo-100 rounded-full w-fit mb-4 sm:mb-8 shadow-sm">
                        <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 bg-indigo-500 rounded-full animate-pulse" />
                        <span className="text-[8px] sm:text-[10px] font-bold text-indigo-700 uppercase tracking-widest">{BRAND.platformLabelLatam}</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl md:text-4xl font-black text-slate-900 leading-[1.1] mb-3 sm:mb-6 tracking-tight">
                        Todo tu mundo<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">operativo en una sola plataforma.</span>
                    </h2>
                    <p className="text-slate-500 text-xs sm:text-sm md:text-base leading-relaxed mb-6 sm:mb-10 max-w-sm font-medium">
                        Control Operativo · Preventivo · Productivo.<br />
                        Flota, Logística, RRHH, Empresa360 y Aprobaciones.<br />
                        Diseñado para operaciones complejas en {countries}.
                    </p>

                    {/* Platform areas grid */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        {PLATFORM_AREAS.map((area, i) => {
                            const c = colorMap[area.color];
                            return (
                                <div key={i} className={`area-card flex items-center gap-2 sm:gap-3 p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-100 shadow-sm`}>
                                    <div className={`w-6 sm:w-8 h-6 sm:h-8 ${c.dot} rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0`}>
                                        <area.icon size={12} className="text-white" />
                                    </div>
                                    <span className="text-[9px] sm:text-[11px] font-bold text-slate-700">{area.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Stats bottom strip */}
                <div className="relative z-10 mt-6 sm:mt-10 pt-4 sm:pt-8 border-t border-white/60">
                    <div className="grid grid-cols-3 gap-3 sm:gap-6 text-center">
                        {[['100%', 'Módulos activos'], ['+43%', 'Eficiencia'], ['360°', 'Visibilidad']].map(([val, label]) => (
                            <div key={label}>
                                <p className="text-base sm:text-xl font-black text-indigo-700">{val}</p>
                                <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── RIGHT: FORM PANEL ─────────────────────────────────────── */}
            <div className="flex-1 flex flex-col justify-center p-3 sm:p-6 md:p-14 lg:p-16 bg-white relative">
                {/* Mobile logo */}
                <div className="flex lg:hidden items-center gap-2 sm:gap-3 mb-6 sm:mb-10">
                    <img src={BRAND.logoPath} alt={BRAND.fullName} className="w-8 sm:w-9 h-8 sm:h-9 rounded-xl" />
                     <span className="text-sm sm:text-lg font-black text-slate-900">{BRAND.productName}<span className="text-indigo-600"> by {BRAND.companyName}</span></span>
                </div>

                <div className="w-full max-w-[400px] mx-auto px-2 sm:px-0">
                    {/* Back to landing */}
                    <button onClick={() => navigate('/')} className="flex items-center gap-2 text-[10px] sm:text-[11px] font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-wider transition-colors mb-6 sm:mb-8">
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
                        <div className="h-1 w-10 sm:w-12 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full mt-3 sm:mt-5" />
                    </div>

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
                                <label className="label-style text-xs sm:text-sm">Correo Electrónico</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="email" value={email} onChange={e => setEmail(e.target.value)}
                                        className="input-style input-icon text-sm py-3 sm:py-4"
                                        placeholder="correo@empresa.cl" required
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
                                        className="w-4 h-4 accent-indigo-600 rounded" />
                                    <span className="text-[10px] sm:text-[12px] font-semibold text-slate-500">Mantener sesión</span>
                                </label>
                            </div>

                            <button type="submit" disabled={loading}
                                className="btn-primary w-full text-white py-3 sm:py-4 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 sm:gap-3 shadow-lg shadow-indigo-200 disabled:opacity-60">
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
                                <p className="text-[10px] sm:text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-3 sm:mb-4">Seguridad de Acceso</p>
                                <div className="flex justify-center gap-3 sm:gap-5">
                                    {[1, 2, 3, 4].map(dot => (
                                        <div key={dot} className={`w-3 sm:w-4 h-3 sm:h-4 rounded-full border-2 transition-all duration-300 ${pin.length >= dot ? 'bg-indigo-600 border-indigo-600 scale-125 shadow-lg shadow-indigo-200' : 'border-slate-200 bg-white'}`} />
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
                                            key === 'check' ? 'bg-indigo-600 text-white shadow-lg' : 
                                            key === 'back' ? 'bg-slate-50 text-slate-400' : 
                                            'bg-slate-50 text-slate-700 hover:bg-white hover:shadow-md border border-transparent hover:border-slate-100'
                                        }`}
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
                                            className="input-style input-icon text-xs sm:text-sm py-2 sm:py-3" placeholder="admin@empresa.cl" required />
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
                                            className="input-style input-icon pr-11 text-xs sm:text-sm py-2 sm:py-3" placeholder="••••••••" required />
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
                    <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-slate-100 text-center">
                        <p className="text-xs sm:text-sm text-slate-400 font-medium mb-2 sm:mb-3">
                            {mode === 'login' ? '¿Tu empresa aún no tiene acceso?' : '¿Ya tienes una cuenta?'}
                        </p>
                        <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                            className="text-[11px] sm:text-[13px] font-black text-indigo-600 hover:text-violet-600 transition-colors underline underline-offset-4 decoration-indigo-200 flex items-center gap-1 sm:gap-2 mx-auto">
                            {mode === 'login' ? <span className="flex items-center gap-1 sm:gap-2"><UserPlus size={12} /> Solicitar Acceso Corporativo</span> : <span className="flex items-center gap-1 sm:gap-2"><ArrowRight size={12} /> Iniciar Sesión</span>}
                        </button>
                    </div>

                    {/* Footer note */}
                     <p className="text-center text-[9px] sm:text-[10px] text-slate-300 font-medium mt-6 sm:mt-10">{BRAND.loginFooter}</p>
                </div>
            </div>
        </div>
    );
};

export default PlatformLogin;

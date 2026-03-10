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

const PLATFORM_AREAS = [
    { icon: Activity, label: 'Control Operativo', color: 'indigo' },
    { icon: ShieldCheck, label: 'Control Preventivo', color: 'rose' },
    { icon: TrendingUp, label: 'Control Productivo', color: 'emerald' },
    { icon: Layers, label: 'Áreas de Soporte', color: 'amber' },
    { icon: BrainCircuit, label: 'Agentes IA', color: 'violet' },
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

const GenAiLogin = () => {
    const navigate = useNavigate();
    const { login, register } = useAuth();
    const [mode, setMode] = useState('login');
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [remember, setRemember] = useState(false);
    const [error, setError] = useState('');

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

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await login(email, password, remember);
            if (data.role === 'ceo_genai' || data.role === 'ceo') {
                navigate('/ceo/command-center');
            } else if (data.role === 'admin') {
                navigate('/configuracion-empresa');
            } else if (data.role === 'supervisor_hse') {
                navigate('/operaciones/portal-supervision');
            } else {
                // Empleados regulares al portal universal
                navigate('/operaciones/portal-colaborador');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Credenciales incorrectas. Por favor verifica tus datos.');
        } finally {
            setLoading(false);
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
                .gradient-panel { background: linear-gradient(145deg, #f0f4ff 0%, #ede9fe 40%, #e0f2fe 100%); }
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
                    <button onClick={() => navigate('/')} className="flex items-center gap-3 group">
                        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2.5 rounded-xl shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
                            <Zap size={20} className="fill-white text-white" />
                        </div>
                        <div>
                            <span className="text-xl font-black tracking-tight text-slate-900">GEN<span className="text-indigo-600">AI</span></span>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] block -mt-0.5">Enterprise Platform</p>
                        </div>
                    </button>
                </div>

                {/* Main copy */}
                <div className="relative z-10 flex-1 flex flex-col justify-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-indigo-100 rounded-full w-fit mb-8 shadow-sm">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest">Plataforma Integral v8.0</span>
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 leading-[1.1] mb-6 tracking-tight">
                        Todo tu mundo<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">operativo en uno.</span>
                    </h2>
                    <p className="text-slate-500 text-base leading-relaxed mb-10 max-w-sm font-medium">
                        Control Operativo · Preventivo · Productivo.<br />
                        Flota, Logística, RRHH y Agentes IA conectados.<br />
                        Gestión 360° con inteligencia transversal.
                    </p>

                    {/* Platform areas grid */}
                    <div className="grid grid-cols-2 gap-3">
                        {PLATFORM_AREAS.map((area, i) => {
                            const c = colorMap[area.color];
                            return (
                                <div key={i} className={`area-card flex items-center gap-3 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm`}>
                                    <div className={`w-8 h-8 ${c.dot} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                        <area.icon size={15} className="text-white" />
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-700">{area.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Stats bottom strip */}
                <div className="relative z-10 mt-10 pt-8 border-t border-white/60">
                    <div className="grid grid-cols-3 gap-6 text-center">
                        {[['99.9%', 'Uptime'], ['+43%', 'Eficiencia'], ['360°', 'Visibilidad']].map(([val, label]) => (
                            <div key={label}>
                                <p className="text-xl font-black text-indigo-700">{val}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── RIGHT: FORM PANEL ─────────────────────────────────────── */}
            <div className="flex-1 flex flex-col justify-center p-8 md:p-14 lg:p-16 bg-white relative">
                {/* Mobile logo */}
                <div className="flex lg:hidden items-center gap-3 mb-10">
                    <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2 rounded-xl">
                        <Zap size={18} className="fill-white text-white" />
                    </div>
                    <span className="text-lg font-black text-slate-900">GEN<span className="text-indigo-600">AI</span></span>
                </div>

                <div className="w-full max-w-[400px] mx-auto">
                    {/* Back to landing */}
                    <button onClick={() => navigate('/')} className="flex items-center gap-2 text-[11px] font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-wider transition-colors mb-8">
                        <ChevronLeft size={14} /> Volver al inicio
                    </button>

                    {/* Header */}
                    <div className="mb-10">
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
                            {mode === 'login' ? 'Bienvenido de nuevo' : 'Crear cuenta'}
                        </h1>
                        <p className="text-slate-500 text-sm font-medium">
                            {mode === 'login'
                                ? 'Ingresa tus credenciales para acceder a la plataforma.'
                                : 'Registra tu empresa y comienza a gestionar todo desde Gen AI.'
                            }
                        </p>
                        <div className="h-1 w-12 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full mt-5" />
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
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div>
                                <label className="label-style">Correo Electrónico</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="email" value={email} onChange={e => setEmail(e.target.value)}
                                        className="input-style input-icon"
                                        placeholder="correo@empresa.cl" required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label-style">Contraseña</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                                        className="input-style input-icon pr-14"
                                        placeholder="••••••••" required
                                    />
                                    <button type="button" onClick={() => setShowPass(!showPass)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors">
                                        {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                                        className="w-4 h-4 accent-indigo-600 rounded" />
                                    <span className="text-[12px] font-semibold text-slate-500">Mantener sesión</span>
                                </label>
                            </div>

                            <button type="submit" disabled={loading}
                                className="btn-primary w-full text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 shadow-lg shadow-indigo-200 disabled:opacity-60">
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <span className="flex items-center gap-3">Ingresar a Gen AI <ArrowRight size={18} /></span>}
                            </button>

                            {/* Trust indicators */}
                            <div className="flex items-center justify-center gap-5 pt-2">
                                {[
                                    [ShieldCheck, 'SSL 256bit'],
                                    [Globe, 'Cloud Seguro'],
                                    [CheckCircle2, 'Multi-empresa'],
                                ].map(([Icon, label], i) => (
                                    <div key={i} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                                        <Icon size={12} className="text-emerald-500" /> {label}
                                    </div>
                                ))}
                            </div>
                        </form>
                    ) : (
                        /* ── REGISTER FORM ── */
                        <form onSubmit={handleRegister} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2">
                                    <label className="label-style">Nombre Completo</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input type="text" value={regName} onChange={e => setRegName(e.target.value)}
                                            className="input-style input-icon" placeholder="Nombre y Apellido" required />
                                    </div>
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="label-style">Email Corporativo</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                                            className="input-style input-icon" placeholder="admin@empresa.cl" required />
                                    </div>
                                </div>
                                <div>
                                    <label className="label-style">Nombre Empresa</label>
                                    <div className="relative">
                                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input type="text" value={regEmpresa} onChange={e => setRegEmpresa(e.target.value)}
                                            className="input-style input-icon" placeholder="Mi Empresa S.A." required />
                                    </div>
                                </div>
                                <div>
                                    <label className="label-style">RUT Empresa</label>
                                    <input type="text" value={regRut} onChange={e => setRegRut(formatRut(e.target.value))}
                                        className={`input-style ${regRut && !validateRut(regRut) ? '!border-rose-400 !bg-rose-50 !text-rose-600' : ''}`} placeholder="77.555.444-3" />
                                    {regRut && !validateRut(regRut) && <p className="text-[9px] text-rose-500 font-bold mt-1 ml-1 uppercase tracking-tighter">RUT Inválido</p>}
                                </div>
                                <div>
                                    <label className="label-style">Cargo</label>
                                    <input type="text" value={regCargo} onChange={e => setRegCargo(e.target.value)}
                                        className="input-style" placeholder="Gerente, Jefe..." />
                                </div>
                                <div>
                                    <label className="label-style">Contraseña</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input type={showPass ? 'text' : 'password'} value={regPassword} onChange={e => setRegPassword(e.target.value)}
                                            className="input-style input-icon pr-12" placeholder="••••••••" required />
                                        <button type="button" onClick={() => setShowPass(!showPass)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600">
                                            {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <button type="submit" disabled={loading}
                                className="btn-primary w-full text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 shadow-lg shadow-indigo-200 disabled:opacity-60 mt-2">
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <span className="flex items-center gap-3">Crear Cuenta <UserPlus size={18} /></span>}
                            </button>
                        </form>
                    )}

                    {/* Toggle */}
                    <div className="mt-8 pt-8 border-t border-slate-100 text-center">
                        <p className="text-sm text-slate-400 font-medium mb-3">
                            {mode === 'login' ? '¿Tu empresa aún no tiene acceso?' : '¿Ya tienes una cuenta?'}
                        </p>
                        <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                            className="text-[13px] font-black text-indigo-600 hover:text-violet-600 transition-colors underline underline-offset-4 decoration-indigo-200 flex items-center gap-2 mx-auto">
                            {mode === 'login' ? <span className="flex items-center gap-2"><UserPlus size={14} /> Solicitar Acceso Corporativo</span> : <span className="flex items-center gap-2"><ArrowRight size={14} /> Iniciar Sesión</span>}
                        </button>
                    </div>

                    {/* Footer note */}
                    <p className="text-center text-[10px] text-slate-300 font-medium mt-10">
                        Gen AI · Empresa Synoptyk · Chile 2026
                    </p>
                </div>
            </div>
        </div>
    );
};

export default GenAiLogin;

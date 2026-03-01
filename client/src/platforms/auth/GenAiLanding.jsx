import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Zap, ArrowRight, ChevronRight, CheckCircle2, Building2, BarChart3,
    ShieldCheck, Truck, BrainCircuit, GitBranch, Activity, Layers,
    HardHat, Users, Package, Globe, TrendingUp, Network, Mail,
    ClipboardList, Factory, Settings, Rocket, Star, Play
} from 'lucide-react';
import { useAuth } from './AuthContext';

// ── DATA ─────────────────────────────────────────────────────────────────────
const PILLARS = [
    {
        id: 'operativo',
        label: 'Control Operativo',
        icon: Activity,
        color: 'indigo',
        gradient: 'from-indigo-600 to-violet-600',
        bg: 'bg-indigo-50',
        border: 'border-indigo-100',
        iconBg: 'bg-indigo-600',
        text: 'text-indigo-700',
        stat: '99.9%',
        statLabel: 'Uptime Operacional',
        desc: 'Seguimiento en tiempo real de todas las operaciones del negocio. KPIs ejecutivos, alertas automáticas y toma de decisiones basada en datos.',
        items: ['Dashboard Ejecutivo en Tiempo Real', 'Alertas y Notificaciones Inteligentes', 'Gestión de Órdenes de Trabajo', 'Control de Actividades por Área']
    },
    {
        id: 'preventivo',
        label: 'Control Preventivo',
        icon: ShieldCheck,
        color: 'rose',
        gradient: 'from-rose-600 to-pink-600',
        bg: 'bg-rose-50',
        border: 'border-rose-100',
        iconBg: 'bg-rose-600',
        text: 'text-rose-700',
        stat: '-74%',
        statLabel: 'Reducción Incidentes',
        desc: 'Sistema HSE completo con AST, EPP, inspecciones y auditorías. Firma digital, GPS y cumplimiento normativo automatizado.',
        items: ['Análisis Seguro de Trabajo (AST)', 'Inspección EPP en Terreno', 'Auditoría HSE Inteligente', 'Charlas y Difusión Preventiva']
    },
    {
        id: 'productivo',
        label: 'Control Productivo',
        icon: TrendingUp,
        color: 'emerald',
        gradient: 'from-emerald-600 to-teal-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-100',
        iconBg: 'bg-emerald-600',
        text: 'text-emerald-700',
        stat: '+43%',
        statLabel: 'Eficiencia Productiva',
        desc: 'Control de rendimiento productivo por equipo, área y proceso. Métricas de eficiencia, tarifarios y producción financiera integrada.',
        items: ['Seguimiento de Producción por Técnico', 'Producción Financiera y Tarifarios', 'Métricas de Rendimiento Diario', 'Control de Metas y Objetivos']
    },
    {
        id: 'soporte',
        label: 'Áreas de Soporte',
        icon: Layers,
        color: 'amber',
        gradient: 'from-amber-500 to-orange-600',
        bg: 'bg-amber-50',
        border: 'border-amber-100',
        iconBg: 'bg-amber-500',
        text: 'text-amber-700',
        stat: '360°',
        statLabel: 'Visibilidad Total',
        desc: 'Flota, logística, RRHH y gestión documental centralizados. Un ecosistema completo de soporte para la operación.',
        items: ['Gestión de Flota y GPS', 'Logística y Movimiento de Recursos', 'Recursos Humanos Integral', 'Gestión Documental Centralizada']
    }
];

const MODULES = [
    { icon: Activity, name: 'Dashboard Ejecutivo', desc: 'KPIs en tiempo real', color: 'indigo' },
    { icon: ShieldCheck, name: 'Prevención HSE', desc: 'AST, EPP, Auditorías', color: 'rose' },
    { icon: TrendingUp, name: 'Control Productivo', desc: 'Rendimiento por área', color: 'emerald' },
    { icon: Truck, name: 'Gestión de Flota', desc: 'Control GPS en vivo', color: 'blue' },
    { icon: Users, name: 'Recursos Humanos', desc: 'Capital humano integral', color: 'violet' },
    { icon: Package, name: 'Logística', desc: 'Movimiento de recursos', color: 'amber' },
    { icon: BrainCircuit, name: 'Agentes IA', desc: 'Automatización inteligente', color: 'purple' },
    { icon: Globe, name: 'Integraciones', desc: 'Conexión multiplataforma', color: 'sky' },
    { icon: GitBranch, name: 'Flujos Transversales', desc: 'Procesos inter-área', color: 'teal' },
    { icon: ClipboardList, name: 'Gestión Documental', desc: 'Control documental', color: 'slate' },
    { icon: Factory, name: 'Control de Planta', desc: 'Operaciones industriales', color: 'orange' },
    { icon: Network, name: 'Centro de Comando', desc: 'Inteligencia centralizada', color: 'indigo' },
];

const INTEGRATIONS = [
    'SAP', 'Oracle', 'Salesforce', 'Microsoft 365', 'Google Workspace', 'Slack', 'TOA Field Service', 'Power BI'
];

const STATS = [
    { value: '360°', label: 'Visibilidad Total', icon: Globe },
    { value: '+40%', label: 'Eficiencia Operativa', icon: TrendingUp },
    { value: '-74%', label: 'Incidentes Preventibles', icon: ShieldCheck },
    { value: '8', label: 'Verticales Integradas', icon: Layers },
];

const colorMap = {
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', icon: 'bg-indigo-600' },
    rose: { bg: 'bg-rose-100', text: 'text-rose-700', icon: 'bg-rose-600' },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: 'bg-emerald-600' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'bg-blue-600' },
    violet: { bg: 'bg-violet-100', text: 'text-violet-700', icon: 'bg-violet-600' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-700', icon: 'bg-amber-500' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-700', icon: 'bg-purple-600' },
    sky: { bg: 'bg-sky-100', text: 'text-sky-700', icon: 'bg-sky-600' },
    teal: { bg: 'bg-teal-100', text: 'text-teal-700', icon: 'bg-teal-600' },
    slate: { bg: 'bg-slate-100', text: 'text-slate-700', icon: 'bg-slate-600' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-700', icon: 'bg-orange-600' },
};

// ── COMPONENT ─────────────────────────────────────────────────────────────────
const GenAiLanding = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [activePillar, setActivePillar] = useState(0);
    const [scrollY, setScrollY] = useState(0);
    const [visibleSections, setVisibleSections] = useState(new Set());
    const heroRef = useRef(null);

    useEffect(() => {
        const onScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) setVisibleSections(p => new Set([...p, entry.target.id]));
                });
            },
            { threshold: 0.15 }
        );
        document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));
        return () => observer.disconnect();
    }, []);

    const isVisible = (id) => visibleSections.has(id);

    const pillar = PILLARS[activePillar];

    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans antialiased overflow-x-hidden">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                body { font-family: 'Inter', sans-serif; }
                .gradient-text { background: linear-gradient(135deg, #4f46e5, #7c3aed, #2563eb); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
                .gradient-text-emerald { background: linear-gradient(135deg, #059669, #0891b2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
                .gradient-text-rose { background: linear-gradient(135deg, #e11d48, #7c3aed); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
                .card-hover { transition: all 0.3s cubic-bezier(0.4,0,0.2,1); }
                .card-hover:hover { transform: translateY(-6px); box-shadow: 0 20px 60px rgba(79,70,229,0.12); }
                .hero-glow { background: radial-gradient(ellipse 80% 60% at 50% -20%, rgba(99,102,241,0.15), transparent); }
                .section-fade { opacity: 0; transform: translateY(40px); transition: all 0.8s cubic-bezier(0.4,0,0.2,1); }
                .section-fade.visible { opacity: 1; transform: translateY(0); }
                .pillar-btn { transition: all 0.3s ease; }
                .pillar-btn.active { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; box-shadow: 0 8px 30px rgba(79,70,229,0.3); }
                .float-anim { animation: float 6s ease-in-out infinite; }
                .float-anim-2 { animation: float 8s ease-in-out infinite reverse; }
                @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-16px); } }
                .marquee { display: flex; animation: marquee 20s linear infinite; white-space: nowrap; }
                @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
                .bg-mesh { background-image: radial-gradient(circle at 2px 2px, rgba(99,102,241,0.06) 1px, transparent 0); background-size: 40px 40px; }
                .btn-primary { background: linear-gradient(135deg, #4f46e5, #7c3aed); transition: all 0.3s ease; }
                .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(79,70,229,0.4); }
                .pillar-card { border: 2px solid transparent; transition: all 0.3s ease; border-radius: 2rem; }
                .pillar-card.active { border-color: #4f46e5; background: linear-gradient(white, white) padding-box, linear-gradient(135deg, #4f46e5, #7c3aed) border-box; }
            `}</style>

            {/* ── NAVBAR ──────────────────────────────────────────────── */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrollY > 20 ? 'bg-white/95 backdrop-blur-xl shadow-sm border-b border-slate-100' : 'bg-transparent'}`}>
                <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between py-4">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2.5 rounded-xl shadow-lg">
                            <Zap size={20} className="fill-white text-white" />
                        </div>
                        <div>
                            <span className="text-xl font-black tracking-tight">GEN<span className="gradient-text">AI</span></span>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-[0.3em] -mt-1">Enterprise Platform</span>
                        </div>
                    </div>

                    <div className="hidden lg:flex items-center gap-8">
                        {[['#pilares', 'Plataforma'], ['#modulos', 'Módulos'], ['#integraciones', 'Integraciones'], ['#nosotros', 'Empresa']].map(([href, label]) => (
                            <a key={href} href={href} className="text-[12px] font-semibold text-slate-500 hover:text-indigo-600 transition-colors">{label}</a>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        {user ? (
                            <button onClick={() => navigate('/prevencion/dashboard')}
                                className="btn-primary text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2">
                                Ir a la Plataforma <ArrowRight size={16} />
                            </button>
                        ) : (
                            <>
                                <button onClick={() => navigate('/login')} className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors px-4 py-2">
                                    Iniciar Sesión
                                </button>
                                <button onClick={() => navigate('/login')}
                                    className="btn-primary text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200">
                                    Acceso Corporativo
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* ── HERO ─────────────────────────────────────────────────── */}
            <section ref={heroRef} className="relative pt-32 pb-24 overflow-hidden bg-mesh">
                <div className="hero-glow absolute inset-0 pointer-events-none" />

                {/* Floating UI Cards */}
                <div className="absolute top-32 right-8 lg:right-24 float-anim hidden xl:block z-10">
                    <div className="bg-white rounded-2xl shadow-2xl shadow-indigo-100 border border-indigo-50 p-5 w-56">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                                <TrendingUp size={16} className="text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Eficiencia</p>
                                <p className="text-lg font-black text-slate-900">+43.2%</p>
                            </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full" style={{ width: '73%' }} />
                        </div>
                        <p className="text-[9px] text-emerald-600 font-bold mt-2">↑ 12.3% respecto al mes pasado</p>
                    </div>
                </div>

                <div className="absolute top-56 right-4 lg:right-12 float-anim-2 hidden xl:block z-10">
                    <div className="bg-white rounded-2xl shadow-xl shadow-violet-100 border border-violet-50 p-4 w-48">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Sistema en Línea</p>
                        </div>
                        <div className="space-y-2">
                            {['Operativo', 'Preventivo', 'Productivo'].map((area, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <span className="text-[10px] font-semibold text-slate-600">{area}</span>
                                    <span className="text-[10px] font-black text-emerald-500">✓ OK</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-16 right-16 lg:right-40 float-anim hidden xl:block z-10">
                    <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl shadow-2xl shadow-indigo-300 p-5 w-52 text-white">
                        <div className="flex items-center gap-3 mb-3">
                            <ShieldCheck size={20} className="text-indigo-200" />
                            <p className="text-[10px] font-black uppercase tracking-wider text-indigo-200">Conformidad HSE</p>
                        </div>
                        <p className="text-3xl font-black">97%</p>
                        <p className="text-[10px] text-indigo-300 mt-1">450 trabajadores auditados</p>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="max-w-4xl">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-full mb-8">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-widest">Gen AI Enterprise Platform · v8.0</span>
                        </div>

                        <h1 className="text-5xl md:text-6xl lg:text-7xl font-black leading-[1.05] mb-8 tracking-tight">
                            <span className="text-slate-900">El sistema que</span><br />
                            <span className="gradient-text">unifica todo tu</span><br />
                            <span className="text-slate-900">mundo operativo</span>
                        </h1>

                        <p className="text-xl text-slate-500 leading-relaxed mb-10 max-w-2xl font-medium">
                            Control Operativo · Preventivo · Productivo. Flota, Logística, RRHH y Agentes IA conectados en una sola plataforma. <strong className="text-slate-700">Gestión 360° para empresas que no se detienen.</strong>
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 mb-16">
                            <button onClick={() => navigate('/login')}
                                className="btn-primary text-white px-10 py-5 rounded-2xl text-base font-bold shadow-2xl shadow-indigo-200 flex items-center justify-center gap-3 group">
                                Acceder a la Plataforma
                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            <a href="#pilares" className="bg-white border-2 border-slate-200 text-slate-700 px-10 py-5 rounded-2xl text-base font-bold hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-3">
                                <Play size={16} className="text-indigo-500" /> Ver la Plataforma
                            </a>
                        </div>

                        {/* Micro stats */}
                        <div className="flex flex-wrap gap-8">
                            {STATS.map((s, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                                        <s.icon size={18} className="text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-xl font-black text-slate-900 leading-none">{s.value}</p>
                                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{s.label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── MARQUEE INTEGRATIONS ─────────────────────────────────── */}
            <div className="bg-slate-50 border-y border-slate-100 py-4 overflow-hidden">
                <div className="flex items-center gap-3 mb-2 justify-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Conectado con los mejores ecosistemas</span>
                </div>
                <div className="flex overflow-hidden">
                    <div className="marquee gap-16 items-center">
                        {[...INTEGRATIONS, ...INTEGRATIONS].map((name, i) => (
                            <span key={i} className="px-8 text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors cursor-default whitespace-nowrap">{name}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── 4 PILLARS ────────────────────────────────────────────── */}
            <section id="pilares" className="py-28 bg-white">
                <div className="max-w-7xl mx-auto px-6">
                    <div id="pilares-title" data-animate className={`text-center mb-16 section-fade ${isVisible('pilares-title') ? 'visible' : ''}`}>
                        <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-[0.4em] mb-4">La Plataforma Integral</p>
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-6">
                            Cuatro pilares.<br /><span className="gradient-text">Un solo ecosistema.</span>
                        </h2>
                        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                            Gen AI conecta verticalmente todos los procesos de tu empresa. Elimina los silos y vincula cada área en un resultado transversal unificado.
                        </p>
                    </div>

                    {/* Pillar buttons */}
                    <div className="flex flex-wrap justify-center gap-3 mb-16">
                        {PILLARS.map((p, i) => (
                            <button
                                key={p.id}
                                onClick={() => setActivePillar(i)}
                                className={`pillar-btn px-7 py-4 rounded-2xl font-bold text-sm flex items-center gap-3 border-2 border-slate-100 ${activePillar === i ? 'active' : 'text-slate-600 bg-white hover:border-indigo-200 hover:text-indigo-600'}`}
                            >
                                <p.icon size={18} /> {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Active pillar card */}
                    <div className={`rounded-[3rem] border-2 ${pillar.border} ${pillar.bg} p-12 transition-all duration-500`}>
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div>
                                <div className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-full mb-6 ${pillar.bg} border ${pillar.border}`}>
                                    <div className={`w-8 h-8 ${pillar.iconBg} rounded-lg flex items-center justify-center text-white`}>
                                        <pillar.icon size={16} />
                                    </div>
                                    <span className={`text-[11px] font-black uppercase tracking-widest ${pillar.text}`}>{pillar.label}</span>
                                </div>
                                <div className="flex items-baseline gap-3 mb-6">
                                    <span className="text-6xl font-black text-slate-900">{pillar.stat}</span>
                                    <span className={`text-sm font-bold ${pillar.text} uppercase`}>{pillar.statLabel}</span>
                                </div>
                                <p className="text-lg text-slate-600 leading-relaxed mb-10 font-medium">{pillar.desc}</p>
                                <button onClick={() => navigate('/login')}
                                    className={`btn-primary text-white px-8 py-4 rounded-2xl font-bold text-sm flex items-center gap-3`}>
                                    Explorar módulo <ChevronRight size={16} />
                                </button>
                            </div>
                            <div className="space-y-4">
                                {pillar.items.map((item, i) => (
                                    <div key={i} className="bg-white rounded-2xl px-6 py-5 flex items-center gap-5 shadow-sm border border-white">
                                        <div className={`w-10 h-10 ${pillar.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                            <CheckCircle2 size={20} className="text-white" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{item}</p>
                                            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Integrado · Automatizado · En línea</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
            <section className="py-28 bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-700 relative overflow-hidden">
                <div className="absolute inset-0 bg-mesh opacity-30" />
                <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-white/5 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-violet-900/30 rounded-full blur-[100px]" />

                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="text-center mb-20">
                        <p className="text-[11px] font-bold text-indigo-200 uppercase tracking-[0.4em] mb-4">Cómo funciona</p>
                        <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-6">
                            Integración transversal<br />entre todas tus áreas
                        </h2>
                        <p className="text-indigo-200 text-lg max-w-2xl mx-auto">
                            Gen AI no es solo software. Es el tejido conector que vincula personas, procesos y datos en un solo resultado de negocio.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                step: '01', icon: Network, title: 'Conecta tus áreas',
                                desc: 'Operaciones, prevención, RRHH y flota se conectan automáticamente. Los datos fluyen sin barreras entre departamentos.',
                                color: 'from-blue-400 to-indigo-400'
                            },
                            {
                                step: '02', icon: BrainCircuit, title: 'IA procesa y analiza',
                                desc: 'Nuestros Agentes Inteligentes automatizan tareas administrativas, detectan anomalías y generan alertas proactivas.',
                                color: 'from-violet-400 to-purple-400'
                            },
                            {
                                step: '03', icon: BarChart3, title: 'Resultado unificado',
                                desc: 'Un solo dashboard ejecutivo integra todos los KPIs. Decisiones más rápidas, gestión más eficiente y resultados medibles.',
                                color: 'from-emerald-400 to-teal-400'
                            }
                        ].map((step, i) => (
                            <div key={i} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-[2.5rem] p-10 hover:bg-white/15 transition-all card-hover relative overflow-hidden">
                                <div className={`absolute -top-4 -right-4 text-[80px] font-black text-white/5 leading-none select-none`}>{step.step}</div>
                                <div className={`w-14 h-14 bg-gradient-to-br ${step.color} rounded-2xl flex items-center justify-center text-white shadow-lg mb-8`}>
                                    <step.icon size={26} />
                                </div>
                                <h3 className="text-xl font-black text-white mb-4">{step.title}</h3>
                                <p className="text-indigo-200 text-sm leading-relaxed font-medium">{step.desc}</p>
                            </div>
                        ))}
                    </div>

                    {/* Connection diagram */}
                    <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6">
                        {['Operaciones', 'Prevención', 'Producción', 'Soporte'].map((area, i) => (
                            <div key={i} className="text-center">
                                <div className="bg-white/10 border border-white/20 rounded-2xl p-5 mb-3 hover:bg-white/20 transition-all">
                                    <p className="font-black text-white text-sm uppercase tracking-wide">{area}</p>
                                    <div className="flex justify-center gap-1 mt-3">
                                        {Array.from({ length: 4 }).map((_, j) => (
                                            <div key={j} className={`h-1 rounded-full flex-1 ${j < 3 ? 'bg-indigo-300' : 'bg-white/20'}`} />
                                        ))}
                                    </div>
                                </div>
                                <div className="text-indigo-300 font-bold text-[10px] uppercase tracking-widest">↓ GEN AI</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── MODULES GRID ─────────────────────────────────────────── */}
            <section id="modulos" className="py-28 bg-slate-50">
                <div className="max-w-7xl mx-auto px-6">
                    <div id="modules-title" data-animate className={`text-center mb-20 section-fade ${isVisible('modules-title') ? 'visible' : ''}`}>
                        <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-[0.4em] mb-4">Ecosistema Completo</p>
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight">
                            12 módulos.<br /><span className="gradient-text">Infinitas posibilidades.</span>
                        </h2>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {MODULES.map((m, i) => {
                            const c = colorMap[m.color] || colorMap.indigo;
                            return (
                                <div key={i} className="bg-white rounded-[2rem] p-8 border border-slate-100 card-hover group cursor-pointer" onClick={() => navigate('/login')}>
                                    <div className={`w-12 h-12 ${c.icon} rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                                        <m.icon size={22} />
                                    </div>
                                    <h4 className="font-black text-slate-900 text-base mb-2">{m.name}</h4>
                                    <p className="text-sm text-slate-400 font-medium leading-relaxed">{m.desc}</p>
                                    <div className={`flex items-center gap-2 mt-5 ${c.text} text-[11px] font-black uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity`}>
                                        Explorar <ArrowRight size={12} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ── INTELLIGENT AGENTS ───────────────────────────────────── */}
            <section className="py-28 bg-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-violet-50 to-transparent rounded-full -translate-y-1/2 translate-x-1/4" />
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="grid lg:grid-cols-2 gap-20 items-center">
                        <div>
                            <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-violet-50 border border-violet-100 rounded-full mb-8">
                                <BrainCircuit size={16} className="text-violet-600" />
                                <span className="text-[11px] font-bold text-violet-700 uppercase tracking-widest">Agentes Inteligentes Gen AI</span>
                            </div>
                            <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-8">
                                Tu equipo opera.<br /><span className="gradient-text">La IA administra.</span>
                            </h2>
                            <p className="text-lg text-slate-500 leading-relaxed mb-10 font-medium">
                                Los Agentes Inteligentes de Gen AI automatizan tareas administrativas, generan reportes, detectan riesgos antes de que ocurran y conectan con plataformas externas como SAP, Oracle o Microsoft 365.
                            </p>
                            <div className="space-y-4">
                                {[
                                    ['Automatización de reportes ejecutivos', 'violet'],
                                    ['Detección temprana de anomalías operativas', 'indigo'],
                                    ['Conexión bidireccional con SAP, Oracle & ERP', 'blue'],
                                    ['Asistente administrativo digital 24/7', 'purple'],
                                ].map(([item, color], i) => (
                                    <div key={i} className="flex items-center gap-4">
                                        <div className={`w-5 h-5 bg-${color}-100 rounded-full flex items-center justify-center flex-shrink-0`}>
                                            <CheckCircle2 size={14} className={`text-${color}-600`} />
                                        </div>
                                        <span className="text-slate-700 font-semibold text-sm">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Agent visualization */}
                        <div className="relative">
                            <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-[3rem] p-10 text-white shadow-2xl shadow-violet-200">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                        <BrainCircuit size={20} />
                                    </div>
                                    <div>
                                        <p className="font-black text-sm">Agente Gen AI</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                            <span className="text-[10px] text-violet-200">Procesando en tiempo real</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4 mb-8">
                                    {[
                                        { label: 'Órdenes procesadas hoy', value: '1,247', trend: '↑ 8%' },
                                        { label: 'Alertas preventivas generadas', value: '14', trend: '↓ 23%' },
                                        { label: 'Conformidad HSE actual', value: '97.3%', trend: '↑ 2.1%' },
                                        { label: 'Horas de trabajo administrativo ahorradas', value: '3.2h', trend: '/colaborador' },
                                    ].map((row, i) => (
                                        <div key={i} className="bg-white/10 rounded-2xl px-5 py-4 flex items-center justify-between">
                                            <span className="text-[11px] font-medium text-violet-200">{row.label}</span>
                                            <div className="text-right">
                                                <span className="text-white font-black text-sm">{row.value}</span>
                                                <span className="text-emerald-300 text-[10px] font-bold ml-2">{row.trend}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="text-[10px] text-violet-300 font-bold uppercase tracking-widest">
                                    ★ Gen AI Intelligence Engine v8.0
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── INTEGRATIONS ─────────────────────────────────────────── */}
            <section id="integraciones" className="py-28 bg-slate-50">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-[0.4em] mb-4">Conexiones Multiplataforma</p>
                    <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6">
                        Se integra con<br /><span className="gradient-text">tu ecosistema actual</span>
                    </h2>
                    <p className="text-lg text-slate-500 max-w-xl mx-auto mb-16">No tendrás que cambiar todo tu stack. Gen AI se conecta con las plataformas que ya usas.</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                        {INTEGRATIONS.map((name, i) => (
                            <div key={i} className="bg-white border-2 border-slate-100 rounded-2xl p-6 card-hover flex items-center justify-center">
                                <span className="text-base font-black text-slate-700">{name}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-10 inline-flex items-center gap-3 text-indigo-600 font-bold text-sm">
                        <Globe size={18} /> Y muchas más integraciones disponibles via API REST
                    </div>
                </div>
            </section>

            {/* ── CEO SECTION ──────────────────────────────────────────── */}
            <section id="nosotros" className="py-28 bg-white relative overflow-hidden">
                <div className="absolute -left-40 top-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-50 rounded-full blur-3xl" />
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="grid lg:grid-cols-2 gap-20 items-center">
                        <div className="relative">
                            <div className="bg-gradient-to-br from-slate-900 to-indigo-900 rounded-[3rem] p-12 text-white shadow-2xl shadow-slate-300 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl" />
                                <div className="absolute -top-4 -right-4 bg-gradient-to-br from-indigo-500 to-violet-500 text-white font-black px-6 py-2 rounded-xl text-[10px] uppercase tracking-widest shadow-xl -rotate-3">
                                    Fundador & CEO
                                </div>
                                <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-8 shadow-xl">
                                    <span className="text-4xl font-black text-white">M</span>
                                </div>
                                <h3 className="text-2xl font-black text-white text-center mb-2">Mauricio Barrientos</h3>
                                <p className="text-indigo-400 text-[11px] font-black uppercase tracking-[0.4em] text-center mb-8">Fundador & Arquitecto Digital · Empresa Synoptyk</p>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        ['15+', 'Años de experiencia'],
                                        ['360°', 'Visión de negocio'],
                                        ['8', 'Verticales cubiertas'],
                                        ['∞', 'Escalabilidad']
                                    ].map(([val, label], i) => (
                                        <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                                            <p className="text-2xl font-black text-white">{val}</p>
                                            <p className="text-[10px] text-indigo-300 font-bold uppercase mt-1">{label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-indigo-50 border border-indigo-100 rounded-full mb-8">
                                <Star size={14} className="text-indigo-600 fill-indigo-600" />
                                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-widest">Visión Synoptyk</span>
                            </div>
                            <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-8">
                                Diseñado para las<br /><span className="gradient-text">empresas que lideran</span>
                            </h2>
                            <div className="space-y-5 text-slate-500 text-base leading-relaxed mb-10">
                                <p><strong className="text-slate-800">Empresa Synoptyk</strong> es el ecosistema tecnológico detrás de <strong className="text-indigo-600">Gen AI</strong>. Nacimos para resolver un problema real: las empresas operan con sistemas desconectados que generan silos de información, costos ocultos y decisiones lentas.</p>
                                <p>Gen AI es la respuesta definitiva: una plataforma única que conecta el control operativo, preventivo y productivo con las áreas de soporte y agentes inteligentes, todo en tiempo real.</p>
                                <p className="border-l-4 border-indigo-300 pl-6 italic text-slate-600 py-2">
                                    "Diseñamos Gen AI para que la tecnología desaparezca del problema y quede solo el resultado del negocio."
                                </p>
                            </div>
                            <button onClick={() => navigate('/login')}
                                className="btn-primary text-white px-10 py-5 rounded-2xl font-bold text-sm shadow-xl shadow-indigo-200 flex items-center gap-3 w-fit">
                                <Rocket size={18} /> Comenzar Ahora
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── CTA ──────────────────────────────────────────────────── */}
            <section className="py-24 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 relative overflow-hidden">
                <div className="absolute inset-0 bg-mesh opacity-20" />
                <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                    <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
                        Tu empresa merece<br />operar con inteligencia real
                    </h2>
                    <p className="text-xl text-indigo-200 mb-10 font-medium">Únete a las empresas que ya gestionan todo desde Gen AI.</p>
                    <button onClick={() => navigate('/login')}
                        className="bg-white text-indigo-700 px-12 py-5 rounded-2xl font-black text-base hover:bg-indigo-50 transition-all shadow-2xl inline-flex items-center gap-3">
                        Acceder a Gen AI <ArrowRight size={20} />
                    </button>
                </div>
            </section>

            {/* ── FOOTER ───────────────────────────────────────────────── */}
            <footer className="bg-slate-900 text-white py-16 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid md:grid-cols-4 gap-12 mb-12">
                        <div className="md:col-span-2">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-2.5 rounded-xl">
                                    <Zap size={18} className="fill-white text-white" />
                                </div>
                                <div>
                                    <span className="text-xl font-black">GEN<span className="text-indigo-400">AI</span></span>
                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest block">Enterprise Platform · Empresa Synoptyk</p>
                                </div>
                            </div>
                            <p className="text-slate-400 max-w-xs leading-relaxed text-sm font-medium mb-6">
                                La plataforma que unifica el control operativo, preventivo, productivo y de soporte en un solo ecosistema inteligente.
                            </p>
                            <div className="flex gap-3">
                                <a href="https://synoptyk.cl" target="_blank" rel="noreferrer" className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:bg-indigo-600 hover:text-white transition-all">
                                    <Building2 size={16} />
                                </a>
                                <a href="mailto:contacto@synoptyk.cl" className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:bg-indigo-600 hover:text-white transition-all">
                                    <Mail size={16} />
                                </a>
                                <a href="#" className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:bg-indigo-600 hover:text-white transition-all">
                                    <Globe size={16} />
                                </a>
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-5">Plataforma</p>
                            <div className="space-y-3">
                                {['Control Operativo', 'Control Preventivo', 'Control Productivo', 'Áreas de Soporte', 'Agentes IA', 'Integraciones'].map(l => (
                                    <a key={l} href="#modulos" className="block text-sm text-slate-400 hover:text-indigo-400 transition-colors font-medium">{l}</a>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-5">Empresa</p>
                            <div className="space-y-3">
                                {['Sobre Synoptyk', 'Casos de Éxito', 'Soporte Técnico', 'Documentación API', 'Seguridad', 'Términos de Uso'].map(l => (
                                    <a key={l} href="#nosotros" className="block text-sm text-slate-400 hover:text-indigo-400 transition-colors font-medium">{l}</a>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">© 2026 Gen AI · Empresa Synoptyk · Todos los derechos reservados</p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold">
                            <ShieldCheck size={14} className="text-emerald-500" /> SSL 256bit · SOC2 Ready · ISO 27001
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default GenAiLanding;

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Zap, ArrowRight, ChevronRight, CheckCircle2, Building2, BarChart3,
    ShieldCheck, Truck, BrainCircuit, GitBranch, Activity, Layers,
    Users, Package, Globe, TrendingUp, Network, Mail,
    ClipboardList, Factory, Rocket, Star, Play, Quote
} from 'lucide-react';
import { useAuth } from './AuthContext';

const PILLARS = [
    { id: 'operativo', label: 'Control Operativo', icon: Activity, bg: 'bg-indigo-50', border: 'border-indigo-200', iconBg: 'bg-indigo-600', text: 'text-indigo-700', stat: '99.9%', statLabel: 'Uptime Operacional', desc: 'Seguimiento en tiempo real de todas las operaciones. KPIs ejecutivos, alertas automáticas y toma de decisiones basada en datos.', items: ['Dashboard Ejecutivo en Tiempo Real', 'Alertas y Notificaciones Inteligentes', 'Gestión de Órdenes de Trabajo', 'Control de Actividades por Área'] },
    { id: 'preventivo', label: 'Control Preventivo', icon: ShieldCheck, bg: 'bg-rose-50', border: 'border-rose-200', iconBg: 'bg-rose-600', text: 'text-rose-700', stat: '-74%', statLabel: 'Reducción Incidentes', desc: 'Sistema HSE completo con AST, EPP, inspecciones y auditorías. Firma digital, GPS y cumplimiento normativo automatizado.', items: ['Análisis Seguro de Trabajo (AST)', 'Inspección EPP en Terreno', 'Auditoría HSE Inteligente', 'Charlas y Difusión Preventiva'] },
    { id: 'productivo', label: 'Control Productivo', icon: TrendingUp, bg: 'bg-emerald-50', border: 'border-emerald-200', iconBg: 'bg-emerald-600', text: 'text-emerald-700', stat: '+43%', statLabel: 'Eficiencia Productiva', desc: 'Control de rendimiento por equipo, área y proceso. Métricas de eficiencia, tarifarios y producción financiera integrada.', items: ['Seguimiento de Producción por Técnico', 'Producción Financiera y Tarifarios', 'Métricas de Rendimiento Diario', 'Control de Metas y Objetivos'] },
    { id: 'soporte', label: 'Áreas de Soporte', icon: Layers, bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-500', text: 'text-amber-700', stat: '360°', statLabel: 'Visibilidad Total', desc: 'Flota, logística, RRHH y gestión documental centralizados. Un ecosistema completo de soporte para la operación.', items: ['Gestión de Flota y GPS', 'Logística y Movimiento de Recursos', 'Recursos Humanos Integral', 'Gestión Documental Centralizada'] }
];

const MODULES = [
    { icon: Activity, name: 'Dashboard Ejecutivo', desc: 'KPIs en tiempo real', color: '#4f46e5' },
    { icon: ShieldCheck, name: 'Prevención HSE', desc: 'AST, EPP, Auditorías', color: '#e11d48' },
    { icon: TrendingUp, name: 'Control Productivo', desc: 'Rendimiento por área', color: '#059669' },
    { icon: Truck, name: 'Gestión de Flota', desc: 'Control GPS en vivo', color: '#2563eb' },
    { icon: Users, name: 'Recursos Humanos', desc: 'Capital humano integral', color: '#7c3aed' },
    { icon: Package, name: 'Logística', desc: 'Movimiento de recursos', color: '#d97706' },
    { icon: BrainCircuit, name: 'Agentes IA', desc: 'Automatización inteligente', color: '#9333ea' },
    { icon: Globe, name: 'Integraciones', desc: 'Conexión multiplataforma', color: '#0284c7' },
    { icon: GitBranch, name: 'Flujos Transversales', desc: 'Procesos inter-área', color: '#0d9488' },
    { icon: ClipboardList, name: 'Gestión Documental', desc: 'Control documental', color: '#475569' },
    { icon: Factory, name: 'Control de Planta', desc: 'Operaciones industriales', color: '#ea580c' },
    { icon: Network, name: 'Centro de Comando', desc: 'Inteligencia centralizada', color: '#4f46e5' },
];

const INTEGRATIONS = ['SAP', 'Oracle', 'Salesforce', 'Microsoft 365', 'Google Workspace', 'Slack', 'TOA Field Service', 'Power BI'];
const STATS = [
    { value: '360°', label: 'Visibilidad Total', icon: Globe },
    { value: '+40%', label: 'Eficiencia Operativa', icon: TrendingUp },
    { value: '-74%', label: 'Incidentes Preventibles', icon: ShieldCheck },
    { value: '8', label: 'Verticales Integradas', icon: Layers },
];

const GenAiLanding = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [activePillar, setActivePillar] = useState(0);
    const [scrollY, setScrollY] = useState(0);
    const [visibleSections, setVisibleSections] = useState(new Set());

    useEffect(() => {
        const onScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => { entries.forEach(e => { if (e.isIntersecting) setVisibleSections(p => new Set([...p, e.target.id])); }); },
            { threshold: 0.1 }
        );
        document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));
        return () => observer.disconnect();
    }, []);

    const isV = (id) => visibleSections.has(id);
    const pillar = PILLARS[activePillar];

    const CSS = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', sans-serif; }
        .gt { background: linear-gradient(135deg, #4f46e5, #7c3aed); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .gt-cyan { background: linear-gradient(135deg, #06b6d4, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .shimmer { background: linear-gradient(90deg, #06b6d4, #6366f1, #8b5cf6, #06b6d4); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; animation: sh 4s linear infinite; }
        @keyframes sh { to { background-position: 200% center; } }
        .card-hover { transition: all 0.3s ease; }
        .card-hover:hover { transform: translateY(-5px); box-shadow: 0 20px 50px rgba(79,70,229,0.13); }
        .btn-p { background: linear-gradient(135deg, #4f46e5, #7c3aed); transition: all 0.3s ease; }
        .btn-p:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(79,70,229,0.4); }
        .btn-cyan { background: linear-gradient(135deg, #06b6d4, #4f46e5); transition: all 0.3s ease; }
        .btn-cyan:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(6,182,212,0.35); }
        .fade { opacity: 0; transform: translateY(35px); transition: all 0.7s ease; }
        .fade.vis { opacity: 1; transform: translateY(0); }

        .micro-release { animation: pulse text 4s ease-in-out infinite; }
        @keyframes pulse {
            0%, 100% { transform: translateY(0); opacity: 1; }
            50% { transform: translateY(-6px); opacity: 0.88; }
        }

        .snap-section { scroll-snap-align: start; scroll-snap-stop: always; }

        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
        }
        .float { animation: fl 6s ease-in-out infinite; }
        .float2 { animation: fl 8s ease-in-out infinite reverse; }
        @keyframes fl { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
        .marq { display: flex; animation: mq 22s linear infinite; white-space: nowrap; }
        @keyframes mq { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .logo-glow { filter: drop-shadow(0 0 16px rgba(6,182,212,0.5)); }
        .photo-ring { box-shadow: 0 0 0 4px rgba(6,182,212,0.4), 0 0 40px rgba(6,182,212,0.2), 0 20px 60px rgba(0,0,0,0.4); }
        .pillar-active { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; box-shadow: 0 8px 28px rgba(79,70,229,0.3); }
    `;

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#fff', color: '#0f172a', overflowX: 'hidden', scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' }}>
            <style>{CSS}</style>

            <div style={{ background: '#0f172a', color: '#fff', fontSize: 12, padding: '8px 0', textAlign: 'center', fontWeight: 700 }}>Nuevo: Integración SII automática + Conexiones 360 ya disponibles. Actualiza tu dashboard y revisa los indicadores de cobertura ahora.</div>

            {/* NAVBAR */}
            <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, transition: 'all 0.3s', backgroundColor: scrollY > 20 ? 'rgba(255,255,255,0.97)' : 'transparent', backdropFilter: scrollY > 20 ? 'blur(20px)' : 'none', borderBottom: scrollY > 20 ? '1px solid #f1f5f9' : 'none', boxShadow: scrollY > 20 ? '0 1px 20px rgba(0,0,0,0.06)' : 'none' }}>
                <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <img src="/genai_logo.png" alt="GEN AI" style={{ height: 40 }} className="logo-glow" />
                    <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
                        {[['#pilares','Plataforma'],['#modulos','Módulos'],['#integraciones','Integraciones'],['#nosotros','Empresa']].map(([h,l]) => (
                            <a key={h} href={h} style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textDecoration: 'none' }} onMouseEnter={e=>e.target.style.color='#4f46e5'} onMouseLeave={e=>e.target.style.color='#64748b'}>{l}</a>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        {user ? (
                            <button onClick={() => navigate('/prevencion/dashboard')} className="btn-p" style={{ color: '#fff', padding: '12px 24px', borderRadius: 14, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                Ir a la Plataforma <ArrowRight size={15} />
                            </button>
                        ) : (<>
                            <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', fontWeight: 600, fontSize: 13, color: '#475569', cursor: 'pointer', padding: '12px 16px' }}>Iniciar Sesión</button>
                            <button onClick={() => navigate('/login')} className="btn-p" style={{ color: '#fff', padding: '12px 24px', borderRadius: 14, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>Acceso Corporativo</button>
                        </>)}
                    </div>
                </div>
            </nav>

            {/* HERO — dark, inline styles to ensure rendering */}
            <section className="snap-section" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #020617 0%, #0f172a 60%, #0c1a3a 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '110px 0 80px', position: 'relative', overflow: 'hidden' }}>
                {/* ambient blobs */}
                <div style={{ position: 'absolute', top: '20%', left: '-10%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '10%', right: '-10%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
                {/* grid pattern */}
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(6,182,212,0.07) 1px, transparent 0)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

                {/* Floating cards */}
                <div className="float" style={{ position: 'absolute', top: 160, right: 80, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(6,182,212,0.25)', borderRadius: 20, padding: '20px', width: 220, display: 'none' }} id="fcard1">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <div style={{ width: 36, height: 36, background: 'rgba(5,150,105,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendingUp size={16} color="#34d399" />
                        </div>
                        <div><p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', margin: 0 }}>Eficiencia</p><p style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>+43.2%</p></div>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 10 }}><div style={{ height: '100%', width: '73%', background: 'linear-gradient(90deg,#34d399,#06b6d4)', borderRadius: 10 }} /></div>
                    <p style={{ fontSize: 9, color: '#34d399', fontWeight: 700, marginTop: 8 }}>↑ 12.3% respecto al mes pasado</p>
                </div>

                <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 2, width: '100%' }}>
                    <div style={{ maxWidth: 780 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 999, padding: '8px 20px', marginBottom: 32 }}>
                            <div style={{ width: 8, height: 8, background: '#06b6d4', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Gen AI Enterprise Platform · v8.0</span>
                        </div>

                        <div style={{ marginBottom: 24 }}>
                            <img src="/genai_logo.png" alt="GEN AI" style={{ height: 72 }} className="logo-glow" />
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <p className="shimmer" style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.3, margin: 0 }}>Eres una empresa del futuro, no una agenda del pasado.</p>
                            <p style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1.3, margin: 0 }}>Aquí no vendemos módulos. Entregamos el sistema nervioso.</p>
                        </div>

                        <h1 style={{ fontSize: 60, fontWeight: 900, color: '#ffffff', lineHeight: 1.1, marginBottom: 28, letterSpacing: '-1px' }}>
                            GenAI: no es un módulo más;<br />
                            <span className="gt-cyan">es tu brazo ejecutor</span><br />
                            de operaciones 360°
                        </h1>

                        <p style={{ fontSize: 18, color: '#94a3b8', lineHeight: 1.7, marginBottom: 40, maxWidth: 620 }}>
                            Control Operativo · Preventivo · Productivo. Flota, Logística, RRHH y Agentes IA en una sola plataforma. <strong style={{ color: '#e2e8f0' }}>Gestión 360° para empresas que no se detienen.</strong>
                        </p>

                        <div style={{ display: 'flex', gap: 16, marginBottom: 56, flexWrap: 'wrap' }}>
                            <button onClick={() => navigate('/login')} className="btn-cyan" style={{ color: '#fff', padding: '18px 36px', borderRadius: 18, fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                                Demo disruptive 90s <ArrowRight size={17} />
                            </button>
                            <a href="#pilares" style={{ color: '#94a3b8', padding: '18px 36px', borderRadius: 18, fontSize: 15, fontWeight: 700, border: '1px solid rgba(255,255,255,0.12)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                                Ver comparativa vs legado <Play size={15} color="#06b6d4" />
                            </a>
                        </div>

                        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
                            {STATS.map((s,i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 44, height: 44, background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <s.icon size={18} color="#06b6d4" />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1 }}>{s.value}</p>
                                        <p style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, marginTop: 3 }}>{s.label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* MARQUEE */}
            <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '16px 0', overflow: 'hidden' }}>
                <p style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 10 }}>Conectado con los mejores ecosistemas</p>
                <div style={{ overflow: 'hidden' }}><div className="marq" style={{ gap: 0 }}>
                    {[...INTEGRATIONS,...INTEGRATIONS].map((n,i) => <span key={i} style={{ padding: '0 40px', fontSize: 13, fontWeight: 700, color: '#94a3b8', whiteSpace: 'nowrap' }}>{n}</span>)}
                </div></div>
            </div>

            {/* 4 PILLARS */}
            <section id="pilares" className="snap-section" style={{ padding: '100px 0', background: '#fff' }}>
                <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
                    <div id="pil-t" data-animate className={`fade ${isV('pil-t') ? 'vis' : ''}`} style={{ textAlign: 'center', marginBottom: 60 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 16 }}>La Plataforma Integral</p>
                        <h2 style={{ fontSize: 48, fontWeight: 900, color: '#0f172a', lineHeight: 1.15, marginBottom: 20 }}>Cuatro pilares.<br /><span className="gt">Un solo ecosistema.</span></h2>
                        <p style={{ fontSize: 17, color: '#64748b', maxWidth: 580, margin: '0 auto', lineHeight: 1.7 }}>Gen AI conecta verticalmente todos los procesos de tu empresa, eliminando silos y vinculando cada área en un resultado unificado.</p>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 48 }}>
                        {PILLARS.map((p,i) => (
                            <button key={p.id} onClick={() => setActivePillar(i)} className={activePillar === i ? 'pillar-active' : ''} style={{ padding: '14px 28px', borderRadius: 18, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10, border: activePillar === i ? 'none' : '2px solid #e2e8f0', background: activePillar === i ? undefined : '#fff', color: activePillar === i ? '#fff' : '#475569', cursor: 'pointer', transition: 'all 0.3s' }}>
                                <p.icon size={17} /> {p.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ borderRadius: 40, border: `2px solid`, borderColor: pillar.border.replace('border-',''), padding: 56 }} className={pillar.bg}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
                            <div>
                                <span style={{ fontSize: 64, fontWeight: 900, color: '#0f172a' }}>{pillar.stat}</span>
                                <span style={{ fontSize: 13, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginLeft: 12 }}>{pillar.statLabel}</span>
                                <p style={{ fontSize: 16, color: '#475569', lineHeight: 1.7, margin: '20px 0 32px' }}>{pillar.desc}</p>
                                <button onClick={() => navigate('/login')} className="btn-p" style={{ color: '#fff', padding: '14px 28px', borderRadius: 16, fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    Explorar módulo <ChevronRight size={16} />
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {pillar.items.map((item, i) => (
                                    <div key={i} style={{ background: '#fff', borderRadius: 18, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                                        <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} className={pillar.iconBg}>
                                            <CheckCircle2 size={20} color="#fff" />
                                        </div>
                                        <div>
                                            <p style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', margin: 0 }}>{item}</p>
                                            <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, marginTop: 3 }}>Integrado · Automatizado · En línea</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* HOW IT WORKS */}
            <section className="snap-section" style={{ padding: '100px 0', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 60%, #4338ca 100%)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
                <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 2 }}>
                    <div style={{ textAlign: 'center', marginBottom: 70 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(199,210,254,0.8)', textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 16 }}>Cómo funciona</p>
                        <h2 style={{ fontSize: 48, fontWeight: 900, color: '#fff', lineHeight: 1.15, marginBottom: 20 }}>Integración transversal<br />entre todas tus áreas</h2>
                        <p style={{ fontSize: 17, color: 'rgba(199,210,254,0.8)', maxWidth: 560, margin: '0 auto', lineHeight: 1.7 }}>Gen AI es el tejido conector que vincula personas, procesos y datos en un solo resultado de negocio.</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
                        {[
                            { step: '01', icon: Network, title: 'Conecta tus áreas', desc: 'Operaciones, prevención, RRHH y flota se conectan automáticamente. Los datos fluyen sin barreras.', color: '#06b6d4' },
                            { step: '02', icon: BrainCircuit, title: 'IA procesa y analiza', desc: 'Los Agentes Inteligentes automatizan tareas, detectan anomalías y generan alertas proactivas.', color: '#a78bfa' },
                            { step: '03', icon: BarChart3, title: 'Resultado unificado', desc: 'Un dashboard ejecutivo integra todos los KPIs. Decisiones más rápidas y resultados medibles.', color: '#34d399' }
                        ].map((s, i) => (
                            <div key={i} style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 36, padding: 44, position: 'relative', overflow: 'hidden', transition: 'all 0.3s' }}>
                                <div style={{ fontSize: 80, fontWeight: 900, color: 'rgba(255,255,255,0.04)', position: 'absolute', top: -10, right: 16, lineHeight: 1 }}>{s.step}</div>
                                <div style={{ width: 56, height: 56, background: `${s.color}22`, border: `1px solid ${s.color}44`, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
                                    <s.icon size={26} color={s.color} />
                                </div>
                                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 14 }}>{s.title}</h3>
                                <p style={{ fontSize: 14, color: 'rgba(199,210,254,0.8)', lineHeight: 1.7 }}>{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* MODULES GRID */}
            <section id="modulos" style={{ padding: '100px 0', background: '#f8fafc' }}>
                <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
                    <div id="mod-t" data-animate className={`fade ${isV('mod-t') ? 'vis' : ''}`} style={{ textAlign: 'center', marginBottom: 60 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 16 }}>Ecosistema Completo</p>
                        <h2 style={{ fontSize: 48, fontWeight: 900, color: '#0f172a', lineHeight: 1.15 }}>12 módulos.<br /><span className="gt">Infinitas posibilidades.</span></h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
                        {MODULES.map((m, i) => (
                            <div key={i} className="card-hover" onClick={() => navigate('/login')} style={{ background: '#fff', borderRadius: 28, padding: '32px 28px', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                                <div style={{ width: 48, height: 48, background: `${m.color}18`, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                                    <m.icon size={22} color={m.color} />
                                </div>
                                <h4 style={{ fontWeight: 800, fontSize: 15, color: '#1e293b', marginBottom: 8 }}>{m.name}</h4>
                                <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>{m.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* COMPETENCIA VS GENAI */}
            <section id="competencia" style={{ padding: '90px 0 70px', background: '#f1f5f9' }}>
                <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', textAlign: 'center', marginBottom: 40 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 16 }}>Comparativa</p>
                    <h2 style={{ fontSize: 42, fontWeight: 900, color: '#0f172a' }}>Tu stack hoy vs. GenAI 360°</h2>
                    <p style={{ fontSize: 16, color: '#64748b', maxWidth: 760, margin: '0 auto', lineHeight: 1.7 }}>La competencia vende promesas. Nosotros entregamos resultados que se sienten en el primer mes.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18, maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
                    {[
                        { title: 'Sistemas clásicos', items: ['Dashboards aislados', 'Integración compleja', 'Migración 18 meses', 'Soporte lento', 'Cero insights reales'], color: '#cbd5e1' },
                        { title: 'GenAI', items: ['Conexión instantánea', 'Módulos integrados', 'Go-live en 48h', 'Soporte 24/7', 'ROI en días'], color: '#4f46e5', highlight: true },
                        { title: 'Resultado', items: ['+43% eficiencia', '-74% incidentes', '360° visibilidad', 'Toma de decisiones real', 'Costos operativos -25%'], color: '#10b981' }
                    ].map((block, i) => (
                        <div key={i} style={{ background: block.color, borderRadius: 26, padding: 26, color: block.highlight ? '#fff' : '#0f172a', boxShadow: '0 15px 30px rgba(15,23,42,0.08)', border: block.highlight ? '2px solid #fff' : '1px solid rgba(15,23,42,0.1)' }}>
                            <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 14 }}>{block.title}</h3>
                            <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc' }}>
                                {block.items.map((item, j) => (<li key={j} style={{ marginBottom: 8, fontWeight: 700, fontSize: 14 }}>{item}</li>))}
                            </ul>
                        </div>
                    ))}
                </div>
            </section>

            {/* INTEGRATIONS */}
            <section id="integraciones" style={{ padding: '100px 0', background: '#fff' }}>
                <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 16 }}>Conexiones Multiplataforma</p>
                    <h2 style={{ fontSize: 48, fontWeight: 900, color: '#0f172a', marginBottom: 16 }}>Se integra con<br /><span className="gt">tu ecosistema actual</span></h2>
                    <p style={{ fontSize: 17, color: '#64748b', maxWidth: 500, margin: '0 auto 56px' }}>No tendrás que cambiar todo tu stack. Gen AI se conecta con las plataformas que ya usas.</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, maxWidth: 900, margin: '0 auto' }}>
                        {INTEGRATIONS.map((name, i) => (
                            <div key={i} className="card-hover" style={{ background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: 20, padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: 14, fontWeight: 800, color: '#334155' }}>{name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CEO SECTION */}
            <section id="nosotros" style={{ padding: '100px 0', background: 'linear-gradient(160deg, #020617 0%, #0f172a 100%)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(6,182,212,0.07) 1px, transparent 0)', backgroundSize: '44px 44px' }} />
                <div style={{ position: 'absolute', left: '-15%', top: '50%', transform: 'translateY(-50%)', width: 500, height: 500, background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', borderRadius: '50%' }} />
                <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 2 }}>
                    <div style={{ textAlign: 'center', marginBottom: 72 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 16 }}>El Fundador</p>
                        <h2 style={{ fontSize: 48, fontWeight: 900, color: '#fff', lineHeight: 1.15 }}>Visión, pasión y<br /><span className="shimmer">tecnología sin límites</span></h2>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>
                        {/* CEO Card */}
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <div style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(20px)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 40, padding: 40, maxWidth: 420, width: '100%', boxShadow: '0 0 60px rgba(99,102,241,0.15), 0 30px 60px rgba(0,0,0,0.4)' }}>
                                <div style={{ position: 'relative', marginBottom: 28, display: 'flex', justifyContent: 'center' }}>
                                    <div style={{ position: 'absolute', inset: -6, background: 'linear-gradient(135deg, #06b6d4, #6366f1, #7c3aed)', borderRadius: 32, opacity: 0.6, filter: 'blur(8px)' }} />
                                    <img src="/ceo_mauro.jpg" alt="Mauro - Fundador & CEO" className="photo-ring"
                                        style={{ width: 200, height: 200, objectFit: 'cover', objectPosition: 'top', borderRadius: 26, position: 'relative', border: '2px solid rgba(6,182,212,0.5)' }} />
                                    <div style={{ position: 'absolute', top: -14, right: -14, background: 'linear-gradient(135deg, #06b6d4, #6366f1)', color: '#fff', fontWeight: 800, padding: '8px 18px', borderRadius: 12, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', transform: 'rotate(3deg)', boxShadow: '0 8px 24px rgba(6,182,212,0.3)' }}>
                                        Fundador & CEO
                                    </div>
                                </div>

                                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                    <h3 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: 0, marginBottom: 6 }}>Mauro</h3>
                                    <p style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.25em', margin: 0 }}>Fundador & Arquitecto Digital</p>
                                    <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.2em', margin: 0, marginTop: 4 }}>Empresa Synoptyk</p>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    {[['15+','Años exp.'],['360°','Visión'],['8','Verticales'],['∞','Escala']].map(([v,l],i) => (
                                        <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '16px', textAlign: 'center' }}>
                                            <p style={{ fontSize: 22, fontWeight: 900, color: '#06b6d4', margin: 0 }}>{v}</p>
                                            <p style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', margin: 0, marginTop: 4 }}>{l}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Story */}
                        <div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 999, padding: '10px 22px', marginBottom: 32 }}>
                                <Star size={14} color="#fbbf24" fill="#fbbf24" />
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Visión Synoptyk</span>
                            </div>

                            <h2 style={{ fontSize: 44, fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 32 }}>
                                Diseñado para las<br /><span className="shimmer">empresas que lideran</span>
                            </h2>

                            <div style={{ borderLeft: '4px solid #06b6d4', paddingLeft: 24, marginBottom: 32, background: 'rgba(6,182,212,0.05)', borderRadius: '0 16px 16px 0', padding: '20px 20px 20px 24px' }}>
                                <Quote size={22} color="#06b6d4" style={{ opacity: 0.5, marginBottom: 10 }} />
                                <p style={{ fontSize: 19, fontWeight: 800, color: '#f1f5f9', fontStyle: 'italic', lineHeight: 1.5, margin: 0 }}>
                                    "Deja que GenAI haga lo complicado, para que tú te enfoques en lo importante."
                                </p>
                                <p style={{ fontSize: 13, color: '#06b6d4', fontWeight: 700, margin: 0, marginTop: 12 }}>— Mauro, Fundador</p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 40 }}>
                                <p style={{ fontSize: 16, color: '#94a3b8', lineHeight: 1.8, margin: 0 }}>
                                    <strong style={{ color: '#e2e8f0' }}>Empresa Synoptyk</strong> nació de una visión simple pero poderosa: las empresas que perduran no son las más grandes, sino las más <strong style={{ color: '#06b6d4' }}>inteligentes</strong>. Con más de 15 años en el campo operativo e industrial, Mauro comprendió que los silos de información son el principal freno del crecimiento.
                                </p>
                                <p style={{ fontSize: 16, color: '#94a3b8', lineHeight: 1.8, margin: 0 }}>
                                    <strong style={{ color: '#818cf8' }}>Gen AI</strong> es la respuesta definitiva. No construimos software. <strong style={{ color: '#e2e8f0' }}>Construimos el sistema nervioso de tu empresa.</strong>
                                </p>
                            </div>

                            <button onClick={() => navigate('/login')} className="btn-cyan" style={{ color: '#fff', padding: '18px 36px', borderRadius: 18, fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                                <Rocket size={18} /> Comenzar Ahora
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section style={{ padding: '100px 0', background: 'linear-gradient(135deg, #020617, #0f172a)', borderTop: '1px solid rgba(6,182,212,0.1)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(6,182,212,0.07), transparent)' }} />
                <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px', textAlign: 'center', position: 'relative', zIndex: 2 }}>
                    <img src="/genai_logo.png" alt="GEN AI" style={{ height: 60, marginBottom: 32 }} className="logo-glow" />
                    <p className="shimmer" style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Deja que GenAI haga lo complicado,</p>
                    <p style={{ fontSize: 24, fontWeight: 900, color: '#e2e8f0', marginBottom: 24 }}>para que tú te enfoques en lo importante.</p>
                    <h2 style={{ fontSize: 40, fontWeight: 900, color: '#fff', marginBottom: 20, lineHeight: 1.2 }}>Tu empresa merece operar<br />con inteligencia real</h2>
                    <p style={{ fontSize: 18, color: '#64748b', marginBottom: 40 }}>Únete a las empresas que ya gestionan todo desde Gen AI.</p>
                    <button onClick={() => navigate('/login')} className="btn-cyan" style={{ color: '#fff', padding: '20px 48px', borderRadius: 20, fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                        Acceder a Gen AI <ArrowRight size={20} />
                    </button>
                </div>
            </section>

            {/* FOOTER */}
            <footer style={{ background: '#020617', padding: '64px 24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ maxWidth: 1280, margin: '0 auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 56, marginBottom: 48 }}>
                        <div>
                            <img src="/genai_logo.png" alt="GEN AI" style={{ height: 44, marginBottom: 20 }} className="logo-glow" />
                            <p style={{ fontSize: 12, fontStyle: 'italic', color: '#94a3b8', marginBottom: 16, fontWeight: 600 }}>"Deja que GenAI haga lo complicado, para que tú te enfoques en lo importante."</p>
                            <p style={{ fontSize: 13, color: '#475569', maxWidth: 320, lineHeight: 1.7 }}>La plataforma que unifica el control operativo, preventivo, productivo y de soporte en un ecosistema inteligente.</p>
                            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                                {[Building2, Mail, Globe].map((Icon, i) => (
                                    <a key={i} href="#!" style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.05)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', textDecoration: 'none' }}>
                                        <Icon size={16} />
                                    </a>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p style={{ fontSize: 10, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 20 }}>Plataforma</p>
                            {['Control Operativo','Control Preventivo','Control Productivo','Áreas de Soporte','Agentes IA','Integraciones'].map(l => (
                                <a key={l} href="#modulos" style={{ display: 'block', fontSize: 13, color: '#475569', fontWeight: 500, textDecoration: 'none', marginBottom: 10, transition: 'color 0.2s' }} onMouseEnter={e=>e.target.style.color='#06b6d4'} onMouseLeave={e=>e.target.style.color='#475569'}>{l}</a>
                            ))}
                        </div>
                        <div>
                            <p style={{ fontSize: 10, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 20 }}>Empresa</p>
                            {['Sobre Synoptyk','Casos de Éxito','Soporte Técnico','Documentación API','Seguridad','Términos de Uso'].map(l => (
                                <a key={l} href="#nosotros" style={{ display: 'block', fontSize: 13, color: '#475569', fontWeight: 500, textDecoration: 'none', marginBottom: 10, transition: 'color 0.2s' }} onMouseEnter={e=>e.target.style.color='#06b6d4'} onMouseLeave={e=>e.target.style.color='#475569'}>{l}</a>
                            ))}
                        </div>
                    </div>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontSize: 11, color: '#334155', fontWeight: 700 }}>© 2026 Gen AI · Empresa Synoptyk · Todos los derechos reservados</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#475569', fontWeight: 700 }}>
                            <ShieldCheck size={14} color="#06b6d4" /> SSL 256bit · SOC2 Ready · ISO 27001
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default GenAiLanding;

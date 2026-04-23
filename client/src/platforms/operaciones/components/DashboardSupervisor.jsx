import React from 'react';
import { 
    Users, ShieldCheck, ClipboardCheck, BarChart3, 
    ArrowRight, AlertTriangle, CheckCircle2 
} from 'lucide-react';

const DashboardSupervisor = ({ miEquipo, asts, fuelRequests, setCurrentView }) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Stats calculations
    const teamWithAst = miEquipo.filter(t => 
        asts.some(a => (a.createdAt || a.fecha)?.startsWith(today) && a.rutTrabajador === t.rut)
    ).length;
    
    const pendingAst = miEquipo.length - teamWithAst;
    const pendingFuel = fuelRequests.filter(r => r.estado === 'Pendiente').length;
    const teamSize = miEquipo.length;

    const StatCard = ({ title, value, total, icon: Icon, color, onClick, subtitle }) => (
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between h-48 hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
                <div className={`p-3 rounded-2xl ${color} text-white shadow-lg`}>
                    <Icon size={20} />
                </div>
                {total && (
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progreso</p>
                        <p className="text-sm font-black text-slate-700">{Math.round((value/total)*100)}%</p>
                    </div>
                )}
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
                <h3 className="text-3xl font-black text-slate-900 mt-1">{value}{total ? <span className="text-slate-300 text-xl">/{total}</span> : ''}</h3>
                {subtitle && <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 italic">{subtitle}</p>}
            </div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Cumplimiento AST Hoy"
                    value={teamWithAst}
                    total={teamSize}
                    icon={ShieldCheck}
                    color="bg-emerald-500"
                    subtitle={`${pendingAst} técnicos pendientes de firma`}
                />
                <StatCard 
                    title="Solicitudes Combustible"
                    value={pendingFuel}
                    icon={Users}
                    color="bg-orange-500"
                    subtitle="Pendientes de tu aprobación"
                />
                <StatCard 
                    title="Dotación Activa"
                    value={teamSize}
                    icon={Users}
                    color="bg-violet-500"
                    subtitle="Técnicos vinculados a tu equipo"
                />
                <StatCard 
                    title="Rendimiento Semanal"
                    value="85"
                    total="100"
                    icon={BarChart3}
                    color="bg-indigo-500"
                    subtitle="Basado en metas de producción"
                />
            </div>

            {/* Quick Actions / Critical Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-900 rounded-[3rem] p-8 text-white">
                    <h3 className="text-xl font-black uppercase tracking-tight italic mb-6">Próximos Vencimientos</h3>
                    <div className="space-y-4">
                        {miEquipo.slice(0, 3).map((tec, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center font-black">
                                        {tec.nombre?.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-black uppercase">{tec.nombre}</p>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase">Licencia Conducir: 15 Mayo</p>
                                    </div>
                                </div>
                                <span className="px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-[8px] font-black uppercase">Próximo</span>
                            </div>
                        ))}
                        {miEquipo.length === 0 && <p className="text-slate-500 text-xs italic">Sin datos de equipo</p>}
                    </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-[3rem] p-8 shadow-sm">
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic mb-6">Estado de Seguridad (Hoy)</h3>
                    <div className="space-y-4">
                        {miEquipo.map((tec, i) => {
                            const hasAst = asts.some(a => (a.createdAt || a.fecha)?.startsWith(today) && a.rutTrabajador === tec.rut);
                            return (
                                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-2 h-2 rounded-full ${hasAst ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'}`} />
                                        <p className="text-xs font-black text-slate-700 uppercase">{tec.nombre}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {hasAst ? (
                                            <span className="flex items-center gap-1.5 text-emerald-600 font-black text-[9px] uppercase">
                                                <CheckCircle2 size={12} /> AST Firmado
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-rose-500 font-black text-[9px] uppercase">
                                                <AlertTriangle size={12} /> AST Pendiente
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardSupervisor;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, FileCheck, Search, Loader2, Users,
  CheckCircle2, XCircle, UserCheck, Clock,
  Briefcase, Landmark, ShieldCheck, ChevronRight,
  BarChart3, FolderKanban, UserX,
  Building2, FileText, Calendar, Activity, TrendingUp,
  RefreshCw, ChevronDown
} from 'lucide-react';
import { candidatosApi, proyectosApi } from '../../rrhh/rrhhApi';

// ── Quick-access sub-module cards ──
const MODULES = [
  { label: 'Captura de Talento', path: '/rrhh/captura-talento', icon: UserPlus, color: 'amber' },
  { label: 'Proyectos', path: '/proyectos', icon: FolderKanban, color: 'indigo' },
  { label: 'Personal Activo', path: '/rrhh/personal-activo', icon: UserCheck, color: 'emerald' },
  { label: 'Vacaciones/Licencias', path: '/rrhh/vacaciones-licencias', icon: Calendar, color: 'sky' },
  { label: 'Control Asistencia', path: '/rrhh/control-asistencia', icon: Activity, color: 'violet' },
  { label: 'Nómina', path: '/rrhh/nomina', icon: Landmark, color: 'teal' },
  { label: 'Relaciones Laborales', path: '/rrhh/relaciones-laborales', icon: Briefcase, color: 'rose' },
  { label: 'Gestión Documental', path: '/rrhh/gestion-documental', icon: FileText, color: 'slate' },
];

const COLOR = {
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600', border: 'border-amber-100', hover: 'hover:border-amber-300 hover:shadow-amber-100' },
  indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600', border: 'border-indigo-100', hover: 'hover:border-indigo-300 hover:shadow-indigo-100' },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100', hover: 'hover:border-emerald-300 hover:shadow-emerald-100' },
  sky: { bg: 'bg-sky-50', icon: 'text-sky-600', border: 'border-sky-100', hover: 'hover:border-sky-300 hover:shadow-sky-100' },
  violet: { bg: 'bg-violet-50', icon: 'text-violet-600', border: 'border-violet-100', hover: 'hover:border-violet-300 hover:shadow-violet-100' },
  teal: { bg: 'bg-teal-50', icon: 'text-teal-600', border: 'border-teal-100', hover: 'hover:border-teal-300 hover:shadow-teal-100' },
  rose: { bg: 'bg-rose-50', icon: 'text-rose-600', border: 'border-rose-100', hover: 'hover:border-rose-300 hover:shadow-rose-100' },
  slate: { bg: 'bg-slate-50', icon: 'text-slate-600', border: 'border-slate-100', hover: 'hover:border-slate-300 hover:shadow-slate-100' },
};

const RecursosHumanos = () => {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [globalAnalytics, setGlobalAnalytics] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [candRes, projRes, analyticsRes] = await Promise.all([
        candidatosApi.getAll(),
        proyectosApi.getAll(),
        proyectosApi.getAnalyticsGlobal().catch(() => ({ data: null }))
      ]);
      const allCandidates = candRes.data || [];
      setCandidates(allCandidates);
      setProyectos(projRes.data || []);
      setGlobalAnalytics(analyticsRes.data);

      // Build approvals queue
      const awaiting = [];
      allCandidates.forEach(person => {
        if (person.validationRequested && person.status !== 'Contratado' && person.status !== 'Rechazado') {
          awaiting.push({ ...person, approvalType: 'Ingreso', currentChain: person.approvalChain || [] });
        }
        (person.vacaciones || []).forEach(v => {
          if (v.validationRequested && v.estado === 'Pendiente') {
            awaiting.push({ ...person, approvalType: v.tipo, currentChain: v.approvalChain || [], vacacionId: v.id || v._id, details: v });
          }
        });
      });
      setApplicants(awaiting);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  // ── Approval actions (same logic, just preserved) ──
  const handleApproveStep = async (personId, approverId, comment, type, vId) => {
    try {
      setSaving(true);
      const person = applicants.find(a => a._id === personId && (type === 'Ingreso' ? a.approvalType === 'Ingreso' : a.vacacionId === vId));
      if (!person) return;
      const newChain = person.currentChain.map(step =>
        step.id === approverId ? { ...step, status: 'Aprobado', comment, updatedAt: new Date().toISOString() } : step
      );
      const allApproved = newChain.every(s => s.status === 'Aprobado');
      if (type === 'Ingreso') {
        await candidatosApi.updateStatus(personId, { approvalChain: newChain, status: allApproved ? 'Contratado' : person.status });
      } else {
        const updatedVacaciones = person.vacaciones.map(v =>
          (v.id || v._id) === vId ? { ...v, approvalChain: newChain, estado: allApproved ? 'Aprobado' : v.estado } : v
        );
        await candidatosApi.update(personId, { vacaciones: updatedVacaciones });
      }
      fetchAll();
      setSelectedApplicant(null);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const handleRejectStep = async (personId, approverId, comment, type, vId) => {
    try {
      setSaving(true);
      const person = applicants.find(a => a._id === personId);
      if (!person) return;
      const newChain = person.currentChain.map(step =>
        step.id === approverId ? { ...step, status: 'Rechazado', comment, updatedAt: new Date().toISOString() } : step
      );
      if (type === 'Ingreso') {
        await candidatosApi.updateStatus(personId, { approvalChain: newChain, status: 'Rechazado' });
      } else {
        const updatedVacaciones = person.vacaciones.map(v =>
          (v.id || v._id) === vId ? { ...v, approvalChain: newChain, estado: 'Rechazado' } : v
        );
        await candidatosApi.update(personId, { vacaciones: updatedVacaciones });
      }
      fetchAll();
      setSelectedApplicant(null);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  // ── Derived stats ──
  const ga = globalAnalytics?.totales || null;
  const cntPostulando = candidates.filter(c => ['En Postulación', 'Postulando', 'En Entrevista', 'En Evaluación', 'En Acreditación', 'En Documentación', 'Aprobado'].includes(c.status)).length;
  const cntContratados = candidates.filter(c => c.status === 'Contratado').length;
  const cntFiniquitados = candidates.filter(c => ['Finiquitado', 'Retirado'].includes(c.status)).length;
  const proyectosActivos = proyectos.filter(p => p.status === 'Activo').length;

  const filteredApplicants = applicants.filter(a =>
    a.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.rut?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const KPI_CARDS = [
    { label: 'Total Registros', value: candidates.length, icon: Users, color: 'bg-indigo-500', sub: 'en el sistema' },
    { label: 'En Proceso', value: cntPostulando, icon: Clock, color: 'bg-violet-500', sub: 'selección activa' },
    { label: 'Contratados', value: ga?.globalAct ?? cntContratados, icon: CheckCircle2, color: 'bg-emerald-500', sub: ga ? `${ga.globalEnPermiso ?? 0} en permiso` : 'activos' },
    { label: 'En Permiso', value: ga?.globalEnPermiso ?? 0, icon: Calendar, color: 'bg-amber-500', sub: 'permiso/licencia hoy' },
    { label: 'Finiquitados', value: ga?.globalFin ?? cntFiniquitados, icon: UserX, color: 'bg-rose-500', sub: 'histórico salidas' },
    { label: 'Proyectos', value: proyectosActivos, icon: FolderKanban, color: 'bg-teal-500', sub: `${proyectos.length} total` },
    { label: 'Cobertura Global', value: `${ga?.coberturaGlobal ?? '—'}${ga ? '%' : ''}`, icon: TrendingUp, color: 'bg-sky-500', sub: 'dotación cubierta' },
    { label: 'Pendiente Firma', value: applicants.length, icon: FileCheck, color: 'bg-orange-500', sub: 'aprobaciones' },
  ];

  return (
    <div className="min-h-full bg-slate-50/50 pb-20">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-200">
            <Building2 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">
              Administración <span className="text-indigo-600">RRHH</span>
            </h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">
              Centro de mando · Gestión de personal y reclutamiento
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className={`flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-500 font-black text-xs uppercase tracking-wider hover:border-indigo-200 hover:text-indigo-600 transition-all shadow-sm ${refreshing ? 'animate-pulse' : ''}`}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* ── KPI BAR ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-8">
        {KPI_CARDS.map((card, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-[1.5rem] p-4 shadow-sm hover:shadow-md transition-all group">
            <div className={`w-9 h-9 ${card.color} rounded-xl flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform`}>
              <card.icon size={16} className="text-white" />
            </div>
            <div className="text-xl font-black text-slate-800 tracking-tighter leading-none">{card.value}</div>
            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{card.label}</div>
            <div className="text-[8px] font-bold text-slate-300 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── ACCESSES RÁPIDOS ── */}
      <div className="mb-8">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Acceso Rápido a Módulos</p>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          {MODULES.map((mod, i) => {
            const cs = COLOR[mod.color];
            return (
              <button
                key={i}
                onClick={() => navigate(mod.path)}
                className={`bg-white border ${cs.border} ${cs.hover} rounded-2xl p-4 flex flex-col items-center gap-3 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 group`}
              >
                <div className={`p-2.5 ${cs.bg} ${cs.icon} rounded-xl group-hover:scale-110 transition-transform`}>
                  <mod.icon size={18} />
                </div>
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-wide text-center leading-tight">{mod.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── ANALYTICS POR PROYECTO ── */}
      {globalAnalytics?.proyectos?.length > 0 && (
        <div className="bg-white border border-indigo-100 rounded-[2rem] mb-8 overflow-hidden shadow-sm">
          <button
            onClick={() => setShowAnalytics(v => !v)}
            className="w-full flex items-center justify-between px-7 py-5 hover:bg-indigo-50/30 transition-all"
          >
            <div className="flex items-center gap-3">
              <BarChart3 size={16} className="text-indigo-500" />
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Operación de Reclutamiento por Proyecto</span>
              <span className="text-[8px] font-black bg-indigo-100 text-indigo-500 px-2 py-0.5 rounded-full">En tiempo real</span>
            </div>
            <ChevronDown size={16} className={`text-indigo-400 transition-transform duration-300 ${showAnalytics ? 'rotate-180' : ''}`} />
          </button>

          {showAnalytics && (
            <div className="px-7 pb-7 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {globalAnalytics.proyectos.map(p => {
                const pct = p.cobertura ?? 0;
                const barColor = pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-indigo-500' : 'bg-amber-400';
                const txtColor = pct >= 100 ? 'text-emerald-600' : pct >= 60 ? 'text-indigo-600' : 'text-amber-600';
                return (
                  <div key={p._id} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-all group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="font-black text-slate-900 text-sm leading-tight truncate">{p.nombreProyecto}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">{p.centroCosto}</span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase">{p.area || ''}</span>
                        </div>
                      </div>
                      <span className={`text-2xl font-black ${txtColor} flex-shrink-0`}>{pct}%</span>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 mb-4">
                      {[
                        { label: 'Req.', value: p.requerido, bg: 'bg-slate-100', txt: 'text-slate-700' },
                        { label: 'Activos', value: p.activos, bg: 'bg-emerald-50', txt: 'text-emerald-700' },
                        { label: 'Permiso', value: p.enPermiso, bg: 'bg-amber-50', txt: 'text-amber-700' },
                        { label: 'Postul.', value: p.postulando, bg: 'bg-indigo-50', txt: 'text-indigo-700' },
                        { label: 'Pend.', value: p.pendientes, bg: p.pendientes > 0 ? 'bg-red-50' : 'bg-emerald-50', txt: p.pendientes > 0 ? 'text-red-700' : 'text-emerald-700' },
                      ].map((s, si) => (
                        <div key={si} className={`${s.bg} rounded-xl p-2 text-center`}>
                          <p className={`text-xs font-black ${s.txt}`}>{s.value ?? 0}</p>
                          <p className={`text-[7px] font-bold uppercase ${s.txt} opacity-70`}>{s.label}</p>
                        </div>
                      ))}
                    </div>

                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <p className="text-[8px] text-slate-400 font-bold mt-1.5">
                      {p.activos}/{p.requerido} cubiertos · {p.pendientes} pendientes de contratar
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── COLA DE APROBACIONES ── */}
      <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <FileCheck size={18} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800 uppercase tracking-wide">Cola de Aprobaciones</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ingresos · Vacaciones · Permisos</p>
            </div>
            {applicants.length > 0 && (
              <span className="ml-2 text-[9px] font-black text-white bg-orange-500 px-2.5 py-1 rounded-full shadow-sm">
                {applicants.length} pendientes
              </span>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Buscar..."
              className="pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-300 w-48"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row overflow-hidden" style={{ minHeight: '400px' }}>
          {/* Left: list */}
          <div className="lg:w-80 border-r border-slate-50 flex-shrink-0 overflow-y-auto custom-scrollbar" style={{ maxHeight: '600px' }}>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="animate-spin text-emerald-500" size={28} />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando...</span>
              </div>
            ) : filteredApplicants.length > 0 ? (
              filteredApplicants.map(app => (
                <button
                  key={`${app._id}-${app.approvalType}`}
                  onClick={() => setSelectedApplicant(app)}
                  className={`w-full p-5 text-left transition-all hover:bg-slate-50 flex items-center gap-4 border-l-4 ${selectedApplicant?._id === app._id && selectedApplicant?.approvalType === app.approvalType
                    ? 'bg-emerald-50/60 border-emerald-500'
                    : 'border-transparent'
                    }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white shadow-sm flex-shrink-0 ${app.approvalType === 'Ingreso' ? 'bg-indigo-500' : 'bg-cyan-500'
                    }`}>
                    {app.fullName?.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-slate-800 text-xs uppercase truncate">{app.fullName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[8px] font-bold text-slate-400">{app.rut}</span>
                      <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-md uppercase ${app.approvalType === 'Ingreso' ? 'bg-indigo-100 text-indigo-600' : 'bg-cyan-100 text-cyan-600'}`}>
                        {app.approvalType}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
                </button>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                <FileCheck size={40} className="opacity-30 mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sin aprobaciones pendientes</p>
              </div>
            )}
          </div>

          {/* Right: detail */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
            {selectedApplicant ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Header card */}
                <div className="bg-slate-900 text-white rounded-[2rem] p-8 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center text-2xl font-black shadow-xl">
                      {selectedApplicant.fullName?.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight">{selectedApplicant.fullName}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-bold text-slate-400">{selectedApplicant.rut}</span>
                        <span className="w-1 h-1 bg-slate-600 rounded-full" />
                        <span className="text-emerald-400 text-[10px] font-black uppercase">{selectedApplicant.position}</span>
                      </div>
                    </div>
                  </div>
                  <div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border ${selectedApplicant.approvalType === 'Ingreso'
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    : 'bg-cyan-500/20  text-cyan-300  border-cyan-500/30'
                    }`}>
                    {selectedApplicant.approvalType}
                  </div>
                </div>

                {/* Vacation/leave detail */}
                {selectedApplicant.approvalType !== 'Ingreso' && selectedApplicant.details && (
                  <div className="bg-cyan-50 border border-cyan-100 rounded-2xl p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white rounded-xl text-cyan-600 shadow-sm"><Clock size={20} /></div>
                      <div>
                        <p className="text-[9px] font-black text-cyan-600 uppercase mb-1">Período Solicitado</p>
                        <p className="font-black text-slate-800">
                          {new Date(selectedApplicant.details.fechaInicio + 'T12:00:00').toLocaleDateString()} → {new Date(selectedApplicant.details.fechaFin + 'T12:00:00').toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Días Hábiles</p>
                      <p className="text-2xl font-black text-slate-800">{selectedApplicant.details.diasHabiles}</p>
                    </div>
                  </div>
                )}

                {/* Approval chain */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><ShieldCheck size={18} /></div>
                    <div>
                      <p className="text-xs font-black text-slate-800 uppercase tracking-wide">Flujo de Aprobación</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Cada paso requiere validación y comentario</p>
                    </div>
                  </div>
                  <div className="space-y-6">
                    {selectedApplicant.currentChain?.map((step, idx) => (
                      <div key={step.id || idx} className={`relative flex gap-6 p-6 rounded-2xl border ${step.status === 'Aprobado' ? 'bg-emerald-50/40 border-emerald-100' :
                        step.status === 'Rechazado' ? 'bg-red-50/40 border-red-100' : 'bg-slate-50 border-slate-100'
                        }`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 shadow-sm ${step.status === 'Aprobado' ? 'bg-emerald-600 text-white' :
                          step.status === 'Rechazado' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'
                          }`}>
                          {step.status === 'Aprobado' ? <CheckCircle2 size={20} /> : step.status === 'Rechazado' ? <XCircle size={20} /> : idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="font-black text-slate-800 text-sm uppercase">{step.name}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{step.position}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase border ${step.status === 'Aprobado' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                              step.status === 'Rechazado' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-slate-400 border-slate-200'
                              }`}>{step.status}</span>
                          </div>

                          {step.status === 'Pendiente' ? (
                            <div className="space-y-3">
                              <textarea
                                id={`comment-${step.id}`}
                                placeholder="ESCRIBA UN COMENTARIO U OBSERVACIÓN..."
                                className="w-full bg-white border border-slate-200 p-4 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-300 min-h-[80px] resize-none"
                              />
                              <div className="flex gap-3">
                                <button
                                  disabled={saving}
                                  onClick={() => handleApproveStep(selectedApplicant._id, step.id, document.getElementById(`comment-${step.id}`)?.value || '', selectedApplicant.approvalType, selectedApplicant.vacacionId)}
                                  className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                                >
                                  ✓ Aprobar y Firmar
                                </button>
                                <button
                                  disabled={saving}
                                  onClick={() => handleRejectStep(selectedApplicant._id, step.id, document.getElementById(`comment-${step.id}`)?.value || '', selectedApplicant.approvalType, selectedApplicant.vacacionId)}
                                  className="flex-1 bg-white text-red-600 border border-red-100 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all active:scale-95 disabled:opacity-50"
                                >
                                  ✕ Rechazar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-white/60 p-4 rounded-xl border border-white/50">
                              <p className="text-xs text-slate-600 font-bold uppercase italic">{step.comment || 'Sin comentarios registrados'}</p>
                              {step.updatedAt && (
                                <p className="text-[8px] text-slate-400 mt-1.5 font-black uppercase tracking-widest">
                                  Actualizado: {new Date(step.updatedAt).toLocaleString()}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-indigo-300/20 blur-3xl rounded-full" />
                  <FileCheck size={64} className="relative opacity-20" />
                </div>
                <p className="text-lg font-black uppercase tracking-tight text-slate-400">Panel de Aprobación</p>
                <p className="text-sm font-bold text-slate-400 mt-2 text-center max-w-xs leading-relaxed">
                  Selecciona un elemento de la lista para revisar y procesar la firma.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecursosHumanos;
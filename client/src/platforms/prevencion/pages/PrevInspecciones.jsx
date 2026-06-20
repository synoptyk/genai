import React, { useState, useEffect, useMemo } from 'react';
import {
    ClipboardList, ShieldCheck, HardHat, CheckCircle2, X, AlertTriangle,
    Eye, ChevronRight, Truck, Loader2, FileText
} from 'lucide-react';
import { inspeccionesApi } from '../prevencionApi';
import SlideOverInspCumplimiento from '../components/Inspecciones/SlideOverInspCumplimiento';
import SlideOverInspEpp from '../components/Inspecciones/SlideOverInspEpp';
import SlideOverInspVehicular from '../components/Inspecciones/SlideOverInspVehicular';
import { AlertModal } from '../components/Inspecciones/SharedComponents';

const PrevInspecciones = ({ rutsPermitidos = [], mostrarSoloPermitidos = false }) => {
    const normalizeRut = (value = '') => String(value).replace(/[^0-9kK]/g, '').toUpperCase();
    const rutsPermitidosSet = new Set((rutsPermitidos || []).map(r => normalizeRut(r)));
    
    // SlideOvers State
    const [isCumplimientoOpen, setIsCumplimientoOpen] = useState(false);
    const [isEppOpen, setIsEppOpen] = useState(false);
    const [isVehicularOpen, setIsVehicularOpen] = useState(false);
    const [alert, setAlert] = useState(null);

    const showAlert = (message, type = 'info', onConfirm = null) => {
        setAlert({ message, type, onConfirm });
        if (type !== 'confirm') setTimeout(() => setAlert(null), 4000);
    };
    
    const handleSuccess = (msg) => {
        showAlert(msg, 'success');
    };

    return (
            <div className="min-h-screen bg-slate-50/50 p-6 md:p-10 w-full overflow-x-hidden relative">
                <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-6">
                        <div className="bg-slate-900 text-white p-5 rounded-[2rem] shadow-2xl border-4 border-white transform -rotate-3">
                            <ClipboardList size={32} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">
                                Módulo <span className="text-rose-600">Inspecciones</span>
                            </h1>
                            <p className="text-slate-500 text-[11px] font-black mt-2 uppercase tracking-[0.4em]">Control en Terreno · GENAI360 v8.0</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {/* OPCIÓN 1: CUMPLIMIENTO */}
                    <button onClick={() => setIsCumplimientoOpen(true)} className="group bg-white rounded-[3rem] p-10 border border-slate-100 shadow-lg hover:shadow-2xl hover:shadow-rose-100 hover:-translate-y-2 transition-all text-left relative overflow-hidden">
                        <div className="absolute -top-8 -right-8 w-40 h-40 bg-rose-50 rounded-full transition-all group-hover:scale-150 group-hover:bg-rose-100" />
                        <div className="relative z-10">
                            <div className="bg-rose-600 text-white p-4 rounded-[2rem] w-fit shadow-xl shadow-rose-200 mb-8 group-hover:scale-110 transition-transform">
                                <ShieldCheck size={36} />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter leading-tight">
                                Inspección Cumplimiento<br />
                                <span className="text-rose-600">de Prevención</span>
                            </h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-4 leading-relaxed">
                                Verifica en terreno AST vigente, PTS asignado, EPP completo e inducción realizada.
                            </p>
                            <div className="flex items-center gap-3 mt-8 text-rose-600 font-black text-[10px] uppercase tracking-widest">
                                Nueva Inspección <ChevronRight size={16} className="group-hover:translate-x-2 transition-transform" />
                            </div>
                        </div>
                    </button>

                    {/* OPCIÓN 2: EPP */}
                    <button onClick={() => setIsEppOpen(true)} className="group bg-white rounded-[3rem] p-10 border border-slate-100 shadow-lg hover:shadow-2xl hover:shadow-orange-100 hover:-translate-y-2 transition-all text-left relative overflow-hidden">
                        <div className="absolute -top-8 -right-8 w-40 h-40 bg-orange-50 rounded-full transition-all group-hover:scale-150 group-hover:bg-orange-100" />
                        <div className="relative z-10">
                            <div className="bg-orange-500 text-white p-4 rounded-[2rem] w-fit shadow-xl shadow-orange-200 mb-8 group-hover:scale-110 transition-transform">
                                <HardHat size={36} />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter leading-tight">
                                Inspección de EPP<br />
                                <span className="text-orange-500">Protección Personal</span>
                            </h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-4 leading-relaxed">
                                Revisa ítem por ítem el equipo. Genera alerta en consola HSE ante deficiencias.
                            </p>
                            <div className="flex items-center gap-3 mt-8 text-orange-500 font-black text-[10px] uppercase tracking-widest">
                                Nueva Inspección <ChevronRight size={16} className="group-hover:translate-x-2 transition-transform" />
                            </div>
                        </div>
                    </button>

                    {/* OPCIÓN 3: VEHICULAR */}
                    <button onClick={() => setIsVehicularOpen(true)} className="group bg-white rounded-[3rem] p-10 border border-slate-100 shadow-lg hover:shadow-2xl hover:shadow-blue-100 hover:-translate-y-2 transition-all text-left relative overflow-hidden">
                        <div className="absolute -top-8 -right-8 w-40 h-40 bg-blue-50 rounded-full transition-all group-hover:scale-150 group-hover:bg-blue-100" />
                        <div className="relative z-10">
                            <div className="bg-blue-600 text-white p-4 rounded-[2rem] w-fit shadow-xl shadow-blue-200 mb-8 group-hover:scale-110 transition-transform">
                                <Truck size={36} />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter leading-tight">
                                Inspección<br />
                                <span className="text-blue-600">Vehicular</span>
                            </h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-4 leading-relaxed">
                                Control de flota: documentación, mecánica, carrocería e inventario vehicular.
                            </p>
                            <div className="flex items-center gap-3 mt-8 text-blue-600 font-black text-[10px] uppercase tracking-widest">
                                Nueva Inspección <ChevronRight size={16} className="group-hover:translate-x-2 transition-transform" />
                            </div>
                        </div>
                    </button>
                </div>

                {/* MODALES SLIDEOVER */}
                <SlideOverInspCumplimiento 
                    isOpen={isCumplimientoOpen} 
                    onClose={() => setIsCumplimientoOpen(false)} 
                    rutsPermitidos={rutsPermitidos} 
                    mostrarSoloPermitidos={mostrarSoloPermitidos}
                    onSuccess={handleSuccess}
                />
                <SlideOverInspEpp 
                    isOpen={isEppOpen} 
                    onClose={() => setIsEppOpen(false)} 
                    rutsPermitidos={rutsPermitidos} 
                    mostrarSoloPermitidos={mostrarSoloPermitidos}
                    onSuccess={handleSuccess}
                />
                <SlideOverInspVehicular 
                    isOpen={isVehicularOpen} 
                    onClose={() => setIsVehicularOpen(false)} 
                    onSuccess={handleSuccess}
                />

                <AlertModal alert={alert} setAlert={setAlert} />
            </div>
    );
};

export default PrevInspecciones;

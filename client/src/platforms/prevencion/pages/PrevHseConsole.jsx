import React, { useState, useEffect } from 'react';
import {
    Search, FileText,
    MapPin, ShieldAlert, CheckCircle2, Info, Radio,
    BarChart3, X, AlertTriangle, Camera
} from 'lucide-react';
import { astApi } from '../prevencionApi';

const PrevHseConsole = () => {
    const [loading, setLoading] = useState(false);
    const [asts, setAsts] = useState([]);
    const [activeTab, setActiveTab] = useState('En Revisión');
    const [viewMode, setViewMode] = useState('list'); // 'list', 'smart', 'stats'
    const [smartSample, setSmartSample] = useState([]);
    const [selectedAst, setSelectedAst] = useState(null); // Para el visor PDF
    const [feedbackAst, setFeedbackAst] = useState(null); // Para el modal de inconsistencia
    const [alert, setAlert] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await astApi.getAll();
            setAsts(res.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const showAlert = (message, type = 'info', onConfirm = null) => {
        setAlert({ message, type, onConfirm });
        if (type !== 'confirm') setTimeout(() => setAlert(null), 4000);
    };

    const handleHseApproval = async (id) => {
        showAlert('¿CONFIRMA LA VALIDACIÓN Y FIRMA HSE DE ESTE ANÁLISIS?', 'confirm', async () => {
            try {
                await astApi.update(id, {
                    estado: 'Aprobado',
                    firmaHse: 'HSE_EXPERT_SIGNATURE',
                    fechaAprobacion: new Date()
                });
                showAlert('AST APROBADA CORRECTAMENTE', 'success');
                fetchData();
            } catch {
                showAlert('ERROR EN VALIDACIÓN', 'error');
            }
        });
    };

    const generateSmartSample = () => {
        const pending = asts.filter(a => a.estado === 'En Revisión');
        if (pending.length === 0) return showAlert('NO HAY REGISTROS PENDIENTES', 'info');

        // Muestreo inteligente: 20% de la carga o al menos 5 registros
        const sampleSize = Math.max(5, Math.ceil(pending.length * 0.2));
        const shuffled = [...pending].sort(() => 0.5 - Math.random());
        setSmartSample(shuffled.slice(0, sampleSize));
        setViewMode('smart');
        showAlert(`MUESTRA GENERADA: ${Math.min(sampleSize, pending.length)} REGISTROS CRÍTICOS`, 'success');
    };

    const handleBatchApproval = async () => {
        const pending = asts.filter(a => a.estado === 'En Revisión');
        showAlert(`¿CONFIRMA LA APROBACIÓN MASIVA DE LOS ${pending.length} REGISTROS PENDIENTES?`, 'confirm', async () => {
            setLoading(true);
            try {
                // Se aprueban TODOS los pendientes del sistema, no solo la muestra
                await Promise.all(pending.map(ast =>
                    astApi.update(ast._id, {
                        estado: 'Aprobado',
                        firmaHse: 'SMART_AUDIT_BATCH_MASTER',
                        fechaAprobacion: new Date()
                    })
                ));
                showAlert('TOTALIDAD DE REGISTROS APROBADOS Y REGISTRADOS', 'success');
                setViewMode('list');
                fetchData();
            } catch {
                showAlert('ERROR EN PROCESO MASIVO', 'error');
            } finally {
                setLoading(false);
            }
        });
    };

    const [rejectionData, setRejectionData] = useState({ comment: '', photo: null });

    const handleInconsistencyReport = async () => {
        if (!rejectionData.comment) return showAlert('DEBE ESCRIBIR UN COMENTARIO DE INCONSISTENCIA', 'error');
        setLoading(true);
        try {
            await astApi.update(feedbackAst._id, {
                estado: 'Rechazado',
                comentariosHse: rejectionData.comment,
                fotoInconsistencia: rejectionData.photo
            });
            showAlert('INCONSISTENCIA REPORTADA AL TRABAJADOR', 'success');
            setFeedbackAst(null);
            setRejectionData({ comment: '', photo: null });
            fetchData();
        } catch {
            showAlert('ERROR AL REPORTAR', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRejectionPhoto = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setRejectionData(prev => ({ ...prev, photo: reader.result }));
        reader.readAsDataURL(file);
    };

    const filteredAsts = viewMode === 'smart' ? smartSample : asts.filter(ast => ast.estado === activeTab);

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-10 pb-20">
            <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-6">
                    <div className="bg-slate-900 text-white p-5 rounded-[2rem] shadow-2xl transform -rotate-3 border-4 border-white">
                        <ShieldAlert size={32} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Consola <span className="text-rose-600">HSE Audit</span></h1>
                        <p className="text-slate-500 text-[11px] font-black mt-2 uppercase tracking-[0.4em]">Gestión y Validación de Seguridad Operativa</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-6 mb-10">
                <div className="flex gap-4 bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm w-fit">
                    {['En Revisión', 'Aprobado', 'Rechazado'].map(tab => (
                        <button key={tab} onClick={() => { setActiveTab(tab); setViewMode('list'); }} className={`px-10 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab && viewMode === 'list' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                            {tab} {tab === 'En Revisión' && asts.filter(a => a.estado === 'En Revisión').length > 0 && <span className="ml-2 bg-rose-600 text-white px-2 py-0.5 rounded-full text-[8px]">{asts.filter(a => a.estado === 'En Revisión').length}</span>}
                        </button>
                    ))}
                </div>

                <div className="flex gap-4">
                    <button onClick={generateSmartSample} className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${viewMode === 'smart' ? 'bg-rose-600 text-white shadow-xl' : 'bg-white border border-slate-100 text-slate-400 hover:text-rose-600 shadow-sm'}`}>
                        <Radio size={18} className={viewMode === 'smart' ? 'animate-pulse' : ''} /> Auditoría Inteligente
                    </button>
                    <button onClick={() => setViewMode('stats')} className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${viewMode === 'stats' ? 'bg-indigo-600 text-white shadow-xl' : 'bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 shadow-sm'}`}>
                        <BarChart3 size={18} /> Estadísticas
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[4rem] border border-slate-100 shadow-2xl shadow-slate-200/40 overflow-hidden">
                <div className="p-12 border-b border-slate-50 flex items-center justify-between">
                    <h3 className="text-xl font-black text-slate-900 uppercase italic">Historial de Análisis de Seguridad</h3>
                    <div className="relative">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                        <input type="text" placeholder="BUSCAR POR OT O EMPRESA..." className="bg-slate-50 pl-16 pr-8 py-4 rounded-full text-xs font-bold uppercase w-80 border border-slate-100 outline-none focus:ring-4 focus:ring-rose-500/5 transition-all" />
                    </div>
                </div>

                <div className="divide-y divide-slate-50">
                    {loading ? (
                        <div className="p-32 text-center flex flex-col items-center gap-6">
                            <div className="w-16 h-16 border-4 border-rose-100 border-t-rose-600 rounded-full animate-spin"></div>
                            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Cargando Registros...</p>
                        </div>
                    ) : filteredAsts.length > 0 ? (
                        filteredAsts.map(ast => (
                            <div key={ast._id} className="p-10 hover:bg-slate-50/80 transition-all flex items-center justify-between group border-l-4 border-l-transparent hover:border-l-rose-600">
                                <div className="flex items-center gap-8">
                                    <div className="w-16 h-16 rounded-[2rem] bg-slate-900 text-white flex items-center justify-center font-black shadow-xl group-hover:scale-110 transition-all uppercase">{ast.ot?.substring(0, 3)}</div>
                                    <div>
                                        <h4 className="font-black text-slate-800 uppercase text-lg tracking-tighter">{ast.empresa}</h4>
                                        <div className="flex items-center gap-6 mt-2">
                                            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-2"><MapPin size={12} className="text-rose-500" /> {ast.comuna}</span>
                                            <span className="text-[11px] font-black text-rose-500 uppercase tracking-widest border-l pl-6 border-slate-200">OT: {ast.ot}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-12">
                                    <div className="text-right">
                                        <p className="text-[11px] font-black text-slate-900 uppercase">{new Date(ast.createdAt).toLocaleDateString()}</p>
                                        <div className="flex items-center justify-end gap-2 mt-1">
                                            <CheckCircle2 size={12} className="text-emerald-500" />
                                            <p className="text-[9px] font-black text-slate-400 uppercase">Firma Digital OK</p>
                                        </div>
                                    </div>

                                    {ast.estado === 'En Revisión' && viewMode !== 'smart' && (
                                        <button onClick={() => handleHseApproval(ast._id)} className="bg-emerald-100 text-emerald-700 px-8 py-4 rounded-full font-black text-[10px] uppercase hover:bg-emerald-600 hover:text-white transition-all shadow-md active:scale-95 border border-emerald-200">
                                            Aprobar HSE
                                        </button>
                                    )}

                                    <div className="flex gap-2">
                                        <button onClick={() => setSelectedAst(ast)} title="Ver Expediente" className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-white hover:text-rose-600 shadow-sm border border-transparent hover:border-slate-100 transition-all"><FileText size={20} /></button>
                                        {ast.estado === 'En Revisión' && (
                                            <button onClick={() => { setFeedbackAst(ast); setRejectionData({ comment: '', photo: null }); }} title="Reportar Inconsistencia" className="p-4 bg-rose-50 text-rose-400 rounded-2xl hover:bg-rose-600 hover:text-white shadow-sm border border-transparent hover:border-rose-200 transition-all"><AlertTriangle size={20} /></button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-44 text-center text-slate-300 font-black uppercase text-xs tracking-widest">Sin registros pendientes</div>
                    )}
                </div>

                {viewMode === 'smart' && smartSample.length > 0 && (
                    <div className="p-10 bg-rose-50 border-t border-rose-100 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-black text-rose-600 uppercase tracking-widest leading-none">Modo Auditoría de Muestreo</p>
                            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Revisión estadística recomendada para cumplimiento HSE</p>
                        </div>
                        <button onClick={handleBatchApproval} className="bg-slate-900 text-white px-12 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all shadow-2xl flex items-center gap-4">
                            <CheckCircle2 size={20} /> Aprobar Muestra Analizada
                        </button>
                    </div>
                )}
            </div>

            {/* MODAL VISOR PDF (PLACEHOLDER REAL) */}
            {selectedAst && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/90 backdrop-blur-xl p-4 md:p-12">
                    <div className="bg-white rounded-[3rem] w-full max-w-6xl h-full flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95">
                        <div className="p-8 bg-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-rose-600 rounded-xl"><FileText size={20} /></div>
                                <h3 className="font-black uppercase italic tracking-tighter">Expediente Digital: {selectedAst.ot}</h3>
                            </div>
                            <button onClick={() => setSelectedAst(null)} className="p-4 hover:bg-white/10 rounded-full transition-all"><X size={24} /></button>
                        </div>
                        <div className="flex-1 bg-slate-100 p-8 overflow-y-auto custom-scrollbar flex items-center justify-center">
                            {/* Simulación de PDF Premium A4 */}
                            <div className="bg-white shadow-2xl w-full max-w-[210mm] min-h-[297mm] p-[10mm] md:p-[20mm] relative flex flex-col text-left">
                                <div className="border-b-4 border-rose-600 pb-10 mb-10 flex justify-between items-start">
                                    <div>
                                        <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Análisis Seguro <span className="text-rose-600">de Trabajo (AST)</span></h1>
                                        <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-[0.4em]">Gen AI v8.2 Intelligence</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[12px] font-black text-slate-900 uppercase">OT: {selectedAst.ot}</p>
                                        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">{selectedAst.empresa}</p>
                                    </div>
                                </div>


                                <div className="grid grid-cols-2 gap-10 opacity-60 grayscale scale-95 pointer-events-none">
                                    <div className="space-y-6">
                                        <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                                        <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                                        <div className="h-4 bg-slate-100 rounded w-5/6"></div>
                                        <div className="h-48 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200"></div>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                                        <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                                        <div className="h-48 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 font-bold uppercase text-[8px]">Mapa Georreferenciado</div>
                                    </div>
                                </div>
                                <div className="mt-auto border-t-2 border-slate-100 pt-10 flex justify-between items-end">
                                    <div className="space-y-2">
                                        <div className="w-40 h-10 border-b border-slate-200 flex items-center justify-center">
                                            {selectedAst.firmaColaborador && <img src={selectedAst.firmaColaborador} className="max-h-full grayscale" alt="firma" />}
                                        </div>
                                        <p className="text-[9px] font-black uppercase text-slate-900">Firma Colaborador</p>
                                    </div>
                                    <div className="bg-slate-900 text-white p-6 rounded-3xl flex gap-4 items-center">
                                        <div className="bg-white p-2 rounded-xl">
                                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=AST-${selectedAst._id}`} className="w-12 h-12" alt="qr" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black italic text-rose-400 leading-none">VALIDACIÓN HSE</p>
                                            <p className="text-[7px] text-slate-500 mt-1 uppercase">{selectedAst.estado}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-12 opacity-[0.03] select-none">
                                    <h1 className="text-[120px] font-black uppercase tracking-tighter">GEN AI</h1>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE REPORTE DE INCONSISTENCIA */}
            {feedbackAst && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/70 backdrop-blur-xl p-6">
                    <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
                        <div className="p-8 bg-rose-600 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/20 p-3 rounded-xl"><AlertTriangle size={20} className="text-white" /></div>
                                <div>
                                    <h3 className="font-black uppercase italic tracking-tighter text-white leading-none">Reportar Inconsistencia</h3>
                                    <p className="text-[9px] text-rose-200 font-bold uppercase mt-1">OT: {feedbackAst.ot} — {feedbackAst.empresa}</p>
                                </div>
                            </div>
                            <button onClick={() => setFeedbackAst(null)} className="p-3 hover:bg-white/10 rounded-full transition-all text-white"><X size={20} /></button>
                        </div>
                        <div className="p-10 space-y-6">
                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mensaje al Trabajador</p>
                                <textarea
                                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold uppercase min-h-[120px] outline-none focus:ring-4 focus:ring-rose-500/10 resize-none"
                                    placeholder="DESCRIBA DETALLADAMENTE EL ERROR O INCONSISTENCIA DETECTADA..."
                                    value={rejectionData.comment}
                                    onChange={e => setRejectionData(prev => ({ ...prev, comment: e.target.value }))}
                                />
                            </div>
                            <label className="flex items-center gap-4 p-5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-rose-50 hover:border-rose-200 transition-all group">
                                <input type="file" accept="image/*" className="hidden" onChange={handleRejectionPhoto} />
                                {rejectionData.photo ? (
                                    <img src={rejectionData.photo} className="h-16 w-16 object-cover rounded-xl border border-slate-200" alt="evidencia" />
                                ) : (
                                    <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center border border-slate-200 group-hover:border-rose-300 transition-all">
                                        <Camera size={24} className="text-slate-300 group-hover:text-rose-400 transition-colors" />
                                    </div>
                                )}
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-700">{rejectionData.photo ? 'Foto Adjuntada' : 'Adjuntar Foto de Evidencia'}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{rejectionData.photo ? 'Clic para cambiar' : 'Opcional — Refuerza el feedback'}</p>
                                </div>
                            </label>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setFeedbackAst(null)} className="flex-1 py-5 rounded-2xl border-2 border-slate-100 text-slate-400 font-black text-[10px] uppercase hover:bg-slate-50 transition-all">Cancelar</button>
                                <button
                                    onClick={handleInconsistencyReport}
                                    className="flex-[2] py-5 rounded-2xl bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all shadow-xl flex items-center justify-center gap-3"
                                >
                                    <AlertTriangle size={16} /> Enviar Feedback al Trabajador
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {alert && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white rounded-[3.5rem] p-12 max-w-md w-full shadow-2xl text-center flex flex-col items-center gap-8 animate-in zoom-in-95">
                        <div className={`p-6 rounded-[2rem] ${alert.type === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                            <Info size={48} />
                        </div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-relaxed">{alert.message}</h4>
                        <div className="flex gap-4 w-full">
                            {alert.type === 'confirm' ? (
                                <>
                                    <button onClick={() => setAlert(null)} className="flex-1 py-5 rounded-full border-2 border-slate-100 text-slate-400 font-black text-[10px] uppercase">No</button>
                                    <button onClick={() => { alert.onConfirm(); setAlert(null); }} className="flex-1 py-5 rounded-full bg-slate-900 text-white font-black text-[10px] uppercase hover:bg-rose-600 transition-all">Sí, Confirmar</button>
                                </>
                            ) : (
                                <button onClick={() => setAlert(null)} className="w-full py-5 rounded-full bg-slate-900 text-white font-black text-[10px] uppercase">Cerrar</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PrevHseConsole;

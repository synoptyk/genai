import React, { useState } from 'react';
import { Sparkles, UploadCloud, FileText, Loader2, X } from 'lucide-react';
import { candidatosApi } from '../../../rrhhApi';

const RenunciaAsistente = ({ contratados, onIniciarFiniquito, isModal, onClose }) => {
    const [renunciaFile, setRenunciaFile] = useState(null);
    const [parsingRenuncia, setParsingRenuncia] = useState(false);
    const [parsedResult, setParsedResult] = useState(null);

    const handleParseRenuncia = async () => {
        if (!renunciaFile) return alert('Por favor, selecciona un archivo.');
        setParsingRenuncia(true);
        setParsedResult(null);
        try {
            const formData = new FormData();
            formData.append('file', renunciaFile);
            
            const resp = await candidatosApi.parseRenuncia(formData);
            const { matchedRut, proposedDate, causalTermino } = resp.data;
            
            // Map RUT to local contratado
            let matched = null;
            if (matchedRut) {
                const cleanInputRut = matchedRut.replace(/[^0-9Kk]/g, '').toUpperCase();
                matched = contratados.find(c => {
                    const cRut = c.rut?.replace(/[^0-9Kk]/g, '').toUpperCase();
                    return cRut === cleanInputRut;
                });
            }

            setParsedResult({
                matched,
                proposedDate: proposedDate || new Date().toISOString().split('T')[0],
                causalTermino: causalTermino || 'Renuncia voluntaria (Art. 159 N°2)'
            });
        } catch (error) {
            console.error('Error al parsear renuncia:', error);
            alert('Error al leer la carta de renuncia con IA.');
        } finally {
            setParsingRenuncia(false);
        }
    };

    const content = (
        <div className={isModal ? "" : "w-full"}>
            {!isModal && (
                <div className="flex gap-2 mb-6 pb-4 border-b border-slate-100">
                    <Sparkles size={20} className="text-violet-500" />
                    <div>
                        <h3 className="text-sm font-black text-slate-800">Procesador Inteligente de Renuncias</h3>
                        <p className="text-[10px] font-bold text-slate-400">Sube una carta notarial o firmada y la IA extraerá los datos y preparará el finiquito</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-6">
                {/* Upload Section */}
                <div className="flex-1 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors group relative overflow-hidden">
                        {renunciaFile ? (
                            <>
                                <div className="p-4 bg-violet-100 text-violet-600 rounded-full mb-3">
                                    <FileText size={32} />
                                </div>
                                <p className="text-sm font-black text-slate-800 truncate max-w-[250px]">{renunciaFile.name}</p>
                                <p className="text-[10px] font-bold text-slate-400 mt-1">{(renunciaFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                
                                <button
                                    onClick={() => { setRenunciaFile(null); setParsedResult(null); }}
                                    className="mt-4 px-4 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 text-[10px] font-black uppercase tracking-wider"
                                >
                                    Quitar archivo
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="p-4 bg-slate-100 text-slate-400 rounded-full mb-3 group-hover:scale-110 group-hover:bg-violet-100 group-hover:text-violet-500 transition-all">
                                    <UploadCloud size={32} />
                                </div>
                                <p className="text-sm font-black text-slate-600">Arrastra la carta aquí o haz clic</p>
                                <p className="text-[10px] font-bold text-slate-400 mt-1">Formatos soportados: PDF, JPG, PNG</p>
                                <input
                                    type="file"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    accept=".pdf,image/*"
                                    onChange={(e) => {
                                        setRenunciaFile(e.target.files[0]);
                                        setParsedResult(null);
                                    }}
                                />
                            </>
                        )}
                    </div>

                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handleParseRenuncia}
                            disabled={!renunciaFile || parsingRenuncia}
                            className="w-full md:w-auto px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50 transition-all shadow-md"
                        >
                            {parsingRenuncia ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            {parsingRenuncia ? 'Analizando documento...' : 'Extraer Datos con IA'}
                        </button>
                    </div>
                </div>

                {/* Result Section */}
                {parsedResult && (
                    <div className="flex-1 bg-white border border-emerald-200 rounded-3xl p-6 shadow-sm shadow-emerald-100 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                <Sparkles size={14} />
                            </div>
                            <h4 className="text-sm font-black text-slate-800">Resultados del Análisis</h4>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Colaborador Detectado</label>
                                {parsedResult.matched ? (
                                    <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-200 text-emerald-700 flex items-center justify-center font-black">
                                            {parsedResult.matched.fullName.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-800">{parsedResult.matched.fullName}</p>
                                            <p className="text-[10px] text-slate-500">{parsedResult.matched.rut}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-bold">
                                        No se encontró un colaborador activo con el RUT del documento.
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Fecha de Egreso Propuesta</label>
                                <input
                                    type="date"
                                    value={parsedResult.proposedDate}
                                    onChange={e => setParsedResult(prev => ({ ...prev, proposedDate: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Causal de Término Detectada</label>
                                <input
                                    type="text"
                                    value={parsedResult.causalTermino}
                                    disabled
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-500 font-bold"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                            {isModal && (
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    if (!parsedResult.matched) return alert('Por favor, selecciona un colaborador válido.');
                                    onIniciarFiniquito(parsedResult.matched, parsedResult.proposedDate, parsedResult.causalTermino);
                                }}
                                disabled={!parsedResult.matched}
                                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md shadow-violet-200 disabled:opacity-60"
                            >
                                <Sparkles size={14} /> Iniciar Finiquito
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    if (isModal) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                        <div className="flex items-center gap-2">
                            <Sparkles size={18} className="text-violet-500" />
                            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Carga de Carta de Renuncia</h2>
                        </div>
                        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                    <div className="p-6">
                        {content}
                    </div>
                </div>
            </div>
        );
    }

    return content;
};

export default RenunciaAsistente;

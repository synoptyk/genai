import React, { useState } from 'react';
import { Upload, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import * as candidatosApi from '../../api/candidatosApi';
import SearchableSelect from '../../components/SearchableSelect';
import { formatRut } from '../../../utils/rutUtils';

export default function RenunciaAsistente({ contratados, onStartFiniquito }) {
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
            const { matched, proposedDate, causalTermino } = resp.data;
            
            setParsedResult({
                matched: matched || null,
                proposedDate: proposedDate || new Date().toISOString().split('T')[0],
                causalTermino: causalTermino || 'Renuncia voluntaria (Art. 159 N°2)'
            });
        } catch (err) {
            console.error(err);
            alert('Error al analizar el documento de renuncia. Asegúrate de subir un archivo PDF o imagen legible.');
        } finally {
            setParsingRenuncia(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {/* Left Column: Drag/Drop Upload Area */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col items-center justify-center text-center min-h-[400px]">
                <div className="bg-violet-50/60 text-violet-600 p-4 rounded-full mb-4">
                    <Sparkles size={32} />
                </div>
                <h3 className="text-base font-black text-slate-800 mb-1.5">Procesar Renuncia (AI)</h3>
                <p className="text-xs text-slate-400 max-w-xs mb-6">Sube el documento de renuncia voluntaria (PDF o Imagen) firmado por el trabajador para extraer sus datos automáticamente y cargarlo en el asistente.</p>

                <div className="w-full">
                    <label className="border-2 border-dashed border-slate-200 hover:border-violet-400 bg-slate-50/50 hover:bg-violet-50/10 rounded-2xl p-6 block cursor-pointer transition-all mb-4 text-center">
                        <Upload size={24} className="mx-auto text-slate-400 mb-2" />
                        <span className="block text-xs font-black uppercase text-slate-600 tracking-wider">
                            {renunciaFile ? renunciaFile.name : 'Seleccionar Documento'}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-1 font-bold">PDF, PNG, JPG hasta 5MB</span>
                        <input
                            type="file"
                            className="hidden"
                            accept=".pdf,image/*"
                            onChange={e => {
                                setRenunciaFile(e.target.files[0] || null);
                                setParsedResult(null);
                            }}
                        />
                    </label>

                    {renunciaFile && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setRenunciaFile(null); setParsedResult(null); }}
                                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-black uppercase text-slate-600 tracking-wider"
                            >
                                Limpiar
                            </button>
                            <button
                                onClick={handleParseRenuncia}
                                disabled={parsingRenuncia}
                                className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-violet-200 disabled:opacity-60"
                            >
                                {parsingRenuncia ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                {parsingRenuncia ? 'Analizando...' : 'Analizar con IA'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: AI Extraction Review */}
            <div className="lg:col-span-2">
                {parsingRenuncia ? (
                    <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 font-bold flex flex-col items-center justify-center min-h-[400px] shadow-sm">
                        <Loader2 size={48} className="animate-spin text-violet-600 mb-4" />
                        <h3 className="text-base text-slate-700 font-black mb-1 animate-pulse">Analizando documento...</h3>
                        <p className="text-xs text-slate-400 max-w-sm">Nuestros modelos están leyendo el archivo para detectar el RUT, nombre y la fecha de egreso declarada.</p>
                    </div>
                ) : !parsedResult ? (
                    <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 font-bold flex flex-col items-center justify-center min-h-[400px] shadow-sm">
                        <Sparkles size={48} className="text-violet-300 mb-4 animate-pulse" />
                        <h3 className="text-base text-slate-700 font-black mb-1">Resultados de la Extracción</h3>
                        <p className="text-xs text-slate-400 max-w-sm">Sube y procesa una carta de renuncia para ver la coincidencia inteligente del trabajador y la propuesta de egreso automático.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-sm font-black uppercase text-slate-800 flex items-center gap-1.5">
                                <Sparkles size={16} className="text-violet-600" /> Extracción Completada
                            </h3>
                            <span className={\`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider \${
                                parsedResult.matched ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }\`}>
                                {parsedResult.matched ? '✓ Trabajador Identificado' : '⚠ Coincidencia Parcial / Manual'}
                            </span>
                        </div>

                        {parsedResult.matched ? (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-slate-900 text-white font-black flex items-center justify-center text-lg shadow-md uppercase">
                                    {parsedResult.matched.fullName.substring(0, 2)}
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-black text-slate-800">{parsedResult.matched.fullName}</h4>
                                    <p className="text-xs text-slate-500 font-medium">RUT: <span className="font-bold">{parsedResult.matched.rut}</span> · Cargo: <span className="font-bold">{parsedResult.matched.position}</span></p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 space-y-3">
                                <div className="flex gap-2 text-xs font-bold text-amber-700 items-start">
                                    <AlertCircle size={16} className="mt-0.5" />
                                    <div>
                                        <p>No se encontró coincidencia automática.</p>
                                        <p className="font-medium text-slate-600 mt-1">El RUT o el nombre dentro de la carta de renuncia no coinciden de forma exacta con ningún colaborador activo. Por favor, selecciónalo manualmente.</p>
                                    </div>
                                </div>
                                <div>
                                    <SearchableSelect
                                        label="Buscar y Asignar Colaborador"
                                        placeholder="Selecciona al colaborador manualmente..."
                                        options={contratados.map(c => ({ value: c._id, label: \`\${c.fullName} (\${formatRut(c.rut)}) · \${c.position || ''}\` }))}
                                        value={parsedResult?.matched?._id || ''}
                                        onChange={val => {
                                            const cand = contratados.find(c => c._id === val);
                                            if (cand) {
                                                setParsedResult(prev => ({ ...prev, matched: cand }));
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Fecha de Egreso Propuesta</label>
                                <input
                                    type="date"
                                    value={parsedResult.proposedDate}
                                    onChange={e => setParsedResult(prev => ({ ...prev, proposedDate: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-350"
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

                        <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                            <button
                                onClick={() => { setRenunciaFile(null); setParsedResult(null); }}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase rounded-xl transition-colors"
                            >
                                Descartar
                            </button>
                            <button
                                onClick={() => {
                                    if (!parsedResult.matched) return alert('Por favor, selecciona un colaborador.');
                                    onStartFiniquito(parsedResult);
                                    // Limpiar estados de renuncia
                                    setRenunciaFile(null);
                                    setParsedResult(null);
                                }}
                                disabled={!parsedResult.matched}
                                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md shadow-violet-200 disabled:opacity-60"
                            >
                                <Sparkles size={14} /> Iniciar Finiquito Automatizado
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

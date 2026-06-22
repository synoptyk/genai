import React, { useState } from 'react';
import { Search, FileText, CheckCircle, Printer, AlertCircle } from 'lucide-react';
import { formatRut } from '../../../utils/rutUtils';
import { generateCartaTerminoPdf } from '../../utils/pdfGenerators';

export default function CartasAsistente({ contratados, MOTIVOS }) {
    const [cartaSearchTerm, setCartaSearchTerm] = useState('');
    const [cartaCandidatoId, setCartaCandidatoId] = useState('');
    const [cartaFechaAviso, setCartaFechaAviso] = useState('');
    const [cartaFechaTermino, setCartaFechaTermino] = useState('');
    const [cartaCausal, setCartaCausal] = useState('');
    const [cartaHechos, setCartaHechos] = useState('');
    const [cartaEstadoCotizaciones, setCartaEstadoCotizaciones] = useState(false);

    // Active users filtered
    const activeContratados = contratados.filter(c => 
        (c.fullName || '').toLowerCase().includes(cartaSearchTerm.toLowerCase()) || 
        (c.rut || '').includes(cartaSearchTerm)
    );

    const handleGeneratePdf = (candidato) => {
        generateCartaTerminoPdf(candidato, {
            cartaFechaAviso,
            cartaFechaTermino,
            cartaCausal,
            cartaHechos
        });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {/* Left Column: Search & Select Worker */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[450px]">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-sm font-black uppercase text-slate-800 mb-3 flex items-center gap-1.5">
                        <FileText size={16} className="text-slate-500" /> Selección de Trabajador
                    </h3>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por Nombre o RUT..."
                            value={cartaSearchTerm}
                            onChange={e => setCartaSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 bg-slate-50">
                    {activeContratados.length === 0 ? (
                        <div className="text-center p-6 text-slate-400 text-xs font-bold uppercase">No se encontraron colaboradores activos.</div>
                    ) : (
                        activeContratados.map(c => {
                            const isSelected = cartaCandidatoId === c._id;
                            return (
                                <button
                                    key={c._id}
                                    onClick={() => setCartaCandidatoId(c._id)}
                                    className={\`w-full text-left p-3 rounded-xl mb-1.5 transition-all flex items-center justify-between group \${
                                        isSelected 
                                        ? 'bg-slate-900 text-white shadow-md' 
                                        : 'bg-white hover:bg-slate-100 border border-slate-100 text-slate-700'
                                    }\`}
                                >
                                    <div>
                                        <p className="font-bold text-sm leading-tight">{c.fullName}</p>
                                        <p className={\`text-[10px] mt-1 font-semibold uppercase \${isSelected ? 'text-slate-400' : 'text-slate-500'}\`}>{formatRut(c.rut)}</p>
                                        <p className={\`text-[10px] uppercase font-bold mt-0.5 \${isSelected ? 'text-emerald-400' : 'text-slate-400'}\`}>{c.position || 'Sin cargo'}</p>
                                    </div>
                                    {isSelected && (
                                        <span className="bg-emerald-500 text-white p-1 rounded-full text-xs">
                                            <CheckCircle size={12} />
                                        </span>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right Column: Form for Termination Letter */}
            <div className="lg:col-span-2 space-y-6">
                {!cartaCandidatoId ? (
                    <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 font-bold flex flex-col items-center justify-center min-h-[450px] shadow-sm">
                        <Printer size={48} className="text-slate-300 mb-4 animate-bounce" />
                        <h3 className="text-base text-slate-700 font-black mb-1">Generador de Cartas de Término</h3>
                        <p className="text-xs text-slate-400 max-w-sm">Selecciona un colaborador de la lista para redactar y formalizar la carta de desvinculación de acuerdo al artículo 162 del Código del Trabajo.</p>
                    </div>
                ) : (
                    (() => {
                        const selectedCand = contratados.find(c => c._id === cartaCandidatoId);
                        return (
                            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                    <div>
                                        <h3 className="text-sm font-black uppercase text-slate-800">Carta de Término Legal</h3>
                                        <p className="text-xs text-slate-400 mt-0.5">Colaborador: <span className="font-black text-slate-700">{selectedCand?.fullName}</span> · RUT: <span className="font-bold text-slate-700">{formatRut(selectedCand?.rut)}</span></p>
                                    </div>
                                    <button
                                        onClick={() => setCartaCandidatoId('')}
                                        className="text-xs font-black uppercase tracking-wider text-red-500 hover:underline"
                                    >
                                        Cambiar Colaborador
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Fecha de Notificación / Aviso</label>
                                        <input
                                            type="date"
                                            value={cartaFechaAviso}
                                            onChange={e => setCartaFechaAviso(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Fecha de Término Efectiva</label>
                                        <input
                                            type="date"
                                            value={cartaFechaTermino}
                                            onChange={e => setCartaFechaTermino(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Causal Legal de Desvinculación</label>
                                    <select
                                        value={cartaCausal}
                                        onChange={e => setCartaCausal(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 font-bold text-slate-700"
                                    >
                                        <option value="">Selecciona una causal legal...</option>
                                        {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-[10px] font-black uppercase text-slate-500">Hechos que Fundan el Término de Contrato</label>
                                        <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border border-red-100 flex items-center gap-1">
                                            <AlertCircle size={10} /> Requerido Legalmente
                                        </span>
                                    </div>
                                    <textarea
                                        value={cartaHechos}
                                        onChange={e => setCartaHechos(e.target.value)}
                                        placeholder="Ej: Describa detalladamente los hechos específicos, fechas y circunstancias justificadoras. Para necesidades de la empresa, explique las razones económicas, tecnológicas o de reestructuración..."
                                        rows={5}
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 resize-y"
                                    />
                                </div>

                                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        id="cotizacionesCheck"
                                        checked={cartaEstadoCotizaciones}
                                        onChange={e => setCartaEstadoCotizaciones(e.target.checked)}
                                        className="mt-1 rounded text-emerald-600 focus:ring-emerald-300 h-4 w-4"
                                    />
                                    <label htmlFor="cotizacionesCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                                        Declaración de Cotizaciones Previsionales al Día (Ley Bustos N° 19.631)
                                        <span className="block text-[10px] font-medium text-slate-500 mt-1">
                                            Certifico bajo fe de juramento que a la fecha de término indicada se encuentran íntegramente pagadas las cotizaciones previsionales, de salud y AFC de este colaborador.
                                        </span>
                                    </label>
                                </div>

                                <div className="pt-3 flex justify-end">
                                    <button
                                        onClick={() => handleGeneratePdf(selectedCand)}
                                        className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-md"
                                    >
                                        <Printer size={16} /> Generar y Descargar Carta (PDF)
                                    </button>
                                </div>
                            </div>
                        );
                    })()
                )}
            </div>
        </div>
    );
}

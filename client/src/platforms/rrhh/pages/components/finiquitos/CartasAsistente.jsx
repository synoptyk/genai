import React, { useState } from 'react';
import { Search, FileText, Download } from 'lucide-react';
import { formatRut } from '../../../../../utils/rutUtils';

const CartasAsistente = ({ contratados, MOTIVOS }) => {
    const [cartaSearchTerm, setCartaSearchTerm] = useState('');
    const [cartaCandidatoId, setCartaCandidatoId] = useState('');
    const [cartaFechaAviso, setCartaFechaAviso] = useState('');
    const [cartaFechaTermino, setCartaFechaTermino] = useState('');
    const [cartaCausal, setCartaCausal] = useState('');
    const [cartaHechos, setCartaHechos] = useState('');
    const [cartaEstadoCotizaciones, setCartaEstadoCotizaciones] = useState(true);

    const activeContratados = contratados.filter(c => {
        if (!cartaSearchTerm) return true;
        const q = cartaSearchTerm.toLowerCase();
        return [c.fullName, c.rut, c.position].filter(Boolean).join(' ').toLowerCase().includes(q);
    });

    const generateCartaTerminoPdf = (candidato) => {
        if (!cartaCausal || !cartaFechaTermino || !cartaHechos) {
            return alert('Completa todos los campos obligatorios para la carta.');
        }

        const empresaNombre = "Synoptik Innovacion SPA";
        const empresaRut = "77.123.456-7"; // Reemplazar con RUT real de la empresa
        const empresaRep = "Representante Legal"; // Reemplazar con representante real
        
        let headerText = 'CARTA DE AVISO DE TÉRMINO DE CONTRATO';
        if (cartaCausal.includes('161')) {
            headerText = 'CARTA DE AVISO DE TÉRMINO DE CONTRATO POR NECESIDADES DE LA EMPRESA';
        } else if (cartaCausal.includes('159 N°1') || cartaCausal.includes('159 N°2')) {
            headerText = 'CARTA DE ACEPTACIÓN DE RENUNCIA / MUTUO ACUERDO';
        }

        const html = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Arial', sans-serif; padding: 40px; color: #1e293b; font-size: 14px; line-height: 1.6; }
                    .header { text-align: center; margin-bottom: 40px; }
                    .header h1 { font-size: 16px; font-weight: bold; text-decoration: underline; margin: 0; }
                    .date-right { text-align: right; margin-bottom: 30px; }
                    .recipient { margin-bottom: 30px; }
                    .body-text { margin-bottom: 20px; text-align: justify; }
                    .hechos-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin-top: 15px; margin-bottom: 15px; font-style: italic; }
                    .cotizaciones { border: 1px solid #cbd5e1; padding: 15px; margin-top: 20px; border-radius: 8px; font-size: 12px; }
                    .firmas { margin-top: 80px; display: flex; justify-content: space-between; }
                    .firma-box { text-align: center; width: 40%; }
                    .linea { border-top: 1px solid #000; margin-bottom: 5px; }
                </style>
            </head>
            <body>
                <div class="date-right">
                    Santiago, ${new Date(cartaFechaAviso || cartaFechaTermino).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>

                <div class="header">
                    <h1>${headerText}</h1>
                </div>

                <div class="recipient">
                    <strong>Señor(a):</strong> ${candidato.fullName}<br>
                    <strong>R.U.T.:</strong> ${candidato.rut}<br>
                    <strong>Domicilio:</strong> ${candidato.address || 'Domicilio registrado en carpeta'}<br>
                    <u>Presente</u>
                </div>

                <div class="body-text">
                    De nuestra consideración:
                </div>

                <div class="body-text">
                    Por intermedio de la presente, comunicamos a usted que con fecha <strong>${new Date(cartaFechaTermino).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>, se pone término al contrato de trabajo que lo vincula con <strong>${empresaNombre}</strong>.
                </div>

                <div class="body-text">
                    La causal legal en que se funda esta decisión es la estipulada en el <strong>${cartaCausal}</strong> del Código del Trabajo.
                </div>

                <div class="body-text">
                    Los hechos en que se funda la aplicación de la referida causal son los siguientes:
                </div>
                
                <div class="hechos-box">
                    ${cartaHechos.replace(/\n/g, '<br>')}
                </div>

                <div class="cotizaciones">
                    <strong>Estado de Cotizaciones Previsionales:</strong><br>
                    Se le informa que al momento del término de la relación laboral, sus cotizaciones previsionales (AFP, Salud, Seguro de Cesantía) se encuentran <strong>${cartaEstadoCotizaciones ? 'PAGADAS Y AL DÍA' : 'PENDIENTES DE PAGO O DECLARADAS'}</strong>, adjuntando a la presente los certificados respectivos según lo dispone la Ley 19.631 (Ley Bustos).
                </div>

                <div class="body-text" style="margin-top: 20px;">
                    Su finiquito de contrato de trabajo, junto a los montos que legalmente le correspondan, se encontrará a su disposición en el plazo legal respectivo en la Notaría correspondiente o a través de nuestros canales internos para su revisión y firma electrónica.
                </div>

                <div class="body-text">
                    Agradecemos los servicios prestados durante su permanencia en la empresa y le deseamos éxito en sus proyectos futuros.
                </div>

                <div class="body-text">
                    Atentamente,
                </div>

                <div class="firmas">
                    <div class="firma-box">
                        <div class="linea"></div>
                        <p><strong>${empresaNombre}</strong><br>RUT: ${empresaRut}<br>Empleador</p>
                    </div>
                    <div class="firma-box">
                        <div class="linea"></div>
                        <p><strong>${candidato.fullName}</strong><br>RUT: ${candidato.rut}<br>Recibí Conforme (Trabajador)</p>
                    </div>
                </div>
                
                <div style="font-size: 10px; color: #64748b; margin-top: 40px; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
                    C.C. Inspección del Trabajo.<br>
                    C.C. Carpeta Personal.
                </div>
            </body>
            </html>
        `;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return alert('Desactiva el bloqueador de popups');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    };

    return (
        <div className="w-full">
            <div className="flex gap-2 mb-6 pb-4 border-b border-slate-100">
                <FileText size={20} className="text-violet-500" />
                <div>
                    <h3 className="text-sm font-black text-slate-800">Generación de Cartas de Aviso / Despido</h3>
                    <p className="text-[10px] font-bold text-slate-400">Genera cartas personalizadas y adaptadas a la ley chilena (Ley Bustos)</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 border border-slate-200 rounded-3xl p-4 bg-white shadow-sm flex flex-col h-[500px]">
                    <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-3">1. Seleccionar Colaborador</h4>
                    <div className="relative mb-3">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o RUT..."
                            value={cartaSearchTerm}
                            onChange={(e) => setCartaSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-violet-200"
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {activeContratados.map(c => (
                            <button
                                key={c._id}
                                onClick={() => setCartaCandidatoId(c._id)}
                                className={`w-full text-left p-3 rounded-2xl transition-all border ${cartaCandidatoId === c._id ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-200' : 'bg-white hover:bg-violet-50 text-slate-700 border-slate-200'}`}
                            >
                                <div className="font-bold text-xs truncate">{c.fullName}</div>
                                <div className={`text-[9px] mt-0.5 ${cartaCandidatoId === c._id ? 'text-violet-200' : 'text-slate-400'}`}>
                                    {c.rut} · {c.position}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-2 border border-slate-200 rounded-3xl p-6 bg-white shadow-sm">
                    {cartaCandidatoId ? (() => {
                        const target = contratados.find(c => c._id === cartaCandidatoId);
                        return (
                            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div>
                                    <h4 className="text-[10px] font-black uppercase text-violet-600 tracking-wider mb-1">2. Datos de la Carta</h4>
                                    <p className="text-[11px] font-bold text-slate-700">Configurando carta para: <span className="text-violet-700">{target.fullName}</span></p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Causal Legal *</label>
                                        <select
                                            value={cartaCausal}
                                            onChange={e => setCartaCausal(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                                        >
                                            <option value="">Seleccionar causal...</option>
                                            {MOTIVOS.map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Fecha de Término Efectivo *</label>
                                        <input
                                            type="date"
                                            value={cartaFechaTermino}
                                            onChange={e => setCartaFechaTermino(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Fecha de Aviso (Documento)</label>
                                        <input
                                            type="date"
                                            value={cartaFechaAviso}
                                            onChange={e => setCartaFechaAviso(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                                        />
                                    </div>
                                    <div className="flex items-center pt-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={cartaEstadoCotizaciones}
                                                onChange={e => setCartaEstadoCotizaciones(e.target.checked)}
                                                className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 accent-violet-600"
                                            />
                                            <span className="text-xs font-bold text-slate-700">Cotizaciones al día (Ley Bustos)</span>
                                        </label>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Hechos en que se funda (Detalle legal) *</label>
                                        <textarea
                                            value={cartaHechos}
                                            onChange={e => setCartaHechos(e.target.value)}
                                            placeholder="Ej: Que con fecha X, la empresa ha debido restructurar el departamento..."
                                            rows={4}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 resize-none"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-end">
                                    <button
                                        onClick={() => generateCartaTerminoPdf(target)}
                                        disabled={!cartaCausal || !cartaFechaTermino || !cartaHechos}
                                        className="px-6 py-2.5 bg-violet-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-violet-200"
                                    >
                                        <Download size={14} />
                                        Generar PDF Oficial
                                    </button>
                                </div>
                            </div>
                        );
                    })() : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300">
                            <FileText size={48} className="mb-4 text-slate-200" />
                            <p className="text-sm font-black text-slate-400">Selecciona un colaborador</p>
                            <p className="text-[10px] font-bold mt-1 text-center max-w-xs">Elige a alguien de la lista izquierda para configurar los parámetros de su carta de término.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CartasAsistente;

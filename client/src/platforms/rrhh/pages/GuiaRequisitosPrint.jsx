import React from 'react';
import {
    FileText, User, ShieldCheck, Briefcase, MapPin,
    Smartphone, Mail, CheckCircle2, Info
} from 'lucide-react';

const MASTER_DOCUMENTS = [
    {
        category: "Identidad y Perfil",
        items: [
            { name: 'Cédula de Identidad', desc: 'Fotocopia por ambos lados, vigente.' },
            { name: 'Currículum Vitae', desc: 'Versión actualizada con experiencia relevante.' },
            { name: 'Fotografía Tamaño Pasaporte', desc: 'Color, fondo blanco, formato digital.' }
        ]
    },
    {
        category: "Previsión Social",
        items: [
            { name: 'Cert. AFP + 12 Cotizaciones', desc: 'Certificado de afiliación y detalle de últimos 12 meses.' },
            { name: 'Cert. Salud + Valor Plan', desc: 'Certificado Isapre o Fonasa indicando valor del plan.' },
            { name: 'Certificado Cargas Familiares', desc: 'Si corresponde (Punto 10 de la guía).' }
        ]
    },
    {
        category: "Laboral y Estudios",
        items: [
            { name: 'Certificado de Antecedentes', desc: 'Original vigente (Art. 2 Código del Trabajo).' },
            { name: 'Título / Certificado Estudios', desc: 'Enseñanza Media o Superior (fotocopia).' },
            { name: 'Finiquito o Carta Renuncia', desc: 'Del último empleador, firmado.' },
            { name: 'Cert. de Competencias (Cursos)', desc: 'Diplomas o certificados técnicos adicionales.' }
        ]
    },
    {
        category: "Domicilio y Conducción",
        items: [
            { name: 'Certificado de Residencia', desc: 'Junta de vecinos, notaría o boleta a su nombre.' },
            { name: 'Licencia de Conducir', desc: 'Si el cargo requiere conducción (Fotocopia ambos lados).' },
            { name: 'Cert. Hoja de Vida Conductor', desc: 'Emitido por Registro Civil (Vigente).' }
        ]
    }
];

const GuiaRequisitosPrint = () => {
    return (
        <div className="hidden print:block bg-white text-slate-900 font-sans leading-relaxed">
            <div className="max-w-[800px] mx-auto p-16 bg-white print:p-12 min-h-screen flex flex-col">

                {/* Header Section */}
                <div className="flex justify-between items-center border-b-2 border-slate-900 pb-4 mb-6">
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tighter text-slate-900 italic">Guía de Requisitos</h1>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Departamento de Recursos Humanos</p>
                    </div>
                    <div className="text-right">
                        <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg inline-block">
                            <span className="text-[8px] font-black uppercase tracking-widest leading-none">Informativo RRHH</span>
                        </div>
                        <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-widest italic tracking-tighter">Actualización: Feb 2026</p>
                    </div>
                </div>

                {/* Info Text */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 border-l-4 border-l-slate-900">
                    <p className="text-[9px] font-bold text-slate-700 leading-tight uppercase tracking-tight">
                        <b>IMPORTANTE:</b> LOS SIGUIENTES DOCUMENTOS SON OBLIGATORIOS PARA LA FORMALIZACIÓN CONTRACTUAL. ENTREGAR EN FORMATO DIGITAL (PDF o IMAGEN) POR CANALES OFICIALES.
                    </p>
                </div>

                {/* Master List Grid */}
                <div className="grid grid-cols-2 gap-y-8 gap-x-12 flex-1">
                    {MASTER_DOCUMENTS.map((cat, idx) => (
                        <div key={idx} className="page-break-inside-avoid">
                            <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-100">
                                <div className="w-5 h-5 bg-slate-900 text-white rounded flex items-center justify-center text-[9px] font-black">
                                    0{idx + 1}
                                </div>
                                <h2 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-900">{cat.category}</h2>
                            </div>

                            <div className="space-y-2.5 ml-2">
                                {cat.items.map((item, i) => (
                                    <div key={i} className="flex gap-2">
                                        <div className="mt-1 w-1 h-1 bg-slate-300 rounded-full shrink-0" />
                                        <div>
                                            <p className="text-[9px] font-black text-slate-900 uppercase tracking-tight leading-none">{item.name}</p>
                                            <p className="text-[8px] font-bold text-slate-500 mt-0.5 leading-tight">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Additional Notes */}
                <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <div className="flex items-start gap-3">
                        <Info size={12} className="text-slate-400 shrink-0 mt-0.5" />
                        <p className="text-[8px] font-bold text-slate-500 leading-relaxed italic uppercase tracking-tight">
                            <b>Nota:</b> Certificados con antigüedad máxima de 30 días. Extranjeros requieren cédula vigente o comprobante de trámite.
                        </p>
                    </div>
                </div>

                {/* Print Footer */}
                <div className="mt-auto pt-10 text-center border-t border-slate-100">
                    <p className="text-[9px] font-mono text-slate-300 uppercase tracking-[0.4em]">
                        SISTEMA INTEGRAL DE RECURSOS HUMANOS • AGENTPRO RRHH v2.5
                    </p>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { margin: 0; size: letter; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
                    
                    /* Hide unnecessary elements */
                    #root > div > aside, 
                    #root > div > nav, 
                    #root > div > header,
                    .sidebar, .topbar, .navbar,
                    #sidebar, #topbar, #navbar,
                    [role="navigation"], [role="banner"], [role="complementary"],
                    .print\\:hidden { 
                        display: none !important; 
                        opacity: 0 !important; 
                        visibility: hidden !important; 
                        height: 0 !important; 
                        width: 0 !important; 
                        overflow: hidden !important;
                    }
                    
                    .hidden.print\\:block { 
                        display: block !important; 
                        visibility: visible !important;
                        opacity: 1 !important;
                        position: absolute !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                    }

                    .page-break-inside-avoid {
                        page-break-inside: avoid;
                    }
                }
            ` }} />
        </div>
    );
};

export default GuiaRequisitosPrint;

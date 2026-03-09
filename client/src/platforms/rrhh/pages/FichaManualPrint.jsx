import React from 'react';
import { Briefcase } from 'lucide-react';

const FichaManualPrint = ({ companyConfig }) => {
    return (
        <div className="hidden print:block bg-white text-slate-900 font-sans leading-relaxed">
            {/* Sheet Container - Simulating A4/Letter */}
            <div className="max-w-[800px] mx-auto p-16 bg-white print:p-12">
                {/* Header / Brand */}
                <div className="flex justify-between items-center border-b-2 border-slate-900 pb-6 mb-8">
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900 italic">Ficha de Captación de Talento</h1>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Formulario de Registro Único de Personal</p>
                    </div>
                    <div className="text-right flex items-center gap-4">
                        <div className="h-12 border-l border-slate-200 pl-4 flex flex-col justify-center">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Estado</span>
                            <span className="text-[10px] font-black text-slate-900 uppercase">DOCUMENTO OFICIAL</span>
                        </div>
                    </div>
                </div>

                {/* Instructions Box */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-8 border-l-4 border-l-slate-900">
                    <p className="text-[9px] font-bold text-slate-700 leading-relaxed uppercase tracking-tight">
                        <b>IMPORTANTE:</b> FAVOR COMPLETAR CON LETRA IMPRENTA CLARA. ESTA INFORMACIÓN ES CONFIDENCIAL Y SE UTILIZARÁ EXCLUSIVAMENTE PARA FINES DE CONTRATACIÓN Y CUMPLIMIENTO LEGAL SEGÚN LEY 19.628.
                    </p>
                </div>

                {/* Main Content Sections */}
                <div className="space-y-10">
                    {/* 1. DATOS PERSONALES */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 bg-slate-900 text-white rounded flex items-center justify-center text-[10px] font-black">01</div>
                            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">Identidad y Datos Personales</h2>
                        </div>
                        <div className="grid grid-cols-12 gap-y-7 gap-x-8">
                            <div className="col-span-8">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nombre Completo (Apellidos y Nombres)</label>
                                <div className="h-8 border-b border-slate-300"></div>
                            </div>
                            <div className="col-span-4">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">RUT / Identificación</label>
                                <div className="h-8 border-b border-slate-300"></div>
                            </div>

                            <div className="col-span-3">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Fecha Nacimiento</label>
                                <div className="h-8 border-b border-slate-300"></div>
                            </div>
                            <div className="col-span-3">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nacionalidad</label>
                                <div className="h-8 border-b border-slate-300"></div>
                            </div>
                            <div className="col-span-3">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Estado Civil</label>
                                <div className="h-8 border-b border-slate-300"></div>
                            </div>
                            <div className="col-span-3">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Género</label>
                                <div className="h-8 border-b border-slate-300 text-[9px] pt-1.5 text-slate-400 flex justify-between px-2">
                                    <span>[ ] MASC</span>
                                    <span>[ ] FEM</span>
                                    <span>[ ] OTRO</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 2. CONTACTO Y UBICACIÓN */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 bg-slate-900 text-white rounded flex items-center justify-center text-[10px] font-black">02</div>
                            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">Ubicación y Contacto</h2>
                        </div>
                        <div className="grid grid-cols-12 gap-y-7 gap-x-8">
                            <div className="col-span-12">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Dirección Particular (Calle, Número, Depto/Block)</label>
                                <div className="h-8 border-b border-slate-300"></div>
                            </div>
                            <div className="col-span-4">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Comuna</label>
                                <div className="h-8 border-b border-slate-300"></div>
                            </div>
                            <div className="col-span-4">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Región</label>
                                <div className="h-8 border-b border-slate-300"></div>
                            </div>
                            <div className="col-span-4">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Teléfono Móvil</label>
                                <div className="h-8 border-b border-slate-300"></div>
                            </div>
                        </div>
                    </section>

                    {/* 3. ASIGNACIÓN OPERATIVA */}
                    <section className="bg-slate-50 p-7 border border-slate-200 rounded-[2rem]">
                        <div className="flex items-center gap-2 mb-5">
                            <Briefcase size={16} className="text-slate-900" />
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 italic">03. Asignación Operativa (Administración)</h2>
                        </div>
                        <div className="grid grid-cols-3 gap-8">
                            <div>
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Cargo / Función</label>
                                <div className="h-8 border-b border-slate-300"></div>
                            </div>
                            <div>
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">CECO Madre</label>
                                <div className="h-8 border-b border-slate-300"></div>
                            </div>
                            <div>
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Área Operativa</label>
                                <div className="h-8 border-b border-slate-300"></div>
                            </div>
                        </div>
                    </section>

                    {/* 4. SALUD Y PREVISIÓN */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 bg-slate-900 text-white rounded flex items-center justify-center text-[10px] font-black">04</div>
                            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">Salud, Previsión y Finanzas</h2>
                        </div>
                        <div className="grid grid-cols-12 gap-y-7 gap-x-8">
                            <div className="col-span-4">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Prev. Salud (Isapre / Fonasa)</label>
                                <div className="h-8 border-b border-slate-300"></div>
                            </div>
                            <div className="col-span-4">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">AFP Actual</label>
                                <div className="h-8 border-b border-slate-300"></div>
                            </div>
                            <div className="col-span-4">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Grupo Sanguíneo</label>
                                <div className="h-8 border-b border-slate-300"></div>
                            </div>
                            <div className="col-span-5">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Institución Bancaria</label>
                                <div className="h-8 border-b border-slate-300"></div>
                            </div>
                            <div className="col-span-3">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tipo de Cuenta</label>
                                <div className="h-8 border-b border-slate-300"></div>
                            </div>
                            <div className="col-span-4">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Número de Cuenta</label>
                                <div className="h-8 border-b border-slate-300"></div>
                            </div>
                        </div>
                    </section>

                    {/* 5. TALLAS Y EQUIPAMIENTO */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 bg-slate-900 text-white rounded flex items-center justify-center text-[10px] font-black">05</div>
                            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">Tallas y Equipamiento EPP</h2>
                        </div>
                        <div className="grid grid-cols-4 gap-6 bg-slate-50 p-5 rounded-2xl border border-dashed border-slate-300 items-end">
                            <div>
                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-2 text-center underline italic">Talla Camisa</label>
                                <div className="h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-[9px] text-slate-300">[ . . . ]</div>
                            </div>
                            <div>
                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-2 text-center underline italic">Talla Pantalón</label>
                                <div className="h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-[9px] text-slate-300">[ . . . ]</div>
                            </div>
                            <div>
                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-2 text-center underline italic">Talla Calzado</label>
                                <div className="h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-[9px] text-slate-300">[ . . . ]</div>
                            </div>
                            <div>
                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-2 text-center underline italic">Talla Chaqueta</label>
                                <div className="h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-[9px] text-slate-300">[ . . . ]</div>
                            </div>
                        </div>
                    </section>

                    {/* Signatures */}
                    <div className="mt-20 pt-16 grid grid-cols-2 gap-24">
                        <div className="text-center group">
                            <div className="border-t-2 border-slate-900 pt-4 px-8 relative">
                                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">Firma del Colaborador</p>
                                <p className="text-[8px] font-black text-slate-400 uppercase mt-2 tracking-widest">NOMBRE: ___________________________</p>
                                <p className="text-[8px] font-black text-slate-400 uppercase mt-1 tracking-widest">RUT: ______________________________</p>
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="border-t-2 border-slate-900 pt-4 px-8">
                                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">Validación Institucional</p>
                                <p className="text-[8px] font-black text-slate-400 uppercase mt-2 tracking-widest italic">FIRMA Y TIMBRE RECURSOS HUMANOS</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Print Footer */}
                <div className="mt-16 text-center text-[8px] font-mono text-slate-300 uppercase tracking-[0.4em] border-t border-slate-50 pt-10">
                    SISTEMA DE GESTIÓN DE RECURSOS HUMANOS • PROPIEDAD DE LA EMPRESA • USO RESTRINGIDO
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { margin: 0; size: letter; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
                    
                    /* NUCLEAR OPTION: Hide every top-level layout element */
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
                    
                    /* Ensure the print container is the only thing visible */
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
                }
            ` }} />
        </div>
    );
};

export default FichaManualPrint;

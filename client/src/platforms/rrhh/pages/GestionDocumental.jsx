import React, { useState, useEffect, useCallback } from 'react';
import {
    FileText, Search, Upload, Eye, Check,
    Loader2, Share2,
    Smartphone, ShieldCheck, Info,
    User, Briefcase, MapPin, Printer
} from 'lucide-react';
import { candidatosApi } from '../rrhhApi';
import { formatRut } from '../../../utils/rutUtils';
import GuiaRequisitosPrint from './GuiaRequisitosPrint';

const MASTER_DOCUMENTS = [
    {
        category: "Identidad y Perfil",
        icon: User,
        color: "indigo",
        items: [
            { name: 'Cédula de Identidad', desc: 'Fotocopia por ambos lados, vigente.' },
            { name: 'Currículum Vitae', desc: 'Versión actualizada con experiencia relevante.' },
            { name: 'Fotografía Tamaño Pasaporte', desc: 'Color, fondo blanco, formato digital.' }
        ]
    },
    {
        category: "Previsión Social",
        icon: ShieldCheck,
        color: "rose",
        items: [
            { name: 'Cert. AFP + 12 Cotizaciones', desc: 'Certificado de afiliación y detalle de últimos 12 meses.' },
            { name: 'Cert. Salud + Valor Plan', desc: 'Certificado Isapre o Fonasa indicando valor del plan.' },
            { name: 'Certificado Cargas Familiares', desc: 'Si corresponde (Punto 10 de la guía).' }
        ]
    },
    {
        category: "Laboral y Estudios",
        icon: Briefcase,
        color: "violet",
        items: [
            { name: 'Certificado de Antecedentes', desc: 'Original vigente (Art. 2 Código del Trabajo).' },
            { name: 'Título / Certificado Estudios', desc: 'Enseñanza Media o Superior (fotocopia).' },
            { name: 'Finiquito o Carta Renuncia', desc: 'Del último empleador, firmado.' },
            { name: 'Cert. de Competencias (Cursos)', desc: 'Diplomas o certificados técnicos adicionales.' }
        ]
    },
    {
        category: "Domicilio y Conducción",
        icon: MapPin,
        color: "emerald",
        items: [
            { name: 'Certificado de Residencia', desc: 'Junta de vecinos, notaría o boleta a su nombre.' },
            { name: 'Licencia de Conducir', desc: 'Si el cargo requiere conducción (Fotocopia ambos lados).' },
            { name: 'Cert. Hoja de Vida Conductor', desc: 'Emitido por Registro Civil (Vigente).' }
        ]
    },
    {
        category: "Historial Contractual y Pago",
        icon: FileText,
        color: "amber",
        items: [
            { name: 'Contrato de Trabajo', desc: 'Contrato firmado con la empresa.' },
            { name: 'Anexo de Contrato', desc: 'Anexos o modificaciones al contrato original.' },
            { name: 'Liquidación de Sueldo', desc: 'Liquidaciones mensuales de remuneraciones.' },
            { name: 'Acta de Finiquito', desc: 'Acta de término de relación laboral y finiquito legalizado.' }
        ]
    }
];

const GestionDocumental = () => {
    const [candidatos, setCandidatos] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [uploading, setUploading] = useState(null);
    const [viewMode, setViewMode] = useState('expedientes'); // 'expedientes' or 'requisitos'
    const [copied, setCopied] = useState(false);
    const [docDates, setDocDates] = useState({ emissionDate: '', expiryDate: '' });
    const [editingDoc, setEditingDoc] = useState(null);

    const fetchCandidatos = useCallback(async () => {
        setLoading(true);
        try {
            const res = await candidatosApi.getAll();
            setCandidatos(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    const selected = candidatos.find(c => c._id === selectedId);

    const printFiniquitoPdf = () => {
        if (!selected) return;
        const candidato = selected;
        const fd = candidato.finiquitoDetalle || {};
        const fechaFiniquitoStr = candidato.fechaFiniquito
            ? new Date(candidato.fechaFiniquito).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
            : new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
        
        const fechaIngresoStr = candidato.contractStartDate
            ? new Date(candidato.contractStartDate).toLocaleDateString('es-CL')
            : (fd.fechaIngresoReal ? new Date(fd.fechaIngresoReal).toLocaleDateString('es-CL') : 'No registrada');
            
        const fechaEgresoStr = candidato.fechaFiniquito
            ? new Date(candidato.fechaFiniquito).toLocaleDateString('es-CL')
            : (fd.fechaEgreso ? new Date(fd.fechaEgreso).toLocaleDateString('es-CL') : 'No registrada');

        const projectName = candidato.projectName || 'No asignado';
        const empresaNombre = candidato.empresaRef?.nombre || 'Empresa Empleadora';
        const causalTermino = fd.causalTermino || candidato.finiquitoMotivo || 'Necesidades de la empresa (Art. 161)';

        const aniosServicio = fd.aniosServicioCalculados || 0;
        const montoIAS = fd.montoIndemnizacionAnos || 0;
        const montoISAP = fd.montoIndemnizacionAviso || 0;
        const montoFP = fd.montoFeriadoProporcional || 0;
        const diasFP = fd.diasVacacionesCorridosCalculados || 0;
        const diasHabilesFP = fd.diasVacacionesHabilesCalculados || 0;
        const otrosHaberes = fd.otrosHaberes || 0;
        
        const descuentoAFC = fd.descuentoAFC || 0;
        const otrosDescuentos = fd.otrosDescuentos || 0;
        const netoFiniquito = fd.netoFiniquito !== undefined ? fd.netoFiniquito : 0;

        const totalHaberes = montoIAS + montoISAP + montoFP + otrosHaberes;
        const totalDescuentos = descuentoAFC + otrosDescuentos;

        const html = `
            <html>
            <head>
                <title>Acta de Finiquito - ${candidato.fullName}</title>
                <style>
                    body { font-family: 'Arial', sans-serif; color: #1e293b; margin: 40px; line-height: 1.5; font-size: 12px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .header h1 { font-size: 18px; font-weight: 800; margin: 0; text-transform: uppercase; color: #0f172a; }
                    .header p { font-size: 11px; margin: 5px 0 0 0; color: #64748b; font-weight: bold; }
                    .body-text { margin-bottom: 20px; text-align: justify; }
                    .table-title { font-weight: bold; margin-bottom: 8px; text-transform: uppercase; font-size: 11px; color: #334155; }
                    table { border-collapse: collapse; margin-bottom: 20px; width: 100%; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
                    th { background: #f1f5f9; font-weight: bold; font-size: 11px; }
                    .text-right { text-align: right; }
                    .font-bold { font-weight: bold; }
                    .section { margin-top: 25px; }
                    .reserva-box { border: 2px dashed #94a3b8; padding: 15px; margin-top: 25px; border-radius: 8px; background: #f8fafc; }
                    .reserva-title { font-weight: 900; font-size: 11px; text-transform: uppercase; color: #475569; margin-bottom: 6px; }
                    .firmas { display: flex; justify-content: space-between; margin-top: 60px; }
                    .firma-box { width: 45%; text-align: center; }
                    .linea { border-top: 1px solid #475569; margin-top: 50px; margin-bottom: 5px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${fd.procesadoEn === 'Notaria' ? 'Acta de Finiquito de Contrato de Trabajo (Legalizado ante Notario)' : 'Acta de Finiquito de Contrato de Trabajo'}</h1>
                    <p>${fd.procesadoEn === 'Notaria' ? `PROCESADO EN: ${fd.notariaNombre || 'NOTARÍA PÚBLICA'}` : 'DIRECCIÓN DEL TRABAJO COMPLIANT'}</p>
                </div>
                
                <div class="body-text">
                    En la ciudad de Rancagua, Chile, a ${fechaFiniquitoStr}, comparecen por una parte <strong>${empresaNombre}</strong>, en adelante "el Empleador", y por la otra don (ña) <strong>${candidato.fullName}</strong>, nacionalidad ${candidato.nationality || 'Chilena'}, cédula de identidad N° <strong>${candidato.rut}</strong>, de profesión u oficio <strong>${candidato.position || 'Colaborador'}</strong>, domiciliado(a) en ${candidato.address || 'No registrado'}, en adelante "el Trabajador", quienes dejan constancia de lo siguiente:
                </div>

                <div class="body-text">
                    <strong>PRIMERO:</strong> Las partes declaran que la relación laboral que los unía, iniciada con fecha ${fechaIngresoStr}, ha terminado con fecha ${fechaEgresoStr}, por la causal contemplada en el Código del Trabajo: <strong>"${causalTermino}"</strong>.
                </div>

                <div class="body-text">
                    <strong>SEGUNDO:</strong> El Empleador practica la liquidación de los haberes que le corresponden al Trabajador con motivo del término de su contrato de trabajo, la que arroja los siguientes conceptos e importes:
                </div>

                <div class="table-title">Desglose de Haberes e Indemnizaciones</div>
                <table>
                    <thead>
                        <tr>
                            <th>Concepto / Detalle</th>
                            <th class="text-right" style="width: 150px;">Monto ($)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${montoIAS > 0 ? `
                        <tr>
                            <td>Indemnización por Años de Servicio (${aniosServicio} año(s) calculado(s))</td>
                            <td class="text-right">$${montoIAS.toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        ${montoISAP > 0 ? `
                        <tr>
                            <td>Indemnización Sustitutiva de Aviso Previo</td>
                            <td class="text-right">$${montoISAP.toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        <tr>
                            <td>Feriado Proporcional (${diasFP} días corridos, equivalentes a ${diasHabilesFP} días hábiles)</td>
                            <td class="text-right">$${montoFP.toLocaleString('es-CL')}</td>
                        </tr>
                        ${otrosHaberes > 0 ? `
                        <tr>
                            <td>Otros Haberes devengados a pagar</td>
                            <td class="text-right">$${otrosHaberes.toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        <tr class="font-bold">
                            <td>TOTAL HABERES</td>
                            <td class="text-right">$${totalHaberes.toLocaleString('es-CL')}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="table-title">Desglose de Descuentos</div>
                <table>
                    <thead>
                        <tr>
                            <th>Concepto / Detalle</th>
                            <th class="text-right" style="width: 150px;">Monto ($)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${descuentoAFC > 0 ? `
                        <tr>
                            <td>Descuento Aporte Empleador Seguro de Cesantía (Art. 13 Ley 19.728)</td>
                            <td class="text-right text-red-600">-$${descuentoAFC.toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        ${otrosDescuentos > 0 ? `
                        <tr>
                            <td>Otros Descuentos autorizados / deudas / anticipos</td>
                            <td class="text-right text-red-600">-$${otrosDescuentos.toLocaleString('es-CL')}</td>
                        </tr>` : ''}
                        <tr class="font-bold">
                            <td>TOTAL DESCUENTOS</td>
                            <td class="text-right">-$${totalDescuentos.toLocaleString('es-CL')}</td>
                        </tr>
                    </tbody>
                </table>

                <table>
                    <tbody>
                        <tr class="font-bold" style="font-size: 13px; background: #e2e8f0;">
                            <td>SALDO NETO A PAGAR AL TRABAJADOR</td>
                            <td class="text-right" style="color: #047857;">$${netoFiniquito.toLocaleString('es-CL')}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="body-text">
                    <strong>TERCERO:</strong> El Trabajador declara recibir del Empleador, a su entera satisfacción, la suma neta de <strong>$${netoFiniquito.toLocaleString('es-CL')}</strong> mediante transferencia bancaria o vale vista, y otorga con esto el más amplio, completo y recíproco finiquito de todas las obligaciones laborales, declarando no tener deuda pendiente alguna por concepto de remuneraciones, horas extras, feriado legal o proporcional, cotizaciones previsionales u otros.
                </div>

                <div class="reserva-box">
                    <div class="reserva-title">Reserva de Derechos del Trabajador (Espacio Legal de la DT)</div>
                    <div style="font-size: 10px; color: #64748b; margin-bottom: 20px;">
                        De conformidad con la doctrina de la Dirección del Trabajo, el trabajador conserva la facultad de consignar su reserva de derechos al estampar su firma para posteriores acciones ante tribunales.
                    </div>
                    <div style="border-bottom: 1px solid #cbd5e1; height: 16px; margin-bottom: 10px;"></div>
                    <div style="border-bottom: 1px solid #cbd5e1; height: 16px; margin-bottom: 10px;"></div>
                    <div style="border-bottom: 1px solid #cbd5e1; height: 16px;"></div>
                </div>

                ${fd.procesadoEn === 'Notaria' ? `
                <div class="reserva-box" style="border: 1px solid #cbd5e1; padding: 15px; margin-top: 25px; border-radius: 8px; background: #f8fafc;">
                    <div class="reserva-title" style="font-weight: 900; font-size: 11px; text-transform: uppercase; color: #475569; margin-bottom: 6px;">
                        Certificación de Ministro de Fe (Notario Público)
                    </div>
                    <div style="font-size: 10px; color: #334155; line-height: 1.4; text-align: justify;">
                        Autorizo las firmas de los comparecientes don/ña <strong>${candidato.fullName}</strong> y el representante legal de <strong>${empresaNombre}</strong>, quienes firman ante mí en señal de conformidad y ratificación de este documento, y después de haber pagado la suma de $${netoFiniquito.toLocaleString('es-CL')} pactada.
                    </div>
                    <div style="font-size: 9px; color: #64748b; margin-top: 8px; font-weight: bold;">
                        Fecha de legalización: ${fd.notariaFechaFirma ? new Date(fd.notariaFechaFirma).toLocaleDateString('es-CL') : '______'} | Gastos notariales: $${(fd.notariaGastos || 0).toLocaleString('es-CL')} (Pagado por ${fd.notariaPagadoPor})
                    </div>
                </div>` : ''}

                ${fd.procesadoEn === 'Notaria' ? `
                <div class="firmas" style="display: flex; justify-content: space-between; margin-top: 60px;">
                    <div class="firma-box" style="width: 30%; text-align: center;">
                        <div class="linea"></div>
                        <p class="font-bold">${candidato.fullName}</p>
                        <p>TRABAJADOR</p>
                        <p>RUT: ${candidato.rut}</p>
                    </div>
                    <div class="firma-box" style="width: 30%; text-align: center;">
                        <div class="linea"></div>
                        <p class="font-bold">${empresaNombre}</p>
                        <p>EMPLEADOR</p>
                    </div>
                    <div class="firma-box" style="width: 30%; text-align: center;">
                        <div class="linea"></div>
                        <p class="font-bold">${fd.notariaNombre || 'NOTARIO PÚBLICO'}</p>
                        <p>MINISTRO DE FE / NOTARIO</p>
                    </div>
                </div>
                ` : `
                <div class="firmas">
                    <div class="firma-box" style="width: 45%;">
                        <div class="linea"></div>
                        <p class="font-bold">${candidato.fullName}</p>
                        <p>TRABAJADOR</p>
                        <p>RUT: ${candidato.rut}</p>
                    </div>
                    <div class="firma-box" style="width: 45%;">
                        <div class="linea"></div>
                        <p class="font-bold">${empresaNombre}</p>
                        <p>EMPLEADOR</p>
                    </div>
                </div>
                `}
            </body>
            </html>
        `;
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) return alert('No se pudo abrir la ventana de impresión. Por favor, desactiva el bloqueador de popups.');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500);
    };

    useEffect(() => {
        fetchCandidatos();
    }, [fetchCandidatos]);

    const handleUpload = async (e, docType) => {
        if (!selected) return;
        const file = e.target.files[0];
        if (!file) return;

        setUploading(docType);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('docType', docType);
            
            // Adjuntar fechas si están presentes
            if (docDates.emissionDate) formData.append('emissionDate', docDates.emissionDate);
            if (docDates.expiryDate) formData.append('expiryDate', docDates.expiryDate);

            await candidatosApi.uploadDocument(selected._id, formData);
            fetchCandidatos();
            setDocDates({ emissionDate: '', expiryDate: '' });
            setEditingDoc(null);
        } catch (e) {
            alert('Error al subir documento');
        } finally {
            setUploading(null);
        }
    };

    const handleUpdateDocumentMetadata = async (docId) => {
        if (!selected || !docDates.emissionDate) return;
        setLoading(true);
        try {
            await candidatosApi.updateDocumentStatus(selected._id, docId, null, {
                emissionDate: docDates.emissionDate,
                expiryDate: docDates.expiryDate
            });
            fetchCandidatos();
            setEditingDoc(null);
            setDocDates({ emissionDate: '', expiryDate: '' });
        } catch (e) {
            alert('Error al actualizar metadatos');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (docId, newStatus) => {
        try {
            await candidatosApi.updateDocumentStatus(selected._id, docId, newStatus);
            fetchCandidatos();
        } catch (e) {
            alert('Error al actualizar estado');
        }
    };

    const calculateExpiry = (type, emission) => {
        // Prioridad: Fechas ya registradas en la ficha (Cédula/Licencia)
        if (type === 'Cédula de Identidad' && selected?.idExpiryDate) {
            return new Date(selected.idExpiryDate).toISOString().split('T')[0];
        }
        if (type === 'Licencia de Conducir' && selected?.fechaVencimientoLicencia) {
            return new Date(selected.fechaVencimientoLicencia).toISOString().split('T')[0];
        }

        if (!emission) return '';
        const d = new Date(emission);
        if (type === 'Certificado de Antecedentes' || type === 'Antecedentes Penales' || type === 'Antecedentes Fines Especiales') {
            d.setDate(d.getDate() + 30);
            return d.toISOString().split('T')[0];
        }
        if (type === 'Certificado de Residencia' || type === 'Certificado Afiliación AFP' || type === 'Certificado Afiliación Salud') {
            d.setDate(d.getDate() + 90);
            return d.toISOString().split('T')[0];
        }
        return '';
    };

    const copyToClipboard = () => {
        let text = "*LISTA DE DOCUMENTOS REQUERIDOS - RRHH*\n\n";
        MASTER_DOCUMENTS.forEach(cat => {
            text += `*${cat.category.toUpperCase()}*\n`;
            cat.items.forEach(item => {
                text += `• ${item.name}: ${item.desc}\n`;
            });
            text += "\n";
        });
        text += "_Por favor entregar estos documentos en formato digital (PDF o Imagen clara) para su procesamiento._";

        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const filtered = candidatos.filter(c => {
        const term = searchTerm.toLowerCase();
        const cleanSearch = searchTerm.replace(/[^0-9kK]/gi, '');
        const cleanRut = c.rut ? c.rut.replace(/[^0-9kK]/gi, '') : '';
        return !searchTerm ||
               c.fullName?.toLowerCase().includes(term) ||
               (cleanSearch && cleanRut.includes(cleanSearch));
    });

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-20 animate-in fade-in duration-500 print:p-0 w-full overflow-x-hidden relative">
            {/* Cabecera con Tabs Globales */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 print:hidden">
                <div className="flex items-center gap-4">
                    <div className="bg-amber-600 text-white p-3.5 rounded-[1.25rem] shadow-xl shadow-amber-200/50">
                        <FileText size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">
                            Gestión <span className="text-amber-600">Documental</span>
                        </h1>
                        <p className="text-slate-400 text-[10px] font-black mt-1 uppercase tracking-[0.2em]">Centro de Control y Cumplimiento Normativo</p>
                    </div>
                </div>

                <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 self-start md:self-center">
                    <button
                        onClick={() => setViewMode('expedientes')}
                        className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'expedientes' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Expedientes Digitales
                    </button>
                    <button
                        onClick={() => setViewMode('requisitos')}
                        className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'requisitos' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Requisitos Oficiales
                    </button>
                </div>
            </div>

            {viewMode === 'expedientes' ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in slide-in-from-left-4 duration-500">
                    {/* Search Sidebar */}
                    <div className="lg:col-span-1 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col h-[700px] overflow-hidden">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar candidato..."
                                    className="w-full pl-11 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-[11px] font-black placeholder:text-slate-300 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto divide-y divide-slate-50 custom-scrollbar">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="animate-spin text-amber-500" size={32} />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando...</span>
                                </div>
                            ) : filtered.length > 0 ? (
                                filtered.map(c => (
                                    <button
                                        key={c._id}
                                        onClick={() => setSelectedId(c._id)}
                                        className={`w-full p-6 text-left transition-all hover:bg-slate-50 border-l-4 ${selectedId === c._id ? 'bg-amber-50/50 border-amber-600 shadow-inner' : 'border-transparent'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-500 uppercase shadow-inner border border-slate-200 shrink-0">
                                                {c.profilePic ? <img src={c.profilePic} alt="" className="w-full h-full object-cover rounded-lg" /> : c.fullName?.substring(0, 2)}
                                            </div>
                                            <div className="flex flex-col overflow-hidden">
                                                <p className={`text-[11px] font-black uppercase truncate transition-colors ${selectedId === c._id ? 'text-amber-700' : 'text-slate-800'}`}>{c.fullName}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[9px] font-mono font-black text-slate-400 tracking-widest">{formatRut(c.rut)}</span>
                                                    <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                                    <span className="text-[9px] font-black text-slate-500 uppercase">{c.status}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 bg-slate-100 rounded-full h-1 overflow-hidden">
                                            <div className="bg-emerald-500 h-full transition-all duration-700" style={{ width: `${Math.min((c.documents?.length || 0) * 8, 100)}%` }}></div>
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="p-12 text-center">
                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-loose">No se encontraron registros</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main View Expediente */}
                    <div className="lg:col-span-3">
                        {selected ? (
                            <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
                                {/* Profile Header */}
                                <div className="bg-slate-900 p-10 rounded-[3.5rem] shadow-2xl text-white flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
                                    <div className="flex items-center gap-8 relative z-10">
                                        <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center text-4xl font-black border border-white/20 shadow-inner">
                                            {selected.fullName.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="text-3xl font-black uppercase tracking-tight italic">{selected.fullName}</h3>
                                            <div className="flex flex-wrap items-center gap-4 mt-3">
                                                <div className="bg-amber-500 text-slate-900 px-3 py-1 rounded-xl text-[10px] font-mono font-black uppercase tracking-widest shadow-lg shadow-amber-500/20">{formatRut(selected.rut)}</div>
                                                <span className="w-1.5 h-1.5 bg-white/20 rounded-full"></span>
                                                <div className="flex items-center gap-2 text-slate-400">
                                                    <Briefcase size={14} className="text-amber-500" />
                                                    <span className="text-[11px] font-bold uppercase tracking-widest">{selected.position}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 relative z-10 px-6 py-4 bg-white/5 rounded-3xl border border-white/10">
                                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Items Cargados</p>
                                        <p className="text-5xl font-black text-white">{selected.documents?.length || 0} <span className="text-sm text-slate-500">/ 17</span></p>
                                    </div>
                                </div>

                                {/* Documents Grid */}
                                <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100">
                                    <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-50">
                                        <div>
                                            <h4 className="font-black text-slate-800 uppercase tracking-tight text-xl italic">Expediente Digital 360</h4>
                                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Verificación de requisitos contractuales</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setViewMode('requisitos')}
                                                className="flex items-center gap-3 px-6 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-xl shadow-slate-200"
                                            >
                                                <Info size={16} /> Ver Guía de Requisitos
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {[
                                            'Cédula de Identidad',
                                            'Currículum Vitae',
                                            'Certificado de Antecedentes',
                                            'Certificado de Residencia',
                                            'Título / Certificado Estudios',
                                            'Cert. de Competencias (Cursos)',
                                            'Fotografía Tamaño Pasaporte',
                                            'Finiquito o Carta Renuncia',
                                            'Cert. AFP + 12 Cotizaciones',
                                            'Cert. Salud + Valor Plan',
                                            'Certificado Cargas Familiares',
                                            'Licencia de Conducir',
                                            'Cert. Hoja de Vida Conductor',
                                            'Contrato de Trabajo',
                                            'Anexo de Contrato',
                                            'Liquidación de Sueldo',
                                            'Acta de Finiquito'
                                        ].map(type => {
                                            const doc = selected.documents?.find(d => d.docType === type);
                                            const isActiveFiniquito = type === 'Acta de Finiquito' && selected.status !== 'Finiquitado';
                                            return (
                                                <div key={type} className={`group p-6 rounded-3xl border-2 transition-all hover:scale-[1.02] ${
                                                    isActiveFiniquito ? 'border-slate-100 bg-slate-50/20 opacity-70' :
                                                    doc ? 'border-emerald-50 bg-emerald-50/20' : 'border-slate-50 bg-slate-50/50'
                                                }`}>
                                                    <div className="flex flex-col h-full justify-between gap-6">
                                                        <div>
                                                            <div className="flex justify-between items-start mb-3">
                                                                <h5 className="font-black text-slate-800 text-[11px] uppercase tracking-tight leading-tight max-w-[70%]">{type}</h5>
                                                                {doc ? <Check className="text-emerald-500" size={18} /> : (
                                                                    (type === 'Licencia de Conducir' || type === 'Cert. Hoja de Vida Conductor') && selected.requiereLicencia === 'NO' ?
                                                                        <div className="w-1.5 h-1.5 bg-slate-100 rounded-full" /> :
                                                                        isActiveFiniquito ?
                                                                            <div className="w-1.5 h-1.5 bg-slate-100 rounded-full" /> :
                                                                            <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
                                                                )}
                                                            </div>

                                                            {/* Inyección de Metadata Declarada */}
                                                            <div className="mb-4">
                                                                {type === 'Cert. AFP + 12 Cotizaciones' && selected.afp && (
                                                                    <div className="flex items-center gap-2 text-[9px] font-black text-indigo-600 bg-indigo-50/50 px-2 py-1 rounded-lg border border-indigo-100">
                                                                        <span className="opacity-50 uppercase tracking-tighter">Declarado:</span> {selected.afp}
                                                                    </div>
                                                                )}
                                                                {type === 'Cert. Salud + Valor Plan' && selected.previsionSalud && (
                                                                    <div className="flex items-center gap-2 text-[9px] font-black text-rose-600 bg-rose-50/50 px-2 py-1 rounded-lg border border-rose-100">
                                                                        <span className="opacity-50 uppercase tracking-tighter">Declarado:</span> {selected.previsionSalud} {selected.valorPlan && `(${selected.valorPlan} ${selected.monedaPlan})`}
                                                                    </div>
                                                                )}
                                                                {type === 'Licencia de Conducir' && selected.requiereLicencia === 'SI' && (
                                                                    <div className="flex items-center gap-2 text-[9px] font-black text-orange-600 bg-orange-50/50 px-2 py-1 rounded-lg border border-orange-100">
                                                                        <span className="opacity-50 uppercase tracking-tighter">Vence:</span> {selected.fechaVencimientoLicencia || 'No Ingresado'}
                                                                    </div>
                                                                )}
                                                                {type === 'Fotografía Tamaño Pasaporte' && (selected.shirtSize || selected.pantsSize) && (
                                                                    <div className="flex items-center gap-2 text-[8px] font-black text-slate-500 bg-slate-100/50 px-2 py-1 rounded-lg border border-slate-200 uppercase tracking-tighter">
                                                                        Tallas: {selected.shirtSize}/{selected.pantsSize}/{selected.jacketSize}/{selected.shoeSize}
                                                                    </div>
                                                                )}
                                                                {type === 'Certificado Cargas Familiares' && (
                                                                    <div className={`flex items-center gap-2 text-[9px] font-black px-2 py-1 rounded-lg border uppercase tracking-tighter ${selected.tieneCargas === 'SI' ? 'text-amber-600 bg-amber-50/50 border-amber-100' : 'text-slate-400 bg-slate-50 border-slate-100'}`}>
                                                                        {selected.tieneCargas === 'SI' ? `Tiene ${selected.listaCargas?.length || 0} Cargas` : 'Sin Cargas Declaradas'}
                                                                    </div>
                                                                )}
                                                                {type === 'Licencia de Conducir' && selected.requiereLicencia === 'NO' && (
                                                                    <div className="text-[8px] font-black text-slate-400 uppercase italic opacity-60">No requerida para el cargo</div>
                                                                )}
                                                                {type === 'Contrato de Trabajo' && (selected.contractType || selected.contractStartDate) && (
                                                                    <div className="flex flex-col gap-1 text-[9px] font-black text-amber-600 bg-amber-50/50 px-2 py-1 rounded-lg border border-amber-100 uppercase tracking-tighter">
                                                                        {selected.contractType && <div>Tipo: {selected.contractType}</div>}
                                                                        {selected.contractStartDate && <div>Inicio: {new Date(selected.contractStartDate).toLocaleDateString('es-CL')}</div>}
                                                                    </div>
                                                                )}
                                                                {type === 'Acta de Finiquito' && selected.finiquitoDetalle && (
                                                                    <div className="flex flex-col gap-1 text-[9px] font-black text-violet-600 bg-violet-50/50 px-2 py-1 rounded-lg border border-violet-100 uppercase tracking-tighter">
                                                                        {selected.finiquitoDetalle.netoFiniquito !== undefined && <div>Monto Neto: ${(selected.finiquitoDetalle.netoFiniquito).toLocaleString('es-CL')}</div>}
                                                                        {selected.finiquitoDetalle.fechaEgreso && <div>Fecha Egreso: {new Date(selected.finiquitoDetalle.fechaEgreso).toLocaleDateString('es-CL')}</div>}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {isActiveFiniquito ? (
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase italic tracking-tighter opacity-80">No requerido aún (Colaborador Activo)</span>
                                                            ) : doc ? (
                                                                <div className="flex flex-col gap-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded shadow-sm uppercase ${doc.status === 'Verificado' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                                                                            {doc.status}
                                                                        </span>
                                                                        {doc.expiryDate && (
                                                                            <span className={`text-[9px] font-black uppercase tracking-wider ${
                                                                                new Date(doc.expiryDate) < new Date() ? 'text-rose-600 animate-pulse' : 
                                                                                (new Date(doc.expiryDate) - new Date()) / (1000 * 60 * 60 * 24) < 7 ? 'text-amber-600' : 'text-emerald-600'
                                                                            }`}>
                                                                                {new Date(doc.expiryDate) < new Date() ? 'Vencido' : 
                                                                                 `Vence en ${Math.ceil((new Date(doc.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))} días`}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex flex-col gap-1 mt-1">
                                                                        {doc.emissionDate && <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Emisión: {new Date(doc.emissionDate).toLocaleDateString()}</span>}
                                                                        {doc.expiryDate && <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Vencimiento: {new Date(doc.expiryDate).toLocaleDateString()}</span>}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-slate-300 uppercase italic tracking-tighter">Pendiente de recepción</span>
                                                            )}
                                                        </div>

                                                            <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-slate-100/50">
                                                                {isActiveFiniquito ? (
                                                                    <div className="w-full">
                                                                        <button
                                                                            onClick={() => window.location.href = `/rrhh/finiquitos?candidatoId=${selected._id}`}
                                                                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                                                                        >
                                                                            Desvincular
                                                                        </button>
                                                                    </div>
                                                                ) : type === 'Acta de Finiquito' && selected.status === 'Finiquitado' && !editingDoc ? (
                                                                    <div className="flex flex-col gap-2 w-full">
                                                                        <button
                                                                            onClick={printFiniquitoPdf}
                                                                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                                                                        >
                                                                            <Printer size={14} /> Generar Acta (PDF)
                                                                        </button>
                                                                        <div className="flex items-center gap-2 w-full">
                                                                            {doc?.url && (
                                                                                <a
                                                                                    href={doc.url}
                                                                                    target="_blank"
                                                                                    rel="noreferrer"
                                                                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white text-slate-600 rounded-xl border border-slate-200 text-[10px] font-black uppercase hover:bg-slate-50 transition-all shadow-sm"
                                                                                >
                                                                                    <Eye size={14} /> Ver
                                                                                </a>
                                                                            )}
                                                                            {!doc ? (
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setEditingDoc(type);
                                                                                        const ex = calculateExpiry(type, '');
                                                                                        const em = '';
                                                                                        setDocDates({ emissionDate: em, expiryDate: ex });
                                                                                    }}
                                                                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-amber-700 transition-all shadow-xl shadow-amber-100"
                                                                                >
                                                                                    <Upload size={14} /> Subir
                                                                                </button>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setEditingDoc(type);
                                                                                        setDocDates({
                                                                                            emissionDate: doc.emissionDate ? new Date(doc.emissionDate).toISOString().split('T')[0] : '',
                                                                                            expiryDate: doc.expiryDate ? new Date(doc.expiryDate).toISOString().split('T')[0] : ''
                                                                                        });
                                                                                    }}
                                                                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white text-slate-400 rounded-xl border border-slate-100 text-[10px] font-black uppercase hover:border-amber-500 hover:text-amber-600 transition-all"
                                                                                >
                                                                                    <FileText size={14} /> Fechas
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ) : editingDoc === type ? (
                                                                    <div className="space-y-3 p-4 bg-white/50 rounded-2xl border border-slate-100 animate-in fade-in zoom-in duration-300">
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            <div>
                                                                                <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block">Emisión</label>
                                                                                <input 
                                                                                    type="date"
                                                                                    className="w-full px-2 py-1.5 bg-white border border-slate-100 rounded-lg text-[10px] font-bold outline-none focus:border-amber-500"
                                                                                    value={docDates.emissionDate}
                                                                                    onChange={(e) => {
                                                                                        const em = e.target.value;
                                                                                        const ex = calculateExpiry(type, em);
                                                                                        setDocDates({ emissionDate: em, expiryDate: ex });
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block">Vencimiento</label>
                                                                                <input 
                                                                                    type="date"
                                                                                    className="w-full px-2 py-1.5 bg-white border border-slate-100 rounded-lg text-[10px] font-bold outline-none focus:border-amber-500"
                                                                                    value={docDates.expiryDate}
                                                                                    onChange={(e) => setDocDates({ ...docDates, expiryDate: e.target.value })}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        {!doc ? (
                                                                            <label className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer shadow-xl shadow-amber-200 hover:bg-amber-700">
                                                                                {uploading === type ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                                                                Subir Archivo
                                                                                <input type="file" className="hidden" onChange={e => handleUpload(e, type)} accept=".pdf,image/*" />
                                                                            </label>
                                                                        ) : (
                                                                            <button 
                                                                                onClick={() => handleUpdateDocumentMetadata(doc._id)}
                                                                                className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-xl shadow-slate-200"
                                                                            >
                                                                                Confirmar Fechas
                                                                            </button>
                                                                        )}
                                                                        <button onClick={() => setEditingDoc(null)} className="w-full text-[9px] font-black text-slate-400 uppercase hover:text-rose-500 transition-colors">Cancelar</button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-2 w-full">
                                                                        {doc?.url && (
                                                                            <a
                                                                                href={doc.url}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white text-slate-600 rounded-xl border border-slate-200 text-[10px] font-black uppercase hover:bg-slate-50 transition-all shadow-sm"
                                                                            >
                                                                                <Eye size={14} /> Ver
                                                                            </a>
                                                                        )}
                                                                        {!doc ? (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setEditingDoc(type);
                                                                                    const ex = calculateExpiry(type, '');
                                                                                    const em = (type === 'Cédula de Identidad' || type === 'Licencia de Conducir') ? (doc?.emissionDate ? new Date(doc.emissionDate).toISOString().split('T')[0] : '') : '';
                                                                                    setDocDates({ emissionDate: em, expiryDate: ex });
                                                                                }}
                                                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-amber-700 transition-all shadow-xl shadow-amber-100"
                                                                            >
                                                                                <Upload size={14} /> Subir
                                                                            </button>
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setEditingDoc(type);
                                                                                    setDocDates({
                                                                                        emissionDate: doc.emissionDate ? new Date(doc.emissionDate).toISOString().split('T')[0] : '',
                                                                                        expiryDate: doc.expiryDate ? new Date(doc.expiryDate).toISOString().split('T')[0] : ''
                                                                                    });
                                                                                }}
                                                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white text-slate-400 rounded-xl border border-slate-100 text-[10px] font-black uppercase hover:border-amber-500 hover:text-amber-600 transition-all"
                                                                            >
                                                                                <FileText size={14} /> Fechas
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                        {doc && doc.status === 'Pendiente' && (
                                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                                <button
                                                                    onClick={() => handleUpdateStatus(doc._id, 'Verificado')}
                                                                    className="py-2 bg-emerald-100 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                                                >
                                                                    Validar
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUpdateStatus(doc._id, 'Rechazado')}
                                                                    className="py-2 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                                                >
                                                                    Rechazar
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-[700px] bg-white rounded-[3.5rem] border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 relative overflow-hidden">
                                <div className="absolute inset-0 bg-slate-50/30 -z-10" />
                                <div className="bg-slate-50 p-10 rounded-[2.5rem] mb-6 shadow-inner">
                                    <FileText size={80} className="text-slate-200" />
                                </div>
                                <h4 className="font-black uppercase tracking-[0.2em] text-lg text-slate-400">Expediente No Seleccionado</h4>
                                <p className="text-[11px] font-bold text-slate-300 mt-2 max-w-xs text-center leading-loose">Seleccione un colaborador o postulante en el panel lateral para gestionar sus documentos.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* VISTA DE REQUISITOS OFICIALES (GLOBAL) */
                <div className="max-w-6xl mx-auto animate-in slide-in-from-right-8 duration-700 space-y-10 print:hidden">

                    {/* Hero Section Requisitos */}
                    <div className="bg-white p-12 rounded-[3.5rem] shadow-xl border border-slate-100 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000">
                            <Smartphone size={300} />
                        </div>
                        <div className="flex flex-col md:flex-row items-center justify-between gap-10 relative z-10">
                            <div className="max-w-xl pr-10">
                                <h2 className="text-4xl font-black text-slate-800 tracking-tighter uppercase italic leading-tight print:hidden">
                                    Guía de <br /> <span className="text-amber-600">Requisitos Oficiales</span>
                                </h2>
                                <p className="text-slate-500 font-bold mt-4 leading-relaxed text-sm print:hidden">
                                    Este documento contiene el desglose legal y corporativo de todos los documentos necesarios para formalizar una contratación. Úselo para guiar a los postulantes y validar ingresos.
                                </p>
                                <div className="flex flex-wrap gap-4 mt-4">
                                    <button
                                        onClick={() => window.print()}
                                        className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl border border-slate-800 hover:bg-slate-800 transition-all font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200"
                                    >
                                        <FileText size={16} /> Descargar Guía PDF
                                    </button>
                                    <button
                                        onClick={copyToClipboard}
                                        className={`group flex items-center justify-center gap-4 px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all transform active:scale-95 shadow-xl ${copied ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 shadow-slate-200'}`}
                                    >
                                        {copied ? (
                                            <>
                                                <Check size={16} /> ¡Copiado!
                                            </>
                                        ) : (
                                            <>
                                                <Share2 size={16} /> Compartir por WhatsApp
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="shrink-0 hidden lg:block">
                                <div className="p-8 bg-amber-50 rounded-[2.5rem] border border-amber-100">
                                    <Smartphone size={100} className="text-amber-600 opacity-20" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Categorías en Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {MASTER_DOCUMENTS.map((cat, idx) => (
                            <div key={idx} className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 group">
                                <div className={`p-8 flex items-center gap-6 border-b border-slate-50 transition-colors bg-white group-hover:bg-slate-50/50`}>
                                    <div className={`p-4 rounded-[1.5rem] transition-all duration-500 group-hover:rotate-6 bg-${cat.color}-50 text-${cat.color}-600 shadow-sm`}>
                                        <cat.icon size={28} />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight italic">{cat.category}</h4>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 opacity-60">{cat.items.length} Requisitos</p>
                                    </div>
                                </div>
                                <div className="p-8 space-y-6 flex-1">
                                    {cat.items.map((item, i) => (
                                        <div key={i} className="flex gap-4">
                                            <div className="mt-1.5 w-1.5 h-1.5 bg-slate-200 rounded-full shrink-0 group-hover:bg-amber-500 transition-colors" />
                                            <div>
                                                <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{item.name}</p>
                                                <p className="text-[11px] font-bold text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer Info */}
                    <div className="bg-slate-900/5 p-10 rounded-[3.5rem] border border-dashed border-slate-200 flex items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-white rounded-2xl text-amber-600 shadow-sm border border-slate-100">
                                <Info size={24} />
                            </div>
                            <p className="text-[11px] font-bold text-slate-500 leading-loose max-w-2xl">
                                <span className="font-black text-slate-700 uppercase">Nota Importante:</span> Todos los documentos deben ser legibles y estar vigentes al momento de la carga. En caso de extranjeros, la cédula debe estar vigente o contar con certificado de residencia en trámite acreditado.
                            </p>
                        </div>
                        <div className="hidden lg:block h-12 w-1 border-l-2 border-slate-200" />
                        <div className="shrink-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center italic opacity-40">AgentPro RRHH v2.5</p>
                        </div>
                    </div>

                    <div className="text-center opacity-30 mt-10">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] italic">Propiedad de AgentPro © 2026</p>
                    </div>

                </div>
            )}

            {/* Componente de Impresión (Invisible en UI normal) */}
            <GuiaRequisitosPrint />
        </div>
    );
};

export default GestionDocumental;

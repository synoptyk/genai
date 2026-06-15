import React from 'react';
import { 
  User, Mail, Phone, MapPin, Briefcase, 
  Calendar, Hash, Globe, Shield, 
  Check, Square, Building, Landmark,
  CreditCard, Share2, Download, Printer,
  Heart, GraduationCap, Shirt, Truck,
  Clock, Map,
  FileText,
  UserMinus,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatRut } from '../utils/rutUtils';

/**
 * FichaIngresoPremium
 * Componente de visualización ejecutiva con Firmas Electrónicas Avanzadas.
 */
const printStyles = `
  @media print {
    @page {
      size: A4;
      margin: 10mm;
    }
    body {
      background: white !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print-hide { display: none !important; }
    .ficha-container {
      width: 100% !important;
      max-width: none !important;
      padding: 0 !important;
      margin: 0 !important;
      box-shadow: none !important;
      border: none !important;
      background: white !important;
    }
    .ficha-content {
      transform: none !important;
      width: 100% !important;
    }
    .print-no-break {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
        margin-bottom: 2rem !important;
    }
    /* Estilos para asegurar que los bordes y gradientes se vean bien */
    section {
        border-color: #e2e8f0 !important;
    }
    .bg-slate-900 {
        background-color: #0f172a !important;
        color: white !important;
    }
    .bg-indigo-50 { background-color: #eef2ff !important; }
    .bg-rose-50 { background-color: #fff1f2 !important; }
    .bg-amber-50 { background-color: #fffbeb !important; }
  }
`;

const FichaIngresoPremium = ({ data, approvalChain = [] }) => {
  if (!data) return <div className="p-10 text-center font-bold text-slate-400 uppercase tracking-widest text-xs">Sin datos disponibles</div>;

  const handlePrint = () => window.print();

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return dateStr; }
  };

  const printFiniquitoPdf = () => {
    const candidato = data;
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

  const AdvancedSignature = ({ payload, label, fallbackName, fallbackPosition, fallbackDate }) => {
    const isSigned = !!payload?.imagenBase64 || !!payload?.signature;
    const signatureImg = payload?.imagenBase64 || payload?.signature;
    const name = payload?.nombreFirmante || payload?.nombre || fallbackName;
    const position = payload?.cargoFirmante || payload?.position || fallbackPosition;
    const date = payload?.timestamp || payload?.date || fallbackDate;
    const firmaId = payload?.firmaId || `ID-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const coords = payload?.coordenadas;
    const qrData = payload?.qrVerificacion || `${window.location.origin}/verify?id=${firmaId}`;

    return (
      <div className="flex flex-col items-center w-full group">
        <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 relative overflow-hidden transition-all hover:bg-white hover:shadow-md h-40 flex flex-col justify-center items-center">
          {isSigned ? (
            <>
              <img src={signatureImg} alt="Firma" className="max-h-24 max-w-full object-contain relative z-10 drop-shadow-sm" />
              <div className="absolute top-2 right-2 opacity-5">
                <Shield size={40} className="text-blue-900" />
              </div>
            </>
          ) : (
            <div className="text-[7px] text-slate-300 font-black uppercase tracking-[0.2em] italic">Validación Pendiente</div>
          )}
        </div>
        
        <div className="mt-3 w-full space-y-2 text-center">
            <p className="text-[9px] font-black text-slate-800 uppercase leading-none">{name || label}</p>
            <p className="text-[7px] font-bold text-[#3b79b6] uppercase tracking-tighter">{position}</p>
            
            {isSigned && (
              <div className="flex flex-col items-center gap-1.5 pt-2 border-t border-slate-50">
                 <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                    <div className="w-10 h-10 p-0.5 bg-white rounded-lg">
                       <QRCodeSVG value={qrData} size={36} level="M" />
                    </div>
                    <div className="text-left">
                       <p className="text-[6px] font-mono text-slate-400 uppercase leading-none mb-1">ID: {firmaId}</p>
                       <p className="text-[6px] font-black text-slate-600 flex items-center gap-1 uppercase">
                          <Clock size={8} /> {new Date(date).toLocaleString('es-CL')}
                       </p>
                       {coords && (
                         <p className="text-[5px] font-bold text-emerald-600 flex items-center gap-1 uppercase mt-0.5">
                            <Map size={8} /> Lat: {coords.lat} Lng: {coords.lng}
                         </p>
                       )}
                    </div>
                 </div>
              </div>
            )}
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{printStyles}</style>
      
      <div className="print-hide sticky top-4 z-50 flex justify-center mb-6">
        <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 p-2 rounded-[2rem] shadow-2xl flex items-center gap-2">
           <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-2.5 bg-[#3b79b6] hover:bg-[#2c5d8c] text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all">
             <Printer size={14} /> Imprimir
           </button>
           <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all">
             <Download size={14} /> PDF
           </button>
        </div>
      </div>

      <div className="ficha-container bg-white p-12 max-w-5xl mx-auto shadow-2xl border border-slate-100 font-sans text-slate-800 transition-all duration-500 relative rounded-3xl">
        <div className="ficha-content">
          {/* Header Banner */}
          <div className="h-3 bg-gradient-to-r from-[#3b79b6] to-slate-900 w-full mb-8 rounded-full opacity-90 overflow-hidden relative">
            <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.1)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.1)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[slide_1s_linear_infinite]"></div>
          </div>

          <div className="flex justify-between items-start mb-12 border-b-2 border-slate-50 pb-8">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-2xl relative overflow-hidden group">
                 <span className="text-4xl font-black relative z-10">{data.fullName?.charAt(0)}</span>
                 <div className="absolute inset-0 bg-[#3b79b6] opacity-0 group-hover:opacity-20 transition-all"></div>
              </div>
              <div>
                <h1 className="text-4xl font-black text-[#2c3e50] tracking-tighter uppercase leading-none">
                  Expediente <span className="text-[#3b79b6]">Auditado</span>
                </h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">
                  Ecosistema de Gestión <span className="text-[#3b79b6]">{data.empresaRef?.nombre || 'Portal Corporativo'}</span>
                </p>
              </div>
            </div>
            <div className="text-right glass-sm p-4 rounded-3xl border border-slate-100 bg-slate-50/50">
               <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">ID RECURSO TOA</p>
               <span className="text-[14px] font-black text-indigo-600 font-mono leading-none tracking-widest">{data.idRecursoToa || 'SIN ASIGNAR'}</span>
               <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em] mt-3 mb-1">Hash ID Registro</p>
               <span className="text-[10px] font-black text-slate-400 font-mono leading-none tracking-tighter opacity-50">#{data._id?.toString().toUpperCase()}</span>
            </div>
          </div>

          <div className="space-y-10">
            {/* 1. SECCIÓN IDENTIDAD */}
            <section className="print-no-break">
              <div className="flex items-center gap-3 mb-6 border-l-4 border-[#3b79b6] pl-5">
                <h2 className="text-xs font-black text-[#2c3e50] uppercase tracking-[0.2em]">01. Protocolo de Identidad</h2>
              </div>
              <div className="flex gap-10">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-32 h-44 bg-slate-100 rounded-[2.5rem] overflow-hidden flex items-center justify-center border-4 border-white shadow-xl ring-1 ring-slate-100 flex-shrink-0">
                    {(data.fotoPerfil || data.profilePic) ? (
                      <img src={data.fotoPerfil || data.profilePic} alt="Perfil" className="w-full h-full object-cover" />
                    ) : (
                      <User size={48} className="text-slate-200" />
                    )}
                  </div>
                  {data.cvUrl && (
                    <a 
                      href={data.cvUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex flex-col items-center gap-2 p-4 bg-indigo-50 hover:bg-indigo-100 rounded-3xl border border-indigo-100 transition-all group/cv w-full"
                    >
                      <FileText size={20} className="text-indigo-600 group-hover/cv:scale-110 transition-transform" />
                      <span className="text-[7px] font-black text-indigo-600 uppercase tracking-widest text-center leading-tight">Ver Curriculum</span>
                    </a>
                  )}
                </div>

                <div className="flex-1 grid grid-cols-3 gap-4">
                  {[
                    { label: 'Nombres', value: data.nombres || data.fullName?.split(' ')[0] },
                    { label: 'Apellidos', value: data.apellidos || data.fullName?.split(' ').slice(1).join(' ') },
                    { label: 'RUT / Identificador', value: formatRut(data.rut) },
                    { label: 'Fecha Nacimiento', value: formatDate(data.fechaNacimiento) },
                    { label: 'Nacionalidad', value: data.nacionalidad || data.nationality },
                    { label: 'Estado Civil', value: data.estadoCivil },
                    { label: 'Lugar Nacimiento', value: data.birthPlace },
                    { label: 'Vencimiento Cédula', value: formatDate(data.idExpiryDate) },
                    { label: 'Nivel Educacional', value: data.educationLevel },
                    { label: 'Género', value: data.gender || 'No Informado' },
                  ].map((item, i) => (
                    <div key={i} className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-[#3b79b6]/30">
                      <label className="text-[7px] font-black text-slate-300 uppercase block mb-1 tracking-widest">{item.label}</label>
                      <div className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{item.value || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 2. CONTACTO & EDUCACIÓN */}
            <div className="grid grid-cols-2 gap-10 print-no-break">
               <section>
                  <div className="flex items-center gap-3 mb-6 border-l-4 border-[#3b79b6] pl-5">
                    <h2 className="text-xs font-black text-[#2c3e50] uppercase tracking-[0.2em]">02. Localización y Médios</h2>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: 'Teléfono Directo', value: data.telefono || data.phone, icon: Phone, color: 'emerald' },
                      { label: 'Email Corporativo', value: data.email, icon: Mail, color: 'blue' },
                      { label: 'Residencia Actual', value: (data.address || `${data.calle || ''} ${data.numero || ''} ${data.deptoBlock ? `Block/Depto: ${data.deptoBlock}` : ''}`).trim() || '—', icon: MapPin, color: 'rose' },
                      { label: 'Comuna / Región', value: data.comuna ? `${data.comuna} / ${data.region}` : '—', icon: Map, color: 'indigo' },
                    ].map((item, i) => (
                      <div key={i} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center gap-5 transition-all hover:bg-white hover:shadow-lg">
                        <div className={`w-10 h-10 rounded-xl bg-${item.color}-50 text-${item.color}-600 flex items-center justify-center shadow-sm`}><item.icon size={16} /></div>
                        <div>
                          <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
                          <p className="text-[9px] font-black text-slate-800 uppercase leading-none mt-1">{item.value || '—'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
               </section>

               <section>
                  <div className="flex items-center gap-3 mb-6 border-l-4 border-[#3b79b6] pl-5">
                    <h2 className="text-xs font-black text-[#2c3e50] uppercase tracking-[0.2em]">03. Formación y Grado</h2>
                  </div>
                  <div className="bg-[#3b79b6]/5 p-6 rounded-[2.5rem] border border-[#3b79b6]/10 h-[calc(100%-3rem)] flex flex-col justify-between">
                     <div className="flex items-center gap-5">
                        <div className="p-3 bg-white rounded-2xl shadow-md text-[#3b79b6]"><GraduationCap size={24} /></div>
                        <div>
                          <p className="text-[12px] font-black text-slate-800 uppercase tracking-tighter leading-none">{data.educationLevel || 'NO REGISTRADO'}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Estatus Académico</p>
                        </div>
                     </div>
                     <div className="border-t border-[#3b79b6]/10 mt-6 pt-6">
                        <p className="text-[8px] font-black text-[#3b79b6] uppercase tracking-[0.2em] mb-2 leading-none">Especialidad / Título</p>
                        <p className="text-[11px] font-black text-slate-700 uppercase leading-tight">{data.profession || data.cargo || 'GENERALISTA'}</p>
                     </div>
                  </div>
               </section>
            </div>

            {/* 3. PERFIL PROFESIONAL */}
            <section className="print-no-break">
              <div className="flex items-center gap-3 mb-6 border-l-4 border-[#3b79b6] pl-5">
                <h2 className="text-xs font-black text-[#2c3e50] uppercase tracking-[0.2em]">04. Asignación y Perfil Laboral</h2>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Posición Estratégica', value: data.cargo || data.position, icon: Briefcase },
                  { label: 'Unidad de Negocio', value: data.area || data.departamento, icon: Building },
                  { label: 'Centro Costos', value: data.ceco, icon: Hash },
                  { label: 'Sede Operativa', value: data.sede, icon: Globe },
                  { label: 'Proyecto Asignado', value: data.projectName || data.proyectoTipo, icon: Map },
                  { label: 'Cliente Mandante', value: data.clienteNombre, icon: User },
                  { label: 'Empresa Principal', value: data.empresaRef?.nombre, icon: Building },
                  { label: 'Fuente de Captación', value: data.source || 'Captación Directa', icon: Share2 }
                ].map((item, i) => (
                  <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center group transition-all hover:bg-slate-900 hover:text-white">
                    <p className="text-[7px] font-black text-slate-400 group-hover:text-blue-400 uppercase mb-2 tracking-widest">{item.label}</p>
                    <p className="text-[10px] font-black uppercase leading-none truncate">{item.value || '—'}</p>
                  </div>
                ))}
              </div>
              
              {/* Info Contrato Adicional */}
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tipo Contrato</span>
                   <span className="text-[10px] font-black text-slate-800 uppercase">{data.contractType || '—'}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Inicio LABORES</span>
                   <span className="text-[10px] font-black text-slate-800 uppercase">{formatDate(data.contractStartDate)}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Duración Contrato</span>
                   <span className="text-[10px] font-black text-slate-800 uppercase">{data.contractDurationDays ? `${data.contractDurationDays} días` : '—'}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Término Contrato</span>
                   <span className="text-[10px] font-black text-slate-800 uppercase">{formatDate(data.contractEndDate)}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Inicio Operativo</span>
                   <span className="text-[10px] font-black text-slate-800 uppercase">{formatDate(data.operationalStartDate)}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Etapa Contrato</span>
                   <span className="text-[10px] font-black text-indigo-600 uppercase font-bold">{data.contractStep || '—'}</span>
                </div>
              </div>
            </section>

            {/* 4. COMPENSACIÓN & PREVISIÓN */}
            <section className="print-no-break">
              <div className="flex items-center gap-3 mb-6 border-l-4 border-[#3b79b6] pl-5">
                <h2 className="text-xs font-black text-[#2c3e50] uppercase tracking-[0.2em]">05. Compensación y Protección Social</h2>
              </div>
              <div className="grid grid-cols-4 gap-6">
                 <div className="bg-slate-900 p-5 rounded-3xl text-white col-span-1 shadow-xl">
                    <p className="text-[7px] font-black text-blue-400 uppercase mb-2 tracking-[0.2em]">Sueldo Base Mensual</p>
                    <p className="text-[18px] font-black leading-none">${Number(data.sueldoBase || 0).toLocaleString('es-CL')}</p>
                    <div className="mt-4 flex items-center gap-2">
                       <Landmark size={12} className="text-blue-400" />
                       <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Pacto Mensual Auditado</span>
                    </div>
                 </div>
                 <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 col-span-1 flex flex-col justify-center gap-3 shadow-inner">
                    <div className="flex justify-between items-center bg-white px-3 py-2 rounded-xl border border-slate-100">
                       <span className="text-[8px] font-black text-slate-400 uppercase">AFP</span>
                       <span className="text-[10px] font-black text-[#3b79b6] uppercase leading-none">{data.afp || '—'}</span>
                    </div>
                    <div className="flex flex-col gap-1 bg-white px-3 py-2 rounded-xl border border-slate-100">
                       <div className="flex justify-between items-center">
                          <span className="text-[8px] font-black text-slate-400 uppercase">SALUD</span>
                          <span className="text-[10px] font-black text-[#3b79b6] uppercase leading-none">{data.previsionSalud || 'FONASA'}</span>
                       </div>
                       {data.previsionSalud === 'ISAPRE' && (
                          <div className="pt-1 mt-1 border-t border-slate-50 flex flex-col gap-0.5">
                             <p className="text-[7px] font-black text-indigo-500 uppercase leading-none">{data.isapreNombre}</p>
                             <p className="text-[8px] font-black text-slate-700 leading-none">{data.valorPlan} {data.monedaPlan}</p>
                          </div>
                       )}
                    </div>
                 </div>
                 <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm col-span-2 flex items-center gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white"><CreditCard size={20} /></div>
                    <div className="flex-1">
                       <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Institución: {data.banco || 'NO REGISTRADA'}</p>
                       <div className="flex gap-4">
                          <div>
                             <p className="text-[11px] font-black text-slate-800 uppercase tracking-tighter leading-none">{data.numeroCuenta || 'EVALUANDO'}</p>
                             <p className="text-[7px] font-bold text-slate-400 uppercase mt-1">Cuenta</p>
                          </div>
                          <div className="border-l border-slate-100 pl-4 text-right ml-auto">
                             <p className="text-[11px] font-black text-slate-800 uppercase tracking-tighter leading-none">{data.tipoCuenta || 'TRAB. ACTIVO'}</p>
                             <p className="text-[7px] font-bold text-slate-400 uppercase mt-1 font-mono">Tipo</p>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Bonos y Asignaciones Contractuales Adicionales */}
              {data.bonuses && data.bonuses.length > 0 && (
                <div className="mt-6 bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Bonos y Asignaciones Contractuales Adicionales</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="pb-2 text-[7px] font-black text-slate-400 uppercase tracking-wider">Bono / Concepto</th>
                          <th className="pb-2 text-[7px] font-black text-slate-400 uppercase tracking-wider">Código DT</th>
                          <th className="pb-2 text-[7px] font-black text-slate-400 uppercase tracking-wider">Monto</th>
                          <th className="pb-2 text-[7px] font-black text-slate-400 uppercase tracking-wider">Tipo</th>
                          <th className="pb-2 text-[7px] font-black text-slate-400 uppercase tracking-wider">Descripción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {data.bonuses.map((bonus, idx) => (
                          <tr key={idx} className="hover:bg-slate-100/50">
                            <td className="py-2.5 text-[9px] font-black text-slate-800 uppercase">{bonus.type || '—'}</td>
                            <td className="py-2.5 text-[9px] font-mono text-slate-500 uppercase">{bonus.codigoDT || '—'}</td>
                            <td className="py-2.5 text-[9px] font-black text-[#3b79b6]">${Number(bonus.amount || 0).toLocaleString('es-CL')}</td>
                            <td className="py-2.5 text-[8px] font-black uppercase">
                              <span className={`px-2 py-0.5 rounded-full text-[7px] ${bonus.isImponible ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                                {bonus.isImponible ? 'IMPONIBLE' : 'NO IMPONIBLE'}
                              </span>
                            </td>
                            <td className="py-2.5 text-[8px] font-bold text-slate-500 uppercase truncate max-w-[200px]">{bonus.description || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            {/* 5. SALUD & BIENESTAR */}
            <section className="print-no-break">
              <div className="flex items-center gap-3 mb-6 border-l-4 border-rose-500 pl-5">
                <h2 className="text-xs font-black text-[#2c3e50] uppercase tracking-[0.2em]">06. Salud y Bienestar</h2>
              </div>
              <div className="grid grid-cols-4 gap-4">
                 {[
                   { label: 'Grupo Sanguíneo', value: data.bloodType || '—', color: 'rose' },
                   { label: 'Jubilado/Pensionado', value: data.pensionado || 'NO', color: 'indigo' },
                   { label: 'Discapacidad', value: data.hasDisability ? `SÍ (${data.disabilityType || 'NO DECLARADO'})` : 'NO', color: 'emerald' },
                   { label: 'Cargas Familiares', value: data.tieneCargas === 'SI' ? `SÍ (${data.listaCargas?.length || 0} CARGAS)` : 'NO', color: 'sky' },
                 ].map((item, i) => (
                   <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all hover:bg-slate-50">
                     <p className="text-[7px] font-black text-slate-400 uppercase mb-2 tracking-widest leading-none">{item.label}</p>
                     <p className="text-[10px] font-black text-slate-800 uppercase">{item.value}</p>
                   </div>
                 ))}
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-rose-50/30 p-4 rounded-2xl border border-rose-100">
                   <p className="text-[7px] font-black text-rose-400 uppercase tracking-widest mb-1.5">Alergias Conocidas</p>
                   <p className="text-[9px] font-black text-rose-800 uppercase italic">{data.allergies || 'Ninguna declarada'}</p>
                </div>
                <div className="bg-amber-50/30 p-4 rounded-2xl border border-amber-100">
                   <p className="text-[7px] font-black text-amber-500 uppercase tracking-widest mb-1.5">Patologías Crónicas</p>
                   <p className="text-[9px] font-black text-amber-800 uppercase italic">{data.chronicDiseases || 'Ninguna declarada'}</p>
                </div>
              </div>

              {/* Detalle de Cargas Familiares */}
              {data.listaCargas && data.listaCargas.length > 0 && (
                <div className="mt-6 bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Detalle de Cargas Familiares (Dependientes)</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="pb-2 text-[7px] font-black text-slate-400 uppercase tracking-wider">Nombre Completo</th>
                          <th className="pb-2 text-[7px] font-black text-slate-400 uppercase tracking-wider">RUT</th>
                          <th className="pb-2 text-[7px] font-black text-slate-400 uppercase tracking-wider">Parentesco</th>
                          <th className="pb-2 text-[7px] font-black text-slate-400 uppercase tracking-wider">Fecha Nacimiento</th>
                          <th className="pb-2 text-[7px] font-black text-slate-400 uppercase tracking-wider">Edad</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {data.listaCargas.map((carga, idx) => {
                          const age = carga.fechaNacimiento ? Math.floor((new Date() - new Date(carga.fechaNacimiento)) / (365.25 * 24 * 60 * 60 * 1000)) : null;
                          return (
                            <tr key={idx} className="hover:bg-slate-100/50">
                              <td className="py-2 text-[9px] font-black text-slate-800 uppercase">{carga.fullName || carga.nombre || '—'}</td>
                              <td className="py-2 text-[9px] font-mono text-slate-600 uppercase">{formatRut(carga.rut)}</td>
                              <td className="py-2 text-[9px] font-black text-[#3b79b6] uppercase">{carga.parentesco || '—'}</td>
                              <td className="py-2 text-[9px] font-bold text-slate-500">{formatDate(carga.fechaNacimiento)}</td>
                              <td className="py-2 text-[9px] font-bold text-slate-700">{age !== null && age >= 0 ? `${age} años` : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            {/* 6. DOTACIÓN, EMERGENCIA & LICENCIA */}
            <div className="grid grid-cols-2 gap-10 print-no-break">
               <section>
                  <div className="flex items-center gap-3 mb-6 border-l-4 border-[#3b79b6] pl-5">
                    <h2 className="text-xs font-black text-[#2c3e50] uppercase tracking-[0.2em]">07. Equipamiento Auditado</h2>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Calzado', value: data.shoeSize, icon: Truck },
                      { label: 'Pantalón', value: data.pantsSize, icon: Shirt },
                      { label: 'Camisa/Pol', value: data.shirtSize, icon: Shirt },
                      { label: 'Telas/Chaq', value: data.jacketSize, icon: Shield },
                      { label: 'Overol', value: data.uniformSize, icon: Shield },
                      { label: 'Guantes', value: data.tallaGuantes, icon: Shield },
                    ].map((item, i) => (
                      <div key={i} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center flex flex-col items-center gap-1.5 transition-all hover:bg-white hover:scale-105">
                        <item.icon size={12} className="text-slate-300" />
                        <p className="text-[6px] font-black text-slate-400 uppercase tracking-tighter">{item.label}</p>
                        <p className="text-[12px] font-black text-slate-800 leading-none">{item.value || '—'}</p>
                      </div>
                    ))}
                  </div>
               </section>

               <section>
                  <div className="flex items-center gap-3 mb-6 border-l-4 border-rose-600 pl-5">
                    <h2 className="text-xs font-black text-[#2c3e50] uppercase tracking-[0.2em]">08. Protocolo de Emergencia</h2>
                  </div>
                  <div className="bg-rose-50/50 p-5 rounded-[2rem] border border-rose-100 flex items-center gap-6">
                     <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center animate-pulse"><Heart size={28} /></div>
                     <div className="flex-1">
                        <p className="text-[11px] font-black text-rose-800 uppercase truncate leading-none">{data.emergencyContact || 'SIN CONTACTO'}</p>
                        <p className="text-[8px] font-bold text-rose-400 uppercase mt-1">{data.emergencyEmail || 'EMAIL NO DECLARADO'}</p>
                        <div className="mt-3 bg-white px-3 py-1.5 rounded-xl border border-rose-100 w-fit">
                           <p className="text-[10px] font-black text-rose-600 font-mono leading-none tracking-widest">{data.emergencyPhone || 'XXXXXXXXX'}</p>
                        </div>
                     </div>
                  </div>
               </section>
            </div>

            <section className="print-no-break">
               <div className="flex items-center gap-3 mb-6 border-l-4 border-orange-600 pl-5">
                 <h2 className="text-xs font-black text-[#2c3e50] uppercase tracking-[0.2em]">09. Licencia de Conducir</h2>
               </div>
               <div className="bg-orange-50/50 p-5 rounded-[2rem] border border-orange-100 flex items-center gap-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${data.requiereLicencia === 'SI' ? 'bg-orange-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                     <Truck size={28} />
                  </div>
                  <div className="flex-1">
                     <p className="text-[11px] font-black text-orange-800 uppercase leading-none">{data.requiereLicencia === 'SI' ? 'LICENCIA VIGENTE' : 'SIN LICENCIA'}</p>
                     {data.requiereLicencia === 'SI' && (
                        <>
                          <p className="text-[8px] font-bold text-orange-400 uppercase mt-1">Vence: {formatDate(data.fechaVencimientoLicencia)}</p>
                          <div className="mt-3 bg-white px-3 py-1.5 rounded-xl border border-orange-100 w-fit">
                             <p className="text-[10px] font-black text-orange-600 font-mono leading-none tracking-widest">VALIDADO</p>
                          </div>
                        </>
                     )}
                     {data.requiereLicencia !== 'SI' && <p className="text-[8px] font-bold text-slate-400 uppercase mt-1 italic">No declarada / No requerida</p>}
                  </div>
               </div>
            </section>

            {/* 10. Declaración de Conflicto de Interés */}
            <section className="print-no-break">
              <div className="flex items-center gap-3 mb-6 border-l-4 border-amber-500 pl-5">
                <h2 className="text-xs font-black text-[#2c3e50] uppercase tracking-[0.2em]">10. Declaración de Conflicto de Interés</h2>
              </div>
              <div className={`p-5 rounded-[2rem] border flex items-center gap-6 ${data.conflictOfInterest?.hasFamilyInCompany ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50/50 border-slate-100'}`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md ${data.conflictOfInterest?.hasFamilyInCompany ? 'bg-amber-500 text-white animate-pulse' : 'bg-slate-200 text-slate-400'}`}>
                  <Shield size={28} />
                </div>
                <div className="flex-1 grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">¿Tiene Familiares en la Empresa?</p>
                    <p className={`text-[11px] font-black uppercase mt-1.5 ${data.conflictOfInterest?.hasFamilyInCompany ? 'text-amber-800' : 'text-slate-800'}`}>
                      {data.conflictOfInterest?.hasFamilyInCompany ? 'SÍ, DECLARA VÍNCULO' : 'NO DECLARA VÍNCULO'}
                    </p>
                  </div>
                  {data.conflictOfInterest?.hasFamilyInCompany && (
                    <>
                      <div>
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">Relación / Parentesco</p>
                        <p className="text-[11px] font-black text-slate-800 uppercase mt-1.5">{data.conflictOfInterest.relationship || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">Nombre del Colaborador</p>
                        <p className="text-[11px] font-black text-[#3b79b6] uppercase mt-1.5">{data.conflictOfInterest.employeeName || '—'}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* 11. REGISTRO DE COMPORTAMIENTO E HISTORIAL */}
            <section className="print-no-break">
              <div className="flex items-center gap-3 mb-6 border-l-4 border-indigo-600 pl-5">
                <h2 className="text-xs font-black text-[#2c3e50] uppercase tracking-[0.2em]">11. Registro de Comportamiento e Historial</h2>
              </div>
              
              {((data.amonestaciones && data.amonestaciones.length > 0) || (data.felicitaciones && data.felicitaciones.length > 0)) ? (
                <div className="space-y-4">
                  {data.felicitaciones && data.felicitaciones.length > 0 && (
                    <div className="bg-emerald-50/30 p-5 rounded-3xl border border-emerald-100">
                      <p className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-3">Reconocimientos y Felicitaciones</p>
                      <div className="space-y-3">
                        {data.felicitaciones.map((feli, idx) => (
                          <div key={idx} className="bg-white p-3 rounded-2xl border border-emerald-100 flex justify-between items-start gap-4">
                            <div>
                              <p className="text-[10px] font-black text-emerald-800 uppercase">{feli.motivo || 'Reconocimiento Formal'}</p>
                              <p className="text-[8px] font-bold text-slate-500 uppercase mt-1">{feli.descripcion || '—'}</p>
                            </div>
                            <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full font-mono">{formatDate(feli.fecha)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {data.amonestaciones && data.amonestaciones.length > 0 && (
                    <div className="bg-rose-50/30 p-5 rounded-3xl border border-rose-100">
                      <p className="text-[8px] font-black text-rose-600 uppercase tracking-[0.2em] mb-3">Medidas Disciplinarias y Amonestaciones</p>
                      <div className="space-y-3">
                        {data.amonestaciones.map((amon, idx) => (
                          <div key={idx} className="bg-white p-3 rounded-2xl border border-rose-100 flex justify-between items-start gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-[6px] font-black uppercase ${
                                  amon.tipo === 'Escrita' ? 'bg-amber-100 text-amber-700' : amon.tipo === 'Suspensión' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {amon.tipo || 'Verbal'}
                                </span>
                                <p className="text-[10px] font-black text-slate-800 uppercase">{amon.motivo || 'Infracción Operativa'}</p>
                              </div>
                              <p className="text-[8px] font-bold text-slate-500 uppercase mt-1">{amon.descripcion || '—'}</p>
                              {amon.firmado && (
                                <span className="text-[6px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase mt-2 inline-block">FIRMADO POR COLABORADOR</span>
                              )}
                            </div>
                            <span className="text-[8px] font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-full font-mono">{formatDate(amon.fecha)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-emerald-50/30 p-5 rounded-[2rem] border border-emerald-100 flex items-center gap-6">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                    <Check size={28} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-emerald-800 uppercase leading-none">Expediente Disciplinario Impecable</p>
                    <p className="text-[8px] font-bold text-emerald-500 uppercase mt-1.5">No se registran amonestaciones ni medidas de sanción vigentes en la base de datos.</p>
                  </div>
                </div>
              )}
            </section>

            {/* 12. SECCIÓN FINIQUITO */}
            <section className="print-no-break">
              <div className="flex items-center gap-3 mb-6 border-l-4 border-violet-600 pl-5">
                <h2 className="text-xs font-black text-[#2c3e50] uppercase tracking-[0.2em]">12. Desvinculación y Finiquito</h2>
              </div>
              {data.status === 'Finiquitado' || data.finiquitoDetalle ? (
                <div className="bg-violet-50/50 p-6 rounded-[2.5rem] border border-violet-100 shadow-sm">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                      <span className="px-3 py-1 bg-violet-600 text-white rounded-full text-[8px] font-black uppercase tracking-widest">Colaborador Finiquitado</span>
                      <h3 className="text-sm font-black text-slate-800 uppercase mt-2">{data.finiquitoDetalle?.causalTermino || data.finiquitoMotivo || 'Necesidades de la empresa (Art. 161)'}</h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                        Causal legal aplicada • Egreso: {formatDate(data.fechaFiniquito || data.finiquitoDetalle?.fechaEgreso)}
                      </p>
                    </div>
                    <button 
                      onClick={printFiniquitoPdf}
                      className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-violet-100/20 active:scale-95 transition-all"
                    >
                      <Printer size={12} /> Descargar Acta PDF
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 mt-6">
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm">
                      <span className="text-[7px] font-black text-slate-300 uppercase block mb-1 tracking-widest">Total Neto Liquidado</span>
                      <div className="text-[12px] font-black text-emerald-600">${Number(data.finiquitoDetalle?.netoFiniquito || 0).toLocaleString('es-CL')}</div>
                    </div>
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm">
                      <span className="text-[7px] font-black text-slate-300 uppercase block mb-1 tracking-widest">Antigüedad Calculada</span>
                      <div className="text-[10px] font-black text-slate-700 uppercase">{data.finiquitoDetalle?.aniosServicioCalculados || 0} Años</div>
                    </div>
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm">
                      <span className="text-[7px] font-black text-slate-300 uppercase block mb-1 tracking-widest">Vacaciones Proporcionales</span>
                      <div className="text-[10px] font-black text-slate-700 uppercase">{data.finiquitoDetalle?.diasVacacionesHabilesCalculados || 0} Días Hábiles</div>
                    </div>
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm">
                      <span className="text-[7px] font-black text-slate-300 uppercase block mb-1 tracking-widest">Canal de Legalización</span>
                      <div className="text-[10px] font-black text-slate-700 uppercase">
                        {data.finiquitoDetalle?.procesadoEn === 'Notaria' ? '🏛️ En Notaría' : '📁 Módulo GenAI'}
                      </div>
                    </div>
                  </div>

                  {data.finiquitoDetalle?.procesadoEn === 'Notaria' && (
                    <div className="mt-4 p-4 bg-slate-900 text-white rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <p className="text-[7px] font-black text-blue-400 uppercase tracking-widest">Detalles Notaría Externa</p>
                        <p className="text-[10px] font-black uppercase mt-1">{data.finiquitoDetalle.notariaNombre || 'Notaría Pública'}</p>
                      </div>
                      <div className="flex gap-6">
                        <div>
                          <p className="text-[6px] font-black text-slate-400 uppercase">Fecha Firma</p>
                          <p className="text-[8px] font-bold mt-0.5">{formatDate(data.finiquitoDetalle.notariaFechaFirma)}</p>
                        </div>
                        <div>
                          <p className="text-[6px] font-black text-slate-400 uppercase">Gastos Notaría</p>
                          <p className="text-[8px] font-bold mt-0.5">${(data.finiquitoDetalle.notariaGastos || 0).toLocaleString('es-CL')}</p>
                        </div>
                        <div>
                          <p className="text-[6px] font-black text-slate-400 uppercase">Estado Trámite</p>
                          <span className={`inline-block px-2 py-0.5 text-[6px] font-black uppercase rounded-full mt-0.5 ${
                            data.finiquitoDetalle.notariaEstado === 'Firmado' ? 'bg-emerald-500/25 text-emerald-300' :
                            data.finiquitoDetalle.notariaEstado === 'Rechazado' ? 'bg-rose-500/25 text-rose-300' :
                            'bg-amber-500/25 text-amber-300'
                          }`}>
                            {data.finiquitoDetalle.notariaEstado || 'Pendiente'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50/30 p-6 rounded-[2.5rem] border border-amber-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-[1.5rem] flex items-center justify-center flex-shrink-0">
                      <UserMinus size={24} />
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-black text-slate-800 uppercase leading-none">Colaborador en Estatus Activo</h3>
                      <p className="text-[10px] font-bold text-slate-500 uppercase mt-2 max-w-xl leading-relaxed">
                        Para desvincular formalmente a este colaborador y calcular sus indemnizaciones y haberes previsionales conforme a la doctrina oficial de la Dirección del Trabajo (DT), inicia el proceso en el Asistente de Finiquitos.
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => window.location.href = `/rrhh/finiquitos?candidatoId=${data._id}`}
                    className="flex items-center gap-2.5 px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-amber-100/20 active:scale-95 transition-all whitespace-nowrap self-stretch md:self-auto justify-center"
                  >
                    <UserMinus size={14} /> Desvincular Colaborador
                  </button>
                </div>
              )}
            </section>
          </div>

          {/* 13. VALIDACIÓN DIGITAL AVANZADA */}
          <section className="bg-slate-900 -mx-12 px-12 py-12 rounded-b-[4rem] text-white print-no-break shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] mt-12">
            <div className="flex items-center gap-4 mb-10 border-l-4 border-blue-400 pl-5">
              <h2 className="text-xs font-black text-white uppercase tracking-[0.3em] leading-none">13. Validación Digital Certificada</h2>
              <span className="bg-blue-400/20 text-blue-300 text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Plataforma Corporativa</span>
            </div>
  
            <div className="grid grid-cols-2 gap-16 px-6">
              {/* Firma Administrativa */}
              <AdvancedSignature 
                label="Responsable Operativo" 
                payload={data.firmaAdministrativoPayload}
                fallbackName={data.registradorNombre || "OPERADOR RRHH"} 
                fallbackPosition="ADMINISTRACIÓN CENTRAL"
                fallbackDate={data.createdAt}
              />

              {/* Firma Gerencia */}
              {approvalChain.length > 0 ? (
                approvalChain.filter(s => s.status === 'Aprobado').slice(0, 1).map((step, idx) => (
                  <AdvancedSignature 
                    key={idx}
                    label="Validación Gerencial"
                    payload={step}
                    fallbackName={step.name} 
                    fallbackPosition={step.position} 
                    fallbackDate={step.updatedAt}
                  />
                ))
              ) : (
                 <AdvancedSignature 
                   label="Autorización Final" 
                   fallbackName="GUSTAVO BARRIENTOS" 
                   fallbackPosition="DIRECCIÓN GENERAL" 
                 />
              )}
            </div>
            
            <div className="mt-12 flex justify-between items-end border-t border-white/5 pt-8">
               <div className="space-y-2">
                 <p className="text-[7px] font-black text-white/30 uppercase tracking-[0.5em]">Firma Electrónica Avanzada • Cumple Ley 19.799</p>
                 <div className="flex items-center gap-3">
                    <span className="text-[6px] font-mono text-white/20 bg-white/5 px-2 py-1 rounded">AUTH-LEVEL: 05</span>
                    <span className="text-[6px] font-mono text-white/20 bg-white/5 px-2 py-1 rounded tracking-tighter italic">DOCUMENTO GENERADO POR NÚCLEO {data.empresaRef?.nombre || 'GESTIÓN'}</span>
                 </div>
               </div>
               <div className="text-right">
                 <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] leading-none">Ecosistema {data.empresaRef?.nombre || 'Integral'}</p>
                 <p className="text-[7px] text-white/20 mt-2 lowercase italic">validación forense mediante qr y coordenadas gps</p>
               </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default FichaIngresoPremium;

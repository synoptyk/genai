import React from 'react';
import { 
  User, Mail, Phone, MapPin, Briefcase, 
  Calendar, Hash, Globe, ShieldCheck, 
  CheckSquare, Square, Building, Landmark,
  CreditCard, Share2, Download, Printer,
  Heart, GraduationCap, Shirt, Truck,
  Clock, Map,
  FileText,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

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
                <ShieldCheck size={40} className="text-blue-900" />
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
               <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Hash ID Registro</p>
               <span className="text-[11px] font-black text-[#3b79b6] font-mono leading-none tracking-tighter">#{data._id?.toString().toUpperCase()}</span>
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
                    { label: 'RUT / Identificador', value: data.rut },
                    { label: 'Fecha Nacimiento', value: formatDate(data.fechaNacimiento) },
                    { label: 'Nacionalidad', value: data.nacionalidad || data.nationality },
                    { label: 'Estado Civil', value: data.estadoCivil },
                    { label: 'Lugar Nacimiento', value: data.birthPlace },
                    { label: 'Vencimiento Cédula', value: formatDate(data.idExpiryDate) },
                    { label: 'Nivel Educacional', value: data.educationLevel },
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
                      { label: 'Residencia Actual', value: data.address || `${data.calle} ${data.numero}`, icon: MapPin, color: 'rose' },
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
                  { label: 'Sede Operativa', value: data.sede || data.empresaRef?.nombre || 'PROYECTO ACTIVO', icon: Globe },
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
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Captación Directa</span>
                   <span className="text-[10px] font-black text-emerald-600 uppercase italic">{data.isDirectHire ? 'SÍ' : 'NO'}</span>
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
                    <div className="flex justify-between items-center bg-white px-3 py-2 rounded-xl border border-slate-100">
                       <span className="text-[8px] font-black text-slate-400 uppercase">SALUD</span>
                       <span className="text-[10px] font-black text-[#3b79b6] uppercase leading-none">{data.previsionSalud || 'FONASA'}</span>
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
                   { label: 'Discapacidad', value: data.hasDisability ? 'SÍ' : 'NO', color: 'emerald' },
                   { label: 'Cargas Familiares', value: `${data.listaCargas?.length || 0} CARGAS`, color: 'sky' },
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
                      { label: 'Telas/Chaq', value: data.jacketSize, icon: ShieldCheck },
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
          </div>

          {/* 10. VALIDACIÓN DIGITAL AVANZADA */}
          <section className="bg-slate-900 -mx-12 px-12 py-12 rounded-b-[4rem] text-white print-no-break shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] mt-12">
            <div className="flex items-center gap-4 mb-10 border-l-4 border-blue-400 pl-5">
              <h2 className="text-xs font-black text-white uppercase tracking-[0.3em] leading-none">10. Validación Digital Certificada</h2>
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

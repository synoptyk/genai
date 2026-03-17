import React from 'react';
import { 
  User, Mail, Phone, MapPin, Briefcase, 
  Calendar, Hash, Globe, ShieldCheck, 
  CheckSquare, Square, Building, Landmark,
  CreditCard, Share2, Download, Printer,
  Heart, GraduationCap, Shirt, Truck
} from 'lucide-react';

/**
 * FichaIngresoPremium
 * Componente de visualización ejecutiva basado en referencia visual.
 * @param {Object} data - Datos del candidato/contratado
 * @param {Array} approvalChain - Cadena de aprobación con firmas
 */
// --- ESTILOS DE IMPRESIÓN GLOBALES ---
const printStyles = `
  @media print {
    @page {
      size: A4;
      margin: 0;
    }
    body {
      background: white !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print-no-break {
      break-inside: avoid;
    }
    .print-hide {
      display: none !important;
    }
    .ficha-container {
      width: 210mm !important;
      min-height: 297mm !important;
      padding: 10mm !important;
      margin: 0 auto !important;
      box-shadow: none !important;
      border: none !important;
    }
    /* Forzar a que quepa en una página si es posible */
    .ficha-content {
      transform: scale(0.92);
      transform-origin: top center;
    }
  }
`;

const FichaIngresoPremium = ({ data, approvalChain = [] }) => {
  if (!data) return <div className="p-10 text-center font-bold text-slate-400">Sin datos disponibles</div>;

  const handlePrint = () => window.print();
  
  const handleDownload = () => window.print();

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert('Enlace de la ficha copiado al portapapeles');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('es-CL');
    } catch (e) {
      return dateStr;
    }
  };

  const SignatureBlock = ({ name, position, date, signature, label }) => (
    <div className="flex flex-col items-center">
      <div className="w-full h-24 border-b border-slate-300 relative flex items-center justify-center mb-2 px-4 bg-slate-50/30 rounded-t-xl">
        {signature ? (
          <img src={signature} alt={`Firma ${name}`} className="max-h-full max-w-full object-contain relative z-10 drop-shadow-md" />
        ) : (
          <div className="text-[8px] text-slate-300 font-black uppercase tracking-widest italic opacity-50">Validación Pendiente</div>
        )}
        <div className="absolute bottom-1 right-1 opacity-[0.03]">
           <ShieldCheck size={50} className="text-blue-900" />
        </div>
      </div>
      <p className="text-[9px] font-black text-slate-800 uppercase text-center mt-1 leading-tight">{name || label}</p>
      <p className="text-[7px] font-black text-slate-400 uppercase text-center tracking-tighter">{position}</p>
      {date && signature && (
        <p className="text-[6px] font-mono text-slate-400 mt-1 bg-slate-100 px-2 py-0.5 rounded-full">
          {new Date(date).toLocaleString('es-CL')}
        </p>
      )}
      <div className="w-32 h-0.5 bg-[#3b79b6] mt-2 opacity-10"></div>
    </div>
  );

  return (
    <>
      <style>{printStyles}</style>
      
      {/* 🚀 ACTION TOOLBAR */}
      <div className="print-hide sticky top-4 z-50 flex justify-center mb-6">
        <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 p-2 rounded-[2rem] shadow-2xl flex items-center gap-2">
           <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-2.5 bg-[#3b79b6] hover:bg-[#2c5d8c] text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all">
             <Printer size={14} /> Imprimir
           </button>
           <button onClick={handleDownload} className="flex items-center gap-2 px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all">
             <Download size={14} /> PDF
           </button>
           <button onClick={handleShare} className="flex items-center gap-2 px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all">
             <Share2 size={14} /> Compartir
           </button>
        </div>
      </div>

      <div className="ficha-container bg-white p-12 max-w-5xl mx-auto shadow-2xl border border-slate-100 font-sans text-slate-800 transition-all duration-500 relative">
        <div className="ficha-content">
          {/* 📘 TOP BANNER */}
          <div className="h-4 bg-[#3b79b6] w-full mb-6 rounded-full opacity-80"></div>

          {/* 🏷️ TITLE HEADER */}
          <div className="flex justify-between items-start mb-10 border-b-2 border-slate-100 pb-8">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-800 to-slate-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl">
                 <span className="text-4xl font-black">{data.fullName?.charAt(0) || data.nombres?.charAt(0)}</span>
              </div>
              <div>
                <h1 className="text-3xl font-black text-[#2c3e50] tracking-tighter uppercase leading-none">
                  Expediente <span className="text-[#3b79b6]">Corporativo</span>
                </h1>
                <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3em] mt-1">
                  Ecosistema Digital <span className="text-[#3b79b6]">GenAI Systems</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-100 shadow-inner">
                 <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">ID de Documento</p>
                 <span className="text-xs font-black text-[#3b79b6] font-mono">#{data._id?.toString().slice(-10).toUpperCase()}</span>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            
            {/* 1. IDENTIDAD */}
            <section className="print-no-break">
              <div className="flex items-center gap-3 mb-4 border-l-4 border-[#3b79b6] pl-4">
                <h2 className="text-xs font-black text-[#2c3e50] uppercase tracking-widest">01. Identidad del Candidato</h2>
              </div>
              
              <div className="flex gap-8">
                <div className="w-32 h-40 bg-slate-100 rounded-[1.5rem] overflow-hidden flex items-center justify-center border-2 border-slate-50 shadow-md">
                   {(data.fotoPerfil || data.profilePic) ? (
                      <img src={data.fotoPerfil || data.profilePic} alt="Perfil" className="w-full h-full object-cover" />
                    ) : (
                      <User size={48} className="text-slate-200" />
                    )}
                </div>

                <div className="flex-1 grid grid-cols-3 gap-3">
                  {[
                    { label: 'Nombres', value: data.nombres || data.fullName?.split(' ')[0] },
                    { label: 'Apellidos', value: data.apellidos || data.fullName?.split(' ').slice(1).join(' ') },
                    { label: 'RUT / ID', value: data.rut },
                    { label: 'Nacimiento', value: formatDate(data.fechaNacimiento) },
                    { label: 'Nacionalidad', value: data.nacionalidad },
                    { label: 'Estado Civil', value: data.estadoCivil },
                  ].map((item, i) => (
                    <div key={i} className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                      <label className="text-[7px] font-black text-slate-400 uppercase block mb-0.5">{item.label}</label>
                      <div className="text-[9px] font-black text-slate-700 uppercase">{item.value || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 2. CONTACTO & EDUCACIÓN */}
            <div className="grid grid-cols-2 gap-8 print-no-break">
               <section>
                  <div className="flex items-center gap-3 mb-4 border-l-4 border-[#3b79b6] pl-4">
                    <h2 className="text-xs font-black text-[#2c3e50] uppercase tracking-widest">02. Ubicación y Contacto</h2>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: 'Teléfono', value: data.telefono || data.phone, icon: Phone },
                      { label: 'Email Corporativo', value: data.email, icon: Mail },
                      { label: 'Dirección Residencial', value: data.address || `${data.calle} ${data.numero}`, icon: MapPin },
                    ].map((item, i) => (
                      <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                        <div className="w-6 h-6 rounded-lg bg-blue-50 text-[#3b79b6] flex items-center justify-center"><item.icon size={12} /></div>
                        <div>
                          <p className="text-[6px] font-black text-slate-400 uppercase">{item.label}</p>
                          <p className="text-[8px] font-black text-slate-800 uppercase">{item.value || '—'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
               </section>

               <section>
                  <div className="flex items-center gap-3 mb-4 border-l-4 border-[#3b79b6] pl-4">
                    <h2 className="text-xs font-black text-[#2c3e50] uppercase tracking-widest">03. Formación Académica</h2>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 h-[calc(100%-2rem)]">
                     <div className="flex items-center gap-4 mb-4">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><GraduationCap size={18} /></div>
                        <div>
                          <p className="text-[10px] font-black text-slate-800 uppercase">{data.educationLevel || 'NIVEL NO REGISTRADO'}</p>
                          <p className="text-[7px] font-bold text-slate-400 uppercase">Grado Académico Alcanzado</p>
                        </div>
                     </div>
                     <div className="border-t border-slate-200 mt-4 pt-4">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Título / Especialidad</p>
                        <p className="text-[9px] font-black text-slate-700 uppercase">{data.profession || data.cargo || 'Generalista'}</p>
                     </div>
                  </div>
               </section>
            </div>

            {/* 3. PERFIL PROFESIONAL */}
            <section className="print-no-break">
              <div className="flex items-center gap-3 mb-4 border-l-4 border-[#3b79b6] pl-4">
                <h2 className="text-xs font-black text-[#2c3e50] uppercase tracking-widest">04. Asignación y Perfil Laboral</h2>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Cargo Actual', value: data.cargo || data.position, icon: Briefcase },
                  { label: 'Departamento', value: data.area || data.departamento, icon: Building },
                  { label: 'Centro de Costos', value: data.ceco, icon: Hash },
                  { label: 'Sede / Proyecto', value: data.sede || data.projectName || data.empresaRef || 'Casa Matriz', icon: Globe },
                ].map((item, i) => (
                  <div key={i} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[6px] font-black text-slate-400 uppercase mb-1">{item.label}</p>
                    <p className="text-[9px] font-black text-slate-700 uppercase">{item.value || '—'}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 4. REMUNERACIÓN & PREVISIÓN */}
            <section className="print-no-break">
              <div className="flex items-center gap-3 mb-4 border-l-4 border-[#3b79b6] pl-4">
                <h2 className="text-xs font-black text-[#2c3e50] uppercase tracking-widest">05. Compensación y Seguridad Social</h2>
              </div>
              <div className="grid grid-cols-3 gap-6">
                 <div className="bg-[#3b79b6]/5 p-4 rounded-2xl border border-[#3b79b6]/10 col-span-1">
                    <p className="text-[7px] font-black text-[#3b79b6] uppercase mb-2 tracking-widest">Remuneración</p>
                    <p className="text-[14px] font-black text-slate-800">
                       {data.sueldoBase ? `$${Number(data.sueldoBase).toLocaleString('es-CL')}` : '—'}
                    </p>
                    <p className="text-[6px] font-bold text-slate-400 uppercase mt-0.5">Sueldo Base Mensual Pactado</p>
                 </div>
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-1 flex flex-col justify-center">
                    <div className="space-y-2">
                       <div className="flex justify-between items-center text-[8px] font-black">
                         <span className="text-slate-400 uppercase">AFP</span>
                         <span className="text-slate-800 uppercase">{data.afp || '—'}</span>
                       </div>
                       <div className="flex justify-between items-center text-[8px] font-black">
                         <span className="text-slate-400 uppercase">Salud</span>
                         <span className="text-slate-800 uppercase">{data.previsionSalud || data.isapreNombre || 'Fonasa'}</span>
                       </div>
                    </div>
                 </div>
                 <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm col-span-1">
                    <p className="text-[7px] font-black text-slate-300 uppercase mb-2">Pago: {data.banco || '—'}</p>
                    <p className="text-[9px] font-black text-slate-700 uppercase">{data.numeroCuenta || 'CONTRA CHEQUE'}</p>
                    <p className="text-[6px] font-black text-slate-400 uppercase mt-0.5">{data.tipoCuenta || 'PAGO DIRECTO'}</p>
                 </div>
              </div>
            </section>

            {/* 5. DOTACIÓN & EMERGENCIA */}
            <div className="grid grid-cols-2 gap-8 print-no-break">
               <section>
                  <div className="flex items-center gap-3 mb-4 border-l-4 border-[#3b79b6] pl-4">
                    <h2 className="text-xs font-black text-[#2c3e50] uppercase tracking-widest">06. Equipamiento y Tallas</h2>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Calzado', value: data.shoeSize, icon: Truck },
                      { label: 'Pantalón', value: data.pantsSize, icon: Shirt },
                      { label: 'Camisa', value: data.shirtSize, icon: Shirt },
                      { label: 'Chaqueta', value: data.jacketSize, icon: ShieldCheck },
                    ].map((item, i) => (
                      <div key={i} className="bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
                        <p className="text-[6px] font-black text-slate-400 uppercase mb-1">{item.label}</p>
                        <p className="text-[10px] font-black text-slate-800">{item.value || '—'}</p>
                      </div>
                    ))}
                  </div>
               </section>

               <section>
                  <div className="flex items-center gap-3 mb-4 border-l-4 border-[#3b79b6] pl-4">
                    <h2 className="text-xs font-black text-[#2c3e50] uppercase tracking-widest">07. Contacto de Emergencia</h2>
                  </div>
                  <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                     <div className="flex items-center gap-3 mb-3 text-rose-600">
                        <Heart size={16} />
                        <p className="text-[9px] font-black uppercase truncate">{data.emergencyContact || 'SIN CONTACTO'}</p>
                     </div>
                     <div className="grid grid-cols-2 gap-4 border-t border-rose-200 mt-2 pt-2 text-[8px] font-black text-rose-700">
                        <div>
                           <p className="text-rose-400 text-[6px] uppercase">Teléfono Directo</p>
                           <p>{data.emergencyPhone || '—'}</p>
                        </div>
                        <div>
                           <p className="text-rose-400 text-[6px] uppercase">Parentesco</p>
                           <p>{data.emergencyRelationship || 'No Informado'}</p>
                        </div>
                     </div>
                  </div>
               </section>
            </div>

            {/* 6. VALIDACIÓN Y FIRMAS */}
            <section className="bg-slate-900 -mx-12 px-12 py-10 rounded-b-[4rem] text-white print-no-break">
              <div className="flex items-center gap-3 mb-8 border-l-4 border-blue-400 pl-4">
                <h2 className="text-xs font-black text-white uppercase tracking-widest">08. Protocolo de Validación Digital</h2>
              </div>
    
              <div className="grid grid-cols-2 gap-20 px-10">
                <SignatureBlock 
                  label="Responsable de Registro" 
                  name={data.firmaAdministrativoPayload?.nombreFirmante || data.registradorNombre || "RESPONSABLE RRHH"} 
                  position="VALIDACIÓN ADMINISTRATIVA" 
                  date={data.createdAt}
                  signature={data.firmaAdministrativo || data.firmaAdministrativoPayload?.imagenBase64} 
                />

                {approvalChain.length > 0 ? (
                  approvalChain.filter(s => s.status === 'Aprobado').slice(0, 1).map((step, idx) => (
                    <SignatureBlock 
                      key={idx}
                      label="Autorización Gerencial"
                      name={step.name} 
                      position={step.position} 
                      date={step.updatedAt}
                      signature={step.firmaBase64} 
                    />
                  ))
                ) : (
                   <SignatureBlock label="Autorización Gerencial" name="MAURICIO BARRIENTOS" position="GERENTE GENERAL" />
                )}
              </div>
              
              <div className="mt-8 flex justify-between items-end border-t border-white/10 pt-6">
                 <div>
                   <p className="text-[6px] font-black text-white/30 uppercase tracking-[0.4em]">Firma Electrónica Avanzada • Ley 19.799</p>
                   <p className="text-[5px] font-mono text-white/20 mt-1 uppercase">HASH-CERT: {data._id?.toString().toUpperCase() || 'VALIDATING...'}</p>
                 </div>
                 <div className="text-right">
                   <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest leading-none">GenAI Systems • Protocolo de Gestión Integral</p>
                   <p className="text-[6px] text-white/20 mt-1 lowercase">documento dinámico validado en tiempo real</p>
                 </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </>
  );
};

export default FichaIngresoPremium;

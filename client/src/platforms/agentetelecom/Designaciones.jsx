import React, { useState, useEffect } from 'react';
import telecomApi from './telecomApi';
import * as XLSX from 'xlsx';
import {
   ShieldCheck, UserCog, AlertCircle, CheckCircle2,
   Smartphone, Briefcase, Key, Save, Search,
   LayoutList, Fingerprint, Zap, Mail, Building,
   Car, UserCheck, MapPin, BadgeCheck, Download,
   ExternalLink, Info
} from 'lucide-react';

const Designaciones = () => {
   // --- ESTADOS ---
   const [personal, setPersonal] = useState([]);
   const [pendientes, setPendientes] = useState([]);
   const [loading, setLoading] = useState(true);
   const [filtro, setFiltro] = useState('');

   // Estado para el Modal de Habilitación
   const [selectedUser, setSelectedUser] = useState(null);
   const [form, setForm] = useState({
      cargo: '',          
      area: '',           
      proyecto: '',       
      mandante: '',       
      region: '',         
      sede: '',           // <--- NUEVO
      telefono: '',       
      email: '',          
      usuarioToa: '',     
      claveToa: '',
      idRecursoToa: '',   
      supervisor: '',     
      patente: '',        
      marcaVehiculo: '',  
      modeloVehiculo: ''  
   });

   // --- CARGA DE DATOS ---
   const fetchData = async () => {
      setLoading(true);
      try {
         const res = await telecomApi.get('/tecnicos');
         const todos = res.data;

         // FILTRO INTELIGENTE: ¿Quiénes faltan por designar?
         const listaPendiente = todos.filter(p =>
            !p.cargo || !p.area || !p.proyecto || !p.mandantePrincipal || !p.region ||
            !p.telefono || !p.email || !p.usuarioToa || !p.idRecursoToa
         );

         setPersonal(todos);
         setPendientes(listaPendiente);
      } catch (error) {
         console.error("Error cargando personal:", error);
      } finally {
         setLoading(false);
      }
   };

   useEffect(() => { fetchData(); }, []);

   // --- MANEJADORES ---
   const handleSelect = async (persona) => {
      try {
         const res = await telecomApi.get(`/tecnicos/${persona._id}/ficha`);
         const { tecnico } = res.data;
         
         setSelectedUser(tecnico);
         setForm({
            cargo: tecnico.cargo || '',
            area: tecnico.area || '',
            proyecto: tecnico.proyecto || '',
            mandante: tecnico.mandantePrincipal || '',
            region: tecnico.region || '',
            sede: tecnico.sede || '', // <--- CARGA SEDE
            telefono: tecnico.telefono || '',
            email: tecnico.email || '',
            usuarioToa: tecnico.usuarioToa || '',
            claveToa: tecnico.claveToa || '',
            idRecursoToa: tecnico.idRecursoToa || '',
            supervisor: tecnico.supervisorId?.name || 'SIN ASIGNAR',
            patente: tecnico.vehiculoAsignado?.patente || tecnico.patente || '',
            marcaVehiculo: tecnico.vehiculoAsignado?.marca || tecnico.marcaVehiculo || '',
            modeloVehiculo: tecnico.vehiculoAsignado?.modelo || tecnico.modeloVehiculo || ''
         });
      } catch (error) {
         console.error("Error al cargar ficha detallada:", error);
         setSelectedUser(persona);
      }
   };

   const handleChange = (e) => {
      setForm({ ...form, [e.target.name]: e.target.value });
   };

   const handleSave = async (e) => {
      e.preventDefault();
      if (!selectedUser) return;

      try {
         const payload = { 
            ...selectedUser, 
            ...form,
            mandantePrincipal: form.mandante 
         };

         await telecomApi.post('/tecnicos', payload);
         alert(`✅ ${selectedUser.nombre} habilitado operativamente.`);
         setSelectedUser(null);
         fetchData();
      } catch (error) {
         alert("Error al guardar designación");
      }
   };

   const handleExportExcel = () => {
      const dataToExport = personal.map(p => ({
         RUT: p.rut,
         NOMBRE: p.nombre,
         CARGO: p.cargo || 'N/A',
         AREA: p.area || 'N/A',
         PROYECTO: p.proyecto || 'N/A',
         MANDANTE: p.mandantePrincipal || 'N/A',
         SEDE: p.sede || 'N/A',
         REGION: p.region || 'N/A',
         TELEFONO: p.telefono || 'N/A',
         EMAIL: p.email || 'N/A',
         ID_TOA: p.idRecursoToa || 'N/A',
         USUARIO_TOA: p.usuarioToa || 'N/A',
         PATENTE: (p.vehiculoAsignado?.patente || p.patente) || 'SIN VEHÍCULO',
         MARCA: (p.vehiculoAsignado?.marca || p.marcaVehiculo) || '',
         MODELO: (p.vehiculoAsignado?.modelo || p.modeloVehiculo) || '',
         ESTADO_OPERATIVO: p.estadoActual || 'OPERATIVO'
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Designaciones");
      XLSX.writeFile(wb, `Reporte_Designaciones_${new Date().toISOString().split('T')[0]}.xlsx`);
   };

   const listaVisible = pendientes.filter(p =>
      p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
      p.rut.toLowerCase().includes(filtro.toLowerCase())
   );

   return (
      <div className="animate-in fade-in slide-in-from-right-8 duration-500 h-full flex flex-col bg-slate-50/30 p-4 md:p-6">

         {/* HEADER */}
         <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
            <div>
               <h1 className="text-4xl font-black italic text-slate-800 flex items-center gap-3 tracking-tighter">
                  <ShieldCheck className="text-blue-600 w-10 h-10" strokeWidth={2.5} />
                  CENTRO DE <span className="text-blue-600">DESIGNACIONES</span>
               </h1>
               <div className="flex items-center gap-3 mt-3">
                  <div className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black tracking-widest flex items-center gap-2 border border-amber-200 shadow-sm">
                     <AlertCircle size={12} className="animate-pulse" /> {pendientes.length} PENDIENTES DE HABILITACIÓN
                  </div>
                  <button 
                     onClick={handleExportExcel}
                     className="px-3 py-1 bg-white hover:bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black tracking-widest flex items-center gap-2 border border-emerald-100 shadow-sm transition-all"
                  >
                     <Download size={12} /> EXPORTAR MASTER EXCEL
                  </button>
               </div>
            </div>

            {/* BUSCADOR */}
            <div className="relative w-full md:w-80 group">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
               <input
                  type="text"
                  placeholder="Buscar por RUT o Nombre..."
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 bg-white text-xs font-black outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm transition-all placeholder:text-slate-300"
                  value={filtro}
                  onChange={e => setFiltro(e.target.value)}
               />
            </div>
         </div>

         <div className="flex gap-8 flex-1 overflow-hidden">

            {/* COLUMNA 1: LISTA DE PENDIENTES */}
            <div className="w-full md:w-[380px] flex flex-col bg-white border border-slate-200 rounded-[2.5rem] shadow-xl shadow-slate-200/40 overflow-hidden shrink-0">
               <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-black text-slate-600 text-xs uppercase tracking-[0.2em] flex items-center gap-2">
                     <LayoutList size={16} className="text-slate-400" /> BANDEJA DE ENTRADA
                  </h3>
                  <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg shadow-blue-500/20">{pendientes.length}</div>
               </div>

               <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                  {loading ? (
                     <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-3">
                        <RefreshCw className="animate-spin" size={32} />
                        <span className="text-[10px] font-black tracking-widest uppercase">Cargando Personal...</span>
                     </div>
                  ) : listaVisible.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60 p-8 text-center">
                        <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-4">
                           <CheckCircle2 size={40} className="text-emerald-500" />
                        </div>
                        <h4 className="font-black text-slate-400 text-sm uppercase">¡Excelente!</h4>
                        <p className="text-[10px] font-bold uppercase tracking-tighter mt-1">No hay técnicos pendientes de designación estratégica.</p>
                     </div>
                  ) : (
                     listaVisible.map(p => (
                        <div
                           key={p._id}
                           onClick={() => handleSelect(p)}
                           className={`p-5 rounded-[1.8rem] border cursor-pointer transition-all duration-300 group relative overflow-hidden
                        ${selectedUser?._id === p._id 
                           ? 'bg-blue-600 border-blue-600 shadow-2xl shadow-blue-500/30 -translate-y-1' 
                           : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-lg hover:-translate-y-1'}
                      `}
                        >
                           {selectedUser?._id === p._id && (
                              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl -mr-16 -mt-16 rounded-full" />
                           )}

                           <div className="flex justify-between items-start mb-3 relative z-10">
                              <div>
                                 <h4 className={`font-black text-sm uppercase tracking-tight ${selectedUser?._id === p._id ? 'text-white' : 'text-slate-800'}`}>{p.nombre}</h4>
                                 <p className={`text-[10px] font-mono mt-0.5 ${selectedUser?._id === p._id ? 'text-blue-100' : 'text-slate-400'}`}>{p.rut}</p>
                              </div>
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shadow-inner transition-colors duration-500
                                 ${selectedUser?._id === p._id ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                 {p.nombre.charAt(0)}
                              </div>
                           </div>

                           <div className="flex gap-1.5 flex-wrap relative z-10">
                              {!p.idRecursoToa && <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border transition-colors ${selectedUser?._id === p._id ? 'bg-white/20 border-white/30 text-white' : 'bg-red-50 border-red-100 text-red-600'}`}>FALTA TOA</span>}
                              {!p.email && <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border transition-colors ${selectedUser?._id === p._id ? 'bg-white/20 border-white/30 text-white' : 'bg-red-50 border-red-100 text-red-600'}`}>FALTA CORREO</span>}
                              {!p.area && <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border transition-colors ${selectedUser?._id === p._id ? 'bg-white/20 border-white/30 text-white' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>FALTA ÁREA</span>}
                           </div>
                        </div>
                     ))
                  )}
               </div>
            </div>

            {/* COLUMNA 2: PANEL DE CONFIGURACIÓN */}
            <div className="flex-1 bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 flex flex-col overflow-hidden relative">

               {selectedUser ? (
                  <form onSubmit={handleSave} className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-6 duration-500">

                     {/* Header Ficha Inteligente */}
                     <div className="p-8 border-b border-slate-100 bg-slate-50/30 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 opacity-40 blur-3xl rounded-full -mr-48 -mt-48 transition-transform duration-1000 group-hover:scale-110" />
                        
                        <div className="flex items-center gap-6 relative z-10">
                           <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-3xl font-black shadow-2xl shadow-blue-500/40 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                              {selectedUser.nombre.charAt(0)}
                           </div>
                           <div>
                              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-none mb-2">{selectedUser.nombre}</h2>
                              <div className="flex items-center gap-3">
                                 <span className="text-[10px] font-mono bg-white px-3 py-1 rounded-full border border-slate-200 text-slate-500 font-bold shadow-sm">{selectedUser.rut}</span>
                                 <div className="h-1 w-1 bg-slate-300 rounded-full" />
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <BadgeCheck size={14} className="text-emerald-500" /> Ficha Verificada
                                 </span>
                              </div>
                           </div>
                           <div className="ml-auto flex flex-col items-end">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Supervisor de Origen</span>
                              <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                 <UserCheck size={14} className="text-blue-600" />
                                 <span className="text-xs font-black text-slate-700 uppercase">{form.supervisor}</span>
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="flex-1 overflow-y-auto custom-scrollbar p-8">

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                           
                           {/* COLUMNA IZQUIERDA: ESTRUCTURA (READ ONLY) */}
                           <div className="space-y-8">
                              <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-200/60 shadow-inner">
                                 <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                                       <div className="w-8 h-8 rounded-xl bg-blue-100/50 flex items-center justify-center text-blue-600">
                                          <Briefcase size={16} />
                                       </div>
                                       Estructura Registrada (Blindada)
                                    </h3>
                                    <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg flex items-center gap-2">
                                       <Info size={12} className="text-blue-600" />
                                       <span className="text-[8px] font-black text-slate-400 uppercase">Solo editable en Captura de Talento</span>
                                    </div>
                                 </div>

                                 <div className="grid gap-6 opacity-80 pointer-events-none">
                                    <FieldGroup label="Función / Cargo Estratégico" name="cargo" value={form.cargo} onChange={handleChange} placeholder="N/A" icon={UserCog} readOnly />
                                    <FieldGroup label="Unidad de Negocio / Área" name="area" value={form.area} onChange={handleChange} placeholder="N/A" icon={Building} readOnly />
                                    <div className="grid grid-cols-2 gap-4">
                                       <FieldGroup label="Proyecto Designado" name="proyecto" value={form.proyecto} onChange={handleChange} placeholder="N/A" readOnly />
                                       <FieldGroup label="Sede / Sucursal" name="sede" value={form.sede} onChange={handleChange} placeholder="N/A" readOnly />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                       <FieldGroup label="Cliente / Empresa" name="mandante" value={form.mandante} onChange={handleChange} placeholder="N/A" readOnly />
                                       <FieldGroup label="Región Operativa" name="region" value={form.region} onChange={handleChange} placeholder="N/A" icon={MapPin} readOnly />
                                    </div>
                                 </div>
                              </div>

                              <div className="bg-amber-50/40 rounded-3xl p-6 border border-amber-100 shadow-sm">
                                 <h3 className="text-[11px] font-black text-amber-600/60 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-amber-100/50 flex items-center justify-center text-amber-600">
                                       <Key size={16} />
                                    </div>
                                    Accesos TOA Systems (Configuración)
                                 </h3>
                                 <div className="grid grid-cols-2 gap-4">
                                    <FieldGroup label="ID Técnico TOA" name="idRecursoToa" value={form.idRecursoToa} onChange={handleChange} placeholder="ID RECURSO" dark />
                                    <FieldGroup label="Usuario Acceso" name="usuarioToa" value={form.usuarioToa} onChange={handleChange} placeholder="USR_TOA" dark />
                                    <FieldGroup label="Contraseña" name="claveToa" value={form.claveToa} onChange={handleChange} placeholder="••••••••" type="password" dark />
                                 </div>
                              </div>
                           </div>

                           {/* COLUMNA DERECHA: LOGÍSTICA & FLOTA */}
                           <div className="space-y-8">
                              <div className="bg-slate-900 rounded-3xl p-6 shadow-2xl shadow-slate-900/40 relative overflow-hidden group">
                                 <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 opacity-10 blur-3xl -mr-16 -mt-16 rounded-full group-hover:scale-125 transition-transform duration-1000" />
                                 
                                 <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3">
                                       <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-blue-400">
                                          <Car size={16} />
                                       </div>
                                       Flota Vehicular Registrada
                                    </h3>
                                    {form.patente && (
                                       <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg flex items-center gap-2">
                                          <CheckCircle2 size={12} className="text-emerald-400" />
                                          <span className="text-[8px] font-black text-emerald-400 uppercase">Vinculado</span>
                                       </div>
                                    )}
                                 </div>
                                 
                                 <div className="grid gap-6">
                                    <div className="flex flex-col gap-1">
                                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Patente Asignada</label>
                                       <input 
                                          name="patente" value={form.patente} onChange={handleChange} readOnly
                                          className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm font-black text-white outline-none opacity-60 cursor-not-allowed uppercase placeholder:text-slate-700" 
                                          placeholder="SIN ASIGNACIÓN"
                                       />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                       <FieldGroup label="Marca" name="marcaVehiculo" value={form.marcaVehiculo} onChange={handleChange} placeholder="N/A" dark readOnly />
                                       <FieldGroup label="Modelo" name="modeloVehiculo" value={form.modeloVehiculo} onChange={handleChange} placeholder="N/A" dark readOnly />
                                    </div>
                                 </div>
                                 
                                 {!form.patente ? (
                                    <div className="mt-8 p-6 bg-red-500/10 border border-red-500/20 rounded-3xl flex flex-col items-center text-center gap-3">
                                       <Car size={32} className="text-red-400 opacity-50" />
                                       <div>
                                          <h4 className="text-xs font-black text-red-400 uppercase">Sin Vehículo en Flota</h4>
                                          <p className="text-[10px] font-bold text-red-400/70 uppercase mt-1">Se requiere asignación para habilitación TOA.</p>
                                       </div>
                                       <button 
                                          type="button"
                                          onClick={() => window.location.href = '/flota'}
                                          className="mt-2 w-full bg-white hover:bg-slate-100 text-slate-900 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all shadow-xl"
                                       >
                                          <ExternalLink size={14} /> Solicitar Asignación (Mi Flotilla)
                                       </button>
                                    </div>
                                 ) : (
                                    <div className="mt-6 flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                                       <BadgeCheck size={16} className="text-emerald-400" />
                                       <span className="text-[9px] font-black text-emerald-400 uppercase italic">Flota verificada y vinculada a la unidad.</span>
                                    </div>
                                 )}
                              </div>

                              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                                 <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                                       <Smartphone size={16} />
                                    </div>
                                    Comunicación Corporativa
                                 </h3>
                                 <div className="grid gap-4">
                                    <FieldGroup label="Teléfono Registro" name="telefono" value={form.telefono} onChange={handleChange} placeholder="+56 9 1234 5678" icon={Smartphone} />
                                    <FieldGroup label="Email Oficial" name="email" value={form.email} onChange={handleChange} placeholder="usuario@empresa.com" icon={Mail} lowercase />
                                 </div>
                              </div>
                           </div>

                        </div>
                     </div>

                     {/* Footer Actions */}
                     <div className="p-8 border-t border-slate-100 bg-white/80 backdrop-blur-md flex justify-between items-center sticky bottom-0 z-20">
                        <div className="flex items-center gap-2 text-slate-400">
                           <Zap size={14} className="text-amber-500" />
                           <span className="text-[9px] font-black uppercase tracking-[0.1em]">La habilitación activa los KPIs en tiempo real en el Dashboard Ejecutivo.</span>
                        </div>
                        <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-12 py-4 rounded-2xl font-black text-xs uppercase shadow-2xl shadow-blue-500/40 flex items-center gap-3 transition-all active:scale-95 group">
                           <Save size={18} className="group-hover:rotate-12 transition-transform" /> GUARDAR DESIGNACIÓN SMART
                        </button>
                     </div>

                  </form>
               ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 p-12 text-center">
                     <div className="w-32 h-32 bg-slate-50 rounded-[3rem] flex items-center justify-center mb-6 shadow-inner">
                        <ShieldCheck size={64} className="text-slate-200" />
                     </div>
                     <h3 className="text-2xl font-black text-slate-400 uppercase tracking-tight">CENTRO DE CONTROL</h3>
                     <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-3 opacity-60">Selecciona un colaborador para iniciar la vinculación inteligente.</p>
                  </div>
               )}

            </div>

         </div>
      </div>
   );
};

// --- HELPER COMPONENTS ---
const FieldGroup = ({ label, name, value, onChange, placeholder, icon: Icon, type = "text", dark = false, lowercase = false, readOnly = false }) => (
   <div className="flex flex-col gap-1.5 group">
      <label className={`text-[9px] font-black uppercase tracking-widest ml-1 transition-colors 
         ${readOnly ? 'text-slate-400' : dark ? 'text-slate-500' : 'text-slate-400 group-focus-within:text-blue-600'}`}>
         {label}
      </label>
      <div className="relative">
         {Icon && <Icon className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors 
            ${readOnly ? 'text-slate-300' : dark ? 'text-slate-600' : 'text-slate-300 group-focus-within:text-blue-500'}`} size={16} />}
         <input
            name={name}
            value={value}
            onChange={onChange}
            type={type}
            placeholder={placeholder}
            readOnly={readOnly}
            className={`w-full rounded-2xl px-5 py-4 text-xs font-bold outline-none transition-all ${Icon ? 'pl-12' : ''} ${lowercase ? 'lowercase' : 'uppercase'} 
               ${readOnly 
                  ? 'bg-slate-100/50 border border-slate-200/50 text-slate-500 cursor-not-allowed shadow-none' 
                  : dark 
                     ? 'bg-white/5 border border-white/10 text-white focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 shadow-inner' 
                     : 'bg-slate-50 border border-slate-100 text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm'
               }`}
         />
      </div>
   </div>
);

const RefreshCw = ({ size, className }) => (
   <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
);

export default Designaciones;
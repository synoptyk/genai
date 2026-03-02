import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
   ShieldCheck, UserCog, AlertCircle, CheckCircle2,
   Smartphone, Briefcase, Key, Save, Search,
   LayoutList, Fingerprint, Zap, Mail, Building
} from 'lucide-react';

const Designaciones = () => {
   // --- ESTADOS ---
   const [, setPersonal] = useState([]);
   const [pendientes, setPendientes] = useState([]);
   const [, setLoading] = useState(true);
   const [filtro, setFiltro] = useState('');

   // Estado para el Modal de Habilitación
   const [selectedUser, setSelectedUser] = useState(null);
   const [form, setForm] = useState({
      cargo: '',          // Funciones
      area: '',           // <--- NUEVO CAMPO: Área
      proyecto: '',       // Proyecto específico
      mandante: '',       // Cliente mandante
      region: '',         // Región operativa
      telefono: '',       // Contacto corporativo
      email: '',          // <--- NUEVO CAMPO: Correo
      usuarioToa: '',     // Acceso Sistemas
      claveToa: ''        // Acceso Sistemas
   });

   // --- CARGA DE DATOS ---
   const fetchData = async () => {
      setLoading(true);
      try {
         const res = await axios.get('http://localhost:5001/api/tecnicos');
         const todos = res.data;

         // FILTRO INTELIGENTE: ¿Quiénes faltan por designar?
         // Ahora incluye validación de Área y Email
         const listaPendiente = todos.filter(p =>
            !p.cargo || !p.area || !p.proyecto || !p.mandante || !p.region ||
            !p.telefono || !p.email || !p.usuarioToa || !p.claveToa
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
   const handleSelect = (persona) => {
      setSelectedUser(persona);
      // Pre-cargar datos existentes (incluyendo los nuevos campos si ya vienen de Ficha Ingreso)
      setForm({
         cargo: persona.cargo || '',
         area: persona.area || '', // Carga el área si ya existe
         proyecto: persona.proyecto || '',
         mandante: persona.mandante || '',
         region: persona.region || '',
         telefono: persona.telefono || '',
         email: persona.email || '', // Carga el email si ya existe
         usuarioToa: persona.usuarioToa || '',
         claveToa: persona.claveToa || ''
      });
   };

   const handleChange = (e) => {
      setForm({ ...form, [e.target.name]: e.target.value });
   };

   const handleSave = async (e) => {
      e.preventDefault();
      if (!selectedUser) return;

      try {
         // Actualizamos solo los campos operativos del usuario
         const payload = { ...selectedUser, ...form };

         await axios.post('http://localhost:5001/api/tecnicos', payload);
         alert(`✅ ${selectedUser.nombre} habilitado operativamente.`);
         setSelectedUser(null);
         fetchData(); // Recargar para limpiar la lista de pendientes
      } catch (error) {
         alert("Error al guardar designación");
      }
   };

   // Filtrado visual
   const listaVisible = pendientes.filter(p =>
      p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
      p.rut.toLowerCase().includes(filtro.toLowerCase())
   );

   return (
      <div className="animate-in fade-in slide-in-from-right-8 duration-500 h-full flex flex-col">

         {/* HEADER */}
         <div className="flex justify-between items-end mb-8">
            <div>
               <h1 className="text-3xl font-black italic text-slate-800 flex items-center gap-3">
                  <ShieldCheck className="text-blue-600" size={32} />
                  Centro de <span className="text-blue-600">Designaciones</span>
               </h1>
               <p className="text-slate-500 text-xs font-bold tracking-widest mt-2 flex items-center gap-2">
                  <AlertCircle size={12} className="text-amber-500" /> {pendientes.length} COLABORADORES REQUIEREN HABILITACIÓN OPERATIVA
               </p>
            </div>

            {/* BUSCADOR */}
            <div className="relative w-72">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
               <input
                  type="text"
                  placeholder="Buscar pendiente por RUT o Nombre..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-blue-500 shadow-sm"
                  value={filtro}
                  onChange={e => setFiltro(e.target.value)}
               />
            </div>
         </div>

         <div className="flex gap-8 flex-1 overflow-hidden">

            {/* COLUMNA 1: LISTA DE PENDIENTES (BANDEJA DE ENTRADA) */}
            <div className="w-1/3 flex flex-col bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
               <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-black text-slate-600 text-xs uppercase tracking-widest flex items-center gap-2">
                     <LayoutList size={14} /> Pendientes de Habilitación
                  </h3>
                  <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-black">{pendientes.length}</span>
               </div>

               <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                  {listaVisible.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60">
                        <CheckCircle2 size={48} className="mb-2" />
                        <p className="text-xs font-bold uppercase">Todo al día</p>
                     </div>
                  ) : (
                     listaVisible.map(p => (
                        <div
                           key={p._id}
                           onClick={() => handleSelect(p)}
                           className={`p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-md group relative
                        ${selectedUser?._id === p._id ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-slate-100 hover:border-blue-300'}
                      `}
                        >
                           <div className="flex justify-between items-start mb-2">
                              <div>
                                 <h4 className="font-bold text-slate-700 text-sm uppercase">{p.nombre}</h4>
                                 <p className="text-[10px] text-slate-400 font-mono">{p.rut}</p>
                              </div>
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xs">
                                 {p.nombre.charAt(0)}
                              </div>
                           </div>

                           {/* INDICADORES DE LO QUE FALTA */}
                           <div className="flex gap-1 flex-wrap mt-2">
                              {!p.usuarioToa && <span className="text-[9px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">Falta TOA</span>}
                              {!p.email && <span className="text-[9px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">Falta Email</span>}
                              {!p.proyecto && <span className="text-[9px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">Falta Proy.</span>}
                           </div>

                           {selectedUser?._id === p._id && (
                              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                 <Zap className="text-blue-500 fill-blue-500 animate-pulse" size={20} />
                              </div>
                           )}
                        </div>
                     ))
                  )}
               </div>
            </div>

            {/* COLUMNA 2: PANEL DE CONFIGURACIÓN (FORMULARIO) */}
            <div className="flex-1 bg-white border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/50 flex flex-col overflow-hidden relative">

               {selectedUser ? (
                  <form onSubmit={handleSave} className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4">

                     {/* Header Ficha */}
                     <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex items-center gap-4">
                           <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-blue-500/30">
                              {selectedUser.nombre.charAt(0)}
                           </div>
                           <div>
                              <h2 className="text-xl font-black text-slate-800 uppercase">{selectedUser.nombre}</h2>
                              <p className="text-xs font-bold text-slate-400 flex items-center gap-2">
                                 <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">{selectedUser.rut}</span>
                                 • Fecha Ingreso: {selectedUser.fechaIngreso || 'N/A'}
                              </p>
                           </div>
                        </div>
                     </div>

                     <div className="flex-1 overflow-y-auto custom-scrollbar p-8">

                        {/* SECCIÓN 1: VINCULACIÓN ESTRATÉGICA */}
                        <div className="mb-8">
                           <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <Briefcase size={16} className="text-blue-500" /> Vinculación Operativa
                           </h3>
                           <div className="grid grid-cols-2 gap-6">
                              <div className="group">
                                 <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Función / Cargo</label>
                                 <input
                                    name="cargo" value={form.cargo} onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all uppercase"
                                    placeholder="Ej: TÉCNICO HFC"
                                 />
                              </div>
                              <div className="group">
                                 <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Área</label>
                                 <div className="relative">
                                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                       name="area" value={form.area} onChange={handleChange}
                                       className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pl-10 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all uppercase"
                                       placeholder="Ej: OPERACIONES"
                                    />
                                 </div>
                              </div>
                              <div className="group">
                                 <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Proyecto</label>
                                 <input
                                    name="proyecto" value={form.proyecto} onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all uppercase"
                                    placeholder="Ej: FIBRA 2026"
                                 />
                              </div>
                              <div className="group">
                                 <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Mandante</label>
                                 <input
                                    name="mandante" value={form.mandante} onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all uppercase"
                                    placeholder="Ej: MOVISTAR"
                                 />
                              </div>
                              <div className="group col-span-2">
                                 <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Región Operativa</label>
                                 <input
                                    name="region" value={form.region} onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all uppercase"
                                    placeholder="Ej: METROPOLITANA"
                                 />
                              </div>
                           </div>
                        </div>

                        {/* SECCIÓN 2: ACCESOS Y CONTACTO */}
                        <div className="mb-4">
                           <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <Key size={16} className="text-amber-500" /> Accesos & Contacto
                           </h3>
                           <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-100 grid grid-cols-2 gap-6">

                              <div className="group">
                                 <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Teléfono Corporativo</label>
                                 <div className="relative">
                                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                       name="telefono" value={form.telefono} onChange={handleChange}
                                       className="w-full bg-white border border-amber-200 rounded-xl p-3 pl-10 text-sm font-bold text-slate-700 outline-none focus:border-amber-500 transition-all"
                                       placeholder="+56 9 1234 5678"
                                    />
                                 </div>
                              </div>

                              <div className="group">
                                 <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Correo (Corp/Personal)</label>
                                 <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                       name="email" value={form.email} onChange={handleChange}
                                       className="w-full bg-white border border-amber-200 rounded-xl p-3 pl-10 text-sm font-bold text-slate-700 outline-none focus:border-amber-500 transition-all lowercase"
                                       placeholder="usuario@empresa.com"
                                    />
                                 </div>
                              </div>

                              <div className="group">
                                 <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Usuario TOA</label>
                                 <div className="relative">
                                    <UserCog className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                       name="usuarioToa" value={form.usuarioToa} onChange={handleChange}
                                       className="w-full bg-white border border-amber-200 rounded-xl p-3 pl-10 text-sm font-bold text-slate-700 outline-none focus:border-amber-500 transition-all"
                                    />
                                 </div>
                              </div>

                              <div className="group">
                                 <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Clave TOA</label>
                                 <div className="relative">
                                    <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                       name="claveToa" value={form.claveToa} onChange={handleChange}
                                       className="w-full bg-white border border-amber-200 rounded-xl p-3 pl-10 text-sm font-bold text-slate-700 outline-none focus:border-amber-500 transition-all"
                                    />
                                 </div>
                              </div>

                           </div>
                        </div>

                     </div>

                     {/* Footer Actions */}
                     <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center">
                        <div className="text-[10px] text-slate-400 font-bold max-w-[200px]">
                           * Al guardar, el usuario quedará habilitado en el Maestro de Dotación.
                        </div>
                        <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-black text-xs uppercase shadow-xl shadow-blue-500/20 flex items-center gap-3 transition-transform hover:scale-105 active:scale-95">
                           <Save size={18} /> Guardar Habilitación
                        </button>
                     </div>

                  </form>
               ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300">
                     <ShieldCheck size={80} className="mb-4 text-slate-200" />
                     <h3 className="text-xl font-black text-slate-400 uppercase">Sin Selección</h3>
                     <p className="text-xs font-bold mt-2">Selecciona un colaborador pendiente de la lista</p>
                  </div>
               )}

            </div>

         </div>
      </div>
   );
};

export default Designaciones;
import React, { useState, useEffect } from 'react';
import API_URL from '../../config';

import axios from 'axios';
import { 
  Settings, Save, Building2, Wallet, Target, 
  Server, Play, Plus, Users, Edit3, Briefcase, CheckCircle2,
  AlertTriangle, Banknote, Calculator 
} from 'lucide-react';

// IMPORTAMOS EL COMPONENTE BAREMOS
import Baremos from './Baremos';

// --- SUB-COMPONENTE 1: CONFIGURACIÓN GENERAL (Tu código nuevo) ---
const ConfiguracionGeneral = () => {
  const [clientes, setClientes] = useState([]);
  const [botStatus, setBotStatus] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);

  const [form, setForm] = useState({
    nombre: '', 
    valorPunto: 0,
    metaDiaria: 0,
    valorFijo: 0,          
    reglaAsistencia: true  
  });

  const fetchClientes = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/clientes`);
      setClientes(res.data);
      if (res.data.length > 0 && !form.nombre && !modoEdicion) {
        seleccionarCliente(res.data[0]);
      }
    } catch (e) { console.error(e); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchClientes(); }, []);

  const seleccionarCliente = (cliente) => {
    setForm({
      nombre: cliente.nombre,
      valorPunto: cliente.valorPuntoActual || 0,
      metaDiaria: cliente.metaDiariaActual || 0,
      valorFijo: cliente.valorFijoActual || 0,
      reglaAsistencia: cliente.reglaAsistencia !== undefined ? cliente.reglaAsistencia : true
    });
    setModoEdicion(true);
  };

  const nuevoCliente = () => {
    setForm({ nombre: '', valorPunto: 0, metaDiaria: 0, valorFijo: 0, reglaAsistencia: true });
    setModoEdicion(false);
  };

  const guardarTarifa = async (e) => {
    e.preventDefault();
    if (!form.nombre) return alert("Ingrese un nombre válido");

    try {
      await axios.post(`${API_URL}/api/clientes`, form);
      alert(modoEdicion ? "Contrato Actualizado" : "Nuevo Mandante Creado");
      fetchClientes();
    } catch (e) { alert("Error al guardar"); }
  };

  const ejecutarBot = async () => {
    try {
      setBotStatus('Ejecutando...');
      const res = await axios.post(`${API_URL}/api/bot/run`);
      setBotStatus(res.data.message);
      setTimeout(() => setBotStatus(null), 5000);
    } catch (e) { setBotStatus('Error al conectar con el Agente'); }
  };

  // Cálculos de Facturación Estimada
  const facturacionPxQ = (form.valorPunto || 0) * (form.metaDiaria || 0);
  const facturacionFija = form.valorFijo || 0;

  return (
    <div className="animate-in fade-in duration-500 max-w-7xl mx-auto pb-10">
      
      {/* HEADER ESPECÍFICO DE ESTA PESTAÑA */}
      <div className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter text-slate-800 flex items-center gap-3">
            <Settings className="text-blue-600" size={32}/>
            Ajustes del <span className="text-blue-600">Sistema</span>
          </h1>
          <p className="text-slate-500 font-bold text-xs tracking-widest mt-2">
            CONFIGURACIÓN DE CONTRATOS Y TARIFAS CON MANDANTES
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMNA 1: LISTA DE CLIENTES */}
        <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-xl shadow-slate-200/50">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-slate-700 uppercase tracking-widest text-xs flex items-center gap-2">
                     <Users size={16} className="text-blue-600"/> Cartera Mandantes
                  </h3>
                  <button onClick={nuevoCliente} className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg transition-colors shadow-lg shadow-blue-500/30" title="Nuevo Mandante">
                    <Plus size={16}/>
                  </button>
               </div>
               
               <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                  {clientes.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => seleccionarCliente(c)}
                      className={`w-full text-left p-4 rounded-xl border transition-all group flex justify-between items-center
                        ${form.nombre === c.nombre 
                           ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' 
                           : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-blue-300'
                        }`}
                    >
                       <div>
                          <div className={`font-black text-xs uppercase tracking-wider ${form.nombre === c.nombre ? 'text-blue-700' : 'text-slate-600'}`}>
                            {c.nombre}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                             {/* Badges indicativos */}
                             {c.valorPuntoActual > 0 && (
                               <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold border border-purple-200">
                                 PxQ: ${c.valorPuntoActual}
                               </span>
                             )}
                             {c.valorFijoActual > 0 && (
                               <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold border border-emerald-200">
                                 FIJO: ${c.valorFijoActual.toLocaleString()}
                               </span>
                             )}
                          </div>
                       </div>
                       {form.nombre === c.nombre && <Edit3 size={14} className="text-blue-500"/>}
                    </button>
                  ))}
                  {clientes.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Sin mandantes registrados</p>}
               </div>
            </div>

            {/* BOTÓN DE EMERGENCIA DEL BOT */}
            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-xl shadow-slate-200/50 border-l-4 border-l-red-500">
               <h3 className="font-black text-slate-700 flex items-center gap-2 uppercase tracking-widest text-xs mb-2">
                  <Server size={16} className="text-red-500"/> Agente TOA
               </h3>
               <button onClick={ejecutarBot} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black py-3 rounded-xl shadow-lg uppercase tracking-widest text-[10px] flex justify-center items-center gap-3 transition-all hover:scale-[1.02]">
                  <Play size={14} fill="currentColor"/> Forzar Ejecución
               </button>
               {botStatus && <div className="mt-2 text-center text-[10px] font-bold text-emerald-600 animate-pulse">{botStatus}</div>}
            </div>
        </div>

        {/* COLUMNA 2: FORMULARIO UNIFICADO */}
        <div className="lg:col-span-8">
           <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 relative overflow-hidden h-full flex flex-col">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
              
              <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-black italic text-slate-800 flex items-center gap-2">
                   {modoEdicion ? 'Editando Mandante' : 'Nuevo Mandante'}
                   <span className={`text-[10px] px-2 py-0.5 rounded border uppercase ${modoEdicion ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                     {modoEdicion ? 'Contrato Existente' : 'Nuevo Contrato'}
                   </span>
                 </h2>
                 <div className="text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Facturación Máx x Técnico</span>
                    <span className="text-xl font-black text-slate-800">
                       $ {Math.max(facturacionPxQ, facturacionFija).toLocaleString('es-CL')}
                    </span>
                 </div>
              </div>

              <form onSubmit={guardarTarifa} className="space-y-8 flex-1">
                
                {/* 1. NOMBRE DEL CLIENTE */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nombre Mandante (Ej: Movistar)</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                    <input 
                      type="text" 
                      placeholder="EJ: MOVISTAR, CLARO, WOM"
                      className={`w-full bg-slate-50 border border-slate-200 rounded-xl py-4 pl-12 pr-4 font-black text-slate-700 uppercase focus:bg-white focus:border-blue-500 outline-none transition-all ${modoEdicion ? 'opacity-70 cursor-not-allowed' : ''}`}
                      value={form.nombre}
                      readOnly={modoEdicion}
                      onChange={e => setForm({...form, nombre: e.target.value.toUpperCase()})}
                    />
                  </div>
                </div>

                {/* CONTENEDOR DE MODELOS DE CONTRATO */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   
                   {/* MODELO A: VARIABLE (PXQ) */}
                   <div className="bg-purple-50/50 rounded-2xl border border-purple-100 p-5 hover:border-purple-300 transition-colors">
                      <div className="flex items-center gap-2 text-purple-700 mb-4 pb-2 border-b border-purple-100">
                         <Target size={18}/> <span className="font-black text-xs uppercase tracking-widest">Contrato Variable (PxQ)</span>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Precio Compra x Punto</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 font-bold">$</span>
                              <Wallet className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-200 opacity-50" size={14}/>
                              <input 
                                type="number" 
                                className="w-full bg-white border border-purple-100 rounded-lg py-2 pl-7 pr-3 font-bold text-slate-700 focus:border-purple-500 outline-none text-sm"
                                placeholder="0"
                                value={form.valorPunto}
                                onChange={e => setForm({...form, valorPunto: Number(e.target.value)})}
                              />
                            </div>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Meta Producción Mensual (PTS)</label>
                            <input 
                              type="number" 
                              className="w-full bg-white border border-purple-100 rounded-lg py-2 px-3 font-bold text-slate-700 focus:border-purple-500 outline-none text-sm"
                              placeholder="Ej: 175"
                              value={form.metaDiaria}
                              onChange={e => setForm({...form, metaDiaria: Number(e.target.value)})}
                            />
                        </div>
                        <div className="mt-4 pt-3 border-t border-purple-100 text-right">
                           <span className="text-[9px] font-bold text-purple-400 block uppercase">Ingreso Variable Est.</span>
                           <span className="text-lg font-black text-purple-700">$ {facturacionPxQ.toLocaleString('es-CL')}</span>
                        </div>
                      </div>
                   </div>

                   {/* MODELO B: FIJO (DISPONIBILIDAD) */}
                   <div className="bg-emerald-50/50 rounded-2xl border border-emerald-100 p-5 hover:border-emerald-300 transition-colors">
                      <div className="flex items-center gap-2 text-emerald-700 mb-4 pb-2 border-b border-emerald-100">
                         <Briefcase size={18}/> <span className="font-black text-xs uppercase tracking-widest">Contrato Fijo (Disponibilidad)</span>
                      </div>

                      <div className="space-y-4">
                        <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Valor Mensual Contrato ($)</label>
                            <div className="relative">
                              <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" size={14}/>
                              <input 
                                type="number" 
                                className="w-full bg-white border border-emerald-100 rounded-lg py-2 pl-9 pr-3 font-bold text-slate-700 focus:border-emerald-500 outline-none text-sm"
                                placeholder="0"
                                value={form.valorFijo}
                                onChange={e => setForm({...form, valorFijo: Number(e.target.value)})}
                              />
                            </div>
                        </div>
                        
                        {/* TOGGLE CONDICIÓN */}
                        <div 
                          className={`mt-6 flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${form.reglaAsistencia ? 'bg-white border-emerald-300 shadow-sm' : 'bg-transparent border-transparent opacity-60'}`}
                          onClick={() => setForm({...form, reglaAsistencia: !form.reglaAsistencia})}
                        >
                           <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border transition-colors ${form.reglaAsistencia ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300'}`}>
                              {form.reglaAsistencia && <CheckCircle2 size={12}/>}
                           </div>
                           <div>
                              <span className="text-[10px] font-black text-slate-700 uppercase block">Req. 100% Disponibilidad</span>
                              <span className="text-[9px] text-slate-400 leading-tight block">Para facturar el valor completo, el técnico no debe tener faltas.</span>
                           </div>
                        </div>
                        
                        <div className="mt-4 pt-3 border-t border-emerald-100 text-right">
                           <span className="text-[9px] font-bold text-emerald-400 block uppercase">Ingreso Fijo</span>
                           <span className="text-lg font-black text-emerald-700">$ {facturacionFija.toLocaleString('es-CL')}</span>
                        </div>
                      </div>
                   </div>

                </div>
                
                {/* FOOTER ACCIONES */}
                <div className="pt-6 border-t border-slate-100 flex gap-4 mt-auto">
                   {modoEdicion && (
                     <button type="button" onClick={nuevoCliente} className="px-6 py-4 bg-white border border-slate-200 text-slate-500 font-bold rounded-xl text-xs uppercase hover:bg-slate-50 transition-colors">
                       Cancelar
                     </button>
                   )}
                   <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-500/30 uppercase tracking-widest text-xs flex justify-center items-center gap-2 transition-all hover:scale-[1.02]">
                      <Save size={16}/> {modoEdicion ? 'Actualizar Condiciones Comerciales' : 'Guardar Nuevo Mandante'}
                   </button>
                </div>
                
                <div className="flex items-center gap-2 justify-center text-[10px] text-slate-400 font-medium">
                   <AlertTriangle size={12}/>
                   <span>Nota: Puedes dejar valores en 0 si el contrato no incluye esa modalidad.</span>
                </div>

              </form>
           </div>
        </div>

      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL: AJUSTES (CONTENEDOR) ---
const Ajustes = () => {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      
      {/* NAVEGACIÓN DE PESTAÑAS (TABS) */}
      <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex gap-1 mb-6 w-fit mx-auto lg:mx-0">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
            ${activeTab === 'general' 
              ? 'bg-slate-800 text-white shadow-md' 
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            }`}
        >
          <Settings size={16}/> General
        </button>

        <button
          onClick={() => setActiveTab('baremos')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
            ${activeTab === 'baremos' 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' 
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            }`}
        >
          <Calculator size={16}/> Matriz de Baremos
        </button>
      </div>

      {/* CONTENIDO DINÁMICO */}
      <div className="flex-1 overflow-visible">
        {activeTab === 'general' ? <ConfiguracionGeneral /> : <Baremos />}
      </div>

    </div>
  );
};

export default Ajustes;
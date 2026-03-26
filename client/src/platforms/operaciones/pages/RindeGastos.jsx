import React, { useState, useEffect, useMemo } from 'react';
import { 
  Receipt, Plus, History, CheckCircle2, XCircle, Clock, 
  ChevronRight, Camera, FileText, DollarSign, Wallet, 
  PieChart, Filter, Download, ArrowLeft, Send, Image as ImageIcon,
  AlertCircle, MoreVertical, Coffee, Car, Map, Home, Wrench, Package
} from 'lucide-react';

import { useAuth } from '../../auth/AuthContext';
import { telecomApi as api } from '../../agentetelecom/telecomApi';

const RindeGastos = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('rendir'); // 'rendir', 'historial', 'aprobaciones'
  const [loading, setLoading] = useState(false);
  const [gastos, setGastos] = useState([]);
  const [stats, setStats] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Form state
  const [formData, setFormData] = useState({
    tipoGasto: 'Otros',
    subtipoOtros: '',
    tipoDocumento: 'BOLETA',
    monto: '',
    montoNeto: 0,
    ivaRecuperable: 0,
    ivaPerdido: 0,
    fechaGasto: new Date().toISOString().split('T')[0],
    descripcion: '',
    proyecto: '',
    autorizador: '',
    comprobanteUrl: '',
    evidenciaAutorizacionUrl: ''
  });

  // Cálculo de IVA automático
  useEffect(() => {
    const m = parseFloat(formData.monto) || 0;
    if (m > 0) {
      const neto = Math.round(m / 1.19);
      const iva = m - neto;
      setFormData(prev => ({
        ...prev,
        montoNeto: neto,
        ivaRecuperable: prev.tipoDocumento === 'FACTURA' ? iva : 0,
        ivaPerdido: prev.tipoDocumento === 'BOLETA' ? iva : 0
      }));
    }
  }, [formData.monto, formData.tipoDocumento]);

  const isSupervisor = ['supervisor', 'admin', 'ceo', 'ceo_genai'].includes(user?.role);


  useEffect(() => {
    fetchGastos();
    if (isSupervisor) fetchStats();
  }, [user, activeTab]);

  const fetchGastos = async () => {
    try {
      setLoading(true);
      let url = activeTab === 'aprobaciones' 
        ? `/operaciones/gastos/supervisor/${user._id}`
        : `/operaciones/gastos/rut/${user.rut}`;
      
      const { data } = await api.get(url);
      setGastos(data);
    } catch (error) {
      console.error("Error fetching gastos:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/operaciones/gastos/stats');
      setStats(data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleUploadClick = () => {
    // Simulación de carga de archivos (Debería usar un componente de upload real conectado a Cloudinary)
    const mockUrl = "https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg";
    setFormData(prev => ({ ...prev, comprobanteUrl: mockUrl }));
    showToast("Foto cargada correctamente");
  };

  const handleEvidenciaClick = () => {
    const mockUrl = "https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg";
    setFormData(prev => ({ ...prev, evidenciaAutorizacionUrl: mockUrl }));
    showToast("Evidencia de autorización cargada");
  };

  const handleSubmit = async (e) => {

    e.preventDefault();
    if (!formData.monto || !formData.tipoGasto) return showToast("Faltan campos obligatorios", "error");

    try {
      setLoading(true);
      const payload = {
        ...formData,
        rut: user.rut,
        nombre: user.name,
        empresaRef: user.empresaRef,
        estado: isSupervisor ? 'APROBADO' : 'PENDIENTE'
      };

      await api.post('/operaciones/gastos', payload);
      showToast("Gasto enviado a revisión");

      setFormData({
        tipoGasto: 'Otros',
        subtipoOtros: '',
        tipoDocumento: 'BOLETA',
        monto: '',
        montoNeto: 0,
        ivaRecuperable: 0,
        ivaPerdido: 0,
        fechaGasto: new Date().toISOString().split('T')[0],
        descripcion: '',
        proyecto: '',
        autorizador: '',
        comprobanteUrl: '',
        evidenciaAutorizacionUrl: ''
      });
      setActiveTab('historial');

    } catch (error) {
      showToast("Error al enviar el gasto", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, nuevoEstado) => {
    try {
      const comentario = prompt("Añade un comentario (opcional):");
      await api.patch(`/operaciones/gastos/${id}/estado`, { 
        estado: nuevoEstado, 
        comentarioSupervisor: comentario 
      });
      showToast(`Gasto ${nuevoEstado.toLowerCase()}`);
      fetchGastos();
    } catch (error) {
      showToast("Error al actualizar estado", "error");
    }
  };


  const getStatusBadge = (estado) => {
    const config = {
      PENDIENTE: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
      APROBADO: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
      RECHAZADO: { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
      PAGADO: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Wallet }
    };
    const { color, icon: Icon } = config[estado] || config.PENDIENTE;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${color} shadow-sm`}>
        <Icon size={12} strokeWidth={3} />
        {estado}
      </span>
    );
  };

  const tipos = [
    { id: 'Alimentación', icon: Coffee, color: 'bg-orange-100 text-orange-600' },
    { id: 'Transporte', icon: Car, color: 'bg-blue-100 text-blue-600' },
    { id: 'Peajes', icon: Map, color: 'bg-indigo-100 text-indigo-600' },
    { id: 'Alojamiento', icon: Home, color: 'bg-purple-100 text-purple-600' },
    { id: 'Materiales', icon: Wrench, color: 'bg-teal-100 text-teal-600' },

    { id: 'Combustible', icon: Package, color: 'bg-red-100 text-red-600' },
    { id: 'Otros', icon: MoreVertical, color: 'bg-slate-100 text-slate-600' }
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 animate-in fade-in duration-700 font-sans">
      {/* Header Premium */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-blue-600 p-2.5 rounded-2xl shadow-lg shadow-blue-200">
                <Receipt className="text-white" size={24} />
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Rinde Gastos <span className="text-blue-600">360</span></h1>
            </div>
            <p className="text-slate-500 font-medium ml-1">Gestión corporativa de rendiciones y reembolsos</p>
          </div>

          <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-xl shadow-slate-100 h-fit">
            <button 
              onClick={() => setActiveTab('rendir')}
              className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'rendir' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Rendir
            </button>
            <button 
              onClick={() => setActiveTab('historial')}
              className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'historial' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Mi Historial
            </button>
            {isSupervisor && (
              <button 
                onClick={() => setActiveTab('aprobaciones')}
                className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'aprobaciones' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Aprobaciones
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {activeTab === 'rendir' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Formulario Crystal */}
            <div className="lg:col-span-12">
              <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[2.5rem] p-10 shadow-2xl shadow-slate-200">
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Tipo de Gasto</label>
                      <div className="grid grid-cols-4 gap-3">
                        {tipos.map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setFormData({...formData, tipoGasto: t.id})}
                            className={`flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all ${
                              formData.tipoGasto === t.id 
                                ? 'border-blue-600 bg-blue-50 text-blue-600 scale-105 shadow-md' 
                                : 'border-slate-100 hover:border-slate-200 text-slate-400 grayscale opacity-60'
                            }`}
                          >
                            <t.icon size={24} strokeWidth={2.5} />
                            <span className="text-[9px] font-black mt-2 uppercase text-center">{t.id}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tipo Documento</label>
                        <div className="flex bg-slate-100 p-1 rounded-2xl">
                          {['BOLETA', 'FACTURA'].map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setFormData({...formData, tipoDocumento: t})}
                              className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${formData.tipoDocumento === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Monto Total (c/ IVA)</label>
                        <div className="relative group">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                          <input 
                            type="number" 
                            className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-11 pr-4 text-sm font-black text-slate-700 focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-slate-300"
                            placeholder="Ej: 15000"
                            value={formData.monto}
                            onChange={(e) => setFormData({...formData, monto: e.target.value})}
                          />
                        </div>
                        {parseFloat(formData.monto) > 0 && (
                          <p className="text-[9px] font-bold text-slate-400 px-2">
                            Neto: ${formData.montoNeto.toLocaleString('es-CL')} · 
                            IVA {formData.tipoDocumento === 'FACTURA' ? 'Recup.' : 'Perdido'}: ${ (formData.ivaRecuperable || formData.ivaPerdido).toLocaleString('es-CL')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Autorizado por</label>
                        <input 
                          type="text" 
                          className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-black text-slate-700 focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-slate-300"
                          placeholder="Nombre del Jefe/Gerente"
                          value={formData.autorizador}
                          onChange={(e) => setFormData({...formData, autorizador: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fecha del Gasto</label>
                        <input 
                          type="date" 
                          className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-black text-slate-700 focus:ring-2 focus:ring-blue-600 transition-all"
                          value={formData.fechaGasto}
                          onChange={(e) => setFormData({...formData, fechaGasto: e.target.value})}
                        />
                      </div>
                    </div>

                    {formData.tipoGasto === 'Otros' && (
                       <div className="space-y-2 animate-in slide-in-from-top duration-300">
                         <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Especifique (Alojamiento, Pasajes, etc.)</label>
                         <input 
                           type="text" 
                           className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-black text-slate-700 focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-slate-300"
                           placeholder="Ej: Alojamiento faena, Pasaje bus..."
                           value={formData.subtipoOtros}
                           onChange={(e) => setFormData({...formData, subtipoOtros: e.target.value})}
                         />
                       </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Descripción Detallada</label>
                      <textarea 
                        className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-black text-slate-700 focus:ring-2 focus:ring-blue-600 transition-all min-h-[100px] placeholder:text-slate-300"
                        placeholder="Detalles adicionales del gasto..."
                        value={formData.descripcion}
                        onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                      ></textarea>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Boleta/Factura</label>
                        <div 
                          onClick={handleUploadClick}
                          className="border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all group aspect-square"
                        >
                          {formData.comprobanteUrl ? (
                            <img src={formData.comprobanteUrl} className="w-full h-full object-cover rounded-xl" alt="Doc" />
                          ) : (
                            <div className="text-center">
                              <Camera className="text-slate-300 mx-auto mb-1" size={20} />
                              <span className="text-[8px] font-black text-slate-400 uppercase">Subir</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Evidencia Autoriz.</label>
                        <div 
                          onClick={handleEvidenciaClick}
                          className="border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all group aspect-square"
                        >
                          {formData.evidenciaAutorizacionUrl ? (
                            <img src={formData.evidenciaAutorizacionUrl} className="w-full h-full object-cover rounded-xl" alt="Evid" />
                          ) : (
                            <div className="text-center">
                              <FileText className="text-slate-300 mx-auto mb-1" size={20} />
                              <span className="text-[8px] font-black text-slate-400 uppercase">WhatsApp/Mail</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>


                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {loading ? <Clock className="animate-spin" /> : <Send size={20} />}
                      <span className="uppercase tracking-[0.2em] text-sm">Enviar Rendición</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {activeTab !== 'rendir' && (
          <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[2.5rem] shadow-2xl shadow-slate-200 overflow-hidden animate-in slide-in-from-bottom duration-500">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white/50">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">
                {activeTab === 'historial' ? 'Mis Rendiciones' : 'Solicitudes por Aprobar'}
              </h2>
              <div className="flex gap-4">
                <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"><Filter size={20}/></button>
                <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"><Download size={20}/></button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fecha</th>
                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Colaborador</th>
                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tipo</th>
                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Monto</th>
                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Estado</th>
                    {activeTab === 'aprobaciones' && (
                      <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Aciones</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gastos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center opacity-20">
                          <History size={64} className="mb-4" />
                          <p className="text-sm font-black uppercase tracking-widest text-slate-900">No hay registros</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    gastos.map((g, idx) => (
                      <tr key={g._id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-5 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-slate-700">{new Date(g.fechaGasto).toLocaleDateString()}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">ID: {g._id.slice(-6)}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border border-white flex items-center justify-center text-slate-500 font-black text-xs uppercase shadow-sm">
                              {g.nombre?.charAt(0) || user.rut.charAt(0)}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-slate-700">{g.nombre || 'Técnico'}</span>
                              <span className="text-[10px] font-bold text-slate-400">{g.rut}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                           <div className="flex items-center gap-2.5">
                              {(() => {
                                const t = tipos.find(x => x.id === g.tipoGasto) || tipos[6];
                                return (
                                  <>
                                    <div className={`${t.color} p-2 rounded-xl shadow-sm`}><t.icon size={14} /></div>
                                    <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{g.tipoGasto}</span>
                                  </>
                                )
                              })()}
                           </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-sm font-black text-slate-900">$ {g.monto.toLocaleString('es-CL')}</span>
                        </td>
                        <td className="px-8 py-5 uppercase tracking-widest">
                          {getStatusBadge(g.estado)}
                        </td>
                        {activeTab === 'aprobaciones' && (
                          <td className="px-8 py-5 text-right">
                             {g.estado === 'PENDIENTE' ? (
                               <div className="flex items-center justify-end gap-2">
                                 <button 
                                   onClick={() => handleUpdateStatus(g._id, 'RECHAZADO')}
                                   className="p-3 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all shadow-sm border border-red-100"
                                 >
                                   <XCircle size={18} strokeWidth={3} />
                                 </button>
                                 <button 
                                   onClick={() => handleUpdateStatus(g._id, 'APROBADO')}
                                   className="p-3 bg-emerald-50 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-2xl transition-all shadow-sm border border-emerald-100"
                                 >
                                   <CheckCircle2 size={18} strokeWidth={3} />
                                 </button>
                               </div>
                             ) : (
                               <button 
                                 onClick={() => window.open(g.comprobanteUrl)}
                                 className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                               >
                                 Ver Boleta
                               </button>
                             )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Stats Summary (Supervisor) */}
      {isSupervisor && activeTab === 'aprobaciones' && (
        <div className="max-w-7xl mx-auto mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white/60 backdrop-blur-lg border border-white p-6 rounded-[2rem] shadow-xl shadow-slate-100">
             <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-50 p-2.5 rounded-2xl text-blue-600"><Wallet size={20}/></div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fondo Rendido</h3>
             </div>
             <p className="text-2xl font-black text-slate-900">$ {gastos.reduce((s, g) => s + (g.estado !== 'RECHAZADO' ? g.monto : 0), 0).toLocaleString('es-CL')}</p>
          </div>
          <div className="bg-white/60 backdrop-blur-lg border border-white p-6 rounded-[2rem] shadow-xl shadow-slate-100">
             <div className="flex items-center gap-3 mb-4">
                <div className="bg-amber-50 p-2.5 rounded-2xl text-amber-600"><Clock size={20}/></div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Por Aprobar</h3>
             </div>
             <p className="text-2xl font-black text-slate-900">{gastos.filter(g => g.estado === 'PENDIENTE').length} <span className="text-sm text-slate-400 ml-1">Solics.</span></p>
          </div>
        </div>
      )}

      {/* TOAST INTERNO */}
      {toast && (
        <div className={`fixed bottom-8 right-8 z-[200] px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-wide shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white'}`}>
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
};


export default RindeGastos;

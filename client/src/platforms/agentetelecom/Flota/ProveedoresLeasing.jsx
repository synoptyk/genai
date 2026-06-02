import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../auth/AuthContext';
import axios from 'axios';
import { 
  Building2, Search, Plus, Phone, Mail, 
  MapPin, Settings, Car, Shield, MoreVertical, Edit2, Trash2, 
  CheckCircle2, XCircle, CreditCard, DollarSign, Activity
} from 'lucide-react';

import API_URL from '../../../config';

const ProveedoresLeasing = () => {
  const { user } = useAuth();
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [indicadores, setIndicadores] = useState({ uf: null, usd: null });
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    nombre: '',
    rut: '',
    contacto: { nombre: '', telefono: '', email: '' },
    serviciosContratados: [],
    segurosIncluidos: [],
    valores: { 
      monedas: { rentaBase: 'CLP', seguroAdicional: 'CLP', gps: 'CLP', deducibleSiniestro: 'CLP' },
      rentaBase: 0, seguroAdicional: 0, gps: 0, deducibleSiniestro: 0 
    },
    estadoContrato: 'Activo'
  });

  const [inputServicio, setInputServicio] = useState('');
  const [inputSeguro, setInputSeguro] = useState('');

  useEffect(() => {
    fetchProveedores();
    fetchIndicadores();
  }, []);

  const fetchIndicadores = async () => {
    try {
      const res = await axios.get('https://mindicador.cl/api');
      setIndicadores({ uf: res.data.uf.valor, usd: res.data.dolar.valor });
    } catch (error) {
      console.error('Error fetching indicadores:', error);
    }
  };

  const fetchProveedores = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/flota/proveedores`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      setProveedores(res.data);
    } catch (error) {
      console.error('Error fetching proveedores:', error);
      alert('Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  };

  const filteredProveedores = useMemo(() => {
    if (!searchTerm) return proveedores;
    const lowerSearch = searchTerm.toLowerCase();
    return proveedores.filter(p => 
      p.nombre?.toLowerCase().includes(lowerSearch) ||
      p.rut?.toLowerCase().includes(lowerSearch) ||
      p.contacto?.nombre?.toLowerCase().includes(lowerSearch)
    );
  }, [proveedores, searchTerm]);

  // KPIs
  const kpis = useMemo(() => {
    const total = proveedores.length;
    const activos = proveedores.filter(p => p.estadoContrato === 'Activo').length;
    const gastoMensual = proveedores.reduce((sum, p) => {
      const v = p.valores || {};
      const m = v.monedas || {};
      
      const calcVal = (val, moneda) => {
        let factor = 1;
        if (moneda === 'UF' && indicadores.uf) factor = indicadores.uf;
        if (moneda === 'USD' && indicadores.usd) factor = indicadores.usd;
        return (val || 0) * factor;
      };

      const base = calcVal(v.rentaBase, m.rentaBase) + 
                   calcVal(v.seguroAdicional, m.seguroAdicional) + 
                   calcVal(v.gps, m.gps);
      return sum + base;
    }, 0);
    
    return [
      {
        title: 'Total Proveedores',
        value: total,
        icon: Building2,
        color: 'from-blue-500 to-indigo-600',
        bgIcon: 'bg-blue-100 text-blue-600'
      },
      {
        title: 'Contratos Activos',
        value: activos,
        icon: CheckCircle2,
        color: 'from-emerald-500 to-teal-600',
        bgIcon: 'bg-emerald-100 text-emerald-600'
      },
      {
        title: 'Gasto Base Estimado',
        value: new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(gastoMensual),
        icon: DollarSign,
        color: 'from-amber-500 to-orange-600',
        bgIcon: 'bg-amber-100 text-amber-600'
      }
    ];
  }, [proveedores]);

  const openModal = (proveedor = null) => {
    if (proveedor) {
      setEditingId(proveedor._id);
      setFormData({
        nombre: proveedor.nombre || '',
        rut: proveedor.rut || '',
        contacto: { 
          nombre: proveedor.contacto?.nombre || '', 
          telefono: proveedor.contacto?.telefono || '', 
          email: proveedor.contacto?.email || '' 
        },
        serviciosContratados: proveedor.serviciosContratados || [],
        segurosIncluidos: proveedor.segurosIncluidos || [],
        valores: { 
          monedas: {
            rentaBase: proveedor.valores?.monedas?.rentaBase || 'CLP',
            seguroAdicional: proveedor.valores?.monedas?.seguroAdicional || 'CLP',
            gps: proveedor.valores?.monedas?.gps || 'CLP',
            deducibleSiniestro: proveedor.valores?.monedas?.deducibleSiniestro || 'CLP',
          },
          rentaBase: proveedor.valores?.rentaBase || 0, 
          seguroAdicional: proveedor.valores?.seguroAdicional || 0, 
          gps: proveedor.valores?.gps || 0, 
          deducibleSiniestro: proveedor.valores?.deducibleSiniestro || 0 
        },
        estadoContrato: proveedor.estadoContrato || 'Activo'
      });
    } else {
      setEditingId(null);
      setFormData({
        nombre: '',
        rut: '',
        contacto: { nombre: '', telefono: '', email: '' },
        serviciosContratados: [],
        segurosIncluidos: [],
        valores: { 
          monedas: { rentaBase: 'CLP', seguroAdicional: 'CLP', gps: 'CLP', deducibleSiniestro: 'CLP' },
          rentaBase: 0, seguroAdicional: 0, gps: 0, deducibleSiniestro: 0 
        },
        estadoContrato: 'Activo'
      });
    }
    setInputServicio('');
    setInputSeguro('');
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este proveedor?')) return;
    try {
      await axios.delete(`${API_URL}/api/flota/proveedores/${id}`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      alert('Proveedor eliminado');
      fetchProveedores();
    } catch (error) {
      console.error(error);
      alert('Error al eliminar');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`${API_URL}/api/flota/proveedores/${editingId}`, formData, {
          headers: { Authorization: `Bearer ${user?.token}` }
        });
        alert('Proveedor actualizado');
      } else {
        await axios.post(`${API_URL}/api/flota/proveedores`, formData, {
          headers: { Authorization: `Bearer ${user?.token}` }
        });
        alert('Proveedor creado');
      }
      setIsModalOpen(false);
      fetchProveedores();
    } catch (error) {
      console.error(error);
      alert('Error al guardar');
    }
  };

  const addServicio = () => {
    if (inputServicio.trim()) {
      setFormData(prev => ({
        ...prev,
        serviciosContratados: [...prev.serviciosContratados, inputServicio.trim()]
      }));
      setInputServicio('');
    }
  };

  const removeServicio = (index) => {
    setFormData(prev => ({
      ...prev,
      serviciosContratados: prev.serviciosContratados.filter((_, i) => i !== index)
    }));
  };

  const addSeguro = () => {
    if (inputSeguro.trim()) {
      setFormData(prev => ({
        ...prev,
        segurosIncluidos: [...prev.segurosIncluidos, inputSeguro.trim()]
      }));
      setInputSeguro('');
    }
  };

  const removeSeguro = (index) => {
    setFormData(prev => ({
      ...prev,
      segurosIncluidos: prev.segurosIncluidos.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/30 text-white">
              <Building2 size={24} />
            </div>
            Proveedores Leasing
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-2 ml-1">
            Gestión integral de proveedores, contratos y valores.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Buscar proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-64 bg-white/80 backdrop-blur-sm border-0 ring-1 ring-slate-200/50 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all focus:bg-white"
            />
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:-translate-y-0.5 transition-all"
          >
            <Plus size={18} />
            Nuevo Proveedor
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {kpis.map((kpi, index) => (
          <div key={index} className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-3xl p-6 shadow-xl shadow-slate-200/30 relative overflow-hidden group">
            <div className={`absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-br ${kpi.color} rounded-full opacity-10 group-hover:opacity-20 transition-opacity blur-2xl`}></div>
            <div className="flex items-start justify-between relative z-10">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">{kpi.title}</p>
                <h3 className="text-3xl font-black tracking-tighter text-slate-900">{kpi.value}</h3>
              </div>
              <div className={`p-3 rounded-2xl ${kpi.bgIcon}`}>
                <kpi.icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* GRID DE PROVEEDORES */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProveedores.length === 0 ? (
            <div className="col-span-full py-20 text-center">
              <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-lg font-bold text-slate-600">No hay proveedores registrados</p>
              <p className="text-sm text-slate-500 mt-1">Comienza agregando un nuevo proveedor de leasing.</p>
            </div>
          ) : (
            filteredProveedores.map(proveedor => (
              <div key={proveedor._id} className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 group flex flex-col h-full">
                {/* Header Card */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center border border-white shadow-sm flex-shrink-0">
                      <Building2 size={24} className="text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">{proveedor.nombre}</h3>
                      <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        proveedor.estadoContrato === 'Activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${proveedor.estadoContrato === 'Activo' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                        {proveedor.estadoContrato}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openModal(proveedor)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(proveedor._id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Body Card */}
                <div className="space-y-4 flex-1">
                  {/* Contact Info */}
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100/50 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone size={14} className="text-slate-400" />
                      <span className="font-medium">{proveedor.contacto?.telefono || 'Sin teléfono'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Mail size={14} className="text-slate-400" />
                      <span className="font-medium truncate">{proveedor.contacto?.email || 'Sin email'}</span>
                    </div>
                  </div>

                  {/* Pricing Info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Renta Base</p>
                      <p className="text-sm font-black text-slate-800">
                        {proveedor.valores?.monedas?.rentaBase === 'UF' ? `${proveedor.valores?.rentaBase || 0} UF` : 
                         proveedor.valores?.monedas?.rentaBase === 'USD' ? `USD ${proveedor.valores?.rentaBase || 0}` : 
                         `$${proveedor.valores?.rentaBase?.toLocaleString('es-CL') || '0'}`}
                      </p>
                      {(proveedor.valores?.monedas?.rentaBase === 'UF' || proveedor.valores?.monedas?.rentaBase === 'USD') && (
                        <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                          ~ ${Math.round((proveedor.valores?.rentaBase || 0) * (proveedor.valores?.monedas?.rentaBase === 'UF' ? indicadores.uf : indicadores.usd) || 0).toLocaleString('es-CL')}
                        </p>
                      )}
                    </div>
                    <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Deducible</p>
                      <p className="text-sm font-black text-slate-800">
                        {proveedor.valores?.monedas?.deducibleSiniestro === 'UF' ? `${proveedor.valores?.deducibleSiniestro || 0} UF` : 
                         proveedor.valores?.monedas?.deducibleSiniestro === 'USD' ? `USD ${proveedor.valores?.deducibleSiniestro || 0}` : 
                         `$${proveedor.valores?.deducibleSiniestro?.toLocaleString('es-CL') || '0'}`}
                      </p>
                      {(proveedor.valores?.monedas?.deducibleSiniestro === 'UF' || proveedor.valores?.monedas?.deducibleSiniestro === 'USD') && (
                        <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                          ~ ${Math.round((proveedor.valores?.deducibleSiniestro || 0) * (proveedor.valores?.monedas?.deducibleSiniestro === 'UF' ? indicadores.uf : indicadores.usd) || 0).toLocaleString('es-CL')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Chips (Servicios & Seguros) */}
                  {(proveedor.serviciosContratados?.length > 0 || proveedor.segurosIncluidos?.length > 0) && (
                    <div className="pt-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Incluye</p>
                      <div className="flex flex-wrap gap-2">
                        {proveedor.serviciosContratados?.slice(0, 2).map((s, idx) => (
                          <span key={`serv-${idx}`} className="px-2 py-1 bg-sky-50 text-sky-700 rounded-lg text-[10px] font-bold border border-sky-100 flex items-center gap-1">
                            <Settings size={10} /> {s}
                          </span>
                        ))}
                        {proveedor.segurosIncluidos?.slice(0, 2).map((s, idx) => (
                          <span key={`seg-${idx}`} className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold border border-emerald-100 flex items-center gap-1">
                            <Shield size={10} /> {s}
                          </span>
                        ))}
                        {(proveedor.serviciosContratados?.length + proveedor.segurosIncluidos?.length > 4) && (
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold">
                            +{proveedor.serviciosContratados.length + proveedor.segurosIncluidos.length - 4} más
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MODAL FORM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl relative z-10 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                  {editingId ? <Edit2 size={20} /> : <Plus size={20} />}
                </div>
                {editingId ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <XCircle size={24} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <form id="proveedorForm" onSubmit={handleSubmit} className="space-y-8">
                
                {/* Sección 1: Datos Generales */}
                <div>
                  <h3 className="text-sm font-black text-indigo-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Building2 size={16} className="text-indigo-500" />
                    Datos Comerciales
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre Proveedor *</label>
                      <input 
                        required type="text" 
                        value={formData.nombre} 
                        onChange={e => setFormData({...formData, nombre: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800 transition-all focus:bg-white"
                        placeholder="Ej: Mitta, Tattersall..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">RUT Empresa</label>
                      <input 
                        type="text" 
                        value={formData.rut} 
                        onChange={e => setFormData({...formData, rut: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800 transition-all focus:bg-white"
                        placeholder="Ej: 76.123.456-7"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Estado Contrato</label>
                      <select 
                        value={formData.estadoContrato} 
                        onChange={e => setFormData({...formData, estadoContrato: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 transition-all focus:bg-white"
                      >
                        <option value="Activo">🟢 ACTIVO</option>
                        <option value="Inactivo">🔴 INACTIVO</option>
                      </select>
                    </div>
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* Sección 2: Contacto */}
                <div>
                  <h3 className="text-sm font-black text-emerald-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Phone size={16} className="text-emerald-500" />
                    Contacto Principal
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre</label>
                      <input 
                        type="text" 
                        value={formData.contacto.nombre} 
                        onChange={e => setFormData({...formData, contacto: {...formData.contacto, nombre: e.target.value}})}
                        className="w-full px-4 py-3 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800 transition-all focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Teléfono</label>
                      <input 
                        type="text" 
                        value={formData.contacto.telefono} 
                        onChange={e => setFormData({...formData, contacto: {...formData.contacto, telefono: e.target.value}})}
                        className="w-full px-4 py-3 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800 transition-all focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                      <input 
                        type="email" 
                        value={formData.contacto.email} 
                        onChange={e => setFormData({...formData, contacto: {...formData.contacto, email: e.target.value}})}
                        className="w-full px-4 py-3 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800 transition-all focus:bg-white"
                      />
                    </div>
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* Sección 3: Valores Comerciales */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-amber-900 uppercase tracking-wider flex items-center gap-2">
                      <DollarSign size={16} className="text-amber-500" />
                      Valores Comerciales
                    </h3>
                  </div>
                  {(indicadores.uf || indicadores.usd) && (
                    <div className="mb-4 text-xs font-bold text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-4">
                      <div className="flex items-center gap-2"><Activity size={14} className="text-indigo-500" /> Valores Referenciales Banco Central:</div>
                      {indicadores.uf && <span>UF: <span className="text-indigo-700">${indicadores.uf?.toLocaleString('es-CL')}</span></span>}
                      {indicadores.usd && <span>USD: <span className="text-indigo-700">${indicadores.usd?.toLocaleString('es-CL')}</span></span>}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Renta Base</label>
                      <div className="relative flex">
                        <select
                          value={formData.valores.monedas.rentaBase}
                          onChange={e => setFormData({...formData, valores: {...formData.valores, monedas: {...formData.valores.monedas, rentaBase: e.target.value}}})}
                          className="bg-slate-100 border-0 ring-1 ring-slate-200 rounded-l-xl px-2 py-3 text-xs font-bold text-slate-500 focus:ring-2 focus:ring-amber-500 focus:z-10 cursor-pointer"
                        >
                          <option value="CLP">$</option>
                          <option value="UF">UF</option>
                          <option value="USD">US$</option>
                        </select>
                        <input 
                          type="number" min="0" step="any"
                          value={formData.valores.rentaBase} 
                          onChange={e => setFormData({...formData, valores: {...formData.valores, rentaBase: Number(e.target.value)}})}
                          className="w-full px-4 py-3 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-r-xl focus:ring-2 focus:ring-amber-500 font-black text-slate-800 transition-all focus:bg-white focus:z-10"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Seguro Adic.</label>
                      <div className="relative flex">
                        <select
                          value={formData.valores.monedas.seguroAdicional}
                          onChange={e => setFormData({...formData, valores: {...formData.valores, monedas: {...formData.valores.monedas, seguroAdicional: e.target.value}}})}
                          className="bg-slate-100 border-0 ring-1 ring-slate-200 rounded-l-xl px-2 py-3 text-xs font-bold text-slate-500 focus:ring-2 focus:ring-amber-500 focus:z-10 cursor-pointer"
                        >
                          <option value="CLP">$</option>
                          <option value="UF">UF</option>
                          <option value="USD">US$</option>
                        </select>
                        <input 
                          type="number" min="0" step="any"
                          value={formData.valores.seguroAdicional} 
                          onChange={e => setFormData({...formData, valores: {...formData.valores, seguroAdicional: Number(e.target.value)}})}
                          className="w-full px-4 py-3 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-r-xl focus:ring-2 focus:ring-amber-500 font-black text-slate-800 transition-all focus:bg-white focus:z-10"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Valor GPS</label>
                      <div className="relative flex">
                        <select
                          value={formData.valores.monedas.gps}
                          onChange={e => setFormData({...formData, valores: {...formData.valores, monedas: {...formData.valores.monedas, gps: e.target.value}}})}
                          className="bg-slate-100 border-0 ring-1 ring-slate-200 rounded-l-xl px-2 py-3 text-xs font-bold text-slate-500 focus:ring-2 focus:ring-amber-500 focus:z-10 cursor-pointer"
                        >
                          <option value="CLP">$</option>
                          <option value="UF">UF</option>
                          <option value="USD">US$</option>
                        </select>
                        <input 
                          type="number" min="0" step="any"
                          value={formData.valores.gps} 
                          onChange={e => setFormData({...formData, valores: {...formData.valores, gps: Number(e.target.value)}})}
                          className="w-full px-4 py-3 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-r-xl focus:ring-2 focus:ring-amber-500 font-black text-slate-800 transition-all focus:bg-white focus:z-10"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 text-rose-500">Deducible Sin.</label>
                      <div className="relative flex">
                        <select
                          value={formData.valores.monedas.deducibleSiniestro}
                          onChange={e => setFormData({...formData, valores: {...formData.valores, monedas: {...formData.valores.monedas, deducibleSiniestro: e.target.value}}})}
                          className="bg-slate-100 border-0 ring-1 ring-slate-200 rounded-l-xl px-2 py-3 text-xs font-bold text-slate-500 focus:ring-2 focus:ring-rose-500 focus:z-10 cursor-pointer"
                        >
                          <option value="CLP">$</option>
                          <option value="UF">UF</option>
                          <option value="USD">US$</option>
                        </select>
                        <input 
                          type="number" min="0" step="any"
                          value={formData.valores.deducibleSiniestro} 
                          onChange={e => setFormData({...formData, valores: {...formData.valores, deducibleSiniestro: Number(e.target.value)}})}
                          className="w-full px-4 py-3 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-r-xl focus:ring-2 focus:ring-rose-500 font-black text-slate-800 transition-all focus:bg-white focus:z-10"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* Sección 4: Servicios y Seguros */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Servicios */}
                  <div>
                    <h3 className="text-sm font-black text-sky-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Settings size={16} className="text-sky-500" />
                      Servicios Incluidos
                    </h3>
                    <div className="flex gap-2 mb-3">
                      <input 
                        type="text" 
                        value={inputServicio} 
                        onChange={e => setInputServicio(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addServicio())}
                        className="flex-1 px-4 py-2 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 text-sm transition-all focus:bg-white"
                        placeholder="Ej: Mantención 10.000 KM"
                      />
                      <button type="button" onClick={addServicio} className="p-2 bg-sky-100 text-sky-600 hover:bg-sky-200 rounded-xl transition-colors font-bold text-sm px-4">Agregar</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.serviciosContratados.map((s, idx) => (
                        <span key={idx} className="px-3 py-1.5 bg-sky-50 text-sky-700 rounded-lg text-xs font-bold border border-sky-100 flex items-center gap-2">
                          {s}
                          <button type="button" onClick={() => removeServicio(idx)} className="text-sky-400 hover:text-sky-700"><XCircle size={14} /></button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Seguros */}
                  <div>
                    <h3 className="text-sm font-black text-teal-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Shield size={16} className="text-teal-500" />
                      Seguros Incluidos
                    </h3>
                    <div className="flex gap-2 mb-3">
                      <input 
                        type="text" 
                        value={inputSeguro} 
                        onChange={e => setInputSeguro(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSeguro())}
                        className="flex-1 px-4 py-2 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 text-sm transition-all focus:bg-white"
                        placeholder="Ej: Seguro Resp. Civil"
                      />
                      <button type="button" onClick={addSeguro} className="p-2 bg-teal-100 text-teal-600 hover:bg-teal-200 rounded-xl transition-colors font-bold text-sm px-4">Agregar</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.segurosIncluidos.map((s, idx) => (
                        <span key={idx} className="px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg text-xs font-bold border border-teal-100 flex items-center gap-2">
                          {s}
                          <button type="button" onClick={() => removeSeguro(idx)} className="text-teal-400 hover:text-teal-700"><XCircle size={14} /></button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

              </form>
            </div>

            {/* Footer */}
            <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/80 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                form="proveedorForm"
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all flex items-center gap-2"
              >
                <CheckCircle2 size={18} />
                {editingId ? 'Guardar Cambios' : 'Crear Proveedor'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default ProveedoresLeasing;

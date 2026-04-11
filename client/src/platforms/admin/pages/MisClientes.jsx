import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Mail, Phone, MapPin, Edit3, Trash2, CheckCircle2, XCircle, Info, Briefcase, ChevronRight, Filter, Download } from 'lucide-react';
import { telecomApi as api } from '../../agentetelecom/telecomApi';
import { useCheckPermission } from '../../../hooks/useCheckPermission';

const MisClientes = () => {
    const { hasPermission } = useCheckPermission();
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        nombre: '',
        rut: '',
        direccion: '',
        contacto: '',
        email: '',
        telefono: '',
        estado: 'Activo',
        descripcion: ''
    });

    const canCreate = hasPermission('admin_mis_clientes', 'crear');
    const canEdit = hasPermission('admin_mis_clientes', 'editar');
    const canDelete = hasPermission('admin_mis_clientes', 'eliminar');

    useEffect(() => {
        fetchClientes();
    }, []);

    const fetchClientes = async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/clientes');
            setClientes(res.data);
            setError(null);
        } catch (err) {
            setError('Error al cargar clientes');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (client = null) => {
        if (!client && !canCreate) {
            alert('No tienes permiso para crear clientes.');
            return;
        }
        if (client && !canEdit) {
            alert('No tienes permiso para editar clientes.');
            return;
        }

        if (client) {
            setEditingClient(client);
            setFormData({ ...client });
        } else {
            setEditingClient(null);
            setFormData({
                nombre: '',
                rut: '',
                direccion: '',
                contacto: '',
                email: '',
                telefono: '',
                estado: 'Activo',
                descripcion: ''
            });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (editingClient && !canEdit) {
            alert('No tienes permiso para editar clientes.');
            return;
        }
        if (!editingClient && !canCreate) {
            alert('No tienes permiso para crear clientes.');
            return;
        }
        try {
            if (editingClient) {
                await api.put(`/admin/clientes/${editingClient._id}`, formData);
            } else {
                await api.post('/admin/clientes', formData);
            }
            setShowModal(false);
            fetchClientes();
        } catch (err) {
            alert('Error al guardar el cliente');
        }
    };

    const handleDelete = async (id) => {
        if (!canDelete) {
            alert('No tienes permiso para eliminar clientes.');
            return;
        }
        if (window.confirm('¿Estás seguro de eliminar este cliente?')) {
            try {
                await api.delete(`/admin/clientes/${id}`);
                fetchClientes();
            } catch (err) {
                alert('Error al eliminar');
            }
        }
    };

    const filteredClientes = clientes.filter(c => 
        c.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.rut?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.contacto?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading && clientes.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-transparent">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-10 space-y-10 max-w-7xl mx-auto animate-in fade-in duration-700">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-indigo-900 tracking-tight flex items-center gap-3">
                        <Users className="w-10 h-10 text-indigo-600" />
                        Mis Clientes
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100 flex items-center gap-1.5 ml-2">
                            <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse"></span>
                            Crystal Admin
                        </span>
                    </h1>
                    <p className="text-indigo-400 font-bold text-sm mt-2 uppercase tracking-widest flex items-center gap-2">
                        Gestión Centralizada de Cartera y Proyectos
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    disabled={!canCreate}
                    className="group relative flex items-center gap-3 bg-indigo-600 text-white px-8 py-4 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-1 transition-all active:scale-95 overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                    <Plus className="w-4 h-4" /> Registrar Nuevo Cliente
                </button>
            </div>

            {/* STATS MINI BARS (CRYSTAL) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                    { label: 'Total Clientes', value: clientes.length, icon: Briefcase, color: 'indigo' },
                    { label: 'Activos', value: clientes.filter(c => c.estado === 'Activo').length, icon: CheckCircle2, color: 'emerald' },
                    { label: 'Inactivos', value: clientes.filter(c => c.estado !== 'Activo').length, icon: XCircle, color: 'amber' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white/70 backdrop-blur-xl border border-indigo-100/50 rounded-[2.5rem] p-6 shadow-xl shadow-indigo-100/20 group hover:border-indigo-300 transition-all">
                        <div className="flex items-center gap-4">
                            <div className={`p-4 bg-${stat.color}-50 text-${stat.color}-600 rounded-2xl group-hover:scale-110 transition-transform`}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                                <p className="text-2xl font-black text-indigo-900 tracking-tight">{stat.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* SEARCH & FILTER AREA */}
            <div className="bg-white/40 backdrop-blur-md border border-indigo-100/30 rounded-[2.5rem] p-6 flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-300" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, RUT o contacto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/80 border border-indigo-100 rounded-2xl pl-14 pr-6 py-4 text-sm font-bold text-indigo-900 placeholder:text-indigo-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all shadow-sm"
                    />
                </div>
                <div className="flex gap-2">
                    <button className="p-4 bg-white border border-indigo-100 rounded-2xl text-indigo-400 hover:text-indigo-600 hover:border-indigo-300 transition-all shadow-sm active:scale-95">
                        <Filter className="w-5 h-5" />
                    </button>
                    <button className="p-4 bg-white border border-indigo-100 rounded-2xl text-indigo-400 hover:text-indigo-600 hover:border-indigo-300 transition-all shadow-sm active:scale-95">
                        <Download className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* CLIENTS LIST (PREMIUM CARDS / TABLE) */}
            <div className="bg-white/80 backdrop-blur-2xl border border-indigo-100/50 rounded-[3rem] shadow-2xl shadow-indigo-100/30 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-indigo-50/50 border-b border-indigo-100/50">
                                <th className="px-8 py-6 text-left text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Cliente / Empresa</th>
                                <th className="px-8 py-6 text-left text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Identificación</th>
                                <th className="px-8 py-6 text-left text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Contacto Principal</th>
                                <th className="px-8 py-6 text-center text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Estado</th>
                                <th className="px-8 py-6 text-right text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-indigo-50/50">
                            {filteredClientes.map((cliente) => (
                                <tr key={cliente._id} className="group hover:bg-indigo-50/20 transition-all duration-300 cursor-default">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg group-hover:scale-110 transition-transform">
                                                {cliente.nombre?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-black text-indigo-900 uppercase text-sm tracking-tight leading-none mb-1">{cliente.nombre}</p>
                                                <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">{cliente.direccion || 'Sin dirección'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[11px] font-black font-mono border border-indigo-100">
                                            {cliente.rut || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="space-y-1">
                                            <p className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                                                <Users className="w-3.5 h-3.5 text-indigo-400" />
                                                {cliente.contacto || 'No asignado'}
                                            </p>
                                            <p className="text-[11px] font-semibold text-indigo-400 flex items-center gap-2 lowercase">
                                                <Mail className="w-3.5 h-3.5" /> {cliente.email || '—'}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex justify-center">
                                            {cliente.estado === 'Activo' ? (
                                                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-3 h-3" /> Activo
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-100 flex items-center gap-1.5">
                                                    <XCircle className="w-3 h-3" /> Inactivo
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center justify-end gap-2 translate-x-2 opacity-60 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                            <button 
                                                onClick={() => handleOpenModal(cliente)}
                                                disabled={!canEdit}
                                                className="p-3 hover:bg-indigo-600 hover:text-white rounded-2xl text-indigo-400 transition-all active:scale-90"
                                            >
                                                <Edit3 className="w-5 h-5" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(cliente._id)}
                                                disabled={!canDelete}
                                                className="p-3 hover:bg-red-500 hover:text-white rounded-2xl text-red-400 transition-all active:scale-90"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredClientes.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="py-24 text-center">
                                        <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-500">
                                            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-200">
                                                <Briefcase className="w-10 h-10" />
                                            </div>
                                            <div>
                                                <p className="text-[12px] font-black text-indigo-400 uppercase tracking-[0.2em]">No se encontraron clientes</p>
                                                <p className="text-sm font-semibold text-indigo-300 mt-1">Registra nuevos clientes para comenzar a vincular proyectos.</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL (CRYSTAL FORMS) */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-indigo-950/20 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white border border-indigo-100 rounded-[3rem] p-8 md:p-12 w-full max-w-4xl shadow-[0_50px_100px_-20px_rgba(79,70,229,0.25)] relative overflow-hidden my-auto max-h-[95vh] overflow-y-auto">
                        {/* Modal Glow */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 opacity-60"></div>
                        
                        <div className="relative z-10 flex items-center justify-between mb-10">
                            <div>
                                <h3 className="text-3xl font-black text-indigo-900 tracking-tight">
                                    {editingClient ? 'Actualizar Cliente' : 'Registrar Nuevo Cliente'}
                                </h3>
                                <p className="text-indigo-400 font-bold text-sm mt-1 uppercase tracking-widest">
                                    Configuración de Identidad y Contacto
                                </p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-4 hover:bg-indigo-50 rounded-3xl text-indigo-300 hover:text-indigo-600 transition-all">
                                <XCircle className="w-8 h-8" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="relative z-10 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-1">Nombre Comercial *</label>
                                    <input 
                                        type="text" required
                                        value={formData.nombre}
                                        onChange={e => setFormData({...formData, nombre: e.target.value})}
                                        className="w-full bg-indigo-50/30 border border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all"
                                        placeholder="Ej: Antigravity Corp."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-1">RUT / Identificador</label>
                                    <input 
                                        type="text"
                                        value={formData.rut}
                                        onChange={e => setFormData({...formData, rut: e.target.value})}
                                        className="w-full bg-indigo-50/30 border border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all"
                                        placeholder="Ej: 76.123.456-K"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-1">Dirección de Operación</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-300" />
                                        <input 
                                            type="text"
                                            value={formData.direccion}
                                            onChange={e => setFormData({...formData, direccion: e.target.value})}
                                            className="w-full bg-indigo-50/30 border border-indigo-100 rounded-2xl pl-14 pr-6 py-4 text-sm font-bold text-indigo-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all"
                                            placeholder="Ciudad, Calle, Oficina..."
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-1">Persona de Contacto</label>
                                    <input 
                                        type="text"
                                        value={formData.contacto}
                                        onChange={e => setFormData({...formData, contacto: e.target.value})}
                                        className="w-full bg-indigo-50/30 border border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all"
                                        placeholder="Nombre del responsable"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-1">Correo Electrónico</label>
                                    <input 
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({...formData, email: e.target.value})}
                                        className="w-full bg-indigo-50/30 border border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all"
                                        placeholder="email@cliente.com"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-1">Teléfono</label>
                                    <input 
                                        type="text"
                                        value={formData.telefono}
                                        onChange={e => setFormData({...formData, telefono: e.target.value})}
                                        className="w-full bg-indigo-50/30 border border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all"
                                        placeholder="+56 9 ..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-1">Estado de Cuenta</label>
                                    <select 
                                        value={formData.estado}
                                        onChange={e => setFormData({...formData, estado: e.target.value})}
                                        className="w-full bg-indigo-50/30 border border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all cursor-pointer"
                                    >
                                        <option value="Activo">Activo</option>
                                        <option value="Inactivo">Inactivo</option>
                                    </select>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-1">Descripción o Notas</label>
                                    <textarea 
                                        value={formData.descripcion}
                                        onChange={e => setFormData({...formData, descripcion: e.target.value})}
                                        className="w-full bg-indigo-50/30 border border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all resize-none"
                                        rows="3"
                                        placeholder="Detalles adicionales sobre el cliente o el tipo de servicios..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-8 border-t border-indigo-50">
                                <button 
                                    type="button" 
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-5 rounded-3xl border border-indigo-100 text-indigo-400 font-black text-[11px] uppercase tracking-widest hover:bg-indigo-50 transition-all active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-2 py-5 rounded-3xl bg-indigo-600 text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 transition-all active:scale-95"
                                >
                                    {editingClient ? 'Guardar Cambios' : 'Finalizar Registro'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MisClientes;

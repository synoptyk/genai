import React, { useState, useEffect } from 'react';
import { 
    Plus, 
    Search, 
    UserPlus, 
    Mail, 
    Phone, 
    Tag, 
    MapPin, 
    MoreVertical,
    Edit3,
    Trash2,
    CheckCircle2
} from 'lucide-react';
import logisticaApi from '../logisticaApi';
import { formatRut, validateRut } from '../../../utils/rutUtils';

const Proveedores = () => {
    const [proveedores, setProveedores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [form, setForm] = useState({
        rut: '',
        nombre: '',
        contacto: '',
        email: '',
        telefono: '',
        rubro: '',
        direccion: ''
    });

    const fetchProveedores = async () => {
        try {
            const res = await logisticaApi.get('/proveedores');
            setProveedores(res.data);
        } catch (e) {
            console.error("Error fetching providers", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProveedores();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editing) {
                await logisticaApi.put(`/proveedores/${editing._id}`, form);
            } else {
                await logisticaApi.post('/proveedores', form);
            }
            setShowModal(false);
            setEditing(null);
            setForm({ rut: '', nombre: '', contacto: '', email: '', telefono: '', rubro: '', direccion: '' });
            fetchProveedores();
        } catch (err) {
            alert("Error al guardar proveedor: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (p) => {
        setEditing(p);
        setForm({
            rut: p.rut,
            nombre: p.nombre,
            contacto: p.contacto || '',
            email: p.email || '',
            telefono: p.telefono || '',
            rubro: p.rubro || '',
            direccion: p.direccion || ''
        });
        setShowModal(true);
    };

    const filtered = proveedores.filter(p => 
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.rut.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.rubro?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Gestión de Proveedores</h1>
                    <p className="text-slate-500 text-sm">Directorio maestro de proveedores para compras y servicios.</p>
                </div>
                <button 
                    onClick={() => { setEditing(null); setForm({ rut: '', nombre: '', contacto: '', email: '', telefono: '', rubro: '', direccion: '' }); setShowModal(true); }}
                    className="px-6 py-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-slate-200"
                >
                    <UserPlus size={18} />
                    Nuevo Proveedor
                </button>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Buscar por nombre, RUT o rubro..."
                    className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-3xl focus:ring-4 focus:ring-slate-900/5 transition-all text-sm font-medium shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    [1,2,3].map(i => <div key={i} className="h-64 bg-slate-50 rounded-[2.5rem] animate-pulse" />)
                ) : filtered.map(p => (
                    <div key={p._id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group overflow-hidden border-b-4 border-b-slate-50 hover:border-b-indigo-500">
                        <div className="p-8">
                            <div className="flex items-start justify-between mb-6">
                                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shadow-inner">
                                    <Tag size={24} />
                                </div>
                                <button 
                                    onClick={() => handleEdit(p)}
                                    className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                                >
                                    <Edit3 size={18} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 truncate">{p.nombre}</h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.rut}</p>
                                </div>

                                <div className="space-y-2 pt-4">
                                    <div className="flex items-center gap-3 text-slate-500 text-xs font-bold">
                                        <Mail size={14} className="text-slate-300" />
                                        <span className="truncate">{p.email || 'Sin email'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-500 text-xs font-bold">
                                        <Phone size={14} className="text-slate-300" />
                                        <span>{p.telefono || 'Sin teléfono'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-500 text-xs font-bold">
                                        <MapPin size={14} className="text-slate-300" />
                                        <span className="truncate">{p.direccion || 'Sin dirección'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="px-8 py-4 bg-slate-50/50 flex items-center justify-between border-t border-slate-50">
                            <span className="px-3 py-1 bg-white text-indigo-600 text-[10px] font-black uppercase rounded-lg border border-indigo-100 italic">
                                {p.rubro || 'General'}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <CheckCircle2 size={14} className="text-emerald-500" />
                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Activo</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200">
                        <form onSubmit={handleSubmit}>
                            <div className="p-8 border-b border-slate-50">
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">{editing ? 'Editar' : 'Nuevo'} Proveedor</h2>
                                <p className="text-slate-400 text-sm font-medium">Completa los datos fiscales y de contacto.</p>
                            </div>
                            
                            <div className="p-8 grid grid-cols-2 gap-6">
                                <div className="space-y-2 col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre Comercial / Razón Social</label>
                                    <input 
                                        required
                                        value={form.nombre}
                                        onChange={e => setForm({...form, nombre: e.target.value})}
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none ring-2 ring-transparent focus:ring-slate-100 transition-all"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">RUT Empresa</label>
                                    <input 
                                        required
                                        placeholder="Ej: 76.123.456-7"
                                        value={form.rut}
                                        onChange={e => setForm({...form, rut: formatRut(e.target.value)})}
                                        className={`w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none ring-2 ring-transparent focus:ring-slate-100 transition-all ${form.rut && !validateRut(form.rut) ? 'bg-rose-50 text-rose-600 ring-rose-300' : ''}`}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rubro / Especialidad</label>
                                    <input 
                                        value={form.rubro}
                                        onChange={e => setForm({...form, rubro: e.target.value})}
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                    />
                                </div>

                                <div className="space-y-2 col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Persona de Contacto</label>
                                    <input 
                                        value={form.contacto}
                                        onChange={e => setForm({...form, contacto: e.target.value})}
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</label>
                                    <input 
                                        type="email"
                                        value={form.email}
                                        onChange={e => setForm({...form, email: e.target.value})}
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Teléfono</label>
                                    <input 
                                        value={form.telefono}
                                        onChange={e => setForm({...form, telefono: e.target.value})}
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                    />
                                </div>

                                <div className="space-y-2 col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dirección Comercial</label>
                                    <input 
                                        value={form.direccion}
                                        onChange={e => setForm({...form, direccion: e.target.value})}
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                    />
                                </div>
                            </div>

                            <div className="p-8 bg-slate-50 flex items-center justify-end gap-3 rounded-b-[2.5rem]">
                                <button 
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-3 text-slate-400 font-bold text-xs uppercase hover:text-slate-600"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" disabled={saving}
                                    className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl disabled:opacity-50 active:scale-95 transition-all"
                                >
                                    {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear Proveedor'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Proveedores;

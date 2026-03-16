import React, { useState, useEffect } from 'react';
import { 
    Settings, Warehouse, Tags, Box, Plus, Search, 
    MoreHorizontal, MapPin, Truck, User, ArrowRight,
    Anchor, Repeat, ChevronRight, Archive
} from 'lucide-react';
import logisticaApi from '../logisticaApi';

const ConfigLogistica = () => {
    const [activeTab, setActiveTab] = useState('bodegas');
    const [data, setData] = useState({ almacenes: [], categorias: [], productos: [], tecnicos: [], clientes: [] });
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form states
    const [almForm, setAlmForm] = useState({ nombre: '', codigo: '', tipo: 'Central', parentAlmacen: '', tecnicoRef: '', ubicacion: { direccion: '' }, propiedad: 'Propio', clienteRef: '' });
    const [catForm, setCatForm] = useState({ nombre: '', prioridadValor: 'Bajo Valor', tipoRotacion: 'Rotativo' });
    const [prodForm, setProdForm] = useState({ nombre: '', sku: '', categoria: '', marca: '', modelo: '', tipo: 'Activo', segmentacion: 'Estándar', propiedad: 'Propio', clienteRef: '', valorUnitario: 0 });

    useEffect(() => {
        fetchMasterData();
    }, []);

    const fetchMasterData = async () => {
        try {
            const res = await logisticaApi.get('/configuracion-maestra');
            setData(res.data);
        } catch (e) {
            console.error("Error fetching master config", e);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const endpoint = activeTab === 'bodegas' ? '/almacenes' : activeTab === 'categorias' ? '/categorias' : '/productos';
            const payload = activeTab === 'bodegas' ? almForm : activeTab === 'categorias' ? catForm : prodForm;
            await logisticaApi.post(endpoint, payload);
            setShowModal(false);
            fetchMasterData();
        } catch (err) {
            alert("Error: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-slate-900 text-white rounded-[2rem] shadow-2xl shadow-slate-200">
                        <Settings size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Centro de Configuración Logística</h1>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Ecosistema 360 / Bodegas, Categorías y Activos</p>
                    </div>
                </div>
                <button 
                    onClick={() => setShowModal(true)}
                    className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-3"
                >
                    <Plus size={18} /> Crear {activeTab === 'bodegas' ? 'Bodega' : activeTab === 'categorias' ? 'Categoría' : 'Producto'}
                </button>
            </header>

            {/* TABS */}
            <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[2rem] w-fit">
                {['bodegas', 'categorias', 'productos'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <main className="grid grid-cols-1 gap-6">
                {loading ? (
                    <div className="py-20 text-center animate-pulse text-slate-300 font-black uppercase tracking-widest">Sincronizando Ecosistema...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activeTab === 'bodegas' && data.almacenes.map(alm => (
                            <ConfigCard key={alm._id} icon={<Warehouse size={20}/>} title={alm.nombre} sub={alm.codigo} type={alm.tipo}>
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center justify-between text-[10px] font-bold">
                                        <span className="text-slate-400 uppercase">Jerarquía:</span>
                                        <span className="text-slate-800">{alm.parentAlmacen?.nombre || 'Bodega Raíz'}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] font-bold">
                                        <span className="text-slate-400 uppercase">Responsable:</span>
                                        <span className="text-slate-800">{alm.tecnicoRef ? `${alm.tecnicoRef.nombres} ${alm.tecnicoRef.apellidos}` : 'No Asignado'}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] font-bold">
                                        <span className="text-slate-400 uppercase">Propiedad:</span>
                                        <span className={`px-2 py-0.5 rounded-lg ${alm.propiedad === 'Propio' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                            {alm.propiedad === 'Propio' ? 'Empresa' : alm.clienteRef?.nombre || 'Cliente'}
                                        </span>
                                    </div>
                                </div>
                            </ConfigCard>
                        ))}

                        {activeTab === 'categorias' && data.categorias.map(cat => (
                            <ConfigCard key={cat._id} icon={<Tags size={20}/>} title={cat.nombre} sub={cat.codigo || 'S/C'} type={cat.prioridadValor}>
                                <p className="mt-4 text-[10px] text-slate-400 font-medium leading-relaxed">{cat.descripcion || 'Configuración base de stock'}</p>
                            </ConfigCard>
                        ))}

                        {activeTab === 'productos' && data.productos.map(prod => (
                            <ConfigCard key={prod._id} icon={<Archive size={20}/>} title={prod.nombre} sub={prod.sku} type={prod.tipo}>
                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    <div className="p-2 bg-slate-50 rounded-xl">
                                        <p className="text-[8px] font-black text-slate-300 uppercase">Marca</p>
                                        <p className="text-[10px] font-black text-slate-700">{prod.marca || 'N/A'}</p>
                                    </div>
                                    <div className="p-2 bg-slate-50 rounded-xl">
                                        <p className="text-[8px] font-black text-slate-300 uppercase">Modelo</p>
                                        <p className="text-[10px] font-black text-slate-700">{prod.modelo || 'N/A'}</p>
                                    </div>
                                    <div className="p-2 bg-slate-50 rounded-xl col-span-2 flex items-center justify-between">
                                        <div>
                                            <p className="text-[8px] font-black text-slate-300 uppercase">Propiedad</p>
                                            <p className="text-[10px] font-black text-slate-700">{prodForm.propiedad === 'Propio' ? 'Empresa' : prodForm.clienteRef?.nombre || 'Cliente'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[8px] font-black text-emerald-300 uppercase">Precio Adq.</p>
                                            <p className="text-[10px] font-black text-emerald-600">${prod.valorUnitario?.toLocaleString() || 0}</p>
                                        </div>
                                    </div>
                                </div>
                            </ConfigCard>
                        ))}
                    </div>
                )}
            </main>

            {/* MODAL UNIFICADO */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
                        <form onSubmit={handleAction}>
                            <div className="p-8 border-b border-slate-50">
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Registro de {activeTab}</h2>
                                <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-1">Configuración Maestra 360</p>
                            </div>

                            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                {activeTab === 'bodegas' && (
                                    <>
                                        <InputField label="Nombre de Bodega/Vehículo" value={almForm.nombre} onChange={v => setAlmForm({...almForm, nombre: v})} />
                                        <div className="grid grid-cols-2 gap-4">
                                            <SelectField label="Tipo Unidad" value={almForm.tipo} onChange={v => setAlmForm({...almForm, tipo: v})} options={['Central', 'Sucursal', 'Móvil', 'Técnico', 'Sub-Bodega']} />
                                            <SelectField label="Propiedad" value={almForm.propiedad} onChange={v => setAlmForm({...almForm, propiedad: v})} options={['Propio', 'Cliente']} />
                                        </div>
                                        {almForm.propiedad === 'Cliente' && (
                                            <SelectField label="Cliente Dueño" value={almForm.clienteRef} onChange={v => setAlmForm({...almForm, clienteRef: v})} options={data?.clientes?.map(c => ({label: c.nombre, value: c._id}))} />
                                        )}
                                        <div className="grid grid-cols-2 gap-4">
                                            <SelectField label="Bodega Padre (Jerarquía)" value={almForm.parentAlmacen} onChange={v => setAlmForm({...almForm, parentAlmacen: v})} options={data?.almacenes?.map(a => ({label: a.nombre, value: a._id}))} />
                                            <SelectField label="Responsable (RRHH)" value={almForm.tecnicoRef} onChange={v => setAlmForm({...almForm, tecnicoRef: v})} options={data?.tecnicos?.map(t => ({label: `${t.nombres} ${t.apellidos} (${t.rut})`, value: t._id}))} />
                                        </div>
                                        <InputField label="Dirección / Ubicación" value={almForm.ubicacion.direccion} onChange={v => setAlmForm({...almForm, ubicacion: { direccion: v }})} />
                                    </>
                                )}

                                {activeTab === 'categorias' && (
                                    <>
                                        <InputField label="Nombre Categoría" value={catForm.nombre} onChange={v => setCatForm({...catForm, nombre: v})} />
                                        <div className="grid grid-cols-2 gap-4">
                                            <SelectField label="Valoración" value={catForm.prioridadValor} onChange={v => setCatForm({...catForm, prioridadValor: v})} options={['Bajo Valor', 'Alto Valor']} />
                                            <SelectField label="Movilidad" value={catForm.tipoRotacion} onChange={v => setCatForm({...catForm, tipoRotacion: v})} options={['Rotativo', 'Estático']} />
                                        </div>
                                    </>
                                )}

                                {activeTab === 'productos' && (
                                    <>
                                        <InputField label="Nombre del Producto" value={prodForm.nombre} onChange={v => setProdForm({...prodForm, nombre: v})} />
                                        <div className="grid grid-cols-2 gap-4">
                                            <SelectField label="Categoría" value={prodForm.categoria} onChange={v => setProdForm({...prodForm, categoria: v})} options={data?.categorias?.map(c => ({label: c.nombre, value: c._id}))} />
                                            <SelectField label="Tipo" value={prodForm.tipo} onChange={v => setProdForm({...prodForm, tipo: v})} options={['Activo', 'Suministro']} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <InputField label="Marca" value={prodForm.marca} onChange={v => setProdForm({...prodForm, marca: v})} />
                                            <InputField label="Modelo" value={prodForm.modelo} onChange={v => setProdForm({...prodForm, modelo: v})} />
                                        </div>
                                        <div className="p-4 bg-emerald-50 rounded-3xl border border-emerald-100">
                                            <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">Precio Unitario de Adquisición ($)</label>
                                            <input 
                                                type="number" required
                                                value={prodForm.valorUnitario}
                                                onChange={e => setProdForm({...prodForm, valorUnitario: parseFloat(e.target.value)})}
                                                className="w-full mt-2 p-4 bg-white border-none rounded-2xl text-sm font-bold outline-none shadow-sm"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <SelectField label="Tipo" value={prodForm.tipo} onChange={v => setProdForm({...prodForm, tipo: v})} options={['Activo', 'Suministro']} />
                                            <SelectField label="Segmentación" value={prodForm.segmentacion} onChange={v => setProdForm({...prodForm, segmentacion: v})} options={['Crítico', 'Estándar', 'Consumo']} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <SelectField label="Propiedad" value={prodForm.propiedad} onChange={v => setProdForm({...prodForm, propiedad: v})} options={['Propio', 'Cliente']} />
                                            {prodForm.propiedad === 'Cliente' && (
                                                <SelectField label="Cliente Dueño" value={prodForm.clienteRef} onChange={v => setProdForm({...prodForm, clienteRef: v})} options={data?.clientes?.map(c => ({label: c.nombre, value: c._id}))} />
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="p-8 bg-slate-50 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 text-[10px] font-black uppercase text-slate-400">Cancelar</button>
                                <button type="submit" disabled={saving} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl disabled:opacity-50">
                                    {saving ? 'Guardando...' : 'Guardar Registro'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const ConfigCard = ({ icon, title, sub, type, children }) => (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all group">
        <div className="flex items-start justify-between mb-6">
            <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-slate-900 group-hover:text-white transition-all">
                {icon}
            </div>
            <div className="px-3 py-1 bg-slate-100 rounded-full text-[8px] font-black uppercase tracking-widest text-slate-500">
                {type}
            </div>
        </div>
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{title}</h3>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">{sub}</p>
        {children}
    </div>
);

const InputField = ({ label, value, onChange }) => (
    <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
        <input 
            required type="text" value={value} 
            onChange={e => onChange(e.target.value)}
            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none ring-2 ring-transparent focus:ring-slate-100 transition-all"
        />
    </div>
);

const SelectField = ({ label, value, onChange, options }) => (
    <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
        <select 
            required value={value} 
            onChange={e => onChange(e.target.value)}
            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
        >
            <option value="">Seleccionar...</option>
            {options && options.map(opt => (
                typeof opt === 'string' 
                ? <option key={opt} value={opt}>{opt}</option>
                : <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    </div>
);

export default ConfigLogistica;

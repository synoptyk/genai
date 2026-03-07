import React, { useState, useEffect } from 'react';
import {
    Camera, MapPin, QrCode, ClipboardCheck,
    CheckCircle2, AlertTriangle, X, Save,
    Truck, User, Calendar, BarChart3
} from 'lucide-react';
import axios from 'axios';
import API_URL from '../../../config';
import { useAuth } from '../../auth/AuthContext';

const CheckListVehicular = ({ vehiculo, tecnico, onSave, onClose }) => {
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [coords, setCoords] = useState(null);
    const [checklist, setChecklist] = useState({
        // Datos de Contexto
        proyecto: '',
        lugar: '',
        licenciaConducir: '',
        vencimientoLicencia: '',
        kmEntrega: '',
        kmDevolucion: '',

        // Exteriores
        lucesPrincipales: 'OK', luzMedia: 'OK', luzStop: 'OK', limpiaParabrisas: 'OK',
        espejoIzq: 'OK', espejoDer: 'OK', vidriosLaterales: 'OK', parabrisasDel: 'OK',
        parabrisasTras: 'OK', taponesLlantas: 'OK', tapaGasolina: 'OK', carroceria: 'OK',
        parachoquesDel: 'OK', parachoquesTras: 'OK', patentes: 'OK', calefaccion: 'OK', radio: 'OK',

        // Interiores
        pantalla: 'OK', bocina: 'OK', encendedor: 'OK', retrovisor: 'OK', cinturones: 'OK',
        pisosGoma: 'OK', jaladorPuertas: 'OK', sujetadorMano: 'OK', tarjetaCombustible: 'OK',
        docSoap: 'OK', docInspeccionTec: 'OK', docPadron: 'OK', docPolizaSeguro: 'OK',
        gata: 'OK', llaveRueda: 'OK', estucheLlave: 'OK', triangulo: 'OK',

        // Accesorios
        llantaRepuesto: 'OK', extintor: 'OK', botiquin: 'OK', portaEscalas: 'OK',
        cajaSeguridad: 'OK', candadoBle: 'OK', chapaSeguridad: 'OK', llaveControl: 'OK',
        manualUso: 'OK', procedimientos: 'OK', correspondeContrato: 'OK', aseo: 'OK',
        estadoPintura: 'OK', estadoCarroceria: 'OK', branding: 'OK',

        combustible: '1/2',
        kilometraje: '',
        observaciones: ''
    });

    const [activeTab, setActiveTab] = useState('exteriores');
    const [photos, setPhotos] = useState({
        frontal: null,
        trasera: null,
        lateralIzq: null,
        lateralDer: null,
        tablero: null,
        adicionales: []
    });

    // 1. Obtener Coordenadas
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => console.error("Error GPS:", err)
            );
        }
    }, []);

    const handlePhotoUpload = (e, target) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (target === 'adicionales') {
                    setPhotos(prev => ({ ...prev, adicionales: [...prev.adicionales, reader.result] }));
                } else {
                    setPhotos(prev => ({ ...prev, [target]: reader.result }));
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            if (tecnico.isPreview) {
                alert('Estás en MODO VISTA PREVIA. No se guardarán datos en el servidor.');
                onSave();
                return;
            }

            const payload = {
                vehiculoId: vehiculo._id,
                tecnicoId: tecnico._id,
                checklist,
                coordenadas: coords,
                fotos: photos,
                fecha: new Date(),
                tipo: 'Asignación'
            };

            await axios.post(`${API_URL}/api/vehiculos/${vehiculo._id}/checklist`, payload);
            alert('Checklist y Asignación guardada con éxito');
            onSave();
        } catch (error) {
            console.error("Error guardando checklist:", error);
            alert('Error al guardar el checklist');
        } finally {
            setLoading(false);
        }
    };

    const OptionRow = ({ label, field, customOpts }) => {
        const opts = customOpts || ['OK', 'DETALLE', 'FALLA'];
        return (
            <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 hover:border-sky-100 transition-colors">
                <span className="text-[10px] font-bold text-slate-500 uppercase leading-tight pr-4">{label}</span>
                <div className="flex gap-1">
                    {opts.map(opt => (
                        <button
                            key={opt}
                            onClick={() => setChecklist(prev => ({ ...prev, [field]: opt }))}
                            className={`min-w-[40px] px-2 py-1.5 rounded-lg text-[9px] font-black transition-all uppercase ${checklist[field] === opt
                                ? opt === 'OK' || opt === 'VIGENTE' || opt === 'LLENO' || opt === 'LIMPIO' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100'
                                    : opt === 'DETALLE' || opt === '1/2' || opt === '3/4' || opt === '1/4' ? 'bg-amber-500 text-white shadow-md shadow-amber-100'
                                        : 'bg-rose-500 text-white shadow-md shadow-rose-100'
                                : 'bg-slate-50 text-slate-300 border border-slate-100'
                                }`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[2000] flex flex-col animate-in fade-in duration-300">
            {/* Header */}
            <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-sky-100 text-sky-600 rounded-2xl">
                        <ClipboardCheck size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Inspección Vehicular v2.0</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Paso {step} de 4</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-3 bg-slate-100 rounded-2xl text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all">
                    <X size={20} />
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-32">

                {/* STEP 1: CONTEXTO Y LICENCIA */}
                {step === 1 && (
                    <div className="space-y-6 animate-in slide-in-from-right duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 rounded-2xl space-y-3 border border-slate-100">
                                <label className="text-[10px] font-black text-slate-400 uppercase italic ml-2">Proyecto / Cliente</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Movistar, Entel..."
                                    className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-all"
                                    value={checklist.proyecto}
                                    onChange={(e) => setChecklist(prev => ({ ...prev, proyecto: e.target.value }))}
                                />
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl space-y-3 border border-slate-100">
                                <label className="text-[10px] font-black text-slate-400 uppercase italic ml-2">Lugar de Inspección</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Bodega Central, Terreno..."
                                    className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-all"
                                    value={checklist.lugar}
                                    onChange={(e) => setChecklist(prev => ({ ...prev, lugar: e.target.value }))}
                                />
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl space-y-3 border border-slate-100">
                                <label className="text-[10px] font-black text-slate-400 uppercase italic ml-2">N° Licencia de Conducir</label>
                                <input
                                    type="text"
                                    placeholder="Ej: 12.345.678-9"
                                    className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-all"
                                    value={checklist.licenciaConducir}
                                    onChange={(e) => setChecklist(prev => ({ ...prev, licenciaConducir: e.target.value }))}
                                />
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl space-y-3 border border-slate-100">
                                <label className="text-[10px] font-black text-slate-400 uppercase italic ml-2">Vencimiento Licencia</label>
                                <input
                                    type="date"
                                    className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-all text-slate-600"
                                    value={checklist.vencimientoLicencia}
                                    onChange={(e) => setChecklist(prev => ({ ...prev, vencimientoLicencia: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="p-6 bg-blue-50 border border-blue-100 rounded-3xl flex items-center gap-4">
                            <Truck className="text-blue-600 shrink-0" size={32} />
                            <div>
                                <p className="text-sm font-black text-blue-900 uppercase">{vehiculo.marca} {vehiculo.modelo}</p>
                                <p className="text-[10px] font-mono font-bold text-blue-600 uppercase">Patente: {vehiculo.patente}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 2: INSPECCION FISICA */}
                {step === 2 && (
                    <div className="space-y-6 animate-in slide-in-from-right duration-300">
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
                            {['exteriores', 'interiores', 'accesorios'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:bg-white/50'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto px-1 custom-scrollbar">
                            {activeTab === 'exteriores' && (
                                <>
                                    <OptionRow label="Luces Principales" field="lucesPrincipales" />
                                    <OptionRow label="Luz Media" field="luzMedia" />
                                    <OptionRow label="Luz Stop" field="luzStop" />
                                    <OptionRow label="Limpia Parabrisas" field="limpiaParabrisas" />
                                    <OptionRow label="Espejo Lateral Izq" field="espejoIzq" />
                                    <OptionRow label="Espejo Lateral Der" field="espejoDer" />
                                    <OptionRow label="Vidrios Laterales" field="vidriosLaterales" />
                                    <OptionRow label="Parabrisas Delantero" field="parabrisasDel" />
                                    <OptionRow label="Parabrisas Trasero" field="parabrisasTras" />
                                    <OptionRow label="Tapones Llantas" field="taponesLlantas" />
                                    <OptionRow label="Tapa Gasolina" field="tapaGasolina" />
                                    <OptionRow label="Carrocería" field="carroceria" />
                                    <OptionRow label="Parachoques Del" field="parachoquesDel" />
                                    <OptionRow label="Parachoques Tras" field="parachoquesTras" />
                                    <OptionRow label="Patentes" field="patentes" />
                                    <OptionRow label="Calefacción" field="calefaccion" />
                                    <OptionRow label="Radio" field="radio" />
                                </>
                            )}
                            {activeTab === 'interiores' && (
                                <>
                                    <OptionRow label="Pantalla" field="pantalla" />
                                    <OptionRow label="Bocina" field="bocina" />
                                    <OptionRow label="Encendedor" field="encendedor" />
                                    <OptionRow label="Retrovisor" field="retrovisor" />
                                    <OptionRow label="Cinturones" field="cinturones" />
                                    <OptionRow label="Pisos Goma" field="pisosGoma" />
                                    <OptionRow label="Jalador Puertas" field="jaladorPuertas" />
                                    <OptionRow label="Sujetador Mano" field="sujetadorMano" />
                                    <OptionRow label="Tarj. Combustible" field="tarjetaCombustible" />
                                    <OptionRow label="DOC SOAP" field="docSoap" />
                                    <OptionRow label="DOC Rev. Técnica" field="docInspeccionTec" />
                                    <OptionRow label="DOC Padrón" field="docPadron" />
                                    <OptionRow label="DOC Seguro" field="docPolizaSeguro" />
                                    <OptionRow label="Gata" field="gata" />
                                    <OptionRow label="Llave Rueda" field="llaveRueda" />
                                    <OptionRow label="Estuche Llave" field="estucheLlave" />
                                    <OptionRow label="Triángulo" field="triangulo" />
                                </>
                            )}
                            {activeTab === 'accesorios' && (
                                <>
                                    <OptionRow label="Llanta Repuesto" field="llantaRepuesto" />
                                    <OptionRow label="Extintor" field="extintor" />
                                    <OptionRow label="Botiquín" field="botiquin" />
                                    <OptionRow label="Porta-Escalas" field="portaEscalas" />
                                    <OptionRow label="Caja Seguridad" field="cajaSeguridad" />
                                    <OptionRow label="Candado BLE" field="candadoBle" />
                                    <OptionRow label="Chapa Seguridad" field="chapaSeguridad" />
                                    <OptionRow label="Llave Control" field="llaveControl" />
                                    <OptionRow label="Manual Uso" field="manualUso" />
                                    <OptionRow label="Procedimientos" field="procedimientos" />
                                    <OptionRow label="Corresponde Contrato" field="correspondeContrato" />
                                    <OptionRow label="Aseo" field="aseo" />
                                    <OptionRow label="Estado Pintura" field="estadoPintura" />
                                    <OptionRow label="Estado Carrocería" field="estadoCarroceria" />
                                    <OptionRow label="Branding" field="branding" />
                                </>
                            )}
                        </div>

                        {activeTab === 'exteriores' && (
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase italic ml-2">Nivel de Combustible</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {['RESERVA', '1/4', '1/2', '3/4', 'LLENO'].map(nivel => (
                                        <button
                                            key={nivel}
                                            onClick={() => setChecklist({ ...checklist, combustible: nivel })}
                                            className={`py-3 rounded-xl text-[9px] font-black transition-all ${checklist.combustible === nivel ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-400 border border-slate-100'}`}
                                        >
                                            {nivel}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 3: FOTOS */}
                {step === 3 && (
                    <div className="space-y-6 animate-in slide-in-from-right duration-300">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {[
                                { id: 'frontal', label: 'Frontal', icon: Truck },
                                { id: 'trasera', label: 'Trasera', icon: Truck },
                                { id: 'lateralIzq', label: 'Lat. Izq', icon: Truck },
                                { id: 'lateralDer', label: 'Lat. Der', icon: Truck },
                                { id: 'tablero', label: 'Tablero/Km', icon: BarChart3 }
                            ].map(quad => (
                                <div key={quad.id} className="relative group">
                                    <label className={`block w-full h-32 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center transition-all cursor-pointer overflow-hidden ${photos[quad.id] ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50'}`}>
                                        <input type="file" className="hidden" accept="image/*" capture="camera" onChange={(e) => handlePhotoUpload(e, quad.id)} />
                                        {photos[quad.id] ? (
                                            <img src={photos[quad.id]} alt={quad.label} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-center">
                                                <Camera className="mx-auto text-slate-300" size={24} />
                                                <span className="text-[9px] font-black text-slate-400 uppercase mt-2 block">{quad.label}</span>
                                            </div>
                                        )}
                                    </label>
                                    {photos[quad.id] && (
                                        <button onClick={() => setPhotos(prev => ({ ...prev, [quad.id]: null }))} className="absolute -top-2 -right-2 p-1 bg-white text-rose-500 border border-rose-100 rounded-full shadow-md"><X size={12} /></button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-3xl space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase italic ml-2">Observaciones Generales</label>
                            <textarea
                                className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-xs outline-none focus:border-blue-500 transition-all resize-none h-24"
                                placeholder="..."
                                value={checklist.observaciones}
                                onChange={(e) => setChecklist(prev => ({ ...prev, observaciones: e.target.value }))}
                            />
                        </div>
                    </div>
                )}

                {/* STEP 4: FIRMA */}
                {step === 4 && (
                    <div className="space-y-6 animate-in slide-in-from-right duration-300">
                        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-[3rem] bg-slate-50 relative">
                            <QrCode className="text-slate-200 mb-4" size={100} />
                            <h3 className="text-lg font-black text-slate-800 uppercase italic tracking-tighter">Firma Digital de Recepción</h3>
                            <div className="mt-8 w-full h-40 bg-white border border-slate-200 rounded-3xl shadow-inner flex items-center justify-center">
                                <span className="text-slate-200 font-black text-[10px] uppercase">Área de Firma</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-white border border-slate-100 rounded-2xl text-center">
                                <p className="text-[8px] font-black text-slate-400 uppercase">Supervisor</p>
                                <p className="text-xs font-black text-slate-700 uppercase">{user?.name?.split(' ')[0]}</p>
                            </div>
                            <div className="p-4 bg-white border border-slate-100 rounded-2xl text-center">
                                <p className="text-[8px] font-black text-slate-400 uppercase">Colaborador</p>
                                <p className="text-xs font-black text-slate-700 uppercase">{tecnico.nombre?.split(' ')[0]}</p>
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* Footer Navigation */}
            <div className="p-6 bg-white border-t border-slate-100 fixed bottom-0 left-0 right-0 z-[2100] flex gap-4">
                {step > 1 && (
                    <button
                        onClick={() => setStep(step - 1)}
                        className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all"
                    >
                        Atrás
                    </button>
                )}
                {step < 4 ? (
                    <button
                        onClick={() => setStep(step + 1)}
                        className="flex-[2] py-4 bg-blue-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200 transition-all hover:scale-[1.02]"
                    >
                        Siguiente Paso
                    </button>
                ) : (
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className={`flex-[2] py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest italic shadow-xl transition-all hover:scale-[1.02] flex items-center justify-center gap-2 ${tecnico.isPreview ? 'bg-amber-500 shadow-amber-200 text-white' : 'bg-emerald-600 shadow-emerald-200 text-white'}`}
                    >
                        {loading ? 'Guardando...' : tecnico.isPreview ? 'Cerrar Vista Previa' : <><Save size={18} /> Finalizar & Asignar</>}
                    </button>
                )}
            </div>
        </div>
    );
};

export default CheckListVehicular;

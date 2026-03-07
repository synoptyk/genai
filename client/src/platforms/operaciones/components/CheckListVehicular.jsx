import React, { useState, useEffect } from 'react';
import {
    Camera, MapPin, QrCode, ClipboardCheck,
    CheckCircle2, AlertTriangle, X, Save,
    Truck, User, Calendar
} from 'lucide-react';
import axios from 'axios';
import API_URL from '../../../config';

const CheckListVehicular = ({ vehiculo, tecnico, onSave, onClose }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [coords, setCoords] = useState(null);
    const [photos, setPhotos] = useState([]);
    const [checklist, setChecklist] = useState({
        niveles: 'OK',
        luces: 'OK',
        neumaticos: 'OK',
        carroceria: 'OK',
        cristales: 'OK',
        documentacion: 'OK',
        limpieza: 'OK',
        extintor: 'VIGENTE',
        kitEmergencia: 'OK',
        combustible: '1/2',
        kilometraje: '',
        observaciones: ''
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

    const handlePhotoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotos(prev => [...prev, reader.result]);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const payload = {
                vehiculoId: vehiculo._id,
                tecnicoId: tecnico._id,
                checklist,
                coordenadas: coords,
                fotos: photos,
                fecha: new Date(),
                tipo: 'Asignación'
            };

            // Simulación de guardado (Podriamos crear un modelo RegistroChecklist si fuera necesario)
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
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 gap-3">
                <span className="text-xs font-black text-slate-600 uppercase italic leading-tight max-w-[140px]">{label}</span>
                <div className="flex flex-wrap gap-2 w-full md:w-auto md:justify-end">
                    {opts.map(opt => (
                        <button
                            key={opt}
                            onClick={() => setChecklist(prev => ({ ...prev, [field]: opt }))}
                            className={`flex-1 md:flex-none px-3 py-2 md:py-1.5 rounded-lg text-[10px] sm:text-xs font-black transition-all uppercase tracking-wide ${checklist[field] === opt
                                ? opt === 'OK' || opt === 'VIGENTE' || opt === 'LLENO' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                                    : opt === 'DETALLE' || opt === '1/2' || opt === '3/4' || opt === '1/4' ? 'bg-amber-500 text-white shadow-lg shadow-amber-200'
                                        : 'bg-rose-500 text-white shadow-lg shadow-rose-200'
                                : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300'
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
                        <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Checklist Vehicular</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Paso {step} de 3</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-3 bg-slate-100 rounded-2xl text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all">
                    <X size={20} />
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-32">

                {step === 1 && (
                    <div className="space-y-6 animate-in slide-in-from-right duration-300">
                        <div className="bg-sky-50 p-6 rounded-[2rem] border border-sky-100 flex flex-col items-center text-center gap-3">
                            <Truck size={48} className="text-sky-600" />
                            <div>
                                <h3 className="text-2xl font-black text-sky-900 uppercase">{vehiculo.patente}</h3>
                                <p className="text-xs font-bold text-sky-600 uppercase italic">{vehiculo.marca} {vehiculo.modelo}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <OptionRow label="Niveles (Aceite/Agua)" field="niveles" />
                            <OptionRow label="Luces (Frontal/Trasera)" field="luces" />
                            <OptionRow label="Neumáticos (Presión/Estado)" field="neumaticos" />
                            <OptionRow label="Carrocería (Golpes)" field="carroceria" />
                            <OptionRow label="Cristales y Espejos" field="cristales" />
                            <OptionRow label="Limpieza Intl/Ext" field="limpieza" customOpts={['LIMPIO', 'DETALLE', 'SUCIO']} />
                            <OptionRow label="Documentación Obligatoria" field="documentacion" />
                            <OptionRow label="Extintor" field="extintor" customOpts={['VIGENTE', 'VENCIDO', 'SIN EXTINTOR']} />
                            <OptionRow label="Kit (Gata/Triángulo/Botiquín)" field="kitEmergencia" customOpts={['OK', 'INCOMPLETO', 'SIN KIT']} />
                        </div>

                        <div className="p-5 bg-amber-50 border border-amber-100 rounded-[2rem] space-y-4">
                            <label className="text-[10px] font-black text-amber-700 uppercase italic ml-2">Nivel de Combustible Actual</label>
                            <div className="flex gap-2">
                                {['RESERVA', '1/4', '1/2', '3/4', 'LLENO'].map(nivel => (
                                    <button
                                        key={nivel}
                                        onClick={() => setChecklist({ ...checklist, combustible: nivel })}
                                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${checklist.combustible === nivel
                                            ? nivel === 'RESERVA' ? 'bg-rose-500 text-white shadow-lg shadow-rose-200'
                                                : nivel === 'LLENO' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                                                    : 'bg-amber-500 text-white shadow-lg shadow-amber-200'
                                            : 'bg-white text-amber-600/50 border border-amber-200 hover:bg-amber-100/50'
                                            }`}
                                    >
                                        {nivel}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Kilometraje Actual</label>
                            <input
                                type="number"
                                className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl text-lg font-black text-slate-700 outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-400 transition-all"
                                placeholder="Ej: 45000"
                                value={checklist.kilometraje}
                                onChange={e => setChecklist({ ...checklist, kilometraje: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6 animate-in slide-in-from-right duration-300">
                        <h3 className="text-lg font-black text-slate-800 uppercase italic">Evidencia & Ubicación</h3>

                        {/* GPS Info */}
                        <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-center gap-4">
                            <div className="p-3 bg-emerald-500 text-white rounded-2xl rotate-12 shadow-lg shadow-emerald-200">
                                <MapPin size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-emerald-600 uppercase italic">Coordenadas Capturadas</p>
                                <p className="text-sm font-mono font-bold text-emerald-800">
                                    {coords ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}` : 'Obteniendo GPS...'}
                                </p>
                            </div>
                        </div>

                        {/* Photo Capture */}
                        <div className="space-y-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase italic ml-2">Fotos del Vehículo (Mín. 4)</p>
                            <div className="grid grid-cols-2 gap-4">
                                {photos.map((src, i) => (
                                    <div key={i} className="relative aspect-square rounded-3xl overflow-hidden border-2 border-slate-200 group">
                                        <img src={src} className="w-full h-full object-cover" alt="Checklist" />
                                        <button
                                            onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                                            className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                                {photos.length < 8 && (
                                    <label className="aspect-square rounded-3xl border-4 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-300 hover:border-sky-300 hover:text-sky-300 transition-all cursor-pointer">
                                        <Camera size={32} />
                                        <span className="text-[10px] font-black uppercase">Tomar Foto</span>
                                        <input type="file" accept="image/*" capture="camera" className="hidden" onChange={handlePhotoUpload} />
                                    </label>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-8 animate-in slide-in-from-right duration-300 flex flex-col items-center">
                        <div className="p-8 bg-violet-50 border-2 border-dashed border-violet-200 rounded-[3rem] w-full max-w-sm flex flex-col items-center gap-6 text-center">
                            <div className="p-6 bg-violet-600 text-white rounded-[2rem] shadow-2xl shadow-violet-200">
                                <QrCode size={64} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-violet-900 uppercase">Firma Digital QR</h3>
                                <p className="text-xs text-violet-600 font-bold italic mt-2">
                                    El técnico debe escanear para confirmar la recepción del vehículo conforme al checklist.
                                </p>
                            </div>
                            <div className="bg-white p-4 rounded-3xl shadow-sm border border-violet-100">
                                <div className="w-48 h-48 bg-slate-100 flex items-center justify-center text-slate-300 italic text-[10px] font-bold">
                                    [GENERANDO QR...]
                                </div>
                            </div>
                        </div>

                        <div className="w-full space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase italic ml-2">Observaciones Finales</label>
                            <textarea
                                className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold text-slate-700 outline-none h-32 resize-none"
                                placeholder="Escribe aquí cualquier detalle adicional..."
                                value={checklist.observaciones}
                                onChange={e => setChecklist({ ...checklist, observaciones: e.target.value })}
                            />
                        </div>
                    </div>
                )}

            </div>

            {/* Footer Navigation */}
            <div className="p-6 bg-white border-t border-slate-100 fixed bottom-0 left-0 right-0 z-[2100] flex gap-4">
                {step > 1 && (
                    <button
                        onClick={() => setStep(step - 1)}
                        className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-[1.5rem] font-black text-xs uppercase tracking-widest italic transition-all hover:bg-slate-200"
                    >
                        Atrás
                    </button>
                )}
                {step < 3 ? (
                    <button
                        disabled={step === 1 && !checklist.kilometraje}
                        onClick={() => setStep(step + 1)}
                        className="flex-[2] py-4 bg-sky-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest italic shadow-xl shadow-sky-200 transition-all hover:scale-[1.02] disabled:opacity-50"
                    >
                        Continuar
                    </button>
                ) : (
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-[2] py-4 bg-emerald-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest italic shadow-xl shadow-emerald-200 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                    >
                        {loading ? 'Guardando...' : <><Save size={18} /> Finalizar & Asignar</>}
                    </button>
                )}
            </div>
        </div>
    );
};

export default CheckListVehicular;

import React from 'react';
import { Loader2, CheckCircle2, MapPin, AlertTriangle, XCircle, X } from 'lucide-react';
import FirmaAvanzada from '../../../../components/FirmaAvanzada';

export const IdentificacionSection = ({
    form,
    setForm,
    formType,
    tecEncontrado,
    searchingTec,
    handleRutChange,
    handleSearchRut,
    handleGetGps,
    esVehicular = false
}) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[
            ['rutTrabajador', esVehicular ? 'RUT Conductor *' : 'RUT Trabajador *'],
            ['nombreTrabajador', esVehicular ? 'Nombre del Conductor *' : 'Nombre del Trabajador *'],
            ['cargoTrabajador', 'Cargo'],
            ['empresa', 'Empresa *'],
            ['ot', 'OT / Proyecto'],
            ['lugarInspeccion', 'Lugar de Inspección'],
        ].map(([key, label]) => (
            <div key={key} className="space-y-1.5 text-left relative">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                    {label}
                    {key === 'rutTrabajador' && tecEncontrado && <span className="text-emerald-500 text-[8px] font-black uppercase">✓ Encontrado</span>}
                </label>
                <div className="relative">
                    <input
                        type="text"
                        className={`w-full px-5 py-3.5 rounded-2xl font-bold text-[11px] uppercase outline-none transition-all ${key !== 'rutTrabajador' && tecEncontrado && form[key] ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 focus:ring-4 focus:ring-emerald-500/10' : 'bg-white border border-slate-200 focus:ring-4 focus:ring-rose-500/10'}`}
                        value={form[key] || ''}
                        onChange={e => {
                            if (key === 'rutTrabajador') {
                                handleRutChange(e.target.value, setForm);
                            } else {
                                setForm(p => ({ ...p, [key]: e.target.value }));
                            }
                        }}
                        onBlur={() => {
                            if (key === 'rutTrabajador' && form.rutTrabajador && !tecEncontrado) {
                                handleSearchRut(form.rutTrabajador, setForm);
                            }
                        }}
                    />
                    {key === 'rutTrabajador' && searchingTec && <Loader2 className="absolute right-4 top-3.5 animate-spin text-rose-500" size={16} />}
                    {key === 'rutTrabajador' && tecEncontrado && !searchingTec && <CheckCircle2 className="absolute right-4 top-3.5 text-emerald-500" size={16} />}
                </div>
            </div>
        ))}
        <div className="space-y-1.5 text-left">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">GPS (Coordenadas)</label>
            <button
                type="button"
                onClick={() => handleGetGps(formType)}
                className={`w-full px-5 py-3.5 rounded-2xl border font-bold text-[11px] uppercase transition-all flex items-center gap-3 ${form.gps ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-400 hover:border-rose-300 hover:text-rose-600'}`}
            >
                <MapPin size={16} />
                {form.gps || 'Capturar Posición GPS'}
            </button>
        </div>
    </div>
);

export const FirmaSection = ({ form, setForm, tecEncontrado, firmaColaborador, setFirmaColaborador, esVehicular = false }) => (
    <div className="space-y-8">
        <div className="space-y-4">
            <p className="text-[9px] font-black text-rose-500 uppercase tracking-[0.3em]">1. Inspector / Supervisor HSE</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[['nombre', 'Nombre Inspector *'], ['cargo', 'Cargo Inspector'], ['rut', 'RUT Inspector'], ['email', 'Email Inspector']].map(([key, label]) => (
                    <div key={key} className="space-y-1.5 text-left">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</label>
                        <input
                            type={key === 'email' ? 'email' : 'text'}
                            className="w-full px-5 py-3.5 rounded-2xl bg-white border border-slate-200 font-bold text-[11px] uppercase outline-none focus:ring-4 focus:ring-rose-500/10"
                            value={form.inspector?.[key] || ''}
                            onChange={e => setForm(p => ({ ...p, inspector: { ...p.inspector, [key]: e.target.value } }))}
                        />
                    </div>
                ))}
            </div>
            <FirmaAvanzada
                label="Firma del Inspector HSE"
                rutFirmante={form.inspector?.rut || ''}
                nombreFirmante={form.inspector?.nombre || ''}
                emailFirmante={form.inspector?.email || ''}
                onSave={(payload) => setForm(p => ({ ...p, inspector: { ...p.inspector, firma: payload?.imagenBase64 || null, firmaId: payload?.firmaId || null, timestamp: payload?.timestamp || null } }))}
                colorAccent="rose"
            />
            {form.inspector?.firma && (
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-2xl w-fit">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span className="text-[10px] font-black text-emerald-700 uppercase">Inspector firmó</span>
                </div>
            )}
        </div>
        <div className="space-y-4 pt-6 border-t border-slate-100">
            <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.3em]">{`2. ${esVehicular ? 'Conductor' : 'Trabajador'} Inspeccionado`}</p>
            <div className="space-y-1.5 text-left relative">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                    Email del {esVehicular ? 'Conductor' : 'Trabajador'} (para envío de informe)
                    {tecEncontrado && form.emailTrabajador && <span className="text-emerald-500 text-[8px] font-black uppercase">✓ Auto-completado</span>}
                </label>
                <div className="relative">
                    <input
                        type="email"
                        className={`w-full px-5 py-3.5 rounded-2xl font-bold text-[11px] outline-none transition-all focus:ring-4 ${tecEncontrado && form.emailTrabajador ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 focus:ring-emerald-500/10' : 'bg-white border border-slate-200 focus:ring-indigo-500/10'}`}
                        value={form.emailTrabajador || ''}
                        placeholder="correo@ejemplo.com"
                        onChange={e => setForm(p => ({ ...p, emailTrabajador: e.target.value }))}
                    />
                    {tecEncontrado && form.emailTrabajador && <CheckCircle2 className="absolute right-4 top-3.5 text-emerald-500" size={16} />}
                </div>
            </div>
            <FirmaAvanzada
                label={`Firma del ${esVehicular ? 'Conductor' : 'Trabajador'}`}
                rutFirmante={form.rutTrabajador || ''}
                nombreFirmante={form.nombreTrabajador || ''}
                emailFirmante={form.emailTrabajador || ''}
                onSave={(payload) => setFirmaColaborador(payload)}
                colorAccent="blue"
            />
            {firmaColaborador?.imagenBase64 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-2xl w-fit">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span className="text-[10px] font-black text-emerald-700 uppercase">{esVehicular ? 'Conductor' : 'Trabajador'} firmó</span>
                </div>
            )}
        </div>
    </div>
);

export const SectionTitle = ({ icon: Icon, title, accent = 'rose' }) => (
    <div className="flex items-center gap-4">
        <div className={`p-3 rounded-2xl ${accent === 'orange' ? 'bg-orange-100 text-orange-600' : accent === 'blue' ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>
            <Icon size={20} />
        </div>
        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{title}</h4>
    </div>
);

export const CheckItem = ({ label, checked, onToggle, children, small = false }) => (
    <div className="space-y-2">
        <div
            onClick={() => onToggle(!checked)}
            className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${checked ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-100 hover:border-rose-300'} ${small ? 'ml-4' : ''}`}
        >
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${checked ? 'bg-emerald-500 text-white' : 'bg-white border-2 border-slate-200 text-slate-300'}`}>
                {checked ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            </div>
            <span className={`font-black uppercase text-[10px] tracking-tight flex-1 ${checked ? 'text-emerald-700' : 'text-rose-700'}`}>{label}</span>
            <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${checked ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'}`}>
                {checked ? 'Cumple' : 'No Cumple'}
            </span>
        </div>
        {children && <div>{children}</div>}
    </div>
);

export const AlertModal = ({ alert, setAlert }) => {
    if (!alert) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white rounded-[3.5rem] p-12 max-w-md w-full shadow-2xl text-center flex flex-col items-center gap-8 animate-in zoom-in-95">
                <div className={`p-6 rounded-[2rem] ${alert.type === 'error' ? 'bg-rose-100 text-rose-600' : alert.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    {alert.type === 'error' ? <AlertTriangle size={48} /> : <CheckCircle2 size={48} />}
                </div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-relaxed">{alert.message}</h4>
                <div className="flex gap-4 w-full">
                    {alert.type === 'confirm' ? (
                        <>
                            <button onClick={() => setAlert(null)} className="flex-1 py-5 rounded-full border-2 border-slate-100 text-slate-400 font-black text-[10px] uppercase hover:bg-slate-50 transition-all">No</button>
                            <button onClick={() => { alert.onConfirm?.(); setAlert(null); }} className="flex-1 py-5 rounded-full bg-slate-900 text-white font-black text-[10px] uppercase hover:bg-rose-600 transition-all">Sí</button>
                        </>
                    ) : (
                        <button onClick={() => setAlert(null)} className="w-full py-5 rounded-full bg-slate-900 text-white font-black text-[10px] uppercase hover:bg-slate-800 transition-all">Cerrar</button>
                    )}
                </div>
            </div>
        </div>
    );
};

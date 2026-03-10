import React, { useState, useEffect } from 'react';
import {
    Building2, FileKey2, FileDigit, Settings, Bot, ArrowRightLeft,
    ShieldCheck, CloudCog, ShieldAlert, CheckCircle2, ChevronRight, Save, Lock
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import API_URL from '../../../config';

const IntegracionesSII = () => {
    const { user } = useAuth();

    // States: RPA Lector Panel
    const [robotStatus, setRobotStatus] = useState('disconnected'); // disconnected, connecting, active
    const [rpaData, setRpaData] = useState({
        rutEmpresa: '',
        rutAuth: '',
        passwordAuth: '' // NOTA DE SEGURIDAD: Esto se cifrará en backend
    });

    // States: Emisor DTE Panel
    const [dteStatus, setDteStatus] = useState('pending'); // pending, uploading, verified
    const [certFile, setCertFile] = useState(null);
    const [certPassword, setCertPassword] = useState('');

    useEffect(() => {
        const checkStatus = async () => {
            try {
                if (!user || !user.token) return;
                const res = await fetch(`${API_URL}/api/admin/sii/status`, {
                    headers: { 'Authorization': `Bearer ${user.token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.rpaActivo) {
                        setRobotStatus('active');
                        setRpaData(prev => ({ ...prev, rutEmpresa: data.rutEmpresa || '', rutAuth: data.rutAutorizado || '' }));
                    }
                    if (data.hasCertificado) {
                        setDteStatus('verified');
                    }
                }
            } catch (e) { console.error("Error validando estado del SII:", e); }
        };
        checkStatus();
    }, []);

    const handleRPASumbit = async (e) => {
        e.preventDefault();
        setRobotStatus('connecting');
        try {
            if (!user || !user.token) return alert("Sesión inválida");
            const res = await fetch(`${API_URL}/api/admin/sii/rpa`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    rutEmpresa: rpaData.rutEmpresa,
                    rutAutorizado: rpaData.rutAuth,
                    claveTributaria: rpaData.passwordAuth
                })
            });
            if (res.ok) {
                setRobotStatus('active');
            } else {
                setRobotStatus('disconnected');
                alert('Fallo de validación. Verifica las credenciales e intenta nuevamente.');
            }
        } catch (e) {
            setRobotStatus('disconnected');
            console.error(e);
            alert('Error al conectar el robot a la API principal.');
        }
    };

    const handleResetRPA = async () => {
        if (!window.confirm("¿Estás seguro de que deseas eliminar las credenciales del SII? Perderás la conexión con el robot.")) return;
        setRobotStatus('connecting');
        try {
            const res = await fetch(`${API_URL}/api/admin/sii/rpa`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (res.ok) {
                setRobotStatus('disconnected');
                setRpaData({ rutEmpresa: '', rutAuth: '', passwordAuth: '' });
                alert("Bóveda reseteada exitosamente.");
            } else {
                setRobotStatus('active');
                alert("No se pudo resetear la bóveda.");
            }
        } catch (e) {
            setRobotStatus('active');
            console.error(e);
            alert("Error de conexión al resetear bóveda.");
        }
    };

    const handleDTEUpload = async (e) => {
        e.preventDefault();
        setDteStatus('uploading');
        try {
            if (!user || !user.token) return alert("Sesión inválida");
            const formData = new FormData();
            formData.append('certificadoPfx', certFile);
            formData.append('password', certPassword);

            const res = await fetch(`${API_URL}/api/admin/sii/upload-cert`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${user.token}`
                },
                body: formData
            });

            if (res.ok) {
                setDteStatus('verified');
            } else {
                setDteStatus('pending');
                alert('No se pudo firmar el Certificado Digital en Tránsito.');
            }
        } catch (e) {
            setDteStatus('pending');
            console.error(e);
            alert('Error procesando archivo criptográfico localmente.');
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto pb-24">

            {/* ── ENCABEZADO PREMIUM ── */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden mb-8 border border-slate-800">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>

                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="w-24 h-24 bg-white/10 rounded-3xl border border-white/20 flex flex-col items-center justify-center p-4 shadow-xl backdrop-blur-md shrink-0">
                        <Building2 size={40} className="text-indigo-400 mb-2" />
                        <span className="text-[10px] font-black tracking-widest uppercase text-white">SII Chile</span>
                    </div>

                    <div className="flex-1 text-center md:text-left">
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2 flex items-center justify-center md:justify-start gap-3">
                            Integraciones Gubernamentales
                            <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                                <ShieldCheck size={12} /> Nivel Bancario
                            </div>
                        </h1>
                        <p className="text-indigo-200/80 font-semibold text-sm max-w-2xl leading-relaxed">
                            Conecta GenAI directamente con el Servicio de Impuestos Internos. Automatiza la descarga histórica de tu RCV mediante Robots de Software y habilita tu plataforma para la emisión legal de Facturas Electrónicas (DTE).
                        </p>
                    </div>
                </div>
            </div>

            {/* ── GRID DE PANELES ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* ── PANEL 1: ROBOT DE EXTRACCIÓN (RPA) ── */}
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    {/* Header Panel 1 */}
                    <div className="p-8 pb-6 border-b border-slate-100 flex items-start gap-5 bg-gradient-to-b from-slate-50 to-white relative">
                        {robotStatus === 'active' && <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 animate-pulse"></div>}
                        <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                            <Bot size={28} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                                Sincronización Inteligente (RPA)
                            </h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Robot Lector del SII</p>
                            <p className="text-slate-500 text-sm font-semibold mt-3 leading-relaxed">
                                Ingresa las credenciales del SII para que GenAI descargue automáticamente todas las noches tu Registro de Compras y Ventas. Solo usaremos estos datos para nutrir tus Gráficos Financieros.
                            </p>
                        </div>
                    </div>

                    {/* Content Panel 1 */}
                    <div className="p-8">
                        {robotStatus === 'active' ? (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center animate-in zoom-in duration-300">
                                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 ring-4 ring-emerald-50 shadow-lg">
                                    <CloudCog size={32} />
                                </div>
                                <h3 className="text-emerald-800 font-black text-lg">Conexión Activa</h3>
                                <p className="text-emerald-600/80 font-semibold text-sm mt-1 max-w-xs">
                                    El Robot está monitoreando y descargando la actividad de {user?.empresa?.nombre || 'la Empresa'} diariamente.
                                </p>
                                <div className="flex gap-4 mt-6">
                                    <button onClick={() => setRobotStatus('disconnected')} className="text-xs font-bold text-emerald-600 hover:text-emerald-800 underline uppercase tracking-widest">
                                        Editar Datos
                                    </button>
                                    <button onClick={handleResetRPA} className="text-xs font-bold text-rose-500 hover:text-rose-700 underline uppercase tracking-widest">
                                        Resetear Bóveda
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleRPASumbit} className="space-y-5">
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 mb-6">
                                    <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-bold text-amber-800 uppercase tracking-widest mb-1">Entorno Seguro AES-256</p>
                                        <p className="text-xs text-amber-700/80 font-medium">Tus credenciales son cifradas en tránsito y en reposo. Nadie en GenAI, ni desarrolladores, tiene acceso a tu Clave Tributaria real.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">RUT Empresa (Opcional si es P. Natural)</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: 77.216.779-2"
                                            value={rpaData.rutEmpresa}
                                            onChange={(e) => setRpaData({ ...rpaData, rutEmpresa: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-shadow"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">RUT Autorizado (Conectado)</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: 15.123.456-7"
                                            value={rpaData.rutAuth}
                                            onChange={(e) => setRpaData({ ...rpaData, rutAuth: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-shadow"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Clave Tributaria SII</label>
                                    <div className="relative">
                                        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="password"
                                            placeholder="••••••••"
                                            value={rpaData.passwordAuth}
                                            onChange={(e) => setRpaData({ ...rpaData, passwordAuth: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-shadow"
                                            required
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={robotStatus === 'connecting'}
                                    className="w-full mt-2 bg-indigo-600 text-white font-black text-sm uppercase tracking-widest py-4 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {robotStatus === 'connecting' ? (
                                        <><ArrowRightLeft size={18} className="animate-spin" /> Conectando API...</>
                                    ) : (
                                        <><CheckCircle2 size={18} /> Conectar Robot al Servidor</>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>


                {/* ── PANEL 2: EMISOR ELECTRÓNICO (DTE) ── */}
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    {/* Header Panel 2 */}
                    <div className="p-8 pb-6 border-b border-slate-100 flex items-start gap-5 bg-gradient-to-b from-slate-50 to-white relative">
                        {dteStatus === 'verified' && <div className="absolute top-0 left-0 w-full h-1 bg-violet-500 animate-pulse"></div>}
                        <div className="w-14 h-14 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                            <FileKey2 size={28} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">
                                Facturación y Emisión (DTE)
                            </h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Carga de Certificado Digital</p>
                            <p className="text-slate-500 text-sm font-semibold mt-3 leading-relaxed">
                                Carga tu Certificado Centralizado para habilitar a GenAI como tu emisor de facturas, boletas y notas de crédito. El SII exige este archivo en formato PFX/P12 para firmar legalmente tus ventas.
                            </p>
                        </div>
                    </div>

                    {/* Content Panel 2 */}
                    <div className="p-8">
                        {dteStatus === 'verified' ? (
                            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center animate-in zoom-in duration-300">
                                <div className="w-16 h-16 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center mb-4 ring-4 ring-violet-50 shadow-lg">
                                    <ShieldCheck size={32} />
                                </div>
                                <h3 className="text-violet-800 font-black text-lg">Certificado Instalado</h3>
                                <p className="text-violet-600/80 font-semibold text-sm mt-1 max-w-xs">
                                    Tu empresa está habilitada para emitir documentos tributarios oficiales directamente desde la suite GenAI.
                                </p>
                                <div className="mt-5 px-4 py-2 bg-white rounded-xl border border-violet-100 shadow-sm flex items-center justify-between w-full max-w-[200px]">
                                    <div className="text-left">
                                        <p className="text-[9px] font-black text-slate-400 tracking-widest uppercase">Vencimiento</p>
                                        <p className="text-xs font-bold text-slate-700">12 Dic 2027</p>
                                    </div>
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                </div>
                                <button onClick={() => setDteStatus('pending')} className="mt-6 text-[10px] font-bold text-slate-400 hover:text-red-500 hover:underline uppercase tracking-widest transition-colors">
                                    Eliminar y Reemplazar Certificado
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleDTEUpload} className="space-y-5">

                                <div className="border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-violet-300 transition-colors rounded-2xl p-6 text-center cursor-pointer relative overflow-hidden group">
                                    <input
                                        type="file"
                                        accept=".pfx,.p12"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        onChange={(e) => setCertFile(e.target.files[0])}
                                    />
                                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400 group-hover:text-violet-500 transition-colors">
                                        <FileDigit size={24} />
                                    </div>
                                    <h4 className="text-sm font-black text-slate-700">
                                        {certFile ? certFile.name : 'Subir Certificado Digital'}
                                    </h4>
                                    <p className="text-xs font-semibold text-slate-400 mt-1">
                                        {certFile ? 'Archivo seleccionado correctamente.' : 'Arrastra o haz clic aquí (Soporta archivos .pfx o .p12)'}
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Contraseña del Certificado</label>
                                    <div className="relative">
                                        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="password"
                                            placeholder="••••••••"
                                            value={certPassword}
                                            onChange={(e) => setCertPassword(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-shadow"
                                            required={certFile !== null}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2 font-semibold">Esta contraseña es provista por tu casa certificadora (Acepta, E-Cert, etc) al momento de descargar tu archivo.</p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={!certFile || dteStatus === 'uploading'}
                                    className="w-full mt-2 bg-slate-900 text-white font-black text-sm uppercase tracking-widest py-4 rounded-xl shadow-lg hover:bg-black transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {dteStatus === 'uploading' ? (
                                        <><ArrowRightLeft size={18} className="animate-spin" /> Instalando...</>
                                    ) : (
                                        <><Save size={18} /> Instalar Certificado F.E.</>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>

            </div>

        </div >
    );
};

export default IntegracionesSII;

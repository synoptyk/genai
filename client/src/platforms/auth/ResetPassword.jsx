import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, Loader2, Eye, EyeOff, CheckCircle2, ChevronLeft } from 'lucide-react';
import { BRAND } from '../../branding/brand';
import axios from 'axios';
import API_URL from '../../config';

const ResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const API_BASE = `${API_URL}/api`;

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setLoading(true);
        try {
            const { data } = await axios.post(`${API_BASE}/auth/reset-password/${token}`, { password });
            setSuccess(data.message);
        } catch (err) {
            setError(err.response?.data?.message || 'Error al restablecer la contraseña.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-white font-sans antialiased relative overflow-hidden">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                body { font-family: 'Inter', sans-serif; }
                .gradient-panel { background: linear-gradient(145deg, #e7eefc 0%, #ebe5ff 35%, #def4ff 100%); }
                .btn-primary { background: linear-gradient(135deg, #4f46e5, #7c3aed); transition: all 0.3s ease; }
                .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(79,70,229,0.35); }
                .input-style { width: 100%; padding: 14px 20px; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 14px; color: #0f172a; font-size: 14px; font-weight: 600; outline: none; transition: all 0.2s ease; }
                .input-style::placeholder { color: #94a3b8; font-weight: 500; }
                .input-style:focus { border-color: #6366f1; background: white; box-shadow: 0 0 0 4px rgba(99,102,241,0.08); }
                .input-icon { padding-left: 48px !important; }
                .label-style { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6366f1; margin-bottom: 8px; margin-left: 4px; }
            `}</style>

            <div className="flex-1 flex flex-col justify-center p-3 sm:p-6 md:p-14 lg:p-16 bg-white relative">
                {/* Mobile logo */}
                <div className="flex items-center justify-center gap-2 sm:gap-3 mb-6 sm:mb-10">
                    <img src={BRAND.logoPath} alt={BRAND.fullName} className="w-8 sm:w-9 h-8 sm:h-9 rounded-xl" />
                    <span className="text-sm sm:text-lg font-black text-slate-900">{BRAND.productName}<span className="text-indigo-600"> by {BRAND.companyName}</span></span>
                </div>

                <div className="w-full max-w-[400px] mx-auto px-2 sm:px-0">
                    {/* Header */}
                    <div className="mb-8 sm:mb-10 text-center">
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-1 sm:mb-2">
                            Restablecer Contraseña
                        </h1>
                        <p className="text-xs sm:text-sm font-medium text-slate-500">
                            Ingresa una nueva contraseña para tu cuenta corporativa.
                        </p>
                        <div className="h-1 w-10 sm:w-12 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full mt-3 sm:mt-5 mx-auto" />
                    </div>

                    {/* Alerts */}
                    {error && (
                        <div className="mb-6 p-4 bg-rose-50 border-2 border-rose-100 rounded-2xl flex items-start gap-3">
                            <div className="w-5 h-5 bg-rose-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-rose-600 text-[10px] font-black">!</span>
                            </div>
                            <p className="text-rose-700 text-[12px] font-semibold leading-relaxed">{error}</p>
                        </div>
                    )}

                    {success ? (
                        <div className="text-center space-y-6">
                            <div className="mb-6 p-6 bg-emerald-50 border-2 border-emerald-100 rounded-3xl flex flex-col items-center justify-center gap-3">
                                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-2">
                                    <CheckCircle2 size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-emerald-800">¡Contraseña Actualizada!</h3>
                                <p className="text-emerald-700 text-[13px] font-medium text-center">{success}</p>
                            </div>
                            
                            <button onClick={() => navigate('/login')}
                                className="btn-primary w-full text-white py-3 sm:py-4 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 sm:gap-3 shadow-lg shadow-indigo-200">
                                Ir a Iniciar Sesión
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleResetPassword} className="space-y-4 sm:space-y-6">
                            <div>
                                <label className="label-style text-xs sm:text-sm">Nueva Contraseña</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                                        className="input-style input-icon pr-14 text-sm py-3 sm:py-4"
                                        placeholder="Min. 6 caracteres" required
                                    />
                                    <button type="button" onClick={() => setShowPass(!showPass)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors">
                                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="label-style text-xs sm:text-sm">Confirmar Nueva Contraseña</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type={showConfirmPass ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                                        className="input-style input-icon pr-14 text-sm py-3 sm:py-4"
                                        placeholder="Confirmar contraseña" required
                                    />
                                    <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors">
                                        {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <button type="submit" disabled={loading}
                                className="btn-primary w-full text-white py-3 sm:py-4 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 sm:gap-3 shadow-lg shadow-indigo-200 disabled:opacity-60">
                                {loading ? <Loader2 className="animate-spin" size={18} /> : <span>Actualizar Contraseña</span>}
                            </button>

                            <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-slate-100 text-center">
                                <button type="button" onClick={() => navigate('/login')}
                                    className="text-[11px] sm:text-[13px] font-black text-indigo-600 hover:text-violet-600 transition-colors underline underline-offset-4 decoration-indigo-200 flex items-center gap-1 sm:gap-2 mx-auto">
                                    <ChevronLeft size={14} /> Volver al Login
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;

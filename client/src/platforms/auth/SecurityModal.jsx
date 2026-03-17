import React, { useState } from 'react';
import { Lock, X, CheckCircle2, ShieldCheck, ChevronLeft, Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';

const SecurityModal = ({ isOpen, onClose }) => {
    const { setupPin } = useAuth();
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [step, setStep] = useState('input'); // input, confirm, success
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSave = async () => {
        if (pin !== confirmPin) {
            setError('Los PIN no coinciden');
            setStep('input');
            setPin('');
            setConfirmPin('');
            return;
        }

        setLoading(true);
        try {
            await setupPin(pin);
            setStep('success');
        } catch (err) {
            setError('Error al guardar el PIN. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyClick = (key) => {
        setError('');
        const currentVal = step === 'input' ? pin : confirmPin;
        if (key === 'back') {
            if (step === 'input') setPin(pin.slice(0, -1));
            else setConfirmPin(confirmPin.slice(0, -1));
        } else {
            if (currentVal.length < 4) {
                const newVal = currentVal + key;
                if (step === 'input') {
                    setPin(newVal);
                    if (newVal.length === 4) setStep('confirm');
                } else {
                    setConfirmPin(newVal);
                }
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-[360px] rounded-[2.5rem] shadow-2xl overflow-hidden relative border border-slate-100 animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 pb-0 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                            <Lock size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Seguridad PIN</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Protección 2FA</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8">
                    {step === 'success' ? (
                        <div className="text-center space-y-6 py-4">
                            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500 shadow-inner">
                                <ShieldCheck size={40} />
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-slate-800 tracking-tight">¡PIN Configurado!</h4>
                                <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed px-4">
                                    Tu cuenta ahora está protegida. Se te pedirá este código en tu próximo inicio de sesión.
                                </p>
                            </div>
                            <button 
                                onClick={onClose}
                                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                            >
                                Entendido
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="text-center">
                                <p className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-4">
                                    {step === 'input' ? 'Ingresa un nuevo PIN' : 'Confirma tu PIN'}
                                </p>
                                <div className="flex justify-center gap-5">
                                    {[1, 2, 3, 4].map(dot => {
                                        const isFilled = step === 'input' ? pin.length >= dot : confirmPin.length >= dot;
                                        return (
                                            <div key={dot} className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${isFilled ? 'bg-indigo-600 border-indigo-600 scale-125 shadow-lg shadow-indigo-200' : 'border-slate-200 bg-white'}`} />
                                        );
                                    })}
                                </div>
                                {error && <p className="text-[10px] text-rose-500 font-black mt-4 uppercase tracking-tighter">{error}</p>}
                            </div>

                            {/* Keypad */}
                            <div className="grid grid-cols-3 gap-3">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'back', 0, 'check'].map((key, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        disabled={loading}
                                        onClick={() => {
                                            if (key === 'check') {
                                                if (step === 'confirm' && confirmPin.length === 4) handleSave();
                                            } else handleKeyClick(key);
                                        }}
                                        className={`h-14 rounded-2xl flex items-center justify-center text-lg font-black transition-all active:scale-90 ${
                                            key === 'check' ? 'bg-indigo-600 text-white shadow-lg disabled:opacity-50' : 
                                            key === 'back' ? 'bg-slate-50 text-slate-400' : 
                                            'bg-slate-50 text-slate-700 hover:bg-white hover:shadow-md border border-transparent hover:border-slate-100'
                                        }`}
                                    >
                                        {key === 'back' ? <ChevronLeft size={20} /> : 
                                         key === 'check' ? (loading ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />) : 
                                         key}
                                    </button>
                                ))}
                            </div>

                            {step === 'confirm' && !loading && (
                                <button
                                    onClick={() => { setStep('input'); setConfirmPin(''); }}
                                    className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                                >
                                    Corregir anterior
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SecurityModal;

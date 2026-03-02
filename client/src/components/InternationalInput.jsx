import React, { useState } from 'react';
import { Smartphone, Globe } from 'lucide-react';
import { COUNTRIES } from '../utils/intlUtils';

const InternationalInput = ({
    label,
    value,
    onChange,
    type = 'text',
    name,
    placeholder,
    selectedCountry,
    onCountryChange,
    icon: Icon = Smartphone,
    isPhone = false,
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const country = COUNTRIES.find(c => c.code === selectedCountry) || COUNTRIES.find(c => c.code === 'CL') || COUNTRIES[0];

    return (
        <div className={`space-y-1.5 ${className}`}>
            {label && <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>}
            <div className="relative group">
                {/* Country Selector for Phone or special fields */}
                {(isPhone || onCountryChange) && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
                        <button
                            type="button"
                            onClick={() => setIsOpen(!isOpen)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 rounded-xl border-2 border-slate-100 transition-all outline-none shadow-sm"
                        >
                            <span className="text-base">{country.flag}</span>
                            {isPhone && <span className="text-[10px] font-black text-slate-600">{country.prefix}</span>}
                        </button>

                        {isOpen && (
                            <div className="absolute top-full left-0 mt-2 w-64 bg-white border-2 border-slate-100 rounded-[2rem] shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in duration-200">
                                <div className="max-h-60 overflow-y-auto py-2 custom-scrollbar">
                                    <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }`}</style>
                                    {COUNTRIES.map((c) => (
                                        <button
                                            key={c.code}
                                            type="button"
                                            onClick={() => {
                                                onCountryChange(c.code);
                                                setIsOpen(false);
                                            }}
                                            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-indigo-50 transition-colors text-left"
                                        >
                                            <span className="text-xl">{c.flag}</span>
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-black text-slate-900">{c.name}</span>
                                                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                                                    {isPhone ? c.prefix : c.taxIdName}
                                                </span>
                                            </div>
                                            {selectedCountry === c.code && (
                                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {!isPhone && !onCountryChange && (
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors pointer-events-none">
                        <Icon size={18} />
                    </div>
                )}

                <input
                    type={type}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder || (isPhone ? "9 1234 5678" : country.placeholder)}
                    className={`w-full bg-slate-50 border-2 border-slate-200 rounded-2xl py-3.5 pr-6 text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400 ${(isPhone || onCountryChange) ? 'pl-28' : 'pl-14'
                        }`}
                    required
                />
            </div>
        </div>
    );
};

export default InternationalInput;

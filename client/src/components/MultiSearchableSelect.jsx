import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X, Check, Bookmark } from 'lucide-react';

const MultiSearchableSelect = ({ 
    options = [], 
    value = [], // Debe ser un array
    onChange, 
    placeholder = "Seleccionar múltiples...", 
    label, 
    icon: Icon,
    className = "",
    disabled = false,
    required = false,
    variant = "default" // "default" or "compact"
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);
    const isCompact = variant === "compact";

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const filteredOptions = options.filter(option => {
        const text = typeof option === 'string' ? option : option.label || option.nombre || '';
        return text.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const handleSelect = (option) => {
        const val = typeof option === 'string' ? option : option.value || option.nombre;
        const currentValues = Array.isArray(value) ? value : [];
        
        if (currentValues.includes(val)) {
            onChange(currentValues.filter(v => v !== val));
        } else {
            onChange([...currentValues, val]);
        }
    };

    const removeValue = (valToRemove, e) => {
        e.stopPropagation();
        onChange(value.filter(v => v !== valToRemove));
    };

    return (
        <div className={`relative w-full ${className}`} ref={wrapperRef}>
            {label && !isCompact && (
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    {Icon && <Icon size={12} className="text-indigo-400" />}
                    {label} {required && <span className="text-rose-500">*</span>}
                </label>
            )}
            
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`flex items-center gap-2 bg-white/70 backdrop-blur-md border rounded-2xl cursor-pointer transition-all duration-300 group shadow-sm ${
                    isCompact ? 'p-1.5 px-3' : 'p-3.5'
                } ${
                    isOpen ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-slate-200 hover:border-indigo-400'
                } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
            >
                <div className={`rounded-xl transition-colors duration-300 flex items-center justify-center ${
                    isCompact ? 'p-1.5' : 'p-2'
                } ${isOpen ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                    {Icon && <Icon size={isCompact ? 14 : 16} weight={isOpen ? "fill" : "regular"} />}
                </div>
                
                <div className="flex flex-wrap gap-1.5 flex-1 py-1">
                    {Array.isArray(value) && value.length > 0 ? (
                        value.map((v, i) => {
                            const option = options.find(opt => (opt.value || opt.id || opt.nombre) === v);
                            const labelText = option ? (option.label || option.nombre) : v;
                            return (
                                <div key={i} className={`flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-200/50 border border-white/20 animate-in zoom-in-95 duration-200 ${
                                    isCompact ? 'px-2 py-1' : 'px-3 py-1.5'
                                }`}>
                                    <span className={`${isCompact ? 'text-[8px]' : 'text-[10px]'} font-black uppercase tracking-tighter leading-none`}>{labelText}</span>
                                    <button
                                        type="button"
                                        onClick={(e) => removeValue(v, e)}
                                        className="hover:bg-white/20 rounded-full transition-colors flex items-center justify-center w-3 h-3"
                                    >
                                        <X size={8} strokeWidth={4} />
                                    </button>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex flex-col">
                            {isCompact ? (
                                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{label || placeholder}</span>
                            ) : (
                                <>
                                    <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest leading-none mb-1">{label}</span>
                                    <span className="text-slate-400 text-sm font-medium">{placeholder || 'Seleccionar...'}</span>
                                </>
                            )}
                        </div>
                    )}
                </div>
                
                <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-600' : 'text-slate-300'}`}>
                    <ChevronDown size={isCompact ? 12 : 14} strokeWidth={3} />
                </div>
            </div>
            {isOpen && (
                <div className="absolute z-[100] w-full mt-2 bg-white/90 backdrop-blur-2xl border border-indigo-100 rounded-[2.5rem] shadow-2xl shadow-indigo-200/40 p-4 animate-in fade-in slide-in-from-top-2 duration-300 overflow-hidden">
                    <div className="relative mb-3">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300" size={14} />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-slate-50 border-none rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        />
                    </div>

                    <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => {
                                const val = opt.value || opt.id || opt.nombre;
                                const isSelected = Array.isArray(value) && value.includes(val);
                                return (
                                    <div
                                        key={val}
                                        onClick={(e) => { e.stopPropagation(); handleSelect(opt); }}
                                        className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 ${
                                            isSelected 
                                                ? 'bg-indigo-50 text-indigo-700' 
                                                : 'hover:bg-slate-50 text-slate-600 hover:text-indigo-600'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2.5 h-2.5 rounded-full border-2 transition-all ${isSelected ? 'bg-indigo-600 border-indigo-400 scale-125' : 'bg-transparent border-slate-200 group-hover:border-indigo-300'}`} />
                                            <span className="text-[11px] font-black uppercase tracking-tight">{opt.label || opt.nombre}</span>
                                        </div>
                                        {isSelected && (
                                            <div className="bg-indigo-600 text-white p-1 rounded-md shadow-sm">
                                                <Check size={10} strokeWidth={4} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                <Search className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed block">No se encontraron<br/>resultados</span>
                            </div>
                        )}
                    </div>

                    {Array.isArray(value) && value.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-indigo-50/50 flex items-center justify-between px-2">
                             <div className="flex items-center gap-1.5">
                                <Bookmark size={10} className="text-indigo-300" />
                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-wider">{value.length} seleccionados</span>
                             </div>
                             <button 
                                onClick={(e) => { e.stopPropagation(); onChange([]); }}
                                className="text-[9px] font-black text-rose-500 uppercase tracking-tighter hover:text-rose-600 transition-colors bg-rose-50 px-3 py-1.5 rounded-lg active:scale-95"
                             >
                                Limpiar selección
                             </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MultiSearchableSelect;


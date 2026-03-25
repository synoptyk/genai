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
    required = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);

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
            {label && (
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    {Icon && <Icon size={12} className="text-indigo-400" />}
                    {label} {required && <span className="text-rose-500">*</span>}
                </label>
            )}
            
            <div 
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`
                    flex items-center justify-between w-full px-4 py-2 bg-slate-50 border-2 rounded-2xl cursor-pointer transition-all min-h-[56px]
                    ${isOpen ? 'border-indigo-400 bg-white ring-4 ring-indigo-50' : 'border-slate-200'}
                    ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:border-indigo-300'}
                `}
            >
                <div className="flex flex-wrap gap-1.5 flex-1 py-1">
                    {Array.isArray(value) && value.length > 0 ? (
                        value.map((v, i) => {
                            const option = options.find(opt => (opt.value || opt.id || opt.nombre) === v);
                            const labelText = option ? (option.label || option.nombre) : v;
                            return (
                                <div key={i} className="flex items-center gap-1.5 bg-indigo-600 text-white px-2.5 py-1 rounded-lg shadow-sm border border-indigo-500/50">
                                    <span className="text-[10px] font-black uppercase tracking-tighter leading-none">{labelText}</span>
                                    <button
                                        type="button"
                                        onClick={(e) => removeValue(v, e)}
                                        className="hover:bg-indigo-700 rounded-full transition-colors flex items-center justify-center w-3.5 h-3.5"
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            );
                        })
                    ) : (
                        <span className="text-slate-400 text-sm font-medium">{placeholder}</span>
                    )}
                </div>
                <div className="ml-2 text-slate-400">
                    <ChevronDown size={16} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-[110] w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-200/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top">
                    <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-400 transition-all font-black"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
                    
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option, idx) => {
                                const val = typeof option === 'string' ? option : option.value || option.nombre;
                                const labelText = typeof option === 'string' ? option : option.label || option.nombre;
                                const isSelected = Array.isArray(value) && value.includes(val);
                                
                                return (
                                    <div
                                        key={idx}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSelect(option);
                                        }}
                                        className={`
                                            flex items-center justify-between px-4 py-3 cursor-pointer transition-colors
                                            ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'}
                                        `}
                                    >
                                        <span className={`text-xs ${isSelected ? 'font-black' : 'font-bold'} uppercase italic`}>{labelText}</span>
                                        {isSelected && <Check size={14} className="text-indigo-600" />}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="px-4 py-8 text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin resultados</p>
                            </div>
                        )}
                    </div>
                    
                    {(value && value.length > 0) && (
                        <div className="p-3 border-t border-slate-100 bg-slate-50/30 flex justify-between items-center">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{value.length} seleccionados</span>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onChange([]); }}
                                className="text-[9px] font-black text-rose-500 uppercase tracking-widest hover:underline"
                            >
                                Limpiar todo
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MultiSearchableSelect;

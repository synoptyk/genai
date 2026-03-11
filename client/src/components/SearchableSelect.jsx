import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';

const SearchableSelect = ({ 
    options = [], 
    value, 
    onChange, 
    placeholder = "Seleccionar...", 
    label, 
    icon: Icon,
    className = "",
    error = false,
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

    const selectedOption = options.find(option => {
        const val = typeof option === 'string' ? option : option.value || option.nombre || '';
        return val === value;
    });

    const displayValue = selectedOption 
        ? (typeof selectedOption === 'string' ? selectedOption : selectedOption.label || selectedOption.nombre)
        : '';

    const handleSelect = (option) => {
        const val = typeof option === 'string' ? option : option.value || option.nombre;
        onChange(val);
        setIsOpen(false);
        setSearchTerm('');
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
                    flex items-center justify-between w-full px-4 py-3 bg-slate-50 border-2 rounded-2xl cursor-pointer transition-all
                    ${isOpen ? 'border-indigo-400 bg-white ring-4 ring-indigo-50' : 'border-slate-200'}
                    ${error ? 'border-rose-300 bg-rose-50/30' : ''}
                    ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:border-indigo-300'}
                `}
            >
                <div className="flex-1 truncate">
                    {displayValue ? (
                        <span className="text-slate-900 text-sm font-semibold">{displayValue}</span>
                    ) : (
                        <span className="text-slate-400 text-sm font-medium">{placeholder}</span>
                    )}
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                    {value && !disabled && (
                        <X 
                            size={14} 
                            className="hover:text-rose-500 transition-colors" 
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('');
                            }}
                        />
                    )}
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
                                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-400 transition-all"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
                    
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option, idx) => {
                                const val = typeof option === 'string' ? option : option.value || option.nombre;
                                const label = typeof option === 'string' ? option : option.label || option.nombre;
                                const isSelected = val === value;
                                
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
                                        <span className={`text-xs ${isSelected ? 'font-black' : 'font-bold'}`}>{label}</span>
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
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

const USAGE_KEY = 'logistica_smart_select_usage_v1';

const normalizeOption = (option) => {
    if (typeof option === 'string') {
        return { value: option, label: option };
    }
    return {
        value: option?.value ?? '',
        label: option?.label ?? String(option?.value ?? ''),
    };
};

const readUsage = () => {
    try {
        const raw = localStorage.getItem(USAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
};

const writeUsage = (usage) => {
    try {
        localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
    } catch (e) {
        // Silent fail: localStorage may be unavailable in private modes.
    }
};

const SmartSelect = ({
    label,
    value,
    onChange,
    options = [],
    placeholder = 'Seleccionar...',
    required = false,
    disabled = false,
    searchable = true,
    noOptionsText = 'Sin resultados',
    contextKey = '',
    className = '',
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const boxRef = useRef(null);
    const searchRef = useRef(null);

    const normalizedOptions = useMemo(() => options.map(normalizeOption), [options]);

    const usageMap = useMemo(() => {
        if (!contextKey) return {};
        const usage = readUsage();
        return usage?.[contextKey] || {};
    }, [contextKey, options]);

    const selected = useMemo(
        () => normalizedOptions.find((opt) => String(opt.value) === String(value)),
        [normalizedOptions, value]
    );

    const filtered = useMemo(() => {
        const scoreOption = (opt) => {
            const hit = usageMap?.[String(opt.value)];
            if (!hit) return 0;
            const ageMs = Math.max(0, Date.now() - Number(hit.last || 0));
            const freshness = Math.max(0, 30 - Math.floor(ageMs / (1000 * 60 * 60 * 24)));
            return (Number(hit.count || 0) * 10) + freshness;
        };

        if (!searchable || !query.trim()) {
            return [...normalizedOptions].sort((a, b) => scoreOption(b) - scoreOption(a));
        }

        const q = query.trim().toLowerCase();
        return normalizedOptions
            .filter((opt) => String(opt.label || '').toLowerCase().includes(q))
            .sort((a, b) => scoreOption(b) - scoreOption(a));
    }, [normalizedOptions, query, searchable, usageMap]);

    useEffect(() => {
        const onOutside = (event) => {
            if (boxRef.current && !boxRef.current.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onOutside);
        return () => document.removeEventListener('mousedown', onOutside);
    }, []);

    useEffect(() => {
        if (open && searchable) {
            const id = setTimeout(() => searchRef.current?.focus(), 0);
            return () => clearTimeout(id);
        }
        return undefined;
    }, [open, searchable]);

    const handleSelect = (nextValue) => {
        if (contextKey) {
            const usage = readUsage();
            const ctx = usage?.[contextKey] || {};
            const key = String(nextValue);
            const prev = ctx[key] || { count: 0, last: 0 };
            const next = {
                ...prev,
                count: Number(prev.count || 0) + 1,
                last: Date.now(),
            };
            usage[contextKey] = { ...ctx, [key]: next };
            writeUsage(usage);
        }

        onChange(nextValue);
        setOpen(false);
        setQuery('');
    };

    return (
        <div className={`space-y-2 ${className}`} ref={boxRef}>
            {label && (
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    {label}
                </label>
            )}

            {/* Hidden input for native required validation in forms */}
            <input readOnly tabIndex={-1} required={required} value={value || ''} className="sr-only" />

            <button
                type="button"
                onClick={() => !disabled && setOpen((v) => !v)}
                disabled={disabled}
                className={`w-full p-4 bg-gradient-to-b from-white to-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none text-left flex items-center justify-between transition-all shadow-sm ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/40'}`}
            >
                <span className={`${selected ? 'text-slate-700' : 'text-slate-400'}`}>
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="mt-2 rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 overflow-hidden z-30 relative">
                    {searchable && (
                        <div className="p-3 border-b border-slate-100 bg-slate-50/80">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    ref={searchRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Buscar..."
                                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-300"
                                />
                            </div>
                        </div>
                    )}

                    <div className="max-h-56 overflow-y-auto p-2 space-y-1">
                        {filtered.length === 0 && (
                            <div className="px-3 py-2 text-xs font-bold text-slate-400">{noOptionsText}</div>
                        )}
                        {filtered.map((opt) => {
                            const isActive = String(opt.value) === String(value);
                            return (
                                <button
                                    key={`${opt.value}`}
                                    type="button"
                                    onClick={() => handleSelect(opt.value)}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'}`}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SmartSelect;

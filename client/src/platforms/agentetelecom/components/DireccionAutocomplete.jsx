/**
 * DireccionAutocomplete
 * ─────────────────────────────────────────────────────────────────────────────
 * Campo de dirección con sugerencias en tiempo real (estilo Google Maps).
 * Fuente: Photon/Komoot sobre OpenStreetMap — sin API key, cobertura Chile total.
 * Incluye código postal OSM + integración opcional con Correos de Chile (backend).
 *
 * Props
 *  value          string                  Valor controlado del campo de dirección
 *  onChange       (text: string) => void  Cambio libre de texto
 *  onSelect       (sug: Suggestion) => void  Cuando el usuario elige una sugerencia
 *  placeholder    string
 *  label          string
 *  required       bool
 *  darkMode       bool                    true = tema oscuro para app del conductor
 *  currentPosition { lat, lng }           Proximidad para ordenar resultados
 *  disabled       bool
 *
 * Suggestion shape:
 *  { display, direccion, calle, numero, comuna, region, pais, codigoPostal, lat, lng, tipo }
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { CheckCircle2, Loader2, MapPin, X } from 'lucide-react';
import API_URL from '../../../config';

const publicApi = axios.create({ baseURL: `${API_URL}/api/rrhh/conductores` });

const DireccionAutocomplete = ({
  value = '',
  onChange,
  onSelect,
  placeholder = 'Escribe una dirección...',
  label,
  required = false,
  darkMode = false,
  currentPosition = null,
  disabled = false,
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const debounceRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // ── Búsqueda con debounce ────────────────────────────────────────────────
  const search = useCallback(
    async (q) => {
      if (q.length < 3) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const params = { q };
        if (currentPosition?.lat && currentPosition?.lng) {
          params.lat = currentPosition.lat;
          params.lng = currentPosition.lng;
        }
        const res = await publicApi.get('/autocomplete-direccion', { params });
        const rows = Array.isArray(res.data) ? res.data : [];
        setSuggestions(rows);
        setActiveIdx(-1);
        setOpen(rows.length > 0);
      } catch (_) {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    },
    [currentPosition]
  );

  // ── Keyboard navigation ──────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // ── Texto cambia ─────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const text = e.target.value;
    setSelectedFlag(false);
    onChange?.(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 320);
  };

  // ── Seleccionar sugerencia ───────────────────────────────────────────────
  const handleSelect = (sug) => {
    onChange?.(sug.display);
    onSelect?.(sug);
    setSelectedFlag(true);
    setOpen(false);
    setSuggestions([]);
    setActiveIdx(-1);
  };

  // ── Limpiar campo ────────────────────────────────────────────────────────
  const handleClear = () => {
    onChange?.('');
    onSelect?.({ display: '', direccion: '', calle: '', numero: '', comuna: '', region: '', pais: '', codigoPostal: '', lat: null, lng: null });
    setSelectedFlag(false);
    setSuggestions([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  // ── Cerrar al hacer clic fuera ───────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Clases dinámicas ─────────────────────────────────────────────────────
  const base = 'w-full rounded-xl px-3 py-2.5 text-sm pr-9 focus:outline-none focus:ring-2 transition-colors';
  const inputCls = darkMode
    ? `${base} bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:ring-indigo-500 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`
    : `${base} border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-indigo-500 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`;

  const dropdownCls = darkMode
    ? 'bg-slate-850 border border-slate-700 shadow-2xl'
    : 'bg-white border border-slate-200 shadow-xl';

  const itemBase = 'px-3 py-2.5 cursor-pointer flex items-start gap-2 border-b last:border-b-0 transition-colors';
  const itemCls = (idx) =>
    darkMode
      ? `${itemBase} border-slate-700/60 ${idx === activeIdx ? 'bg-slate-700' : 'hover:bg-slate-700/70'}`
      : `${itemBase} border-slate-100 ${idx === activeIdx ? 'bg-indigo-50' : 'hover:bg-slate-50'}`;

  const labelCls = darkMode ? 'block text-xs font-semibold text-slate-400 mb-1' : 'block text-xs font-bold text-slate-600 mb-1';

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className={labelCls}>
          {label}
          {required && <span className="text-rose-400 ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          className={inputCls}
        />

        {/* Iconos de estado en el lado derecho */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
          {loading && <Loader2 size={14} className={`animate-spin ${darkMode ? 'text-slate-400' : 'text-slate-400'}`} />}
          {!loading && selectedFlag && <CheckCircle2 size={14} className="text-emerald-400" />}
          {!loading && !selectedFlag && <MapPin size={12} className={darkMode ? 'text-slate-600' : 'text-slate-400'} />}
        </div>

        {/* Botón limpiar */}
        {value && !disabled && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleClear(); }}
            className={`absolute right-7 top-1/2 -translate-y-1/2 p-0.5 rounded-full transition-colors
              ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Dropdown de sugerencias */}
      {open && suggestions.length > 0 && (
        <ul
          className={`absolute z-[9999] left-0 right-0 mt-1 rounded-2xl overflow-hidden max-h-60 overflow-y-auto ${dropdownCls}`}
          onMouseDown={(e) => e.preventDefault()}
        >
          {suggestions.map((sug, i) => (
            <li
              key={`${sug.lat}-${sug.lng}-${i}`}
              onMouseDown={() => handleSelect(sug)}
              className={itemCls(i)}
            >
              <MapPin
                size={14}
                className={`mt-0.5 shrink-0 ${darkMode ? 'text-indigo-400' : 'text-indigo-500'}`}
              />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  {sug.display}
                </p>
                <div className={`flex items-center gap-1.5 mt-0.5 flex-wrap ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {sug.codigoPostal && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${darkMode ? 'bg-indigo-900/60 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
                      CP {sug.codigoPostal}
                    </span>
                  )}
                  {sug.comuna && (
                    <span className="text-[11px] truncate">{sug.comuna}</span>
                  )}
                  {sug.region && (
                    <span className={`text-[11px] truncate ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      · {sug.region}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
          <li className={`px-3 py-1.5 text-[10px] font-medium ${darkMode ? 'text-slate-600 bg-slate-900/40' : 'text-slate-400 bg-slate-50/80'}`}>
            Direcciones: OpenStreetMap · Photon (Komoot)
          </li>
        </ul>
      )}
    </div>
  );
};

export default DireccionAutocomplete;

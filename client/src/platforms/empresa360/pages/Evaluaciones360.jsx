import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Star, Plus } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

export default function Evaluaciones360() {
  const { API_BASE, authHeader } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ periodo: '', evaluadoRef: '' });

  const load = async () => {
    const res = await axios.get(`${API_BASE}/empresa360/evaluaciones`, { headers: authHeader() });
    setItems(res.data || []);
  };

  useEffect(() => { load(); }, []);

  const crear = async (e) => {
    e.preventDefault();
    if (!form.evaluadoRef) {
      alert('Ingresa ID de usuario evaluado');
      return;
    }
    await axios.post(`${API_BASE}/empresa360/evaluaciones`, {
      periodo: form.periodo,
      evaluadoRef: form.evaluadoRef,
      evaluadoresRef: [],
      estado: 'Abierta'
    }, { headers: authHeader() });
    setForm({ periodo: '', evaluadoRef: '' });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Star size={18} className="text-indigo-600" />
          <h1 className="text-sm font-black uppercase tracking-widest text-slate-700">Evaluaciones 360</h1>
        </div>
        <form onSubmit={crear} className="grid md:grid-cols-3 gap-2">
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Periodo (ej. 2026-Q2)" value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })} required />
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="ID usuario evaluado" value={form.evaluadoRef} onChange={(e) => setForm({ ...form, evaluadoRef: e.target.value })} required />
          <button className="bg-indigo-600 text-white rounded-lg px-3 py-2 text-sm font-bold inline-flex items-center justify-center gap-2"><Plus size={14} /> Crear</button>
        </form>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-2">Ciclos activos</h2>
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i._id} className="rounded-lg border border-slate-100 p-2 text-xs">
              <b>{i.periodo}</b> · {i.evaluadoRef?.name || i.evaluadoRef} · {i.estado}
              <div className="text-slate-500">Promedio: {i.promedioFinal || 0}</div>
            </div>
          ))}
          {items.length === 0 && <p className="text-xs text-slate-500">Sin evaluaciones.</p>}
        </div>
      </div>
    </div>
  );
}

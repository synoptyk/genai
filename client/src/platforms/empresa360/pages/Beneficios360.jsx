import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Gift, Plus } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

export default function Beneficios360() {
  const { API_BASE, authHeader } = useAuth();
  const [catalogo, setCatalogo] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [beneficio, setBeneficio] = useState({ nombre: '', categoria: 'Salud', montoMensual: '' });

  const load = async () => {
    const [r1, r2] = await Promise.all([
      axios.get(`${API_BASE}/empresa360/beneficios/catalogo`, { headers: authHeader() }),
      axios.get(`${API_BASE}/empresa360/beneficios/asignaciones`, { headers: authHeader() })
    ]);
    setCatalogo(r1.data || []);
    setAsignaciones(r2.data || []);
  };

  useEffect(() => { load(); }, []);

  const createBeneficio = async (e) => {
    e.preventDefault();
    await axios.post(`${API_BASE}/empresa360/beneficios/catalogo`, {
      ...beneficio,
      montoMensual: Number(beneficio.montoMensual || 0)
    }, { headers: authHeader() });
    setBeneficio({ nombre: '', categoria: 'Salud', montoMensual: '' });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gift size={18} className="text-indigo-600" />
          <h1 className="text-sm font-black uppercase tracking-widest text-slate-700">Beneficios 360</h1>
        </div>
        <form onSubmit={createBeneficio} className="grid md:grid-cols-4 gap-2">
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Nombre" value={beneficio.nombre} onChange={(e) => setBeneficio({ ...beneficio, nombre: e.target.value })} required />
          <select className="border rounded-lg px-3 py-2 text-sm" value={beneficio.categoria} onChange={(e) => setBeneficio({ ...beneficio, categoria: e.target.value })}>
            <option>Salud</option><option>Alimentacion</option><option>Transporte</option><option>Educacion</option><option>Reconocimiento</option><option>Otro</option>
          </select>
          <input className="border rounded-lg px-3 py-2 text-sm" type="number" placeholder="Monto mensual" value={beneficio.montoMensual} onChange={(e) => setBeneficio({ ...beneficio, montoMensual: e.target.value })} required />
          <button className="bg-indigo-600 text-white rounded-lg px-3 py-2 text-sm font-bold inline-flex items-center justify-center gap-2"><Plus size={14} /> Crear</button>
        </form>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-2">Catalogo</h2>
          <div className="space-y-2">
            {catalogo.map((b) => (
              <div key={b._id} className="rounded-lg border border-slate-100 p-2 text-xs flex justify-between">
                <span>{b.nombre} ({b.categoria})</span>
                <b>${b.montoMensual}</b>
              </div>
            ))}
            {catalogo.length === 0 && <p className="text-xs text-slate-500">Sin beneficios.</p>}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-2">Asignaciones activas</h2>
          <div className="space-y-2">
            {asignaciones.map((a) => (
              <div key={a._id} className="rounded-lg border border-slate-100 p-2 text-xs">
                <b>{a.userRef?.name || 'Usuario'}</b> - {a.beneficioRef?.nombre || 'Beneficio'}
                <div className="text-slate-500">Estado: {a.estado}</div>
              </div>
            ))}
            {asignaciones.length === 0 && <p className="text-xs text-slate-500">Sin asignaciones.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { GraduationCap, Plus } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

export default function CapacitacionLMS() {
  const { API_BASE, authHeader } = useAuth();
  const [cursos, setCursos] = useState([]);
  const [inscripciones, setInscripciones] = useState([]);
  const [form, setForm] = useState({ titulo: '', categoria: 'General', horasObjetivo: '' });

  const load = async () => {
    const [r1, r2] = await Promise.all([
      axios.get(`${API_BASE}/empresa360/lms/cursos`, { headers: authHeader() }),
      axios.get(`${API_BASE}/empresa360/lms/inscripciones`, { headers: authHeader() })
    ]);
    setCursos(r1.data || []);
    setInscripciones(r2.data || []);
  };

  useEffect(() => { load(); }, []);

  const crearCurso = async (e) => {
    e.preventDefault();
    await axios.post(`${API_BASE}/empresa360/lms/cursos`, {
      titulo: form.titulo,
      categoria: form.categoria,
      horasObjetivo: Number(form.horasObjetivo || 0),
      estado: 'Publicado'
    }, { headers: authHeader() });
    setForm({ titulo: '', categoria: 'General', horasObjetivo: '' });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap size={18} className="text-indigo-600" />
          <h1 className="text-sm font-black uppercase tracking-widest text-slate-700">Capacitacion LMS</h1>
        </div>
        <form onSubmit={crearCurso} className="grid md:grid-cols-4 gap-2">
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Titulo" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Categoria" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} required />
          <input className="border rounded-lg px-3 py-2 text-sm" type="number" placeholder="Horas objetivo" value={form.horasObjetivo} onChange={(e) => setForm({ ...form, horasObjetivo: e.target.value })} required />
          <button className="bg-indigo-600 text-white rounded-lg px-3 py-2 text-sm font-bold inline-flex items-center justify-center gap-2"><Plus size={14} /> Crear curso</button>
        </form>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-2">Cursos</h2>
          <div className="space-y-2">
            {cursos.map((c) => (
              <div key={c._id} className="rounded-lg border border-slate-100 p-2 text-xs">
                <b>{c.titulo}</b>
                <div className="text-slate-500">{c.categoria} · {c.horasObjetivo} hrs · {c.estado}</div>
              </div>
            ))}
            {cursos.length === 0 && <p className="text-xs text-slate-500">Sin cursos.</p>}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-2">Inscripciones</h2>
          <div className="space-y-2">
            {inscripciones.map((i) => (
              <div key={i._id} className="rounded-lg border border-slate-100 p-2 text-xs">
                <b>{i.userRef?.name || 'Colaborador'}</b> - {i.cursoRef?.titulo || 'Curso'}
                <div className="text-slate-500">{i.progresoPct}% · {i.estado}</div>
              </div>
            ))}
            {inscripciones.length === 0 && <p className="text-xs text-slate-500">Sin inscripciones.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

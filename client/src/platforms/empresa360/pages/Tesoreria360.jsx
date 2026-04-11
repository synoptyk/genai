import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Landmark, Plus } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useCheckPermission } from '../../../hooks/useCheckPermission';

export default function Tesoreria360() {
  const { API_BASE, authHeader } = useAuth();
  const { hasPermission } = useCheckPermission();
  const canCreate = hasPermission('emp360_tesoreria', 'crear');
  const canEdit = hasPermission('emp360_tesoreria', 'editar');
  const [rows, setRows] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [form, setForm] = useState({ tipo: 'Ingreso', categoria: 'General', descripcion: '', monto: '' });

  const load = async () => {
    const [r1, r2] = await Promise.all([
      axios.get(`${API_BASE}/empresa360/tesoreria/movimientos`, { headers: authHeader() }),
      axios.get(`${API_BASE}/empresa360/tesoreria/resumen`, { headers: authHeader() })
    ]);
    setRows(r1.data || []);
    setResumen(r2.data || null);
  };

  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!canCreate) {
      alert('No tienes permiso para registrar movimientos.');
      return;
    }

    await axios.post(`${API_BASE}/empresa360/tesoreria/movimientos`, {
      ...form,
      monto: Number(form.monto || 0)
    }, { headers: authHeader() });
    setForm({ tipo: 'Ingreso', categoria: 'General', descripcion: '', monto: '' });
    load();
  };

  const conciliar = async (id) => {
    if (!canEdit) {
      alert('No tienes permiso para conciliar movimientos.');
      return;
    }

    await axios.put(`${API_BASE}/empresa360/tesoreria/movimientos/${id}/conciliar`, { referenciaExterna: 'Conciliado manual' }, { headers: authHeader() });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Landmark size={18} className="text-indigo-600" />
          <h1 className="text-sm font-black uppercase tracking-widest text-slate-700">Tesoreria 360</h1>
        </div>
        {resumen && (
          <div className="grid md:grid-cols-4 gap-2 text-xs mb-3">
            <div className="p-2 rounded-lg bg-emerald-50">Ingresos: <b>${resumen.ingresos}</b></div>
            <div className="p-2 rounded-lg bg-rose-50">Egresos: <b>${resumen.egresos}</b></div>
            <div className="p-2 rounded-lg bg-slate-50">Balance: <b>${resumen.balance}</b></div>
            <div className="p-2 rounded-lg bg-amber-50">Pendientes: <b>{resumen.pendientes}</b></div>
          </div>
        )}

        <form onSubmit={create} className="grid md:grid-cols-5 gap-2">
          <select disabled={!canCreate} className="border rounded-lg px-3 py-2 text-sm disabled:opacity-50" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            <option>Ingreso</option>
            <option>Egreso</option>
          </select>
          <input disabled={!canCreate} className="border rounded-lg px-3 py-2 text-sm disabled:opacity-50" placeholder="Categoria" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} required />
          <input disabled={!canCreate} className="border rounded-lg px-3 py-2 text-sm disabled:opacity-50" placeholder="Descripcion" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} required />
          <input disabled={!canCreate} className="border rounded-lg px-3 py-2 text-sm disabled:opacity-50" type="number" placeholder="Monto" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} required />
          <button disabled={!canCreate} className="bg-indigo-600 text-white rounded-lg px-3 py-2 text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><Plus size={14} /> Registrar</button>
        </form>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-2">Fecha</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-left p-2">Descripcion</th>
              <th className="text-left p-2">Monto</th>
              <th className="text-left p-2">Conciliado</th>
              <th className="text-left p-2">Accion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id} className="border-t border-slate-100">
                <td className="p-2">{new Date(r.fecha).toLocaleDateString('es-CL')}</td>
                <td className="p-2">{r.tipo}</td>
                <td className="p-2">{r.descripcion}</td>
                <td className="p-2">${r.monto}</td>
                <td className="p-2">{r.conciliado ? 'Si' : 'No'}</td>
                <td className="p-2">
                  {!r.conciliado && <button disabled={!canEdit} onClick={() => conciliar(r._id)} className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed">Conciliar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FileText, PlusCircle, DollarSign } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useCheckPermission } from '../../../hooks/useCheckPermission';

export default function Facturacion360() {
  const { API_BASE, authHeader } = useAuth();
  const { hasPermission } = useCheckPermission();
  const canCreate = hasPermission('emp360_facturacion', 'crear');
  const canEdit = hasPermission('emp360_facturacion', 'editar');
  const [rows, setRows] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [form, setForm] = useState({ clienteNombre: '', numeroFactura: '', total: '', fechaVencimiento: '' });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        axios.get(`${API_BASE}/empresa360/facturacion`, { headers: authHeader() }),
        axios.get(`${API_BASE}/empresa360/facturacion/resumen`, { headers: authHeader() })
      ]);
      setRows(r1.data || []);
      setResumen(r2.data || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createFactura = async (e) => {
    e.preventDefault();
    if (!canCreate) {
      alert('No tienes permiso para crear facturas.');
      return;
    }

    await axios.post(`${API_BASE}/empresa360/facturacion`, {
      clienteNombre: form.clienteNombre,
      numeroFactura: form.numeroFactura,
      fechaVencimiento: form.fechaVencimiento,
      items: [{ descripcion: 'Servicio', cantidad: 1, precioUnitario: Number(form.total || 0) }]
    }, { headers: authHeader() });

    setForm({ clienteNombre: '', numeroFactura: '', total: '', fechaVencimiento: '' });
    load();
  };

  const registrarPago = async (id) => {
    if (!canEdit) {
      alert('No tienes permiso para registrar pagos.');
      return;
    }

    const monto = window.prompt('Monto del pago');
    if (!monto) return;
    await axios.post(`${API_BASE}/empresa360/facturacion/${id}/pagos`, { monto: Number(monto), metodo: 'Transferencia' }, { headers: authHeader() });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={18} className="text-indigo-600" />
          <h1 className="text-sm font-black uppercase tracking-widest text-slate-700">Facturacion 360</h1>
        </div>
        {resumen && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-slate-50">Emitidas: <b>{resumen.cantidad}</b></div>
            <div className="p-2 rounded-lg bg-slate-50">Total: <b>${resumen.totalEmitido}</b></div>
            <div className="p-2 rounded-lg bg-slate-50">Pagado: <b>${resumen.totalPagado}</b></div>
            <div className="p-2 rounded-lg bg-slate-50">Pendiente: <b>${resumen.totalPendiente}</b></div>
            <div className="p-2 rounded-lg bg-rose-50">Vencidas: <b>{resumen.vencidas}</b></div>
          </div>
        )}
      </div>

      <form onSubmit={createFactura} className="rounded-2xl bg-white border border-slate-200 p-4 grid md:grid-cols-5 gap-2">
        <input disabled={!canCreate} className="border rounded-lg px-3 py-2 text-sm disabled:opacity-50" placeholder="Cliente" value={form.clienteNombre} onChange={(e) => setForm({ ...form, clienteNombre: e.target.value })} required />
        <input disabled={!canCreate} className="border rounded-lg px-3 py-2 text-sm disabled:opacity-50" placeholder="Numero factura" value={form.numeroFactura} onChange={(e) => setForm({ ...form, numeroFactura: e.target.value })} required />
        <input disabled={!canCreate} className="border rounded-lg px-3 py-2 text-sm disabled:opacity-50" placeholder="Total" type="number" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} required />
        <input disabled={!canCreate} className="border rounded-lg px-3 py-2 text-sm disabled:opacity-50" type="date" value={form.fechaVencimiento} onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })} required />
        <button disabled={!canCreate} className="bg-indigo-600 text-white rounded-lg px-3 py-2 text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><PlusCircle size={14} /> Crear</button>
      </form>

      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-2 text-left">Factura</th>
              <th className="p-2 text-left">Cliente</th>
              <th className="p-2 text-left">Estado</th>
              <th className="p-2 text-left">Total</th>
              <th className="p-2 text-left">Saldo</th>
              <th className="p-2 text-left">Accion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id} className="border-t border-slate-100">
                <td className="p-2">{r.numeroFactura}</td>
                <td className="p-2">{r.clienteNombre}</td>
                <td className="p-2">{r.estado}</td>
                <td className="p-2">${r.total}</td>
                <td className="p-2">${r.saldoPendiente}</td>
                <td className="p-2">
                  <button disabled={!canEdit} onClick={() => registrarPago(r._id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                    <DollarSign size={12} /> Pago
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <p className="p-4 text-xs text-slate-500">Sin facturas registradas.</p>}
      </div>
    </div>
  );
}

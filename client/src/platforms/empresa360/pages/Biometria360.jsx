import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Fingerprint, Plus, Pencil, Trash2, X, CheckCircle2, ActivitySquare } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useCheckPermission } from '../../../hooks/useCheckPermission';

export default function Biometria360() {
  const { API_BASE, authHeader } = useAuth();
  const { hasPermission } = useCheckPermission();
  const canCreate = hasPermission('emp360_biometria', 'crear');
  const canEdit = hasPermission('emp360_biometria', 'editar');
  const canDelete = hasPermission('emp360_biometria', 'eliminar');
  const [devices, setDevices] = useState([]);
  const [logs, setLogs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    nombre: '',
    serial: '',
    marca: '',
    modelo: '',
    ubicacion: '',
    ipLocal: '',
    estado: 'Activo'
  });

  const load = async () => {
    const [r1, r2] = await Promise.all([
      axios.get(`${API_BASE}/empresa360/biometria/devices`, { headers: authHeader() }),
      axios.get(`${API_BASE}/empresa360/biometria/logs`, { headers: authHeader() })
    ]);
    setDevices(r1.data || []);
    setLogs(r2.data || []);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ nombre: '', serial: '', marca: '', modelo: '', ubicacion: '', ipLocal: '', estado: 'Activo' });
    setEditingId(null);
  };

  const addDevice = async (e) => {
    e.preventDefault();

    if (editingId && !canEdit) {
      alert('No tienes permiso para editar dispositivos biométricos.');
      return;
    }
    if (!editingId && !canCreate) {
      alert('No tienes permiso para registrar dispositivos biométricos.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await axios.put(`${API_BASE}/empresa360/biometria/devices/${editingId}`, form, { headers: authHeader() });
      } else {
        await axios.post(`${API_BASE}/empresa360/biometria/devices`, form, { headers: authHeader() });
      }
      resetForm();
      await load();
    } catch (error) {
      alert(error.response?.data?.message || 'No se pudo guardar el dispositivo biométrico');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (device) => {
    if (!canEdit) {
      alert('No tienes permiso para editar dispositivos biométricos.');
      return;
    }

    setEditingId(device._id);
    setForm({
      nombre: device.nombre || '',
      serial: device.serial || '',
      marca: device.marca || '',
      modelo: device.modelo || '',
      ubicacion: device.ubicacion || '',
      ipLocal: device.ipLocal || '',
      estado: device.estado || 'Activo'
    });
  };

  const deleteDevice = async (device) => {
    if (!device?._id) return;
    if (!canDelete) {
      alert('No tienes permiso para eliminar dispositivos biométricos.');
      return;
    }
    if (!window.confirm(`¿Eliminar el dispositivo ${device.nombre} (${device.serial})?`)) return;

    try {
      await axios.delete(`${API_BASE}/empresa360/biometria/devices/${device._id}`, { headers: authHeader() });
      if (editingId === device._id) resetForm();
      await load();
    } catch (error) {
      alert(error.response?.data?.message || 'No se pudo eliminar el dispositivo');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Fingerprint size={18} className="text-indigo-600" />
          <h1 className="text-sm font-black uppercase tracking-widest text-slate-700">Biometria 360</h1>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Administra relojes biométricos, terminales de marcación y sus eventos de entrada/salida para integrarlos con asistencia y control horario.
        </p>
        <form onSubmit={addDevice} className="grid md:grid-cols-4 gap-2">
          <input disabled={editingId ? !canEdit : !canCreate} className="border rounded-lg px-3 py-2 text-sm disabled:opacity-50" placeholder="Nombre dispositivo" value={form.nombre} onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))} required />
          <input disabled={editingId ? !canEdit : !canCreate} className="border rounded-lg px-3 py-2 text-sm disabled:opacity-50" placeholder="Serial" value={form.serial} onChange={(e) => setForm((prev) => ({ ...prev, serial: e.target.value }))} required />
          <input disabled={editingId ? !canEdit : !canCreate} className="border rounded-lg px-3 py-2 text-sm disabled:opacity-50" placeholder="Marca" value={form.marca} onChange={(e) => setForm((prev) => ({ ...prev, marca: e.target.value }))} />
          <input disabled={editingId ? !canEdit : !canCreate} className="border rounded-lg px-3 py-2 text-sm disabled:opacity-50" placeholder="Modelo" value={form.modelo} onChange={(e) => setForm((prev) => ({ ...prev, modelo: e.target.value }))} />
          <input disabled={editingId ? !canEdit : !canCreate} className="border rounded-lg px-3 py-2 text-sm disabled:opacity-50" placeholder="Ubicación" value={form.ubicacion} onChange={(e) => setForm((prev) => ({ ...prev, ubicacion: e.target.value }))} />
          <input disabled={editingId ? !canEdit : !canCreate} className="border rounded-lg px-3 py-2 text-sm disabled:opacity-50" placeholder="IP local" value={form.ipLocal} onChange={(e) => setForm((prev) => ({ ...prev, ipLocal: e.target.value }))} />
          <select disabled={editingId ? !canEdit : !canCreate} className="border rounded-lg px-3 py-2 text-sm disabled:opacity-50" value={form.estado} onChange={(e) => setForm((prev) => ({ ...prev, estado: e.target.value }))}>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
            <option value="Mantenimiento">Mantenimiento</option>
          </select>
          <div className="flex gap-2">
            <button disabled={saving || (editingId ? !canEdit : !canCreate)} className="flex-1 bg-indigo-600 text-white rounded-lg px-3 py-2 text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <Plus size={14} /> {editingId ? 'Guardar' : 'Registrar'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="bg-slate-100 text-slate-600 rounded-lg px-3 py-2 text-sm font-bold inline-flex items-center justify-center gap-2">
                <X size={14} /> Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-2">Dispositivos</h2>
          <div className="space-y-2">
            {devices.map((d) => (
              <div key={d._id} className="rounded-lg border border-slate-100 p-3 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <b>{d.nombre}</b> · {d.serial}
                    <div className="text-slate-500 mt-1">Estado: {d.estado}</div>
                    {(d.marca || d.modelo || d.ubicacion) && (
                      <div className="text-slate-400 mt-1">
                        {[d.marca, d.modelo, d.ubicacion].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {d.ultimoHeartbeat && (
                      <div className="text-slate-400 mt-1 inline-flex items-center gap-1">
                        <ActivitySquare size={12} /> Último pulso: {new Date(d.ultimoHeartbeat).toLocaleString('es-CL')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={!canEdit} onClick={() => startEdit(d)} className="p-2 rounded-lg bg-indigo-50 text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed">
                      <Pencil size={14} />
                    </button>
                    <button type="button" disabled={!canDelete} onClick={() => deleteDevice(d)} className="p-2 rounded-lg bg-rose-50 text-rose-600 disabled:opacity-50 disabled:cursor-not-allowed">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {devices.length === 0 && <p className="text-xs text-slate-500">Sin dispositivos registrados.</p>}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-2">Ultimas marcas</h2>
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {logs.map((l) => (
              <div key={l._id} className="rounded-lg border border-slate-100 p-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <b>{l.userRef?.name || l.rut || 'Sin usuario'}</b>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-600 px-2 py-1 text-[10px] font-black uppercase">
                    <CheckCircle2 size={11} /> {l.tipoMarca}
                  </span>
                </div>
                <div className="text-slate-500">{new Date(l.fechaMarca).toLocaleString('es-CL')}</div>
                {l.deviceRef?.nombre && <div className="text-slate-400">Dispositivo: {l.deviceRef.nombre}</div>}
              </div>
            ))}
            {logs.length === 0 && <p className="text-xs text-slate-500">Sin marcas.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

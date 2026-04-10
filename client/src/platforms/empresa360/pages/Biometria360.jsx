import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Fingerprint, Plus } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

export default function Biometria360() {
  const { API_BASE, authHeader } = useAuth();
  const [devices, setDevices] = useState([]);
  const [logs, setLogs] = useState([]);
  const [serial, setSerial] = useState('');
  const [nombre, setNombre] = useState('');

  const load = async () => {
    const [r1, r2] = await Promise.all([
      axios.get(`${API_BASE}/empresa360/biometria/devices`, { headers: authHeader() }),
      axios.get(`${API_BASE}/empresa360/biometria/logs`, { headers: authHeader() })
    ]);
    setDevices(r1.data || []);
    setLogs(r2.data || []);
  };

  useEffect(() => { load(); }, []);

  const addDevice = async (e) => {
    e.preventDefault();
    await axios.post(`${API_BASE}/empresa360/biometria/devices`, { nombre, serial }, { headers: authHeader() });
    setSerial('');
    setNombre('');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Fingerprint size={18} className="text-indigo-600" />
          <h1 className="text-sm font-black uppercase tracking-widest text-slate-700">Biometria 360</h1>
        </div>
        <form onSubmit={addDevice} className="grid md:grid-cols-3 gap-2">
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Nombre dispositivo" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Serial" value={serial} onChange={(e) => setSerial(e.target.value)} required />
          <button className="bg-indigo-600 text-white rounded-lg px-3 py-2 text-sm font-bold inline-flex items-center justify-center gap-2"><Plus size={14} /> Registrar</button>
        </form>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-2">Dispositivos</h2>
          <div className="space-y-2">
            {devices.map((d) => (
              <div key={d._id} className="rounded-lg border border-slate-100 p-2 text-xs">
                <b>{d.nombre}</b> · {d.serial}
                <div className="text-slate-500">Estado: {d.estado}</div>
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
                <b>{l.userRef?.name || l.rut || 'Sin usuario'}</b> · {l.tipoMarca}
                <div className="text-slate-500">{new Date(l.fechaMarca).toLocaleString('es-CL')}</div>
              </div>
            ))}
            {logs.length === 0 && <p className="text-xs text-slate-500">Sin marcas.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

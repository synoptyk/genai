import React, { useState, useEffect } from 'react';
import { ShieldCheck, Download, AlertTriangle, Filter, Search, Loader2, X, CalendarRange, Edit2, Info, Plus } from 'lucide-react';
import { asistenciaApi, turnosApi, candidatosApi } from '../rrhhApi';
import { useAuth } from '../../auth/AuthContext';
import { useCheckPermission } from '../../../hooks/useCheckPermission';
import SearchableSelect from '../../../components/SearchableSelect';
import MultiSearchableSelect from '../../../components/MultiSearchableSelect';

const AsistenciaLegal = () => {
    const [registros, setRegistros] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQ, setSearchQ] = useState('');
    const [filterTurno, setFilterTurno] = useState('');
    const [filterEstado, setFilterEstado] = useState('');
    const [filterHorasExtra, setFilterHorasExtra] = useState(false);
    const [mesObj, setMesObj] = useState(new Date().toISOString().slice(0, 7));

    const [turnos, setTurnos] = useState([]);
    const [candidatos, setCandidatos] = useState([]);
    const [selectedTurnoDetails, setSelectedTurnoDetails] = useState(null);

    const [modalMarcaje, setModalMarcaje] = useState(null);
    const [marcajeForm, setMarcajeForm] = useState({ estado: 'Presente', horaEntrada: '', horaSalida: '', observacionLegal: '' });
    const [savingMarcaje, setSavingMarcaje] = useState(false);
    const [downloadingReporte, setDownloadingReporte] = useState(false);
    const [processingId, setProcessingId] = useState(null);
    
    // Estados para Multi-select
    const [candidatosId, setCandidatosId] = useState([]);
    const [cargoFilter, setCargoFilter] = useState('');
    const cargosDisponibles = [...new Set(candidatos.map(c => c.position).filter(Boolean))];
    
    // Estados para Historial
    const [activeTab, setActiveTab] = useState('libro'); // 'libro' | 'historial'
    const [historialCandidatoId, setHistorialCandidatoId] = useState('');
    const [historialRegs, setHistorialRegs] = useState([]);
    const [historialLoading, setHistorialLoading] = useState(false);
    
    const { user } = useAuth();
    const { hasPermission } = useCheckPermission();
    
    const isAdmin = ['system_admin', 'ceo_genai', 'ceo', 'admin', 'rrhh', 'gerencia'].includes(String(user?.role || '').toLowerCase());
    
    const canCreate = isAdmin || hasPermission('rrhh_asistencia', 'crear');
    const canEdit = isAdmin || hasPermission('rrhh_asistencia', 'editar');
    const canDelete = isAdmin || hasPermission('rrhh_asistencia', 'eliminar');

    const toHHmm = (raw) => {
        if (!raw) return '';

        const str = String(raw).trim();
        if (!str) return '';

        let m = str.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d{1,3})?)?$/);
        if (m) {
            const hh = Number(m[1]);
            const mm = Number(m[2]);
            if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
                return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
            }
        }

        const normalized = str
            .toLowerCase()
            .replace(/\./g, '')
            .replace(/\s+/g, '');

        m = normalized.match(/^(\d{1,2}):(\d{2})(am|pm)$/);
        if (m) {
            let hh = Number(m[1]);
            const mm = Number(m[2]);
            const meridiem = m[3];
            if (hh >= 1 && hh <= 12 && mm >= 0 && mm <= 59) {
                if (meridiem === 'am' && hh === 12) hh = 0;
                if (meridiem === 'pm' && hh !== 12) hh += 12;
                return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
            }
        }

        const parsed = new Date(str);
        if (!Number.isNaN(parsed.getTime())) {
            return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
        }

        return '';
    };

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            try {
                const [y, m] = mesObj.split('-');
                const [resAsist, resTurnos, resCand] = await Promise.all([
                    asistenciaApi.getAll({ year: parseInt(y), month: parseInt(m) }),
                    turnosApi.getAll(),
                    candidatosApi.getAll({ limit: 1000 })
                ]);
                setRegistros(resAsist.data || []);
                setTurnos(resTurnos.data || []);
                setCandidatos(resCand.data?.data || resCand.data || []);
            } catch (err) {
                console.error("Error fetching legal attendance", err);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [mesObj]);

    useEffect(() => {
        const fetchHistorial = async () => {
            if (!historialCandidatoId) {
                setHistorialRegs([]);
                return;
            }
            setHistorialLoading(true);
            try {
                const res = await asistenciaApi.getAll({ candidatoId: historialCandidatoId });
                const regs = res.data || [];
                regs.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
                setHistorialRegs(regs);
            } catch (err) {
                console.error("Error fetching history", err);
            } finally {
                setHistorialLoading(false);
            }
        };
        fetchHistorial();
    }, [historialCandidatoId]);

    const getTurnoObj = (candidatoObj) => {
        if (!candidatoObj) return null;
        
        const strId = typeof candidatoObj === 'object' ? (candidatoObj._id?.toString() || candidatoObj.toString()) : candidatoObj.toString();
        
        return turnos.find(t => {
            return (t.colominoAsignados || []).some(idObj => {
                if (!idObj) return false;
                const arrId = typeof idObj === 'object' ? (idObj._id?.toString() || idObj.toString()) : idObj.toString();
                return arrId === strId;
            });
        });
    };

    const getTurnoName = (candidatoObj) => {
        const turno = getTurnoObj(candidatoObj);
        return turno ? turno.nombre : 'NO ASIGNADO';
    };

    const filteredRegistros = registros.filter(reg => {
        // Search
        const name = reg.candidatoId?.fullName || reg.candidatoId?.nombre || '';
        const rut = reg.candidatoId?.rut || '';
        if (searchQ && !name.toLowerCase().includes(searchQ.toLowerCase()) && !rut.toLowerCase().includes(searchQ.toLowerCase())) return false;
        
        // Turno
        if (filterTurno) {
            const turnoName = getTurnoName(reg.candidatoId);
            if (turnoName !== filterTurno) return false;
        }
        
        // Estado
        if (filterEstado && reg.estado !== filterEstado) return false;
        
        // Horas Extra
        if (filterHorasExtra && (!reg.horasExtra || reg.horasExtra <= 0)) return false;
        
        return true;
    });

    const handleDownloadLegalReport = async () => {
        setDownloadingReporte(true);
        try {
            const [y, m] = mesObj.split('-');
            const res = await asistenciaApi.getReporteLegal({ month: Number(m), year: Number(y), includeAnulados: true });
            const filas = res.data?.filas || [];

            const csvRows = [
                ['Fecha', 'Trabajador', 'RUT', 'Cargo', 'Estado', 'Entrada', 'Salida', 'Turno', 'EstadoRegistro', 'IntegridadOK', 'HashIntegridad'],
                ...filas.map((f) => [
                    String(f.fecha || '').substring(0, 10),
                    f.trabajador || '',
                    f.rut || '',
                    f.cargo || '',
                    f.estado || '',
                    f.horaEntrada || '',
                    f.horaSalida || '',
                    f.turno || '',
                    f.estadoRegistro || '',
                    f.integridadOk ? 'SI' : 'NO',
                    f.hashIntegridad || ''
                ])
            ];

            const csv = csvRows
                .map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
                .join('\n');

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `reporte_legal_asistencia_${mesObj}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            alert(err.response?.data?.message || 'No fue posible generar el reporte legal.');
        } finally {
            setDownloadingReporte(false);
        }
    };

    const handleVerifyIntegrity = async (id) => {
        const idStr = String(id || '').trim();
        if (!/^[a-fA-F0-9]{24}$/.test(idStr)) {
            alert('El registro no tiene un identificador válido para verificación de integridad.');
            return;
        }

        setProcessingId(id);
        try {
            const res = await asistenciaApi.verificarIntegridad(idStr);
            const data = res.data || {};
            if (data.ok) {
                alert(`Integridad verificada. Eventos: ${data.totalEventos}. Hash: ${data.ultimoHashCalculado}`);
            } else {
                alert(`Integridad con observaciones: ${(data.inconsistencias || []).join(' | ')}`);
            }
        } catch (err) {
            if (err?.response?.status === 404) {
                alert('No se encontró el registro para verificación de integridad. Refresca la vista y vuelve a intentar.');
                return;
            }
            alert(err.response?.data?.message || 'No fue posible verificar la integridad');
        } finally {
            setProcessingId(null);
        }
    };

    const handleAnularRegistro = async (registro) => {
        const motivo = window.prompt('Motivo legal de anulación (obligatorio):');
        if (!motivo || !motivo.trim()) return;

        setProcessingId(registro._id);
        try {
            await asistenciaApi.remove(registro._id, motivo.trim());
            setRegistros(prev => prev.map(r => r._id === registro._id ? { ...r, estadoRegistro: 'ANULADO', anulado: { motivo } } : r));
        } catch (err) {
            alert(err.response?.data?.message || 'No se pudo anular el registro');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="absolute inset-0 overflow-y-auto p-8 bg-slate-50/50">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
                <div>
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <ShieldCheck className="text-indigo-600" />
                        Libro de Asistencia Digital (DT)
                    </h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1 flex items-center gap-1">
                        Trazabilidad legal avanzada y cadena de integridad verificable
                        <Info size={12} className="text-indigo-400" title="Las alteraciones manuales deben justificarse obligatoriamente."/>
                    </p>
                </div>
                
                <div className="flex bg-slate-200 p-1 rounded-xl">
                    <button 
                        onClick={() => setActiveTab('libro')}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'libro' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Libro Diario
                    </button>
                    <button 
                        onClick={() => setActiveTab('historial')}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'historial' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Historial Trabajador
                    </button>
                </div>

                {activeTab === 'libro' && (
                    <div className="flex gap-3">
                        {canCreate && (
                            <button 
                                onClick={() => {
                                    setModalMarcaje({ isNew: true });
                                    setMarcajeForm({ fecha: new Date().toISOString().substring(0, 10), estado: 'Presente', horaEntrada: '', horaSalida: '', observacionLegal: '' });
                                    setCandidatosId([]);
                                    setCargoFilter('');
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:bg-indigo-700 transition-all"
                            >
                                <Plus size={14} /> Crear Registro Retroactivo
                            </button>
                        )}
                        <input 
                            type="month" 
                            value={mesObj} 
                            onChange={(e) => setMesObj(e.target.value)}
                            className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 bg-white"
                        />
                        <button
                            onClick={handleDownloadLegalReport}
                            disabled={downloadingReporte}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:bg-emerald-700 transition-all disabled:opacity-60"
                        >
                            {downloadingReporte ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Reporte DT/Auditoría
                        </button>
                    </div>
                )}
            </div>

            {activeTab === 'libro' && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                {/* Filtros */}
                <div className="flex flex-col gap-4 mb-6">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Buscar por RUT o Nombre..." 
                                value={searchQ}
                                onChange={(e) => setSearchQ(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-indigo-100 outline-none"
                            />
                        </div>
                        <div className="flex-1 min-w-[150px] max-w-xs">
                            <select
                                value={filterTurno}
                                onChange={(e) => setFilterTurno(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-indigo-100 outline-none"
                            >
                                <option value="">Todos los Turnos</option>
                                {turnos.map(t => (
                                    <option key={t._id} value={t.nombre}>{t.nombre}</option>
                                ))}
                                <option value="NO ASIGNADO">NO ASIGNADO</option>
                            </select>
                        </div>
                        <div className="flex-1 min-w-[150px] max-w-xs">
                            <select
                                value={filterEstado}
                                onChange={(e) => setFilterEstado(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-indigo-100 outline-none"
                            >
                                <option value="">Todos los Estados</option>
                                <option value="Presente">Presente</option>
                                <option value="Ausente">Ausente</option>
                                <option value="Licencia">Licencia</option>
                                <option value="Vacaciones">Vacaciones</option>
                            </select>
                        </div>
                        <label className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                            <input 
                                type="checkbox"
                                checked={filterHorasExtra}
                                onChange={(e) => setFilterHorasExtra(e.target.checked)}
                                className="w-4 h-4 rounded text-indigo-600"
                            />
                            <span className="text-sm font-bold text-slate-700">Con Horas Extra</span>
                        </label>
                    </div>
                </div>

                {/* Tabla */}
                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                <th className="p-4 border-b border-slate-200">Trabajador</th>
                                <th className="p-4 border-b border-slate-200">RUT</th>
                                <th className="p-4 border-b border-slate-200">Turno Asignado</th>
                                <th className="p-4 border-b border-slate-200">Fecha</th>
                                <th className="p-4 border-b border-slate-200">Entrada</th>
                                <th className="p-4 border-b border-slate-200">Salida</th>
                                <th className="p-4 border-b border-slate-200">Horas Extras</th>
                                <th className="p-4 border-b border-slate-200">
                                    <div className="flex items-center gap-1">
                                        Estado Legal 
                                        <Info size={10} className="text-slate-400" title="Estado oficial auditable (Ord. 1140/27)"/>
                                    </div>
                                </th>
                                <th className="p-4 border-b border-slate-200">
                                    <div className="flex items-center gap-1">
                                        Estado Operativo
                                        <Info size={10} className="text-slate-400" title="Estado declarado por supervisor en terreno"/>
                                    </div>
                                </th>
                                <th className="p-4 border-b border-slate-200">Trazabilidad (IP/Geo)</th>
                                {(canEdit || canDelete) && <th className="p-4 border-b border-slate-200 text-center">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="text-xs">
                            {loading ? (
                                <tr>
                                    <td colSpan="9" className="p-8 text-center">
                                        <Loader2 className="animate-spin text-indigo-500 mx-auto mb-2" />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cargando Libro...</span>
                                    </td>
                                </tr>
                            ) : filteredRegistros.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="p-8 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                                        No hay registros para este período.
                                    </td>
                                </tr>
                            ) : (
                                filteredRegistros.map((reg, idx) => (
                                    <tr 
                                        key={reg._id || idx} 
                                        className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                                        onClick={() => {
                                            const tObj = getTurnoObj(reg.candidatoId);
                                            if (tObj) setSelectedTurnoDetails(tObj);
                                            else alert('El trabajador seleccionado no tiene un turno asignado en la plataforma.');
                                        }}
                                    >
                                        <td className="p-4 font-bold text-slate-800">{reg.candidatoId?.fullName || reg.candidatoId?.nombre || 'Desconocido'}</td>
                                        <td className="p-4 text-slate-500">{reg.candidatoId?.rut || '—'}</td>
                                        <td className="p-4 text-indigo-600 font-black uppercase text-[10px]">
                                            {getTurnoName(reg.candidatoId)}
                                        </td>
                                        <td className="p-4 font-bold text-slate-600">{String(reg.fecha || '').substring(0, 10)}</td>
                                        <td className="p-4 text-slate-700">{reg.horaIngresoDeclarada || reg.horaEntrada || '—'}</td>
                                        <td className="p-4 text-slate-700">{reg.horaSalida || '—'}</td>
                                        <td className="p-4">
                                            {reg.horasExtra > 0 ? (
                                                <span className="text-indigo-600 font-black">{reg.horasExtra}h</span>
                                            ) : '—'}
                                        </td>
                                        <td className="p-4">
                                            <span className="bg-slate-100 text-slate-600 text-[9px] font-black uppercase px-2 py-1 rounded-lg">
                                                {(reg.estado === 'Presente' && !reg.horaIngresoDeclarada && !reg.horaEntrada) ? 'Por Registrar' : reg.estado}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-[10px] font-bold text-slate-500">
                                                {reg.estado} {reg.observacion && <span title={reg.observacion} className="text-indigo-400 ml-1">💬</span>}
                                            </span>
                                        </td>
                                        <td className="p-4 text-[10px] text-slate-400 font-bold">
                                            {reg.auditLog ? (
                                                <div className="flex flex-col">
                                                    <span className="text-emerald-500 flex items-center gap-1"><ShieldCheck size={12}/> {reg.auditLog.ip || 'Registrado'}</span>
                                                    {reg.auditLog.geoLat && <span className="text-[8px] text-slate-300 mt-0.5">Lat: {reg.auditLog.geoLat} Lng: {reg.auditLog.geoLng}</span>}
                                                    {reg.auditLog.nota && <span className="text-[8px] text-indigo-400 mt-0.5">{reg.auditLog.nota}</span>}
                                                    {reg.auditLog.ultimoEventoHash && <span className="text-[8px] text-slate-300 mt-0.5">Hash: {String(reg.auditLog.ultimoEventoHash).slice(0, 12)}...</span>}
                                                </div>
                                            ) : 'Pendiente / Operativo'}
                                        </td>
                                        {(canEdit || canDelete) && (
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {canEdit && (
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setModalMarcaje(reg);
                                                                setMarcajeForm({
                                                                    estado: reg.estado || 'Presente',
                                                                    horaEntrada: toHHmm(reg.horaEntrada || reg.horaIngresoDeclarada || ''),
                                                                    horaSalida: toHHmm(reg.horaSalida || ''),
                                                                    observacionLegal: ''
                                                                });
                                                            }}
                                                            className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                            title="Forzar Marcaje Manual (Requiere Observación Legal)"
                                                            disabled={reg.estadoRegistro === 'ANULADO' || processingId === reg._id}
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleVerifyIntegrity(reg._id);
                                                        }}
                                                        className="p-2 bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                                        title="Verificar integridad criptográfica"
                                                        disabled={processingId === reg._id}
                                                    >
                                                        {processingId === reg._id ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                                                    </button>
                                                    {canDelete && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleAnularRegistro(reg);
                                                            }}
                                                            className="p-2 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                            title="Anular registro (sin borrado físico)"
                                                            disabled={reg.estadoRegistro === 'ANULADO' || processingId === reg._id}
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            {activeTab === 'historial' && (
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Seleccionar Trabajador</label>
                        <SearchableSelect
                            value={historialCandidatoId}
                            onChange={setHistorialCandidatoId}
                            placeholder="-- Elija un Trabajador --"
                            options={candidatos.map(c => ({
                                label: `${c.fullName || c.nombre} (${c.rut}) - ${c.position || 'Sin cargo'}`,
                                value: c._id
                            }))}
                            className="w-full max-w-md"
                        />
                    </div>

                    {historialCandidatoId && (
                        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                            <h4 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                                <CalendarRange className="text-indigo-600" />
                                Historial de Asistencia
                            </h4>
                            
                            {historialLoading ? (
                                <div className="p-8 text-center">
                                    <Loader2 className="animate-spin text-indigo-500 mx-auto mb-2" />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cargando historial...</span>
                                </div>
                            ) : historialRegs.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest bg-slate-50 rounded-2xl border border-slate-100">
                                    No hay registros de asistencia para este trabajador.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {historialRegs.map((reg) => (
                                        <div key={reg._id} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                            {/* Header de la tarjeta */}
                                            <div className="bg-slate-50 p-4 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 gap-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-black tracking-wider shadow-sm">
                                                        {reg.fecha?.substring(0, 10)}
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-0.5">Estado Legal</span>
                                                        <span className={`text-xs font-bold px-2 py-1 rounded-md ${reg.estado === 'Presente' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                            {reg.estado}
                                                        </span>
                                                    </div>
                                                    {reg.estado === 'Presente' && (
                                                        <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                                                            <span className="bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">{reg.horaIngresoDeclarada || reg.horaEntrada || '--:--'}</span>
                                                            <span className="text-slate-300">-</span>
                                                            <span className="bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">{reg.horaSalida || '--:--'}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horas Extras</span>
                                                    <span className="text-sm font-bold text-slate-700">{reg.horasExtra > 0 ? `${reg.horasExtra}h (${reg.estadoHorasExtra})` : 'No aplica'}</span>
                                                </div>
                                            </div>
                                            
                                            {/* Timeline de Auditoría */}
                                            <div className="p-4 bg-white">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Timeline de Auditoría / Modificaciones</span>
                                                {reg.eventosTimeline && reg.eventosTimeline.length > 0 ? (
                                                    <div className="space-y-4">
                                                        {reg.eventosTimeline.map((ev, idx) => (
                                                            <div key={idx} className="flex gap-4 relative">
                                                                {idx !== reg.eventosTimeline.length - 1 && (
                                                                    <div className="absolute left-2.5 top-6 bottom-0 w-px bg-slate-200 -z-0"></div>
                                                                )}
                                                                <div className="relative z-10 shrink-0 w-5 h-5 rounded-full bg-indigo-100 border-4 border-white flex items-center justify-center mt-0.5 shadow-sm">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                                </div>
                                                                <div className="flex-1 bg-slate-50 border border-slate-100 p-3 rounded-xl shadow-sm">
                                                                    <div className="flex justify-between items-start mb-1">
                                                                        <span className="text-xs font-black text-slate-700">{ev.tipo}</span>
                                                                        <span className="text-[10px] font-bold text-slate-400">{new Date(ev.timestamp).toLocaleString()}</span>
                                                                    </div>
                                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px] font-medium text-slate-600 mb-2">
                                                                        <div><span className="font-bold text-slate-400 uppercase">Hora Registro:</span> {ev.hora || 'N/A'}</div>
                                                                        <div><span className="font-bold text-slate-400 uppercase">Estado:</span> {ev.estadoSeleccionado || 'N/A'}</div>
                                                                        <div><span className="font-bold text-slate-400 uppercase">Usuario:</span> {ev.registradoPor || 'Sistema'}</div>
                                                                    </div>
                                                                    {ev.observacion && (
                                                                        <div className="text-[11px] text-slate-500 bg-white p-2 rounded-lg border border-slate-100 italic shadow-sm">
                                                                            "{ev.observacion}"
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-slate-500 italic">Sin eventos registrados en la línea de tiempo.</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Modal de Detalle de Turno */}
            {selectedTurnoDetails && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl relative border border-slate-100 animate-in zoom-in-95 duration-200">
                        <button 
                            onClick={() => setSelectedTurnoDetails(null)} 
                            className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                        >
                            <X size={20} />
                        </button>
                        
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                                <CalendarRange size={24} />
                            </div>
                            Detalle del Turno
                        </h3>
                        
                        <div className="space-y-5 text-sm font-medium text-slate-600">
                            <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Nombre del Turno</span>
                                <p className="text-slate-800 font-bold text-base">{selectedTurnoDetails.nombre}</p>
                            </div>
                            {selectedTurnoDetails.descripcion && (
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Descripción</span>
                                    <p className="text-slate-500">{selectedTurnoDetails.descripcion}</p>
                                </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-5 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="col-span-2">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-3">Horarios por Día</span>
                                    <div className="space-y-2">
                                        {(selectedTurnoDetails.diasSemana || []).map(dia => {
                                            const override = (selectedTurnoDetails.horariosPorDia || []).find(h => h.dia === dia);
                                            const entrada = override ? override.horaEntrada : selectedTurnoDetails.horaEntrada;
                                            const salida = override ? override.horaSalida : selectedTurnoDetails.horaSalida;
                                            const colacion = override ? override.colacionMinutos : selectedTurnoDetails.colacionMinutos;
                                            
                                            return (
                                                <div key={dia} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                                    <span className="text-sm font-bold text-slate-700 w-24">{dia}</span>
                                                    <div className="flex gap-3 text-sm font-black">
                                                        <span className="text-indigo-600">{entrada}</span>
                                                        <span className="text-slate-300">-</span>
                                                        <span className="text-rose-500">{salida}</span>
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                                                        {colacion} min colación
                                                    </span>
                                                </div>
                                            );
                                        })}
                                        {!(selectedTurnoDetails.diasSemana || []).length && (
                                            <div className="text-xs font-bold text-slate-400 text-center py-2">
                                                No hay días asignados
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Tipo</span>
                                    <span className="inline-block px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 shadow-sm">
                                        {selectedTurnoDetails.tipo}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Total Horas Semanales</span>
                                    <p className="text-slate-700 font-bold">{selectedTurnoDetails.horasTrabajo} horas</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="mt-8">
                            <button 
                                onClick={() => setSelectedTurnoDetails(null)}
                                className="w-full py-3.5 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md shadow-slate-200 hover:bg-slate-700 transition-all"
                            >
                                Cerrar Detalle
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Marcaje Manual Administrativo */}
            {modalMarcaje && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl relative border border-slate-100 animate-in zoom-in-95 duration-200">
                        <button 
                            onClick={() => setModalMarcaje(null)} 
                            className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                        >
                            <X size={20} />
                        </button>
                        
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2 flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                                {modalMarcaje.isNew ? <Plus size={24} /> : <Edit2 size={24} />}
                            </div>
                            {modalMarcaje.isNew ? 'Crear Registro Retroactivo' : 'Marcaje Manual'}
                        </h3>
                        <p className="text-xs font-bold text-slate-500 mb-6">
                            {modalMarcaje.isNew 
                                ? 'Crea un registro de asistencia para fechas pasadas.' 
                                : `Editando registro de ${modalMarcaje.candidatoId?.fullName || modalMarcaje.candidatoId?.nombre || 'Trabajador'} para el día ${modalMarcaje.fecha?.substring(0, 10)}.`}
                        </p>

                        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 text-amber-700 text-xs font-medium">
                            <AlertTriangle size={24} className="shrink-0" />
                            <p>Según el <strong>Ord. 1140/27</strong> de la DT, toda alteración manual del libro de asistencia debe estar justificada. Esta acción quedará registrada en la bitácora inmutable de auditoría a nombre de tu usuario.</p>
                        </div>
                        
                        <div className="space-y-4">
                            {modalMarcaje.isNew && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Filtrar por Cargo</label>
                                            <select 
                                                value={cargoFilter}
                                                onChange={(e) => setCargoFilter(e.target.value)}
                                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
                                            >
                                                <option value="">Todos los cargos</option>
                                                {cargosDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Trabajadores Filtrados</label>
                                            <div className="flex items-end h-full pb-0.5">
                                                <button 
                                                    onClick={() => {
                                                        const filtrados = candidatos.filter(c => !cargoFilter || c.position === cargoFilter);
                                                        const allIds = filtrados.map(c => c._id);
                                                        if (candidatosId.length === allIds.length) setCandidatosId([]);
                                                        else setCandidatosId(allIds);
                                                    }}
                                                    className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-black uppercase tracking-widest w-full hover:bg-indigo-100 transition-colors"
                                                >
                                                    {candidatos.filter(c => !cargoFilter || c.position === cargoFilter).length === candidatosId.length && candidatosId.length > 0 
                                                        ? 'Deseleccionar Todos' 
                                                        : 'Seleccionar Todos'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <MultiSearchableSelect
                                            label={`Selecciona Trabajadores (${candidatosId.length} seleccionados)`}
                                            placeholder="Buscar trabajadores..."
                                            value={candidatosId}
                                            onChange={setCandidatosId}
                                            options={candidatos
                                                .filter(c => !cargoFilter || c.position === cargoFilter)
                                                .map(c => ({
                                                    label: `${c.fullName || c.nombre} (${c.rut}) - ${c.position || 'Sin cargo'}`,
                                                    value: c._id
                                                }))
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha</label>
                                        <input 
                                            type="date" 
                                            value={marcajeForm.fecha || ''}
                                            onChange={(e) => setMarcajeForm({...marcajeForm, fecha: e.target.value})}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
                                        />
                                    </div>
                                </>
                            )}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estado Legal</label>
                                <select 
                                    value={marcajeForm.estado}
                                    onChange={(e) => setMarcajeForm({...marcajeForm, estado: e.target.value})}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
                                >
                                    <option value="Presente">Presente</option>
                                    <option value="Ausente">Ausente</option>
                                    <option value="Licencia">Licencia</option>
                                    <option value="Vacaciones">Vacaciones</option>
                                    <option value="Feriado">Feriado</option>
                                    <option value="Permiso">Permiso</option>
                                </select>
                            </div>
                            
                            {marcajeForm.estado === 'Presente' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hora Entrada</label>
                                        <input 
                                            type="time" 
                                            value={marcajeForm.horaEntrada}
                                            onChange={(e) => setMarcajeForm({...marcajeForm, horaEntrada: e.target.value})}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hora Salida</label>
                                        <input 
                                            type="time" 
                                            value={marcajeForm.horaSalida}
                                            onChange={(e) => setMarcajeForm({...marcajeForm, horaSalida: e.target.value})}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Observación Legal (Obligatoria)</label>
                                <textarea 
                                    value={marcajeForm.observacionLegal}
                                    onChange={(e) => setMarcajeForm({...marcajeForm, observacionLegal: e.target.value})}
                                    placeholder="Ej: Trabajador olvidó celular, ingresó a las 09:00 confirmado por supervisor..."
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 resize-none h-24"
                                />
                            </div>
                        </div>
                        
                        <div className="mt-8 flex gap-3">
                            <button 
                                onClick={() => setModalMarcaje(null)}
                                className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={async () => {
                                    if (modalMarcaje.isNew) {
                                        if (candidatosId.length === 0) return alert('Debes seleccionar al menos un trabajador.');
                                        if (!marcajeForm.fecha) return alert('Debes seleccionar una fecha.');
                                    }
                                    if (!marcajeForm.observacionLegal.trim()) return alert('La observación legal es obligatoria.');
                                    if (marcajeForm.estado === 'Presente' && !marcajeForm.horaEntrada) return alert('La hora de entrada es obligatoria si el estado es Presente.');
                                    
                                    setSavingMarcaje(true);
                                    try {
                                        let res;
                                        if (modalMarcaje.isNew) {
                                            // Asignamos el turnoId si solo seleccionaron uno y tiene turno, sino null (lo resolverá el backend si hace falta, o se manda null)
                                            let resolvedTurnoId = null;
                                            if (candidatosId.length === 1) {
                                                resolvedTurnoId = getTurnoObj(candidatosId[0])?._id;
                                            }
                                            res = await asistenciaApi.createMarcajeLegal({
                                                candidatosId: candidatosId,
                                                fecha: marcajeForm.fecha,
                                                estado: marcajeForm.estado,
                                                horaEntrada: marcajeForm.horaEntrada,
                                                horaSalida: marcajeForm.horaSalida,
                                                observacionLegal: marcajeForm.observacionLegal,
                                                turnoId: resolvedTurnoId
                                            });
                                            // Agregar a la tabla si coincide con el mes/año filtrado actual
                                            const [y, m] = mesObj.split('-');
                                            const arrGuardados = Array.isArray(res.data) ? res.data : [res.data];
                                            
                                            setRegistros(prev => {
                                                let updated = [...prev];
                                                for (const r of arrGuardados) {
                                                    const resDate = new Date(r.fecha);
                                                    if (resDate.getUTCFullYear() === parseInt(y) && (resDate.getUTCMonth() + 1) === parseInt(m)) {
                                                        const idx = updated.findIndex(u => u._id === r._id);
                                                        if (idx >= 0) updated[idx] = r;
                                                        else updated.push(r);
                                                    }
                                                }
                                                return updated;
                                            });
                                        } else {
                                            res = await asistenciaApi.marcajeLegal(modalMarcaje._id, {
                                                estado: marcajeForm.estado,
                                                horaEntrada: marcajeForm.horaEntrada,
                                                horaSalida: marcajeForm.horaSalida,
                                                observacionLegal: marcajeForm.observacionLegal,
                                                turnoId: modalMarcaje.turnoId?._id
                                            });
                                            setRegistros(prev => prev.map(r => r._id === res.data._id ? res.data : r));
                                        }
                                        setModalMarcaje(null);
                                    } catch (err) {
                                        alert(err.response?.data?.message || 'Error guardando marcaje');
                                    } finally {
                                        setSavingMarcaje(false);
                                    }
                                }}
                                disabled={savingMarcaje}
                                className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:bg-indigo-700 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                {savingMarcaje ? <Loader2 size={16} className="animate-spin" /> : 'Guardar Marcaje'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AsistenciaLegal;

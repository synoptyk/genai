import React, { useState, useEffect } from 'react';
import { 
    CheckSquare, CalendarDays, Users, Search, Save, CheckCircle2, 
    XOctagon, TrendingUp, Loader2, Camera, Clock, X 
} from 'lucide-react';
import { asistenciaApi, turnosApi } from '../../rrhh/rrhhApi';
import { getHorarioDelDia } from '../../rrhh/utils/turnoHelper';
import API_URL from '../../../config';

const AsistenciaOperativa = ({ 
    miEquipo, 
    asistenciaFecha, 
    setAsistenciaFecha, 
    solicitudes, 
    user,
    showToast 
}) => {
    const [asistenciaLogs, setAsistenciaLogs] = useState({});
    const [asistenciaLoading, setAsistenciaLoading] = useState(false);
    const [asistenciaSaving, setAsistenciaSaving] = useState(false);
    const [asistenciaSearch, setAsistenciaSearch] = useState('');
    
    // Modal state para subir foto
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const [photoModalData, setPhotoModalData] = useState({ candId: null, file: null, preview: null, isLoading: false, tipoEvento: null, observacion: '' });

    const toHHmm = (raw) => {
        if (!raw) return '';

        if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
            const hh = String(raw.getHours()).padStart(2, '0');
            const mm = String(raw.getMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
        }

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
            const hh = String(parsed.getHours()).padStart(2, '0');
            const mm = String(parsed.getMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
        }

        return '';
    };

    const getNowHHmm = () => toHHmm(new Date());

    const getActiveLeave = (candidateId, dateStr) => {
        const targetDate = new Date(dateStr);
        targetDate.setHours(0,0,0,0);
        return solicitudes.find(s => {
            if (s.candId === candidateId && s.estado === 'Aprobado' && s.fechaInicio && s.fechaFin) {
                const inicio = new Date(s.fechaInicio);
                const fin = new Date(s.fechaFin);
                inicio.setHours(0,0,0,0);
                fin.setHours(0,0,0,0);
                return targetDate >= inicio && targetDate <= fin;
            }
            return false;
        });
    };

    const fetchAsistenciaLogs = async (fechaStr) => {
        if (!fechaStr) return;
        setAsistenciaLoading(true);
        try {
            const [resAsist, resTurnos] = await Promise.all([
                asistenciaApi.getAll({ fecha: fechaStr }),
                turnosApi.getAll()
            ]);
            
            const turnosList = resTurnos.data || [];
            const getTurnoForCand = (candidatoId) => {
                if (!candidatoId) return null;
                const strId = candidatoId.toString();
                return turnosList.find(t => 
                    (t.colominoAsignados || []).some(idObj => {
                        if (!idObj) return false;
                        const arrId = typeof idObj === 'object' ? (idObj._id?.toString() || idObj.toString()) : idObj.toString();
                        return arrId === strId;
                    })
                );
            };

            const logsMap = {};
            
            miEquipo.forEach(tec => {
                if (tec.rrhh?._id) {
                    const activeLeave = getActiveLeave(tec.rrhh._id, fechaStr);
                    const turnoAsignado = getTurnoForCand(tec.rrhh._id) || tec.rrhh.turnoId || tec.turnoId || null;
                    
                    if (activeLeave) {
                        const leaveEstado = activeLeave.tipo === 'Vacaciones' ? 'Vacaciones' : 'Licencia';
                        const leaveTipo = activeLeave.tipo === 'Licencia Médica' ? 'Licencia Médica' : 'Vacaciones';
                        logsMap[tec.rrhh._id] = {
                            candidatoId: tec.rrhh._id,
                            estado: leaveEstado,
                            tipoAusencia: leaveTipo,
                            observacion: `Bloqueado por ${activeLeave.tipo} aprobado`,
                            isLocked: true,
                            estadoDia: 'Abierto',
                            eventosTimeline: [],
                            turno: turnoAsignado
                        };
                    } else {
                        logsMap[tec.rrhh._id] = {
                            candidatoId: tec.rrhh._id,
                            estado: 'Presente',
                            minutosTardanza: 0,
                            horasExtraAprobadas: 0,
                            tipoAusencia: null,
                            observacion: '',
                            isNew: true,
                            estadoDia: 'Abierto',
                            eventosTimeline: [],
                            horaIngresoDeclarada: '',
                            horaSalida: '',
                            isFinDia: false,
                            turno: turnoAsignado
                        };
                    }
                }
            });

            (resAsist.data || []).forEach(record => {
                const candId = record.candidatoId?._id || record.candidatoId;
                if (candId && logsMap[candId]) {
                    const isLocked = logsMap[candId].isLocked;
                    logsMap[candId] = {
                        ...logsMap[candId],
                        _id: record._id,
                        estado: isLocked ? logsMap[candId].estado : (record.estado || 'Presente'),
                        minutosTardanza: record.minutosTardanza || 0,
                        horasExtraAprobadas: record.horasExtraAprobadas || 0,
                        tipoAusencia: isLocked ? logsMap[candId].tipoAusencia : record.tipoAusencia,
                        observacion: record.observacion || '',
                        isNew: false,
                        estadoDia: record.estadoDia || 'Abierto',
                        eventosTimeline: record.eventosTimeline || [],
                        horaIngresoDeclarada: toHHmm(record.horaIngresoDeclarada),
                        horaSalida: toHHmm(record.horaSalida),
                        isFinDia: !!record.horaSalida,
                        turno: record.turnoId || logsMap[candId].turno
                    };
                }
            });

            setAsistenciaLogs(logsMap);
        } catch (error) {
            console.error("Error cargando asistencia:", error);
        } finally {
            setAsistenciaLoading(false);
        }
    };

    useEffect(() => {
        if (miEquipo.length > 0) {
            fetchAsistenciaLogs(asistenciaFecha);
        }
    }, [asistenciaFecha, miEquipo, solicitudes]);

    const calculateTardanza = (horaReal, turnoHoraEntrada, tolerancia = 0) => {
        if (!horaReal || !turnoHoraEntrada) return 0;
        const [hR, mR] = horaReal.split(':').map(Number);
        const [hE, mE] = turnoHoraEntrada.split(':').map(Number);
        const totalR = hR * 60 + mR;
        const totalE = hE * 60 + mE;
        const diff = totalR - totalE;
        return diff > tolerancia ? diff : 0;
    };

    const handleUpdateLog = (candId, field, val) => {
        setAsistenciaLogs(prev => {
            const current = prev[candId] || {};
            const normalizedVal = (field === 'horaIngresoDeclarada' || field === 'horaSalida') ? toHHmm(val) : val;
            let extra = {};
            if (field === 'estado') {
                if (val !== 'Presente') {
                    extra = { minutosTardanza: 0, horasExtraAprobadas: 0, horaSalida: '' };
                    if (val === 'Ausente') extra.tipoAusencia = 'Inasistencia Injustificada';
                    else if (val === 'Permiso') extra.tipoAusencia = 'Permiso con Goce de Sueldo';
                    else if (val === 'Licencia') extra.tipoAusencia = 'Licencia Médica';
                    else if (val === 'Vacaciones') extra.tipoAusencia = 'Vacaciones';
                    else extra.tipoAusencia = null;
                } else {
                    extra = { tipoAusencia: null };
                }
            } else if (field === 'horaIngresoDeclarada') {
                // Autocalcular tardanza si tenemos el turno
                const turno = current.turno;
                if (turno) {
                    const horario = getHorarioDelDia(turno, asistenciaFecha);
                    if (horario && horario.horaEntrada) {
                        extra.minutosTardanza = calculateTardanza(normalizedVal, horario.horaEntrada, horario.toleranciaTardanza || 0);
                    }
                }
            }
            return {
                ...prev,
                [candId]: {
                    ...current,
                    [field]: normalizedVal,
                    ...extra
                }
            };
        });
    };

    const handleAddEvento = (candId, tipo, hora, estadoSeleccionado, observacion, fotoUrl = null) => {
        setAsistenciaLogs(prev => {
            const current = prev[candId];
            const newEvento = {
                tipo,
                hora,
                estadoSeleccionado,
                observacion,
                fotoUrl,
                registradoPor: user?.name || 'Supervisor',
                timestamp: new Date()
            };
            
            let updatedTimeline = current.eventosTimeline ? [...current.eventosTimeline] : [];
            
            // Evitamos duplicar eventos de Apertura o Ausencia inicial (Reemplaza el último)
            if (tipo === 'Apertura' || tipo === 'Ausencia/Excepción') {
                const existingIndex = updatedTimeline.findIndex(e => e.tipo === 'Apertura' || e.tipo === 'Ausencia/Excepción');
                if (existingIndex >= 0) {
                    updatedTimeline[existingIndex] = newEvento;
                } else {
                    updatedTimeline.push(newEvento);
                }
            } else {
                updatedTimeline.push(newEvento);
            }

            return {
                ...prev,
                [candId]: {
                    ...current,
                    eventosTimeline: updatedTimeline
                }
            };
        });
    };

    const handleSetPuntual = (candId) => {
        setAsistenciaLogs(prev => {
            const current = prev[candId] || {};
            const horario = current.turno ? getHorarioDelDia(current.turno, asistenciaFecha) : null;
            const horaEntrada = horario?.horaEntrada || getNowHHmm();
            
            const newEvento = {
                tipo: 'Apertura',
                hora: horaEntrada,
                estadoSeleccionado: 'Puntual',
                observacion: 'Asistencia inicial',
                registradoPor: user?.name || 'Supervisor',
                timestamp: new Date()
            };
            
            let updatedTimeline = current.eventosTimeline ? [...current.eventosTimeline] : [];
            const existingIndex = updatedTimeline.findIndex(e => e.tipo === 'Apertura' || e.tipo === 'Ausencia/Excepción');
            if (existingIndex >= 0) {
                updatedTimeline[existingIndex] = newEvento;
            } else {
                updatedTimeline.push(newEvento);
            }

            return {
                ...prev,
                [candId]: {
                    ...current,
                    estado: 'Presente',
                    tipoAusencia: null,
                    horaIngresoDeclarada: horaEntrada,
                    minutosTardanza: 0,
                    eventosTimeline: updatedTimeline
                }
            };
        });
    };

    const handleSetAtraso = (candId) => {
        setAsistenciaLogs(prev => {
            const current = prev[candId] || {};
            const horaNow = getNowHHmm();
            let tardanzaCalculated = 1; // Default to at least 1 min for Atraso
            
            const turno = current.turno;
            if (turno) {
                const horario = getHorarioDelDia(turno, asistenciaFecha);
                if (horario && horario.horaEntrada) {
                    const diff = calculateTardanza(horaNow, horario.horaEntrada, horario.toleranciaTardanza || 0);
                    if (diff > 0) tardanzaCalculated = diff;
                }
            }
            
            const newEvento = {
                tipo: 'Apertura',
                hora: horaNow,
                estadoSeleccionado: 'Atraso',
                observacion: 'Asistencia con atraso',
                registradoPor: user?.name || 'Supervisor',
                timestamp: new Date()
            };
            
            let updatedTimeline = current.eventosTimeline ? [...current.eventosTimeline] : [];
            const existingIndex = updatedTimeline.findIndex(e => e.tipo === 'Apertura' || e.tipo === 'Ausencia/Excepción');
            if (existingIndex >= 0) {
                updatedTimeline[existingIndex] = newEvento;
            } else {
                updatedTimeline.push(newEvento);
            }

            return {
                ...prev,
                [candId]: {
                    ...current,
                    estado: 'Presente',
                    tipoAusencia: null,
                    horaIngresoDeclarada: horaNow,
                    minutosTardanza: tardanzaCalculated,
                    eventosTimeline: updatedTimeline
                }
            };
        });
    };

    const handleCerrarDia = (candId) => {
        handleUpdateLog(candId, 'estadoDia', 'Cerrado');
        handleAddEvento(candId, 'Cierre', getNowHHmm(), 'Cierre Jornada', 'Jornada cerrada por supervisor');
    };

    const handleReabrirDia = (candId) => {
        handleUpdateLog(candId, 'estadoDia', 'Abierto');
        handleAddEvento(candId, 'Evento', getNowHHmm(), 'Reapertura', 'Día reabierto por supervisor');
    };

    const openPhotoModal = (candId, tipoEvento) => {
        setPhotoModalData({ candId, file: null, preview: null, isLoading: false, tipoEvento, observacion: '' });
        setShowPhotoModal(true);
    };

    const handleUploadPhoto = async () => {
        if (!photoModalData.file) return showToast('Selecciona una imagen', 'error');
        
        setPhotoModalData(prev => ({ ...prev, isLoading: true }));
        const formData = new FormData();
        formData.append('file', photoModalData.file);

        try {
            const stored = localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user');
            let token = null;
            if (stored) {
                try {
                    token = JSON.parse(stored)?.token || null;
                } catch (_) {
                    token = null;
                }
            }

            if (!token) {
                throw new Error('Sesión inválida. Vuelve a iniciar sesión para subir el respaldo.');
            }

            const res = await fetch(`${API_URL}/api/rrhh/asistencia/upload-respaldo`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const responseType = res.headers.get('content-type') || '';
            let data = {};
            if (responseType.includes('application/json')) {
                data = await res.json();
            } else {
                const responseText = await res.text();
                throw new Error(responseText?.slice(0, 120) || `Error HTTP ${res.status}`);
            }

            if (!res.ok) throw new Error(data.message || 'Error uploading');

            // Apply specific logic based on what required the photo
            if (['Ausente', 'Libre', 'Permiso', 'Licencia'].includes(photoModalData.tipoEvento)) {
                handleUpdateLog(photoModalData.candId, 'estado', photoModalData.tipoEvento);
                handleAddEvento(photoModalData.candId, 'Ausencia/Excepción', getNowHHmm(), photoModalData.tipoEvento, photoModalData.observacion || 'Respaldo cargado', data.url);
            } else if (photoModalData.tipoEvento === 'Retiro') {
                handleAddEvento(photoModalData.candId, 'Retiro', getNowHHmm(), 'Retiro Anticipado', photoModalData.observacion || 'Retiro anticipado registrado', data.url);
            } else {
                handleAddEvento(photoModalData.candId, 'Evento', getNowHHmm(), photoModalData.tipoEvento, photoModalData.observacion || 'Respaldo cargado', data.url);
            }

            showToast('Respaldo guardado', 'success');
            setShowPhotoModal(false);
        } catch (error) {
            console.error(error);
            showToast('Error al subir imagen', 'error');
        } finally {
            setPhotoModalData(prev => ({ ...prev, isLoading: false }));
        }
    };

    const handleSaveAsistencia = async () => {
        setAsistenciaSaving(true);
        try {
            const supervisorName = user?.name || user?.fullName || 'Supervisor';
            const registrosToSave = Object.values(asistenciaLogs).map(log => {
                const candidate = miEquipo.find(t => t.rrhh?._id === log.candidatoId);
                const projectObj = candidate?.rrhh?.projectId;
                const clientObj = projectObj?.cliente;
                const turnoId = (typeof log.turno === 'object' && log.turno?._id) ? log.turno._id : (log.turno || null);
                const horaIngreso = toHHmm(log.horaIngresoDeclarada);
                const minutosTardanza = Number(log.minutosTardanza || 0);

                let estadoFinal = log.estado;
                if (log.estado === 'Presente' && horaIngreso && minutosTardanza > 0) {
                    estadoFinal = 'Tardanza';
                }

                return {
                    candidatoId: log.candidatoId,
                    fecha: asistenciaFecha,
                    turnoId,
                    estado: estadoFinal,
                    horaIngresoDeclarada: horaIngreso,
                    horaEntrada: horaIngreso,
                    horaSalida: toHHmm(log.horaSalida),
                    minutosTardanza: ['Presente', 'Tardanza'].includes(estadoFinal) ? minutosTardanza : 0,
                    horasExtraAprobadas: ['Presente', 'Tardanza'].includes(estadoFinal) ? Number(log.horasExtraAprobadas || 0) : 0,
                    estadoHorasExtra: ['Presente', 'Tardanza'].includes(estadoFinal) && Number(log.horasExtraAprobadas || 0) > 0 ? 'Aprobado' : 'Sin HE',
                    tipoAusencia: ['Presente', 'Tardanza'].includes(estadoFinal) ? null : log.tipoAusencia,
                    descuentaDia: estadoFinal === 'Ausente' && log.tipoAusencia === 'Inasistencia Injustificada',
                    observacion: log.observacion || '',
                    validadoPor: supervisorName,
                    registradoPor: supervisorName,
                    proyectoId: projectObj?._id || null,
                    proyectoNombre: projectObj?.nombreProyecto || candidate?.proyecto || '',
                    clienteId: clientObj?._id || null,
                    clienteNombre: clientObj?.nombre || candidate?.mandantePrincipal || '',
                    estadoDia: log.estadoDia,
                    eventosTimeline: log.eventosTimeline,
                    syncFromProduccion: false
                };
            });

            await asistenciaApi.bulkUpsert(registrosToSave);
            showToast('Asistencia guardada correctamente', 'success');
            fetchAsistenciaLogs(asistenciaFecha);
        } catch (error) {
            console.error("Error al guardar asistencia:", error);
            showToast('Error al guardar asistencia', 'error');
        } finally {
            setAsistenciaSaving(false);
        }
    };

    const getTimelineDays = () => {
        const base = new Date(asistenciaFecha + 'T00:00:00');
        const year = base.getFullYear();
        const month = base.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const daysList = [];
        for (let i = 1; i <= daysInMonth; i++) {
            daysList.push(new Date(year, month, i));
        }
        return daysList;
    };

    useEffect(() => {
        const el = document.getElementById(`day-${asistenciaFecha}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [asistenciaFecha]);

    const handleCerrarDiaGeneral = () => {
        if (!window.confirm('¿Estás seguro de cerrar el día para todos los técnicos listados? No podrás hacer más modificaciones después de guardar.')) return;
        
        setAsistenciaLogs(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(candId => {
                if (updated[candId].estadoDia !== 'Cerrado') {
                    updated[candId] = {
                        ...updated[candId],
                        estadoDia: 'Cerrado',
                        eventosTimeline: [
                            ...(updated[candId].eventosTimeline || []),
                            {
                                tipo: 'Cierre',
                                hora: getNowHHmm(),
                                estadoSeleccionado: 'Cierre Jornada',
                                observacion: 'Cierre general de jornada',
                                registradoPor: user?.name || 'Supervisor',
                                timestamp: new Date()
                            }
                        ]
                    };
                }
            });
            return updated;
        });
        showToast('Día cerrado para todos. Recuerda hacer clic en "Guardar Avance".', 'success');
    };

    const handlePuntualMasivo = () => {
        if (!window.confirm('¿Deseas marcar como PUNTUAL a todos los técnicos listados que aún no tienen asistencia registrada hoy?')) return;

        setAsistenciaLogs(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(candId => {
                const log = updated[candId];
                if (log.estadoDia === 'Cerrado' || log.isLocked) return;
                
                const hasApertura = log.eventosTimeline?.some(e => e.tipo === 'Apertura' || e.tipo === 'Ausencia/Excepción');
                
                if (!hasApertura) {
                    updated[candId] = {
                        ...log,
                        estado: 'Presente',
                        horaIngresoDeclarada: '',
                        eventosTimeline: [
                            ...(log.eventosTimeline || []),
                            {
                                tipo: 'Apertura',
                                hora: getNowHHmm(),
                                estadoSeleccionado: 'Puntual',
                                observacion: 'Asistencia inicial (Masiva)',
                                registradoPor: user?.name || 'Supervisor',
                                timestamp: new Date()
                            }
                        ]
                    };
                }
            });
            return updated;
        });
        showToast('Asistencia Puntual masiva aplicada. Recuerda hacer clic en "Guardar Avance".', 'success');
    };

    return (
        <div className="max-w-[1400px] mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-500 w-full overflow-x-hidden relative">
            
            {/* Header Tarjeta */}
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-[2.5rem] p-8 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="absolute inset-0 bg-white/5 opacity-10 pointer-events-none"></div>
                <div className="space-y-2 relative z-10">
                    <span className="bg-white/20 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">Operaciones Terreno</span>
                    <h2 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                        <CheckSquare size={32} />
                        Asistencia Operativa
                    </h2>
                    <p className="text-teal-50 text-xs font-bold uppercase tracking-wider italic">
                        Control de disponibilidad, línea de tiempo diaria y respaldos
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 relative z-10 bg-white/10 p-3 rounded-3xl border border-white/10 backdrop-blur-md">
                    <label className="text-[10px] font-black uppercase text-teal-100 tracking-wider">Fecha de Control:</label>
                    <input
                        type="date"
                        value={asistenciaFecha}
                        onChange={(e) => setAsistenciaFecha(e.target.value)}
                        className="px-4 py-2 rounded-xl text-slate-800 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-teal-400"
                    />
                </div>
            </div>

            {/* Timeline Navegación Días */}
            <div className="bg-white rounded-[2rem] border border-slate-100 p-4 shadow-sm flex flex-wrap justify-between items-center gap-4">
                <div className="flex gap-2 overflow-x-auto py-1 custom-scrollbar w-full xl:w-auto flex-1">
                    {getTimelineDays().map((d, index) => {
                        const dLocal = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
                        const iso = dLocal.toISOString().split('T')[0];
                        const isSelected = iso === asistenciaFecha;
                        const weekday = d.toLocaleDateString('es-CL', { weekday: 'short' });
                        const dayNum = d.getDate();
                        return (
                            <button
                                key={index}
                                id={`day-${iso}`}
                                onClick={() => setAsistenciaFecha(iso)}
                                className={`flex-shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-2xl border transition-all ${
                                    isSelected
                                        ? 'bg-teal-600 border-teal-600 text-white shadow-md shadow-teal-100 scale-105'
                                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                                }`}
                            >
                                <span className="text-[9px] font-bold uppercase tracking-tight">{weekday}</span>
                                <span className="text-lg font-black tracking-tighter mt-0.5">{dayNum}</span>
                            </button>
                        );
                    })}
                </div>
                <button
                    onClick={() => setAsistenciaFecha(new Date().toISOString().split('T')[0])}
                    className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap"
                >
                    Hoy
                </button>
            </div>

            {/* Acciones y Búsqueda */}
            <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:w-96">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Filtrar por técnico o RUT..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-400 transition-all"
                        value={asistenciaSearch}
                        onChange={(e) => setAsistenciaSearch(e.target.value)}
                    />
                </div>
                <div className="flex w-full md:w-auto items-center justify-end gap-2 flex-wrap">
                    <button
                        onClick={handlePuntualMasivo}
                        disabled={asistenciaSaving || asistenciaLoading}
                        className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-200 flex items-center gap-2 disabled:opacity-50"
                    >
                        <CheckSquare size={14} /> Puntual Masivo
                    </button>
                    <button
                        onClick={handleCerrarDiaGeneral}
                        disabled={asistenciaSaving || asistenciaLoading}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-slate-200 flex items-center gap-2 disabled:opacity-50"
                    >
                        <XOctagon size={14} /> Cerrar Día General
                    </button>
                    <button
                        onClick={handleSaveAsistencia}
                        disabled={asistenciaSaving || asistenciaLoading}
                        className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-teal-100 flex items-center gap-2 disabled:opacity-50"
                    >
                        {asistenciaSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar Avance
                    </button>
                </div>
            </div>

            {/* Lista de Técnicos */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
                {asistenciaLoading ? (
                    <div className="p-20 text-center space-y-3">
                        <Loader2 size={40} className="animate-spin text-teal-600 mx-auto" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando...</p>
                    </div>
                ) : miEquipo.filter(t => t.rrhh?._id).length === 0 ? (
                    <div className="p-20 text-center text-slate-400 space-y-3">
                        <Users size={40} className="mx-auto" />
                        <p className="text-sm font-black uppercase tracking-wider">No tienes técnicos vinculados a tu equipo</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {miEquipo
                            .filter(t => t.rrhh?._id)
                            .filter(t => {
                                const q = asistenciaSearch.toLowerCase();
                                return t.nombre?.toLowerCase().includes(q) || t.rut?.toLowerCase().includes(q);
                            })
                            .map(tec => {
                                const log = asistenciaLogs[tec.rrhh._id] || {};
                                const isCerrado = log.estadoDia === 'Cerrado';
                                
                                return (
                                    <div key={tec._id} className={`p-6 flex flex-col gap-4 transition-colors ${isCerrado ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}>
                                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                                            {/* Datos Trabajador */}
                                            <div className="flex items-center gap-4 min-w-[280px]">
                                                <div className={`w-14 h-14 rounded-full border-2 bg-white flex items-center justify-center ${isCerrado ? 'border-slate-300 opacity-50' : 'border-teal-500 ring-2 ring-teal-50'}`}>
                                                    <span className="text-base font-black text-slate-500">{tec.nombre?.charAt(0)}</span>
                                                </div>
                                                <div>
                                                    <h4 className="text-base font-black text-slate-800">{tec.nombre}</h4>
                                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">{tec.rut} · {tec.cargo || 'Técnico'}</p>
                                                    
                                                    {log.turno && log.turno.nombre ? (() => {
                                                        const horario = getHorarioDelDia(log.turno, asistenciaFecha);
                                                        return (
                                                            <div className={`mt-1 flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border max-w-fit ${horario.esHorarioEspecial ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                                                <Clock size={10} className={horario.esHorarioEspecial ? 'text-indigo-500' : 'text-teal-500'}/> 
                                                                Turno: {horario.horaEntrada} a {horario.horaSalida}
                                                                {horario.esHorarioEspecial && <span title="Horario especial de este día" className="ml-0.5">★</span>}
                                                            </div>
                                                        );
                                                    })() : (
                                                        <div className="mt-1 flex items-center gap-1 text-[9px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 max-w-fit">
                                                            <XOctagon size={10} /> Sin turno asignado
                                                        </div>
                                                    )}

                                                    {isCerrado && <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full"><Clock size={10} /> Día Cerrado</span>}
                                                </div>
                                            </div>

                                            {/* Panel Control Principal */}
                                            <div className="flex-1 w-full lg:w-auto">
                                                {!isCerrado ? (
                                                    <div className="space-y-3">
                                                        <p className="text-[9px] font-black uppercase text-slate-400">Estado de la Jornada (Apertura)</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            <button 
                                                                onClick={() => handleSetPuntual(tec.rrhh._id)}
                                                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border ${['Presente', 'Tardanza'].includes(log.estado) && (log.minutosTardanza || 0) === 0 && !!log.horaIngresoDeclarada ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200'}`}
                                                            >
                                                                Puntual
                                                            </button>
                                                            <button 
                                                                onClick={() => handleSetAtraso(tec.rrhh._id)}
                                                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border ${['Presente', 'Tardanza'].includes(log.estado) && (log.minutosTardanza || 0) > 0 && !!log.horaIngresoDeclarada ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200'}`}
                                                            >
                                                                Atraso
                                                            </button>

                                                            {/* Estados de Excepción con Foto Obligatoria */}
                                                            {['Ausente', 'Libre', 'Permiso', 'Licencia'].map(ex => (
                                                                <button 
                                                                    key={ex}
                                                                    onClick={() => {
                                                                        if (ex === 'Libre') {
                                                                            handleUpdateLog(tec.rrhh._id, 'estado', 'Libre');
                                                                            handleAddEvento(tec.rrhh._id, 'Ausencia/Excepción', getNowHHmm(), 'Libre', 'Día libre asignado');
                                                                        } else {
                                                                            openPhotoModal(tec.rrhh._id, ex);
                                                                        }
                                                                    }}
                                                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border ${log.estado === ex ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-600 border-slate-200'} flex items-center gap-1`}
                                                                >
                                                                    {log.estado === ex && <CheckCircle2 size={12}/>} {ex}
                                                                </button>
                                                            ))}

                                                            {/* Botón de Retiro Anticipado */}
                                                            <button 
                                                                onClick={() => {
                                                                    handleUpdateLog(tec.rrhh._id, 'horaSalida', getNowHHmm());
                                                                    openPhotoModal(tec.rrhh._id, 'Retiro');
                                                                }}
                                                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border ${log.eventosTimeline?.some(e => e.tipo === 'Retiro') ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-slate-600 border-slate-200'} flex items-center gap-1`}
                                                            >
                                                                {log.eventosTimeline?.some(e => e.tipo === 'Retiro') && <CheckCircle2 size={12}/>} Retiro
                                                            </button>

                                                            {/* Botón de Fin Día */}
                                                            {['Presente', 'Tardanza'].includes(log.estado) && (
                                                                <button 
                                                                    onClick={() => {
                                                                        handleUpdateLog(tec.rrhh._id, 'isFinDia', true);
                                                                        if (!log.horaSalida) {
                                                                            handleUpdateLog(tec.rrhh._id, 'horaSalida', getNowHHmm());
                                                                        }
                                                                        handleAddEvento(tec.rrhh._id, 'Salida', getNowHHmm(), 'Fin Día', 'Término de jornada');
                                                                    }}
                                                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border ${log.isFinDia ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'} flex items-center gap-1 ml-auto`}
                                                                >
                                                                    {log.isFinDia && <CheckCircle2 size={12}/>} Fin Día
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* Paneles Contextuales (Ingreso y Fin Día) */}
                                                        {['Presente', 'Tardanza'].includes(log.estado) && log.horaIngresoDeclarada !== undefined && log.horaIngresoDeclarada !== '' && (
                                                            <div className={`flex flex-wrap items-center gap-4 mt-3 animate-in fade-in p-2.5 rounded-xl border max-w-fit ${(log.minutosTardanza || 0) > 0 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                                                
                                                                <div className="flex items-center gap-2">
                                                                    <label className={`text-[9px] font-black uppercase flex flex-col ${(log.minutosTardanza || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                                        <span>Hora de Ingreso</span>
                                                                        {(log.minutosTardanza || 0) > 0 ? (
                                                                            <span className="text-amber-500 font-bold lowercase">Tardanza: {log.minutosTardanza} min</span>
                                                                        ) : (
                                                                            <span className="text-emerald-500 font-bold lowercase">Puntual</span>
                                                                        )}
                                                                    </label>
                                                                    <input 
                                                                        type="time" 
                                                                        value={log.horaIngresoDeclarada}
                                                                        onChange={(e) => handleUpdateLog(tec.rrhh._id, 'horaIngresoDeclarada', e.target.value)}
                                                                        className={`px-2 py-1.5 text-xs font-bold border bg-white rounded-lg outline-none focus:ring-2 ${(log.minutosTardanza || 0) > 0 ? 'border-amber-200 focus:ring-amber-400' : 'border-emerald-200 focus:ring-emerald-400'}`}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}

                                                        {['Presente', 'Tardanza'].includes(log.estado) && log.isFinDia && (
                                                            <div className="flex flex-wrap items-center gap-4 mt-3 animate-in fade-in bg-indigo-50 p-2.5 rounded-xl border border-indigo-100 max-w-fit">
                                                                <div className="flex items-center gap-2">
                                                                    <label className="text-[9px] font-black uppercase text-indigo-600 flex flex-col">
                                                                        <span>Salida</span>
                                                                        <span className="text-indigo-400 font-bold lowercase">Término jornada</span>
                                                                    </label>
                                                                    <input 
                                                                        type="time" 
                                                                        value={log.horaSalida || ''}
                                                                        onChange={(e) => handleUpdateLog(tec.rrhh._id, 'horaSalida', e.target.value)}
                                                                        className="px-2 py-1.5 text-xs font-bold border border-indigo-200 bg-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                                                                    />
                                                                </div>

                                                                <div className="w-px h-8 bg-indigo-200 hidden sm:block"></div>

                                                                <div className="flex items-center gap-2">
                                                                    <label className="text-[9px] font-black uppercase text-emerald-600 flex flex-col">
                                                                        <span>H. Extras</span>
                                                                        <span className="text-emerald-500 font-bold lowercase">Aprobadas</span>
                                                                    </label>
                                                                    <input 
                                                                        type="number" 
                                                                        step="0.5"
                                                                        min="0"
                                                                        value={log.horasExtraAprobadas || 0}
                                                                        onChange={(e) => handleUpdateLog(tec.rrhh._id, 'horasExtraAprobadas', e.target.value)}
                                                                        className="w-16 px-2 py-1.5 text-xs font-bold border border-emerald-200 bg-white rounded-lg outline-none focus:ring-2 focus:ring-emerald-400"
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-3 text-slate-500">
                                                        <CheckSquare size={20} className="text-emerald-500" />
                                                        <div>
                                                            <p className="text-sm font-black">Día Cerrado</p>
                                                            <p className="text-[10px] uppercase">No se permiten más eventos hoy.</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Botón Cierre / Apertura */}
                                            <div>
                                                {!isCerrado ? (
                                                    <button 
                                                        onClick={() => handleCerrarDia(tec.rrhh._id)}
                                                        className="px-4 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all"
                                                    >
                                                        Cerrar Día
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => handleReabrirDia(tec.rrhh._id)}
                                                        className="px-4 py-2 bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 transition-all"
                                                    >
                                                        Reabrir
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Timeline / Novedades */}
                                        <div className="mt-4 pt-4 border-t border-slate-100">
                                            <div className="flex items-center justify-between mb-3">
                                                <h5 className="text-[10px] font-black uppercase text-slate-400">Timeline de Eventos</h5>
                                                {!isCerrado && (
                                                    <button 
                                                        onClick={() => openPhotoModal(tec.rrhh._id, 'Novedad/Retiro')}
                                                        className="flex items-center gap-1 text-[9px] font-black uppercase text-blue-500 hover:text-blue-600"
                                                    >
                                                        <Camera size={12} /> Agregar Evento
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {log.eventosTimeline?.map((ev, i) => (
                                                    <div key={i} className="flex flex-col bg-slate-50 border border-slate-200 rounded-lg p-2 min-w-[150px]">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-[9px] font-black uppercase text-slate-500">{ev.tipo}</span>
                                                            <span className="text-[9px] font-bold text-slate-400">{ev.hora}</span>
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-800">{ev.estadoSeleccionado}</span>
                                                        {ev.fotoUrl && (
                                                            <a href={ev.fotoUrl} target="_blank" rel="noreferrer" className="text-[9px] font-black text-blue-500 uppercase flex items-center gap-1 mt-1 hover:underline">
                                                                <Camera size={10} /> Ver Respaldo
                                                            </a>
                                                        )}
                                                    </div>
                                                ))}
                                                {(!log.eventosTimeline || log.eventosTimeline.length === 0) && (
                                                    <span className="text-[10px] text-slate-400 italic font-bold">Sin eventos registrados</span>
                                                )}
                                            </div>
                                        </div>

                                    </div>
                                );
                            })}
                    </div>
                )}
            </div>

            {/* Modal de Foto / Respaldo */}
            {showPhotoModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md relative animate-in zoom-in-95 duration-200">
                        <button onClick={() => setShowPhotoModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                            <X size={20} />
                        </button>
                        <div className="mb-6">
                            <h3 className="text-lg font-black uppercase text-slate-800 flex items-center gap-2">
                                <Camera className="text-teal-500" />
                                Respaldo Fotográfico
                            </h3>
                            <p className="text-xs font-bold text-slate-500 mt-1">Sube una foto obligatoria para: {photoModalData.tipoEvento}</p>
                        </div>
                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase text-slate-400">Seleccionar Archivo (Imagen)</label>
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            setPhotoModalData(prev => ({ 
                                                ...prev, 
                                                file, 
                                                preview: URL.createObjectURL(file) 
                                            }));
                                        }
                                    }}
                                    className="text-sm font-bold text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase text-slate-400">Observaciones (Opcional)</label>
                                <textarea
                                    value={photoModalData.observacion}
                                    onChange={(e) => setPhotoModalData(prev => ({ ...prev, observacion: e.target.value }))}
                                    placeholder="Detalles sobre esta justificación..."
                                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-teal-400 resize-none h-20"
                                />
                            </div>
                            {photoModalData.preview && (
                                <div className="rounded-xl border border-slate-200 overflow-hidden h-40">
                                    <img src={photoModalData.preview} alt="Preview" className="w-full h-full object-cover" />
                                </div>
                            )}
                            <button 
                                onClick={handleUploadPhoto}
                                disabled={photoModalData.isLoading || !photoModalData.file}
                                className="w-full py-3 bg-teal-600 text-white rounded-xl font-black uppercase text-xs tracking-widest disabled:opacity-50 hover:bg-teal-700 transition-all flex items-center justify-center gap-2"
                            >
                                {photoModalData.isLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Guardar Respaldo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AsistenciaOperativa;

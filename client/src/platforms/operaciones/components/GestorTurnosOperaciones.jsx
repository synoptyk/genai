```javascript
import React, { useState, useEffect } from 'react';
import api from '../../../api/api';
import { useAuth } from '../../auth/AuthContext';
import { Loader2, Calendar, Send, CheckCircle2, ChevronLeft, ChevronRight, UserPlus, Trash2 } from 'lucide-react';

const GestorTurnosOperaciones = () => {
    const { user, authHeader } = useAuth();
    const [loading, setLoading] = useState(true);
    const [turnos, setTurnos] = useState([]);
    const [supervisoresActivos, setSupervisoresActivos] = useState([]);

    // Controles de fecha (Semana Actual por defecto)
    const getLunesSemana = (fecha = new Date()) => {
        const d = new Date(fecha);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajuste para Lunes
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    };

    const [semanaView, setSemanaView] = useState(getLunesSemana());

    // Permisos
    const isAdmin = user?.role === 'ceo' || user?.role === 'ceo_genai' || user?.role === 'admin_operaciones';

    const fetchDatos = async () => {
        setLoading(true);
        try {
            // Cargar supervisores (Filtrar usuarios con rol supervisor/admin)
            if (isAdmin) {
                const resUsers = await api.get(`/ api / auth / users`);
                const superv = resUsers.data.filter(u => u.role.includes('supervisor') || u.role.includes('operaciones'));
                setSupervisoresActivos(superv);
            }

            // Cargar turnos de la semana
            const resTurnos = await api.get(`/ api / operaciones / turnos ? semanaDe = ${ semanaView.toISOString() } `);
            setTurnos(resTurnos.data);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDatos();
    }, [semanaView, user]);

    const cambiarSemana = (offset) => {
        const nueva = new Date(semanaView);
        nueva.setDate(nueva.getDate() + (offset * 7));
        setSemanaView(nueva);
    };

    const generarDiasSemana = () => {
        const dias = ['L', 'M', 'M', 'J', 'V', 'S'];
        return dias.map((d, i) => {
            const fecha = new Date(semanaView);
            fecha.setDate(fecha.getDate() + i);
            return {
                label: d,
                fechaFormato: fecha.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }),
                dateObj: fecha
            };
        });
    };

    const diasCol = generarDiasSemana();

    // HANDLERS (ADMIN)
    const handleCrearTurnoVacio = async (supervisorId) => {
        const supervisor = supervisoresActivos.find(s => s._id === supervisorId);
        if (!supervisor) return;

        // Horario por Defecto: 09:00 a 19:00 (Podría cambiarse en interfaz)
        const rutasNuevas = diasCol.map(d => ({
            fecha: d.dateObj,
            diaSemana: d.label,
            horario: '09:00 a 19:00'
        }));

        const semanaHasta = new Date(semanaView);
        semanaHasta.setDate(semanaHasta.getDate() + 6);

        try {
            await api.post(`/ api / operaciones / turnos`, {
                semanaDe: semanaView,
                semanaHasta,
                supervisor: supervisor._id,
                supervisorNombre: supervisor.name,
                rutasDiarias: rutasNuevas,
                creadoPor: user._id || user.id
            });
            fetchDatos();
        } catch (error) {
            alert(error.response?.data?.error || 'Error al asignar turno');
        }
    };

    // HANDLER (SUPERVISOR)
    const handleConfirmar = async (turnoId) => {
        try {
            await api.put(`/ api / operaciones / turnos / ${ turnoId }/confirmar`, {});
fetchDatos();
alert("Turno confirmado exitosamente.");
        } catch (error) {
    alert("Error al confirmar turno");
}
    };

// HANDLER (ADMIN TOGGLE HORARIO)
const handleToggleHorario = async (turno, diaIndex) => {
    if (!isAdmin) return;

    const nuevaRuta = [...turno.rutasDiarias];
    const actual = nuevaRuta[diaIndex].horario;

    // Rotar horarios comunes
    nuevaRuta[diaIndex].horario = actual === '09:00 a 19:00' ? '09:00 a 17:30' :
        actual === '09:00 a 17:30' ? 'LIBRE' : '09:00 a 19:00';

    try {
        // Reutilizando endpoint de guardar si existiera, o directo por Axios
        await api.put(`/api/operaciones/turnos/${turno._id}`, { rutasDiarias: nuevaRuta });
        fetchDatos();
    } catch (error) {
        console.error("Falta endpoint PUT general o error:", error);
        alert("Error al editar horario. Asegúrese que el backend soporte PUT genérico.");
    }
};

if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-fuchsia-500 w-10 h-10" /></div>;

return (
    <div className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-xl space-y-8 animate-in slide-in-from-bottom duration-500 max-w-6xl mx-auto">

        {/* Cabecera y Navegación de Semanas */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-slate-50 p-4 rounded-3xl border border-slate-200 gap-4">
            <div className="flex items-center gap-3">
                <div className="bg-fuchsia-100 p-3 rounded-2xl text-fuchsia-600"><Calendar size={24} /></div>
                <div>
                    <h3 className="font-black text-slate-800 uppercase tracking-tight text-lg">Semana Operativa</h3>
                    <p className="text-xs font-bold text-slate-400 italic">Programación de Lunes a Sábado</p>
                </div>
            </div>

            <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
                <button onClick={() => cambiarSemana(-1)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all"><ChevronLeft size={20} /></button>
                <span className="px-6 font-black text-sm text-slate-700 uppercase tracking-widest">
                    {semanaView.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })} - {
                        new Date(semanaView.getTime() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
                    }
                </span>
                <button onClick={() => cambiarSemana(1)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all"><ChevronRight size={20} /></button>
            </div>
        </div>

        {/* TABLA DE TURNOS (SIMIL FOTO ADJUNTA AL PROMPT) */}
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className="bg-slate-800 text-white p-4 rounded-tl-2xl font-black text-xs uppercase tracking-widest text-left w-64 border-r border-slate-700">Supervisor</th>
                        {diasCol.map((d, i) => (
                            <th key={i} className={`bg-blue-100 p-2 border border-blue-200 text-center ${i === 5 ? 'rounded-tr-2xl' : ''}`}>
                                <p className="text-[10px] font-black text-blue-800 uppercase">{d.fechaFormato}</p>
                                <p className="text-lg font-black text-blue-600">{d.label}</p>
                            </th>
                        ))}
                        <th className="bg-slate-800 text-white p-4 font-black text-xs uppercase tracking-widest text-center">Estado</th>
                    </tr>
                </thead>
                <tbody>
                    {turnos.length === 0 ? (
                        <tr><td colSpan={8} className="p-10 text-center text-slate-400 font-bold italic text-sm border border-slate-100">No hay programación cargada para esta semana.</td></tr>
                    ) : (
                        turnos.map(turno => (
                            <tr key={turno._id} className="hover:bg-slate-50 transition-colors group">
                                <td className="p-4 border border-slate-200 font-black text-slate-700 text-sm">{turno.supervisorNombre}</td>

                                {/* DÍAS COLUMNAS */}
                                {diasCol.map((d, i) => {
                                    const diaInfo = turno.rutasDiarias.find(r => r.diaSemana === d.label);
                                    const horarioTexto = diaInfo ? diaInfo.horario : 'LIBRE';

                                    return (
                                        <td
                                            key={i}
                                            onClick={() => handleToggleHorario(turno, turno.rutasDiarias.findIndex(r => r.diaSemana === d.label))}
                                            className={`p-2 border border-slate-200 text-center transition-colors select-none ${isAdmin ? 'cursor-pointer hover:bg-blue-50' : ''} ${horarioTexto === 'LIBRE' ? 'bg-slate-100' : 'bg-white'}`}
                                        >
                                            <span className={`text-xs font-bold truncate ${horarioTexto === 'LIBRE' ? 'text-slate-400' : 'text-slate-700'}`}>
                                                {horarioTexto}
                                            </span>
                                        </td>
                                    );
                                })}

                                {/* ESTADO / BOTON CONFIRMAR */}
                                <td className="p-4 border border-slate-200 text-center bg-white">
                                    {turno.estado === 'Confirmado' ? (
                                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 font-black text-[10px] uppercase px-3 py-1 rounded-full"><CheckCircle2 size={12} /> Confirmado</span>
                                    ) : (
                                        <>
                                            {/* SI SOY ESE SUPERVISOR, ME SALE BOTON PARA CONFIRMAR */}
                                            {(user?.id || user?._id) === turno.supervisor?._id ? (
                                                <button onClick={() => handleConfirmar(turno._id)} className="bg-fuchsia-600 text-white font-black text-[10px] uppercase px-4 py-2 rounded-xl shadow-lg shadow-fuchsia-200 hover:scale-105 transition-transform flex items-center justify-center gap-2 w-full">
                                                    <Send size={14} /> Enterado
                                                </button>
                                            ) : (
                                                <span className="text-slate-400 font-bold text-[10px] uppercase italic animate-pulse">{turno.estado}</span>
                                            )}
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>

        {/* ZONA ADMIN: ASIGNAR NUEVO SUPERVISOR A LA SEMANA */}
        {isAdmin && (
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 border-dashed">
                <h4 className="flex items-center gap-2 text-xs font-black uppercase text-slate-500 mb-4 tracking-widest"><UserPlus size={16} /> Asignar Supervisor a Semana</h4>
                <div className="flex gap-4">
                    <select id="supervSelect" className="flex-1 p-3 rounded-2xl border border-slate-300 font-bold text-sm text-slate-700">
                        <option value="">-- Seleccionar Supervisor --</option>
                        {supervisoresActivos.map(s => (
                            <option key={s._id} value={s._id}>{s.name} ({s.cargo || 'Supervisor'})</option>
                        ))}
                    </select>
                    <button
                        onClick={() => {
                            const val = document.getElementById('supervSelect').value;
                            if (val) handleCrearTurnoVacio(val);
                        }}
                        className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-fuchsia-600 transition-colors shadow-lg shadow-slate-200"
                    >
                        Crear Horario Estándar
                    </button>
                </div>
                <p className="text-[10px] text-slate-400 font-bold italic mt-3">* El botón crea una fila base de 09:00 a 19:00. Las notificaciones se enviarán al supervisor asociado.</p>
            </div>
        )}
    </div>
);
};

export default GestorTurnosOperaciones;

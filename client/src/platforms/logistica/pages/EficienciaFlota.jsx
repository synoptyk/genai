import React, { useState, useEffect, useMemo } from 'react';
import { Truck, Activity, Droplets, Map as MapIcon, Upload, CheckCircle2, AlertTriangle, Search, ChevronRight, X, Loader2, Calendar, TrendingUp, Car, Route, DollarSign, Trophy } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import { telecomApi as api } from '../../agentetelecom/telecomApi'; // Ajusta la importación según tu estructura

// ============================================================================
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || ''; 

// ============================================================================
// COMPONENTES DE GRÁFICOS (RECHARTS)
// ============================================================================

const CustomBarLabel = (props) => {
    const { x, y, width, value, total } = props;
    if (!value || value === 0) return null;
    
    const porcentaje = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
    const abr = `$${(value / 1000).toFixed(0)}k`;

    return (
        <g>
            <text x={x + width / 2} y={y - 12} fill="#64748b" textAnchor="middle" fontSize={9} fontWeight={800}>
                {abr}
            </text>
            <text x={x + width / 2} y={y - 2} fill="#94a3b8" textAnchor="middle" fontSize={8} fontWeight={600}>
                {porcentaje}%
            </text>
        </g>
    );
};

const formatNombreCorto = (nombreFull) => {
    if (!nombreFull || nombreFull === 'Sin Técnico' || nombreFull === 'Desconocido') return 'Sin Técnico';
    const parts = nombreFull.trim().split(/\s+/);
    if (parts.length >= 4) {
        return `${parts[0]} ${parts[2]}`;
    } else if (parts.length === 3) {
        return `${parts[0]} ${parts[1]}`;
    } else if (parts.length === 2) {
        return `${parts[0]} ${parts[1]}`;
    } else {
        return parts[0];
    }
};

const CustomXAxisTick = ({ x, y, payload }) => {
    if (!payload || !payload.value) return null;
    const [nombre, patente] = payload.value.split('|');
    return (
        <g transform={`translate(${x},${y}) rotate(-45)`}>
            <text x={0} y={0} dy={10} textAnchor="end" fill="#475569" fontSize={9} fontWeight={900}>
                {nombre}
            </text>
            <text x={0} y={0} dy={22} textAnchor="end" fill="#94a3b8" fontSize={8} fontWeight={700}>
                {patente}
            </text>
        </g>
    );
};

// ============================================================================
// COMPONENTE SECUNDARIO: CARGA DE COMBUSTIBLE
// ============================================================================
const ConsumoCombustible = () => {
    const [historico, setHistorico] = useState([]);
    const [cargando, setCargando] = useState(false);
    
    // Estados para Vista por Trabajador
    const [viewMode, setViewMode] = useState('historial'); // 'historial' o 'trabajadores'
    const [consumoTrabajadores, setConsumoTrabajadores] = useState([]);
    const [cargandoTrabajadores, setCargandoTrabajadores] = useState(false);

    const [procesando, setProcesando] = useState(false);
    const [msg, setMsg] = useState(null);
    const [filtroTexto, setFiltroTexto] = useState('');
    const [filtroAnio, setFiltroAnio] = useState('');
    const [filtroMes, setFiltroMes] = useState('');
    const [filtroPatente, setFiltroPatente] = useState('');
    const [filtroEstacion, setFiltroEstacion] = useState('');
    const [presupuestoVehiculo, setPresupuestoVehiculo] = useState(150000);

    // Estados para Mapeo Inteligente
    const [showMappingModal, setShowMappingModal] = useState(false);
    const [fileData, setFileData] = useState([]);
    const [fileHeaders, setFileHeaders] = useState([]);
    const [columnMapping, setColumnMapping] = useState({});

    const cargarHistorial = async () => {
        setCargando(true);
        try {
            const res = await api.get('/flota/eficiencia/combustible');
            setHistorico(res.data || []);
        } catch (error) {
            console.error('Error cargando historial de combustible:', error);
            setMsg({ type: 'err', text: 'Error al cargar el histórico' });
        } finally {
            setCargando(false);
        }
    };

    const cargarConsumoTrabajadores = async () => {
        setCargandoTrabajadores(true);
        try {
            const params = new URLSearchParams();
            if (filtroMes) {
                const [y, m] = filtroMes.split('-');
                const lastDay = new Date(y, m, 0).getDate();
                params.append('desde', `${filtroMes}-01`);
                params.append('hasta', `${filtroMes}-${lastDay}`);
            } else if (filtroAnio) {
                params.append('desde', `${filtroAnio}-01-01`);
                params.append('hasta', `${filtroAnio}-12-31`);
            }
            if (filtroPatente) params.append('patente', filtroPatente);
            
            const res = await api.get(`/flota/eficiencia/combustible/trabajadores?${params.toString()}`);
            setConsumoTrabajadores(res.data || []);
        } catch (error) {
            console.error('Error cargando consumo por trabajador:', error);
            setMsg({ type: 'err', text: 'Error al cargar datos agrupados' });
        } finally {
            setCargandoTrabajadores(false);
        }
    };

    useEffect(() => {
        cargarHistorial();
    }, []);

    useEffect(() => {
        if (viewMode === 'trabajadores') {
            cargarConsumoTrabajadores();
        }
    }, [viewMode, filtroAnio, filtroMes, filtroPatente]);

    // Extraer años, meses, patentes y estaciones disponibles
    const { aniosDisponibles, mesesDisponibles, patentesDisponibles, estacionesDisponibles } = useMemo(() => {
        const anios = new Set();
        const meses = new Set();
        const patentes = new Set();
        const estaciones = new Set();
        
        historico.forEach(row => {
            if (row.fechaCarga) {
                const date = new Date(row.fechaCarga);
                if (!isNaN(date.getTime())) {
                    const anio = date.getFullYear().toString();
                    anios.add(anio);
                    // Solo agregar al mes si coincide con el filtro de año (si hay uno activo), o siempre
                    meses.add(`${anio}-${(date.getMonth() + 1).toString().padStart(2, '0')}`);
                }
            }
            if (row.patente) patentes.add(row.patente);
            if (row.estacion) estaciones.add(row.estacion);
        });
        
        return {
            aniosDisponibles: Array.from(anios).sort().reverse(),
            mesesDisponibles: Array.from(meses).sort().reverse(),
            patentesDisponibles: Array.from(patentes).sort(),
            estacionesDisponibles: Array.from(estaciones).sort()
        };
    }, [historico]);

    const historicoFiltrado = useMemo(() => {
        let result = historico;

        if (filtroAnio) {
            result = result.filter(row => {
                const d = new Date(row.fechaCarga);
                return d.getFullYear().toString() === filtroAnio;
            });
        }

        if (filtroMes) {
            result = result.filter(row => {
                const d = new Date(row.fechaCarga);
                return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}` === filtroMes;
            });
        }

        if (filtroPatente) {
            result = result.filter(row => row.patente === filtroPatente);
        }

        if (filtroEstacion) {
            result = result.filter(row => row.estacion === filtroEstacion);
        }

        if (filtroTexto) {
            const lower = filtroTexto.toLowerCase();
            result = result.filter(row => 
                row.patente?.toLowerCase().includes(lower) ||
                row.estacion?.toLowerCase().includes(lower) ||
                row.tarjeta?.toLowerCase().includes(lower) ||
                row.monto?.toString().includes(lower) ||
                row.litros?.toString().includes(lower) ||
                new Date(row.fechaCarga).toLocaleDateString('es-CL').includes(lower)
            );
        }
        
        return result;
    }, [historico, filtroTexto, filtroAnio, filtroMes, filtroPatente, filtroEstacion]);

    // Función inteligente para normalizar y formatear patentes (chilenas)
    const formatPatente = (p) => {
        if (!p) return '';
        const clean = String(p).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        return clean.replace(/([A-Z]+)([0-9]+)/, '$1-$2');
    };

    const parseNumber = (val) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            const cleanVal = val.replace(/\./g, '').replace(',', '.');
            const parsed = Number(cleanVal);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    };

    const parseDateTime = (fechaVal, horaVal) => {
        let dateObj = new Date();
        
        if (typeof fechaVal === 'number') {
            // Utiliza decodificador nativo de Excel para evitar bugs de año bisiesto 1900 y de zonas horarias
            const parsed = XLSX.SSF.parse_date_code(fechaVal);
            dateObj = new Date(parsed.y, parsed.m - 1, parsed.d);
        } else if (typeof fechaVal === 'string') {
            const parts = fechaVal.trim().split(/[-/]/);
            if (parts.length === 3) {
                let day, month, year;
                if (parts[0].length === 4) {
                    // YYYY-MM-DD
                    year = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10) - 1;
                    day = parseInt(parts[2], 10);
                } else if (parts[2].length === 4) {
                    // DD-MM-YYYY
                    day = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10) - 1;
                    year = parseInt(parts[2], 10);
                } else {
                    // DD-MM-YY (asumiendo YY al final)
                    day = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10) - 1;
                    year = parseInt(parts[2], 10) + 2000;
                }
                dateObj = new Date(year, month, day);
            } else {
                dateObj = new Date(fechaVal);
            }
        } else if (fechaVal instanceof Date) {
            dateObj = new Date(fechaVal.getTime());
        }

        if (isNaN(dateObj.getTime())) {
            dateObj = new Date();
        }

        if (typeof horaVal === 'string') {
            const timeParts = horaVal.trim().split(':');
            if (timeParts.length >= 2) {
                dateObj.setHours(parseInt(timeParts[0], 10) || 0);
                dateObj.setMinutes(parseInt(timeParts[1], 10) || 0);
                dateObj.setSeconds(parseInt(timeParts[2], 10) || 0);
            }
        } else if (typeof horaVal === 'number') {
            const totalSeconds = Math.round(horaVal * 86400);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            dateObj.setHours(hours);
            dateObj.setMinutes(minutes);
            dateObj.setSeconds(seconds);
        }

        return dateObj;
    };

    // Procesar datos para KPI y Gráficos
    const stats = useMemo(() => {
        if (!historicoFiltrado || historicoFiltrado.length === 0) return null;

        let totalMonto = 0;
        let totalLitros = 0;
        
        let minOdoPorPatente = {};
        let maxOdoPorPatente = {};
        const gastoPorPatente = {};
        
        // Asumiremos un array base de 31 días para acumular
        const datosGrafico = Array.from({ length: 31 }, (_, i) => ({ dia: i + 1, monto: 0, litros: 0 }));

        historicoFiltrado.forEach(rawRow => {
            const row = { ...rawRow, patente: formatPatente(rawRow.vehiculoPatente || rawRow.patente) };
            const date = new Date(row.fechaCarga);
            if (isNaN(date.getTime())) return;
            
            // Km recorridos
            if (row.odometro > 0) {
                if (!minOdoPorPatente[row.patente] || row.odometro < minOdoPorPatente[row.patente]) {
                    minOdoPorPatente[row.patente] = row.odometro;
                }
                if (!maxOdoPorPatente[row.patente] || row.odometro > maxOdoPorPatente[row.patente]) {
                    maxOdoPorPatente[row.patente] = row.odometro;
                }
            }

            const monto = row.monto || 0;
            const litros = row.litros || 0;

            totalMonto += monto;
            totalLitros += litros;

            if (!gastoPorPatente[row.patente]) {
                gastoPorPatente[row.patente] = { monto: 0, tecnico: row.tecnicoNombre || 'Sin Técnico' };
            }
            gastoPorPatente[row.patente].monto += monto;

            const d = date.getDate();
            if (d >= 1 && d <= 31) {
                datosGrafico[d - 1].monto += monto;
                datosGrafico[d - 1].litros += litros;
                // Si está filtrado a 1 mes, se verá perfecto. Si hay varios meses, se acumularán por día del mes.
                datosGrafico[d - 1].date = `${d.toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            }
        });

        // Sin límite de 10. Ahora se llama gastosVehiculos
        const gastosVehiculos = Object.entries(gastoPorPatente)
            .map(([patente, data]) => ({ 
                patente, 
                monto: data.monto,
                tecnico: data.tecnico,
                label: data.tecnico !== 'Sin Técnico' ? `${formatNombreCorto(data.tecnico)}|${patente}` : `Sin Técnico|${patente}`
            }))
            .sort((a, b) => b.monto - a.monto);

        // Días representados (usamos 31 como max por defecto si hay meses de 31 en la muestra)
        const daysInMonth = 31;
        let acumuladoTotal = 0;
        const chartData = datosGrafico.map(d => {
            acumuladoTotal += d.monto;
            return {
                ...d,
                montoAcumulado: acumuladoTotal,
                date: d.date || `${d.dia.toString().padStart(2, '0')}/-`
            };
        });

        const chartDataPatentes = [...gastosVehiculos];

        const chartDataSemanas = [
            { semana: 'Sem 1 (1-7)', monto: 0 },
            { semana: 'Sem 2 (8-14)', monto: 0 },
            { semana: 'Sem 3 (15-21)', monto: 0 },
            { semana: 'Sem 4 (22-28)', monto: 0 },
            { semana: `Sem 5 (29-31)`, monto: 0 }
        ];

        datosGrafico.forEach(d => {
            if (d.dia <= 7) chartDataSemanas[0].monto += d.monto;
            else if (d.dia <= 14) chartDataSemanas[1].monto += d.monto;
            else if (d.dia <= 21) chartDataSemanas[2].monto += d.monto;
            else if (d.dia <= 28) chartDataSemanas[3].monto += d.monto;
            else chartDataSemanas[4].monto += d.monto;
        });

        let totalKm = 0;
        Object.keys(maxOdoPorPatente).forEach(pat => {
            const diff = maxOdoPorPatente[pat] - (minOdoPorPatente[pat] || 0);
            if (diff > 0 && diff < 150000) { // sanity check
                totalKm += diff;
            }
        });

        const totalCargas = historicoFiltrado.length;
        const totalDiasUnicos = Math.max(1, new Set(historicoFiltrado.map(h => new Date(h.fechaCarga).toLocaleDateString())).size);

        // Consideramos "válido" si consumió >= $10.000 para el periodo
        const vehiculosValidos = Object.values(gastoPorPatente).filter(monto => monto >= 10000).length;

        // Label del periodo (Inteligente)
        let mesLiteral = 'Periodo Seleccionado';
        if (filtroMes) {
            const [y, m] = filtroMes.split('-');
            const d = new Date(parseInt(y), parseInt(m)-1, 1);
            mesLiteral = d.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        } else if (filtroAnio) {
            mesLiteral = `Año ${filtroAnio}`;
        }

        return {
            mesLiteral,
            totalMontoMes: totalMonto,
            totalLitrosMes: totalLitros,
            promedioDiaMonto: totalMonto / (filtroMes ? 30 : totalDiasUnicos || 30),
            promedioSemanaMonto: totalMonto / (filtroMes ? 4 : (totalDiasUnicos / 7) || 4),
            vehiculosMes: vehiculosValidos,
            promedioPorVehiculo: vehiculosValidos > 0 ? totalMonto / vehiculosValidos : 0,
            cargasDiaPromedio: totalCargas / totalDiasUnicos,
            totalKmCalculados: totalKm,
            gastosVehiculos,
            chartData,
            chartDataPatentes,
            chartDataSemanas,
            diasMes: daysInMonth
        };
    }, [historicoFiltrado, filtroMes, filtroAnio]);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setProcesando(true);
        setMsg(null);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (!data || data.length === 0) {
                    setMsg({ type: 'err', text: 'El archivo Excel parece estar vacío.' });
                    setProcesando(false);
                    return;
                }

                const headersSet = new Set();
                data.forEach(row => Object.keys(row).forEach(k => headersSet.add(k)));
                const headers = Array.from(headersSet);

                // 🧠 Memoria Inteligente: Recuperar último mapeo exitoso
                let savedMapping = null;
                try {
                    const saved = localStorage.getItem('fuelColumnMapping');
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        // Verificar si el archivo actual tiene las columnas del mapeo anterior
                        const isCompatible = Object.values(parsed).some(v => v && headers.includes(v));
                        if (isCompatible) savedMapping = parsed;
                    }
                } catch (e) { /* ignore */ }

                const findKey = (keywords) => {
                    for (const kw of keywords) {
                        const found = headers.find(k => k.toLowerCase().includes(kw));
                        if (found) return found;
                    }
                    return '';
                };

                // Si hay un mapeo previo, lo priorizamos. Si no, adivinamos.
                let initialMapping = {};
                if (savedMapping) {
                    initialMapping = { ...savedMapping };
                    // Limpiar campos cuya columna ya no viene en este nuevo Excel
                    Object.keys(initialMapping).forEach(k => {
                        if (initialMapping[k] && !headers.includes(initialMapping[k])) {
                            initialMapping[k] = '';
                        }
                    });
                } else {
                    initialMapping = {
                        fechaCarga: findKey(['fecha', 'date']),
                        horaCarga: findKey(['hora', 'time']),
                        patente: findKey(['patente', 'placa', 'vehiculo']),
                        monto: findKey(['monto trans', 'monto', 'total']),
                        comprobanteTransaccion: findKey(['comprobante transaccion', 'comprobante', 'transaccion', 'folio', 'nro']),
                        litros: findKey(['litro', 'vol', 'cantidad', 'volumen']),
                        tipoCombustible: findKey(['tipo', 'producto', 'combustible']),
                        odometro: findKey(['odo', 'km', 'kilometraje']),
                        estacion: findKey(['comuna e/s', 'direccion e/s', 'estacion', 'sucursal']),
                        tarjeta: findKey(['tarjeta', 'cupon', 'nro tarjeta', 'numero tarjeta'])
                    };
                }

                setColumnMapping(initialMapping);
                setFileData(data);
                setFileHeaders(headers);
                setShowMappingModal(true);
                setProcesando(false);

            } catch (error) {
                console.error('Error procesando Excel:', error);
                setMsg({ type: 'err', text: 'Error al procesar el archivo Excel.' });
                setProcesando(false);
            } finally {
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const confirmUpload = async () => {
        setShowMappingModal(false);
        setProcesando(true);
        setMsg(null);

        // Guardar configuración para la próxima vez
        try {
            localStorage.setItem('fuelColumnMapping', JSON.stringify(columnMapping));
        } catch(e) { /* ignore */ }

        try {
            const payload = fileData.map(row => {
                const rawPatente = columnMapping.patente ? row[columnMapping.patente] : null;
                const rawFecha = columnMapping.fechaCarga ? row[columnMapping.fechaCarga] : null;
                const rawHora = columnMapping.horaCarga ? row[columnMapping.horaCarga] : null;
                const rawLitros = columnMapping.litros ? row[columnMapping.litros] : 0;
                const rawMonto = columnMapping.monto ? row[columnMapping.monto] : 0;
                const rawOdometro = columnMapping.odometro ? row[columnMapping.odometro] : 0;
                const rawTarjeta = columnMapping.tarjeta ? row[columnMapping.tarjeta] : null;

                return {
                    ...row,
                    patente: formatPatente(rawPatente),
                    fechaCarga: rawFecha ? parseDateTime(rawFecha, rawHora) : new Date(),
                    litros: parseNumber(rawLitros),
                    monto: parseNumber(rawMonto),
                    tipoCombustible: columnMapping.tipoCombustible && row[columnMapping.tipoCombustible] ? row[columnMapping.tipoCombustible] : '',
                    odometro: parseNumber(rawOdometro),
                    estacion: columnMapping.estacion && row[columnMapping.estacion] ? row[columnMapping.estacion] : '',
                    tarjeta: rawTarjeta ? String(rawTarjeta).trim() : '',
                    comprobanteTransaccion: columnMapping.comprobanteTransaccion && row[columnMapping.comprobanteTransaccion] ? String(row[columnMapping.comprobanteTransaccion]).trim() : null
                };
            }).filter(r => r.patente && r.monto > 0 && r.comprobanteTransaccion);

            if (payload.length === 0) {
                setMsg({ type: 'err', text: 'No se encontraron datos válidos con el mapeo seleccionado. Verifique que la columna Monto, Patente y Comprobante estén mapeadas y contengan datos válidos.' });
                setProcesando(false);
                return;
            }

            const response = await api.post('/flota/eficiencia/combustible/bulk', { datos: payload });
            const { insertados, actualizados, omitidos } = response.data;
            setMsg({ type: 'ok', text: `Base de datos sincronizada: ${insertados} insertados, ${actualizados} actualizados, ${omitidos} omitidos.` });
            cargarHistorial();
            if (viewMode === 'trabajadores') cargarConsumoTrabajadores();

        } catch (error) {
            console.error('Error subiendo datos:', error);
            setMsg({ type: 'err', text: 'Error al comunicarse con el servidor.' });
        } finally {
            setProcesando(false);
            setFileData([]);
            setFileHeaders([]);
        }
    };

    const presupuestoDiarioFlota = stats && presupuestoVehiculo > 0 ? (presupuestoVehiculo * stats.vehiculosMes) / stats.diasMes : 0;

    const showLitros = historico.some(r => r.litros && r.litros > 0);
    const showOdometro = historico.some(r => r.odometro && r.odometro > 0);
    const showTarjeta = historico.some(r => r.tarjeta && String(r.tarjeta).trim() !== '');
    const showEstacion = historico.some(r => r.estacion && String(r.estacion).trim() !== '');
    const colSpanTotal = 3 + (showLitros ? 1 : 0) + (showTarjeta ? 1 : 0) + (showEstacion ? 1 : 0) + (showOdometro ? 1 : 0);

    return (
        <div className="space-y-6">
            {/* Modal de Mapeo Inteligente */}
            {showMappingModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                    <Activity className="text-indigo-500" /> Carga Inteligente de Combustible
                                </h2>
                                <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-widest">Confirma las columnas de tu Excel antes de importar</p>
                            </div>
                            <button onClick={() => setShowMappingModal(false)} className="text-slate-400 hover:text-rose-500 transition-colors p-2 rounded-full hover:bg-rose-50">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto bg-white flex-1 space-y-6">
                            <div className="bg-sky-50 border border-sky-100 p-4 rounded-2xl flex gap-4 text-sky-800">
                                <AlertTriangle className="flex-shrink-0" size={24} />
                                <div>
                                    <p className="text-sm font-bold">Hemos pre-seleccionado las columnas detectadas automáticamente.</p>
                                    <p className="text-xs mt-1 opacity-80">Por favor revisa que correspondan, o cámbialas si alguna está incorrecta. Los campos con (*) son obligatorios.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Obligatorios */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest border-b border-slate-100 pb-2">Datos Obligatorios</h3>
                                    
                                    {[
                                        { key: 'fechaCarga', label: 'Fecha de Carga *' },
                                        { key: 'patente', label: 'Patente / Placa *' },
                                        { key: 'monto', label: 'Monto Total ($) *' },
                                        { key: 'comprobanteTransaccion', label: 'N° Comprobante *' }
                                    ].map(field => (
                                        <div key={field.key} className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-600 block">{field.label}</label>
                                            <select
                                                value={columnMapping[field.key] || ''}
                                                onChange={(e) => setColumnMapping({...columnMapping, [field.key]: e.target.value})}
                                                className={`w-full text-sm font-semibold text-slate-700 bg-slate-50 border rounded-xl px-3 py-2.5 outline-none transition-all ${columnMapping[field.key] ? 'border-slate-300 focus:border-indigo-500' : 'border-rose-300 bg-rose-50/30'}`}
                                            >
                                                <option value="">-- No seleccionado --</option>
                                                {fileHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>

                                {/* Opcionales */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Datos Complementarios</h3>
                                    
                                    {[
                                        { key: 'horaCarga', label: 'Hora de Carga' },
                                        { key: 'litros', label: 'Volumen (Litros)' },
                                        { key: 'odometro', label: 'Kilometraje' },
                                        { key: 'estacion', label: 'Estación de Servicio' },
                                        { key: 'tipoCombustible', label: 'Tipo de Combustible' },
                                        { key: 'tarjeta', label: 'Tarjeta / Cupón' }
                                    ].map(field => (
                                        <div key={field.key} className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-500 block">{field.label}</label>
                                            <select
                                                value={columnMapping[field.key] || ''}
                                                onChange={(e) => setColumnMapping({...columnMapping, [field.key]: e.target.value})}
                                                className="w-full text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 transition-all"
                                            >
                                                <option value="">-- Ignorar este dato --</option>
                                                {fileHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 border-t border-slate-100 p-6 flex justify-end gap-3">
                            <button onClick={() => setShowMappingModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors">
                                Cancelar
                            </button>
                            <button 
                                onClick={confirmUpload}
                                disabled={!columnMapping.fechaCarga || !columnMapping.patente || !columnMapping.monto || !columnMapping.comprobanteTransaccion}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black tracking-wide uppercase flex items-center gap-2 shadow-md disabled:opacity-50 transition-all"
                            >
                                <CheckCircle2 size={18} /> Confirmar e Importar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Botón de Carga Masiva y Presupuesto Movidos Arriba */}
            <div className="flex flex-col sm:flex-row justify-end items-end sm:items-center mb-2 gap-4">
                <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ppto. Máx / Vehículo</label>
                    <div className="flex items-center gap-1">
                        <span className="text-slate-500 font-bold">$</span>
                        <input 
                            type="number" 
                            className="w-24 outline-none font-black text-slate-700 text-sm bg-transparent"
                            value={presupuestoVehiculo}
                            onChange={(e) => setPresupuestoVehiculo(Number(e.target.value))}
                        />
                    </div>
                </div>

                <div className="relative">
                    <input 
                        type="file" 
                        accept=".xlsx, .xls, .csv" 
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        disabled={procesando}
                    />
                    <button disabled={procesando} className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-md disabled:opacity-50">
                        {procesando ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        {procesando ? 'Procesando...' : 'Cargar Archivo Masivo'}
                    </button>
                </div>
            </div>

            {/* Mensajes de feedback */}
            {msg && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 mb-4 ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                    {msg.type === 'ok' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                    <span className="font-bold text-sm">{msg.text}</span>
                    <button onClick={() => setMsg(null)} className="ml-auto"><X size={16} /></button>
                </div>
            )}

            {/* FILTROS GLOBALES */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Search size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Filtros Inteligentes</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase">Impactan todos los gráficos y métricas</p>
                    </div>
                </div>
                
                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    <select
                        value={filtroAnio}
                        onChange={(e) => setFiltroAnio(e.target.value)}
                        className="flex-1 md:flex-none py-2 px-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-slate-50 appearance-none"
                    >
                        <option value="">Todos los Años</option>
                        {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>

                    <select
                        value={filtroMes}
                        onChange={(e) => setFiltroMes(e.target.value)}
                        className="flex-1 md:flex-none py-2 px-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-slate-50 appearance-none"
                    >
                        <option value="">Todos los Meses</option>
                        {mesesDisponibles.map(mes => <option key={mes} value={mes}>{mes}</option>)}
                    </select>

                    <select
                        value={filtroPatente}
                        onChange={(e) => setFiltroPatente(e.target.value)}
                        className="flex-1 md:flex-none py-2 px-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-slate-50 appearance-none"
                    >
                        <option value="">Todas las Patentes</option>
                        {patentesDisponibles.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>

                    <select
                        value={filtroEstacion}
                        onChange={(e) => setFiltroEstacion(e.target.value)}
                        className="flex-1 md:flex-none py-2 px-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-slate-50 appearance-none"
                    >
                        <option value="">Todas las Estaciones</option>
                        {estacionesDisponibles.map(est => <option key={est} value={est}>{est || 'Sin Nombre'}</option>)}
                    </select>
                </div>
            </div>

            {/* KPI Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-3xl p-5 border border-indigo-400 shadow-lg text-white flex flex-col justify-between group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><DollarSign size={80}/></div>
                        <div className="flex items-center justify-between mb-4 z-10">
                            <h4 className="text-xs font-black text-indigo-100 uppercase tracking-widest">Consumo {stats.mesLiteral}</h4>
                            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                                <DollarSign size={16} />
                            </div>
                        </div>
                        <div className="z-10">
                            <p className="text-3xl font-black drop-shadow-md">${stats.totalMontoMes.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</p>
                            <p className="text-xs font-bold text-indigo-200 mt-1">{stats.totalLitrosMes.toLocaleString('es-CL', { maximumFractionDigits: 1 })} Lts totales cargados</p>
                        </div>
                    </div>
                    
                    <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-3xl p-5 border border-emerald-400 shadow-lg text-white flex flex-col justify-between group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp size={80}/></div>
                        <div className="flex items-center justify-between mb-4 z-10">
                            <h4 className="text-xs font-black text-emerald-100 uppercase tracking-widest">Promedios Financieros</h4>
                            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                                <TrendingUp size={16} />
                            </div>
                        </div>
                        <div className="z-10">
                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-xs font-bold text-emerald-200 uppercase">Diario</p>
                                    <p className="text-xl font-black drop-shadow-md">${stats.promedioDiaMonto.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-emerald-200 uppercase">Semanal</p>
                                    <p className="text-xl font-black drop-shadow-md">${stats.promedioSemanaMonto.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative overflow-hidden bg-gradient-to-br from-sky-500 to-blue-700 rounded-3xl p-5 border border-blue-400 shadow-lg text-white flex flex-col justify-between group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Car size={80}/></div>
                        <div className="flex items-center justify-between mb-4 z-10">
                            <h4 className="text-xs font-black text-blue-100 uppercase tracking-widest">Promedio Vehículo</h4>
                            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                                <Car size={16} />
                            </div>
                        </div>
                        <div className="z-10">
                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-xs font-bold text-blue-200 uppercase">Gasto / Vehículo</p>
                                    <p className="text-2xl font-black drop-shadow-md">${stats.promedioPorVehiculo.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-blue-200 uppercase">Vehículos</p>
                                    <p className="text-2xl font-black drop-shadow-md">{stats.vehiculosMes}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl p-5 border border-amber-400 shadow-lg text-white flex flex-col justify-between group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Route size={80}/></div>
                        <div className="flex items-center justify-between mb-4 z-10">
                            <h4 className="text-xs font-black text-amber-100 uppercase tracking-widest">Odometría Global</h4>
                            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                                <Route size={16} />
                            </div>
                        </div>
                        <div className="z-10">
                            <p className="text-3xl font-black drop-shadow-md">{stats.totalKmCalculados.toLocaleString('es-CL')} km</p>
                            <p className="text-xs font-bold text-amber-100 mt-1">Recorridos históricos detectados</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Gráfico y Top 5 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <div className="mb-6">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Tendencia de Consumo Diario</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase mt-1">Gasto en Combustible (CLP) durante el mes de {stats?.mesLiteral}</p>
                    </div>
                    {stats && stats.chartData && (
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                                <BarChart data={stats.chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} />
                                    <Tooltip 
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value) => [`$${value.toLocaleString('es-CL')}`, 'Gasto']}
                                        labelStyle={{ fontWeight: 900, color: '#334155', marginBottom: '0.25rem' }}
                                    />
                                    <ReferenceLine y={stats.promedioDiaMonto} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'insideTopRight', value: 'Promedio', fill: '#10b981', fontSize: 10, fontWeight: 800 }} />
                                    {presupuestoDiarioFlota > 0 && (
                                        <ReferenceLine y={presupuestoDiarioFlota} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Presup. Sugerido', fill: '#f59e0b', fontSize: 10, fontWeight: 800 }} />
                                    )}
                                    <Bar dataKey="monto" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={40} label={(props) => <CustomBarLabel {...props} total={stats.totalMontoMes} />} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Ranking Gasto por Vehículo */}
                {stats && stats.gastosVehiculos && stats.gastosVehiculos.length > 0 && (
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm overflow-y-auto max-h-[350px]">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Trophy size={16} className="text-amber-500" /> Gasto Histórico por Móvil</h4>
                        <div className="space-y-3">
                            {stats.gastosVehiculos.map((item, idx) => (
                                <div key={item.patente} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center ${idx < 3 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>{idx + 1}</div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1">
                                                <div className="inline-flex items-center gap-1.5 bg-white border border-slate-300 shadow-sm text-slate-800 px-2 py-0.5 rounded-md text-[10px] font-black tracking-widest uppercase">
                                                    <div className="w-1 h-3 bg-slate-800 rounded-full"></div>
                                                    {item.patente}
                                                </div>
                                                {presupuestoVehiculo > 0 && item.monto > presupuestoVehiculo && (
                                                    <AlertTriangle size={14} className="text-rose-500" title="Excede presupuesto" />
                                                )}
                                            </div>
                                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mt-1 truncate max-w-[140px]">
                                                {formatNombreCorto(item.tecnico)}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-sm font-black text-rose-600">${item.monto.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Acumulado de Todas las Patentes */}
            {stats && stats.chartDataPatentes && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-6 flex flex-col">
                    <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Gasto Acumulado por Patente</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase mt-1">Comparativa de consumo total de todos los vehículos en {stats.mesLiteral}</p>
                        </div>
                        <div className="text-left md:text-right bg-violet-50 px-4 py-2 rounded-2xl border border-violet-100">
                            <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest">Total Gasto de esta Flota</p>
                            <p className="text-2xl font-black text-violet-600">${stats.totalMontoMes.toLocaleString('es-CL')}</p>
                        </div>
                    </div>
                    <div className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                            <BarChart data={stats.chartDataPatentes} margin={{ top: 30, right: 10, left: -20, bottom: 80 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={<CustomXAxisTick />} interval={0} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value) => [`$${value.toLocaleString('es-CL')}`, 'Acumulado']}
                                    labelStyle={{ fontWeight: 900, color: '#334155', marginBottom: '0.25rem' }}
                                />
                                {presupuestoVehiculo > 0 && (
                                    <ReferenceLine y={presupuestoVehiculo} stroke="#f43f5e" strokeDasharray="3 3" label={{ position: 'insideTopRight', value: 'Presupuesto Máximo', fill: '#f43f5e', fontSize: 10, fontWeight: 800 }} />
                                )}
                                <Bar dataKey="monto" radius={[4, 4, 0, 0]} maxBarSize={40} label={(props) => <CustomBarLabel {...props} total={stats.totalMontoMes} />}>
                                    {stats.chartDataPatentes.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={presupuestoVehiculo > 0 && entry.monto > presupuestoVehiculo ? '#f43f5e' : '#8b5cf6'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Evolución Gasto Semanal */}
            {stats && stats.chartDataSemanas && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-6 flex flex-col">
                    <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Evolución de Gasto Semanal</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase mt-1">Comparativa de consumo por semanas en {stats.mesLiteral}</p>
                        </div>
                    </div>
                    <div className="h-[250px] w-full mt-4">
                        <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                            <BarChart data={stats.chartDataSemanas} margin={{ top: 30, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="semana" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value) => [`$${value.toLocaleString('es-CL')}`, 'Gasto']}
                                    labelStyle={{ fontWeight: 900, color: '#334155', marginBottom: '0.25rem' }}
                                />
                                <ReferenceLine y={stats.promedioSemanaMonto} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'insideTopRight', value: 'Promedio Semanal', fill: '#10b981', fontSize: 10, fontWeight: 800 }} />
                                <Bar dataKey="monto" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={60} label={(props) => <CustomBarLabel {...props} total={stats.totalMontoMes} />} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Controles de Tabla: Filtros y Búsqueda */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 mb-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Detalle de Transacciones</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase mt-1">Registros de combustible importados</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                    <div className="relative w-full sm:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={16} className="text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar patente, monto, o estación..."
                            value={filtroTexto}
                            onChange={(e) => setFiltroTexto(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-white shadow-sm"
                        />
                        {filtroTexto && (
                            <button onClick={() => setFiltroTexto('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600">
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* TABS DE VISTAS */}
            <div className="flex bg-slate-100 p-1 rounded-2xl w-fit mb-4">
                <button
                    onClick={() => setViewMode('historial')}
                    className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'historial' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Historial de Cargas
                </button>
                <button
                    onClick={() => setViewMode('trabajadores')}
                    className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'trabajadores' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Consumo por Trabajador
                </button>
            </div>

            {/* VISTA 1: TABLA HISTÓRICO */}
            {viewMode === 'historial' && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-100/80 sticky top-0 z-10 backdrop-blur-md border-b border-slate-200 shadow-sm">
                            <tr className="text-[10px] uppercase font-black text-slate-500 tracking-wider">
                                <th className="p-4 border-b border-slate-200">Fecha Carga</th>
                                <th className="p-4 border-b border-slate-200">Patente</th>
                                {showLitros && <th className="p-4 border-b border-slate-200">Litros</th>}
                                <th className="p-4 border-b border-slate-200">Monto (CLP)</th>
                                {showTarjeta && <th className="p-4 border-b border-slate-200">Tarjeta</th>}
                                {showEstacion && <th className="p-4 border-b border-slate-200">Estación</th>}
                                {showOdometro && <th className="p-4 border-b border-slate-200">Odómetro</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {cargando ? (
                                <tr>
                                    <td colSpan={colSpanTotal} className="p-8 text-center text-slate-400">
                                        <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                                        Cargando histórico...
                                    </td>
                                </tr>
                            ) : historico.length === 0 ? (
                                <tr>
                                    <td colSpan={colSpanTotal} className="p-8 text-center text-slate-400 font-bold text-sm">
                                        No se encontraron registros de combustible
                                    </td>
                                </tr>
                            ) : (
                                historicoFiltrado.map((row, idx) => (
                                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4 text-xs font-semibold text-slate-700">
                                            {new Date(row.fechaCarga).toLocaleDateString('es-CL')}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="inline-flex items-center gap-2 bg-white border-2 border-slate-300 shadow-sm text-slate-800 px-3 py-1.5 rounded-lg font-black tracking-widest uppercase w-max text-xs">
                                                    <div className="w-1.5 h-4 bg-slate-800 rounded-full"></div>
                                                    {row.patente}
                                                </div>
                                                {row.tecnicoNombre ? (
                                                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                                                        {row.tecnicoNombre}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                        Sin Técnico
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        {showLitros && (
                                            <td className="p-4 text-xs font-bold text-slate-600">
                                                {row.litros?.toFixed(2)} L
                                            </td>
                                        )}
                                        <td className="p-4 text-sm font-black text-sky-600">
                                            ${row.monto?.toLocaleString('es-CL')}
                                        </td>
                                        {showTarjeta && (
                                            <td className="p-4 text-xs font-bold text-slate-600 uppercase tracking-widest">
                                                {row.tarjeta}
                                            </td>
                                        )}
                                        {showEstacion && (
                                            <td className="p-4 text-xs font-medium text-slate-500 truncate max-w-[150px]">
                                                {row.estacion}
                                            </td>
                                        )}
                                        {showOdometro && (
                                            <td className="p-4 text-xs font-bold text-slate-500">
                                                {row.odometro ? `${row.odometro.toLocaleString('es-CL')} km` : '-'}
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

            {/* VISTA 2: TABLA POR TRABAJADOR */}
            {viewMode === 'trabajadores' && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-100/80 sticky top-0 z-10 backdrop-blur-md border-b border-slate-200 shadow-sm">
                            <tr className="text-[10px] uppercase font-black text-slate-500 tracking-wider">
                                <th className="p-4 border-b border-slate-200">Trabajador</th>
                                <th className="p-4 border-b border-slate-200">Vehículo Vinculado</th>
                                <th className="p-4 border-b border-slate-200">Cupón (Flota)</th>
                                <th className="p-4 border-b border-slate-200">Tarjeta Usada (Física)</th>
                                <th className="p-4 border-b border-slate-200 text-center">N° Cargas</th>
                                <th className="p-4 border-b border-slate-200 text-right">Total Litros</th>
                                <th className="p-4 border-b border-slate-200 text-right">Total Monto (CLP)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cargandoTrabajadores ? (
                                <tr>
                                    <td colSpan="7" className="p-8 text-center text-slate-400">
                                        <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                                        Agrupando consumos...
                                    </td>
                                </tr>
                            ) : consumoTrabajadores.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-8 text-center text-slate-400 font-bold text-sm">
                                        No hay datos de consumo para los filtros seleccionados
                                    </td>
                                </tr>
                            ) : (
                                consumoTrabajadores.map((row, idx) => (
                                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4">
                                            {!row.nombre ? (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                                                        <AlertTriangle size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-600">Trabajador Desconocido</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Sin Técnico Asignado</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-sm shadow-sm">
                                                        {row.nombre ? row.nombre.split(' ').map(n => n[0]).join('').substring(0, 2) : '?'}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-800">{row.nombre || 'Sin Nombre'}</p>
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase">RUT: {row.rut}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {row.vehiculoPatente ? (
                                                <div className="inline-flex items-center gap-2 bg-white border-2 border-slate-300 shadow-sm text-slate-800 px-3 py-1.5 rounded-lg font-black tracking-widest uppercase text-xs">
                                                    <div className="w-1.5 h-4 bg-slate-800 rounded-full"></div>
                                                    {row.vehiculoPatente}
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 shadow-sm text-slate-500 px-3 py-1.5 rounded-lg font-bold tracking-widest uppercase text-[10px]">
                                                    {row.patenteOriginal || '-'}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {row.tarjetaVinculada ? (
                                                <div className="flex flex-col">
                                                    {row.tipoCuponVinculado && row.tipoCuponVinculado !== 'Sin Cupón' ? (
                                                        <span className={`text-[10px] font-black tracking-widest uppercase ${row.tipoCuponVinculado === 'Cupón Titular' ? 'text-purple-600' : 'text-orange-500'}`}>
                                                            {row.tipoCuponVinculado}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-black tracking-widest uppercase text-slate-500">
                                                            Tarjeta Asignada
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] font-bold text-slate-400">
                                                        N°: {row.tarjetaVinculada}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs font-bold text-slate-400">Sin Cupón</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md">
                                                {row.tarjetaOriginal || 'No Registrada'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 bg-sky-50 text-sky-700 rounded-lg text-xs font-black shadow-sm border border-sky-100">
                                                {row.cantidadCargas}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right text-sm font-bold text-slate-700">
                                            {row.totalLitros?.toFixed(2)} L
                                        </td>
                                        <td className="p-4 text-right text-sm font-black text-indigo-600">
                                            ${row.totalMonto?.toLocaleString('es-CL')}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            )}
        </div>
    );
};


// ============================================================================
// COMPONENTE SECUNDARIO: MAPA DE RUTAS TOA
// ============================================================================
const RutasRecorridas = () => {
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [rutas, setRutas] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [tecnicoSeleccionado, setTecnicoSeleccionado] = useState(null);
    const [msg, setMsg] = useState(null);

    const cargarRutas = async () => {
        if (!fecha) return;
        setCargando(true);
        setMsg(null);
        try {
            const res = await api.get(`/flota/eficiencia/rutas?fecha=${fecha}`);
            setRutas(res.data || []);
            setTecnicoSeleccionado(null);
        } catch (error) {
            console.error('Error cargando rutas:', error);
            setMsg('No se pudieron cargar las rutas del día seleccionado. Verifique conexión.');
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarRutas();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fecha]);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: GOOGLE_MAPS_API_KEY
    });

    // Placeholder if Google Maps is not ready or keys are missing
    const renderGoogleMap = () => {
        if (!GOOGLE_MAPS_API_KEY) {
            return (
                <div className="w-full h-full bg-slate-100 rounded-3xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center p-8 text-center">
                    <MapIcon size={48} className="text-slate-300 mb-4" />
                    <h4 className="text-lg font-black text-slate-700">API de Mapas no configurada</h4>
                    <p className="text-sm font-semibold text-slate-500 mt-2 max-w-sm">
                        Se requiere configurar una clave de API de Google Maps válida en las variables de entorno (REACT_APP_GOOGLE_MAPS_API_KEY) para visualizar las rutas interactivas.
                    </p>
                    {tecnicoSeleccionado && (
                        <div className="mt-6 w-full max-w-md bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-left">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Simulación de Datos Extraídos:</p>
                            <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                                {tecnicoSeleccionado.actividades.map((act, i) => (
                                    <div key={i} className="flex gap-3 items-center border-b border-slate-50 pb-2">
                                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${act.esCompletado ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-slate-800 truncate">{act.actividad}</p>
                                            <p className="text-[10px] text-slate-500 truncate" title={act.direccion}>{act.direccion}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        if (!isLoaded) {
            return (
                <div className="w-full h-full bg-slate-200 rounded-3xl animate-pulse flex items-center justify-center">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-sm">Cargando Mapas...</span>
                </div>
            );
        }

        let center = { lat: -33.4489, lng: -70.6693 }; // Santiago default
        let markers = [];
        let path = [];

        if (tecnicoSeleccionado && tecnicoSeleccionado.actividades.length > 0) {
            const validActivities = tecnicoSeleccionado.actividades.filter(a => a.lat && a.lng);
            if (validActivities.length > 0) {
                center = { lat: Number(validActivities[0].lat), lng: Number(validActivities[0].lng) };
                
                markers = validActivities.map((act, index) => ({
                    id: index,
                    position: { lat: Number(act.lat), lng: Number(act.lng) },
                    title: act.actividad
                }));
                path = validActivities.map(act => ({ lat: Number(act.lat), lng: Number(act.lng) }));
            }
        }

        return (
            <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%', borderRadius: '1.5rem' }}
                center={center}
                zoom={12}
                options={{ disableDefaultUI: true, zoomControl: true }}
            >
                {markers.map(m => (
                    <Marker key={m.id} position={m.position} title={m.title} />
                ))}
                {path.length > 1 && (
                    <Polyline 
                        path={path} 
                        options={{ strokeColor: '#6366f1', strokeOpacity: 0.8, strokeWeight: 4 }} 
                    />
                )}
            </GoogleMap>
        );
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-14rem)] min-h-[600px]">
            {/* Panel Izquierdo: Buscador y Lista de Técnicos */}
            <div className="w-full lg:w-96 flex-shrink-0 flex flex-col bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Fecha de Operación</label>
                    <input 
                        type="date" 
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {cargando ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <Loader2 className="animate-spin mb-3" size={24} />
                            <span className="text-xs font-bold uppercase tracking-widest">Sincronizando Rutas...</span>
                        </div>
                    ) : rutas.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center p-4">
                            <Activity size={32} className="mb-3 opacity-20" />
                            <span className="text-sm font-bold">No hay rutas para este día</span>
                            <span className="text-xs mt-1">Verifique que exista descarga de TOA cargada para esta fecha.</span>
                        </div>
                    ) : (
                        rutas.map((ruta, idx) => {
                            const isSelected = tecnicoSeleccionado?.idRecursoToa === ruta.idRecursoToa;
                            return (
                                <button
                                    key={idx}
                                    onClick={() => setTecnicoSeleccionado(ruta)}
                                    className={`w-full text-left p-4 rounded-2xl transition-all border ${
                                        isSelected 
                                        ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                                        : 'bg-white border-transparent hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <p className={`font-black text-sm truncate pr-2 ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                                            {ruta.nombreTecnico}
                                        </p>
                                        <div className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase whitespace-nowrap ${
                                            ruta.eficiencia >= 80 ? 'bg-emerald-100 text-emerald-700' :
                                            ruta.eficiencia >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                                        }`}>
                                            {ruta.eficiencia}% Efi
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-slate-300"></span> {ruta.totalActividades} Total
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> {ruta.completadas} Realizados
                                        </span>
                                    </div>
                                </button>
                            )
                        })
                    )}
                </div>
            </div>

            {/* Panel Derecho: Mapa */}
            <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-2 relative">
                {renderGoogleMap()}

                {tecnicoSeleccionado && GOOGLE_MAPS_API_KEY && (
                    <div className="absolute top-6 right-6 bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-xl w-64 z-10">
                        <h4 className="text-sm font-black text-slate-800 mb-1">{tecnicoSeleccionado.nombreTecnico}</h4>
                        <p className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-widest">{tecnicoSeleccionado.actividades.length} Servicios en ruta</p>
                        
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Completados</span>
                                <span className="text-slate-800">{tecnicoSeleccionado.completadas}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-rose-500"></div> Rechazados/Pendientes</span>
                                <span className="text-slate-800">{tecnicoSeleccionado.totalActividades - tecnicoSeleccionado.completadas}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


// ============================================================================
// CONTENEDOR PRINCIPAL
// ============================================================================
const EficienciaFlota = () => {
    const [activeTab, setActiveTab] = useState('combustible'); // 'combustible' | 'rutas'

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-10">
            {/* Header Módulo */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-5">
                    <div className="bg-sky-600 text-white p-4 rounded-[1.5rem] shadow-xl shadow-sky-600/20 transform -rotate-3">
                        <Activity size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">
                            Eficiencia <span className="text-sky-600">de Flota</span>
                        </h1>
                        <p className="text-slate-500 text-[10px] font-black mt-2 uppercase tracking-[0.3em]">Logística · Combustible & Rutas TOA</p>
                    </div>
                </div>

                {/* Tabs Navigation */}
                <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 flex gap-1">
                    <button
                        onClick={() => setActiveTab('combustible')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                            activeTab === 'combustible' 
                            ? 'bg-slate-900 text-white shadow-md' 
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        <Droplets size={16} /> Combustible
                    </button>
                    <button
                        onClick={() => setActiveTab('rutas')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                            activeTab === 'rutas' 
                            ? 'bg-slate-900 text-white shadow-md' 
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        <MapIcon size={16} /> KM Recorrido
                    </button>
                </div>
            </div>

            {/* Contenido Dinámico */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {activeTab === 'combustible' ? <ConsumoCombustible /> : <RutasRecorridas />}
            </div>
        </div>
    );
};

export default EficienciaFlota;

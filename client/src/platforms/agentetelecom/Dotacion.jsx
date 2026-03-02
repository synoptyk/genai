import React, { useState, useEffect, useRef } from 'react';
import API_URL from '../../config';

import axios from 'axios';
import * as XLSX from 'xlsx';
import {
    UserCog, Users, Search, Edit3, Trash2, LayoutGrid, List, FileDown,
    Car, Unlink, AlertTriangle, RefreshCw,
    FileText, Ban, Upload,
    Briefcase, DollarSign, User,
    Award, X, Plus, AlertCircle, LogOut
} from 'lucide-react';

const Dotacion = () => {
    // --- ESTADOS ---
    const [personal, setPersonal] = useState([]);
    const [stats, setStats] = useState({ total: 0, conMovil: 0, sinMovil: 0, alertas: 0 });
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null);

    // UI
    const [viewMode, setViewMode] = useState('list');
    const [filtro, setFiltro] = useState('');

    // Modal de Edición (Full Detail)
    const [modalOpen, setModalOpen] = useState(false);
    const [editData, setEditData] = useState(null);
    const [activeTab, setActiveTab] = useState('contractual'); // contractual, personal, financiero

    // Auxiliary State for Modal (Cargas Familiares)
    const [cargaTemp, setCargaTemp] = useState({ rut: '', nombre: '', parentesco: '' });

    // --- LISTAS MAESTRAS (Sync with FichaIngreso) ---
    const AFPS = ["CAPITAL", "CUPRUM", "HABITAT", "MODELO", "PLANVITAL", "PROVIDA", "UNO"];
    const ISAPRES = ["FONASA", "BANMEDICA", "COLMENA", "CONSALUD", "CRUZ BLANCA", "NUEVA MASVIDA", "VIDA TRES"];
    const CONTRATOS = ["PLAZO FIJO", "INDEFINIDO", "HONORARIOS", "POR FAENA"];
    const ESTADO_CIVIL = ["SOLTERO", "CASADO", "DIVORCIADO", "VIUDO", "CONVIVIENTE CIVIL"];
    const BONOS = ["NO APLICA", "FIJO", "VARIABLE", "MIXTO (FIJO + VARIABLE)"];
    const BANCOS = ["BANCO ESTADO", "BANCO DE CHILE", "SANTANDER", "BCI", "SCOTIABANK", "ITAÚ", "FALABELLA", "RIPLEY", "CONSORCIO", "SECURITY", "INTERNACIONAL", "BICE"];
    const TIPOS_CUENTA = ["CUENTA CORRIENTE", "CUENTA VISTA / RUT", "AHORRO"];
    const MANDANTES = ["TIGO", "MOVISTAR", "ENTEL", "CLARO", "WOM", "VTR", "INTERNO"];

    // --- ESTADOS ADMINISTRATIVOS ---
    const ESTADOS = [
        { id: 'OPERATIVO', label: 'Operativo', color: 'emerald' },
        { id: 'VACACIONES', label: 'Vacaciones', color: 'blue' },
        { id: 'LICENCIA MEDICA', label: 'Licencia Médica', color: 'amber' },
        { id: 'PERMISO CON GOCE', label: 'Permiso c/Goce', color: 'indigo' },
        { id: 'PERMISO SIN GOCE', label: 'Permiso s/Goce', color: 'slate' },
        { id: 'AUSENTE', label: 'Ausente', color: 'red' },
        { id: 'FINIQUITADO', label: 'Finiquitado', color: 'gray' }
    ];

    // --- 1. CARGA DE DATOS (CRUCE RRHH + FLOTA) ---
    const fetchData = async () => {
        setLoading(true);
        try {
            const [resPersonal, resFlota] = await Promise.all([
                axios.get(`${API_URL}/api/tecnicos`),
                axios.get(`${API_URL}/api/vehiculos`)
            ]);

            const flotaDB = resFlota.data;
            let contadorMovil = 0;
            let contadorAlertas = 0;

            const dataUnificada = resPersonal.data.map(persona => {
                const vehiculoAsignado = flotaDB.find(v =>
                    (v.asignadoA && v.asignadoA._id === persona._id) ||
                    (v.asignadoA && v.asignadoA.rut === persona.rut)
                );

                if (vehiculoAsignado) contadorMovil++;

                // Regla: Técnico sin auto es alerta, PERO SOLO SI ES OPERATIVO
                let estadoIntegridad = 'OK';
                if (persona.cargo?.toUpperCase().includes('TECNICO') && !vehiculoAsignado && persona.estadoActual === 'OPERATIVO') {
                    estadoIntegridad = 'WARNING_SIN_MOVIL';
                    contadorAlertas++;
                }

                return {
                    ...persona,
                    flota: vehiculoAsignado ? {
                        patente: vehiculoAsignado.patente,
                        modelo: `${vehiculoAsignado.marca} ${vehiculoAsignado.modelo}`,
                        estado: vehiculoAsignado.estadoOperativo,
                        vinculado: true
                    } : { vinculado: false },
                    integridad: estadoIntegridad
                };
            });

            setPersonal(dataUnificada);
            setStats({
                total: dataUnificada.filter(p => p.estadoActual !== 'FINIQUITADO').length,
                conMovil: contadorMovil,
                sinMovil: dataUnificada.filter(p => p.estadoActual !== 'FINIQUITADO').length - contadorMovil,
                alertas: contadorAlertas
            });

        } catch (e) {
            console.error("Error sync:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // --- 2. ACCIONES ---
    const handleEdit = (persona) => {
        // Ensure default values for arrays/objects
        setEditData({
            ...persona,
            listaCargas: persona.listaCargas || [],
            estadoActual: persona.estadoActual || 'OPERATIVO',
            estadoObservacion: persona.estadoObservacion || ''
        });
        setModalOpen(true);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            // Logic for Finiquito
            if (editData.estadoActual === 'FINIQUITADO' && !editData.fechaFiniquito) {
                return alert("Debe indicar Fecha de Finiquito para desvincular.");
            }

            // Normal Upsert
            await axios.post(`${API_URL}/api/tecnicos`, editData);
            alert("Ficha actualizada correctamente");
            setModalOpen(false);
            fetchData();
        } catch (e) { alert("Error al actualizar: " + e.response?.data?.error || e.message); }
    };

    // Cargas Familiares Helper
    const handleCargaAdd = () => {
        if (cargaTemp.rut && cargaTemp.nombre) {
            setEditData(prev => ({ ...prev, listaCargas: [...prev.listaCargas, cargaTemp] }));
            setCargaTemp({ rut: '', nombre: '', parentesco: '' });
        }
    };

    const handleCargaRemove = (idx) => {
        setEditData(prev => ({ ...prev, listaCargas: prev.listaCargas.filter((_, i) => i !== idx) }));
    };

    const handleDelete = async (id) => {
        if (window.confirm("¿Confirma ELIMINAR definitivamente este registro?\nPara salidas normales use 'Finiquitar' en la edición.")) {
            try {
                await axios.delete(`http://localhost:5001/api/tecnicos/${id}`);
                fetchData();
            } catch (e) { alert("Error al eliminar"); }
        }
    };

    // Helper para normalizar RUT
    const cleanRut = (val) => {
        if (!val) return "";
        return val.toString().replace(/\./g, "").replace(/-/g, "").toUpperCase().trim();
    }

    // --- 3. CARGA MASIVA ROBUSTA ---
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];

                // 1. Obtener JSON crudo para manipular headers
                const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
                if (rawData.length === 0) return alert("Archivo vacío.");

                // 2. Normalizar Headers (Trim + Uppercase)
                const originalHeaders = rawData[0];
                const headers = originalHeaders.map(h => (h || '').toString().trim().toUpperCase());

                // 3. Convertir filas a objetos usando headers normalizados
                const rows = rawData.slice(1).map(row => {
                    const obj = {};
                    headers.forEach((h, i) => {
                        obj[h] = row[i];
                    });
                    return obj;
                });

                // 4. Filtrar vacíos y procesar
                const validRows = rows.filter(r => r["RUT"] && r["RUT"].toString().trim() !== "");
                if (validRows.length === 0) return alert("No se encontraron filas con RUT válido.");

                // Helper para Fechas Excel
                const parseExcelDate = (val) => {
                    if (!val) return null;
                    if (typeof val === 'number') {
                        const date = new Date(Math.round((val - 25569) * 864e5));
                        return date.toISOString();
                    }
                    return val;
                };

                const tecnicosImportados = validRows.map(row => ({
                    rut: cleanRut(row["RUT"]),
                    nombres: row["NOMBRES"],
                    apellidos: row["APELLIDOS"],
                    nombre: row["NOMBRE COMPLETO"] || `${row["NOMBRES"] || ''} ${row["APELLIDOS"] || ''}`.trim(),
                    fechaNacimiento: parseExcelDate(row["FECHA_NACIMIENTO"] || row["FECHA NACIMIENTO"]),
                    fechaIngreso: parseExcelDate(row["FECHA_INGRESO"] || row["FECHA INGRESO"]),
                    fechaVencimientoLicencia: parseExcelDate(row["VENCIMIENTO_LICENCIA"] || row["VENCIMIENTO LICENCIA"]),
                    fechaFiniquito: parseExcelDate(row["FECHA_FINIQUITO"] || row["FECHA FINIQUITO"]),
                    nacionalidad: row["NACIONALIDAD"],
                    estadoCivil: row["ESTADO_CIVIL"] || row["ESTADO CIVIL"],
                    calle: row["CALLE"],
                    numero: row["NUMERO"],
                    deptoBlock: row["DEPTO_BLOCK"] || row["DEPTO"] || row["BLOCK"],
                    comuna: row["COMUNA"],
                    region: row["REGION"],
                    email: row["EMAIL"] || row["CORREO"],
                    telefono: row["TELEFONO"] || row["CELULAR"],
                    cargo: row["CARGO"],
                    area: row["AREA"],
                    ceco: row["CECO"],
                    nombreCeco: row["NOMBRE_CECO"] || row["NOMBRE CECO"],
                    mandantePrincipal: row["MANDANTE"],
                    tipoContrato: row["TIPO_CONTRATO"] || row["TIPO CONTRATO"],
                    duracionContrato: row["DURACION_MESES"] || row["DURACION"],
                    previsionSalud: row["PREVISION"] || row["SALUD"],
                    isapreNombre: row["NOMBRE_ISAPRE"] || row["ISAPRE"],
                    valorPlan: row["VALOR_PLAN"],
                    monedaPlan: row["MONEDA_PLAN"],
                    afp: row["AFP"],
                    pensionado: row["PENSIONADO"],
                    tieneCargas: row["TIENE_CARGAS"],
                    banco: row["BANCO"],
                    tipoCuenta: row["TIPO_CUENTA"],
                    numeroCuenta: row["NUMERO_CUENTA"],
                    sueldoBase: row["SUELDO_BASE"],
                    tipoBonificacion: row["TIPO_BONO"],
                    montoBonoFijo: row["MONTO_BONO_FIJO"],
                    descripcionBonoVariable: row["DESC_BONO_VARIABLE"],
                    requiereLicencia: row["REQUIERE_LICENCIA"],
                    estadoActual: (row["ESTADO"] || row["ESTADO ACTUAL"] || 'OPERATIVO').toUpperCase()
                }));

                await axios.post(`${API_URL}/api/tecnicos/bulk`, { tecnicos: tecnicosImportados });
                alert(`✅ PROCESO COMPLETADO:\n- Leídos: ${validRows.length}\n- Procesados: ${tecnicosImportados.length}`);
                fetchData();
            } catch (err) {
                alert("Error procesando archivo");
                console.error(err);
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const exportarExcel = () => {
        const dataExport = personal.map(p => ({
            ESTADO: p.estadoActual,
            RUT: p.rut,
            Nombre_Completo: p.nombre + ' ' + (p.apellidos || ''),
            Cargo: p.cargo,
            Area: p.area,
            Mandante: p.mandantePrincipal,
            CECO: p.ceco,
            Tipo_Contrato: p.tipoContrato,
            Fecha_Ingreso: p.fechaIngreso,
            Movil_Asignado: p.flota.vinculado ? p.flota.patente : 'NO ASIGNADO',
            Banco: p.banco,
            Cuenta: p.numeroCuenta
        }));
        const ws = XLSX.utils.json_to_sheet(dataExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Dotacion_Unificada");
        XLSX.writeFile(wb, "Reporte_Master_Dotacion.xlsx");
    };

    // --- FILTRADO ---
    const dataFiltrada = personal.filter(p => {
        const term = filtro.toLowerCase();
        const matchesTerm = (
            p.nombre?.toLowerCase().includes(term) ||
            p.apellidos?.toLowerCase().includes(term) ||
            p.rut?.toLowerCase().includes(term) ||
            p.flota.patente?.toLowerCase().includes(term) ||
            p.mandantePrincipal?.toLowerCase().includes(term)
        );
        // By default show all, or maybe hide Finiquitados? Let's leave clear for now or separate tab
        // Show finiquitados slightly transparent if needed
        return matchesTerm;
    });

    // --- UI HELPERS ---
    const KpiCard = ({ title, value, icon: Icon, color, subtext }) => (
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-${color}-50 text-${color}-600`}>
                <Icon size={24} />
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
                <h3 className="text-2xl font-black text-slate-800">{value}</h3>
                {subtext && <p className="text-[10px] text-slate-400 font-medium">{subtext}</p>}
            </div>
        </div>
    );

    // Status Badge Component
    const StatusBadge = ({ status }) => {
        const config = ESTADOS.find(e => e.id === status) || ESTADOS[0];
        return (
            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-${config.color}-100 text-${config.color}-700 border border-${config.color}-200`}>
                {config.label}
            </span>
        );
    };

    return (
        <div className="animate-in fade-in duration-500 max-w-full mx-auto pb-10">

            {/* HEADER & KPIs */}
            <div className="mb-8">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-black italic text-slate-800 flex items-center gap-3">
                            <Users className="text-blue-600" size={32} />
                            Maestro de <span className="text-blue-600">Dotación</span>
                        </h1>
                        <p className="text-slate-500 text-xs font-bold tracking-widest mt-1">
                            VISIÓN UNIFICADA: RRHH + ASISTENCIA + FLOTA
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => fileInputRef.current.click()} className="group bg-blue-50 text-blue-600 border border-blue-200 px-4 py-2 rounded-xl font-bold text-xs uppercase flex items-center gap-2 hover:bg-blue-100 transition-all">
                            <Upload size={16} /> Carga Masiva (Update)
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".xlsx" />
                        </button>
                        <button onClick={fetchData} className="p-2 bg-white border border-slate-200 text-slate-500 rounded-xl hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm" title="Sincronizar Ahora">
                            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <KpiCard title="Total Activos" value={stats.total} icon={UserCog} color="blue" subtext="Personal Operativo" />
                    <KpiCard title="Con Asignación" value={stats.conMovil} icon={Car} color="emerald" subtext="Vehículo Vinculado" />
                    <KpiCard title="Sin Asignación" value={stats.sinMovil} icon={Unlink} color="slate" subtext="En espera de recurso" />
                    <KpiCard title="Alertas Cargo" value={stats.alertas} icon={AlertTriangle} color="amber" subtext="Técnicos sin móvil" />
                </div>
            </div>

            {/* CONTROLES DE TABLA */}
            <div className="flex justify-between items-center mb-4 gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por Nombre, RUT, Patente, Mandante..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-bold outline-none focus:bg-slate-50 transition-all"
                        value={filtro}
                        onChange={e => setFiltro(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <button onClick={exportarExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-[10px] uppercase hover:bg-emerald-100 transition-colors">
                        <FileDown size={14} /> Excel
                    </button>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}><List size={16} /></button>
                        <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}><LayoutGrid size={16} /></button>
                    </div>
                </div>
            </div>

            {/* TABLA MAESTRA INTELIGENTE */}
            {viewMode === 'list' ? (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left whitespace-nowrap">
                            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <tr>
                                    <th className="p-4 sticky left-0 bg-slate-50 z-10">Nombre</th>
                                    <th className="p-4">RUT</th>
                                    <th className="p-4">Situación</th>
                                    <th className="p-4">Cargo</th>
                                    <th className="p-4">Área</th>
                                    <th className="p-4">Mandante</th>
                                    <th className="p-4">CECO</th>
                                    <th className="p-4">Contrato</th>
                                    <th className="p-4 text-center">Patente</th>
                                    <th className="p-4 text-right sticky right-0 bg-slate-50 z-10">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {dataFiltrada.map(p => (
                                    <tr key={p._id} className={`hover:bg-slate-50/50 transition-colors group ${p.estadoActual === 'FINIQUITADO' ? 'opacity-50 grayscale' : ''}`}>
                                        <td className="p-4 sticky left-0 bg-white group-hover:bg-slate-50/50 z-10 font-bold text-slate-700 uppercase">
                                            {p.nombre}
                                        </td>
                                        <td className="p-4 font-mono text-slate-400">
                                            {p.rut}
                                        </td>
                                        <td className="p-4">
                                            <StatusBadge status={p.estadoActual || 'OPERATIVO'} />
                                        </td>
                                        <td className="p-4 font-bold text-slate-600 uppercase">
                                            {p.cargo}
                                        </td>
                                        <td className="p-4 text-slate-500 uppercase">
                                            {p.area}
                                        </td>
                                        <td className="p-4">
                                            {p.mandantePrincipal && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold text-[9px] border border-blue-100 uppercase">{p.mandantePrincipal}</span>}
                                        </td>
                                        <td className="p-4 text-slate-500 font-mono">
                                            {p.ceco || '-'}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="text-slate-600 font-medium">{p.tipoContrato}</span>
                                                <span className="text-[9px] text-slate-400">Ingreso: {p.fechaIngreso ? new Date(p.fechaIngreso).toLocaleDateString() : '-'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            {p.flota.vinculado ? (
                                                <span className="font-black text-emerald-700">{p.flota.patente}</span>
                                            ) : (
                                                <span className="text-slate-300 italic text-[10px]">S/A</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right sticky right-0 bg-white group-hover:bg-slate-50/50 z-10">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => handleEdit(p)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit3 size={16} /></button>
                                                <button onClick={() => handleDelete(p._id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* VISTA GRID (TARJETAS) */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {dataFiltrada.map(p => (
                        <div key={p._id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all relative group">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black text-sm">
                                        {p.nombre ? p.nombre.charAt(0) : '?'}
                                    </div>
                                    <div className="overflow-hidden">
                                        <h4 className="font-bold text-slate-800 text-xs uppercase truncate w-32" title={p.nombre}>{p.nombre}</h4>
                                        <span className="text-[10px] text-slate-400 font-mono">{p.rut}</span>
                                    </div>
                                </div>
                                <StatusBadge status={p.estadoActual} />
                            </div>

                            <div className="space-y-2 mb-4 border-t border-slate-50 pt-3">
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-slate-400 font-bold uppercase">Cargo</span>
                                    <span className="text-slate-600 font-medium truncate w-24 text-right" title={p.cargo}>{p.cargo}</span>
                                </div>
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-slate-400 font-bold uppercase">Mandante</span>
                                    <span className="text-blue-600 font-medium">{p.mandantePrincipal || '-'}</span>
                                </div>
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-slate-400 font-bold uppercase">Movil</span>
                                    <span className={`font-black ${p.flota.vinculado ? 'text-emerald-600' : 'text-slate-300 italic'}`}>
                                        {p.flota.vinculado ? p.flota.patente : '---'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button onClick={() => handleEdit(p)} className="flex-1 py-2 rounded-lg bg-blue-50 text-blue-600 font-bold text-[10px] uppercase hover:bg-blue-100 transition-colors">Editar Ficha</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* --- MODAL DE EDICIÓN COMPLETA (TABS) --- */}
            {modalOpen && editData && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 flex flex-col">

                        {/* HEADER */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl sticky top-0 bg-white z-20">
                            <div>
                                <h3 className="font-black text-slate-700 uppercase text-lg flex items-center gap-2">
                                    <FileText size={20} className="text-blue-600" /> Editar Colaborador
                                </h3>
                                <p className="text-xs text-slate-400 font-bold tracking-widest mt-1">
                                    {editData.rut} • {editData.nombre} {editData.apellidos}
                                </p>
                            </div>
                            <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><Ban size={24} /></button>
                        </div>

                        {/* ALERT FOR FINIQUITADO */}
                        {editData.estadoActual === 'FINIQUITADO' && (
                            <div className="bg-red-50 border-b border-red-100 p-3 flex justify-center text-red-700 text-xs font-bold uppercase tracking-widest">
                                <AlertCircle size={14} className="mr-2" /> Colaborador Finiquitado / Inactivo
                            </div>
                        )}

                        {/* TABS */}
                        <div className="flex bg-slate-100 p-1 mx-6 mt-6 rounded-xl gap-1 shrink-0">
                            {['contractual', 'personal', 'financiero'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === tab ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {tab === 'contractual' && <Briefcase size={14} />}
                                    {tab === 'personal' && <User size={14} />}
                                    {tab === 'financiero' && <DollarSign size={14} />}
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* FORM BODY */}
                        <form onSubmit={handleUpdate} className="p-6 space-y-6 flex-1 overflow-y-auto">

                            {/* TAB 1: CONTRACTUAL */}
                            {activeTab === 'contractual' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right-4 duration-300">

                                    {/* STATUS SELECTOR (CRITICAL) */}
                                    <div className="col-span-2 bg-slate-50 rounded-xl p-4 border border-slate-200">
                                        <h4 className="text-xs font-black text-slate-600 uppercase mb-4 flex items-center gap-2"><Award size={14} /> Situación Actual</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <SelectGroup label="Estado" value={editData.estadoActual} onChange={v => setEditData({ ...editData, estadoActual: v })}>
                                                {ESTADOS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                                            </SelectGroup>

                                            {(['VACACIONES', 'LICENCIA MEDICA', 'PERMISO CON GOCE', 'PERMISO SIN GOCE'].includes(editData.estadoActual)) && (
                                                <>
                                                    <InputGroup label="Desde" type="date" value={editData.fechaInicioEstado} onChange={v => setEditData({ ...editData, fechaInicioEstado: v })} />
                                                    <InputGroup label="Hasta" type="date" value={editData.fechaFinEstado} onChange={v => setEditData({ ...editData, fechaFinEstado: v })} />
                                                </>
                                            )}

                                            {editData.estadoActual === 'FINIQUITADO' && (
                                                <>
                                                    <InputGroup label="Fecha Finiquito" type="date" value={editData.fechaFiniquito} onChange={v => setEditData({ ...editData, fechaFiniquito: v })} />
                                                    <InputGroup label="Motivo Salida" value={editData.motivoSalida} onChange={v => setEditData({ ...editData, motivoSalida: v })} />
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="col-span-2 border-t border-slate-100"></div>

                                    <div className="col-span-2 bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex gap-4 items-center">
                                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><InfoField label="RUT" value={editData.rut} readOnly /></div>
                                        <div className="flex-1"><label className="text-[10px] uppercase font-bold text-slate-400">Nombre Completo</label><input className="w-full font-bold text-slate-700 bg-transparent border-b border-slate-300 focus:border-blue-500 outline-none" value={`${editData.nombre} ${editData.apellidos || ''}`} onChange={e => {
                                            const parts = e.target.value.split(' ');
                                            setEditData({ ...editData, nombre: parts[0], apellidos: parts.slice(1).join(' ') })
                                        }} /></div>
                                    </div>

                                    <InputGroup label="Cargo" value={editData.cargo} onChange={v => setEditData({ ...editData, cargo: v })} />
                                    <InputGroup label="Área" value={editData.area} onChange={v => setEditData({ ...editData, area: v })} />

                                    <div className="col-span-2 border-t border-slate-100 pt-4 mt-2"></div>

                                    <SelectGroup label="Mandante Principal" value={editData.mandantePrincipal} onChange={v => setEditData({ ...editData, mandantePrincipal: v })}>
                                        <option value="">Seleccione...</option>
                                        {MANDANTES.map(m => <option key={m} value={m}>{m}</option>)}
                                    </SelectGroup>
                                    <InputGroup label="Centro Costo (CECO)" value={editData.ceco} onChange={v => setEditData({ ...editData, ceco: v })} />

                                    <div className="col-span-2 border-t border-slate-100 pt-4 mt-2"></div>

                                    <InputGroup label="Fecha Ingreso" type="date" value={editData.fechaIngreso} onChange={v => setEditData({ ...editData, fechaIngreso: v })} />
                                    <div className="flex gap-4">
                                        <SelectGroup label="Tipo Contrato" value={editData.tipoContrato} onChange={v => setEditData({ ...editData, tipoContrato: v })}>
                                            {CONTRATOS.map(c => <option key={c} value={c}>{c}</option>)}
                                        </SelectGroup>
                                        {editData.tipoContrato === 'PLAZO FIJO' && (
                                            <InputGroup label="Duración (Meses)" type="number" value={editData.duracionContrato} onChange={v => setEditData({ ...editData, duracionContrato: v })} />
                                        )}
                                    </div>

                                    {/* LICENCIA DE CONDUCIR */}
                                    <div className="col-span-2 mt-4 flex items-end gap-4 p-4 border border-slate-200 rounded-xl">
                                        <div className="flex-1">
                                            <SelectGroup label="¿Requiere Conducir?" value={editData.requiereLicencia} onChange={v => setEditData({ ...editData, requiereLicencia: v })}>
                                                <option value="NO">No</option>
                                                <option value="SI">Sí</option>
                                            </SelectGroup>
                                        </div>
                                        {editData.requiereLicencia === 'SI' && (
                                            <div className="flex-1">
                                                <InputGroup label="Vencimiento Licencia" type="date" value={editData.fechaVencimientoLicencia} onChange={v => setEditData({ ...editData, fechaVencimientoLicencia: v })} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: PERSONAL */}
                            {activeTab === 'personal' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right-4 duration-300">
                                    <InputGroup label="Fecha Nacimiento" type="date" value={editData.fechaNacimiento} onChange={v => setEditData({ ...editData, fechaNacimiento: v })} />
                                    <InputGroup label="Nacionalidad" value={editData.nacionalidad} onChange={v => setEditData({ ...editData, nacionalidad: v })} />

                                    <SelectGroup label="Estado Civil" value={editData.estadoCivil} onChange={v => setEditData({ ...editData, estadoCivil: v })}>
                                        <option value="">Seleccione...</option>
                                        {ESTADO_CIVIL.map(ec => <option key={ec} value={ec}>{ec}</option>)}
                                    </SelectGroup>

                                    <div className="col-span-2 border-t border-slate-100 pt-4 mt-2"></div>

                                    <InputGroup label="Email" type="email" value={editData.email} onChange={v => setEditData({ ...editData, email: v })} />
                                    <InputGroup label="Teléfono" type="tel" value={editData.telefono} onChange={v => setEditData({ ...editData, telefono: v })} />

                                    <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                                        <h4 className="text-xs font-black text-slate-400 uppercase mb-4">Domicilio</h4>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="col-span-2"><InputGroup label="Calle" value={editData.calle} onChange={v => setEditData({ ...editData, calle: v })} /></div>
                                            <InputGroup label="Número" value={editData.numero} onChange={v => setEditData({ ...editData, numero: v })} />
                                            <InputGroup label="Depto/Block" value={editData.deptoBlock} onChange={v => setEditData({ ...editData, deptoBlock: v })} />
                                            <InputGroup label="Comuna" value={editData.comuna} onChange={v => setEditData({ ...editData, comuna: v })} />
                                            <InputGroup label="Region" value={editData.region} onChange={v => setEditData({ ...editData, region: v })} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: FINANCIERO */}
                            {activeTab === 'financiero' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right-4 duration-300">
                                    <div className="col-span-2 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                                        <h4 className="text-xs font-black text-emerald-600 uppercase mb-4 flex items-center gap-2"><DollarSign size={14} /> Datos Bancarios</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <SelectGroup label="Banco" value={editData.banco} onChange={v => setEditData({ ...editData, banco: v })}>
                                                <option value="">Seleccione...</option>
                                                {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                                            </SelectGroup>
                                            <SelectGroup label="Tipo Cuenta" value={editData.tipoCuenta} onChange={v => setEditData({ ...editData, tipoCuenta: v })}>
                                                <option value="">Seleccione...</option>
                                                {TIPOS_CUENTA.map(t => <option key={t} value={t}>{t}</option>)}
                                            </SelectGroup>
                                            <div className="col-span-2">
                                                <InputGroup label="Número de Cuenta" value={editData.numeroCuenta} onChange={v => setEditData({ ...editData, numeroCuenta: v })} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* PREVISION */}
                                    <div className="col-span-2 grid grid-cols-2 gap-6 border-t border-slate-100 pt-4">
                                        <SelectGroup label="Sistema Salud" value={editData.previsionSalud} onChange={v => setEditData({ ...editData, previsionSalud: v })}>
                                            <option value="FONASA">FONASA</option>
                                            <option value="ISAPRE">ISAPRE</option>
                                        </SelectGroup>

                                        {editData.previsionSalud === 'ISAPRE' && (
                                            <>
                                                <SelectGroup label="Nombre Isapre" value={editData.isapreNombre} onChange={v => setEditData({ ...editData, isapreNombre: v })}>
                                                    <option value="">Seleccione...</option>
                                                    {ISAPRES.filter(i => i !== 'FONASA').map(i => <option key={i} value={i}>{i}</option>)}
                                                </SelectGroup>
                                                <div className="flex gap-2">
                                                    <InputGroup label="Valor Plan" type="number" value={editData.valorPlan} onChange={v => setEditData({ ...editData, valorPlan: v })} />
                                                    <div className="w-24">
                                                        <SelectGroup label="Moneda" value={editData.monedaPlan} onChange={v => setEditData({ ...editData, monedaPlan: v })}>
                                                            <option value="UF">UF</option>
                                                            <option value="CLP">$</option>
                                                        </SelectGroup>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        <SelectGroup label="AFP" value={editData.afp} onChange={v => setEditData({ ...editData, afp: v })}>
                                            <option value="">Seleccione...</option>
                                            {AFPS.map(a => <option key={a} value={a}>{a}</option>)}
                                        </SelectGroup>

                                        <SelectGroup label="Pensionado" value={editData.pensionado} onChange={v => setEditData({ ...editData, pensionado: v })}>
                                            <option value="NO">No</option>
                                            <option value="SI">Sí</option>
                                        </SelectGroup>
                                    </div>

                                    {/* CARGAS */}
                                    <div className="col-span-2 border-t border-slate-100 pt-4 pb-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2">
                                                <Users size={14} /> Cargas Familiares
                                            </h4>
                                            <SelectGroup label="¿Tiene Cargas?" value={editData.tieneCargas} onChange={v => setEditData({ ...editData, tieneCargas: v })}>
                                                <option value="NO">No</option>
                                                <option value="SI">Sí</option>
                                            </SelectGroup>
                                        </div>

                                        {editData.tieneCargas === 'SI' && (
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                <div className="flex gap-2 items-end mb-4">
                                                    <InputGroup label="RUT Carga" value={cargaTemp.rut} onChange={v => setCargaTemp({ ...cargaTemp, rut: v })} />
                                                    <InputGroup label="Nombre" value={cargaTemp.nombre} onChange={v => setCargaTemp({ ...cargaTemp, nombre: v })} />
                                                    <InputGroup label="Parentesco" value={cargaTemp.parentesco} onChange={v => setCargaTemp({ ...cargaTemp, parentesco: v })} />
                                                    <button type="button" onClick={handleCargaAdd} className="bg-blue-500 text-white p-2.5 rounded-lg mb-[1px]"><Plus size={16} /></button>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {editData.listaCargas?.map((c, i) => (
                                                        <div key={i} className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm text-xs">
                                                            <span className="font-bold">{c.nombre}</span> <span className="text-slate-400">({c.parentesco})</span>
                                                            <button type="button" onClick={() => handleCargaRemove(i)} className="text-red-400"><X size={12} /></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                                        <InputGroup label="Sueldo Base" type="number" value={editData.sueldoBase} onChange={v => setEditData({ ...editData, sueldoBase: v })} />

                                        <div className="mt-4 grid grid-cols-2 gap-4">
                                            <SelectGroup label="Tipo Bono" value={editData.tipoBonificacion} onChange={v => setEditData({ ...editData, tipoBonificacion: v })}>
                                                {BONOS.map(b => <option key={b} value={b}>{b}</option>)}
                                            </SelectGroup>
                                            {(editData.tipoBonificacion?.includes('FIJO') || editData.tipoBonificacion?.includes('MIXTO')) && (
                                                <InputGroup label="Monto Bono Fijo" type="number" value={editData.montoBonoFijo} onChange={v => setEditData({ ...editData, montoBonoFijo: v })} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between pt-4 border-t border-slate-100 mt-4 sticky bottom-0 bg-white pb-2">
                                {/* FINIQUITAR ACTION */}
                                {editData.estadoActual !== 'FINIQUITADO' && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (window.confirm("¿Iniciar proceso de Finiquito?")) {
                                                setEditData({ ...editData, estadoActual: 'FINIQUITADO', activeTab: 'contractual' });
                                                setActiveTab('contractual');
                                            }
                                        }}
                                        className="text-red-500 font-bold text-xs uppercase flex items-center gap-2 hover:bg-red-50 px-4 py-2 rounded-xl transition-colors"
                                    >
                                        <LogOut size={16} /> Finiquitar
                                    </button>
                                )}

                                <button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-xs uppercase hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-500/20 transition-all transform hover:scale-105 active:scale-95 ml-auto">
                                    Guardar Cambios Oficiales
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

// --- HELPER COMPONENTS FOR FORM ---
const InputGroup = ({ label, value, onChange, type = "text" }) => (
    <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5 ml-1">{label}</label>
        <input
            type={type}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
        />
    </div>
);

const SelectGroup = ({ label, value, onChange, children }) => (
    <div className="relative group">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5 ml-1 group-focus-within:text-blue-500 transition-colors">{label}</label>
        <div className="relative">
            <select
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-bold text-sm rounded-xl py-3 pl-4 pr-10 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none shadow-sm cursor-pointer"
            >
                {children}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
            </div>
        </div>
    </div>
);

const InfoField = ({ label, value }) => (
    <div>
        <label className="text-[9px] font-black text-blue-400 uppercase block">{label}</label>
        <div className="text-sm font-black text-blue-800">{value}</div>
    </div>
);

export default Dotacion;
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Users, RefreshCw, Search, Download, AlertCircle, Calendar, User, DollarSign,
    TrendingUp, ShieldCheck, Activity, HeartPulse, Wallet
} from 'lucide-react';
import { candidatosApi, proyectosApi, bonosConfigApi, bonosApi, modelosBonificacionApi, asistenciaApi, descuentosApi, beneficiosApi } from '../rrhhApi';
import { telecomApi } from '../../agentetelecom/telecomApi';
import { formatRut } from '../../../utils/rutUtils';
import * as XLSX from 'xlsx';
import { useIndicadores } from '../../../contexts/IndicadoresContext';

const fmt = (n) => `$${Math.round(n || 0).toLocaleString('es-CL')}`;

const AFP_RATES = {
    'CAPITAL': 11.44,
    'CUPRUM': 11.44,
    'HABITAT': 11.27,
    'PLANVITAL': 11.16,
    'PROVIDA': 11.45,
    'MODELO': 10.58,
    'UNO': 10.46,
};
const TOPE_AFP_UF = 89.9;

const getWorkerActiveDays = (emp, diasMes, periodStr) => {
    // periodStr is YYYY-MM
    const [y, m] = periodStr.split('-');
    const year = parseInt(y, 10);
    const month = parseInt(m, 10);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);

    const ingresoDate = (emp.contractStartDate || emp.fechaIngreso) ? new Date(emp.contractStartDate || emp.fechaIngreso) : null;
    const finiquitoDate = emp.fechaFiniquito ? new Date(emp.fechaFiniquito) : null;

    if (!ingresoDate || isNaN(ingresoDate.getTime())) return diasMes;
    if (ingresoDate > endOfMonth) return 0;
    
    let activeStart = startOfMonth;
    if (ingresoDate > startOfMonth) activeStart = ingresoDate;

    let activeEnd = endOfMonth;
    if (finiquitoDate && !isNaN(finiquitoDate.getTime())) {
        if (finiquitoDate < startOfMonth) return 0;
        if (finiquitoDate < endOfMonth) activeEnd = finiquitoDate;
    }

    const diffTime = Math.abs(activeEnd - activeStart);
    let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    return Math.min(diasMes, Math.max(0, diffDays));
};

const RemuCentral = () => {
    const [employees, setEmployees] = useState([]);
    const [proyectos, setProyectos] = useState([]);
    const [bonosConfig, setBonosConfig] = useState([]);
    const [closures, setClosures] = useState([]);
    const [modelosBono, setModelosBono] = useState([]);
    
    const { ufValue } = useIndicadores();
    
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCeco, setFilterCeco] = useState('');
    const [asistenciaData, setAsistenciaData] = useState([]);
    const [descuentosData, setDescuentosData] = useState([]);
    const [beneficiosData, setBeneficiosData] = useState([]);
    const [activeTab, setActiveTab] = useState('Sueldo Base & Bonos');
    const [filterStatus, setFilterStatus] = useState('Activo');

    const d = new Date();
    const currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const [period, setPeriod] = useState(currentMonth);

    const diasMes = useMemo(() => {
        const [y, m] = period.split('-');
        return new Date(y, m, 0).getDate();
    }, [period]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [year, month] = period.split('-');
            const [candRes, projRes, configRes, closRes, modRes, asisRes, descRes, benRes] = await Promise.all([
                candidatosApi.getAll(),
                proyectosApi.getAll(),
                bonosConfigApi.getAll(),
                bonosApi.getClosure(year, month).catch(() => ({ data: [] })),
                modelosBonificacionApi.getAll().catch(() => ({ data: [] })),
                asistenciaApi.getResumenPeriodo(month, year).catch(() => ({ data: [] })),
                descuentosApi.getTransacciones(period).catch(() => ({ data: [] })),
                beneficiosApi.getTransacciones(period).catch(() => ({ data: [] }))
            ]);
            
            setEmployees(candRes.data || []);
            setProyectos(projRes.data || []);
            setBonosConfig(configRes.data || []);
            setModelosBono(modRes.data || []);
            setAsistenciaData(asisRes.data || []);
            setDescuentosData(descRes.data || []);
            setBeneficiosData(benRes.data || []);

            let fetchedClosures = closRes.data || [];
            
            // Si no hay cierre (ni siquiera borrador), calculamos al vuelo para que sea 100% dinámico
            if (fetchedClosures.length === 0) {
                try {
                    const daysInMonth = new Date(year, month, 0).getDate();
                    const desde = `${year}-${String(month).padStart(2, '0')}-01`;
                    const hasta  = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
                    
                    let prevMonth = parseInt(month) - 1;
                    let prevYear = parseInt(year);
                    if (prevMonth === 0) {
                        prevMonth = 12;
                        prevYear = parseInt(year) - 1;
                    }
                    const prevDaysInMonth = new Date(prevYear, prevMonth, 0).getDate();
                    const desdeGarantias = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
                    const hastaGarantias = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevDaysInMonth).padStart(2, '0')}`;

                    const [statsRes, garantiasRes] = await Promise.all([
                        telecomApi.get('/bot/produccion-stats', { params: { desde, hasta, estado: 'Completado' } }).catch(() => ({ data: null })),
                        telecomApi.get('/bot/garantias-stats', { params: { desde: desdeGarantias, hasta: hastaGarantias } }).catch(() => ({ data: null }))
                    ]);

                    const garantiasMap = {};
                    if (garantiasRes?.data?.statsTecnicos) {
                        garantiasRes.data.statsTecnicos.forEach(t => {
                            const cleanId = String(t.id).replace(/^0+/, '').trim();
                            garantiasMap[cleanId] = t;
                        });
                    }

                    const activeModels = Array.isArray(modRes.data) ? modRes.data : [modRes.data];
                    const activeModel = activeModels.find(m => m && m.tipo === 'BAREMO_PUNTOS') || activeModels[0] || null;

                    const calculateTierBonus = (val, tramos) => {
                        if (!tramos || tramos.length === 0) return 0;
                        const matchingTiers = tramos.filter(t => {
                            if (t.operator === '<') return val < t.limit;
                            if (t.operator === '>') return val > t.limit;
                            return val >= t.desde && val <= t.hasta;
                        });
                        if (matchingTiers.length === 0) return 0;
                        return Math.max(...matchingTiers.map(t => t.valor || 0));
                    };

                    const tecnicos = Array.isArray(statsRes?.data?.tecnicos) ? statsRes.data.tecnicos : [];
                    const calculosSimulados = tecnicos.map(t => {
                        const pts = t.ptsTotal || 0;
                        let multiplier = 0;
                        let baremoBonus = 0;
                        let rrBonus = 0;
                        let aiBonus = 0;

                        if (activeModel?.tramosBaremos) {
                            const tier = activeModel.tramosBaremos.find(tr => {
                                const hString = String(tr.hasta).trim().toLowerCase();
                                const isMax = hString === 'más' || hString === 'mas' || hString === 'mas+' || hString === '';
                                const limitMax = isMax ? 999999 : parseFloat(tr.hasta);
                                const limitMin = parseFloat(tr.desde) || 0;
                                const currentPts = parseFloat(pts) || 0;
                                return currentPts >= limitMin && currentPts <= limitMax;
                            });
                            multiplier = tier ? parseFloat(tier.valor) : 0;
                            const ptsExcluidos = activeModel.puntosExcluidos || 0;
                            const calculablePts = Math.max(0, (parseFloat(pts) || 0) - ptsExcluidos);
                            baremoBonus = calculablePts * multiplier;
                        }

                        const idRecursoRaw = String(t.idRecursoToa || t.idRecurso || t._id || '').replace(/^0+/, '').trim();
                        const garantiasTec = garantiasMap[idRecursoRaw] || {};
                        const rrValue = Math.round((garantiasTec.rrValue || 0) * 100) / 100;
                        const aiValue = Math.round((garantiasTec.aiValue || 0) * 100) / 100;

                        if (activeModel && t.orders > 0) {
                            const ptsExcluidos = activeModel.puntosExcluidos || 0;
                            const calculablePts = Math.max(0, (parseFloat(pts) || 0) - ptsExcluidos);
                            if (calculablePts > 0) {
                                rrBonus = calculateTierBonus(rrValue, activeModel.tramosRR);
                                aiBonus = calculateTierBonus(aiValue, activeModel.tramosAI);
                            }
                        }

                        return {
                            tecnicoId: t.idRecursoToa || t._id,
                            rut: t.rut,
                            nombre: t.name || t.nombre,
                            puntos: pts,
                            baremoBonus,
                            rrValue,
                            rrBonus,
                            aiValue,
                            aiBonus,
                            totalBonus: baremoBonus + rrBonus + aiBonus
                        };
                    });

                    fetchedClosures = [{
                        status: 'CERRADO', 
                        calculos: calculosSimulados,
                        transacciones: []
                    }];
                } catch (err) {
                    console.error('Error calculando bonos dinámicamente:', err);
                }
            }

            setClosures(fetchedClosures);
        } catch (e) {
            console.error('Error fetching RemuCentral data:', e);
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const cecos = [...new Set(proyectos.map(p => p.centroCosto).filter(Boolean))];

    const consolidado = useMemo(() => {
        const result = [];
        
        employees.forEach(emp => {
            if (emp.status === 'Finiquitado' || emp.status === 'De Baja' || emp.status === 'Retirado') {
                if (emp.fechaFiniquito) {
                    const fQ = new Date(emp.fechaFiniquito);
                    const pDate = new Date(`${period}-01T00:00:00`);
                    if (fQ.getMonth() !== pDate.getMonth() || fQ.getFullYear() !== pDate.getFullYear()) {
                        return;
                    }
                } else {
                    return;
                }
            }

            const term = searchTerm.toLowerCase();
            const cleanSearch = searchTerm.replace(/[^0-9kK]/gi, '');
            const empCleanRut = emp.rut ? emp.rut.replace(/[^0-9kK]/gi, '') : '';
            const matchesSearch = !searchTerm || 
                emp.fullName?.toLowerCase().includes(term) || 
                (cleanSearch && empCleanRut.includes(cleanSearch)) || 
                emp.position?.toLowerCase().includes(term);
            
            const projId = emp.projectId?._id || emp.projectId;
            const proj = proyectos.find(p => p._id === projId);
            const ceco = proj?.centroCosto || emp.ceco || 'N/A';
            const matchesCeco = !filterCeco || ceco === filterCeco;
            
            const matchesStatus = filterStatus === 'Todos' || 
                (filterStatus === 'Activo' && ['Contratado', 'Activo', 'ACTIVO', 'En Terreno'].includes(emp.status)) || 
                (filterStatus === 'Fis/Ret' && ['Finiquitado', 'Retirado', 'De Baja'].includes(emp.status));

            if (!matchesSearch || !matchesCeco || !matchesStatus) return;

            const sueldoBase = Number(emp.sueldoBase) || 0;
            const workerDays = getWorkerActiveDays(emp, diasMes, period);
            const prorrateadoSueldo = sueldoBase ? Math.round((sueldoBase / diasMes) * workerDays) : 0;

            let totalFijos = 0;
            let totalVariables = 0;

            // Bonos Fijos
            const modelosActivos = modelosBono.filter(m => m.activo && m.tipo === 'BONO_FIJO');
            const modelosAplicables = modelosActivos.filter(m => {
                if (m.aplicaA?.todos) return true;
                if (m.aplicaA?.cargos && m.aplicaA.cargos.length > 0) {
                    const normalizedCargo = (emp.position || '').toUpperCase().trim();
                    return m.aplicaA.cargos.map(c => (c || '').toUpperCase().trim()).includes(normalizedCargo);
                }
                return false;
            });

            if (proj?.dotacion) {
                const dot = proj.dotacion.find(d => d.cargo === emp.position);
                if (dot?.bonos) {
                    const bonosFijosList = dot.bonos.filter(b => b.modality === 'Fijo');
                    bonosFijosList.forEach(bf => {
                        const bonoRefId = bf.bonoRef?._id || bf.bonoRef;
                        const isCoveredByModel = modelosAplicables.some(mod => 
                            bonoRefId === mod._id || 
                            bonoRefId === mod.tipoBonoRef?._id || 
                            bonoRefId === mod.tipoBonoRef
                        );
                        if (isCoveredByModel) return;
                        
                        const config = bonosConfig.find(c => c._id === bonoRefId);
                        const montoBase = bf.monto || config?.config?.monto || 0;
                        totalFijos += montoBase;
                    });
                }
            }

            modelosAplicables.forEach(mod => {
                const montoBase = mod.bonoFijo?.monto || 0;
                totalFijos += montoBase;
            });

            const prorrateadoBonoFijo = totalFijos > 0 ? Math.round((totalFijos / diasMes) * workerDays) : 0;

            let baremoBonus = 0;
            let rrBonus = 0;
            let aiBonus = 0;

            const cleanRut = (r) => String(r || '').replace(/[^0-9kK]/g, '').toUpperCase();
            const cleanId = (id) => String(id || '').replace(/^0+/, '').trim();
            const eRut = cleanRut(emp.rut);
            const eId = cleanId(emp.idRecursoToa);
            const eName = String(emp.fullName || '').toLowerCase().trim();

            // Bonos Variables
            closures.forEach(cl => {
                if (cl.status !== 'CERRADO') return;
                
                const calculos = cl.calculos || [];
                const empCalc = calculos.find(c => {
                    const cRut = cleanRut(c.rut);
                    const cId = cleanId(c.tecnicoId || c.idRecursoToa);
                    const cName = String(c.nombre || c.name || '').toLowerCase().trim();
                    
                    if (eRut && cRut && cRut === eRut) return true;
                    if (eId && cId && cId === eId) return true;
                    if (eName && cName && cName === eName) return true;
                    return false;
                });
                
                if (empCalc) {
                    baremoBonus += (empCalc.baremoBonus || 0);
                    rrBonus += (empCalc.rrBonus || 0);
                    aiBonus += (empCalc.aiBonus || 0);
                    totalVariables += (empCalc.totalBonus || (empCalc.baremoBonus || 0) + (empCalc.rrBonus || 0) + (empCalc.aiBonus || 0));
                } else {
                    const txs = cl.transacciones || [];
                    const empTxs = txs.filter(t => {
                        const tRut = cleanRut(t.beneficiario?.rut);
                        const tId = cleanId(t.beneficiario?.tecnicoRef);
                        const tName = String(t.beneficiario?.fullName || t.beneficiario?.nombre || '').toLowerCase().trim();
                        
                        if (eRut && tRut && tRut === eRut) return true;
                        if (eId && tId && tId === eId) return true;
                        if (eName && tName && tName === eName) return true;
                        return false;
                    });
                    empTxs.forEach(tx => {
                        const monto = tx.monto || 0;
                        totalVariables += monto;
                    });
                }
            });

            const totalCostoCaja = prorrateadoSueldo + prorrateadoBonoFijo;
            const rentabilidadBruta = totalVariables - totalCostoCaja;

            const asis = asistenciaData.find(a => {
                const aRut = cleanRut(a.rut);
                return (aRut && aRut === eRut) || (a.candidatoRef === emp._id) || (a.tecnicoRef === emp._id);
            });
            
            const totalAsistencia = asis?.diasTrabajados ?? asis?.asistencia ?? 0;
            const totalInasistencia = asis?.diasAusente ?? asis?.inasistencia ?? 0;
            const hrsExtras = asis?.horasExtras ?? 0;
            const hrsDescontadas = asis?.horasDescontadas ?? 0;

            const desc = descuentosData.filter(d => d.candidatoRef === emp._id || (d.rut && cleanRut(d.rut) === eRut));
            const totalDescuentos = desc.reduce((sum, d) => sum + (d.monto || 0), 0);

            const ben = beneficiosData.filter(b => b.candidatoRef === emp._id || (b.rut && cleanRut(b.rut) === eRut));
            const totalBeneficios = ben.reduce((sum, b) => sum + (b.monto || 0), 0);

            // Cálculos de Cotizaciones y Otros
            const ufHoy = ufValue || 38600; // Fallback si no hay UF disponible
            const topeLegalCLP = TOPE_AFP_UF * ufHoy;
            
            // Gratificación Legal
            const SUELDO_MINIMO = 500000;
            const topeGratifMensual = (SUELDO_MINIMO * 4.75) / 12;
            const prorrateoTopeGratif = Math.round((topeGratifMensual / diasMes) * workerDays);
            const gratificacion = Math.min(Math.round((prorrateadoSueldo + prorrateadoBonoFijo + totalVariables) * 0.25), prorrateoTopeGratif);

            // La base imponible ahora incluye la Gratificación
            const baseImponible = Math.min(prorrateadoSueldo + prorrateadoBonoFijo + totalVariables + gratificacion, topeLegalCLP);

            // AFP
            const empAfpBase = (emp.afp || '').toUpperCase();
            const afpRate = AFP_RATES[empAfpBase] || 0;
            const afpMonto = afpRate ? Math.round(baseImponible * (afpRate / 100)) : 0;
            const empAfp = afpRate ? `${empAfpBase} (${afpRate}%)` : empAfpBase;

            // Salud
            const isFonasa = (emp.previsionSalud || '').toUpperCase() === 'FONASA';
            let saludMonto = 0;
            let saludEntidad = isFonasa ? 'FONASA (7%)' : (emp.isapreNombre || 'ISAPRE');
            
            if (isFonasa || !emp.valorPlan) {
                saludMonto = Math.round(baseImponible * 0.07);
                if (!isFonasa && !emp.valorPlan && emp.isapreNombre) {
                    saludEntidad = `${emp.isapreNombre} (7% Legal)`;
                }
            } else {
                // Isapre con plan pactado en UF
                const valPlan = parseFloat(emp.valorPlan) || 0;
                const montoPactado = Math.round(valPlan * ufHoy);
                const minimoLegal = Math.round(baseImponible * 0.07);
                saludMonto = Math.max(minimoLegal, montoPactado); 
                saludEntidad = minimoLegal > montoPactado ? `${emp.isapreNombre || 'ISAPRE'} (7% Legal)` : `${emp.isapreNombre || 'ISAPRE'} (${valPlan} UF)`;
            }

            // Cálculo Total Líquido
            const totalImponible = prorrateadoSueldo + prorrateadoBonoFijo + totalVariables + gratificacion;
            const totalDescuentosLegales = afpMonto + saludMonto;
            const totalLiquido = totalImponible - totalDescuentosLegales - totalDescuentos + totalBeneficios;
            
            // Distribuimos el descuento legal total sobre el 100% del ingreso imponible real
            const factorLiquido = totalImponible > 0 ? (totalImponible - totalDescuentosLegales) / totalImponible : 1;

            result.push({
                emp,
                projectName: proj?.nombreProyecto || 'General',
                ceco,
                sueldoBase,
                prorrateadoSueldo,
                totalFijos,
                prorrateadoBonoFijo,
                baremoBonus,
                rrBonus,
                aiBonus,
                totalVariables,
                totalCostoCaja,
                rentabilidadBruta,
                workerDays,
                totalAsistencia,
                totalInasistencia,
                hrsExtras,
                hrsDescontadas,
                totalDescuentos,
                totalBeneficios,
                gratificacion,
                totalImponible,
                totalDescuentosLegales,
                totalLiquido,
                factorLiquido,
                empAfp,
                afpMonto,
                saludEntidad,
                saludMonto
            });
        });

        return result.sort((a, b) => b.rentabilidadBruta - a.rentabilidadBruta);
    }, [employees, proyectos, bonosConfig, closures, modelosBono, asistenciaData, descuentosData, beneficiosData, searchTerm, filterCeco, filterStatus, period, diasMes, ufValue]);

    const getStatusInfo = (status) => {
        if (['Contratado', 'Activo', 'ACTIVO', 'En Terreno'].includes(status)) return { short: 'ACT', color: 'border-emerald-200 text-emerald-700 bg-emerald-50' };
        if (['Finiquitado', 'De Baja', 'Retirado'].includes(status)) return { short: 'BAJA', color: 'border-rose-200 text-rose-700 bg-rose-50' };
        return { short: 'PEND', color: 'border-amber-200 text-amber-700 bg-amber-50' };
    };

    const exportToExcel = () => {
        const data = consolidado.map(c => ({
            'ID Recurso': c.emp.idRecursoToa || 'N/A',
            'Especialista': c.emp.fullName,
            'RUT': formatRut(c.emp.rut),
            'Fecha Inicio': c.emp.contractStartDate || c.emp.fechaIngreso || '-',
            'Estado': c.emp.status,
            'Cargo': c.emp.position || 'Especialista',
            'Proyecto': c.projectName,
            'Sueldo Base Mes': c.sueldoBase,
            'Prorrateo Sueldo Base': c.prorrateadoSueldo,
            'Bono Fijo Mes': c.totalFijos,
            'Gratificación': c.gratificacion,
            'Asistencia': c.totalAsistencia,
            'Inasistencia': c.totalInasistencia,
            'Hrs Extras': c.hrsExtras,
            'Hrs Descontadas': c.hrsDescontadas,
            'Total Descuentos': c.totalDescuentos,
            'Total Beneficios': c.totalBeneficios,
            'AFP': c.empAfp || '-',
            'Monto AFP': c.afpMonto,
            'Salud': c.saludEntidad,
            'Monto Salud': c.saludMonto,
            'Líquido a Pagar': c.totalLiquido
        }));
        
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Rentabilidad_${period}`);
        XLSX.writeFile(wb, `Remu_Central_Rentabilidad_${period}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const sumImponible = consolidado.reduce((sum, c) => sum + (c.totalImponible || 0), 0);
    const sumCotizaciones = consolidado.reduce((sum, c) => sum + (c.totalDescuentosLegales || 0), 0);
    const sumDescuentos = consolidado.reduce((sum, c) => sum + (c.totalDescuentos || 0), 0);
    const sumBeneficios = consolidado.reduce((sum, c) => sum + (c.totalBeneficios || 0), 0);
    const sumLiquido = consolidado.reduce((sum, c) => sum + (c.totalLiquido || 0), 0);

    const summaryCards = [
        { title: 'Sueldo Base & Bonos', val: sumImponible, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', icon: TrendingUp },
        { title: 'Cotizaciones Legales', val: sumCotizaciones, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', icon: ShieldCheck },
        { title: 'Otros Descuentos', val: sumDescuentos, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: Activity },
        { title: 'Beneficios Laborales', val: sumBeneficios, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', icon: HeartPulse },
        { title: 'Líquido a Pagar', val: sumLiquido, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: Wallet },
    ];

    return (
        <div className="min-h-full bg-slate-50/50 p-4 md:p-8 pb-32 w-full overflow-x-hidden relative">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-emerald-600 text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-emerald-200 -rotate-3 hover:rotate-0 transition-transform">
                        <DollarSign size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase">
                            Remu <span className="text-emerald-600">Central</span>
                        </h1>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                            Detalle de Costos y Producción · {consolidado.length} Registros
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 mr-2">
                        <Calendar size={16} className="text-slate-400 ml-2" />
                        <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="bg-transparent text-sm font-black text-slate-700 focus:outline-none pr-2" />
                    </div>
                    <button onClick={exportToExcel} className="flex items-center gap-2 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-slate-600 font-black text-[10px] uppercase tracking-widest hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm">
                        <Download size={14} /> Exportar
                    </button>
                    <button onClick={fetchData} className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[2.5rem] p-6 mb-8 flex flex-wrap items-center gap-6 shadow-xl">
                <div className="flex-1 min-w-[300px] relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-emerald-500 transition-colors" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por Nombre, RUT o Cargo..." 
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold text-slate-600 focus:outline-none focus:ring-4 focus:ring-emerald-50 focus:bg-white transition-all"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                        {['Todos', 'Activo', 'Fis/Ret'].map(s => (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    <select 
                        className="pl-5 pr-10 py-4 bg-slate-100 border-none rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 focus:ring-4 focus:ring-indigo-50 appearance-none cursor-pointer"
                        value={filterCeco}
                        onChange={e => setFilterCeco(e.target.value)}
                    >
                        <option value="">TODOS LOS CECO</option>
                        {cecos.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                {summaryCards.map((card, idx) => {
                    const Icon = card.icon;
                    return (
                        <div key={idx} className={`rounded-[2rem] p-5 border bg-white ${card.border} shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group`}>
                            <div className={`absolute top-0 right-0 w-24 h-24 ${card.bg} rounded-bl-[4rem] -z-10 transition-transform group-hover:scale-110`}></div>
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-2xl ${card.bg} ${card.color}`}>
                                    <Icon size={18} />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{card.title}</h3>
                                <p className={`text-xl font-black ${card.color} tracking-tight`}>
                                    {fmt(card.val)}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Main Table Container */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl relative overflow-hidden">
                
                {/* Tabs */}
                <div className="flex items-end px-6 border-b-2 border-slate-200 mt-6 overflow-x-auto custom-scrollbar">
                    <button 
                        onClick={() => setActiveTab('Sueldo Base & Bonos')}
                        className={`px-6 py-4 text-[11px] font-black uppercase tracking-widest rounded-t-2xl transition-all ${activeTab === 'Sueldo Base & Bonos' ? 'bg-white text-emerald-600 border-t border-l border-r border-slate-100 shadow-[0_2px_0_0_white]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 border-t border-l border-r border-transparent'}`}
                        style={{ marginBottom: activeTab === 'Sueldo Base & Bonos' ? '-1px' : '0' }}
                    >
                        Sueldo Base & Bonos
                    </button>
                    <button 
                        onClick={() => setActiveTab('Cotizaciones y Otros')}
                        className={`px-6 py-4 text-[11px] font-black uppercase tracking-widest rounded-t-2xl transition-all ${activeTab === 'Cotizaciones y Otros' ? 'bg-white text-emerald-600 border-t border-l border-r border-slate-100 shadow-[0_2px_0_0_white]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 border-t border-l border-r border-transparent'}`}
                        style={{ marginBottom: activeTab === 'Cotizaciones y Otros' ? '-1px' : '0' }}
                    >
                        Cotizaciones y Otros
                    </button>
                    <button 
                        onClick={() => setActiveTab('Asistencia y Hrs Extras')}
                        className={`px-6 py-4 text-[11px] font-black uppercase tracking-widest rounded-t-2xl transition-all ${activeTab === 'Asistencia y Hrs Extras' ? 'bg-white text-emerald-600 border-t border-l border-r border-slate-100 shadow-[0_2px_0_0_white]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 border-t border-l border-r border-transparent'}`}
                        style={{ marginBottom: activeTab === 'Asistencia y Hrs Extras' ? '-1px' : '0' }}
                    >
                        Asistencia y Hrs Extras
                    </button>
                    <button 
                        onClick={() => setActiveTab('Descuentos')}
                        className={`px-6 py-4 text-[11px] font-black uppercase tracking-widest rounded-t-2xl transition-all ${activeTab === 'Descuentos' ? 'bg-white text-emerald-600 border-t border-l border-r border-slate-100 shadow-[0_2px_0_0_white]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 border-t border-l border-r border-transparent'}`}
                        style={{ marginBottom: activeTab === 'Descuentos' ? '-1px' : '0' }}
                    >
                        Descuentos
                    </button>
                    <button 
                        onClick={() => setActiveTab('Beneficios Laborales')}
                        className={`px-6 py-4 text-[11px] font-black uppercase tracking-widest rounded-t-2xl transition-all ${activeTab === 'Beneficios Laborales' ? 'bg-white text-emerald-600 border-t border-l border-r border-slate-100 shadow-[0_2px_0_0_white]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 border-t border-l border-r border-transparent'}`}
                        style={{ marginBottom: activeTab === 'Beneficios Laborales' ? '-1px' : '0' }}
                    >
                        Beneficios Laborales
                    </button>
                </div>

                {loading ? (
                    <div className="py-32 text-center">
                        <RefreshCw className="animate-spin mx-auto text-emerald-500 mb-4" size={40} />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Calculando Rentabilidad...</p>
                    </div>
                ) : consolidado.length === 0 ? (
                    <div className="py-32 text-center">
                        <AlertCircle className="mx-auto text-slate-200 mb-4" size={60} />
                        <p className="text-slate-400 font-bold">No se encontraron registros para {period}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar p-2">
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Especialista</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Inicio</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargo</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Proyecto</th>
                                    
                                    {activeTab === 'Sueldo Base & Bonos' && (
                                        <>
                                            <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Sueldo Base</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Producción</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Bono Fijo</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-indigo-500 uppercase tracking-widest text-right">Bono Baremo</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-emerald-500 uppercase tracking-widest text-right">DAT | RR%</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-blue-500 uppercase tracking-widest text-right">AI (Auditoría)</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-purple-500 uppercase tracking-widest text-right">Gratificación</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-right rounded-tr-xl bg-emerald-50">Líquido a Pagar</th>
                                        </>
                                    )}

                                    {activeTab === 'Asistencia y Hrs Extras' && (
                                        <>
                                            <th className="py-4 px-4 text-[10px] font-black text-amber-500 uppercase tracking-widest text-right">Asistencia</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-rose-500 uppercase tracking-widest text-right">Inasistencia</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-indigo-500 uppercase tracking-widest text-right">Hrs Extras</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-rose-500 uppercase tracking-widest text-right rounded-tr-xl">Hrs Descontadas</th>
                                        </>
                                    )}

                                    {activeTab === 'Descuentos' && (
                                        <>
                                            <th className="py-4 px-4 text-[10px] font-black text-rose-500 uppercase tracking-widest text-right rounded-tr-xl">Total Descuentos</th>
                                        </>
                                    )}

                                    {activeTab === 'Beneficios Laborales' && (
                                        <>
                                            <th className="py-4 px-4 text-[10px] font-black text-emerald-500 uppercase tracking-widest text-right rounded-tr-xl">Total Beneficios</th>
                                        </>
                                    )}

                                    {activeTab === 'Cotizaciones y Otros' && (
                                        <>
                                            <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">AFP</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Salud</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right rounded-tr-xl">Otros</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {consolidado.map((c, i) => (
                                    <tr key={c.emp._id || i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                                        <td className="py-4 px-4">
                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                                {c.emp.idRecursoToa || '-'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-xs text-slate-500 uppercase shadow-inner border border-slate-200 shrink-0">
                                                    {c.emp.profilePic ? <img src={c.emp.profilePic} alt="" className="w-full h-full object-cover rounded-xl" /> : (c.emp.fullName ? c.emp.fullName.substring(0, 2).toUpperCase() : <User size={14} />)}
                                                </div>
                                                <div>
                                                    <span className="text-[11px] font-black text-slate-800 tracking-tight block leading-tight">{c.emp.fullName}</span>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5 block font-mono">
                                                        RUT: {formatRut(c.emp.rut) || 'N/A'}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            {(() => {
                                                const start = c.emp.contractStartDate || c.emp.fechaIngreso;
                                                if (!start) return <span className="text-xs text-slate-300">-</span>;
                                                
                                                let displayDate = start;
                                                if (start.includes('T')) {
                                                    displayDate = new Date(start).toLocaleDateString('es-CL');
                                                } else if (/^\d{4}-\d{2}-\d{2}/.test(start)) {
                                                    const [y, m, d] = start.split('-');
                                                    displayDate = `${d}/${m}/${y}`;
                                                }
                                                return <span className="text-[10px] font-black text-slate-600 uppercase">{displayDate}</span>;
                                            })()}
                                        </td>
                                        <td className="py-4 px-4">
                                            {(() => {
                                                const { short, color } = getStatusInfo(c.emp.status || 'ACTIVO');
                                                return <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${color} shadow-sm uppercase tracking-wider`}>{short}</span>;
                                            })()}
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                                {c.emp.position || 'Especialista'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                                                {c.projectName}
                                            </span>
                                        </td>
                                        
                                        {activeTab === 'Sueldo Base & Bonos' && (
                                            <>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-sky-600 text-[11px]">
                                                        {c.prorrateadoSueldo > 0 ? fmt(c.prorrateadoSueldo) : '$0'}
                                                    </div>
                                                    <div className="font-black text-emerald-500 text-[9px] mt-0.5">
                                                        Líq: {fmt(c.prorrateadoSueldo * c.factorLiquido)}
                                                    </div>
                                                    <div className="text-[10px] font-bold text-slate-400 mt-1">
                                                        Mes Total: {c.sueldoBase > 0 ? fmt(c.sueldoBase) : '-'}
                                                    </div>
                                                    <div className="text-[9px] font-semibold text-slate-400 mt-0.5">
                                                        Prorrateo: {c.workerDays}/{diasMes} días
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    {c.totalVariables > 0 ? (
                                                        <>
                                                            <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                                                                {fmt(c.totalVariables)}
                                                            </div>
                                                            <div className="font-black text-emerald-500 text-[9px] mt-0.5">
                                                                Líq: {fmt(c.totalVariables * c.factorLiquido)}
                                                            </div>
                                                        </>
                                                    ) : <span className="text-xs text-slate-300">-</span>}
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-violet-600 text-[11px]">
                                                        {c.prorrateadoBonoFijo > 0 ? fmt(c.prorrateadoBonoFijo) : '$0'}
                                                    </div>
                                                    <div className="font-black text-emerald-500 text-[9px] mt-0.5">
                                                        Líq: {fmt(c.prorrateadoBonoFijo * c.factorLiquido)}
                                                    </div>
                                                    {c.totalFijos > 0 && (
                                                        <div className="text-[10px] font-bold text-slate-400 mt-1">
                                                            Mes Total: {fmt(c.totalFijos)}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-indigo-600 text-[11px]">
                                                        {c.baremoBonus > 0 ? fmt(c.baremoBonus) : '$0'}
                                                    </div>
                                                    <div className="font-black text-emerald-500 text-[9px] mt-0.5">
                                                        Líq: {fmt(c.baremoBonus * c.factorLiquido)}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-emerald-600 text-[11px]">
                                                        {c.rrBonus > 0 ? fmt(c.rrBonus) : '$0'}
                                                    </div>
                                                    <div className="font-black text-emerald-500 text-[9px] mt-0.5">
                                                        Líq: {fmt(c.rrBonus * c.factorLiquido)}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-blue-600 text-[11px]">
                                                        {c.aiBonus > 0 ? fmt(c.aiBonus) : '$0'}
                                                    </div>
                                                    <div className="font-black text-emerald-500 text-[9px] mt-0.5">
                                                        Líq: {fmt(c.aiBonus * c.factorLiquido)}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-purple-600 text-[11px]">
                                                        {c.gratificacion > 0 ? fmt(c.gratificacion) : '$0'}
                                                    </div>
                                                    <div className="font-black text-emerald-500 text-[9px] mt-0.5">
                                                        Líq: {fmt(c.gratificacion * c.factorLiquido)}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right bg-emerald-50/50">
                                                    <div className="font-black text-emerald-600 text-[12px]">
                                                        {fmt(c.totalLiquido)}
                                                    </div>
                                                </td>
                                            </>
                                        )}

                                        {activeTab === 'Asistencia y Hrs Extras' && (
                                            <>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-amber-600 text-[11px]">
                                                        {c.totalAsistencia > 0 ? c.totalAsistencia : '-'}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-rose-600 text-[11px]">
                                                        {c.totalInasistencia > 0 ? c.totalInasistencia : '-'}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-indigo-600 text-[11px]">
                                                        {c.hrsExtras > 0 ? c.hrsExtras : '-'}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-rose-600 text-[11px]">
                                                        {c.hrsDescontadas > 0 ? c.hrsDescontadas : '-'}
                                                    </div>
                                                </td>
                                            </>
                                        )}

                                        {activeTab === 'Descuentos' && (
                                            <>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-rose-600 text-[11px]">
                                                        {c.totalDescuentos > 0 ? fmt(c.totalDescuentos) : '-'}
                                                    </div>
                                                </td>
                                            </>
                                        )}

                                        {activeTab === 'Beneficios Laborales' && (
                                            <>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-emerald-600 text-[11px]">
                                                        {c.totalBeneficios > 0 ? fmt(c.totalBeneficios) : '-'}
                                                    </div>
                                                </td>
                                            </>
                                        )}

                                        {activeTab === 'Cotizaciones y Otros' && (
                                            <>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-slate-800 text-[11px]">{c.empAfp || '-'}</div>
                                                    <div className="font-black text-rose-500 text-[11px] mt-0.5">
                                                        {c.afpMonto > 0 ? fmt(c.afpMonto) : '-'}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-slate-800 text-[11px]">{c.saludEntidad || '-'}</div>
                                                    <div className="font-black text-rose-500 text-[11px] mt-0.5">
                                                        {c.saludMonto > 0 ? fmt(c.saludMonto) : '-'}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-slate-400 text-[11px]">-</div>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RemuCentral;

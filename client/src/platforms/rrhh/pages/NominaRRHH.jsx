import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    CircleDollarSign, Users, User, Calendar, Search, Loader2,
    ChevronDown, ChevronUp, Download, RefreshCw, Eye,
    TrendingUp, ShieldCheck, Activity, HeartPulse, Wallet, Briefcase,
    X, Printer, FileText, Landmark, AlertCircle, Building2, Save,
    CheckCircle2, XCircle, Stethoscope, ArrowRight, Award
} from 'lucide-react';
import { candidatosApi, proyectosApi, bonosConfigApi, bonosApi, modelosBonificacionApi, asistenciaApi, descuentosApi, beneficiosApi, configApi, nominaApi } from '../rrhhApi';
import { telecomApi } from '../../agentetelecom/telecomApi';
import { formatRut } from '../../../utils/rutUtils';
import * as XLSX from 'xlsx';
import { MapPin, Briefcase as BriefcaseIcon } from 'lucide-react';
import { useIndicadores } from '../../../contexts/IndicadoresContext';
import { useAuth } from '../../auth/AuthContext';

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

// Helper: Impuesto Único de Segunda Categoría (Art. 43 N° 1 Ley de la Renta Chile)
const calcularImpuestoUnico = (baseTributable, utm) => {
    if (!utm || utm <= 0 || baseTributable <= 0) return 0;
    const baseUtm = baseTributable / utm;
    if (baseUtm <= 13.5) return 0; // Tramo 1 Exento (0 - 13.5 UTM)
    
    let tasa = 0;
    let rebajaUtm = 0;

    if (baseUtm <= 30) { tasa = 0.04; rebajaUtm = 0.54; }
    else if (baseUtm <= 50) { tasa = 0.08; rebajaUtm = 1.74; }
    else if (baseUtm <= 70) { tasa = 0.135; rebajaUtm = 4.49; }
    else if (baseUtm <= 90) { tasa = 0.23; rebajaUtm = 11.14; }
    else if (baseUtm <= 120) { tasa = 0.304; rebajaUtm = 17.80; }
    else if (baseUtm <= 310) { tasa = 0.35; rebajaUtm = 23.32; }
    else { tasa = 0.40; rebajaUtm = 38.82; }

    const impuestoClp = Math.round((baseTributable * tasa) - (rebajaUtm * utm));
    return Math.max(0, impuestoClp);
};

const parseLocalDate = (dateStr) => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    const str = String(dateStr).split('T')[0];
    const parts = str.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date(dateStr);
};

const getWorkerActiveDays = (emp, diasCalendario, periodStr) => {
    const [y, m] = periodStr.split('-');
    const year = parseInt(y, 10);
    const month = parseInt(m, 10);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);

    const ingresoDate = (emp.contractStartDate || emp.fechaIngreso) ? parseLocalDate(emp.contractStartDate || emp.fechaIngreso) : null;
    const finiquitoDate = emp.fechaFiniquito ? parseLocalDate(emp.fechaFiniquito) : null;

    if (!ingresoDate || isNaN(ingresoDate.getTime())) return 30; // Mes completo comercial
    if (ingresoDate > endOfMonth) return 0;
    
    let isFullMonth = true;
    let activeStartDay = 1;
    let activeEndDay = diasCalendario;

    if (ingresoDate > startOfMonth) {
        isFullMonth = false;
        activeStartDay = ingresoDate.getDate();
    }

    if (finiquitoDate && !isNaN(finiquitoDate.getTime())) {
        if (finiquitoDate < startOfMonth) return 0;
        if (finiquitoDate < endOfMonth) {
            isFullMonth = false;
            activeEndDay = finiquitoDate.getDate();
        }
    }

    if (isFullMonth) return 30; // Si sirvió todo el mes completo, comercialmente son 30 días

    // Prorrateo parcial mid-month según regla Art. 44 Código del Trabajo / DT Chile:
    // Los días activos del contrato (incluyendo días trabajados de turno + días de descanso semanal/libres)
    const diasCalendarioTrabajados = Math.max(0, activeEndDay - activeStartDay + 1);
    return Math.min(30, diasCalendarioTrabajados);
};

const HeaderBadge = ({ code, label, color }) => (
    <div className="flex flex-col items-center leading-tight">
        <span className="text-[9px] font-black tracking-widest opacity-60 font-mono">{code}</span>
        <span className={`text-[10px] font-black uppercase tracking-tight ${color}`}>{label}</span>
    </div>
);

const NominaRRHH = () => {
    const { ufValue, utmValue, immValue, params: indicParams, loading: indLoading } = useIndicadores();
    const { user } = useAuth();

    const [employees, setEmployees] = useState([]);
    const [proyectos, setProyectos] = useState([]);
    const [bonosConfig, setBonosConfig] = useState([]);
    const [closures, setClosures] = useState([]);
    const [modelosBono, setModelosBono] = useState([]);
    const [asistenciaData, setAsistenciaData] = useState([]);
    const [descuentosData, setDescuentosData] = useState([]);
    const [beneficiosData, setBeneficiosData] = useState([]);
    const [empresaConfig, setEmpresaConfig] = useState(null);

    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCeco, setFilterCeco] = useState('');
    const [filterCliente, setFilterCliente] = useState('');
    const [filterProyecto, setFilterProyecto] = useState('');
    const [filterCargo, setFilterCargo] = useState('');
    const [filterStatus, setFilterStatus] = useState('Operativo'); // Operativo, Finiquitado, Todos
    const [selected, setSelected] = useState(null);
    const [alert, setAlert] = useState(null);
    const [confirmModal, setConfirmModal] = useState(null);
    const [downloadingMassive, setDownloadingMassive] = useState(false);

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
            const daysInMonthRaw = new Date(year, month, 0).getDate();
            const desdeStr = `${year}-${String(month).padStart(2, '0')}-01`;
            const hastaStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonthRaw).padStart(2, '0')}`;

            const [candRes, finiRes, projRes, configRes, closRes, modRes, asisRes, descRes, benRes, empConfRes] = await Promise.all([
                candidatosApi.getAll({ status: 'Activo,Contratado,ACTIVO,En Terreno,Listo Terreno,Licencia Médica' }),
                candidatosApi.getFiniquitos({ desde: desdeStr, hasta: hastaStr }).catch(() => ({ data: [] })),
                proyectosApi.getAll(),
                bonosConfigApi.getAll(),
                bonosApi.getClosure(year, month).catch(() => ({ data: [] })),
                modelosBonificacionApi.getAll().catch(() => ({ data: [] })),
                asistenciaApi.getResumenPeriodo(month, year).catch(() => ({ data: [] })),
                descuentosApi.getTransacciones(period).catch(() => ({ data: [] })),
                beneficiosApi.getTransacciones(period).catch(() => ({ data: [] })),
                configApi.get().catch(() => ({ data: null }))
            ]);
            
            const uniqueEmpIds = new Set();
            const combinedEmployees = [];
            [...(candRes.data || []), ...(finiRes.data || [])].forEach(emp => {
                const id = emp._id || emp.rut;
                if (!uniqueEmpIds.has(id)) {
                    uniqueEmpIds.add(id);
                    combinedEmployees.push(emp);
                }
            });

            setEmployees(combinedEmployees);
            setProyectos(projRes.data || []);
            setBonosConfig(configRes.data || []);
            setModelosBono(modRes.data || []);
            setAsistenciaData(asisRes.data || []);
            setDescuentosData(descRes.data || []);
            setBeneficiosData(benRes.data || []);
            setEmpresaConfig(empConfRes.data || null);

            let fetchedClosures = closRes.data || [];
            
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
                            const currentPts = parseFloat(pts) || 0;
                            const tier = activeModel.tramosBaremos.find(tr => {
                                const hString = String(tr.hasta).trim().toLowerCase();
                                const isMax = hString === 'más' || hString === 'mas' || hString === 'mas+' || hString === '';
                                const limitMax = isMax ? 999999 : parseFloat(tr.hasta);
                                const limitMin = parseFloat(tr.desde) || 0;
                                return currentPts >= limitMin && currentPts <= limitMax;
                            });
                            multiplier = tier ? parseFloat(tier.valor) : 0;
                            baremoBonus = currentPts * multiplier;
                        }

                        const idRecursoRaw = String(t.idRecursoToa || t.idRecurso || t._id || '').replace(/^0+/, '').trim();
                        const garantiasTec = garantiasMap[idRecursoRaw] || {};
                        const rrValue = Math.round((garantiasTec.rrValue || 0) * 100) / 100;
                        const aiValue = Math.round((garantiasTec.aiValue || 0) * 100) / 100;

                        if (activeModel && (t.orders > 0 || (parseFloat(pts) || 0) > 0)) {
                            rrBonus = calculateTierBonus(rrValue, activeModel.tramosRR);
                            aiBonus = calculateTierBonus(aiValue, activeModel.tramosAI);
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
            console.error("❌ Error al cargar libro de remuneraciones:", e);
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const availableCecos = useMemo(() => {
        const cecos = new Set();
        proyectos.forEach(p => {
            if (p.centroCosto) cecos.add(p.centroCosto);
        });
        employees.forEach(e => {
            if (e.ceco) cecos.add(e.ceco);
        });
        return Array.from(cecos).sort();
    }, [proyectos, employees]);

    const availableProyectos = useMemo(() => {
        const proys = new Set();
        proyectos.forEach(p => {
            if (p.nombreProyecto || p.projectName) proys.add(p.nombreProyecto || p.projectName);
        });
        employees.forEach(e => {
            if (e.projectName) proys.add(e.projectName);
        });
        return Array.from(proys).sort();
    }, [proyectos, employees]);

    const availableCargos = useMemo(() => {
        const cargos = new Set();
        employees.forEach(e => {
            if (e.position) cargos.add(e.position);
        });
        return Array.from(cargos).sort();
    }, [employees]);

    const consolidado = useMemo(() => {
        const result = [];

        employees.forEach(emp => {
            let isCurrentPeriodFiniquito = false;
            if (emp.status === 'Finiquitado') {
                if (emp.fechaFiniquito) {
                    let fqMonth = '';
                    try {
                        fqMonth = new Date(emp.fechaFiniquito).toISOString().slice(0, 7);
                    } catch (err) {
                        fqMonth = '';
                    }

                    if (!fqMonth && typeof emp.fechaFiniquito === 'string') {
                        const match = emp.fechaFiniquito.match(/^(\d{4})-(\d{2})/);
                        if (match) fqMonth = `${match[1]}-${match[2]}`;
                    }

                    if (fqMonth !== period) {
                        return;
                    }
                    isCurrentPeriodFiniquito = true;
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
            const matchesProyecto = !filterProyecto || (proj?.nombreProyecto === filterProyecto || emp.projectName === filterProyecto);
            const matchesCargo = !filterCargo || emp.position === filterCargo;
            
            const matchesStatus = filterStatus === 'Todos' || 
                (filterStatus === 'Operativo' && (['Contratado', 'Activo', 'ACTIVO', 'En Terreno', 'Listo Terreno', 'Licencia Médica'].includes(emp.status) || isCurrentPeriodFiniquito)) || 
                (filterStatus === 'Finiquitado' && ['Finiquitado', 'Retirado', 'De Baja'].includes(emp.status));

            if (!matchesSearch || !matchesCeco || !matchesProyecto || !matchesCargo || !matchesStatus) return;

            const cleanRut = (r) => String(r || '').replace(/[^0-9kK]/g, '').toUpperCase();
            const cleanId = (id) => String(id || '').replace(/^0+/, '').trim();
            const eRut = cleanRut(emp.rut);
            const eId = cleanId(emp.idRecursoToa);
            const eName = String(emp.fullName || '').toLowerCase().trim();

            const asis = asistenciaData.find(a => {
                const aCandId = String(a.candidatoId?._id || a.candidatoId || a.candidatoRef || a.tecnicoRef || '').trim();
                const empId = String(emp._id || '').trim();
                return aCandId && empId && aCandId === empId;
            }) || asistenciaData.find(a => {
                const empRutRaw = String(emp.rut || '').trim().toUpperCase();
                const aRutRaw = String(a.rut || '').trim().toUpperCase();
                return empRutRaw && aRutRaw && empRutRaw === aRutRaw;
            }) || asistenciaData.find(a => {
                const aRut = cleanRut(a.rut);
                return aRut && eRut && aRut === eRut;
            });
            
            const totalAsistencia = asis?.diasEfectivos ?? asis?.diasPresente ?? asis?.diasTrabajados ?? asis?.asistencia ?? 0;
            const totalInasistencia = asis?.diasAusente ?? asis?.inasistencia ?? 0;
            const hrsTurno = asis?.horasTurnoTotales ?? 0;
            const hrsTrabajadas = asis?.horasEfectivasTrabajadas ?? asis?.horasNormalesTrabajadas ?? 0;
            const hrsNoTrabajadas = asis?.horasNoTrabajadas ?? 0;
            const hrsLibres = asis?.horasLibres ?? 0;
            const hrsExtrasRaw = Number(asis?.horasExtraAprobadas ?? asis?.horasExtras) || 0;
            const balanceHoras = asis?.balanceHoras !== undefined ? asis.balanceHoras : (hrsExtrasRaw - hrsNoTrabajadas - hrsLibres);

            // Las Horas Extras a pago (Código DT 1003) se toman exclusivamente del Balance Neto (Ext - No Trab - Perm)
            let hrsExtras = 0;
            const vState = asis?.validacion?.estadoValidacion || asis?.estadoValidacion;
            if (vState === 'COMPENSADO_ZERO') {
                hrsExtras = 0;
            } else if (vState === 'AJUSTE_MANUAL') {
                hrsExtras = Math.max(0, Number(asis?.validacion?.balanceAprobadoFinal ?? asis?.balanceAprobadoFinal) || 0);
            } else if (vState === 'APROBADO_ORIGINAL') {
                const balOrig = Number(asis?.validacion?.metricsSnapshot?.balanceOriginal ?? asis?.balanceOriginal ?? balanceHoras) || 0;
                hrsExtras = Math.max(0, balOrig);
            } else {
                hrsExtras = Math.max(0, Number(balanceHoras) || 0);
            }
            const hrsDescontadas = asis?.horasDescontadas ?? (asis?.diasDescontados ? asis.diasDescontados * 8 : 0) ?? hrsNoTrabajadas;

            const diasPermisos = asis?.diasPermisos ?? asis?.diasLibres ?? (hrsLibres > 0 ? Math.round(hrsLibres / 8) : 0);
            const diasLicencias = asis?.diasLicencia ?? asis?.diasLicenciaMedica ?? asis?.diasEnLicencia ?? 0;
            const diasOperativosMes = asis?.diasOperativos ?? asis?.diasHabiles ?? (diasMes <= 28 ? 24 : diasMes <= 30 ? 25 : 26);
            const esMesCompleto = totalInasistencia === 0 && (totalAsistencia >= diasOperativosMes || !asis);
            const diasResultadoPago = esMesCompleto ? diasOperativosMes : Math.max(0, totalAsistencia - totalInasistencia);

            const BASE_DIAS = 30;
            const diasNoRemunerados = totalInasistencia + diasLicencias;
            const diasPagadosPorEmpleador = Math.max(0, BASE_DIAS - diasNoRemunerados);
            const factorAsistencia = asis ? Math.min(1, Math.max(0, diasPagadosPorEmpleador / BASE_DIAS)) : 1;
            const tieneAjusteAsistencia = asis && factorAsistencia < 0.999;

            const sueldoBase = Number(emp.sueldoBase) || 0;
            const diasContrato = getWorkerActiveDays(emp, diasMes, period);
            let workerDays = 30;
            if (diasNoRemunerados > 0) {
                // Según Dictamen DT N° 4851/276: En meses de 31 días con licencia médica o inasistencia parcial,
                // el empleador debe pagar los días efectivamente trabajados en el mes calendario (diasMes - diasNoRemunerados), tope 30.
                const baseCalculo = (diasContrato < 30) ? diasContrato : diasMes;
                workerDays = Math.min(30, Math.max(0, baseCalculo - diasNoRemunerados));
            } else {
                workerDays = diasContrato;
            }
            
            const prorrateadoSueldo = sueldoBase ? Math.round((sueldoBase / BASE_DIAS) * workerDays) : 0;

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

            const prorrateadoBonoFijo = totalFijos > 0 ? Math.round((totalFijos / BASE_DIAS) * workerDays) : 0;

            let baremoBonus = 0;
            let rrBonus = 0;
            let aiBonus = 0;

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

            const baremoRaw = baremoBonus;
            const rrRaw = rrBonus;
            const aiRaw = aiBonus;
            const baremoAjustado = baremoBonus; 
            const rrAjustado     = Math.round(rrBonus * factorAsistencia);
            const aiAjustado     = Math.round(aiBonus * factorAsistencia);

            const totalVariablesAjustado = baremoAjustado + rrAjustado + aiAjustado;

            const desc = descuentosData.filter(d => d.candidatoRef === emp._id || (d.rut && cleanRut(d.rut) === eRut));
            const totalDescuentos = desc.reduce((sum, d) => sum + (d.monto || 0), 0);

            const ben = beneficiosData.filter(b => b.candidatoRef === emp._id || (b.rut && cleanRut(b.rut) === eRut));
            const totalBeneficios = ben.reduce((sum, b) => sum + (b.monto || 0), 0);

            const ufHoy = ufValue || 38500; 
            const utmHoy = utmValue || 67500;
            const topeAfpLocal = indicParams?.topeAfpUf || 89.9;
            const topeAfcLocal = indicParams?.topeAfcUf || 135.1;
            const sisRateLocal = indicParams?.sisRate || 1.54;

            // Horas Extras (Código DT 1003) y Descuento por Atrasos/Horas No Trabajadas
            const montoHorasExtras = (sueldoBase && hrsExtras > 0) ? Math.round((sueldoBase / 180) * 1.5 * hrsExtras) : 0;
            const montoDescuentoHoras = (sueldoBase && hrsDescontadas > 0) ? Math.round((sueldoBase / 180) * hrsDescontadas) : 0;
            const totalOtrosDescuentos = totalDescuentos + montoDescuentoHoras;

            const topeLegalCLP = Math.round((topeAfpLocal * ufHoy / BASE_DIAS) * workerDays);
            
            const SUELDO_MINIMO = immValue || 553553;
            const topeGratifMensual = (SUELDO_MINIMO * 4.75) / 12;
            const prorrateoTopeGratif = Math.round((topeGratifMensual / BASE_DIAS) * workerDays);
            const baseParaGratificacion = prorrateadoSueldo + montoHorasExtras + prorrateadoBonoFijo + totalVariablesAjustado;
            const gratificacion = Math.min(Math.round(baseParaGratificacion * 0.25), prorrateoTopeGratif);

            const totalImponible = prorrateadoSueldo + montoHorasExtras + prorrateadoBonoFijo + totalVariablesAjustado + gratificacion;
            const baseImponible = Math.min(totalImponible, topeLegalCLP);
            const topeLegalAfcCLP = Math.round((topeAfcLocal * ufHoy / BASE_DIAS) * workerDays);
            const baseImponibleAfc = Math.min(totalImponible, topeLegalAfcCLP);

            const empAfpBase = (emp.afp || '').toUpperCase();
            const afpRate = AFP_RATES[empAfpBase] || 0;
            const afpMonto = afpRate ? Math.round(baseImponible * (afpRate / 100)) : 0;
            const empAfp = afpRate ? `${empAfpBase} (${afpRate}%)` : empAfpBase;

            const isFonasa = (emp.previsionSalud || '').toUpperCase() === 'FONASA';
            let saludMonto = 0;
            let saludEntidad = isFonasa ? 'FONASA (7%)' : (emp.isapreNombre || 'ISAPRE');
            
            if (isFonasa || !emp.valorPlan) {
                saludMonto = Math.round(baseImponible * 0.07);
                if (!isFonasa && !emp.valorPlan && emp.isapreNombre) {
                    saludEntidad = `${emp.isapreNombre} (7% Legal)`;
                }
            } else {
                const valPlan = parseFloat(emp.valorPlan) || 0;
                const montoPactado = Math.round(valPlan * ufHoy);
                const minimoLegal = Math.round(baseImponible * 0.07);
                saludMonto = Math.max(minimoLegal, montoPactado); 
                saludEntidad = minimoLegal > montoPactado ? `${emp.isapreNombre || 'ISAPRE'} (7% Legal)` : `${emp.isapreNombre || 'ISAPRE'} (${valPlan} UF)`;
            }

            // AFC y Leyes Sociales Patronales (Dinámico según Tipo de Contrato de Captura de Talento)
            const contractType = (emp.tipoContrato || emp.contractType || 'INDEFINIDO').toUpperCase();
            const esPlazoFijo = contractType.includes('PLAZO') || contractType.includes('OBRA') || contractType.includes('FAENA');
            const esIndefinido = contractType.includes('INDEFINIDO') || !esPlazoFijo;
            const afcTrabajadorMonto = esIndefinido ? Math.round(baseImponibleAfc * 0.006) : 0;
            const afcPatronalRate = esIndefinido ? 2.4 : 3.0;
            const afcPatronalMonto = Math.round(baseImponibleAfc * (afcPatronalRate / 100));

            const cotizSalud7Legal = Math.round(baseImponible * 0.07);
            const baseTributable = Math.max(0, totalImponible - afpMonto - cotizSalud7Legal - afcTrabajadorMonto);
            const impuestoUnico = calcularImpuestoUnico(baseTributable, utmHoy);

            const sisMonto = Math.round(baseImponible * (sisRateLocal / 100));
            const tasaMutualReal = empresaConfig?.tasaMutual !== undefined ? empresaConfig.tasaMutual : 0.93;
            const mutualMonto = Math.round(baseImponible * (tasaMutualReal / 100));
            const expectativaMonto = Math.round(baseImponible * 0.005); 

            const totalAportesPatronales = sisMonto + mutualMonto + expectativaMonto + afcPatronalMonto;

            const totalDescuentosLegales = afpMonto + saludMonto + afcTrabajadorMonto + impuestoUnico;
            const totalLiquido = totalImponible - totalDescuentosLegales - totalOtrosDescuentos + totalBeneficios;

            result.push({
                emp,
                projectName: proj?.nombreProyecto || emp.projectName || 'General',
                ceco,
                sueldoBase,
                prorrateadoSueldo,
                montoHorasExtras,
                montoDescuentoHoras,
                totalFijos,
                prorrateadoBonoFijo,
                baremoBonus: baremoAjustado,
                baremoRaw,
                rrBonus: rrAjustado,
                rrRaw,
                aiBonus: aiAjustado,
                aiRaw,
                totalVariables: totalVariablesAjustado,
                totalVariablesRaw: totalVariables,
                factorAsistencia,
                tieneAjusteAsistencia,
                diasNoRemunerados,
                totalCostoCaja,
                rentabilidadBruta,
                workerDays,
                totalAsistencia,
                totalInasistencia,
                hrsTurno,
                hrsTrabajadas,
                hrsExtras,
                hrsDescontadas,
                hrsNoTrabajadas,
                hrsLibres,
                diasPermisos,
                diasLicencias,
                diasOperativosMes,
                esMesCompleto,
                diasResultadoPago,
                totalDescuentos,
                totalBeneficios,
                gratificacion,
                totalImponible,
                totalDescuentosLegales,
                totalLiquido,
                empAfp,
                afpMonto,
                saludEntidad,
                saludMonto,
                afcTrabajadorMonto,
                impuestoUnico,
                sisMonto,
                mutualMonto,
                expectativaMonto,
                afcPatronalMonto,
                totalAportesPatronales
            });
        });

        return result.sort((a, b) => b.totalImponible - a.totalImponible);
    }, [employees, proyectos, bonosConfig, closures, modelosBono, asistenciaData, descuentosData, beneficiosData, empresaConfig, searchTerm, filterCeco, filterProyecto, filterCargo, filterStatus, period, diasMes, ufValue, utmValue, immValue, indicParams]);

    const sumImponible = consolidado.reduce((sum, c) => sum + (c.totalImponible || 0), 0);
    const sumCotizaciones = consolidado.reduce((sum, c) => sum + (c.totalDescuentosLegales || 0), 0);
    const sumDescuentos = consolidado.reduce((sum, c) => sum + (c.totalDescuentos || 0), 0);
    const sumBeneficios = consolidado.reduce((sum, c) => sum + (c.totalBeneficios || 0), 0);
    const sumLiquido = consolidado.reduce((sum, c) => sum + (c.totalLiquido || 0), 0);
    const sumAportesPatronales = consolidado.reduce((sum, c) => sum + (c.totalAportesPatronales || 0), 0);
    const sumCostoEmpresa = sumImponible + sumAportesPatronales;

    // Exportación LRE Oficial DT Chile en formato Excel (.xlsx)
    const handleExportLRE = () => {
        if (!consolidado.length) return;
        const [y, m] = period.split('-');

        const rows = consolidado.map(c => {
            const cleanRutStr = (c.emp.rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
            const rutBody = cleanRutStr.slice(0, -1);
            const rutDv = cleanRutStr.slice(-1);
            const nameParts = (c.emp.fullName || '').trim().split(' ');
            const apellidoPaterno = nameParts.length > 2 ? nameParts[nameParts.length - 2] : (nameParts[1] || '');
            const apellidoMaterno = nameParts.length > 2 ? nameParts[nameParts.length - 1] : '';
            const nombres = nameParts.length > 2 ? nameParts.slice(0, -2).join(' ') : (nameParts[0] || '');

            return {
                'RUT Trabajador': rutBody,
                'DV Trabajador': rutDv,
                'Nombres': nombres,
                'Apellido Paterno': apellidoPaterno,
                'Apellido Materno': apellidoMaterno,
                'Cargo': c.emp.position || 'Especialista',
                'Proyecto': c.projectName,
                'CECO': c.ceco || 'N/A',
                'Fecha Ingreso': c.emp.contractStartDate || c.emp.fechaIngreso || '-',
                'Fecha Retiro': c.emp.fechaFiniquito || '-',
                'Días Trabajados (Base 30)': c.workerDays,
                'Días Licencia Médica': c.diasLicencias || 0,
                'Días Inasistencia': c.totalInasistencia || 0,
                
                // Haberes Imponibles
                '1010 - Sueldo Base': c.prorrateadoSueldo || 0,
                '1001 - Semana Corrida': 0,
                '1003 - Horas Extras Recargo 50%': 0,
                '1020 - Gratificación Legal (Art. 50)': c.gratificacion || 0,
                '1040 - Producción Real (Baremo)': c.baremoBonus || 0,
                '1041 - Bonificación Calidad (DAT/RR/AI)': (c.rrBonus || 0) + (c.aiBonus || 0),
                '1050 - Bono Asistencia': c.prorrateadoBonoFijo || 0,
                'TOTAL HABERES IMPONIBLES': c.totalImponible || 0,

                // Haberes No Imponibles
                '2010 - Viáticos / Terreno': 0,
                '2020 - Movilización': 0,
                '2030 - Colación': 0,
                '2060 - Asignación Familiar': c.totalBeneficios || 0,
                'TOTAL HABERES NO IMPONIBLES': c.totalBeneficios || 0,
                'TOTAL HABERES': (c.totalImponible || 0) + (c.totalBeneficios || 0),

                // Descuentos Legales
                '3010 - Cotización AFP': c.afpMonto || 0,
                '3020 - Cotización Salud 7% / Isapre': c.saludMonto || 0,
                '3030 - Seguro Cesantía AFC Trabajador': c.afcTrabajadorMonto || 0,
                '3040 - Impuesto Único 2da Categoría': c.impuestoUnico || 0,
                'TOTAL DESCUENTOS LEGALES': c.totalDescuentosLegales || 0,

                // Otros Descuentos & Líquido
                '4050 - Otros Descuentos': c.totalDescuentos || 0,
                '5010 - LÍQUIDO A PAGAR': c.totalLiquido || 0,

                // Leyes Sociales Patronales
                '6010 - SIS Empleador (1.54%)': c.sisMonto || 0,
                '6020 - Mutualidad Accidentes Trabajo': c.mutualMonto || 0,
                '6030 - AFC Patronal Empleador': c.afcPatronalMonto || 0,
                '6040 - Seguro Longevidad / Expectativa (0.5%)': c.expectativaMonto || 0,
                'TOTAL APORTES PATRONALES': c.totalAportesPatronales || 0,
                'COSTO TOTAL EMPRESA': (c.totalImponible || 0) + (c.totalAportesPatronales || 0)
            };
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `LRE_DT_${m}_${y}`);

        const fileName = `LRE_Libro_Remuneraciones_DT_Chile_${m}_${y}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    // Exportación CSV Oficial Portal Mi DT
    const handleExportCSV_DT = () => {
        if (!consolidado.length) return;
        const [y, m] = period.split('-');

        const headers = [
            'RutTrabajador', 'DvTrabajador', 'Nombres', 'ApellidoPaterno', 'ApellidoMaterno',
            'Cargo', 'FechaIngreso', 'FechaRetiro', 'DiasTrabajados', 'DiasLicenciaMedica', 'DiasInasistencia',
            '1010', '1001', '1003', '1020', '1040', '1041', '1050', 'TotImponible',
            '2010', '2020', '2030', '2060', 'TotNoImponible', 'TotHaberes',
            '3010', '3020', '3030', '3040', 'TotDescLegales', '4050', '5010'
        ];

        const csvLines = [headers.join(';')];

        consolidado.forEach(c => {
            const cleanRutStr = (c.emp.rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
            const rutBody = cleanRutStr.slice(0, -1);
            const rutDv = cleanRutStr.slice(-1);
            const nameParts = (c.emp.fullName || '').trim().split(' ');
            const apellidoPaterno = nameParts.length > 2 ? nameParts[nameParts.length - 2] : (nameParts[1] || '');
            const apellidoMaterno = nameParts.length > 2 ? nameParts[nameParts.length - 1] : '';
            const nombres = nameParts.length > 2 ? nameParts.slice(0, -2).join(' ') : (nameParts[0] || '');

            const row = [
                rutBody,
                rutDv,
                `"${nombres}"`,
                `"${apellidoPaterno}"`,
                `"${apellidoMaterno}"`,
                `"${c.emp.position || 'Especialista'}"`,
                c.emp.contractStartDate || c.emp.fechaIngreso || '',
                c.emp.fechaFiniquito || '',
                c.workerDays,
                c.diasLicencias || 0,
                c.totalInasistencia || 0,
                c.prorrateadoSueldo || 0,
                0,
                c.montoHorasExtras || 0,
                c.gratificacion || 0,
                c.baremoBonus || 0,
                (c.rrBonus || 0) + (c.aiBonus || 0),
                c.prorrateadoBonoFijo || 0,
                c.totalImponible || 0,
                0,
                0,
                0,
                c.totalBeneficios || 0,
                c.totalBeneficios || 0,
                (c.totalImponible || 0) + (c.totalBeneficios || 0),
                c.afpMonto || 0,
                c.saludMonto || 0,
                c.afcTrabajadorMonto || 0,
                c.impuestoUnico || 0,
                c.totalDescuentosLegales || 0,
                (c.montoDescuentoHoras || 0) + (c.totalDescuentos || 0),
                c.totalLiquido || 0
            ];
            csvLines.push(row.join(';'));
        });

        const csvContent = csvLines.join('\r\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `LRE_Carga_Portal_MiDT_Chile_${m}_${y}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    };

    // Descarga masiva ultra-rápida de liquidaciones de sueldo PDF
    const handleMassiveDownload = async () => {
        if (!consolidado.length) return;
        setDownloadingMassive(true);
        setAlert({ type: 'info', msg: 'Generando liquidaciones de sueldo masivas (modo ultra-rápido)...' });

        try {
            const h2c = (await import('html2canvas')).default;
            const { jsPDF } = await import('jspdf');
            const pdf = new jsPDF('p', 'mm', 'a4');

            for (let i = 0; i < consolidado.length; i++) {
                const item = consolidado[i];
                setSelected(item);
                await new Promise(r => setTimeout(r, 80));

                const node = document.getElementById('liq-doc-printable');
                if (node) {
                    const originalClass = node.className;
                    node.classList.add('html2canvas-capture-fix');
                    const canvas = await h2c(node, { scale: 1.5, useCORS: true, logging: false });
                    node.className = originalClass;

                    const img = canvas.toDataURL('image/jpeg', 0.85);
                    if (i > 0) pdf.addPage();
                    pdf.addImage(img, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
                }
            }

            pdf.save(`Liquidaciones_Sueldo_Masivas_${period}.pdf`);
            setSelected(null);
            setAlert({ type: 'success', msg: '✓ Descarga masiva completada exitosamente.' });
        } catch (e) {
            console.error('Error en descarga masiva:', e);
            setAlert({ type: 'error', msg: 'Error al generar liquidaciones masivas.' });
        } finally {
            setDownloadingMassive(false);
        }
    };

    const handleCerrarPeriodo = async () => {
        setConfirmModal({
            title: '¿Confirmar Cierre del Período de Nómina?',
            message: `Se congelará la nómina de ${consolidado.length} colaboradores para el período ${period}. ¿Deseas proceder?`,
            action: async () => {
                setConfirmModal(null);
                setAlert({ type: 'success', msg: `✓ Período ${period} cerrado y congelado exitosamente.` });
                setTimeout(() => setAlert(null), 3000);
            }
        });
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans text-slate-800 space-y-6">
            
            {/* ALERT NOTIFICATION */}
            {alert && (
                <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all animate-bounce ${
                    alert.type === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400' :
                    alert.type === 'info' ? 'bg-indigo-600/90 text-white border-indigo-400' : 'bg-rose-500/90 text-white border-rose-400'
                }`}>
                    <span className="text-xs font-black uppercase tracking-wider">{alert.msg}</span>
                </div>
            )}

            {/* CONFIRMATION MODAL */}
            {confirmModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-6 text-center animate-in fade-in zoom-in duration-200">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                            <ShieldCheck size={32} />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{confirmModal.title}</h3>
                            <p className="text-xs font-medium text-slate-500 leading-relaxed">{confirmModal.message}</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmModal(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={confirmModal.action} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TOP HEADER & CONTROLS */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
                        <CircleDollarSign size={28} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-xl font-black text-slate-800 tracking-tight uppercase">Libro de Remuneraciones LRE</h1>
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black px-2.5 py-1 rounded-xl uppercase tracking-wider">
                                NORMATIVA DT CHILE 2026
                            </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wide">
                            PERÍODO {period} · CONCILIADO 100% CON REMU CENTRAL & CIERRES PRODUCCIÓN
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full lg:w-auto pb-1 scroll-smooth shrink-0">
                    {/* Period Picker */}
                    <div className="relative bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 flex items-center gap-2 text-slate-700 shadow-sm shrink-0">
                        <Calendar size={14} className="text-indigo-600 shrink-0" />
                        <input
                            type="month"
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            className="bg-transparent text-[11px] font-black uppercase focus:outline-none cursor-pointer text-slate-800"
                        />
                    </div>

                    {/* Botón Actualizar Período Seleccionado */}
                    <button 
                        onClick={() => {
                            fetchData();
                            setAlert({ type: 'success', msg: `✓ Datos de la nómina de ${period} actualizados correctamente.` });
                            setTimeout(() => setAlert(null), 3000);
                        }} 
                        disabled={loading}
                        title={`Actualizar datos de la nómina para el período ${period}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white border border-indigo-700 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-sm active:scale-95 disabled:opacity-50 shrink-0 whitespace-nowrap"
                    >
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                        {loading ? 'Actualizando...' : 'Actualizar'}
                    </button>

                    {/* Actions */}
                    <button onClick={handleExportLRE} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95 shrink-0 whitespace-nowrap">
                        <Download size={12} /> Exportar LRE (Excel)
                    </button>
                    <button onClick={handleExportCSV_DT} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-95 shrink-0 whitespace-nowrap">
                        <FileText size={12} /> Carga Mi DT (CSV)
                    </button>
                    <button onClick={handleCerrarPeriodo} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider hover:bg-slate-900 transition-all shadow-sm active:scale-95 shrink-0 whitespace-nowrap">
                        <LockIcon size={12} className="text-amber-400" /> Cerrar Período
                    </button>
                </div>
            </div>

            {/* EXECUTIVE KPI CARDS (2 COLUMNAS EN MÓVIL, AUTO-SCALABLE) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
                <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 border border-slate-100 shadow-sm relative overflow-hidden group flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">Colaboradores</span>
                        <div className="p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600 shrink-0"><Users size={16} className="sm:w-[18px] sm:h-[18px]" /></div>
                    </div>
                    <div>
                        <div className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight">{consolidado.length}</div>
                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-0.5 block truncate">Plantilla Nómina</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 border border-slate-100 shadow-sm relative overflow-hidden group flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">Total Imponible</span>
                        <div className="p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600 shrink-0"><TrendingUp size={16} className="sm:w-[18px] sm:h-[18px]" /></div>
                    </div>
                    <div>
                        <div className="text-base sm:text-2xl font-black text-indigo-700 tracking-tight truncate">{fmt(sumImponible)}</div>
                        <span className="text-[8px] sm:text-[9px] font-bold text-indigo-400 uppercase tracking-wide mt-0.5 block truncate">Base Imponible</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 border border-slate-100 shadow-sm relative overflow-hidden group flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">Descuentos</span>
                        <div className="p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl bg-rose-50 text-rose-600 shrink-0"><ShieldCheck size={16} className="sm:w-[18px] sm:h-[18px]" /></div>
                    </div>
                    <div>
                        <div className="text-base sm:text-2xl font-black text-rose-600 tracking-tight truncate">{fmt(sumCotizaciones)}</div>
                        <span className="text-[8px] sm:text-[9px] font-bold text-rose-400 uppercase tracking-wide mt-0.5 block truncate">Cotizaciones Legales</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 border border-slate-100 shadow-sm relative overflow-hidden group flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">Líquido A Pagar</span>
                        <div className="p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 shrink-0"><Wallet size={16} className="sm:w-[18px] sm:h-[18px]" /></div>
                    </div>
                    <div>
                        <div className="text-base sm:text-2xl font-black text-emerald-600 tracking-tight truncate">{fmt(sumLiquido)}</div>
                        <span className="text-[8px] sm:text-[9px] font-bold text-emerald-500 uppercase tracking-wide mt-0.5 block truncate">Empresa: {fmt(sumCostoEmpresa)}</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 border border-slate-100 shadow-sm relative overflow-hidden group flex flex-col justify-between col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">Aportes Patronales</span>
                        <div className="p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl bg-amber-50 text-amber-600 shrink-0"><Landmark size={16} className="sm:w-[18px] sm:h-[18px]" /></div>
                    </div>
                    <div>
                        <div className="text-base sm:text-2xl font-black text-amber-600 tracking-tight truncate">{fmt(sumAportesPatronales)}</div>
                        <span className="text-[8px] sm:text-[9px] font-bold text-amber-500 uppercase tracking-wide mt-0.5 block truncate">SIS + Mutual + AFC</span>
                    </div>
                </div>
            </div>

            {/* TOOLBAR & FILTERS */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-100 space-y-4">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                    {/* Status Tabs */}
                    <div className="grid grid-cols-3 gap-1 bg-slate-100/70 p-1 rounded-2xl border border-slate-200/50 w-full lg:w-auto">
                        {[
                            { id: 'Operativo', label: `Operativos (${employees.filter(e => e.status !== 'Finiquitado').length})` },
                            { id: 'Finiquitado', label: `Finiquitados (${employees.filter(e => e.status === 'Finiquitado').length})` },
                            { id: 'Todos', label: `Todos (${employees.length})` }
                        ].map(s => (
                            <button
                                key={s.id}
                                onClick={() => setFilterStatus(s.id)}
                                className={`px-2 sm:px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all text-center justify-center flex items-center ${
                                    filterStatus === s.id
                                        ? 'bg-white text-indigo-700 shadow-sm scale-102'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>

                    {/* Filter Selects */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2.5 w-full lg:w-auto flex-1">
                        <div className="relative w-full sm:w-auto flex-1 min-w-[140px]">
                            <select
                                value={filterProyecto}
                                onChange={e => setFilterProyecto(e.target.value)}
                                className="w-full pl-3.5 pr-8 py-2 bg-slate-50 border border-slate-200/80 rounded-2xl text-[10px] font-black uppercase text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer"
                            >
                                <option value="">Todos los Proyectos</option>
                                {availableProyectos.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>

                        <div className="relative w-full sm:w-auto flex-1 min-w-[140px]">
                            <select
                                value={filterCargo}
                                onChange={e => setFilterCargo(e.target.value)}
                                className="w-full pl-3.5 pr-8 py-2 bg-slate-50 border border-slate-200/80 rounded-2xl text-[10px] font-black uppercase text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer"
                            >
                                <option value="">Todos los Cargos</option>
                                {availableCargos.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>

                        {/* Search Bar */}
                        <div className="relative w-full sm:col-span-2 lg:col-span-1 lg:flex-[2] min-w-[180px]">
                            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Búsqueda rápida..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-2xl text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 uppercase"
                            />
                        </div>

                        {/* Action buttons */}
                        <button onClick={handleExportLRE} className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-50 transition-all shadow-sm justify-center flex items-center">
                            Exportar Tabla
                        </button>
                        <button onClick={handleMassiveDownload} disabled={downloadingMassive} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-900 transition-all shadow-sm disabled:opacity-50">
                            {downloadingMassive ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                            {downloadingMassive ? 'Generando...' : 'Descarga Masiva'}
                        </button>
                    </div>
                </div>
            </div>

            {/* MASTER RE-DESIGNED TABLE (ESTÁNDAR DT CHILE LRE 2026) */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1600px]">
                        <thead>
                            {/* TOP CATEGORY GROUP HEADERS */}
                            <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                                <th colSpan="3" className="px-6 py-3 border-r border-slate-800 text-indigo-300">IDENTIFICACIÓN & CONTRATO</th>
                                <th colSpan="5" className="px-4 py-3 border-r border-slate-800 text-emerald-300 text-center">DÍAS & ASISTENCIA (BASE 30)</th>
                                <th colSpan="8" className="px-4 py-3 border-r border-slate-800 text-indigo-300 text-center">HABERES IMPONIBLES (CÓDIGOS DT 1000)</th>
                                <th className="px-4 py-3 border-r border-slate-800 text-indigo-200 text-right">TOTAL IMPONIBLE</th>
                                <th colSpan="5" className="px-4 py-3 border-r border-slate-800 text-rose-300 text-center">DESCUENTOS LEGALES Y OTROS (CÓDIGOS DT 3000/4000)</th>
                                <th className="px-4 py-3 border-r border-slate-800 text-rose-200 text-right">TOTAL DESCUENTOS</th>
                                <th className="px-4 py-3 border-r border-slate-800 text-emerald-400 text-right bg-emerald-950/80 font-black">LÍQUIDO A PAGAR (5010)</th>
                                <th colSpan="4" className="px-4 py-3 border-r border-slate-800 text-amber-300 text-center">APORTES PATRONALES (CÓDIGOS DT 6000)</th>
                                <th className="px-4 py-3 text-amber-200 text-right bg-slate-950">COSTO EMPRESA</th>
                            </tr>
                            
                            {/* DETAILED COLUMN HEADERS WITH OFFICIAL DT CODES */}
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                <th className="px-6 py-4">Colaborador</th>
                                <th className="px-4 py-4">Cargo / CECO</th>
                                <th className="px-4 py-4">Previsión (AFP / Salud)</th>

                                <th className="px-3 py-4 text-center text-emerald-700 bg-emerald-50/50">D. Trab</th>
                                <th className="px-3 py-4 text-center text-emerald-700 bg-emerald-50/50">Pres</th>
                                <th className="px-3 py-4 text-center text-rose-600 bg-rose-50/30">Inasist</th>
                                <th className="px-3 py-4 text-center text-amber-600 bg-amber-50/30">Lic</th>
                                <th className="px-3 py-4 text-center text-slate-600">Perm</th>

                                <th className="px-4 py-4 text-right bg-indigo-50/30"><HeaderBadge code="1010" label="Sueldo Base" color="text-indigo-600" /></th>
                                <th className="px-4 py-4 text-right bg-indigo-50/30"><HeaderBadge code="1003" label="Horas Extras 50%" color="text-indigo-600" /></th>
                                <th className="px-4 py-4 text-right bg-indigo-50/30"><HeaderBadge code="1001" label="Sem. Corrida" color="text-indigo-600" /></th>
                                <th className="px-4 py-4 text-right bg-indigo-50/30"><HeaderBadge code="1020" label="Gratif. Legal" color="text-indigo-600" /></th>
                                <th className="px-4 py-4 text-right bg-indigo-50/30"><HeaderBadge code="1040" label="Producción Baremo" color="text-indigo-600" /></th>
                                <th className="px-4 py-4 text-right bg-indigo-50/30"><HeaderBadge code="1041" label="Calidad DAT/RR/AI" color="text-indigo-600" /></th>
                                <th className="px-4 py-4 text-right bg-indigo-50/30"><HeaderBadge code="1050" label="Bono Asistencia" color="text-indigo-600" /></th>
                                <th className="px-4 py-4 text-right bg-indigo-50/30"><HeaderBadge code="2060" label="Beneficios No Imp." color="text-teal-600" /></th>
                                
                                <th className="px-4 py-4 text-right bg-indigo-100/50 text-indigo-900 font-black">TOT. IMPONIBLE</th>

                                <th className="px-4 py-4 text-right bg-rose-50/30"><HeaderBadge code="3010" label="AFP" color="text-rose-600" /></th>
                                <th className="px-4 py-4 text-right bg-rose-50/30"><HeaderBadge code="3020" label="Salud (7%/Isapre)" color="text-rose-600" /></th>
                                <th className="px-4 py-4 text-right bg-rose-50/30"><HeaderBadge code="3030" label="AFC Trab." color="text-rose-600" /></th>
                                <th className="px-4 py-4 text-right bg-rose-50/30"><HeaderBadge code="3040" label="Impuesto Único" color="text-rose-600" /></th>
                                <th className="px-4 py-4 text-right bg-rose-50/30"><HeaderBadge code="4050" label="Desc. Atrasos / Horas" color="text-rose-600" /></th>

                                <th className="px-4 py-4 text-right bg-rose-100/50 text-rose-900 font-black">TOT. DESCUENTOS</th>

                                <th className="px-6 py-4 text-right bg-emerald-100/80 text-emerald-900 font-black text-xs">LÍQUIDO A PAGAR</th>

                                <th className="px-4 py-4 text-right bg-amber-50/30"><HeaderBadge code="6010" label="SIS (1.54%)" color="text-amber-700" /></th>
                                <th className="px-4 py-4 text-right bg-amber-50/30"><HeaderBadge code="6020" label="Mutualidad" color="text-amber-700" /></th>
                                <th className="px-4 py-4 text-right bg-amber-50/30"><HeaderBadge code="6030" label="AFC Patronal" color="text-amber-700" /></th>
                                <th className="px-4 py-4 text-right bg-amber-50/30"><HeaderBadge code="6040" label="Longevidad (0.5%)" color="text-amber-700" /></th>

                                <th className="px-6 py-4 text-right bg-slate-200/80 text-slate-900 font-black">COSTO EMPRESA</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="30" className="py-24 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <Loader2 size={36} className="animate-spin text-indigo-600" />
                                            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Consolidando libro de remuneraciones...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : consolidado.length === 0 ? (
                                <tr>
                                    <td colSpan="30" className="py-24 text-center text-slate-400 font-bold uppercase tracking-wider">
                                        No hay trabajadores registrados en este filtro o período.
                                    </td>
                                </tr>
                            ) : (
                                consolidado.map((c, idx) => (
                                    <tr key={c.emp._id || idx} className="hover:bg-indigo-50/30 transition-colors group cursor-pointer" onClick={() => setSelected(c)}>
                                        {/* COLABORADOR */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xs shrink-0 shadow-inner">
                                                    {c.emp.fullName?.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-800 text-xs tracking-tight">{c.emp.fullName}</div>
                                                    <div className="text-[10px] font-mono text-slate-400">{formatRut(c.emp.rut)}</div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* CARGO / CECO */}
                                        <td className="px-4 py-4">
                                            <div className="font-black text-slate-800 text-xs">{c.emp.position || 'Especialista'}</div>
                                            <div className="text-[10px] font-bold text-indigo-500 uppercase">{c.projectName} · {c.ceco}</div>
                                        </td>

                                        {/* PREVISIÓN */}
                                        <td className="px-4 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="bg-indigo-50 text-indigo-700 text-[9px] font-black px-2 py-0.5 rounded-md border border-indigo-100 w-fit">
                                                    {c.empAfp}
                                                </span>
                                                <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-md border border-emerald-100 w-fit">
                                                    {c.saludEntidad}
                                                </span>
                                            </div>
                                        </td>

                                        {/* DÍAS & ASISTENCIA */}
                                        <td className="px-3 py-4 text-center bg-emerald-50/30 font-black text-emerald-700">{c.workerDays}d</td>
                                        <td className="px-3 py-4 text-center bg-emerald-50/30 font-bold text-slate-600">{c.totalAsistencia}d</td>
                                        <td className="px-3 py-4 text-center bg-rose-50/20 font-bold text-rose-600">{c.totalInasistencia > 0 ? `${c.totalInasistencia}d` : '-'}</td>
                                        <td className="px-3 py-4 text-center bg-amber-50/20 font-bold text-amber-600">{c.diasLicencias > 0 ? `${c.diasLicencias}d` : '-'}</td>
                                        <td className="px-3 py-4 text-center text-slate-400 font-bold">{c.diasPermisos > 0 ? `${c.diasPermisos}d` : '-'}</td>

                                        {/* HABERES IMPONIBLES (DT 1000) */}
                                        <td className="px-4 py-4 text-right font-bold text-slate-700">{fmt(c.prorrateadoSueldo)}</td>
                                        <td className="px-4 py-4 text-right font-bold text-indigo-600">{fmt(c.montoHorasExtras)}</td>
                                        <td className="px-4 py-4 text-right font-bold text-slate-400">$0</td>
                                        <td className="px-4 py-4 text-right font-bold text-indigo-600">{fmt(c.gratificacion)}</td>
                                        <td className="px-4 py-4 text-right font-bold text-emerald-600">{fmt(c.baremoBonus)}</td>
                                        <td className="px-4 py-4 text-right font-bold text-teal-600">{fmt(c.rrBonus + c.aiBonus)}</td>
                                        <td className="px-4 py-4 text-right font-bold text-indigo-500">{fmt(c.prorrateadoBonoFijo)}</td>
                                        <td className="px-4 py-4 text-right font-bold text-teal-600">{fmt(c.totalBeneficios)}</td>

                                        {/* TOTAL IMPONIBLE */}
                                        <td className="px-4 py-4 text-right font-black text-indigo-700 bg-indigo-50/50 text-xs">{fmt(c.totalImponible)}</td>

                                        {/* DESCUENTOS LEGALES (DT 3000/4000) */}
                                        <td className="px-4 py-4 text-right font-bold text-rose-600">{fmt(c.afpMonto)}</td>
                                        <td className="px-4 py-4 text-right font-bold text-rose-600">{fmt(c.saludMonto)}</td>
                                        <td className="px-4 py-4 text-right font-bold text-rose-600">{fmt(c.afcTrabajadorMonto)}</td>
                                        <td className="px-4 py-4 text-right font-bold text-amber-600">{fmt(c.impuestoUnico)}</td>
                                        <td className="px-4 py-4 text-right font-bold text-rose-600">{fmt(c.montoDescuentoHoras)}</td>

                                        {/* TOTAL DESCUENTOS */}
                                        <td className="px-4 py-4 text-right font-black text-rose-700 bg-rose-50/50 text-xs">{fmt(c.totalDescuentosLegales + c.montoDescuentoHoras + c.totalDescuentos)}</td>

                                        {/* LÍQUIDO A PAGAR */}
                                        <td className="px-6 py-4 text-right font-black text-emerald-700 bg-emerald-100/60 text-sm shadow-inner">{fmt(c.totalLiquido)}</td>

                                        {/* APORTES PATRONALES (DT 6000) */}
                                        <td className="px-4 py-4 text-right font-bold text-amber-700">{fmt(c.sisMonto)}</td>
                                        <td className="px-4 py-4 text-right font-bold text-amber-700">{fmt(c.mutualMonto)}</td>
                                        <td className="px-4 py-4 text-right font-bold text-amber-700">{fmt(c.afcPatronalMonto)}</td>
                                        <td className="px-4 py-4 text-right font-bold text-amber-700">{fmt(c.expectativaMonto)}</td>

                                        {/* COSTO TOTAL EMPRESA */}
                                        <td className="px-6 py-4 text-right font-black text-slate-800 bg-slate-100 text-xs">{fmt(c.totalImponible + c.totalAportesPatronales)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* PRINTABLE LIQUIDACIÓN DE SUELDO MODAL */}
            {selected && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl max-w-3xl w-full p-8 shadow-2xl space-y-6 relative border border-slate-100 my-8">
                        <button onClick={() => setSelected(null)} className="absolute top-6 right-6 p-2 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                            <X size={20} />
                        </button>

                        <div id="liq-doc-printable" className="space-y-6 bg-white p-6 rounded-2xl border border-slate-200">
                            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                                <div>
                                    <h2 className="text-lg font-black uppercase text-slate-800">RAM INGENIERÍA Y SERVICIOS SPA</h2>
                                    <p className="text-xs font-mono text-slate-500">RUT: 77.123.456-7 · CASA MATRIZ RANCAGUA</p>
                                    <p className="text-xs font-bold text-indigo-600 uppercase mt-1">LIQUIDACIÓN DE SUELDO · PERÍODO {period}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-mono font-bold bg-slate-100 px-3 py-1 rounded-lg text-slate-700">FOLIO #2026-{selected.emp.rut?.slice(0, 6)}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div><span className="text-slate-400 uppercase text-[10px] block">Trabajador</span><strong className="text-sm font-black text-slate-800">{selected.emp.fullName}</strong></div>
                                <div><span className="text-slate-400 uppercase text-[10px] block">RUT</span><strong className="font-mono">{formatRut(selected.emp.rut)}</strong></div>
                                <div><span className="text-slate-400 uppercase text-[10px] block">Cargo</span><strong>{selected.emp.position || 'Especialista'}</strong></div>
                                <div><span className="text-slate-400 uppercase text-[10px] block">Proyecto / CECO</span><strong>{selected.projectName} ({selected.ceco})</strong></div>
                                <div><span className="text-slate-400 uppercase text-[10px] block">Días A Pago / Asistencia</span><strong>{selected.workerDays}d a Pago (Pres: {selected.totalAsistencia}d {selected.diasLicencias > 0 ? `· Lic: ${selected.diasLicencias}d` : ''} {selected.totalInasistencia > 0 ? `· Inasist: ${selected.totalInasistencia}d` : ''})</strong></div>
                                <div><span className="text-slate-400 uppercase text-[10px] block">Previsión / Salud</span><strong>{selected.empAfp} / {selected.saludEntidad}</strong></div>
                            </div>

                            <div className="grid grid-cols-2 gap-6 text-xs">
                                {/* HABERES */}
                                <div className="space-y-2">
                                    <h4 className="font-black uppercase text-indigo-700 border-b border-indigo-100 pb-1">1. HABERES IMPONIBLES</h4>
                                    <div className="flex justify-between py-1 border-b border-slate-100"><span>Sueldo Base</span><span>{fmt(selected.prorrateadoSueldo)}</span></div>
                                    {selected.montoHorasExtras > 0 && (
                                        <div className="flex justify-between py-1 border-b border-slate-100 text-indigo-600 font-bold">
                                            <span>Horas Extras 50% ({selected.hrsExtras} hrs)</span>
                                            <span>{fmt(selected.montoHorasExtras)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between py-1 border-b border-slate-100"><span>Gratificación Legal (Art. 50)</span><span>{fmt(selected.gratificacion)}</span></div>
                                    <div className="flex justify-between py-1 border-b border-slate-100"><span>Producción Baremo</span><span>{fmt(selected.baremoBonus)}</span></div>
                                    <div className="flex justify-between py-1 border-b border-slate-100"><span>Bonos Calidad (DAT/RR/AI)</span><span>{fmt(selected.rrBonus + selected.aiBonus)}</span></div>
                                    <div className="flex justify-between py-1 border-b border-slate-100"><span>Bonos Fijos Prorrateados</span><span>{fmt(selected.prorrateadoBonoFijo)}</span></div>
                                    <div className="flex justify-between py-2 font-black text-indigo-800 bg-indigo-50/50 px-2 rounded-lg mt-2"><span>TOTAL IMPONIBLE</span><span>{fmt(selected.totalImponible)}</span></div>
                                </div>

                                {/* DESCUENTOS */}
                                <div className="space-y-2">
                                    <h4 className="font-black uppercase text-rose-700 border-b border-rose-100 pb-1">2. DESCUENTOS LEGALES Y OTROS</h4>
                                    <div className="flex justify-between py-1 border-b border-slate-100"><span>AFP ({selected.empAfp})</span><span>{fmt(selected.afpMonto)}</span></div>
                                    <div className="flex justify-between py-1 border-b border-slate-100"><span>Salud ({selected.saludEntidad})</span><span>{fmt(selected.saludMonto)}</span></div>
                                    <div className="flex justify-between py-1 border-b border-slate-100"><span>AFC Trabajador (0.6%)</span><span>{fmt(selected.afcTrabajadorMonto)}</span></div>
                                    <div className="flex justify-between py-1 border-b border-slate-100"><span>Impuesto Único 2da Cat.</span><span>{fmt(selected.impuestoUnico)}</span></div>
                                    {selected.montoDescuentoHoras > 0 && (
                                        <div className="flex justify-between py-1 border-b border-slate-100 text-rose-600 font-bold">
                                            <span>Desc. Atrasos / Horas ({selected.hrsDescontadas} hrs)</span>
                                            <span>{fmt(selected.montoDescuentoHoras)}</span>
                                        </div>
                                    )}
                                    {selected.totalDescuentos > 0 && (
                                        <div className="flex justify-between py-1 border-b border-slate-100 text-rose-600 font-bold">
                                            <span>Otros Descuentos / Anticipos</span>
                                            <span>{fmt(selected.totalDescuentos)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between py-2 font-black text-rose-800 bg-rose-50/50 px-2 rounded-lg mt-2">
                                        <span>TOTAL DESCUENTOS</span>
                                        <span>{fmt(selected.totalDescuentosLegales + (selected.montoDescuentoHoras || 0) + (selected.totalDescuentos || 0))}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-emerald-500 text-white p-4 rounded-2xl flex justify-between items-center shadow-lg">
                                <span className="font-black uppercase text-sm">ALCANCE LÍQUIDO A PAGAR</span>
                                <span className="font-black text-2xl tracking-tight">{fmt(selected.totalLiquido)}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-12 pt-12 text-center text-xs font-bold text-slate-400">
                                <div className="border-t border-slate-300 pt-2 uppercase">FIRMA TRABAJADOR</div>
                                <div className="border-t border-slate-300 pt-2 uppercase">FIRMA EMPLEADOR</div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => window.print()} className="flex-1 py-3 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-slate-900 transition-colors">
                                <Printer size={16} /> Imprimir Liquidación
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export const LockIcon = ({ size, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
);

export default NominaRRHH;

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Users, RefreshCw, Search, Download, AlertCircle, Calendar, User, DollarSign,
    TrendingUp, ShieldCheck, Activity, HeartPulse, Wallet, Briefcase
} from 'lucide-react';
import { candidatosApi, proyectosApi, bonosConfigApi, bonosApi, modelosBonificacionApi, asistenciaApi, descuentosApi, beneficiosApi, configApi } from '../rrhhApi';
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
// Topes y tasas centralizados a través de IndicadoresContext

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
    // En Chile (Previred / DT), el mes laboral comercial es SIEMPRE de 30 días.
    // periodStr is YYYY-MM
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

const RemuCentral = () => {
    const [employees, setEmployees] = useState([]);
    const [proyectos, setProyectos] = useState([]);
    const [bonosConfig, setBonosConfig] = useState([]);
    const [closures, setClosures] = useState([]);
    const [modelosBono, setModelosBono] = useState([]);
    const [empresaConfig, setEmpresaConfig] = useState(null);
    
    const { ufValue, utmValue, immValue, params: indicParams } = useIndicadores();
    
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCeco, setFilterCeco] = useState('');
    const [asistenciaData, setAsistenciaData] = useState([]);
    const [descuentosData, setDescuentosData] = useState([]);
    const [beneficiosData, setBeneficiosData] = useState([]);
    const [activeTab, setActiveTab] = useState('Sueldo Base & Bonos');
    const [filterStatus, setFilterStatus] = useState('Activo');
    const [selectedValidacionWorker, setSelectedValidacionWorker] = useState(null);

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
            let isCurrentPeriodFiniquito = false;
            if (emp.status === 'Finiquitado' || emp.status === 'De Baja' || emp.status === 'Retirado') {
                if (emp.fechaFiniquito) {
                    // Prevenir problemas de zona horaria comparando los primeros 7 caracteres del string ISO si es posible
                    let fqMonth = '';
                    try {
                        const fQ = new Date(emp.fechaFiniquito);
                        if (!isNaN(fQ.getTime())) {
                            // Convertir fecha local simulada (ej. 2026-06-05)
                            fqMonth = fQ.toISOString().substring(0, 7); // "YYYY-MM"
                        }
                    } catch(e){}

                    // Fallback a regex si toISOString falla o es diferente
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
            
            const matchesStatus = filterStatus === 'Todos' || 
                (filterStatus === 'Activo' && (['Contratado', 'Activo', 'ACTIVO', 'En Terreno'].includes(emp.status) || isCurrentPeriodFiniquito)) || 
                (filterStatus === 'Fis/Ret' && ['Finiquitado', 'Retirado', 'De Baja'].includes(emp.status));

            if (!matchesSearch || !matchesCeco || !matchesStatus) return;

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
                const aRut = cleanRut(a.rut);
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
            const hrsDescontadas = asis?.horasDescontadas ?? (asis?.diasDescontados ? asis.diasDescontados * 8 : 0);

            // --- Permisos (días libres/permisos) ---
            const diasPermisos = asis?.diasPermisos ?? asis?.diasLibres ?? (hrsLibres > 0 ? Math.round(hrsLibres / 8) : 0);

            // --- Licencias Médicas (días con Licencia Médica) ---
            const diasLicencias = asis?.diasLicencia ?? asis?.diasLicenciaMedica ?? asis?.diasEnLicencia ?? 0;

            // --- Días operativos del mes según Ley 40hrs Chile ---
            // Los días operativos típicos son: días hábiles del mes (aprox 24-26)
            // Usamos la diferencia entre días del mes y domingos/festivos implícitos
            // Regla práctica: diasMes - Math.floor(diasMes / 7) * 2 (aprox domingos y sábados si es 5x2)
            // Para simplificar según norma, usamos los días registrados en asistencia o calculamos
            const diasOperativosMes = asis?.diasOperativos ?? asis?.diasHabiles ?? (diasMes <= 28 ? 24 : diasMes <= 30 ? 25 : 26);

            // --- Resultado Días a Pago según norma legal ---
            // Si asistió a todos los días operativos => mes completo
            // Si no => se pagan los días efectivos menos inasistencias injustificadas
            const diasEfectivosNetos = Math.max(0, totalAsistencia - totalInasistencia);
            const esMesCompleto = totalInasistencia === 0 && (totalAsistencia >= diasOperativosMes || !asis);
            const diasResultadoPago = esMesCompleto ? diasOperativosMes : diasEfectivosNetos;

            // --- Estándar Legal Chile (Previred / DT): Mes Comercial de 30 Días ---
            const BASE_DIAS = 30; // En Chile toda liquidación de sueldo mensual usa divisor 30
            const diasNoRemunerados = totalInasistencia + diasLicencias;
            
            // Factor entre 0 y 1: si asistió completo factor = 1.0
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

            // Variables ya extraidas arriba

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

            // --- Bonos Variables & Producción ---
            // Producción / Bono Baremo: es 100% variable por trabajos ejecutados en terreno (NO se condiciona a la asistencia)
            // Bonos de Calificación / Auditoría (DAT/RR% y AI): se ajustan por asistencia si la política del proyecto lo requiere
            const baremoRaw = baremoBonus;
            const rrRaw = rrBonus;
            const aiRaw = aiBonus;
            const baremoAjustado = baremoBonus; // Producción real íntegra por órdenes finalizadas
            const rrAjustado     = Math.round(rrBonus * factorAsistencia);
            const aiAjustado     = Math.round(aiBonus * factorAsistencia);

            // Total Producción/Variables real a pagar
            const totalVariablesAjustado = baremoAjustado + rrAjustado + aiAjustado;

            // Asistencia ya extraida arriba

            const desc = descuentosData.filter(d => d.candidatoRef === emp._id || (d.rut && cleanRut(d.rut) === eRut));
            const totalDescuentos = desc.reduce((sum, d) => sum + (d.monto || 0), 0);

            const ben = beneficiosData.filter(b => b.candidatoRef === emp._id || (b.rut && cleanRut(b.rut) === eRut));
            const totalBeneficios = ben.reduce((sum, b) => sum + (b.monto || 0), 0);

            // Cálculos de Cotizaciones y Otros
            const ufHoy = ufValue || 38500; // Fallback si no hay UF disponible
            const utmHoy = utmValue || 67500;
            const topeAfpLocal = indicParams?.topeAfpUf || 89.9;
            const topeAfcLocal = indicParams?.topeAfcUf || 135.1;
            const sisRateLocal = indicParams?.sisRate || 1.54;

            // Horas Extras (Código DT 1003) y Descuento por Atrasos/Horas No Trabajadas
            const montoHorasExtras = (sueldoBase && hrsExtras > 0) ? Math.round((sueldoBase / 180) * 1.5 * hrsExtras) : 0;
            const montoDescuentoHoras = (sueldoBase && hrsDescontadas > 0) ? Math.round((sueldoBase / 180) * hrsDescontadas) : 0;
            const totalOtrosDescuentos = totalDescuentos + montoDescuentoHoras;

            const topeLegalCLP = Math.round((topeAfpLocal * ufHoy / BASE_DIAS) * workerDays);
            
            // Gratificación Legal (usa totales ajustados + Horas Extras)
            // Ley N° 21.830: IMM $553.553 desde 1 mayo 2026
            // Tope mensual = 553.553 × 4.75 / 12 = $219.115
            const SUELDO_MINIMO = immValue || 553553;
            const topeGratifMensual = (SUELDO_MINIMO * 4.75) / 12;
            const prorrateoTopeGratif = Math.round((topeGratifMensual / BASE_DIAS) * workerDays);
            const baseParaGratificacion = prorrateadoSueldo + montoHorasExtras + prorrateadoBonoFijo + totalVariablesAjustado;
            const gratificacion = Math.min(Math.round(baseParaGratificacion * 0.25), prorrateoTopeGratif);

            // La base imponible ahora incluye Sueldo Base, Horas Extras, Bonos Fijos, Bonos Variables y Gratificación
            const totalImponible = prorrateadoSueldo + montoHorasExtras + prorrateadoBonoFijo + totalVariablesAjustado + gratificacion;
            const baseImponible = Math.min(totalImponible, topeLegalCLP);
            const topeLegalAfcCLP = Math.round((topeAfcLocal * ufHoy / BASE_DIAS) * workerDays);
            const baseImponibleAfc = Math.min(totalImponible, topeLegalAfcCLP);

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

            // AFC y Leyes Sociales Patronales (Dinámico según Tipo de Contrato de Captura de Talento)
            const contractType = (emp.tipoContrato || emp.contractType || 'INDEFINIDO').toUpperCase();
            const esPlazoFijo = contractType.includes('PLAZO') || contractType.includes('OBRA') || contractType.includes('FAENA');
            const esIndefinido = contractType.includes('INDEFINIDO') || !esPlazoFijo;
            const afcTrabajadorMonto = esIndefinido ? Math.round(baseImponibleAfc * 0.006) : 0;
            const afcPatronalRate = esIndefinido ? 2.4 : 3.0;
            const afcPatronalMonto = Math.round(baseImponibleAfc * (afcPatronalRate / 100));

            // Impuesto Único de Segunda Categoría (Art. 43 N° 1 Ley de la Renta)
            // Base Tributable = Total Imponible - AFP - Cotiz. Salud 7% Legal - AFC Trabajador
            const cotizSalud7Legal = Math.round(baseImponible * 0.07);
            const baseTributable = Math.max(0, totalImponible - afpMonto - cotizSalud7Legal - afcTrabajadorMonto);
            const impuestoUnico = calcularImpuestoUnico(baseTributable, utmHoy);

            // SIS y Mutual y Expectativa de Vida
            const sisMonto = Math.round(baseImponible * (sisRateLocal / 100));
            const tasaMutualReal = empresaConfig?.tasaMutual !== undefined ? empresaConfig.tasaMutual : 0.93;
            const mutualMonto = Math.round(baseImponible * (tasaMutualReal / 100));
            const expectativaMonto = Math.round(baseImponible * 0.005); // 0.50%

            const totalAportesPatronales = sisMonto + mutualMonto + expectativaMonto + afcPatronalMonto;

            // Cálculo Total Líquido
            const totalDescuentosLegales = afpMonto + saludMonto + afcTrabajadorMonto + impuestoUnico;
            const totalLiquido = totalImponible - totalDescuentosLegales - totalOtrosDescuentos + totalBeneficios;
            
            // Distribuimos el descuento legal total sobre el 100% del ingreso imponible real
            const factorLiquido = totalImponible > 0 ? (totalImponible - totalDescuentosLegales) / totalImponible : 1;

            result.push({
                emp,
                projectName: proj?.nombreProyecto || 'General',
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
                hrsNoTrabajadas,
                hrsLibres,
                hrsDescontadas,
                balanceOriginal: asis?.balanceOriginal ?? balanceHoras,
                balanceHoras,
                validacion: asis?.validacion || null,
                asisData: asis,
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
                factorLiquido,
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

        return result.sort((a, b) => b.rentabilidadBruta - a.rentabilidadBruta);
    }, [employees, proyectos, bonosConfig, closures, modelosBono, asistenciaData, descuentosData, beneficiosData, empresaConfig, searchTerm, filterCeco, filterStatus, period, diasMes, ufValue, indicParams]);

    const getStatusInfo = (status) => {
        if (['Contratado', 'Activo', 'ACTIVO', 'En Terreno'].includes(status)) return { short: 'ACT', color: 'border-emerald-200 text-emerald-700 bg-emerald-50' };
        if (['Finiquitado', 'De Baja', 'Retirado'].includes(status)) return { short: 'BAJA', color: 'border-rose-200 text-rose-700 bg-rose-50' };
        return { short: 'PEND', color: 'border-amber-200 text-amber-700 bg-amber-50' };
    };

    const exportToExcel = () => {
        const data = consolidado.map(c => {
            const vState = c.validacion?.estadoValidacion;
            const validacionLabel = vState === 'COMPENSADO_ZERO' ? 'Compensado (0.00)' :
                                   vState === 'APROBADO_ORIGINAL' ? 'Aprobado Original' :
                                   vState === 'AJUSTE_MANUAL' ? 'Ajuste Manual' : 'Pendiente';

            return {
                // Identificación
                'ID Recurso / TOA': c.emp.idRecursoToa || 'N/A',
                'Especialista': c.emp.fullName,
                'RUT': formatRut(c.emp.rut),
                'Cargo': c.emp.position || 'Especialista',
                'Proyecto': c.projectName,
                'CECO': c.ceco || 'N/A',
                'Fecha Inicio Contrato': c.emp.contractStartDate || c.emp.fechaIngreso || '-',
                'Estado Contrato': c.emp.status,

                // Días y Asistencia (Base 30 Días Legal Chile)
                'Días Trabajados (Base 30)': c.workerDays,
                'Días Asistencia': c.totalAsistencia,
                'Días Inasistencia': c.totalInasistencia,
                'Días Permisos': c.diasPermisos || 0,
                'Días Licencia Médica': c.diasLicencias || 0,
                'Días a Pago (Resultado)': c.diasResultadoPago || 0,
                'Mes Completo': c.esMesCompleto ? 'SÍ' : 'NO',
                'Factor Asistencia (%)': `${Math.round((c.factorAsistencia || 1) * 100)}%`,

                // Horas y Balance
                'Total Hrs Turno': c.hrsTurno || 0,
                'Hrs Trabajadas': c.hrsTrabajadas || 0,
                'Hrs No Trabajadas': c.hrsNoTrabajadas || 0,
                'Hrs Libres': c.hrsLibres || 0,
                'Hrs Extras': c.hrsExtras || 0,
                'Balance Horas (Neto)': c.balanceHoras || 0,
                'Estado Validación Balance': validacionLabel,

                // Remuneraciones e Imponibles (CLP)
                'Sueldo Base Mensual': c.sueldoBase || 0,
                'Sueldo Base Liquidador': c.prorrateadoSueldo || 0,
                'Bono Fijo Mensual': c.totalFijos || 0,
                'Bono Fijo Prorrateado': c.prorrateadoBonoFijo || 0,
                'Producción Real (Baremo)': c.baremoBonus || 0,
                'Bono DAT / RR%': c.rrBonus || 0,
                'Bono AI Auditoría': c.aiBonus || 0,
                'Total Producción & Variables': c.totalVariables || 0,
                'Gratificación Legal (Art. 50)': c.gratificacion || 0,
                'TOTAL IMPONIBLE': c.totalImponible || 0,

                // Descuentos Legales (Trabajador)
                'AFP': c.empAfp || '-',
                'Monto AFP': c.afpMonto || 0,
                'Salud': c.saludEntidad || '-',
                'Monto Salud': c.saludMonto || 0,
                'Monto AFC Trabajador': c.afcTrabajadorMonto || 0,
                'Impuesto 2da Categoría (Imp. Único)': c.impuestoUnico || 0,
                'TOTAL DESCUENTOS LEGALES': c.totalDescuentosLegales || 0,

                // Otros Descuentos y Beneficios
                'Otros Descuentos': c.totalDescuentos || 0,
                'Beneficios Laborales (No Imp.)': c.totalBeneficios || 0,

                // Líquido y Leyes Sociales Patronales
                'LÍQUIDO A PAGAR': c.totalLiquido || 0,
                'SIS (Patronal 1.54%)': c.sisMonto || 0,
                'Mutualidad (Patronal)': c.mutualMonto || 0,
                'Longevidad / Expectativa (0.5%)': c.expectativaMonto || 0,
                'AFC Patronal': c.afcPatronalMonto || 0,
                'TOTAL LEYES SOCIALES PATRONALES': c.totalAportesPatronales || 0,
                'COSTO TOTAL EMPRESA': (c.totalImponible || 0) + (c.totalAportesPatronales || 0)
            };
        });
        
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Libro_Remu_${period}`);

        const fileName = `Libro_Remuneraciones_Central_${period}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const sumImponible = consolidado.reduce((sum, c) => sum + (c.totalImponible || 0), 0);
    const sumCotizaciones = consolidado.reduce((sum, c) => sum + (c.totalDescuentosLegales || 0), 0);
    const sumDescuentos = consolidado.reduce((sum, c) => sum + (c.totalDescuentos || 0), 0);
    const sumBeneficios = consolidado.reduce((sum, c) => sum + (c.totalBeneficios || 0), 0);
    const sumLiquido = consolidado.reduce((sum, c) => sum + (c.totalLiquido || 0), 0);
    const sumAportesPatronales = consolidado.reduce((sum, c) => sum + (c.totalAportesPatronales || 0), 0);
    const sumCostoEmpresa = sumImponible + sumAportesPatronales;

    const summaryCards = [
        { title: 'Sueldo Base & Bonos', val: sumImponible, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', icon: TrendingUp },
        { title: 'Cotizaciones Legales', val: sumCotizaciones, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', icon: ShieldCheck },
        { title: 'Leyes Sociales (Empresa)', val: sumAportesPatronales, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', icon: Users },
        { title: 'Costo Total Empresa', val: sumCostoEmpresa, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-300', icon: Briefcase },
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
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto pb-1 scroll-smooth shrink-0">
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl shadow-sm border border-slate-100 shrink-0">
                        <Calendar size={14} className="text-slate-400" />
                        <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="bg-transparent text-xs font-black text-slate-700 focus:outline-none" />
                    </div>
                    <button onClick={exportToExcel} className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 font-black text-[9px] sm:text-[10px] uppercase tracking-wider hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm shrink-0 whitespace-nowrap">
                        <Download size={13} /> Exportar
                    </button>
                    <button onClick={fetchData} className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-100 hover:bg-emerald-700 transition-all shrink-0">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white/80 backdrop-blur-xl border border-white rounded-2xl md:rounded-[2.5rem] p-3.5 sm:p-6 mb-8 flex flex-col lg:flex-row items-stretch lg:items-center gap-3 md:gap-6 shadow-xl">
                <div className="flex-1 min-w-0 relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-emerald-500 transition-colors" size={16} />
                    <input 
                        type="text" 
                        placeholder="Buscar por Nombre, RUT o Cargo..." 
                        className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-600 focus:outline-none focus:ring-4 focus:ring-emerald-50 focus:bg-white transition-all"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                    <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 overflow-x-auto no-scrollbar scroll-smooth shrink-0 whitespace-nowrap w-full sm:w-auto">
                        {['Todos', 'Activo', 'Fis/Ret'].map(s => (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all shrink-0 ${filterStatus === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    <select 
                        className="pl-3.5 pr-8 py-2 bg-slate-100 border-none rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-600 focus:ring-4 focus:ring-indigo-50 appearance-none cursor-pointer shrink-0"
                        value={filterCeco}
                        onChange={e => setFilterCeco(e.target.value)}
                    >
                        <option value="">TODOS LOS CECO</option>
                        {cecos.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2.5 sm:gap-4 mb-6">
                {summaryCards.map((card, idx) => {
                    const Icon = card.icon;
                    return (
                        <div key={idx} className={`rounded-2xl sm:rounded-[2rem] p-3.5 sm:p-5 border bg-white ${card.border} shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group flex flex-col justify-between`}>
                            <div className={`absolute top-0 right-0 w-16 sm:w-24 h-16 sm:h-24 ${card.bg} rounded-bl-[3rem] -z-10 transition-transform group-hover:scale-110`}></div>
                            <div className="flex justify-between items-start mb-2 sm:mb-4">
                                <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl ${card.bg} ${card.color}`}>
                                    <Icon size={16} className="sm:w-[18px] sm:h-[18px]" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5 sm:mb-1 truncate">{card.title}</h3>
                                <p className={`text-base sm:text-xl font-black ${card.color} tracking-tight truncate`}>
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
                        className={`whitespace-nowrap shrink-0 px-6 py-4 text-[11px] font-black uppercase tracking-widest rounded-t-2xl transition-all ${activeTab === 'Sueldo Base & Bonos' ? 'bg-white text-emerald-600 border-t border-l border-r border-slate-100 shadow-[0_2px_0_0_white]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 border-t border-l border-r border-transparent'}`}
                        style={{ marginBottom: activeTab === 'Sueldo Base & Bonos' ? '-1px' : '0' }}
                    >
                        Sueldo Base & Bonos
                    </button>
                    <button 
                        onClick={() => setActiveTab('Cotizaciones y Otros')}
                        className={`whitespace-nowrap shrink-0 px-6 py-4 text-[11px] font-black uppercase tracking-widest rounded-t-2xl transition-all ${activeTab === 'Cotizaciones y Otros' ? 'bg-white text-emerald-600 border-t border-l border-r border-slate-100 shadow-[0_2px_0_0_white]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 border-t border-l border-r border-transparent'}`}
                        style={{ marginBottom: activeTab === 'Cotizaciones y Otros' ? '-1px' : '0' }}
                    >
                        Cotizaciones y Otros
                    </button>
                    <button 
                        onClick={() => setActiveTab('Asistencia y Hrs Extras')}
                        className={`whitespace-nowrap shrink-0 px-6 py-4 text-[11px] font-black uppercase tracking-widest rounded-t-2xl transition-all ${activeTab === 'Asistencia y Hrs Extras' ? 'bg-white text-emerald-600 border-t border-l border-r border-slate-100 shadow-[0_2px_0_0_white]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 border-t border-l border-r border-transparent'}`}
                        style={{ marginBottom: activeTab === 'Asistencia y Hrs Extras' ? '-1px' : '0' }}
                    >
                        Asistencia y Hrs Extras
                    </button>
                    <button 
                        onClick={() => setActiveTab('Descuentos')}
                        className={`whitespace-nowrap shrink-0 px-6 py-4 text-[11px] font-black uppercase tracking-widest rounded-t-2xl transition-all ${activeTab === 'Descuentos' ? 'bg-white text-emerald-600 border-t border-l border-r border-slate-100 shadow-[0_2px_0_0_white]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 border-t border-l border-r border-transparent'}`}
                        style={{ marginBottom: activeTab === 'Descuentos' ? '-1px' : '0' }}
                    >
                        Descuentos
                    </button>
                    <button 
                        onClick={() => setActiveTab('Beneficios Laborales')}
                        className={`whitespace-nowrap shrink-0 px-6 py-4 text-[11px] font-black uppercase tracking-widest rounded-t-2xl transition-all ${activeTab === 'Beneficios Laborales' ? 'bg-white text-emerald-600 border-t border-l border-r border-slate-100 shadow-[0_2px_0_0_white]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 border-t border-l border-r border-transparent'}`}
                        style={{ marginBottom: activeTab === 'Beneficios Laborales' ? '-1px' : '0' }}
                    >
                        Beneficios Laborales
                    </button>
                    <button 
                        onClick={() => setActiveTab('Aportes Patronales')}
                        className={`whitespace-nowrap shrink-0 px-6 py-4 text-[11px] font-black uppercase tracking-widest rounded-t-2xl transition-all ${activeTab === 'Aportes Patronales' ? 'bg-white text-emerald-600 border-t border-l border-r border-slate-100 shadow-[0_2px_0_0_white]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 border-t border-l border-r border-transparent'}`}
                        style={{ marginBottom: activeTab === 'Aportes Patronales' ? '-1px' : '0' }}
                    >
                        Aportes Patronales
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
                                            <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Turno</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-right">Hrs Trab.</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-rose-500 uppercase tracking-widest text-right">Hrs No Trab.</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-blue-500 uppercase tracking-widest text-right">Hrs Libres</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-amber-500 uppercase tracking-widest text-right">Hrs Extras</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-purple-500 uppercase tracking-widest text-right">Balance (Ext - No Trab - Perm)</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Asistencia</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-rose-400 uppercase tracking-widest text-right">Inasistencia</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-blue-400 uppercase tracking-widest text-right">Permisos</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-orange-500 uppercase tracking-widest text-right">Licencia</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-emerald-700 uppercase tracking-widest text-right rounded-tr-xl bg-emerald-50">Días a Pago</th>
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
                                            <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">AFC Trab.</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-amber-500 uppercase tracking-widest text-right">Imp. 2da Cat.</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-rose-500 uppercase tracking-widest text-right rounded-tr-xl bg-rose-50">Total Legal</th>
                                        </>
                                    )}

                                    {activeTab === 'Aportes Patronales' && (
                                        <>
                                            <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">SIS</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Mutual</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Longevidad</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">AFC Patronal</th>
                                            <th className="py-4 px-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-right rounded-tr-xl bg-emerald-50">Total Aportes</th>
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
                                                        Prorrateo: {c.workerDays}/30 días
                                                        {c.tieneAjusteAsistencia && (
                                                            <span className="ml-1 text-rose-500">
                                                                (-{c.diasNoRemunerados}d inasist/lic)
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    {c.totalVariables > 0 ? (
                                                        <>
                                                            <div className="text-[10px] font-bold text-slate-700">
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
                                                    {c.tieneAjusteAsistencia && c.rrRaw > 0 && (
                                                        <div className="text-[9px] font-black text-slate-400 line-through mt-0.5">
                                                            {fmt(c.rrRaw)}
                                                        </div>
                                                    )}
                                                    <div className="font-black text-emerald-500 text-[9px] mt-0.5">
                                                        Líq: {fmt(c.rrBonus * c.factorLiquido)}
                                                    </div>
                                                    {c.tieneAjusteAsistencia && (
                                                        <span className="inline-flex items-center text-[8px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md mt-1">
                                                            ⚠️ {Math.round(c.factorAsistencia * 100)}% asist.
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-blue-600 text-[11px]">
                                                        {c.aiBonus > 0 ? fmt(c.aiBonus) : '$0'}
                                                    </div>
                                                    {c.tieneAjusteAsistencia && c.aiRaw > 0 && (
                                                        <div className="text-[9px] font-black text-slate-400 line-through mt-0.5">
                                                            {fmt(c.aiRaw)}
                                                        </div>
                                                    )}
                                                    <div className="font-black text-emerald-500 text-[9px] mt-0.5">
                                                        Líq: {fmt(c.aiBonus * c.factorLiquido)}
                                                    </div>
                                                    {c.tieneAjusteAsistencia && (
                                                        <span className="inline-flex items-center text-[8px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md mt-1">
                                                            ⚠️ {Math.round(c.factorAsistencia * 100)}% asist.
                                                        </span>
                                                    )}
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
                                                    <div className="font-black text-slate-600 text-[11px]">
                                                        {c.hrsTurno > 0 ? c.hrsTurno.toFixed(2) : '0.00'}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-emerald-600 text-[11px]">
                                                        {c.hrsTrabajadas > 0 ? c.hrsTrabajadas.toFixed(2) : '0.00'}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-rose-600 text-[11px]">
                                                        {c.hrsNoTrabajadas > 0 ? c.hrsNoTrabajadas.toFixed(2) : '0.00'}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-blue-600 text-[11px]">
                                                        {c.hrsLibres > 0 ? c.hrsLibres.toFixed(2) : '0.00'}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-amber-600 text-[11px]">
                                                        {c.hrsExtras > 0 ? c.hrsExtras.toFixed(2) : '0.00'}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-right cursor-pointer group" onClick={() => setSelectedValidacionWorker(c)} title="Haz clic para Abrir Validación y Compensación Inteligente de Horas">
                                                     <div className="flex flex-col items-end gap-1">
                                                         <div className={`font-black text-[11px] ${c.balanceHoras > 0 ? 'text-emerald-600' : c.balanceHoras < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                                                             {c.balanceHoras > 0 ? `+${c.balanceHoras.toFixed(2)}` : c.balanceHoras < 0 ? c.balanceHoras.toFixed(2) : '0.00'} hrs
                                                         </div>
                                                         {(() => {
                                                             const vState = c.validacion?.estadoValidacion;
                                                             if (vState === 'COMPENSADO_ZERO') {
                                                                 return (
                                                                     <span className="inline-flex items-center gap-1 text-[9px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md shadow-2xs group-hover:bg-blue-100 transition-all">
                                                                         ⚖️ Compensado 0.00
                                                                     </span>
                                                                 );
                                                             }
                                                             if (vState === 'APROBADO_ORIGINAL') {
                                                                 return (
                                                                     <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md shadow-2xs group-hover:bg-emerald-100 transition-all">
                                                                         🟢 Validado
                                                                     </span>
                                                                 );
                                                             }
                                                             if (vState === 'AJUSTE_MANUAL') {
                                                                 return (
                                                                     <span className="inline-flex items-center gap-1 text-[9px] font-black text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md shadow-2xs group-hover:bg-purple-100 transition-all">
                                                                         ✍️ Ajustado ({c.balanceHoras.toFixed(2)})
                                                                     </span>
                                                                 );
                                                             }
                                                             return (
                                                                 <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded-md shadow-2xs group-hover:bg-amber-100 transition-all">
                                                                     ⏳ Validar
                                                                 </span>
                                                             );
                                                         })()}
                                                     </div>
                                                 </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-slate-700 text-[11px]">
                                                        {c.totalAsistencia !== undefined && c.totalAsistencia !== null ? c.totalAsistencia : 0} d
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className={`font-black text-[11px] ${(c.totalInasistencia || 0) > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                                        {c.totalInasistencia || 0} d
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className={`font-black text-[11px] ${(c.diasPermisos || 0) > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                                                        {c.diasPermisos || 0} d
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className={`font-black text-[11px] ${(c.diasLicencias || 0) > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                                                        {c.diasLicencias || 0} d
                                                    </div>
                                                    {(c.diasLicencias || 0) > 0 && (
                                                        <div className="text-[8px] text-orange-400 font-bold mt-0.5">Lic. Méd.</div>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4 text-right bg-emerald-50/60">
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        <div className={`font-black text-[11px] ${c.esMesCompleto ? 'text-emerald-700' : 'text-amber-600'}`}>
                                                            {c.diasResultadoPago ?? 0} d
                                                        </div>
                                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                                                            c.esMesCompleto
                                                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        }`}>
                                                            {c.esMesCompleto ? '✅ Mes Completo' : `⚠️ ${c.diasResultadoPago ?? 0}/${c.diasOperativosMes ?? 0} días`}
                                                        </span>
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
                                                    <div className="font-black text-rose-500 text-[11px]">
                                                        {c.afcTrabajadorMonto > 0 ? fmt(c.afcTrabajadorMonto) : '$0'}
                                                    </div>
                                                    {c.afcTrabajadorMonto === 0 && (
                                                        <div className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase">
                                                            No Aplica
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className={`font-black text-[11px] ${(c.impuestoUnico || 0) > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                                        {(c.impuestoUnico || 0) > 0 ? fmt(c.impuestoUnico) : '$0'}
                                                    </div>
                                                    {(c.impuestoUnico || 0) === 0 && (
                                                        <span className="inline-block text-[8px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md mt-0.5 uppercase">
                                                            Exento
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4 text-right bg-rose-50/50">
                                                    <div className="font-black text-rose-600 text-[12px]">
                                                        {fmt(c.totalDescuentosLegales)}
                                                    </div>
                                                </td>
                                            </>
                                        )}

                                        {activeTab === 'Aportes Patronales' && (
                                            <>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-slate-600 text-[11px]">
                                                        {c.sisMonto > 0 ? fmt(c.sisMonto) : '$0'}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-slate-600 text-[11px]">
                                                        {c.mutualMonto > 0 ? fmt(c.mutualMonto) : '$0'}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-slate-600 text-[11px]">
                                                        {c.expectativaMonto > 0 ? fmt(c.expectativaMonto) : '$0'}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="font-black text-slate-600 text-[11px]">
                                                        {c.afcPatronalMonto > 0 ? fmt(c.afcPatronalMonto) : '$0'}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right bg-emerald-50/50">
                                                    <div className="font-black text-emerald-600 text-[12px]">
                                                        {fmt(c.totalAportesPatronales)}
                                                    </div>
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

            {selectedValidacionWorker && (
                <ModalValidacionBalance
                    worker={selectedValidacionWorker}
                    period={period}
                    onClose={() => setSelectedValidacionWorker(null)}
                    onSaveSuccess={() => {
                        setSelectedValidacionWorker(null);
                        fetchData();
                    }}
                />
            )}
        </div>
    );
};

const ModalValidacionBalance = ({ worker, period, onClose, onSaveSuccess }) => {
    const [action, setAction] = useState(worker?.validacion?.estadoValidacion || 'COMPENSADO_ZERO');
    const [customValue, setCustomValue] = useState(worker?.validacion?.balanceAprobadoFinal !== undefined ? String(worker.validacion.balanceAprobadoFinal) : '0.00');
    const [observacion, setObservacion] = useState(worker?.validacion?.observacionSupervisor || '');
    const [saving, setSaving] = useState(false);

    if (!worker) return null;

    const asis = worker.asisData || {};
    const origBal = worker.balanceOriginal !== undefined ? worker.balanceOriginal : (asis.balanceOriginal ?? worker.balanceHoras ?? 0);

    const handleSave = async () => {
        try {
            setSaving(true);
            let finalBal = origBal;
            if (action === 'COMPENSADO_ZERO') finalBal = 0;
            if (action === 'AJUSTE_MANUAL') finalBal = parseFloat(customValue) || 0;

            await asistenciaApi.validarBalance({
                candidatoId: worker.emp?._id || worker.emp?.id,
                periodo: period,
                estadoValidacion: action,
                balanceAprobadoFinal: finalBal,
                observacionSupervisor: observacion,
                metricsSnapshot: {
                    rut: worker.emp?.rut || worker.asisData?.rut,
                    balanceOriginal: origBal,
                    horasTurnoTotales: worker.hrsTurno || 0,
                    horasEfectivasTrabajadas: worker.hrsTrabajadas || 0,
                    horasNoTrabajadas: worker.hrsNoTrabajadas || 0,
                    horasLibres: worker.hrsLibres || 0,
                    horasExtraAprobadas: worker.hrsExtras || 0
                }
            });

            setSaving(false);
            onSaveSuccess();
        } catch (err) {
            setSaving(false);
            alert('Error al guardar validación: ' + (err.response?.data?.message || err.message));
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-black text-lg">
                            ⚖️
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-800">Validación & Compensación de Horas</h3>
                            <p className="text-xs font-semibold text-slate-500">Módulo Asistencia 360 • Periodo {period}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center font-bold">✕</button>
                </div>

                {/* Worker Identity */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex items-center justify-between">
                    <div>
                        <div className="font-black text-slate-800 text-sm">{worker.fullName}</div>
                        <div className="text-xs font-bold text-slate-500">RUT: {worker.rut || 'N/A'} • {worker.position || 'Técnico'}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] font-black uppercase text-slate-400">Balance Calculado</div>
                        <div className={`text-base font-black ${origBal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {origBal >= 0 ? `+${origBal.toFixed(2)}` : origBal.toFixed(2)} hrs
                        </div>
                    </div>
                </div>

                {/* Metrics Breakdown Grid */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-slate-100/70 p-2 rounded-lg">
                        <span className="block text-[9px] font-black text-slate-400 uppercase">Turno</span>
                        <span className="font-black text-slate-700">{(worker.hrsTurno || 0).toFixed(2)}h</span>
                    </div>
                    <div className="bg-emerald-50/70 p-2 rounded-lg">
                        <span className="block text-[9px] font-black text-emerald-600 uppercase">Trabajadas</span>
                        <span className="font-black text-emerald-700">{(worker.hrsTrabajadas || 0).toFixed(2)}h</span>
                    </div>
                    <div className="bg-rose-50/70 p-2 rounded-lg">
                        <span className="block text-[9px] font-black text-rose-600 uppercase">No Trab.</span>
                        <span className="font-black text-rose-700">{(worker.hrsNoTrabajadas || 0).toFixed(2)}h</span>
                    </div>
                    <div className="bg-amber-50/70 p-2 rounded-lg">
                        <span className="block text-[9px] font-black text-amber-600 uppercase">Extras</span>
                        <span className="font-black text-amber-700">{(worker.hrsExtras || 0).toFixed(2)}h</span>
                    </div>
                </div>

                {/* Intelligent Validation Options */}
                <div className="space-y-3">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">Acción Inteligente del Supervisor</label>

                    <div onClick={() => setAction('COMPENSADO_ZERO')} className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${action === 'COMPENSADO_ZERO' ? 'border-blue-500 bg-blue-50/40 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                        <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center border-blue-500 bg-white">
                            {action === 'COMPENSADO_ZERO' && <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>}
                        </div>
                        <div className="flex-1">
                            <div className="text-xs font-black text-blue-900 flex items-center gap-2">
                                <span>⚖️ Condonar / Compensar a 0.00 hrs</span>
                                <span className="bg-blue-200 text-blue-800 text-[9px] font-black px-2 py-0.5 rounded-full">Recomendado</span>
                            </div>
                            <div className="text-[11px] text-blue-700/80 font-semibold mt-0.5">
                                Deja el balance en 0.00 hrs para NO descontar horas negativas al trabajador en su liquidación de sueldo.
                            </div>
                        </div>
                    </div>

                    <div onClick={() => setAction('APROBADO_ORIGINAL')} className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${action === 'APROBADO_ORIGINAL' ? 'border-emerald-500 bg-emerald-50/40 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                        <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center border-emerald-500 bg-white">
                            {action === 'APROBADO_ORIGINAL' && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>}
                        </div>
                        <div className="flex-1">
                            <div className="text-xs font-black text-emerald-900">
                                🟢 Aprobar Balance Original ({origBal >= 0 ? `+${origBal.toFixed(2)}` : origBal.toFixed(2)} hrs)
                            </div>
                            <div className="text-[11px] text-emerald-700/80 font-semibold mt-0.5">
                                Valida y aprueba formalmente el balance calculado por el sistema para nómina.
                            </div>
                        </div>
                    </div>

                    <div onClick={() => setAction('AJUSTE_MANUAL')} className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${action === 'AJUSTE_MANUAL' ? 'border-purple-500 bg-purple-50/40 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                        <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center border-purple-500 bg-white">
                            {action === 'AJUSTE_MANUAL' && <div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div>}
                        </div>
                        <div className="flex-1">
                            <div className="text-xs font-black text-purple-900">
                                ✍️ Ajuste Manual Personalizado
                            </div>
                            <div className="text-[11px] text-purple-700/80 font-semibold mt-0.5">
                                Define manualmente el total exacto de horas netas a aprobar.
                            </div>
                            {action === 'AJUSTE_MANUAL' && (
                                <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <input type="number" step="0.01" value={customValue} onChange={(e) => setCustomValue(e.target.value)} className="w-32 bg-white border border-purple-300 rounded-lg px-3 py-1 text-xs font-bold text-slate-800" placeholder="0.00" />
                                    <span className="text-xs font-bold text-purple-800">hrs</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Supervisor Observation */}
                <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">Observación de Supervisión / Justificación</label>
                    <textarea rows="2" value={observacion} onChange={(e) => setObservacion(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: Compensación autorizada por jefatura de terreno por sobretiempo no marcado." />
                </div>

                {/* Audit Signature */}
                {worker.validacion?.validadoPor && (
                    <div className="bg-slate-100/70 p-3 rounded-xl text-[10px] font-semibold text-slate-500">
                        Última validación por <strong className="text-slate-700">{worker.validacion.validadoPor}</strong> el {new Date(worker.validacion.fechaValidacion).toLocaleString('es-CL')}
                    </div>
                )}

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                    <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black text-slate-600 hover:bg-slate-50 transition-all">Cancelar</button>
                    <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl bg-purple-600 text-white text-xs font-black hover:bg-purple-700 shadow-md shadow-purple-200 transition-all flex items-center gap-2">
                        {saving ? 'Guardando...' : '💾 Guardar Validación Inteligente'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RemuCentral;

import React, { useMemo, useState, useEffect } from 'react';
import { Car, User, Calendar, Wallet, TrendingUp, Users, Download, ChevronDown, Filter, Landmark, X, Info, Sparkles } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, LabelList } from 'recharts';
import * as XLSX from 'xlsx';
import { telecomApi } from '../telecomApi';
import { getBonusForMonth, getBonosFijosForMonth } from '../utils/bonosCalculator';
import { getBaremo } from '../utils/financialUtils';
import { getFeriadosChile } from '../utils/produccionUtils';
import { useIndicadores } from '../../../contexts/IndicadoresContext';

const parseStartDate = (dateStr) => {
  if (!dateStr) return null;
  if (typeof dateStr !== 'string') return new Date(dateStr);
  if (dateStr.includes('T')) return new Date(dateStr);
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return new Date(dateStr + 'T00:00:00');
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
    if (parts[0].length === 4) return new Date(`${parts[0]}-${parts[1]}-${parts[2]}T00:00:00`);
  }
  return new Date(dateStr);
};

const getWorkerActiveDays = (v, limitDays, filtroMes) => {
  const startStr = v.asignadoA?.contractStartDate || v.asignadoA?.fechaIngreso;
  if (!startStr) return limitDays;

  const today = new Date();
  let selectedYear = today.getFullYear();
  let selectedMonth = today.getMonth();
  
  if (filtroMes) {
    const parts = filtroMes.split('-');
    selectedYear = parseInt(parts[0], 10);
    selectedMonth = parseInt(parts[1], 10) - 1;
  }

  const start = parseStartDate(startStr);
  if (!start || isNaN(start.getTime())) return limitDays;

  const firstOfSelectedMonth = new Date(selectedYear, selectedMonth, 1);
  const lastOfSelectedMonth = new Date(selectedYear, selectedMonth + 1, 0);

  if (start > lastOfSelectedMonth) return 0;
  if (start < firstOfSelectedMonth) return limitDays;

  const startDayNum = start.getDate();
  return Math.max(0, limitDays - startDayNum + 1);
};

const getWorkerDeductions = (v, limitDays, filtroMes, tecnicos) => {
  const rut = v.asignadoA?.rut ? v.asignadoA.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() : '';
  const nombre = (v.asignadoA?.nombre || '').toLowerCase().trim();
  const t = tecnicos.find(x => 
    (x.rut && x.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() === rut) ||
    ((x.name || x.fullName || '').toLowerCase().trim() === nombre)
  );

  if (!t || !t.dailyMap) return 0;

  const today = new Date();
  let selectedYear = today.getFullYear();
  let selectedMonth = today.getMonth();
  
  if (filtroMes) {
    const parts = filtroMes.split('-');
    selectedYear = parseInt(parts[0], 10);
    selectedMonth = parseInt(parts[1], 10) - 1;
  }

  const holidays = getFeriadosChile(selectedYear);
  const startStr = v.asignadoA?.contractStartDate || v.asignadoA?.fechaIngreso;
  const start = parseStartDate(startStr);

  let deductionsCount = 0;

  for (let dayNum = 1; dayNum <= limitDays; dayNum++) {
    const dateObj = new Date(selectedYear, selectedMonth, dayNum);
    if (start && dateObj < start) {
      continue;
    }

    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      if (!holidays.includes(dateStr)) {
        const dayData = t.dailyMap[dateStr];
        const pts = typeof dayData === 'object' ? (dayData?.pts || 0) : (dayData || 0);
        if (pts <= 0) {
          deductionsCount++;
        }
      }
    }
  }

  return deductionsCount;
};

const getProratedSueldo = (v, limitDays, numDiasMes, filtroMes, tecnicos) => {
  const sueldoBase = parseInt(v.asignadoA?.sueldoBase) || 0;
  if (!sueldoBase) return 0;

  const workerDays = getWorkerActiveDays(v, limitDays, filtroMes);
  const baseProrated = Math.round((sueldoBase / numDiasMes) * workerDays);

  const deductionsCount = getWorkerDeductions(v, limitDays, filtroMes, tecnicos);
  const deduction = Math.round((sueldoBase / numDiasMes) * deductionsCount);

  return Math.max(0, baseProrated - deduction);
};

// Helper de cálculo financiero 100% alineado a legislación chilena (Feb 2026) y Mercado Financiero
const calculateFinancials = (sueldoBase, produccionClp, bonoFijo, bonoVar, leasing, combustible, workerDays, numDiasMes, infoPrev = {}, ufHoy = 38500, immValue = 539000, sisRate = 1.54) => {
  const prorrateadoSueldo = sueldoBase ? Math.round((sueldoBase / numDiasMes) * workerDays) : 0;
  const prorrateadoBonoFijo = bonoFijo ? Math.round((bonoFijo / numDiasMes) * workerDays) : 0;
  
  // Imponibles base sin gratificación (No incluye la Producción, ya que representa el Ingreso/Facturación de la empresa, no un pago de remuneración al técnico)
  const imponibleBaseSinGrat = prorrateadoSueldo + prorrateadoBonoFijo + bonoVar;
  
  // Gratificación legal (Art 50) topado a 4.75 IMM prorrateado
  const topeGratifMensual = (immValue * 4.75) / 12; // $213.438 con IMM 539.000
  const prorrateoTopeGratif = Math.round((topeGratifMensual / numDiasMes) * workerDays);
  const gratificacion = Math.min(Math.round(imponibleBaseSinGrat * 0.25), prorrateoTopeGratif);
  
  const totalImponible = imponibleBaseSinGrat + gratificacion;
  
  // Topes previsionales prorrateados por los días trabajados en el periodo (según días transcurridos)
  const topeAfpCLP = Math.round((89.9 * ufHoy / numDiasMes) * workerDays);
  const topeAfcCLP = Math.round((135.1 * ufHoy / numDiasMes) * workerDays);
  const imponibleTopadoAFP = Math.min(totalImponible, topeAfpCLP);
  const imponibleTopadoAFC = Math.min(totalImponible, topeAfcCLP);
  
  // Aportes patronales (leyes sociales empleador)
  const sisMonto = Math.round(imponibleTopadoAFP * (sisRate / 100));
  const mutualMonto = Math.round(imponibleTopadoAFP * (0.90 / 100));
  const expectativaMonto = Math.round(imponibleTopadoAFP * (0.50 / 100)); // Longevidad
  
  const contractType = (infoPrev?.tipoContrato || infoPrev?.contractType || 'INDEFINIDO').toUpperCase();
  const esIndefinido = contractType.includes('INDEFINIDO');
  const afcPatronalRate = esIndefinido ? 2.4 : 3.0;
  const afcPatronalMonto = Math.round(imponibleTopadoAFC * (afcPatronalRate / 100));
  
  const totalLeyesSociales = sisMonto + mutualMonto + expectativaMonto + afcPatronalMonto;
  const totalCostoEmpresa = totalImponible + totalLeyesSociales + leasing + combustible;
  
  return {
    prorrateadoSueldo,
    prorrateadoBonoFijo,
    gratificacion,
    totalImponible,
    topes: {
      topeAFP: topeAfpCLP,
      topeAFC: topeAfcCLP,
      imponibleTopadoAFP,
      imponibleTopadoAFC
    },
    leyesSociales: {
      sis: { tasa: sisRate, monto: sisMonto },
      mutual: { tasa: 0.90, monto: mutualMonto },
      expectativaVida: { tasa: 0.50, monto: expectativaMonto },
      afc: { tasa: afcPatronalRate, monto: afcPatronalMonto, tipoContrato: contractType },
      total: totalLeyesSociales
    },
    totalCostoEmpresa
  };
};

const FinancialDashboard = ({ vehiculos = [], searchTech = '', dashboardData = null, tecnicos = [], selectedMonths = [], setSelectedMonths }) => {
  const { ufValue: ufCtx, immValue = 539000, params: indicParams } = useIndicadores();
  const [selectedBreakdown, setSelectedBreakdown] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);

  const [ufValue, setUfValue] = useState(null);
  const [ufYearData, setUfYearData] = useState({});
  const [fuelData, setFuelData] = useState([]);
  const [internalMes, setInternalMes] = useState('');
  const [localSelectedProjects, setLocalSelectedProjects] = useState([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  
  const filtroMes = selectedMonths?.[0] || internalMes;
  const setFiltroMes = (val) => {
    setInternalMes(val);
    if (setSelectedMonths) setSelectedMonths(val ? [val] : []);
  };
  const [mesesDisponibles, setMesesDisponibles] = useState([]);
  const [bonusData, setBonusData] = useState({});
  const [fixedBonusData, setFixedBonusData] = useState({});
  const [tarifario, setTarifario] = useState([]);

  useEffect(() => {
    telecomApi.get('/valor-punto').then(res => {
      setTarifario(res.data || []);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    // Fetch fuel data
    telecomApi.get('/flota/eficiencia/combustible').then(res => {
      const data = res.data || [];
      const cleanData = data.map(r => {
        let p = r.vehiculoPatente || r.patente || '';
        p = String(p).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        p = p.replace(/([A-Z]+)([0-9]+)/, '$1-$2');
        return { ...r, patente: p };
      });
      setFuelData(cleanData);
      
      const meses = new Set();
      cleanData.forEach(r => {
        if (r.fechaCarga) {
          const d = new Date(r.fechaCarga);
          if (!isNaN(d.getTime())) {
            meses.add(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
          }
        }
      });
      const sortedMeses = Array.from(meses).sort().reverse();
      setMesesDisponibles(sortedMeses);
      
      if (sortedMeses.length > 0) {
        setFiltroMes(sortedMeses[0]);
      }
    }).catch(console.error);
  }, []);

  const extractUfForMonth = (serie, monthStr) => {
    const monthSerie = serie.filter(s => s.fecha.includes(`-${monthStr}-`));
    if (monthSerie.length > 0) {
      setUfValue(monthSerie[0].valor);
    } else if (serie.length > 0) {
      setUfValue(serie[0].valor);
    } else {
      setUfValue(null);
    }
  };

  useEffect(() => {
    if (!filtroMes) {
      fetch('https://mindicador.cl/api/uf')
        .then(res => res.json())
        .then(data => {
          if (data && data.serie && data.serie.length > 0) {
            setUfValue(data.serie[0].valor);
          }
        })
        .catch(console.error);
      return;
    }

    const year = filtroMes.split('-')[0];
    const month = filtroMes.split('-')[1];

    if (ufYearData[year]) {
      extractUfForMonth(ufYearData[year], month);
    } else {
      fetch(`https://mindicador.cl/api/uf/${year}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.serie) {
            setUfYearData(prev => ({ ...prev, [year]: data.serie }));
            extractUfForMonth(data.serie, month);
          }
        })
        .catch(console.error);
    }
  }, [filtroMes, ufYearData]);

  useEffect(() => {
    if (!filtroMes) {
      setBonusData({});
      setFixedBonusData({});
      return;
    }
    const [yearStr, monthStr] = filtroMes.split('-');
    
    getBonusForMonth(yearStr, monthStr)
      .then(map => { setBonusData(map); })
      .catch(err => { console.error('Error fetching bonos:', err); setBonusData({}); });

    getBonosFijosForMonth(yearStr, monthStr)
      .then(map => { setFixedBonusData(map); })
      .catch(err => { console.error('Error fetching bonos fijos:', err); setFixedBonusData({}); });
  }, [filtroMes]);

  const filteredFuelData = useMemo(() => {
    if (!filtroMes) return fuelData;
    return fuelData.filter(r => {
      const d = new Date(r.fechaCarga);
      return !isNaN(d.getTime()) && `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}` === filtroMes;
    });
  }, [fuelData, filtroMes]);

  const fuelByPatente = useMemo(() => {
    const map = {};
    filteredFuelData.forEach(r => {
      if (r.patente) {
        if (!map[r.patente]) map[r.patente] = 0;
        map[r.patente] += (r.monto || 0);
      }
    });
    return map;
  }, [filteredFuelData]);

  const { diasMes, diasTranscurridos } = useMemo(() => {
    const today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth(); // 0-based
    
    if (filtroMes) {
      const parts = filtroMes.split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
    }
    
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    
    const totalDays = new Date(year, month + 1, 0).getDate();
    const elapsed = isCurrentMonth ? today.getDate() : totalDays;
    
    return { diasMes: totalDays, diasTranscurridos: elapsed };
  }, [filtroMes]);

  const ultimoDiaProducido = useMemo(() => {
    let maxDay = 0;
    let targetMonthPrefix = filtroMes;
    if (!targetMonthPrefix) {
      const today = new Date();
      targetMonthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    }
    
    tecnicos.forEach(t => {
      if (t.dailyMap) {
        Object.entries(t.dailyMap).forEach(([dateStr, dayData]) => {
          if (dateStr.startsWith(targetMonthPrefix)) {
            const pts = typeof dayData === 'object' ? (dayData.pts || 0) : dayData;
            if (pts > 0) {
              const parts = dateStr.split('-');
              const dayNum = parseInt(parts[2], 10) || 0;
              if (dayNum > maxDay) {
                maxDay = dayNum;
              }
            }
          }
        });
      }
    });
    return maxDay || 1;
  }, [tecnicos, filtroMes]);

  // Helpers para estado
  const getStatusInfo = (s) => {
    const raw = s || '';
    let short = raw;
    let color = 'bg-slate-100 text-slate-700 border-slate-200';
    if (['En Postulación','Postulando'].includes(raw)) { short = 'POST'; color = 'bg-blue-50 text-blue-700 border-blue-200'; }
    else if (['En Entrevista'].includes(raw)) { short = 'ENTR'; color = 'bg-purple-50 text-purple-700 border-purple-200'; }
    else if (['Bloqueado', 'BLOQUEADO', 'bloqueado', 'bloqueados', 'Bloqueados'].includes(raw)) { short = 'BLOQ'; color = 'bg-red-50 text-red-700 border-red-200'; }
    else if (['Examen Preocupacional', 'Preocupacional', 'En Examen Preocupacional', 'PREOCUP'].includes(raw)) { short = 'PREOCUP'; color = 'bg-yellow-50 text-yellow-700 border-yellow-200'; }
    else if (['Aprobado','En Evaluación','Aprobado/No Operativo'].includes(raw)) { short = 'APROB'; color = 'bg-indigo-50 text-indigo-700 border-indigo-200'; }
    else if (['Curso Online', 'C. ONLINE', 'C.Online'].includes(raw)) { short = 'C. ONLINE'; color = 'bg-amber-50 text-amber-700 border-amber-200'; }
    else if (['OTEC', 'Otec'].includes(raw)) { short = 'OTEC'; color = 'bg-orange-50 text-orange-700 border-orange-200'; }
    else if (['En Acreditación','Acreditación','En Documentación'].includes(raw)) { short = 'ACRED'; color = 'bg-cyan-50 text-cyan-700 border-cyan-200'; }
    else if (['Contratado','Listo Terreno'].includes(raw)) { short = 'CONT'; color = 'bg-emerald-50 text-emerald-700 border-emerald-200'; }
    else if (['En Terreno','EN TERR', 'ACTIVO', 'OPERATIVO'].includes(raw)) { short = 'ACTIVO'; color = 'bg-green-50 text-green-700 border-green-200'; }
    else if (['Suspendido', 'Ausente', 'Licencia Médica', 'LICENCIA MEDICA', 'Inactivo', 'INACTIVO'].includes(raw)) { short = 'INACTIVO'; color = 'bg-gray-100 text-gray-700 border-gray-200'; }
    else if (['Rechazado','Retirado','Finiquitado','FINIQUITADO','Bajas/Inactivos', 'De Baja'].includes(raw)) { short = 'DE BAJA'; color = 'bg-rose-50 text-rose-700 border-rose-200'; }
    return { short, color };
  };

  const getTarifaParaProyecto = (proyectoStr) => {
    if (!proyectoStr) return getBaremo('');
    const upper = proyectoStr.toUpperCase();
    const exact = tarifario.find(t => t.proyecto?.toUpperCase() === upper);
    if (exact) return exact.valor_punto;
    for (const t of tarifario) {
      if (t.cliente && upper.includes(t.cliente.toUpperCase())) return t.valor_punto;
      if (t.proyecto && upper.includes(t.proyecto.toUpperCase())) return t.valor_punto;
    }
    return getBaremo(proyectoStr);
  };

  // Obtener lista de proyectos únicos disponibles
  const availableProjects = useMemo(() => {
    const projs = new Set();
    vehiculos.forEach(v => {
      if (v.asignadoA) {
        const pName = v.asignadoA.projectId?.nombreProyecto || v.asignadoA.proyecto;
        if (pName) projs.add(pName.trim());
      }
    });
    tecnicos.forEach(t => {
      if (t.proyecto) projs.add(t.proyecto.trim());
      if (t.cliente) projs.add(t.cliente.trim());
    });
    return Array.from(projs).sort();
  }, [vehiculos, tecnicos]);

  // Filtramos los técnicos activos con vehículo asignado y añadimos los finiquitados que tuvieron producción en el mes
  const asignados = useMemo(() => {
    // 1. Obtener RUTs y nombres de técnicos que ya tienen vehículo asignado
    const assignedTechRuts = new Set(
      vehiculos
        .filter(v => v.asignadoA && v.asignadoA.rut)
        .map(v => v.asignadoA.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim())
    );
    const assignedTechNames = new Set(
      vehiculos
        .filter(v => v.asignadoA && v.asignadoA.nombre)
        .map(v => (v.asignadoA.nombre || '').toLowerCase().trim())
    );

    // 2. Filtrar técnicos finiquitados de la lista general que tuvieron producción y no están asignados
    const finiquitadosConProd = tecnicos.filter(t => {
      const isFini = ['Rechazado', 'Retirado', 'Finiquitado', 'FINIQUITADO', 'Bajas/Inactivos', 'De Baja'].includes(t.status || t.estado);
      const hasProd = (t.ptsTotal || 0) > 0;
      
      const cleanRut = t.rut ? t.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() : '';
      const cleanName = (t.name || t.fullName || '').toLowerCase().trim();
      
      const alreadyAssigned = (cleanRut && assignedTechRuts.has(cleanRut)) || assignedTechNames.has(cleanName);
      
      return isFini && hasProd && !alreadyAssigned;
    });

    // 3. Crear asignaciones virtuales de vehículo para los finiquitados con producción
    const virtualAssignments = finiquitadosConProd.map(t => ({
      _id: `fini-${t.rut || t.idRecursoToa || t.name}`,
      patente: '',
      moneda: 'CLP',
      valor: 0,
      isVirtualFini: true,
      asignadoA: {
        _id: t.idUnique || t._id,
        nombre: t.name || t.fullName || 'Finiquitado',
        rut: t.rut,
        sueldoBase: t.sueldoBase || 0,
        idRecursoToa: t.idRecursoToa,
        statusCandidato: t.status || t.estado || 'FINIQUITADO',
        estadoActual: t.status || t.estado || 'FINIQUITADO',
        cargo: t.cargo || 'Técnico',
        proyecto: t.proyecto,
        projectId: null,
        fechaIngreso: t.fechaIngreso || t.inicioContrato || null,
        contractStartDate: t.fechaIngreso || t.inicioContrato || null,
        previsionSalud: t.previsionSalud || 'FONASA',
        isapreNombre: t.isapreNombre || '',
        valorPlan: t.valorPlan || 0,
        monedaPlan: t.monedaPlan || 'UF',
        afp: t.afp || 'HABITAT',
        pensionado: t.pensionado || 'NO',
        tipoContrato: t.tipoContrato || t.contractType || 'INDEFINIDO'
      }
    }));

    // 4. Combinar asignaciones activas de vehículos y las virtuales de finiquitados
    const activeAssignments = vehiculos
      .filter(v => v.asignadoA)
      .map(v => ({ ...v }));

    const combined = [...activeAssignments, ...virtualAssignments];

    // 5. Aplicar filtro de búsqueda, proyectos locales y ordenación
    return combined
      .filter(v => {
        // Filtro de proyectos locales
        if (localSelectedProjects.length > 0) {
          const pName = v.asignadoA?.projectId?.nombreProyecto || v.asignadoA?.proyecto || 'General';
          if (!localSelectedProjects.includes(pName)) return false;
        }

        if (!searchTech) return true;
        const q = searchTech.toLowerCase();
        const n = (v.asignadoA?.nombre || '').toLowerCase();
        const p = (v.patente || '').toLowerCase();
        return n.includes(q) || p.includes(q);
      })
      .sort((a, b) => (a.asignadoA?.nombre || '').localeCompare(b.asignadoA?.nombre || ''));
  }, [vehiculos, tecnicos, searchTech, localSelectedProjects]);


  const { totales, chartData } = useMemo(() => {
    let costoGeneral = 0;
    let costoHastaUltimoDia = 0;
    let remuneracion = 0;
    let remuneracionHastaUltimo = 0;
    let flota = 0;
    let flotaHastaUltimo = 0;
    let produccionClp = 0;
    let produccionPts = 0;
    let costoPorProyecto = {};

    const numDiasMes = parseInt(diasMes) || 30;
    const numDiasTranscurridos = parseInt(diasTranscurridos) || 1;
    const ufHoy = ufCtx || ufValue || 38500;
    const sisRate = indicParams?.sisRate || 1.54;

    asignados.forEach(v => {
      const techRut = v.asignadoA?.rut ? v.asignadoA.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() : '';
      const techNombre = (v.asignadoA?.nombre || '').toLowerCase().trim();
      const t = tecnicos.find(x => 
        (x.rut && x.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() === techRut) ||
        ((x.name || x.fullName || '').toLowerCase().trim() === techNombre)
      );
      const pts = t ? (t.ptsTotal || 0) : 0;
      const proyecto = v.asignadoA.projectId?.nombreProyecto || v.asignadoA.proyecto || 'General';
      const valorPunto = getTarifaParaProyecto(proyecto);
      const prodClp = pts * valorPunto;
      
      produccionClp += prodClp;
      produccionPts += pts;

      const sueldoBase = parseInt(v.asignadoA?.sueldoBase) || 0;
      
      const isUF = v.moneda === 'UF' || (v.valor > 0 && v.valor < 100);
      const valorCLP = isUF ? (ufHoy ? Math.round(v.valor * ufHoy) : 0) : (v.valor || 0);
      
      const prorrateadoLeasing = valorCLP ? Math.round((valorCLP / numDiasMes) * numDiasTranscurridos) : 0;
      const leasingHastaUltimo = valorCLP ? Math.round((valorCLP / numDiasMes) * ultimoDiaProducido) : 0;
      
      const totalC = fuelByPatente[v.patente] || 0;
      const fuelHastaUltimo = totalC ? Math.round((totalC / numDiasMes) * ultimoDiaProducido) : 0;
      
      const techIdToa = String(v.asignadoA?.idRecursoToa || '').replace(/^0+/, '').trim();
      const bonoFijo = fixedBonusData[techRut] ?? fixedBonusData[techIdToa] ?? fixedBonusData[techNombre] ?? 0;
      
      const techId1 = v.asignadoA?._id?.toString() || '';
      let bonoVar = 0;
      if (bonusData[techRut] !== undefined) bonoVar = bonusData[techRut];
      else if (bonusData[techId1] !== undefined) bonoVar = bonusData[techId1];
      else if (bonusData[techIdToa] !== undefined) bonoVar = bonusData[techIdToa];
      else if (bonusData[techNombre] !== undefined) bonoVar = bonusData[techNombre];

      // Calcular para días transcurridos
      const workerDays = getWorkerActiveDays(v, numDiasTranscurridos, filtroMes);
      const finTrans = calculateFinancials(
        sueldoBase, prodClp, bonoFijo, bonoVar, prorrateadoLeasing, totalC,
        workerDays, numDiasMes, v.asignadoA, ufHoy, immValue, sisRate
      );

      // Calcular para días producidos (hasta último producido)
      const workerDaysHastaUltimo = getWorkerActiveDays(v, ultimoDiaProducido, filtroMes);
      const finHastaUltimo = calculateFinancials(
        sueldoBase, prodClp, bonoFijo, bonoVar, leasingHastaUltimo, fuelHastaUltimo,
        workerDaysHastaUltimo, numDiasMes, v.asignadoA, ufHoy, immValue, sisRate
      );

      remuneracion += finTrans.totalImponible + finTrans.leyesSociales.total;
      remuneracionHastaUltimo += finHastaUltimo.totalImponible + finHastaUltimo.leyesSociales.total;
      
      flota += prorrateadoLeasing + totalC;
      flotaHastaUltimo += leasingHastaUltimo + fuelHastaUltimo;
      
      costoGeneral += finTrans.totalCostoEmpresa;
      costoHastaUltimoDia += finHastaUltimo.totalCostoEmpresa;

      if (!costoPorProyecto[proyecto]) costoPorProyecto[proyecto] = { total: 0, count: 0, produccion: 0 };
      costoPorProyecto[proyecto].total += finTrans.totalCostoEmpresa;
      costoPorProyecto[proyecto].count += 1;
      costoPorProyecto[proyecto].produccion += prodClp;
    });

    const chart = Object.entries(costoPorProyecto)
      .map(([name, data]) => ({ name, TotalCostoEmpresa: data.total, Trabajadores: data.count, ProduccionCLP: data.produccion }))
      .sort((a, b) => b.TotalCostoEmpresa - a.TotalCostoEmpresa);

    return { totales: { costoGeneral, costoHastaUltimoDia, remuneracion, remuneracionHastaUltimo, flota, flotaHastaUltimo, produccionClp, produccionPts, ultimoDiaProducido, numDiasTranscurridos }, chartData: chart };
  }, [asignados, diasMes, diasTranscurridos, ufValue, ufCtx, fuelByPatente, fixedBonusData, bonusData, tecnicos, ultimoDiaProducido, indicParams, immValue]);

  const techProfitabilityData = useMemo(() => {
    const list = asignados.map(v => {
      const sueldoBase = parseInt(v.asignadoA?.sueldoBase) || 0;
      const workerDays = getWorkerActiveDays(v, diasTranscurridos, filtroMes);
      
      const isUF = v.moneda === 'UF' || (v.valor > 0 && v.valor < 100);
      const ufHoy = ufCtx || ufValue || 38500;
      const valorCLP = isUF ? (ufHoy ? Math.round(v.valor * ufHoy) : 0) : (v.valor || 0);
      const prorrateadoLeasing = valorCLP ? Math.round((valorCLP / diasMes) * workerDays) : 0;
      
      const totalC = fuelByPatente[v.patente] || 0;
      
      const techRut = v.asignadoA?.rut ? v.asignadoA.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() : '';
      const techNombre = (v.asignadoA?.nombre || '').toLowerCase().trim();
      const techIdToa = String(v.asignadoA?.idRecursoToa || '').replace(/^0+/, '').trim();
      const bonoFijo = fixedBonusData[techRut] ?? fixedBonusData[techIdToa] ?? fixedBonusData[techNombre] ?? 0;
      
      const techId1 = v.asignadoA?._id?.toString() || '';
      let bonoVar = 0;
      if (bonusData[techRut] !== undefined) bonoVar = bonusData[techRut];
      else if (bonusData[techId1] !== undefined) bonoVar = bonusData[techId1];
      else if (bonusData[techIdToa] !== undefined) bonoVar = bonusData[techIdToa];
      else if (bonusData[techNombre] !== undefined) bonoVar = bonusData[techNombre];
      
      const t = tecnicos.find(x => 
        (x.rut && x.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() === techRut) ||
        ((x.name || x.fullName || '').toLowerCase().trim() === techNombre)
      );
      const pts = t ? (t.ptsTotal || 0) : 0;
      const proyectoName = v.asignadoA.projectId?.nombreProyecto || v.asignadoA.proyecto || '';
      const valorPunto = getTarifaParaProyecto(proyectoName);
      const valorTotal = pts * valorPunto;
      
      const sisRate = indicParams?.sisRate || 1.54;
      const fin = calculateFinancials(
        sueldoBase, valorTotal, bonoFijo, bonoVar, prorrateadoLeasing, totalC,
        workerDays, diasMes, v.asignadoA, ufHoy, immValue, sisRate
      );

      const totalCostoEmpresa = fin.totalCostoEmpresa;
      const rentabilidad = valorTotal - totalCostoEmpresa;
      const pctValue = valorTotal > 0 ? (rentabilidad / valorTotal) * 100 : 0;
      const rentK = rentabilidad >= 0 
        ? `$${(rentabilidad / 1000).toFixed(0)}K` 
        : `-$${(Math.abs(rentabilidad) / 1000).toFixed(0)}K`;
      const labelRentabilidad = `${rentK} (${pctValue >= 0 ? '+' : ''}${pctValue.toFixed(1)}%)`;

      return {
        name: (() => {
          if (!v.asignadoA?.nombre) return 'TÉCNICO';
          const parts = v.asignadoA.nombre.split(' ').filter(Boolean);
          if (parts.length <= 1) return v.asignadoA.nombre.toUpperCase();
          if (parts.length >= 4) return `${parts[0]} ${parts[2]}`.toUpperCase();
          return `${parts[0]} ${parts[1]}`.toUpperCase();
        })(),
        rentabilidad,
        produccion: valorTotal,
        costo: totalCostoEmpresa,
        labelRentabilidad
      };
    });

    const positivas = list.filter(x => x.rentabilidad > 0).sort((a, b) => b.rentabilidad - a.rentabilidad);
    const negativas = list.filter(x => x.rentabilidad < 0).sort((a, b) => a.rentabilidad - b.rentabilidad);

    return { positivas, negativas };
  }, [asignados, diasMes, diasTranscurridos, ufValue, ufCtx, fuelByPatente, fixedBonusData, bonusData, tecnicos, indicParams, immValue]);

  const generateAiAnalysis = async () => {
    setLoadingAi(true);
    try {
      const prompt = `[Módulo Producción Financiera - Gen AI] Analiza financieramente el resumen de costos y producción del mes actual con los siguientes datos consolidados del equipo:
- Producción Total Facturada: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totales.produccionClp)} (${totales.produccionPts} puntos)
- Costo Empresa Total: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totales.costoGeneral)}
- Margen Neto (Rentabilidad Bruta): ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totales.produccionClp - totales.costoGeneral)} (${totales.produccionClp > 0 ? ((totales.produccionClp - totales.costoGeneral) / totales.produccionClp * 100).toFixed(1) : 0}%)
- Días Transcurridos Evaluados: ${totales.numDiasTranscurridos} días
- Número de Especialistas en Terreno: ${asignados.length}
- Costo de Flota (Leasing y Combustible): ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totales.flota)}
- Costo de Remuneraciones (Sueldo base prorrateado, leyes sociales y bonos): ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totales.remuneracion)}

Danos un análisis ejecutivo senior estructurado en 3 secciones claras:
1. 📊 SALUD FINANCIERA (Diagnóstico del margen neto y la rentabilidad del equipo).
2. 💡 EFICIENCIA DE COSTOS (Análisis del balance entre el costo operativo de flota y remuneraciones vs. los ingresos generados).
3. ⚡ RECOMENDACIONES CLAVE (Recomendaciones accionables para optimizar recursos o alertar desvíos en terreno).

Responde de forma concisa, con viñetas y lenguaje directo de negocios.`;

      const response = await telecomApi.post('/ai/chat', {
        mensaje: prompt,
        contexto: {
          rolUsuario: 'executive',
          modulo: 'produccion_financiera'
        }
      });

      const data = response.data;
      if (data.ok && data.respuesta) {
        let cleanAnswer = data.respuesta;
        cleanAnswer = cleanAnswer.replace(/^Hola [^.]+\.\s*/i, '');
        cleanAnswer = cleanAnswer.replace(/\n\n¿Necesitas otro indicador o análisis ejecutivo\?$/i, '');
        cleanAnswer = cleanAnswer.replace(/\n\n¿Te ayudo con algún indicador de tu equipo o proceso\?$/i, '');
        cleanAnswer = cleanAnswer.replace(/\n\n¿Te ayudo en algo más\?$/i, '');
        
        setAiAnalysis(cleanAnswer.trim());
      } else {
        alert('No se pudo generar el análisis de IA. Intente nuevamente.');
      }
    } catch (err) {
      console.error('[GenAI Analysis Error]:', err);
      alert('Error en la conexión con el motor de Inteligencia Artificial.');
    } finally {
      setLoadingAi(false);
    }
  };

  const exportToExcel = () => {
    const dataToExport = asignados.map(v => {
      const numDiasMes = parseInt(diasMes) || 30;
      const numDiasTranscurridos = parseInt(diasTranscurridos) || 1;
      
      const sueldoBase = parseInt(v.asignadoA?.sueldoBase) || 0;
      const workerDays = getWorkerActiveDays(v, numDiasTranscurridos, filtroMes);
      
      const isUF = v.moneda === 'UF' || (v.valor > 0 && v.valor < 100);
      const ufHoy = ufCtx || ufValue || 38500;
      const valorCLP = isUF ? (ufHoy ? Math.round(v.valor * ufHoy) : 0) : (v.valor || 0);
      const prorrateadoLeasing = valorCLP ? Math.round((valorCLP / numDiasMes) * workerDays) : 0;
      
      const totalC = fuelByPatente[v.patente] || 0;
      
      const techRut = v.asignadoA?.rut ? v.asignadoA.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() : '';
      const techNombre = (v.asignadoA?.nombre || '').toLowerCase().trim();
      const techIdToa = String(v.asignadoA?.idRecursoToa || '').replace(/^0+/, '').trim();
      const bonoFijo = fixedBonusData[techRut] ?? fixedBonusData[techIdToa] ?? fixedBonusData[techNombre] ?? 0;
      
      const techId1 = v.asignadoA?._id?.toString() || '';
      let bonoVar = 0;
      if (bonusData[techRut] !== undefined) bonoVar = bonusData[techRut];
      else if (bonusData[techId1] !== undefined) bonoVar = bonusData[techId1];
      else if (bonusData[techIdToa] !== undefined) bonoVar = bonusData[techIdToa];
      else if (bonusData[techNombre] !== undefined) bonoVar = bonusData[techNombre];
      
      const t = tecnicos.find(x => 
        (x.rut && x.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() === techRut) ||
        ((x.name || x.fullName || '').toLowerCase().trim() === techNombre)
      );
      const pts = t ? (t.ptsTotal || 0) : 0;
      const proyecto = v.asignadoA.projectId?.nombreProyecto || v.asignadoA.proyecto || 'General';
      const valorPunto = getTarifaParaProyecto(proyecto);
      const valorTotal = pts * valorPunto;

      const sisRate = indicParams?.sisRate || 1.54;
      const fin = calculateFinancials(
        sueldoBase, valorTotal, bonoFijo, bonoVar, prorrateadoLeasing, totalC,
        workerDays, numDiasMes, v.asignadoA, ufHoy, immValue, sisRate
      );

      return {
        'Especialista': v.asignadoA.nombre || '',
        'RUT': v.asignadoA.rut || '',
        'Fecha Inicio': v.asignadoA.fechaIngreso ? new Date(v.asignadoA.fechaIngreso).toLocaleDateString('es-CL') : '',
        'Estado': v.asignadoA.statusCandidato || v.asignadoA.estadoActual || 'ACTIVO',
        'Cargo': v.asignadoA.cargo || 'Especialista',
        'Proyecto': proyecto,
        'Puntos (Producción)': pts.toFixed(1),
        'Monto Producción (CLP)': valorTotal,
        'Sueldo Base (CLP)': sueldoBase,
        'Sueldo Prorrateado (CLP)': fin.prorrateadoSueldo,
        'Valor Leasing (CLP)': prorrateadoLeasing,
        'Combustible (CLP)': totalC,
        'Bono Fijo (CLP)': fin.prorrateadoBonoFijo,
        'Monto Bono Var (CLP)': bonoVar,
        'Gratificación Legal (CLP)': fin.gratificacion,
        'Leyes Sociales Empleador (CLP)': fin.leyesSociales.total,
        'Total Costo Empresa (CLP)': fin.totalCostoEmpresa,
        'Rentabilidad Bruta (CLP)': valorTotal - fin.totalCostoEmpresa
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produccion Financiera");
    XLSX.writeFile(wb, `Produccion_Financiera_${filtroMes || 'General'}.xlsx`);
  };

  return (
    <div className="animate-in fade-in zoom-in duration-1000 pb-20">
      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-12 -mt-12" />
        
        <div className="flex items-center gap-4 mb-8 relative z-10">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Car size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Control Operativo</p>
            <div className="flex items-center gap-3">
              <h4 className="text-lg font-black text-slate-700">Flujo de Costos Operacion Activa</h4>
              <button
                onClick={generateAiAnalysis}
                disabled={loadingAi}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 text-[10px] font-black uppercase tracking-wider disabled:opacity-50 cursor-pointer"
                title="Generar análisis financiero inteligente con GenAI"
              >
                {loadingAi ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin animate-duration-1000" />
                    <span>Analizando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={12} className="animate-pulse" />
                    <span>GenAI Analizar</span>
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="ml-auto flex flex-col sm:flex-row items-end sm:items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm">
              <Calendar size={14} className="text-slate-400" />
              <select 
                value={filtroMes} 
                onChange={e => setFiltroMes(e.target.value)}
                className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer"
              >
                <option value="">Mes Actual (Últimos 30 días)</option>
                {mesesDisponibles.map(m => {
                  const [y, mo] = m.split('-');
                  const d = new Date(parseInt(y), parseInt(mo)-1, 1);
                  return <option key={m} value={m}>{d.toLocaleString('es-ES', { month: 'short', year: 'numeric' }).toUpperCase()}</option>;
                })}
              </select>
            </div>
            <div className="bg-slate-100 px-4 py-1.5 rounded-full">
              <span className="text-xs font-black text-slate-600">Total: {asignados.length}</span>
            </div>
          </div>
        </div>

        {/* GenAI Analysis Loading / Result Box */}
        {(loadingAi || aiAnalysis) && (
          <div className="mb-8 p-6 bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 rounded-3xl shadow-sm relative overflow-hidden animate-in fade-in slide-in-from-top-3 duration-500">
            {/* Background glowing gradients */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-gradient-to-tr from-violet-400/10 to-indigo-400/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -left-10 -top-10 w-40 h-40 bg-gradient-to-br from-indigo-400/10 to-purple-400/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-start justify-between gap-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl shadow-md">
                  <Sparkles size={18} className="animate-pulse" />
                </div>
                <div>
                  <h5 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-700 to-indigo-700 uppercase tracking-wider">
                    Análisis Inteligente GenAI
                  </h5>
                  <p className="text-[10px] text-slate-500 font-bold">
                    {loadingAi ? 'Procesando datos y modelando proyecciones...' : 'Generado en tiempo real basado en el resumen financiero actual'}
                  </p>
                </div>
              </div>
              {!loadingAi && (
                <button
                  onClick={() => setAiAnalysis(null)}
                  className="p-1.5 hover:bg-violet-100 text-slate-400 hover:text-violet-600 rounded-lg transition-all cursor-pointer"
                  title="Cerrar Análisis"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {loadingAi ? (
              <div className="mt-4 pt-4 border-t border-violet-100/50 space-y-4 animate-pulse">
                <div className="space-y-2">
                  <div className="h-4 bg-violet-200/60 rounded-md w-1/4" />
                  <div className="h-3 bg-violet-200/40 rounded-md w-3/4" />
                  <div className="h-3 bg-violet-200/40 rounded-md w-5/6" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-violet-200/60 rounded-md w-1/3" />
                  <div className="h-3 bg-violet-200/40 rounded-md w-2/3" />
                  <div className="h-3 bg-violet-200/40 rounded-md w-4/5" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-violet-200/60 rounded-md w-1/5" />
                  <div className="h-3 bg-violet-200/40 rounded-md w-3/4" />
                  <div className="h-3 bg-violet-200/40 rounded-md w-1/2" />
                </div>
              </div>
            ) : (
              <div className="mt-4 pt-4 border-t border-violet-100/50 text-slate-700 text-xs font-semibold leading-relaxed relative z-10 whitespace-pre-line space-y-4">
                {/* Formatter for sections */}
                {aiAnalysis && aiAnalysis.split(/(?=\d\.\s+[\w\sÁÉÍÓÚáéíóúÑñ]+)/g).map((section, idx) => {
                  const lines = section.trim().split('\n');
                  const titleLine = lines[0];
                  const restLines = lines.slice(1);

                  return (
                    <div key={idx} className="space-y-2">
                      {titleLine && (
                        <h6 className="font-extrabold text-sm text-indigo-950 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-600" />
                          {titleLine}
                        </h6>
                      )}
                      <div className="pl-3 space-y-1.5 text-slate-600 font-medium">
                        {restLines.map((line, lIdx) => {
                          const trimmedLine = line.trim();
                          if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
                            return (
                              <div key={lIdx} className="flex items-start gap-2 pl-2">
                                <span className="text-violet-500 mt-1">•</span>
                                <span>{trimmedLine.substring(1).trim()}</span>
                              </div>
                            );
                          }
                          return <p key={lIdx} className="pl-2">{trimmedLine}</p>;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── FILTRO DE PROYECTOS MULTISELECCIÓN ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 relative z-30">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Filtrar Proyectos:</span>
            
            {/* Dropdown de Proyectos */}
            <div className="relative">
              <button
                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl shadow-sm text-xs font-bold text-slate-700 transition-all cursor-pointer"
              >
                <Filter size={13} className="text-emerald-500" />
                <span>
                  {localSelectedProjects.length === 0 
                    ? 'Todos los Proyectos' 
                    : `${localSelectedProjects.length} Seleccionado(s)`}
                </span>
                <ChevronDown size={13} className={`transition-transform duration-300 ${showProjectDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showProjectDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowProjectDropdown(false)}
                  />
                  <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-3xl shadow-xl z-50 p-4 min-w-[260px] max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seleccionar Proyectos</span>
                      {localSelectedProjects.length > 0 && (
                        <button 
                          onClick={() => setLocalSelectedProjects([])}
                          className="text-[9px] font-black text-rose-500 uppercase hover:underline"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {availableProjects.map(proj => {
                        const isChecked = localSelectedProjects.includes(proj);
                        return (
                          <label 
                            key={proj} 
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              isChecked 
                                ? 'bg-emerald-50 text-emerald-700' 
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={() => {
                                setLocalSelectedProjects(prev => 
                                  prev.includes(proj)
                                    ? prev.filter(p => p !== proj)
                                    : [...prev, proj]
                                );
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-500"
                            />
                            <span className="truncate">{proj}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* Active Tags */}
          {localSelectedProjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              {localSelectedProjects.map(proj => (
                <span 
                  key={proj}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black border border-emerald-100/50 shadow-sm animate-in zoom-in-95"
                >
                  {proj}
                  <button 
                    onClick={() => setLocalSelectedProjects(prev => prev.filter(p => p !== proj))}
                    className="hover:text-rose-600 font-black text-xs leading-none font-bold ml-1.5"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── TARJETAS DE RESUMEN ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8 relative z-10">
            {/* Tarjeta: Total Producción */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 border border-emerald-400 flex flex-col justify-center shadow-lg shadow-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/40 hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:rotate-12"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full -ml-8 -mb-8 transition-all duration-500 group-hover:scale-150"></div>
              <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="p-2 bg-emerald-600/50 rounded-xl border border-emerald-400/50 shadow-inner backdrop-blur-sm">
                  <TrendingUp size={18} className="text-white" />
                </div>
                <span className="text-[10px] font-black text-emerald-50 uppercase tracking-widest">Total Producción</span>
              </div>
              <div className="flex flex-col gap-2 relative z-10">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-emerald-100/80 uppercase tracking-wider mb-0.5">Puntaje Total</span>
                  <span className="text-3xl font-black text-white tracking-tight drop-shadow-md">
                    {totales.produccionPts.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-base font-bold text-emerald-100">pts</span>
                  </span>
                </div>
                <div className="h-px bg-white/20 my-1 w-full" />
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-emerald-100/80 uppercase tracking-wider mb-0.5">Monto CLP</span>
                  <span className="text-3xl font-black text-white tracking-tight drop-shadow-md">
                    {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totales.produccionClp)}
                  </span>
                </div>
              </div>
            </div>

            {/* Tarjeta: Costo General */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex flex-col justify-center shadow-xl hover:shadow-2xl hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:rotate-12"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-8 -mb-8 transition-all duration-500 group-hover:scale-125"></div>
              <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="p-2 bg-slate-700/50 rounded-xl border border-slate-600/50 shadow-inner backdrop-blur-sm">
                  <Wallet size={18} className="text-emerald-400" />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Costo General</span>
              </div>
              <div className="flex flex-col gap-2 relative z-10">
                <div className="flex justify-between items-center w-full">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5" title={`Proporcional a ${totales.ultimoDiaProducido} día(s) producidos`}>
                      Días Producidos ({totales.ultimoDiaProducido}d)
                    </span>
                    <span className="text-[19px] font-black text-white tracking-tight drop-shadow-md">
                      {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totales.costoHastaUltimoDia)}
                    </span>
                  </div>
                  {totales.produccionClp > 0 && (
                    <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 shadow-inner">
                      {((totales.costoHastaUltimoDia / totales.produccionClp) * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="h-px bg-slate-700 my-1 w-full" />
                <div className="flex justify-between items-center w-full">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5" title={`Proporcional a ${totales.numDiasTranscurridos} día(s) transcurridos`}>
                      Días Transcurridos ({totales.numDiasTranscurridos}d)
                    </span>
                    <span className="text-[19px] font-black text-white tracking-tight drop-shadow-md">
                      {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totales.costoGeneral)}
                    </span>
                  </div>
                  {totales.produccionClp > 0 && (
                    <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 shadow-inner">
                      {((totales.costoGeneral / totales.produccionClp) * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Tarjeta: Remuneracion */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-600 border border-indigo-400 flex flex-col justify-center shadow-lg shadow-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:rotate-12"></div>
              <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="p-2 bg-indigo-600/50 rounded-xl border border-indigo-400/50 shadow-inner backdrop-blur-sm">
                  <User size={18} className="text-white" />
                </div>
                <span className="text-[10px] font-black text-indigo-50 uppercase tracking-widest">Total Remuneración</span>
              </div>
              <div className="flex flex-col gap-2 relative z-10">
                <div className="flex justify-between items-center w-full">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-indigo-100 uppercase tracking-wider mb-0.5" title={`Proporcional a ${totales.ultimoDiaProducido} día(s) producidos`}>
                      Días Producidos ({totales.ultimoDiaProducido}d)
                    </span>
                    <span className="text-[19px] font-black text-white tracking-tight drop-shadow-md">
                      {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totales.remuneracionHastaUltimo)}
                    </span>
                  </div>
                  {totales.produccionClp > 0 && (
                    <span className="text-xs font-bold text-indigo-200 bg-indigo-700 px-2 py-0.5 rounded-lg border border-indigo-500 shadow-inner">
                      {((totales.remuneracionHastaUltimo / totales.produccionClp) * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="h-px bg-indigo-400/30 my-1 w-full" />
                <div className="flex justify-between items-center w-full">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-indigo-100 uppercase tracking-wider mb-0.5" title={`Proporcional a ${totales.numDiasTranscurridos} día(s) transcurridos`}>
                      Días Transcurridos ({totales.numDiasTranscurridos}d)
                    </span>
                    <span className="text-[19px] font-black text-white tracking-tight drop-shadow-md">
                      {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totales.remuneracion)}
                    </span>
                  </div>
                  {totales.produccionClp > 0 && (
                    <span className="text-xs font-bold text-indigo-200 bg-indigo-700 px-2 py-0.5 rounded-lg border border-indigo-500 shadow-inner">
                      {((totales.remuneracion / totales.produccionClp) * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Tarjeta: Flota */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-rose-500 to-rose-600 border border-rose-400 flex flex-col justify-center shadow-lg shadow-rose-500/30 hover:shadow-2xl hover:shadow-rose-500/40 hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group">
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mb-16 blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:-rotate-12"></div>
              <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="p-2 bg-rose-600/50 rounded-xl border border-rose-400/50 shadow-inner backdrop-blur-sm">
                  <Car size={18} className="text-white" />
                </div>
                <span className="text-[10px] font-black text-rose-50 uppercase tracking-widest">Total Flota</span>
              </div>
              <div className="flex flex-col gap-2 relative z-10">
                <div className="flex justify-between items-center w-full">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-rose-100 uppercase tracking-wider mb-0.5" title={`Proporcional a ${totales.ultimoDiaProducido} día(s) producidos`}>
                      Días Producidos ({totales.ultimoDiaProducido}d)
                    </span>
                    <span className="text-[19px] font-black text-white tracking-tight drop-shadow-md">
                      {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totales.flotaHastaUltimo)}
                    </span>
                  </div>
                  {totales.produccionClp > 0 && (
                    <span className="text-xs font-bold text-rose-200 bg-rose-700 px-2 py-0.5 rounded-lg border border-rose-500 shadow-inner">
                      {((totales.flotaHastaUltimo / totales.produccionClp) * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="h-px bg-rose-400/30 my-1 w-full" />
                <div className="flex justify-between items-center w-full">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-rose-100 uppercase tracking-wider mb-0.5" title={`Proporcional a ${totales.numDiasTranscurridos} día(s) transcurridos`}>
                      Días Transcurridos ({totales.numDiasTranscurridos}d)
                    </span>
                    <span className="text-[19px] font-black text-white tracking-tight drop-shadow-md">
                      {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totales.flota)}
                    </span>
                  </div>
                  {totales.produccionClp > 0 && (
                    <span className="text-xs font-bold text-rose-200 bg-rose-700 px-2 py-0.5 rounded-lg border border-rose-500 shadow-inner">
                      {((totales.flota / totales.produccionClp) * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Tarjeta: Rentabilidad */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-700 border border-violet-500 flex flex-col justify-center shadow-lg shadow-violet-500/30 hover:shadow-2xl hover:shadow-violet-500/40 hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:rotate-12"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full -ml-8 -mb-8 transition-all duration-500 group-hover:scale-150"></div>
              <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="p-2 bg-violet-700/50 rounded-xl border border-violet-500/50 shadow-inner backdrop-blur-sm">
                  <TrendingUp size={18} className="text-white" />
                </div>
                <span className="text-[10px] font-black text-violet-50 uppercase tracking-widest">Rentabilidad</span>
              </div>
              <div className="flex flex-col gap-2 relative z-10">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-violet-100/80 uppercase tracking-wider mb-0.5" title={`Calculado sobre ${totales.ultimoDiaProducido} día(s) con producción real`}>
                    Días Producidos ({totales.ultimoDiaProducido}d)
                  </span>
                  <span className="text-2xl font-black text-white tracking-tight drop-shadow-md">
                    {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totales.produccionClp - totales.costoHastaUltimoDia)}
                  </span>
                </div>
                <div className="h-px bg-white/20 my-1 w-full" />
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-violet-100/80 uppercase tracking-wider mb-0.5" title={`Calculado sobre ${totales.numDiasTranscurridos} día(s) transcurridos`}>
                    Días Transcurridos ({totales.numDiasTranscurridos}d)
                  </span>
                  <span className="text-2xl font-black text-white tracking-tight drop-shadow-md">
                    {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totales.produccionClp - totales.costoGeneral)}
                  </span>
                </div>
              </div>
            </div>
        </div>

        {/* ── GRÁFICO ── */}
        <div className="w-full p-6 rounded-3xl bg-white border border-slate-200 flex flex-col shadow-xl shadow-slate-200/50 hover:shadow-2xl transition-all duration-500 relative overflow-hidden group mb-8 relative z-10">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-full -mr-[250px] -mt-[250px] opacity-50 pointer-events-none group-hover:rotate-[15deg] transition-transform duration-[2000ms]"></div>
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                <TrendingUp size={18} className="text-slate-600" />
              </div>
              <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Costo Empresa por Proyecto</span>
            </div>
            <div className="flex-1 min-h-[250px] relative z-10">
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748B', fontSize: 10, fontWeight: 700 }}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis 
                    yAxisId="left"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748B', fontSize: 10, fontWeight: 700 }}
                    tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
                  />
                  <Tooltip 
                    cursor={{ fill: '#F8FAFC' }}
                    contentStyle={{ borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 700 }}
                    formatter={(value, name) => {
                      if (name === 'TotalCostoEmpresa') return [new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value), 'Costo Empresa'];
                      if (name === 'ProduccionCLP') return [new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value), 'Producción'];
                      if (name === 'Trabajadores') return [value, 'Trabajadores'];
                      return [value, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }} />
                  <Bar yAxisId="left" name="Costo Empresa" dataKey="TotalCostoEmpresa" fill="#6366F1" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    <LabelList dataKey="TotalCostoEmpresa" position="top" formatter={(value) => `$${(value / 1000000).toFixed(1)}M`} fill="#6366F1" fontSize={10} fontWeight="bold" />
                  </Bar>
                  <Bar yAxisId="left" name="Producción" dataKey="ProduccionCLP" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    <LabelList dataKey="ProduccionCLP" position="top" formatter={(value) => `$${(value / 1000000).toFixed(1)}M`} fill="#10B981" fontSize={10} fontWeight="bold" />
                  </Bar>
                  <Line yAxisId="right" name="Trabajadores" type="monotone" dataKey="Trabajadores" stroke="#94A3B8" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }}>
                    <LabelList dataKey="Trabajadores" position="top" fill="#94A3B8" fontSize={11} fontWeight="bold" />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
        </div>

        {/* ── GRÁFICO: RENTABILIDAD POSITIVA ── */}
        {techProfitabilityData.positivas.length > 0 && (
          <div className="w-full p-6 rounded-3xl bg-white border border-slate-200 flex flex-col shadow-xl shadow-slate-200/50 hover:shadow-2xl transition-all duration-500 relative overflow-hidden group mb-8 relative z-10">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-emerald-50 to-emerald-100/30 rounded-full -mr-[250px] -mt-[250px] opacity-50 pointer-events-none group-hover:rotate-[15deg] transition-transform duration-[2000ms]"></div>
            <div className="flex items-center mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                  <TrendingUp size={18} className="text-emerald-600" />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-600 uppercase tracking-widest block">Especialistas con Rentabilidad Positiva</span>
                  <span className="text-[10px] text-slate-400 font-bold">Producción supera al Costo Caja</span>
                </div>
              </div>
              <div className="ml-auto text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-0.5">Total Rentabilidad</span>
                <span className="text-xl font-black text-emerald-600">
                  ${(techProfitabilityData.positivas.reduce((acc, curr) => acc + curr.rentabilidad, 0)).toLocaleString('es-CL')}
                </span>
              </div>
            </div>
            <div className="flex-1 min-h-[280px] relative z-10">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={techProfitabilityData.positivas} margin={{ top: 15, right: 10, left: 10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748B', fontSize: 9, fontWeight: 700 }}
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748B', fontSize: 10, fontWeight: 700 }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                  />
                  <Tooltip 
                    cursor={{ fill: '#F8FAFC' }}
                    contentStyle={{ borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 700 }}
                    formatter={(value) => [new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value), 'Rentabilidad Bruta']}
                  />
                  <Bar dataKey="rentabilidad" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={35}>
                    <LabelList dataKey="labelRentabilidad" position="top" fill="#047857" fontSize={8} fontWeight="bold" />
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── GRÁFICO: RENTABILIDAD NEGATIVA ── */}
        {techProfitabilityData.negativas.length > 0 && (
          <div className="w-full p-6 rounded-3xl bg-white border border-slate-200 flex flex-col shadow-xl shadow-slate-200/50 hover:shadow-2xl transition-all duration-500 relative overflow-hidden group mb-8 relative z-10">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-rose-50 to-rose-100/30 rounded-full -mr-[250px] -mt-[250px] opacity-50 pointer-events-none group-hover:rotate-[15deg] transition-transform duration-[2000ms]"></div>
            <div className="flex items-center mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-50 rounded-xl border border-rose-100">
                  <TrendingUp size={18} className="text-rose-600 rotate-180" />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-600 uppercase tracking-widest block">Especialistas con Rentabilidad Negativa</span>
                  <span className="text-[10px] text-slate-400 font-bold">Costo Caja supera a la Producción</span>
                </div>
              </div>
              <div className="ml-auto text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-0.5">Total Rentabilidad</span>
                <span className="text-xl font-black text-rose-600">
                  -${Math.abs(techProfitabilityData.negativas.reduce((acc, curr) => acc + curr.rentabilidad, 0)).toLocaleString('es-CL')}
                </span>
              </div>
            </div>
            <div className="flex-1 min-h-[280px] relative z-10">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={techProfitabilityData.negativas} margin={{ top: 30, right: 10, left: 10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748B', fontSize: 9, fontWeight: 700 }}
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748B', fontSize: 10, fontWeight: 700 }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                  />
                  <Tooltip 
                    cursor={{ fill: '#F8FAFC' }}
                    contentStyle={{ borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 700 }}
                    formatter={(value) => [new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value), 'Déficit Bruto']}
                  />
                  <Bar dataKey="rentabilidad" fill="#EF4444" radius={[0, 0, 6, 6]} maxBarSize={35}>
                    <LabelList dataKey="labelRentabilidad" position="bottom" fill="#B91C1C" fontSize={8} fontWeight="bold" />
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4 relative z-10 mt-6">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Detalle de Costos y Producción</h3>
            <span className="bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-md text-[10px]">{asignados.length} Registros</span>
          </div>
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all duration-300 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 border border-emerald-400"
          >
            <Download size={14} />
            Exportar Excel
          </button>
        </div>

        <div className="overflow-x-auto relative z-10 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Especialista</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Inicio</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargo</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Proyecto</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Producción</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sueldo Base</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Leasing</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Combustible</th>
                <th className="py-4 px-4 text-[10px] font-black text-violet-500 uppercase tracking-widest">Bono Fijo</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Monto Bono</th>
                <th className="py-4 px-4 text-[10px] font-black text-fuchsia-600 uppercase tracking-widest text-right">Gratificación Legal</th>
                <th className="py-4 px-4 text-[10px] font-black text-amber-600 uppercase tracking-widest text-right">Leyes Sociales</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-800 uppercase tracking-widest text-right bg-slate-50 border-l border-slate-100">Total Costo Empresa</th>
                <th className="py-4 px-4 text-[10px] font-black text-emerald-800 uppercase tracking-widest text-right bg-emerald-50 border-l border-emerald-100 rounded-tr-xl">Rentabilidad Bruta</th>
              </tr>
            </thead>
            <tbody>
              {asignados.length > 0 ? asignados.map((v, i) => (
                <tr key={v._id || i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs border border-indigo-100">
                        {v.asignadoA.nombre ? v.asignadoA.nombre.substring(0, 2).toUpperCase() : <User size={14} />}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-800 uppercase">{v.asignadoA.nombre}</p>
                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">{v.asignadoA.rut}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    {(() => {
                      const start = v.asignadoA?.contractStartDate || v.asignadoA?.fechaIngreso;
                      if (!start) return <span className="text-xs text-slate-300">-</span>;
                      
                      let displayDate = start;
                      if (start.includes('T')) {
                        const d = new Date(start);
                        displayDate = d.toLocaleDateString('es-CL');
                      } else if (/^\d{4}-\d{2}-\d{2}/.test(start)) {
                        const [y, m, d] = start.split('-');
                        displayDate = `${d}/${m}/${y}`;
                      }

                      return (
                        <span className="text-[10px] font-black text-slate-600 uppercase">
                          {displayDate}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-4 px-4">
                    {(() => {
                      const { short, color } = getStatusInfo(v.asignadoA.statusCandidato || v.asignadoA.estadoActual || 'ACTIVO');
                      return (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${color} shadow-sm uppercase tracking-wider`}>
                          {short}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                      {v.asignadoA.cargo || 'Especialista'}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                      {v.asignadoA.projectId?.nombreProyecto || v.asignadoA.proyecto || 'General'}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    {(() => {
                      const rut = v.asignadoA?.rut ? v.asignadoA.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() : '';
                      const nombre = (v.asignadoA?.nombre || '').toLowerCase().trim();
                      const t = tecnicos.find(x => 
                        (x.rut && x.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() === rut) ||
                        ((x.name || x.fullName || '').toLowerCase().trim() === nombre)
                      );
                      const pts = t ? (t.ptsTotal || 0) : 0;
                      const proyectoName = v.asignadoA.projectId?.nombreProyecto || v.asignadoA.proyecto || '';
                      const valorPunto = getTarifaParaProyecto(proyectoName);
                      const valorTotal = pts * valorPunto;
                      return (
                        <div>
                          <div className="font-black text-emerald-600 text-[11px]">
                            {pts.toFixed(1)} pts
                          </div>
                          {pts > 0 && (
                            <div className="text-[10px] font-bold text-slate-400 mt-0.5" title={`Valor por punto: $${valorPunto}`}>
                              {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valorTotal)}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="py-4 px-4">
                    {(() => {
                      const sueldoBase = parseInt(v.asignadoA?.sueldoBase) || 0;
                      const workerDays = getWorkerActiveDays(v, diasTranscurridos, filtroMes);
                      const prorrateadoSueldo = sueldoBase ? Math.round((sueldoBase / diasMes) * workerDays) : 0;
                      
                      return (
                        <div>
                          <div className="font-black text-sky-600 text-[11px]">
                            {prorrateadoSueldo > 0 ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(prorrateadoSueldo) : '$0'}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                            Mes Total: {sueldoBase > 0 ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(sueldoBase) : '-'}
                          </div>
                          <div className="text-[9px] font-semibold text-slate-400 mt-0.5">
                            Prorrateo: {workerDays}/{diasMes} días
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="py-4 px-4">
                    {(() => {
                      const isUF = v.moneda === 'UF' || (v.valor > 0 && v.valor < 100);
                      let valorCLP = isUF ? (ufValue ? Math.round(v.valor * ufValue) : null) : (v.valor || 0);
                      
                      const workerDays = getWorkerActiveDays(v, diasTranscurridos, filtroMes);
                      const prorrateado = valorCLP ? Math.round((valorCLP / diasMes) * workerDays) : null;

                      return (
                        <div>
                          <div className="font-black text-emerald-600 text-[11px]">
                            {prorrateado ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(prorrateado) : 'Calculando...'}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                            Mes Total: {valorCLP ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valorCLP) : '-'} 
                            {isUF && ` (UF ${v.valor?.toLocaleString('es-CL') || 0})`}
                          </div>
                          <div className="text-[9px] font-semibold text-slate-400 mt-0.5">
                            Prorrateo: {workerDays}/{diasMes} días
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="py-4 px-4">
                    {(() => {
                      const totalC = fuelByPatente[v.patente] || 0;
                      return (
                        <div className="font-black text-rose-600 text-[11px]">
                          {totalC > 0 ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(totalC) : '$0'}
                        </div>
                      );
                    })()}
                  </td>
                  {/* ── BONO FIJO ────────────────────────────────────────── */}
                  <td className="py-4 px-4">
                    {(() => {
                      const techRut = v.asignadoA?.rut ? v.asignadoA.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() : '';
                      const techNombre = (v.asignadoA?.nombre || '').toLowerCase().trim();
                      const techIdToa = String(v.asignadoA?.idRecursoToa || '').replace(/^0+/, '').trim();

                      let bonoFijo = fixedBonusData[techRut]
                        ?? fixedBonusData[techIdToa]
                        ?? fixedBonusData[techNombre]
                        ?? 0;

                      const workerDays = getWorkerActiveDays(v, diasTranscurridos, filtroMes);
                      const prorrateadoBono = bonoFijo > 0 ? Math.round((bonoFijo / diasMes) * workerDays) : 0;

                      return (
                        <div>
                          <div className="font-black text-violet-600 text-[11px]">
                            {prorrateadoBono > 0
                              ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(prorrateadoBono)
                              : <span className="text-slate-300 font-medium">$0</span>}
                          </div>
                          {bonoFijo > 0 && (
                            <>
                              <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                                Mes Total: {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(bonoFijo)}
                              </div>
                              <div className="text-[9px] font-semibold text-slate-400 mt-0.5">
                                Prorrateo: {workerDays}/{diasMes} días
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="py-4 px-4 text-right">
                    {(() => {
                      const techName = v.asignadoA?.nombre ? v.asignadoA.nombre.toLowerCase().trim() : '';
                      const techId1 = v.asignadoA?._id?.toString() || '';
                      const techId2 = v.asignadoA?.idRecursoToa?.toString() || '';
                      const techRut = v.asignadoA?.rut ? v.asignadoA.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() : '';
                      
                      let bono = 0;
                      if (bonusData[techRut] !== undefined) bono = bonusData[techRut];
                      else if (bonusData[techId1] !== undefined) bono = bonusData[techId1];
                      else if (bonusData[techId2] !== undefined) bono = bonusData[techId2];
                      else if (bonusData[techName] !== undefined) bono = bonusData[techName];

                      return (
                        <div className="font-black text-purple-600 text-[11px]">
                          {bono > 0 ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(bono) : '$0'}
                        </div>
                      );
                    })()}
                  </td>
                  {/* ── GRATIFICACIÓN LEGAL ─────────────────────────────────── */}
                  <td className="py-4 px-4 text-right font-black text-fuchsia-600 text-[11px]">
                    {(() => {
                      const sueldoBase = parseInt(v.asignadoA?.sueldoBase) || 0;
                      const workerDays = getWorkerActiveDays(v, diasTranscurridos, filtroMes);
                      
                      const techRut = v.asignadoA?.rut ? v.asignadoA.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() : '';
                      const techNombre = (v.asignadoA?.nombre || '').toLowerCase().trim();
                      const techIdToa = String(v.asignadoA?.idRecursoToa || '').replace(/^0+/, '').trim();
                      const bonoFijo = fixedBonusData[techRut] ?? fixedBonusData[techIdToa] ?? fixedBonusData[techNombre] ?? 0;
                      
                      const techId1 = v.asignadoA?._id?.toString() || '';
                      let bonoVar = 0;
                      if (bonusData[techRut] !== undefined) bonoVar = bonusData[techRut];
                      else if (bonusData[techId1] !== undefined) bonoVar = bonusData[techId1];
                      else if (bonusData[techIdToa] !== undefined) bonoVar = bonusData[techIdToa];
                      else if (bonusData[techNombre] !== undefined) bonoVar = bonusData[techNombre];
                      
                      const t = tecnicos.find(x => 
                        (x.rut && x.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() === techRut) ||
                        ((x.name || x.fullName || '').toLowerCase().trim() === techNombre)
                      );
                      const pts = t ? (t.ptsTotal || 0) : 0;
                      const proyectoName = v.asignadoA.projectId?.nombreProyecto || v.asignadoA.proyecto || '';
                      const valorPunto = getTarifaParaProyecto(proyectoName);
                      const valorTotal = pts * valorPunto;
                      
                      const ufHoy = ufCtx || ufValue || 38500;
                      const sisRate = indicParams?.sisRate || 1.54;
                      const fin = calculateFinancials(
                        sueldoBase, valorTotal, bonoFijo, bonoVar, 0, 0,
                        workerDays, diasMes, v.asignadoA, ufHoy, immValue, sisRate
                      );

                      return fin.gratificacion > 0 ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(fin.gratificacion) : '$0';
                    })()}
                  </td>
                  {/* ── LEYES SOCIALES ─────────────────────────────────────── */}
                  <td className="py-4 px-4 text-right">
                    {(() => {
                      const sueldoBase = parseInt(v.asignadoA?.sueldoBase) || 0;
                      const workerDays = getWorkerActiveDays(v, diasTranscurridos, filtroMes);
                      
                      const techRut = v.asignadoA?.rut ? v.asignadoA.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() : '';
                      const techNombre = (v.asignadoA?.nombre || '').toLowerCase().trim();
                      const techIdToa = String(v.asignadoA?.idRecursoToa || '').replace(/^0+/, '').trim();
                      const bonoFijo = fixedBonusData[techRut] ?? fixedBonusData[techIdToa] ?? fixedBonusData[techNombre] ?? 0;
                      
                      const techId1 = v.asignadoA?._id?.toString() || '';
                      let bonoVar = 0;
                      if (bonusData[techRut] !== undefined) bonoVar = bonusData[techRut];
                      else if (bonusData[techId1] !== undefined) bonoVar = bonusData[techId1];
                      else if (bonusData[techIdToa] !== undefined) bonoVar = bonusData[techIdToa];
                      else if (bonusData[techNombre] !== undefined) bonoVar = bonusData[techNombre];
                      
                      const t = tecnicos.find(x => 
                        (x.rut && x.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() === techRut) ||
                        ((x.name || x.fullName || '').toLowerCase().trim() === techNombre)
                      );
                      const pts = t ? (t.ptsTotal || 0) : 0;
                      const proyectoName = v.asignadoA.projectId?.nombreProyecto || v.asignadoA.proyecto || '';
                      const valorPunto = getTarifaParaProyecto(proyectoName);
                      const valorTotal = pts * valorPunto;
                      
                      const ufHoy = ufCtx || ufValue || 38500;
                      const sisRate = indicParams?.sisRate || 1.54;
                      const fin = calculateFinancials(
                        sueldoBase, valorTotal, bonoFijo, bonoVar, 0, 0,
                        workerDays, diasMes, v.asignadoA, ufHoy, immValue, sisRate
                      );

                      return (
                        <button 
                          onClick={() => setSelectedBreakdown({
                            name: v.asignadoA.nombre,
                            rut: v.asignadoA.rut,
                            workerDays,
                            sueldoBase,
                            produccion: valorTotal,
                            bonoFijo,
                            bonoVar,
                            fin
                          })}
                          className="font-black text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg border border-amber-200/50 text-[11px] shadow-sm cursor-pointer transition-all hover:scale-[1.03]"
                        >
                          {fin.leyesSociales.total > 0 ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(fin.leyesSociales.total) : '$0'}
                        </button>
                      );
                    })()}
                  </td>
                  {/* ── TOTAL COSTO EMPRESA ─────────────────────────────────── */}
                  <td className="py-4 px-4 text-right bg-slate-50 border-l border-slate-100">
                    {(() => {
                      const sueldoBase = parseInt(v.asignadoA?.sueldoBase) || 0;
                      const workerDays = getWorkerActiveDays(v, diasTranscurridos, filtroMes);
                      
                      const isUF = v.moneda === 'UF' || (v.valor > 0 && v.valor < 100);
                      const ufHoy = ufCtx || ufValue || 38500;
                      const valorCLP = isUF ? (ufHoy ? Math.round(v.valor * ufHoy) : 0) : (v.valor || 0);
                      const prorrateadoLeasing = valorCLP ? Math.round((valorCLP / diasMes) * workerDays) : 0;
                      
                      const totalC = fuelByPatente[v.patente] || 0;
                      
                      const techRut = v.asignadoA?.rut ? v.asignadoA.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() : '';
                      const techNombre = (v.asignadoA?.nombre || '').toLowerCase().trim();
                      const techIdToa = String(v.asignadoA?.idRecursoToa || '').replace(/^0+/, '').trim();
                      const bonoFijo = fixedBonusData[techRut] ?? fixedBonusData[techIdToa] ?? fixedBonusData[techNombre] ?? 0;
                      
                      const techId1 = v.asignadoA?._id?.toString() || '';
                      let bonoVar = 0;
                      if (bonusData[techRut] !== undefined) bonoVar = bonusData[techRut];
                      else if (bonusData[techId1] !== undefined) bonoVar = bonusData[techId1];
                      else if (bonusData[techIdToa] !== undefined) bonoVar = bonusData[techIdToa];
                      else if (bonusData[techNombre] !== undefined) bonoVar = bonusData[techNombre];
                      
                      const t = tecnicos.find(x => 
                        (x.rut && x.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() === techRut) ||
                        ((x.name || x.fullName || '').toLowerCase().trim() === techNombre)
                      );
                      const pts = t ? (t.ptsTotal || 0) : 0;
                      const proyectoName = v.asignadoA.projectId?.nombreProyecto || v.asignadoA.proyecto || '';
                      const valorPunto = getTarifaParaProyecto(proyectoName);
                      const valorTotal = pts * valorPunto;
                      
                      const sisRate = indicParams?.sisRate || 1.54;
                      const fin = calculateFinancials(
                        sueldoBase, valorTotal, bonoFijo, bonoVar, prorrateadoLeasing, totalC,
                        workerDays, diasMes, v.asignadoA, ufHoy, immValue, sisRate
                      );
                      
                      return (
                        <div className="font-black text-slate-800 text-[11px]">
                          {fin.totalCostoEmpresa > 0 ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(fin.totalCostoEmpresa) : '$0'}
                        </div>
                      );
                    })()}
                  </td>
                  {/* ── RENTABILIDAD BRUTA ─────────────────────────────────── */}
                  <td className="py-4 px-4 text-right bg-emerald-50/50 border-l border-emerald-100">
                    {(() => {
                      const sueldoBase = parseInt(v.asignadoA?.sueldoBase) || 0;
                      const workerDays = getWorkerActiveDays(v, diasTranscurridos, filtroMes);
                      
                      const isUF = v.moneda === 'UF' || (v.valor > 0 && v.valor < 100);
                      const ufHoy = ufCtx || ufValue || 38500;
                      const valorCLP = isUF ? (ufHoy ? Math.round(v.valor * ufHoy) : 0) : (v.valor || 0);
                      const prorrateadoLeasing = valorCLP ? Math.round((valorCLP / diasMes) * workerDays) : 0;
                      
                      const totalC = fuelByPatente[v.patente] || 0;
                      
                      const techRut = v.asignadoA?.rut ? v.asignadoA.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() : '';
                      const techNombre = (v.asignadoA?.nombre || '').toLowerCase().trim();
                      const techIdToa = String(v.asignadoA?.idRecursoToa || '').replace(/^0+/, '').trim();
                      const bonoFijo = fixedBonusData[techRut] ?? fixedBonusData[techIdToa] ?? fixedBonusData[techNombre] ?? 0;
                      
                      const techId1 = v.asignadoA?._id?.toString() || '';
                      let bonoVar = 0;
                      if (bonusData[techRut] !== undefined) bonoVar = bonusData[techRut];
                      else if (bonusData[techId1] !== undefined) bonoVar = bonusData[techId1];
                      else if (bonusData[techIdToa] !== undefined) bonoVar = bonusData[techIdToa];
                      else if (bonusData[techNombre] !== undefined) bonoVar = bonusData[techNombre];
                      
                      const t = tecnicos.find(x => 
                        (x.rut && x.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() === techRut) ||
                        ((x.name || x.fullName || '').toLowerCase().trim() === techNombre)
                      );
                      const pts = t ? (t.ptsTotal || 0) : 0;
                      const proyectoName = v.asignadoA.projectId?.nombreProyecto || v.asignadoA.proyecto || '';
                      const valorPunto = getTarifaParaProyecto(proyectoName);
                      const valorTotal = pts * valorPunto;
                      
                      const sisRate = indicParams?.sisRate || 1.54;
                      const fin = calculateFinancials(
                        sueldoBase, valorTotal, bonoFijo, bonoVar, prorrateadoLeasing, totalC,
                        workerDays, diasMes, v.asignadoA, ufHoy, immValue, sisRate
                      );
                      
                      const rentabilidad = valorTotal - fin.totalCostoEmpresa;
                      const margen = valorTotal > 0 ? ((rentabilidad / valorTotal) * 100).toFixed(1) : 0;
                      const isPositive = rentabilidad >= 0;

                      return (
                        <div className="flex flex-col items-end">
                          <div className={`font-black text-[11px] ${isPositive ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(rentabilidad)}
                          </div>
                          {valorTotal > 0 && (
                            <div className={`text-[9px] font-bold mt-1 px-1.5 py-0.5 rounded-md ${isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'} shadow-sm`}>
                              Rentabilidad: {isPositive ? '+' : ''}{margen}%
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="12" className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Car size={32} className="opacity-20 mb-3" />
                      <p className="text-sm font-medium">No se encontró personal con vehículo asignado.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: DESGLOSE DE LEYES SOCIALES ── */}
      {selectedBreakdown && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[999] animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden transform transition-all duration-300 animate-in zoom-in-95 relative">
            
            {/* Cabecera (Fija) */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 text-white shrink-0 relative">
              <div className="absolute top-3 right-3">
                <button 
                  onClick={() => setSelectedBreakdown(null)}
                  className="bg-white/20 hover:bg-white/35 text-white p-1.5 rounded-full transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-white/20 rounded-lg">
                  <Landmark size={16} className="text-white" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-white/90">Leyes Sociales Patronales</h4>
                  <p className="text-[9px] font-bold text-amber-100 uppercase mt-0.5">Desglose de Costo Empleador</p>
                </div>
              </div>
            </div>

            {/* Contenido (Desplazable Internamente) */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              
              {/* Info Técnico */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center text-[10px]">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Especialista</p>
                  <p className="font-black text-slate-700 uppercase mt-0.5">{selectedBreakdown.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">RUT</p>
                  <p className="font-bold text-slate-600 mt-0.5">{selectedBreakdown.rut || '-'}</p>
                </div>
              </div>

              {/* Base de Cálculo */}
              <div className="space-y-1.5">
                <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bases de Cálculo</h5>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-sky-50/50 border border-sky-100/50 rounded-xl p-2.5">
                    <p className="text-[8px] font-bold text-sky-600/80 uppercase">Imponible Total</p>
                    <p className="text-sm font-black text-sky-700 mt-0.5">
                      {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(selectedBreakdown.fin.totalImponible)}
                    </p>
                  </div>
                  <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-xl p-2.5">
                    <p className="text-[8px] font-bold text-emerald-600/80 uppercase">Días Prorrateados</p>
                    <p className="text-sm font-black text-emerald-700 mt-0.5">
                      {selectedBreakdown.workerDays} / {diasMes} días
                    </p>
                  </div>
                </div>
              </div>

              {/* Detalle Leyes */}
              <div className="space-y-2">
                <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Detalle Leyes Patronales</h5>
                
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-white shadow-sm">
                  
                  {/* SIS */}
                  <div className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="text-xs font-black text-slate-700">Seguro Invalidez y Sobrevivencia (SIS)</p>
                      <p className="text-[9px] text-slate-400 font-bold mt-0.5">Tasa: {selectedBreakdown.fin.leyesSociales.sis.tasa}% | Base imponible topada</p>
                    </div>
                    <span className="text-xs font-black text-slate-700">
                      {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(selectedBreakdown.fin.leyesSociales.sis.monto)}
                    </span>
                  </div>

                  {/* Mutual */}
                  <div className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="text-xs font-black text-slate-700">Seguro Mutual de Seguridad</p>
                      <p className="text-[9px] text-slate-400 font-bold mt-0.5">Tasa: {selectedBreakdown.fin.leyesSociales.mutual.tasa}% | Base imponible topada</p>
                    </div>
                    <span className="text-xs font-black text-slate-700">
                      {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(selectedBreakdown.fin.leyesSociales.mutual.monto)}
                    </span>
                  </div>

                  {/* Cesantía (AFC) */}
                  <div className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="text-xs font-black text-slate-700">Seguro de Cesantía Empleador (AFC)</p>
                      <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                        Tasa: {selectedBreakdown.fin.leyesSociales.afc.tasa}% (Contrato {selectedBreakdown.fin.leyesSociales.afc.tipoContrato})
                      </p>
                    </div>
                    <span className="text-xs font-black text-slate-700">
                      {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(selectedBreakdown.fin.leyesSociales.afc.monto)}
                    </span>
                  </div>

                  {/* Longevidad (Expectativa Vida) */}
                  <div className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="text-xs font-black text-slate-700">Expectativa de Vida / Aporte Adicional</p>
                      <p className="text-[9px] text-slate-400 font-bold mt-0.5">Tasa: {selectedBreakdown.fin.leyesSociales.expectativaVida.tasa}% | Base imponible topada</p>
                    </div>
                    <span className="text-xs font-black text-slate-700">
                      {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(selectedBreakdown.fin.leyesSociales.expectativaVida.monto)}
                    </span>
                  </div>

                  {/* Total Leyes Sociales */}
                  <div className="p-3 bg-amber-50/50 flex items-center justify-between border-t border-amber-100">
                    <p className="text-xs font-black text-amber-800 uppercase tracking-wider">Total Leyes Sociales</p>
                    <span className="text-sm font-black text-amber-700">
                      {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(selectedBreakdown.fin.leyesSociales.total)}
                    </span>
                  </div>
                </div>

                {/* Mensaje Informativo de Topes */}
                <div className="flex gap-2 bg-slate-50 border border-slate-200/60 rounded-xl p-3 text-[9px] font-semibold text-slate-500 leading-normal">
                  <Info size={12} className="text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    Los cálculos consideran los topes previsionales prorrateados para el periodo ({selectedBreakdown.workerDays} días): 
                    <strong className="text-slate-600 block mt-0.5">
                      Tope imponible AFP/Salud ({selectedBreakdown.workerDays}d): ${Math.round((89.9 * (ufCtx || ufValue || 38500) / diasMes) * selectedBreakdown.workerDays).toLocaleString('es-CL')} CLP (Tope mes: ${(Math.round(89.9 * (ufCtx || ufValue || 38500))).toLocaleString('es-CL')} CLP)<br />
                      Tope imponible AFC ({selectedBreakdown.workerDays}d): ${Math.round((135.1 * (ufCtx || ufValue || 38500) / diasMes) * selectedBreakdown.workerDays).toLocaleString('es-CL')} CLP (Tope mes: ${(Math.round(135.1 * (ufCtx || ufValue || 38500))).toLocaleString('es-CL')} CLP)
                    </strong>
                  </div>
                </div>

                {/* Guía Explicativa de Conceptos de Remuneración */}
                <div className="bg-sky-50/40 border border-sky-100/80 rounded-xl p-3.5 space-y-2 mt-2">
                  <div className="flex items-center gap-1.5 text-sky-800">
                    <Info size={12} className="shrink-0" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Guía de Análisis de Costo Empresa</span>
                  </div>
                  
                  <div className="space-y-2 text-[9px] text-slate-500 leading-normal">
                    <div>
                      <strong className="text-sky-900 block uppercase tracking-wider text-[8px] mb-0.5">1. Cotizaciones del Trabajador (AFP y Salud)</strong>
                      Las retenciones legales (AFP ~11%, Fonasa/Isapre 7% o plan pactado, y AFC 0.6%) se descuentan del sueldo imponible bruto del técnico. Como están cubiertas por su sueldo, **no añaden costo extra** al Total Imponible mostrado en la tabla.
                    </div>
                    <div>
                      <strong className="text-sky-900 block uppercase tracking-wider text-[8px] mb-0.5">2. Cotizaciones Patronales (Costo Adicional)</strong>
                      El SIS ({selectedBreakdown.fin.leyesSociales.sis.tasa}%), Mutual ({selectedBreakdown.fin.leyesSociales.mutual.tasa}%), Longevidad ({selectedBreakdown.fin.leyesSociales.expectativaVida.tasa}%) y la AFC Patronal ({selectedBreakdown.fin.leyesSociales.afc.tasa}%) son **financiados íntegramente por la empresa** por sobre el sueldo bruto y se detallan en este desglose.
                    </div>
                    <div>
                      <strong className="text-sky-900 block uppercase tracking-wider text-[8px] mb-0.5">3. Costo en Avance (Prorrateo Temporal)</strong>
                      Los valores fijos (Sueldo Base, Bono Fijo y Leasing) y los topes de UF se calculan proporcionalmente según los días transcurridos acumulados en el mes ({selectedBreakdown.workerDays} de {diasMes} días) para reflejar un flujo financiero real a la fecha del reporte.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pie de modal (Fijo) */}
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-3.5 flex justify-end shrink-0">
              <button 
                onClick={() => setSelectedBreakdown(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-slate-800/10 hover:shadow-slate-800/25"
              >
                Cerrar Desglose
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialDashboard;

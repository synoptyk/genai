import React, { useMemo, useState, useEffect } from 'react';
import { Car, User, Calendar, Wallet, TrendingUp, Users, Download, ChevronDown, Filter } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, LabelList } from 'recharts';
import * as XLSX from 'xlsx';
import { telecomApi } from '../telecomApi';
import { getBonusForMonth, getBonosFijosForMonth } from '../utils/bonosCalculator';
import { getBaremo } from '../utils/financialUtils';
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

const FinancialDashboard = ({ vehiculos = [], searchTech = '', dashboardData = null, tecnicos = [], selectedMonths = [], setSelectedMonths }) => {
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
        fechaIngreso: t.inicioContrato || null,
        contractStartDate: t.inicioContrato || null
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

    asignados.forEach(v => {
      const sueldoBase = parseInt(v.asignadoA?.sueldoBase) || 0;
      const prorrateadoSueldo = sueldoBase ? Math.round((sueldoBase / numDiasMes) * numDiasTranscurridos) : 0;
      const sueldoHastaUltimo = sueldoBase ? Math.round((sueldoBase / numDiasMes) * ultimoDiaProducido) : 0;
      
      const isUF = v.moneda === 'UF' || (v.valor > 0 && v.valor < 100);
      const valorCLP = isUF ? (ufValue ? Math.round(v.valor * ufValue) : 0) : (v.valor || 0);
      const prorrateadoLeasing = valorCLP ? Math.round((valorCLP / numDiasMes) * numDiasTranscurridos) : 0;
      const leasingHastaUltimo = valorCLP ? Math.round((valorCLP / numDiasMes) * ultimoDiaProducido) : 0;
      
      const totalC = fuelByPatente[v.patente] || 0;
      const fuelHastaUltimo = totalC ? Math.round((totalC / numDiasMes) * ultimoDiaProducido) : 0;
      
      const techRut = v.asignadoA?.rut ? v.asignadoA.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() : '';
      const techNombre = (v.asignadoA?.nombre || '').toLowerCase().trim();
      const techIdToa = String(v.asignadoA?.idRecursoToa || '').replace(/^0+/, '').trim();
      const bonoFijo = fixedBonusData[techRut] ?? fixedBonusData[techIdToa] ?? fixedBonusData[techNombre] ?? 0;
      const prorrateadoBonoFijo = bonoFijo > 0 ? Math.round((bonoFijo / numDiasMes) * numDiasTranscurridos) : 0;
      const bonoFijoHastaUltimo = bonoFijo > 0 ? Math.round((bonoFijo / numDiasMes) * ultimoDiaProducido) : 0;
      
      const techId1 = v.asignadoA?._id?.toString() || '';
      let bonoVar = 0;
      if (bonusData[techRut] !== undefined) bonoVar = bonusData[techRut];
      else if (bonusData[techId1] !== undefined) bonoVar = bonusData[techId1];
      else if (bonusData[techIdToa] !== undefined) bonoVar = bonusData[techIdToa];
      else if (bonusData[techNombre] !== undefined) bonoVar = bonusData[techNombre];
      
      const sumRemu = prorrateadoSueldo + prorrateadoBonoFijo + bonoVar;
      const sumFlota = prorrateadoLeasing + totalC;
      const totalCaja = sumRemu + sumFlota;

      const sumRemuHastaUltimo = sueldoHastaUltimo + bonoFijoHastaUltimo + bonoVar;
      const sumFlotaHastaUltimo = leasingHastaUltimo + fuelHastaUltimo;
      const totalCajaHastaUltimo = sumRemuHastaUltimo + sumFlotaHastaUltimo;

      remuneracion += sumRemu;
      remuneracionHastaUltimo += sumRemuHastaUltimo;
      flota += sumFlota;
      flotaHastaUltimo += sumFlotaHastaUltimo;
      costoGeneral += totalCaja;
      costoHastaUltimoDia += totalCajaHastaUltimo;

      const rut = v.asignadoA?.rut ? v.asignadoA.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() : '';
      const nombre = (v.asignadoA?.nombre || '').toLowerCase().trim();
      const t = tecnicos.find(x => 
        (x.rut && x.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() === rut) ||
        ((x.name || x.fullName || '').toLowerCase().trim() === nombre)
      );
      const pts = t ? (t.ptsTotal || 0) : 0;
      const proyecto = v.asignadoA.projectId?.nombreProyecto || v.asignadoA.proyecto || 'General';
      const valorPunto = getTarifaParaProyecto(proyecto);
      produccionClp += pts * valorPunto;
      produccionPts += pts;

      if (!costoPorProyecto[proyecto]) costoPorProyecto[proyecto] = { total: 0, count: 0, produccion: 0 };
      costoPorProyecto[proyecto].total += totalCaja;
      costoPorProyecto[proyecto].count += 1;
      costoPorProyecto[proyecto].produccion += (pts * valorPunto);
    });

    const chart = Object.entries(costoPorProyecto)
      .map(([name, data]) => ({ name, TotalCostoCaja: data.total, Trabajadores: data.count, ProduccionCLP: data.produccion }))
      .sort((a, b) => b.TotalCostoCaja - a.TotalCostoCaja);

    return { totales: { costoGeneral, costoHastaUltimoDia, remuneracion, remuneracionHastaUltimo, flota, flotaHastaUltimo, produccionClp, produccionPts, ultimoDiaProducido, numDiasTranscurridos }, chartData: chart };
  }, [asignados, diasMes, diasTranscurridos, ufValue, fuelByPatente, fixedBonusData, bonusData, tecnicos, ultimoDiaProducido]);

  const techProfitabilityData = useMemo(() => {
    const list = asignados.map(v => {
      const sueldoBase = parseInt(v.asignadoA?.sueldoBase) || 0;
      const workerDays = getWorkerActiveDays(v, diasTranscurridos, filtroMes);
      const prorrateadoSueldo = sueldoBase ? Math.round((sueldoBase / diasMes) * workerDays) : 0;
      
      const isUF = v.moneda === 'UF' || (v.valor > 0 && v.valor < 100);
      const valorCLP = isUF ? (ufValue ? Math.round(v.valor * ufValue) : 0) : (v.valor || 0);
      const prorrateadoLeasing = valorCLP ? Math.round((valorCLP / diasMes) * workerDays) : 0;
      
      const totalC = fuelByPatente[v.patente] || 0;
      
      const techRut = v.asignadoA?.rut ? v.asignadoA.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() : '';
      const techNombre = (v.asignadoA?.nombre || '').toLowerCase().trim();
      const techIdToa = String(v.asignadoA?.idRecursoToa || '').replace(/^0+/, '').trim();
      const bonoFijo = fixedBonusData[techRut] ?? fixedBonusData[techIdToa] ?? fixedBonusData[techNombre] ?? 0;
      const prorrateadoBonoFijo = bonoFijo > 0 ? Math.round((bonoFijo / diasMes) * workerDays) : 0;
      
      const techId1 = v.asignadoA?._id?.toString() || '';
      let bonoVar = 0;
      if (bonusData[techRut] !== undefined) bonoVar = bonusData[techRut];
      else if (bonusData[techId1] !== undefined) bonoVar = bonusData[techId1];
      else if (bonusData[techIdToa] !== undefined) bonoVar = bonusData[techIdToa];
      else if (bonusData[techNombre] !== undefined) bonoVar = bonusData[techNombre];
      
      const totalCostoCaja = prorrateadoSueldo + prorrateadoLeasing + totalC + prorrateadoBonoFijo + bonoVar;

      const t = tecnicos.find(x => 
        (x.rut && x.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() === techRut) ||
        ((x.name || x.fullName || '').toLowerCase().trim() === techNombre)
      );
      const pts = t ? (t.ptsTotal || 0) : 0;
      const proyectoName = v.asignadoA.projectId?.nombreProyecto || v.asignadoA.proyecto || '';
      const valorPunto = getTarifaParaProyecto(proyectoName);
      const valorTotal = pts * valorPunto;
      
      const rentabilidad = valorTotal - totalCostoCaja;
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
        costo: totalCostoCaja,
        labelRentabilidad
      };
    });

    const positivas = list.filter(x => x.rentabilidad > 0).sort((a, b) => b.rentabilidad - a.rentabilidad);
    const negativas = list.filter(x => x.rentabilidad < 0).sort((a, b) => a.rentabilidad - b.rentabilidad);

    return { positivas, negativas };
  }, [asignados, diasMes, diasTranscurridos, ufValue, fuelByPatente, fixedBonusData, bonusData, tecnicos]);

  const exportToExcel = () => {
    const dataToExport = asignados.map(v => {
      const numDiasMes = parseInt(diasMes) || 30;
      const numDiasTranscurridos = parseInt(diasTranscurridos) || 1;
      
      const sueldoBase = parseInt(v.asignadoA?.sueldoBase) || 0;
      const workerDays = getWorkerActiveDays(v, numDiasTranscurridos, filtroMes);
      const prorrateadoSueldo = sueldoBase ? Math.round((sueldoBase / numDiasMes) * workerDays) : 0;
      
      const isUF = v.moneda === 'UF' || (v.valor > 0 && v.valor < 100);
      const valorCLP = isUF ? (ufValue ? Math.round(v.valor * ufValue) : 0) : (v.valor || 0);
      const prorrateadoLeasing = valorCLP ? Math.round((valorCLP / numDiasMes) * workerDays) : 0;
      
      const totalC = fuelByPatente[v.patente] || 0;
      
      const techRut = v.asignadoA?.rut ? v.asignadoA.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() : '';
      const techNombre = (v.asignadoA?.nombre || '').toLowerCase().trim();
      const techIdToa = String(v.asignadoA?.idRecursoToa || '').replace(/^0+/, '').trim();
      const bonoFijo = fixedBonusData[techRut] ?? fixedBonusData[techIdToa] ?? fixedBonusData[techNombre] ?? 0;
      const prorrateadoBonoFijo = bonoFijo > 0 ? Math.round((bonoFijo / numDiasMes) * workerDays) : 0;
      
      const techId1 = v.asignadoA?._id?.toString() || '';
      let bonoVar = 0;
      if (bonusData[techRut] !== undefined) bonoVar = bonusData[techRut];
      else if (bonusData[techId1] !== undefined) bonoVar = bonusData[techId1];
      else if (bonusData[techIdToa] !== undefined) bonoVar = bonusData[techIdToa];
      else if (bonusData[techNombre] !== undefined) bonoVar = bonusData[techNombre];
      
      const sumRemu = prorrateadoSueldo + prorrateadoBonoFijo + bonoVar;
      const sumFlota = prorrateadoLeasing + totalC;
      const totalCaja = sumRemu + sumFlota;

      const t = tecnicos.find(x => 
        (x.rut && x.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() === techRut) ||
        ((x.name || x.fullName || '').toLowerCase().trim() === techNombre)
      );
      const pts = t ? (t.ptsTotal || 0) : 0;
      const proyecto = v.asignadoA.projectId?.nombreProyecto || v.asignadoA.proyecto || 'General';
      const valorPunto = getTarifaParaProyecto(proyecto);
      const valorTotal = pts * valorPunto;

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
        'Sueldo Prorrateado (CLP)': prorrateadoSueldo,
        'Valor Leasing (CLP)': prorrateadoLeasing,
        'Combustible (CLP)': totalC,
        'Bono Fijo (CLP)': prorrateadoBonoFijo,
        'Monto Bono Var (CLP)': bonoVar,
        'Total Remuneración (CLP)': sumRemu,
        'Total Flota (CLP)': sumFlota,
        'Total Costo Caja (CLP)': totalCaja,
        'Rentabilidad Bruta (CLP)': valorTotal - totalCaja
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
            <h4 className="text-lg font-black text-slate-700">Flujo de Costos Operacion Activa</h4>
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
              <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Costo Caja por Proyecto</span>
            </div>
            <div className="flex-1 min-h-[250px] relative z-10">
              <ResponsiveContainer width="100%" minHeight={250}>
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
                      if (name === 'TotalCostoCaja') return [new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value), 'Costo Caja'];
                      if (name === 'ProduccionCLP') return [new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value), 'Producción'];
                      if (name === 'Trabajadores') return [value, 'Trabajadores'];
                      return [value, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }} />
                  <Bar yAxisId="left" name="Costo Caja" dataKey="TotalCostoCaja" fill="#6366F1" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    <LabelList dataKey="TotalCostoCaja" position="top" formatter={(value) => `$${(value / 1000000).toFixed(1)}M`} fill="#6366F1" fontSize={10} fontWeight="bold" />
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
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                <TrendingUp size={18} className="text-emerald-600" />
              </div>
              <div>
                <span className="text-xs font-black text-slate-600 uppercase tracking-widest block">Especialistas con Rentabilidad Positiva</span>
                <span className="text-[10px] text-slate-400 font-bold">Producción supera al Costo Caja</span>
              </div>
            </div>
            <div className="flex-1 min-h-[280px] relative z-10">
              <ResponsiveContainer width="100%" minHeight={280}>
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
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="p-2 bg-rose-50 rounded-xl border border-rose-100">
                <TrendingUp size={18} className="text-rose-600 rotate-180" />
              </div>
              <div>
                <span className="text-xs font-black text-slate-600 uppercase tracking-widest block">Especialistas con Rentabilidad Negativa</span>
                <span className="text-[10px] text-slate-400 font-bold">Costo Caja supera a la Producción</span>
              </div>
            </div>
            <div className="flex-1 min-h-[280px] relative z-10">
              <ResponsiveContainer width="100%" minHeight={280}>
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
                <th className="py-4 px-4 text-[10px] font-black text-slate-800 uppercase tracking-widest text-right bg-slate-50 border-l border-slate-100">Total Costo Caja</th>
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
                          {bono > 0 ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(bono) : '$0'}
                        </div>
                      );
                    })()}
                  </td>
                  {/* ── TOTAL COSTO CAJA ─────────────────────────────────── */}
                  <td className="py-4 px-4 text-right bg-slate-50 border-l border-slate-100">
                    {(() => {
                      const sueldoBase = parseInt(v.asignadoA?.sueldoBase) || 0;
                      const workerDays = getWorkerActiveDays(v, diasTranscurridos, filtroMes);
                      const prorrateadoSueldo = sueldoBase ? Math.round((sueldoBase / diasMes) * workerDays) : 0;
                      
                      const isUF = v.moneda === 'UF' || (v.valor > 0 && v.valor < 100);
                      const valorCLP = isUF ? (ufValue ? Math.round(v.valor * ufValue) : 0) : (v.valor || 0);
                      const prorrateadoLeasing = valorCLP ? Math.round((valorCLP / diasMes) * workerDays) : 0;
                      
                      const totalC = fuelByPatente[v.patente] || 0;
                      
                      const techRut = v.asignadoA?.rut ? v.asignadoA.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() : '';
                      const techNombre = (v.asignadoA?.nombre || '').toLowerCase().trim();
                      const techIdToa = String(v.asignadoA?.idRecursoToa || '').replace(/^0+/, '').trim();
                      const bonoFijo = fixedBonusData[techRut] ?? fixedBonusData[techIdToa] ?? fixedBonusData[techNombre] ?? 0;
                      const prorrateadoBonoFijo = bonoFijo > 0 ? Math.round((bonoFijo / diasMes) * workerDays) : 0;
                      
                      const techId1 = v.asignadoA?._id?.toString() || '';
                      let bonoVar = 0;
                      if (bonusData[techRut] !== undefined) bonoVar = bonusData[techRut];
                      else if (bonusData[techId1] !== undefined) bonoVar = bonusData[techId1];
                      else if (bonusData[techIdToa] !== undefined) bonoVar = bonusData[techIdToa];
                      else if (bonusData[techNombre] !== undefined) bonoVar = bonusData[techNombre];
                      
                      const totalCostoCaja = prorrateadoSueldo + prorrateadoLeasing + totalC + prorrateadoBonoFijo + bonoVar;
                      
                      return (
                        <div className="font-black text-slate-800 text-[11px]">
                          {totalCostoCaja > 0 ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(totalCostoCaja) : '$0'}
                        </div>
                      );
                    })()}
                  </td>
                  {/* ── RENTABILIDAD BRUTA ─────────────────────────────────── */}
                  <td className="py-4 px-4 text-right bg-emerald-50/50 border-l border-emerald-100">
                    {(() => {
                      const sueldoBase = parseInt(v.asignadoA?.sueldoBase) || 0;
                      const workerDays = getWorkerActiveDays(v, diasTranscurridos, filtroMes);
                      const prorrateadoSueldo = sueldoBase ? Math.round((sueldoBase / diasMes) * workerDays) : 0;
                      
                      const isUF = v.moneda === 'UF' || (v.valor > 0 && v.valor < 100);
                      const valorCLP = isUF ? (ufValue ? Math.round(v.valor * ufValue) : 0) : (v.valor || 0);
                      const prorrateadoLeasing = valorCLP ? Math.round((valorCLP / diasMes) * workerDays) : 0;
                      
                      const totalC = fuelByPatente[v.patente] || 0;
                      
                      const techRut = v.asignadoA?.rut ? v.asignadoA.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() : '';
                      const techNombre = (v.asignadoA?.nombre || '').toLowerCase().trim();
                      const techIdToa = String(v.asignadoA?.idRecursoToa || '').replace(/^0+/, '').trim();
                      const bonoFijo = fixedBonusData[techRut] ?? fixedBonusData[techIdToa] ?? fixedBonusData[techNombre] ?? 0;
                      const prorrateadoBonoFijo = bonoFijo > 0 ? Math.round((bonoFijo / diasMes) * workerDays) : 0;
                      
                      const techId1 = v.asignadoA?._id?.toString() || '';
                      let bonoVar = 0;
                      if (bonusData[techRut] !== undefined) bonoVar = bonusData[techRut];
                      else if (bonusData[techId1] !== undefined) bonoVar = bonusData[techId1];
                      else if (bonusData[techIdToa] !== undefined) bonoVar = bonusData[techIdToa];
                      else if (bonusData[techNombre] !== undefined) bonoVar = bonusData[techNombre];
                      
                      const totalCostoCaja = prorrateadoSueldo + prorrateadoLeasing + totalC + prorrateadoBonoFijo + bonoVar;

                      const t = tecnicos.find(x => 
                        (x.rut && x.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim() === techRut) ||
                        ((x.name || x.fullName || '').toLowerCase().trim() === techNombre)
                      );
                      const pts = t ? (t.ptsTotal || 0) : 0;
                      const proyectoName = v.asignadoA.projectId?.nombreProyecto || v.asignadoA.proyecto || '';
                      const valorPunto = getTarifaParaProyecto(proyectoName);
                      const valorTotal = pts * valorPunto;
                      
                      const rentabilidad = valorTotal - totalCostoCaja;
                      const margen = valorTotal > 0 ? ((rentabilidad / valorTotal) * 100).toFixed(1) : 0;
                      const isPositive = rentabilidad >= 0;

                      return (
                        <div className="flex flex-col items-end">
                          <div className={`font-black text-[11px] ${isPositive ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(rentabilidad)}
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
    </div>
  );
};

export default FinancialDashboard;

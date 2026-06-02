import { telecomApi as api } from '../telecomApi';
import { rrhhApi } from '../../rrhh/rrhhApi';

// ─────────────────────────────────────────────────────────────────────────────
// BONOS FIJOS: Devuelve mapa { rut/id/nombre → montoFijo }
// Replica EXACTAMENTE la lógica de BonosFijos.jsx para garantizar consistencia.
// Clave: el proyecto se busca por emp.projectId (campo directo del candidato),
// NO iterando las dotaciones — idéntico a BonosFijos.jsx líneas 69-71.
// ─────────────────────────────────────────────────────────────────────────────
export const getBonosFijosForMonth = async (yearStr, monthStr) => {
  try {
    const [modelosRes, proyectosRes, candidatosRes, bonosConfigRes] = await Promise.all([
      api.get('/admin/bonificadores').catch(() => ({ data: [] })),
      rrhhApi.get('/proyectos').catch(() => ({ data: [] })),
      rrhhApi.get('/candidatos').catch(() => ({ data: [] })),
      api.get('/admin/bonos-config').catch(() => ({ data: [] }))
    ]);

    const modelosBono = Array.isArray(modelosRes.data)     ? modelosRes.data     : [];
    const proyectos   = Array.isArray(proyectosRes.data)   ? proyectosRes.data   : [];
    const candidatos  = Array.isArray(candidatosRes.data)  ? candidatosRes.data  : [];
    const bonosConfig = Array.isArray(bonosConfigRes.data) ? bonosConfigRes.data : [];

    const modelosActivos = modelosBono.filter(m => m.activo && m.tipo === 'BONO_FIJO');
    const map = {};
    const cleanRut = (r) => (r || '').replace(/[^0-9kK]/g, '').toUpperCase().trim();

    candidatos.forEach(emp => {
      // === MISMO filtro de BonosFijos.jsx línea 67 ===
      if (['Finiquitado', 'De Baja', 'Retirado'].includes(emp.status)) return;

      // === MISMO lookup de proyecto por emp.projectId (BonosFijos.jsx líneas 69-71) ===
      const projId = emp.projectId?._id || emp.projectId;
      const proj = proyectos.find(p => String(p._id) === String(projId));
      if (!proj || !proj.dotacion) return;

      // === Modelos aplicables al cargo (BonosFijos.jsx líneas 83-92) ===
      const modelosAplicables = modelosActivos.filter(m => {
        if (m.aplicaA?.todos) return true;
        if (m.aplicaA?.cargos?.length > 0) {
          const cargo = (emp.position || '').toUpperCase().trim();
          return m.aplicaA.cargos.map(c => (c || '').toUpperCase().trim()).includes(cargo);
        }
        return false;
      });

      let montoFijo = 0;

      if (modelosAplicables.length > 0) {
        // Modelo reemplaza proyecto completamente (BonosFijos.jsx líneas 96-102)
        modelosAplicables.forEach(mod => { montoFijo += (mod.bonoFijo?.monto || 0); });
      } else {
        // Sin modelo: usar bonos fijos de la dotación del proyecto
        const dot = proj.dotacion.find(d => d.cargo === emp.position);
        if (dot?.bonos) {
          dot.bonos.filter(b => b.modality === 'Fijo').forEach(bf => {
            const bonoRefId = bf.bonoRef?._id || bf.bonoRef;
            const config = bonosConfig.find(c => c._id === bonoRefId);
            montoFijo += bf.monto || config?.config?.monto || 0;
          });
        }
      }

      if (montoFijo <= 0) return;

      // Indexar por todos los identificadores para máxima cobertura de lookup
      const rut = cleanRut(emp.rutFormateado || emp.rut || '');
      if (rut) map[rut] = montoFijo;

      const nombre = (emp.nombre || emp.name || '').toLowerCase().trim();
      if (nombre) map[nombre] = montoFijo;

      const idToa = String(emp.idRecursoToa || '').replace(/^0+/, '').trim();
      if (idToa) map[idToa] = montoFijo;

      if (emp._id) map[String(emp._id)] = montoFijo;
    });

    console.log(`[BonosFijos] ${candidatos.length} candidatos → ${Math.round(Object.keys(map).length / 4)} con bono fijo`);
    return map;
  } catch (error) {
    console.error('Error calculando bonos fijos:', error);
    return {};
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// BONOS VARIABLES (Baremo + RR + AI)
// ─────────────────────────────────────────────────────────────────────────────
export const getBonusForMonth = async (yearStr, monthStr) => {
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  
  try {
    const [closureRes, modelRes, tecnicosRes] = await Promise.all([
      api.get(`/admin/bonos/closure/${year}/${month}`).catch(() => ({ data: [] })),
      api.get('/admin/bonos/active').catch(() => ({ data: [] })),
      api.get('/tecnicos').catch(() => ({ data: [] }))
    ]);

    const closures = closureRes.data;
    const closure = Array.isArray(closures) && closures.length > 0 ? closures[0] : null;
    const map = {};

    if (closure && Array.isArray(closure.calculos)) {
      closure.calculos.forEach(c => {
        if (c.tecnicoId) map[c.tecnicoId.toString()] = c.totalBonus || 0;
        if (c.rut) {
          const cleanC = c.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim();
          if (cleanC) map[cleanC] = c.totalBonus || 0;
        }
        if (c.nombre) map[c.nombre.toLowerCase().trim()] = c.totalBonus || 0;
      });
      return map;
    }

    // IF NOT CLOSED, CALCULATE PREVIEW
    const activeModels = Array.isArray(modelRes.data) ? modelRes.data : [modelRes.data];
    const activeModel = activeModels.find(m => m && m.tipo === 'BAREMO_PUNTOS') || activeModels[0] || null;

    const daysInMonth = new Date(year, month, 0).getDate();
    const desde = `${year}-${String(month).padStart(2, '0')}-01`;
    const hasta  = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) { prevMonth = 12; prevYear = year - 1; }
    const prevDaysInMonth = new Date(prevYear, prevMonth, 0).getDate();
    const desdeGarantias = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    const hastaGarantias = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevDaysInMonth).padStart(2, '0')}`;

    const [statsRes, garantiasRes] = await Promise.all([
      api.get('/bot/produccion-stats', { params: { desde, hasta, estado: 'Completado' } }).catch(() => ({ data: null })),
      api.get('/bot/garantias-stats', { params: { desde: desdeGarantias, hasta: hastaGarantias } }).catch(() => ({ data: null }))
    ]);

    const garantiasMap = {};
    if (garantiasRes?.data?.statsTecnicos) {
      garantiasRes.data.statsTecnicos.forEach(t => {
        const cleanId = String(t.id).replace(/^0+/, '').trim();
        garantiasMap[cleanId] = t;
      });
    }

    const tecnicosData = Array.isArray(tecnicosRes?.data) ? tecnicosRes.data : [];
    const rutMap = {};
    tecnicosData.forEach(t => {
      if (t.idRecursoToa) rutMap[String(t.idRecursoToa).replace(/^0+/, '').trim()] = t.rutFormateado || t.rut;
      if (t.nombre) rutMap[t.nombre.toLowerCase().trim()] = t.rutFormateado || t.rut;
    });

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
    
    tecnicos.forEach(t => {
      const pts = t.ptsTotal || 0;
      const techName = t.name || t.nombre || '';
      let baremoBonus = 0;
      let rrBonus = 0;
      let aiBonus = 0;

      if (activeModel?.tramosBaremos) {
        const tier = activeModel.tramosBaremos.find(tr => {
          const hString = String(tr.hasta).trim().toLowerCase();
          const limitMax = (hString === 'más' || hString === 'mas' || hString === 'mas+' || hString === '') ? 999999 : parseFloat(tr.hasta);
          const limitMin = parseFloat(tr.desde) || 0;
          return pts >= limitMin && pts <= limitMax;
        });
        const multiplier = tier ? parseFloat(tier.valor) : 0;
        const ptsExcluidos = activeModel.puntosExcluidos || 0;
        const calculablePts = Math.max(0, pts - ptsExcluidos);
        baremoBonus = calculablePts * multiplier;
      }

      const idRecursoRaw = String(t.idRecursoToa || t.idRecurso || t._id || '').replace(/^0+/, '').trim();
      const garantiasTec = garantiasMap[idRecursoRaw] || {};
      const rrValue = Math.round((garantiasTec.rrValue || 0) * 100) / 100;
      const aiValue = Math.round((garantiasTec.aiValue || 0) * 100) / 100;

      if (activeModel && t.orders > 0) {
        const ptsExcluidos = activeModel.puntosExcluidos || 0;
        const calculablePts = Math.max(0, pts - ptsExcluidos);
        if (calculablePts > 0) {
          rrBonus = calculateTierBonus(rrValue, activeModel.tramosRR);
          aiBonus = calculateTierBonus(aiValue, activeModel.tramosAI);
        }
      }

      const totalBonus = baremoBonus + rrBonus + aiBonus;
      const techRut = rutMap[idRecursoRaw] || rutMap[techName.toLowerCase().trim()] || '';
      
      if (idRecursoRaw) map[idRecursoRaw] = totalBonus;
      if (techRut) map[techRut.replace(/[^0-9kK]/g, '').toUpperCase().trim()] = totalBonus;
      if (techName) map[techName.toLowerCase().trim()] = totalBonus;
    });

    return map;
  } catch (error) {
    console.error('Error calculating bonos:', error);
    return {};
  }
};

const mongoose = require('mongoose');
const Tecnico = require('../platforms/agentetelecom/models/Tecnico');
const Candidato = require('../platforms/rrhh/models/Candidato');
const Actividad = require('../platforms/agentetelecom/models/Actividad');
const RegistroAsistencia = require('../platforms/rrhh/models/RegistroAsistencia');
const PlatformUser = require('../platforms/auth/PlatformUser');
const Notification = require('../platforms/rrhh/models/Notification');

/**
 * Servicio para detectar anomalías estadísticas (Z-score) e inconsistencias
 * entre producción (órdenes) y asistencia diaria.
 * 
 * @param {string|mongoose.Types.ObjectId} empresaId - ID de la empresa a auditar
 * @param {Date|string} [runDate] - Fecha a evaluar (por defecto: hoy)
 */
async function runDailyAnomalyCheck(empresaId, runDate = null) {
  try {
    console.log(`🔍 [AnomalyCheck] Iniciando detección de anomalías para empresa ${empresaId}...`);
    const targetDate = runDate ? new Date(runDate) : new Date();
    // Formatear fecha a YYYY-MM-DD
    const targetDateStr = targetDate.toISOString().split('T')[0];
    console.log(`📅 [AnomalyCheck] Fecha objetivo: ${targetDateStr}`);

    const startOfRunDate = new Date(targetDateStr + 'T00:00:00Z');
    const endOfRunDate = new Date(targetDateStr + 'T23:59:59Z');

    const startOf30Days = new Date(startOfRunDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const endOf30Days = new Date(startOfRunDate.getTime() - 1 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000);

    // 1. CARGAR TÉCNICOS Y CANDIDATOS
    const [tecnicosVinculados, candsVal] = await Promise.all([
      Tecnico.find({ empresaRef: empresaId }).lean(),
      Candidato.find({ empresaRef: empresaId }).lean()
    ]);

    const techMap = {};
    const idToKey = {};
    const rutToKey = {};
    const nameToMapKey = {};

    const addToTechMap = (t, source) => {
      const idRawToa = String(t.idRecursoToa || '').trim();
      const idRawRec = String(t.idRecurso || '').trim();
      const rutRaw = String(t.rut || '').trim().toLowerCase();
      const rutClean = rutRaw.replace(/[^0-9kK]/g, '');

      if (!rutClean && !idRawToa && !idRawRec) return;

      const getKeys = (id) => {
        if (!id) return [];
        const low = id.toLowerCase();
        const clean = low.replace(/^0+/, '');
        return [low, clean, id];
      };

      const keysToa = getKeys(idRawToa);
      const keysRec = getKeys(idRawRec);

      let key = null;
      if (rutClean && rutToKey[rutClean]) key = rutToKey[rutClean];
      
      if (!key) {
        for (const k of [...keysToa, ...keysRec]) {
          if (idToKey[k]) {
            key = idToKey[k];
            break;
          }
        }
      }

      const rawName = t.name || t.fullName || (t.nombres ? `${t.nombres} ${t.apellidos || ''}` : '') || 'Sin Nombre';
      const name = rawName.trim();
      const normalizeName = (s) => (s || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
      const normName = normalizeName(rawName);
      
      const nameParts = normName.split(' ').filter(Boolean);
      const nameVariations = [
        normName,
        nameParts.join(' '),
        nameParts.length >= 3 ? `${nameParts[0]} ${nameParts[2]}` : null,
        nameParts.length >= 3 ? `${nameParts[0]} ${nameParts[1]} ${nameParts[2]}` : null,
      ].filter(Boolean);

      if (!key) {
        for (const nv of nameVariations) {
          if (nameToMapKey[nv]) {
            key = nameToMapKey[nv];
            break;
          }
        }
      }

      if (!key) {
        const cleanIdToUse = keysToa[1] || keysRec[1];
        const lowIdToUse = keysToa[0] || keysRec[0];
        key = cleanIdToUse || lowIdToUse || (rutClean ? `rut_${rutClean}` : `id_${Math.random()}`);
        
        techMap[key] = {
          name,
          idRecursoToa: idRawToa || idRawRec,
          idRecurso: idRawRec || idRawToa,
          rut: t.rut || '',
          candidatoId: source === 'candidato' ? String(t._id) : undefined,
          tecnicoId: source === 'tecnico' ? String(t._id) : undefined,
          status: t.status || 'Operativo',
          dailyPoints: {},
          dailyOrders: {}
        };

        if (rutClean) rutToKey[rutClean] = key;
        [...keysToa, ...keysRec].forEach(k => {
          if (k) {
            idToKey[k] = key;
            const num = parseInt(k);
            if (!isNaN(num)) idToKey[num] = key;
          }
        });

        nameVariations.forEach(nv => {
          nameToMapKey[nv] = key;
        });
      } else {
        if (source === 'candidato' && !techMap[key].candidatoId) {
          techMap[key].candidatoId = String(t._id);
        }
        if (source === 'tecnico' && !techMap[key].tecnicoId) {
          techMap[key].tecnicoId = String(t._id);
        }
      }
    };

    candsVal.forEach(c => addToTechMap(c, 'candidato'));
    tecnicosVinculados.forEach(t => addToTechMap(t, 'tecnico'));

    // 2. QUERY DE ACTIVIDADES (últimos 30 días + fecha objetivo)
    const activities = await Actividad.find({
      empresaRef: empresaId,
      fecha: { $gte: startOf30Days, $lte: endOfRunDate }
    }).lean();

    console.log(`📦 [AnomalyCheck] Encontradas ${activities.length} actividades para calcular estadísticas.`);

    const seenActivities = new Set();

    activities.forEach(doc => {
      const pet = String(doc.NUMERO_DE_PETICION || doc.NUMERO_PETICION || doc.APPT_NUMBER || '').trim();
      const fallbackId = String(doc.ORDENID || doc._id || '').trim();
      const uniqueKey = pet && pet.length > 2 ? pet : fallbackId;
      
      if (uniqueKey && seenActivities.has(uniqueKey)) return;
      if (uniqueKey) seenActivities.add(uniqueKey);

      const idRawToa = String(
        doc.idRecursoToa || 
        doc.idRecurso || 
        doc.ID_RECURSO || 
        doc.IDRECURSOTOA || 
        doc.ID_RECURSO_TOA || 
        doc.RECURSO || 
        doc['AUTO_ASIGNADO_A_RECURSO_(ID)'] ||
        doc.TECNICO ||
        ''
      ).trim().replace(/^0+/, '');

      const idLow = idRawToa.toLowerCase();
      const idClean = idLow.replace(/^0+/, '');

      let techKey = techMap[idRawToa] ? idRawToa : (idToKey[idLow] || idToKey[idClean] || idToKey[idRawToa] || '');

      if (!techKey) {
        const nombreRaw = doc.NOMBRE || doc.NOMBRE_TECNICO || doc.TECNICO_NOMBRE || doc.nombre || '';
        if (nombreRaw) {
          const nClean = String(nombreRaw).trim().toUpperCase();
          if (nameToMapKey[nClean]) {
            techKey = nameToMapKey[nClean];
          } else {
            const parts = nClean.split(' ').filter(Boolean);
            if (parts.length >= 3 && nameToMapKey[`${parts[0]} ${parts[2]}`]) {
              techKey = nameToMapKey[`${parts[0]} ${parts[2]}`];
            }
          }
        }
      }

      if (!techKey) return;

      const dateStr = doc.fecha instanceof Date
        ? doc.fecha.toISOString().split('T')[0]
        : String(doc.fecha).split('T')[0];

      const pts = parseFloat(
        doc.ptsTotalBaremo || doc.PTS_TOTAL_BAREMO || doc.Pts_Total_Baremo || 
        doc.pts_normalizados || doc.PUNTOS || doc.Puntos || 0
      );

      const tech = techMap[techKey];
      if (!tech.dailyPoints[dateStr]) {
        tech.dailyPoints[dateStr] = 0;
        tech.dailyOrders[dateStr] = 0;
      }
      tech.dailyPoints[dateStr] += pts;
      tech.dailyOrders[dateStr] += 1;
    });

    // 3. QUERY ASISTENCIAS DE LA FECHA OBJETIVO
    const checkinRecords = await RegistroAsistencia.find({
      empresaRef: empresaId,
      fecha: { $gte: startOfRunDate, $lte: endOfRunDate }
    }).lean();

    const candIdToKey = {};
    const rutToKeyNormalized = {};
    Object.entries(techMap).forEach(([key, tech]) => {
      if (tech.candidatoId) {
        candIdToKey[String(tech.candidatoId)] = key;
      }
      if (tech.rut) {
        const cleanRut = String(tech.rut).replace(/[^0-9kK]/g, '').toLowerCase();
        if (cleanRut) rutToKeyNormalized[cleanRut] = key;
      }
    });

    const dailyAttendance = {};
    checkinRecords.forEach(record => {
      let key = candIdToKey[String(record.candidatoId)];
      if (!key && record.rut) {
        const cleanRut = String(record.rut).replace(/[^0-9kK]/g, '').toLowerCase();
        key = rutToKeyNormalized[cleanRut];
      }
      if (!key) return;

      dailyAttendance[key] = {
        estado: record.estado,
        observacion: record.observacion || ''
      };
    });

    // 4. PROCESAR CADA TÉCNICO Y EVALUAR ANOMALÍAS
    const anomalies = [];
    const historicalDates = [];
    for (let i = 1; i <= 30; i++) {
      const d = new Date(startOfRunDate.getTime() - i * 24 * 60 * 60 * 1000);
      historicalDates.push(d.toISOString().split('T')[0]);
    }

    Object.entries(techMap).forEach(([key, tech]) => {
      const isInactive = String(tech.status || '').toLowerCase().includes('finiquit') ||
                         String(tech.status || '').toLowerCase().includes('egreso') ||
                         String(tech.status || '').toLowerCase().includes('inactiv') ||
                         String(tech.status || '').toLowerCase().includes('retir');
      
      const ptsTarget = tech.dailyPoints[targetDateStr] || 0;
      const ordersTarget = tech.dailyOrders[targetDateStr] || 0;

      const historyPoints = historicalDates.map(dateStr => tech.dailyPoints[dateStr] || 0);
      const totalHistoryPoints = historyPoints.reduce((sum, val) => sum + val, 0);

      if (isInactive && ptsTarget === 0 && totalHistoryPoints === 0) return;

      const count = historyPoints.length; // 30
      const mean = totalHistoryPoints / count;
      
      const variance = historyPoints.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / count;
      const stdDev = Math.sqrt(variance);

      let zScore = 0;
      let isZScoreAnomaly = false;

      if (stdDev > 0.05) {
        zScore = (ptsTarget - mean) / stdDev;
        if (Math.abs(zScore) > 2.2) {
          isZScoreAnomaly = true;
        }
      } else if (ptsTarget > 0 && mean === 0) {
        if (ptsTarget > 5) {
          zScore = 99;
          isZScoreAnomaly = true;
        }
      }

      let isAttendanceAnomaly = false;
      let attendanceAnomalyType = '';
      
      const hasProd = ptsTarget > 0 || ordersTarget > 0;
      const attRecord = dailyAttendance[key];
      const statusAst = attRecord ? attRecord.estado : null;

      if (hasProd && (!statusAst || statusAst === 'Ausente')) {
        isAttendanceAnomaly = true;
        attendanceAnomalyType = 'Producción sin Asistencia';
      } else if (!hasProd && (statusAst === 'Presente' || statusAst === 'Tardanza')) {
        const dayOfWeek = startOfRunDate.getDay();
        const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
        if (!isWeekendDay) {
          isAttendanceAnomaly = true;
          attendanceAnomalyType = 'Asistencia sin Producción';
        }
      }

      if (isZScoreAnomaly) {
        anomalies.push({
          techName: tech.name,
          candidatoId: tech.candidatoId,
          type: 'z_score',
          message: `El técnico ${tech.name} registró ${ptsTarget} puntos el ${targetDateStr}. Su promedio de 30 días es de ${mean.toFixed(2)} puntos (Desviación: ${stdDev.toFixed(2)}, Z-Score: ${zScore.toFixed(2)}).`
        });
      }

      if (isAttendanceAnomaly) {
        anomalies.push({
          techName: tech.name,
          candidatoId: tech.candidatoId,
          type: 'attendance_mismatch',
          anomalyType: attendanceAnomalyType,
          message: attendanceAnomalyType === 'Producción sin Asistencia'
            ? `El técnico ${tech.name} registra producción (${ptsTarget} pts, ${ordersTarget} órdenes) el ${targetDateStr} pero figura como Ausente o sin registro de asistencia.`
            : `El técnico ${tech.name} figura como Presente/Tardanza el ${targetDateStr} pero registra 0 puntos de producción (día laborable).`
        });
      }
    });

    console.log(`⚠️ [AnomalyCheck] Detectadas ${anomalies.length} anomalías totales para ${targetDateStr}.`);

    // 5. GUARDAR NOTIFICACIONES DIRIGIDAS A ADMINISTRADORES
    if (anomalies.length > 0) {
      const admins = await PlatformUser.find({
        empresaRef: empresaId,
        role: { $in: ['admin', 'system_admin', 'gerencia', 'jefatura'] },
        status: 'Activo'
      }).select('email').lean();

      console.log(`👤 [AnomalyCheck] Se enviarán notificaciones a ${admins.length} administradores.`);

      if (admins.length > 0) {
        for (const admin of admins) {
          for (const anomaly of anomalies) {
            const title = anomaly.type === 'z_score'
              ? 'Desviación Estadística de Rendimiento (Z-Score)'
              : `Inconsistencia Operativa: ${anomaly.anomalyType}`;

            await Notification.create({
              userEmail: admin.email,
              title,
              message: anomaly.message,
              type: 'alert',
              empresaRef: empresaId,
              metadata: {
                candidatoId: anomaly.candidatoId ? new mongoose.Types.ObjectId(anomaly.candidatoId) : undefined,
                module: 'rend_operativo',
                action: 'anomaly_detected'
              }
            });
          }
        }
      }
    }

    return {
      success: true,
      anomaliesCount: anomalies.length,
      anomalies
    };

  } catch (error) {
    console.error('❌ Error ejecutando runDailyAnomalyCheck:', error.message, error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = { runDailyAnomalyCheck };

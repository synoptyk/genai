const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const ConsumoCombustible = require('../models/ConsumoCombustible');
const Actividad = require('../models/Actividad');
const Tecnico = require('../models/Tecnico');
const { protect } = require('../../auth/authMiddleware');

// ============================================================================
// 1. CONSUMO DE COMBUSTIBLE
// ============================================================================

// GET /api/flota/eficiencia/combustible
// Obtiene el historial de cargas de combustible
router.get('/combustible', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const { desde, hasta, patente } = req.query;
    
    let query = { empresaRef: empresaId };
    
    if (desde || hasta) {
      query.fechaCarga = {};
      if (desde) query.fechaCarga.$gte = new Date(desde);
      if (hasta) query.fechaCarga.$lte = new Date(hasta);
    }
    
    if (patente) {
      query.patente = new RegExp(patente, 'i');
    }

    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: 'vehiculos',
          let: { 
            tarjetaInput: { $arrayElemAt: [{ $split: [{ $ifNull: ['$tarjeta', ''] }, "-"] }, 0] }, 
            patenteInput: { $replaceAll: { input: { $ifNull: ['$patente', ''] }, find: "-", replacement: "" } } 
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $and: [ { $ne: ["$$tarjetaInput", ""] }, { $eq: ["$numeroCupon", "$$tarjetaInput"] } ] },
                    { $and: [ { $ne: ["$$patenteInput", ""] }, { $eq: [{ $replaceAll: { input: { $ifNull: ["$patente", ""] }, find: "-", replacement: "" } }, "$$patenteInput"] } ] }
                  ]
                }
              }
            },
            {
              $addFields: {
                matchScore: {
                  $cond: {
                    if: { $and: [ { $ne: ["$$tarjetaInput", ""] }, { $eq: ["$numeroCupon", "$$tarjetaInput"] } ] },
                    then: 2,
                    else: 1
                  }
                }
              }
            },
            { $sort: { matchScore: -1 } },
            { $limit: 1 }
          ],
          as: 'vehiculoInfo'
        }
      },
      { $unwind: { path: '$vehiculoInfo', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'tecnicos',
          localField: 'vehiculoInfo.asignadoA',
          foreignField: '_id',
          as: 'tecnicoInfo'
        }
      },
      { $unwind: { path: '$tecnicoInfo', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          vehiculoPatente: { $ifNull: ['$vehiculoInfo.patente', '$patente'] },
          tecnicoNombre: '$tecnicoInfo.nombre'
        }
      },
      { $sort: { fechaCarga: -1 } }
    ];

    const registros = await ConsumoCombustible.aggregate(pipeline);
    res.json(registros);
  } catch (error) {
    console.error('Error al obtener consumo de combustible:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/flota/eficiencia/combustible/trabajadores
// Obtiene el consumo agrupado por trabajador (Técnico)
router.get('/combustible/trabajadores', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const { desde, hasta, patente } = req.query;
    
    let matchQuery = { empresaRef: empresaId };
    
    if (desde || hasta) {
      matchQuery.fechaCarga = {};
      if (desde) matchQuery.fechaCarga.$gte = new Date(desde);
      if (hasta) matchQuery.fechaCarga.$lte = new Date(hasta);
    }
    
    if (patente) {
      matchQuery.patente = new RegExp(patente, 'i');
    }

    const pipeline = [
      { $match: matchQuery },
      // Unir con Vehiculo usando tarjeta o patente
      {
        $lookup: {
          from: 'vehiculos',
          let: { 
            tarjetaInput: { $arrayElemAt: [{ $split: [{ $ifNull: ['$tarjeta', ''] }, "-"] }, 0] }, 
            patenteInput: { $replaceAll: { input: { $ifNull: ['$patente', ''] }, find: "-", replacement: "" } } 
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $and: [ { $ne: ["$$tarjetaInput", ""] }, { $eq: ["$numeroCupon", "$$tarjetaInput"] } ] },
                    { $and: [ { $ne: ["$$patenteInput", ""] }, { $eq: [{ $replaceAll: { input: { $ifNull: ["$patente", ""] }, find: "-", replacement: "" } }, "$$patenteInput"] } ] }
                  ]
                }
              }
            },
            {
              $addFields: {
                matchScore: {
                  $cond: {
                    if: { $and: [ { $ne: ["$$tarjetaInput", ""] }, { $eq: ["$numeroCupon", "$$tarjetaInput"] } ] },
                    then: 2,
                    else: 1
                  }
                }
              }
            },
            { $sort: { matchScore: -1 } },
            { $limit: 1 }
          ],
          as: 'vehiculoInfo'
        }
      },
      { $unwind: { path: '$vehiculoInfo', preserveNullAndEmptyArrays: true } },
      
      // Unir con Tecnico basado en el vehículo
      {
        $lookup: {
          from: 'tecnicos',
          localField: 'vehiculoInfo.asignadoA',
          foreignField: '_id',
          as: 'tecnicoInfo'
        }
      },
      { $unwind: { path: '$tecnicoInfo', preserveNullAndEmptyArrays: true } },

      // Agrupar resultados por trabajador (o por vehículo/tarjeta si no hay match)
      {
        $group: {
          _id: { 
            $ifNull: ['$tecnicoInfo._id', { $ifNull: ['$vehiculoInfo._id', '$tarjeta'] }] 
          },
          rut: { $first: '$tecnicoInfo.rut' },
          nombre: { $first: '$tecnicoInfo.nombre' },
          vehiculoPatente: { $first: '$vehiculoInfo.patente' },
          tarjetaVinculada: { $first: '$vehiculoInfo.numeroCupon' },
          tipoCuponVinculado: { $first: '$vehiculoInfo.cuponElectronico' },
          tarjetaOriginal: { $first: '$tarjeta' }, // <--- Para saber qué tarjeta usó realmente, aunque no coincida
          patenteOriginal: { $first: '$patente' }, // <--- Para saber qué patente anotaron en la gasolinera
          totalLitros: { $sum: '$litros' },
          totalMonto: { $sum: '$monto' },
          cantidadCargas: { $sum: 1 }
        }
      },
      { $sort: { totalMonto: -1 } }
    ];

    const resultados = await ConsumoCombustible.aggregate(pipeline);
    res.json(resultados);
  } catch (error) {
    console.error('Error al agrupar combustible por trabajadores:', error);
    res.status(500).json({ error: 'Error del servidor al agrupar datos' });
  }
});

// POST /api/flota/eficiencia/combustible/bulk
// Carga masiva de datos de combustible (desde Excel/CSV)
router.post('/combustible/bulk', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const { datos } = req.body;

    if (!datos || !Array.isArray(datos)) {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    const operaciones = [];

    for (const fila of datos) {
      if (!fila.patente || !fila.fechaCarga || !fila.monto || !fila.comprobanteTransaccion) {
        continue;
      }

      // Sanitizar keys del excel para evitar errores en MongoDB (no acepta . ni $)
      const sanitizedFila = {};
      Object.keys(fila).forEach(k => {
        const cleanKey = k.replace(/[\.\$]/g, '').trim();
        sanitizedFila[cleanKey] = fila[k];
      });

      operaciones.push({
        updateOne: {
          filter: { comprobanteTransaccion: String(fila.comprobanteTransaccion).trim() },
          update: {
            $set: {
              ...sanitizedFila,
              empresaRef: empresaId,
              patente: fila.patente.trim().toUpperCase(),
              fechaCarga: new Date(fila.fechaCarga),
              litros: Number(fila.litros) || 0,
              monto: Number(fila.monto) || 0,
              tipoCombustible: fila.tipoCombustible || 'Desconocido',
              odometro: Number(fila.odometro) || 0,
              estacion: fila.estacion || '',
              tarjeta: fila.tarjeta || '',
              proveedor: fila.proveedor || 'MANUAL'
            }
          },
          upsert: true
        }
      });
    }

    if (operaciones.length === 0) {
      return res.json({ success: true, insertados: 0, actualizados: 0, omitidos: datos.length });
    }

    const result = await ConsumoCombustible.bulkWrite(operaciones, { ordered: false });

    res.json({ 
      success: true, 
      insertados: result.upsertedCount || 0, 
      actualizados: result.modifiedCount || 0, 
      omitidos: datos.length - (result.upsertedCount || 0) - (result.modifiedCount || 0)
    });
  } catch (error) {
    console.error('Error en carga masiva de combustible (bulkWrite):', error);
    res.status(500).json({ error: 'Error del servidor en carga masiva' });
  }
});


// ============================================================================
// 2. KM RECORRIDO (RUTAS TOA)
// ============================================================================

// GET /api/flota/eficiencia/rutas
// Obtiene las rutas agrupadas por técnico para una fecha determinada
router.get('/rutas', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const { fecha } = req.query;

    if (!fecha) {
      return res.status(400).json({ error: 'Se requiere una fecha' });
    }

    // Parse date (assuming YYYY-MM-DD format)
    const startDate = new Date(fecha);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(fecha);
    endDate.setUTCHours(23, 59, 59, 999);

    // 1. Obtener actividades de ese día (desde la BD de descarga TOA)
    const actividades = await Actividad.find({
      empresaRef: empresaId,
      fecha: { $gte: startDate, $lte: endDate }
    }).lean();

    if (!actividades || actividades.length === 0) {
      return res.json([]);
    }

    // 2. Extraer los idRecursoToa de las actividades
    const recursosIds = [...new Set(actividades.map(a => a.idRecursoToa).filter(Boolean))];

    // 3. Buscar técnicos que coincidan con esos idRecursoToa
    const tecnicos = await Tecnico.find({
      empresaRef: empresaId,
      idRecursoToa: { $in: recursosIds }
    }).select('nombres apellidos nombre rut idRecursoToa').lean();

    const tecnicosMap = {};
    tecnicos.forEach(t => {
      tecnicosMap[t.idRecursoToa] = t;
    });

    // 4. Agrupar actividades por técnico
    const rutasPorTecnico = {};

    actividades.forEach(act => {
      const recId = act.idRecursoToa;
      if (!recId) return; // Saltar si no hay recurso
      
      const tecnico = tecnicosMap[recId];
      if (!tecnico) return; // Saltar si el recurso no está mapeado a un técnico nuestro

      if (!rutasPorTecnico[recId]) {
        rutasPorTecnico[recId] = {
          tecnicoId: tecnico._id,
          nombreTecnico: tecnico.nombre || `${tecnico.nombres} ${tecnico.apellidos}`,
          idRecursoToa: recId,
          rut: tecnico.rut,
          actividades: []
        };
      }

      // Normalizar estado (Ej: "Completado", "Pendiente", "Suspendido", "Cancelado")
      const estadoRaw = String(act.Estado || act.estado || '').toLowerCase();
      const esCompletado = estadoRaw.includes('completado') || estadoRaw.includes('realizado') || estadoRaw.includes('terminado');

      // Extraer datos de dirección
      const direccionRaw = act.Direccion || act.direccion || '';
      const comuna = act.Comuna || act.comuna || '';
      const ciudad = act.Ciudad || act.ciudad || '';
      
      let direccionFull = direccionRaw;
      if (comuna) direccionFull += `, ${comuna}`;
      if (ciudad) direccionFull += `, ${ciudad}`;

      // Coordenadas si vienen provistas
      const lat = act['Direccion Polar Y'] || act.lat || null;
      const lng = act['Direccion Polar X'] || act.lng || null;

      rutasPorTecnico[recId].actividades.push({
        ordenId: act.ordenId || act['Número orden'] || act._id,
        estado: act.Estado || act.estado || 'Desconocido',
        esCompletado,
        actividad: act['Subtipo de Actividad'] || act.actividad || act.tipo,
        direccion: direccionFull.trim(),
        direccionCruda: direccionRaw,
        lat,
        lng,
        fecha: act.fecha
      });
    });

    // Formatear array de salida
    const resultado = Object.values(rutasPorTecnico).map(ruta => {
      // Opcional: ordenar las actividades por algún criterio (ej: por hora de ejecución, o dejar tal cual)
      ruta.totalActividades = ruta.actividades.length;
      ruta.completadas = ruta.actividades.filter(a => a.esCompletado).length;
      ruta.eficiencia = ruta.totalActividades > 0 
        ? Math.round((ruta.completadas / ruta.totalActividades) * 100) 
        : 0;
      return ruta;
    });

    // Ordenar por eficiencia descendente, o por nombre alfabético
    resultado.sort((a, b) => a.nombreTecnico.localeCompare(b.nombreTecnico));

    res.json(resultado);
  } catch (error) {
    console.error('Error al obtener rutas TOA:', error);
    res.status(500).json({ error: 'Error del servidor al obtener rutas' });
  }
});

module.exports = router;

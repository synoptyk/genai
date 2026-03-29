const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../auth/authMiddleware');
const TarifaLPU = require('../models/TarifaLPU');

// =============================================================================
// CRUD — Tarifas LPU (puntos baremos por empresa)
// =============================================================================

// GET /api/tarifa-lpu — Todas las tarifas de la empresa
router.get('/', protect, authorize('rend_config_lpu:ver'), async (req, res) => {
  try {
    const tarifas = await TarifaLPU.find({ empresaRef: req.user.empresaRef })
      .sort({ grupo: 1, orden: 1, codigo: 1 })
      .lean();
    res.json(tarifas);
  } catch (error) {
    console.error('❌ GET /api/tarifa-lpu:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tarifa-lpu/grupos — Lista de grupos únicos
router.get('/grupos', protect, authorize('rend_config_lpu:ver'), async (req, res) => {
  try {
    const grupos = await TarifaLPU.distinct('grupo', { empresaRef: req.user.empresaRef });
    res.json(grupos.sort());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// CONFIG PRODUCCIÓN — Meta de producción por empresa
// =============================================================================
const ConfigProduccion = require('../models/ConfigProduccion');

// GET /api/tarifa-lpu/config-produccion — Obtener config de producción de la empresa
router.get('/config-produccion', protect, authorize('rend_config_lpu:ver'), async (req, res) => {
  try {
    let config = await ConfigProduccion.findOne({ empresaRef: req.user.empresaRef });
    if (!config) {
      config = await ConfigProduccion.create({ empresaRef: req.user.empresaRef });
    }
    res.json(config);
  } catch (error) {
    console.error('❌ GET config-produccion:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/tarifa-lpu/config-produccion — Actualizar config de producción
router.put('/config-produccion', protect, authorize('rend_config_lpu:editar'), async (req, res) => {
  try {
    const { metaProduccionDia, diasLaboralesSemana, diasLaboralesMes } = req.body;
    const config = await ConfigProduccion.findOneAndUpdate(
      { empresaRef: req.user.empresaRef },
      { $set: { metaProduccionDia, diasLaboralesSemana, diasLaboralesMes } },
      { new: true, upsert: true }
    );
    res.json(config);
  } catch (error) {
    console.error('❌ PUT config-produccion:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/tarifa-lpu — Crear una tarifa
router.post('/', protect, authorize('rend_config_lpu:crear'), async (req, res) => {
  try {
    const tarifa = new TarifaLPU({ ...req.body, empresaRef: req.user.empresaRef });
    await tarifa.save();
    res.status(201).json(tarifa);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: `El código "${req.body.codigo}" ya existe.` });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/tarifa-lpu/:id — Actualizar una tarifa
router.put('/:id', protect, authorize('rend_config_lpu:editar'), async (req, res) => {
  try {
    const tarifa = await TarifaLPU.findOneAndUpdate(
      { _id: req.params.id, empresaRef: req.user.empresaRef },
      { $set: req.body },
      { new: true }
    );
    if (!tarifa) return res.status(404).json({ error: 'Tarifa no encontrada.' });
    res.json(tarifa);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: `El código "${req.body.codigo}" ya existe.` });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/tarifa-lpu/:id — Eliminar una tarifa
router.delete('/:id', protect, authorize('rend_config_lpu:eliminar'), async (req, res) => {
  try {
    const tarifa = await TarifaLPU.findOneAndDelete({
      _id: req.params.id,
      empresaRef: req.user.empresaRef
    });
    if (!tarifa) return res.status(404).json({ error: 'Tarifa no encontrada.' });
    res.json({ ok: true, eliminada: tarifa.codigo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/tarifa-lpu/bulk — Carga masiva (upsert por código)
router.post('/bulk', protect, authorize('rend_config_lpu:crear'), async (req, res) => {
  try {
    const { tarifas } = req.body;
    if (!Array.isArray(tarifas) || !tarifas.length) {
      return res.status(400).json({ error: 'Se requiere un array de tarifas.' });
    }

    const ops = tarifas.map(t => ({
      updateOne: {
        filter: { codigo: t.codigo, empresaRef: req.user.empresaRef },
        update: { $set: { ...t, empresaRef: req.user.empresaRef } },
        upsert: true
      }
    }));

    const result = await TarifaLPU.bulkWrite(ops, { ordered: false });
    res.json({
      ok: true,
      insertados: result.upsertedCount || 0,
      actualizados: result.modifiedCount || 0,
      total: tarifas.length
    });
  } catch (error) {
    console.error('❌ POST /api/tarifa-lpu/bulk:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/tarifa-lpu/cargar-plantilla-chile — Carga la plantilla base de Chile (Movistar)
router.post('/cargar-plantilla-chile', protect, authorize('rend_config_lpu:crear'), async (req, res) => {
  try {
    const empresaRef = req.user.empresaRef;

    // Plantilla base: LPU Movistar Chile - Unidades de Mano de Obra
    const plantilla = [
      // ═══ GRUPO RED DE SERVICIO DE VOZ ═══
      { codigo: '510010', descripcion: 'Alta Voz', grupo: 'RED DE SERVICIO DE VOZ', categoria: 'ATENCION AL CLIENTE', puntos: 2, observacion: 'Instalación nueva de línea de voz', mapeo: { subtipo_actividad: 'Alta', familia_producto: 'TOIP' }, orden: 1 },
      { codigo: '510012', descripcion: 'Alta Voz con Reutilización de DROP', grupo: 'RED DE SERVICIO DE VOZ', categoria: 'ATENCION AL CLIENTE', puntos: 1.7, observacion: 'Alta de voz reutilizando cable DROP existente', mapeo: { subtipo_actividad: 'Alta', familia_producto: 'TOIP', requiere_reutilizacion_drop: 'SI' }, orden: 2 },
      { codigo: '510021', descripcion: 'Alta N-Líneas 2 Líneas', grupo: 'RED DE SERVICIO DE VOZ', categoria: 'ATENCION AL CLIENTE', puntos: 1, observacion: '2 líneas de voz', orden: 3 },
      { codigo: '510022', descripcion: 'Alta N-Líneas 4 Líneas', grupo: 'RED DE SERVICIO DE VOZ', categoria: 'ATENCION AL CLIENTE', puntos: 1.5, observacion: '4 líneas de voz', orden: 4 },
      { codigo: '510023', descripcion: 'Alta N-Líneas 8 Líneas', grupo: 'RED DE SERVICIO DE VOZ', categoria: 'ATENCION AL CLIENTE', puntos: 2, observacion: '8 líneas de voz', orden: 5 },

      // ═══ GRUPO BANDA ANCHA ═══
      { codigo: '520012', descripcion: 'Alta Banda Ancha', grupo: 'BANDA ANCHA', categoria: 'ATENCION AL CLIENTE', puntos: 1.5, observacion: 'Instalación nueva de internet fibra óptica', mapeo: { tipo_trabajo_pattern: 'At--------', subtipo_actividad: 'Alta' }, orden: 10 },
      { codigo: '390013', descripcion: 'Alta Banda Ancha con Reutilización de DROP', grupo: 'BANDA ANCHA', categoria: 'ATENCION AL CLIENTE', puntos: 1.7, observacion: 'Alta BA reutilizando cable DROP existente', mapeo: { subtipo_actividad: 'Alta', requiere_reutilizacion_drop: 'SI' }, orden: 11 },
      { codigo: '540025', descripcion: 'Instalación Access Point coincidente en Alta', grupo: 'BANDA ANCHA', categoria: 'ATENCION AL CLIENTE', puntos: 0.5, observacion: 'Repetidor WiFi instalado junto con el alta del servicio', mapeo: { es_equipo_adicional: true, campo_cantidad: 'Repetidores_WiFi', condicion_extra: 'Coincidente con alta' }, orden: 12 },
      { codigo: '540026', descripcion: 'Instalación Access Point WI-Fi', grupo: 'BANDA ANCHA', categoria: 'ATENCION AL CLIENTE', puntos: 0.25, observacion: 'Repetidor/extensor WiFi independiente', mapeo: { es_equipo_adicional: true, campo_cantidad: 'Repetidores_WiFi' }, orden: 13 },
      { codigo: '520014', descripcion: 'Instalación Servicio BAS Starlink (Banda ancha satelital)', grupo: 'BANDA ANCHA', categoria: 'ATENCION AL CLIENTE', puntos: 2, observacion: 'Internet satelital Starlink', orden: 14 },

      // ═══ GRUPO TELEVISION ═══
      { codigo: '830127', descripcion: 'Alta TV', grupo: 'TELEVISION', categoria: 'ATENCION AL CLIENTE', puntos: 1.5, observacion: 'Instalación nueva de TV IPTV', mapeo: { subtipo_actividad: 'Alta', familia_producto: 'IPTV' }, orden: 20 },
      { codigo: '390023', descripcion: 'Alta TV con Reutilización de DROP', grupo: 'TELEVISION', categoria: 'ATENCION AL CLIENTE', puntos: 2.13, observacion: 'Alta TV reutilizando cable DROP', mapeo: { subtipo_actividad: 'Alta', familia_producto: 'IPTV', requiere_reutilizacion_drop: 'SI' }, orden: 21 },
      { codigo: '540056', descripcion: 'Decodificador Adicional en Alta TV', grupo: 'TELEVISION', categoria: 'ATENCION AL CLIENTE', puntos: 0.5, observacion: 'Cada decodificador extra instalado con el alta de TV', mapeo: { es_equipo_adicional: true, campo_cantidad: 'Decos_Adicionales' }, orden: 22 },
      { codigo: '540057', descripcion: 'Decodificador Adicional Wi-Fi TV', grupo: 'TELEVISION', categoria: 'ATENCION AL CLIENTE', puntos: 0.25, observacion: 'Decodificador WiFi adicional', mapeo: { es_equipo_adicional: true, campo_cantidad: 'Decos_Adicionales', condicion_extra: 'WiFi' }, orden: 23 },
      { codigo: '830130', descripcion: 'Alta Movistar TV', grupo: 'TELEVISION', categoria: 'ATENCION AL CLIENTE', puntos: 0.3, observacion: 'Alta servicio Movistar TV básico', orden: 24 },

      // ═══ GRUPO INSTALACIONES MULTIPRODUCTO ═══
      { codigo: '390011', descripcion: 'Instalación de Voz/Punto Ppal FTTH y Banda Ancha', grupo: 'INSTALACIONES MULTIPRODUCTO', categoria: 'ATENCION AL CLIENTE', puntos: 2, observacion: 'Combo Voz + Internet', mapeo: { tipo_trabajo_pattern: 'AtAt------', subtipo_actividad: 'Alta' }, orden: 30 },
      { codigo: '390014', descripcion: 'Instalación de Voz/Punto Ppal FTTH y Banda Ancha con Reutilización de DROP', grupo: 'INSTALACIONES MULTIPRODUCTO', categoria: 'ATENCION AL CLIENTE', puntos: 1.7, observacion: 'Combo Voz + Internet con DROP existente', mapeo: { tipo_trabajo_pattern: 'AtAt------', requiere_reutilizacion_drop: 'SI' }, orden: 31 },
      { codigo: '390021', descripcion: 'Instalación de Voz/Punto Ppal FTTH y TV', grupo: 'INSTALACIONES MULTIPRODUCTO', categoria: 'ATENCION AL CLIENTE', puntos: 2.5, observacion: 'Combo Voz + TV', orden: 32 },
      { codigo: '390024', descripcion: 'Instalación de Voz/Punto Ppal FTTH y TV con Reutilización de DROP', grupo: 'INSTALACIONES MULTIPRODUCTO', categoria: 'ATENCION AL CLIENTE', puntos: 2.13, observacion: 'Combo Voz + TV con DROP existente', orden: 33 },
      { codigo: '390039', descripcion: 'Instalación de Banda Ancha y TV', grupo: 'INSTALACIONES MULTIPRODUCTO', categoria: 'ATENCION AL CLIENTE', puntos: 2, observacion: 'Combo Internet + TV (sin voz)', mapeo: { tipo_trabajo_pattern: 'At------At', subtipo_actividad: 'Alta' }, orden: 34 },
      { codigo: '390050', descripcion: 'Instalación de Banda Ancha y TV con Reutilización de DROP', grupo: 'INSTALACIONES MULTIPRODUCTO', categoria: 'ATENCION AL CLIENTE', puntos: 2.13, observacion: 'Combo Internet + TV con DROP existente', mapeo: { tipo_trabajo_pattern: 'At------At', requiere_reutilizacion_drop: 'SI' }, orden: 35 },
      { codigo: '390048', descripcion: 'Instalación de Voz/Punto Ppal FTTH, Banda Ancha y TV', grupo: 'INSTALACIONES MULTIPRODUCTO', categoria: 'ATENCION AL CLIENTE', puntos: 2.5, observacion: 'Triple play: Voz + Internet + TV', mapeo: { tipo_trabajo_pattern: 'AtAt----At', subtipo_actividad: 'Alta' }, orden: 36 },
      { codigo: '390051', descripcion: 'Instalación de Voz/Punto Ppal FTTH, Banda Ancha y TV con Reutilización de DROP', grupo: 'INSTALACIONES MULTIPRODUCTO', categoria: 'ATENCION AL CLIENTE', puntos: 2.13, observacion: 'Triple play con DROP existente', mapeo: { tipo_trabajo_pattern: 'AtAt----At', requiere_reutilizacion_drop: 'SI' }, orden: 37 },

      // ═══ GRUPO RUTINAS Y PREVENTIVOS ═══
      { codigo: '540050', descripcion: 'RP de Servicio FTTX en casa cliente', grupo: 'RUTINAS Y PREVENTIVOS', categoria: 'ATENCION AL CLIENTE', puntos: 1.5, observacion: 'Rutina preventiva en domicilio', mapeo: { subtipo_actividad: 'Rutina' }, orden: 40 },
      { codigo: '540055', descripcion: 'RP de Servicio FTTX en casa cliente coincidente con alta y/o rutina', grupo: 'RUTINAS Y PREVENTIVOS', categoria: 'ATENCION AL CLIENTE', puntos: 0.5, observacion: 'Rutina coincidente con otra visita', orden: 41 },
      { codigo: '580341', descripcion: 'Unidad singular para tareas no baremadas', grupo: 'RUTINAS Y PREVENTIVOS', categoria: 'ATENCION AL CLIENTE', puntos: 1, observacion: 'Tarea especial sin código estándar', orden: 42 },

      // ═══ GRUPO ALTO VALOR ═══
      { codigo: '600011', descripcion: 'Verificación de factibilidad en la red óptica FTTX (fotomontaje)', grupo: 'ALTO VALOR', categoria: 'ATENCION AL CLIENTE', puntos: 5.7, observacion: 'Verificación técnica en terreno', mapeo: { subtipo_actividad: 'ALTA ALTO VALOR' }, orden: 50 },
      { codigo: '600012', descripcion: 'Instalación FTTX, Drop o Fibra Óptica entre CTO y dependencia del Cliente', grupo: 'ALTO VALOR', categoria: 'ATENCION AL CLIENTE', puntos: 4.3, observacion: 'Instalación fibra punto a punto', orden: 51 },
      { codigo: '600013', descripcion: 'Instalación Equipos para Servicios FTTX', grupo: 'ALTO VALOR', categoria: 'ATENCION AL CLIENTE', puntos: 3.8, observacion: 'Instalación de equipamiento FTTX', orden: 52 },
      { codigo: '600014', descripcion: 'Upgrade equipo', grupo: 'ALTO VALOR', categoria: 'ATENCION AL CLIENTE', puntos: 3.8, observacion: 'Actualización de equipo existente', mapeo: { subtipo_actividad: 'RUTINA ALTO VALOR' }, orden: 53 },
      { codigo: '600015', descripcion: 'Instalación punto de red', grupo: 'ALTO VALOR', categoria: 'ATENCION AL CLIENTE', puntos: 3.2, observacion: 'Punto de red adicional', orden: 54 },
      { codigo: '600016', descripcion: 'Factibilidad Light', grupo: 'ALTO VALOR', categoria: 'ATENCION AL CLIENTE', puntos: 2.5, observacion: 'Verificación de factibilidad simplificada', orden: 55 },
      { codigo: '600017', descripcion: 'Trabajos fuera de horario', grupo: 'ALTO VALOR', categoria: 'ATENCION AL CLIENTE', puntos: 3, observacion: 'Trabajos realizados fuera del horario normal', orden: 56 },

      // ═══ RESOLUCIÓN DE AVERÍAS ═══
      { codigo: '570010', descripcion: 'Resolución de averías FTTX', grupo: 'RESOLUCIÓN DE AVERÍAS', categoria: 'RESOLUCIÓN DE AVERÍAS', puntos: 1, observacion: 'Reparación de fallas en fibra óptica', mapeo: { subtipo_actividad: 'Fibra Óptica', tipo_trabajo_pattern: 'RCFOP|RFOPA' }, orden: 60 },
      { codigo: '520015', descripcion: 'Desinstalación Servicio BAS Starlink (Banda ancha satelital)', grupo: 'RESOLUCIÓN DE AVERÍAS', categoria: 'RESOLUCIÓN DE AVERÍAS', puntos: 1.5, observacion: 'Retiro de equipo Starlink', orden: 61 },
    ];

    const ops = plantilla.map(t => ({
      updateOne: {
        filter: { codigo: t.codigo, empresaRef },
        update: { $set: { ...t, empresaRef } },
        upsert: true
      }
    }));

    const result = await TarifaLPU.bulkWrite(ops, { ordered: false });
    res.json({
      ok: true,
      mensaje: 'Plantilla LPU Chile cargada exitosamente',
      insertados: result.upsertedCount || 0,
      actualizados: result.modifiedCount || 0,
      total: plantilla.length
    });
  } catch (error) {
    console.error('❌ Cargar plantilla Chile:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

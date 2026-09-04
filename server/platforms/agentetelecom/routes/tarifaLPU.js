const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../auth/authMiddleware');
const TarifaLPU = require('../models/TarifaLPU');
const { invalidarCacheTarifas } = require('../utils/calculoEngine');

// =============================================================================
// CRUD — Tarifas LPU (puntos baremos por empresa)
// =============================================================================

// GET /api/tarifa-lpu/catalogo — Catálogo público de solo lectura (cualquier usuario autenticado)
// Usado por el Portal Colaborador para mostrar el espejo del catálogo LPU baremizada
router.get('/catalogo', protect, async (req, res) => {
  try {
    const tarifas = await TarifaLPU.find({ empresaRef: req.user.empresaRef, activo: true })
      .select('codigo descripcion grupo categoria puntos observacion')
      .sort({ grupo: 1, orden: 1, codigo: 1 })
      .lean();
    res.json(tarifas);
  } catch (error) {
    console.error('❌ GET /api/tarifa-lpu/catalogo:', error.message);
    res.status(500).json({ error: error.message });
  }
});

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
    invalidarCacheTarifas(req.user.empresaRef); // 🔄 Invalidar cache para próximos cálculos
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
    invalidarCacheTarifas(req.user.empresaRef); // 🔄 Invalidar cache para próximos cálculos
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
    invalidarCacheTarifas(req.user.empresaRef); // 🔄 Invalidar cache para próximos cálculos
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
    invalidarCacheTarifas(req.user.empresaRef); // 🔄 Invalidar cache para próximos cálculos
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
      { codigo: '510010', descripcion: 'Alta Voz', grupo: 'RED DE SERVICIO DE VOZ', categoria: 'ATENCION AL CLIENTE', puntos: 1, observacion: 'Instalación nueva de línea de voz', mapeo: { subtipo_actividad: 'Alta', familia_producto: 'TOIP', tipo_trabajo_pattern: '\'-------At|At------A-|At------M-|AtAt------|AtAt----A-|AtM-------|M-------At|M-Mt----At|Mt------A-|Mt------At|MtAt------|MtAt----At|MtAt----M-|MtMt------' }, orden: 1 },
      { codigo: '510012', descripcion: 'Alta Voz con Reutilización de DROP', grupo: 'RED DE SERVICIO DE VOZ', categoria: 'ATENCION AL CLIENTE', puntos: 0.8, observacion: 'Alta de voz reutilizando cable DROP existente', mapeo: { subtipo_actividad: 'Alta', familia_producto: 'TOIP', requiere_reutilizacion_drop: 'SI', tipo_trabajo_pattern: '\'-------At|At------A-|At------M-|AtAt----At|M-------At|M-Mt----At|Mt------At|MtAt------|MtMt------' }, orden: 2 },
      { codigo: '510021', descripcion: 'Alta N-Líneas 2 Líneas', grupo: 'RED DE SERVICIO DE VOZ', categoria: 'ATENCION AL CLIENTE', puntos: 1, observacion: '2 líneas de voz', mapeo: { subtipo_actividad: 'Alta', familia_producto: 'TOIP', tipo_trabajo_pattern: 'AtAt------|2L|DOS_LINEAS|ALTA_2L' }, orden: 3 },
      { codigo: '510022', descripcion: 'Alta N-Líneas 4 Líneas', grupo: 'RED DE SERVICIO DE VOZ', categoria: 'ATENCION AL CLIENTE', puntos: 1.5, observacion: '4 líneas de voz', mapeo: { subtipo_actividad: 'Alta', familia_producto: 'TOIP', tipo_trabajo_pattern: 'AtAt------|4L|CUATRO_LINEAS|ALTA_4L' }, orden: 4 },
      { codigo: '510023', descripcion: 'Alta N-Líneas 8 Líneas', grupo: 'RED DE SERVICIO DE VOZ', categoria: 'ATENCION AL CLIENTE', puntos: 2, observacion: '8 líneas de voz', mapeo: { subtipo_actividad: 'Alta', familia_producto: 'TOIP', tipo_trabajo_pattern: 'AtAt------|8L|OCHO_LINEAS|ALTA_8L' }, orden: 5 },

      // ═══ GRUPO BANDA ANCHA ═══
      { codigo: '520012', descripcion: 'Alta Banda Ancha', grupo: 'BANDA ANCHA', categoria: 'ATENCION AL CLIENTE', puntos: 1.5, observacion: 'Instalación nueva de internet fibra óptica', mapeo: { subtipo_actividad: 'Alta', familia_producto: 'BA', tipo_trabajo_pattern: 'At--------|51--------|BA_FIBRA|ALTA_BA' }, orden: 10 },
      { codigo: '390013', descripcion: 'Alta Banda Ancha con Reutilización de DROP', grupo: 'BANDA ANCHA', categoria: 'ATENCION AL CLIENTE', puntos: 1.7, observacion: 'Alta BA reutilizando cable DROP existente', mapeo: { subtipo_actividad: 'Alta', familia_producto: 'BA', requiere_reutilizacion_drop: 'SI', tipo_trabajo_pattern: 'At--------|Tt--------|AC--------|TC--------' }, orden: 11 },
      { codigo: '540025', descripcion: 'Instalación Access Point coincidente en Alta', grupo: 'BANDA ANCHA', categoria: 'ATENCION AL CLIENTE', puntos: 0.5, observacion: 'Repetidor WiFi instalado junto con el alta del servicio', mapeo: { es_equipo_adicional: true, campo_cantidad: 'Repetidores_WiFi', tipo_trabajo_pattern: 'Mt--------|Tt--------|FK--------|TC--------|*H211', condicion_extra: 'Coincidente con alta' }, orden: 12 },
      { codigo: '540026', descripcion: 'Instalación Access Point WI-Fi', grupo: 'BANDA ANCHA', categoria: 'ATENCION AL CLIENTE', puntos: 0.25, observacion: 'Repetidor/extensor WiFi independiente', mapeo: { es_equipo_adicional: true, campo_cantidad: 'Repetidores_WiFi', tipo_trabajo_pattern: '*H211|REPETIDOR|WIFI|H211_Repetidores_WiFi|AP_WIFI' }, orden: 13 },
      { codigo: '520014', descripcion: 'Instalación Servicio BAS Starlink (Banda ancha satelital)', grupo: 'BANDA ANCHA', categoria: 'ATENCION AL CLIENTE', puntos: 2, observacion: 'Internet satelital Starlink', mapeo: { subtipo_actividad: 'Alta', familia_producto: 'SATELITAL', tipo_trabajo_pattern: 'STARLINK|BAS_STARLINK|INST_STARLINK|BAS' }, orden: 14 },

      // ═══ GRUPO TELEVISION ═══
      { codigo: '830127', descripcion: 'Alta TV', grupo: 'TELEVISION', categoria: 'ATENCION AL CLIENTE', puntos: 1.5, observacion: 'Instalación nueva de TV IPTV', mapeo: { subtipo_actividad: 'Alta', familia_producto: 'IPTV', tipo_trabajo_pattern: '\'-------At|At------A-|At------At|At------M-|M-------At|M-------Mt|M-Mt----At|Mt------At' }, orden: 20 },
      { codigo: '390023', descripcion: 'Alta TV con Reutilización de DROP', grupo: 'TELEVISION', categoria: 'ATENCION AL CLIENTE', puntos: 2.13, observacion: 'Alta TV reutilizando cable DROP', mapeo: { subtipo_actividad: 'Alta', familia_producto: 'IPTV', requiere_reutilizacion_drop: 'SI', tipo_trabajo_pattern: '\'-------At|-------At|At------At|M-------At|Mt------At' }, orden: 21 },
      { codigo: '540056', descripcion: 'Decodificador Adicional en Alta TV', grupo: 'TELEVISION', categoria: 'ATENCION AL CLIENTE', puntos: 0.5, observacion: 'Cada decodificador extra instalado con el alta de TV', mapeo: { es_equipo_adicional: true, campo_cantidad: 'Decos_Adicionales', tipo_trabajo_pattern: '\'-------Mt|-------Mt|At------At|M-------At|DECO_ADIC|*H211_Decos_Adicionales' }, orden: 22 },
      { codigo: '540057', descripcion: 'Decodificador Adicional Wi-Fi TV', grupo: 'TELEVISION', categoria: 'ATENCION AL CLIENTE', puntos: 0.25, observacion: 'Decodificador WiFi adicional', mapeo: { es_equipo_adicional: true, campo_cantidad: 'Decos_Adicionales', tipo_trabajo_pattern: 'DECO_WIFI|WIFI_TV|DECO_IPTV_WIFI', condicion_extra: 'WiFi' }, orden: 23 },
      { codigo: '830130', descripcion: 'Alta Movistar TV', grupo: 'TELEVISION', categoria: 'ATENCION AL CLIENTE', puntos: 0.3, observacion: 'Alta servicio Movistar TV básico', mapeo: { tipo_trabajo_pattern: '\'-------Mt|ACC_NEW|ALTA_CONS|ALTA_DIS|ALTA_HAB|ALTA_ID_CYM|ALTA_UP_HAB|At--------|At-------At|AtAt------|CFOCC|MANTDROP|MANTEQU|Mt------Mt|NEW_FACT|RCFOP|REPASP|RFOPA|TRASINTSP|Tt-------|Tt------Mt|Tt------Tt|TtTt------|TtTt----Tt' }, orden: 24 },

      // ═══ GRUPO INSTALACIONES MULTIPRODUCTO ═══
      { codigo: '390011', descripcion: 'Instalación de Voz/Punto Ppal FTTH y Banda Ancha', grupo: 'INSTALACIONES MULTIPRODUCTO', categoria: 'ATENCION AL CLIENTE', puntos: 2, observacion: 'Combo Voz + Internet', mapeo: { subtipo_actividad: 'Alta', tipo_trabajo_pattern: 'At------At|AtAt------|Tt--------|At--------' }, orden: 30 },
      { codigo: '390014', descripcion: 'Instalación de Voz/Punto Ppal FTTH y Banda Ancha con Reutilización de DROP', grupo: 'INSTALACIONES MULTIPRODUCTO', categoria: 'ATENCION AL CLIENTE', puntos: 1.7, observacion: 'Combo Voz + Internet con DROP existente', mapeo: { subtipo_actividad: 'Alta', requiere_reutilizacion_drop: 'SI', tipo_trabajo_pattern: 'AtAt------|At------At|ALAX-------' }, orden: 31 },
      { codigo: '390021', descripcion: 'Instalación de Voz/Punto Ppal FTTH y TV', grupo: 'INSTALACIONES MULTIPRODUCTO', categoria: 'ATENCION AL CLIENTE', puntos: 2.5, observacion: 'Combo Voz + TV', mapeo: { subtipo_actividad: 'Alta', tipo_trabajo_pattern: '\'-------At|At------Mt|M-------Mt|At------At' }, orden: 32 },
      { codigo: '390024', descripcion: 'Instalación de Voz/Punto Ppal FTTH y TV con Reutilización de DROP', grupo: 'INSTALACIONES MULTIPRODUCTO', categoria: 'ATENCION AL CLIENTE', puntos: 2.13, observacion: 'Combo Voz + TV con DROP existente', mapeo: { subtipo_actividad: 'Alta', requiere_reutilizacion_drop: 'SI', tipo_trabajo_pattern: '\'-------At|At------Mt|M-------Mt' }, orden: 33 },
      { codigo: '390039', descripcion: 'Instalación de Banda Ancha y TV', grupo: 'INSTALACIONES MULTIPRODUCTO', categoria: 'ATENCION AL CLIENTE', puntos: 2, observacion: 'Combo Internet + TV (sin voz)', mapeo: { subtipo_actividad: 'Alta', tipo_trabajo_pattern: 'At------At|Tt------Tt|N1--------|T1--------|TC-------' }, orden: 34 },
      { codigo: '390050', descripcion: 'Instalación de Banda Ancha y TV con Reutilización de DROP', grupo: 'INSTALACIONES MULTIPRODUCTO', categoria: 'ATENCION AL CLIENTE', puntos: 2.13, observacion: 'Combo Internet + TV con DROP existente', mapeo: { subtipo_actividad: 'Alta', requiere_reutilizacion_drop: 'SI', tipo_trabajo_pattern: 'At------At|N1--------|TC-------' }, orden: 35 },
      { codigo: '390048', descripcion: 'Instalación de Voz/Punto Ppal FTTH, Banda Ancha y TV', grupo: 'INSTALACIONES MULTIPRODUCTO', categoria: 'ATENCION AL CLIENTE', puntos: 2.5, observacion: 'Triple play: Voz + Internet + TV', mapeo: { subtipo_actividad: 'Alta', tipo_trabajo_pattern: 'AtAt----At|At------At|Mt------At|ALAX-------|F1--------|N1--------|T1--------|TC-------' }, orden: 36 },
      { codigo: '390051', descripcion: 'Instalación de Voz/Punto Ppal FTTH, Banda Ancha y TV con Reutilización de DROP', grupo: 'INSTALACIONES MULTIPRODUCTO', categoria: 'ATENCION AL CLIENTE', puntos: 2.13, observacion: 'Triple play con DROP existente', mapeo: { subtipo_actividad: 'Alta', requiere_reutilizacion_drop: 'SI', tipo_trabajo_pattern: 'AtAt----At|At------At|ALAX-------|F1--------|N1--------|TC-------' }, orden: 37 },

      // ═══ GRUPO TRASLADOS ═══
      { codigo: '52050', descripcion: 'Traslado TOIP', grupo: 'TRASLADOS', categoria: 'ATENCION AL CLIENTE', puntos: 1.5, observacion: 'Traslado de servicio de voz TOIP', mapeo: { subtipo_actividad: 'Traslado', familia_producto: 'TOIP', tipo_trabajo_pattern: 'TtTt------|TRASLADO_TOIP' }, orden: 40 },
      { codigo: '52051', descripcion: 'Traslado Voz Banda Ancha + IPTV', grupo: 'TRASLADOS', categoria: 'ATENCION AL CLIENTE', puntos: 2, observacion: 'Traslado Voz Banda Ancha + IPTV', mapeo: { subtipo_actividad: 'Traslado', tipo_trabajo_pattern: 'TtTt----Tt|TRASLADO_TRIPLE' }, orden: 41 },
      { codigo: '52052', descripcion: 'Traslado Voz Banda Ancha + IPTV', grupo: 'TRASLADOS', categoria: 'ATENCION AL CLIENTE', puntos: 2, observacion: 'Traslado Voz Banda Ancha + IPTV', mapeo: { subtipo_actividad: 'Traslado', tipo_trabajo_pattern: 'TtTt----Tt|TRASLADO_VOZ_BA_TV' }, orden: 42 },
      { codigo: '52053', descripcion: 'Traslado Banda Ancha + IPTV', grupo: 'TRASLADOS', categoria: 'ATENCION AL CLIENTE', puntos: 2, observacion: 'Traslado Banda Ancha + IPTV', mapeo: { subtipo_actividad: 'Traslado', tipo_trabajo_pattern: 'Tt------Tt|TRASLADO_DUO_BA_TV' }, orden: 43 },
      { codigo: '52055', descripcion: 'Traslado Banda Ancha + IPTV + Reutiliza Drop', grupo: 'TRASLADOS', categoria: 'ATENCION AL CLIENTE', puntos: 1.7, observacion: 'Traslado Banda Ancha + IPTV con Reutilización de Drop', mapeo: { subtipo_actividad: 'Traslado', requiere_reutilizacion_drop: 'SI', tipo_trabajo_pattern: 'Tt------Tt|TRASLADO_REUTILIZA_DROP' }, orden: 44 },

      // ═══ GRUPO RUTINAS Y PREVENTIVOS ═══
      { codigo: '540050', descripcion: 'RP de Servicio FTTX en casa cliente', grupo: 'RUTINAS Y PREVENTIVOS', categoria: 'ATENCION AL CLIENTE', puntos: 1.5, observacion: 'Rutina preventiva en domicilio', mapeo: { subtipo_actividad: 'Rutina', tipo_trabajo_pattern: '\'-------At|\'-------Mt|\'-Mt------|-------Mt|M-------At|M-------Mt|M-Mt----At|M-Mt----M-|Mt--------|Mt------At|Mt------M-|Mt------Mt|MtMt------|MtMt----At|MtMt----Mt|MtMt----M-' }, orden: 50 },
      { codigo: '540051', descripcion: 'RP de Servicio FTTX en casa cliente', grupo: 'RUTINAS Y PREVENTIVOS', categoria: 'ATENCION AL CLIENTE', puntos: 1.5, observacion: 'Rutina preventiva FTTX domicilio', mapeo: { subtipo_actividad: 'Rutina', tipo_trabajo_pattern: '\'-------Mt|Mt--------|Mt------Mt' }, orden: 51 },
      { codigo: '540055', descripcion: 'RP de Servicio FTTX en casa cliente coincidente con alta y/o rutina', grupo: 'RUTINAS Y PREVENTIVOS', categoria: 'ATENCION AL CLIENTE', puntos: 0.5, observacion: 'Rutina coincidente con otra visita', mapeo: { subtipo_actividad: 'Rutina Coincidente', tipo_trabajo_pattern: 'RUTINA_COINC|COINCIDENTE|RP_COINC' }, orden: 52 },
      { codigo: '580341', descripcion: 'Unidad singular para tareas no baremadas', grupo: 'RUTINAS Y PREVENTIVOS', categoria: 'ATENCION AL CLIENTE', puntos: 1, observacion: 'Tarea especial sin código estándar', mapeo: { subtipo_actividad: 'Especial', tipo_trabajo_pattern: 'NO_BAREMADA|SINGULAR|TAREA_ESPECIAL' }, orden: 53 },

      // ═══ GRUPO ALTO VALOR ═══
      { codigo: '600011', descripcion: 'Verificación de factibilidad en la red óptica FTTX (fotomontaje)', grupo: 'ALTO VALOR', categoria: 'ATENCION AL CLIENTE', puntos: 5.7, observacion: 'Verificación técnica en terreno / Fotomontaje', mapeo: { subtipo_actividad: 'ALTA ALTO VALOR', tipo_trabajo_pattern: 'INSTALACION DROP \\+ EQUIPO|INSTDROEQU|INSTEQU|MIGRDROEQU|INSTFACT' }, orden: 60 },
      { codigo: '600012', descripcion: 'Instalación FTTX, Drop o Fibra Óptica entre CTO y dependencia del Cliente', grupo: 'ALTO VALOR', categoria: 'ATENCION AL CLIENTE', puntos: 4.3, observacion: 'Instalación fibra punto a punto CTO a cliente', mapeo: { subtipo_actividad: 'ALTA P2P SSPP', tipo_trabajo_pattern: '\'-------Mt|ACC_NEW|ALTA_CONS|ALTA_DIS|ALTA_HAB|ALTA_ID_CYM|ALTA_SSPP_E2E|ALTA_TRAS_INT|ALTA_UP_HAB|At--------|At------At|CFOCC|MANTDROP|M-Mt----At|M-------At|M-------Mt|Mt--------|Mt------At|Mt------M-|Mt------Mt|NEW_FACT|RCFOP|RFOPA|Tt-------|Tt------Tt|TtTt------|UPGRADEQU' }, orden: 61 },
      { codigo: '600013', descripcion: 'Instalación Equipos para Servicios FTTX', grupo: 'ALTO VALOR', categoria: 'ATENCION AL CLIENTE', puntos: 3.8, observacion: 'Instalación de equipamiento FTTX', mapeo: { subtipo_actividad: 'ALTO VALOR', tipo_trabajo_pattern: 'INSTEQU|INST_EQUIPOS|EQUIPOS_FTTX' }, orden: 62 },
      { codigo: '600014', descripcion: 'Upgrade equipo', grupo: 'ALTO VALOR', categoria: 'ATENCION AL CLIENTE', puntos: 3.8, observacion: 'Actualización de equipo existente', mapeo: { subtipo_actividad: 'RUTINA ALTO VALOR', tipo_trabajo_pattern: 'ALTA_UP_HAB|FACTECLT|INSTEQU|UPGRADEQU|UPGRADE_EQUIPO' }, orden: 63 },
      { codigo: '600015', descripcion: 'Instalación punto de red', grupo: 'ALTO VALOR', categoria: 'ATENCION AL CLIENTE', puntos: 3.2, observacion: 'Punto de red adicional', mapeo: { subtipo_actividad: 'ALTO VALOR', tipo_trabajo_pattern: 'PTO_RED|PUNTO_RED|INST_PTO_RED' }, orden: 64 },
      { codigo: '600016', descripcion: 'Factibilidad Light', grupo: 'ALTO VALOR', categoria: 'ATENCION AL CLIENTE', puntos: 2.5, observacion: 'Verificación de factibilidad simplificada', mapeo: { subtipo_actividad: 'ALTO VALOR', tipo_trabajo_pattern: 'FACT_LIGHT|FACTIBILIDAD|FACT_FTTX' }, orden: 65 },
      { codigo: '600017', descripcion: 'Trabajos fuera de horario', grupo: 'ALTO VALOR', categoria: 'ATENCION AL CLIENTE', puntos: 3, observacion: 'Trabajos realizados fuera del horario normal', mapeo: { subtipo_actividad: 'ALTO VALOR', tipo_trabajo_pattern: 'FUERA_HORARIO|EXTRA_HORARIO|EMERGENCIA' }, orden: 66 },

      // ═══ RESOLUCIÓN DE AVERÍAS ═══
      { codigo: '570010', descripcion: 'Resolución de averías FTTX', grupo: 'RESOLUCIÓN DE AVERÍAS', categoria: 'RESOLUCIÓN DE AVERÍAS', puntos: 1, observacion: 'Reparación de fallas en fibra óptica', mapeo: { subtipo_actividad: 'Fibra Óptica', tipo_trabajo_pattern: 'RCFOP|RFOPA|CFOCC|REPARACION|AVERIA' }, orden: 70 },
      { codigo: '520015', descripcion: 'Desinstalación Servicio BAS Starlink (Banda ancha satelital)', grupo: 'RESOLUCIÓN DE AVERÍAS', categoria: 'RESOLUCIÓN DE AVERÍAS', puntos: 1.5, observacion: 'Retiro de equipo Starlink', mapeo: { subtipo_actividad: 'Averías/Retiro', tipo_trabajo_pattern: 'DES_STARLINK|RETIRO_STARLINK|DESINST_STARLINK' }, orden: 71 },
    ];

    const ops = plantilla.map(t => ({
      updateOne: {
        filter: { codigo: t.codigo, empresaRef },
        update: { $set: { ...t, empresaRef } },
        upsert: true
      }
    }));

    const result = await TarifaLPU.bulkWrite(ops, { ordered: false });
    invalidarCacheTarifas(empresaRef); // 🔄 Invalidar cache de cálculos para que use la nueva plantilla
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

// Helper para ejecutar recalculación en background sin bloquear la respuesta HTTP
async function ejecutarRecalculacion({ empresaId, userEmail, userRole, queryAct, label }) {
  const Actividad = require('../models/Actividad');
  const { obtenerTarifasEmpresa, calcularBaremos, valorizarBaremos, construirMapaValorizacion } = require('../utils/calculoEngine');

  let tarifas = await obtenerTarifasEmpresa(empresaId);
  if (!tarifas || tarifas.length === 0) {
    const TarifaLPU = require('../models/TarifaLPU');
    tarifas = await TarifaLPU.find({}).lean();
  }
  const mapaValor = await construirMapaValorizacion(empresaId);
  console.log(`📋 [${label}] Tarifas: ${tarifas.length} | Mapa: ${Object.keys(mapaValor).length}`);

  const cursor = Actividad.find(queryAct).cursor({ batchSize: 500 });
  let total = 0, actualizados = 0, batch = [];

  for (let act = await cursor.next(); act != null; act = await cursor.next()) {
    total++;
    const baremo = calcularBaremos(act, tarifas);
    const docParaValorizar = {
      ...act.toObject(), ...baremo,
      ID_Recurso: act.idRecursoToa || act.RECURSO || act.idRecurso,
      Pts_Total_Baremo: baremo.Pts_Total_Baremo
    };
    const val = valorizarBaremos(docParaValorizar, mapaValor);
    batch.push({
      updateOne: {
        filter: { _id: act._id },
        update: {
          $set: {
            ...baremo, ...val,
            ptsTotalBaremo: baremo.ptsTotalBaremo,
            PTS_TOTAL_BAREMO: baremo.ptsTotalBaremo,
            Total_Puntos_Baremo: baremo.ptsTotalBaremo,
            ultimaActualizacion: new Date()
          }
        }
      }
    });
    if (batch.length >= 500) {
      await Actividad.bulkWrite(batch);
      actualizados += batch.length;
      batch = [];
      console.log(`   [${label}] ... ${actualizados} procesados`);
    }
  }
  if (batch.length > 0) { await Actividad.bulkWrite(batch); actualizados += batch.length; }
  console.log(`✅ [${label}] COMPLETADO: ${actualizados}/${total} actividades recalculadas.`);
  return { total, actualizados };
}

// POST /api/tarifa-lpu/recalculate-all — Responde inmediatamente y procesa en background
router.post('/recalculate-all', protect, authorize('rend_config_lpu:editar'), async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const Actividad = require('../models/Actividad');
    const userRole = String(req.user?.role || '').toLowerCase().trim();
    const isHighLevel = ['system_admin', 'admin', 'gerencia', 'ceo', 'ceo_genai', 'administrador', 'administrador maestro', 'director', 'coordinador'].includes(userRole);

    let queryAct = isHighLevel ? {} : { empresaRef: empresaId };
    if (!isHighLevel) {
      const countEmp = await Actividad.countDocuments(queryAct);
      if (countEmp === 0) queryAct = {};
    }

    const totalEstimado = await Actividad.countDocuments(queryAct);
    console.log(`🚀 [recalculate-all] Background job para ${req.user.email} — ${totalEstimado} actividades`);

    // ✅ Responder INMEDIATAMENTE (evita timeout de 60s del cliente Axios)
    res.json({
      ok: true,
      mensaje: `Recalculación iniciada. Se procesarán ~${totalEstimado.toLocaleString()} actividades en background. Los cambios se reflejarán en producción en unos minutos.`,
      totalEstimado,
      background: true
    });

    // Procesar en background después de enviar respuesta
    setImmediate(async () => {
      try {
        await ejecutarRecalculacion({ empresaId, userEmail: req.user.email, userRole, queryAct, label: 'ALL' });
      } catch (bgErr) {
        console.error('❌ [recalculate-all background]:', bgErr.message);
      }
    });
  } catch (error) {
    console.error('❌ POST /api/tarifa-lpu/recalculate-all:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/tarifa-lpu/recalculate-month — Responde inmediatamente y procesa en background
router.post('/recalculate-month', protect, authorize('rend_config_lpu:editar'), async (req, res) => {
  try {
    const { anio, mes } = req.body;
    if (!anio || !mes) return res.status(400).json({ error: 'Se requiere anio y mes.' });

    const empresaId = req.user.empresaRef;
    const Actividad = require('../models/Actividad');
    const userRole = String(req.user?.role || '').toLowerCase().trim();
    const isHighLevel = ['system_admin', 'admin', 'gerencia', 'ceo', 'ceo_genai', 'administrador', 'administrador maestro', 'director', 'coordinador'].includes(userRole);

    const desde = new Date(Number(anio), Number(mes) - 1, 1);
    const hasta = new Date(Number(anio), Number(mes), 1);

    const filtroFecha = {
      $or: [
        { Fecha_Actividad: { $gte: desde, $lt: hasta } },
        { fechaActividad: { $gte: desde, $lt: hasta } },
        { FechaActividad: { $gte: desde, $lt: hasta } },
        { fecha: { $gte: desde, $lt: hasta } },
      ]
    };
    const queryAct = isHighLevel ? filtroFecha : { ...filtroFecha, empresaRef: empresaId };

    const totalEstimado = await Actividad.countDocuments(queryAct);
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const nombreMes = MESES[Number(mes) - 1];

    console.log(`📅 [recalculate-month] ${nombreMes} ${anio} — ${totalEstimado} actividades para ${req.user.email}`);

    // ✅ Responder INMEDIATAMENTE (evita timeout de 60s del cliente Axios)
    res.json({
      ok: true,
      mensaje: `Recalculación de ${nombreMes} ${anio} iniciada. Se procesarán ~${totalEstimado.toLocaleString()} actividades en background. Los cambios se reflejarán en producción en unos minutos.`,
      totalEstimado,
      mes,
      anio,
      background: true
    });

    // Procesar en background después de enviar respuesta
    setImmediate(async () => {
      try {
        await ejecutarRecalculacion({
          empresaId, userEmail: req.user.email, userRole, queryAct,
          label: `MES-${nombreMes}-${anio}`
        });
      } catch (bgErr) {
        console.error(`❌ [recalculate-month ${nombreMes}/${anio}]:`, bgErr.message);
      }
    });
  } catch (error) {
    console.error('❌ POST /api/tarifa-lpu/recalculate-month:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


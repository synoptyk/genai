const express = require('express');
const router = express.Router();
const logisticaController = require('../logisticaController');
const { protect, authorize } = require('../../auth/authMiddleware');
const ROLES = require('../../auth/roles');

// Todo el módulo requiere estar autenticado
router.use(protect);

router.get('/tecnicos', authorize('logistica_dashboard:ver'), logisticaController.getTecnicos);
router.get('/buscar-tecnico', authorize('logistica_dashboard:ver'), logisticaController.buscarTecnicoPorRut);
router.get('/vehiculos', authorize('logistica_dashboard:ver'), logisticaController.getVehiculos);

// --- CATEGORÍAS ---
router.get('/categorias', authorize('logistica_configuracion:ver', 'logistica_auditorias:ver', 'logistica_inventario:ver'), logisticaController.getCategorias);
router.post('/categorias', authorize('logistica_configuracion:crear'), logisticaController.createCategoria);

// --- PRODUCTOS ---
router.get('/productos', authorize('logistica_inventario:ver'), logisticaController.getProductos);
router.post('/productos', authorize('logistica_inventario:crear'), logisticaController.createProducto);

// --- ALMACENES ---
router.get('/almacenes', authorize('logistica_almacenes:ver'), logisticaController.getAlmacenes);
router.post('/almacenes', authorize('logistica_almacenes:crear'), logisticaController.createAlmacen);

// --- MOVIMIENTOS ---
router.post('/movimientos', authorize('logistica_movimientos:crear'), logisticaController.registrarMovimiento);
router.get('/movimientos', authorize('logistica_movimientos:ver'), logisticaController.getMovimientos);
router.get('/stock/reporte', authorize('logistica_movimientos:ver'), logisticaController.getStockReport);

// --- DESPACHOS ---
router.get('/despachos', authorize('logistica_despachos:ver'), logisticaController.getDespachos);
router.post('/despachos', authorize('logistica_despachos:crear'), logisticaController.createDespacho);
router.put('/despachos/:id/status', authorize('logistica_despachos:editar'), logisticaController.updateDespachoStatus);

// --- AUDITORÍAS ---
router.get('/auditorias', authorize('logistica_auditorias:ver'), logisticaController.getAuditorias);
router.post('/auditorias', authorize('logistica_auditorias:crear'), logisticaController.createAuditoria);
router.get('/auditorias-tecnico', authorize('logistica_auditorias:ver', ROLES.TECNICO, 'user', 'operativo'), logisticaController.getAuditoriasPorTecnico);
router.get('/stock-tecnico', authorize('logistica_inventario:ver', 'logistica_auditorias:ver', ROLES.TECNICO, 'user', 'operativo'), logisticaController.getStockPorTecnico);

// --- CARGA INICIAL ---
router.post('/carga-inicial', authorize('logistica_configuracion:crear'), logisticaController.cargaInicialStock);
router.get('/configuracion-maestra', authorize('logistica_configuracion:ver'), logisticaController.getConfiguracionMaestra);

// --- PROVEEDORES ---
router.get('/proveedores', authorize('logistica_proveedores:ver'), logisticaController.getProveedores);
router.post('/proveedores', authorize('logistica_proveedores:crear'), logisticaController.createProveedor);
router.put('/proveedores/:id', authorize('logistica_proveedores:editar'), logisticaController.updateProveedor);

// --- TIPOS DE COMPRA ---
router.get('/tipos-compra', authorize('logistica_compras:ver'), logisticaController.getTiposCompra);
router.post('/tipos-compra', authorize('logistica_compras:crear'), logisticaController.createTipoCompra);
router.put('/tipos-compra/:id', authorize('logistica_compras:editar'), logisticaController.updateTipoCompra);
router.delete('/tipos-compra/:id', authorize('logistica_compras:eliminar'), logisticaController.deleteTipoCompra);

// --- COMPRAS (Workflow 360) ---
router.get('/solicitudes-compra', authorize('logistica_compras:ver'), logisticaController.getSolicitudesCompra);
router.post('/solicitudes-compra', authorize('logistica_compras:crear'), logisticaController.createSolicitudCompra);
router.put('/solicitudes-compra/:id', authorize('logistica_compras:editar'), logisticaController.updateSolicitudCompra);

router.get('/ordenes-compra', authorize('logistica_compras:ver'), logisticaController.getOrdenesCompra);
router.post('/ordenes-compra', authorize('logistica_compras:crear'), logisticaController.createOrdenCompra);

console.log("✅ [LOGISTICA] Routes defined successfully.");
module.exports = router;

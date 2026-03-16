const express = require('express');
const router = express.Router();
const logisticaController = require('../logisticaController');
const { protect, authorize } = require('../../auth/authMiddleware');

// Todo el módulo requiere estar autenticado
router.use(protect);

router.get('/tecnicos', logisticaController.getTecnicos);
router.get('/buscar-tecnico', logisticaController.buscarTecnicoPorRut);
router.get('/vehiculos', logisticaController.getVehiculos);

// --- CATEGORÍAS ---
router.get('/categorias', logisticaController.getCategorias);
router.post('/categorias', authorize('ceo_genai', 'ceo', 'admin'), logisticaController.createCategoria);

// --- PRODUCTOS ---
router.get('/productos', logisticaController.getProductos);
router.post('/productos', authorize('ceo_genai', 'ceo', 'admin'), logisticaController.createProducto);

// --- ALMACENES ---
router.get('/almacenes', logisticaController.getAlmacenes);
router.post('/almacenes', authorize('ceo_genai', 'ceo', 'admin'), logisticaController.createAlmacen);

// --- MOVIMIENTOS ---
router.post('/movimientos', logisticaController.registrarMovimiento);
router.get('/movimientos', logisticaController.getMovimientos);
router.get('/stock/reporte', logisticaController.getStockReport);

// --- DESPACHOS ---
router.get('/despachos', logisticaController.getDespachos);
router.post('/despachos', logisticaController.createDespacho);
router.put('/despachos/:id/status', logisticaController.updateDespachoStatus);

// --- AUDITORÍAS ---
router.get('/auditorias', logisticaController.getAuditorias);
router.post('/auditorias', logisticaController.createAuditoria);
router.get('/auditorias-tecnico', logisticaController.getAuditoriasPorTecnico);
router.get('/stock-tecnico', logisticaController.getStockPorTecnico);

// --- CARGA INICIAL ---
router.post('/carga-inicial', authorize('ceo_genai', 'ceo', 'admin'), logisticaController.cargaInicialStock);

// --- CONFIGURACIÓN CONSOLIDADA ---
router.get('/configuracion-maestra', logisticaController.getConfiguracionMaestra);

// --- PROVEEDORES ---
router.get('/proveedores', logisticaController.getProveedores);
router.post('/proveedores', logisticaController.createProveedor);
router.put('/proveedores/:id', logisticaController.updateProveedor);

// --- TIPOS DE COMPRA ---
router.get('/tipos-compra', logisticaController.getTiposCompra);
router.post('/tipos-compra', authorize('ceo_genai', 'ceo', 'admin'), logisticaController.createTipoCompra);
router.put('/tipos-compra/:id', authorize('ceo_genai', 'ceo', 'admin'), logisticaController.updateTipoCompra);
router.delete('/tipos-compra/:id', authorize('ceo_genai', 'ceo', 'admin'), logisticaController.deleteTipoCompra);

// --- COMPRAS (Workflow 360) ---
router.get('/solicitudes-compra', logisticaController.getSolicitudesCompra);
router.post('/solicitudes-compra', logisticaController.createSolicitudCompra);
router.put('/solicitudes-compra/:id', authorize('ceo_genai', 'ceo', 'admin'), logisticaController.updateSolicitudCompra); // Aprobación

router.get('/ordenes-compra', logisticaController.getOrdenesCompra);
router.post('/ordenes-compra', logisticaController.createOrdenCompra);

console.log("✅ [LOGISTICA] Routes defined successfully.");
module.exports = router;

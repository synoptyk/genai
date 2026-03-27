const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../auth/authMiddleware');
const siiController = require('../controllers/siiController');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de Multer para Certificados Digitales (.pfx)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'storage/certificates';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Renombrar con ID de empresa para mayor seguridad
        const empresaId = req.user.empresaRef;
        if (!empresaId) return cb(new Error('Empresa no identificada'), false);
        cb(null, `${empresaId}_sii.pfx`);
    }
});

const upload = multer({
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.pfx' || ext === '.p12') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos .pfx o .p12 (Certificados Digitales).'), false);
        }
    },
    storage: storage
});

/* ─ ENDPOINTS DE BÓVEDA SII Cifrada ─ */
// POST /api/admin/sii/rpa - Guardar o Actualizar RUT/CLAVE para Scraping
router.post('/rpa', authorize('admin_sii:crear'), siiController.guardarCredencialesRPA);

// DELETE /api/admin/sii/rpa - Eliminar/Resetear credenciales guardadas
router.delete('/rpa', authorize('admin_sii:eliminar'), siiController.resetCredencialesRPA);

// GET /api/admin/sii/status - Estado del Robot RPA y Certificado
router.get('/status', authorize('admin_sii:ver'), siiController.estadoIntegracion);

// GET /api/admin/sii/rcv - Obtener datos reales del Dashboard Tributario (vía RPA)
router.get('/rcv', authorize('admin_dashboard_tributario:ver'), siiController.obtenerDatosRCV);

// POST /api/admin/sii/upload-cert - Almacenamiento Seguro del Certificado PFX F.E.
router.post('/upload-cert', authorize('admin_sii:crear'), upload.single('certificadoPfx'), siiController.subirCertificado);

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect } = require('../../auth/authMiddleware');
const GpsActivo = require('../models/GpsActivo');
const PlatformUser = require('../../auth/PlatformUser');
const Producto = require('../../logistica/models/Producto');

// Middleware para verificar que el usuario esté autenticado y tenga empresaRef
router.use(protect);

// Lista de clientes SSE activos
const sseClients = [];

/**
 * @route GET /api/flota/gps-activos/stream
 * @desc Endpoint SSE para recibir actualizaciones en tiempo real
 */
router.get('/stream', protect, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Enviar los headers inmediatamente

    const { empresaRef } = req.user;
    
    const client = {
        id: req.user._id.toString(),
        empresaRef: empresaRef.toString(),
        res
    };
    
    sseClients.push(client);

    req.on('close', () => {
        const idx = sseClients.indexOf(client);
        if (idx !== -1) {
            sseClients.splice(idx, 1);
        }
    });
});

/**
 * @route GET /api/flota/gps-activos
 * @desc Obtener la ubicación más reciente de todos los activos de la empresa
 */
router.get('/', async (req, res) => {
    try {
        const { empresaRef } = req.user;
        
        // Obtenemos los activos más recientes de esta empresa, poblados con datos del trabajador y del producto
        const activos = await GpsActivo.find({ empresaRef })
            .sort({ timestamp: -1 })
            .populate('asignadoA', 'nombres apellidos rut cargo email name')
            .populate('productoRef', 'nombre marca modelo numeroCelular imei nroSerie')
            .lean();
            
        // Filtrar para mantener solo el último reporte de cada activo (basado en el identificador)
        const uniqueActivos = {};
        for (const activo of activos) {
            if (!uniqueActivos[activo.identificador]) {
                uniqueActivos[activo.identificador] = activo;
            }
        }
        
        const activosList = Object.values(uniqueActivos);
        res.json(activosList);
    } catch (error) {
        console.error('Error fetching GPS Activos:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener activos GPS.' });
    }
});

/**
 * @route POST /api/flota/gps-activos/update
 * @desc Endpoint para que los celulares/notebooks envíen su ubicación
 */
router.post('/update', async (req, res) => {
    try {
        const { 
            tipoActivo, 
            identificador, 
            modelo, 
            latitud, 
            longitud, 
            bateria, 
            conexion, 
            origenCaptura 
        } = req.body;
        
        // Si la petición viene autenticada desde una app, usamos el usuario autenticado
        // asumiendo que el usuario es el dueño del celular/notebook
        const asignadoA = req.user._id;
        const empresaRef = req.user.empresaRef;
        
        if (!identificador || latitud === undefined || longitud === undefined) {
            return res.status(400).json({ error: 'Faltan campos obligatorios: identificador, latitud, longitud' });
        }

        // --- ULTRA INTELIGENCIA: CRUCE CON EXISTENCIA GENERAL ---
        // Buscamos si el IMEI/Identificador existe en el inventario corporativo
        const productoVinculado = await Producto.findOne({ 
            empresaRef, 
            imei: identificador, 
            status: 'Activo' 
        });

        const esPersonal = !productoVinculado;
        
        // REGLA: Sólo geolocalizar dispositivos en Existencia General
        if (esPersonal) {
            return res.status(403).json({ 
                error: 'Geolocalización rechazada. El dispositivo no pertenece a la Existencia General corporativa.' 
            });
        }

        const productoRef = productoVinculado ? productoVinculado._id : null;
        const finalModelo = productoVinculado && productoVinculado.modelo ? productoVinculado.modelo : modelo;
        const finalNumeroCelular = productoVinculado && productoVinculado.numeroCelular ? productoVinculado.numeroCelular : (req.body.numeroCelular || null);

        const nuevoRegistro = new GpsActivo({
            empresaRef,
            tipoActivo: tipoActivo || 'CELULAR',
            identificador,
            modelo: finalModelo,
            numeroCelular: finalNumeroCelular,
            asignadoA,
            productoRef,
            esPersonal,
            latitud,
            longitud,
            bateria,
            conexion,
            origenCaptura: origenCaptura || 'APP_MOBILE'
        });

        await nuevoRegistro.save();

        // Emitir a todos los clientes SSE conectados de esta empresa
        const payload = await GpsActivo.findById(nuevoRegistro._id)
            .populate('asignadoA', 'nombres apellidos rut cargo email name')
            .populate('productoRef', 'nombre marca modelo numeroCelular imei nroSerie')
            .lean();

        sseClients.forEach(client => {
            if (client.empresaRef === empresaRef.toString()) {
                client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
            }
        });

        res.status(201).json({ message: 'Ubicación actualizada correctamente', data: nuevoRegistro });
    } catch (error) {
        console.error('Error saving GPS Activo update:', error);
        res.status(500).json({ error: 'Error interno del servidor al actualizar ubicación.' });
    }
});

// ==========================================
// RUTAS ADMINISTRATIVAS (CRUD Manual)
// ==========================================

/**
 * @route GET /api/flota/gps-activos/users
 * @desc Obtiene la lista de usuarios de la empresa para poder asignarles equipos
 */
router.get('/users', async (req, res) => {
    try {
        const { empresaRef } = req.user;
        const users = await PlatformUser.find({ empresaRef })
            .select('_id name nombres apellidos rut email cargo')
            .sort({ nombres: 1 })
            .lean();
        res.json(users);
    } catch (error) {
        console.error('Error fetching users for GPS Activos:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener usuarios.' });
    }
});

/**
 * @route POST /api/flota/gps-activos/admin
 * @desc Crea un activo manualmente desde el panel de administrador
 */
router.post('/admin', async (req, res) => {
    try {
        const { empresaRef } = req.user;
        const { tipoActivo, identificador, modelo, asignadoA } = req.body;

        if (!identificador) {
            return res.status(400).json({ error: 'El identificador (IMEI/MAC) es obligatorio.' });
        }

        // Verificar si ya existe en GPS
        const existe = await GpsActivo.findOne({ empresaRef, identificador });
        if (existe) {
            return res.status(400).json({ error: 'Ya existe un equipo con este identificador.' });
        }

        // --- ULTRA INTELIGENCIA: CRUCE CON EXISTENCIA GENERAL ---
        const productoVinculado = await Producto.findOne({ 
            empresaRef, 
            imei: identificador, 
            status: 'Activo' 
        });

        const esPersonal = !productoVinculado;
        const productoRef = productoVinculado ? productoVinculado._id : null;
        const finalModelo = productoVinculado && productoVinculado.modelo ? productoVinculado.modelo : modelo;
        const finalNumeroCelular = productoVinculado && productoVinculado.numeroCelular ? productoVinculado.numeroCelular : (req.body.numeroCelular || null);

        const nuevoActivo = new GpsActivo({
            empresaRef,
            tipoActivo: tipoActivo || 'CELULAR',
            identificador,
            modelo: finalModelo,
            numeroCelular: finalNumeroCelular,
            asignadoA: asignadoA || null,
            productoRef,
            esPersonal,
            latitud: 0, // Por defecto hasta que transmita
            longitud: 0,
            estado: 'ACTIVO',
            origenCaptura: 'PANEL_ADMIN'
        });

        await nuevoActivo.save();
        
        const activoPoblado = await GpsActivo.findById(nuevoActivo._id)
            .populate('asignadoA', 'nombres apellidos rut cargo email name')
            .populate('productoRef', 'nombre marca modelo numeroCelular imei nroSerie')
            .lean();
            
        res.status(201).json(activoPoblado);
    } catch (error) {
        console.error('Error creando GPS Activo:', error);
        res.status(500).json({ error: 'Error interno del servidor al crear el activo.' });
    }
});

/**
 * @route PUT /api/flota/gps-activos/admin/:id
 * @desc Actualiza la asignación o datos de un equipo existente
 */
router.put('/admin/:id', async (req, res) => {
    try {
        const { empresaRef } = req.user;
        const { tipoActivo, identificador, modelo, asignadoA, estado } = req.body;

        const activo = await GpsActivo.findOne({ _id: req.params.id, empresaRef });
        
        if (!activo) {
            return res.status(404).json({ error: 'Activo no encontrado.' });
        }

        if (tipoActivo) activo.tipoActivo = tipoActivo;
        
        // Si cambia el identificador, re-evaluamos el cruce con Existencia General
        if (identificador && identificador !== activo.identificador) {
            activo.identificador = identificador;
            
            const productoVinculado = await Producto.findOne({ 
                empresaRef, 
                imei: identificador, 
                status: 'Activo' 
            });
            
            activo.productoRef = productoVinculado ? productoVinculado._id : null;
            activo.esPersonal = !productoVinculado;
            if (productoVinculado && productoVinculado.modelo) {
                activo.modelo = productoVinculado.modelo;
            }
            if (productoVinculado && productoVinculado.numeroCelular) {
                activo.numeroCelular = productoVinculado.numeroCelular;
            }
        }
        
        if (modelo !== undefined) activo.modelo = modelo;
        if (req.body.numeroCelular !== undefined && !activo.productoRef) {
            activo.numeroCelular = req.body.numeroCelular;
        }
        if (asignadoA !== undefined) activo.asignadoA = asignadoA || null;
        if (estado) activo.estado = estado;

        await activo.save();
        
        const activoPoblado = await GpsActivo.findById(activo._id)
            .populate('asignadoA', 'nombres apellidos rut cargo email name')
            .populate('productoRef', 'nombre marca modelo numeroCelular imei nroSerie')
            .lean();

        res.json(activoPoblado);
    } catch (error) {
        console.error('Error actualizando GPS Activo:', error);
        res.status(500).json({ error: 'Error interno del servidor al actualizar el activo.' });
    }
});

/**
 * @route DELETE /api/flota/gps-activos/admin/:id
 * @desc Elimina permanentemente un activo
 */
router.delete('/admin/:id', async (req, res) => {
    try {
        const { empresaRef } = req.user;
        const result = await GpsActivo.findOneAndDelete({ _id: req.params.id, empresaRef });
        
        if (!result) {
            return res.status(404).json({ error: 'Activo no encontrado.' });
        }

        res.json({ message: 'Activo eliminado correctamente.' });
    } catch (error) {
        console.error('Error eliminando GPS Activo:', error);
        res.status(500).json({ error: 'Error interno del servidor al eliminar el activo.' });
    }
});

module.exports = router;

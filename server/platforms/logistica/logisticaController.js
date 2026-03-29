const Producto = require('./models/Producto');
const Almacen = require('./models/Almacen');
const Movimiento = require('./models/Movimiento');
const StockNivel = require('./models/StockNivel');
const Despacho = require('./models/Despacho');
const UserGenAi = require('../auth/UserGenAi');
const Vehiculo = require('../agentetelecom/models/Vehiculo');
const AuditoriaInventario = require('./models/AuditoriaInventario');
const Categoria = require('./models/Categoria');
const Tecnico = require('../agentetelecom/models/Tecnico');
const Cliente = require('../agentetelecom/models/Cliente');
const Proveedor = require('./models/Proveedor');
const SolicitudCompra = require('./models/SolicitudCompra');
const OrdenCompra = require('./models/OrdenCompra');
const TipoCompra = require('./models/TipoCompra');
const mailer = require('../../utils/mailer');
const notificationService = require('../../utils/notificationService');
const { logAction } = require('../../utils/auditLogger');

// --- CONFIGURACIÓN CONSOLIDADA ---
const generateCorrelativo = async (modelo, prefijo, empresaRef) => {
    const year = new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    const count = await modelo.countDocuments({
        empresaRef,
        createdAt: { $gte: startOfYear, $lte: endOfYear }
    });

    const sequence = (count + 1).toString().padStart(4, '0');
    return `${prefijo}-${year}-${sequence}`;
};

exports.getConfiguracionMaestra = async (req, res) => {
    try {
        const empresaRef = req.user.empresaRef;
        const [almacenes, categorias, productos, tecnicos, clientes, tiposCompra] = await Promise.all([
            Almacen.find({ empresaRef }).populate('parentAlmacen', 'nombre').populate('tecnicoRef', 'nombres apellidos').populate('clienteRef', 'nombre'),
            Categoria.find({ empresaRef }),
            Producto.find({ empresaRef }).populate('categoria', 'nombre').populate('clienteRef', 'nombre'),
            Tecnico.find({ empresaRef, estadoActual: { $ne: 'FINIQUITADO' } }).select('nombres apellidos rut email'),
            Cliente.find({ empresaRef }),
            TipoCompra.find({ empresaRef, status: 'Activo' })
        ]);
        
        res.json({ almacenes, categorias, productos, tecnicos, clientes, tiposCompra });
    } catch (e) {
        next(e);
    }
};

// --- AUXILIARES ---

exports.getVehiculos = async (req, res) => {
    try {
        const vehiculos = await Vehiculo.find({ empresaRef: req.user.empresaRef, estadoOperativo: 'Operativa' });
        res.json(vehiculos);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

exports.getTecnicos = async (req, res) => {
    try {
        const tecnicos = await Tecnico.find({ 
            empresaRef: req.user.empresaRef,
            estadoActual: { $ne: 'FINIQUITADO' }
        }).select('nombres apellidos rut email'); 
        
        // Mapear campos para consistencia en el front
        const mapped = tecnicos.map(t => ({
            _id: t._id,
            nombres: t.nombres,
            apellidos: t.apellidos,
            rut: t.rut || 'S/R',
            email: t.email
        }));
        
        res.json(mapped);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// --- PRODUCTOS ---

exports.getProductos = async (req, res) => {
    try {
        const productos = await Producto.find({ empresaRef: req.user.empresaRef, status: 'Activo' });
        res.json(productos);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

exports.createProducto = async (req, res) => {
    try {
        const data = { ...req.body, empresaRef: req.user.empresaRef };
        const nuevo = new Producto(data);
        await nuevo.save();

        await notificationService.notifyAction({
            actor: req.user,
            moduleKey: 'logistica_producto',
            action: 'creó',
            entityName: `producto ${nuevo.nombre || nuevo._id}`,
            entityId: nuevo._id,
            companyRef: req.user.empresaRef,
            isImportant: false
        });

        res.status(201).json(nuevo);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

// --- ALMACENES ---

exports.getAlmacenes = async (req, res) => {
    try {
        const almacenes = await Almacen.find({ empresaRef: req.user.empresaRef, status: 'Activo' });
        res.json(almacenes);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

exports.createAlmacen = async (req, res) => {
    try {
        const data = { ...req.body, empresaRef: req.user.empresaRef };
        const nuevo = new Almacen(data);
        await nuevo.save();

        await notificationService.notifyAction({
            actor: req.user,
            moduleKey: 'logistica_almacen',
            action: 'creó',
            entityName: `almacén ${nuevo.nombre || nuevo._id}`,
            entityId: nuevo._id,
            companyRef: req.user.empresaRef,
            isImportant: false
        });

        res.status(201).json(nuevo);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

// --- MOVIMIENTOS Y STOCK (INTELIGENTE V2) ---

const getStockField = (estado) => {
    switch (estado) {
        case 'Nuevo': return 'cantidadNuevo';
        case 'Usado Bueno': return 'cantidadUsadoBueno';
        case 'Usado Malo': return 'cantidadUsadoMalo';
        case 'Merma': return 'cantidadMerma';
        default: return 'cantidadNuevo';
    }
};

exports.registrarMovimiento = async (req, res) => {
    const { tipo, productoRef, cantidad, almacenOrigen, almacenDestino, estadoProducto, motivo, documentoReferencia, fotoUrl } = req.body;
    try {
        const stockField = getStockField(estadoProducto);

        // 1. Crear el registro de movimiento
        const mov = new Movimiento({
            tipo,
            productoRef,
            cantidad,
            estadoProducto,
            almacenOrigen,
            almacenDestino,
            motivo,
            documentoReferencia,
            fotoUrl,
            usuarioRef: req.user._id,
            empresaRef: req.user.empresaRef
        });
        await mov.save();

        // 1.1 Si el movimiento tiene foto y el producto no tiene fotos, guardarla como referencia maestra
        if (fotoUrl) {
            await Producto.findOneAndUpdate(
                { _id: productoRef, empresaRef: req.user.empresaRef },
                { $addToSet: { fotos: fotoUrl } }
            );
        }

        // 2. Lógica de actualización de stock multidimensional
        const isEntry = ['ENTRADA', 'RECEPCION', 'AJUSTE', 'REVERSA'].includes(tipo);
        const isExit = ['SALIDA', 'ASIGNACION', 'MERMA'].includes(tipo);
        const isTransfer = tipo === 'TRASPASO' || tipo === 'ASIGNACION' || tipo === 'REVERSA';

        if (isTransfer) {
            // Salida de origen
            if (almacenOrigen) {
                await StockNivel.findOneAndUpdate(
                    { productoRef, almacenRef: almacenOrigen, empresaRef: req.user.empresaRef },
                    { $inc: { [stockField]: -cantidad } }
                );
            }
            // Entrada a destino
            if (almacenDestino) {
                await StockNivel.findOneAndUpdate(
                    { productoRef, almacenRef: almacenDestino, empresaRef: req.user.empresaRef },
                    { $inc: { [stockField]: cantidad } },
                    { upsert: true }
                );
            }
        } else if (isEntry) {
            await StockNivel.findOneAndUpdate(
                { productoRef, almacenRef: almacenDestino, empresaRef: req.user.empresaRef },
                { $inc: { [stockField]: cantidad } },
                { upsert: true }
            );
        } else if (isExit) {
            await StockNivel.findOneAndUpdate(
                { productoRef, almacenRef: almacenOrigen, empresaRef: req.user.empresaRef },
                { $inc: { [stockField]: -cantidad } },
                { upsert: true }
            );
        }

        // 3. Si es MERMA y viene de un ajuste o salida, asegurar que se registre en el campo Merma del almacén
        if (tipo === 'MERMA' && almacenOrigen) {
            await StockNivel.findOneAndUpdate(
                { productoRef, almacenRef: almacenOrigen, empresaRef: req.user.empresaRef },
                { $inc: { cantidadMerma: cantidad } },
                { upsert: true }
            );
        }

        // 4. Actualizar Stock Total en el Producto para acceso rápido (Solo cuenta nuevo y bueno)
        const totalImpact = (isEntry ? cantidad : (isExit ? -cantidad : 0));
        if (totalImpact !== 0 && (estadoProducto === 'Nuevo' || estadoProducto === 'Usado Bueno')) {
            await Producto.findOneAndUpdate(
                { _id: productoRef, empresaRef: req.user.empresaRef },
                { $inc: { stockActual: totalImpact } }
            );
        }

        await logAction(req, 'Logistica', 'MOVIMIENTO', { tipo, productoRef, cantidad, motivo });
        res.json({ message: 'Movimiento registrado con éxito', movimiento: mov });
    } catch (e) {
        next(e);
    }
};

exports.getStockReport = async (req, res, next) => {
    try {
        const stock = await StockNivel.find({ empresaRef: req.user.empresaRef })
            .populate({
                path: 'productoRef',
                select: 'nombre sku categoria stockMinimo tipo valorUnitario movilidad vidaUtilMeses fechaAdquisicion fotos marca modelo propiedad clienteRef',
                populate: [
                    { path: 'categoria', select: 'nombre prioridadValor tipoRotacion' },
                    { path: 'clienteRef', select: 'nombre' }
                ]
            })
            .populate({
                path: 'almacenRef',
                select: 'nombre codigo tipo tecnicoRef',
                populate: { path: 'tecnicoRef', select: 'nombres apellidos rut' }
            }).lean();
        
        res.json(stock);
    } catch (e) {
        next(e);
    }
};

// --- DESPACHOS (360 INTEGRATION) ---

exports.getDespachos = async (req, res) => {
    try {
        const despachos = await Despacho.find({ empresaRef: req.user.empresaRef })
            .populate('items.productoRef', 'nombre sku')
            .populate('vehiculoRef', 'patente marca modelo')
            .populate(' choferRef', 'name email')
            .sort({ createdAt: -1 })
            .lean();
        res.json(despachos);
    } catch (e) {
        next(e);
    }
};

exports.createDespacho = async (req, res) => {
    try {
        const codigo = `DESP-${Date.now().toString().slice(-6)}`;
        const { items, almacenOrigen, vehiculoRef, choferRef, direccionEntrega, clienteTag, fechaPrometida, observaciones } = req.body;
        
        const data = { 
            ...req.body, 
            codigoDespacho: codigo, 
            empresaRef: req.user.empresaRef 
        };
        
        const nuevo = new Despacho(data);
        await nuevo.save();

        // INTEGRACIÓN 360: Descontar Stock Real al crear el despacho
        if (almacenOrigen && items && items.length > 0) {
            for (const item of items) {
                // 1. Descontar de StockNivel (Priorizamos estado 'Nuevo')
                // Buscamos si hay stock nuevo, si no, bueno, etc. Para simplificar, descontamos de 'cantidadNuevo'
                await StockNivel.findOneAndUpdate(
                    { productoRef: item.productoRef, almacenRef: almacenOrigen, empresaRef: req.user.empresaRef },
                    { $inc: { cantidadNuevo: -item.cantidad } }
                );

                // 2. Descontar Stock Gral del Producto
                await Producto.findOneAndUpdate(
                    { _id: item.productoRef, empresaRef: req.user.empresaRef },
                    { $inc: { stockActual: -item.cantidad } }
                );

                // 3. Registrar Movimiento de Salida
                const mov = new Movimiento({
                    tipo: 'SALIDA',
                    productoRef: item.productoRef,
                    cantidad: item.cantidad,
                    estadoProducto: 'Nuevo',
                    almacenOrigen: almacenOrigen,
                    motivo: `Despacho ${codigo}`,
                    documentoReferencia: codigo,
                    usuarioRef: req.user._id,
                    empresaRef: req.user.empresaRef
                });
                await mov.save();
            }
        }

        await notificationService.notifyAction({
            actor: req.user,
            moduleKey: 'logistica_despacho',
            action: 'creó',
            entityName: `despacho ${nuevo.codigoDespacho || nuevo._id}`,
            entityId: nuevo._id,
            companyRef: req.user.empresaRef,
            isImportant: true,
            messageExtra: `estado ${nuevo.status || 'pendiente'}`
        });

        res.status(201).json(nuevo);
    } catch (e) {
        console.error("Error creating dispatch", e);
        res.status(400).json({ message: e.message });
    }
};

exports.updateDespachoStatus = async (req, res) => {
    const { status, observaciones } = req.body;
    try {
        const desp = await Despacho.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            { status, observaciones },
            { new: true }
        );
        if (desp) {
            await notificationService.notifyAction({
                actor: req.user,
                moduleKey: 'logistica_despacho',
                action: 'actualizó',
                entityName: `despacho ${desp.codigoDespacho || desp._id}`,
                entityId: desp._id,
                companyRef: req.user.empresaRef,
                isImportant: true,
                messageExtra: `estado ${status || 'sin estado'}`
            });
        }
        res.json(desp);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

// --- AUDITORÍAS (Weekly Cycle Counts) ---

exports.getAuditorias = async (req, res) => {
    try {
        const data = await AuditoriaInventario.find({ empresaRef: req.user.empresaRef })
            .populate('almacen', 'nombre codigo tipo')
            .populate('supervisor', 'name')
            .populate('auditadoRef', 'nombres apellidos rut cargo')
            .populate('detalles.producto', 'nombre sku')
            .sort({ createdAt: -1 })
            .lean();
        res.json(data);
    } catch (e) {
        next(e);
    }
};

exports.createAuditoria = async (req, res) => {
    try {
        const { auditadoId, datosAuditado, firmaAceptacion, firmaFinalizacion, almacenId, detalles, observaciones } = req.body;
        const empresaRef = req.user.empresaRef;
        const auditadoRef = auditadoId; // Normalizar nombre de variable

        let tieneDiscrepancia = false;
        const detallesProcesados = detalles.map(d => {
            const dif = d.conteoFisico - d.stockSistema;
            if (dif !== 0) tieneDiscrepancia = true;
            
            // Verificación forense básica: foto obligatoria
            if (!d.fotoUrl) throw new Error(`La foto es obligatoria para el producto ${d.producto}`);

            return { 
                ...d, 
                diferencia: dif,
                coordenadasGps: d.coordenadasGps || null,
                comentario: d.comentario || '' // Soporte para comentarios por item
            };
        });

        const auditoria = new AuditoriaInventario({
            empresaRef,
            almacen: almacenId,
            supervisor: req.user._id,
            auditadoRef,
            datosAuditado,
            firmaAceptacion,
            firmaFinalizacion,
            detalles: detallesProcesados,
            observaciones,
            tieneDiscrepancia
        });

        await auditoria.save();

        if (tieneDiscrepancia) {
            // Notificar a involucrados (Ejemplos ficticios de emails, el controlador debería buscar los del supervisor/manager)
            const destinatarios = ['logistica@centraliza-t.cl', 'rrhh@centraliza-t.cl', 'finanzas@centraliza-t.cl'];
            
            // Si el técnico tiene email, incluirlo
            const tecnico = await Tecnico.findOne({ _id: auditadoRef, empresaRef: req.user.empresaRef });
            if (tecnico?.email) destinatarios.push(tecnico.email);
            
            await mailer.sendAuditoriaDiscrepanciaEmail(auditoria, destinatarios);
            console.log("ALERTA: Discrepancia detectada en auditoría. Notificaciones enviadas.");
        }

        res.status(201).json(auditoria);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

// --- CATEGORÍAS ---

exports.getCategorias = async (req, res) => {
    try {
        const categorias = await Categoria.find({ empresaRef: req.user.empresaRef, status: 'Activo' });
        res.json(categorias);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

exports.createCategoria = async (req, res) => {
    try {
        const data = { ...req.body, empresaRef: req.user.empresaRef };
        const nueva = new Categoria(data);
        await nueva.save();
        res.status(201).json(nueva);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

// --- CARGA INICIAL DE EXISTENCIAS (Bulk Load) ---

exports.cargaInicialStock = async (req, res) => {
    try {
        const { almacenId, productos } = req.body; // Array de { productoRef, cantidad, estadoProducto }
        const empresaRef = req.user.empresaRef;

        for (const item of productos) {
            const stockField = getStockField(item.estadoProducto);
            
            // 1. Registrar Movimiento
            const mov = new Movimiento({
                tipo: 'ENTRADA',
                productoRef: item.productoRef,
                cantidad: item.cantidad,
                estadoProducto: item.estadoProducto,
                almacenDestino: almacenId,
                motivo: 'Carga Inicial de Existencias',
                referencia: 'INVENTARIO INICIAL',
                fotoUrl: item.fotoUrl,
                usuarioRef: req.user._id,
                empresaRef
            });
            await mov.save();

            // 2. Actualizar StockNivel
            await StockNivel.findOneAndUpdate(
                { productoRef: item.productoRef, almacenRef: almacenId, empresaRef },
                { $inc: { [stockField]: item.cantidad } },
                { upsert: true }
            );

            // 3. Actualizar Producto
            if (item.estadoProducto === 'Nuevo' || item.estadoProducto === 'Usado Bueno') {
                await Producto.findOneAndUpdate(
                    { _id: item.productoRef, empresaRef },
                    { 
                        $inc: { stockActual: item.cantidad },
                        $addToSet: { fotos: item.fotoUrl } 
                    }
                );
            }
        }

        res.json({ message: 'Carga inicial completada con éxito' });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

// --- HISTORIAL DE MOVIMIENTOS ---

exports.getMovimientos = async (req, res) => {
    try {
        const movs = await Movimiento.find({ empresaRef: req.user.empresaRef })
            .populate('productoRef', 'nombre sku')
            .populate('usuarioRef', 'name')
            .populate('almacenOrigen', 'nombre codigo')
            .populate('almacenDestino', 'nombre codigo')
            .sort({ createdAt: -1 })
            .limit(1000);
        res.json(movs);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

exports.buscarTecnicoPorRut = async (req, res) => {
    try {
        const { rut } = req.query;
        if (!rut) return res.status(400).json({ message: 'RUT es requerido' });
        
        const cleanRut = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();
        const tecnico = await Tecnico.findOne({ 
            rut: cleanRut,
            empresaRef: req.user.empresaRef 
        }).populate('projectId');
        
        if (!tecnico) return res.status(404).json({ message: 'Trabajador no encontrado' });
        res.json(tecnico);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

exports.getStockPorTecnico = async (req, res) => {
    try {
        const { rut } = req.query;
        let tecnico;
        if (rut) {
            const cleanRut = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();
            tecnico = await Tecnico.findOne({ rut: cleanRut, empresaRef: req.user.empresaRef });
        } else {
            // Si no hay RUT, intentamos buscarlo por el email del usuario actual (Portal Colaborador)
            tecnico = await Tecnico.findOne({ email: req.user.email, empresaRef: req.user.empresaRef });
        }

        if (!tecnico) return res.status(404).json({ message: 'Técnico no encontrado' });

        const almacenes = await Almacen.find({ tecnicoRef: tecnico._id, empresaRef: req.user.empresaRef });
        const almacenIds = almacenes.map(a => a._id);

        const stock = await StockNivel.find({ almacenRef: { $in: almacenIds }, empresaRef: req.user.empresaRef })
            .populate('productoRef')
            .populate('almacenRef', 'nombre tipo');

        res.json(stock);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

exports.getAuditoriasPorTecnico = async (req, res) => {
    try {
        const { rut } = req.query;
        let tecnico;
        if (rut) {
            const cleanRut = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();
            tecnico = await Tecnico.findOne({ rut: cleanRut, empresaRef: req.user.empresaRef });
        } else {
            tecnico = await Tecnico.findOne({ email: req.user.email, empresaRef: req.user.empresaRef });
        }

        if (!tecnico) return res.status(404).json({ message: 'Técnico no encontrado' });

        const auditorias = await AuditoriaInventario.find({ auditadoRef: tecnico._id })
            .populate('almacen', 'nombre tipo')
            .populate('supervisor', 'name')
            .populate('detalles.producto', 'nombre sku')
            .sort({ createdAt: -1 });

        res.json(auditorias);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// --- PROVEEDORES ---

exports.getProveedores = async (req, res) => {
    try {
        const data = await Proveedor.find({ empresaRef: req.user.empresaRef, status: 'Activo' });
        res.json(data);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

exports.createProveedor = async (req, res) => {
    try {
        const nuevo = new Proveedor({ ...req.body, empresaRef: req.user.empresaRef });
        await nuevo.save();
        res.status(201).json(nuevo);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

exports.updateProveedor = async (req, res) => {
    try {
        const actual = await Proveedor.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            req.body,
            { new: true }
        );
        res.json(actual);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

// --- SOLICITUDES DE COMPRA ---

exports.getSolicitudesCompra = async (req, res) => {
    try {
        const data = await SolicitudCompra.find({ empresaRef: req.user.empresaRef })
            .populate('solicitante', 'name email avatar')
            .populate('aprobador', 'name')
            .populate('items.productoRef', 'nombre codigo sku stock stockActual stockMinimo unidadesMedida')
            .populate('tipoCompraRef', 'nombre')
            .populate('proveedorSugeridoRef', 'nombre rut contacto email')
            .populate('proveedorSeleccionado', 'nombre rut contacto email')
            .sort({ createdAt: -1 })
            .lean();
        res.json(data);
    } catch (e) {
        next(e);
    }
};

exports.createSolicitudCompra = async (req, res) => {
    try {
        const codigoSC = await generateCorrelativo(SolicitudCompra, 'SC', req.user.empresaRef);
        const data = { 
            ...req.body, 
            codigoSC,
            solicitante: req.user._id,
            empresaRef: req.user.empresaRef,
            status: 'Pendiente'
        };
        const nueva = new SolicitudCompra(data);
        await nueva.save();
        res.status(201).json(nueva);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

// Gestión de Aprobación Multi-Nivel (con escalamiento a Gerencia)
exports.updateSolicitudCompra = async (req, res) => {
    const { status, items, comentarioAprobador, observacionModificacion } = req.body;
    const userRole = req.user.role;
    const isGerencia = ['ceo_genai', 'ceo', 'gerencia'].includes(userRole);

    try {
        const sol = await SolicitudCompra.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef })
            .populate('solicitante', 'name email')
            .populate('items.productoRef', 'nombre');
        if (!sol) return res.status(404).json({ message: 'Solicitud no encontrada' });

        // --- DETECCIÓN DE CAMBIO EN CANTIDADES ---
        let cantidadAlterada = false;
        if (items && items.length > 0) {
            for (let i = 0; i < items.length; i++) {
                const original = sol.items.find(it => it._id.toString() === items[i]._id?.toString() || it.productoRef?.toString() === items[i].productoRef?.toString());
                if (original && parseInt(items[i].cantidadAutorizada) !== parseInt(original.cantidadSolicitada)) {
                    cantidadAlterada = true;
                    break;
                }
            }
        }

        // --- VALIDACIÓN: observación obligatoria al alterar cantidades ---
        if (cantidadAlterada && !observacionModificacion) {
            return res.status(400).json({ 
                message: 'Debes adjuntar una justificación al modificar las cantidades solicitadas.' 
            });
        }

        // --- LÓGICA DE ESCALAMIENTO ---
        let newStatus = status;
        let historialEntry = null;

        if (cantidadAlterada && !isGerencia) {
            // Un usuario sin rol gerencial modifica cantidades → escala a Gerencia
            newStatus = 'Revision Gerencia';
            historialEntry = {
                usuario: req.user.name,
                accion: 'MODIFICACIÓN CON ESCALAMIENTO',
                detalle: `Cantidades alteradas. Justificación: "${observacionModificacion}". Enviado a revisión gerencial.`
            };
        } else if (status === 'Aprobada' && !isGerencia) {
            // Solo gerencia puede aprobar directamente
            return res.status(403).json({ 
                message: 'No tienes permisos para aprobar directamente. La solicitud debe ser revisada por Gerencia.' 
            });
        } else {
            // Acción normal (o gerencia actuando directamente)
            const actionMap = {
                'Aprobada': 'APROBACIÓN GERENCIAL',
                'Rechazada': 'RECHAZO GERENCIAL',
                'Ordenada': 'ORDEN DE COMPRA EMITIDA',
            };
            historialEntry = {
                usuario: req.user.name,
                accion: actionMap[newStatus] || `CAMBIO DE ESTADO: ${newStatus}`,
                detalle: comentarioAprobador || observacionModificacion || 'Sin observaciones adicionales.'
            };
        }
        
        // --- APLICAR CAMBIOS ---
        if (newStatus) sol.status = newStatus;
        if (comentarioAprobador) sol.comentarioAprobador = comentarioAprobador;
        if (observacionModificacion) sol.observacionModificacion = observacionModificacion;
        if (cantidadAlterada) {
            sol.modificador = req.user._id;
        }
        if (items) {
            sol.items = items;
        }
        if (['Aprobada', 'Rechazada'].includes(newStatus)) {
            sol.aprobador = req.user._id;
            sol.fechaAprobacion = new Date();
            // Si se aprueba, pasar automáticamente a Cotizando si no es para stock interno inmediato?
            // Por ahora mantenemos Aprobada y el front gestiona el paso a Cotizando
        }

        // --- GESTIÓN DE COTIZACIONES ---
        if (req.body.cotizaciones) {
            sol.cotizaciones = req.body.cotizaciones;
        }
        if (req.body.proveedorSeleccionado) {
            sol.proveedorSeleccionado = req.body.proveedorSeleccionado;
        }

        sol.historial.push(historialEntry);

        await sol.save();

        // --- NOTIFICACIONES (Email) ---
        try {
            const itemsData = sol.items.map(it => ({
                productoNombre: it.productoRef?.nombre || 'Producto',
                cantidadSolicitada: it.cantidadSolicitada,
                cantidadAutorizada: it.cantidadAutorizada
            }));

            // 1. Notificar al solicitante del cambio de estado
            if (sol.solicitante?.email) {
                await mailer.sendPurchaseNotification({
                    to: sol.solicitante.email,
                    subject: `Tu solicitud de compra cambió a "${newStatus}"`,
                    title: 'Actualización de Solicitud de Compra',
                    subtitle: `Tu solicitud ha pasado al estado: ${newStatus}`,
                    items: itemsData,
                    observation: observacionModificacion,
                    status: newStatus,
                    solicitanteNombre: sol.solicitante.name,
                    empresaId: req.user.empresaRef
                });
            }

            // 2. Si es Revision Gerencia, notificar a gerentes
            if (newStatus === 'Revision Gerencia') {
                const gerentes = await UserGenAi.find({ 
                    empresaRef: req.user.empresaRef, 
                    role: { $in: ['ceo', 'ceo_genai', 'gerencia'] },
                    status: 'Activo' 
                }).select('email name');
                
                for (const gerente of gerentes) {
                    if (gerente.email) {
                        await mailer.sendPurchaseNotification({
                            to: gerente.email,
                            subject: `Solicitud de compra requiere validación gerencial`,
                            title: '⚠️ Revisión Gerencial Requerida',
                            subtitle: `${req.user.name} ha propuesto una modificación de cantidades`,
                            items: itemsData,
                            observation: observacionModificacion,
                            status: 'Revision Gerencia',
                            solicitanteNombre: sol.solicitante?.name || 'N/A',
                            empresaId: req.user.empresaRef
                        });
                    }
                }
            }
        } catch (mailErr) {
            console.error('Error no bloqueante enviando emails de compra:', mailErr.message);
        }

        await logAction(req, 'Logistica', 'SOLICITUD_COMPRA_UPDATE', { 
            id: req.params.id, 
            status: newStatus, 
            justificacion: observacionModificacion 
        });

        res.json(sol);
    } catch (e) {
        next(e);
    }
};

// --- ORDENES DE COMPRA ---

exports.getOrdenesCompra = async (req, res) => {
    try {
        const data = await OrdenCompra.find({ empresaRef: req.user.empresaRef })
            .populate('proveedorRef', 'nombre rut')
            .populate('solicitudRef')
            .populate('items.productoRef', 'nombre sku')
            .sort({ createdAt: -1 });
        res.json(data);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

exports.createOrdenCompra = async (req, res) => {
    try {
        const codigoOC = await generateCorrelativo(OrdenCompra, 'OC', req.user.empresaRef);
        
        // Calcular Finanzas de la OC (IVA 19% Chile)
        const subtotalNeto = req.body.items.reduce((sum, it) => sum + (it.cantidad * it.precioUnitario), 0);
        const iva = Math.round(subtotalNeto * 0.19);
        const total = subtotalNeto + iva;

        const data = { 
            ...req.body, 
            codigoOC,
            subtotalNeto,
            iva,
            total,
            empresaRef: req.user.empresaRef 
        };
        const nueva = new OrdenCompra(data);
        await nueva.save();

        // Si se genera OC, marcar la solicitud original
        if (req.body.solicitudRef) {
            await SolicitudCompra.findByIdAndUpdate(req.body.solicitudRef, { 
                status: 'Ordenada',
                proveedorSeleccionado: req.body.proveedorRef
            });
        }

        res.status(201).json(nueva);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

// --- TIPOS DE COMPRA ---

exports.getTiposCompra = async (req, res) => {
    try {
        const tipos = await TipoCompra.find({ empresaRef: req.user.empresaRef });
        res.json(tipos);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

exports.createTipoCompra = async (req, res) => {
    try {
        const data = { ...req.body, empresaRef: req.user.empresaRef };
        const nuevo = new TipoCompra(data);
        await nuevo.save();
        res.status(201).json(nuevo);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

exports.updateTipoCompra = async (req, res) => {
    try {
        const { id } = req.params;
        const actualizado = await TipoCompra.findOneAndUpdate(
            { _id: id, empresaRef: req.user.empresaRef },
            req.body,
            { new: true }
        );
        res.json(actualizado);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

exports.deleteTipoCompra = async (req, res) => {
    try {
        const { id } = req.params;
        await TipoCompra.findOneAndDelete({ _id: id, empresaRef: req.user.empresaRef });
        res.json({ message: 'Tipo de compra eliminado' });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

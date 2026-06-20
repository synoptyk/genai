const Producto = require('./models/Producto');
const Almacen = require('./models/Almacen');
const Movimiento = require('./models/Movimiento');
const StockNivel = require('./models/StockNivel');
const Despacho = require('./models/Despacho');
const PlatformUser = require('../auth/PlatformUser');
const Vehiculo = require('../agentetelecom/models/Vehiculo');
const AuditoriaInventario = require('./models/AuditoriaInventario');
const Categoria = require('./models/Categoria');
const CargoEquipamiento = require('./models/CargoEquipamiento');
const Tecnico = require('../agentetelecom/models/Tecnico');
const Candidato = require('../rrhh/models/Candidato');
const Cliente = require('../agentetelecom/models/Cliente');
const Proveedor = require('./models/Proveedor');
const SolicitudCompra = require('./models/SolicitudCompra');
const OrdenCompra = require('./models/OrdenCompra');
const TipoCompra = require('./models/TipoCompra');
const ObservacionStock = require('./models/ObservacionStock');
const AutoAuditoriaColaborador = require('./models/AutoAuditoriaColaborador');
const mailer = require('../../utils/mailer');
const notificationService = require('../../utils/notificationService');
const { logAction } = require('../../utils/auditLogger');

const isSupervisorRole = (role) => {
    const r = String(role || '').toLowerCase();
    return r === 'supervisor' || r === 'supervisor_hse';
};

const isMasterUser = (role) => {
    const r = String(role || '').toLowerCase();
    return r === 'system_admin' || r === 'ceo' || r === 'ceo_genai';
};

const normalizeRut = (value) => String(value || '').replace(/[^0-9kK]/g, '').toUpperCase().trim();

const splitName = (fullName) => {
    const clean = String(fullName || '').trim();
    if (!clean) return { nombres: 'Sin', apellidos: 'Nombre' };
    const chunks = clean.split(/\s+/);
    if (chunks.length === 1) return { nombres: chunks[0], apellidos: '-' };
    return {
        nombres: chunks.slice(0, Math.max(1, chunks.length - 2)).join(' ') || chunks[0],
        apellidos: chunks.slice(Math.max(1, chunks.length - 2)).join(' ') || '-'
    };
};

const LOGISTICA_PLATFORM_ROLES = ['supervisor', 'supervisor_hse', 'administrativo', 'admin', 'gerencia', 'jefatura', 'operativo', 'tecnico'];

const ensureLogisticaPersonalBase = async (userOrEmpresaRef) => {
    let empresaRef = null;
    let role = '';

    if (userOrEmpresaRef && typeof userOrEmpresaRef === 'object' && (userOrEmpresaRef.role !== undefined || userOrEmpresaRef.empresaRef !== undefined)) {
        empresaRef = userOrEmpresaRef.empresaRef;
        role = String(userOrEmpresaRef.role || '').toLowerCase();
    } else {
        empresaRef = userOrEmpresaRef;
        role = 'supervisor';
    }

    if (!empresaRef) {
        console.warn("⚠️ [ensureLogisticaPersonalBase] Omitiendo ejecución por empresaRef inválido o nulo.");
        return;
    }

    // 1. Replicar exactamente el filtro de candidatos de Captura de Talento basado en el rol del usuario
    let filter = {};
    if (['system_admin', 'ceo', 'ceo_genai'].includes(role)) {
        filter = {};
    } else if (role === 'admin') {
        filter = {
            $or: [ { empresaRef }, { empresaRef: null }, { empresaRef: { $exists: false } } ]
        };
    } else {
        filter = { empresaRef };
    }

    const candidatos = await Candidato.find(filter)
        .select('rut fullName email phone position projectId projectName area departamento ceco sede contractStartDate status idRecursoToa shirtSize pantsSize jacketSize shoeSize uniformSize bootsSize')
        .lean();

    const candRuts = candidatos.map(c => normalizeRut(c.rut)).filter(Boolean);

    // 2. Eliminar cualquier técnico que:
    //    - Tenga proyectos obsoletos "ULTIMA MILLA"
    //    - O que su RUT no exista en los candidatos (limpiando PlatformUsers agregados en el pasado)
    let deleteFilter = {};
    if (['system_admin', 'ceo', 'ceo_genai'].includes(role)) {
        deleteFilter = {
            $or: [
                { proyecto: { $regex: /^ULTIMA MILLA/i } },
                { rut: { $nin: candRuts } }
            ]
        };
    } else {
        deleteFilter = {
            empresaRef,
            $or: [
                { proyecto: { $regex: /^ULTIMA MILLA/i } },
                { rut: { $nin: candRuts } }
            ]
        };
    }

    await Tecnico.deleteMany(deleteFilter);

    // 3. Registrar o actualizar (espejo online) a los candidatos en la colección de técnicos
    for (const cand of candidatos) {
        const rut = normalizeRut(cand.rut);
        if (!rut) continue;

        const names = splitName(cand.fullName);
        const mappedData = {
            empresaRef: cand.empresaRef || empresaRef,
            rut,
            nombres: names.nombres,
            apellidos: names.apellidos,
            email: cand.email || '',
            telefono: cand.phone || '',
            cargo: cand.position || 'Colaborador',
            projectId: cand.projectId || null,
            proyecto: cand.projectName || '',
            area: cand.area || '',
            departamento: cand.departamento || '',
            ceco: cand.ceco || '',
            sede: cand.sede || '',
            fechaIngreso: cand.contractStartDate || null,
            estadoActual: (cand.status === 'Inactivo' || cand.status === 'Suspendido' || cand.status === 'Bloqueado') ? 'INACTIVO' : 
                          (cand.status === 'Licencia Médica') ? 'LICENCIA MEDICA' :
                          (cand.status === 'Finiquitado') ? 'FINIQUITADO' : 'OPERATIVO',
            idRecursoToa: cand.idRecursoToa || '',
            shirtSize: cand.shirtSize || '',
            pantsSize: cand.pantsSize || '',
            jacketSize: cand.jacketSize || '',
            shoeSize: cand.shoeSize || '',
            uniformSize: cand.uniformSize || '',
            bootsSize: cand.bootsSize || ''
        };

        // Upsert en tiempo real para actuar como espejo online absoluto
        await Tecnico.findOneAndUpdate(
            { rut, empresaRef: cand.empresaRef || empresaRef },
            mappedData,
            { upsert: true, new: true }
        );
    }

    // 5. AUTO-CREACIÓN DE ALMACENES PARA TÉCNICOS (Self-healing & Auto-provisioning)
    // Buscamos todos los técnicos activos para esta empresa
    let allTecnicosQuery = {};
    if (!['system_admin', 'ceo', 'ceo_genai'].includes(role)) {
        allTecnicosQuery.empresaRef = empresaRef;
    }

    const activeTecnicos = await Tecnico.find(allTecnicosQuery).select('_id nombres apellidos empresaRef').lean();
    
    // DEDUPLICACIÓN DE ALMACENES EN TIEMPO REAL (Self-cleaning & Anti-duplication)
    // Buscamos todas las bodegas que tengan tecnicoRef asignado
    let whCleanupQuery = { tecnicoRef: { $exists: true, $ne: null } };
    if (!['system_admin', 'ceo', 'ceo_genai'].includes(role)) {
        whCleanupQuery.empresaRef = empresaRef;
    }
    const allWhs = await Almacen.find(whCleanupQuery).select('_id tecnicoRef createdAt').sort({ createdAt: 1 }).lean();
    
    const whByTechnician = new Map();
    const duplicateWhIds = [];
    
    for (const wh of allWhs) {
        const tecIdStr = String(wh.tecnicoRef);
        if (!whByTechnician.has(tecIdStr)) {
            whByTechnician.set(tecIdStr, wh._id);
        } else {
            // Es un duplicado! Lo guardamos para eliminarlo y mantener solo el más antiguo
            duplicateWhIds.push(wh._id);
        }
    }
    
    if (duplicateWhIds.length > 0) {
        console.log(`🧹 [Logística] Limpiando ${duplicateWhIds.length} bodegas duplicadas para mantener consistencia 1:1.`);
        await Almacen.deleteMany({ _id: { $in: duplicateWhIds } });
    }

    // Obtenemos los almacenes de técnicos ya existentes (cualquier tipo)
    let allAlmacenesQuery = { tecnicoRef: { $exists: true, $ne: null } };
    if (!['system_admin', 'ceo', 'ceo_genai'].includes(role)) {
        allAlmacenesQuery.empresaRef = empresaRef;
    }
    const existingAlmacenes = await Almacen.find(allAlmacenesQuery).select('tecnicoRef').lean();
    const techniciansWithWh = new Set(existingAlmacenes.map(w => String(w.tecnicoRef || '')));

    // Buscamos o creamos la Bodega Central como raíz para cada empresa involucrada
    const getCentralWarehouse = async (targetEmpresaRef) => {
        let centralWh = await Almacen.findOne({ empresaRef: targetEmpresaRef, tipo: 'Central' }).select('_id').lean();
        if (!centralWh) {
            centralWh = await Almacen.findOne({ empresaRef: targetEmpresaRef, nombre: /Central/i }).select('_id').lean();
        }
        if (!centralWh) {
            // Auto-crear Bodega Central si no existe ninguna en absoluto
            const newCentral = new Almacen({
                nombre: 'Bodega Central',
                codigo: `BOD-CENTRAL-${targetEmpresaRef.toString().slice(-4).toUpperCase()}`,
                tipo: 'Central',
                propiedad: 'Propio',
                empresaRef: targetEmpresaRef
            });
            await newCentral.save();
            centralWh = newCentral;
        }
        return centralWh;
    };

    // Auto-creación para cada técnico faltante
    for (const tec of activeTecnicos) {
        if (techniciansWithWh.has(String(tec._id))) continue;

        const targetEmpresaRef = tec.empresaRef || empresaRef;
        const centralWh = await getCentralWarehouse(targetEmpresaRef);

        const tecWhName = `Bodega Móvil - ${tec.nombres} ${tec.apellidos}`;
        const tecWhCode = `MOB-${tec._id.toString().slice(-6).toUpperCase()}`;

        const newWh = new Almacen({
            nombre: tecWhName,
            codigo: tecWhCode,
            tipo: 'Técnico',
            tecnicoRef: tec._id,
            parentAlmacen: centralWh?._id || null, // Por defecto queda con Bodega Central de raíz
            propiedad: 'Propio',
            empresaRef: targetEmpresaRef
        });
        await newWh.save();
    }
};

const getLogisticaPersonal = async (user) => {
    await ensureLogisticaPersonalBase(user);

    const empresaRef = user.empresaRef;
    const role = String(user.role || '').toLowerCase();

    let filter = {};
    if (['system_admin', 'ceo', 'ceo_genai'].includes(role)) {
        filter = {};
    } else if (role === 'admin') {
        filter = {
            $or: [ { empresaRef }, { empresaRef: null }, { empresaRef: { $exists: false } } ]
        };
    } else {
        filter = { empresaRef };
    }

    let tecnicoQuery = {};
    if (!['system_admin', 'ceo', 'ceo_genai'].includes(role)) {
        tecnicoQuery.empresaRef = empresaRef;
    }

    let platformUserQuery = {};
    if (!['system_admin', 'ceo', 'ceo_genai'].includes(role)) {
        platformUserQuery.empresaRef = empresaRef;
    }
    platformUserQuery.status = 'Activo';

    const [tecnicos, usuarios, candidatos] = await Promise.all([
        Tecnico.find(tecnicoQuery)
            .select('nombres apellidos rut email cargo supervisorId estadoActual proyecto mandantePrincipal idRecursoToa projectId shirtSize pantsSize jacketSize shoeSize uniformSize bootsSize fechaIngreso')
            .populate({
                path: 'projectId',
                select: 'nombreProyecto cliente centroCosto',
                populate: { path: 'cliente', select: 'nombre' }
            })
            .lean(),
        PlatformUser.find(platformUserQuery)
            .select('_id rut email role name cargo')
            .lean(),
        Candidato.find(filter)
            .select('rut status')
            .lean()
    ]);

    const byRut = new Map();
    const byEmail = new Map();
    for (const u of usuarios) {
        const rut = normalizeRut(u.rut);
        if (rut && !byRut.has(rut)) byRut.set(rut, u);
        const email = String(u.email || '').toLowerCase().trim();
        if (email && !byEmail.has(email)) byEmail.set(email, u);
    }

    const candByRut = new Map();
    for (const c of candidatos) {
        const rut = normalizeRut(c.rut);
        if (rut) candByRut.set(rut, c.status);
    }

    return tecnicos.map(t => {
        const rut = normalizeRut(t.rut);
        const email = String(t.email || '').toLowerCase().trim();
        const userObj = (rut && byRut.get(rut)) || (email && byEmail.get(email)) || null;

        const nomProyecto = t.proyecto || t.projectId?.nombreProyecto || 'Sin Asignar';
        const nomCliente = t.mandantePrincipal || t.projectId?.cliente?.nombre || 'Sin Asignar';
        const candStatus = rut ? candByRut.get(rut) : null;

        return {
            _id: t._id,
            tecnicoId: t._id,
            platformUserId: userObj?._id || null,
            nombres: t.nombres,
            apellidos: t.apellidos,
            nombreCompleto: `${t.nombres || ''} ${t.apellidos || ''}`.trim(),
            rut: rut || 'S/R',
            email: t.email || userObj?.email || '',
            cargo: t.cargo || userObj?.cargo || userObj?.role || 'Cargo en Préstamo',
            role: userObj?.role || null,
            estadoActual: candStatus || t.estadoActual || 'OPERATIVO',
            supervisorId: t.supervisorId || null,
            proyecto: nomProyecto,
            cliente: nomCliente,
            idRecursoToa: t.idRecursoToa || '',
            shirtSize: t.shirtSize || '',
            pantsSize: t.pantsSize || '',
            jacketSize: t.jacketSize || '',
            shoeSize: t.shoeSize || '',
            uniformSize: t.uniformSize || '',
            bootsSize: t.bootsSize || '',
            fechaIngreso: t.fechaIngreso || null
        };
    });
};

const resolveTecnicoRef = async (empresaRef, item = {}) => {
    if (item.tecnicoRef) return item.tecnicoRef;
    const rut = normalizeRut(item.tecnicoRut || item.rutResponsable || item.rut);
    if (!rut) return null;
    const tecnico = await Tecnico.findOne({ empresaRef, rut }).select('_id').lean();
    return tecnico?._id || null;
};

const resolveChoferRef = async (empresaRef, item = {}) => {
    if (item.choferRef) return item.choferRef;
    const rut = normalizeRut(item.choferRut || item.rutChofer || item.rut);
    if (!rut) return null;
    const user = await PlatformUser.findOne({ empresaRef, rut, status: 'Activo' }).select('_id').lean();
    return user?._id || null;
};

const persistDespachoConMovimientos = async (payload, user) => {
    const codigo = `DESP-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`;
    const data = {
        ...payload,
        codigoDespacho: codigo,
        empresaRef: user.empresaRef
    };

    const nuevo = new Despacho(data);
    await nuevo.save();

    if (payload.almacenOrigen && payload.items && payload.items.length > 0) {
        for (const item of payload.items) {
            await StockNivel.findOneAndUpdate(
                { productoRef: item.productoRef, almacenRef: payload.almacenOrigen, empresaRef: user.empresaRef },
                { $inc: { cantidadNuevo: -item.cantidad } }
            );

            await Producto.findOneAndUpdate(
                { _id: item.productoRef, empresaRef: user.empresaRef },
                { $inc: { stockActual: -item.cantidad } }
            );

            const mov = new Movimiento({
                tipo: 'SALIDA',
                productoRef: item.productoRef,
                cantidad: item.cantidad,
                estadoProducto: 'Nuevo',
                almacenOrigen: payload.almacenOrigen,
                motivo: `Despacho ${codigo}`,
                documentoReferencia: codigo,
                usuarioRef: user._id,
                empresaRef: user.empresaRef
            });
            await mov.save();
        }
    }

    return nuevo;
};

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
        const tecnicos = await getLogisticaPersonal(req.user);
        const empresaRef = req.user.empresaRef;
        const [almacenes, categorias, productos, clientes, tiposCompra, cargoEquipamientos] = await Promise.all([
            Almacen.find({ empresaRef }).populate('parentAlmacen', 'nombre').populate('tecnicoRef', 'nombres apellidos rut cargo estadoActual idRecursoToa').populate('clienteRef', 'nombre'),
            Categoria.find({ empresaRef }),
            Producto.find({ empresaRef }).populate('categoria', 'nombre icono').populate('clienteRef', 'nombre'),
            Cliente.find({ empresaRef }),
            TipoCompra.find({ empresaRef, status: 'Activo' }),
            CargoEquipamiento.find({ empresaRef }).populate({
                path: 'items.productoRef',
                select: 'nombre sku fotos color tipo marca modelo categoria',
                populate: { path: 'categoria', select: 'nombre icono' }
            })
        ]);
        
        res.json({ almacenes, categorias, productos, tecnicos, clientes, tiposCompra, cargoEquipamientos });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// --- AUXILIARES Y ASIGNACION INTELIGENTE ---

exports.asignarCargoPredeterminado = async (req, res, next) => {
    try {
        const { id } = req.params; // Tecnico ID
        const { almacenOrigen, dryRun } = req.body;
        const empresaRef = req.user.empresaRef;

        const tecnico = await Tecnico.findOne({ _id: id, empresaRef });
        if (!tecnico) return res.status(404).json({ message: 'Técnico no encontrado' });

        // Encontrar su bodega móvil (Almacen)
        const almacenTecnico = await Almacen.findOne({ tecnicoRef: id, tipo: 'Técnico', empresaRef });
        if (!almacenTecnico) return res.status(404).json({ message: 'El técnico no tiene una bodega asignada' });

        // Encontrar el CargoEquipamiento que coincida con su cargo (ignorando mayúsculas/minúsculas)
        const cargoQuery = tecnico.cargo ? { $regex: new RegExp(`^${tecnico.cargo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } : null;
        
        const cargoEquip = await CargoEquipamiento.findOne({ 
            empresaRef, 
            $or: [
                { cargo: cargoQuery },
                { nombreTipoCargo: cargoQuery }
            ]
        }).populate({
            path: 'items.productoRef',
            populate: { path: 'categoria' }
        });

        if (!cargoEquip || !cargoEquip.items || cargoEquip.items.length === 0) {
            return res.status(404).json({ message: `No hay configuración de cargo predeterminado para el cargo: ${tecnico.cargo}` });
        }

        // Arrays para guardar la simulación/resultado
        const matchResults = [];
        const fallbacks = [];
        const missingStock = [];
        const asigMovimientos = [];

        for (const item of cargoEquip.items) {
            const prodGen = item.productoRef;
            if (!prodGen) continue;

            const catName = (prodGen.categoria?.nombre || '').toLowerCase();
            const prodName = (prodGen.nombre || '').toLowerCase();
            const originalSku = prodGen.sku;
            
            // Determinar si es ropa o calzado
            const isShoes = /zapato|bota|calzado|zapatilla/.test(prodName) || /zapato|bota|calzado|zapatilla/.test(catName);
            const isPants = /pantalon|pantalón|jeans|blue jean/.test(prodName) || /pantalon/.test(catName);
            const isJacket = /parka|casaca|cortaviento|campera|chaqueta|microforro|poleron|polerón/.test(prodName) || /parka|chaqueta/.test(catName);
            const isShirt = /polera|camisa|geologo|geólogo|chaleco|overol|ropa|uniforme|vestuario/.test(prodName) || /ropa|vestuario|uniforme|epp/.test(catName);
            
            let targetSize = null;
            if (isShoes) targetSize = tecnico.shoeSize || tecnico.bootsSize;
            else if (isPants) targetSize = tecnico.pantsSize;
            else if (isJacket) targetSize = tecnico.jacketSize || tecnico.shirtSize;
            else if (isShirt) targetSize = tecnico.shirtSize || tecnico.jacketSize || tecnico.uniformSize;

            targetSize = String(targetSize || '').trim();

            let matchedProduct = prodGen;
            let matchType = 'exact-fallback';

            if (targetSize && targetSize.length > 0 && targetSize !== 'undefined' && targetSize !== 'null') {
                // Remover cualquier talla explícita en el nombre del producto base
                const baseNameRaw = prodGen.nombre.replace(/\s+(TALLA|T-|SZ|T\.?)\s*[A-Z0-9\.\-]+/ig, '').trim();
                const baseNameEscaped = baseNameRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                // Buscar productos de la misma empresa que coincidan con baseName y la talla
                const posibles = await Producto.find({ 
                    empresaRef, 
                    status: 'Activo',
                    nombre: { $regex: new RegExp(baseNameEscaped, 'i') } 
                }).lean();

                // Filtrar para encontrar la variante específica de la talla
                const variante = posibles.find(p => {
                    const pName = (p.nombre || '').toUpperCase();
                    const sizeRegex = new RegExp(`\\b(TALLA|T-|SZ|T\.?)\\s*${targetSize.toUpperCase()}\\b`, 'i');
                    const sizeDirectRegex = new RegExp(`\\b${targetSize.toUpperCase()}\\b`, 'i');
                    return sizeRegex.test(pName) || sizeDirectRegex.test(pName);
                });

                if (variante) {
                    matchedProduct = variante;
                    matchType = 'size-matched';
                }
            }

            // Validar existencia en almacén de origen si se proporciona
            let stockDisponible = Infinity;
            if (almacenOrigen && !dryRun) {
                const stockRef = await StockNivel.findOne({ 
                    productoRef: matchedProduct._id, 
                    almacenRef: almacenOrigen, 
                    empresaRef 
                });
                const qtyN = stockRef ? stockRef.cantidadNuevo : 0;
                const qtyU = stockRef ? stockRef.cantidadUsadoBueno : 0;
                stockDisponible = qtyN + qtyU;
                
                if (stockDisponible < item.cantidad) {
                    missingStock.push({ 
                        producto: matchedProduct.nombre, 
                        sku: matchedProduct.sku,
                        requerido: item.cantidad, 
                        disponible: stockDisponible 
                    });
                    continue; // Skip assignation for this product if no stock (or maybe you want it to fail all)
                }
            }

            const itemResult = {
                productoOriginal: prodGen.nombre,
                skuOriginal: originalSku,
                tallaDetectada: targetSize,
                productoAsignado: matchedProduct.nombre,
                skuAsignado: matchedProduct.sku,
                productoRef: matchedProduct._id,
                matchType,
                cantidad: item.cantidad,
                estadoProducto: item.estadoProducto
            };

            if (matchType === 'size-matched') matchResults.push(itemResult);
            else fallbacks.push(itemResult);
            
            asigMovimientos.push(itemResult);
        }

        // Si es DryRun, devolver la simulación sin guardar
        if (dryRun) {
            return res.json({
                message: 'Simulación de asignación exitosa',
                tecnico: `${tecnico.nombres} ${tecnico.apellidos}`,
                cargoEncontrado: cargoEquip.nombreTipoCargo,
                tallas: {
                    shirt: tecnico.shirtSize, pants: tecnico.pantsSize, jacket: tecnico.jacketSize, shoe: tecnico.shoeSize
                },
                simulacion: { matches: matchResults, fallbacks, missingStock, totalItems: asigMovimientos.length }
            });
        }

        if (missingStock.length > 0) {
            return res.status(400).json({ 
                message: 'No hay stock suficiente en la bodega de origen para algunos artículos.',
                missingStock 
            });
        }

        // Procesar movimientos reales (Bulk ASIGNACION)
        const finalMovimientos = [];
        const generatedDocRef = await generateCorrelativo(Movimiento, 'GD', empresaRef);

        for (const movItem of asigMovimientos) {
            const mov = new Movimiento({
                tipo: 'ASIGNACION',
                productoRef: movItem.productoRef,
                cantidad: movItem.cantidad,
                estadoProducto: movItem.estadoProducto,
                almacenOrigen: almacenOrigen || null,
                almacenDestino: almacenTecnico._id,
                motivo: `Asignación por Cargo Predeterminado: ${cargoEquip.nombreTipoCargo}`,
                documentoReferencia: generatedDocRef,
                usuarioRef: req.user._id,
                empresaRef
            });
            await mov.save();
            finalMovimientos.push(mov);

            const stockField = movItem.estadoProducto === 'Nuevo' ? 'cantidadNuevo' : 'cantidadUsadoBueno';
            
            if (almacenOrigen) {
                await StockNivel.findOneAndUpdate(
                    { productoRef: movItem.productoRef, almacenRef: almacenOrigen, empresaRef },
                    { $inc: { [stockField]: -movItem.cantidad } },
                    { upsert: true }
                );
            }
            await StockNivel.findOneAndUpdate(
                { productoRef: movItem.productoRef, almacenRef: almacenTecnico._id, empresaRef },
                { $inc: { [stockField]: movItem.cantidad } },
                { upsert: true }
            );

            // Actualizar Stock Total en el Producto para acceso rápido (Solo si sale de un almacén)
            if (almacenOrigen) {
                // Al salir hacia el técnico, no descontamos del "stockActual" (el técnico sigue teniéndolo como propio de la empresa) a menos que queramos aislar. 
                // En registrarMovimiento vemos: "Al salir hacia el tecnico, NO descontamos del stockActual". Wait! En registrarMovimiento: `const totalImpact = (isEntry ? cantidad : (isExit ? -cantidad : 0));` y ASIGNACION es isExit (resta -cantidad).
                await Producto.findOneAndUpdate(
                    { _id: movItem.productoRef, empresaRef },
                    { $inc: { stockActual: -movItem.cantidad } }
                );
            }
        }

        res.json({ 
            message: `Asignación masiva exitosa para ${tecnico.nombres} ${tecnico.apellidos}`,
            movimientosCount: finalMovimientos.length,
            resultados: { matches: matchResults, fallbacks }
        });
    } catch (e) {
        next(e);
    }
};

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
        const personal = await getLogisticaPersonal(req.user);
        res.json(personal);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// --- PRODUCTOS ---

exports.getProductos = async (req, res) => {
    try {
        const query = { empresaRef: req.user.empresaRef };
        if (req.query.includeInactive !== 'true') {
            query.status = 'Activo';
        }
        const productos = await Producto.find(query);
        res.json(productos);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

exports.createProducto = async (req, res) => {
    try {
        let skuVal = req.body.sku ? String(req.body.sku).trim() : '';
        if (!skuVal) {
            const count = await Producto.countDocuments({ empresaRef: req.user.empresaRef });
            skuVal = `PRD-${(count + 1).toString().padStart(5, '0')}`;
        }

        const data = {
            ...req.body,
            sku: skuVal,
            clienteRef: req.body.propiedad === 'Cliente' ? (req.body.clienteRef || null) : null,
            fotos: Array.isArray(req.body.fotos)
                ? req.body.fotos.filter(Boolean)
                : req.body.fotoUrl
                ? [req.body.fotoUrl]
                : [],
            empresaRef: req.user.empresaRef
        };
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

exports.bulkCreateProductos = async (req, res) => {
    try {
        const rows = Array.isArray(req.body?.productos) ? req.body.productos : [];
        if (rows.length === 0) {
            return res.status(400).json({ message: 'Debes enviar el arreglo productos con al menos un registro.' });
        }

        const categorias = await Categoria.find({ empresaRef: req.user.empresaRef }).select('_id nombre codigo').lean();
        const categoriasByCodigo = new Map(categorias.map(c => [String(c.codigo || '').toUpperCase(), c._id]));
        const categoriasByNombre = new Map(categorias.map(c => [String(c.nombre || '').toUpperCase(), c._id]));

        const errores = [];
        let creados = 0;
        let actualizados = 0;

        for (let i = 0; i < rows.length; i += 1) {
            const item = rows[i];
            if (!item?.nombre) {
                errores.push({ fila: i + 1, error: 'Nombre es obligatorio' });
                continue;
            }

            try {
                const categoriaKey = String(item.categoriaCodigo || item.categoriaNombre || item.categoria || '').toUpperCase();
                const categoriaId = categoriasByCodigo.get(categoriaKey) || categoriasByNombre.get(categoriaKey) || null;

                const skuVal = String(item.sku || '').trim();
                let existente = null;
                if (skuVal) {
                    existente = await Producto.findOne({ empresaRef: req.user.empresaRef, sku: skuVal });
                }

                if (existente) {
                    existente.nombre = item.nombre || existente.nombre;
                    existente.categoria = categoriaId || existente.categoria;
                    existente.marca = item.marca !== undefined ? item.marca : existente.marca;
                    existente.modelo = item.modelo !== undefined ? item.modelo : existente.modelo;
                    existente.nroSerie = (item.nroSerie || item.numeroSerie) !== undefined ? (item.nroSerie || item.numeroSerie) : existente.nroSerie;
                    existente.imei = item.imei !== undefined ? item.imei : existente.imei;
                    existente.tipo = item.tipo || existente.tipo;
                    existente.trackSerial = item.trackSerial !== undefined ? item.trackSerial : (!!(existente.nroSerie || existente.imei || item.nroSerie || item.imei));
                    existente.segmentacion = item.segmentacion || existente.segmentacion;
                    existente.color = item.color || existente.color;
                    existente.icono = item.icono || existente.icono;
                    existente.propiedad = item.propiedad || existente.propiedad;
                    existente.clienteRef = item.propiedad === 'Cliente' ? (item.clienteRef || existente.clienteRef) : null;
                    existente.valorUnitario = item.valorUnitario !== undefined ? Number(item.valorUnitario) : existente.valorUnitario;
                    existente.descripcion = item.descripcion || existente.descripcion || '';
                    if (item.imagenUrl) existente.fotos = [item.imagenUrl];
                    await existente.save();
                    actualizados += 1;
                } else {
                    const nuevo = new Producto({
                        nombre: item.nombre,
                        sku: item.sku,
                        categoria: categoriaId,
                        marca: item.marca || '',
                        modelo: item.modelo || '',
                        nroSerie: item.nroSerie || item.numeroSerie || '',
                        imei: item.imei || '',
                        tipo: item.tipo || 'Suministro',
                        trackSerial: item.trackSerial !== undefined ? item.trackSerial : (!!(item.nroSerie || item.numeroSerie || item.imei)),
                        segmentacion: item.segmentacion || 'Estándar',
                        color: item.color || 'Genérico',
                        icono: item.icono || 'Archive',
                        propiedad: item.propiedad || 'Propio',
                        clienteRef: item.propiedad === 'Cliente' ? (item.clienteRef || null) : null,
                        valorUnitario: Number(item.valorUnitario || 0),
                        fotos: item.imagenUrl ? [item.imagenUrl] : [],
                        descripcion: item.descripcion || '',
                        empresaRef: req.user.empresaRef
                    });
                    await nuevo.save();
                    creados += 1;
                }
            } catch (e) {
                errores.push({ fila: i + 1, error: e.message });
            }
        }

        res.status(201).json({
            message: `Carga masiva productos completada. Creados: ${creados}. Actualizados: ${actualizados}. Errores: ${errores.length}.`,
            creados,
            actualizados,
            errores
        });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

exports.updateProducto = async (req, res) => {
    try {
        const productoExistente = await Producto.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!productoExistente) return res.status(404).json({ message: 'Producto no encontrado' });

        const data = { ...req.body };

        // Handle SKU update safely: only generate if 'sku' is explicitly in the payload
        if ('sku' in req.body) {
            let skuVal = req.body.sku ? String(req.body.sku).trim() : '';
            if (!skuVal) {
                if (!productoExistente.sku) {
                    const count = await Producto.countDocuments({ empresaRef: req.user.empresaRef });
                    skuVal = `PRD-${(count + 1).toString().padStart(5, '0')}`;
                } else {
                    skuVal = productoExistente.sku;
                }
            }
            data.sku = skuVal;
        }

        // Handle propiedad / clienteRef update: only modify if propiedad/clienteRef are in the payload
        if ('propiedad' in req.body) {
            data.clienteRef = req.body.propiedad === 'Cliente' ? (req.body.clienteRef || null) : null;
        } else if ('clienteRef' in req.body) {
            data.clienteRef = req.body.clienteRef || null;
        }

        // Handle photos update: only update if fotos or fotoUrl are provided
        if ('fotos' in req.body || 'fotoUrl' in req.body) {
            data.fotos = Array.isArray(req.body.fotos)
                ? req.body.fotos.filter(Boolean)
                : req.body.fotoUrl
                ? [req.body.fotoUrl]
                : [];
        }

        const actualizado = await Producto.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            data,
            { new: true }
        );

        res.json(actualizado);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

exports.deleteProducto = async (req, res) => {
    try {
        const eliminado = await Producto.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!eliminado) return res.status(404).json({ message: 'Producto no encontrado' });

        try {
            const AuditLog = require('../../models/AuditLog');
            await AuditLog.create({
                usuarioRef: req.user._id,
                empresaRef: req.user.empresaRef,
                accion: 'ELIMINACION_PRODUCTO',
                modulo: 'Logística',
                detalles: { sku: eliminado.sku, nombre: eliminado.nombre }
            });
        } catch (e) {
            console.error('Error AuditLog deleteProducto:', e.message);
        }

        res.json({ message: 'Producto eliminado' });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

// --- ALMACENES ---

exports.getAlmacenes = async (req, res) => {
    try {
        await ensureLogisticaPersonalBase(req.user);
        const almacenes = await Almacen.find({ empresaRef: req.user.empresaRef })
            .populate('tecnicoRef', 'nombres apellidos rut cargo estadoActual idRecursoToa')
            .populate('encargado', 'name email')
            .lean();
        res.json(almacenes);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

exports.createAlmacen = async (req, res) => {
    try {
        const tecnicoRef = await resolveTecnicoRef(req.user.empresaRef, req.body);
        const data = {
            ...req.body,
            parentAlmacen: req.body.parentAlmacen || null,
            clienteRef: req.body.clienteRef || null,
            tecnicoRef,
            empresaRef: req.user.empresaRef
        };
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

exports.bulkCreateAlmacenes = async (req, res) => {
    try {
        const rows = Array.isArray(req.body?.almacenes) ? req.body.almacenes : [];
        if (rows.length === 0) {
            return res.status(400).json({ message: 'Debes enviar el arreglo almacenes con al menos un registro.' });
        }

        const creados = [];
        const errores = [];

        for (let i = 0; i < rows.length; i += 1) {
            const item = rows[i];
            if (!item?.nombre) {
                errores.push({ fila: i + 1, error: 'Nombre es obligatorio' });
                continue;
            }

            try {
                const tecnicoRef = await resolveTecnicoRef(req.user.empresaRef, item);
                const nuevo = new Almacen({
                    nombre: item.nombre,
                    codigo: item.codigo,
                    tipo: item.tipo || 'Central',
                    parentAlmacen: item.parentAlmacen || null,
                    tecnicoRef,
                    ubicacion: {
                        direccion: item.direccion || item.ubicacion?.direccion || ''
                    },
                    propiedad: item.propiedad || 'Propio',
                    clienteRef: item.clienteRef || null,
                    empresaRef: req.user.empresaRef
                });
                await nuevo.save();
                creados.push(nuevo._id);
            } catch (e) {
                errores.push({ fila: i + 1, error: e.message });
            }
        }

        res.status(201).json({
            message: `Carga masiva almacenes completada. Creados: ${creados.length}. Errores: ${errores.length}.`,
            creados: creados.length,
            errores
        });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

exports.updateAlmacen = async (req, res) => {
    try {
        const tecnicoRef = await resolveTecnicoRef(req.user.empresaRef, req.body);
        const data = {
            ...req.body,
            parentAlmacen: req.body.parentAlmacen || null,
            clienteRef: req.body.propiedad === 'Cliente' ? (req.body.clienteRef || null) : null,
            tecnicoRef
        };

        const actualizado = await Almacen.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            data,
            { new: true }
        );

        if (!actualizado) return res.status(404).json({ message: 'Almacen no encontrado' });

        await notificationService.notifyAction({
            actor: req.user,
            moduleKey: 'logistica_almacen',
            action: 'actualizó',
            entityName: `almacén ${actualizado.nombre || actualizado._id}`,
            entityId: actualizado._id,
            companyRef: req.user.empresaRef,
            isImportant: false
        });

        res.json(actualizado);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

exports.deleteAlmacen = async (req, res) => {
    try {
        const eliminado = await Almacen.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!eliminado) return res.status(404).json({ message: 'Almacen no encontrado' });

        try {
            const AuditLog = require('../../models/AuditLog');
            await AuditLog.create({
                usuarioRef: req.user._id,
                empresaRef: req.user.empresaRef,
                accion: 'ELIMINACION_ALMACEN',
                modulo: 'Logística',
                detalles: { codigo: eliminado.codigo, nombre: eliminado.nombre }
            });
        } catch (e) {
            console.error('Error AuditLog deleteAlmacen:', e.message);
        }

        await notificationService.notifyAction({
            actor: req.user,
            moduleKey: 'logistica_almacen',
            action: 'eliminó',
            entityName: `almacén ${eliminado.nombre || eliminado._id}`,
            entityId: eliminado._id,
            companyRef: req.user.empresaRef,
            isImportant: false
        });

        res.json({ message: 'Almacen eliminado con éxito' });
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

exports.registrarMovimiento = async (req, res, next) => {
    const { tipo, productoRef, cantidad, almacenOrigen, almacenDestino, estadoProducto, motivo, documentoReferencia, fotoUrl } = req.body;
    try {
        const stockField = getStockField(estadoProducto);

        // Generar correlativo si documentoReferencia es vacío, nulo o marcado como automático
        let finalDocRef = documentoReferencia;
        if (!finalDocRef || finalDocRef === '(AUTO-GENERADO)' || finalDocRef.trim() === '') {
            const prefijo = tipo === 'ASIGNACION' || tipo === 'REVERSA' ? 'GD' : (tipo === 'RECEPCION' ? 'REC' : 'MOV');
            finalDocRef = await generateCorrelativo(Movimiento, prefijo, req.user.empresaRef);
        }

        // 1. Crear el registro de movimiento
        const mov = new Movimiento({
            tipo,
            productoRef,
            cantidad,
            estadoProducto,
            almacenOrigen,
            almacenDestino,
            motivo,
            documentoReferencia: finalDocRef,
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

exports.registrarMovimientosBulk = async (req, res, next) => {
    const { movimientos } = req.body;
    try {
        if (!Array.isArray(movimientos) || movimientos.length === 0) {
            return res.status(400).json({ message: 'Se requiere un arreglo de movimientos.' });
        }

        // Generar un correlativo único para toda la transacción bulk si corresponde
        let bulkDocRef = null;
        if (movimientos.length > 0) {
            const firstMov = movimientos[0];
            if (!firstMov.documentoReferencia || firstMov.documentoReferencia === '(AUTO-GENERADO)' || firstMov.documentoReferencia.trim() === '') {
                const prefijo = firstMov.tipo === 'ASIGNACION' || firstMov.tipo === 'REVERSA' ? 'GD' : (firstMov.tipo === 'RECEPCION' ? 'REC' : 'MOV');
                bulkDocRef = await generateCorrelativo(Movimiento, prefijo, req.user.empresaRef);
            }
        }

        const creados = [];
        for (const movData of movimientos) {
            const { tipo, productoRef, cantidad, almacenOrigen, almacenDestino, estadoProducto, motivo, documentoReferencia, fotoUrl } = movData;
            const stockField = getStockField(estadoProducto);

            const finalDocRef = bulkDocRef || documentoReferencia;

            // 1. Crear el registro de movimiento
            const mov = new Movimiento({
                tipo,
                productoRef,
                cantidad,
                estadoProducto,
                almacenOrigen,
                almacenDestino,
                motivo,
                documentoReferencia: finalDocRef,
                fotoUrl,
                usuarioRef: req.user._id,
                empresaRef: req.user.empresaRef
            });
            await mov.save();
            creados.push(mov);

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
        }

        res.json({ message: `${creados.length} movimientos registrados con éxito.`, movimientos: creados });
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
            .populate('choferRef', 'name email rut')
            .sort({ createdAt: -1 })
            .lean();
        res.json(despachos);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

exports.createDespacho = async (req, res) => {
    try {
        const choferRef = await resolveChoferRef(req.user.empresaRef, req.body);
        const nuevo = await persistDespachoConMovimientos({ ...req.body, choferRef }, req.user);

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

exports.bulkCreateDespachos = async (req, res) => {
    try {
        const rows = Array.isArray(req.body?.despachos) ? req.body.despachos : [];
        if (rows.length === 0) {
            return res.status(400).json({ message: 'Debes enviar el arreglo despachos con al menos un registro.' });
        }

        const errores = [];
        let creados = 0;

        for (let i = 0; i < rows.length; i += 1) {
            const item = rows[i];
            if (!item?.direccionEntrega || !Array.isArray(item?.items) || item.items.length === 0) {
                errores.push({ fila: i + 1, error: 'direccionEntrega e items son obligatorios' });
                continue;
            }

            try {
                const choferRef = await resolveChoferRef(req.user.empresaRef, item);
                await persistDespachoConMovimientos({ ...item, choferRef }, req.user);
                creados += 1;
            } catch (e) {
                errores.push({ fila: i + 1, error: e.message });
            }
        }

        res.status(201).json({
            message: `Carga masiva despachos completada. Creados: ${creados}. Errores: ${errores.length}.`,
            creados,
            errores
        });
    } catch (e) {
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
        const filter = { empresaRef: req.user.empresaRef };

        if (isSupervisorRole(req.user.role)) {
            const team = await Tecnico.find({ empresaRef: req.user.empresaRef, supervisorId: req.user._id }).select('_id').lean();
            const teamIds = team.map(t => t._id);
            filter.auditadoRef = { $in: teamIds };
        }

        const data = await AuditoriaInventario.find(filter)
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

exports.bulkCreateCategorias = async (req, res) => {
    try {
        const rows = Array.isArray(req.body?.categorias) ? req.body.categorias : [];
        if (rows.length === 0) {
            return res.status(400).json({ message: 'Debes enviar el arreglo categorias con al menos un registro.' });
        }

        const errores = [];
        let creados = 0;
        let actualizados = 0;

        for (let i = 0; i < rows.length; i += 1) {
            const item = rows[i];
            if (!item?.nombre) {
                errores.push({ fila: i + 1, error: 'Nombre es obligatorio' });
                continue;
            }

            try {
                const nombre = String(item.nombre || '').trim();
                let existente = await Categoria.findOne({ empresaRef: req.user.empresaRef, nombre });

                if (existente) {
                    existente.descripcion = item.descripcion || existente.descripcion || '';
                    existente.prioridadValor = item.prioridadValor || existente.prioridadValor || 'Bajo Valor';
                    existente.tipoRotacion = item.tipoRotacion || existente.tipoRotacion || 'Rotativo';
                    existente.icono = item.icono || existente.icono || 'Tags';
                    existente.imagenUrl = item.imagenUrl || existente.imagenUrl || '';
                    await existente.save();
                    actualizados += 1;
                } else {
                    const nueva = new Categoria({
                        nombre,
                        empresaRef: req.user.empresaRef,
                        descripcion: item.descripcion || '',
                        prioridadValor: item.prioridadValor || 'Bajo Valor',
                        tipoRotacion: item.tipoRotacion || 'Rotativo',
                        icono: item.icono || 'Tags',
                        imagenUrl: item.imagenUrl || ''
                    });
                    await nueva.save();
                    creados += 1;
                }
            } catch (e) {
                errores.push({ fila: i + 1, error: e.message });
            }
        }

        res.status(201).json({
            message: `Carga masiva categorías completada. Creados: ${creados}. Actualizados: ${actualizados}. Errores: ${errores.length}.`,
            creados,
            actualizados,
            errores
        });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

exports.updateCategoria = async (req, res) => {
    try {
        const actualizada = await Categoria.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            {
                nombre: req.body.nombre,
                descripcion: req.body.descripcion || '',
                prioridadValor: req.body.prioridadValor || 'Bajo Valor',
                tipoRotacion: req.body.tipoRotacion || 'Rotativo',
                icono: req.body.icono || 'Tags',
                imagenUrl: req.body.imagenUrl || ''
            },
            { new: true }
        );
        if (!actualizada) return res.status(404).json({ message: 'Categoría no encontrada' });
        res.json(actualizada);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

exports.deleteCategoria = async (req, res) => {
    try {
        const categoria = await Categoria.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!categoria) return res.status(404).json({ message: 'Categoría no encontrada' });
        res.json({ message: 'Categoría eliminada' });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

exports.deleteAllCategorias = async (req, res) => {
    try {
        if (!isMasterUser(req.user.role)) {
            return res.status(403).json({ message: 'Solo el usuario maestro puede eliminar todas las categorías.' });
        }
        const result = await Categoria.deleteMany({ empresaRef: req.user.empresaRef });
        res.json({ message: `Se eliminaron ${result.deletedCount || 0} categorías.` });
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

        await ensureLogisticaPersonalBase(req.user.empresaRef);
        const cleanRut = normalizeRut(rut);
        const tecnico = await Tecnico.findOne({ rut: cleanRut, empresaRef: req.user.empresaRef }).populate({
            path: 'projectId',
            select: 'nombreProyecto centroCosto cliente',
            populate: { path: 'cliente', select: 'nombre' }
        });
        
        if (!tecnico) return res.status(404).json({ message: 'Trabajador no encontrado' });

        if (isSupervisorRole(req.user.role)) {
            const sameSupervisor = String(tecnico.supervisorId || '') === String(req.user._id || '');
            const sameRut = normalizeRut(req.user.rut) && normalizeRut(req.user.rut) === cleanRut;
            if (!sameSupervisor && !sameRut) {
                return res.status(403).json({ message: 'No autorizado para consultar este trabajador' });
            }
        }

        res.json(tecnico);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

exports.getStockPorTecnico = async (req, res) => {
    try {
        const { rut, tecnicoId } = req.query;
        let tecnico;

        if (tecnicoId) {
            tecnico = await Tecnico.findOne({ _id: tecnicoId, empresaRef: req.user.empresaRef });
        } else if (rut) {
            const cleanRut = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();
            tecnico = await Tecnico.findOne({ rut: cleanRut, empresaRef: req.user.empresaRef });
        } else {
            // Si no hay RUT ni ID, intentamos buscarlo por el email del usuario actual (Portal Colaborador)
            tecnico = await Tecnico.findOne({ email: req.user.email, empresaRef: req.user.empresaRef });
        }

        if (!tecnico) return res.status(404).json({ message: 'Técnico no encontrado' });

        if (isSupervisorRole(req.user.role) && String(tecnico.supervisorId || '') !== String(req.user._id || '')) {
            return res.status(403).json({ message: 'No autorizado para auditar este técnico' });
        }

        const almacenes = await Almacen.find({ tecnicoRef: tecnico._id, empresaRef: req.user.empresaRef });
        const almacenIds = almacenes.map(a => a._id);

        const stock = await StockNivel.find({ almacenRef: { $in: almacenIds }, empresaRef: req.user.empresaRef })
            .populate({
                path: 'productoRef',
                populate: { path: 'categoria', select: 'nombre' }
            })
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

        if (isSupervisorRole(req.user.role) && String(tecnico.supervisorId || '') !== String(req.user._id || '')) {
            return res.status(403).json({ message: 'No autorizado para ver auditorías de este técnico' });
        }

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
    const isGerencia = ['system_admin', 'ceo', 'gerencia'].includes(userRole);

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
                const gerentes = await PlatformUser.find({ 
                    empresaRef: req.user.empresaRef, 
                    role: { $in: ['ceo', 'system_admin', 'gerencia'] },
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

// --- CARGO EQUIPAMIENTO (PREDETERMINADOS) ---

exports.getCargoEquipamientos = async (req, res) => {
    try {
        const list = await CargoEquipamiento.find({ empresaRef: req.user.empresaRef })
            .populate({
                path: 'items.productoRef',
                select: 'nombre sku fotos color tipo marca modelo categoria',
                populate: { path: 'categoria', select: 'nombre icono' }
            });
        res.json(list);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

exports.createCargoEquipamiento = async (req, res) => {
    try {
        const data = { ...req.body, empresaRef: req.user.empresaRef };
        const nueva = new CargoEquipamiento(data);
        await nueva.save();
        
        const populated = await CargoEquipamiento.findById(nueva._id)
            .populate({
                path: 'items.productoRef',
                select: 'nombre sku fotos color tipo marca modelo categoria',
                populate: { path: 'categoria', select: 'nombre icono' }
            });
            
        res.status(201).json(populated);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

exports.updateCargoEquipamiento = async (req, res) => {
    try {
        const actualizada = await CargoEquipamiento.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            req.body,
            { new: true }
        ).populate({
            path: 'items.productoRef',
            select: 'nombre sku fotos color tipo marca modelo categoria',
            populate: { path: 'categoria', select: 'nombre icono' }
        });
        
        if (!actualizada) return res.status(404).json({ message: 'Configuración de cargo no encontrada' });
        res.json(actualizada);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

exports.deleteCargoEquipamiento = async (req, res) => {
    try {
        const eliminada = await CargoEquipamiento.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!eliminada) return res.status(404).json({ message: 'Configuración de cargo no encontrada' });
        res.json({ message: 'Configuración de cargo eliminada con éxito' });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

// --- OBSERVACIONES STOCK ---
exports.createObservacionStock = async (req, res) => {
    try {
        const { tecnicoRef, productoRef, comentario, fotoUrl } = req.body;
        const empresaRef = req.user.empresaRef;

        const tecnico = await Tecnico.findOne({ _id: tecnicoRef, empresaRef });
        if (!tecnico) return res.status(404).json({ message: 'Técnico no encontrado' });

        const supervisorRef = tecnico.supervisorId || null;

        const nuevaObs = new ObservacionStock({
            tecnicoRef,
            productoRef,
            supervisorRef,
            comentario,
            fotoUrl: fotoUrl || '',
            empresaRef,
            estado: 'Abierto'
        });

        await nuevaObs.save();

        if (supervisorRef) {
            await notificationService.notifyAction({
                actor: req.user,
                moduleKey: 'logistica_inventario',
                action: 'reportó observación',
                entityName: `Activo ${productoRef}`,
                entityId: nuevaObs._id,
                companyRef: empresaRef,
                targetUserId: supervisorRef,
                isImportant: true
            });
        }

        res.status(201).json(nuevaObs);
    } catch (e) {
        console.error("Error al crear observación de stock:", e);
        res.status(500).json({ message: 'Error interno al crear la observación' });
    }
};

exports.getObservacionesPorTecnico = async (req, res) => {
    try {
        const { tecnicoId } = req.params;
        const empresaRef = req.user.empresaRef;

        const observaciones = await ObservacionStock.find({
            tecnicoRef: tecnicoId,
            empresaRef,
            estado: 'Abierto'
        }).populate('productoRef', 'nombre sku');

        res.json(observaciones);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

exports.submitAutoAuditoria = async (req, res) => {
    try {
        const { tecnicoId, items } = req.body;
        const empresaRef = req.user.empresaRef;

        if (!tecnicoId || !items || !Array.isArray(items)) {
            return res.status(400).json({ message: 'Datos incompletos para procesar la auto-auditoría.' });
        }

        const tecnico = await Tecnico.findById(tecnicoId);
        if (!tecnico) return res.status(404).json({ message: 'Técnico no encontrado.' });

        const supervisorRef = tecnico.supervisorId || null;
        const observacionesToSave = [];

        for (const item of items) {
            if (item.estado === 'Malo' || item.estado === 'No Tengo') {
                const tipo = item.estado === 'Malo' ? 'Daño' : 'Pérdida';
                const obs = new ObservacionStock({
                    tecnicoRef: tecnicoId,
                    productoRef: item.productoRef,
                    supervisorRef,
                    comentario: item.comentario || `Reportado en Auto-Auditoría: ${item.estado}`,
                    fotoUrl: item.fotoUrl || '',
                    estado: 'Abierto',
                    tipo,
                    empresaRef
                });
                observacionesToSave.push(obs);
            }
        }

        if (observacionesToSave.length > 0) {
            await ObservacionStock.insertMany(observacionesToSave);

            if (supervisorRef) {
                await notificationService.notifyAction({
                    actor: req.user,
                    moduleKey: 'logistica_inventario',
                    action: `reportó discrepancias en su auto-auditoría (${observacionesToSave.length} ítems)`,
                    entityName: 'Auto-Auditoría',
                    entityId: observacionesToSave[0]._id, // ref simple
                    companyRef: empresaRef,
                    targetUserId: supervisorRef,
                    isImportant: true
                });
            }
        }

        res.status(200).json({ message: 'Auto-Auditoría procesada correctamente.', anomalías: observacionesToSave.length });
    } catch (e) {
        console.error('Error procesando auto-auditoría:', e);
        res.status(500).json({ message: 'Error interno al procesar auto-auditoría' });
    }
};

exports.submitAutoAuditoriaFirmada = async (req, res) => {
    try {
        const { tecnicoId, items, firmaUrl, geolocalizacion } = req.body;
        const empresaRef = req.user.empresaRef;

        if (!tecnicoId || !items || !Array.isArray(items) || !firmaUrl || !geolocalizacion) {
            return res.status(400).json({ message: 'Datos incompletos para procesar la auto-auditoría.' });
        }

        const tecnico = await Tecnico.findById(tecnicoId);
        if (!tecnico) return res.status(404).json({ message: 'Técnico no encontrado.' });

        const supervisorRef = tecnico.supervisorId || null;
        const observacionesToSave = [];

        for (const item of items) {
            if (item.estado === 'Malo' || item.estado === 'No Tengo') {
                const tipo = item.estado === 'Malo' ? 'Daño' : 'Pérdida';
                const obs = new ObservacionStock({
                    tecnicoRef: tecnicoId,
                    productoRef: item.productoRef,
                    supervisorRef,
                    comentario: item.comentario || `Reportado en Auto-Auditoría: ${item.estado}`,
                    fotoUrl: item.fotoUrl || '',
                    estado: 'Abierto',
                    tipo,
                    empresaRef
                });
                observacionesToSave.push(obs);
            }
        }

        if (observacionesToSave.length > 0) {
            await ObservacionStock.insertMany(observacionesToSave);

            if (supervisorRef) {
                await notificationService.notifyAction({
                    actor: req.user,
                    moduleKey: 'logistica_inventario',
                    action: `reportó discrepancias en su auto-auditoría firmada (${observacionesToSave.length} ítems)`,
                    entityName: 'Auto-Auditoría',
                    entityId: observacionesToSave[0]._id, // ref simple
                    companyRef: empresaRef,
                    targetUserId: supervisorRef,
                    isImportant: true
                });
            }
        }

        // Guardar el registro de auditoría firmada
        const nuevaAuditoria = new AutoAuditoriaColaborador({
            empresaRef,
            tecnicoRef: tecnicoId,
            items: items.map(i => ({
                productoRef: i.productoRef,
                estado: i.estado,
                comentario: i.comentario,
                fotoUrl: i.fotoUrl
            })),
            firmaUrl,
            geolocalizacion,
            tieneDiscrepancia: observacionesToSave.length > 0
        });

        await nuevaAuditoria.save();

        res.status(200).json({ 
            message: 'Auto-Auditoría firmada y procesada correctamente.', 
            anomalias: observacionesToSave.length,
            auditoriaId: nuevaAuditoria._id
        });
    } catch (e) {
        console.error('Error procesando auto-auditoría firmada:', e);
        res.status(500).json({ message: 'Error interno al procesar auto-auditoría' });
    }
};

exports.getHistorialAutoAuditorias = async (req, res) => {
    try {
        const { tecnicoId } = req.params;
        const auditorias = await AutoAuditoriaColaborador.find({ 
            tecnicoRef: tecnicoId, 
            empresaRef: req.user.empresaRef 
        })
        .populate('items.productoRef', 'nombre sku marca modelo')
        .sort({ fecha: -1 });

        res.json(auditorias);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

exports.bulkCreateCargoEquipamientos = async (req, res) => {
    try {
        const rows = Array.isArray(req.body?.cargos) ? req.body.cargos : [];
        if (rows.length === 0) {
            return res.status(400).json({ message: 'Debes enviar el arreglo cargos con al menos un registro.' });
        }

        // 1. Obtener todos los productos para validar SKU y obtener ID
        const productos = await Producto.find({ empresaRef: req.user.empresaRef }).select('_id sku nombre').lean();
        const productosBySku = new Map(productos.map(p => [String(p.sku || '').trim().toUpperCase(), p]));

        // 2. Agrupar filas de Excel por cargo/nombreTipoCargo
        // La estructura de la fila es: { cargo, nombreTipoCargo, productoSku, cantidad, estadoProducto }
        const groups = {};
        const errores = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const cargo = String(row.cargo || '').trim();
            const nombreTipoCargo = String(row.nombreTipoCargo || row.cargo || 'Técnico General').trim();
            
            if (!cargo) {
                errores.push({ fila: i + 1, error: 'El campo "cargo" es obligatorio.' });
                continue;
            }

            const sku = String(row.productoSku || row.sku || '').trim().toUpperCase();
            if (!sku) {
                errores.push({ fila: i + 1, error: `El SKU del producto es obligatorio para el cargo "${cargo}".` });
                continue;
            }

            const matchedProd = productosBySku.get(sku);
            if (!matchedProd) {
                errores.push({ fila: i + 1, error: `El SKU de producto "${sku}" no existe en el catálogo para el cargo "${cargo}".` });
                continue;
            }

            const qty = Math.max(1, parseInt(row.cantidad, 10) || 1);
            let estado = String(row.estadoProducto || row.estado || 'Nuevo').trim();
            if (!['Nuevo', 'Usado Bueno', 'Usado Malo', 'Merma'].includes(estado)) {
                estado = 'Nuevo';
            }

            const key = nombreTipoCargo.toUpperCase();
            if (!groups[key]) {
                groups[key] = {
                    cargo,
                    nombreTipoCargo,
                    itemsMap: {}
                };
            }

            // Agrupar cantidades por productoRef y estadoProducto para evitar duplicados en el mismo cargo
            const itemKey = `${matchedProd._id}_${estado}`;
            if (!groups[key].itemsMap[itemKey]) {
                groups[key].itemsMap[itemKey] = {
                    productoRef: matchedProd._id,
                    cantidad: 0,
                    estadoProducto: estado
                };
            }
            groups[key].itemsMap[itemKey].cantidad += qty;
        }

        let creados = 0;
        let actualizados = 0;

        // 3. Guardar en Base de Datos
        const groupKeys = Object.keys(groups);
        for (const key of groupKeys) {
            try {
                const grp = groups[key];
                const items = Object.values(grp.itemsMap);

                let existente = await CargoEquipamiento.findOne({ 
                    empresaRef: req.user.empresaRef,
                    nombreTipoCargo: grp.nombreTipoCargo 
                });

                if (existente) {
                    existente.cargo = grp.cargo;
                    existente.items = items;
                    existente.status = 'Activo';
                    await existente.save();
                    actualizados += 1;
                } else {
                    const nuevo = new CargoEquipamiento({
                        cargo: grp.cargo,
                        nombreTipoCargo: grp.nombreTipoCargo,
                        items,
                        empresaRef: req.user.empresaRef,
                        status: 'Activo'
                    });
                    await nuevo.save();
                    creados += 1;
                }
            } catch (err) {
                errores.push({ fila: 'Guardado', error: `Error guardando cargo "${groups[key].nombreTipoCargo}": ${err.message}` });
            }
        }

        res.status(201).json({
            message: `Carga masiva de cargos completada. Creados: ${creados}. Actualizados: ${actualizados}. Errores: ${errores.length}.`,
            creados,
            actualizados,
            errores
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};


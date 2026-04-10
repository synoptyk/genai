const express = require('express');
const router = express.Router();
const Tecnico = require('../models/Tecnico');
const Candidato = require('../../rrhh/models/Candidato');
const PlatformUser = require('../../auth/PlatformUser');
const { protect, authorize } = require('../../auth/authMiddleware');
const ROLES = require('../../auth/roles');

// Helper to normalize RUT for comparison
const cleanRut = (r) => (r || "").toString().replace(/[^0-9kK]/g, '').toUpperCase().trim();
const formatRutWithDash = (r) => {
  const clean = cleanRut(r);
  if (!clean || clean.length < 2) return r || '';
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
};

// --- HERRAMIENTA DE LIMPIEZA Y REPARACIÓN ---
// (Visit http://localhost:5003/api/tecnicos/fix-db in browser to deduplicate)
router.get('/fix-db', async (req, res) => {
  const Tecnico = require('../models/Tecnico');
  const cleanRut = (r) => (r || "").toString().replace(/[^0-9kK]/g, '').toUpperCase().trim();
  try {
    const all = await Tecnico.find().sort({ updatedAt: -1 });
    const seen = new Set();
    let deleted = 0;
    let updated = 0;
    let kept = 0;

    for (const t of all) {
      if (!t.rut) {
        await Tecnico.findByIdAndDelete(t._id);
        deleted++;
        continue;
      }
      const r = cleanRut(t.rut);
      const uniqueKey = `${r}_${t.empresaRef || 'no_company'}`;

      if (seen.has(uniqueKey)) {
        await Tecnico.findByIdAndDelete(t._id);
        deleted++;
      } else {
        seen.add(uniqueKey);
        kept++;
        if (t.rut !== r) {
          await Tecnico.updateOne({ _id: t._id }, { $set: { rut: r } });
          updated++;
        }
      }
    }
    res.send(`✅ LIMPIEZA COMPLETADA: Registros únicos: ${kept}, Duplicados borrados: ${deleted}, Formatos corregidos: ${updated}`);
  } catch (err) {
    res.status(500).send("Error reparando DB: " + err.message);
  }
});

// --- SINCRONIZACIÓN MASIVA DESDE RRHH (CAPTURA DE TALENTO) ---
router.get('/sync-all-from-candidatos', authorize('cfg_personal:crear', ROLES.ADMIN, ROLES.CEO), async (req, res) => {
  try {
    // 1. Buscar todos los candidatos contratados que son técnicos
    const candidatos = await Candidato.find({
      status: 'Contratado',
      position: { $regex: /TECNICO TELECOMUNICACIONES/i }
    });

    let syncCount = 0;
    let userSyncCount = 0;
    const results = [];

    for (const c of candidatos) {
      const r = cleanRut(c.rut);
      if (!r) continue;

      // 2. Sincronizar con colección Tecnico (Operaciones)
      let tecnico = await Tecnico.findOne({ rut: r, empresaRef: c.empresaRef });
      
      const payload = {
        rut: r,
        empresaRef: c.empresaRef,
        nombres: c.fullName?.split(' ')[0] || 'Sin Nombre',
        apellidos: c.fullName?.split(' ').slice(1).join(' ') || 'Sin Apellido',
        cargo: c.position,
        departamento: c.departamento,
        area: c.area,
        ceco: c.ceco,
        projectId: c.projectId,
        proyecto: c.projectName,
        idRecursoToa: c.idRecursoToa,
        email: c.email,
        telefono: c.phone,
        sede: c.sede
      };

      if (!tecnico) {
        tecnico = new Tecnico(payload);
        await tecnico.save();
        syncCount++;
      } else {
        await Tecnico.updateOne({ _id: tecnico._id }, { $set: payload });
        syncCount++;
      }

      // 3. Sincronizar con PlatformUser (Acceso)
      // Aseguramos que el usuario de acceso tenga el RUT y email vinculados para el Portal
      const user = await PlatformUser.findOne({ 
        $or: [
          { email: c.email?.toLowerCase() },
          { rut: r }
        ]
      });

      if (user) {
        const userUpdate = {};
        if (!user.rut || user.rut !== r) userUpdate.rut = r;
        if (!user.empresaRef) userUpdate.empresaRef = c.empresaRef;
        if (!user.cargo) userUpdate.cargo = c.position;
        
        if (Object.keys(userUpdate).length > 0) {
          await PlatformUser.updateOne({ _id: user._id }, { $set: userUpdate });
          userSyncCount++;
        }
      }

      results.push({ rut: r, nombre: c.fullName, status: 'OK', toa: c.idRecursoToa });
    }

    res.json({
      message: "Sincronización masiva finalizada",
      candidatosProcesados: candidatos.length,
      tecnicosSincronizados: syncCount,
      usuariosAccesoActualizados: userSyncCount,
      detalles: results
    });

  } catch (err) {
    console.error("Error en sync masiva:", err);
    res.status(500).json({ error: err.message });
  }
});

// Blindaje global: Autenticación requerida para todas las rutas
router.use(protect);

// OBTENER TODOS
router.get('/', authorize('cfg_personal:ver', 'op_designaciones:ver', 'op_dotacion:ver'), async (req, res) => {
  try {
    const isSupervisor = String(req.user.role).toLowerCase() === ROLES.SUPERVISOR;
    const isHighLevel = [ROLES.SYSTEM_ADMIN, ROLES.CEO, ROLES.CEO_GENAI, ROLES.GERENCIA, ROLES.ADMIN, ROLES.RRHH_ADMIN].includes(String(req.user.role).toLowerCase());

    // 🔒 FILTRO BASE POR EMPRESA
    const filter = { 
      empresaRef: req.user.empresaRef,
      idRecursoToa: { $exists: true, $ne: '' }
    };

    // Si es supervisor y no es nivel alto, forzar filtro de su propio equipo
    if (isSupervisor && !isHighLevel) {
      filter.supervisorId = req.user._id;
    }

    const tecnicos = await Tecnico.find(filter)
      .populate('empresaRef', 'nombre')
      .populate('bonosConfig')
      .sort({ createdAt: -1 });
    res.json(tecnicos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// OBTENER POR RUT (Bypass self-query)
router.get('/rut/:rut', protect, async (req, res, next) => {
  const r = req.params.rut.replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();
  const ur = (req.user.rut || "").replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();
  
  // 1. Si el RUT coincide con el de la sesión, permitir
  if (r && ur && r === ur) return next();

  // 2. Si el RUT no coincide (o no está en sesión), pero el usuario es el dueño del técnico (por email)
  if (req.user.role === 'tecnico' || req.user.role === 'user') {
    const isOwner = await Tecnico.exists({ 
      $or: [{ rut: r }, { rut: req.params.rut.trim() }], 
      email: req.user.email, 
      empresaRef: req.user.empresaRef 
    });
    if (isOwner) return next();
  }

  // 3. Si no es el dueño, validar permisos de administración
  authorize('cfg_personal:ver')(req, res, next);
}, async (req, res) => {
  try {
    const rawRut = req.params.rut.trim();
    const r = rawRut.replace(/\./g, '').replace(/-/g, '').toUpperCase();
    // 🔒 FILTRO POR EMPRESA
    let tecnico = await Tecnico.findOne({ 
      $or: [{ rut: r }, { rut: rawRut }], 
      empresaRef: req.user.empresaRef 
    })
      .populate('supervisorId', 'name email telefono')
      .populate('vehiculoAsignado', 'patente marca modelo anio estadoLogistico estadoOperativo')
      .populate('bonosConfig');

    if (!tecnico) {
      // 🚀 RECUPERACIÓN CRÍTICA: Si no existe el técnico pero sí el candidato contratado, crearlo on-the-fly
      const Candidato = require('../../rrhh/models/Candidato');
      const rLimpiado = cleanRut(rawRut);
      const cand = await Candidato.findOne({ 
        $or: [{ rut: rLimpiado }, { rut: rawRut }],
        status: 'Contratado'
      }).lean();

      if (cand) {
        console.log(`🚀 Creando perfil técnico faltante para: ${cand.fullName}`);
        tecnico = new Tecnico({
          rut: cand.rut,
          empresaRef: cand.empresaRef,
          nombres: cand.fullName.split(' ')[0],
          apellidos: cand.fullName.split(' ').slice(1).join(' ') || ' ',
          email: cand.email,
          idRecursoToa: cand.idRecursoToa || '',
          estadoActual: 'OPERATIVO'
        });
        await tecnico.save();
        // Recargar con populates
        tecnico = await Tecnico.findById(tecnico._id)
          .populate('supervisorId', 'name email telefono')
          .populate('vehiculoAsignado', 'patente marca modelo anio estadoLogistico estadoOperativo');
      }
    }

    if (!tecnico) return res.status(404).json({ error: "Técnico no encontrado o sin acceso" });

    // 🚀 AUTOSANACIÓN: Si el técnico existe pero no tiene ID Recursos TOA, intentar sincronizar desde RRHH
    // Esto resuelve el problema de "Sin ID TOA asociado" cuando RRHH ya lo cargó pero Operaciones no lo tiene.
    if (!tecnico.idRecursoToa) {
      const Candidato = require('../../rrhh/models/Candidato');
      const rLimpiado = cleanRut(tecnico.rut);
      const cand = await Candidato.findOne({ 
        $or: [
          { rut: tecnico.rut }, 
          { rut: rLimpiado },
          { rut: new RegExp(rLimpiado.split('').join('.*'), 'i') } // Acepta 12.345.678-9 o 123456789
        ] 
      }).select('idRecursoToa').lean();
      
      if (cand && cand.idRecursoToa) {
        console.log(`🔄 Sincronizando ID TOA (${cand.idRecursoToa}) para técnico: ${tecnico.rut}`);
        await Tecnico.updateOne({ _id: tecnico._id }, { $set: { idRecursoToa: cand.idRecursoToa } });
        tecnico.idRecursoToa = cand.idRecursoToa;
      }
    }

    // Enriquecer vínculo cliente/proyecto para módulos como AST
    let proyectoVinculado = '';
    let clienteVinculado = '';
    try {
      const Proyecto = require('../../rrhh/models/Proyecto');
      const Cliente = require('../models/Cliente');

      if (tecnico.projectId) {
        const p = await Proyecto.findById(tecnico.projectId).select('nombreProyecto projectName cliente').lean();
        if (p) {
          proyectoVinculado = p.nombreProyecto || p.projectName || '';
          if (p.cliente) {
            const c = await Cliente.findById(p.cliente).select('nombre').lean();
            clienteVinculado = c?.nombre || '';
          }
        }
      }

      if ((!proyectoVinculado || !clienteVinculado) && tecnico.idRecursoToa) {
        const { construirMapaValorizacion } = require('../utils/calculoEngine');
        const mapa = await construirMapaValorizacion(req.user.empresaRef);
        const cfg = mapa?.[String(tecnico.idRecursoToa)] || null;
        if (cfg) {
          if (!proyectoVinculado) proyectoVinculado = cfg.proyecto || '';
          if (!clienteVinculado) clienteVinculado = cfg.cliente || '';
        }
      }
    } catch (_) {
      // Si falla el enriquecimiento no bloqueamos el endpoint principal.
    }

    const empresaOrigen = [clienteVinculado, proyectoVinculado].filter(Boolean).join(' / ') ||
      tecnico.mandantePrincipal || tecnico.proyecto || tecnico.departamento || '';

    const payload = tecnico.toObject ? tecnico.toObject() : tecnico;
    payload.rutFormateado = formatRutWithDash(payload.rut || rawRut);
    payload.proyectoVinculado = proyectoVinculado;
    payload.clienteVinculado = clienteVinculado;
    payload.empresaOrigen = empresaOrigen;

    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREAR/EDITAR (UPSERT)
router.post('/', authorize('cfg_personal:crear', 'op_designaciones:editar', 'op_dotacion:editar'), async (req, res) => {
  const { rut, nombres, apellidos } = req.body;
  if (!rut) return res.status(400).json({ error: "RUT requerido" });

  try {
    const r = cleanRut(rut);
    const isSupervisor = String(req.user.role).toLowerCase() === ROLES.SUPERVISOR;
    const isHighLevel = [ROLES.SYSTEM_ADMIN, ROLES.CEO, ROLES.CEO_GENAI, ROLES.GERENCIA, ROLES.ADMIN, ROLES.RRHH_ADMIN].includes(String(req.user.role).toLowerCase());

    const empresaFilter = { rut: r, empresaRef: req.user.empresaRef };
    
    // Si es supervisor, solo puede editar si ya es SUYO o si lo está vinculando
    if (isSupervisor && !isHighLevel) {
      const tecnicoExistente = await Tecnico.findOne(empresaFilter);
      if (tecnicoExistente && String(tecnicoExistente.supervisorId) !== String(req.user._id)) {
        return res.status(403).json({ error: "No tiene permiso para editar personal de otro supervisor." });
      }
      
    // PROTECCIÓN: El supervisor NO puede editar información que viene de RRHH (Captura de Talento)
      if (tecnicoExistente) {
        // Ignoramos campos críticos si vienen en el body de un supervisor
        delete req.body.nombres;
        delete req.body.apellidos;
        delete req.body.rut;
        delete req.body.fechaIngreso;
        delete req.body.tipoContrato;
      }
    }

    const tecnico = await Tecnico.findOneAndUpdate(
      empresaFilter,
      { ...req.body, rut: r, empresaRef: req.user.empresaRef },
      { new: true, upsert: true }
    ).populate('bonosConfig');

    // 🚀 SINCRONIZACIÓN BIDIRECCIONAL (Operaciones -> RRHH)
    // Si se actualizan campos operativos, devolvemos el valor a la ficha maestra
    if (tecnico) {
      const syncPayload = {};
      if (req.body.telefono) syncPayload.phone = req.body.telefono;
      if (req.body.email) syncPayload.email = req.body.email; // El corporativo/oficial
      if (req.body.idRecursoToa) syncPayload.idRecursoToa = req.body.idRecursoToa;
      if (req.body.projectId) syncPayload.projectId = req.body.projectId;
      if (req.body.ceco) syncPayload.ceco = req.body.ceco;
      if (req.body.region) syncPayload.region = req.body.region;
      if (req.body.area) syncPayload.area = req.body.area;
      if (req.body.cargo) syncPayload.position = req.body.cargo;

      if (Object.keys(syncPayload).length > 0) {
        await Candidato.findOneAndUpdate(
          { rut: r, empresaRef: req.user.empresaRef },
          { $set: syncPayload },
          { new: false } // No upsert, RRHH es el origen de la verdad de que exista. Solo actualizamos si ya existe.
        ).catch(err => console.error('Error en sync bidireccional Candidato:', err.message));
      }
    }

    res.json(tecnico);
  } catch (err) {
    res.status(500).json({ error: "Error al guardar." });
  }
});

// VINCULAR SUPERVISOR A TÉCNICO (Auto-asignación)
router.post('/claim', authorize('cfg_personal:editar', ROLES.SUPERVISOR), async (req, res) => {
  const { rut, supervisorId } = req.body;
  if (!rut || !supervisorId) return res.status(400).json({ error: "RUT y Supervisor ID requeridos" });

  try {
    const r = cleanRut(rut); // sin puntos ni guión → "200253876"
    // También construir variante formateada: "20.025.387-6"
    const rutFormateado = rut.toString().trim();
    const rutRegex = new RegExp(`^(${r}|${rutFormateado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})$`, 'i');

    const isCeo = [ROLES.SYSTEM_ADMIN, ROLES.CEO].includes(req.user.role);

    // Construir filtro de empresa: CEO sin override puede ver todas las empresas
    const empresaFilter = isCeo && !req.headers['x-company-override']
      ? {} // CEO sin contexto específico → busca en todas las empresas
      : { empresaRef: req.user.empresaRef };

    // 1. Buscar técnico ya registrado (cualquier formato de RUT)
    let tecnico = await Tecnico.findOneAndUpdate(
      { rut: { $regex: rutRegex }, ...empresaFilter },
      { supervisorId },
      { new: true }
    );

    if (!tecnico) {
      // Fallback 1: Sincronizar desde candidatos contratados
      const candidato = await Candidato.findOne({
        rut: { $regex: rutRegex },
        ...empresaFilter,
        status: { $regex: /^contratado$/i }
      });
      if (candidato) {
        let nombres = candidato.fullName || 'Sin Nombre';
        let apellidos = 'Sin Apellido';
        if (candidato.fullName) {
          const parts = candidato.fullName.split(' ');
          if (parts.length > 1) {
            nombres = parts[0];
            apellidos = parts.slice(1).join(' ');
          }
        }
        tecnico = new Tecnico({
          rut: cleanRut(candidato.rut),
          empresaRef: candidato.empresaRef, // usar la empresa del candidato, no la del CEO
          nombres,
          apellidos,
          cargo: candidato.position,
          departamento: candidato.departamento,
          sede: candidato.sede,
          projectId: candidato.projectId,
          ceco: candidato.ceco,
          bonosConfig: candidato.bonosConfig,
          supervisorId
        });
        await tecnico.save();
      }
    }

    if (!tecnico) {
      // Fallback 2: Sincronizar desde usuarios de la plataforma (PlatformUser)
      const u = await PlatformUser.findOne({ rut: { $regex: rutRegex }, ...empresaFilter }).lean();
      if (u) {
        const partes = (u.name || 'Sin Nombre').split(' ');
        tecnico = new Tecnico({
          rut: cleanRut(u.rut || r),
          empresaRef: u.empresaRef || req.user.empresaRef,
          nombres: partes[0] || u.name,
          apellidos: partes.slice(1).join(' ') || 'Sin Apellido',
          cargo: u.cargo || 'Colaborador',
          email: u.email,
          supervisorId
        });
        await tecnico.save();
      }
    }

    if (!tecnico) return res.status(404).json({ error: "Técnico no encontrado o sin acceso" });
    res.json(tecnico);
  } catch (err) {
    res.status(500).json({ error: "Error al vincular." });
  }
});

// DESVINCULAR SUPERVISOR
router.post('/unclaim', authorize('cfg_personal:editar', ROLES.SUPERVISOR), async (req, res) => {
  const { id } = req.body;
  try {
    // 🔒 FILTRO POR EMPRESA
    const tecnico = await Tecnico.findOneAndUpdate(
      { _id: id, empresaRef: req.user.empresaRef },
      { $unset: { supervisorId: 1 } },
      { new: true }
    );
    if (!tecnico) return res.status(404).json({ error: "No encontrado o sin acceso" });
    res.json(tecnico);
  } catch (err) {
    res.status(500).json({ error: "Error al desvincular." });
  }
});

// OBTENER TÉCNICOS POR SUPERVISOR (Vista Enriquecida para Gestión Operativa)
router.get('/supervisor/:id', (req, res, next) => {
  if (String(req.params.id) === String(req.user._id)) return next();
  authorize('cfg_personal:ver', 'op_dotacion:ver')(req, res, next);
}, async (req, res) => {
  try {
    const empresaFilter = { empresaRef: req.user.empresaRef };
    
    // 1. Obtener técnicos vinculados al supervisor, requerimos ID TOA
    const tecnicos = await Tecnico.find({
      supervisorId: req.params.id,
      idRecursoToa: { $exists: true, $ne: '' },
      ...empresaFilter
    }).populate('bonosConfig').sort({ createdAt: -1 }).lean();

    // 2. Enriquecer cada técnico con su ficha de Captura de Talento (Candidato)
    const tecnicosFull = await Promise.all(tecnicos.map(async (t) => {
      const r = cleanRut(t.rut);
      
      // Definir campos a seleccionar (excluyendo sensibles si es supervisor)
      const isSupervisor = String(req.user.role).toLowerCase() === ROLES.SUPERVISOR;
      let candidateSelect = 'profilePic cvUrl email phone area sede projectId ceco region hiring contractType idRecursoToa documents accreditation';
      
      const candidato = await Candidato.findOne({
        $or: [
          { rut: t.rut },
          { rut: r }
        ],
        ...empresaFilter
      }).select(candidateSelect).lean();
      
      if (candidato && candidato.hiring && isSupervisor) {
        delete candidato.hiring.salary;
      }
      
      return { ...t, rrhh: candidato || null };
    }));

    res.json(tecnicosFull);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CARGA MASIVA MEJORADA (CON FILTRO DE SUPERVISOR) ---
router.post('/bulk', authorize('cfg_personal:crear', 'op_dotacion:editar', 'op_designaciones:editar'), async (req, res) => {
  try {
    const { tecnicos } = req.body;
    if (!tecnicos || !Array.isArray(tecnicos)) return res.status(400).json({ error: "Datos inválidos" });

    const isSupervisor = String(req.user.role).toLowerCase() === ROLES.SUPERVISOR;
    const isHighLevel = [ROLES.SYSTEM_ADMIN, ROLES.CEO, ROLES.CEO_GENAI, ROLES.GERENCIA, ROLES.ADMIN, ROLES.RRHH_ADMIN].includes(String(req.user.role).toLowerCase());
    const empresaRef = req.user.empresaRef;
    const rutsCargados = [];

    const operaciones = tecnicos.map(tec => {
      const r = cleanRut(tec.rut);
      if (r) rutsCargados.push(r);
      
      const updateData = { ...tec, rut: r, empresaRef };
      delete updateData._id;

      // Si es un supervisor haciendo bulk, inyectar su ID
      if (isSupervisor && !isHighLevel) {
        updateData.supervisorId = req.user._id;
      }

      return {
        updateOne: {
          filter: { rut: r, empresaRef },
          update: { $set: updateData },
          upsert: true
        }
      };
    });

    if (operaciones.length > 0) {
      await Tecnico.bulkWrite(operaciones, { ordered: false });

      // 🧹 LIMPIEZA: Solo eliminar técnicos NO presentes en el archivo que PERTENECEN al que carga.
      // Si soy admin, borro globales de la empresa.
      // Si soy supervisor, solo borro de MI equipo.
      const deleteFilter = { empresaRef, rut: { $nin: rutsCargados } };
      if (isSupervisor && !isHighLevel) {
        deleteFilter.supervisorId = req.user._id;
      }

      const resultDelete = await Tecnico.deleteMany(deleteFilter);
      console.log(`🧹 Sync Bulk [${req.user.role}]: ${operaciones.length} procesados, ${resultDelete.deletedCount} eliminados.`);
    }

    res.json({ 
      message: "Sincronización completada con éxito",
      procesados: operaciones.length
    });
  } catch (err) {
    console.error("Error bulk sync:", err);
    res.status(500).json({ error: "Error al procesar la carga masiva: " + err.message });
  }
});

// ELIMINAR
router.delete('/:id', authorize('cfg_personal:eliminar', 'op_dotacion:eliminar', 'op_designaciones:eliminar'), async (req, res) => {
  try {
    // 🔒 FILTRO POR EMPRESA
    const result = await Tecnico.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
    if (!result) return res.status(404).json({ error: "No encontrado o sin acceso" });
    res.json({ message: "Eliminado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// FICHA COMPLETA DEL TRABAJADOR (solo lectura — tecnico + candidato)
router.get('/:id/ficha', async (req, res) => {
  try {
    const isHighLevel = [
      ROLES.SYSTEM_ADMIN,
      ROLES.CEO,
      ROLES.CEO_GENAI,
      ROLES.GERENCIA,
      ROLES.ADMIN
    ].includes(String(req.user.role).toLowerCase());

    const empresaFilter = isHighLevel && !req.headers['x-company-override'] ? {} : { empresaRef: req.user.empresaRef };

    // 1. Buscar el técnico con los filtros básicos de empresa (si no es high level)
    const tecnico = await Tecnico.findOne({ _id: req.params.id, ...empresaFilter })
      .populate('vehiculoAsignado', 'patente marca modelo anio estadoLogistico estadoOperativo')
      .populate('supervisorId', 'name email')
      .lean();

    if (!tecnico) return res.status(404).json({ error: 'No encontrado o sin acceso' });

    // 2. Validación de Permisos Dinámica (Bypass para dueños y supervisores)
    const rutUser = cleanRut(req.user.rut);
    const rutTec = cleanRut(tecnico.rut);
    
    const sameEmail = req.user.email && tecnico.email && req.user.email.toLowerCase() === tecnico.email.toLowerCase();
    const esPropietario = (rutUser && rutUser === rutTec) || sameEmail;
    const esSuSupervisor = tecnico.supervisorId && String(tecnico.supervisorId._id || tecnico.supervisorId) === String(req.user._id);
    
    // Verificar permiso granular rrhh_captura:ver, cfg_personal:ver u op_designaciones:ver
    const perms = req.user.permisosModulos || {};
    const hasGranularPerm = (perms.cfg_personal?.ver === true) || (perms.rrhh_captura?.ver === true) || (perms.op_designaciones?.ver === true);

    if (!isHighLevel && !esPropietario && !esSuSupervisor && !hasGranularPerm) {
      return res.status(403).json({ 
        error: 'Acceso denegado', 
        message: 'No tienes permisos para ver esta ficha técnica.' 
      });
    }

    // Complementar con datos del candidato (RRHH) - Búsqueda ultra-robusta por RUT
    const rutLimpio = cleanRut(tecnico.rut);
    
    // Intentamos encontrar al candidato con varias estrategias de match de RUT
    let candidateSelect = 'profilePic cvUrl emergencyContact emergencyPhone email phone documents accreditation interview tests amonestaciones felicitaciones notes vacaciones bonuses hiring contractType contractStartDate contractEndDate idRecursoToa area sede projectId projectName proyectoTipo ceco region';
    
    let candidato = await Candidato.findOne({ 
      $or: [
        { rut: tecnico.rut },
        { rut: rutLimpio },
        { rut: new RegExp(rutLimpio.split('').join('.*'), 'i') }
      ]
    })
      .select(candidateSelect)
      .lean();

    // Fallback: Si no hay match por RUT (raro), intentar por nombre completo aproximado si el RUT es muy corto o sospechoso
    if (!candidato && tecnico.nombre) {
       candidato = await Candidato.findOne({ fullName: { $regex: tecnico.nombre, $options: 'i' } })
         .select(candidateSelect)
         .lean();
    }

    if (candidato && !isHighLevel) {
      const userRole = String(req.user.role).toLowerCase();
      if (userRole === ROLES.SUPERVISOR) {
        // Blindaje de datos sensibles para supervisores
        if (candidato.hiring) delete candidato.hiring.salary;
        delete candidato.bonuses;
        delete candidato.sueldoBase;
        delete candidato.banco;
        delete candidato.tipoCuenta;
        delete candidato.numeroCuenta;
      }
    }

    res.json({ tecnico, candidato: candidato || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PRODUCCIÓN DEL TÉCNICO (vinculada por idRecursoToa)
router.get('/:id/produccion', async (req, res) => {
  try {
    const empresaFilter = { empresaRef: req.user.empresaRef };
    const tecnico = await Tecnico.findOne({ _id: req.params.id, ...empresaFilter }).lean();
    if (!tecnico) return res.status(404).json({ error: 'Técnico no encontrado' });

    // 🔒 SEGURIDAD: Solo el propio técnico o alguien con permiso 'op_produccion:ver'
    const urut = cleanRut(req.user.rut);
    const trut = cleanRut(tecnico.rut);
    const isOwner = (urut && trut && urut === trut) || (req.user.email && tecnico.email && req.user.email.toLowerCase() === tecnico.email.toLowerCase());
    
    const hasPermission = req.user.role === 'ceo' || req.user.permissions?.includes('op_produccion:ver');
    
    if (!isOwner && !hasPermission) {
      return res.status(403).json({ error: 'No tienes permisos para ver esta producción' });
    }

    const idRecursoToa = tecnico.idRecursoToa;
    if (!idRecursoToa) return res.json({ sin_toa: true, message: 'El técnico no tiene ID TOA configurado' });

    const Actividad = require('../models/Actividad');
    const { desde, hasta, estado } = req.query;
    const selectedStatus = estado || 'Completado';

    // Nombre del técnico en sus variantes posibles (fallback para actividades sin ID_Recurso)
    const nombreTecnico = tecnico.nombre || `${tecnico.nombres || ''} ${tecnico.apellidos || ''}`.trim();
    const idRecursoNum = !isNaN(idRecursoToa) ? Number(idRecursoToa) : null;

    // El bot sanitiza las claves: espacios → _ (ej. "ID Recurso" → "ID_Recurso")
    const matchFilter = {
      $or: [
        { 'tecnicoId': tecnico._id },
        { 'ID_Recurso': idRecursoToa },
        { 'ID Recurso': idRecursoToa },   // variante legacy sin sanitizar
        { 'Recurso': idRecursoToa },
        { 'recurso': idRecursoToa },
        { 'idRecurso': idRecursoToa },
        { 'idRecursoToa': idRecursoToa },
        ...(idRecursoNum !== null ? [
          { 'ID_Recurso': idRecursoNum },
          { 'ID Recurso': idRecursoNum },
          { 'Recurso': idRecursoNum },
        ] : []),
        // Actividades guardadas solo por nombre (sin ID_Recurso, casos de bot sin ese campo)
        ...(nombreTecnico ? [{ 'Técnico': nombreTecnico }] : []),
      ]
    };

    if (selectedStatus !== 'todos') {
      matchFilter.Estado = selectedStatus;
    }

    if (desde || hasta) {
      matchFilter.fecha = {};
      if (desde) matchFilter.fecha.$gte = new Date(desde + 'T00:00:00.000Z');
      if (hasta) matchFilter.fecha.$lte = new Date(hasta + 'T23:59:59.999Z');
    }

    // 1. Obtener Tarifas LPU para el cálculo dinámico
    const TarifaLPU = require('../models/TarifaLPU');
    const { obtenerTarifasEmpresa, calcularBaremos, valorizarBaremos, construirMapaValorizacion } = require('../utils/calculoEngine');
    const tarifasLPU = await obtenerTarifasEmpresa(req.user.empresaRef, TarifaLPU);
    const mapaValorizacion = await construirMapaValorizacion(req.user.empresaRef);

    // 2. Traer TODAS las actividades del periodo para calcular on-the-fly
    const actividadesRaw = await Actividad.find(matchFilter).sort({ fecha: -1 }).lean();
    
    // 3. Procesar baremos + valorización CLP y agrupar
    const actividadesProcesadas = actividadesRaw.map(act => {
      const baremos = calcularBaremos(act, tarifasLPU);
      if (!baremos) return null;
      const valoriz = valorizarBaremos(baremos, mapaValorizacion);
      return { ...baremos, ...valoriz };
    }).filter(Boolean);
    
    // 4. Generar Estadísticas Agregadas (Stats)
    const statsData = { totalActividades: 0, totalPuntos: 0, totalIngreso: 0, diasTrabajados: new Set() };
    const porDiaMap = {};
    const actividadesFull = actividadesProcesadas.map(a => ({
      ...a,
      ptsVisible:        a.Pts_Total_Baremo || a.PTS_TOTAL_BAREMO || a.totalPuntos || 0,
      ingresoVisible:    parseFloat(a.Valor_Actividad_CLP || a.ingreso || 0),
      actividadVisible:  a.Desc_LPU_Base || a.actividad || a.Subtipo_de_Actividad || 'Operación Técnica'
    }));

    for (const a of actividadesProcesadas) {
      const pts = a.Pts_Total_Baremo || a.PTS_TOTAL_BAREMO || 0;
      const ing = parseFloat(a.Valor_Actividad_CLP || a.ingreso || 0);
      
      // Auto-sanar: solo actualizar si los puntos calculados difieren de lo guardado en DB
      const original = actividadesRaw.find(r => String(r._id) === String(a._id));
      if (original) {
        // Usar campo canónico DB (Pts_Total_Baremo) con fallback al alias legacy
        const ptsOriginal = parseFloat(original.Pts_Total_Baremo || original.PTS_TOTAL_BAREMO || 0);
        if (Math.round(pts * 100) !== Math.round(ptsOriginal * 100)) {
          console.log(`[SYNC] Corrigiendo puntos OT ${a.ordenId}: ${ptsOriginal} -> ${pts}`);
          await Actividad.updateOne({ _id: a._id }, { 
            $set: { 
              Pts_Total_Baremo:   pts,
              PTS_TOTAL_BAREMO:   pts,
              Pts_Actividad_Base: a.Pts_Actividad_Base,
              Pts_Deco_Adicional: a.Pts_Deco_Adicional,
              Pts_Repetidor_WiFi: a.Pts_Repetidor_WiFi,
              Codigo_LPU_Base:    a.Codigo_LPU_Base,
              Desc_LPU_Base:      a.Desc_LPU_Base
            } 
          }).catch(e => console.error('Error auto-sync points:', e));
        }
      }

      let fKey = 'S/F';
      try {
        if (a.fecha) {
          const d = new Date(a.fecha);
          if (!isNaN(d.getTime())) {
            fKey = d.toISOString().split('T')[0];
          }
        }
      } catch (e) {
        console.warn(`Fecha inválida en actividad: ${a._id}`);
      }

      statsData.totalActividades++;
      statsData.totalPuntos += pts;
      statsData.totalIngreso += ing;
      if (fKey !== 'S/F') statsData.diasTrabajados.add(fKey);

      if (!porDiaMap[fKey]) porDiaMap[fKey] = { _id: fKey, actividades: 0, puntos: 0, ingreso: 0 };
      porDiaMap[fKey].actividades++;
      porDiaMap[fKey].puntos += pts;
      porDiaMap[fKey].ingreso += ing;
    }

    const porDia = Object.values(porDiaMap).sort((a,b) => b._id.localeCompare(a._id));
    
    // 5. Ranking (Ahora sincronizado con el periodo seleccionado para coherencia)
    const rankingStart = desde ? new Date(desde + 'T00:00:00.000Z') : new Date();
    if (!desde) {
      rankingStart.setDate(1);
      rankingStart.setHours(0,0,0,0);
    }
    
    const rankingEnd = hasta ? new Date(hasta + 'T23:59:59.999Z') : new Date();

    const rankingAgg = await Actividad.aggregate([
      { $match: { empresaRef: req.user.empresaRef, fecha: { $gte: rankingStart, $lte: rankingEnd } } },
      {
        $group: {
          _id: { $ifNull: ['$Recurso', { $ifNull: ['$recurso', { $ifNull: ['$ID_Recurso', { $ifNull: ['$idRecursoToa', '$tecnicoId'] }] }] }] },
          totalPuntos: { 
            $sum: { 
              $ifNull: ['$PTS_TOTAL_BAREMO', 
              { $ifNull: ['$Pts_Total_Baremo', 
              { $ifNull: ['$PTS_TOTAL', 
              { $ifNull: ['$Total_Puntos_Baremo', 
              { $ifNull: ['$TOTAL_PUNTOS', 
              { $ifNull: ['$puntos', 0] }] }] }] }] }] 
            } 
          }
        }
      },
      { $sort: { totalPuntos: -1 } }
    ]);

    const pos = rankingAgg.findIndex(r => String(r._id).trim() === String(idRecursoToa).trim()) + 1;
    const totalTechs = rankingAgg.length;
    const mejorDia = porDia.reduce((best, d) => (!best || d.puntos > best.puntos ? d : best), null);

    res.json({
      idRecursoToa,
      resumen: {
        totalActividades: statsData.totalActividades,
        totalPuntos: Math.round(statsData.totalPuntos * 10) / 10,
        totalIngreso: Math.round(statsData.totalIngreso),
        diasTrabajados: statsData.diasTrabajados.size,
        promedioPorDia: statsData.diasTrabajados.size > 0 ? Math.round(statsData.totalPuntos / statsData.diasTrabajados.size * 10) / 10 : 0,
        promedioIngresoDia: statsData.diasTrabajados.size > 0 ? Math.round(statsData.totalIngreso / statsData.diasTrabajados.size) : 0,
        ranking: pos > 0 ? { posicion: pos, total: totalTechs } : null
      },
      mejorDia,
      porDia,
      recientes: actividadesFull
    });
  } catch (err) {
    console.error('Error producción técnico:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- REGISTRAR APELACIÓN DE PRODUCCIÓN ---
router.post('/produccion/apelacion', async (req, res) => {
  try {
    const { actividadId, tecnicoId, rut, equipos, observacion } = req.body;
    const Actividad = require('../models/Actividad');

    // Buscar la actividad para validar empresa
    const act = await Actividad.findOne({ _id: actividadId, empresaRef: req.user.empresaRef });
    if (!act) return res.status(404).json({ error: 'Actividad no encontrada o fuera del alcance' });

    // Actualizar actividad con datos de apelación
    await Actividad.updateOne(
      { _id: actividadId },
      { 
        $set: { 
          apelacion: {
            tecnicoId,
            rut,
            equipos,
            observacion,
            fechaSolicitud: new Date(),
            status: 'por_validar'
          }
        } 
      }
    );

    res.json({ success: true, message: 'Apelación registrada para validación' });
  } catch (err) {
    console.error('Error apelación técnico:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
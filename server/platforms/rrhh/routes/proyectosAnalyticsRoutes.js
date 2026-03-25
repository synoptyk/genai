const express = require('express');
const router = express.Router();
const Candidato = require('../models/Candidato');
const Proyecto = require('../models/Proyecto');

const { protect } = require('../../auth/authMiddleware');

/**
 * GET /api/rrhh/proyectos/:id/analytics
 * Devuelve análisis de reclutamiento para un proyecto específico.
 * Cruza candidatos con la dotación requerida por cargo.
 */
router.get('/:id/analytics', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const proyecto = await Proyecto.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!proyecto) return res.status(404).json({ message: 'Proyecto no encontrado o sin acceso' });

        const today = new Date();

        // Traer todos los candidatos que referencian este proyecto (por _id o por ceco+nombre)
        const candidatos = await Candidato.find({
            empresaRef: req.user.empresaRef, // 🔒 FILTRO POR EMPRESA
            $or: [
                { projectId: proyecto._id },
                {
                    ceco: proyecto.centroCosto,
                    $or: [
                        { projectName: proyecto.nombreProyecto },
                        { projectName: proyecto.projectName }
                    ]
                }
            ]
        });

        // Función para verificar si un candidato tiene permiso activo hoy
        const tienePermisoActivo = (c) => {
            if (!c.vacaciones || c.vacaciones.length === 0) return false;
            return c.vacaciones.some(v => {
                const aprobado = v.estado === 'Aprobado';
                const inicio = v.fechaInicio ? new Date(v.fechaInicio) : null;
                const fin = v.fechaFin ? new Date(v.fechaFin) : null;
                const vigente = inicio && fin ? (today >= inicio && today <= fin) : false;
                return aprobado && vigente;
            });
        };

        // Construcción del análisis por cargo
        const dotacionAnalytics = (proyecto.dotacion || []).map(d => {
            const porCargo = candidatos.filter(c =>
                c.position?.toLowerCase().trim() === d.cargo?.toLowerCase().trim()
            );

            const postulando = porCargo.filter(c => c.status === 'En Postulación' || c.status === 'Postulando').length;
            const contratados = porCargo.filter(c => c.status === 'Contratado');
            const enPermiso = contratados.filter(c => tienePermisoActivo(c)).length;
            const activos = contratados.length - enPermiso;  // contratados sin permiso activo
            const finiquitados = porCargo.filter(c => c.status === 'Finiquitado' || c.status === 'Retirado').length;
            const rechazados = porCargo.filter(c => c.status === 'Rechazado').length;

            const requeridos = d.cantidad || 0;
            const cubiertos = activos;                           // activos reales (sin permiso)
            const pendientes = Math.max(0, requeridos - (activos + enPermiso));
            const cobertura = requeridos > 0 ? Math.round((cubiertos / requeridos) * 100) : 0;

            return {
                cargo: d.cargo,
                requeridos,
                cubiertos,            // activos en terreno
                enPermiso,            // contratados con permiso/licencia vigente hoy
                activos,              // activos efectivos (contratados - en permiso)
                postulando,           // en proceso de selección
                finiquitados,         // histórico de salidas
                rechazados,
                pendientes,           // puestos aún sin cubrir
                cobertura,            // % real
                candidatos: porCargo.map(c => ({
                    _id: c._id,
                    fullName: c.fullName,
                    rut: c.rut,
                    status: c.status,
                    permisoActivo: tienePermisoActivo(c),
                    contractStartDate: c.contractStartDate,
                    contractEndDate: c.contractEndDate
                }))
            };
        });

        // Totales globales del proyecto
        const totalRequerido = dotacionAnalytics.reduce((a, d) => a + d.requeridos, 0);
        const totalCubierto = dotacionAnalytics.reduce((a, d) => a + d.cubiertos, 0);
        const totalEnPermiso = dotacionAnalytics.reduce((a, d) => a + d.enPermiso, 0);
        const totalPostulando = dotacionAnalytics.reduce((a, d) => a + d.postulando, 0);
        const totalFiniquitados = dotacionAnalytics.reduce((a, d) => a + d.finiquitados, 0);
        const totalPendientes = dotacionAnalytics.reduce((a, d) => a + d.pendientes, 0);
        const coberturaGlobal = totalRequerido > 0 ? Math.round((totalCubierto / totalRequerido) * 100) : 0;

        res.json({
            proyecto: {
                _id: proyecto._id,
                centroCosto: proyecto.centroCosto,
                nombreProyecto: proyecto.nombreProyecto || proyecto.projectName,
                area: proyecto.area,
                status: proyecto.status
            },
            resumen: {
                totalRequerido,
                totalCubierto,
                totalEnPermiso,
                totalPostulando,
                totalFiniquitados,
                totalPendientes,
                coberturaGlobal
            },
            dotacion: dotacionAnalytics
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * GET /api/rrhh/proyectos/analytics/global
 * Resumen global de todos los proyectos activos.
 */
router.get('/analytics/global', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const proyectos = await Proyecto.find({
            status: { $ne: 'Cerrado' },
            empresaRef: req.user.empresaRef
        }).populate('cliente');
        const today = new Date();

        const tienePermisoActivo = (c) => {
            if (!c.vacaciones || c.vacaciones.length === 0) return false;
            return c.vacaciones.some(v => {
                const aprobado = v.estado === 'Aprobado';
                const inicio = v.fechaInicio ? new Date(v.fechaInicio) : null;
                const fin = v.fechaFin ? new Date(v.fechaFin) : null;
                return aprobado && inicio && fin && today >= inicio && today <= fin;
            });
        };
        // 🔒 FILTRO POR EMPRESA
        const allCandidatos = await Candidato.find({ empresaRef: req.user.empresaRef });

        const resumenProyectos = proyectos.map(proyecto => {
            const candidatos = allCandidatos.filter(c =>
                c.projectId?.toString() === proyecto._id.toString() ||
                (c.ceco === proyecto.centroCosto &&
                    (c.projectName === proyecto.nombreProyecto || c.projectName === proyecto.projectName))
            );

            const requerido = (proyecto.dotacion || []).reduce((a, d) => a + (d.cantidad || 0), 0);
            const contratados = candidatos.filter(c => c.status === 'Contratado');
            const enPermiso = contratados.filter(c => tienePermisoActivo(c)).length;
            const activos = contratados.length - enPermiso;
            const postulando = candidatos.filter(c => ['En Postulación', 'Postulando'].includes(c.status)).length;
            const finiquitados = candidatos.filter(c => ['Finiquitado', 'Retirado'].includes(c.status)).length;
            const pendientes = Math.max(0, requerido - activos);
            const cobertura = requerido > 0 ? Math.round((activos / requerido) * 100) : 0;

            return {
                _id: proyecto._id,
                centroCosto: proyecto.centroCosto,
                nombreProyecto: proyecto.nombreProyecto || proyecto.projectName,
                area: proyecto.area,
                status: proyecto.status,
                requerido,
                activos,
                enPermiso,
                postulando,
                finiquitados,
                pendientes,
                cobertura
            };
        });

        const globalReq = resumenProyectos.reduce((a, p) => a + p.requerido, 0);
        const globalAct = resumenProyectos.reduce((a, p) => a + p.activos, 0);
        const globalPerm = resumenProyectos.reduce((a, p) => a + p.enPermiso, 0);
        const globalPost = resumenProyectos.reduce((a, p) => a + p.postulando, 0);
        const globalFin = resumenProyectos.reduce((a, p) => a + p.finiquitados, 0);
        const globalPend = resumenProyectos.reduce((a, p) => a + p.pendientes, 0);
        const coberturaGlobal = globalReq > 0 ? Math.round((globalAct / globalReq) * 100) : 0;

        res.json({
            totales: { globalReq, globalAct, globalEnPermiso: globalPerm, globalPost, globalFin, globalPend, coberturaGlobal },
            proyectos: resumenProyectos
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;

const AST = require('../models/AST');
const Charla = require('../models/Charla');
const Hallazgo = require('../models/Hallazgo');
const Tecnico = require('../../agentetelecom/models/Tecnico');
const mongoose = require('mongoose');

exports.getDashboardStats = async (req, res) => {
    try {
        const empresaRef = req.user.empresaRef;
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - hoy.getDay() + 1); // Lunes

        // 1. KPI: Hallazgos Críticos (Abiertos/En Proceso con prioridad Alta/Crítica)
        const hallazgosCriticos = await Hallazgo.countDocuments({
            empresaRef,
            prioridad: { $in: ['Alta', 'Crítica'] },
            estado: { $ne: 'Cerrado' }
        });

        // 2. KPI: Cumplimiento AST (Simplificado: ASTs hoy vs Técnicos activos)
        const [totalASTsHoy, totalTecnicos] = await Promise.all([
            AST.countDocuments({ empresaRef, createdAt: { $gte: hoy } }),
            Tecnico.countDocuments({ empresaRef, estadoActual: { $ne: 'FINIQUITADO' } })
        ]);

        const cumplimientoAST = totalTecnicos > 0 ? ((totalASTsHoy / totalTecnicos) * 100).toFixed(1) : 0;

        // 3. KPI: Cobertura Charlas (Charlas mes actual vs meta)
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const charlasMes = await Charla.countDocuments({
            empresaRef,
            fecha: { $gte: inicioMes }
        });
        // Meta arbitraria o basada en técnicos
        const coberturaCharlas = totalTecnicos > 0 ? Math.min(100, (charlasMes / (totalTecnicos * 0.8)) * 100).toFixed(0) : 0;

        // 4. Curva de Productividad Segura (Trend semanal: AST vs Charlas)
        const weeklyData = [];
        const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        
        for (let i = 0; i < 7; i++) {
            const currentDay = new Date(inicioSemana);
            currentDay.setDate(inicioSemana.getDate() + i);
            const nextDay = new Date(currentDay);
            nextDay.setDate(currentDay.getDate() + 1);

            const [astCount, charlaCount] = await Promise.all([
                AST.countDocuments({ empresaRef, createdAt: { $gte: currentDay, $lt: nextDay } }),
                Charla.countDocuments({ empresaRef, fecha: { $gte: currentDay, $lt: nextDay } })
            ]);

            weeklyData.push({
                name: diasSemana[i],
                ast: astCount,
                charlas: charlaCount
            });
        }

        // 5. Mapa de Criticidad (Hallazgos por Riesgo/Categoría - Basado en etiquetas de AST relacionados si no hay campo directo)
        // Por ahora, simularemos la distribución basada en datos REALES de prioridad si el campo riesgo no es explícito
        const hallazgosPorPrioridad = await Hallazgo.aggregate([
            { $match: { empresaRef } },
            { $group: { _id: "$prioridad", count: { $sum: 1 } } }
        ]);

        const riskDistribution = hallazgosPorPrioridad.map(item => ({
            name: item._id,
            value: item.count,
            color: item._id === 'Crítica' ? '#f43f5e' : item._id === 'Alta' ? '#fb923c' : '#facc15'
        }));

        // 6. Actividad Reciente
        const reciente = await AST.find({ empresaRef })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('nombreTrabajador comuna createdAt estado');

        const feed = reciente.map(r => ({
            type: 'AST',
            user: r.nombreTrabajador || 'Sistema',
            location: r.comuna || 'Chile',
            time: new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: r.estado
        }));

        res.json({
            kpis: {
                cumplimientoAST: `${cumplimientoAST}%`,
                indiceFrecuencia: "0.00", // Requiere cálculos complejos de HH, se deja en real 0 si no hay
                hallazgosCriticos: hallazgosCriticos.toString().padStart(2, '0'),
                coberturaCharlas: `${coberturaCharlas}%`
            },
            weeklyData,
            riskDistribution: riskDistribution.length > 0 ? riskDistribution : [
                { name: 'Sin Hallazgos', value: 100, color: '#2dd4bf' }
            ],
            recentActivity: feed
        });

    } catch (error) {
        console.error("HSE Stats Error:", error);
        res.status(500).json({ error: error.message });
    }
};

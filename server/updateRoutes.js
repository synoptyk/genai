const fs = require('fs');
const path = './platforms/agentetelecom/routes/vehiculos.js';
let content = fs.readFileSync(path, 'utf8');

const importSiniestro = "const SiniestroVehicular = require('../models/SiniestroVehicular');\n";
if (!content.includes('SiniestroVehicular')) {
  content = content.replace("const ChecklistVehicular = require('../models/ChecklistVehicular');", "const ChecklistVehicular = require('../models/ChecklistVehicular');\n" + importSiniestro);
}

const siniestrosRoutes = `
// ── 9. REGISTRAR SINIESTRO ────────────────────────────────────────────────────
router.post('/:id/siniestro', protect, async (req, res) => {
  try {
    const vehiculo = await Vehiculo.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
    if (!vehiculo) return res.status(404).json({ error: 'Vehículo no encontrado' });

    const nuevoSiniestro = new SiniestroVehicular({
      vehiculo: req.params.id,
      tecnico: req.body.tecnicoId || vehiculo.asignadoA,
      empresaRef: req.user.empresaRef,
      reportadoPor: req.user._id,
      fechaSiniestro: req.body.fechaSiniestro || new Date(),
      gravedad: req.body.gravedad || 'Moderado',
      descripcion: req.body.descripcion,
      lugar: req.body.lugar,
      fotos: req.body.fotos || [],
      observacionesAdicionales: req.body.observacionesAdicionales
    });

    await nuevoSiniestro.save();

    // Bloquear el vehículo operativamente
    vehiculo.estadoOperativo = 'Siniestro';
    vehiculo.historialAsignaciones.push({
      tecnico: vehiculo.asignadoA,
      supervisor: req.user._id,
      tipo: 'Cambio',
      fecha: new Date(),
      observacion: \`Siniestro Reportado: \${req.body.gravedad}. Vehículo bloqueado.\`
    });
    await vehiculo.save();

    await notificationService.notifyAction({
      actor: req.user,
      moduleKey: 'agentetelecom_vehiculos',
      action: 'reportó',
      entityName: \`siniestro en vehículo \${vehiculo.patente}\`,
      entityId: nuevoSiniestro._id,
      companyRef: req.user.empresaRef,
      isImportant: true
    });

    res.status(201).json(nuevoSiniestro);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 10. OBTENER SINIESTROS DE UN VEHÍCULO ─────────────────────────────────────
router.get('/:id/siniestros', protect, async (req, res) => {
  try {
    const siniestros = await SiniestroVehicular.find({ vehiculo: req.params.id, empresaRef: req.user.empresaRef })
      .populate('tecnico', 'nombre rut')
      .populate('reportadoPor', 'name')
      .sort({ fechaSiniestro: -1 });
    res.json(siniestros);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
`;

if (!content.includes('REGISTRAR SINIESTRO')) {
  content = content.replace('module.exports = router;', siniestrosRoutes + '\nmodule.exports = router;');
}

fs.writeFileSync(path, content);
console.log('Routes updated');

require('dotenv').config();
const mongoose = require('mongoose');
const Candidato = require('../platforms/rrhh/models/Candidato');
const Proyecto = require('../platforms/rrhh/models/Proyecto');
const ModeloBonificacion = require('../platforms/admin/models/ModeloBonificacion');
const BonoConfig = require('../platforms/admin/models/BonoConfig');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("DB Connected!");

  // Find candidate for supervisor
  const supervisors = await Candidato.find({ position: /supervisor/i }).lean();
  console.log(`\n--- SUPERVISORS (${supervisors.length}) ---`);
  supervisors.forEach(s => {
    console.log(`Name: ${s.fullName}, RUT: ${s.rut}, Position: ${s.position}, SueldoBase: ${s.sueldoBase}, bonuses: ${JSON.stringify(s.bonuses)}, bonosConfig: ${JSON.stringify(s.bonosConfig)}`);
  });

  // Find project dotation for supervisor
  const projects = await Proyecto.find({ 'dotacion.cargo': /supervisor/i }).lean();
  console.log(`\n--- PROJECTS WITH SUPERVISOR IN DOTACION (${projects.length}) ---`);
  projects.forEach(p => {
    console.log(`Project: ${p.nombreProyecto} / ${p.projectName}, CentroCosto: ${p.centroCosto}`);
    p.dotacion.forEach(d => {
      if (/supervisor/i.test(d.cargo)) {
        console.log(`  Cargo: ${d.cargo}, SueldoBaseLiquido: ${d.sueldoBaseLiquido}, Bonos: ${JSON.stringify(d.bonos)}`);
      }
    });
  });

  // Find modelos de bonificacion for supervisor
  const modelos = await ModeloBonificacion.find({ 'aplicaA.cargos': /supervisor/i }).lean();
  console.log(`\n--- MODELOS DE BONIFICACION FOR SUPERVISOR (${modelos.length}) ---`);
  modelos.forEach(m => {
    console.log(`Nombre: ${m.nombre}, Tipo: ${m.tipo}, Activo: ${m.activo}, BonoFijo: ${JSON.stringify(m.bonoFijo)}, TipoBonoRef: ${m.tipoBonoRef}`);
  });

  // Find BonoConfigs
  const configs = await BonoConfig.find().lean();
  console.log(`\n--- BONO CONFIGS (${configs.length}) ---`);
  configs.forEach(c => {
    console.log(`ID: ${c._id}, Nombre: ${c.nombre}, CodeDT: ${c.payroll?.codigoDT}, Type: ${c.payroll?.tipo}`);
  });

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

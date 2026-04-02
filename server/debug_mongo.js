const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://ceo_synoptyk_reclutando:ReclutaSeguro.%23%23@clusterreclutando.im7etzo.mongodb.net/reclutando?retryWrites=true&w=majority&appName=ClusterReclutando');

async function run() {
  const Empresa = mongoose.model('Empresa', new mongoose.Schema({ nombre: String }));
  const Tecnico = mongoose.model('Tecnico', new mongoose.Schema({ nombre: String, empresaRef: mongoose.Schema.Types.ObjectId, idRecursoToa: String, rut: String }));
  const User = mongoose.model('PlatformUser', new mongoose.Schema({ email: String, name: String, empresa: { nombre: String } }));
  const Candidato = mongoose.model('Candidato', new mongoose.Schema({ fullName: String, rut: String, idRecursoToa: String, empresaRef: mongoose.Schema.Types.ObjectId, status: String }));
  
  const emp = await Empresa.findOne({ nombre: /RAM/i });
  console.log('Empresa RAM ID:', emp?._id);
  
  const countTecnicos = await Tecnico.countDocuments({ empresaRef: emp?._id });
  console.log('Tecnicos con RAM ID:', countTecnicos);
  
  const countT2 = await Tecnico.countDocuments();
  console.log('Total Tecnicos DB:', countT2);
  
  const countCands = await Candidato.countDocuments({ empresaRef: emp?._id });
  console.log('Candidatos con RAM ID:', countCands);

  const cands = await Candidato.find({ empresaRef: emp?._id, status: /contratado/i });
  console.log('Candidatos CONTRATADOS con RAM ID:', cands.length);
  
  process.exit();
}
run();

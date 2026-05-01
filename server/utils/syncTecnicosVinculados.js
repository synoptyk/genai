// Sincroniza técnicos vinculados y su producción
const Tecnico = require('../platforms/agentetelecom/models/Tecnico');
const Actividad = require('../platforms/agentetelecom/models/Actividad');

// Obtiene todos los técnicos vinculados a una empresa y su producción
async function obtenerTecnicosVinculadosYProduccion(empresaId) {
  // 1. Buscar técnicos vinculados a la empresa
  const tecnicos = await Tecnico.find({ empresaRef: empresaId });
  if (!tecnicos.length) return { tecnicos: 0, produccion: 0, detalle: [] };

  // 2. Buscar producción por cada técnico (por idRecursoToa)
  const idsToa = tecnicos.map(t => t.idRecursoToa).filter(Boolean);
  // En Actividad, el campo es RECURSO (mayúsculas)
  const actividades = await Actividad.find({ RECURSO: { $in: idsToa } });

  // 3. Resumir producción
  const resumenPorTecnico = tecnicos.map(t => {
    const produccion = actividades.filter(a => a.RECURSO === t.idRecursoToa);
    return {
      tecnico: t.nombre || t._id,
      idRecursoToa: t.idRecursoToa,
      produccion: produccion.length,
      actividades: produccion.map(a => a._id)
    };
  });

  return {
    tecnicos: tecnicos.length,
    produccion: actividades.length,
    detalle: resumenPorTecnico
  };
}

module.exports = { obtenerTecnicosVinculadosYProduccion };
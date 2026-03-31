const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../auth/authMiddleware');
const TipoBono = require('../models/TipoBono');

// GET all for empresa
router.get('/', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const items = await TipoBono.find({ empresaRef: empresaId }).sort({ nombre: 1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET one
router.get('/:id', protect, async (req, res) => {
  try {
    const item = await TipoBono.findById(req.params.id);
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE
router.post('/', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const item = new TipoBono({ ...req.body, empresaRef: empresaId });
    await item.save();
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE
router.put('/:id', protect, async (req, res) => {
  try {
    const item = await TipoBono.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SEED: Populate default legal bonuses (DT Chile 2026)
router.post('/seed-defaults', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const defaults = [
        // --- IMPONIBLES (RELIABLE REMUNERATION) ---
        {
          nombre: "Sueldo Base",
          tipo: "IMPONIBLE",
          baseLegal: "Art. 42 letra a) Código del Trabajo",
          observacionDT: "Estipendio fijo en dinero, pagado por períodos iguales, que recibe el trabajador por la prestación de sus servicios.",
          pagoProporcional: true
        },
        {
          nombre: "Gratificación Legal",
          tipo: "IMPONIBLE",
          baseLegal: "Art. 47 y 50 Código del Trabajo",
          observacionDT: "Parte de las utilidades que el empleador beneficia al sueldo del trabajador. Sujeta a tope de 4.75 ingresos mínimos mensuales.",
          pagoProporcional: true
        },
        {
          nombre: "Bono de Antigüedad",
          tipo: "IMPONIBLE",
          baseLegal: "Art. 41 Código del Trabajo",
          observacionDT: "Premio por la permanencia en la empresa. Es parte de la base de cálculo para indemnizaciones.",
          pagoProporcional: true
        },
        {
          nombre: "Bono Responsabilidad / Cargo",
          tipo: "IMPONIBLE",
          baseLegal: "Art. 42 Código del Trabajo",
          observacionDT: "Remuneración fija vinculada a la jerarquía o funciones críticas del colaborador.",
          pagoProporcional: true
        },
        {
          nombre: "Comisiones y Ventas",
          tipo: "IMPONIBLE",
          baseLegal: "Art. 42 letra c) Código del Trabajo",
          observacionDT: "Sueldo variable calculado sobre el precio de ventas o compras efectuadas por el empleador con ayuda del trabajador.",
          pagoProporcional: false
        },
        {
          nombre: "Bono Producción (Metas/KPIS)",
          tipo: "IMPONIBLE",
          baseLegal: "Art. 42 Código del Trabajo",
          observacionDT: "Incentivo variable por cumplimiento de objetivos operativos (TOA/Baremo).",
          pagoProporcional: true,
          esModuloProduccion: true
        },
        {
          nombre: "Sobresueldo (Horas Extra)",
          tipo: "IMPONIBLE",
          baseLegal: "Art. 43 Código del Trabajo",
          observacionDT: "Remuneración de horas trabajadas en exceso de la jornada pactada, con recargo del 50% mínimo.",
          pagoProporcional: false
        },
        {
          nombre: "Bono por Turno / Nocturnidad",
          tipo: "IMPONIBLE",
          baseLegal: "Dictámenes DT sobre jornada",
          observacionDT: "Compensa la especial penosidad o alteración del ciclo circadiano por trabajos nocturnos.",
          pagoProporcional: true
        },
        {
          nombre: "Aguinaldo Fiestas Patrias / Navidad",
          tipo: "IMPONIBLE",
          baseLegal: "Dictámenes DT sobre carácter remuneratorio",
          observacionDT: "Si se paga de forma recurrente, adquiere carácter de remuneración y es imponible.",
          pagoProporcional: false
        },

        // --- NO IMPONIBLES (INDEMNIZATORY/REFUND) ---
        {
          nombre: "Asignación de Movilización",
          tipo: "NO_IMPONIBLE",
          baseLegal: "Art. 41 inc. 2 Código del Trabajo",
          observacionDT: "Reembolso de gastos de transporte desde el domicilio al lugar de trabajo.",
          limiteReferencial: 95000, 
          avisoLegal: "Si excede lo razonable para el cargo, la DT puede considerarlo sueldo encubierto."
        },
        {
          nombre: "Asignación de Colación",
          tipo: "NO_IMPONIBLE",
          baseLegal: "Art. 41 inc. 2 Código del Trabajo",
          observacionDT: "Gasto de alimentación durante la jornada de trabajo.",
          limiteReferencial: 105000,
          avisoLegal: "Monto debe ser uniforme para cargos similares o justificado por mercado."
        },
        {
          nombre: "Viáticos",
          tipo: "NO_IMPONIBLE",
          baseLegal: "Art. 41 inc. 2 Código del Trabajo",
          observacionDT: "Sumas para gastos de alimentación y alojamiento por servicios fuera del lugar habitual.",
          limiteReferencial: 45000,
          avisoLegal: "Solo no imponible mientras se rinda el gasto o sea por causa de servicio."
        },
        {
          nombre: "Asignación de Caja (Pérdida pecuniaria)",
          tipo: "NO_IMPONIBLE",
          baseLegal: "Art. 41 inc. 2 Código del Trabajo",
          observacionDT: "Compensa el riesgo de faltantes de dinero al manejar valores.",
          limiteReferencial: 55000
        },
        {
          nombre: "Asignación Familiar (Legal)",
          tipo: "NO_IMPONIBLE",
          baseLegal: "DFL N° 150 de 1981",
          observacionDT: "Beneficio estatal pagado a través del empleador por cargas familiares acreditadas.",
          baseCalculo: "FIJO"
        },
        {
          nombre: "Bono de Herramientas / Desgaste",
          tipo: "NO_IMPONIBLE",
          baseLegal: "Art. 41 inc. 2 Código del Trabajo",
          observacionDT: "Compensa el uso y deterioro de herramientas propias del trabajador.",
          limiteReferencial: 35000
        }
    ];

    const bulk = defaults.map(d => ({ ...d, empresaRef: empresaId }));
    const names = bulk.map(d => d.nombre);

    // 1. Lógica de Autolimpieza: Eliminar duplicados previos si existen los mismos nombres
    await TipoBono.deleteMany({ nombre: { $in: names }, empresaRef: empresaId });
    
    // 2. Inserción Limpia (como ya borramos, ahora insertMany es seguro y actualiza a lo ultimo)
    const finalBulk = bulk.map(d => ({ ...d, empresaRef: empresaId }));
    await TipoBono.insertMany(finalBulk);

    res.json({ message: "Diccionario Maestro Sincronizado y Depurado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE
router.delete('/:id', protect, async (req, res) => {
  try {
    await TipoBono.findByIdAndDelete(req.params.id);
    res.json({ message: "Eliminado con éxito" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

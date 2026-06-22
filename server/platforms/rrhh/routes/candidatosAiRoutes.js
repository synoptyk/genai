const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../../auth/authMiddleware');
const genaiService = require('../../../utils/genaiService');

// Usamos memory storage para no guardar el CV físico antes de parsearlo, 
// o bien para pasarlo a Gemini como base64 directo.
const upload = multer({ storage: multer.memoryStorage() });

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function pickValue(source, aliases) {
  if (!source || typeof source !== 'object') return '';

  for (const alias of aliases) {
    if (source[alias] !== undefined && source[alias] !== null && String(source[alias]).trim() !== '') {
      return String(source[alias]).trim();
    }
  }

  const entries = Object.entries(source);
  for (const [key, value] of entries) {
    const normalizedKey = normalizeText(key);
    const matched = aliases.some(alias => normalizeText(alias) === normalizedKey);
    if (matched && value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }

  return '';
}

function hasUsefulData(parsedData) {
  const fields = [
    parsedData.nombres,
    parsedData.apellidos,
    parsedData.email,
    parsedData.phone,
    parsedData.position,
    parsedData.rut
  ];
  return fields.filter(Boolean).length >= 2;
}

/**
 * @route POST /api/platforms/rrhh/candidatos/parse-cv
 * @desc Sube un CV en PDF o imagen y extrae un JSON estructurado usando Gemini
 * @access Private
 */
router.post('/parse-cv', protect, upload.single('cvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    const mimeType = req.file.mimetype;
    const data = req.file.buffer.toString('base64');

    const prompt = `Analiza este CV aunque tenga formato no estándar, columnas, tablas o diseño visual complejo.

  Instrucciones:
  1) Identifica datos equivalentes por semántica, aunque cambie el nombre del campo.
  2) Reconoce sinónimos y variantes frecuentes:
  - nombre completo, nombres, nombre, full name
  - apellidos, apellido paterno/materno, surname, last name
  - telefono, celular, móvil, phone, contacto
  - cargo actual, cargo, puesto, posicion, perfil, role
  - correo, email, e-mail
  3) No inventes datos: si no aparece claramente, deja string vacío.
  4) Responde solo en JSON válido.`;

    const schema = {
      type: "OBJECT",
      properties: {
        nombres: { type: "STRING", description: "Nombre(s) o primer nombre detectado en el CV" },
        apellidos: { type: "STRING", description: "Apellido(s) detectados en el CV" },
        fullName: { type: "STRING", description: "Nombre completo si viene como una sola cadena" },
        rut: { type: "STRING", description: "RUT chileno si aparece, con o sin puntos y guión" },
        phone: { type: "STRING", description: "Teléfono de contacto (móvil/fijo), incluyendo prefijo si existe" },
        email: { type: "STRING", description: "Correo electrónico principal" },
        position: { type: "STRING", description: "Cargo principal, puesto o perfil profesional" },
        summary: { type: "STRING", description: "Resumen profesional breve" }
      },
      required: []
    };

    const extractedData = await genaiService.parseDocumentStructured(
      { mimeType, data },
      schema,
      prompt
    );

    const firstName = pickValue(extractedData, ['nombres', 'nombre', 'firstName', 'name']);
    const lastName = pickValue(extractedData, ['apellidos', 'apellido', 'lastName', 'surname']);
    const fullName = pickValue(extractedData, ['fullName', 'nombreCompleto', 'nombre completo']);

    let normalizedNombres = firstName;
    let normalizedApellidos = lastName;

    if ((!normalizedNombres || !normalizedApellidos) && fullName) {
      const parts = fullName.split(/\s+/).filter(Boolean);
      if (!normalizedNombres && parts.length > 0) normalizedNombres = parts[0];
      if (!normalizedApellidos && parts.length > 1) normalizedApellidos = parts.slice(1).join(' ');
    }

    // Envolver en estructura esperada por frontend y normalizar vacíos
    const parsedData = {
      nombres: normalizedNombres || '',
      apellidos: normalizedApellidos || '',
      rut: pickValue(extractedData, ['rut', 'run', 'dni', 'idNumber']) || '',
      phone: pickValue(extractedData, ['phone', 'telefono', 'celular', 'movil', 'contacto']) || '',
      email: pickValue(extractedData, ['email', 'correo', 'correoElectronico', 'e-mail']) || '',
      position: pickValue(extractedData, ['position', 'cargo', 'puesto', 'perfil', 'role']) || '',
      summary: pickValue(extractedData, ['summary', 'resumen', 'perfilProfesional', 'extracto']) || ''
    };

    if (!hasUsefulData(parsedData)) {
      return res.status(200).json({
        parsedData,
        warning: 'No se detectaron suficientes datos útiles. Prueba con un CV más legible o en PDF con texto seleccionable.'
      });
    }

    res.json({ parsedData });
  } catch (error) {
    console.error('Error parseando CV:', error?.message || error);
    
    // Manejar específicamente error 503 de Gemini
    const isUnavailable = error?.status === 503 || error?.message?.includes('UNAVAILABLE');
    const statusCode = isUnavailable ? 503 : 500;
    const errorMessage = isUnavailable 
      ? 'El servicio de IA está sobrecargado. Por favor, intenta nuevamente en unos momentos.'
      : 'Error analizando el currículum con IA';
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: error?.message,
      parsedData: null
    });
  }
});

module.exports = router;

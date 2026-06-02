const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../../auth/authMiddleware');
const genaiService = require('../../../utils/genaiService');

// Usamos memory storage para no guardar el CV físico antes de parsearlo, 
// o bien para pasarlo a Gemini como base64 directo.
const upload = multer({ storage: multer.memoryStorage() });

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

    const prompt = `Extrae la información principal de este currículum vitae. 
Si algún campo no está explícito en el CV, déjalo vacío o usa null.
Sigue estrictamente el JSON schema solicitado.`;

    const schema = {
      type: "OBJECT",
      properties: {
        nombres: { type: "STRING", description: "Nombres del candidato" },
        apellidos: { type: "STRING", description: "Apellidos del candidato" },
        rut: { type: "STRING", description: "RUT chileno si aparece, con guión" },
        telefono: { type: "STRING", description: "Teléfono de contacto" },
        email: { type: "STRING", description: "Correo electrónico" },
        cargo_sugerido: { type: "STRING", description: "Cargo al que postula o perfil principal" },
        experiencia_resumen: { type: "STRING", description: "Un breve párrafo resumiendo su experiencia laboral" }
      },
      required: ["nombres", "apellidos", "email"]
    };

    const extractedData = await genaiService.parseDocumentStructured(
      { mimeType, data },
      schema,
      prompt
    );

    res.json(extractedData);
  } catch (error) {
    console.error('Error parseando CV:', error);
    res.status(500).json({ error: 'Error analizando el currículum con IA', details: error.message });
  }
});

module.exports = router;

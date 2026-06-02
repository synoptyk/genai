const express = require('express');
const router = express.Router();
const { protect } = require('../../auth/authMiddleware');
const genaiService = require('../../../utils/genaiService');
const Vehiculo = require('../../agentetelecom/models/Vehiculo');
const Conductor = require('../../rrhh/models/Conductor');

/**
 * @route POST /api/admin/assistant/chat
 * @desc Endpoint para chatear con GENAI360 Assistant usando Function Calling
 * @access Private
 */
router.post('/chat', protect, async (req, res) => {
  try {
    const { message, history } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Mensaje es requerido' });
    }

    const systemInstruction = `Eres GENAI360, el asistente experto y maestro de operaciones logísticas, recursos humanos y telecomunicaciones de esta empresa.
Eres profesional, conciso y muy útil. 
Tienes acceso a herramientas para consultar el estado de vehículos y ubicaciones de conductores.
Si no sabes algo, dilo directamente. Si el usuario te pide datos que requieren herramientas, úsalas.`;

    // Tool declarations for Gemini
    const tools = [
      {
        name: 'getVehiculoInfo',
        description: 'Obtiene el estado actual y detalles de un vehículo dada su patente',
        parameters: {
          type: 'OBJECT',
          properties: {
            patente: {
              type: 'STRING',
              description: 'La patente del vehículo, ej. ABCD-12 o ABCD12'
            }
          },
          required: ['patente']
        }
      },
      {
        name: 'getConductorUbicacion',
        description: 'Obtiene la última ubicación GPS y detalles de un conductor dado su RUT',
        parameters: {
          type: 'OBJECT',
          properties: {
            rut: {
              type: 'STRING',
              description: 'El RUT del conductor, ej. 12345678-9'
            }
          },
          required: ['rut']
        }
      }
    ];

    // Initialize chat session
    // Ideally history is passed in, for this simplified version we create a fresh chat
    // If the SDK receives function calls, we handle them
    const chat = await genaiService.chatWithTools(history || [], message, tools, systemInstruction);

    // Check if the response includes a function call
    if (chat.functionCalls && chat.functionCalls.length > 0) {
      // Execute the function locally
      const calls = chat.functionCalls;
      const functionResponses = [];

      for (const call of calls) {
        if (call.name === 'getVehiculoInfo') {
          const patente = call.args.patente;
          const v = await Vehiculo.findOne({ patente: new RegExp(patente.replace('-', ''), 'i'), empresaRef: req.user.empresaRef }).lean();
          functionResponses.push({
            name: call.name,
            response: v ? { estado: v.estadoOperativo, marca: v.marca, modelo: v.modelo, asignado: v.asignadoA ? 'Sí' : 'No' } : { error: 'Vehículo no encontrado' }
          });
        } else if (call.name === 'getConductorUbicacion') {
          const rut = call.args.rut;
          const c = await Conductor.findOne({ rut, empresaRef: req.user.empresaRef }).lean();
          functionResponses.push({
            name: call.name,
            response: c ? { ubicacion: c.ultimaUbicacionTexto, actualizacion: c.ultimaConexion, estado: c.estadoGps } : { error: 'Conductor no encontrado' }
          });
        }
      }

      // Send the function responses back to the model to get the final text answer
      // Using the GoogleGenAI sdk, we typically send the function response back
      // Note: Implementation details of function calling loops vary by SDK wrapper, 
      // but conceptually we would return this to the user for now to test the loop,
      // or send it back to the chat instance.
      
      return res.json({ 
        role: 'model', 
        text: 'He consultado la base de datos.',
        functionCalls: calls,
        functionResponses: functionResponses 
      });
    }

    // Normal text response
    res.json({
      role: 'model',
      text: chat.text
    });

  } catch (error) {
    console.error('Error en GenAI Assistant:', error);
    res.status(500).json({ error: 'Error comunicándose con el asistente de IA' });
  }
});

module.exports = router;

const fs = require('fs');
const file = 'server/platforms/ai/aiRoutes.js';
let content = fs.readFileSync(file, 'utf8');

const startMarker = '// ── Tools definition (Function Calling for Gemini) ─────────────────────';
const endMarker = '// ─── GET /api/ai/health ──────────────────────────────────────────────────────';

let startIdx = content.indexOf(startMarker);
let endIdx = content.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
    const originalPre = content.substring(0, startIdx);
    const originalPost = content.substring(endIdx);

    const replacement = `// ── Tools definition (Function Calling for Gemini) ─────────────────────
    let useLocal = !process.env.GEMINI_API_KEY;
    const dbContext = contexto?.dbContext || '';
    const tools = [{
      functionDeclarations: [
        {
          name: 'buscar_orden_mongodb',
          description: 'Busca una orden de trabajo o actividad en MongoDB usando un RUT o un Número de Petición/INC.',
          parameters: {
            type: 'OBJECT',
            properties: {
              searchTerm: {
                type: 'STRING',
                description: 'El RUT del cliente o el Número de Petición (ej. INC000038780885)'
              }
            },
            required: ['searchTerm']
          }
        }
      ]
    }];
    let payloadSources = fuentes.map(({ documento, titulo, relevancia }) => ({ documento, titulo, relevancia }));

    if (!useLocal) {
      try {
        const { GoogleGenAI } = require('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const personaStyle = PERSONA_SYSTEM_STYLE[persona] || PERSONA_SYSTEM_STYLE.colaborador;
        
        const systemPrompt = \`Eres el asistente de IA del ecosistema Enterprise Platform GENAI360. 
Tu rol es analizar datos operacionales, responder preguntas sobre producción, RRHH, logística y prevención, y actuar como mesa de ayuda del ecosistema. Eres Ultra Inteligente: usas tus herramientas (tools) para buscar en la base de datos cuando se te pida analizar una orden o RUT.
Responde siempre en español. \${personaStyle}
      Contexto operativo en vivo: \${JSON.stringify(liveCtx)}.
    \${contexto ? \`Contexto adicional del usuario: \${String(contexto).slice(0, 500)}\` : ''}
    \${fuentes.length > 0 ? \`Base de conocimiento de manuales relevantes: \${JSON.stringify(fuentes.map((f) => ({ documento: f.documento, titulo: f.titulo, resumen: f.resumen })).slice(0, 3))}\` : ''}\`;

        let currentMessages = [
          ...sessionTurns,
          { role: 'user', parts: [{ text: mensajeLimpio }] }
        ];

        let response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: currentMessages,
          config: { systemInstruction: systemPrompt, tools: tools, temperature: 0.4 }
        });

        if (response.functionCalls && response.functionCalls.length > 0) {
          currentMessages.push({ role: 'model', parts: response.functionCalls.map(fc => ({ functionCall: fc })) });
          let toolResponsesParts = [];
          for (const toolCall of response.functionCalls) {
            if (toolCall.name === 'buscar_orden_mongodb') {
              const args = toolCall.args;
              let toolResult = '';
              try {
                const mongoose = require('mongoose');
                let ActividadModel;
                try { ActividadModel = mongoose.model('Actividad'); } catch (e) { ActividadModel = require('../agentetelecom/models/Actividad'); }
                const searchTerm = String(args.searchTerm || '').toUpperCase();
                const cleanTerm = searchTerm.replace('-', '');
                const query = {
                  $or: [
                    { RUT_DEL_CLIENTE: new RegExp(searchTerm, 'i') },
                    { RUT_DEL_CLIENTE: new RegExp(cleanTerm, 'i') },
                    { NUMERO_DE_PETICION: new RegExp(searchTerm, 'i') },
                    { ORDENID: new RegExp(searchTerm, 'i') },
                    { ordenId: new RegExp(searchTerm, 'i') },
                    { 'Número de Petición': new RegExp(searchTerm, 'i') },
                    { 'Numero orden': new RegExp(searchTerm, 'i') },
                    { 'RUT del cliente': new RegExp(searchTerm, 'i') },
                    { 'RUT del cliente': new RegExp(cleanTerm, 'i') }
                  ]
                };
                const orderResults = await ActividadModel.find(query).sort({ fecha: -1 }).limit(5).lean();
                if (orderResults.length > 0) {
                  toolResult = orderResults.map(o => ({
                    fecha: o.fecha, peticion: o.NUMERO_DE_PETICION, rut: o.RUT_DEL_CLIENTE,
                    tecnico: o.nombreTecnico || o.idRecursoToa, estado: o.ESTADO_DE_LA_ACTIVIDAD,
                    tipo_trabajo: o.TIPO_DE_TRABAJO, observaciones: o.OBSERVACIONES_DE_LA_ORDEN
                  }));
                } else {
                  toolResult = { message: \`No se encontraron resultados para la búsqueda "\${searchTerm}".\` };
                }
              } catch (err) {
                toolResult = { error: \`Error al buscar en base de datos operativa: \${err.message}\` };
              }
              toolResponsesParts.push({ functionResponse: { name: toolCall.name, response: { result: toolResult } } });
            }
          }
          currentMessages.push({ role: 'function', parts: toolResponsesParts });
          response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', contents: currentMessages,
            config: { systemInstruction: systemPrompt, tools: tools, temperature: 0.4 }
          });
        }

        const raw = response.text || 'Sin respuesta del modelo.';
        const respuesta = humanizeResponse({ user: req.user, answer: raw, isFirstTurn, persona });
        
        const newTurns = [
          { role: 'user', parts: [{ text: mensajeLimpio }] },
          { role: 'model', parts: [{ text: respuesta }] }
        ];
        await appendSessionMemory(req, chatSessionId, newTurns);

        return res.json({ ok: true, modo: 'gemini', respuesta, tokens: response.usageMetadata || {}, intentLabel, fuentes: payloadSources });
      } catch (aiErr) {
        logger.error('Gemini error fallback', { error: aiErr.message });
        useLocal = true;
      }
    }

    if (useLocal) {
      const lower = mensajeLimpio.toLowerCase();
      let respuesta = '';

      const respuestaManual = buildManualGuidedLocalAnswer(mensajeLimpio, liveCtx, fuentes);

      if (dbContext && dbContext.includes('Base de datos operativa (Búsqueda')) {
        respuesta = \`**Resultados de Búsqueda de Órdenes:**\\n\${dbContext}\\n\\n*Nota: Para un análisis más natural de esta información, asegúrate de activar la llave de Inteligencia Artificial (OpenAI).*\`;
      } else if (lower.includes('produccion') || lower.includes('producción') || lower.includes('actividad')) {
        respuesta = \`Producción en vivo (30 días): \${liveCtx.totalActividades30d} actividades, \${liveCtx.totalPuntos30d} puntos, promedio \${liveCtx.promedioActividadesDia30d} actividades/día. Revisa Insights de Producción para tendencia y proyección.\`;
      } else if (lower.includes('rrhh') || lower.includes('personal') || lower.includes('dotacion') || lower.includes('asistencia') || intentLabel === 'rrhh_operacion') {
        respuesta = \`RRHH en vivo: dotación \${liveCtx.totalPersonal} personas y asistencia 7d \${liveCtx.tasaAsistencia7d ?? 'N/D'}%. \${liveCtx.tasaAsistencia7d !== null && liveCtx.tasaAsistencia7d < 80 ? 'Alerta: asistencia bajo 80%.' : 'Sin alerta crítica de asistencia.'}\`;
      } else if (lower.includes('gps') || lower.includes('flota') || lower.includes('vehiculo') || intentLabel === 'operaciones_portales') {
        respuesta = 'El rastreo GPS de flota está activo y sincroniza cada 5 minutos de forma automática. Visita **Flota & GPS → Monitor GPS** para ver posiciones en tiempo real.';
      } else if (lower.includes('toa') || lower.includes('extracci')) {
        respuesta = 'El Bot TOA ejecuta extracción masiva de órdenes de trabajo cada noche a las 23:00 (hora Santiago). Los datos quedan disponibles en el módulo de Producción al día siguiente.';
      } else if (lower.includes('sii') || lower.includes('tributario') || lower.includes('factura')) {
        respuesta = 'La integración con el SII permite consultar y gestionar documentación tributaria directamente desde la plataforma. Accede desde **Administración → Dashboard Tributario**.';
      } else if (lower.includes('prevenci') || lower.includes('ast') || lower.includes('riesgo') || intentLabel === 'prevencion_inspecciones') {
        respuesta = 'El módulo HSE cubre AST digital, inspecciones, incidentes, matriz IPER y charlas de seguridad. Para anomalías en indicadores de seguridad, revisa **Prevención → Dashboard HSE**.';
      } else if (intentLabel === 'permisos_accesos') {
        respuesta = 'Para incidencias de acceso, valida primero rol, permisos granulares y ruta de menú del usuario. Si indicas módulo y acción exacta (ver/crear/editar/eliminar), te doy el paso a paso de corrección.';
      } else if (intentLabel === 'logistica_operacion') {
        respuesta = 'Para logística, revisa trazabilidad de inventario por técnico, stock disponible y último movimiento de bodega. Si me compartes técnico, recurso y fecha, te indico dónde validar y aprobar.';
      } else if (respuestaManual) {
        respuesta = respuestaManual;
      } else {
        respuesta = buildSmartLocalFallbackAnswer(mensajeLimpio, liveCtx, intentLabel, fuentes);
      }

      const finalRespuesta = humanizeResponse({ user: req.user, answer: respuesta, isFirstTurn, persona });
      
      const newTurns = [
        { role: 'user', parts: [{ text: mensajeLimpio }] },
        { role: 'model', parts: [{ text: finalRespuesta }] }
      ];
      await appendSessionMemory(req, chatSessionId, newTurns);

      return res.json({ ok: true, modo: 'local', respuesta: finalRespuesta, intentLabel, contextoVivo: liveCtx, fuentes: payloadSources, sessionMemory: { ttlMs: CHAT_TTL_MS } });
    }
  } catch (err) {
    logger.error('AI chat error', { error: err.message, stack: err.stack });
    res.status(500).json({ ok: false, message: 'Error al procesar la consulta.', err_msg: err.message, stack: err.stack });
  }
});

`;

    fs.writeFileSync(file, originalPre + replacement + '\n' + originalPost, 'utf8');
    console.log('Successfully replaced file content.');
} else {
    console.log('Markers not found.');
}

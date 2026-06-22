const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');

// Instantiate the SDK. It will automatically use process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({});

// We use the 'flash' model as requested for lowest cost and fast performance
const FLASH_MODEL = 'gemini-2.5-flash';

function extractResponseText(response) {
  if (!response) return '';
  if (typeof response.text === 'string') return response.text;
  if (typeof response.text === 'function') return response.text() || '';

  const partText = response?.candidates?.[0]?.content?.parts
    ?.map(part => part?.text)
    .filter(Boolean)
    .join('\n');

  return partText || '';
}

function parseJsonSafely(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return {};

  // Soporta respuestas dentro de bloques markdown ```json ... ```
  const codeBlockMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/i);
  const candidate = codeBlockMatch ? codeBlockMatch[1].trim() : text;

  try {
    return JSON.parse(candidate);
  } catch (_err) {
    // Fallback: intenta extraer el primer objeto JSON válido entre llaves
    const objectMatch = candidate.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    throw _err;
  }
}

// Helper para reintentos con backoff exponencial
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      // Detectar si es error 503 de Gemini
      const isUnavailable = err?.status === 503 || 
                           err?.message?.includes('UNAVAILABLE') ||
                           err?.error?.status === 'UNAVAILABLE';
      const isLastAttempt = attempt === maxRetries;
      
      if (!isUnavailable || isLastAttempt) {
        throw err;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1); // 2s, 4s, 8s...
      console.warn(`⚠️ Gemini API unavailable (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Parses a document (image/pdf) using a strict JSON schema.
 * Useful for extracting CVs, invoices, or ID cards into structured data.
 * @param {Object} mimeAndData - { mimeType: 'application/pdf', data: 'base64_encoded_string' }
 * @param {Object} schema - The JSON schema object
 * @param {String} prompt - Instructions for extraction
 */
exports.parseDocumentStructured = async (mimeAndData, schema, prompt) => {
  try {
    const response = await retryWithBackoff(async () => {
      return await ai.models.generateContent({
        model: FLASH_MODEL,
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mimeAndData.mimeType,
                  data: mimeAndData.data
                }
              },
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.1 // Low temperature for deterministic extraction
        }
      });
    });

    const text = extractResponseText(response);
    return parseJsonSafely(text);
  } catch (err) {
    console.error('Error in parseDocumentStructured after retries:', err?.message || err);
    throw err;
  }
};

/**
 * Analyzes an image multimodally.
 * Useful for assessing vehicle damage (Siniestros) or quality checks.
 * @param {Array<String>} imageUrls - Array of image URLs
 * @param {String} prompt - What to look for in the images
 */
exports.analyzeImageMultimodal = async (imageUrls, prompt) => {
  try {
    const contents = [];
    
    // Download images and convert to base64
    for (const url of imageUrls) {
      if (typeof url === 'string' && url.startsWith('http')) {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');
        const mimeType = response.headers['content-type'] || 'image/jpeg';
        contents.push({
          inlineData: {
            mimeType,
            data: buffer.toString('base64')
          }
        });
      }
    }
    
    if (contents.length === 0) {
      return "No valid images provided for analysis.";
    }

    contents.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents,
      generationConfig: {
        temperature: 0.3
      }
    });

    return extractResponseText(response);
  } catch (err) {
    console.error('Error in analyzeImageMultimodal:', err);
    throw err;
  }
};

/**
 * Handles a conversation turn with tool calling enabled.
 * @param {Array} history - The chat history format expected by the SDK
 * @param {String} message - The new user message
 * @param {Array} tools - Array of tool declarations
 * @param {Object} systemInstruction - System persona rules
 */
exports.chatWithTools = async (history, message, tools, systemInstruction) => {
  try {
    // Convert history format if necessary
    const chat = ai.chats.create({
      model: FLASH_MODEL,
      config: {
        systemInstruction,
        tools: tools && tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
        temperature: 0.2
      }
    });

    // If there's prior history, you would load it here or pass the context.
    // For simplicity, we send the message to a new or pre-loaded chat session.
    const response = await chat.sendMessage({ message });
    return response;
  } catch (err) {
    console.error('Error in chatWithTools:', err);
    throw err;
  }
};

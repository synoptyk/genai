const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');

// Instantiate the SDK. It will automatically use process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({});

// We use the 'flash' model as requested for lowest cost and fast performance
const FLASH_MODEL = 'gemini-2.5-flash';

/**
 * Parses a document (image/pdf) using a strict JSON schema.
 * Useful for extracting CVs, invoices, or ID cards into structured data.
 * @param {Object} mimeAndData - { mimeType: 'application/pdf', data: 'base64_encoded_string' }
 * @param {Object} schema - The JSON schema object
 * @param {String} prompt - Instructions for extraction
 */
exports.parseDocumentStructured = async (mimeAndData, schema, prompt) => {
  try {
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: [
        {
          inlineData: {
            mimeType: mimeAndData.mimeType,
            data: mimeAndData.data
          }
        },
        prompt
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.1 // Low temperature for deterministic extraction
      }
    });

    return JSON.parse(response.text());
  } catch (err) {
    console.error('Error in parseDocumentStructured:', err);
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

    contents.push(prompt);

    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents,
      config: {
        temperature: 0.3
      }
    });

    return response.text();
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

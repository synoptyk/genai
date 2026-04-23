const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

// Soporte para múltiples frameworks (Vite y CRA)
const VITE_API_URL = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_API_URL : null;
const REACT_APP_API_URL = process.env.REACT_APP_API_URL;

let API_URL = REACT_APP_API_URL || VITE_API_URL;

if (!API_URL) {
  if (isLocal) {
    API_URL = "http://localhost:5003";
  } else {
    // Si estamos en Cloud Run, intentamos inferir la URL del servidor
    if (window.location.hostname.includes('run.app')) {
      API_URL = window.location.origin.replace('genai-client', 'genai-server');
    } else {
      // Fallback definitivo para producción
      API_URL = "https://genai-server-g6z724w66a-uc.a.run.app";
    }
  }
}

// CORRECCIÓN CRÍTICA: Si no es local pero el API_URL apunta a localhost (posible error de build), forzamos producción
if (!isLocal && (API_URL.includes('localhost') || API_URL.includes('127.0.0.1'))) {
  console.warn("⚠️ API_URL configurada como localhost en ambiente remoto. Forzando URL de producción.");
  API_URL = "https://genai-server-g6z724w66a-uc.a.run.app";
}

console.log(`🌐 [Config] API URL: ${API_URL} (${isLocal ? 'Local Mode' : 'Production Mode'})`);

export default API_URL;

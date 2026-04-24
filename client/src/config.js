const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

// Soporte para múltiples frameworks (Vite y CRA)
const VITE_API_URL = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_API_URL : null;
const REACT_APP_API_URL = process.env.REACT_APP_API_URL;

let API_URL = REACT_APP_API_URL || VITE_API_URL;

// Si no hay API_URL configurada en el build, intentamos detectarla dinámicamente
if (!API_URL) {
  if (isLocal) {
    API_URL = "http://localhost:5003";
  } else {
    // Detectar dinámicamente si estamos en Cloud Run
    const hostname = window.location.hostname;
    if (hostname.includes('run.app')) {
      // Si el cliente es 'genai-client-xyz', el servidor suele ser 'genai-server-xyz'
      API_URL = window.location.origin.replace('genai-client', 'genai-server');
    } else {
      // Fallback para el proyecto específico genai360-494015
      API_URL = "https://genai-server-494015-uc.a.run.app"; 
    }
  }
}

// Validación final: Si estamos en producción pero la URL apunta a local, forzamos la URL del proyecto
if (!isLocal && (API_URL.includes('localhost') || API_URL.includes('127.0.0.1'))) {
  console.log("☁️ Optimizando conexión para ambiente remoto...");
  API_URL = "https://genai-server-494015-uc.a.run.app";
}

console.log(`🌐 [Config] API URL: ${API_URL} (${isLocal ? 'Local Mode' : 'Production Mode'})`);

export default API_URL;


const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

// Soporte para múltiples frameworks (Vite y CRA)
const VITE_API_URL = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_API_URL : null;
const REACT_APP_API_URL = typeof process !== 'undefined' && process.env ? process.env.REACT_APP_API_URL : null;

const API_URL = VITE_API_URL || REACT_APP_API_URL || (
  isLocal 
    ? "http://localhost:5003" 
    : (window.location.hostname.includes('run.app') 
        ? window.location.origin.replace('genai-client', 'genai-server') 
        : "https://genai-backend-final.onrender.com")
);

console.log(`🌐 [Config] API URL: ${API_URL} (${isLocal ? 'Local Mode' : 'Production Mode'})`);

export default API_URL;

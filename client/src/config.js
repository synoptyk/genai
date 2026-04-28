const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

const VITE_API_URL = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_API_URL : null;
const REACT_APP_API_URL = process.env.REACT_APP_API_URL;
const PROD_API_URL = "https://genai-server-g6z724w66a-uc.a.run.app";
const LOCAL_API_URL = "http://localhost:5003";
const localApiFlag = (() => {
  try {
    return window.localStorage.getItem('use_local_api') === 'true';
  } catch (_) {
    return false;
  }
})();
const useLocalApi = process.env.REACT_APP_USE_LOCAL_API === 'true' || localApiFlag;

let API_URL = REACT_APP_API_URL || VITE_API_URL;

if (!API_URL) {
  if (isLocal) {
    // Por defecto en localhost usar la API local (puerto 5003)
    API_URL = LOCAL_API_URL;
  } else {
    const hostname = window.location.hostname;
    if (hostname.includes('run.app')) {
      API_URL = window.location.origin.replace('genai-client', 'genai-server');
    } else {
      API_URL = PROD_API_URL;
    }
  }
}

API_URL = String(API_URL || '').replace(/\/$/, '');

if (!isLocal && (API_URL.includes('localhost') || API_URL.includes('127.0.0.1') || API_URL.includes('494015'))) {
  API_URL = PROD_API_URL;
}

if (isLocal && !useLocalApi && (API_URL.includes('localhost') || API_URL.includes('127.0.0.1'))) {
  // Forzamos a que en local se conecte a Producción por defecto para evitar ERR_CONNECTION_REFUSED
  API_URL = PROD_API_URL;
}

console.log(`🌐 [Config] API URL: ${API_URL} (${isLocal ? 'Local Mode (Apuntando a Producción)' : 'Production Mode'})`);

export const API_FALLBACK_URL = PROD_API_URL;
export const API_LOCAL_URL = LOCAL_API_URL;
export default API_URL;

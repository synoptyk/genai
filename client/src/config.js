
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

const API_URL = isLocal
    ? "http://localhost:5005"
    : "https://gen-ai-backend.onrender.com"; // Reemplazar con tu URL de Render despues del Paso 1

export default API_URL;

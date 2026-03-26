
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

const API_URL = isLocal
    ? "http://localhost:5003"
    : (import.meta.env.VITE_API_URL || "https://genai-backend-final.onrender.com");

export default API_URL;

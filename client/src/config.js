
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

const API_URL = isLocal
    ? "http://localhost:5005"
    : "https://genai-backend-kdab.onrender.com";

export default API_URL;

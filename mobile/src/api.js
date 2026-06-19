import axios from 'axios';

// URL Producción Google Cloud Run
export const API_BASE = 'https://genai-server-g6z724w66a-uc.a.run.app/api';

export const apiClient = (token) => axios.create({
  baseURL: API_BASE,
  headers: token ? { Authorization: `Bearer ${token}` } : {}
});

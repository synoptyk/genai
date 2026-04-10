import axios from 'axios';

export const API_BASE = 'https://platform-backend-final.onrender.com/api';

export const apiClient = (token) => axios.create({
  baseURL: API_BASE,
  headers: token ? { Authorization: `Bearer ${token}` } : {}
});

import axios from "axios";
import toast from "react-hot-toast";
import { API_URL, WebSocket_BASE } from "../../config"; 

export const API_BASE = API_URL
export const WS_BASE = WebSocket_BASE

const axiosClient = axios.create({
  baseURL: API_BASE, // API_BASE = API_URL
  headers: { "Content-Type": "application/json" },
});

// ➕ Access token қосу
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ⚠️ 401 өңдеу
axiosClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const detail = error?.response?.data?.detail;
    if (status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      toast.error(detail || "Сессия уақыты аяқталды. Қайта кіріңіз.");
      // Қалауың бойынша редирект:
      // if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
console.log("API_BASE =", API_BASE)

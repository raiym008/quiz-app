import axios from "axios";

const API_URL = "http://localhost:8000/api/auth";

export async function registerUser(email: string, username: string, password: string) {
  const res = await axios.post(`${API_URL}/register`, { email, username, password });
  return res.data;
}

export async function verifyUser(email: string, code: string) {
  const res = await axios.post(`${API_URL}/verify`, { email, code });
  return res.data;
}

export async function loginUser(username: string, password: string) {
  const res = await axios.post(`${API_URL}/login`, { username, password });
  return res.data;
}

export async function getCurrentUser(token: string) {
  const res = await axios.get(`${API_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

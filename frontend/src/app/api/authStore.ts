import { create } from "zustand";
import axiosClient from "./axiosClient";

type AuthState = {
  user: any | null;
  login: (username: string, password: string) => Promise<boolean>;
  register: (email: string, username: string, password: string) => Promise<boolean>;
  verify: (email: string, code: string) => Promise<boolean>;
  resendCode: (email: string) => Promise<boolean>;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,

  async register(email, username, password) {
    const res = await axiosClient.post("/register", { email, username, password });
    return res.status === 200;
  },

  async verify(email, code) {
    const res = await axiosClient.post("/verify", { email, code });
    return res.status === 200;
  },

  async resendCode(email) {
    const res = await axiosClient.post("/resend-code", { email });
    return res.status === 200;
  },

  async login(username, password) {
    const res = await axiosClient.post("/login", { username, password });
    if (res.data.access_token) {
      localStorage.setItem("access_token", res.data.access_token);
      localStorage.setItem("refresh_token", res.data.refresh_token);
      set({ user: res.data.user });
      return true;
    }
    return false;
  },

  logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    set({ user: null });
    window.location.href = "/login";
  },
}));

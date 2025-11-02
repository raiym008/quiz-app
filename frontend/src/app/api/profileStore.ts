import { create } from "zustand";
import { API_BASE } from "./axiosClient";

export type UserProfile = {
  id: number;
  email: string;
  username: string;
  name?: string;
  bio?: string;
  avatar_url?: string;
  created_at?: string;
};

type ProfileState = {
  baseURL: string;
  me: UserProfile | null;
  loading: boolean;

  // API
  getMe: () => Promise<boolean>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<boolean>;
  uploadAvatar: (file: File) => Promise<string | null>;
};

export const useProfileStore = create<ProfileState>((set, get) => ({
  baseURL: API_BASE,
  me: null,
  loading: false,

  async getMe() {
    try {
      set({ loading: true });
      const res = await fetch(`${get().baseURL}/me`, { credentials: "include" });
      set({ loading: false });
      if (!res.ok) {
        console.error("getMe error", await safeJson(res));
        return false;
      }
      const data = (await res.json()) as UserProfile;
      set({ me: data });
      return true;
    } catch (e) {
      console.error("getMe exception", e);
      set({ loading: false });
      return false;
    }
  },

  async updateProfile(patch) {
    try {
      const res = await fetch(`${get().baseURL}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        console.error("updateProfile error", await safeJson(res));
        return false;
      }
      // сервер соңғы жаңартылған профильді қайтара алады
      const data = (await res.json()) as UserProfile;
      set({ me: data });
      return true;
    } catch (e) {
      console.error("updateProfile exception", e);
      return false;
    }
  },

  async uploadAvatar(file: File) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${get().baseURL.replace(/\/api$/, "")}/api/upload`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        console.error("uploadAvatar error", await safeJson(res));
        return null;
      }
      const data = await res.json(); // күтілетіні: { url: "..." } не { filename, url }
      const url = data?.url || data?.filename || null;
      return url;
    } catch (e) {
      console.error("uploadAvatar exception", e);
      return null;
    }
  },
}));

async function safeJson(res: Response) {
  try { return await res.json(); } catch { return {}; }
}

import { create } from "zustand";
import axiosClient from "./axiosClient";

export type User = {
  id: number;
  email: string;
  username: string;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  hydrate: () => void;
  register: (email: string, username: string, password: string) => Promise<User | null>;
  verify: (email: string, code: string) => Promise<boolean>;
  resendCode: (email: string) => Promise<boolean>;
  login: (username: string, password: string) => Promise<User | null>;
  logout: () => void;
};

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const USER_ID_KEY = "user_id";
const USER_KEY = "user";

function saveSession(user: User, access: string, refresh?: string) {
  localStorage.setItem(ACCESS_KEY, access);
  if (refresh) {
    localStorage.setItem(REFRESH_KEY, refresh);
  }
  localStorage.setItem(USER_ID_KEY, String(user.id));
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(USER_KEY);
}

function isJwtValid(token: string | null): boolean {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    const payload = JSON.parse(atob(parts[1]));
    const expMs = payload?.exp ? payload.exp * 1000 : 0;

    if (!expMs) return false;
    return Date.now() < expMs;
  } catch {
    return false;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,

  // Приложение ашылғанда localStorage-тен user + token алып көреміз
  hydrate: () => {
    const token = localStorage.getItem(ACCESS_KEY);
    const userStr = localStorage.getItem(USER_KEY);

    if (!token || !userStr || !isJwtValid(token)) {
      clearSession();
      set({ user: null });
      return;
    }

    try {
      const user = JSON.parse(userStr) as User;
      set({ user });
    } catch {
      clearSession();
      set({ user: null });
    }
  },

  // ТІРКЕЛУ:
  // /api/register → { message, user: { id, email, username } } деп күтеміз.
  // Егер user келмесе де, 200 болса — success ретінде қараймыз (verify бетіне өтеміз).
  async register(email, username, password) {
    set({ loading: true });
    try {
      const res = await axiosClient.post("/register", {
        email,
        username,
        password,
      });

      if (res.status === 200) {
        if (res.data?.user) {
          // backend user.id қайтарса — сол нақты user
          return res.data.user as User;
        }

        // Кейбір жағдайда backend тек message қайтарады:
        // verify логикасы email арқылы жүретіндіктен, dummy user қайтарсақ та болады.
        return {
          id: res.data?.id ?? 0,
          email,
          username,
        } as User;
      }

      return null;
    } catch {
      return null;
    } finally {
      set({ loading: false });
    }
  },

  // EMAIL РАСТАУ
  async verify(email, code) {
    set({ loading: true });
    try {
      const res = await axiosClient.post("/verify", { email, code });
      return res.status === 200;
    } catch {
      return false;
    } finally {
      set({ loading: false });
    }
  },

  // ҚАЙТА КОД ЖІБЕРУ
  async resendCode(email) {
    try {
      const res = await axiosClient.post("/resend-code", { email });
      return res.status === 200;
    } catch {
      return false;
    }
  },

  // ЛОГИН:
  // /api/login → { access_token, refresh_token, user:{id,email,username} }
  // Мұнда сәтті болса:
  // - token-дарды сақтаймыз
  // - user.id-ны сақтаймыз
  // - return user → LoginPage `/u/:id`-ке redirect жасай алады
  async login(username, password) {
    set({ loading: true });
    try {
      const res = await axiosClient.post("/login", { username, password });
      const data = res.data;

      if (!data?.access_token || !data?.user) return null;
      if (!isJwtValid(data.access_token)) return null;

      const user = data.user as User;
      const access = data.access_token as string;
      const refresh = data.refresh_token as string | undefined;

      saveSession(user, access, refresh);
      set({ user });

      return user;
    } catch {
      return null;
    } finally {
      set({ loading: false });
    }
  },

  // ЛОГАУТ
  logout() {
    clearSession();
    set({ user: null });
    window.location.href = "/login";
  },
}));

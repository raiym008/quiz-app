import React, { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const USER_KEY = "user";
const USER_ID_KEY = "user_id";

function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(USER_ID_KEY);
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

function readAuth() {
  const token = localStorage.getItem(ACCESS_KEY);
  const uid = localStorage.getItem(USER_ID_KEY);
  const user = localStorage.getItem(USER_KEY);

  if (!token || !uid || !user) {
    clearSession();
    return { ok: false, uid: null as string | null };
  }

  if (!isJwtValid(token)) {
    clearSession();
    return { ok: false, uid: null };
  }

  return { ok: true, uid };
}

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId: routeId } = useParams();
  const [checking, setChecking] = useState(true);
  const [ok, setOk] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    const { ok, uid } = readAuth();
    setOk(ok);
    setUid(uid);
    setChecking(false);
  }, []);

  if (checking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          color: "#9ca3af",
          background:
            "radial-gradient(1200px 800px at -10% -10%, #e8eefc 0%, transparent 60%) no-repeat, #f5f7fb",
        }}
      >
        Жүктелуде...
      </div>
    );
  }

  if (!ok || !uid) {
    return <Navigate to="/login" replace />;
  }

  if (routeId && routeId !== uid) {
    return <Navigate to={`/u/${uid}`} replace />;
  }

  return <>{children}</>;
}

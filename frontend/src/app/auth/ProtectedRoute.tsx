import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

/**
 * Қорғалған беттерге арналған маршрут.
 * Егер access_token жоқ болса — /login бетіне қайтарады.
 * Егер токен бар, бірақ тексеру жүріп жатса — жүктеу спиннерін көрсетеді.
 */
export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const [checking, setChecking] = useState(true);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setIsAuth(false);
      setChecking(false);
      return;
    }

    // Егер токен бар болса, оны жай тексеріп өтеміз (мысалы, localStorage-та сақталған)
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const exp = payload?.exp ? payload.exp * 1000 : 0;
      if (Date.now() > exp) {
        toast.error("Сессия уақыты аяқталды. Қайта кіріңіз 🔐");
        localStorage.removeItem("access_token");
        setIsAuth(false);
      } else {
        setIsAuth(true);
      }
    } catch {
      setIsAuth(false);
    } finally {
      setChecking(false);
    }
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600 text-lg">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mr-3"></div>
        Жүктелуде...
      </div>
    );
  }

  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

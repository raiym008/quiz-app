import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { Toaster } from "react-hot-toast";

import MainPage from "./app/pages/MainPage";
import HomePage from "./app/pages/HomePage";
import AdminPanel from "./app/admin/AdminPanel";
import TopicsPage from "./app/pages/TopicsPage";
import QuizPage from "./app/admin/quiz/QuizPage";

import RegisterPage from "./app/auth/RegisterPage";
import LoginPage from "./app/auth/LoginPage";
import VerifyPage from "./app/auth/VerifyPage";
import ProtectedRoute from "./app/auth/ProtectedRoute";

import Test from "../test";
import { useAuthStore } from "./app/api/authStore";

import FeedbackManager from "./app/feedback/FeedbackManager";
import NetworkGuard from "./app/NetworkGuard";

// /home, /account -> әрқашан ағымдағы user-ге редирект
function RedirectToMyAccount() {
  const user = useAuthStore((s) => s.user);

  if (user?.id) {
    return <Navigate to={`/u/${user.id}`} replace />;
  }

  return <Navigate to="/login" replace />;
}

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <>
      <NetworkGuard/>

      <BrowserRouter>
        <Routes>
          {/* Паблик беттер */}
          <Route path="/" element={<MainPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify" element={<VerifyPage />} />

          {/* ====== ҚОРҒАЛҒАН РОУТТАР: /u/:userId/... ====== */}

          {/* Негізгі дашборд */}
          <Route
            path="/u/:userId"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />

          {/* Quiz жасау беті */}
          <Route
            path="/u/:userId/quiz-jasau"
            element={
              <ProtectedRoute>
                <AdminPanel />
              </ProtectedRoute>
            }
          />

          {/* Тақырыпқа тиесілі Quiz-дер */}
          <Route
            path="/u/:userId/topics/:id/quizzes"
            element={
              <ProtectedRoute>
                <QuizPage />
              </ProtectedRoute>
            }
          />

          {/* Пән -> Тақырыптар */}
          <Route
            path="/u/:userId/subjects/:subjectId/topics"
            element={
              <ProtectedRoute>
                <TopicsPage />
              </ProtectedRoute>
            }
          />

          {/* Ескі /home және /account → ағымдағы user */}
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <RedirectToMyAccount />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <RedirectToMyAccount />
              </ProtectedRoute>
            }
          />

          {/* Info / test */}
          <Route path="/info" element={<Test />} />

          {/* Белгісіз роуттар → басты бет */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <FeedbackManager/>

      </BrowserRouter>

      {/* Toast конфигурациясы */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 6000,
          style: {
            borderRadius: "12px",
            background: "#fff",
            color: "#111827",
            boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
          },
          success: { iconTheme: { primary: "#22c55e", secondary: "#fff" } },
          error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
        }}
      />
    </>
  );
}

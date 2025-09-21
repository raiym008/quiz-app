// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import HomePage from "./app/pages/HomePage";
import AdminPanel from "./app/admin/AdminPanel";
import TopicsPage from "./app/pages/TopicsPage";
import QuizPage from "./app/admin/quiz/QuizPage";
import QuizSessionPage from "./app/pages/QuizSessionPage";

import RegisterPage from "./app/auth/RegisterPage";
import LoginPage from "./app/auth/LoginPage";
import VerifyPage from "./app/auth/VerifyPage";
import ProtectedRoute from "./app/auth/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ашық беттер */}
        <Route path="/" element={<HomePage />} />
        <Route path="/subjects/:name/topics" element={<TopicsPage />} />

        {/* Auth беттері */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify" element={<VerifyPage />} />

        {/* Қорғалған беттер: тек кіргендерге */}
        <Route
          path="/quiz-jasau"
          element={
            <ProtectedRoute>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/topics/:id/quizzes"
          element={
            <ProtectedRoute>
              <QuizPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/topics/:id/emtihan"
          element={
            <ProtectedRoute>
              <QuizSessionPage />
            </ProtectedRoute>
          }
        />

        {/* Белгісіз маршруттар үшін бағыттау */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

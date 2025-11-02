import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

// Беттер (нақты барларын ғана қалдыр)
import HomePage from "./app/pages/HomePage";
import AdminPanel from "./app/admin/AdminPanel";
import TopicsPage from "./app/pages/TopicsPage";
import QuizPage from "./app/admin/quiz/QuizPage";

import RegisterPage from "./app/auth/RegisterPage";
import LoginPage from "./app/auth/LoginPage";
import VerifyPage from "./app/auth/VerifyPage";
import ProtectedRoute from "./app/auth/ProtectedRoute";
import ProfilePage from "./app/pages/ProfilePage";
import MainPage from "./app/pages/MainPage";

import WaitingRoom from "./app/modes/iQuiz/WaitingRoom";
import JoinRoom from "./app/modes/iQuiz/JoinRoom";
import ExamSetup from "./app/modes/iQuiz/ExamSetup";
import StudentWaitingRoom from "./app/modes/iQuiz/StudentWaitingRoom";

import Test from "../test";

export default function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          {/* 🌍 Ашық маршруттар */}
          <Route path="/" element={<MainPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify" element={<VerifyPage />} />

          <Route path="/iquiz/waiting/:roomId" element={<WaitingRoom />} />
          <Route path="/iquiz/join" element={<JoinRoom/>}/>
          <Route path="/iquiz/start" element={<ExamSetup/>}/>
          <Route path="/iquiz/room/:roomId" element={<StudentWaitingRoom/>}/>

          {/* 🔒 Қорғалған маршруттар */}
          <Route path="/home" element={<ProtectedRoute><HomePage/></ProtectedRoute>} />
          <Route path="/quiz-jasau" element={<ProtectedRoute><AdminPanel/></ProtectedRoute>} />
          <Route path="/topics/:id/quizzes" element={<ProtectedRoute><QuizPage/></ProtectedRoute>} />
          <Route path="/subjects/:name/topics" element={<ProtectedRoute><TopicsPage/></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><ProfilePage/></ProtectedRoute>} />

          {/* 🚫 Белгісіз маршрут */}
          <Route path="*" element={<Navigate to="/" replace />} />

          <Route path="/info" element={<Test/>}/>
        </Routes>
      </BrowserRouter>

      {/* 🔔 Toast хабарламалар */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: "12px",
            background: "#fff",
            color: "#333",
            boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
          },
          success: { iconTheme: { primary: "#22c55e", secondary: "#fff" } },
          error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
        }}
      />
    </>
  );
}

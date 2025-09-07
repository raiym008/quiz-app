import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./app/pages/HomePage";
import AdminPanel from "./app/admin/AdminPanel";
import TopicsPage from "./app/pages/TopicsPage";
import QuizPage from "./app/admin/quiz/QuizPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/subjects/:name/topics" element={<TopicsPage />}/>
        <Route path="/topics/:id/quizzes" element={<QuizPage />} />
      </Routes>
    </BrowserRouter>
  );
}


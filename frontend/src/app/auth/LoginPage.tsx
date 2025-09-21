import { useState } from "react";
import { loginUser } from "../api/auth";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await loginUser(username, password);
      localStorage.setItem("access_token", data.access_token);
      alert("Кіру сәтті ✅");
      navigate("/");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Қате логин немесе пароль");
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card p-4 shadow">
            <h2 className="text-center mb-4">Кіру</h2>
            <form onSubmit={handleLogin}>
              <div className="mb-3">
                <label>Username</label>
                <input type="text" className="form-control"
                  value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="mb-3">
                <label>Password</label>
                <input type="password" className="form-control"
                  value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <button className="btn btn-primary w-100">Кіру</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

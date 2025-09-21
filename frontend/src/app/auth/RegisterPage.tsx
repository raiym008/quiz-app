import { useState } from "react";
import { registerUser } from "../api/auth";
import { useNavigate } from "react-router-dom";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await registerUser(email, username, password);
      alert("Код email-ге жіберілді ✅");
      navigate("/verify", { state: { email } });
    } catch (err: any) {
      alert(err.response?.data?.detail || "Қате шықты");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card p-4 shadow">
            <h2 className="text-center mb-4">Тіркелу</h2>
            <form onSubmit={handleRegister}>
              <div className="mb-3">
                <label>Email</label>
                <input type="email" className="form-control"
                  value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
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
              <button disabled={loading} className="btn btn-primary w-100">
                {loading ? "Жүктелуде..." : "Тіркелу"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

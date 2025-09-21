import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { verifyUser } from "../api/auth";

export default function VerifyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = (location.state as any)?.email || "";
  const [code, setCode] = useState("");

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await verifyUser(email, code);
      alert("Аккаунт расталды ✅");
      navigate("/login");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Қате код");
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card p-4 shadow">
            <h2 className="text-center mb-4">Email тексеру</h2>
            <p className="mb-3 text-muted">Код {email} поштасына жіберілді</p>
            <form onSubmit={handleVerify}>
              <div className="mb-3">
                <label>Код</label>
                <input type="text" className="form-control"
                  value={code} onChange={(e) => setCode(e.target.value)} required />
              </div>
              <button className="btn btn-success w-100">Растау</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

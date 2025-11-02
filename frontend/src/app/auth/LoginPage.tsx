import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../api/authStore";

const css = `
:root{
  --bg: #f5f7fb; --ink:#0f172a; --muted:#6b7280;
  --paper:#ffffff; --line:#e5e7eb;
  --brand:#3b82f6; --brand2:#8b5cf6;
  --ring: rgba(59,130,246,.45); --shadow: 0 12px 30px rgba(15,23,42,.10);
}
*{box-sizing:border-box} html,body,#root{height:100%}
body{
  margin:0;
  background:
    radial-gradient(1200px 800px at -10% -10%, #e8eefc 0%, transparent 60%) no-repeat,
    radial-gradient(900px 700px at 110% 10%, #ede9fe 0%, transparent 60%) no-repeat,
    var(--bg);
  color:var(--ink);
  font-family: ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;
}
a{color:var(--brand)}
.auth{min-height:100vh; display:grid; place-items:center; padding:32px 16px}
.card{
  width:100%; max-width:460px; padding:28px; border-radius:20px;
  background: var(--paper); border:1px solid var(--line); box-shadow: var(--shadow);
  animation: in .45s ease both;
}
@keyframes in{from{opacity:0; transform: translateY(10px) scale(.98)} to{opacity:1; transform:none}}

.brand{display:flex; align-items:center; gap:12px; margin-bottom:12px}
.logo{
  width:40px; height:40px; border-radius:12px; display:grid; place-items:center; color:white;
  background: linear-gradient(135deg, var(--brand), var(--brand2));
  box-shadow:0 8px 22px rgba(59,130,246,.25);
}
.h1{font-size:18px; margin:0}
.title{font-size:24px; margin:10px 0 4px}
.sub{margin:0 0 16px; color:var(--muted); font-size:14px}

.form{display:grid; gap:14px; margin-top:4px}
.row{display:flex; gap:12px; align-items:center; justify-content:space-between}
.input{
  display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:12px;
  border:1px solid var(--line); background:#fafbff;
  transition:border .2s, box-shadow .2s, transform .06s;
}
.input:focus-within{border-color: var(--brand); box-shadow:0 0 0 4px var(--ring); transform: translateY(-1px)}
.input input{width:100%; background:transparent; border:none; outline:none; color:var(--ink); font-size:14.5px}
.icon{opacity:.9; color:#64748b}
.btn{
  appearance:none; border:none; cursor:pointer; border-radius:12px; padding:12px 16px; font-weight:600;
  background:linear-gradient(135deg, var(--brand), var(--brand2)); color:white;
  box-shadow:0 12px 28px rgba(59,130,246,.25); transition:transform .06s,filter .2s,box-shadow .2s;
}
.btn:hover{filter:brightness(1.06); box-shadow:0 16px 32px rgba(59,130,246,.3)}
.btn:active{transform:translateY(1px)}
.helper{color:var(--muted); font-size:13px; text-align:center}
.footer{margin-top:12px; text-align:center; color:var(--muted); font-size:13px}
.err{color:#ef4444; font-size:12.5px; margin-top:-6px}
.meta{color:var(--muted); font-size:12px; text-align:right; margin-top:-4px}
.spinner{width:16px; height:16px; border-radius:50%; border:2px solid rgba(255,255,255,.45); border-top-color:#fff; animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

.capbox{
  display:flex; align-items:center; gap:8px; color:#92400e; background:#fff7ed; border:1px solid #fed7aa;
  border-radius:10px; padding:8px 10px; font-size:12.5px;
}
.eye{cursor:pointer; display:grid; place-items:center}
.tip{color:var(--muted); font-size:12.5px; text-align:center; margin-top:8px}
.token{display:inline-flex; align-items:center; gap:6px; background:#eef2ff; color:#3730a3; padding:6px 10px; border-radius:999px; border:1px solid #e2e8f0; font-size:12px}
`;

function UserIcon(){
  return <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M5 20c1.5-3.5 5-4.5 7-4.5s5.5 1 7 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>;
}
function LockIcon(){
  return <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M7 10V8a5 5 0 1 1 10 0v2" stroke="currentColor" strokeWidth="1.6"/>
    <rect x="5" y="10" width="14" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.6"/>
  </svg>;
}
function EyeIcon({open}:{open:boolean}){
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M2 12s3.5-6 10-6c2.2 0 4.1.6 5.6 1.4" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M22 12s-3.5 6-10 6c-2.2 0-4.1-.6-5.6-1.4" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6"/>
    </svg>
  );
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [caps, setCaps] = useState(false);

  const pwRef = useRef<HTMLInputElement|null>(null);
  const userRef = useRef<HTMLInputElement|null>(null);

  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const valid = username.trim().length >= 3 && password.length >= 4;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    const ok = await login(username.trim(), password);
    setLoading(false);
    if (ok) {
      // ТАЛАП БОЙЫНША: логин сәтті болса — әрқашан /home бетіне өтеміз
      navigate("/home", { replace: true });
    }
  };

  // === SMART-PASTE ===
  const onUserPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const t = e.clipboardData.getData("text").trim();
    const m = t.match(/^(.+?)[\s:\t\r\n]+(.+)$/);
    if (m) {
      e.preventDefault();
      setUsername(m[1].trim());
      setPassword(m[2]);
      requestAnimationFrame(() => pwRef.current?.focus());
    }
  };

  const onPwKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isCaps = (e as any).getModifierState?.("CapsLock");
    if (typeof isCaps === "boolean") setCaps(isCaps);
  };

  const holdStart = () => setShow(true);
  const holdEnd   = () => setShow(false);

  return (
    <div className="auth">
      <style>{css}</style>

      <div className="card" role="form" aria-labelledby="login-title">
        <div className="brand">
          <div className="logo">🔐</div>
          <h1 className="h1">Easy • Auth</h1>
        </div>

        <h2 id="login-title" className="title">Кіру</h2>
        <p className="sub">
          Аккаунтыңызға кіріңіз. Егер аккаунтыңыз болмаса — <Link to="/register">тіркеліңіз</Link>.
        </p>

        <form onSubmit={onSubmit} className="form">
          <label className="input" aria-label="Username">
            <UserIcon/>
            <input
              ref={userRef}
              autoFocus
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
              onPaste={onUserPaste}
              minLength={3}
              required
            />
          </label>

          <label className="input" aria-label="Password">
            <LockIcon/>
            <input
              ref={pwRef}
              placeholder="Құпия сөз"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              onKeyDown={onPwKey}
              onKeyUp={onPwKey}
              minLength={4}
              required
            />
            <span
              className="eye"
              title="Көрсету үшін басып тұрыңыз"
              onMouseDown={holdStart} onMouseUp={holdEnd} onMouseLeave={holdEnd}
              onTouchStart={holdStart} onTouchEnd={holdEnd}
            >
              <EyeIcon open={show}/>
            </span>
          </label>

          <div className="row">
            <span className="meta">
              {caps ? <span className="capbox">CapsLock қосулы</span> : "Кеңес: CapsLock өшірулі ме?"}
            </span>
            <Link to="/forgot" className="helper">Құпия сөзді ұмыттым</Link>
          </div>

          <button className="btn" type="submit" disabled={!valid || loading} aria-busy={loading}>
            {loading ? <span className="spinner" /> : "Кіру"}
          </button>

          <div className="footer">
            Жаңа пайдаланушысыз ба? <Link to="/register">Аккаунт жасау</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

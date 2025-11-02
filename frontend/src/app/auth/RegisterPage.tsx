import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../api/authStore";

const css = `
:root{
  --bg: #f5f7fb; --paper: #ffffff; --ink:#0f172a; --muted:#6b7280;
  --line:#e5e7eb; --brand:#3b82f6; --brand2:#8b5cf6; --ok:#10b981; --warn:#f59e0b; --bad:#ef4444;
  --ring: rgba(59,130,246,.45); --shadow: 0 12px 30px rgba(15,23,42,.10);
}
*{box-sizing:border-box} html,body,#root{height:100%}
body{margin:0;background:
  radial-gradient(1200px 800px at -10% -10%, #e8eefc 0%, transparent 60%) no-repeat,
  radial-gradient(900px 700px at 110% 10%, #ede9fe 0%, transparent 60%) no-repeat,
  var(--bg);
  color:var(--ink); font-family: ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial}
a{color:var(--brand)}
.auth{min-height:100vh; display:grid; place-items:center; padding:32px 16px}
.wrap{width:100%; max-width:1000px; display:grid; gap:22px; grid-template-columns:1.1fr .9fr}
@media (max-width: 900px){ .wrap{grid-template-columns:1fr} }
.card{background:var(--paper); border:1px solid var(--line); border-radius:20px; box-shadow:var(--shadow); padding:26px}
.header{display:flex; align-items:center; justify-content:space-between; margin-bottom:8px}
.brand{display:flex; align-items:center; gap:12px}
.logo{width:40px; height:40px; border-radius:12px; display:grid; place-items:center;
      background:linear-gradient(135deg, var(--brand), var(--brand2)); color:white;
      box-shadow:0 8px 22px rgba(59,130,246,.25)}
.title{font-size:22px; margin:6px 0 2px}
.sub{margin:0; color:var(--muted); font-size:14px}
.form{display:grid; gap:14px; margin-top:10px}
.input{display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:12px;
       border:1px solid var(--line); background:#fafbff; transition: border .2s, box-shadow .2s, transform .06s}
.input:focus-within{border-color: var(--brand); box-shadow:0 0 0 4px var(--ring); transform: translateY(-1px)}
.input input{width:100%; background:transparent; border:none; outline:none; color:var(--ink); font-size:14.5px}
.icon{opacity:.9; color:#64748b}
.row{display:flex; gap:12px; align-items:center; justify-content:space-between}
.note{color:var(--muted); font-size:12.5px}
.helper{font-size:13px}
.err{color:var(--bad); font-size:12.5px; margin-top:-6px}
.btn{appearance:none; border:none; cursor:pointer; border-radius:12px; padding:12px 16px; font-weight:600;
     background:linear-gradient(135deg, var(--brand), var(--brand2)); color:white;
     box-shadow:0 12px 28px rgba(59,130,246,.25); transition:transform .06s,filter .2s,box-shadow .2s}
.btn:hover{filter:brightness(1.06); box-shadow:0 16px 32px rgba(59,130,246,.3)}
.btn:active{transform:translateY(1px)}
.btn[disabled]{opacity:.6; filter:grayscale(15%); cursor:not-allowed}
.spinner{width:16px; height:16px; border-radius:50%; border:2px solid rgba(255,255,255,.45); border-top-color:#fff; animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

.strength{display:flex; gap:6px; margin-top:-4px}
.bar{height:6px; flex:1; border-radius:6px; background:#eef2ff}
.bar.f1{background:#fecaca}.bar.f2{background:#fde68a}.bar.f3{background:#bbf7d0}.bar.f4{background:#86efac}

/* Profile Preview */
.preview{position:relative; overflow:hidden}
.preview-head{display:flex; align-items:center; justify-content:space-between; margin-bottom:16px}
.preview-title{font-size:18px; margin:0}
.preview-sub{margin:0; color:var(--muted); font-size:13px}
.preview-card{position:relative; border:1px solid var(--line); border-radius:18px; padding:18px; background:
              linear-gradient(180deg, #ffffff, #f8faff)}
.preview-row{display:flex; align-items:center; gap:14px}
.avatar{width:56px; height:56px; border-radius:14px; display:grid; place-items:center; color:white; font-weight:700; font-size:20px;
        background:linear-gradient(135deg, #60a5fa, #a78bfa); box-shadow:0 10px 24px rgba(99,102,241,.25)}
.preview-name{margin:0; font-weight:700; font-size:16px}
.preview-mail{margin:2px 0 0; font-size:13px; color:#475569}
.badge{margin-left:auto; font-size:12px; padding:6px 10px; border-radius:999px; color:#0f766e; background:#ccfbf1; border:1px solid #99f6e4}
.skeleton{opacity:.5}
.tip{margin-top:12px; color:var(--muted); font-size:12.5px}
.token{display:inline-flex; align-items:center; gap:6px; background:#eef2ff; color:#3730a3; padding:6px 10px; border-radius:999px; border:1px solid #e2e8f0; font-size:12px}
.kbd{background:#f1f5f9; border:1px solid #e2e8f0; padding:2px 6px; border-radius:6px; font-size:12px}
`;

/* Icons */
function MailIcon(){ return (
  <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);}
function UserIcon(){ return (
  <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M5 20c1.5-3.5 5-4.5 7-4.5s5.5 1 7 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);}
function LockIcon(){ return (
  <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M7 10V8a5 5 0 1 1 10 0v2" stroke="currentColor" strokeWidth="1.6"/>
    <rect x="5" y="10" width="14" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.6"/>
  </svg>
);}
function EyeIcon({open}:{open:boolean}){ return open ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{cursor:'pointer'}}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" stroke="currentColor" strokeWidth="1.6"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6"/>
  </svg>
) : (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{cursor:'pointer'}}>
    <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M2 12s3.5-6 10-6c2.2 0 4.1.6 5.6 1.4" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M22 12s-3.5 6-10 6c-2.2 0-4.1-.6-5.6-1.4" stroke="currentColor" strokeWidth="1.6"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6"/>
  </svg>
);}

/* Small helpers */
function initialFrom(username: string, email: string){
  const src = (username?.trim() || email?.split("@")[0] || "").trim();
  const ch = src ? src[0] : "U";
  return ch.toUpperCase();
}
function hueFrom(str: string){
  let h = 0;
  for (let i=0;i<str.length;i++) h = (h*31 + str.charCodeAt(i)) % 360;
  return h;
}

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  // Қарапайым пароль күшін есептеу
  const score = useMemo(() => {
    let s = 0;
    if (pw.length >= 6) s++;
    if (/[A-ZА-Я]/.test(pw) && /[a-zа-я]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }, [pw]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const usernameOk = username.trim().length >= 3;
  const pwOk = score >= 2; // орташадан жоғары
  const valid = emailOk && usernameOk && pwOk;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    const ok = await register(email.trim(), username.trim(), pw);
    setLoading(false);
    if (ok) navigate("/verify", { state: { email } });
  };

  // Live preview data
  const initials = initialFrom(username, email);
  const hue = hueFrom(username || email || "user");
  const gradA = `hsl(${hue}, 85%, 60%)`;
  const gradB = `hsl(${(hue+40)%360}, 85%, 60%)`;

  return (
    <div className="auth">
      <style>{css}</style>

      <div className="wrap">
        {/* LEFT: Registration form */}
        <section className="card" role="form" aria-labelledby="reg-title">
          <div className="header">
            <div className="brand">
              <div className="logo">✨</div>
              <div>
                <div style={{fontWeight:700}}>Easy • Registration</div>
                <div className="token" title="Келесі қадам – профиль">
                  Next: Profile
                </div>
              </div>
            </div>
            <Link to="/login" className="helper">Кіру</Link>
          </div>

          <h2 id="reg-title" className="title">Аккаунт ашу</h2>
          <p className="sub">Email арқылы растаймыз. Тез және қауіпсіз.</p>

          <form onSubmit={onSubmit} className="form" noValidate>
            <label className="input" aria-label="Email">
              <MailIcon/>
              <input
                type="email"
                placeholder="Email (код осы жерге келеді)"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                required
                aria-invalid={email.length>0 && !emailOk}
              />
            </label>
            {!emailOk && email.length > 0 && <div className="err">Email форматы дұрыс емес</div>}

            <label className="input" aria-label="Username">
              <UserIcon/>
              <input
                placeholder="Username (ең аз 3 әріп)"
                value={username}
                onChange={(e) => setUsername(e.currentTarget.value)}
                minLength={3}
                required
                aria-invalid={username.length>0 && !usernameOk}
              />
            </label>
            {!usernameOk && username.length > 0 && <div className="err">Username тым қысқа</div>}

            <label className="input" aria-label="Password">
              <LockIcon/>
              <input
                type={show ? "text" : "password"}
                placeholder="Құпия сөз"
                value={pw}
                onChange={(e) => setPw(e.currentTarget.value)}
                required
              />
              <span onClick={() => setShow(v => !v)} title={show ? "Жасыру" : "Көру"}>
                <EyeIcon open={show}/>
              </span>
            </label>

            <div className="strength" aria-hidden>
              <div className={`bar ${score>=1?'f1':''}`}/>
              <div className={`bar ${score>=2?'f2':''}`}/>
              <div className={`bar ${score>=3?'f3':''}`}/>
              <div className={`bar ${score>=4?'f4':''}`}/>
            </div>

            <div className="row">
              <span className="note">
                Кеңес: <span className="kbd">6+</span> таңба, <span className="kbd">Aa</span> әріптер, <span className="kbd">0-9</span> сан және символ.
              </span>
              <Link to="/login" className="helper">Кіру</Link>
            </div>

            <button className="btn" type="submit" disabled={!valid || loading} aria-busy={loading}>
              {loading ? <span className="spinner" /> : "Тіркелу"}
            </button>
          </form>
        </section>

        {/* RIGHT: Live Profile Preview */}
        <aside className="card preview" aria-live="polite">
          <div className="preview-head">
            <div>
              <h3 className="preview-title">Профиль алдын ала көрінісі</h3>
              <p className="preview-sub">Келесі қадамда дәл осылай көрінеді.</p>
            </div>
            <span className="badge">Draft</span>
          </div>

          <div className="preview-card">
            <div className="preview-row">
              <div className="avatar" style={{background:`linear-gradient(135deg, ${gradA}, ${gradB})`}}>
                {initials}
              </div>
              <div>
                <p className={`preview-name ${!username ? 'skeleton':''}`}>
                  {username || "Your Name"}
                </p>
                <p className={`preview-mail ${!email ? 'skeleton':''}`}>
                  {email || "your@email.com"}
                </p>
              </div>
            </div>
            <div className="tip">
              Атын/Email-ды өзгерткен сайын алдын ала көрініс те жаңарады.
              Профиль бетінде {` `}
              <span className="kbd">Аты</span> және <span className="kbd">Email</span> дәл осы стильде көрсетіледі.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

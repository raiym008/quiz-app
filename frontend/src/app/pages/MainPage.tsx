import { useState } from "react";
import { useAuthStore } from "../api/authStore";
import { useNavigate } from "react-router-dom";
import { LogIn, UserPlus, ChevronRight} from "lucide-react";

export default function MainPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [pinCode, setPinCode] = useState("");
  const [isAuthSheetOpen, setIsAuthSheetOpen] = useState(false);

  const handleJoinQuiz = () => {
    if (pinCode.length !== 6) return;
    navigate(`/iquiz/room/${pinCode}`);
  };

  const handleLogout = () => {
    localStorage.removeIte("access_token");
    window.location.reload();
  };

  return (
    <>
      {/* === iOS SAFE AREA === */}
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900 flex flex-col supports-[padding-top:env(safe-area-inset-top)]:pt-[env(safe-area-inset-top)]">
        
        {/* === HEADER: iOS Navigation Bar === */}
        <header className="flex items-center justify-between px-5 h-12 bg-white/80 backdrop-blur-xl border-b border-gray-200 sticky top-0 z-50">
          <h1 className="text-xl font-bold text-blue-600 tracking-tight">
            EASYAPP
          </h1>

          {user ? (
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2 px-3 py-1.5 bg-system-gray-100 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-200 transition-all duration-150 active:scale-95"
            >
              <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {user.username[0].toUpperCase()}
              </div>
              <span className="hidden sm:inline">{user.username}</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAuthSheetOpen(true)}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-150"
            >
              Кіру
            </button>
          )}
        </header>

        {/* === MAIN: PIN ENTRY – FULL FOCUS === */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
          <div className="w-full max-w-xs space-y-8">
            
            {/* Заголовок – Large Title */}
            <h2 className="text-4xl font-bold text-center text-gray-900 leading-tight">
              Ойынға қосылу
            </h2>

            {/* PIN Input – iOS Password Style */}
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={6}
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="______"
                className="w-full text-center text-5xl font-mono tracking-widest p-5 bg-white rounded-2xl shadow-sm border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all duration-200 placeholder:text-gray-300"
                autoFocus
              />
              {pinCode.length === 6 && (
                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-blue-600" />
              )}
            </div>

            {/* Primary Action Button – iOS "Continue" */}
            <button
              onClick={handleJoinQuiz}
              disabled={pinCode.length !== 6}
              className={`w-full h-14 rounded-full font-semibold text-lg transition-all duration-200 shadow-md flex items-center justify-center gap-2 ${
                pinCode.length === 6
                  ? "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed"
              }`}
            >
              {pinCode.length === 6 ? (
                <>Кіру <ChevronRight className="w-5 h-5" /></>
              ) : (
                "PIN-кодты енгізіңіз"
              )}
            </button>

            {/* Secondary Actions */}
            <div className="text-center space-y-4 pt-4">
              <p className="text-sm text-gray-500">
                Жаңа ойын құрғыңыз келе ме?
              </p>
              {user ? (
                <button
                  onClick={handleLogout}
                  className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                >
                  Шығу
                </button>
              ) : (
                <div className="flex justify-center gap-8">
                  <button
                    onClick={() => { setIsAuthSheetOpen(true); navigate("/login"); }}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    <LogIn className="w-4 h-4" />
                    Кіру
                  </button>
                  <button
                    onClick={() => { setIsAuthSheetOpen(true); navigate("/register"); }}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Тіркелу
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* === FOOTER: iOS Status Bar Style === */}
        <footer className="py-3 text-center text-xs text-gray-400 bg-white/70 backdrop-blur-sm border-t border-gray-200">
          © 2025 Easy Project • Raim
        </footer>
      </div>

      {/* === BOTTOM SHEET: iOS Action Sheet === */}
      {isAuthSheetOpen && !user && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end" onClick={() => setIsAuthSheetOpen(false)}>
          <div
            className="w-full bg-white rounded-t-3xl p-6 shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grabber */}
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5" />

            <h3 className="text-xl font-semibold text-center mb-6">Аккаунт</h3>

            <button
              onClick={() => { navigate("/login"); setIsAuthSheetOpen(false); }}
              className="w-full h-12 mb-3 bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <LogIn className="w-5 h-5" /> Кіру
            </button>

            <button
              onClick={() => { navigate("/register"); setIsAuthSheetOpen(false); }}
              className="w-full h-12 bg-gray-100 text-gray-800 rounded-xl font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <UserPlus className="w-5 h-5" /> Тіркелу
            </button>

            <button
              onClick={() => setIsAuthSheetOpen(false)}
              className="mt-5 text-sm text-gray-500 font-medium"
            >
              Болдырмау
            </button>
          </div>
        </div>
      )}
    </>
  );
}
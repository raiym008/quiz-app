import { useAuthStore } from "../api/authStore";
import { useNavigate } from "react-router-dom";
import {
  LogIn,
  ArrowRight,
  FileText,
  Edit3,
  PlayCircle,
  Users,
} from "lucide-react";

export default function MainPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const uid = localStorage.getItem("user_id");

  const goToDashboard = () => {
    if (uid) navigate(`/u/${uid}`);
    else navigate("/login");
  };

  const handleStart = () => {
    if (user && uid) goToDashboard();
    else navigate("/register");
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* HEADER */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          {/* LOGО */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-3 group"
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-sky-200 group-hover:bg-sky-300 transition-all blur-sm opacity-80" />
              <div className="relative w-9 h-9 rounded-2xl bg-white border border-sky-400/70 flex items-center justify-center text-sky-600 font-extrabold text-xl shadow-sm">
                e
              </div>
            </div>
            <div className="leading-tight text-left">
              <div className="font-extrabold text-lg tracking-tight text-slate-900">
                Easy
              </div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                сұрақ & тест онлайн платформасы
              </div>
            </div>
          </button>

          {/* NAV (desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600">
            <button
              onClick={() => scrollTo("about")}
              className="hover:text-sky-600 transition-colors"
            >
              Easy деген не?
            </button>
            <button
              onClick={() => scrollTo("for-whom")}
              className="hover:text-sky-600 transition-colors"
            >
              Кімдер қолданады
            </button>
            <button
              onClick={() => scrollTo("features")}
              className="hover:text-sky-600 transition-colors"
            >
              Мүмкіндіктер
            </button>
            <button
              onClick={() => scrollTo("process")}
              className="hover:text-sky-600 transition-colors"
            >
              Қалай жұмыс істейді
            </button>
            <button
              onClick={() => scrollTo("contact")}
              className="hover:text-sky-600 transition-colors"
            >
              Байланыс
            </button>
          </nav>

          {/* AUTH / CTA */}
          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={goToDashboard}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-600 text-white text-sm font-semibold shadow-sm hover:bg-sky-500 active:scale-95 transition"
              >
                Платформаға өту
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate("/login")}
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-sky-600 transition"
                >
                  <LogIn className="w-4 h-4" />
                  Кіру
                </button>
                <button
                  onClick={handleStart}
                  className="px-4 py-2.5 rounded-full bg-sky-600 text-white text-xs sm:text-sm font-semibold shadow-sm hover:bg-sky-500 active:scale-95 transition"
                >
                  Тіркеліп көру
                </button>
              </>
            )}
          </div>
        </div>

        {/* NAV (mobile) */}
        <div className="md:hidden mx-auto max-w-6xl px-4 pb-2 flex gap-2 overflow-x-auto text-[11px] text-slate-700">
          <button
            onClick={() => scrollTo("about")}
            className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200"
          >
            Easy
          </button>
          <button
            onClick={() => scrollTo("for-whom")}
            className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200"
          >
            Кімдерге
          </button>
          <button
            onClick={() => scrollTo("features")}
            className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200"
          >
            Мүмкіндіктер
          </button>
          <button
            onClick={() => scrollTo("process")}
            className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200"
          >
            Қадамдар
          </button>
          <button
            onClick={() => scrollTo("contact")}
            className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200"
          >
            Байланыс
          </button>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1">
        {/* HERO */}
        <section className="mx-auto max-w-6xl px-4 pt-10 pb-14 grid gap-10 md:grid-cols-[1.4fr_minmax(0,1fr)] items-center">
          {/* LEFT */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-[11px] font-medium text-sky-700 mb-4">
              Уақытты үнемдеп, оқуды жеңілдететін онлайн платформа
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-slate-900">
              Сұрақ құру,{" "}
              <span className="bg-gradient-to-r from-sky-600 to-cyan-500 bg-clip-text text-transparent">
                тест тапсыру
              </span>{" "}
              — барлығы бір жерде
            </h1>

            <p className="mt-4 text-sm sm:text-base text-slate-600 max-w-xl">
              Easy — мұғалімдерге, студенттерге, оқушыларға, репетиторларға және
              командаларға арналған онлайн құрал. Бір платформада сұрақ-жауап
              құрып, сол тестті онлайн тапсыруға беруге болады.
            </p>

            {/* TAGS */}
            <div className="mt-5 flex flex-wrap gap-2 text-[11px] text-slate-700">
              <span className="px-3 py-1 rounded-full bg-white border border-slate-200">
                Мұғалімдер
              </span>
              <span className="px-3 py-1 rounded-full bg-white border border-slate-200">
                Студенттер мен оқушылар
              </span>
              <span className="px-3 py-1 rounded-full bg-white border border-slate-200">
                Репетиторлар
              </span>
              <span className="px-3 py-1 rounded-full bg-white border border-slate-200">
                Командалар мен клубтар
              </span>
            </div>

            {/* CTA */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={handleStart}
                className="px-6 py-3 rounded-xl bg-sky-600 text-white text-sm sm:text-base font-semibold shadow-sm hover:bg-sky-500 active:scale-95 transition"
              >
                Тіркеліп, тест құру
              </button>
              <button
                onClick={() => scrollTo("process")}
                className="px-6 py-3 rounded-xl bg-white border border-slate-200 text-sm sm:text-base text-slate-800 font-medium hover:bg-slate-50 transition inline-flex items-center gap-2"
              >
                Қалай жұмыс істейді?
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-6 flex items-center gap-2 text-[11px] text-slate-500">
              <span className="h-[1px] w-8 bg-slate-300" />
              Easy туралы толығырақ білу үшін төменге жылжытыңыз
            </div>
          </div>

          {/* RIGHT — "мини-дэшборд" карточкасы */}
          <div className="w-full">
            <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
              <div className="text-sm font-semibold text-slate-900">
                Easy платформасында не істей аласыз?
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="flex gap-3 items-start">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 border border-sky-200">
                    <Edit3 className="w-4 h-4 text-sky-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-[12px] text-slate-900">
                      Сұрақтарды қолмен құру
                    </div>
                    <p className="mt-1">
                      Платформа ішінде өзіңізге керек сұрақтар мен жауап
                      нұсқаларын оңай қосуға болады.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-200">
                    <FileText className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-[12px] text-slate-900">
                      DOCX арқылы автоматты тест
                    </div>
                    <p className="mt-1">
                      Дайын құжаттағы сұрақтарды жүктеп, автоматты түрде тестке
                      айналдыруға болады.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200">
                    <PlayCircle className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-[12px] text-slate-900">
                      Онлайн тапсыру
                    </div>
                    <p className="mt-1">
                      Құрылған тестті сілтеме арқылы бөлісіп, басқа қолданушылар
                      онлайн түрде тапсыра алады.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                Барлығы бір аккаунтта сақталады. Қайта қолдану, өзгерту және
                бөлісу жеңілдейді.
              </div>
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <section id="about" className="mx-auto max-w-6xl px-4 pb-12">
          <div className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-7">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              Easy деген не?
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-4xl">
              Easy — жеке бастама ретінде жасалған онлайн платформа. Негізгі
              мақсат — қолданушылардың уақытын үнемдеп, оқыту мен дайындық
              процесін жеңілдету. Платформа сұрақ-жауап құруды және сол тесттерді
              онлайн тапсыруды бір ортада біріктіреді.
            </p>
          </div>
        </section>

        {/* FOR WHOM */}
        <section id="for-whom" className="mx-auto max-w-6xl px-4 pb-12">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-2xl font-bold text-slate-900">
              Кімдер қолдана алады?
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Users className="w-4 h-4 text-sky-600" />
                Мұғалімдер
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600">
                Бақылау жұмыстары мен тақырыптық тесттерді тез дайындап,
                оқушыларға онлайн тапсыруға бере алады.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Users className="w-4 h-4 text-sky-600" />
                Студенттер мен оқушылар
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600">
                Өзіндік дайындық үшін жеке тесттер құрып, сұрақтарды қайталап,
                өз білімін тексере алады.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Users className="w-4 h-4 text-sky-600" />
                Репетиторлар
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600">
                Әр оқушыға бөлек тест дайындап, бір сілтеме арқылы бөлісуге
                ыңғайлы.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Users className="w-4 h-4 text-sky-600" />
                Командалар
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600">
                Кішігірім командалар не клубтар ішкі тесттер мен викториналар
                ұйымдастыра алады.
              </p>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="mx-auto max-w-6xl px-4 pb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Негізгі мүмкіндіктер
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="p-5 rounded-2xl bg-white border border-slate-200">
              <h3 className="text-sm sm:text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-sky-600" />
                Сұрақтарды қолмен құру
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                Платформа ішінде өзіңізге керек сұрақтар мен жауап нұсқаларын
                қолмен енгізе аласыз. Интерфейс қарапайым әрі түсінікті.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200">
              <h3 className="text-sm sm:text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                DOCX арқылы автоматты құру
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                Дайын DOCX құжатын жүктеп, ішіндегі сұрақтардан автоматты түрде
                тест жасауға мүмкіндік береді. Қолмен көшіруді азайтады.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200">
              <h3 className="text-sm sm:text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-emerald-600" />
                Онлайн тапсыру
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                Құрылған тестті сілтеме арқылы бөлісіп, басқалардың онлайн
                тапсыруына бере аласыз.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200">
              <h3 className="text-sm sm:text-lg font-semibold text-slate-900 mb-2">
                Бір профильде сақтау
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                Барлық тесттеріңіз бір профильде сақталады. Қайта қолдану,
                өзгерту және басқару жеңілдейді.
              </p>
            </div>
          </div>
        </section>

        {/* PROCESS */}
        <section id="process" className="mx-auto max-w-6xl px-4 pb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Қалай жұмыс істейді?
          </h2>
          <div className="grid gap-5 md:grid-cols-3">
            <div className="relative p-5 rounded-2xl bg-white border border-slate-200">
              <div className="absolute -top-4 left-4 h-8 w-8 rounded-full bg-sky-50 border border-sky-300 flex items-center justify-center text-sky-700 text-lg font-bold">
                1
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Тіркелесіз
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-600">
                  Аккаунт ашып, өз профиліңізді қолдануға дайын боласыз.
                </p>
              </div>
            </div>

            <div className="relative p-5 rounded-2xl bg-white border border-slate-200">
              <div className="absolute -top-4 left-4 h-8 w-8 rounded-full bg-sky-50 border border-sky-300 flex items-center justify-center text-sky-700 text-lg font-bold">
                2
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Тест құрасыз
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-600">
                  Сұрақтарды қолмен қосасыз немесе DOCX арқылы автоматты түрде
                  тест жасайсыз.
                </p>
              </div>
            </div>

            <div className="relative p-5 rounded-2xl bg-white border border-slate-200">
              <div className="absolute -top-4 left-4 h-8 w-8 rounded-full bg-sky-50 border border-sky-300 flex items-center justify-center text-sky-700 text-lg font-bold">
                3
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Тапсыруға бересіз
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-600">
                  Тест сілтемесін жіберіп, қолданушылардың онлайн тапсыруына
                  мүмкіндік бересіз.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CONTACT / CTA */}
        <section id="contact" className="mx-auto max-w-6xl px-4 pb-16">
          <div className="rounded-2xl bg-gradient-to-r from-sky-50 to-cyan-50 border border-sky-100 px-6 sm:px-8 py-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Easy-ді қолданып көргіңіз келе ме?
              </h2>
              <p className="text-sm md:text-base text-slate-700 max-w-xl">
                Тіркеліп, өз сұрақтарыңыз бен тесттеріңізді құрып көріңіз.
                Барлығы қарапайым және түсінікті интерфейсте.
              </p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="font-semibold text-slate-900">
                Байланыс поштасы:
              </div>
              <div className="underline underline-offset-2 text-slate-800">
                easyquizkz@gmail.com
              </div>
              <button
                onClick={handleStart}
                className="mt-3 px-5 py-2.5 rounded-xl bg-sky-600 text-white font-semibold text-sm hover:bg-sky-500 active:scale-95 transition inline-flex items-center gap-2"
              >
                Тіркелу бетіне өту
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[11px] text-slate-500">
            © 2025 Easy — сұрақ құру және тест тапсыру онлайн платформасы.
          </p>
        </div>
      </footer>
    </div>
  );
}

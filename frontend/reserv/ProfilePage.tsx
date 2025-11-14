import { useEffect, useMemo, useRef, useState } from "react";
import { useProfileStore } from "../api/profileStore";

export default function ProfilePage() {
  const { me, loading, getMe, updateProfile, uploadAvatar } = useProfileStore();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [hue, setHue] = useState(210); // initials avatar түсі
  const [saving, setSaving] = useState(false);
  const dropRef = useRef<HTMLDivElement | null>(null);

  // Алғашқы жүктеу
  useEffect(() => { getMe(); }, [getMe]);

  // me өзгерсе — форманы толтыру
  useEffect(() => {
    if (!me) return;
    setName(me.name || "");
    setBio(me.bio || "");
    setAvatarUrl(me.avatar_url || undefined);
    // username/email-ға тәуелді default түс
    if (me.username) {
      const h = seedHue(me.username);
      setHue(h);
    }
  }, [me]);

  const initials = useMemo(() => {
    const src = name?.trim() || me?.username || me?.email?.split("@")[0] || "U";
    return src.charAt(0).toUpperCase();
  }, [name, me]);

  const gradient = useMemo(() => {
    const a = `hsl(${hue}, 85%, 60%)`;
    const b = `hsl(${(hue + 40) % 360}, 85%, 60%)`;
    return `linear-gradient(135deg, ${a}, ${b})`;
  }, [hue]);

  const dirty = useMemo(() => (
    name !== (me?.name || "") ||
    bio !== (me?.bio || "") ||
    avatarUrl !== (me?.avatar_url || undefined)
  ), [name, bio, avatarUrl, me]);

  const bioLimit = 160;
  const bioLeft = bioLimit - (bio?.length || 0);

  // Drag & drop avatar
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onDragOver = (e: DragEvent) => { e.preventDefault(); el.classList.add("ring-2", "ring-blue-400"); };
    const onDragLeave = () => el.classList.remove("ring-2", "ring-blue-400");
    const onDrop = async (e: DragEvent) => {
      e.preventDefault(); el.classList.remove("ring-2", "ring-blue-400");
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith("image/")) {
        const url = await uploadAvatar(file);
        if (url) setAvatarUrl(url);
      }
    };
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, [uploadAvatar]);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const url = await uploadAvatar(file);
      if (url) setAvatarUrl(url);
      e.currentTarget.value = "";
    }
  };

  const onSmartFill = () => {
    if (!me?.email) return;
    const proposed = (me.email.split("@")[0] || "").replace(/[._-]/g, " ").trim();
    if (proposed && !name) setName(capitalizeWords(proposed));
  };

  const onRandomize = () => setHue(Math.floor(Math.random() * 360));

  const onCopyLink = async () => {
    const origin = window.location.origin;
    const slug = me?.username || "me";
    const link = `${origin}/u/${slug}`;
    await navigator.clipboard.writeText(link);
    alert("Профиль сілтемесі көшірілді ✅");
  };

  const onSave = async () => {
    if (!dirty || !me) return;
    setSaving(true);
    const ok = await updateProfile({ name: name.trim(), bio: bio.trim(), avatar_url: avatarUrl });
    setSaving(false);
    if (ok) alert("Профиль сақталды ✅");
    else alert("Сақтау кезінде қате пайда болды");
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-gray-100 via-white to-gray-200 p-4">
      <div className="w-full max-w-5xl grid gap-6 md:grid-cols-[320px,1fr]">
        {/* LEFT — Avatar & Quick actions */}
        <aside className="rounded-3xl bg-white border border-gray-200 shadow-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Профиль</h2>

          {/* Avatar Card */}
          <div
            ref={dropRef}
            className="rounded-2xl border border-gray-200 bg-gray-50 p-5 grid place-items-center text-center"
          >
            {avatarUrl ? (
              <div className="relative">
                <img
                  src={avatarUrl}
                  alt="avatar"
                  className="w-28 h-28 rounded-2xl object-cover shadow-md"
                />
                <button
                  onClick={() => setAvatarUrl(undefined)}
                  className="absolute -right-2 -top-2 bg-white border border-gray-200 text-gray-600 text-xs rounded-full px-2 py-1 shadow"
                  title="Фотоны алып тастау"
                >
                  ×
                </button>
              </div>
            ) : (
              <div
                className="w-28 h-28 rounded-2xl grid place-items-center text-white text-2xl font-bold shadow-md"
                style={{ background: gradient }}
                title="Фото жүктемесеңіз — инициалдар қолданылады"
              >
                {initials}
              </div>
            )}

            <div className="mt-4 flex items-center justify-center gap-2">
              <label className="cursor-pointer text-sm text-blue-600 hover:text-blue-500">
                Фото жүктеу
                <input type="file" accept="image/*" onChange={onPickFile} className="hidden" />
              </label>
              <span className="text-gray-400">·</span>
              <button onClick={onRandomize} className="text-sm text-blue-600 hover:text-blue-500">
                Randomize
              </button>
            </div>

            {!avatarUrl && (
              <div className="mt-4 w-full">
                <label className="block text-xs text-gray-500 mb-1">Avatar түсі</label>
                <input
                  type="range"
                  min={0}
                  max={359}
                  value={hue}
                  onChange={(e) => setHue(+e.currentTarget.value)}
                  className="w-full"
                />
              </div>
            )}

            <p className="text-xs text-gray-500 mt-4">
              Суретті бұл блокқа сүйреп тастауға болады (drag & drop).
            </p>
          </div>

          {/* Quick actions */}
          <div className="mt-5 grid gap-2">
            <button
              onClick={onCopyLink}
              className="w-full bg-white border border-gray-200 hover:border-blue-300 text-gray-700 rounded-xl py-2 shadow-sm"
              title="Профиль сілтемесін көшіру"
            >
              Профиль сілтемесін көшіру 🔗
            </button>
            <button
              onClick={onSmartFill}
              disabled={!!name || !me?.email}
              className={`w-full rounded-xl py-2 shadow-sm ${
                name
                  ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                  : "bg-white text-gray-700 border border-gray-200 hover:border-blue-300"
              }`}
              title="Егер аты бос болса — email-ден автомат ұсыну"
            >
              Smart name autofill ✨
            </button>
          </div>
        </aside>

        {/* RIGHT — Form */}
        <section className="rounded-3xl bg-white border border-gray-200 shadow-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Жеке мәліметтер</h3>
              <p className="text-sm text-gray-500">
                {loading ? "Жүктелуде..." : "Атыңызды, био және аватарды баптаңыз."}
              </p>
            </div>
            <button
              onClick={onSave}
              disabled={!dirty || saving}
              className={`px-4 py-2 rounded-xl text-white shadow-md ${
                !dirty || saving ? "bg-blue-300 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"
              }`}
            >
              {saving ? "Сақталуда..." : "Сақтау"}
            </button>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm text-gray-600">Атыңыз (Display Name)</label>
              <input
                placeholder="Мысалы: Raim"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition-all"
              />
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <label className="text-sm text-gray-600">Username</label>
                <input
                  value={me?.username || ""}
                  disabled
                  className="w-full px-4 py-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-700 outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Email</label>
                <input
                  value={me?.email || ""}
                  disabled
                  className="w-full px-4 py-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-700 outline-none"
                />
              </div>
            </div>

            <div className="grid gap-1">
              <label className="text-sm text-gray-600">Bio</label>
              <textarea
                placeholder="Өзіңіз жайлы қысқаша (160 таңба)"
                value={bio}
                onChange={(e) => setBio(e.currentTarget.value.slice(0, bioLimit))}
                rows={4}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition-all resize-none"
              />
              <div className={`text-xs ${bioLeft < 10 ? "text-red-500" : "text-gray-500"}`}>
                Қалды: {bioLeft}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* Helpers */
function seedHue(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}
function capitalizeWords(s: string) {
  return s.split(" ").filter(Boolean).map(w => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

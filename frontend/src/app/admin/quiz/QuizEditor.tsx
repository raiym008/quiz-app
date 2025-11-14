// src/pages/quiz/QuizEditor.tsx

type Props = {
  value: string;                 // Сыртқа берілетін мәтін
  onChange: (text: string) => void;
};

export default function QuizEditor({ value, onChange }: Props) {
  return (
    <div className="rounded-2xl ring-1 ring-slate-200 bg-white">
      {/* Жоғарғы тақырыпша */}
      <div className="px-3 py-2 border-b border-slate-200 rounded-t-2xl bg-white/90">
        <span className="text-sm font-semibold text-slate-800">
          Мәтіндік редактор
        </span>
        <span className="ml-2 text-[11px] text-slate-500">
          Сұрақты немесе жауапты қарапайым мәтінмен жазыңыз
        </span>
      </div>

      {/* Негізгі мәтін алаңы */}
      <div className="p-3">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="
            w-full min-h-[140px]
            rounded-xl
            border border-slate-200
            px-3 py-2
            text-[15px] leading-7
            text-slate-800
            outline-none
            focus:ring-2 focus:ring-sky-500
            focus:border-sky-500
            placeholder:text-slate-400
            resize-vertical
          "
          placeholder="Осында сұрақ мәтінін немесе дұрыс жауапты жазыңыз..."
        />
      </div>
    </div>
  );
}

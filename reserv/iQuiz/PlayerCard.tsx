// src/app/modes/iQuiz/PlayerCard.tsx
import type { Player } from "./types";

export default function PlayerCard({ player }: { player: Player }) {
  return (
    <div className="bg-white/10 rounded-xl p-4 flex flex-col items-center backdrop-blur shadow hover:bg-white/15 transition">
      <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
        {player.avatar ? (
          <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl">🎓</span>
        )}
      </div>
      <p className="mt-2 text-base font-medium">{player.name}</p>
    </div>
  );
}

import { useState, useEffect } from "react";
import { UNIFIED } from "./unified.config";

export default function UnifiedOverallLeaderboard() {
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const me = (() => {
    try {
      return (
        JSON.parse(
          localStorage.getItem("jambite_user") || "{}",
        ).username?.toLowerCase() || ""
      );
    } catch {
      return "";
    }
  })();

  const load = () => {
    fetch(`${UNIFIED.API_BASE}/api/unified/leaderboard/overall`)
      .then((r) => r.json())
      .then((d) => {
        setBoard(d.leaderboard || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // auto-refresh every 15s
    return () => clearInterval(t);
  }, []);

  if (loading)
    return (
      <div className="bg-[#121A2E] border border-white/10 rounded-[20px] p-4 text-center text-slate-400 text-[13px]">
        🏆 Loading overall leaderboard...
      </div>
    );
  if (!board.length)
    return (
      <div className="bg-[#121A2E] border border-white/10 rounded-[20px] p-4 text-center text-slate-400 text-[13px]">
        No scores yet. Be the FIRST to top the board!
      </div>
    );

  return (
    <div className="bg-[#121A2E]/80 border border-amber-400/20 rounded-[20px] p-4 mb-5">
      <div className="flex justify-between items-center">
        <h3 className="font-black text-[15px]">🏆 OVERALL LEADERBOARD</h3>
        <span className="text-[11px] bg-amber-400/15 text-amber-300 px-2.5 py-1 rounded-full font-bold">
          {board.length} Players • All Tests
        </span>
      </div>
      <p className="text-[11px] text-slate-400 mt-1">
        Ranked by total score across ALL Unified Tests. Updates every 15s.
      </p>

      <div className="space-y-1.5 mt-3">
        {board.slice(0, 20).map((b) => {
          const isMe = b.username?.toLowerCase() === me;
          const isTop1 = b.rank === 1;
          const isTop2 = b.rank === 2;
          return (
            <div
              key={b.username}
              className={`relative flex items-center gap-2 px-3 py-2.5 rounded-xl border ${
                isTop1
                  ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-black border-amber-300 font-black shadow-[0_0_30px_rgba(251,191,36,0.5)]"
                  : isTop2
                    ? "bg-gradient-to-r from-slate-300 to-slate-500 text-black border-slate-300 font-black"
                    : isMe
                      ? "bg-amber-400 text-black border-amber-400 font-black"
                      : "bg-white/5 border-white/5"
              }`}
            >
              <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-[16px] font-black shrink-0">
                {isTop1 ? "👑" : isTop2 ? "🥈" : b.rank === 3 ? "🥉" : b.rank}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold truncate flex items-center gap-1 flex-wrap">
                  @{b.username} {isMe ? "(You)" : ""}
                  {isTop1 && (
                    <span className="text-[10px] bg-black text-amber-400 px-1.5 py-0.5 rounded-full">
                      👑 CHAMPION
                    </span>
                  )}
                  {isTop2 && (
                    <span className="text-[10px] bg-black text-slate-200 px-1.5 py-0.5 rounded-full">
                      ⚔️ VICE-CHAMPION
                    </span>
                  )}
                </p>
                <p
                  className={`text-[11px] truncate ${
                    isTop1 || isTop2 || isMe
                      ? "text-black/70"
                      : "text-slate-400"
                  }`}
                >
                  {b.fullName} • {b.testsPlayed} test
                  {b.testsPlayed > 1 ? "s" : ""} played
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[14px] font-black">
                  {b.totalScore}/{b.totalPossible}
                </p>
                <p
                  className={`text-[10px] font-bold ${
                    isTop1 || isTop2 || isMe
                      ? "text-black/70"
                      : "text-emerald-400"
                  }`}
                >
                  {isTop1 ? "👑 " : isTop2 ? "🥈 " : ""}
                  {b.percent}% avg
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

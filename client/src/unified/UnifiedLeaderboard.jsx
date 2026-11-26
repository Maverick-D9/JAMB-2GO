// client/src/unified/UnifiedLeaderboard.jsx
import { useState, useEffect } from "react";
import { UNIFIED } from "./unified.config";

function getCurrentUsername() {
  try {
    const raw = localStorage.getItem("jambite_user");
    if (raw) return JSON.parse(raw).username || "";
  } catch {}
  return localStorage.getItem("username") || "";
}

const MEDALS = ["🥇", "🥈", "🥉"];
const PODIUM_STYLE = [
  "bg-gradient-to-b from-amber-400 to-yellow-600 text-black scale-105 z-10 shadow-[0_0_40px_rgba(251,191,36,0.4)]",
  "bg-gradient-to-b from-slate-300 to-slate-500 text-black",
  "bg-gradient-to-b from-orange-400 to-amber-700 text-black",
];
const PODIUM_HEIGHT = ["h-[110px]", "h-[80px]", "h-[65px]"];

export default function UnifiedLeaderboard({
  testId,
  testTitle,
  compact = false,
}) {
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const me = getCurrentUsername()?.toLowerCase();

  useEffect(() => {
    if (!testId) return;
    const load = () => {
      fetch(`${UNIFIED.API_BASE}/api/unified/tests/${testId}/leaderboard`)
        .then((r) => r.json())
        .then((d) => {
          setBoard(d.leaderboard || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    };
    setLoading(true);
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [testId]);

  if (loading)
    return (
      <div className="bg-[#121A2E] border border-white/10 rounded-[20px] p-4 text-center text-slate-400 text-[13px]">
        🏆 Loading leaderboard...
      </div>
    );
  if (!board.length)
    return (
      <div className="bg-[#121A2E] border border-white/10 rounded-[20px] p-4 text-center">
        <p className="text-[20px]">🏆</p>
        <p className="text-slate-400 text-[13px] mt-1">
          No scores yet. Be the FIRST to top the board!
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          Finish the test, your name go appear here.
        </p>
      </div>
    );

  const top3 = board.slice(0, 3);
  const rest = board.slice(3);
  const myEntry = board.find((b) => b.username?.toLowerCase() === me);
  const showBoard = compact ? board.slice(0, 10) : board;

  return (
    <div className="bg-[#121A2E]/80 border border-amber-400/20 rounded-[20px] p-4 mt-4 overflow-hidden relative">
      {/* Glow */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-[300px] h-[100px] bg-amber-400/20 blur-[40px] rounded-full pointer-events-none" />

      <div className="flex justify-between items-center relative">
        <h3 className="font-black text-[15px]">🏆 LEADERBOARD</h3>
        <span className="text-[11px] bg-amber-400/15 text-amber-300 px-2.5 py-1 rounded-full font-bold">
          {board.length} Players
        </span>
      </div>
      {testTitle && (
        <p className="text-[11px] text-slate-400 mt-0.5">{testTitle}</p>
      )}

      {/* MY RANK BANNER - if I don do am */}
      {myEntry && (
        <div className="mt-3 bg-gradient-to-r from-amber-400 to-yellow-500 text-black rounded-xl px-3 py-2.5 flex justify-between items-center">
          <span className="font-black text-[13px]">
            👤 You — @{myEntry.username}
          </span>
          <span className="font-black text-[13px]">
            #{myEntry.rank} • {myEntry.score}/{myEntry.total} ({myEntry.percent}
            %)
          </span>
        </div>
      )}

      {/* PODIUM - Top 3 */}
      <div className="flex items-end justify-center gap-2 mt-5 relative">
        {/* 2nd */}
        {top3[1] && (
          <div className="flex-1 flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-slate-300 border-2 border-white flex items-center justify-center font-black text-[13px] text-black">
              {(
                top3[1].fullName?.[0] ||
                top3[1].username?.[0] ||
                "?"
              ).toUpperCase()}
            </div>
            <p className="text-[12px] font-bold mt-1 truncate max-w-[80px]">
              @{top3[1].username}
            </p>
            <p className="text-[11px] text-slate-400 truncate max-w-[80px]">
              {top3[1].fullName}
            </p>
            <p className="text-[11px] font-black text-amber-300">
              {top3[1].score}/{top3[1].total}
            </p>
            <div
              className={`w-full ${PODIUM_HEIGHT[1]} ${PODIUM_STYLE[1]} rounded-t-xl flex flex-col items-center justify-center mt-1`}
            >
              <span className="text-[20px]">🥈</span>
              <span className="font-black text-[18px]">2</span>
            </div>
          </div>
        )}
        {/* 1st - King */}
        {top3[0] && (
          <div className="flex-1 flex flex-col items-center -mt-3">
            <span className="text-[22px] animate-bounce">👑</span>
            <div className="w-12 h-12 rounded-full bg-amber-400 border-[3px] border-white flex items-center justify-center font-black text-black shadow-lg">
              {(
                top3[0].fullName?.[0] ||
                top3[0].username?.[0] ||
                "?"
              ).toUpperCase()}
            </div>
            <p className="text-[13px] font-black mt-1 truncate max-w-[90px]">
              @{top3[0].username}
            </p>
            <p className="text-[11px] text-slate-300 truncate max-w-[90px]">
              {top3[0].fullName}
            </p>
            <p className="text-[12px] font-black text-amber-300">
              {top3[0].score}/{top3[0].total} • {top3[0].percent}%
            </p>
            <div
              className={`w-full ${PODIUM_HEIGHT[0]} ${PODIUM_STYLE[0]} rounded-t-xl flex flex-col items-center justify-center mt-1`}
            >
              <span className="text-[22px]">🥇</span>
              <span className="font-black text-[22px]">1</span>
            </div>
          </div>
        )}
        {/* 3rd */}
        {top3[2] && (
          <div className="flex-1 flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-orange-400 border-2 border-white flex items-center justify-center font-black text-[13px] text-black">
              {(
                top3[2].fullName?.[0] ||
                top3[2].username?.[0] ||
                "?"
              ).toUpperCase()}
            </div>
            <p className="text-[12px] font-bold mt-1 truncate max-w-[80px]">
              @{top3[2].username}
            </p>
            <p className="text-[11px] text-slate-400 truncate max-w-[80px]">
              {top3[2].fullName}
            </p>
            <p className="text-[11px] font-black text-amber-300">
              {top3[2].score}/{top3[2].total}
            </p>
            <div
              className={`w-full ${PODIUM_HEIGHT[2]} ${PODIUM_STYLE[2]} rounded-t-xl flex flex-col items-center justify-center mt-1`}
            >
              <span className="text-[20px]">🥉</span>
              <span className="font-black text-[18px]">3</span>
            </div>
          </div>
        )}
      </div>

      {/* REST OF LIST 4-10+ */}
      <div className="space-y-1.5 mt-3">
        {(compact ? showBoard.slice(3) : rest).map((b) => {
          const isMe = b.username?.toLowerCase() === me;
          return (
            <div
              key={b.username}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${isMe ? "bg-amber-400 text-black border-amber-400 font-black" : "bg-white/5 border-white/5"}`}
            >
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[11px] font-black shrink-0">
                {b.rank}
              </span>
              <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-[11px] font-black text-white shrink-0">
                {(b.fullName?.[0] || b.username?.[0] || "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold truncate">
                  @{b.username} {isMe ? "(You)" : ""}
                </p>
                <p
                  className={`text-[11px] truncate ${isMe ? "text-black/70" : "text-slate-400"}`}
                >
                  {b.fullName}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] font-black">
                  {b.score}/{b.total}
                </p>
                <p
                  className={`text-[10px] font-bold ${isMe ? "text-black/70" : "text-emerald-400"}`}
                >
                  {b.percent}%
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {compact && board.length > 10 && (
        <p className="text-center text-[11px] text-slate-500 mt-2">
          + {board.length - 10} more players... Finish test to see full board
        </p>
      )}
    </div>
  );
}

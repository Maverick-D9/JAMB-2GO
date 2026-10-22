import { useEffect, useState } from "react";
import { VITALS } from "../config/vitals";
import ReviewFab from "../components/ReviewFab.jsx";

const ACCENT = "#FBBF24"; // Gold
const API_BASE = VITALS.SYSTEM.API_BASE;
const API = `${API_BASE}/api/cbt`;

export default function CBTResult() {
  const [data, setData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [lbType, setLbType] = useState("main");
  const [subjectFilter, setSubjectFilter] = useState("mathematics");
  const [loading, setLoading] = useState(false);
  const [isFlagged, setIsFlagged] = useState(false);

  const currentUserId =
    localStorage.getItem("userId") ||
    localStorage.getItem("cbt_userId") ||
    "anon_user";
  const currentName =
    localStorage.getItem("userName") ||
    localStorage.getItem("cbt_name") ||
    JSON.parse(localStorage.getItem("jambite_user") || "{}").username ||
    "You";

  useEffect(() => {
    try {
      const keys = ["cbt_result", "lastCbtResult", "cbtResult", "jamb_result"];
      let found = null;
      for (const k of keys) {
        const raw = localStorage.getItem(k) || sessionStorage.getItem(k);
        if (raw) {
          try {
            found = JSON.parse(raw);
          } catch {}
          if (found && found.score !== undefined) break;
        }
      }
      if (!found || found.score === undefined) {
        found = { score: 0, total: 0, breakdown: {} };
      }
      if (found.breakdown) {
        const sum = Object.values(found.breakdown).reduce(
          (s, v) => s + (v?.total || 0),
          0,
        );
        const scoreSum = Object.values(found.breakdown).reduce(
          (s, v) => s + (v?.score || 0),
          0,
        );
        if (sum > 0 && found.total !== sum) {
          found.total = sum;
          found.score = scoreSum;
        }
        if (found.total === 0 && sum > 0) {
          found.total = sum;
          found.score = scoreSum;
        }
      }
      if (
        found.total === 160 &&
        found.score === 40 &&
        Object.keys(found.breakdown || {}).length === 0
      ) {
        found = { score: 0, total: 0, breakdown: {} };
      }
      setData(found);

      if (found.total > 0) {
        const timeTaken = Number(
          localStorage.getItem("cbt_timeTaken") || found.timeTaken || 0,
        );
        const totalQs = found.total;
        if (totalQs >= 100 && timeTaken > 0 && timeTaken < 900) {
          setIsFlagged(true);
        }
        const payload = {
          userId: currentUserId,
          name: currentName,
          totalScore: Math.round((found.score / (found.total || 1)) * 400),
          rawScore: found.score,
          rawTotal: found.total,
          breakdown: found.breakdown,
          subjects: Object.keys(found.breakdown || {}),
          timeTaken: timeTaken || 1800,
        };
        fetch(`${API}/save-result`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then((r) => r.json())
          .then((res) => {
            if (res.attemptId) {
              localStorage.setItem("lastAttemptId", res.attemptId);
            }
            if (res.isFlagged) setIsFlagged(true);
          })
          .catch(() => {});
        localStorage.removeItem("cbt_timeTaken");
      }
    } catch {
      setData({ score: 0, total: 0, breakdown: {} });
    }
    fetchLeaderboard("main");
  }, []);

  const fetchLeaderboard = async (type, subject = subjectFilter) => {
    setLoading(true);
    setLbType(type);
    if (type === "subject") setSubjectFilter(subject);
    try {
      const url = `${API}/leaderboard?type=${type}${type === "subject" ? `&subject=${subject}` : ""}`;
      const res = await fetch(url);
      const json = await res.json();
      setLeaderboard(Array.isArray(json) ? json : json.leaderboard || []);
    } catch {
      setLeaderboard([]);
    }
    setLoading(false);
  };

  const handleReview = () => {
    const attemptId = localStorage.getItem("lastAttemptId") || data?.attemptId;
    if (attemptId) {
      window.location.href = `/cbt-review/${attemptId}`;
    } else {
      window.location.href = `/cbt-review`;
    }
  };

  if (!data) return null;
  const safeTotal = data.total || 1;
  const pct = data.total > 0 ? Math.round((data.score / data.total) * 100) : 0;
  const jambScore =
    data.total > 0 ? Math.round((data.score / data.total) * 400) : 0;
  const config =
    pct >= 75
      ? {
          emoji: "👑🏆",
          title: "Royal Champion!",
          msg: "Distinction! The throne is yours!",
          color: "from-amber-300 to-yellow-600",
          text: "text-amber-400",
          light: "bg-amber-500/15",
          ring: "#FBBF24",
        }
      : pct >= 60
        ? {
            emoji: "⚔️🔥",
            title: "Warrior Elite!",
            msg: "You fought brilliantly!",
            color: "from-emerald-400 to-green-600",
            text: "text-emerald-400",
            light: "bg-emerald-500/15",
            ring: "#22c55e",
          }
        : pct >= 45
          ? {
              emoji: "🛡️💪",
              title: "Valiant Knight!",
              msg: "Good effort, keep training!",
              color: "from-sky-400 to-blue-600",
              text: "text-sky-400",
              light: "bg-sky-500/15",
              ring: "#38bdf8",
            }
          : {
              emoji: "📜📚",
              title: "Squire in Training",
              msg: "The Palace believes in you. Try again!",
              color: "from-orange-400 to-red-500",
              text: "text-orange-400",
              light: "bg-orange-500/15",
              ring: "#f97316",
            };
  const breakdown = data.breakdown || {};
  const subjects = Object.keys(breakdown).filter(
    (k) => typeof breakdown[k] === "object" && breakdown[k].total !== undefined,
  );

  if (data.total === 0) {
    return (
      <div className="min-h-screen bg-[#0A0F1A] flex items-center justify-center p-4">
        <div className="bg-[#141E2F] border border-white/10 rounded-[20px] p-8 text-center max-w-sm">
          <div className="text-4xl mb-3">📜</div>
          <h2 className="font-black text-lg text-white">
            No Royal Scroll Found
          </h2>
          <p className="text-sm text-slate-400 mt-2">Enter the hall first</p>
          <button
            onClick={() => (window.location.href = "/cbt-setup")}
            className="mt-5 w-full bg-[#FBBF24] text-black font-black py-3 rounded-xl"
          >
            Go to Palace Setup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0F1A] flex flex-col items-center p-4 relative overflow-hidden font-['Inter']">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Cinzel:wght@700;800&display=swap'); @keyframes aurora {0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-20px)}}`}</style>
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute w-[800px] h-[800px] -top-[200px] left-1/2 -translate-x-1/2 bg-gradient-to-b from-amber-500/15 to-transparent rounded-full blur-[90px]"
          style={{ animation: "aurora 8s infinite" }}
        ></div>
        <div className="absolute w-[600px] h-[600px] top-[30%] right-[-100px] bg-gradient-to-b from-indigo-500/10 to-transparent rounded-full blur-[80px]"></div>
      </div>

      <div className="relative w-full max-w-[580px] bg-[#141E2F] rounded-[28px] overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.7)] border border-white/10 mt-4">
        <div className="bg-gradient-to-b from-[#1A263E] to-[#0f172a] px-8 py-7 text-center relative border-b border-white/5">
          <div
            className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r ${config.color}`}
          ></div>
          <div
            className="inline-flex items-center gap-2 bg-white/5 border border-amber-400/20 rounded-full px-4 py-1.5 text-[10px] tracking-widest text-amber-300 uppercase font-bold mb-3"
            style={{ fontFamily: "Cinzel" }}
          >
            👑 Palace Official • 2026 Mock
          </div>
          <h1
            className="text-white font-black text-[22px] tracking-tight"
            style={{ fontFamily: "Cinzel" }}
          >
            ROYAL RESULT SCROLL
          </h1>
          <p className="text-amber-200/60 text-[10px] mt-1 uppercase tracking-[0.3em]">
            Sealed by the King's Council
          </p>
          {isFlagged && (
            <div className="mt-3 text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 rounded-full px-3 py-1 inline-block">
              ⚠️ FLAGGED: Too fast for leaderboard
            </div>
          )}
        </div>

        <div className="p-8">
          <div className="text-center">
            <p className="text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase">
              Your Conquest
            </p>
            <div className="mt-2 flex items-baseline justify-center gap-2">
              <span
                className="font-black text-6xl text-white tracking-tight"
                style={{ fontFamily: "Cinzel" }}
              >
                {data.score}
              </span>
              <span className="font-black text-3xl text-slate-600">/</span>
              <span className="font-bold text-3xl text-slate-400">
                {data.total}
              </span>
            </div>
            <div className="mt-4 inline-flex items-center gap-3 bg-[#0A0F1A] rounded-full pl-2 pr-5 py-2 border border-white/10">
              <span
                className={`w-9 h-9 rounded-full bg-gradient-to-r ${config.color} flex items-center justify-center text-black font-black text-xs`}
              >
                400
              </span>
              <span className="text-white text-sm font-bold tracking-wide">
                JAMB:{" "}
                <span
                  className="text-amber-400 text-[18px]"
                  style={{ fontFamily: "Cinzel" }}
                >
                  {jambScore}
                </span>{" "}
                / 400
              </span>
              <span className="text-[11px] bg-white/10 text-amber-200 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                {pct}%
              </span>
            </div>
          </div>

          <div className="mt-8 flex gap-5 items-center justify-center bg-[#0A0F1A] border border-white/5 rounded-2xl p-4">
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  stroke="#1e293b"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  stroke={config.ring}
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 32}`}
                  strokeDashoffset={`${2 * Math.PI * 32 * (1 - pct / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div
                className="absolute inset-0 flex items-center justify-center font-black text-sm text-white"
                style={{ fontFamily: "Cinzel" }}
              >
                {pct}%
              </div>
            </div>
            <div className="text-left">
              <div className="text-xl">{config.emoji}</div>
              <h2
                className={`font-black text-[16px] ${config.text}`}
                style={{ fontFamily: "Cinzel" }}
              >
                {config.title}
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">{config.msg}</p>
            </div>
          </div>

          {subjects.length > 0 && (
            <div className="mt-7">
              <h3
                className="font-bold text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-3"
                style={{ fontFamily: "Cinzel" }}
              >
                Kingdom Breakdown
              </h3>
              <div className="grid gap-2.5">
                {subjects.map((sub) => {
                  const v = breakdown[sub];
                  const subPct =
                    v.total > 0 ? Math.round((v.score / v.total) * 100) : 0;
                  return (
                    <div
                      key={sub}
                      className="flex items-center justify-between bg-[#0A0F1A] border border-white/5 rounded-xl px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full ${config.light} flex items-center justify-center font-black text-[11px] ${config.text} border border-white/10`}
                        >
                          {sub[0].toUpperCase()}
                        </div>
                        <span className="font-bold text-sm capitalize text-slate-200">
                          {sub}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${config.color}`}
                            style={{ width: `${subPct}%` }}
                          ></div>
                        </div>
                        <span className="font-black text-sm text-white w-12 text-right">
                          {v.score}/{v.total}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl py-3 text-center">
              <div
                className="font-black text-lg text-emerald-400"
                style={{ fontFamily: "Cinzel" }}
              >
                {data.score}
              </div>
              <div className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">
                Correct
              </div>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl py-3 text-center">
              <div
                className="font-black text-lg text-red-400"
                style={{ fontFamily: "Cinzel" }}
              >
                {data.total - data.score}
              </div>
              <div className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">
                Wrong
              </div>
            </div>
            <div className="bg-amber-500/10 border border-amber-400/20 rounded-2xl py-3 text-center">
              <div
                className="font-black text-lg text-amber-400"
                style={{ fontFamily: "Cinzel" }}
              >
                {jambScore}
              </div>
              <div className="text-[9px] font-bold tracking-widest text-amber-200/70 uppercase">
                Over 400
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-3">
            <button
              onClick={handleReview}
              className="w-full py-4 rounded-[14px] bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black text-[13px] tracking-widest shadow-[0_0_25px_rgba(251,191,36,0.35)] hover:scale-[1.02] active:scale-[0.98] transition"
              style={{ fontFamily: "Cinzel" }}
            >
              🔍 REVIEW ANSWERS
            </button>
            <p className="text-center text-[10px] text-slate-500">
              See all {data.total} questions, your answers, correct answers &
              royal explanations
            </p>
          </div>
        </div>
      </div>

      <div className="relative w-full max-w-[580px] mt-6 bg-[#141E2F] rounded-[24px] overflow-hidden shadow-xl border border-white/10">
        <div
          className="px-6 py-4 flex justify-between items-center"
          style={{ background: "linear-gradient(90deg, #0A0F1A, #1A263E)" }}
        >
          <h3
            className="text-amber-300 font-black text-sm tracking-wide"
            style={{ fontFamily: "Cinzel" }}
          >
            👑 HALL OF CHAMPIONS
          </h3>
          <span className="text-[10px] bg-amber-400/15 text-amber-300 px-2.5 py-1 rounded-full border border-amber-400/20">
            Live • Top 100
          </span>
        </div>

        <div className="p-3 bg-[#0A0F1A] border-y border-white/5 flex gap-2 overflow-x-auto">
          {[
            { k: "main", label: "Main • 400" },
            { k: "subject", label: "Subject" },
            { k: "streak", label: "🔥 Streak" },
            { k: "improved", label: "📈 Improved" },
          ].map((tab) => (
            <button
              key={tab.k}
              onClick={() => fetchLeaderboard(tab.k)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-[11px] font-black tracking-wide transition ${lbType === tab.k ? "text-black shadow" : "bg-[#141E2F] text-slate-400 border border-white/5"}`}
              style={lbType === tab.k ? { background: ACCENT } : {}}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {lbType === "subject" && (
          <div className="px-4 py-3 bg-amber-500/5 flex gap-2 items-center border-b border-amber-400/10">
            <span className="text-[11px] font-bold text-slate-500">
              Filter:
            </span>
            <select
              value={subjectFilter}
              onChange={(e) => fetchLeaderboard("subject", e.target.value)}
              className="flex-1 bg-[#0A0F1A] border border-amber-400/20 rounded-full px-3 py-2 text-xs font-bold capitalize outline-none text-amber-300"
            >
              <option value="english">English</option>
              <option value="mathematics">Mathematics</option>
              <option value="physics">Physics</option>
              <option value="chemistry">Chemistry</option>
              <option value="biology">Biology</option>
              <option value="economics">Economics</option>
              <option value="government">Government</option>
              <option value="literature">Literature</option>
            </select>
          </div>
        )}

        <div className="p-3 max-h-[420px] overflow-y-auto bg-[#0f172a]">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Summoning champions...
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="py-10 text-center">
              <div className="text-3xl">🏰</div>
              <p className="text-xs text-slate-500 mt-2">
                No champions yet. Claim the throne!
              </p>
            </div>
          ) : (
            leaderboard.map((row, i) => {
              const isYou = row.userId === currentUserId;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 14px",
                    marginBottom: 8,
                    borderRadius: 12,
                    background: isYou ? "rgba(251,191,36,0.12)" : "#141E2F",
                    border: isYou
                      ? `1.5px solid ${ACCENT}`
                      : "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#0A0F1A] border border-white/10 flex items-center justify-center text-[11px] font-black text-amber-300">
                      {i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[13px] text-white">
                          {row.name?.slice(0, 18) || "Anon"}
                        </span>
                        {isYou && (
                          <span
                            className="text-black text-[8px] font-black px-2 py-0.5 rounded-full"
                            style={{ background: ACCENT }}
                          >
                            YOU
                          </span>
                        )}
                      </div>
                      {lbType === "main" && (
                        <div className="text-[10px] text-slate-500">
                          {Math.floor((row.timeTaken || 0) / 60)}m{" "}
                          {(row.timeTaken || 0) % 60}s •{" "}
                          {new Date(row.date).toLocaleDateString()}
                        </div>
                      )}
                      {lbType === "improved" && (
                        <div className="text-[10px] text-slate-500">
                          {row.firstScore} → {row.highestScore} • {row.attempts}{" "}
                          attempts
                        </div>
                      )}
                      {lbType === "streak" && (
                        <div className="text-[10px] text-slate-500">
                          Last: {new Date(row.lastActive).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {lbType === "main" && (
                      <div
                        className="font-black text-[14px] text-amber-300"
                        style={{ fontFamily: "Cinzel" }}
                      >
                        {row.totalScore}/400
                      </div>
                    )}
                    {lbType === "subject" && (
                      <div className="font-black text-[14px] text-amber-300">
                        {row.subjectScore}/{row.subjectTotal || 40}
                      </div>
                    )}
                    {lbType === "streak" && (
                      <div className="font-black text-[14px] text-amber-300">
                        🔥 {row.streak}
                      </div>
                    )}
                    {lbType === "improved" && (
                      <div className="font-black text-[13px] text-emerald-400">
                        +{row.percentIncrease}%
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="w-full max-w-[580px] mt-5 grid grid-cols-2 gap-3">
        <button
          onClick={() => (window.location.href = "/cbt-setup")}
          className="bg-[#141E2F] border border-white/10 text-white font-black py-4 rounded-xl text-sm"
        >
          Retake ⚔️
        </button>
        <button
          onClick={() => (window.location.href = "/")}
          className="text-black font-black py-4 rounded-xl text-sm"
          style={{ background: "linear-gradient(135deg, #FBBF24, #f59e0b)" }}
        >
          Palace Home 👑
        </button>
      </div>
      <p className="mt-4 text-[10px] text-slate-600 tracking-wide">
        Royal Leaderboard • Anti-cheat wards active • JAMB•2GO Palace
      </p>
      <ReviewFab />
    </div>
  );
}

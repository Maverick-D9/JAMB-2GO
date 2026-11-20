import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import { VITALS } from "../config/vitals";

const socket = io.connect(VITALS.SYSTEM.API_BASE);

// --- FLOATING DOODLES - NOW WELL VISIBLE ---
// Before: opacity 0.1, all white, 18-48px. Now: 34-68px, 0.85 opacity, gold/white/indigo + glow
const CHESS_COLORS = {
  "♞": "#FACC15", // gold knight
  "♜": "#FFFFFF", // white rook
  "♛": "#FACC15", // gold queen
  "♟️": "#FFFFFF",
  "♔": "#FB7185", // red king
  "♟": "#FFFFFF",
};
// --- FLOATING DOODLES - BALANCED LEFT + RIGHT ---
// Left side: 2% - 20% | Right side: 80% - 97% | Centre kept clear so cards no cover dem
const LEFT_DOODLES = [
  { icon: "♞", top: "6%", left: "4%", size: 68, color: "#FACC15" },
  { icon: "⚔️", top: "18%", left: "12%", size: 32, color: "#FFFFFF" },
  { icon: "♜", top: "30%", left: "3%", size: 72, color: "#FFFFFF" },
  { icon: "✦", top: "42%", left: "14%", size: 26, color: "#A5B4FC" },
  { icon: "♛", top: "52%", left: "6%", size: 62, color: "#FACC15" },
  { icon: "ᚱ", top: "64%", left: "15%", size: 28, color: "#A5B4FC" },
  { icon: "♟️", top: "74%", left: "4%", size: 52, color: "#FFFFFF" },
  { icon: "⚡", top: "84%", left: "11%", size: 30, color: "#FACC15" },
  { icon: "♔", top: "90%", left: "6%", size: 48, color: "#FB7185" },
  { icon: "🔮", top: "12%", left: "18%", size: 28, color: "#C4B5FD" },
];

const RIGHT_DOODLES = [
  { icon: "♜", top: "6%", left: "92%", size: 72, color: "#FFFFFF" },
  { icon: "ᚠ", top: "16%", left: "85%", size: 28, color: "#A5B4FC" },
  { icon: "⚔️", top: "26%", left: "93%", size: 32, color: "#FFFFFF" },
  { icon: "♞", top: "38%", left: "84%", size: 60, color: "#FACC15" },
  { icon: "✧", top: "48%", left: "94%", size: 26, color: "#A5B4FC" },
  { icon: "♛", top: "58%", left: "86%", size: 64, color: "#FACC15" },
  { icon: "🗡️", top: "68%", left: "93%", size: 32, color: "#FFFFFF" },
  { icon: "♟️", top: "78%", left: "84%", size: 50, color: "#FFFFFF" },
  { icon: "♔", top: "88%", left: "93%", size: 52, color: "#FB7185" },
  { icon: "🌀", top: "92%", left: "85%", size: 30, color: "#C4B5FD" },
];

function FloatingDoodles() {
  const all = [...LEFT_DOODLES, ...RIGHT_DOODLES];
  return (
    <div className="absolute inset-0 overflow-visible pointer-events-none z-[1]">
      {all.map((d, i) => {
        const isChess = ["♞", "♜", "♛", "♟️", "♔"].includes(d.icon);
        return (
          <motion.span
            key={i}
            className="absolute select-none"
            style={{
              left: d.left,
              top: d.top,
              fontSize: d.size,
              lineHeight: 1,
              color: d.color,
              opacity: isChess ? 0.95 : 0.6,
              textShadow: isChess
                ? `0 0 16px ${d.color}, 0 0 36px ${d.color}88, 0 4px 0 rgba(0,0,0,0.6)`
                : "0 0 12px rgba(165,180,252,0.7)",
              WebkitTextStroke: isChess ? "1px rgba(0,0,0,0.4)" : "0px",
              filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.6))",
            }}
            animate={{
              y: [0, -22, 0],
              opacity: isChess ? [0.85, 1, 0.85] : [0.45, 0.65, 0.45],
              rotate: [0, 10, -8, 0],
            }}
            transition={{
              duration: 6 + (i % 5),
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.3,
            }}
          >
            {d.icon}
          </motion.span>
        );
      })}
    </div>
  );
}

function PortalBackground() {
  return (
    <>
      <motion.div
        className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, #7F1D1D 0%, #4C1D95 45%, transparent 70%)",
          filter: "blur(60px)",
        }}
        animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, #EF4444 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
        animate={{ opacity: [0.2, 0.45, 0.2], scale: [1, 1.1, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.65) 100%)",
        }}
      />
    </>
  );
}

export default function DuelArena() {
  const [username] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("jambite_user") || "null")?.username ||
        ""
      );
    } catch {
      return "";
    }
  });
  const [state, setState] = useState("lobby");
  const [opponent, setOpponent] = useState("");
  const [duelId, setDuelId] = useState("");
  const duelIdRef = useRef("");
  const [q, setQ] = useState(null);
  const [qNumber, setQNumber] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [timer, setTimer] = useState(30);
  const [expiresAt, setExpiresAt] = useState(null);
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState(null);
  const [history, setHistory] = useState([]);
  const [duelPoints, setDuelPoints] = useState(0);
  const [duelStats, setDuelStats] = useState({
    duelWins: 0,
    duelLosses: 0,
    duelDraws: 0,
  });
  const [leaderboard, setLeaderboard] = useState([]);

  const refreshDuelData = () => {
    fetch(`${VITALS.SYSTEM.API_BASE}/api/duel/rank/${username}`)
      .then((r) => r.json())
      .then((d) => {
        setDuelPoints(d.duelPoints || 0);
        setDuelStats(d);
      })
      .catch(() => {});
    fetch(`${VITALS.SYSTEM.API_BASE}/api/duel/leaderboard`)
      .then((r) => r.json())
      .then((d) => setLeaderboard(Array.isArray(d) ? d : []))
      .catch(() => {});
  };

  useEffect(() => {
    refreshDuelData();
    socket.emit("duel:history", { username });
    socket.on("duel:history_result", (h) => setHistory(h));
    socket.on("duel:waiting", () => setState("waiting"));
    socket.on("duel:cancelled", () => setState("lobby"));
    socket.on("duel:result", () => refreshDuelData());
    socket.on("duel:finished", () => refreshDuelData());
    socket.on("duel:complete", () => refreshDuelData());
    socket.on("duel:ended", () => refreshDuelData());
    socket.on("duel:error", (d) => {
      setToast(d?.message || "Duel error");
      setState("lobby");
      setTimeout(() => setToast(null), 5000);
    });
    socket.on("duel:matched", (d) => {
      duelIdRef.current = d.duelId;
      setDuelId(d.duelId);
      setOpponent(d.opponent);
      setState("battle");
      setMyScore(0);
      setOppScore(0);
      setResult(null);
    });
    socket.on("duel:question", (d) => {
      setQ(d.question);
      setQNumber(d.qNumber);
      setExpiresAt(d.expiresAt);
      setSelected(null);
      setFeedback(null);
      setTimer(Math.max(0, Math.ceil((d.expiresAt - Date.now()) / 1000)));
    });
    socket.on("duel:answer_result", (d) => {
      setFeedback(d);
      if (d.isCorrect) setMyScore(d.score);
    });
    socket.on("duel:score_update", (d) => {
      setMyScore(d.myScore);
      setOppScore(d.opponentScore);
    });
    socket.on("duel:finished", (d) => {
      setResult(d);
      setMyScore(d.myScore);
      setOppScore(d.opponentScore);
      setState("finished");
      socket.emit("duel:history", { username });
    });
    return () => {
      socket.off("duel:waiting");
      socket.off("duel:error");
      socket.off("duel:matched");
      socket.off("duel:question");
      socket.off("duel:answer_result");
      socket.off("duel:score_update");
      socket.off("duel:finished");
      socket.off("duel:history_result");
      socket.off("duel:cancelled");
    };
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    const iv = setInterval(
      () => setTimer(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))),
      200,
    );
    return () => clearInterval(iv);
  }, [expiresAt]);

  const rematch = () => {
    duelIdRef.current = "";
    setDuelId("");
    setResult(null);
    setQ(null);
    setQNumber(0);
    setSelected(null);
    setFeedback(null);
    setMyScore(0);
    setOppScore(0);
    setOpponent("");
    setExpiresAt(null);
    setToast(null);
    setState("waiting");
    socket.emit("duel:join", { username });
  };
  const join = () => {
    setToast(null);
    setState("waiting");
    socket.emit("duel:join", { username });
  };
  const cancelMatchmaking = () => {
    socket.emit("duel:cancel", { username });
    setState("lobby");
  };
  const answer = (opt) => {
    if (selected) return;
    setSelected(opt);
    const textForOpt = q ? q[`option_${opt.toLowerCase()}`] : "";
    socket.emit("duel:answer", {
      duelId: duelIdRef.current || duelId,
      answer: opt,
      answerText: textForOpt,
    });
  };

  const toastEl = toast ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] bg-red-500 text-white text-[13px] font-bold px-4 py-3 rounded-xl shadow-xl max-w-[90vw] text-center">
      {toast}
    </div>
  ) : null;

  // ================= LOBBY =================
  if (state === "lobby")
    return (
      <div className="min-h-screen w-full relative overflow-hidden bg-[#0A0F1A] text-white flex justify-center items-start py-6 px-4">
        <PortalBackground />
        <FloatingDoodles />
        {toastEl}
        <div className="relative z-10 w-[640px] max-w-[95vw] text-center">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <h1
              className="font-black italic tracking-tight leading-none text-[52px] md:text-[64px]"
              style={{ fontFamily: "Cinzel, sans-serif" }}
            >
              <span
                className="text-white"
                style={{ textShadow: "0 0 18px rgba(255,255,255,0.5)" }}
              >
                DUEL
              </span>{" "}
              <span
                className="text-red-500"
                style={{
                  textShadow:
                    "0 0 22px #EF4444, 0 0 48px #F97316, 0 0 80px #7F1D1D",
                }}
              >
                ARENA
              </span>
            </h1>
            <p className="text-white/60 text-[13px] mt-2">
              Enter the portal. Only one leaves victorious.
            </p>
          </motion.div>

          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mt-4 mx-auto inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-5 py-2.5 rounded-full"
            style={{
              background: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            <span className="text-[13px] text-white/80">
              Welcome, Scholar-{username}
            </span>
            <span
              className="text-[18px] leading-none"
              style={{ filter: "drop-shadow(0 0 8px #FACC15)" }}
            >
              👑
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 font-bold">
              FREE for all
            </span>
            <span
              className="text-[13px] font-black text-amber-300"
              style={{ textShadow: "0 0 12px rgba(250,204,21,0.7)" }}
            >
              ⚔️ Duel Points: {duelPoints} • {duelStats.duelWins}W -{" "}
              {duelStats.duelLosses}L
            </span>
          </motion.div>

          {/* 2. HOW DUEL WORKS - #1E293B + PURE WHITE */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mt-5 p-[16px] rounded-[20px] text-left"
            style={{
              background: "#1E293B",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div className="w-9 h-9 rounded-xl bg-red-500/20 grid place-items-center">
              ⚔️
            </div>
            <div
              className="mt-3 font-extrabold text-[13px]"
              style={{ color: "#FFFFFF" }}
            >
              How Duel Works
            </div>
            <div
              className="text-[12px] mt-1 leading-5"
              style={{ color: "#FFFFFF" }}
            >
              • 1v1 • 10 questions • 30s each
              <br />• Winner <b style={{ color: "#FFFFFF" }}>+20 pts</b> • Loser{" "}
              <b style={{ color: "#FFFFFF" }}>-10 pts</b> • Draw 0
            </div>
          </motion.div>

          {/* 3. TOP DUELISTS - USER ROW GLOWING INDIGO */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-4 p-[16px] rounded-[20px] text-left"
            style={{
              background: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <p className="font-extrabold text-[13px] text-white">
              🏆 Top Duelists
            </p>
            {leaderboard.length === 0 ? (
              <p className="text-[12px] text-slate-400 mt-2">
                No duelists yet. Be the first!
              </p>
            ) : (
              leaderboard.map((p, i) => {
                const isMe = p.username === username;
                return (
                  <div
                    key={p.username}
                    className="flex justify-between items-center text-[12px] mt-2 px-3 py-2.5 rounded-xl"
                    style={
                      isMe
                        ? {
                            background: "rgba(99,102,241,0.18)",
                            border: "1px solid #818CF8",
                            boxShadow:
                              "0 0 22px rgba(99,102,241,0.6), inset 0 0 12px rgba(99,102,241,0.25)",
                            color: "#fff",
                            fontWeight: 700,
                          }
                        : {
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid transparent",
                            color: "#CBD5E1",
                          }
                    }
                  >
                    <span
                      style={
                        i === 0 && !isMe
                          ? {
                              textShadow: "0 0 12px rgba(250,204,21,0.9)",
                              color: "#fff",
                              fontWeight: 800,
                            }
                          : {}
                      }
                    >
                      {i === 0 ? "👑 " : ""}
                      {i + 1}. {p.username}{" "}
                      {isMe ? (
                        <span className="text-[10px] bg-indigo-500 px-2 py-0.5 rounded-full ml-1">
                          (You)
                        </span>
                      ) : (
                        ""
                      )}
                    </span>
                    <span className="text-amber-300 font-black">
                      {p.duelPoints} pts • {p.duelWins}W
                    </span>
                  </div>
                );
              })
            )}
          </motion.div>

          {/* FIND OPPONENT + RADAR PULSE ON HOVER */}
          <div className="relative group mt-4">
            <span className="absolute inset-0 rounded-2xl bg-red-500/40 opacity-0 group-hover:opacity-100 group-hover:animate-ping pointer-events-none" />
            <span
              className="absolute inset-0 rounded-2xl bg-orange-500/25 opacity-0 group-hover:opacity-100 group-hover:animate-pulse pointer-events-none"
              style={{ animationDelay: "150ms" }}
            />
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              animate={{
                boxShadow: [
                  "0 0 0px #F97316",
                  "0 0 32px #F97316",
                  "0 0 0px #F97316",
                ],
              }}
              transition={{ duration: 1.8, repeat: Infinity }}
              onClick={join}
              className="relative w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 text-white font-black text-[15px] overflow-hidden"
            >
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />
              ⚔️ Find Opponent
            </motion.button>
          </div>

          {/* 1. LAST DUELS - ALWAYS SHOW, DIRECTLY UNDER FIND OPPONENT */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mt-4 p-[16px] rounded-[20px] text-left"
            style={{
              background: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="font-extrabold text-[13px] text-white">
                ⚔️ Last Duels
              </div>
              <span className="text-white/40 text-[11px]">
                {history.length} battles
              </span>
            </div>

            {history.length === 0 ? (
              // Empty state - Nice No Battles Yet graphic
              <div className="mt-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-center">
                <div
                  className="text-[44px] leading-none"
                  style={{
                    filter: "drop-shadow(0 0 16px rgba(250,204,21,0.6))",
                  }}
                >
                  🛡️
                </div>
                <p className="mt-2 font-bold text-white text-[14px]">
                  No Battles Yet
                </p>
                <p className="text-white/50 text-[12px] mt-1">
                  Your duel history go show here. Hit{" "}
                  <b className="text-white">Find Opponent</b> to enter your
                  first battle!
                </p>
                <div className="mt-3 flex justify-center gap-2 text-[22px]">
                  <span>♞</span>
                  <span className="text-yellow-400">♜</span>
                  <span>♝</span>
                </div>
              </div>
            ) : (
              history
                .slice()
                .reverse()
                .map((h, i) => {
                  const isWin = h.result === "WIN";
                  const isDraw = h.result === "DRAW";
                  return (
                    <div
                      key={i}
                      className="mt-3 p-3.5 rounded-2xl bg-[#0F172A]"
                      style={{
                        border: `2px solid ${isWin ? "#10B981" : isDraw ? "#94A3B8" : "#EF4444"}`,
                        boxShadow: `0 0 18px ${isWin ? "rgba(16,185,129,0.3)" : isDraw ? "rgba(148,163,184,0.2)" : "rgba(239,68,68,0.3)"}`,
                      }}
                    >
                      <div className="flex justify-between items-center text-[12px]">
                        <span className="text-white font-bold">
                          vs {h.opponent} • {h.myScore}-{h.opponentScore}
                        </span>
                        <span
                          className={`font-black px-2.5 py-1 rounded-full text-[11px] ${isWin ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : isDraw ? "bg-slate-500/20 text-slate-300 border border-slate-500/40" : "bg-red-500/20 text-red-300 border border-red-500/40"}`}
                        >
                          {isWin ? "✓ WIN" : isDraw ? "＝ DRAW" : "✕ LOSS"}{" "}
                          {h.xpChange > 0 ? `+${h.xpChange}` : h.xpChange}
                        </span>
                      </div>
                    </div>
                  );
                })
            )}
          </motion.div>

          <button
            onClick={() => (window.location.href = "/")}
            className="mt-3 text-slate-500 text-[12px]"
          >
            ← Back to Haven
          </button>
        </div>
        <style>{`.group:hover .animate-ping{animation: radarPing 1s cubic-bezier(0,0,0.2,1) infinite;} @keyframes radarPing{0%{transform:scale(1);opacity:.6;}100%{transform:scale(1.12);opacity:0;}}`}</style>
      </div>
    );

  if (state === "waiting")
    return (
      <div className="min-h-screen relative overflow-hidden bg-[#0A0F1A] grid place-items-center text-white p-4 text-center">
        <PortalBackground />
        <FloatingDoodles />
        {toastEl}
        <div className="relative z-10">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="text-[48px]"
          >
            ⚔️
          </motion.div>
          <div className="mt-3 font-black text-[18px]">
            Searching for opponent...
          </div>
          <div className="text-slate-400 text-[12px] mt-1">
            The portal is scanning for a worthy rival...
          </div>
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="mt-4 text-[11px] text-orange-300 font-bold tracking-widest"
          >
            MATCHMAKING...
          </motion.div>
          <button
            onClick={cancelMatchmaking}
            className="mt-6 px-6 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-black text-[13px] active:scale-95"
          >
            ✕ Stop Searching
          </button>
          <p className="mt-2 text-[11px] text-slate-500">
            Return to Duel Arena
          </p>
        </div>
      </div>
    );

  if (state === "finished" && result) {
    const iWon = !result.isDraw && result.myScore > result.opponentScore;
    const iLost = !result.isDraw && result.myScore < result.opponentScore;
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-[#0F172A] border-2 rounded-[24px] p-8 text-center max-w-sm w-full"
          style={{
            borderColor: result.isDraw
              ? "#94A3B8"
              : iWon
                ? "#F59E0B"
                : "#EF4444",
            boxShadow: `0 0 60px ${result.isDraw ? "#94A3B8" : iWon ? "#F59E0B" : "#EF4444"}60`,
          }}
        >
          <div className="text-6xl animate-bounce">
            {result.isDraw ? "🤝" : iWon ? "👑" : "💀"}
          </div>
          <p className="text-white/60 text-[12px] mt-4 font-bold tracking-widest">
            {result.isDraw ? "DRAW!" : iWon ? "VICTORY!" : "DEFEAT"}
          </p>
          <h2 className="text-3xl font-black mt-2 text-white">
            {result.isDraw
              ? "Draw!"
              : iWon
                ? `You beat ${result.opponent}!`
                : `${result.opponent} wins`}
          </h2>
          <p className="text-white/80 text-[13px] mt-3">
            {result.myScore} - {result.opponentScore} •{" "}
            {result.pointsChange > 0
              ? `+${result.pointsChange}`
              : result.pointsChange}{" "}
            pts
          </p>
          <button
            onClick={() => (window.location.href = "/")}
            className="mt-6 w-full py-3 rounded-[12px] font-black text-black bg-amber-400"
          >
            Back to Haven 🔥
          </button>
          <button
            onClick={rematch}
            className="mt-2 w-full py-3 rounded-[12px] font-black text-white border border-white/10"
          >
            Rematch ⚔️
          </button>
        </motion.div>
      </div>
    );
  }

  const opts = q
    ? [
        { k: "A", v: q.option_a },
        { k: "B", v: q.option_b },
        { k: "C", v: q.option_c },
        { k: "D", v: q.option_d },
      ]
    : [];
  const timerColor =
    timer <= 5 ? "#EF4444" : timer <= 10 ? "#F97316" : "#FACC15";
  return (
    <div className="w-full min-h-screen relative overflow-hidden bg-[#0A0F1A] text-white flex flex-col">
      <PortalBackground />
      <FloatingDoodles />
      {toastEl}
      <div className="relative z-10 w-full bg-black/30 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-4 py-3">
        <div className="text-[12px] font-black">
          YOU {username} • <span className="text-amber-300">{myScore} pts</span>
        </div>
        <div className="text-center">
          <div
            className="font-black text-[13px]"
            style={{ color: timerColor, textShadow: `0 0 12px ${timerColor}` }}
          >
            Q{qNumber}/10 • {timer}s
          </div>
          <div className="h-1.5 w-[80px] bg-white/10 rounded-full overflow-hidden mt-1 mx-auto">
            <motion.div
              className="h-full"
              style={{ background: timerColor }}
              animate={{ width: `${(timer / 30) * 100}%` }}
            />
          </div>
        </div>
        <div className="text-[12px] font-black text-right">
          {opponent} • <span className="text-red-300">{oppScore} pts</span>
        </div>
      </div>
      <div className="relative z-10 flex-1 flex flex-col justify-center px-4 max-w-[640px] w-full mx-auto py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={qNumber}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
            className="rounded-[20px] p-5"
            style={{
              background: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div className="text-white font-extrabold text-[16px] leading-6">
              {q?.question_text}
            </div>
            <div className="grid gap-2 mt-4">
              {opts.map((o) => (
                <motion.button
                  key={o.k}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => answer(o.k)}
                  disabled={!!selected}
                  className={`text-left p-4 rounded-[14px] border text-[13px] font-bold ${selected === o.k ? (feedback?.isCorrect ? "bg-emerald-500/20 border-emerald-400 text-white" : "bg-red-500/20 border-red-400 text-white") : "bg-[#0F172A]/80 border-white/10 text-slate-200"}`}
                >
                  <b className="text-sky-400 mr-2">{o.k}.</b> {o.v}
                </motion.button>
              ))}
            </div>
            {feedback && (
              <div className="mt-3 text-[12px] font-bold text-center text-white/80">
                {feedback.isCorrect
                  ? "✅ Correct!"
                  : `❌ Wrong! Correct: ${feedback.correct}`}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

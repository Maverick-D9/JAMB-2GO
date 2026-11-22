// client/src/unified/UnifiedTest.jsx
import { useState, useEffect } from "react";
import { UNIFIED, getUser } from "./unified.config";
import { fetchUnifiedTests, checkUnifiedAccess } from "./unified.api";
import UnifiedLeaderboard from "./UnifiedLeaderboard";

// NEW: Get logged-in user from your Auth.jsx (jambite_user)
function getLoggedUser() {
  try {
    // Try unified.config getUser() first, if e exist
    if (typeof getUser === "function") {
      const u = getUser();
      if (u?.username)
        return {
          username: u.username,
          fullName: u.fullName || u.name || "",
          userId: u.userId || u.id || "",
        };
    }
  } catch {}
  try {
    const raw = localStorage.getItem("jambite_user");
    if (raw) {
      const u = JSON.parse(raw);
      return {
        username: u.username || localStorage.getItem("username") || "",
        fullName:
          u.fullName || u.name || localStorage.getItem("fullName") || "",
        userId: u.userId || localStorage.getItem("userId") || "",
      };
    }
  } catch {}
  return {
    username: localStorage.getItem("username") || "",
    fullName: localStorage.getItem("fullName") || "",
    userId: localStorage.getItem("userId") || "",
  };
}

function useCountdown(target) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!target) return "—";
  const diff = Math.max(0, new Date(target) - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function LiveCard({ live, hasAccess, username, alreadyDone }) {
  const countdown = useCountdown(live.endAt);

  const enter = () => {
    if (alreadyDone) return; // NEW: Block if don do am
    if (!hasAccess) {
      window.location.href = "/pricing";
      return;
    }
    window.location.href = `/unified-exam/${live._id}`;
  };

  return (
    <div className="relative bg-[#121A2E]/80 border border-red-500/40 rounded-[20px] p-5 mb-4 overflow-hidden shadow-[0_0_40px_rgba(239,68,68,0.25)]">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping absolute" />
        <span className="w-2.5 h-2.5 bg-red-500 rounded-full relative" />
        <span className="text-[11px] font-black tracking-widest text-red-400">
          LIVE NOW
        </span>
        <span className="ml-auto text-[12px] font-bold text-slate-300">
          Ends in {countdown}
        </span>
      </div>
      <h2 className="text-xl font-black mt-3">{live.title}</h2>
      {/* NEW: Topic badge */}
      <p className="text-[11px] text-amber-300/80 mt-1">
        📌 Topic: {live.topic || "all"}
      </p>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {live.subjects?.map((s) => (
          <span
            key={s}
            className="text-[11px] bg-white/10 px-2.5 py-1 rounded-full"
          >
            {UNIFIED.ICONS[s] || "📝"} {s}
          </span>
        ))}
      </div>

      {/* NEW: If don do am, show score + lock button */}
      {alreadyDone ? (
        <div className="mt-4">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center">
            <p className="text-[12px] text-emerald-300 font-bold">
              ✅ You don submit this test before
            </p>
            <p className="text-[13px] text-white mt-1">
              @{username} — Score:{" "}
              <b className="text-amber-400">
                {alreadyDone.score} / {alreadyDone.total}
              </b>
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Your first attempt na the one wey count.
            </p>
          </div>
          <button
            disabled
            className="w-full mt-3 py-3.5 rounded-full bg-white/10 text-slate-400 font-black text-[14px] cursor-not-allowed"
          >
            🔒 ALREADY DONE — CAN'T RETAKE
          </button>
        </div>
      ) : (
        <button
          onClick={enter}
          className="w-full mt-4 py-3.5 rounded-full bg-gradient-to-r from-red-500 to-amber-400 text-black font-black text-[14px] cursor-pointer active:scale-[0.98]"
        >
          {hasAccess ? "🚀 ENTER LIVE TEST" : "🔒 UNLOCK PASS TO ENTER"}
        </button>
      )}
    </div>
  );
}

function UpcomingCard({ t }) {
  const countdown = useCountdown(t.startAt);
  return (
    <div className="bg-[#121A2E]/70 border border-white/10 rounded-[20px] p-4 mb-3">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold text-[14px]">{t.title}</p>
          <p className="text-[11px] text-slate-500">
            {new Date(t.startAt).toLocaleString()}
          </p>
          <p className="text-[11px] text-amber-300/80 mt-0.5">
            📌 Topic: {t.topic || "all"}
          </p>
        </div>
        <span className="text-[11px] bg-amber-400/15 text-amber-300 px-2.5 py-1 rounded-full font-bold">
          Starts in {countdown}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {t.subjects?.map((s) => (
          <span
            key={s}
            className="text-[11px] bg-white/10 px-2.5 py-1 rounded-full"
          >
            {UNIFIED.ICONS[s] || "📝"} {s}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function UnifiedTest() {
  const [tests, setTests] = useState([]);
  const [hasAccess, setHasAccess] = useState(null);
  const [user] = useState(getLoggedUser);
  const [liveDone, setLiveDone] = useState(null); // NEW: attempt for live test
  const [selectedPast, setSelectedPast] = useState(null);
  const [pastResult, setPastResult] = useState(null);

  useEffect(() => {
    fetchUnifiedTests().then((d) => setTests(d.tests || []));
    checkUnifiedAccess().then((r) => setHasAccess(r.hasAccess));
  }, []);

  // NEW: Check if this username don do the LIVE test before
  const live = tests.find((t) => t.status === "live");
  useEffect(() => {
    if (!live?._id || !user.username) {
      setLiveDone(null);
      return;
    }
    fetch(
      `${UNIFIED.API_BASE}/api/unified/tests/${live._id}/attempt?username=${encodeURIComponent(user.username)}`,
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.done) setLiveDone(d);
        else setLiveDone(null);
      })
      .catch(() => setLiveDone(null));
  }, [live?._id, user.username]);

  const upcoming = tests.filter((t) => t.status === "upcoming");
  const past = tests.filter((t) => t.status === "ended");
  const handleViewResult = async (t) => {
    setSelectedPast(t);
    setPastResult(null);
    if (!user.username) return;
    try {
      const r = await fetch(
        `${UNIFIED.API_BASE}/api/unified/tests/${t._id}/attempt?username=${encodeURIComponent(user.username)}`,
      );
      const d = await r.json();
      if (d.done) setPastResult(d);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#070B18] p-4 text-white">
      <div className="max-w-3xl mx-auto">
        <div className="text-center py-6">
          <p className="text-[10px] tracking-[0.3em] text-amber-400 font-bold">
            JAMB • 2GO • LIVE ARENA
          </p>
          <h1
            className="text-3xl font-black mt-1"
            style={{ fontFamily: "Cinzel" }}
          >
            UNIFIED TEST
          </h1>
          <p className="text-slate-400 text-[13px] mt-1">
            Everybody. Same paper. Same time.
          </p>
          {/* NEW: Show logged-in username */}
          {user.username ? (
            <p className="text-[12px] mt-2 text-slate-300">
              👤 Logged in as <b className="text-white">@{user.username}</b>
              {user.fullName ? (
                <span className="text-slate-500"> • {user.fullName}</span>
              ) : (
                ""
              )}
            </p>
          ) : (
            <p className="text-[12px] mt-2 text-red-300">
              ⚠️ Please login first to take Unified Test
            </p>
          )}
        </div>

        {live ? (
          <LiveCard
            live={live}
            hasAccess={hasAccess}
            username={user.username}
            alreadyDone={liveDone}
          />
        ) : (
          <div className="bg-[#121A2E]/60 border border-white/10 rounded-[20px] p-5 mb-4 text-center text-slate-400 text-[13px]">
            No live test right now. Check upcoming below 👇
          </div>
        )}
        {live && (
          <UnifiedLeaderboard
            testId={live._id}
            testTitle={live.title}
            compact={false}
          />
        )}

        <h3 className="text-[11px] tracking-widest font-bold text-slate-500 mb-2"></h3>

        <h3 className="text-[11px] tracking-widest font-bold text-slate-500 mb-2">
          UPCOMING
        </h3>
        {upcoming.length === 0 && (
          <p className="text-slate-500 text-[13px] mb-4">
            No upcoming test announced yet.
          </p>
        )}
        {upcoming.map((t) => (
          <UpcomingCard key={t._id} t={t} />
        ))}

        <h3 className="text-[11px] tracking-widest font-bold text-slate-500 mt-5 mb-2">
          PAST • TROPHY CABINET
        </h3>
        {past.length === 0 && (
          <p className="text-slate-500 text-[13px]">No past tests yet.</p>
        )}
        {past.map((t) => (
          <div
            key={t._id}
            className="bg-[#121A2E]/50 border border-white/10 rounded-[20px] p-4 mb-2 flex justify-between items-center"
          >
            <div>
              <p className="font-bold text-[13px]">{t.title}</p>
              <p className="text-[11px] text-slate-500">
                {new Date(t.startAt).toLocaleDateString()} • 📌 Topic:{" "}
                {t.topic || "all"}
              </p>
            </div>
            <button
              onClick={() => handleViewResult(t)}
              className="text-[11px] bg-amber-400 text-black font-bold px-3 py-1.5 rounded-full cursor-pointer active:scale-95"
            >
              View Result →
            </button>
          </div>
        ))}

        {/* Show result when you click View Result */}
        {selectedPast && (
          <div className="bg-[#121A2E] border border-amber-400/30 rounded-[20px] p-4 mt-4">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-[15px]">
                {selectedPast.title} — Result
              </h3>
              <button
                onClick={() => setSelectedPast(null)}
                className="text-slate-400 text-[12px]"
              >
                ✕ Close
              </button>
            </div>

            {pastResult ? (
              <div className="mt-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center">
                <p className="text-[13px] text-white">
                  @{user.username} — Score:{" "}
                  <b className="text-amber-400">
                    {pastResult.score} / {pastResult.total}
                  </b>
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Your first attempt na the one wey count.
                </p>
              </div>
            ) : (
              <p className="text-[12px] text-slate-400 mt-3">
                You no submit this test — no result for @
                {user.username || "you"}.
              </p>
            )}

            <div className="mt-4">
              <UnifiedLeaderboard
                testId={selectedPast._id}
                testTitle={selectedPast.title}
                compact={false}
              />
            </div>
          </div>
        )}

        <button
          onClick={() => (window.location.href = "/")}
          className="w-full mt-6 py-3 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[13px]"
        >
          ← Back to Palace
        </button>
      </div>
    </div>
  );
}

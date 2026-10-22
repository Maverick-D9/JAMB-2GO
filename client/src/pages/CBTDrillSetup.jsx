import { useState, useEffect } from "react";
import { VITALS } from "../config/vitals";

const API_BASE = VITALS.SYSTEM.API_BASE;

export default function CBTDrillSetup() {
  const [subject, setSubject] = useState("");
  const [topics, setTopics] = useState([]);
  const [counts, setCounts] = useState({});
  const [totalQs, setTotalQs] = useState(0);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(20);
  const [timed, setTimed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [hasSub, setHasSub] = useState(null);
  const [access, setAccess] = useState(null);
  const [checking, setChecking] = useState(true);
  const [paying, setPaying] = useState(false);

  const paidSubjects = [
    "english-room",
    "maths-room",
    "physics-room",
    "chemistry-room",
    "biology-room",
    "economics-room",
    "commerce-room",
    "government-room",
    "literature-room",
    "crs-room",
    "geography-room",
    "agric-room",
    "marketing-room",
    "yoruba-room",
    "irs-room",
    "history-room",
    "accounting-room",
  ];

  const toPlain = (room) => {
    if (!room) return "";
    return room.toLowerCase().replace("-room", "").trim();
  };

  const getUser = () => {
    try {
      return JSON.parse(localStorage.getItem("jambite_user") || "{}");
    } catch {
      return {};
    }
  };

  useEffect(() => {
    const u = getUser();
    const emailToUse = u.email || u.userId || u.username;
    if (!emailToUse) {
      setHasSub(false);
      setChecking(false);
      return;
    }
    fetch(`${API_BASE}/api/payment/access/${encodeURIComponent(emailToUse)}`)
      .then((r) => r.json())
      .then((d) => {
        setAccess(d);
        setHasSub(d.tier === "full_access");
        setChecking(false);
      })
      .catch(() => {
        setHasSub(false);
        setChecking(false);
      });
  }, []);

  useEffect(() => {
    if (!subject) {
      setTopics([]);
      setCounts({});
      setTotalQs(0);
      setTopic("");
      return;
    }
    const plain = toPlain(subject);
    const fetchTopics = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/drill/topics/${plain}`);
        const d = await res.json();
        setTopics(d.topics || []);
        setCounts(d.counts || {});
        setTotalQs(d.totalQs || 0);
        if (d.topics && d.topics.length > 0) setTopic(d.topics[0]);
        else setTopic("");
      } catch {
        setTopics([]);
        setCounts({});
        setTotalQs(0);
      }
    };
    fetchTopics();
  }, [subject]);

  const handlePay = async () => {
    const u = getUser();
    const userId = u.userId || u.username;
    const email = u.email;
    if (!email) return alert("Login first");
    setPaying(true);
    try {
      const res = await fetch(`${API_BASE}/api/payment/subscribe/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email }),
      });
      const data = await res.json();
      const authUrl = data.data?.authorization_url || data.authorization_url;
      const ref = data.data?.reference || data.reference;
      if (authUrl) {
        if (ref) localStorage.setItem("paystack_ref", ref);
        window.location.href = authUrl;
      } else {
        alert("Failed to init");
        setPaying(false);
      }
    } catch (e) {
      alert(e.message);
      setPaying(false);
    }
  };

  const startDrill = async () => {
    if (!subject || !topic) return alert("Select subject and topic");
    setLoading(true);
    const u = getUser();
    const userEmail = u?.email;
    const userId = u?.userId || u?.id || u?.username || "";
    const plain = toPlain(subject);
    if (!userEmail) {
      setLoading(false);
      return alert("Please login again - email missing");
    }
    try {
      const res = await fetch(
        `${API_BASE}/api/drill/questions?subject=${plain}&topic=${encodeURIComponent(topic)}&count=${count}&email=${encodeURIComponent(userEmail)}&userId=${encodeURIComponent(userId)}`,
        {
          headers: {
            "x-user-email": userEmail,
          },
        },
      );
      const data = await res.json();
      setLoading(false);
      if (data.error) {
        if (data.code === "ACCESS_DENIED")
          return alert(VITALS.MESSAGES.ACCESS_DENIED_SUB);
        return alert(data.error);
      }
      if (!data.questions || data.questions.length === 0)
        return alert("No questions found");
      localStorage.setItem("drillQuestions", JSON.stringify(data.questions));
      localStorage.setItem(
        "drillConfig",
        JSON.stringify({
          subject: plain,
          originalSubject: subject,
          topic,
          count,
          timed,
          timePerQ: 60,
          availableQs: counts[topic] || 0,
        }),
      );
      window.location.href = "/cbt-drill-run";
    } catch {
      setLoading(false);
      alert("Server error - is backend running on port 5000?");
    }
  };

  if (checking)
    return (
      <div className="min-h-screen bg-[#070B18] grid place-items-center text-slate-400">
        {VITALS.MESSAGES.CHECKING_PASS}
      </div>
    );

  if (hasSub === false) {
    return (
      <div className="min-h-screen w-full bg-[#070B18] grid place-items-center p-4">
        <div className="max-w-[480px] w-full bg-white rounded-[24px] p-7 text-center">
          <div className="text-[40px]">🎯</div>
          <h2 className="text-[22px] font-black mt-2">
            {VITALS.MESSAGES.DRILL_LOCKED_TITLE}
          </h2>
          <p className="text-[13px] text-slate-500 mt-2">
            Unlock{" "}
            <b>
              {VITALS.SUBSCRIPTION.DISPLAY_COMMA}/month{" "}
              {VITALS.SUBSCRIPTION.NAME}
            </b>{" "}
            to access Drill Palace + CBT + All Live Rooms.
          </p>
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-left text-[12px] grid gap-1">
            <div>✅ Topic-by-topic drills</div>
            <div>✅ All subjects & topics</div>
            <div>✅ Timed & practice modes</div>
            <div>✅ Unlimited attempts</div>
          </div>
          <button
            onClick={handlePay}
            disabled={paying}
            className="w-full mt-5 py-4 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black"
          >
            {paying ? "Opening Paystack..." : VITALS.MESSAGES.PAY_BUTTON_FULL}
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="mt-3 text-[12px] text-slate-500"
          >
            ← Back to Palace
          </button>
          <p className="text-[11px] text-slate-400 mt-3">
            One pass: Live + CBT + Drill • {access?.status || "free"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#070B18] text-white relative overflow-hidden">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&display=swap');`}</style>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-[700px] h-[500px] -top-[150px] -left-[150px] bg-[radial-gradient(ellipse_at_center,_rgba(56,189,248,0.18),_transparent_65%)] blur-[40px]" />
        <div className="absolute w-[500px] h-[500px] top-[30%] right-[-150px] bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.18),_transparent_65%)] blur-[40px]" />
      </div>

      <div className="w-full max-w-[98vw] mx-auto px-3 md:px-6 py-4 relative z-10">
        <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center bg-[#121A2E]/70 backdrop-blur-xl border border-white/10 rounded-[20px] p-5 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 grid place-items-center font-black text-black text-xl">
              🎯
            </div>
            <div>
              <h1
                className="text-xl md:text-2xl font-black tracking-tight"
                style={{ fontFamily: "Cinzel" }}
              >
                Topic Drill Mode
              </h1>
              <p className="text-[11px] text-slate-400 tracking-widest uppercase mt-1">
                {subject
                  ? `${toPlain(subject).toUpperCase()} • ${topics.length} TOPICS • ${totalQs} Qs TOTAL`
                  : `Quick 10-40 Qs focus practice`}{" "}
                • ✅ {VITALS.MESSAGES.PASS_BADGE} • {access?.daysLeft || 0}d
                left
              </p>
            </div>
          </div>
          <button
            onClick={() => (window.location.href = "/")}
            className="px-5 py-2.5 bg-[#0F172A] border border-white/10 rounded-full text-[13px] font-bold"
          >
            ← Lobby
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5 w-full">
          <div className="grid gap-4">
            <div className="bg-[#121A2E]/70 backdrop-blur-xl border border-white/10 rounded-[20px] p-5">
              <label className="text-[10px] tracking-[0.14em] font-bold text-slate-500 uppercase">
                Select Subject Room
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mt-3">
                {paidSubjects.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSubject(s)}
                    className={`px-3 py-3 rounded-xl text-[11px] font-black border transition ${subject === s ? "bg-sky-400 text-black border-sky-400" : "bg-[#0B0F1E] border-white/10 text-slate-400 hover:text-white"}`}
                  >
                    {s.toUpperCase().replace("-ROOM", "")}{" "}
                    {subject === s && totalQs > 0 ? `• ${totalQs}` : ""}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#121A2E]/70 backdrop-blur-xl border border-white/10 rounded-[20px] p-5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] tracking-[0.14em] font-bold text-slate-500 uppercase">
                  Topic {topics.length > 0 && `(${topics.length})`} •{" "}
                  {toPlain(subject).toUpperCase() || "Select Subject First"}
                </label>
                {totalQs > 0 && (
                  <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/20 text-emerald-400">
                    {totalQs} Qs total
                  </span>
                )}
              </div>
              {topics.length === 0 ? (
                <div className="mt-3 p-6 text-center border border-dashed border-white/10 rounded-xl">
                  <p className="text-slate-500 text-sm">
                    {subject
                      ? `No topics for ${toPlain(subject)}`
                      : "Select a subject to load topics"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-3">
                  {topics.map((t) => {
                    const c = counts[t] || 0;
                    return (
                      <button
                        key={t}
                        onClick={() => setTopic(t)}
                        className={`flex justify-between items-center px-4 py-3 rounded-xl text-[12px] font-bold border transition ${topic === t ? "bg-white text-black border-white" : "bg-[#0B0F1E] border-white/10 text-slate-300"}`}
                      >
                        <span>{t}</span>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-black ${topic === t ? "bg-black text-white" : "bg-sky-400/15 text-sky-400"}`}
                        >
                          {c} Qs
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#121A2E]/80 backdrop-blur-xl border border-sky-500/20 rounded-[20px] p-5 h-fit lg:sticky lg:top-5">
            <h3
              className="font-black text-[13px]"
              style={{ fontFamily: "Cinzel" }}
            >
              DRILL CONFIG
            </h3>
            <div className="mt-4 p-3 rounded-xl bg-[#0B0F1E] border border-white/5 flex justify-between items-center">
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  Current
                </div>
                <div className="font-black text-sm mt-1">
                  {toPlain(subject).toUpperCase() || "..."} /{" "}
                  <span className="text-sky-400">{topic || "..."}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  Available
                </div>
                <div className="font-black text-emerald-400">
                  {counts[topic] || 0} Qs
                </div>
              </div>
            </div>
            <label className="text-[10px] tracking-widest font-bold text-slate-500 uppercase mt-5 block">
              Question Count
            </label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {[10, 20, 40, "All"].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`py-3 rounded-xl font-black text-[13px] border transition ${count === n ? "bg-sky-400 text-black border-sky-400" : "bg-[#0B0F1E] border-white/10 text-slate-400"}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-3 p-3.5 border border-white/10 bg-[#0B0F1E] rounded-xl mt-5 cursor-pointer">
              <input
                type="checkbox"
                checked={timed}
                onChange={(e) => setTimed(e.target.checked)}
                className="w-5 h-5 accent-sky-400"
              />
              <div>
                <div className="font-bold text-sm">Timed Mode</div>
                <div className="text-[11px] text-slate-500">
                  60s per question
                </div>
              </div>
            </label>
            <button
              onClick={startDrill}
              disabled={loading || !topic}
              className="w-full mt-5 py-4 bg-gradient-to-r from-sky-400 to-blue-500 text-black rounded-xl font-black text-[15px] disabled:opacity-40"
            >
              {loading
                ? "Loading..."
                : `Start ${topic ? `${topic} (${counts[topic] || 0})` : "Drill"} 🚀`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import ReviewFab from "../components/ReviewFab.jsx";

export default function CBTDrill() {
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const qs = JSON.parse(localStorage.getItem("drillQuestions") || "[]");
    const cfg = JSON.parse(localStorage.getItem("drillConfig") || "{}");
    if (qs.length === 0) {
      alert("No drill found, go back");
      window.location.href = "/cbt-drill";
      return;
    }
    setQuestions(qs);
    setConfig(cfg);
    if (cfg.timed) setTimeLeft(qs.length * (cfg.timePerQ || 60));
  }, []);

  useEffect(() => {
    if (!config?.timed || timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          finishDrill();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [timeLeft, config]);

  const selectAnswer = (opt) => setAnswers({ ...answers, [index]: opt });

  const finishDrill = () => {
    localStorage.setItem("drillAnswers", JSON.stringify(answers));
    window.location.href = "/cbt-drill-result";
  };

  if (!questions.length) return null;
  const q = questions[index];
  const progress = ((index + 1) / questions.length) * 100;
  const formatTime = (s) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen w-full bg-[#070B18] text-white relative overflow-hidden">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&display=swap');`}</style>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-[600px] h-[400px] -top-[100px] left-[20%] bg-[radial-gradient(ellipse_at_center,_rgba(56,189,248,0.18),_transparent_70%)] blur-[40px]" />
      </div>

      {/* TOP BAR - NOW FULL WIDTH */}
      <div className="sticky top-0 z-20 bg-[#070B18]/90 backdrop-blur-xl border-b border-white/10 w-full">
        <div className="w-full max-w-[98vw] mx-auto px-3 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (confirm("Quit drill?")) window.location.href = "/cbt-drill";
              }}
              className="w-9 h-9 rounded-full bg-[#121A2E] border border-white/10 flex items-center justify-center hover:border-white/20"
            >
              ✕
            </button>
            <div>
              <div
                className="text-[10px] tracking-[0.14em] text-emerald-400 font-black uppercase"
                style={{ fontFamily: "Cinzel" }}
              >
                {config?.topic} • {config?.subject?.toUpperCase()}
              </div>
              <div className="text-[13px] md:text-sm font-black">
                Q {index + 1} of {questions.length}{" "}
                <span className="text-slate-500 font-bold">
                  • {answeredCount} answered
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex px-3 py-1.5 rounded-full bg-[#121A2E] border border-white/10 text-[11px] font-bold text-slate-400">
              {config?.mode || "DRILL"} • {questions.length} Qs
            </div>
            {config?.timed && (
              <div
                className={`px-4 py-2 rounded-full text-sm font-black border backdrop-blur-xl ${timeLeft < 60 ? "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse" : "bg-sky-400/15 text-sky-400 border-sky-400/30"}`}
              >
                ⏱ {formatTime(timeLeft)}
              </div>
            )}
          </div>
        </div>
        <div className="h-[3px] w-full bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* QUESTION - WIDER, NO SIDE SPACE */}
      <div className="w-full max-w-[98vw] mx-auto px-2 md:px-4 py-4 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* MAIN CARD */}
        <div className="w-full">
          <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-none">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 min-w-[10px] rounded-full transition-all ${i < index ? "bg-emerald-400/60" : ""} ${i === index ? "bg-emerald-400 h-2.5" : ""} ${i > index ? "bg-white/10" : ""} ${answers[i] ? "!bg-white" : ""}`}
              />
            ))}
          </div>

          <div className="bg-[#121A2E]/80 backdrop-blur-xl border border-white/10 rounded-[24px] md:rounded-[28px] p-5 md:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
            <div
              className="inline-flex px-3 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/20 text-[10px] font-black tracking-widest text-emerald-400 mb-4"
              style={{ fontFamily: "Cinzel" }}
            >
              Q{index + 1} • {config?.topic?.toUpperCase()}
            </div>

            <div
              className="text-[19px] md:text-[22px] font-bold leading-[1.35] mb-7"
              dangerouslySetInnerHTML={{
                __html: q.question_text || q.question,
              }}
            />

            <div className="grid gap-3">
              {["A", "B", "C", "D"].map((k) => {
                const key = `option_${k.toLowerCase()}`;
                const val = q[key] || q[k] || q[`option_${k}`] || "";
                if (!val) return null;
                const isSelected = answers[index] === k;
                return (
                  <button
                    key={k}
                    onClick={() => selectAnswer(k)}
                    className={`group text-left p-4 md:p-5 rounded-2xl border-2 flex gap-4 items-start transition-all ${isSelected ? "bg-emerald-400 border-emerald-400 text-black scale-[1.01]" : "bg-[#0C1224] border-white/10 hover:border-emerald-400/30 hover:bg-[#0F172A]"}`}
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${isSelected ? "bg-black text-white" : "bg-white/10 text-emerald-400 group-hover:bg-white/15"}`}
                    >
                      {k}
                    </div>
                    <span
                      className={`pt-1 leading-snug ${isSelected ? "font-black" : ""}`}
                    >
                      {val}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/5">
              <button
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className="px-5 py-3 rounded-xl bg-[#0C1224] border border-white/10 disabled:opacity-30 font-bold text-sm"
              >
                ← Prev
              </button>
              <div className="text-xs text-slate-500 font-bold tracking-widest">
                {index + 1} / {questions.length}
              </div>
              {index === questions.length - 1 ? (
                <button
                  onClick={finishDrill}
                  className="px-7 py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-black font-black shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition"
                >
                  Finish 🏁
                </button>
              ) : (
                <button
                  onClick={() => setIndex((i) => i + 1)}
                  className="px-7 py-3 rounded-xl bg-white text-black font-black hover:bg-slate-100 transition"
                >
                  Next →
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PALETTE - FULL WIDTH ON MOBILE, SIDEBAR ON DESKTOP */}
        <div className="bg-[#121A2E]/60 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 h-fit lg:sticky lg:top-[76px]">
          <div className="flex justify-between items-center mb-3">
            <div className="text-[11px] font-black tracking-widest text-slate-500 uppercase">
              Question Map
            </div>
            <div className="text-[11px] font-bold px-2 py-1 rounded-full bg-white/5 border border-white/10">
              {answeredCount}/{questions.length}
            </div>
          </div>
          <div className="grid grid-cols-8 lg:grid-cols-5 gap-2">
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`aspect-square rounded-xl text-[12px] font-black border transition ${i === index ? "bg-white text-black border-white scale-105" : answers[i] ? "bg-emerald-400/20 text-emerald-400 border-emerald-400/30" : "bg-[#0B0F1E] border-white/10 text-slate-500 hover:border-white/20"}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button
            onClick={finishDrill}
            className="w-full mt-4 py-3 rounded-xl bg-[#0B0F1E] border border-white/10 font-bold text-sm text-slate-300 hover:text-white"
          >
            Submit Drill
          </button>
          <p className="text-center text-[10px] text-slate-500 mt-3 tracking-widest uppercase">
            Palace Drill • {config?.topic}
          </p>
        </div>
      </div>
      <ReviewFab />
    </div>
  );
}

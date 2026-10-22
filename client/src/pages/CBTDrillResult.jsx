import { useEffect, useState } from "react";
import ReviewFab from "../components/ReviewFab.jsx";

export default function CBTDrillResult() {
  const [result, setResult] = useState(null);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const qs = JSON.parse(localStorage.getItem("drillQuestions") || "[]");
    const ans = JSON.parse(localStorage.getItem("drillAnswers") || "{}");
    const cfg = JSON.parse(localStorage.getItem("drillConfig") || "{}");
    setConfig(cfg);

    let correct = 0;
    qs.forEach((q, idx) => {
      const userAns = ans[idx];
      const correctAns = (q.correct_answer || q.correct || q.answer || "")
        .toString()
        .trim()
        .toUpperCase();
      if (userAns === correctAns) correct++;
    });

    const total = qs.length;
    const percent = total ? Math.round((correct / total) * 100) : 0;
    setResult({
      correct,
      total,
      percent,
      wrong: total - correct,
      answers: ans,
      questions: qs,
    });
  }, []);

  if (!result)
    return (
      <div className="min-h-screen bg-[#070B18] grid place-items-center text-white">
        Calculating...
      </div>
    );

  const getRemark = (p) => {
    if (p >= 80)
      return {
        text: "Palace Master! 👑",
        sub: "You don master this topic",
        color: "from-sky-400 to-blue-500",
      };
    if (p >= 60)
      return {
        text: "Strong! 💪",
        sub: "Small remaining, you go ace am",
        color: "from-emerald-400 to-teal-500",
      };
    if (p >= 40)
      return {
        text: "You dey come 📚",
        sub: "Review your weak spots",
        color: "from-amber-400 to-orange-500",
      };
    return {
      text: "Keep grinding! 🔥",
      sub: "Drill again, no gree",
      color: "from-red-400 to-rose-500",
    };
  };

  const remark = getRemark(result.percent);
  const circ = 2 * Math.PI * 84;
  const offset = circ - (result.percent / 100) * circ;

  return (
    <div className="min-h-screen bg-[#070B18] text-white">
      <div className="max-w-[520px] mx-auto p-5">
        {/* Header */}
        <div className="text-center mt-4 mb-6">
          <div className="inline-flex px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold tracking-widest text-slate-400 uppercase">
            {config?.subject?.toUpperCase()} • {config?.topic}
          </div>
          <h1 className="text-3xl font-black mt-3">Drill Complete!</h1>
          <p className="text-slate-400 text-sm mt-1">{remark.sub}</p>
        </div>

        {/* Score Ring */}
        <div className="bg-[#121A2E] border border-white/10 rounded-[32px] p-7 mb-5">
          <div className="flex justify-center">
            <div className="relative w-[200px] h-[200px]">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 180 180">
                <circle
                  cx="90"
                  cy="90"
                  r="84"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="12"
                />
                <circle
                  cx="90"
                  cy="90"
                  r="84"
                  fill="none"
                  stroke="url(#grad)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={offset}
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop
                      offset="0%"
                      stopColor={
                        result.percent >= 80
                          ? "#38bdf8"
                          : result.percent >= 50
                            ? "#34d399"
                            : "#f87171"
                      }
                    />
                    <stop
                      offset="100%"
                      stopColor={
                        result.percent >= 80
                          ? "#3b82f6"
                          : result.percent >= 50
                            ? "#10b981"
                            : "#ef4444"
                      }
                    />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <div className="text-[54px] font-black leading-none">
                    {result.percent}%
                  </div>
                  <div className="text-[13px] font-bold tracking-widest text-slate-400 mt-1">
                    {result.correct}/{result.total} CORRECT
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-5">
            <div
              className={`inline-flex px-4 py-2 rounded-full bg-gradient-to-r ${remark.color} text-black font-black text-sm`}
            >
              {remark.text}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-7">
            <div className="bg-[#0C1224] border border-white/10 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-emerald-400">
                {result.correct}
              </div>
              <div className="text-[11px] font-bold tracking-widest text-slate-500">
                CORRECT
              </div>
            </div>
            <div className="bg-[#0C1224] border border-white/10 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-red-400">
                {result.wrong}
              </div>
              <div className="text-[11px] font-bold tracking-widest text-slate-500">
                WRONG
              </div>
            </div>
            <div className="bg-[#0C1224] border border-white/10 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-white">
                {result.total}
              </div>
              <div className="text-[11px] font-bold tracking-widest text-slate-500">
                TOTAL
              </div>
            </div>
          </div>
        </div>

        {/* Topic breakdown */}
        <div className="bg-[#121A2E]/60 border border-white/10 rounded-2xl p-4 flex justify-between items-center mb-6">
          <div>
            <div className="text-xs text-slate-400 font-bold tracking-widest">
              TOPIC
            </div>
            <div className="font-black">{config?.topic}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400 font-bold tracking-widest">
              MODE
            </div>
            <div className="font-bold text-sm">
              {config?.timed ? "Timed 60s/q" : "Untimed"}
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <button
            onClick={() => (window.location.href = "/cbt-drill-review")}
            className="w-full py-4 rounded-2xl bg-white text-black font-black text-[15px] flex items-center justify-center gap-2"
          >
            Review Answers <span>📝</span>
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => (window.location.href = "/cbt-drill")}
              className="py-4 rounded-2xl bg-sky-400 text-black font-black"
            >
              Drill Again 🔁
            </button>
            <button
              onClick={() => (window.location.href = "/cbt-drill")}
              className="py-4 rounded-2xl bg-[#121A2E] border border-white/10 font-bold"
            >
              New Topic 🎯
            </button>
          </div>
          <button
            onClick={() => (window.location.href = "/")}
            className="w-full py-3 text-slate-500 text-sm"
          >
            ← Back to Lobby
          </button>
        </div>
      </div>
      <ReviewFab />
    </div>
  );
}

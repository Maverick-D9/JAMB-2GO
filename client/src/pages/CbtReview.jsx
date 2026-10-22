import { useEffect, useState } from "react";
import { VITALS } from "../config/vitals";

const API_BASE = VITALS.SYSTEM.API_BASE;

export default function CbtReview() {
  const [data, setData] = useState(null);
  const [subject, setSubject] = useState("english");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const getAttemptIdFromUrl = () => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && last !== "cbt-review") return last;
    const params = new URLSearchParams(window.location.search);
    return params.get("attemptId");
  };

  useEffect(() => {
    const paramId = getAttemptIdFromUrl();
    const attemptId =
      paramId ||
      localStorage.getItem("lastAttemptId") ||
      JSON.parse(localStorage.getItem("cbt_result") || "{}").attemptId;
    if (!attemptId) {
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/api/cbt/review/${attemptId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error);
        setData(res);
        const firstSub =
          Object.keys(res.questionsSnapshot || {})[0] || "english";
        setSubject(firstSub);
        setLoading(false);
      })
      .catch(() => {
        const local = JSON.parse(localStorage.getItem("cbt_result") || "{}");
        if (local.questions) {
          setData({
            attemptId,
            userAnswers: local.answers || {},
            questionsSnapshot: local.questions,
            totalScore: local.jambScore || local.totalScore,
            rawScore: local.score,
            rawTotal: local.total,
          });
          setSubject(Object.keys(local.questions)[0]);
        }
        setLoading(false);
      });
  }, []);

  if (loading)
    return (
      <div className="min-h-screen bg-[#080C18] grid place-items-center text-slate-400">
        Opening Royal Scroll...
      </div>
    );
  if (!data)
    return (
      <div className="min-h-screen bg-[#080C18] grid place-items-center text-slate-400">
        No review found. Do an exam first.
      </div>
    );

  const qs = data.questionsSnapshot?.[subject] || [];
  const userAnswers = data.userAnswers || {};

  const stats = { correct: 0, wrong: 0, unanswered: 0 };
  qs.forEach((q) => {
    const ua = userAnswers[q.id];
    if (!ua) stats.unanswered++;
    else if (ua.toUpperCase() === q.correct_answer.toUpperCase())
      stats.correct++;
    else stats.wrong++;
  });

  const filtered = qs.filter((q) => {
    if (filter === "all") return true;
    const ua = userAnswers[q.id];
    if (filter === "correct")
      return ua && ua.toUpperCase() === q.correct_answer.toUpperCase();
    if (filter === "wrong")
      return ua && ua.toUpperCase() !== q.correct_answer.toUpperCase();
    if (filter === "unanswered") return !ua;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#080C18] font-['Inter',sans-serif] relative overflow-hidden">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&family=Cinzel:wght@700;800&display=swap');`}</style>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-[700px] h-[500px] -top-[100px] -left-[100px] bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.20),_transparent_65%)] blur-[30px]" />
        <div className="absolute w-[600px] h-[600px] bottom-0 right-0 bg-[radial-gradient(ellipse_at_center,_rgba(251,191,36,0.12),_transparent_65%)] blur-[40px]" />
      </div>

      <div className="relative z-10 max-w-[900px] mx-auto p-4">
        <div className="bg-[#121A2E]/80 backdrop-blur-xl border border-white/10 rounded-[20px] p-5 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1
                className="text-white font-black text-[20px]"
                style={{ fontFamily: "Cinzel" }}
              >
                ROYAL REVIEW 👑
              </h1>
              <p className="text-slate-400 text-[12px] mt-1">
                Attempt: {data.attemptId} • Score: {data.totalScore}/400 •{" "}
                {data.rawScore}/{data.rawTotal}
              </p>
            </div>
            <button
              onClick={() => (window.location.href = "/cbt-result")}
              className="px-4 py-2 rounded-full bg-white/10 border border-white/10 text-white text-[12px] font-bold"
            >
              ← Back to Result
            </button>
          </div>
          <div className="flex gap-2 mt-4">
            <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
              ✅ Correct: {stats.correct}
            </div>
            <div className="px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-[11px] font-bold">
              ❌ Wrong: {stats.wrong}
            </div>
            <div className="px-3 py-1.5 rounded-full bg-slate-500/20 border border-white/10 text-slate-300 text-[11px] font-bold">
              ⚪ Unanswered: {stats.unanswered}
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3">
          {Object.keys(data.questionsSnapshot || {}).map((sub) => {
            const active = subject === sub;
            return (
              <button
                key={sub}
                onClick={() => setSubject(sub)}
                className={`px-4 py-2 rounded-full font-extrabold text-[11px] uppercase border ${active ? "bg-amber-400 text-black border-amber-400" : "bg-[#121A2E]/70 text-slate-400 border-white/10"}`}
              >
                {sub}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 mb-4">
          {["all", "correct", "wrong", "unanswered"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border capitalize ${filter === f ? "bg-white text-black border-white" : "bg-[#0F172A] text-slate-400 border-white/10"}`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="grid gap-4">
          {filtered.map((q, idx) => {
            const userAns = userAnswers[q.id];
            const isCorrect =
              userAns &&
              userAns.toUpperCase() === q.correct_answer.toUpperCase();
            const isWrong = userAns && !isCorrect;
            return (
              <div
                key={q.id || idx}
                className={`bg-[#121A2E]/80 backdrop-blur-xl border rounded-[20px] p-5 ${isCorrect ? "border-emerald-500/30" : ""} ${isWrong ? "border-red-500/30" : ""} ${!userAns ? "border-white/10" : ""}`}
              >
                <div className="text-white font-semibold text-[14px] leading-[1.6]">
                  <span
                    className="text-amber-400 font-black mr-2"
                    style={{ fontFamily: "Cinzel" }}
                  >
                    Q{idx + 1}.
                  </span>
                  {q.question_text}
                </div>
                <div className="grid gap-2 mt-4">
                  {["A", "B", "C", "D"].map((letter) => {
                    const txt = q[`option_${letter.toLowerCase()}`];
                    const isUserPick = userAns === letter;
                    const isRightAnswer = q.correct_answer === letter;
                    let cls = "bg-[#0F172A] border-white/10 text-white";
                    if (isRightAnswer)
                      cls =
                        "bg-emerald-500/15 border-emerald-400/50 text-emerald-200";
                    if (isUserPick && !isRightAnswer)
                      cls = "bg-red-500/15 border-red-400/50 text-red-200";
                    return (
                      <div
                        key={letter}
                        className={`flex gap-3 p-3 rounded-xl border ${cls}`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full grid place-items-center font-black text-[11px] flex-shrink-0 ${isRightAnswer ? "bg-emerald-400 text-black" : isUserPick ? "bg-red-400 text-black" : "bg-[#1e293b] text-slate-400"}`}
                        >
                          {letter}
                        </div>
                        <span className="text-[13px]">{txt}</span>
                        <span className="ml-auto text-[11px] font-bold">
                          {isRightAnswer && "✅ Correct"}
                          {isUserPick && !isRightAnswer && `❌ You picked`}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {!userAns && (
                  <div className="mt-3 text-[11px] text-slate-500">
                    ⚪ You did not answer this.
                  </div>
                )}
                {q.explanation && (
                  <div className="mt-4 p-3 rounded-xl bg-amber-400/10 border border-amber-400/20">
                    <div
                      className="text-amber-300 font-bold text-[11px] tracking-widest"
                      style={{ fontFamily: "Cinzel" }}
                    >
                      ROYAL EXPLANATION
                    </div>
                    <div className="text-slate-300 text-[13px] mt-1 leading-[1.5]">
                      {q.explanation}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

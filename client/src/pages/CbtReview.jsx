import { useEffect, useState } from "react";
import { VITALS } from "../config/vitals";

const API_BASE = VITALS.SYSTEM.API_BASE;

export default function CbtReview() {
  const [data, setData] = useState(null);
  const [subject, setSubject] = useState("english");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [debugMsg, setDebugMsg] = useState("");

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
      JSON.parse(localStorage.getItem("cbt_result") || "{}").attemptId ||
      JSON.parse(localStorage.getItem("lastCbtResult") || "{}").attemptId;

    const buildFromLocal = () => {
      // 1. NEW: Your actual keys from screenshot: cbt_exam holds questions, cbt_result holds answers
      try {
        const examRaw = localStorage.getItem("cbt_exam");
        const resultRaw = localStorage.getItem("cbt_result");
        if (examRaw && resultRaw) {
          const exam = JSON.parse(examRaw);
          const result = JSON.parse(resultRaw);
          const qs =
            exam.questions ||
            exam.questionsSnapshot ||
            exam.questionsData ||
            exam;
          const answers =
            result.answers || result.userAnswers || result.userAns || {};
          // qs should be object like {english:[...], maths:[...]}
          if (
            qs &&
            typeof qs === "object" &&
            Object.keys(qs).length > 0 &&
            (qs.english || qs.maths || qs.mathematics)
          ) {
            console.log(
              `ROYAL REVIEW: Found data in cbt_exam + cbt_result`,
              qs,
            );
            return {
              attemptId: result.attemptId || attemptId,
              userAnswers: answers,
              questionsSnapshot: qs,
              totalScore:
                result.jambScore || result.totalScore || result.score || 0,
              rawScore: result.score || result.rawScore || 0,
              rawTotal: result.total || result.rawTotal || 0,
            };
          }
          // Also handle if exam itself is the questions object directly
          if (Array.isArray(qs)) {
            // edge case: single subject array
            return {
              attemptId: result.attemptId || attemptId,
              userAnswers: answers,
              questionsSnapshot: { english: qs },
              totalScore: result.jambScore || result.totalScore || 0,
              rawScore: result.score || 0,
              rawTotal: result.total || 0,
            };
          }
        }
      } catch (e) {
        console.log("cbt_exam parse error", e);
      }

      // 2. OLD KEYS - fallback
      const keys = [
        "cbt_result",
        "lastCbtResult",
        "cbt_exam_result",
        "cbtResult",
        "last_result",
      ];
      for (const key of keys) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const local = JSON.parse(raw);
          const qs =
            local.questions || local.questionsSnapshot || local.questionsData;
          const answers = local.answers || local.userAnswers || local.userAns;
          if (qs && Object.keys(qs).length > 0) {
            console.log(`ROYAL REVIEW: Found data in ${key}`, qs);
            return {
              attemptId: local.attemptId || attemptId,
              userAnswers: answers || {},
              questionsSnapshot: qs || {},
              totalScore:
                local.jambScore || local.totalScore || local.score || 0,
              rawScore: local.score || local.rawScore || 0,
              rawTotal: local.total || local.rawTotal || 0,
            };
          }
        } catch (e) {}
      }

      try {
        const qRaw = localStorage.getItem("cbt_questions");
        const aRaw = localStorage.getItem("cbt_answers");
        if (qRaw) {
          return {
            attemptId,
            userAnswers: aRaw ? JSON.parse(aRaw) : {},
            questionsSnapshot: JSON.parse(qRaw),
            totalScore: 0,
            rawScore: 0,
            rawTotal: 0,
          };
        }
      } catch (e) {}
      return null;
    };

    // PRIORITY: LocalStorage first (saves Mongo, instant)
    const localData = buildFromLocal();
    if (localData) {
      setData(localData);
      setSubject(
        Object.keys(localData.questionsSnapshot || {})[0] || "english",
      );
      setDebugMsg("Loaded from localStorage (0 Mongo cost) 👑");
      setLoading(false);
      return; // Don't even call backend
    }

    // Only if local fails, try backend
    if (!attemptId) {
      setLoading(false);
      setDebugMsg("No attemptId found");
      return;
    }

    fetch(`${API_BASE}/api/cbt/review/${attemptId}`)
      .then((r) => r.json())
      .then((res) => {
        console.log("Review API response:", res);
        if (
          res.questionsSnapshot &&
          Object.keys(res.questionsSnapshot).length > 0
        ) {
          setData(res);
          setSubject(Object.keys(res.questionsSnapshot)[0] || "english");
          setDebugMsg("Loaded from backend (local not found)");
        } else {
          setDebugMsg(
            `Backend empty + no local for ${attemptId}. Keys: ${Object.keys(localStorage).join(", ")}`,
          );
          setData(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setDebugMsg(
          `Fetch failed + no local. Keys: ${Object.keys(localStorage).join(", ")}`,
        );
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
      <div className="min-h-screen bg-[#080C18] grid place-items-center text-slate-400 p-4 text-center">
        No review found. {debugMsg}
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
              {debugMsg && (
                <p className="text-amber-300 text-[10px] mt-1">{debugMsg}</p>
              )}
            </div>
            <button
              onClick={() => (window.location.href = "/cbt-result")}
              className="px-4 py-2 rounded-full bg-white/10 border border-white/10 text-white text-[12px] font-bold"
            >
              ← Back
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
          {Object.keys(data.questionsSnapshot || {}).map((sub) => (
            <button
              key={sub}
              onClick={() => setSubject(sub)}
              className={`px-4 py-2 rounded-full font-extrabold text-[11px] uppercase border ${subject === sub ? "bg-amber-400 text-black border-amber-400" : "bg-[#121A2E]/70 text-slate-400 border-white/10"}`}
            >
              {sub}
            </button>
          ))}
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
          {filtered.length === 0 && (
            <div className="text-center text-slate-500 py-10">
              No questions for this filter. Total in subject: {qs.length}
              <br />
              Debug: {debugMsg}
            </div>
          )}
          {filtered.map((q, idx) => {
            const userAns = userAnswers[q.id];
            const isCorrect =
              userAns &&
              userAns.toUpperCase() === q.correct_answer.toUpperCase();
            const isWrong = userAns && !isCorrect;
            return (
              <div
                key={q.id || idx}
                className={`bg-[#121A2E]/80 border rounded-[20px] p-5 ${isCorrect ? "border-emerald-500/30" : ""} ${isWrong ? "border-red-500/30" : ""} ${!userAns ? "border-white/10" : ""}`}
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
                          className={`w-7 h-7 rounded-full grid place-items-center font-black text-[11px] ${isRightAnswer ? "bg-emerald-400 text-black" : isUserPick ? "bg-red-400 text-black" : "bg-[#1e293b] text-slate-400"}`}
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
                    <div className="text-slate-300 text-[13px] mt-1">
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

import { useState, useEffect, useMemo, useRef } from "react";
import { VITALS } from "../config/vitals";

const API_BASE = VITALS.SYSTEM.API_BASE;
const JAMB_MAX = VITALS.CBT?.JAMB_MAX_SCORE || 400;

export default function CBTExam() {
  const [examData, setExamData] = useState(null);
  const [currentSubject, setCurrentSubject] = useState("english");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalDuration, setTotalDuration] = useState(7200);
  const [showCalc, setShowCalc] = useState(false);
  const [calcVal, setCalcVal] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const submitRef = useRef(false);
  const answersRef = useRef({});
  const timeLeftRef = useRef(0);
  const totalDurationRef = useRef(7200);

  // Keep refs in sync for auto-submit inside interval
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);
  useEffect(() => {
    totalDurationRef.current = totalDuration;
  }, [totalDuration]);

  // --- LOAD + RESUME ---
  useEffect(() => {
    const saved = localStorage.getItem("cbt_exam");
    if (!saved) {
      alert("No exam found. Go to setup.");
      window.location.href = "/cbt-setup";
      return;
    }
    try {
      const data = JSON.parse(saved);
      setExamData(data);
      const duration =
        (data.durationMinutes || data.config?.durationMinutes || 120) * 60;
      setTotalDuration(duration);

      // Restore progress
      let restoredSubject = data.subjects?.[0] || "english";
      let restoredIndex = 0;
      let restoredAnswers = {};
      try {
        const p = JSON.parse(localStorage.getItem("cbt_progress") || "{}");
        if (p.currentSubject) restoredSubject = p.currentSubject;
        if (typeof p.currentIndex === "number") restoredIndex = p.currentIndex;
      } catch {}
      try {
        restoredAnswers = JSON.parse(
          localStorage.getItem("cbt_answers") || "{}",
        );
        // Fallback: answers stored inside cbt_exam itself
        if (!Object.keys(restoredAnswers).length && data.answers)
          restoredAnswers = data.answers;
      } catch {}
      setCurrentSubject(restoredSubject);
      setCurrentIndex(restoredIndex);
      setAnswers(restoredAnswers);

      // OPTION A TIMER: endsAt - now, NOT full duration
      if (data.endsAt) {
        const remaining = Math.floor((data.endsAt - Date.now()) / 1000);
        if (remaining <= 0) {
          setTimeLeft(0);
          // Will auto-submit via effect below
        } else {
          setTimeLeft(remaining);
        }
        const taken = Math.max(0, duration - Math.max(0, remaining));
        localStorage.setItem("cbt_timeTaken", String(taken));
      } else {
        // Legacy exam without endsAt (created before fix) - create endsAt now from duration
        // and persist it so next reload will resume correctly
        const endsAt = Date.now() + duration * 1000;
        const patched = {
          ...data,
          startedAt: data.startedAt || Date.now(),
          endsAt,
          attemptId: data.attemptId || data.examId || `att_${Date.now()}`,
        };
        localStorage.setItem("cbt_exam", JSON.stringify(patched));
        setExamData(patched);
        setTimeLeft(duration);
        localStorage.setItem("cbt_timeTaken", "0");
      }
    } catch (e) {
      console.error(e);
      alert("Corrupt exam file. Go to setup.");
      window.location.href = "/cbt-setup";
    }
  }, []);

  // --- AUTOSAVE answers + position ---
  useEffect(() => {
    if (!examData) return;
    try {
      localStorage.setItem("cbt_answers", JSON.stringify(answers));
      localStorage.setItem(
        "cbt_progress",
        JSON.stringify({ currentSubject, currentIndex }),
      );
      // Also mirror into cbt_exam so single key has everything
      const raw = localStorage.getItem("cbt_exam");
      if (raw) {
        const d = JSON.parse(raw);
        d.answers = answers;
        d.currentSubject = currentSubject;
        d.currentIndex = currentIndex;
        localStorage.setItem("cbt_exam", JSON.stringify(d));
      }
    } catch {}
  }, [answers, currentSubject, currentIndex, examData]);

  // --- TIMER: tick from endsAt, not from full duration ---
  useEffect(() => {
    if (!examData || timeLeft <= 0 || isSubmitting) {
      if (examData && timeLeft <= 0 && !submitRef.current && examData.endsAt) {
        // Time already expired on load
        submitRef.current = true;
        setTimeout(() => handleSubmit(true), 200);
      }
      return;
    }
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        const taken = totalDurationRef.current - next;
        localStorage.setItem("cbt_timeTaken", String(taken > 0 ? taken : 0));
        if (next <= 0) {
          clearInterval(t);
          setTimeout(() => handleSubmit(true), 100);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examData, isSubmitting, totalDuration]);

  // Auto-scroll active subject pill - ONLY scroll the pill bar, no touch question
  useEffect(() => {
    const bar = document.getElementById("subject-bar");
    const btn = document.getElementById(`subj-${currentSubject}`);
    if (!bar || !btn) return;
    const target = btn.offsetLeft - bar.clientWidth / 2 + btn.clientWidth / 2;
    bar.scrollTo({ left: target, behavior: "smooth" });
  }, [currentSubject]);

  const questionsBySubject = useMemo(() => {
    if (!examData) return {};
    return examData.questions || examData.papers || {};
  }, [examData]);

  const subjectList = examData?.subjects || ["english"];
  const currentQuestions = questionsBySubject[currentSubject] || [];
  const currentQ = currentQuestions[currentIndex];

  const handleNextSubject = () => {
    const idx = subjectList.indexOf(currentSubject);
    if (idx < subjectList.length - 1) {
      setCurrentSubject(subjectList[idx + 1]);
      setCurrentIndex(0);
      setShowPalette(false);
      window.scrollTo(0, 0);
    } else {
      handleSubmit(false);
    }
  };

  const isLastSubject =
    subjectList.indexOf(currentSubject) === subjectList.length - 1;

  const handleOption = (opt) => {
    if (!currentQ) return;
    setAnswers((prev) => ({ ...prev, [currentQ.id]: opt }));
  };

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const handleSubmit = async (isAuto = false) => {
    if (submitRef.current) return;
    if (isSubmitting) return;
    if (!isAuto) {
      if (!confirm("Submit exam? You cannot change after submission.")) return;
    }
    submitRef.current = true;
    setIsSubmitting(true);
    const finalAnswers = answersRef.current;
    const finalTimeLeft = timeLeftRef.current;
    const finalTotal = totalDurationRef.current;
    const timeTaken = Math.max(0, finalTotal - finalTimeLeft);
    localStorage.setItem("cbt_timeTaken", String(timeTaken));

    let score = 0,
      total = 0;
    const breakdown = {};
    Object.entries(questionsBySubject).forEach(([sub, arr]) => {
      let subScore = 0;
      arr.forEach((q) => {
        total++;
        if (
          finalAnswers[q.id] &&
          String(finalAnswers[q.id]).toUpperCase() ===
            String(q.correct_answer || q.correct).toUpperCase()
        ) {
          score++;
          subScore++;
        }
      });
      breakdown[sub] = { score: subScore, total: arr.length };
    });

    const userId =
      localStorage.getItem("userId") ||
      localStorage.getItem("cbt_userId") ||
      examData?.userId ||
      `anon_${Date.now()}`;
    if (!localStorage.getItem("userId")) localStorage.setItem("userId", userId);
    const userName =
      localStorage.getItem("userName") ||
      localStorage.getItem("cbt_name") ||
      (() => {
        try {
          return (
            JSON.parse(localStorage.getItem("jambite_user") || "{}").username ||
            "JAMBite"
          );
        } catch {
          return "JAMBite";
        }
      })();

    // OPTION A: Reuse same attemptId from Setup - NO new ID on reload/resubmit
    const attemptId =
      examData?.attemptId ||
      localStorage.getItem("lastAttemptId") ||
      `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const payloadLeaderboard = {
      userId,
      name: userName,
      totalScore: Math.round((score / (total || 1)) * JAMB_MAX),
      rawScore: score,
      rawTotal: total,
      breakdown,
      subjects: subjectList,
      timeTaken,
      date: new Date().toISOString(),
      attemptId,
    };

    try {
      const r = await fetch(`${API_BASE}/api/cbt/save-result`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify(payloadLeaderboard),
      });
      const d = await r.json();
      localStorage.setItem("lastAttemptId", d.attemptId || attemptId);
    } catch (e) {
      localStorage.setItem("lastAttemptId", attemptId);
    }

    const finalResult = {
      score,
      total,
      breakdown,
      timeTaken,
      jambScore: Math.round((score / (total || 1)) * JAMB_MAX),
      attemptId: localStorage.getItem("lastAttemptId"),
      answers: finalAnswers,
      questions: questionsBySubject,
      userAnswers: finalAnswers,
    };

    localStorage.setItem("cbt_result", JSON.stringify(finalResult));
    // Clear in-progress so next Start is fresh - but keep cbt_exam until result loads? Clear progress keys only
    localStorage.removeItem("cbt_progress");
    localStorage.removeItem("cbt_answers");
    // Keep cbt_exam for now, Setup will clear on next Start. Remove it to avoid Resume banner after submit:
    localStorage.removeItem("cbt_exam");
    window.location.href = "/cbt-result";
  };

  if (!examData)
    return (
      <div className="min-h-screen bg-[#080C18] grid place-items-center text-slate-400">
        Summoning the Royal Papers...
      </div>
    );

  return (
    <div className="h-screen flex flex-col bg-[#080C18] font-['Inter',sans-serif] relative overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&family=Cinzel:wght@700;800&display=swap');
        @keyframes aurora{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(30px,-15px) scale(1.08)}}
        .opt-card{transition:all 0.22s cubic-bezier(0.2,0.8,0.2,1)}
        .opt-card:hover{transform:translateY(-2px); border-color:rgba(251,191,36,0.5)!important; background:rgba(30,41,59,0.9)!important}
      `}</style>

      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute w-[700px] h-[500px] -top-[100px] -left-[100px] bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.20),_transparent_65%)] blur-[30px]"
          style={{ animation: "aurora 10s infinite" }}
        />
        <div className="absolute w-[600px] h-[600px] bottom-0 right-0 bg-[radial-gradient(ellipse_at_center,_rgba(251,191,36,0.12),_transparent_65%)] blur-[40px]" />
      </div>

      {isSubmitting && (
        <div className="fixed inset-0 bg-[#080C18]/85 backdrop-blur-[10px] z-[9999] grid place-items-center">
          <div className="bg-[#121A2E]/90 backdrop-blur-xl border border-white/10 p-7 rounded-[20px] text-center max-w-[320px]">
            <div className="text-[38px] mb-2">👑⏳</div>
            <h2 className="font-extrabold text-[18px] text-white">
              {timeLeft === 0
                ? "Time's Up in the Palace!"
                : "Sealing Your Scroll..."}
            </h2>
            <p className="text-slate-400 text-[13px] mt-1.5">
              Saving to Royal Leaderboard...
            </p>
            <div className="mt-3.5 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
              <div className="h-full w-[60%] bg-gradient-to-r from-amber-400 to-sky-400 animate-pulse" />
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 bg-[#121A2E]/60 backdrop-blur-xl border-b border-white/10 px-3 sm:px-4 py-2.5 flex flex-wrap gap-2 justify-between items-center">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-amber-400 to-amber-500 grid place-items-center font-black text-black text-[14px]"
            style={{ fontFamily: "Cinzel" }}
          >
            J
          </div>
          <div>
            <div
              className="font-extrabold text-white text-[12px] tracking-wide"
              style={{ fontFamily: "Cinzel" }}
            >
              {currentSubject.toUpperCase()} • Q {currentIndex + 1}/
              {currentQuestions.length}
            </div>
            <div className="text-[10px] text-slate-500">
              Royal Hall • {formatTime(timeLeft)} remaining •{" "}
              {Object.keys(answers).length}/
              {Object.values(questionsBySubject).reduce(
                (a, b) => a + b.length,
                0,
              )}{" "}
              done
            </div>
          </div>
        </div>
        <div className="flex gap-1.5 sm:gap-2 items-center flex-wrap">
          <button
            onClick={() => setShowCalc(!showCalc)}
            className={`px-3 py-1.5 rounded-full font-bold text-[12px] border ${showCalc ? "bg-amber-400 text-black border-amber-400" : "bg-white/5 text-slate-300 border-white/10"}`}
          >
            🧮 Calc
          </button>
          <div
            className={`px-3.5 py-1.5 rounded-full font-extrabold text-[12px] border ${timeLeft < 60 ? "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse" : timeLeft < 300 ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-[#0F172A] text-white border-white/10"}`}
          >
            ⏳ {formatTime(timeLeft)}
          </div>
          <button
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
            className="px-3.5 py-1.5 rounded-full font-extrabold text-[12px] bg-gradient-to-br from-amber-400 to-amber-500 text-black"
          >
            Submit 👑
          </button>
        </div>
      </div>

      <div
        id="subject-bar"
        className="relative z-10 flex gap-2 px-3 sm:px-4 py-3 overflow-x-auto bg-[#080C18]/50 whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {subjectList.map((sub) => {
          const active = currentSubject === sub;
          const count = questionsBySubject[sub]?.length || 0;
          const done =
            questionsBySubject[sub]?.filter((q) => answers[q.id]).length || 0;
          return (
            <button
              key={sub}
              id={`subj-${sub}`}
              onClick={() => {
                setCurrentSubject(sub);
                setCurrentIndex(0);
              }}
              className={`shrink-0 px-4 py-2 rounded-full font-extrabold text-[11px] uppercase border ${active ? "bg-amber-400 text-black border-amber-400" : "bg-[#121A2E]/70 text-slate-400 border-white/10"}`}
            >
              {sub} • {done}/{count} {active ? "👑" : ""}
            </button>
          );
        })}
      </div>
      {/* MOBILE PALETTE BUTTON - only on phone/tablet */}
      <div className="lg:hidden relative z-20 px-3 pt-2 flex gap-2">
        <button
          onClick={() => setShowPalette(true)}
          className="flex-1 py-2.5 rounded-xl bg-[#121A2E] border border-white/10 text-white text-[12px] font-extrabold"
        >
          ☰ Palette • {currentSubject.toUpperCase()} —{" "}
          {currentQuestions.filter((q) => answers[q.id]).length}/
          {currentQuestions.length} done
        </button>
        <button
          onClick={handleNextSubject}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-black text-[12px] font-extrabold"
        >
          {isLastSubject ? "Finish 👑" : "Next Subject →"}
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[1fr_310px] overflow-hidden relative z-10">
        <div className="flex-1 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#121A2E]/80 backdrop-blur-xl border border-white/10 rounded-[20px] sm:rounded-[24px] p-4 sm:p-6">
            {currentQ ? (
              <>
                <div className="text-[15px] sm:text-[17px] font-semibold leading-[1.65] text-white break-words">
                  <span
                    style={{
                      color: "#FBBF24",
                      fontWeight: 800,
                      fontFamily: "Cinzel",
                      marginRight: 8,
                    }}
                  >
                    Q{currentIndex + 1}.
                  </span>
                  {currentQ.question_text || currentQ.question}
                </div>

                {currentQ.diagramUrl ? (
                  <div className="mt-4">
                    <img
                      src={currentQ.diagramUrl}
                      alt="Question diagram"
                      className="max-w-full max-h-[320px] rounded-xl border border-white/10 mx-auto object-contain bg-white p-2"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                ) : null}
                <div className="grid gap-2.5 mt-6">
                  {["A", "B", "C", "D"].map((k) => {
                    const optKey = `option_${k.toLowerCase()}`;
                    const val =
                      currentQ[optKey] ||
                      currentQ[`option_${k}`] ||
                      currentQ[k];
                    const isSelected = answers[currentQ.id] === k;
                    return (
                      <label
                        key={k}
                        onClick={() => handleOption(k)}
                        className={`opt-card flex gap-3 p-3.5 rounded-2xl cursor-pointer border ${isSelected ? "bg-amber-400/10 border-amber-400" : "bg-[#0F172A] border-white/10"}`}
                      >
                        <div
                          className={`w-7 h-7 shrink-0 rounded-full grid place-items-center font-extrabold text-[12px] ${isSelected ? "bg-amber-400 text-black" : "bg-[#1e293b] text-slate-500"}`}
                        >
                          {k}
                        </div>
                        <span className="text-[13px] sm:text-[14px] text-white leading-relaxed break-words">
                          {val}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div className="flex justify-between gap-2 mt-7">
                  <button
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-full border border-white/10 bg-[#0F172A] text-slate-400 text-[12px] font-bold disabled:opacity-40"
                  >
                    ← Previous
                  </button>
                  <button
                    disabled={currentIndex === currentQuestions.length - 1}
                    onClick={() =>
                      setCurrentIndex((i) =>
                        Math.min(currentQuestions.length - 1, i + 1),
                      )
                    }
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-full bg-gradient-to-br from-sky-400 to-sky-500 text-black text-[12px] font-extrabold disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </>
            ) : (
              <div className="text-slate-500">
                No questions for {currentSubject}
              </div>
            )}
          </div>
        </div>

        <div className="hidden lg:flex bg-[#121A2E]/60 backdrop-blur-xl m-4 ml-0 rounded-[20px] p-3.5 overflow-y-auto flex-col gap-3.5 border border-white/10">
          {showCalc && (
            <div className="border border-white/10 rounded-[14px] p-2.5 bg-[#0F172A]">
              <input
                value={calcVal}
                onChange={(e) => setCalcVal(e.target.value)}
                className="w-full p-2 mb-2 border border-white/10 rounded-lg bg-[#020617] text-white text-[13px]"
                placeholder="0"
              />
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  "7",
                  "8",
                  "9",
                  "/",
                  "4",
                  "5",
                  "6",
                  "*",
                  "1",
                  "2",
                  "3",
                  "-",
                  "0",
                  ".",
                  "=",
                  "+",
                ].map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      if (c === "=") {
                        try {
                          setCalcVal(
                            String(
                              Function(
                                '"use strict";return (' + calcVal + ")",
                              )(),
                            ),
                          );
                        } catch {
                          setCalcVal("Error");
                        }
                      } else setCalcVal((v) => v + c);
                    }}
                    className="p-2.5 rounded-lg border border-white/10 bg-[#141E2F] text-white text-[13px]"
                  >
                    {c}
                  </button>
                ))}
                <button
                  onClick={() => setCalcVal("")}
                  className="col-span-4 p-2 bg-red-500 text-white rounded-lg font-bold text-[12px]"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          <div>
            <h4
              className="m-0 mb-2.5 text-[11px] text-slate-400 tracking-widest"
              style={{ fontFamily: "Cinzel" }}
            >
              PALETTE • {currentSubject.toUpperCase()}
            </h4>
            <div className="grid grid-cols-5 gap-2">
              {currentQuestions.map((q, i) => {
                const answered = !!answers[q.id];
                const isCurrent = i === currentIndex;
                return (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className={`h-9 rounded-[10px] font-extrabold text-[12px] border ${isCurrent ? "border-amber-400" : "border-white/10"} ${answered ? "bg-amber-400 text-black" : isCurrent ? "bg-white text-black" : "bg-[#0F172A] text-slate-500"}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-auto border-t border-white/10 pt-3 text-[12px] text-slate-500">
            <div className="flex justify-between mb-1.5">
              <span>Answered</span>
              <span className="text-amber-400 font-extrabold">
                {currentQuestions.filter((q) => answers[q.id]).length} /{" "}
                {currentQuestions.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total</span>
              <span className="text-white font-extrabold">
                {Object.keys(answers).length} /{" "}
                {Object.values(questionsBySubject).reduce(
                  (a, b) => a + b.length,
                  0,
                )}
              </span>
            </div>
          </div>
          <button
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
            className="w-full p-3 bg-gradient-to-br from-amber-400 to-amber-500 text-black rounded-xl font-extrabold"
          >
            FINISH & SEAL SCROLL 👑
          </button>
        </div>
      </div>

      {/* MOBILE FLOATING CALC */}
      {showCalc && (
        <div className="fixed z-[1000] lg:hidden left-3 right-3 bottom-3">
          <div className="bg-[#121A2E] border border-white/20 rounded-[18px] p-3 shadow-2xl shadow-black/60">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white text-[12px] font-extrabold">
                CALCULATOR
              </span>
              <button
                onClick={() => setShowCalc(false)}
                className="w-7 h-7 rounded-full bg-white/10 text-white text-[12px]"
              >
                ✕
              </button>
            </div>
            <input
              value={calcVal}
              onChange={(e) => setCalcVal(e.target.value)}
              className="w-full p-2.5 mb-2 border border-white/10 rounded-lg bg-[#020617] text-white text-[16px] text-right font-bold"
              placeholder="0"
            />
            <div className="grid grid-cols-4 gap-1.5">
              {[
                "7",
                "8",
                "9",
                "/",
                "4",
                "5",
                "6",
                "*",
                "1",
                "2",
                "3",
                "-",
                "0",
                ".",
                "=",
                "+",
              ].map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    if (c === "=") {
                      try {
                        setCalcVal(
                          String(
                            Function('"use strict";return (' + calcVal + ")")(),
                          ),
                        );
                      } catch {
                        setCalcVal("Error");
                      }
                    } else setCalcVal((v) => v + c);
                  }}
                  className="p-2.5 rounded-lg border border-white/10 bg-[#141E2F] text-white text-[14px]"
                >
                  {c}
                </button>
              ))}
              <button
                onClick={() => setCalcVal("")}
                className="col-span-4 p-2 bg-red-500 text-white rounded-lg font-bold text-[12px]"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE PALETTE DRAWER */}
      {showPalette && (
        <div className="fixed inset-0 z-[999] lg:hidden">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setShowPalette(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-[#121A2E] rounded-t-[24px] p-4 max-h-[75vh] overflow-y-auto">
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-white font-extrabold text-[13px]">
                PALETTE • {currentSubject.toUpperCase()}
              </h4>
              <button
                onClick={() => setShowPalette(false)}
                className="w-8 h-8 rounded-full bg-white/10 text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {currentQuestions.map((q, i) => {
                const answered = !!answers[q.id];
                const isCurrent = i === currentIndex;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      setCurrentIndex(i);
                      setShowPalette(false);
                    }}
                    className={`h-11 rounded-[12px] font-extrabold text-[13px] border ${isCurrent ? "border-amber-400" : "border-white/10"} ${answered ? "bg-amber-400 text-black" : isCurrent ? "bg-white text-black" : "bg-[#0F172A] text-slate-400"}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleNextSubject}
              className="w-full mt-4 p-3.5 bg-gradient-to-br from-amber-400 to-amber-500 text-black rounded-xl font-extrabold"
            >
              {isLastSubject
                ? "FINISH & SEAL SCROLL 👑"
                : `NEXT: ${subjectList[subjectList.indexOf(currentSubject) + 1]?.toUpperCase()} →`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

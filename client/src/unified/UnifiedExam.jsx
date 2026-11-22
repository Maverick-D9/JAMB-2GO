// client/src/unified/UnifiedExam.jsx
import { useState, useEffect, useRef } from "react";
import { UNIFIED } from "./unified.config";

// NEW: Read logged-in user from your Auth.jsx saveSession
function getLoggedUser() {
  try {
    const raw = localStorage.getItem("jambite_user");
    if (raw) {
      const u = JSON.parse(raw);
      return {
        username: u.username || localStorage.getItem("username") || "Guest",
        fullName:
          u.fullName || u.name || localStorage.getItem("fullName") || "",
        userId: u.userId || localStorage.getItem("userId") || "",
      };
    }
  } catch {}
  return {
    username: localStorage.getItem("username") || "Guest",
    fullName: localStorage.getItem("fullName") || "",
    userId: localStorage.getItem("userId") || "",
  };
}

export default function UnifiedExam() {
  const id =
    typeof window !== "undefined" ? window.location.pathname.split("/")[2] : "";
  const [user] = useState(getLoggedUser);
  const [questions, setQuestions] = useState([]);
  const [testTitle, setTestTitle] = useState("");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [alreadyDone, setAlreadyDone] = useState(null); // NEW
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);
  const [showCalc, setShowCalc] = useState(false);
  const [calc, setCalc] = useState("");

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setMsg("No test ID in URL");
      return;
    }
    if (!user.username || user.username === "Guest") {
      setLoading(false);
      setMsg("Please login first to take this test.");
      return;
    }
    // NEW: Check backend if this username don do am before
    fetch(
      `${UNIFIED.API_BASE}/api/unified/tests/${id}/attempt?username=${encodeURIComponent(user.username)}`,
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.done) {
          setAlreadyDone(d);
          setLoading(false);
          return;
        }
        // If never do am, load questions
        return fetch(`${UNIFIED.API_BASE}/api/unified/tests/${id}/questions`)
          .then((r) => r.json())
          .then((qd) => {
            setQuestions(qd.questions || []);
            setTestTitle(qd.test?.title || "Unified Test");
            setTimeLeft((qd.test?.durationMinutes || 120) * 60);
            setLoading(false);
            if (!qd.questions?.length)
              setMsg("No questions for this test yet.");
          });
      })
      .catch(() => {
        setLoading(false);
        setMsg("Failed to load questions");
      });
  }, [id]);

  useEffect(() => {
    if (loading || submitted || !questions.length) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [loading, submitted, questions.length]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  // NEW: Submit + save to backend with username
  const handleSubmit = async () => {
    let correct = 0;
    questions.forEach((q, i) => {
      if (
        answers[i] &&
        answers[i].toUpperCase() === (q.correct || "").toUpperCase()
      )
        correct++;
    });
    setScore(correct);
    setSubmitted(true);
    clearInterval(timerRef.current);
    // Save attempt - backend go block if e don do am
    try {
      await fetch(`${UNIFIED.API_BASE}/api/unified/tests/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          fullName: user.fullName,
          userId: user.userId,
          score: correct,
          total: questions.length,
          answers,
        }),
      });
    } catch {}
  };

  const calcPress = (v) => {
    if (v === "=") {
      try {
        const res = Function(`"use strict"; return (${calc || "0"})`)();
        setCalc(String(res));
      } catch {
        setCalc("Error");
      }
    } else if (v === "C") setCalc("");
    else if (v === "⌫") setCalc(calc.slice(0, -1));
    else setCalc(calc + v);
  };

  if (loading)
    return (
      <div className="min-h-screen bg-[#070B18] text-white grid place-items-center">
        Loading exam...
      </div>
    );

  // NEW: Already done screen
  if (alreadyDone)
    return (
      <div className="min-h-screen bg-[#070B18] text-white p-6 grid place-items-center">
        <div className="max-w-md w-full bg-[#121A2E] rounded-3xl p-8 text-center border border-white/10">
          <div className="text-6xl">🔒</div>
          <h2 className="text-2xl font-black mt-4">
            {testTitle || "Unified Test"}
          </h2>
          <p className="text-slate-400 mt-2">
            Hi <b className="text-white">@{user.username}</b>, you don do this
            test before.
          </p>
          <p className="text-5xl font-black mt-4 text-amber-400">
            {alreadyDone.score} / {alreadyDone.total}
          </p>
          <p className="text-slate-400 mt-2">
            Your first attempt na the one wey count.
          </p>
          <button
            onClick={() => (window.location.href = "/unified-test")}
            className="w-full mt-6 py-3 rounded-full bg-amber-400 text-black font-black"
          >
            ← Back to Lobby
          </button>
        </div>
      </div>
    );

  if (submitted)
    return (
      <div className="min-h-screen bg-[#070B18] text-white p-6 grid place-items-center">
        <div className="max-w-md w-full bg-[#121A2E] rounded-3xl p-8 text-center border border-white/10">
          <div className="text-6xl">🎉</div>
          <h2 className="text-2xl font-black mt-4">{testTitle}</h2>
          <p className="text-slate-400 text-[13px] mt-1">
            👤 @{user.username} — {user.fullName}
          </p>
          <p className="text-5xl font-black mt-4 text-amber-400">
            {score} / {questions.length}
          </p>
          <p className="text-slate-400 mt-2">
            {Math.round((score / questions.length) * 100)}% —{" "}
            {score / questions.length >= 0.5 ? "Pass! 🔥" : "Keep pushing! 💪"}
          </p>
          <div className="grid grid-cols-2 gap-2 mt-6 text-left">
            <div className="bg-emerald-500/10 p-3 rounded-xl">
              <p className="text-emerald-400 font-bold">{score} Correct</p>
            </div>
            <div className="bg-red-500/10 p-3 rounded-xl">
              <p className="text-red-400 font-bold">
                {questions.length - score} Wrong / Skipped
              </p>
            </div>
          </div>
          <button
            onClick={() => (window.location.href = "/unified-test")}
            className="w-full mt-6 py-3 rounded-full bg-amber-400 text-black font-black"
          >
            ← Back to Lobby
          </button>
        </div>
      </div>
    );

  if (!questions.length)
    return (
      <div className="min-h-screen bg-[#070B18] text-white p-6 text-center">
        <p className="mt-20">{msg}</p>
        <button
          onClick={() => (window.location.href = "/unified-test")}
          className="mt-4 px-5 py-3 rounded-full bg-white/10"
        >
          ← Back
        </button>
      </div>
    );

  const q = questions[idx];
  const isLowTime = timeLeft < 300;
  return (
    <div className="min-h-screen bg-[#070B18] text-white p-4 pb-24">
      <div className="max-w-3xl mx-auto">
        <div className="sticky top-0 bg-[#070B18]/95 backdrop-blur py-3 z-10 border-b border-white/10">
          <div className="flex justify-between items-center">
            <span className="font-black text-[13px] truncate">{testTitle}</span>
            <span
              className={`px-3 py-1.5 rounded-full font-black text-[13px] ${isLowTime ? "bg-red-500 text-white animate-pulse" : "bg-amber-400 text-black"}`}
            >
              ⏰ {formatTime(timeLeft)}
            </span>
          </div>
          {/* NEW: Show username */}
          <p className="text-[11px] text-slate-400 mt-1">
            👤 @{user.username} {user.fullName ? `• ${user.fullName}` : ""}
          </p>
          <div className="flex justify-between text-[11px] text-slate-400 mt-2">
            <span>
              Question {idx + 1} / {questions.length}
            </span>
            <span className="uppercase">
              {q.subject} • Answered {Object.keys(answers).length}
            </span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all"
              style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
          {[...new Set(questions.map((x) => x.subject))].map((subj) => {
            const count = questions.filter((x) => x.subject === subj).length;
            const answeredCount = questions.filter(
              (x, i) => x.subject === subj && answers[i],
            ).length;
            const isActive = q.subject === subj;
            return (
              <button
                key={subj}
                onClick={() => {
                  const firstIdx = questions.findIndex(
                    (x) => x.subject === subj,
                  );
                  if (firstIdx !== -1) setIdx(firstIdx);
                }}
                className={`shrink-0 px-4 py-2.5 rounded-full text-[12px] font-bold border whitespace-nowrap ${isActive ? "bg-amber-400 text-black border-amber-400" : "bg-[#121A2E] text-slate-300 border-white/10"}`}
              >
                {subj.toUpperCase()} • {answeredCount}/{count}
              </button>
            );
          })}
        </div>
        {q.diagramUrl && (
          <img
            src={q.diagramUrl}
            alt="Question diagram"
            className="w-full max-h-[280px] object-contain rounded-xl my-3 bg-black/30 p-2"
          />
        )}
        <h2 className="text-lg font-bold mt-4">{q.question_text}</h2>
        <div className="space-y-2 mt-5">
          {["A", "B", "C", "D"].map((letter) => {
            const val = q[`option_${letter.toLowerCase()}`];
            if (!val) return null;
            return (
              <button
                key={letter}
                onClick={() => setAnswers({ ...answers, [idx]: letter })}
                className={`w-full text-left px-4 py-3 rounded-xl border ${answers[idx] === letter ? "bg-amber-400 text-black border-amber-400 font-bold" : "bg-[#121A2E] border-white/10"}`}
              >
                {letter}. {val}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 mt-6">
          <button
            disabled={idx === 0}
            onClick={() => setIdx(idx - 1)}
            className="px-5 py-3 rounded-full bg-white/10 disabled:opacity-30"
          >
            ← Prev
          </button>
          {idx < questions.length - 1 ? (
            (() => {
              const isLastOfSubject = questions[idx + 1]?.subject !== q.subject;
              return (
                <button
                  onClick={() => setIdx(idx + 1)}
                  className="flex-1 py-3 rounded-full bg-amber-400 text-black font-black"
                >
                  {isLastOfSubject
                    ? `Next Subject: ${questions[idx + 1].subject.toUpperCase()} →`
                    : "Next →"}
                </button>
              );
            })()
          ) : (
            <button
              onClick={handleSubmit}
              className="flex-1 py-3 rounded-full bg-emerald-400 text-black font-black"
            >
              Submit ✅
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mt-6 mb-2 uppercase">
          {q.subject} — Tap to jump
        </p>
        <div className="flex flex-wrap gap-1.5">
          {questions.map((qq, i) =>
            qq.subject === q.subject ? (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`w-9 h-9 rounded-lg text-[12px] font-bold ${i === idx ? "bg-white text-black" : answers[i] ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-white/5 text-slate-400"}`}
              >
                {i + 1}
              </button>
            ) : null,
          )}
        </div>
      </div>
      <button
        onClick={() => setShowCalc(!showCalc)}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-amber-400 text-black text-2xl font-black shadow-2xl shadow-amber-400/30"
      >
        🧮
      </button>
      {showCalc && (
        <div className="fixed bottom-24 right-4 z-50 w-[280px] bg-[#121A2E] border border-white/20 rounded-3xl p-3 shadow-2xl">
          <div className="flex justify-between items-center px-1 mb-2">
            <span className="text-[12px] font-bold text-slate-400">
              Calculator
            </span>
            <button
              onClick={() => setShowCalc(false)}
              className="text-slate-400"
            >
              ✕
            </button>
          </div>
          <div className="bg-black/50 rounded-xl px-3 py-3 text-right text-xl font-mono min-h-[48px] break-all">
            {calc || "0"}
          </div>
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            {[
              "C",
              "⌫",
              "%",
              "/",
              "7",
              "8",
              "9",
              "*",
              "4",
              "5",
              "6",
              "-",
              "1",
              "2",
              "3",
              "+",
              "0",
              ".",
              "(",
              ")",
              "=",
            ].map((b) => (
              <button
                key={b}
                onClick={() => calcPress(b)}
                className={`py-2.5 rounded-xl font-bold text-[14px] ${b === "=" ? "bg-amber-400 text-black" : b === "C" ? "bg-red-500/20 text-red-300" : "bg-white/5"}`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

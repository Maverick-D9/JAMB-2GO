// client/src/unified/UnifiedAdmin.jsx
import { useState, useEffect } from "react";
import { UNIFIED } from "./unified.config";
import UnifiedVaultAdmin from "./UnifiedVaultAdmin";

export default function UnifiedAdmin() {
  const [tab, setTab] = useState("tests"); // tests | vault
  const [title, setTitle] = useState("");
  const [subjects, setSubjects] = useState(["english", "mathematics"]);
  const [topic, setTopic] = useState("all"); // NEW: Topic Filter
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(120);
  const [questionsPerSubject, setQuestionsPerSubject] = useState(40);
  const [msg, setMsg] = useState("");
  const [tests, setTests] = useState([]);
  // NEW: Reset state
  const [resettingId, setResettingId] = useState(null);
  const [resetUser, setResetUser] = useState({}); // { testId: "username" }

  const pass = localStorage.getItem("admin_pass");
  const headers = {
    "Content-Type": "application/json",
    "x-admin-password": pass,
  };

  const loadTests = async () => {
    try {
      const r = await fetch(`${UNIFIED.API_BASE}/api/unified/tests`, {
        headers: { "x-admin-password": pass },
      });
      const d = await r.json();
      setTests(d.tests || []);
    } catch {}
  };
  useEffect(() => {
    loadTests();
  }, []);

  const toggle = (s) =>
    setSubjects((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const create = async () => {
    const startAt = date && time ? `${date}T${time}` : "";
    if (!title.trim() || !startAt)
      return setMsg("❌ Fill Title + Date + Time first");
    setMsg("⏳ Creating...");
    const r = await fetch(`${UNIFIED.API_BASE}/api/unified/tests`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: title.trim(),
        subjects,
        topic: topic.trim() || "all", // NEW
        startAt,
        durationMinutes: Number(duration),
        questionsPerSubject: Number(questionsPerSubject) || 40,
      }),
    });
    const d = await r.json();
    setMsg(d.success ? "✅ Test created!" : "❌ " + (d.error || "Failed"));
    if (d.success) {
      setTitle("");
      setDate("");
      setTopic("all"); // NEW: reset
      loadTests();
    }
  };

  const makeLive = async (id, title) => {
    if (!confirm(`Make "${title}" LIVE NOW? Everybody go see ENTER button.`))
      return;
    setMsg("⏳ Making live...");
    const r = await fetch(
      `${UNIFIED.API_BASE}/api/unified/tests/${id}/make-live`,
      {
        method: "POST",
        headers,
      },
    );
    const d = await r.json();
    setMsg(
      d.success
        ? "✅ LIVE NOW! Go check /unified-test"
        : "❌ " + (d.error || "Failed — check backend route"),
    );
    loadTests();
  };

  const endTest = async (id, title) => {
    if (!confirm(`End "${title}"?`)) return;
    const r = await fetch(`${UNIFIED.API_BASE}/api/unified/tests/${id}/end`, {
      method: "POST",
      headers,
    });
    const d = await r.json();
    setMsg(d.success ? "✅ Test ended" : "❌ " + (d.error || "Failed"));
    loadTests();
  };

  // DELETE TEST - only after test don end
  const deleteTest = async (id, title) => {
    if (
      !confirm(`Delete "${title}" permanently? E go comot from All Tests list.`)
    )
      return;
    setMsg("⏳ Deleting...");
    const r = await fetch(`${UNIFIED.API_BASE}/api/unified/tests/${id}`, {
      method: "DELETE",
      headers,
    });
    const d = await r.json();
    setMsg(
      d.success ? "✅ Test deleted!" : "❌ " + (d.error || "Delete failed"),
    );
    if (d.success) loadTests();
  };

  // NEW: RESET ALL attempts for one test
  const resetAllAttempts = async (id, title) => {
    if (
      !confirm(
        `🔄 Reset ALL attempts for "${title}"?\n\nEverybody wey don do am go fit do am again. Their old scores go delete. Continue?`,
      )
    )
      return;
    setResettingId(id);
    setMsg("⏳ Resetting attempts...");
    try {
      const r = await fetch(
        `${UNIFIED.API_BASE}/api/unified/tests/${id}/attempts`,
        {
          method: "DELETE",
          headers,
        },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Reset failed");
      setMsg(
        `✅ Reset done! ${d.deleted} attempt(s) cleared for "${title}". Everybody fit do am again.`,
      );
    } catch (e) {
      setMsg("❌ " + e.message);
    } finally {
      setResettingId(null);
      loadTests();
    }
  };

  // NEW: RESET ONE user for one test
  const resetOneAttempt = async (id, title) => {
    const username = (resetUser[id] || "").trim();
    if (!username)
      return setMsg("❌ Type username to reset for one user first");
    if (!confirm(`Reset attempt for @${username} only for "${title}"?`)) return;
    setResettingId(id);
    try {
      const r = await fetch(
        `${UNIFIED.API_BASE}/api/unified/tests/${id}/attempts/${encodeURIComponent(username)}`,
        {
          method: "DELETE",
          headers,
        },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Reset failed");
      if (d.deleted === 0)
        setMsg(
          `⚠️ @${username} never do "${title}" before — nothing to reset.`,
        );
      else
        setMsg(
          `✅ @${username} reset done for "${title}" — e fit do am again.`,
        );
      setResetUser((p) => ({ ...p, [id]: "" }));
    } catch (e) {
      setMsg("❌ " + e.message);
    } finally {
      setResettingId(null);
      loadTests();
    }
  };

  return (
    <div className="bg-[#121A2E] border border-white/10 rounded-[20px] p-4 mt-4">
      <h3 className="font-black text-white text-[15px]">
        🏆 UNIFIED TEST — Admin
      </h3>

      {/* ✅ NEW TABS */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setTab("tests")}
          className={`px-4 py-2 rounded-full text-[12px] font-bold ${tab === "tests" ? "bg-amber-400 text-black" : "bg-white/10 text-white"}`}
        >
          🏆 Tests
        </button>
        <button
          onClick={() => setTab("vault")}
          className={`px-4 py-2 rounded-full text-[12px] font-bold ${tab === "vault" ? "bg-amber-400 text-black" : "bg-white/10 text-white"}`}
        >
          🗄️ Unified Vault
        </button>
      </div>

      {/* ✅ VAULT TAB */}
      {tab === "vault" && <UnifiedVaultAdmin />}

      {/* ✅ TESTS TAB - your old code, nothing change */}
      {tab === "tests" && (
        <>
          <h3 className="font-black text-white text-[15px] mt-4">
            🏆 UNIFIED TEST — Create
          </h3>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sunday Mega Test"
            className="w-full mt-3 px-3 py-2.5 rounded-xl bg-[#080C18] border border-white/10 text-white text-[13px] outline-none"
          />

          {/* NEW: TOPIC FILTER */}
          <label className="text-[11px] text-slate-400 mt-3 block">
            Topic Filter — leave as "all" for all topics, or type one topic
          </label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            list="topic-suggestions"
            placeholder="all — or e.g. Circle Theorems"
            className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#080C18] border border-white/10 text-white text-[13px] outline-none"
          />
          <datalist id="topic-suggestions">
            <option value="all" />
            <option value="Circle Theorems" />
            <option value="Quadratic" />
            <option value="Trigonometry" />
            <option value="Wave" />
            <option value="Optics" />
          </datalist>
          <p className="text-[11px] text-slate-500 mt-1">
            If you type "Circle Theorems", exam go bring ONLY Circle Theorems.
            If you leave "all", e go bring mix from all topics.
          </p>

          <div className="flex gap-2 mt-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl bg-[#080C18] border border-white/10 text-white text-[13px] outline-none"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-[130px] px-3 py-2.5 rounded-xl bg-[#080C18] border border-white/10 text-white text-[13px] outline-none"
            />
          </div>
          <div className="flex gap-2 mt-2">
            <div className="flex-1">
              <label className="text-[11px] text-slate-400">
                Duration (mins)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#080C18] border border-white/10 text-white text-[13px] outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-slate-400">
                Questions per subject
              </label>
              <input
                type="number"
                min="5"
                max="100"
                value={questionsPerSubject}
                onChange={(e) => setQuestionsPerSubject(e.target.value)}
                placeholder="40"
                className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#080C18] border border-white/10 text-white text-[13px] outline-none"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {UNIFIED.SUBJECTS.map((s) => (
              <button
                key={s}
                onClick={() => toggle(s)}
                className={`text-[11px] px-2.5 py-1.5 rounded-full border ${subjects.includes(s) ? "bg-amber-400 text-black border-amber-400 font-bold" : "bg-white/5 text-slate-300 border-white/10"}`}
              >
                {UNIFIED.ICONS[s]} {s}
              </button>
            ))}
          </div>
          <button
            onClick={create}
            className="w-full mt-4 py-3 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black text-[13px]"
          >
            Create Unified Test →
          </button>
          {msg && <p className="text-[12px] mt-2 text-slate-300">{msg}</p>}

          {/* LIST + MAKE LIVE */}
          <h4 className="text-white font-black text-[13px] mt-6 mb-2">
            All Tests ({tests.length})
          </h4>
          <div className="space-y-2">
            {tests.map((t) => (
              <div
                key={t._id}
                className="bg-[#080C18] border border-white/10 rounded-xl p-3"
              >
                <div className="flex justify-between items-center gap-2">
                  <div>
                    <p className="text-white font-bold text-[13px]">
                      {t.title}{" "}
                      <span
                        className={`ml-1 text-[10px] px-2 py-0.5 rounded-full ${t.status === "live" ? "bg-red-500/20 text-red-300" : t.status === "upcoming" ? "bg-amber-400/15 text-amber-300" : "bg-white/10 text-slate-400"}`}
                      >
                        {t.status}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {new Date(t.startAt).toLocaleString()} •{" "}
                      {t.subjects?.join(", ")} • {t.questionsPerSubject || 40}{" "}
                      Qs/subject
                    </p>
                    {/* NEW: Show Topic */}
                    <p className="text-[11px] text-amber-300/80">
                      📌 Topic: {t.topic || "all"}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                    {t.status !== "live" && (
                      <button
                        onClick={() => makeLive(t._id, t.title)}
                        className="px-3 py-2 rounded-full bg-red-500 text-white font-bold text-[11px]"
                      >
                        🔴 Make Live
                      </button>
                    )}
                    {t.status === "live" && (
                      <button
                        onClick={() => endTest(t._id, t.title)}
                        className="px-3 py-2 rounded-full bg-white/10 text-white font-bold text-[11px]"
                      >
                        End
                      </button>
                    )}
                    {/* NEW: Reset All Attempts - always show */}
                    <button
                      onClick={() => resetAllAttempts(t._id, t.title)}
                      disabled={resettingId === t._id}
                      className="px-3 py-2 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30 font-bold text-[11px] disabled:opacity-50"
                    >
                      {resettingId === t._id
                        ? "Resetting..."
                        : "🔄 Reset Attempts"}
                    </button>
                    {/* DELETE - only show when test don end */}
                    {t.status === "ended" && (
                      <button
                        onClick={() => deleteTest(t._id, t.title)}
                        className="px-3 py-2 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 font-bold text-[11px]"
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>
                {/* NEW: Reset ONE user row */}
                <div className="flex gap-1.5 mt-2">
                  <input
                    value={resetUser[t._id] || ""}
                    onChange={(e) =>
                      setResetUser((p) => ({ ...p, [t._id]: e.target.value }))
                    }
                    placeholder="Username to reset only, e.g. raven"
                    className="flex-1 px-3 py-2 rounded-full bg-[#121A2E] border border-white/10 text-white text-[11px] outline-none"
                  />
                  <button
                    onClick={() => resetOneAttempt(t._id, t.title)}
                    disabled={resettingId === t._id}
                    className="px-3 py-2 rounded-full bg-white/10 text-slate-200 font-bold text-[11px] disabled:opacity-50 shrink-0"
                  >
                    Reset 1 User
                  </button>
                </div>
              </div>
            ))}
            {tests.length === 0 && (
              <p className="text-slate-500 text-[12px]">No tests yet.</p>
            )}
          </div>
          <button
            onClick={loadTests}
            className="mt-3 px-4 py-2 rounded-full bg-white/10 text-slate-300 text-[12px] font-bold"
          >
            🔄 Refresh List
          </button>
        </>
      )}
    </div>
  );
}

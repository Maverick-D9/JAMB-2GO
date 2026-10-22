import { useState, useEffect } from "react";
import { VITALS } from "../config/vitals";

const API = VITALS.SYSTEM.API_BASE;

export default function AdminTopics() {
  const [subject, setSubject] = useState("biology"); // default to biology like screenshot
  const [topics, setTopics] = useState([]);
  const [newTopic, setNewTopic] = useState("");
  const [csvText, setCsvText] = useState("");
  const [uploadTopic, setUploadTopic] = useState("");
  const [msg, setMsg] = useState("");
  const [counts, setCounts] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const adminPass = localStorage.getItem("admin_pass") || "JAMB2GO_2026";

  const load = async () => {
    try {
      const res = await fetch(`${API}/admin/topics/${subject}`, {
        headers: { "x-admin-password": adminPass },
        cache: "no-store",
      });
      const data = await res.json();
      setTopics(data.topics || []);
      if (data.counts) setCounts(data.counts);
      else setCounts({});
    } catch (e) {
      setTopics([]);
    }
  };

  useEffect(() => {
    load();
  }, [subject]);

  // === FIXED REFRESH - NOW ACTUALLY REBUILDS CACHE ===
  const handleRefresh = async () => {
    setRefreshing(true);
    setMsg("⏳ Rebuilding drill cache...");
    try {
      // Force backend to reload topics.json + rebuild drillCache
      await fetch(`${API}/admin/reload-questions`, {
        method: "POST",
        headers: { "x-admin-password": adminPass },
      });
      await load();
      setMsg(`✅ Refreshed ${subject.toUpperCase()} — ${topics.length} topics`);
    } catch (e) {
      setMsg(`❌ Refresh failed: ${e.message}`);
    } finally {
      setRefreshing(false);
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const addTopic = async () => {
    if (!newTopic.trim()) return;
    const res = await fetch(`${API}/admin/topics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": adminPass,
      },
      body: JSON.stringify({ subject, topic: newTopic.trim() }),
    });
    const data = await res.json();
    if (data.ok || data.success) {
      setNewTopic("");
      // Use returned data instantly so you don't need refresh
      if (data.topics) {
        setTopics(data.topics);
        if (data.counts) setCounts(data.counts);
      } else {
        await load();
      }
      if (data.topics && data.topics.includes(newTopic.trim())) {
        setUploadTopic(newTopic.trim());
      }
      setMsg(`✅ Topic "${newTopic.trim()}" added to ${subject.toUpperCase()}`);
      setTimeout(() => setMsg(""), 3000);
    } else {
      setMsg(`❌ ${data.error || data.message || "Error adding topic"}`);
    }
  };

  const upload = async () => {
    if (!csvText.trim()) return setMsg("❌ Paste CSV first");
    const targetTopic = uploadTopic || newTopic;
    if (!targetTopic) return setMsg("❌ Select a topic first");
    setMsg("⏳ Uploading to DRILL...");
    try {
      const res = await fetch(`${API}/admin/upload-drill`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPass,
        },
        body: JSON.stringify({ subject, topic: targetTopic, csvText }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(
          `✅ ${data.count || 0} Qs saved to drill/${subject}/${targetTopic} • ${data.message || ""}`,
        );
        setCsvText("");
        load();
      } else {
        setMsg(`❌ ${data.error || data.message || "Upload failed"}`);
      }
    } catch (e) {
      setMsg(`❌ Network error: ${e.message}`);
    }
  };

  const rowCount = csvText.trim()
    ? csvText.trim().split("\n").length -
      (csvText.includes("question_text") ? 1 : 0)
    : 0;

  return (
    <div className="min-h-screen w-full bg-[#070B18] text-white relative overflow-hidden">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&display=swap');`}</style>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-[800px] h-[600px] -top-[200px] -left-[200px] bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.20),_transparent_65%)] blur-[40px]" />
        <div className="absolute w-[600px] h-[600px] top-[20%] right-[-200px] bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.15),_transparent_65%)] blur-[40px]" />
      </div>

      <div className="w-full max-w-[98vw] mx-auto px-3 md:px-6 py-4 relative z-10">
        <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center mb-5 bg-[#121A2E]/70 backdrop-blur-xl border border-white/10 rounded-[20px] p-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 grid place-items-center font-black text-black text-lg">
              🎯
            </div>
            <div>
              <h1
                className="text-xl font-black tracking-tight"
                style={{ fontFamily: "Cinzel" }}
              >
                Drill Palace Manager
              </h1>
              <p className="text-[11px] text-slate-400 tracking-widest uppercase">
                {subject.toUpperCase()} • {topics.length} TOPICS •{" "}
                {Object.values(counts).reduce((a, b) => a + b, 0) || "—"} Qs
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => (window.location.href = "/admin")}
              className="px-4 py-2.5 bg-[#0F172A] border border-white/10 rounded-full text-[13px] font-bold hover:border-white/20"
            >
              ← Admin
            </button>
            <button
              onClick={() => (window.location.href = "/cbt-drill")}
              className="px-5 py-2.5 bg-white text-black font-black rounded-full text-[13px]"
            >
              Test Drill →
            </button>
          </div>
        </div>

        {msg && (
          <div
            className={`mb-4 p-3.5 rounded-2xl border text-sm font-bold backdrop-blur-xl ${msg.includes("✅") ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : msg.includes("⏳") ? "bg-sky-500/10 border-sky-500/30 text-sky-300" : "bg-red-500/10 border-red-500/30 text-red-300"}`}
          >
            {msg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5 w-full">
          <div className="grid gap-4 w-full">
            <div className="bg-[#121A2E]/70 backdrop-blur-xl border border-white/10 rounded-[20px] p-5 relative overflow-hidden w-full">
              <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
              <label className="text-[10px] tracking-[0.14em] font-bold text-slate-500 uppercase">
                Select Subject
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-3">
                {[
                  "mathematics",
                  "english",
                  "physics",
                  "chemistry",
                  "biology",
                  "economics",
                  "commerce",
                  "government",
                  "accounting",
                  "literature",
                  "crs",
                  "geography",
                  "history",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSubject(s)}
                    className={`px-3 py-2.5 rounded-xl text-[12px] font-black border transition ${subject === s ? "bg-emerald-400 text-black border-emerald-400" : "bg-[#0B0F1E] border-white/10 text-slate-400 hover:text-white hover:border-white/20"}`}
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex justify-between items-center text-[11px]">
                <span className="text-slate-500">
                  {topics.length} topics • Click to select for upload
                </span>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className={`px-3 py-1.5 rounded-full bg-[#0F172A] border border-white/10 font-bold transition ${refreshing ? "opacity-50" : "hover:border-emerald-400/50 text-sky-400"}`}
                >
                  {refreshing ? "⏳ Refreshing..." : "🔄 Refresh"}
                </button>
              </div>
            </div>

            <div className="bg-[#121A2E]/70 backdrop-blur-xl border border-white/10 rounded-[20px] p-5 w-full">
              <label className="text-[10px] tracking-[0.14em] font-bold text-slate-500 uppercase">
                Add New Topic to {subject.toUpperCase()}
              </label>
              <div className="flex gap-2 mt-3">
                <input
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTopic()}
                  placeholder="e.g. Quadratic Equations, Algebra, Number Bases"
                  className="flex-1 p-3.5 bg-[#0B0F1E] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-emerald-400/50 placeholder:text-white/20"
                />
                <button
                  onClick={addTopic}
                  className="px-7 bg-gradient-to-r from-emerald-400 to-teal-500 text-black font-black rounded-xl text-sm hover:scale-[1.02] transition"
                >
                  Add
                </button>
              </div>

              <div className="mt-5">
                <div className="text-[10px] font-bold tracking-widest text-slate-600 uppercase mb-2">
                  Existing Topics — Click to set as upload target
                </div>
                {topics.length === 0 ? (
                  <div className="text-slate-600 text-sm py-6 text-center border border-dashed border-white/10 rounded-xl">
                    No topics yet. Add one above.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {topics.map((t) => {
                      const isActive = uploadTopic === t;
                      return (
                        <button
                          key={t}
                          onClick={() => setUploadTopic(t)}
                          className={`px-4 py-2 rounded-full text-[12px] border font-bold flex items-center gap-2 transition ${isActive ? "bg-white text-black border-white" : "bg-[#0B0F1E] border-white/10 text-slate-300 hover:border-emerald-400/30 hover:text-white"}`}
                        >
                          {t}{" "}
                          {counts[t] != null && (
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? "bg-black text-white" : "bg-white/10"}`}
                            >
                              {counts[t]}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-[#121A2E]/80 backdrop-blur-xl border border-emerald-500/20 rounded-[20px] p-5 h-fit lg:sticky lg:top-5 w-full">
            <div className="flex justify-between items-center">
              <h3
                className="font-black text-[13px]"
                style={{ fontFamily: "Cinzel" }}
              >
                UPLOAD VAULT
              </h3>
              <span className="text-[10px] bg-emerald-400/15 text-emerald-400 px-2 py-1 rounded-full border border-emerald-400/20 font-bold">
                {rowCount} rows
              </span>
            </div>

            <label className="text-[10px] tracking-widest font-bold text-slate-500 uppercase mt-4 block">
              Target Topic
            </label>
            <select
              value={uploadTopic}
              onChange={(e) => setUploadTopic(e.target.value)}
              className="w-full p-3.5 bg-[#0B0F1E] border border-white/10 rounded-xl mt-2 text-sm focus:outline-none focus:border-emerald-400/50"
            >
              <option value="">Select Topic to Upload Into</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <div className="mt-4 p-3 rounded-xl bg-[#0B0F1E] border border-white/5">
              <div className="text-[10px] font-bold text-slate-500 uppercase">
                Current Selection
              </div>
              <div className="font-black text-sm mt-1">
                {subject.toUpperCase()} /{" "}
                <span className="text-emerald-400">{uploadTopic || "..."}</span>
              </div>
            </div>

            <label className="text-[10px] tracking-widest font-bold text-slate-500 uppercase mt-5 block">
              CSV Data
            </label>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`question_text,option_a,option_b,option_c,option_d,correct,explanation
What is 2+2?,2,3,4,5,C,Basic addition
Solve x²=4,1,2,-2,4,B,Take sqrt both sides`}
              className="w-full h-[280px] p-3.5 bg-[#0B0F1E] border border-white/10 rounded-xl mt-2 text-[12px] font-mono focus:outline-none focus:border-emerald-400/50 placeholder:text-white/20 resize-none"
            />

            <button
              onClick={upload}
              className="w-full mt-4 py-3.5 bg-gradient-to-r from-white to-slate-200 text-black font-black rounded-xl text-sm hover:scale-[1.01] transition flex items-center justify-center gap-2"
            >
              🚀 Upload to {uploadTopic || "..."}
            </button>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={() => setCsvText("")}
                className="py-2.5 bg-[#0B0F1E] border border-white/10 rounded-xl text-[12px] font-bold text-slate-400"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(csvText);
                  setMsg("📋 Copied");
                  setTimeout(() => setMsg(""), 2000);
                }}
                className="py-2.5 bg-[#0B0F1E] border border-white/10 rounded-xl text-[12px] font-bold text-slate-400"
              >
                Copy
              </button>
            </div>

            <div className="mt-4 p-3 bg-sky-400/10 border border-sky-400/20 rounded-xl">
              <div className="text-[10px] font-black tracking-widest text-sky-400">
                FORMAT TIP
              </div>
              <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                question_text, option_a, b, c, d, correct (A-D), explanation.
                One per line.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

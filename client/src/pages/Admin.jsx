import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { VITALS } from "../config/vitals";

const API = VITALS.SYSTEM.API_BASE;
const SUBJECTS = [
  "english",
  "mathematics",
  "physics",
  "chemistry",
  "biology",
  "accounting",
  "economics",
  "commerce",
  "government",
  "literature",
  "crs",
  "geography",
  "history",
];
const ALIAS_MAP = {
  mathematics: "mathematics",
  maths: "mathematics",
  math: "mathematics",
  govt: "government",
  lit: "literature",
  crk: "crs",
  crs: "crs",
};
const normalize = (s) => ALIAS_MAP[s.toLowerCase()] || s.toLowerCase();

const mockMetrics = {
  kpis: { totalRevenue: "₦200", mrr: "₦200", activeSubs: 1, usersOnline: 1 },
  revenueTrend: [
    { month: "Jan", revenue: 0 },
    { month: "Feb", revenue: 0 },
    { month: "Mar", revenue: 200 },
  ],
  subjectPopularity: [{ name: "english", attempts: 1 }],
};

function Toast({ message, onClose }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  const isSuccess = message.includes("✅");
  const isWarning = message.includes("⚠️");
  const isInfo = message.includes("ℹ️") || message.includes("⏳");
  return (
    <div
      className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-full text-[13px] font-bold shadow-[0_12px_40px_rgba(0,0,0,0.6)] border backdrop-blur-xl flex items-center gap-2 ${isSuccess ? "bg-[#121A2E]/90 border-emerald-500/30 text-emerald-300" : isWarning ? "bg-[#121A2E]/90 border-amber-400/30 text-amber-300" : isInfo ? "bg-[#121A2E]/90 border-sky-400/30 text-sky-300" : "bg-[#121A2E]/90 border-red-500/30 text-red-300"}`}
    >
      <span>{message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-slate-500 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}

function DashboardStats({ counts }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    const pass = localStorage.getItem("admin_pass");
    fetch(`${API}/admin/metrics`, { headers: { "x-admin-password": pass } })
      .then((r) => r.json())
      .then((realData) => setData(realData))
      .catch(() => setData(mockMetrics));
  }, []);
  if (!data)
    return (
      <div className="bg-[#121A2E]/70 backdrop-blur-xl border border-white/10 p-6 rounded-[20px] text-slate-400 text-sm">
        Loading metrics...
      </div>
    );
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="group relative bg-[#121A2E]/70 backdrop-blur-xl p-5 rounded-[20px] border border-white/10 overflow-hidden hover:-translate-y-1 transition-all">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
          <p className="text-slate-500 text-[10px] tracking-widest font-bold uppercase">
            Total Revenue
          </p>
          <h2 className="text-[22px] font-black text-white mt-1">
            {data.kpis.totalRevenue}
          </h2>
        </div>
        <div className="group relative bg-[#121A2E]/70 backdrop-blur-xl p-5 rounded-[20px] border border-white/10 overflow-hidden hover:-translate-y-1 transition-all">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-sky-400/30 to-transparent" />
          <p className="text-slate-500 text-[10px] tracking-widest font-bold uppercase">
            MRR
          </p>
          <h2 className="text-[22px] font-black text-sky-400 mt-1">
            {data.kpis.mrr}
          </h2>
        </div>
        <div className="group relative bg-[#121A2E]/70 backdrop-blur-xl p-5 rounded-[20px] border border-white/10 overflow-hidden hover:-translate-y-1 transition-all">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
          <p className="text-slate-500 text-[10px] tracking-widest font-bold uppercase">
            Active Subs
          </p>
          <h2 className="text-[22px] font-black text-emerald-400 mt-1">
            {data.kpis.activeSubs}
          </h2>
        </div>
        <div className="group relative bg-[#121A2E]/70 backdrop-blur-xl p-5 rounded-[20px] border border-white/10 overflow-hidden hover:-translate-y-1 transition-all">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-violet-400/30 to-transparent" />
          <p className="text-slate-500 text-[10px] tracking-widest font-bold uppercase">
            Users Online
          </p>
          <h2 className="text-[22px] font-black text-white mt-1 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></span>
            {data.kpis.usersOnline}
          </h2>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <div className="bg-[#121A2E]/70 backdrop-blur-xl p-5 rounded-[20px] border border-white/10 relative overflow-hidden">
          <h3
            className="text-white font-extrabold text-[13px] tracking-wide mb-4"
            style={{ fontFamily: "Cinzel" }}
          >
            REVENUE TREND
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.revenueTrend}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
              />
              <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#121A2E",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#38bdf8"
                fill="rgba(56,189,248,0.15)"
                strokeWidth={2.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[#121A2E]/70 backdrop-blur-xl p-5 rounded-[20px] border border-white/10 relative overflow-hidden">
          <h3
            className="text-white font-extrabold text-[13px] tracking-wide mb-4"
            style={{ fontFamily: "Cinzel" }}
          >
            SUBJECT POPULARITY
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.subjectPopularity}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
              />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#121A2E",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                }}
              />
              <Bar dataKey="attempts" fill="#FBBF24" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

export default function Admin() {
  const [isAuthed, setIsAuthed] = useState(
    () => localStorage.getItem("admin_ok") === "yes",
  );
  const [adminPass, setAdminPass] = useState(
    () => localStorage.getItem("admin_pass") || "",
  );
  const [passInput, setPassInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [subject, setSubject] = useState("english");
  const [counts, setCounts] = useState({});
  const [csvText, setCsvText] = useState("");
  const [status, setStatus] = useState("");
  const [fileName, setFileName] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(true);
  const [cbtDur, setCbtDur] = useState(120);
  const [cbtQ, setCbtQ] = useState(10);
  const [cbtEn, setCbtEn] = useState(true);

  useEffect(() => {
    if (!isAuthed) return;
    const LIMIT = 30 * 60 * 1000;
    let t;
    const reset = () => {
      localStorage.setItem("admin_last_active", Date.now().toString());
      clearTimeout(t);
      t = setTimeout(() => {
        localStorage.removeItem("admin_ok");
        localStorage.removeItem("admin_pass");
        localStorage.removeItem("admin_last_active");
        setIsAuthed(false);
        setAdminPass("");
        setPassInput("");
        setStatus("⏳ Auto-logged out: 30 mins inactive");
      }, LIMIT);
    };
    const last = parseInt(localStorage.getItem("admin_last_active") || "0");
    if (last && Date.now() - last > LIMIT) {
      localStorage.removeItem("admin_ok");
      localStorage.removeItem("admin_pass");
      setIsAuthed(false);
      return;
    }
    const events = ["mousemove", "keydown", "click", "scroll"];
    events.forEach((ev) => window.addEventListener(ev, reset));
    reset();
    return () => {
      clearTimeout(t);
      events.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, [isAuthed]);

  const loadCounts = async (password = adminPass) => {
    try {
      const res = await fetch(`${API}/admin/reload-questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({ adminPassword: password }),
      });
      const data = await res.json();
      if (data.error) {
        if (data.error.includes("Unauthorized")) {
          localStorage.removeItem("admin_ok");
          setIsAuthed(false);
          return;
        }
        setStatus("❌ " + data.error);
        return;
      }
      const normalized = {};
      Object.entries(data.counts || {}).forEach(([k, v]) => {
        const nk = normalize(k);
        normalized[nk] = (normalized[nk] || 0) + v;
      });
      setCounts(normalized);
    } catch (e) {
      console.log(e);
    }
  };
  const loadCbtConfig = async () => {
    try {
      const res = await fetch(`${API}/api/cbt/config`);
      const data = await res.json();
      setCbtDur(data.durationMinutes);
      setCbtQ(data.questionsPerSubject);
      setCbtEn(data.enabled);
      setStatus(
        `ℹ️ CBT Loaded: ${data.durationMinutes} mins, ${data.questionsPerSubject} Qs/subject = ${data.questionsPerSubject * 4} total`,
      );
    } catch (e) {
      setStatus("❌ CBT config not reachable - check backend");
    }
  };
  useEffect(() => {
    if (isAuthed && adminPass) {
      loadCounts(adminPass);
      loadCbtConfig();
    }
  }, [isAuthed]);

  const handleLogin = async () => {
    if (!passInput.trim()) {
      setLoginError("Enter password");
      return;
    }
    try {
      const res = await fetch(`${API}/admin/reload-questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": passInput,
        },
        body: JSON.stringify({ adminPassword: passInput }),
      });
      const data = await res.json();
      if (data.error) {
        setLoginError("❌ Wrong password");
        return;
      }
      localStorage.setItem("admin_pass", passInput);
      localStorage.setItem("admin_ok", "yes");
      localStorage.setItem("admin_last_active", Date.now().toString());
      setAdminPass(passInput);
      setIsAuthed(true);
      setLoginError("");
      const normalized = {};
      Object.entries(data.counts || {}).forEach(([k, v]) => {
        const nk = normalize(k);
        normalized[nk] = (normalized[nk] || 0) + v;
      });
      setCounts(normalized);
    } catch (err) {
      setLoginError("❌ Server not reachable");
    }
  };
  const handleLogout = () => {
    localStorage.removeItem("admin_ok");
    localStorage.removeItem("admin_pass");
    localStorage.removeItem("admin_last_active");
    setIsAuthed(false);
    setAdminPass("");
    setPassInput("");
  };
  const processFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target.result);
    reader.readAsText(file);
  };
  const csvRowCount = csvText.trim()
    ? csvText.trim().split("\n").length - 1
    : 0;

  const handleUpload = async () => {
    if (!csvText.trim()) return setStatus("❌ Paste CSV or upload file first");
    setStatus("⏳ Uploading...");
    try {
      const canonicalSubject = normalize(subject);
      const res = await fetch(`${API}/admin/upload-questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPass,
        },
        body: JSON.stringify({
          subject: canonicalSubject,
          csvText,
          adminPassword: adminPass,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const added = data.added ?? 0;
        const skipped = data.skippedDuplicate ?? 0;
        const invalid = data.skippedInvalid ?? 0;
        if (added === 0 && skipped > 0) {
          setStatus(
            `⚠️ No new — ${skipped} duplicates skipped (already in ${canonicalSubject}). Total: ${data.total}`,
          );
        } else {
          setStatus(
            `✅ ${added} added, ${skipped} duplicates skipped, ${invalid} invalid. Total: ${data.total} for ${canonicalSubject}`,
          );
        }
        if (added > 0) {
          setCsvText("");
          setFileName("");
        }
        loadCounts();
      } else {
        if (data.error?.includes("Unauthorized")) {
          setStatus("❌ Session expired");
          handleLogout();
        } else setStatus("❌ " + data.error);
      }
    } catch (err) {
      setStatus("❌ Failed: " + err.message);
    }
  };

  const saveCbt = async () => {
    setStatus("⏳ Saving CBT settings...");
    try {
      const res = await fetch(`${API}/api/cbt/config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPass,
        },
        body: JSON.stringify({
          durationMinutes: parseInt(cbtDur),
          questionsPerSubject: parseInt(cbtQ),
          enabled: cbtEn,
          adminPassword: adminPass,
        }),
      });
      const data = await res.json();
      if (data.success || data.config) {
        setStatus(
          `✅ CBT Saved: ${data.config.durationMinutes} mins, ${data.config.questionsPerSubject} Qs/subject = ${data.config.questionsPerSubject * 4} total`,
        );
        setCbtDur(data.config.durationMinutes);
        setCbtQ(data.config.questionsPerSubject);
      } else setStatus("❌ " + (data.error || JSON.stringify(data)));
    } catch (e) {
      setStatus(
        "❌ Failed to save CBT - check routes/cbt.js has PUT /config with auth",
      );
    }
  };

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-[#080C18] relative grid place-items-center p-5 overflow-hidden">
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&display=swap');`}</style>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-[800px] h-[600px] -top-[200px] -left-[200px] bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.25),_transparent_65%)] blur-[40px]" />
        </div>
        <div className="relative bg-[#121A2E]/80 backdrop-blur-xl border border-white/10 rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.5)] p-8 w-full max-w-[380px] text-center overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
          <div className="text-4xl">🔐</div>
          <h2
            className="text-white font-black text-[20px] mt-3"
            style={{ fontFamily: "Cinzel" }}
          >
            Palace Vault
          </h2>
          <p className="text-slate-500 text-[11px] tracking-widest mt-1">
            30 MIN AUTO-LOCK ENABLED
          </p>
          <input
            type="password"
            value={passInput}
            onChange={(e) => setPassInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Enter admin password"
            className="w-full mt-6 px-4 py-3 rounded-full bg-[#0F172A] border border-white/10 text-white text-sm outline-none focus:border-amber-400/50"
          />
          <button
            onClick={handleLogin}
            className="w-full mt-3 py-3 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-black font-black text-sm"
          >
            Unlock Palace 👑
          </button>
          {loginError && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl text-[13px]">
              {loginError}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070B18] relative py-6 px-4 overflow-hidden">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&display=swap');`}</style>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-[900px] h-[700px] -top-[250px] -left-[250px] bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.20),_transparent_65%)] blur-[40px]" />
        <div className="absolute w-[700px] h-[700px] top-[30%] right-[-200px] bg-[radial-gradient(ellipse_at_center,_rgba(168,85,247,0.15),_transparent_65%)] blur-[40px]" />
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        <Toast message={status} onClose={() => setStatus("")} />

        <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center mb-6 bg-[#121A2E]/70 backdrop-blur-xl border border-white/10 rounded-[20px] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 grid place-items-center font-black">
              👑
            </div>
            <div>
              <h1
                className="text-white font-black text-xl tracking-tight"
                style={{ fontFamily: "Cinzel" }}
              >
                jamb•2go{" "}
                <span className="text-slate-500 font-sans text-[14px] font-bold ml-1">
                  Command
                </span>
              </h1>
              <p className="text-slate-500 text-[10px] tracking-widest">
                PALACE ADMIN • AUTO-LOCK 30M
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => (window.location.href = "/admin/topics")}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 text-black font-black text-[13px] shadow-[0_6px_20px_rgba(16,185,129,0.3)] hover:scale-[1.02] transition"
            >
              🎯 Drill Topics
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              className="px-4 py-2.5 rounded-full bg-[#0F172A] border border-white/10 text-slate-300 text-[13px] font-bold hover:border-white/20"
            >
              🏠 Lobby
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2.5 rounded-full bg-[#0F172A] border border-white/10 text-slate-500 text-[13px] font-bold hover:text-white"
            >
              Logout →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <button
            onClick={() => (window.location.href = "/admin/topics")}
            className="text-left p-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/20 hover:border-emerald-400/40 transition"
          >
            <div className="text-xl">🎯</div>
            <div className="font-black text-white text-[13px] mt-2">
              Drill Palace
            </div>
            <div className="text-[11px] text-emerald-300/70">Manage topics</div>
          </button>
          <a
            href="/cbt-setup"
            target="_blank"
            className="text-left p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 hover:border-sky-400/40 transition block"
          >
            <div className="text-xl">🖋️</div>
            <div className="font-black text-white text-[13px] mt-2">
              Test CBT
            </div>
            <div className="text-[11px] text-sky-300/70">Live exam</div>
          </a>
          <button
            onClick={() => (window.location.href = "/cbt-drill")}
            className="text-left p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 hover:border-violet-400/40 transition"
          >
            <div className="text-xl">⚔️</div>
            <div className="font-black text-white text-[13px] mt-2">
              Test Drill
            </div>
            <div className="text-[11px] text-violet-300/70">User view</div>
          </button>
          <button
            onClick={() => loadCounts()}
            className="text-left p-4 rounded-2xl bg-[#121A2E] border border-white/10 hover:border-white/20 transition"
          >
            <div className="text-xl">🔄</div>
            <div className="font-black text-white text-[13px] mt-2">
              Reload Vault
            </div>
            <div className="text-[11px] text-slate-500">Refresh counts</div>
          </button>
        </div>

        <DashboardStats counts={counts} />

        <div className="bg-[#121A2E]/70 backdrop-blur-xl rounded-[20px] border border-white/10 p-5 mb-6 relative overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h3
              className="text-white font-bold text-[12px] tracking-widest"
              style={{ fontFamily: "Cinzel" }}
            >
              QUESTION VAULT
            </h3>
            <span className="text-[11px] text-slate-500">
              {Object.keys(counts).length} subjects •{" "}
              {Object.values(counts).reduce((a, b) => a + b, 0)} Qs
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Object.entries(counts).map(([k, v]) => (
              <div
                key={k}
                className={`bg-[#0F172A] border rounded-[12px] px-3 py-2.5 flex justify-between items-center ${v < cbtQ ? "border-red-500/30" : "border-white/10"}`}
              >
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  {k}
                </span>
                <span
                  className={`font-black text-[13px] ${v < cbtQ ? "text-red-400" : "text-amber-400"}`}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#121A2E]/80 backdrop-blur-xl rounded-[20px] border border-emerald-500/20 p-6 mb-6 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
          <h3
            className="text-white font-black text-[14px] flex items-center gap-2"
            style={{ fontFamily: "Cinzel" }}
          >
            ⚙️ JAMB CBT CONTROL{" "}
            <span className="text-[9px] bg-emerald-500/15 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/20 font-sans">
              LIVE
            </span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
            <div>
              <label className="text-[10px] font-bold tracking-widest text-slate-500">
                DURATION (MINUTES)
              </label>
              <input
                type="number"
                value={cbtDur}
                onChange={(e) => setCbtDur(e.target.value)}
                className="w-full mt-2 px-4 py-3 rounded-full bg-[#0F172A] border border-white/10 text-white font-bold outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest text-slate-500">
                QUESTIONS / SUBJECT
              </label>
              <input
                type="number"
                value={cbtQ}
                onChange={(e) => setCbtQ(e.target.value)}
                className="w-full mt-2 px-4 py-3 rounded-full bg-[#0F172A] border border-amber-400/30 text-white font-bold outline-none"
              />
              <p className="text-[11px] text-amber-300 mt-1.5 font-bold">
                Total: {parseInt(cbtQ || 0) * 4} Qs
              </p>
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest text-slate-500">
                ENABLED
              </label>
              <div className="flex items-center gap-3 mt-3">
                <input
                  type="checkbox"
                  checked={cbtEn}
                  onChange={(e) => setCbtEn(e.target.checked)}
                  className="w-5 h-5 accent-amber-400"
                />
                <span
                  className={`text-sm font-bold ${cbtEn ? "text-emerald-400" : "text-red-400"}`}
                >
                  {cbtEn ? "CBT Active" : "Disabled"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-6 flex-wrap">
            <button
              onClick={saveCbt}
              className="px-6 py-3 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 text-black font-black text-sm"
            >
              💾 Save Settings
            </button>
            <button
              onClick={loadCbtConfig}
              className="px-5 py-3 rounded-full bg-[#0F172A] border border-white/10 text-slate-300 text-sm font-bold"
            >
              🔄 Load Current
            </button>
            <a
              href="/cbt-setup"
              target="_blank"
              className="px-5 py-3 rounded-full bg-sky-400/10 border border-sky-400/20 text-sky-300 text-sm font-bold"
            >
              → Test CBT
            </a>
          </div>
        </div>

        <div className="bg-[#121A2E]/70 backdrop-blur-xl rounded-[20px] border border-white/10 overflow-hidden">
          <button
            onClick={() => setIsUploadOpen(!isUploadOpen)}
            className="w-full flex justify-between items-center p-5 text-white font-bold text-[13px]"
          >
            <span style={{ fontFamily: "Cinzel" }}>
              CSV VAULT{" "}
              {csvRowCount > 0 && (
                <span className="ml-2 bg-amber-400 text-black text-[10px] px-2.5 py-1 rounded-full font-sans">
                  {csvRowCount} rows
                </span>
              )}
            </span>
            <span className="text-amber-400 text-xl">
              {isUploadOpen ? "−" : "+"}
            </span>
          </button>
          {isUploadOpen && (
            <div className="p-6 border-t border-white/10">
              <label className="text-[10px] font-bold tracking-widest text-slate-500">
                SELECT SUBJECT
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(normalize(e.target.value))}
                className="w-full mt-2 px-4 py-3 rounded-full bg-[#0F172A] border border-white/10 text-white text-sm outline-none"
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s.toUpperCase()}
                  </option>
                ))}
              </select>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  processFile(e.dataTransfer.files[0]);
                }}
                className={`relative mt-4 border-2 border-dashed rounded-[20px] p-8 text-center transition-all ${isDragOver ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-[#0F172A]/50"}`}
              >
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => processFile(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="pointer-events-none">
                  <div className="text-2xl">📄</div>
                  <p className="text-sm font-semibold text-slate-300 mt-2">
                    {fileName
                      ? `📄 ${fileName} • ${csvRowCount} Qs`
                      : "Drag & drop CSV here or click"}
                  </p>
                </div>
              </div>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="question_text,option_a,option_b,option_c,option_d,correct,explanation"
                className="w-full h-[180px] mt-4 p-4 rounded-[16px] bg-[#0F172A] border border-white/10 text-slate-300 text-[12px] font-mono outline-none"
              />
              <button
                onClick={handleUpload}
                className="w-full mt-5 py-3.5 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-black font-black text-[14px] shadow-[0_8px_24px_rgba(251,191,36,0.25)]"
              >
                ➕ Append{" "}
                {csvRowCount > 0 ? `${csvRowCount} Questions` : "Questions"} to
                Vault
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

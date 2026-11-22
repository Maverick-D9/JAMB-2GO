// client/src/unified/UnifiedVaultAdmin.jsx
import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { UNIFIED } from "./unified.config";

const FORMULAS = [
  { label: "Fraction ½", insert: "$$\\frac{a}{b}$$" },
  { label: "√ Square Root", insert: "$$\\sqrt{x}$$" },
  { label: "x² Power", insert: "$$x^{2}$$" },
  { label: "Quadratic", insert: "$$\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$" },
  { label: "∫ Integral", insert: "$$\\int_{a}^{b} f(x) dx$$" },
  { label: "∑ Sum", insert: "$$\\sum_{i=1}^{n} x_i$$" },
  { label: "π Pi", insert: "$$\\pi$$" },
  { label: "θ Theta", insert: "$$\\theta$$" },
  { label: "≠ Not Equal", insert: "$$\\neq$$" },
  { label: "≤ ≤", insert: "$$\\leq$$" },
  { label: "α Alpha", insert: "$$\\alpha$$" },
  { label: "Δ Delta", insert: "$$\\Delta$$" },
];

export default function UnifiedVaultAdmin() {
  const [tab, setTab] = useState("single"); // single | bulk | manage
  const [subject, setSubject] = useState("mathematics");
  const [topic, setTopic] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [diagramUrl, setDiagramUrl] = useState("");
  const [diagramType, setDiagramType] = useState("link");
  const [options, setOptions] = useState({ A: "", B: "", C: "", D: "" });
  const [correct, setCorrect] = useState("A");
  const [explanation, setExplanation] = useState("");
  const [msg, setMsg] = useState("");
  const [activeField, setActiveField] = useState("question");
  const [editingId, setEditingId] = useState(null);

  // --- MANAGE VAULT STATE ---
  const [vault, setVault] = useState([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [filterSubject, setFilterSubject] = useState("all");
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState({});

  const fileRef = useRef();
  const pass = localStorage.getItem("admin_pass");
  const headers = {
    "Content-Type": "application/json",
    "x-admin-password": pass,
  };

  // --- FETCH VAULT ---
  const fetchVault = async () => {
    setVaultLoading(true);
    try {
      // Try main list endpoint, fallback to ?subject=
      let r = await fetch(`${UNIFIED.API_BASE}/api/unified/vault/list`, {
        headers: { "x-admin-password": pass },
      });
      if (!r.ok)
        r = await fetch(`${UNIFIED.API_BASE}/api/unified/vault`, {
          headers: { "x-admin-password": pass },
        });
      const d = await r.json();
      // Backend fit return {questions: []} or [] or {data: []}
      const list =
        d.questions || d.data || d.items || (Array.isArray(d) ? d : []);
      setVault(list);
      // Count per subject
      const c = {};
      list.forEach((q) => {
        const s = (q.subject || "unknown").toLowerCase();
        c[s] = (c[s] || 0) + 1;
      });
      setCounts(c);
    } catch (e) {
      setMsg("❌ Could not load vault: " + e.message);
    }
    setVaultLoading(false);
  };

  // Auto-load when Manage tab opens
  useEffect(() => {
    if (tab === "manage") fetchVault();
  }, [tab]);

  const filteredVault = vault.filter((q) => {
    if (
      filterSubject !== "all" &&
      (q.subject || "").toLowerCase() !== filterSubject
    )
      return false;
    if (!search.trim()) return true;
    const hay =
      `${q.questionText || q.question || ""} ${q.topic || ""} ${q.subject || ""}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  const deleteQuestion = async (id) => {
    if (!window.confirm("Delete this question from Vault?")) return;
    const r = await fetch(`${UNIFIED.API_BASE}/api/unified/vault/${id}`, {
      method: "DELETE",
      headers: { "x-admin-password": pass },
    });
    const d = await r.json();
    if (d.success || r.ok) {
      setMsg("✅ Deleted!");
      fetchVault();
    } else setMsg("❌ Delete failed: " + (d.error || "Unknown"));
  };

  const editQuestion = (q) => {
    setSubject(q.subject || "mathematics");
    setTopic(q.topic || "");
    setQuestionText(q.questionText || q.question || "");
    setDiagramUrl(q.diagramUrl || q.diagram || "");
    setDiagramType(q.diagramType || "link");
    setOptions({
      A: q.optionA || "",
      B: q.optionB || "",
      C: q.optionC || "",
      D: q.optionD || "",
    });
    setCorrect(q.correct || "A");
    setExplanation(q.explanation || "");
    setEditingId(q._id || q.id);
    setTab("single");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // --- Insert formula like Word ---
  const insertFormula = (code) => {
    if (activeField === "question")
      setQuestionText((p) => p + " " + code + " ");
    else if (activeField === "explanation")
      setExplanation((p) => p + " " + code + " ");
    else
      setOptions((p) => ({
        ...p,
        [activeField]: p[activeField] + " " + code + " ",
      }));
  };
  const insertTag = (tag) => {
    if (activeField === "question")
      setQuestionText((p) => p + ` <${tag}></${tag}> `);
  };

  // --- Image File Upload ---
  const uploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMsg("⏳ Uploading diagram...");
    const fd = new FormData();
    fd.append("image", file);
    const r = await fetch(
      `${UNIFIED.API_BASE}/api/unified/vault/upload-diagram`,
      { method: "POST", headers: { "x-admin-password": pass }, body: fd },
    );
    const d = await r.json();
    if (d.success) {
      setDiagramUrl(d.url);
      setDiagramType("file");
      setMsg("✅ Diagram uploaded!");
    } else setMsg("❌ Upload failed: " + d.error);
  };

  // --- Save Single (Create OR Update if editing) ---
  const saveSingle = async () => {
    if (!questionText.trim()) return setMsg("❌ Question empty");
    setMsg("⏳ Saving...");
    const payload = {
      subject,
      topic,
      questionText,
      diagramUrl,
      diagramType,
      optionA: options.A,
      optionB: options.B,
      optionC: options.C,
      optionD: options.D,
      correct,
      explanation,
    };
    const url = editingId
      ? `${UNIFIED.API_BASE}/api/unified/vault/${editingId}`
      : `${UNIFIED.API_BASE}/api/unified/vault`;
    const method = editingId ? "PUT" : "POST";
    const r = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    setMsg(
      d.success
        ? editingId
          ? "✅ Updated in Unified Vault!"
          : "✅ Saved to Unified Vault!"
        : "❌ " + d.error,
    );
    if (d.success) {
      setQuestionText("");
      setOptions({ A: "", B: "", C: "", D: "" });
      setDiagramUrl("");
      setExplanation("");
      setEditingId(null);
      if (tab === "single" && editingId) {
        /* stay */
      }
    }
  };

  // --- Bulk Upload Excel ---
  const handleBulk = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMsg("⏳ Reading Excel...");
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);
    const r = await fetch(`${UNIFIED.API_BASE}/api/unified/vault/bulk`, {
      method: "POST",
      headers,
      body: JSON.stringify({ questions: rows }),
    });
    const d = await r.json();
    setMsg(
      d.success ? `✅ Bulk done! ${d.count} questions added!` : "❌ " + d.error,
    );
  };

  return (
    <div className="bg-[#121A2E] border border-white/10 rounded-[20px] p-4 mt-4">
      <h3 className="font-black text-white">
        🗄️ UNIFIED VAULT — Upload Questions
      </h3>

      {/* TABS */}
      <div className="flex gap-2 mt-3 flex-wrap">
        <button
          onClick={() => setTab("single")}
          className={`px-4 py-2 rounded-full text-[12px] font-bold ${tab === "single" ? "bg-amber-400 text-black" : "bg-white/10 text-white"}`}
        >
          ✍️ Single Form
        </button>
        <button
          onClick={() => setTab("bulk")}
          className={`px-4 py-2 rounded-full text-[12px] font-bold ${tab === "bulk" ? "bg-amber-400 text-black" : "bg-white/10 text-white"}`}
        >
          📦 Bulk Upload (Excel)
        </button>
        <button
          onClick={() => setTab("manage")}
          className={`px-4 py-2 rounded-full text-[12px] font-bold ${tab === "manage" ? "bg-emerald-400 text-black" : "bg-white/10 text-white"}`}
        >
          📋 Manage Vault {vault.length > 0 ? `(${vault.length})` : ""}
        </button>
      </div>

      {tab === "single" && (
        <>
          {editingId && (
            <div className="mt-3 bg-amber-400/10 border border-amber-400/30 rounded-xl px-3 py-2 flex justify-between items-center">
              <span className="text-amber-300 text-[12px] font-bold">
                ✏️ Editing existing question — Save go update am
              </span>
              <button
                onClick={() => {
                  setEditingId(null);
                  setQuestionText("");
                  setOptions({ A: "", B: "", C: "", D: "" });
                  setDiagramUrl("");
                  setExplanation("");
                }}
                className="text-[11px] bg-white/10 px-2 py-1 rounded-lg"
              >
                Cancel Edit
              </button>
            </div>
          )}
          <div className="mt-4 bg-[#080C18] rounded-xl p-2">
            <p className="text-[11px] text-slate-400 px-1">
              Click field first, then click formula — e go insert am:
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button
                onClick={() => insertTag("b")}
                className="px-2 py-1 bg-white/10 rounded-lg text-[12px] font-black"
              >
                B
              </button>
              <button
                onClick={() => insertTag("i")}
                className="px-2 py-1 bg-white/10 rounded-lg text-[12px] italic"
              >
                I
              </button>
              {FORMULAS.map((f) => (
                <button
                  key={f.label}
                  onClick={() => insertFormula(f.insert)}
                  className="px-2 py-1 bg-amber-400/15 text-amber-300 border border-amber-400/20 rounded-lg text-[11px]"
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-2 px-1">
              Or type LaTeX directly: e.g.{" "}
              <code className="text-amber-300">{"$$ \\frac{1}{2} $$"}</code> — e
              go render fine for exam.
            </p>
          </div>

          <div className="flex gap-2 mt-3">
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 bg-[#080C18] border border-white/10 rounded-xl px-3 py-2.5 text-white text-[13px]"
            >
              {UNIFIED.SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic e.g. Quadratic"
              className="flex-1 bg-[#080C18] border border-white/10 rounded-xl px-3 py-2.5 text-white text-[13px]"
            />
          </div>

          <label className="text-[11px] text-slate-400 mt-3 block">
            Question — click to make am active field
          </label>
          <textarea
            value={questionText}
            onFocus={() => setActiveField("question")}
            onChange={(e) => setQuestionText(e.target.value)}
            rows={4}
            placeholder="If $$x^2 + 2x + 1 = 0$$, find x. Or click formula button above."
            className="w-full mt-1 bg-[#080C18] border border-white/10 rounded-xl px-3 py-2.5 text-white text-[13px]"
          />

          <label className="text-[11px] text-slate-400 mt-3 block">
            Diagram — File OR Link
          </label>
          <div className="flex gap-2 mt-1">
            <input
              value={diagramUrl}
              onChange={(e) => {
                setDiagramUrl(e.target.value);
                setDiagramType("link");
              }}
              placeholder="Paste image link https://..."
              className="flex-1 bg-[#080C18] border border-white/10 rounded-xl px-3 py-2.5 text-white text-[13px]"
            />
            <button
              onClick={() => fileRef.current.click()}
              className="px-4 py-2.5 rounded-xl bg-white/10 text-white text-[12px] font-bold"
            >
              📁 Upload File
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={uploadFile}
            />
          </div>
          {diagramUrl && (
            <img
              src={diagramUrl}
              className="w-full max-h-[200px] object-contain rounded-xl mt-2 bg-black/30"
            />
          )}

          {["A", "B", "C", "D"].map((l) => (
            <div key={l} className="flex gap-2 mt-2 items-center">
              <button
                onClick={() => setCorrect(l)}
                className={`w-9 h-9 rounded-full text-[12px] font-black shrink-0 ${correct === l ? "bg-emerald-400 text-black" : "bg-white/10 text-white"}`}
              >
                {l}
              </button>
              <input
                value={options[l]}
                onFocus={() => setActiveField(l)}
                onChange={(e) =>
                  setOptions({ ...options, [l]: e.target.value })
                }
                placeholder={`Option ${l} — fit put $$formula$$ too`}
                className="flex-1 bg-[#080C18] border border-white/10 rounded-xl px-3 py-2.5 text-white text-[13px]"
              />
            </div>
          ))}
          <p className="text-[11px] text-slate-500 mt-1">
            Tap the letter circle to mark correct answer.
          </p>

          <label className="text-[11px] text-slate-400 mt-3 block">
            Explanation (with formula allowed)
          </label>
          <textarea
            value={explanation}
            onFocus={() => setActiveField("explanation")}
            onChange={(e) => setExplanation(e.target.value)}
            rows={2}
            placeholder="Solution: $$x = -1$$ because..."
            className="w-full mt-1 bg-[#080C18] border border-white/10 rounded-xl px-3 py-2.5 text-white text-[13px]"
          />

          <button
            onClick={saveSingle}
            className="w-full mt-4 py-3 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black text-[13px]"
          >
            {editingId
              ? "Update in Unified Vault →"
              : "Save to Unified Vault →"}
          </button>
        </>
      )}

      {tab === "bulk" && (
        <div className="mt-4 bg-[#080C18] rounded-xl p-4">
          <p className="text-white font-bold text-[13px]">📦 Bulk Upload</p>
          <p className="text-[12px] text-slate-400 mt-1">
            Excel columns must be exactly:
          </p>
          <code className="block bg-black/40 p-2 rounded-lg text-[11px] text-amber-300 mt-2 break-all">
            subject | topic | questionText | diagramUrl | optionA | optionB |
            optionC | optionD | correct | explanation
          </code>
          <p className="text-[11px] text-slate-500 mt-2">
            Example row: <br /> mathematics | Quadratic | If $$x^2=4$$ find x |
            https://.../triangle.png | $$2$$ | $$-2$$ | $$±2$$ | 0 | C | $$x =
            ±2$$
          </p>
          <label className="block mt-4 px-4 py-3 rounded-xl bg-amber-400 text-black font-black text-center text-[13px] cursor-pointer">
            📂 Choose Excel File (.xlsx / .csv)
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleBulk}
            />
          </label>
          <p className="text-[11px] text-slate-500 mt-2">
            Diagram for bulk na Link only. If you want file upload, use Single
            Form — e go upload to Cloudinary.
          </p>
        </div>
      )}

      {tab === "manage" && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="bg-[#080C18] border border-white/10 rounded-xl px-3 py-2 text-white text-[12px]"
            >
              <option value="all">All Subjects ({vault.length})</option>
              {Object.keys(counts).map((s) => (
                <option key={s} value={s}>
                  {s} ({counts[s]})
                </option>
              ))}
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Search topic or question..."
              className="flex-1 min-w-[160px] bg-[#080C18] border border-white/10 rounded-xl px-3 py-2 text-white text-[12px]"
            />
            <button
              onClick={fetchVault}
              className="px-4 py-2 rounded-xl bg-white/10 text-white text-[12px] font-bold"
            >
              🔄 Refresh
            </button>
          </div>

          {vaultLoading ? (
            <p className="text-slate-400 text-[12px] mt-4">
              ⏳ Loading vault...
            </p>
          ) : filteredVault.length === 0 ? (
            <div className="bg-[#080C18] rounded-xl p-4 mt-3 text-center">
              <p className="text-slate-400 text-[13px]">
                No questions found for this filter.
              </p>
              <p className="text-slate-500 text-[11px] mt-1">
                Try All Subjects, or upload some first.
              </p>
            </div>
          ) : (
            <div className="space-y-3 mt-3">
              <p className="text-[12px] text-slate-400">
                Showing {filteredVault.length} question(s)
              </p>
              {filteredVault.map((q, i) => {
                const qText = q.questionText || q.question || "";
                const dUrl = q.diagramUrl || q.diagram || "";
                const id = q._id || q.id;
                return (
                  <div
                    key={id || i}
                    className="bg-[#080C18] border border-white/10 rounded-xl p-3"
                  >
                    <div className="flex justify-between gap-2">
                      <span className="text-[11px] font-bold text-amber-300 uppercase">
                        {q.subject} • {q.topic || "No topic"}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        #{i + 1}
                      </span>
                    </div>
                    <p className="text-white text-[13px] mt-1 whitespace-pre-wrap">
                      {qText}
                    </p>
                    {dUrl && (
                      <img
                        src={dUrl}
                        className="w-full max-h-[160px] object-contain rounded-lg mt-2 bg-black/30"
                        alt="diagram"
                      />
                    )}
                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      {["A", "B", "C", "D"].map((l) => (
                        <div
                          key={l}
                          className={`px-2 py-1.5 rounded-lg text-[12px] ${q.correct === l ? "bg-emerald-400/20 border border-emerald-400/40 text-emerald-300 font-bold" : "bg-white/5 text-slate-300"}`}
                        >
                          {l}. {q[`option${l}`] || q[l] || ""}
                        </div>
                      ))}
                    </div>
                    {q.explanation && (
                      <p className="text-[11px] text-slate-500 mt-2">
                        💡 {q.explanation}
                      </p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => editQuestion(q)}
                        className="px-3 py-1.5 rounded-lg bg-amber-400 text-black text-[11px] font-bold"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => deleteQuestion(id)}
                        className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 text-[11px] font-bold"
                      >
                        🗑️ Delete
                      </button>
                      {dUrl && (
                        <button
                          onClick={() => window.open(dUrl, "_blank")}
                          className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-[11px]"
                        >
                          🖼️ View Diagram
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {msg && <p className="text-[12px] mt-3 text-slate-300">{msg}</p>}
    </div>
  );
}

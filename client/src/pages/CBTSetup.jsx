import { useState, useEffect } from "react";
import { VITALS } from "../config/vitals";

const API_BASE = VITALS.SYSTEM.API_BASE;
const CBT = VITALS.CBT;

// Aligned with backend VITALS.CBT.SUBJECTS
// Backend has both "maths" + "mathematics" as aliases - show only "mathematics" once
// "english" is compulsory, so exclude it from selectable list
const ALL_SUBJECTS = CBT.SUBJECTS.filter(
  (s) => s !== "english" && s !== "maths",
);

const PALACE_MAP = {
  "english-room": "english",
  "maths-room": "mathematics",
  "mathematics-room": "mathematics",
  "physics-room": "physics",
  "chemistry-room": "chemistry",
  "biology-room": "biology",
  "economics-room": "economics",
  "commerce-room": "commerce",
  "government-room": "government",
  "govt-room": "government",
  "literature-room": "literature",
  "accounting-room": "accounting",
  "crs-room": "crs",
  crs: "crs",
  "geography-room": "geography",
  "agric-room": "agric",
  "agriculture-room": "agric",
  "marketing-room": "commerce",
  "yoruba-room": "english",
  "irs-room": "irs",
};

// --- STRONG SHUFFLE UTILS ---
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function strongShuffleQuestions(questions) {
  let shuffled = shuffleArray(questions);
  for (let i = 1; i < shuffled.length; i++) {
    const prev = (
      shuffled[i - 1].question_text ||
      shuffled[i - 1].question ||
      ""
    ).slice(0, 22);
    const curr = (
      shuffled[i].question_text ||
      shuffled[i].question ||
      ""
    ).slice(0, 22);
    if (prev === curr) {
      let k = i + 1;
      while (
        k < shuffled.length &&
        (shuffled[k].question_text || shuffled[k].question || "").slice(
          0,
          22,
        ) === curr
      )
        k++;
      if (k < shuffled.length) {
        [shuffled[i], shuffled[k]] = [shuffled[k], shuffled[i]];
      }
    }
  }
  return shuffled;
}

function shuffleOptionsForQuestion(q) {
  const rawCorrect = q.correct_answer || q.correct || "A";
  const key = String(rawCorrect).toLowerCase().replace("option_", "").charAt(0);
  const correctText = q[`option_${key}`] || q.option_a;

  const opts = [
    { text: q.option_a },
    { text: q.option_b },
    { text: q.option_c },
    { text: q.option_d },
  ].filter((o) => o.text);

  const shuffled = shuffleArray(opts);
  const newIdx = shuffled.findIndex((o) => o.text === correctText);
  const newLabel = ["A", "B", "C", "D"][newIdx >= 0 ? newIdx : 0];

  return {
    ...q,
    option_a: shuffled[0]?.text || "",
    option_b: shuffled[1]?.text || "",
    option_c: shuffled[2]?.text || "",
    option_d: shuffled[3]?.text || "",
    correct_answer: newLabel,
    correct: newLabel,
  };
}

export default function CBTSetup() {
  const [config, setConfig] = useState(null);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasSub, setHasSub] = useState(null);
  const [access, setAccess] = useState(null);
  const [checkingSub, setCheckingSub] = useState(true);
  const [paying, setPaying] = useState(false);
  const [palaceSubject, setPalaceSubject] = useState(null);
  const [dailyCount, setDailyCount] = useState(0);
  // Fallback = frontend VITALS, truth = backend /cbt/status limit
  const [dailyLimit, setDailyLimit] = useState(CBT.DAILY_LIMIT);
  const [dailyLoading, setDailyLoading] = useState(true);

  const getUser = () => {
    try {
      const s = localStorage.getItem("jambite_user");
      return s ? JSON.parse(s) : {};
    } catch {
      return {};
    }
  };
  const authed = getUser();
  const userId =
    authed.userId || authed.username || localStorage.getItem("userId") || "";
  const email = authed.email || "";
  const REQUIRED = CBT.REQUIRED_SUBJECTS_COUNT; // 3
  const TOTAL_SUBJECTS = REQUIRED + 1; // + english

  useEffect(() => {
    fetch(`${API_BASE}/api/cbt/config`)
      .then((r) => r.json())
      .then((c) => {
        setConfig(c);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    const url = new URL(window.location.href);
    const subjParam = url.searchParams.get("subject");
    if (subjParam) {
      const mapped =
        PALACE_MAP[subjParam.toLowerCase()] ||
        subjParam.replace("-room", "").toLowerCase();
      if (mapped && mapped !== "english") {
        setPalaceSubject(mapped);
        setSelected([mapped]);
      } else if (mapped === "english") setPalaceSubject("english");
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const reference = url.searchParams.get("reference");
    if (
      reference &&
      url.pathname.includes("cbt-setup") &&
      url.searchParams.get("payment") === "verify"
    ) {
      fetch(`${API_BASE}/api/payment/subscribe/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            alert(VITALS.MESSAGES.PAY_SUCCESS);
            window.history.replaceState(
              {},
              "",
              "/cbt-setup" +
                (palaceSubject ? `?subject=${palaceSubject}-room` : ""),
            );
            setHasSub(true);
            if (d.access) setAccess(d.access);
            setCheckingSub(false);
          } else {
            setHasSub(false);
            setCheckingSub(false);
          }
        })
        .catch(() => {
          setHasSub(false);
          setCheckingSub(false);
        });
      return;
    }
    const emailToUse = email || userId;
    if (!emailToUse) {
      setHasSub(false);
      setCheckingSub(false);
      return;
    }
    fetch(`${API_BASE}/api/payment/access/${encodeURIComponent(emailToUse)}`)
      .then((r) => r.json())
      .then((data) => {
        setAccess(data);
        const hasValidPass =
          data.tier === "full_access" ||
          (data.tier === "trial" && (data.daysLeft ?? 0) > 0) ||
          data.isActive === true;

        setHasSub(hasValidPass);
        setCheckingSub(false);
      })
      .catch(() => {
        setHasSub(false);
        setCheckingSub(false);
      });
  }, [palaceSubject, email, userId]);

  useEffect(() => {
    if (!userId || hasSub !== true) {
      setDailyLoading(false);
      return;
    }
    fetch(`${API_BASE}/api/cbt/status`, {
      headers: { "x-user-id": userId },
    })
      .then((r) => r.json())
      .then((d) => {
        setDailyCount(d.count || 0);
        if (d.limit) setDailyLimit(d.limit); // backend is truth
        setDailyLoading(false);
      })
      .catch(() => setDailyLoading(false));
  }, [userId, hasSub]);

  const toggle = (subj) => {
    if (selected.includes(subj)) {
      if (subj === palaceSubject) {
        if (!confirm(`Remove ${subj} which came from Palace?`)) return;
      }
      setSelected(selected.filter((s) => s !== subj));
    } else {
      if (selected.length >= REQUIRED)
        return alert(
          `You can select only ${REQUIRED} subjects + English is compulsory`,
        );
      setSelected([...selected, subj]);
    }
  };

  const handlePay = async () => {
    if (!userId) return alert("Please login first");
    const emailToUse =
      email || prompt("Enter your email for Paystack receipt:");
    if (!emailToUse) return;
    setPaying(true);
    try {
      const res = await fetch(`${API_BASE}/api/payment/subscribe/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email: emailToUse }),
      });
      const data = await res.json();
      const authUrl = data.data?.authorization_url || data.authorization_url;
      const reference = data.data?.reference || data.reference;
      if (authUrl) {
        if (reference) localStorage.setItem("paystack_ref", reference);
        window.location.href = authUrl;
      } else {
        alert(
          data.error || `Failed to init ${VITALS.SUBSCRIPTION.DISPLAY} payment`,
        );
        setPaying(false);
      }
    } catch (e) {
      alert(e.message);
      setPaying(false);
    }
  };

  const start = async () => {
    if (selected.length !== REQUIRED)
      return alert(`Select exactly ${REQUIRED} subjects`);
    if (dailyCount >= dailyLimit) {
      return alert(VITALS.MESSAGES.DAILY_LIMIT_REACHED(dailyCount, dailyLimit));
    }
    localStorage.removeItem("cbt_result");
    localStorage.removeItem("cbt_exam");
    sessionStorage.clear();
    const res = await fetch(`${API_BASE}/api/cbt/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ subjects: selected, userId, username: userId }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.code === "SUBSCRIPTION_REQUIRED" || res.status === 403) {
        setHasSub(false);
        return alert(VITALS.MESSAGES.EXPIRED_CBT);
      }
      if (res.status === 429 || data.code === "DAILY_LIMIT") {
        if (data.count != null) setDailyCount(data.count);
        if (data.limit) setDailyLimit(data.limit);
        return alert(
          data.error ||
            VITALS.MESSAGES.DAILY_LIMIT_REACHED(
              data.count ?? dailyCount,
              data.limit ?? dailyLimit,
            ),
        );
      }
      return alert(data.error || "Failed to start CBT");
    }
    if (data.cbtDailyUsage) setDailyCount(data.cbtDailyUsage.count);

    if (data.questions) {
      const fixed = {};
      Object.entries(data.questions).forEach(([sub, arr]) => {
        const withShuffledOpts = arr.map((q) => shuffleOptionsForQuestion(q));
        fixed[sub] = strongShuffleQuestions(withShuffledOpts);
      });
      data.questions = fixed;
      data.papers = fixed;
    }

    localStorage.setItem("cbt_exam", JSON.stringify(data));
    window.location.href = "/cbt-exam";
  };

  if (loading || checkingSub)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0A0F1A",
          display: "grid",
          placeItems: "center",
          color: "#94a3b8",
        }}
      >
        {VITALS.MESSAGES.CHECKING_PASS}
      </div>
    );
  if (!config?.enabled)
    return (
      <div style={{ padding: 40 }}>
        <h2>{VITALS.MESSAGES.CBT_DISABLED}</h2>
      </div>
    );

  if (hasSub === false) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0A0F1A",
          display: "grid",
          placeItems: "center",
          padding: 20,
        }}
      >
        <div
          style={{
            maxWidth: 500,
            width: "100%",
            padding: 30,
            background: "#fff",
            borderRadius: 20,
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>
            {VITALS.MESSAGES.CBT_LOCKED_TITLE}
          </h2>
          <p style={{ color: "#555", marginBottom: 20 }}>
            Unlock{" "}
            <b>
              {VITALS.SUBSCRIPTION.LABEL} {VITALS.SUBSCRIPTION.NAME}
            </b>{" "}
            to get Live Rooms + {CBT.DAILY_LIMIT} CBTs/day + Drill Palace.
          </p>
          {palaceSubject && (
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #22c55e",
                padding: "8px 12px",
                borderRadius: 100,
                fontSize: 12,
                fontWeight: 700,
                color: "#166534",
                marginBottom: 14,
              }}
            >
              👑 From Palace: {palaceSubject.toUpperCase()} will be pre-selected
            </div>
          )}
          <div
            style={{
              background: "#fffbeb",
              border: "1px solid #fde68a",
              padding: 15,
              borderRadius: 12,
              textAlign: "left",
              fontSize: 14,
              marginBottom: 20,
              lineHeight: 1.6,
            }}
          >
            <div>✅ All Live Rooms</div>
            <div>
              ✅ {CBT.DAILY_LIMIT} Full CBTs per day ({TOTAL_SUBJECTS} subjects)
            </div>
            <div>✅ Drill Palace • Topic Mastery</div>
            <div>✓ Real JAMB Timing ({config?.durationMinutes} mins)</div>
            <div>✓ Chat & DMs Unlocked</div>
            <div>✓ Valid for {VITALS.SUBSCRIPTION.DURATION_DAYS} days</div>
          </div>
          <button
            onClick={handlePay}
            disabled={paying}
            style={{
              width: "100%",
              padding: 14,
              background: "linear-gradient(90deg,#fbbf24,#f59e0b)",
              color: "#000",
              borderRadius: 12,
              fontWeight: 800,
              border: "none",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            {paying
              ? "Redirecting to Paystack..."
              : VITALS.MESSAGES.PAY_BUTTON_FULL}
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            style={{
              marginTop: 10,
              background: "transparent",
              border: "none",
              color: "#64748b",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ← Back to Palace
          </button>
          <p style={{ fontSize: 11, color: "#999", marginTop: 12 }}>
            Secure payment via Paystack • User: {userId || "Not logged in"} •
            One Pass for Everything
          </p>
        </div>
      </div>
    );
  }

  const attemptsLeft = Math.max(0, dailyLimit - dailyCount);
  const isLimitReached = dailyCount >= dailyLimit;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0F1A",
        padding: "20px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 600,
          margin: "30px auto",
          padding: 24,
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
            JAMB CBT Mode
          </h2>
          <span
            style={{
              background: "#dcfce7",
              color: "#166534",
              padding: "4px 12px",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            ✓ {VITALS.MESSAGES.PASS_BADGE} • {access?.daysLeft || 0}d left
          </span>
        </div>

        <div
          style={{
            background: isLimitReached ? "#fef2f2" : "#eff6ff",
            border: `1px solid ${isLimitReached ? "#fecaca" : "#bfdbfe"}`,
            padding: "10px 14px",
            borderRadius: 12,
            marginBottom: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: isLimitReached ? "#991b1b" : "#1e40af",
            }}
          >
            {dailyLoading
              ? "Checking attempts..."
              : `📝 Full CBT Today: ${dailyCount}/${dailyLimit}`}
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: isLimitReached ? "#dc2626" : "#16a34a",
            }}
          >
            {dailyLoading
              ? ""
              : isLimitReached
                ? "Limit Reached"
                : `${attemptsLeft} left`}
          </div>
        </div>

        {isLimitReached && (
          <div
            style={{
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              padding: 12,
              borderRadius: 12,
              marginBottom: 14,
              fontSize: 13,
              color: "#7f1d1d",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            ⏰ {VITALS.MESSAGES.DAILY_LIMIT_REACHED(dailyCount, dailyLimit)}{" "}
            Drill Palace is still unlimited!
          </div>
        )}

        {palaceSubject ? (
          <div
            style={{
              background: "linear-gradient(135deg, #0A0F1A, #1e293b)",
              color: "white",
              padding: "12px 14px",
              borderRadius: 12,
              marginBottom: 14,
              border: "1px solid #FBBF24",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <span style={{ color: "#FBBF24", fontWeight: 800 }}>
                👑 From Palace:
              </span>{" "}
              {palaceSubject.toUpperCase()}{" "}
              {palaceSubject === "english"
                ? " (English is already compulsory!)"
                : " pre-selected"}
            </div>
            <button
              onClick={() => (window.location.href = "/")}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "white",
                padding: "4px 10px",
                borderRadius: 100,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Change
            </button>
          </div>
        ) : null}
        <p
          style={{
            color: "#666",
            marginBottom: 15,
            lineHeight: 1.5,
            fontSize: 13,
          }}
        >
          English is compulsory. Select {REQUIRED} other subjects.
          <br />
          Duration: <b>{config.durationMinutes} mins</b> • Per subject:{" "}
          <b>{config.questionsPerSubject} Qs</b> •{" "}
          <span style={{ color: "#16a34a", fontWeight: 800 }}>
            Total: {config.questionsPerSubject * TOTAL_SUBJECTS} Qs
          </span>
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              padding: 12,
              border: "2px solid #16a34a",
              borderRadius: 12,
              background: "#f0fdf4",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            ✓ English (compulsory){" "}
            {palaceSubject === "english" && (
              <span style={{ color: "#f59e0b" }}>👑</span>
            )}
          </div>
          {ALL_SUBJECTS.map((sub) => {
            const isSelected = selected.includes(sub);
            const isPalace = sub === palaceSubject;
            return (
              <div
                key={sub}
                onClick={() => toggle(sub)}
                style={{
                  padding: 12,
                  border: isSelected
                    ? isPalace
                      ? "2px solid #FBBF24"
                      : "2px solid #2563eb"
                    : "1px solid #e5e7eb",
                  borderRadius: 12,
                  cursor: "pointer",
                  background: isSelected
                    ? isPalace
                      ? "#fffbeb"
                      : "#eff6ff"
                    : "#fff",
                  textTransform: "capitalize",
                  fontWeight: isSelected ? 700 : 400,
                  fontSize: 13,
                  position: "relative",
                  boxShadow:
                    isPalace && isSelected
                      ? "0 0 0 2px rgba(251,191,36,0.3)"
                      : "none",
                  opacity: isLimitReached ? 0.5 : 1,
                  pointerEvents: isLimitReached ? "none" : "auto",
                }}
              >
                {isSelected ? "✓ " : ""} {sub} {isPalace && " 👑"}
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginBottom: 14,
            fontSize: 13,
            background: "#f8fafc",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
          }}
        >
          Selected:{" "}
          <b>
            {selected.length}/{REQUIRED}
          </b>{" "}
          - {selected.join(", ") || "None yet"}{" "}
          {palaceSubject &&
            selected.length > 0 &&
            ` • 👑 ${palaceSubject} from Palace`}
        </div>
        <button
          onClick={start}
          disabled={selected.length !== REQUIRED || isLimitReached}
          style={{
            width: "100%",
            padding: 14,
            background:
              selected.length === REQUIRED && !isLimitReached
                ? "#0A0F1A"
                : "#9ca3af",
            color: "#fff",
            borderRadius: 12,
            fontWeight: 800,
            border: "none",
            cursor:
              selected.length === REQUIRED && !isLimitReached
                ? "pointer"
                : "not-allowed",
            letterSpacing: 0.3,
          }}
        >
          {isLimitReached
            ? `Daily Limit Reached ${dailyCount}/${dailyLimit} — Try Tomorrow`
            : selected.length === REQUIRED
              ? `Start CBT Exam — ${selected.join(", ").toUpperCase()} + ENGLISH 👑`
              : `Select ${REQUIRED - selected.length} more subject(s)`}
        </button>
        <button
          onClick={() => (window.location.href = "/")}
          style={{
            width: "100%",
            marginTop: 10,
            padding: 10,
            background: "transparent",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            fontSize: 12,
            color: "#64748b",
            cursor: "pointer",
          }}
        >
          ← Back to King's Palace
        </button>
      </div>
    </div>
  );
}

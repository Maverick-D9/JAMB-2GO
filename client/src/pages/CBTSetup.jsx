import { useState, useEffect } from "react";
import { VITALS } from "../config/vitals";

const API_BASE = VITALS.SYSTEM.API_BASE;

const ALL_SUBJECTS = [
  "mathematics",
  "physics",
  "chemistry",
  "biology",
  "geography",
  "economics",
  "government",
  "literature",
  "commerce",
  "accounting",
  "history",
  "agriculture",
  "marketing",
  "yoruba",
  "irs",
];

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
  "crs-room": "history",
  crs: "history",
  "geography-room": "geography",
  "agric-room": "agriculture",
  "marketing-room": "marketing",
  "yoruba-room": "yoruba",
  "irs-room": "irs",
};

export default function CBTSetup() {
  const [config, setConfig] = useState(null);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasSub, setHasSub] = useState(null);
  const [access, setAccess] = useState(null);
  const [checkingSub, setCheckingSub] = useState(true);
  const [paying, setPaying] = useState(false);
  const [palaceSubject, setPalaceSubject] = useState(null);

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
        const isFull = data.tier === "full_access";
        setHasSub(isFull);
        setCheckingSub(false);
      })
      .catch(() => {
        setHasSub(false);
        setCheckingSub(false);
      });
  }, [palaceSubject, email, userId]);

  const toggle = (subj) => {
    if (selected.includes(subj)) {
      if (subj === palaceSubject) {
        if (!confirm(`Remove ${subj} which came from Palace?`)) return;
      }
      setSelected(selected.filter((s) => s !== subj));
    } else {
      if (selected.length >= 3)
        return alert("You can select only 3 subjects + English is compulsory");
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
    if (selected.length !== 3) return alert("Select exactly 3 subjects");
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
      return alert(data.error || "Failed to start CBT");
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
              {VITALS.SUBSCRIPTION.DISPLAY}/month {VITALS.SUBSCRIPTION.NAME}
            </b>{" "}
            to get Live Rooms + Unlimited CBT + Drill Palace.
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
            <div>✅ All 11 Live Rooms</div>
            <div>✅ Unlimited CBT Attempts</div>
            <div>✅ Drill Palace • Topic Mastery</div>
            <div>✓ Real JAMB Timing ({config?.durationMinutes} mins)</div>
            <div>✓ Chat & DMs Unlocked</div>
            <div>✓ Valid for 30 days</div>
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
          English is compulsory. Select 3 other subjects.
          <br />
          Duration: <b>{config.durationMinutes} mins</b> • Per subject:{" "}
          <b>{config.questionsPerSubject} Qs</b> •{" "}
          <span style={{ color: "#16a34a", fontWeight: 800 }}>
            Total: {config.questionsPerSubject * 4} Qs
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
          Selected: <b>{selected.length}/3</b> -{" "}
          {selected.join(", ") || "None yet"}{" "}
          {palaceSubject &&
            selected.length > 0 &&
            ` • 👑 ${palaceSubject} from Palace`}
        </div>
        <button
          onClick={start}
          disabled={selected.length !== 3}
          style={{
            width: "100%",
            padding: 14,
            background: selected.length === 3 ? "#0A0F1A" : "#9ca3af",
            color: "#fff",
            borderRadius: 12,
            fontWeight: 800,
            border: "none",
            cursor: "pointer",
            letterSpacing: 0.3,
          }}
        >
          {selected.length === 3
            ? `Start CBT Exam — ${selected.join(", ").toUpperCase()} + ENGLISH 👑`
            : `Select ${3 - selected.length} more subject(s)`}
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

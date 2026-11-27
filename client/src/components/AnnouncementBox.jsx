import { useState, useEffect } from "react";
import { VITALS } from "../config/vitals";

const API_BASE = VITALS.SYSTEM.API_BASE;

// Make any https://... inside message clickable
function Linkify({ text }) {
  const parts = String(text || "").split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-300 underline font-bold break-all"
          >
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

const STYLES = {
  info: {
    border: "border-sky-400/40",
    bg: "bg-sky-500/10",
    badge: "bg-sky-400 text-black",
    badgeText: "📢 ANNOUNCEMENT",
    btn: "bg-sky-400 text-black",
  },
  warning: {
    border: "border-amber-400/50",
    bg: "bg-amber-500/10",
    badge: "bg-amber-400 text-black",
    badgeText: "⚠️ NOTICE",
    btn: "bg-amber-400 text-black",
  },
  urgent: {
    border: "border-red-500/50",
    bg: "bg-red-500/10",
    badge: "bg-red-500 text-white",
    badgeText: "🚨 URGENT",
    btn: "bg-red-500 text-white",
  },
};

export default function AnnouncementBox() {
  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/announcements/active`)
      .then((r) => r.json())
      .then((d) => {
        if (d.announcement) {
          // If admin post new one, show am again even if user dismissed old one
          const lastSeen = sessionStorage.getItem("announcement_seen");
          if (lastSeen !== d.announcement._id) setDismissed(false);
          setData(d.announcement);
        } else setData(null);
      })
      .catch(() => {});
  }, []);

  if (!data || dismissed) return null;

  const s = STYLES[data.type] || STYLES.info;
  const hasLink = data.linkUrl && data.linkUrl.trim() !== "";

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("announcement_seen", data._id);
  };

  return (
    <div
      className={`mt-4 ${s.bg} backdrop-blur-xl border ${s.border} rounded-[16px] px-4 py-3.5 relative`}
    >
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/30 text-slate-300 text-[12px] grid place-items-center hover:bg-black/60"
        title="Dismiss"
      >
        ✕
      </button>

      <div className="flex items-center gap-2 pr-6">
        <span
          className={`text-[10px] font-black px-2 py-1 rounded-full ${s.badge}`}
        >
          {s.badgeText}
        </span>
        <span className="text-white text-[13px] font-extrabold truncate">
          {data.title}
        </span>
      </div>

      <p className="text-slate-300 text-[12.5px] leading-6 mt-2 pr-2 whitespace-pre-line">
        <Linkify text={data.message} />
      </p>

      {hasLink && (
        <a
          href={data.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-3 inline-flex items-center gap-1.5 ${s.btn} text-[12px] font-black px-4 py-2.5 rounded-full hover:opacity-90`}
        >
          {data.linkLabel || "Open Link"} ↗
        </a>
      )}
    </div>
  );
}

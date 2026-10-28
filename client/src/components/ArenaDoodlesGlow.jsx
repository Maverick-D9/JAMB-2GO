import React from "react";

export default function ArenaDoodlesGlow() {
  return (
    <>
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-16px) rotate(2deg)} }
        @keyframes glowPulse { 0%,100%{filter:drop-shadow(0 0 8px #22d3ee) drop-shadow(0 0 16px #22d3ee); opacity:.85} 50%{filter:drop-shadow(0 0 14px #22d3ee) drop-shadow(0 0 28px #60a5fa); opacity:1} }
        .doodle { animation: float 5s ease-in-out infinite, glowPulse 2.5s ease-in-out infinite; }
      `}</style>

      <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
        {/* LIGHTBULB - top left */}
        <svg
          className="doodle absolute left-[2%] top-[10%] w-28 h-28 text-cyan-300"
          style={{ animationDelay: "0s" }}
          viewBox="0 0 100 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M35 15 C20 25 20 55 35 65 L35 75 Q50 80 65 75 L65 65 C80 55 80 25 65 15 Z" />
          <path d="M40 75 L60 75 M42 80 L58 80 M44 85 L56 85" />
          <path d="M45 45 Q50 35 55 45 Q50 55 45 45" />
        </svg>
        {/* ATOM - top right */}
        <svg
          className="doodle absolute right-[3%] top-[8%] w-32 h-32 text-cyan-300"
          style={{ animationDelay: "0.6s" }}
          viewBox="0 0 100 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle cx="50" cy="50" r="8" />
          <ellipse cx="50" cy="50" rx="40" ry="16" />
          <ellipse
            cx="50"
            cy="50"
            rx="40"
            ry="16"
            transform="rotate(60 50 50)"
          />
          <ellipse
            cx="50"
            cy="50"
            rx="40"
            ry="16"
            transform="rotate(120 50 50)"
          />
          <circle cx="85" cy="35" r="3" fill="currentColor" />
          <circle cx="20" cy="70" r="3" fill="currentColor" />
        </svg>
        {/* GRADUATION CAP - left mid */}
        <svg
          className="doodle absolute left-[3%] top-[45%] w-28 h-20 text-cyan-200"
          style={{ animationDelay: "1.1s" }}
          viewBox="0 0 100 60"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M5 25 L50 5 L95 25 L50 45 L5 25" />
          <path d="M15 30 L15 45 Q50 58 85 45 L85 30" />
          <circle cx="80" cy="18" r="2" fill="currentColor" />
          <path d="M80 18 L85 38 L82 35 L78 38" />
        </svg>
        {/* BEAKER - right mid */}
        <svg
          className="doodle absolute right-[4%] top-[48%] w-24 h-36 text-cyan-300"
          style={{ animationDelay: "1.4s" }}
          viewBox="0 0 60 90"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <path d="M20 5 L20 35 L5 75 Q5 85 20 85 L40 85 Q55 85 55 75 L40 35 L40 5" />
          <path d="M15 65 Q30 60 45 68 Q30 75 15 65" />
          <circle cx="35" cy="50" r="2.5" />
          <circle cx="45" cy="42" r="1.5" />
        </svg>
        {/* BOOK - left bottom */}
        <svg
          className="doodle absolute left-[4%] bottom-[12%] w-32 h-24 text-cyan-200"
          style={{ animationDelay: "0.9s" }}
          viewBox="0 0 100 70"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M5 20 Q25 5 50 20 Q75 5 95 20 L85 60 Q65 75 50 60 Q35 75 15 60 Z" />
          <path d="M50 20 L50 60" />
          <path d="M15 30 Q35 22 48 30 M60 28 Q80 22 90 30" />
        </svg>
        {/* PI - right bottom */}
        <div
          className="doodle absolute right-[5%] bottom-[6%] text-7xl font-serif text-cyan-300"
          style={{ animationDelay: "0.4s" }}
        >
          π
        </div>
        <div
          className="doodle absolute left-[38%] bottom-[4%] text-4xl font-mono text-cyan-200 tracking-wider"
          style={{ animationDelay: "1.7s" }}
        >
          E=mc²
        </div>
        <div
          className="doodle absolute left-[2%] bottom-[2%] text-5xl text-cyan-300/60"
          style={{ animationDelay: "2s" }}
        >
          ∑
        </div>
      </div>
    </>
  );
}

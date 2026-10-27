"use client";
import { useEffect, useState, useRef } from "react";

// Premium Config based on your spec
const getHypeConfig = (username, streak, timeTaken) => {
  const name = username.toUpperCase();

  // FAST < 3s - Neon Cyan Glow
  if (timeTaken < 3) {
    return {
      text: `⚡ TOO FAST! ${name}!`,
      subText: "UNDER 3 SECONDS! ⚡",
      gradient:
        "linear-gradient(to bottom, #22D3EE 0%, #06B6D4 50%, #0E7490 100%)",
      glow: "4px 4px 0px #000000, 0px 0px 25px rgba(34, 211, 238, 0.9)",
      borderGlow: "shadow-[0_0_40px_rgba(34,211,238,0.6)]",
    };
  }
  // STREAK 3+ - Fire Gradient
  if (streak >= 3) {
    const fireText =
      streak >= 5 ? `🔥🔥🔥 RAMPAGE! ${name}!` : `🔥 ${name} IS ON FIRE!`;
    return {
      text: fireText,
      subText: `${streak} IN A ROW! KEEP GOING!`,
      gradient:
        "linear-gradient(to bottom, #FEF08A 0%, #FBBF24 50%, #EF4444 100%)",
      glow: "4px 4px 0px #000000, 0px 0px 35px rgba(239, 68, 68, 0.8)",
      borderGlow: "shadow-[0_0_50px_rgba(239,68,68,0.7)]",
    };
  }
  // NORMAL - Premium Gold (Your main spec)
  const normal = [
    `BOOM! ${name}! 💥`,
    `${name} SCORES! 🎯`,
    `${name} TAKES LEAD! 🚀`,
  ];
  return {
    text: normal[Math.floor(Math.random() * normal.length)],
    subText: "+20 POINTS!",
    gradient:
      "linear-gradient(to bottom, #FDE047 0%, #F59E0B 50%, #B45309 100%)",
    glow: "4px 4px 0px #000000, 0px 0px 25px rgba(253, 224, 71, 0.6)",
    borderGlow: "shadow-[0_0_50px_rgba(253,224,71,0.5)]",
  };
};

export default function TextHype({
  socket,
  isLeaderboardOpen,
  username: currentUser,
}) {
  const [hype, setHype] = useState(null);
  const [trash, setTrash] = useState(null);
  const queueRef = useRef([]);

  const showHype = (data) => {
    if (isLeaderboardOpen) {
      queueRef.current.push(data);
      return;
    }
    setHype(data);
    setTimeout(() => {
      setHype(null);
      if (queueRef.current.length > 0 && !isLeaderboardOpen) {
        const next = queueRef.current.shift();
        setTimeout(() => showHype(next), 300);
      }
    }, 2800);
  };

  useEffect(() => {
    if (!isLeaderboardOpen && queueRef.current.length > 0) {
      const next = queueRef.current.shift();
      showHype(next);
    }
  }, [isLeaderboardOpen]);

  useEffect(() => {
    if (!socket) return;
    socket.on("answer_result", (d) => {
      if (!d.isCorrect) {
        if (d.username !== currentUser) return;
        setTrash(`Ouch! You missed! 😬 Correct: ${d.correct}`);
        setTimeout(() => setTrash(null), 2000);
        return;
      }
      if (d.username !== currentUser && Math.random() > 0.4) return;
      const streak = d.username === currentUser ? 3 : 1;
      const timeTaken = Math.random() * 5;
      const config = getHypeConfig(d.username, streak, timeTaken);
      showHype({ ...config, streak, username: d.username });
    });

    socket.on("question_locked", (data) => {
      showHype({
        text: `🔒 ${data.winner.toUpperCase()} LOCKED IT!`,
        subText: "FIRST BLOOD!",
        gradient: "linear-gradient(to bottom, #F87171 0%, #DC2626 100%)",
        glow: "4px 4px 0px #000, 0px 0px 20px rgba(239,68,68,0.6)",
        borderGlow: "shadow-[0_0_40px_rgba(220,38,38,0.6)]",
        isLock: true,
      });
    });

    return () => {
      socket.off("answer_result");
      socket.off("question_locked");
    };
  }, [socket, isLeaderboardOpen, currentUser]);

  return (
    <>
      {hype && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[150] pointer-events-none px-4"
          style={{
            background: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          {/* Premium Game Card */}
          <div
            className={`w-full max-w-3xl text-center py-8 px-8 rounded-[24px] border-4 border-white animate-pop ${hype.borderGlow} bg-[#0F172A]/90`}
          >
            <h1
              className="font-black italic leading-none tracking-tight uppercase animate-wiggle"
              style={{
                fontFamily:
                  "Impact, Montserrat ExtraBold, Bebas Neue, sans-serif",
                fontSize: "4rem",
                background: hype.gradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                WebkitTextStroke: "2px white",
                textShadow: hype.glow,
                lineHeight: "0.9",
              }}
            >
              {hype.text}
            </h1>
            <div
              className="mt-3 text-white font-black text-[18px] tracking-widest"
              style={{
                textShadow: "2px 2px 0px #000",
                fontFamily: "Space Grotesk",
              }}
            >
              {hype.subText}
            </div>
          </div>
        </div>
      )}
      {trash && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] bg-black/80 text-white px-6 py-3 rounded-full font-bold text-[14px] animate-slide border border-white/10">
          {trash}
        </div>
      )}
      <style>{`
        @keyframes pop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-pop { animation: pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.5) forwards; }
        @keyframes wiggle {
          0%, 100% { transform: rotate(-2deg); }
          50% { transform: rotate(2deg); }
        }
        .animate-wiggle { animation: wiggle 0.35s ease-in-out infinite; }
        @keyframes slide {
          from { transform: translate(-50%, 15px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        .animate-slide { animation: slide 0.25s ease-out; }
        @media (max-width: 768px) {
          h1 { font-size: 2.5rem !important; }
        }
      `}</style>
    </>
  );
}

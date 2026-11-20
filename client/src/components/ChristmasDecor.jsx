export default function ChristmasDecor() {
  const bulbs = ["#FF3B30", "#FFD60A", "#34C759", "#38BDF8", "#FF9F0A"];
  const snow = Array.from({ length: 35 }, (_, i) => ({
    left: `${(i * 29) % 100}%`,
    delay: `${(i % 10) * 0.6}s`,
    dur: `${7 + (i % 6)}s`,
    size: 14 + (i % 8),
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-[999] overflow-hidden">
      <style>{`
        @keyframes xmas-fall { 0%{transform:translateY(-30px);opacity:0} 10%{opacity:1} 100%{transform:translateY(110vh);opacity:0} }
        @keyframes xmas-blink { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes xmas-sway { 0%,100%{transform:rotate(-2deg)} 50%{transform:rotate(2deg)} }
      `}</style>

      {/* TOP CHRISTMAS LIGHTS */}
      <div className="absolute top-0 left-0 right-0 flex justify-between px-1">
        {Array.from({ length: 32 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="w-[1px] h-[12px] bg-white/40" />
            <div
              className="w-[12px] h-[16px] rounded-full"
              style={{
                background: bulbs[i % bulbs.length],
                boxShadow: `0 0 14px ${bulbs[i % bulbs.length]}`,
                animation: `xmas-blink ${1 + (i % 3) * 0.4}s infinite`,
                animationDelay: `${(i % 5) * 0.2}s`,
              }}
            />
          </div>
        ))}
      </div>

      {/* FALLING SNOW */}
      {snow.map((s, i) => (
        <span
          key={i}
          className="absolute top-0 text-white/80"
          style={{
            left: s.left,
            fontSize: s.size,
            animation: `xmas-fall ${s.dur} linear infinite`,
            animationDelay: s.delay,
          }}
        >
          ❄
        </span>
      ))}

      {/* MERRY CHRISTMAS RIBBON - BOTTOM CENTER */}
      <div className="absolute top-[175px] left-1/2 -translate-x-1/2 bg-red-600 text-white text-[11px] font-black px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.7)] whitespace-nowrap">
        🎄 Merry Christmas Scholar in Advance! 🎄
      </div>

      {/* CHRISTMAS TREE - MEDIUM SIZE, BOTTOM LEFT, NO SCROLL NEEDED */}
      <div
        className="absolute bottom-[18px] left-[10px] text-center"
        style={{ animation: "xmas-sway 3s ease-in-out infinite" }}
      >
        <div className="text-[150px] leading-none drop-shadow-[0_0_25px_rgba(52,199,89,0.8)]">
          🎄
        </div>
        <div className="text-[36px] -mt-2">🎁🎁🎁</div>
      </div>

      {/* SNOWMAN - MEDIUM SIZE, BOTTOM RIGHT, NO SCROLL NEEDED */}
      <div className="absolute bottom-[18px] right-[10px] text-center">
        <div className="text-[130px] leading-none drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]">
          ⛄
        </div>
        <div className="text-[30px]">🍬🍬</div>
      </div>
    </div>
  );
}

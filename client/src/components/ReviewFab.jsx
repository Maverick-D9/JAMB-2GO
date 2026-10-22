export default function ReviewFab() {
  const isReviewsPage =
    typeof window !== "undefined" && window.location.pathname === "/reviews";
  if (isReviewsPage) return null;

  const goReviews = () => {
    window.location.href = "/reviews";
  };

  return (
    <button
      onClick={goReviews}
      className="fixed bottom-5 left-5 z-[999] bg-[#3ABFFF] text-black font-black text-[13px] px-5 py-3 rounded-full shadow-[0_0_25px_rgba(58,191,255,0.6)] hover:bg-[#5BC8FF] flex items-center gap-2 active:scale-95 transition-all animate-[slideIn_0.6s_ease-out_0.5s_both,pulseGlow_2s_infinite]"
    >
      ★ Reviews
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(-100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 15px rgba(58,191,255,0.6); }
          50% { box-shadow: 0 0 30px rgba(58,191,255,0.9); }
        }
      `}</style>
    </button>
  );
}

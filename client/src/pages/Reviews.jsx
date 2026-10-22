import { useState, useEffect } from "react";

export default function Reviews() {
  const [reviews, setReviews] = useState(() => {
    try {
      const saved = localStorage.getItem("palace_reviews");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");

  useEffect(() => {
    localStorage.setItem("palace_reviews", JSON.stringify(reviews));
  }, [reviews]);

  const avg = reviews.length
    ? (reviews.reduce((a, b) => a + b.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const newReview = {
      id: Date.now(),
      name: "You",
      avatar: "Y",
      course: "JAMBITES",
      rating,
      text,
      date: "now",
      likes: 0,
    };
    setReviews([newReview, ...reviews]);
    setText("");
  };

  // Clear existing fake reviews from old version
  const clearAll = () => {
    localStorage.removeItem("palace_reviews");
    setReviews([]);
  };

  return (
    <div className="min-h-screen bg-[#080C18] text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-black">JAMB2GO Reviews</h1>
        <p className="text-white/60 mt-1">
          {reviews.length === 0
            ? "No reviews yet. Be the first!"
            : `Join ${reviews.length} learners sharing their win`}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="bg-[#141E2F] border border-white/10 rounded-xl p-4 text-center">
            <div className="text-2xl font-black">{avg}</div>
            <div className="text-xs text-white/50">Avg Rating</div>
            <div className="text-yellow-400 text-sm">★★★★★</div>
          </div>
          <div className="bg-[#141E2F] border border-white/10 rounded-xl p-4 text-center">
            <div className="text-2xl font-black">{reviews.length}</div>
            <div className="text-xs text-white/50">Reviews</div>
          </div>
          <div className="bg-[#141E2F] border border-white/10 rounded-xl p-4 text-center">
            <div className="text-2xl font-black">
              {reviews.length ? "100%" : "0%"}
            </div>
            <div className="text-xs text-white/50">Would Recommend</div>
          </div>
        </div>

        {/* Write Review */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#141E2F] border border-white/10 rounded-2xl p-4 mt-6"
        >
          <h3 className="font-bold">Write a Review</h3>
          <div className="flex gap-1 mt-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setRating(s)}
                className={`text-2xl ${s <= rating ? "text-yellow-400" : "text-white/20"}`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="How has JAMB2Go helped you?"
            className="w-full mt-3 bg-[#080C18] border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-[#3ABFFF] min-h-[80px]"
          />
          <button className="mt-3 bg-[#3ABFFF] text-black font-bold px-6 py-2 rounded-full text-sm hover:bg-[#5BC8FF]">
            Post Review
          </button>
        </form>

        {/* Clear button to wipe old fakes - remove after first use */}
        {reviews.length > 0 && (
          <button
            onClick={clearAll}
            className="mt-4 text-xs text-white/30 underline"
          >
            Clear all (reset to zero)
          </button>
        )}

        {/* List */}
        <div className="mt-6 space-y-3">
          {reviews.length === 0 ? (
            <div className="bg-[#141E2F] border border-dashed border-white/10 rounded-2xl p-8 text-center">
              <div className="text-4xl">📝</div>
              <div className="mt-2 text-white/50 text-sm">
                No reviews yet. Your honest review will be the first.
              </div>
            </div>
          ) : (
            reviews.map((r) => (
              <div
                key={r.id}
                className="bg-[#141E2F] border border-white/10 rounded-2xl p-4"
              >
                <div className="flex justify-between">
                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#3ABFFF] text-black font-black flex items-center justify-center text-sm">
                      {r.avatar}
                    </div>
                    <div>
                      <div className="font-bold text-sm flex gap-2">
                        {r.name}{" "}
                        <span className="text-white/40 font-normal text-xs">
                          {r.course}
                        </span>
                      </div>
                      <div className="text-yellow-400 text-xs">
                        {"★".repeat(r.rating)}
                        <span className="text-white/20">
                          {"★".repeat(5 - r.rating)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-white/40">{r.date}</div>
                </div>
                <p className="text-sm text-white/80 mt-3 leading-relaxed">
                  "{r.text}"
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

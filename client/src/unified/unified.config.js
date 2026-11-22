// client/src/unified/unified.config.js
export const UNIFIED = {
  API_BASE: import.meta.env.VITE_API_URL || "http://localhost:5000",
  SUBJECTS: [
    "english",
    "mathematics",
    "physics",
    "chemistry",
    "biology",
    "commerce",
    "economics",
    "government",
    "accounting",
    "literature",
    "crs",
    "irs",
    "geography",
    "agric",
  ],
  ICONS: {
    english: "📖",
    mathematics: "🧮",
    physics: "⚛️",
    chemistry: "🧪",
    biology: "🧬",
    commerce: "💼",
    economics: "📈",
    government: "🏛️",
    accounting: "💰",
    literature: "📚",
    crs: "✝️",
    irs: "☪️",
    geography: "🌍",
    agric: "🌾",
  },
};

export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("jambite_user") || "{}");
  } catch {
    return {};
  }
};

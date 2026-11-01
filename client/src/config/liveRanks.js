export const LIVE_RANKS = [
  {
    tier: 1,
    name: "Novice",
    icon: "🐣",
    minCorrect: 0,
    color: "#94A3B8",
    glow: "shadow-slate-400/20",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
  },
  {
    tier: 2,
    name: "Apprentice",
    icon: "📚",
    minCorrect: 20,
    color: "#22C55E",
    glow: "shadow-green-400/30",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
  },
  {
    tier: 3,
    name: "Scholar",
    icon: "🎓",
    minCorrect: 60,
    color: "#3B82F6",
    glow: "shadow-blue-400/30",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
  {
    tier: 4,
    name: "Strategist",
    icon: "🧠",
    minCorrect: 200,
    color: "#A855F7",
    glow: "shadow-purple-400/30",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
  },
  {
    tier: 5,
    name: "Sage",
    icon: "🔮",
    minCorrect: 500,
    color: "#F59E0B",
    glow: "shadow-amber-400/40",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  {
    tier: 6,
    name: "Mastermind",
    icon: "👑",
    minCorrect: 1200,
    color: "#EAB308",
    glow: "shadow-yellow-400/50",
    bg: "bg-yellow-500/15",
    border: "border-yellow-400/50",
  },
  {
    tier: 7,
    name: "Grandmaster",
    icon: "🏛️",
    minCorrect: 2500,
    color: "#EF4444",
    glow: "shadow-red-500/60",
    bg: "bg-red-500/15",
    border: "border-red-500/50",
  },
];

export function getLiveRank(correctCount = 0) {
  let current = LIVE_RANKS[0];
  for (let r of LIVE_RANKS) {
    if (correctCount >= r.minCorrect) current = r;
    else break;
  }
  return current;
}

export function getIconForScore(count) {
  return getLiveRank(count).icon;
}

export function getDisplayName(username, count) {
  const rank = getLiveRank(count);
  return `${username} ${rank.icon}`;
}

// NEW: helper for glow
export function getRankStyle(count) {
  return getLiveRank(count);
}

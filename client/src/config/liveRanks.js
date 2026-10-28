export const LIVE_RANKS = [
  { tier: 1, name: "Novice", icon: "🐣", minCorrect: 0 },
  { tier: 2, name: "Apprentice", icon: "📚", minCorrect: 20 },
  { tier: 3, name: "Scholar", icon: "🎓", minCorrect: 60 },
  { tier: 4, name: "Strategist", icon: "🧠", minCorrect: 200 },
  { tier: 5, name: "Sage", icon: "🔮", minCorrect: 500 },
  { tier: 6, name: "Mastermind", icon: "👑", minCorrect: 1200 },
  { tier: 7, name: "Grandmaster", icon: "🏛️", minCorrect: 2500 },
];

export function getLiveRank(correctCount = 0) {
  let current = LIVE_RANKS[0];
  for (let r of LIVE_RANKS) {
    if (correctCount >= r.minCorrect) current = r;
    else break;
  }
  return current;
}

const mongoose = require("mongoose");
const {
  getDisplayName,
  getIconForScore,
  getLiveRank,
} = require("../config/liveRanks");

const LiveRankSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, required: true, index: true },
    score: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    displayName: { type: String, default: "" },
    icon: { type: String, default: "🐣" },
    tier: { type: String, default: "NOVICE" },
    lastCorrectAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const LiveRank =
  mongoose.models.LiveRank || mongoose.model("LiveRank", LiveRankSchema);

async function getUserRank(username) {
  if (!username) return null;
  let doc = await LiveRank.findOne({ username });
  if (!doc) {
    return {
      username,
      score: 0,
      correct: 0,
      displayName: username,
      icon: "🐣",
    };
  }
  return doc;
}

async function onCorrectAnswer(username) {
  if (!username) return { score: 0, displayName: username, icon: "🐣" };
  let doc = await LiveRank.findOne({ username });
  if (!doc) {
    doc = new LiveRank({ username, score: 1, correct: 1 });
  } else {
    doc.score += 1;
    doc.correct += 1;
    doc.lastCorrectAt = new Date();
  }
  const rankInfo = getLiveRank(doc.score);
  doc.displayName = getDisplayName(username, doc.score);
  doc.icon = getIconForScore(doc.score);
  doc.tier = rankInfo.name;
  await doc.save();
  return {
    score: doc.score,
    correct: doc.correct,
    displayName: doc.displayName,
    icon: doc.icon,
    tier: doc.tier,
  };
}

async function getGlobalRanks(limit = 100) {
  const ranks = await LiveRank.find().sort({ score: -1 }).limit(limit);
  return ranks;
}

async function rebuildIfEmpty() {
  const count = await LiveRank.countDocuments();
  console.log(`[ArenaRank] LiveRank count: ${count}`);
  return count;
}

async function updateScore(room, username, displayName, score) {
  return true;
}

module.exports = {
  getUserRank,
  onCorrectAnswer,
  getGlobalRanks,
  rebuildIfEmpty,
  updateScore,
};

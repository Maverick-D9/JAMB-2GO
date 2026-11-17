const DuelRank = require("../models/DuelRank");

function norm(u) {
  return (u || "").toString().toLowerCase().trim();
}

async function applyDuelResult(winnerUsername, loserUsername, isDraw) {
  const winner = norm(winnerUsername);
  const loser = norm(loserUsername);

  if (isDraw) {
    for (const u of [winner, loser]) {
      if (!u) continue;
      await DuelRank.findOneAndUpdate(
        { username: u },
        { $inc: { duelDraws: 1 }, $set: { lastDuelAt: new Date() } },
        { upsert: true, new: true },
      );
    }
    return { winner: null, draw: true };
  }

  if (winner) {
    await DuelRank.findOneAndUpdate(
      { username: winner },
      {
        $inc: { duelPoints: 20, duelWins: 1 },
        $set: { lastDuelAt: new Date() },
      },
      { upsert: true, new: true },
    );
  }

  if (loser) {
    const doc = await DuelRank.findOneAndUpdate(
      { username: loser },
      { $inc: { duelLosses: 1 }, $set: { lastDuelAt: new Date() } },
      { upsert: true, new: true },
    );
    const newPoints = Math.max(0, (doc?.duelPoints || 0) - 10);
    await DuelRank.findOneAndUpdate(
      { username: loser },
      { $set: { duelPoints: newPoints } },
      { new: true },
    );
  }

  return { winner };
}

async function getDuelRank(username) {
  const u = norm(username);
  const doc = await DuelRank.findOne({ username: u });
  return (
    doc || {
      username: u,
      duelPoints: 0,
      duelWins: 0,
      duelLosses: 0,
      duelDraws: 0,
    }
  );
}

async function getDuelLeaderboard(limit = 10) {
  return DuelRank.find({}).sort({ duelPoints: -1 }).limit(limit).lean();
}

module.exports = { applyDuelResult, getDuelRank, getDuelLeaderboard };

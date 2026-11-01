// This file na wrapper — so liveRankHandler.js no go crash
// It just forward everything to arenaRankService
const arena = require("./arenaRankService");
const {
  getLiveRank,
  getDisplayName,
  getIconForScore,
} = require("../config/liveRanks");

async function handleLiveCorrectAnswer(userIdOrUsername) {
  // support both id and username
  const username =
    typeof userIdOrUsername === "string"
      ? userIdOrUsername
      : userIdOrUsername?.username;
  return arena.onCorrectAnswer(username);
}

module.exports = {
  handleLiveCorrectAnswer,
  onCorrectAnswer: arena.onCorrectAnswer,
  getLiveRank,
  getDisplayName,
  getIconForScore,
  getGlobalRanks: arena.getGlobalRanks,
  rebuildIfEmpty: arena.rebuildIfEmpty,
};

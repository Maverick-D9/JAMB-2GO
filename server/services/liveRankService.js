const User = require("../models/User");
const { getLiveRank, getDisplayName } = require("../config/liveRanks");

async function handleLiveCorrectAnswer(userId) {
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { liveCorrect: 1 } },
    { new: true, select: "username liveCorrect" },
  );

  const newCount = user.liveCorrect;
  const oldCount = newCount - 1;
  const oldRank = getLiveRank(oldCount);
  const newRank = getLiveRank(newCount);

  return {
    userId: user._id,
    username: user.username,
    correctCount: newCount,
    oldRank,
    newRank,
    displayName: getDisplayName(user.username, newCount),
    leveledUp: oldRank.tier !== newRank.tier,
  };
}

module.exports = { handleLiveCorrectAnswer };

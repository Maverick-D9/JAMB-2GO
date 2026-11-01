const arenaRankService = require("../services/arenaRankService");
const { getDisplayName } = require("../config/liveRanks");

function registerLiveRankHandlers(io, socket, liveRooms) {
  // Helper to count users in room from socketUserMap via io
  async function getRoomCount(roomId) {
    try {
      const sockets = await io.in(roomId).fetchSockets();
      return sockets.length;
    } catch {
      return liveRooms.get(roomId)?.users?.length || 0;
    }
  }

  socket.on("live:answer", async ({ roomId, userId, username, isCorrect }) => {
    if (!isCorrect) return;

    const actualUser = username || userId;
    if (!actualUser) return;

    // Check if room get at least 5 users (optional)
    const count = await getRoomCount(roomId);
    if (count < 5) {
      socket.emit("live:rank:inactive", { need: 5, have: count });
      // we still continue to save score, just notify frontend
    }

    try {
      const result = await arenaRankService.onCorrectAnswer(actualUser);

      // Emit to whole room
      io.to(roomId).emit("live:user:rankUpdate", {
        username: result.username,
        displayName: result.displayName,
        score: result.score,
        icon: result.icon,
        correct: result.score,
      });

      // Announce if user cross tier
      const newRank = result.icon;
      // simple announcement for big milestones
      if ([20, 60, 200, 500, 1200, 2500].includes(result.score)) {
        io.to(roomId).emit("live:rank:announcement", {
          text: `🔥 ${result.displayName} is now ${newRank} ranked!`,
        });
      }
    } catch (e) {
      console.error("live rank error", e.message);
    }
  });
}

module.exports = { registerLiveRankHandlers };

const { handleLiveCorrectAnswer } = require("../services/liveRankService");

function registerLiveRankHandlers(io, socket, liveRooms) {
  socket.on("live:answer", async ({ roomId, userId, isCorrect }) => {
    const room = liveRooms.get(roomId);
    if (!room) return;

    if (room.users.length < 5) {
      socket.emit("live:rank:inactive", { need: 5, have: room.users.length });
      return;
    }

    if (!isCorrect) return;

    try {
      const result = await handleLiveCorrectAnswer(userId);
      io.to(roomId).emit("live:user:rankUpdate", result);
      if (result.leveledUp) {
        io.to(roomId).emit("live:rank:announcement", {
          text: `🔥 ${result.username} is now ${result.newRank.icon} ${result.newRank.name}!`,
        });
      }
    } catch (e) {
      console.error("live rank error", e);
    }
  });
}

module.exports = { registerLiveRankHandlers };

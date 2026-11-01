const mongoose = require("mongoose");
const arenaRedis = require("../utils/arenaRedis");

async function getStorage() {
  let mongo = { usedMB: "0" },
    redis = { usedHuman: "0" };
  try {
    const stats = await mongoose.connection.db.stats();
    mongo = {
      dataMB: (stats.dataSize / 1024 / 1024).toFixed(1),
      storageMB: (stats.storageSize / 1024 / 1024).toFixed(1),
      limitMB: 512,
      percent: ((stats.dataSize / (512 * 1024 * 1024)) * 100).toFixed(1) + "%",
    };
  } catch (e) {
    mongo.error = e.message;
  }

  try {
    const { pubClient } = arenaRedis.getClients();
    if (pubClient) {
      const info = await pubClient.info("memory");
      const m = info.match(/used_memory_human:(.+)\r/);
      redis.usedHuman = m ? m[1].trim() : "unknown";
      redis.limit = "25MB (free)";
    }
  } catch {}

  const ram = {
    heapMB: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1),
    limitMB: 512,
  };
  return { mongo, redis, ram, time: new Date().toISOString() };
}

// ✅ FIXED: no require("../server") inside - pass data from outside
function getLive(io, socketUserMap, roomState = {}) {
  return {
    sockets: Object.keys(socketUserMap || {}).length,
    liveArenaRooms:
      global.liveRooms?.size || io?.sockets?.adapter?.rooms?.size || 0,
    totalRoomsMemory: Object.keys(roomState || {}).length,
  };
}

module.exports = { getStorage, getLive };

// TIER 5 STEP 2A: Shared Arena State for 30k
let pubClient = null;
let subClient = null;

function setRedisClients(pub, sub) {
  pubClient = pub;
  subClient = sub;
}

function getClients() {
  return { pubClient, subClient };
}

const ROOM_KEY = (room) => `arena:room:${room}`;
const LEADERBOARD_KEY = (room) => `arena:leaderboard:${room}`;

async function saveRoomState(room, state) {
  if (!pubClient) return;
  // We don't save timers/interval, only serializable data
  const toSave = {
    currentQ: state.currentQ,
    currentIdx: state.currentIdx,
    participants: state.participants, // [{userId, name}]
    scores: state.scores, // {userId: {name, score}}
    started: !!state.started,
  };
  await pubClient.set(ROOM_KEY(room), JSON.stringify(toSave), { EX: 7200 }); // 2hr TTL
}

async function getRoomState(room) {
  if (!pubClient) return null;
  const data = await pubClient.get(ROOM_KEY(room));
  return data ? JSON.parse(data) : null;
}

async function clearRoomState(room) {
  if (!pubClient) return;
  await pubClient.del(ROOM_KEY(room));
  await pubClient.del(LEADERBOARD_KEY(room));
}

async function updateScore(room, userId, name, newScore) {
  if (!pubClient) return;
  await pubClient.hSet(
    LEADERBOARD_KEY(room),
    userId,
    JSON.stringify({ name, score: newScore }),
  );
}

module.exports = {
  setRedisClients,
  getClients,
  saveRoomState,
  getRoomState,
  clearRoomState,
  updateScore,
};

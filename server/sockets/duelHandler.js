const { applyDuelResult } = require("../services/duelRankService");

const queue = [];
const duelHistory = {}; // username -> last 5 duels
const duels = new Map();

// helpers go come from index.js
let getRandomQuestion = null;
let getShuffledQuestion = null;

function registerDuelHandlers(io, socket, helpers = {}) {
  if (helpers.getRandomQuestion) getRandomQuestion = helpers.getRandomQuestion;
  if (helpers.getShuffledQuestion)
    getShuffledQuestion = helpers.getShuffledQuestion;

  socket.on("duel:join", ({ username, subject }) => {
    if (!username) return;
    const subj = (subject || "english").toLowerCase();
    const lowerName = username.toLowerCase();

    // FIX 1: Block if this account already dey queue (2 tabs, same browser)
    const alreadyInQueue = queue.find(
      (q) => q.username.toLowerCase() === lowerName,
    );
    if (alreadyInQueue) {
      socket.emit("duel:error", {
        message:
          "You are already waiting in another tab. Open second player in Incognito / different browser.",
      });
      return;
    }

    // FIX 2: Block if this account already dey inside a duel
    for (const d of duels.values()) {
      if (d.players.some((p) => p.username.toLowerCase() === lowerName)) {
        socket.emit("duel:error", {
          message: "You are already in a duel in another tab.",
        });
        return;
      }
    }

    // Find opponent with SAME subject, not just anybody
    const oppIndex = queue.findIndex((q) => q.subject === subj);
    const opponent = oppIndex >= 0 ? queue.splice(oppIndex, 1)[0] : null;

    // FIX 3: Block same username duel - opponent must be put back, you must NOT be added
    if (opponent && opponent.username.toLowerCase() === lowerName) {
      queue.push(opponent); // put opponent back
      socket.emit("duel:error", {
        message:
          "Open second player in Incognito / different browser. Same account cannot duel itself.",
      });
      return;
    }

    if (!opponent) {
      queue.push({ socketId: socket.id, username, subject: subj });
      socket.emit("duel:waiting");
      return;
    }

    // Match found
    const duelId = `duel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Pick 10 UNIQUE questions from SAME bank as Live Room
    const seen = new Set();
    const questions = [];
    let tries = 0;
    while (questions.length < 10 && tries < 100) {
      tries++;
      const q = getRandomQuestion ? getRandomQuestion(subj) : null;
      if (!q || !q.question_text) continue;
      const key = q.question_text.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      questions.push(q);
    }
    // Fallback: if bank small, allow repeats
    while (questions.length < 10) {
      const q = getRandomQuestion ? getRandomQuestion(subj) : null;
      if (!q) break;
      questions.push(q);
    }

    const duel = {
      id: duelId,
      subject: subj,
      players: [
        { username: opponent.username, socketId: opponent.socketId, score: 0 },
        { username, socketId: socket.id, score: 0 },
      ],
      qIndex: 0,
      questions,
      answers: {},
      timer: null,
    };
    duels.set(duelId, duel);
    socket.data.duelId = duelId;
    const oppSocket = io.sockets.sockets.get(opponent.socketId);
    if (oppSocket) oppSocket.data.duelId = duelId;

    io.to(opponent.socketId).emit("duel:matched", {
      duelId,
      opponent: username,
      subject: subj,
      questionsCount: 10,
    });
    socket.emit("duel:matched", {
      duelId,
      opponent: opponent.username,
      subject: subj,
      questionsCount: 10,
    });

    sendQuestion(io, duel);
  });
  socket.on("duel:history", ({ username }) => {
    socket.emit("duel:history_result", duelHistory[username] || []);
  });

  socket.on("duel:answer", async ({ duelId, answer, answerText }) => {
    const duel = duels.get(duelId);
    if (!duel) return;
    const player = duel.players.find((p) => p.socketId === socket.id);
    if (!player) return;
    if (!duel.answers[duel.qIndex]) duel.answers[duel.qIndex] = {};
    // FIX: key by socketId, not username
    if (duel.answers[duel.qIndex][socket.id]) return; // already answered
    duel.answers[duel.qIndex][socket.id] = answer;

    const baseQ = duel.questions[duel.qIndex];
    // JUDGE BY TEXT like Live Room - same logic as index.js
    const correctLetter = (baseQ.correct || "A")
      .toString()
      .trim()
      .toUpperCase();
    const correctText = (
      baseQ["option_" + correctLetter.toLowerCase()] || ""
    ).trim();
    const givenText = (answerText || "").trim();
    // If frontend sent text, use text judge. If only letter, use letter judge.
    const isCorrect = givenText
      ? givenText.toLowerCase() === correctText.toLowerCase()
      : answer.toUpperCase() === correctLetter;

    if (isCorrect) player.score += 1;

    socket.emit("duel:answer_result", {
      isCorrect,
      correct: correctText,
      correctLetter,
      score: player.score,
    });
    // LIVE SCORE: tell both players their updated scores
    for (const p of duel.players) {
      const opp = duel.players.find((x) => x.socketId !== p.socketId);
      io.to(p.socketId).emit("duel:score_update", {
        myScore: p.score,
        opponentScore: opp?.score || 0,
      });
    }

    const answeredCount = Object.keys(duel.answers[duel.qIndex]).length;
    if (answeredCount >= 2) {
      if (duel.timer) clearTimeout(duel.timer);
      setTimeout(() => nextQuestion(io, duel), 1200);
    }
  });
  // --- DUEL CHAT: only 2 players in this duel can chat ---
  socket.on("duel:chat", ({ duelId, text }) => {
    const duel = duels.get(duelId);
    if (!duel) return;
    // Security: sender must be a player in this duel
    const sender = duel.players.find((p) => p.socketId === socket.id);
    if (!sender) return;

    const clean = (text || "").toString().trim().slice(0, 200);
    if (!clean) return;

    const msg = {
      from: sender.username,
      text: clean,
      at: Date.now(),
    };

    // Send to BOTH players (same pattern as your score_update)
    for (const p of duel.players) {
      io.to(p.socketId).emit("duel:chat_message", msg);
    }
  });

  socket.on("duel:cancel", ({ username }) => {
    const qi = queue.findIndex((q) => q.socketId === socket.id);
    if (qi >= 0) queue.splice(qi, 1);

    // Also try by username in case socketId changed
    if (username) {
      const qi2 = queue.findIndex(
        (q) => q.username.toLowerCase() === username.toLowerCase(),
      );
      if (qi2 >= 0) queue.splice(qi2, 1);
    }

    socket.emit("duel:cancelled");
  });

  socket.on("duel:leave", () => leaveDuel(io, socket));
  socket.on("disconnect", () => {
    const qi = queue.findIndex((q) => q.socketId === socket.id);
    if (qi >= 0) queue.splice(qi, 1);
    leaveDuel(io, socket);
  });

  function leaveDuel(io, socket) {
    const duelId = socket.data.duelId;
    if (!duelId) return;
    const duel = duels.get(duelId);
    if (!duel) return;
    const leaver = duel.players.find((p) => p.socketId === socket.id);
    const other = duel.players.find((p) => p.socketId !== socket.id);
    if (other && leaver)
      finishDuel(io, duel, other.username, leaver.username, true);
    socket.data.duelId = null;
  }
}

function sendQuestion(io, duel) {
  const baseQ = duel.questions[duel.qIndex];
  if (!baseQ) return finishDuel(io, duel);
  const expiresAt = Date.now() + 30000; // 30s for duel
  duel.expiresAt = expiresAt;

  // Per-player shuffle - SAME as Live Room, so dem no fit copy letter
  for (const p of duel.players) {
    const shuffled = getShuffledQuestion ? getShuffledQuestion(baseQ) : baseQ;
    io.to(p.socketId).emit("duel:question", {
      duelId: duel.id,
      qNumber: duel.qIndex + 1,
      total: 10,
      question: {
        question_text: shuffled.question_text || shuffled.question,
        option_a: shuffled.option_a,
        option_b: shuffled.option_b,
        option_c: shuffled.option_c,
        option_d: shuffled.option_d,
      },
      expiresAt,
    });
  }

  if (duel.timer) clearTimeout(duel.timer);
  duel.timer = setTimeout(() => {
    const still = duels.get(duel.id);
    if (still && still.qIndex === duel.qIndex) nextQuestion(io, duel);
  }, 30000);
}

function nextQuestion(io, duel) {
  duel.qIndex += 1;
  if (duel.qIndex >= 10) return finishDuel(io, duel);
  sendQuestion(io, duel);
}

async function finishDuel(io, duel, forcedWinner, forcedLoser, walkover) {
  if (!duels.has(duel.id)) return;
  if (duel.timer) clearTimeout(duel.timer);
  duels.delete(duel.id);
  const [p1, p2] = duel.players;
  let winner = forcedWinner,
    loser = forcedLoser,
    isDraw = false;

  if (!walkover) {
    if (p1.score > p2.score) {
      winner = p1.username;
      loser = p2.username;
    } else if (p2.score > p1.score) {
      winner = p2.username;
      loser = p1.username;
    } else isDraw = true;
  }

  if (!isDraw) await applyDuelResult(winner, loser, false);
  else await applyDuelResult(p1.username, p2.username, true);

  // SAVE HISTORY — keep last 5 only
  for (const p of duel.players) {
    const opp = duel.players.find((x) => x.socketId !== p.socketId);
    const won = !isDraw && p.username === winner;
    const entry = {
      opponent: opp?.username || "Unknown",
      subject: duel.subject || subj,
      result: isDraw ? "DRAW" : won ? "WIN" : "LOSS",
      myScore: p.score,
      opponentScore: opp?.score || 0,
      xpChange: isDraw ? 0 : won ? 20 : -10,
      date: new Date().toLocaleDateString(),
    };
    if (!duelHistory[p.username]) duelHistory[p.username] = [];
    duelHistory[p.username].push(entry);
    duelHistory[p.username] = duelHistory[p.username].slice(-5);
  }

  for (const p of duel.players) {
    const opp = duel.players.find((x) => x.socketId !== p.socketId);
    io.to(p.socketId).emit("duel:finished", {
      duelId: duel.id,
      isDraw,
      winner,
      walkover: !!walkover,
      myScore: p.score,
      opponentScore: opp?.score || 0,
      opponent: opp?.username,
      pointsChange: isDraw ? 0 : p.username === winner ? +20 : -10,
    });
    const s = io.sockets.sockets.get(p.socketId);
    if (s) s.data.duelId = null;
  }
}

module.exports = { registerDuelHandlers };

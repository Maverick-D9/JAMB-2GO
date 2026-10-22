const express = require("express");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");
const router = express.Router();
const CbtResult = require("../models/CbtResult");
const User = require("../models/User");
const VITALS = require("../config/vitals");

// === FIXED: SINGLE CANONICAL CONFIG FILE ONLY - NO HYPHEN/UNDERSCORE DUAL ===
const CONFIG_PATH = path.join(__dirname, `../${VITALS.SYSTEM.CBT_CONFIG_FILE}`);

let CONFIG = { enabled: true, durationMinutes: 120, questionsPerSubject: 40 };
try {
  if (fs.existsSync(CONFIG_PATH)) {
    CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } else {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(CONFIG, null, 2));
  }
} catch (e) {
  console.log("Config load error, using default");
}

function saveConfig() {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(CONFIG, null, 2));
}

function checkAdminPassword(req) {
  const passHeader =
    req.headers["x-admin-password"] ||
    req.body.adminPassword ||
    req.query?.adminPassword;
  const expected = VITALS.ADMIN.PASSWORD;
  if (!passHeader) return false;
  return passHeader === expected;
}

// === FIXED SUB CHECK - MONGO ONLY - ALIGNED WITH /payment/access ===
async function checkSubscription(req, res, next) {
  if (checkAdminPassword(req)) return next();
  const userId =
    req.body.userId ||
    req.body.username ||
    req.query.userId ||
    req.headers["x-user-id"] ||
    req.headers["x-user-email"] ||
    req.headers["x-user-id"];

  if (!userId) {
    return res.status(401).json({ error: "Login required", code: "NO_USER" });
  }
  try {
    const user = await User.findOne({
      $or: [
        { email: userId },
        { username: userId },
        { userId: userId },
        { _id: userId.length === 24 ? userId : null },
      ].filter(Boolean),
    });

    if (!user)
      return res.status(403).json({
        error: "SUBSCRIPTION_REQUIRED",
        code: "SUBSCRIPTION_REQUIRED",
      });

    const now = new Date();

    // Check ANY valid expiry - same logic as /payment/access
    const subExpiry = user.subscriptionExpiresAt
      ? new Date(user.subscriptionExpiresAt)
      : null;
    const trialExpiry = user.trialEndsAt ? new Date(user.trialEndsAt) : null;

    const hasActiveSub = subExpiry && subExpiry > now;
    const hasActiveTrial = trialExpiry && trialExpiry > now;
    const isActive =
      hasActiveSub || hasActiveTrial || user.subscriptionStatus === "active";

    console.log(
      `CBT CHECK for ${userId}: subExpiry=${subExpiry}, now=${now}, active=${isActive}`,
    );

    if (!isActive) {
      return res.status(403).json({
        error: "SUBSCRIPTION_REQUIRED",
        message: "Your ₦2000 pass expired. Please renew to continue CBT.",
        code: "SUBSCRIPTION_REQUIRED",
        debug: { subExpiry, now, status: user.subscriptionStatus },
      });
    }
    req.mongoUser = user; // pass to next handler
    next();
  } catch (e) {
    console.error("checkSubscription error:", e);
    return res.status(500).json({ error: e.message });
  }
}

// === CBT QUESTION BANK CACHE - LOAD ONCE ===
let cbtBankCache = {}; // { subject: [questions] }

function parseCSV(txt) {
  const lines = txt.trim().split("\n").slice(1);
  return lines
    .map((line) => {
      const cols = line
        .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
        .map((s) => s.replace(/^"|"$/g, "").trim());
      if (cols.length < 6) return null;
      return {
        question_text: cols[0],
        option_a: cols[1],
        option_b: cols[2],
        option_c: cols[3],
        option_d: cols[4],
        correct_answer:
          (cols[5] || "A").toUpperCase().match(/[ABCD]/)?.[0] || "A",
        subject: cols[6] || "",
        explanation: cols[7] || "",
      };
    })
    .filter(Boolean);
}

function findFileSync(sub) {
  const tries = [
    path.join(__dirname, `../${VITALS.SYSTEM.QUESTIONS_FOLDER}/${sub}.csv`),
    path.join(__dirname, `../data/${sub}.csv`),
    path.join(__dirname, `../${sub}.csv`),
    path.join(__dirname, `../uploads/${sub}.csv`),
    path.join(__dirname, `../../questions/${sub}.csv`),
  ];
  for (const p of tries) if (fs.existsSync(p)) return p;
  return null;
}

function loadAllCbtBanks() {
  cbtBankCache = {};
  const subjects = [
    "english",
    "maths",
    "mathematics",
    "physics",
    "chemistry",
    "biology",
    "commerce",
    "economics",
    "government",
    "accounting",
    "literature",
    "crs",
    "irs",
    "geography",
    "agric",
    "marketing",
    "yoruba",
    "history",
  ];
  subjects.forEach((sub) => {
    const file = findFileSync(sub);
    if (file) {
      try {
        const bank = parseCSV(fs.readFileSync(file, "utf8"));
        cbtBankCache[sub] = bank;
        console.log(`CBT CACHE: ${bank.length} Qs for ${sub}`);
      } catch (e) {
        console.log(`CBT load err ${sub}:`, e.message);
      }
    }
  });
  // alias maths <-> mathematics
  if (cbtBankCache["mathematics"] && !cbtBankCache["maths"])
    cbtBankCache["maths"] = cbtBankCache["mathematics"];
  if (cbtBankCache["maths"] && !cbtBankCache["mathematics"])
    cbtBankCache["mathematics"] = cbtBankCache["maths"];
}
loadAllCbtBanks();

const DUMMY = {
  english: Array.from({ length: 60 }, (_, i) => ({
    question_text: `English Q${i + 1}: Synonym for happy?`,
    option_a: "Sad",
    option_b: "Joyful",
    option_c: "Angry",
    option_d: "Tired",
    correct_answer: "B",
    subject: "english",
  })),
  mathematics: Array.from({ length: 60 }, (_, i) => ({
    question_text: `Maths Q${i + 1}: ${i + 2}+${i + 3}*2=?`,
    option_a: `${i + 5}`,
    option_b: `${i + 8}`,
    option_c: `${i + 2 * i}`,
    option_d: `${i + 10}`,
    correct_answer: "B",
    subject: "mathematics",
  })),
};

function strongShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getQs(subject, n) {
  const key = subject.toLowerCase();
  let bank = cbtBankCache[key] || [];
  if (bank.length === 0) {
    const alias =
      key === "maths" ? "mathematics" : key === "mathematics" ? "maths" : null;
    if (alias) bank = cbtBankCache[alias] || [];
    if (bank.length === 0) bank = DUMMY[key] || DUMMY.english;
  }
  // triple shuffle from RAM (0 FS)
  let shuffledBank = strongShuffle(bank);
  shuffledBank = strongShuffle(shuffledBank);
  shuffledBank = strongShuffle(shuffledBank);
  const picked = shuffledBank.slice(0, Math.min(n, bank.length));
  return picked.map((q, idx) => {
    const correctLetter = (q.correct_answer || "A").toUpperCase();
    const options = [
      { letter: "A", text: q.option_a },
      { letter: "B", text: q.option_b },
      { letter: "C", text: q.option_c },
      { letter: "D", text: q.option_d },
    ];
    const correctText =
      options.find((o) => o.letter === correctLetter)?.text || options[0].text;
    const shuffledOpts = strongShuffle(options);
    let newCorrect = "A";
    const newOptionsMap = {};
    ["A", "B", "C", "D"].forEach((newLetter, i) => {
      newOptionsMap[`option_${newLetter.toLowerCase()}`] = shuffledOpts[i].text;
      if (shuffledOpts[i].text === correctText) newCorrect = newLetter;
    });
    return {
      question_text: q.question_text,
      subject: q.subject || subject,
      explanation: q.explanation || "",
      ...newOptionsMap,
      correct_answer: newCorrect,
      id: `${subject}-${crypto.randomBytes(4).toString("hex")}-${idx}-${Date.now()}`,
    };
  });
}

router.get("/config", (req, res) => res.json(CONFIG));
router.put("/config", (req, res) => {
  if (!checkAdminPassword(req))
    return res.status(401).json({ error: "Unauthorized" });
  const { enabled, durationMinutes, questionsPerSubject } = req.body;
  if (typeof enabled !== "undefined") CONFIG.enabled = !!enabled;
  if (durationMinutes) CONFIG.durationMinutes = parseInt(durationMinutes);
  if (questionsPerSubject)
    CONFIG.questionsPerSubject = parseInt(questionsPerSubject);
  if (CONFIG.durationMinutes < 5) CONFIG.durationMinutes = 5;
  if (CONFIG.durationMinutes > 300) CONFIG.durationMinutes = 300;
  if (CONFIG.questionsPerSubject < 5) CONFIG.questionsPerSubject = 5;
  if (CONFIG.questionsPerSubject > 60) CONFIG.questionsPerSubject = 60;
  saveConfig();
  res.json({ success: true, config: CONFIG });
});

router.post("/start", checkSubscription, (req, res) => {
  const { subjects } = req.body;
  if (!subjects || subjects.length !== 3)
    return res.status(400).json({ error: "Select 3 subjects" });
  if (!CONFIG.enabled)
    return res
      .status(403)
      .json({ error: "CBT is currently disabled by admin" });
  const allSubjects = ["english", ...subjects.map((s) => s.toLowerCase())];
  const questions = {};
  allSubjects.forEach((sub) => {
    questions[sub] = getQs(sub, CONFIG.questionsPerSubject);
  });
  console.log(
    `CBT START: ${CONFIG.questionsPerSubject} per subject, Total: ${CONFIG.questionsPerSubject * allSubjects.length}`,
  );
  res.json({
    subjects: allSubjects,
    questions,
    durationMinutes: CONFIG.durationMinutes,
    examId: Date.now().toString(),
    config: CONFIG,
  });
});

router.post("/submit", checkSubscription, (req, res) => {
  const { answers, questions } = req.body;
  let score = 0,
    total = 0,
    breakdown = {};
  if (questions) {
    Object.keys(questions).forEach((sub) => {
      let subScore = 0;
      questions[sub].forEach((q) => {
        total++;
        if (
          answers[q.id] &&
          answers[q.id].toUpperCase() === q.correct_answer.toUpperCase()
        ) {
          score++;
          subScore++;
        }
      });
      breakdown[sub] = { score: subScore, total: questions[sub].length };
    });
  }
  console.log(`CBT SUBMIT: ${score}/${total}`);
  res.json({
    score,
    total,
    breakdown,
    jambScore: Math.round((score / (total || 1)) * 400),
  });
});

function calculateStreaks(allResults) {
  const grouped = {};
  allResults.forEach((r) => {
    if (!grouped[r.userId]) grouped[r.userId] = [];
    grouped[r.userId].push(r);
  });
  const streaks = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  Object.entries(grouped).forEach(([userId, results]) => {
    const days = [
      ...new Set(
        results.map((r) => {
          const d = new Date(r.date);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        }),
      ),
    ].sort((a, b) => b - a);
    if (!days.length) return;
    let currentStreak = 0;
    let checkDate = today.getTime();
    const lastDay = days[0];
    const diff = (today.getTime() - lastDay) / 86400000;
    if (diff > 1) currentStreak = 0;
    else {
      for (let d of days) {
        if (
          d === checkDate ||
          (currentStreak === 0 && d === checkDate - 86400000)
        ) {
          if (d !== checkDate && currentStreak === 0) checkDate -= 86400000;
          currentStreak++;
          checkDate -= 86400000;
        } else if (d < checkDate) break;
      }
    }
    if (currentStreak > 0) {
      streaks.push({
        userId,
        name: results[0].name || "Anon",
        streak: currentStreak,
        lastActive: new Date(days[0]),
        totalExams: results.length,
      });
    }
  });
  return streaks.sort((a, b) => b.streak - a.streak).slice(0, 10);
}

router.post("/save-result", checkSubscription, async (req, res) => {
  try {
    const {
      userId,
      name,
      totalScore,
      rawScore,
      rawTotal,
      breakdown,
      subjects,
      timeTaken,
      userAnswers,
      questionsSnapshot,
      attemptId,
    } = req.body;
    if (!breakdown)
      return res.status(400).json({ error: "breakdown required" });
    const subArray = Object.entries(breakdown).map(([sName, data]) => ({
      name: sName,
      score: data.score || 0,
      total: data.total || 0,
    }));
    const totalQuestions = subArray.reduce((a, b) => a + b.total, 0);
    const timeSec = Number(timeTaken) || 0;
    let isFlagged = false;
    if (timeSec > 0 && timeSec <= 300) {
      isFlagged = true;
      console.log(
        `🚨 ANTI-CHEAT FLAGGED: ${userId} ${totalScore}/400 in ${timeSec}s`,
      );
    }
    const english = subArray.find((s) => s.name.toLowerCase() === "english");
    const others = subArray.filter((s) => s.name.toLowerCase() !== "english");
    const doc = await CbtResult.create({
      userId: userId || `anon_${Date.now()}`,
      name: (name || "Anonymous").slice(0, 30),
      date: new Date(),
      totalScore: Number(totalScore) || 0,
      rawScore: rawScore || 0,
      rawTotal: rawTotal || totalQuestions,
      englishScore: english?.score || 0,
      subject2Name: others[0]?.name || "",
      subject2Score: others[0]?.score || 0,
      subject3Name: others[1]?.name || "",
      subject3Score: others[1]?.score || 0,
      subject4Name: others[2]?.name || "",
      subject4Score: others[2]?.score || 0,
      subjects: subArray,
      timeTaken: timeSec,
      isFlagged,
      attemptId: attemptId || undefined,
      userAnswers: userAnswers || {},
      questionsSnapshot: questionsSnapshot || null,
    });
    res.json({
      success: true,
      isFlagged,
      result: doc,
      attemptId: doc.attemptId,
    });
  } catch (e) {
    console.error("save-result error:", e);
    res.status(500).json({ error: e.message });
  }
});

router.get("/review/:attemptId", async (req, res) => {
  try {
    const { attemptId } = req.params;
    const result = await CbtResult.findOne({ attemptId });
    if (!result) return res.status(404).json({ error: "Attempt not found" });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/leaderboard", async (req, res) => {
  try {
    const { type = "main", subject } = req.query;
    const allValid = await CbtResult.find({ isFlagged: false }).lean(); // lean() for 10x faster
    if (type === "main") {
      const bestMap = {};
      allValid.forEach((r) => {
        if (
          !bestMap[r.userId] ||
          r.totalScore > bestMap[r.userId].totalScore ||
          (r.totalScore === bestMap[r.userId].totalScore &&
            r.timeTaken < bestMap[r.userId].timeTaken)
        ) {
          bestMap[r.userId] = r;
        }
      });
      const ranked = Object.values(bestMap)
        .sort(
          (a, b) => b.totalScore - a.totalScore || a.timeTaken - b.timeTaken,
        )
        .slice(0, 100);
      return res.json(ranked);
    }
    if (type === "subject" && subject) {
      const key = subject.toLowerCase();
      const bestMap = {};
      allValid.forEach((r) => {
        const found = r.subjects?.find((s) => s.name.toLowerCase() === key);
        if (!found) return;
        if (
          !bestMap[r.userId] ||
          found.score > (bestMap[r.userId].subjectScore || 0)
        ) {
          bestMap[r.userId] = {
            ...r,
            subjectScore: found.score,
            subjectTotal: found.total,
          };
        }
      });
      const ranked = Object.values(bestMap)
        .sort((a, b) => b.subjectScore - a.subjectScore)
        .slice(0, 100);
      return res.json(ranked);
    }
    if (type === "streak") {
      const streaks = calculateStreaks(allValid);
      return res.json(streaks);
    }
    if (type === "improved") {
      const grouped = {};
      allValid.forEach((r) => {
        if (!grouped[r.userId]) grouped[r.userId] = [];
        grouped[r.userId].push(r);
      });
      const improved = [];
      Object.entries(grouped).forEach(([userId, arr]) => {
        if (arr.length < 2) return;
        arr.sort((a, b) => new Date(a.date) - new Date(b.date));
        const first = arr[0].totalScore;
        const highest = Math.max(...arr.map((x) => x.totalScore));
        if (first <= 0) return;
        const percent = ((highest - first) / first) * 100;
        if (percent > 0) {
          improved.push({
            userId,
            name: arr[0].name,
            firstScore: first,
            highestScore: highest,
            percentIncrease: Math.round(percent),
            attempts: arr.length,
          });
        }
      });
      return res.json(
        improved
          .sort((a, b) => b.percentIncrease - a.percentIncrease)
          .slice(0, 100),
      );
    }
    res.json([]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.delete("/leaderboard/reset", async (req, res) => {
  if (!checkAdminPassword(req))
    return res.status(401).json({ error: "Unauthorized" });
  await CbtResult.deleteMany({});
  res.json({ success: true, message: "Leaderboard cleared" });
});

router.post("/reload-cache", (req, res) => {
  if (!checkAdminPassword(req))
    return res.status(401).json({ error: "Unauthorized" });
  loadAllCbtBanks();
  res.json({
    success: true,
    cached: Object.keys(cbtBankCache).map(
      (k) => `${k}:${cbtBankCache[k].length}`,
    ),
  });
});

module.exports = router;

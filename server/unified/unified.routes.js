// server/unified/unified.routes.js
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const UnifiedTest = require("./unified.model");
const UnifiedAttempt = require("./unifiedAttempt.model");

let UnifiedQuestion = null;
try {
  UnifiedQuestion = require("./unifiedQuestion.model");
} catch (e) {
  console.log("UnifiedQuestion model not found yet - CSV only");
}

const ADMIN_PASS = process.env.ADMIN_PASSWORD || "JAMB2GO_2026";

const checkAdmin = (req, res, next) => {
  if (req.headers["x-admin-password"] !== ADMIN_PASS)
    return res.status(401).json({ error: "Wrong admin password" });
  next();
};

const SUBJECT_ALIASES = {
  mathematics: "maths",
  maths: "maths",
  math: "maths",
  english: "english",
  physics: "physics",
  chemistry: "chemistry",
  biology: "biology",
  accounting: "accounting",
  commerce: "commerce",
  economics: "economics",
  government: "government",
  govt: "government",
  literature: "literature",
  lit: "literature",
  crs: "crs",
  crk: "crs",
};
function normalizeSubject(s) {
  if (!s) return "";
  const low = String(s).toLowerCase().trim().replace("-room", "");
  return SUBJECT_ALIASES[low] || low;
}
// NEW: normalize topic for matching - "Circle Theorems" = "circle theorems"
function normalizeTopic(s) {
  return String(s || "")
    .toLowerCase()
    .trim();
}

function parseCsvLine(line) {
  const vals = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  return vals.map((v) => v.replace(/^"|"$/g, "").trim());
}

function readSubjectQuestions(subject) {
  const norm = normalizeSubject(subject);
  const candidates = [
    path.join(__dirname, "..", "questions", `${norm}.csv`),
    path.join(
      __dirname,
      "..",
      "questions",
      `${String(subject).toLowerCase()}.csv`,
    ),
  ];
  try {
    const VITALS = require("../config/vitals");
    if (VITALS.SYSTEM?.QUESTIONS_FOLDER) {
      candidates.push(
        path.join(
          __dirname,
          "..",
          VITALS.SYSTEM.QUESTIONS_FOLDER,
          `${norm}.csv`,
        ),
      );
      candidates.push(
        path.join(
          __dirname,
          "..",
          VITALS.SYSTEM.QUESTIONS_FOLDER,
          `${String(subject).toLowerCase()}.csv`,
        ),
      );
    }
  } catch {}
  let file = candidates.find((f) => fs.existsSync(f));
  if (!file) return [];
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  let qs = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 6) continue;
    let obj = {};
    header.forEach((h, idx) => (obj[h] = cols[idx] || ""));
    if (obj.question_text) qs.push(obj);
  }
  return qs;
}

// GET - Lobby
router.get("/tests", async (req, res) => {
  try {
    const tests = await UnifiedTest.find().sort({ startAt: -1 }).lean();
    const now = new Date();
    for (const t of tests) {
      if (t.status === "upcoming" && new Date(t.startAt) <= now) {
        await UnifiedTest.findByIdAndUpdate(t._id, {
          status: "live",
          endAt: new Date(now.getTime() + (t.durationMinutes || 120) * 60000),
        });
        t.status = "live";
      }
    }
    res.json({ tests });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET - Questions from BOTH Vaults - NOW WITH TOPIC FILTER
router.get("/tests/:id/questions", async (req, res) => {
  try {
    const t = await UnifiedTest.findById(req.params.id);
    if (!t) return res.status(404).json({ error: "Test not found" });

    const subjects = t.subjects?.length ? t.subjects : ["english"];
    const perSubject = t.questionsPerSubject || 40;
    // NEW: topic filter
    const testTopic = normalizeTopic(t.topic || "all");
    const isAllTopics = !testTopic || testTopic === "all";
    let exam = [];

    let unifiedAll = [];
    if (UnifiedQuestion) {
      try {
        unifiedAll = await UnifiedQuestion.find({}).lean();
      } catch (e) {
        console.log("Unified Vault read failed:", e.message);
      }
    }

    for (const subj of subjects) {
      const norm = normalizeSubject(subj);

      // SOURCE 1: Unified Vault - filter by SUBJECT + TOPIC
      const unifiedForSubject = unifiedAll.filter((q) => {
        if (normalizeSubject(q.subject) !== norm) return false;
        if (isAllTopics) return true;
        return normalizeTopic(q.topic) === testTopic;
      });
      const shuffledUnified = [...unifiedForSubject].sort(
        () => 0.5 - Math.random(),
      );
      const takeUnified = shuffledUnified.slice(0, perSubject);

      // SOURCE 2: CSV Vault - filter by TOPIC too, if topic no be "all"
      const needMore = perSubject - takeUnified.length;
      let csvForSubject = [];
      if (needMore > 0) {
        let bank = readSubjectQuestions(subj);
        if (!isAllTopics) {
          bank = bank.filter((q) => normalizeTopic(q.topic) === testTopic);
        }
        const shuffledCsv = [...bank].sort(() => 0.5 - Math.random());
        csvForSubject = shuffledCsv.slice(0, needMore);
      }

      const merged = [
        ...takeUnified.map((q) => ({
          id: `unified-${q._id}`,
          subject: norm,
          source: "unified-vault",
          question_text: q.questionText || q.question_text || "",
          option_a: q.optionA || q.option_a || "",
          option_b: q.optionB || q.option_b || "",
          option_c: q.optionC || q.option_c || "",
          option_d: q.optionD || q.option_d || "",
          correct: q.correct || "",
          explanation: q.explanation || "",
          topic: q.topic || "General",
          diagramUrl: q.diagramUrl || "",
          diagramType: q.diagramType || "",
        })),
        ...csvForSubject.map((q, idx) => ({
          id: `csv-${norm}-${idx}-${Date.now()}`,
          subject: norm,
          source: "csv-vault",
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct: q.correct,
          explanation: q.explanation || "",
          topic: q.topic || "General",
          diagramUrl: q.diagramUrl || q.diagram_url || "",
          diagramType: q.diagramUrl ? "link" : "",
        })),
      ];

      const finalShuffled = merged.sort(() => 0.5 - Math.random());
      exam.push(...finalShuffled);
      console.log(
        `[Unified] ${subj} | topic=${t.topic || "all"}: Unified=${takeUnified.length} + CSV=${csvForSubject.length} = ${finalShuffled.length}/${perSubject}`,
      );
    }

    res.json({
      test: {
        title: t.title,
        subjects: t.subjects,
        topic: t.topic || "all",
        durationMinutes: t.durationMinutes || 120,
      },
      questions: exam,
    });
  } catch (e) {
    console.log("Unified questions error:", e);
    res.status(500).json({ error: e.message });
  }
});

// POST - Admin creates test - NOW WITH TOPIC
router.post("/tests", checkAdmin, async (req, res) => {
  const {
    title,
    subjects,
    topic,
    startAt,
    durationMinutes,
    questionsPerSubject,
  } = req.body;
  if (!title || !startAt)
    return res.status(400).json({ error: "Title + Start time needed" });
  const test = await UnifiedTest.create({
    title,
    subjects: subjects || [],
    topic: (topic || "all").trim() || "all",
    startAt: new Date(startAt),
    durationMinutes: durationMinutes || 120,
    questionsPerSubject: questionsPerSubject || 40,
    status: "upcoming",
  });
  res.json({ success: true, test });
});

// POST - Make Live NOW
router.post("/tests/:id/make-live", checkAdmin, async (req, res) => {
  try {
    const t = await UnifiedTest.findById(req.params.id);
    if (!t) return res.status(404).json({ error: "Test not found" });
    t.status = "live";
    t.endAt = new Date(Date.now() + (t.durationMinutes || 120) * 60000);
    await t.save();
    res.json({ success: true, test: t });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST - End test
router.post("/tests/:id/end", checkAdmin, async (req, res) => {
  try {
    const t = await UnifiedTest.findById(req.params.id);
    if (!t) return res.status(404).json({ error: "Test not found" });
    t.status = "ended";
    await t.save();
    res.json({ success: true, test: t });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE - Delete test (only after it don end)
router.delete("/tests/:id", checkAdmin, async (req, res) => {
  try {
    const t = await UnifiedTest.findById(req.params.id);
    if (!t)
      return res.status(404).json({ success: false, error: "Test not found" });
    if (t.status === "live") {
      return res.status(400).json({
        success: false,
        error: "End the test first before you delete am",
      });
    }
    await UnifiedTest.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});
// GET - Check if this username don do this test before
router.get("/tests/:id/attempt", async (req, res) => {
  try {
    const username = String(req.query.username || "")
      .toLowerCase()
      .trim();
    if (!username) return res.json({ done: false });
    const found = await UnifiedAttempt.findOne({
      testId: req.params.id,
      username,
    });
    if (found)
      return res.json({
        done: true,
        score: found.score,
        total: found.total,
        submittedAt: found.submittedAt,
      });
    res.json({ done: false });
  } catch (e) {
    res.json({ done: false });
  }
});

// POST - Submit attempt - blocks 2nd attempt
router.post("/tests/:id/submit", async (req, res) => {
  try {
    const { username, fullName, userId, score, total, answers } = req.body;
    const uname = String(username || "")
      .toLowerCase()
      .trim();
    if (!uname) return res.status(400).json({ error: "Login required" });

    const existing = await UnifiedAttempt.findOne({
      testId: req.params.id,
      username: uname,
    });
    if (existing)
      return res.status(409).json({
        error: "You don do this test before",
        score: existing.score,
        total: existing.total,
      });

    const attempt = await UnifiedAttempt.create({
      testId: req.params.id,
      username: uname,
      fullName: fullName || "",
      userId: userId || "",
      score: score || 0,
      total: total || 0,
      answers: answers || {},
    });
    res.json({ success: true, attempt });
  } catch (e) {
    if (e.code === 11000)
      return res.status(409).json({ error: "You don do this test before" });
    res.status(500).json({ error: e.message });
  }
});
// GET - Leaderboard for one test - Top 50, sorted by score
router.get("/tests/:id/leaderboard", async (req, res) => {
  try {
    const attempts = await UnifiedAttempt.find({ testId: req.params.id })
      .sort({ score: -1, submittedAt: 1 })
      .limit(50)
      .lean();

    const board = attempts.map((a, i) => ({
      rank: i + 1,
      username: a.username,
      fullName: a.fullName || "",
      score: a.score,
      total: a.total,
      percent: a.total ? Math.round((a.score / a.total) * 100) : 0,
      submittedAt: a.submittedAt,
    }));

    res.json({ success: true, count: board.length, leaderboard: board });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// NEW: DELETE - Admin Reset ALL attempts for one test
router.delete("/tests/:id/attempts", checkAdmin, async (req, res) => {
  try {
    const result = await UnifiedAttempt.deleteMany({ testId: req.params.id });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// NEW: DELETE - Admin Reset ONE user for one test
router.delete("/tests/:id/attempts/:username", checkAdmin, async (req, res) => {
  try {
    const result = await UnifiedAttempt.deleteOne({
      testId: req.params.id,
      username: String(req.params.username || "")
        .toLowerCase()
        .trim(),
    });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

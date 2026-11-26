// server/unified/unified.routes.js
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const UnifiedTest = require("./unified.model");
const UnifiedAttempt = require("./unifiedAttempt.model");
const multer = require("multer");
const cloudinary = require("./cloudinary");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

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

// STEP 2A: Build questions for a test - extracted from GET /tests/:id/questions
// Returns frozen exam array. CSV id is now stable (no Date.now()) so resume works.
async function buildQuestionsForTest(t) {
  const subjects = t.subjects?.length ? t.subjects : ["english"];
  const perSubject = t.questionsPerSubject || 40;
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
        id: `csv-${norm}-${String(q.question_text || "")
          .slice(0, 40)
          .replace(/[^a-zA-Z0-9]+/g, "-")}-${idx}`,
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
  return exam;
}

// GET - Lobby - FIXED: respect startAt, auto-end, Lagos time
router.get("/tests", async (req, res) => {
  try {
    const tests = await UnifiedTest.find().sort({ startAt: -1 }).lean();
    const now = new Date();
    for (const t of tests) {
      const start = new Date(t.startAt);
      // endAt = startAt + duration, NOT now + duration
      const end = t.endAt
        ? new Date(t.endAt)
        : new Date(start.getTime() + (t.durationMinutes || 120) * 60000);

      let newStatus = t.status;
      if (t.status === "live" && end > now) {
        newStatus = "live"; // Manual Make Live - respect am, no revert
      } else if (now < start) newStatus = "upcoming";
      else if (now >= start && now < end) newStatus = "live";
      else if (now >= end) newStatus = "ended";

      if (newStatus !== t.status || !t.endAt) {
        await UnifiedTest.findByIdAndUpdate(t._id, {
          status: newStatus,
          endAt: end,
        });
        t.status = newStatus;
        t.endAt = end;
      }
    }
    res.json({ tests });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET - Questions from BOTH Vaults - NOW WITH TOPIC FILTER
// Kept for backward compat - new flow uses POST /start which freezes questions
router.get("/tests/:id/questions", async (req, res) => {
  try {
    const t = await UnifiedTest.findById(req.params.id);
    if (!t) return res.status(404).json({ error: "Test not found" });
    const exam = await buildQuestionsForTest(t);
    res.json({
      test: {
        title: t.title,
        subjects: t.subjects,
        topic: t.topic || "all",
        durationMinutes: t.durationMinutes || 120,
        endAt: t.endAt,
        startAt: t.startAt,
      },
      questions: exam,
    });
  } catch (e) {
    console.log("Unified questions error:", e);
    res.status(500).json({ error: e.message });
  }
});

// POST - Admin creates test - FIXED: treat input as Lagos time (UTC+1)
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

  // startAt comes as "2026-11-22T10:00" from datetime-local = Lagos time
  // Convert Lagos -> UTC by subtracting 1 hour, so 10 Lagos stays 10 Lagos
  let startDate;
  if (
    typeof startAt === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(startAt)
  ) {
    const [datePart, timePart] = startAt.split("T");
    const [y, m, d] = datePart.split("-").map(Number);
    const [hh, mm] = timePart.split(":").map(Number);
    // Date.UTC creates UTC, minus 1 hour for Lagos
    startDate = new Date(Date.UTC(y, m - 1, d, hh - 1, mm || 0));
  } else {
    startDate = new Date(startAt);
  }

  const duration = durationMinutes || 120;
  const endDate = new Date(startDate.getTime() + duration * 60000);

  const test = await UnifiedTest.create({
    title,
    subjects: subjects || [],
    topic: (topic || "all").trim() || "all",
    startAt: startDate,
    endAt: endDate,
    durationMinutes: duration,
    questionsPerSubject: questionsPerSubject || 40,
    status: "upcoming", // Always start as upcoming, never live
  });
  res.json({ success: true, test });
});
// POST - Make Live NOW - FIXED: also move startAt to now so GET no revert am
router.post("/tests/:id/make-live", checkAdmin, async (req, res) => {
  try {
    const t = await UnifiedTest.findById(req.params.id);
    if (!t) return res.status(404).json({ error: "Test not found" });
    const now = new Date();
    t.status = "live";
    t.startAt = now; // <-- THIS na the key
    t.endAt = new Date(now.getTime() + (t.durationMinutes || 120) * 60000);
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
// DELETE - Delete test + all its attempts
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
    // Delete all attempts for this test too, so e no remain for DB
    await UnifiedAttempt.deleteMany({ testId: req.params.id });
    await UnifiedTest.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// STEP 2B: POST - Start / Resume - B: Global timer, frozen questions
router.post("/tests/:id/start", async (req, res) => {
  try {
    const { username, fullName, userId } = req.body;
    const uname = String(username || "")
      .toLowerCase()
      .trim();
    if (!uname) return res.status(400).json({ error: "Login required" });
    const t = await UnifiedTest.findById(req.params.id);
    if (!t) return res.status(404).json({ error: "Test not found" });

    const globalEnd = t.endAt
      ? new Date(t.endAt)
      : new Date(
          new Date(t.startAt).getTime() + (t.durationMinutes || 120) * 60000,
        );

    let attempt = await UnifiedAttempt.findOne({
      testId: req.params.id,
      username: uname,
    });
    if (attempt) {
      if (attempt.status === "submitted")
        return res.status(409).json({
          error: "You don do this test before",
          score: attempt.score,
          total: attempt.total,
        });
      // If global end don pass, auto-submit with saved answers
      if (new Date() >= globalEnd) {
        let correct = 0;
        (attempt.questions || []).forEach((q, i) => {
          if (
            attempt.answers?.[i] &&
            String(attempt.answers[i]).toUpperCase() ===
              String(q.correct || "").toUpperCase()
          )
            correct++;
        });
        attempt.score = correct;
        attempt.total = attempt.questions.length;
        attempt.status = "submitted";
        attempt.submittedAt = new Date();
        await attempt.save();
        return res.json({
          expired: true,
          attempt,
          test: {
            title: t.title,
            endAt: t.endAt,
            durationMinutes: t.durationMinutes,
          },
        });
      }
      // Resume: same questions, same answers, same global end
      attempt.endsAt = globalEnd;
      await attempt.save();
      return res.json({
        resumed: true,
        attempt,
        test: {
          title: t.title,
          endAt: t.endAt,
          durationMinutes: t.durationMinutes,
        },
      });
    }

    if (new Date() >= globalEnd)
      return res.status(400).json({ error: "Test don end" });

    const exam = await buildQuestionsForTest(t);
    attempt = await UnifiedAttempt.create({
      testId: req.params.id,
      username: uname,
      fullName: fullName || "",
      userId: userId || "",
      status: "in_progress",
      questions: exam,
      total: exam.length,
      answers: {},
      currentIndex: 0,
      startedAt: new Date(),
      endsAt: globalEnd,
      lastSavedAt: new Date(),
    });
    res.json({
      resumed: false,
      attempt,
      test: {
        title: t.title,
        endAt: t.endAt,
        durationMinutes: t.durationMinutes,
      },
    });
  } catch (e) {
    if (e.code === 11000)
      return res.status(409).json({ error: "You don do this test before" });
    res.status(500).json({ error: e.message });
  }
});

// STEP 2B: POST - Autosave answers + index
router.post("/tests/:id/autosave", async (req, res) => {
  try {
    const { username, answers, currentIndex } = req.body;
    const uname = String(username || "")
      .toLowerCase()
      .trim();
    const attempt = await UnifiedAttempt.findOne({
      testId: req.params.id,
      username: uname,
    });
    if (!attempt) return res.status(404).json({ error: "No attempt" });
    if (attempt.status === "submitted")
      return res.json({ success: true, submitted: true });
    if (answers) attempt.answers = answers;
    if (typeof currentIndex === "number") attempt.currentIndex = currentIndex;
    attempt.lastSavedAt = new Date();
    await attempt.save();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET - Check if this username don do this test before - now returns resume data
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
    if (!found) return res.json({ done: false });
    res.json({
      done: found.status === "submitted",
      inProgress: found.status === "in_progress",
      score: found.score,
      total: found.total,
      answers: found.answers || {},
      currentIndex: found.currentIndex || 0,
      questions: found.questions || [],
      startedAt: found.startedAt,
      endsAt: found.endsAt,
      submittedAt: found.submittedAt,
    });
  } catch (e) {
    res.json({ done: false });
  }
});

// POST - Submit attempt - updates in_progress, recalculates score, blocks 2nd attempt
router.post("/tests/:id/submit", async (req, res) => {
  try {
    const { username, fullName, userId, score, total, answers } = req.body;
    const uname = String(username || "")
      .toLowerCase()
      .trim();
    if (!uname) return res.status(400).json({ error: "Login required" });

    let attempt = await UnifiedAttempt.findOne({
      testId: req.params.id,
      username: uname,
    });
    if (attempt && attempt.status === "submitted")
      return res.status(409).json({
        error: "You don do this test before",
        score: attempt.score,
        total: attempt.total,
      });

    // Recalculate score from frozen questions - no trust frontend score
    let finalScore = score || 0;
    let finalTotal = total || 0;
    if (attempt && attempt.questions?.length) {
      finalTotal = attempt.questions.length;
      finalScore = 0;
      attempt.questions.forEach((q, i) => {
        if (
          answers?.[i] &&
          String(answers[i]).toUpperCase() ===
            String(q.correct || "").toUpperCase()
        )
          finalScore++;
      });
    }
    if (attempt) {
      attempt.score = finalScore;
      attempt.total = finalTotal;
      attempt.answers = answers || {};
      attempt.status = "submitted";
      attempt.submittedAt = new Date();
      await attempt.save();
      return res.json({ success: true, attempt });
    }
    attempt = await UnifiedAttempt.create({
      testId: req.params.id,
      username: uname,
      fullName: fullName || "",
      userId: userId || "",
      score: finalScore,
      total: finalTotal,
      answers: answers || {},
      status: "submitted",
      submittedAt: new Date(),
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
// POST - Upload Diagram to Cloudinary
router.post(
  "/questions/upload-diagram",
  checkAdmin,
  upload.single("diagram"),
  async (req, res) => {
    try {
      if (!req.file)
        return res.status(400).json({ error: "No image selected" });

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "jamb2go/unified-diagrams",
            resource_type: "image",
            transformation: [{ width: 800, crop: "limit", quality: "auto" }],
          },
          (err, result) => (err ? reject(err) : resolve(result)),
        );
        stream.end(req.file.buffer);
      });

      res.json({
        success: true,
        diagramUrl: result.secure_url,
        diagramPublicId: result.public_id,
      });
    } catch (e) {
      console.log("Cloudinary upload error:", e);
      res.status(500).json({ error: "Upload failed: " + e.message });
    }
  },
);
// GET - OVERALL LEADERBOARD - All Unified Tests combined
// Rank = Total Score first, then Avg % . Updates automatically after every submit.
router.get("/leaderboard/overall", async (req, res) => {
  try {
    const attempts = await UnifiedAttempt.find({ status: "submitted" }).lean();

    const map = {};
    for (const a of attempts) {
      const key = String(a.username || "")
        .toLowerCase()
        .trim();
      if (!key) continue;
      if (!map[key]) {
        map[key] = {
          username: a.username,
          fullName: a.fullName || "",
          totalScore: 0,
          totalPossible: 0,
          testsPlayed: 0,
          lastPlayed: a.submittedAt,
        };
      }
      map[key].totalScore += a.score || 0;
      map[key].totalPossible += a.total || 0;
      map[key].testsPlayed += 1;
      if (a.submittedAt > map[key].lastPlayed)
        map[key].lastPlayed = a.submittedAt;
    }

    const board = Object.values(map)
      .map((u) => ({
        ...u,
        percent: u.totalPossible
          ? Math.round((u.totalScore / u.totalPossible) * 100)
          : 0,
      }))
      .sort((a, b) => b.totalScore - a.totalScore || b.percent - a.percent)
      .slice(0, 50)
      .map((u, i) => ({ rank: i + 1, ...u }));

    res.json({ success: true, count: board.length, leaderboard: board });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

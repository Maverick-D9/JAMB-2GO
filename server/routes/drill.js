const express = require("express");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const router = express.Router();
const User = require("../models/User");

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
  irs: "irs",
  geography: "geography",
  "geography-room": "geography",
  agriculture: "agric",
  "agriculture-room": "agric",
  marketing: "marketing",
  yoruba: "yoruba",
  history: "history",
};
function normalizeSubject(s) {
  if (!s) return "";
  const low = String(s).toLowerCase().trim().replace("-room", "");
  return SUBJECT_ALIASES[low] || low;
}

const TOPICS_DB_PATH = path.join(__dirname, "..", "topics.json");
let topicsCache = {};
try {
  if (fs.existsSync(TOPICS_DB_PATH))
    topicsCache = JSON.parse(fs.readFileSync(TOPICS_DB_PATH, "utf8"));
} catch {
  topicsCache = {};
}

const DRILL_PATH = path.join(__dirname, "..", "drill_questions");
if (!fs.existsSync(DRILL_PATH)) fs.mkdirSync(DRILL_PATH, { recursive: true });

function parseCsvLine(line) {
  const vals = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  return vals.map((v) => v.replace(/^"|"$/g, "").trim());
}

function isValidTopicName(t) {
  if (!t || t.length > 60) return false;
  const low = t.toLowerCase();
  if (
    low.includes("total parts") ||
    low.includes("share =") ||
    low.startsWith("a sum of") ||
    low.includes(" x ")
  )
    return false;
  return true;
}

let drillCache = {};

function countFileQsSync(filePath) {
  try {
    if (!fs.existsSync(filePath)) return 0;
    const txt = fs.readFileSync(filePath, "utf8");
    const lines = txt.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length === 0) return 0;
    const hasHeader = lines[0].toLowerCase().includes("question_text");
    return hasHeader ? Math.max(0, lines.length - 1) : lines.length;
  } catch {
    return 0;
  }
}

// === PATCHED - FIXES BIOLOGY 0 TOPICS ===
function rebuildDrillCache() {
  drillCache = {};
  try {
    // Reload topics.json fresh each rebuild (so admin adds show instantly)
    try {
      if (fs.existsSync(TOPICS_DB_PATH)) {
        topicsCache = JSON.parse(fs.readFileSync(TOPICS_DB_PATH, "utf8"));
      }
    } catch {}

    const subjectsFromFS = fs.existsSync(DRILL_PATH)
      ? fs
          .readdirSync(DRILL_PATH)
          .filter((f) => fs.statSync(path.join(DRILL_PATH, f)).isDirectory())
      : [];
    const subjectsFromDB = Object.keys(topicsCache);
    const subjects = [...new Set([...subjectsFromFS, ...subjectsFromDB])];

    subjects.forEach((subj) => {
      const folder = path.join(DRILL_PATH, subj);
      const files = fs.existsSync(folder)
        ? fs.readdirSync(folder).filter((f) => f.toLowerCase().endsWith(".csv"))
        : [];
      const topicsFromDB = topicsCache[subj] || [];
      const topicsFromFiles = files.map((f) => path.basename(f, ".csv"));
      const all = [...new Set([...topicsFromDB, ...topicsFromFiles])].filter(
        isValidTopicName,
      );

      const counts = {};
      const fileMap = {};
      let totalQs = 0;
      all.forEach((t) => {
        let fp = path.join(folder, `${t}.csv`);
        if (!fs.existsSync(fp)) {
          const found = files.find(
            (f) =>
              path.basename(f, ".csv").toLowerCase().trim() ===
              t.toLowerCase().trim(),
          );
          if (found) fp = path.join(folder, found);
        }
        fileMap[t.toLowerCase()] = fp;
        const c = countFileQsSync(fp);
        counts[t] = c;
        totalQs += c;
      });
      drillCache[subj] = {
        topics: all,
        counts,
        totalQs,
        totalTopics: all.length,
        fileMap,
      };
    });
    console.log(
      "✅ DRILL CACHE rebuilt:",
      Object.keys(drillCache).length,
      "subjects ->",
      Object.keys(drillCache).join(", "),
    );
  } catch (e) {
    console.log("drill rebuild err", e.message);
  }
}
rebuildDrillCache();

router.rebuildCache = rebuildDrillCache;
router.reloadTopics = () => {
  try {
    topicsCache = JSON.parse(fs.readFileSync(TOPICS_DB_PATH, "utf8"));
  } catch {}
  rebuildDrillCache();
};

async function canAccessSubject(email, subject) {
  const subj = normalizeSubject(subject);
  if (subj === "english") return true;
  if (!email) return false;
  try {
    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({
      $or: [{ email: cleanEmail }, { username: cleanEmail }],
    });
    if (!user) return false;
    const now = new Date();
    if (
      user.subscriptionStatus === "active" &&
      user.subscriptionExpiresAt &&
      new Date(user.subscriptionExpiresAt) > now
    )
      return true;
    if (user.trialEndsAt && new Date(user.trialEndsAt) > now) return true;
    return false;
  } catch (e) {
    console.error("canAccessSubject error", e.message);
    return false;
  }
}

router.get("/topics/:subject", (req, res) => {
  const subj = normalizeSubject(req.params.subject);
  const cached = drillCache[subj] || {
    topics: [],
    counts: {},
    totalQs: 0,
    totalTopics: 0,
  };
  res.json({
    subject: subj,
    topics: cached.topics,
    counts: cached.counts,
    totalQs: cached.totalQs,
    totalTopics: cached.totalTopics,
  });
});

router.get("/questions", async (req, res) => {
  try {
    let { subject, topic, count, email } = req.query;
    if (!subject || !topic)
      return res.status(400).json({ error: "Missing subject/topic" });

    const subjNorm = normalizeSubject(subject);
    const userEmail =
      email ||
      req.query.userId ||
      req.query.user_id ||
      req.query.serid ||
      req.headers["x-user-email"] ||
      "";
    const identifier = (userEmail || "").toString().toLowerCase().trim();

    if (subjNorm !== "english") {
      const allowed = await canAccessSubject(identifier, subjNorm);
      if (!allowed) {
        return res.status(403).json({
          error: "Subscription required",
          code: "ACCESS_DENIED",
          tier: "english_only",
        });
      }
    }

    subject = normalizeSubject(subject);
    topic = decodeURIComponent(topic).trim();
    const countNum = count === "All" ? 1000 : parseInt(count) || 20;

    const cached = drillCache[subject];
    let filePath = null;
    if (cached && cached.fileMap) {
      filePath =
        cached.fileMap[topic.toLowerCase()] ||
        path.join(DRILL_PATH, subject, `${topic}.csv`);
    } else {
      filePath = path.join(DRILL_PATH, subject, `${topic}.csv`);
    }

    if (!fs.existsSync(filePath)) {
      const folder = path.join(DRILL_PATH, subject);
      if (fs.existsSync(folder)) {
        const files = fs.readdirSync(folder);
        const found = files.find(
          (f) =>
            path.basename(f, ".csv").toLowerCase().trim() ===
            topic.toLowerCase().trim(),
        );
        if (found) filePath = path.join(folder, found);
      }
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: `File not found: drill_questions/${subject}/${topic}.csv`,
      });
    }

    const content = await fsp.readFile(filePath, "utf8");
    const lines = content.split("\n").filter((l) => l.trim() !== "");
    if (lines.length < 2) return res.status(404).json({ error: "Empty file" });

    const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    let all = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 6) continue;
      let obj = {};
      header.forEach((h, idx) => (obj[h] = cols[idx] || ""));
      if (obj.question_text) all.push(obj);
    }
    const shuffled = all.sort(() => 0.5 - Math.random()).slice(0, countNum);
    const out = shuffled.map((q, i) => ({
      id: `${subject}-${topic}-${i}`,
      subject,
      topic: q.topic || topic,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct: q.correct,
      explanation: q.explanation,
    }));
    res.json({ questions: out, total: all.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

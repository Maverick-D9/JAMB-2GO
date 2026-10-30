const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
require("dotenv").config();
const mongoose = require("mongoose");
const VITALS = require("./config/vitals");
const { registerLiveRankHandlers } = require("./sockets/liveRankHandler");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit"); // <-- TIER 2 ADDED

mongoose
  .connect(VITALS.SYSTEM.MONGODB_URI, { dbName: VITALS.SYSTEM.MONGODB_DB_NAME })
  .then(() => console.log("✅ MongoDB jamb-2go connected"))
  .catch((e) => {
    console.error("❌ MongoDB FAILED:", e.message);
    console.error("Check MONGODB_URI in .env or config/vitals.js");
  });
const User = require("./models/User");

async function hasFullAccessFor(usernameOrEmail) {
  if (!usernameOrEmail) return false;
  try {
    const user = await User.findOne({
      $or: [
        { email: usernameOrEmail },
        { username: usernameOrEmail },
        { userId: usernameOrEmail },
      ],
    });
    if (user) {
      const now = new Date();
      if (
        user.subscriptionStatus === "active" &&
        user.subscriptionExpiresAt &&
        new Date(user.subscriptionExpiresAt) > now
      )
        return true;
    }
  } catch (e) {
    console.log("access check err", e.message);
  }
  return false;
}

async function hasAnyAccessFor(usernameOrEmail) {
  if (!usernameOrEmail) return false;
  try {
    const user = await User.findOne({
      $or: [{ email: usernameOrEmail }, { username: usernameOrEmail }],
    });
    if (!user) return false;
    const access = User.checkUserAccess(user);
    return access.tier === VITALS.SUBSCRIPTION.TIER_NAME;
  } catch {
    return false;
  }
}

function isEnglishRoom(room) {
  return room === "english-room" || normalizeSubject(room) === "english";
}

const app = express();
app.set("trust proxy", 1);

const rawCors = VITALS.SYSTEM.CORS_ORIGINS;
const ALLOWED_ORIGINS = [
  "https://jamb-2go.vercel.app",
  "https://www.jamb-2-go.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

let corsOrigin;
if (rawCors === true || (Array.isArray(rawCors) && rawCors.includes("*"))) {
  console.log("⚠️ vitals had * - overriding to strict list");
  corsOrigin = ALLOWED_ORIGINS;
} else if (Array.isArray(rawCors)) {
  corsOrigin = [...new Set([...rawCors, ...ALLOWED_ORIGINS])];
} else {
  corsOrigin = ALLOWED_ORIGINS;
}

console.log("CORS Origin config:", corsOrigin);

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-User-ID",
      "X-User-Email",
      "X-Client-ID",
      "x-user-email",
      "x-user-id",
    ],
  }),
);
// === TIER 5 STEP 3: HEALTH CHECK - TOP ===
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    tier: "TIER 5 - 30k READY",
    time: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
app.get("/", (req, res) => res.send("JAMB-2GO TIER 5 - 30k Arena Ready 🚀"));

// === TIER 2: RATE LIMITERS - BOUNCER ===
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, try again later" },
  standardHeaders: true,
});
const cbtStartLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many CBT starts, slow down for 1 min" },
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(
      req.ip || req.headers["x-forwarded-for"] || "anon",
    );
    const user = req.body?.userId || req.headers["x-user-id"] || "anon";
    return `${ip}-${user}`;
  },
});

app.use("/api/", generalLimiter);
app.use("/api/cbt/start", cbtStartLimiter);
// === END RATE LIMITERS ===

app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    if (!res.headersSent) res.status(503).json({ error: "Request timeout" });
  });
  next();
});

app.use("/api/payment/webhook", express.raw({ type: "application/json" }));

app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
const cbtRoutes = require("./routes/cbt");
const paymentRoutes = require("./routes/payment");
const drillRoutes = require("./routes/drill");
const authRoutes = require("./routes/auth");

app.use("/api/cbt", cbtRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/drill", drillRoutes);
app.use("/api/auth", authRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: corsOrigin, credentials: true },
});

// === TIER 5 STEP 1C + 2A: HARDENED ADAPTER + ARENA STORE ===
const arenaRedis = require("./utils/arenaRedis");

let redisPubClient, redisSubClient;
async function initRedisAdapter() {
  if (!VITALS.SYSTEM.REDIS_URL) {
    console.log("⚠️ No REDIS_URL in vitals - single-server mode");
    return;
  }
  try {
    const { createAdapter } = require("@socket.io/redis-adapter");
    const { createClient } = require("redis");

    redisPubClient = createClient({
      url: VITALS.SYSTEM.REDIS_URL,
      socket: { reconnectStrategy: (retries) => Math.min(retries * 50, 1000) },
    });
    redisSubClient = redisPubClient.duplicate();

    redisPubClient.on("error", (e) =>
      console.error("Redis Pub Error:", e.message),
    );
    redisSubClient.on("error", (e) =>
      console.error("Redis Sub Error:", e.message),
    );

    await Promise.all([redisPubClient.connect(), redisSubClient.connect()]);
    io.adapter(createAdapter(redisPubClient, redisSubClient));
    arenaRedis.setRedisClients(redisPubClient, redisSubClient);
    console.log("✅ TIER 5: Redis adapter ready for 30k");
    console.log("✅ TIER 5: Arena store wired");
  } catch (e) {
    console.log("⚠️ Redis adapter failed, single-server fallback:", e.message);
  }
}
// === END STEP 1C/2A ===

const ADMIN_PASSWORD = VITALS.ADMIN.PASSWORD;
function checkAdmin(req, res, next) {
  const pass =
    req.headers["x-admin-password"] ||
    req.body?.adminPassword ||
    req.query?.adminPassword;
  if (pass !== ADMIN_PASSWORD)
    return res
      .status(401)
      .json({ error: "Unauthorized - wrong admin password" });
  next();
}

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

const TOPICS_DB_PATH = path.join(__dirname, VITALS.SYSTEM.TOPICS_FILE);
let topicsCache = {};
try {
  if (!fs.existsSync(TOPICS_DB_PATH))
    fs.writeFileSync(TOPICS_DB_PATH, JSON.stringify({}, null, 2));
  topicsCache = JSON.parse(fs.readFileSync(TOPICS_DB_PATH, "utf8"));
} catch {
  topicsCache = {};
}
async function saveTopicsCache() {
  await fsp.writeFile(TOPICS_DB_PATH, JSON.stringify(topicsCache, null, 2));
}

let questionBank = {};
function loadQuestions() {
  const qFolder = path.join(__dirname, VITALS.SYSTEM.QUESTIONS_FOLDER);
  if (!fs.existsSync(qFolder)) fs.mkdirSync(qFolder);
  const files = fs
    .readdirSync(qFolder)
    .filter(
      (f) =>
        f.toLowerCase().endsWith(".csv") &&
        !f.toLowerCase().includes(".clean") &&
        !f.toLowerCase().includes(".errors") &&
        !f.toLowerCase().includes(".dup"),
    );
  questionBank = {};
  files.forEach((file) => {
    const raw = path.basename(file, ".csv").toLowerCase();
    const subject = normalizeSubject(raw);
    const content = fs.readFileSync(path.join(qFolder, file), "utf8");
    const lines = content.split("\n").filter((l) => l.trim() !== "");
    if (lines.length < 2) return;
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    let questions = [];
    for (let i = 1; i < lines.length; i++) {
      let values = lines[i].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      if (values.length >= 6) {
        let obj = {};
        header.forEach((h, idx) => {
          obj[h] = (values[idx] || "").replace(/^"|"$/g, "").trim();
        });
        if (obj.question_text && obj.correct) questions.push(obj);
      }
    }
    if (!questionBank[subject]) questionBank[subject] = [];
    questionBank[subject] = questionBank[subject].concat(questions);
    console.log(`Loaded ${questions.length} from ${file} -> ${subject}`);
  });
  console.log(`=== ${Object.keys(questionBank).length} subjects loaded ===`);
  console.log(
    Object.entries(questionBank)
      .map(([k, v]) => `${k}:${v.length}`)
      .join(", "),
  );
}
loadQuestions();

function csvEscape(val) {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n"))
    return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function parseCsvLine(line) {
  const vals = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  return vals.map((v) => v.replace(/^"|"$/g, "").trim());
}

const DRILL_PATH = path.join(__dirname, VITALS.SYSTEM.DRILL_FOLDER);
if (!fs.existsSync(DRILL_PATH)) fs.mkdirSync(DRILL_PATH, { recursive: true });
function isValidTopicName(t) {
  if (!t) return false;
  if (t.length > 60) return false;
  const low = t.toLowerCase();
  if (low.includes("total parts")) return false;
  if (low.includes("share =")) return false;
  if (low.startsWith("a sum of")) return false;
  if (low.includes(" x ")) return false;
  return true;
}
function countDrillFileQs(filePath) {
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
let drillCountsCache = {};

function rebuildDrillCache() {
  drillCountsCache = {};
  try {
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
      const allTopics = [
        ...new Set([...topicsFromDB, ...topicsFromFiles]),
      ].filter(isValidTopicName);
      const counts = {};
      let totalQs = 0;
      allTopics.forEach((t) => {
        let fp = path.join(folder, `${t}.csv`);
        if (!fs.existsSync(fp)) {
          const found = files.find(
            (f) =>
              path.basename(f, ".csv").toLowerCase().trim() ===
              t.toLowerCase().trim(),
          );
          if (found) fp = path.join(folder, found);
        }
        const c = countDrillFileQs(fp);
        counts[t] = c;
        totalQs += c;
      });
      drillCountsCache[subj] = {
        topics: allTopics,
        counts,
        totalQs,
        totalTopics: allTopics.length,
      };
    });
    console.log(
      "✅ DRILL CACHE rebuilt:",
      Object.keys(drillCountsCache).join(", "),
    );
  } catch (e) {
    console.log("rebuild error", e.message);
  }
}
rebuildDrillCache();

function buildCountsForSubject(subj) {
  return (
    drillCountsCache[subj] || {
      topics: [],
      counts: {},
      totalQs: 0,
      totalTopics: 0,
    }
  );
}

const CBT_CONFIG_PATH = path.join(__dirname, VITALS.SYSTEM.CBT_CONFIG_FILE);
let cbtConfigCache = {
  durationMinutes: 120,
  questionsPerSubject: 40,
  enabled: true,
};
try {
  if (!fs.existsSync(CBT_CONFIG_PATH))
    fs.writeFileSync(CBT_CONFIG_PATH, JSON.stringify(cbtConfigCache, null, 2));
  cbtConfigCache = JSON.parse(fs.readFileSync(CBT_CONFIG_PATH, "utf8"));
} catch {}
function saveCBTConfig(cfg) {
  cbtConfigCache = cfg;
  fsp.writeFile(CBT_CONFIG_PATH, JSON.stringify(cfg, null, 2)).catch(() => {});
}

app.get("/api/cbt/config", (req, res) => res.json(cbtConfigCache));
app.get("/api/cbt/topics/:subject", (req, res) => {
  const subj = normalizeSubject(req.params.subject);
  const cached = buildCountsForSubject(subj);
  let topicsFromBank = [];
  if (questionBank[subj]) {
    const raw = [
      ...new Set(questionBank[subj].map((q) => q.topic).filter(Boolean)),
    ];
    topicsFromBank = raw.filter(isValidTopicName);
  }
  let all = [...new Set([...(cached.topics || []), ...topicsFromBank])].filter(
    isValidTopicName,
  );
  res.json({
    subject: subj,
    topics: all,
    counts: cached.counts,
    totalQs: cached.totalQs,
    totalTopics: all.length,
  });
});
app.get("/admin/topics/:subject", checkAdmin, (req, res) => {
  const subj = normalizeSubject(req.params.subject);
  const data = buildCountsForSubject(subj);
  res.json({ subject: subj, ...data });
});
app.get("/api/drill/topics/:subject", (req, res) => {
  const subj = normalizeSubject(req.params.subject);
  res.json({ subject: subj, ...buildCountsForSubject(subj) });
});
app.post("/admin/topics", checkAdmin, async (req, res) => {
  const { subject, topic } = req.body;
  if (!subject || !topic)
    return res.status(400).json({ error: "subject and topic required" });
  const subj = normalizeSubject(subject);
  if (!topicsCache[subj]) topicsCache[subj] = [];
  const normTopic = topic.trim();
  if (
    !topicsCache[subj].some((t) => t.toLowerCase() === normTopic.toLowerCase())
  ) {
    topicsCache[subj].push(normTopic);
    await saveTopicsCache();
    rebuildDrillCache();
  }
  const data = buildCountsForSubject(subj);
  res.json({
    success: true,
    ok: true,
    topics: data.topics,
    counts: data.counts,
    totalQs: data.totalQs,
  });
});
app.delete("/admin/topics/:subject/:topic", checkAdmin, async (req, res) => {
  const subj = normalizeSubject(req.params.subject);
  const topicName = decodeURIComponent(req.params.topic);
  if (topicsCache[subj]) {
    topicsCache[subj] = topicsCache[subj].filter(
      (t) => t.toLowerCase() !== topicName.toLowerCase(),
    );
    await saveTopicsCache();
  }
  const drillFile = path.join(DRILL_PATH, subj, `${topicName}.csv`);
  if (fs.existsSync(drillFile)) fs.unlinkSync(drillFile);
  rebuildDrillCache();
  const data = buildCountsForSubject(subj);
  res.json({
    success: true,
    topics: data.topics,
    counts: data.counts,
    totalQs: data.totalQs,
  });
});
app.get("/api/drill/questions", (req, res) => {
  try {
    let { subject, topic, count } = req.query;
    if (!subject || !topic)
      return res.status(400).json({ error: "Missing subject/topic" });
    subject = normalizeSubject(subject);
    topic = decodeURIComponent(topic).trim();
    const countNum = count === "All" ? 1000 : parseInt(count) || 20;
    const newFilePath = path.join(DRILL_PATH, subject, `${topic}.csv`);
    if (fs.existsSync(newFilePath)) {
      const content = fs.readFileSync(newFilePath, "utf8");
      const lines = content.split("\n").filter((l) => l.trim() !== "");
      if (lines.length >= 2) {
        const header = parseCsvLine(lines[0]).map((h) =>
          h.trim().toLowerCase(),
        );
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
        return res.json({ questions: out, total: all.length });
      }
    }
    const oldFilePath = path.join(__dirname, "questions", `${subject}.csv`);
    if (!fs.existsSync(oldFilePath))
      return res.status(404).json({ error: `No file for ${subject}` });
    const content = fs.readFileSync(oldFilePath, "utf8");
    const lines = content.split("\n").filter((l) => l.trim() !== "");
    const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    let all = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 6) continue;
      let obj = {};
      header.forEach((h, idx) => (obj[h] = cols[idx] || ""));
      if (obj.question_text) all.push(obj);
    }
    let filtered = all.filter((q) => {
      if (!q.topic) return false;
      const a = q.topic.trim().toLowerCase();
      const b = topic.trim().toLowerCase();
      return a === b || a.includes(b) || b.includes(a);
    });
    if (filtered.length === 0)
      return res.status(404).json({ error: `No questions for ${topic}` });
    const shuffled = filtered
      .sort(() => 0.5 - Math.random())
      .slice(0, countNum);
    const out = shuffled.map((q, i) => ({
      id: `${subject}-${topic}-${i}`,
      subject,
      topic: q.topic,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct: q.correct,
      explanation: q.explanation,
    }));
    res.json({ questions: out, total: filtered.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error: " + e.message });
  }
});
app.get("/api/cbt/drill/questions", (req, res) => {
  req.url = "/api/drill/questions?" + new URLSearchParams(req.query).toString();
  app.handle(req, res);
});

const _recentUploadHashes = new Map();
const _activeLocks = new Set();
app.post("/admin/upload-drill", checkAdmin, async (req, res) => {
  try {
    const { subject, topic, csvText, questions } = req.body;
    if (!subject || !topic)
      return res.status(400).json({ error: "subject and topic required" });
    const subj = normalizeSubject(subject);
    const topicName = topic.trim();
    const lockKey = `${subj}::${topicName.toLowerCase()}`;

    if (_activeLocks.has(lockKey)) {
      return res.status(429).json({ error: "Upload in progress" });
    }
    const crypto = require("crypto");
    const hash = crypto
      .createHash("md5")
      .update(`${subj}|${topicName}|${(csvText || "").slice(0, 2000)}`)
      .digest("hex");
    if (
      _recentUploadHashes.has(hash) &&
      Date.now() - _recentUploadHashes.get(hash) < 15000
    ) {
      return res.json({
        success: true,
        count: 0,
        message: `Duplicate ignored - already saved to drill/${subj}/${topicName}`,
        counts: buildCountsForSubject(subj).counts,
        totalQs: buildCountsForSubject(subj).totalQs,
      });
    }
    _activeLocks.add(lockKey);
    _recentUploadHashes.set(hash, Date.now());

    const folder = path.join(DRILL_PATH, subj);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    const filePath = path.join(folder, `${topicName}.csv`);

    let incomingRows = [];
    if (csvText) {
      let lines = csvText.split(/\r?\n/).filter((l) => l.trim() !== "");
      const hasHeader = lines[0].toLowerCase().includes("question_text");
      incomingRows = hasHeader ? lines.slice(1) : lines;
    } else if (Array.isArray(questions)) {
      incomingRows = questions.map((q) => {
        return [
          csvEscape(q.question_text),
          csvEscape(q.option_a),
          csvEscape(q.option_b),
          csvEscape(q.option_c),
          csvEscape(q.option_d),
          csvEscape(q.correct),
          csvEscape(q.explanation),
          csvEscape(q.topic || topicName),
        ].join(",");
      });
    }

    let existingContent = "";
    let existingSet = new Set();
    let isNewFile = !fs.existsSync(filePath);

    if (!isNewFile) {
      existingContent = fs.readFileSync(filePath, "utf8").trim();
      const existingLines = existingContent
        .split(/\r?\n/)
        .filter((l) => l.trim() !== "");
      const hasHeaderExisting = existingLines[0]
        .toLowerCase()
        .includes("question_text");
      const dataLines = hasHeaderExisting
        ? existingLines.slice(1)
        : existingLines;
      dataLines.forEach((line) => {
        try {
          const qText = parseCsvLine(line)[0];
          if (qText) existingSet.add(qText.trim().toLowerCase());
        } catch {}
      });
    }

    let rowsToAdd = [];
    let skippedDuplicate = 0;
    incomingRows.forEach((row) => {
      if (!row.trim()) return;
      try {
        const qText = parseCsvLine(row)[0];
        if (!qText) return;
        const norm = qText.trim().toLowerCase();
        if (existingSet.has(norm)) {
          skippedDuplicate++;
        } else {
          rowsToAdd.push(row);
          existingSet.add(norm);
        }
      } catch {
        rowsToAdd.push(row);
      }
    });

    let finalTotal = 0;
    if (isNewFile) {
      const header =
        "question_text,option_a,option_b,option_c,option_d,correct,explanation,topic";
      const finalCsv = header + "\n" + rowsToAdd.join("\n");
      fs.writeFileSync(filePath, finalCsv);
      finalTotal = rowsToAdd.length;
    } else {
      if (rowsToAdd.length > 0) {
        const toAppend = "\n" + rowsToAdd.join("\n");
        fs.appendFileSync(filePath, toAppend);
      }
      finalTotal = countDrillFileQs(filePath);
    }

    if (!topicsCache[subj]) topicsCache[subj] = [];
    if (
      !topicsCache[subj].some(
        (t) => t.toLowerCase() === topicName.toLowerCase(),
      )
    ) {
      topicsCache[subj].push(topicName);
      await saveTopicsCache();
    }
    rebuildDrillCache();
    const data = buildCountsForSubject(subj);

    _activeLocks.delete(lockKey);
    res.json({
      success: true,
      message: `${rowsToAdd.length} added, ${skippedDuplicate} dup skipped. Total ${finalTotal} Qs in drill/${subj}/${topicName}`,
      count: rowsToAdd.length,
      added: rowsToAdd.length,
      skippedDuplicate,
      total: finalTotal,
      counts: data.counts,
      totalQs: data.totalQs,
    });
  } catch (e) {
    try {
      _activeLocks.delete(
        `${normalizeSubject(req.body.subject)}::${req.body.topic?.trim().toLowerCase()}`,
      );
    } catch {}
    res.status(500).json({ error: e.message });
  }
});
app.post("/api/cbt/start", async (req, res) => {
  try {
    const config = cbtConfigCache;
    if (!config.enabled)
      return res
        .status(403)
        .json({ error: "CBT Mode disabled by admin", code: "CBT_DISABLED" });
    const { subjects, userId, username } = req.body;
    const actualUser = username || userId || req.headers["x-user-id"];
    if (!actualUser)
      return res
        .status(401)
        .json({ error: "Login required", code: "AUTH_REQUIRED" });
    if (!subjects || subjects.length !== 3)
      return res.status(400).json({ error: "Select exactly 3 subjects" });
    let hasActive = await hasFullAccessFor(actualUser);
    if (!hasActive)
      return res.status(403).json({
        error: `Subscription expired. Please renew`,
        code: "SUBSCRIPTION_REQUIRED",
      });
    const canonicalSubjects = [
      "english",
      ...subjects.map((s) => normalizeSubject(s)),
    ];
    let examQuestions = [];
    canonicalSubjects.forEach((subj) => {
      const bank = questionBank[subj] || [];
      const shuffled = [...bank].sort(() => 0.5 - Math.random());
      const sample = shuffled.slice(
        0,
        Math.min(config.questionsPerSubject, bank.length),
      );
      sample.forEach((q, idx) => {
        examQuestions.push({
          id: `${subj}-${idx}-${Date.now()}-${Math.random()}`,
          subject: subj,
          number: examQuestions.length + 1,
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct: q.correct,
          explanation: q.explanation,
        });
      });
    });
    res.json({
      duration: config.durationMinutes * 60,
      durationMinutes: config.durationMinutes,
      questions: examQuestions,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
app.get("/admin/cbt-config", checkAdmin, (req, res) =>
  res.json(cbtConfigCache),
);
app.post("/admin/cbt-config", checkAdmin, (req, res) => {
  const { durationMinutes, questionsPerSubject, enabled } = req.body;
  const cfg = { ...cbtConfigCache };
  if (durationMinutes) cfg.durationMinutes = parseInt(durationMinutes);
  if (questionsPerSubject)
    cfg.questionsPerSubject = parseInt(questionsPerSubject);
  if (typeof enabled === "boolean") cfg.enabled = enabled;
  saveCBTConfig(cfg);
  res.json({ success: true, config: cfg });
});
app.post("/admin/upload-questions", checkAdmin, async (req, res) => {
  try {
    const { subject, topic, questions, csvText } = req.body;
    if (!subject) return res.status(400).json({ error: "subject required" });
    const subj = normalizeSubject(subject);
    const topicName = (topic || "").trim();
    const qFolder = path.join(__dirname, VITALS.SYSTEM.QUESTIONS_FOLDER);
    if (!fs.existsSync(qFolder)) fs.mkdirSync(qFolder);
    const filePath = path.join(qFolder, `${subj}.csv`);
    if (topicName) {
      if (!topicsCache[subj]) topicsCache[subj] = [];
      if (
        !topicsCache[subj].some(
          (t) => t.toLowerCase() === topicName.toLowerCase(),
        )
      ) {
        topicsCache[subj].push(topicName);
        await saveTopicsCache();
      }
    }
    const existingBank = questionBank[subj] || [];
    const existingSet = new Set(
      existingBank.map((q) =>
        String(q.question_text || "")
          .trim()
          .toLowerCase(),
      ),
    );
    const seenInThisUpload = new Set();
    let rowsToAppend = [];
    let skippedDuplicate = 0,
      skippedInvalid = 0;
    if (csvText) {
      const lines = csvText.split("\n").filter((l) => l.trim() !== "");
      const headerLine = lines[0].toLowerCase();
      const hasHeader = headerLine.includes("question_text");
      const startIdx = hasHeader ? 1 : 0;
      let headers = hasHeader
        ? parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
        : [
            "question_text",
            "option_a",
            "option_b",
            "option_c",
            "option_d",
            "correct",
            "explanation",
            "topic",
          ];
      for (let i = startIdx; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 6) {
          skippedInvalid++;
          continue;
        }
        let obj = {};
        headers.forEach((h, idx) => (obj[h] = cols[idx] || ""));
        if (!obj.question_text) {
          skippedInvalid++;
          continue;
        }
        const norm = obj.question_text.trim().toLowerCase();
        if (existingSet.has(norm) || seenInThisUpload.has(norm)) {
          skippedDuplicate++;
          continue;
        }
        seenInThisUpload.add(norm);
        if (topicName) obj.topic = topicName;
        rowsToAppend.push(
          [
            csvEscape(obj.question_text),
            csvEscape(obj.option_a),
            csvEscape(obj.option_b),
            csvEscape(obj.option_c),
            csvEscape(obj.option_d),
            csvEscape(obj.correct || "A"),
            csvEscape(obj.explanation || ""),
            csvEscape(obj.topic || topicName || "General"),
          ].join(","),
        );
      }
    } else if (Array.isArray(questions)) {
      for (const q of questions) {
        const qText = String(q.question_text || "").trim();
        if (!qText) {
          skippedInvalid++;
          continue;
        }
        const norm = qText.toLowerCase();
        if (existingSet.has(norm) || seenInThisUpload.has(norm)) {
          skippedDuplicate++;
          continue;
        }
        seenInThisUpload.add(norm);
        rowsToAppend.push(
          [
            csvEscape(qText),
            csvEscape(q.option_a),
            csvEscape(q.option_b),
            csvEscape(q.option_c),
            csvEscape(q.option_d),
            csvEscape(q.correct || "A"),
            csvEscape(q.explanation || ""),
            csvEscape(q.topic || topicName || "General"),
          ].join(","),
        );
      }
    }
    if (rowsToAppend.length === 0)
      return res.json({
        success: true,
        message: `0 new, ${skippedDuplicate} dup`,
        total: existingBank.length,
        added: 0,
      });
    if (!fs.existsSync(filePath))
      fs.writeFileSync(
        filePath,
        "question_text,option_a,option_b,option_c,option_d,correct,explanation,topic\n",
      );
    fs.appendFileSync(filePath, rowsToAppend.join("\n") + "\n");
    loadQuestions();
    rebuildDrillCache();
    res.json({
      success: true,
      message: `${rowsToAppend.length} added to ${subj}`,
      total: questionBank[subj]?.length || 0,
      added: rowsToAppend.length,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Upload failed: " + e.message });
  }
});
app.post("/admin/reload-questions", checkAdmin, (req, res) => {
  loadQuestions();
  rebuildDrillCache();
  res.json({
    success: true,
    counts: Object.fromEntries(
      Object.entries(questionBank).map(([k, v]) => [k, v.length]),
    ),
  });
});
app.get("/admin/metrics", checkAdmin, async (req, res) => {
  try {
    const Subscription = require("./models/Subscription");
    const totalUsers = await User.countDocuments();
    const allSubs = await Subscription.find({ status: "active" });
    const activeSubsDocs = await Subscription.find({
      status: "active",
      expiresAt: { $gt: new Date() },
    });
    const PRICE = VITALS.SUBSCRIPTION.PRICE;
    const totalRevenueValue = allSubs.reduce(
      (sum, s) => sum + (s.amount || PRICE),
      0,
    );
    const activeCount = activeSubsDocs.length;
    const mrrValue = activeCount * PRICE;
    res.json({
      kpis: {
        totalUsers,
        activeSubs: activeCount,
        mrr: mrrValue,
        totalRevenue: totalRevenueValue,
        usersOnline: Math.floor(activeCount * 0.15) + 1,
      },
      revenueTrend: [
        { month: "Jan", revenue: 0 },
        { month: "Feb", revenue: 0 },
        { month: "Mar", revenue: totalRevenueValue },
      ],
      subjectPopularity: Object.entries(questionBank).map(([k, v]) => ({
        name: k,
        attempts: v.length,
      })),
      tableData: [],
      debug: {
        allSubsCount: allSubs.length,
        activeSubsCount: activeCount,
        subscriptions: allSubs.map((s) => ({
          email: s.email,
          amount: s.amount,
          expiresAt: s.expiresAt,
          ref: s.reference,
        })),
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get("/api/debug/bank", (req, res) => {
  res.json(
    Object.fromEntries(
      Object.entries(questionBank).map(([k, v]) => [k, { total: v.length }]),
    ),
  );
});
app.get("/api/debug/questions/:subject", (req, res) => {
  const subj = normalizeSubject(req.params.subject);
  const list = questionBank[subj] || [];
  res.json({ subject: subj, total: list.length });
});
let roomState = {};
let socketUserMap = {};

// === TIER 4: ROOM MEMORY LEAK FIX ===
const ROOM_MAX_USERS = 50;
const ROOM_IDLE_MS = 60 * 60 * 1000;
const ROOM_CLEANUP_INTERVAL = 5 * 60 * 1000;

function getActiveUsersInRoom(room) {
  return Object.values(socketUserMap).filter((u) => u.room === room).length;
}

function cleanupRoomIfEmpty(room) {
  if (!room) return;
  const count = getActiveUsersInRoom(room);
  if (count === 0) {
    const state = roomState[room];
    if (state) {
      if (state.timer) {
        clearInterval(state.timer);
        console.log(`🧹 CLEANUP: Cleared timer for ${room}`);
      }
      console.log(`🧹 CLEANUP: Deleting empty room ${room}`);
      delete roomState[room];
      // === TIER 5: Clear Redis too ===
      try {
        arenaRedis.clearRoomState(room);
      } catch {}
    }
    if (global.liveRooms && global.liveRooms.has(room)) {
      global.liveRooms.delete(room);
    }
  }
}

// Janitor - kills orphaned rooms
setInterval(() => {
  let cleaned = 0;
  for (const room of Object.keys(roomState)) {
    const count = getActiveUsersInRoom(room);
    const state = roomState[room];
    const idle =
      Date.now() - (state.lastActive || state.createdAt || Date.now());
    if (count === 0 || idle > ROOM_IDLE_MS) {
      if (state.timer) clearInterval(state.timer);
      delete roomState[room];
      try {
        arenaRedis.clearRoomState(room);
      } catch {}
      if (global.liveRooms) global.liveRooms.delete(room);
      cleaned++;
    }
  }
  if (cleaned > 0) console.log(`🧹 JANITOR: Cleaned ${cleaned} rooms`);
  console.log(
    `📊 Rooms: ${Object.keys(roomState).length} | Sockets: ${Object.keys(socketUserMap).length}`,
  );
}, ROOM_CLEANUP_INTERVAL);
// === END TIER 4 ===

function getRandomQuestion(subject) {
  const canonical = normalizeSubject(subject);
  const list = questionBank[canonical];
  if (!list || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function emitParticipants(room) {
  const state = roomState[room];
  if (!state) return;
  const usersArr = Object.entries(state.scores).map(([username, score]) => ({
    username,
    score,
    correct: state.userStats?.[username]?.correct || score,
    lastCorrectAt: state.userStats?.[username]?.lastCorrectAt || 0,
  }));
  io.to(room).emit("roomUsers", usersArr);
  io.to(room).emit("update_users", usersArr);
  io.to(room).emit("update_scores", usersArr);
}

function buildLeaderboard(room) {
  const state = roomState[room];
  if (!state) return [];
  const leaderboard = Object.entries(state.userStats || {}).map(
    ([user, data]) => ({
      user,
      username: user,
      score: data.score || 0,
      correct: data.correct || 0,
      lastCorrectAt: data.lastCorrectAt || 0,
    }),
  );
  leaderboard.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.lastCorrectAt || 0) - (b.lastCorrectAt || 0);
  });
  return leaderboard;
}

function startQuizLoop(room, subject) {
  if (!roomState[room])
    roomState[room] = {
      qCount: 0,
      scores: {},
      userStats: {},
      streaks: {},
      history: [],
      answered: new Set(),
      is_question_locked: false,
      winner: null,
      timer: null,
      currentQ: null,
      expiresAt: null,
      createdAt: Date.now(),
      lastActive: Date.now(),
    };
  let state = roomState[room];
  if (state.timer) clearInterval(state.timer);
  const canonical = normalizeSubject(subject);
  const calcSubjects = ["maths", "physics", "chemistry", "accounting"];
  const intervalTime = calcSubjects.includes(canonical) ? 60000 : 20000;

  const askQuestion = () => {
    if (!roomState[room]) return;
    state = roomState[room];
    state.lastActive = Date.now();
    if (state.qCount > 0 && state.qCount % 10 === 0) {
      const leaderboard = buildLeaderboard(room);
      io.to(room).emit("show_leaderboard", {
        leaderboard,
        qNumber: state.qCount,
      });
    }
    const q = getRandomQuestion(canonical);
    if (!q) {
      console.log(`❌ No Q for ${canonical}`);
      return;
    }
    state.currentQ = q;
    state.qCount += 1;
    state.questionStart = Date.now();
    state.expiresAt = state.questionStart + intervalTime;
    state.intervalTime = intervalTime;
    state.answered = new Set();
    state.is_question_locked = false;
    state.winner = null;

    // === TIER 5: SAVE Q TO REDIS FOR ALL SERVERS ===
    arenaRedis.saveRoomState(room, state).catch(() => {});

    console.log(
      `❓ [${room}] Q${state.qCount}: ${q.question_text?.slice(0, 50)}...`,
    );
    io.to(room).emit("new_question", {
      qNumber: state.qCount,
      question: q,
      time: intervalTime / 1000,
      expiresAt: state.expiresAt,
      serverTime: Date.now(),
      subject: canonical,
    });
  };

  askQuestion();
  state.timer = setInterval(askQuestion, intervalTime);
  console.log(`✅ Quiz loop started for ${room} every ${intervalTime / 1000}s`);
}

const liveRooms = global.liveRooms || new Map();
global.liveRooms = liveRooms;

io.on("connection", (socket) => {
  registerLiveRankHandlers(io, socket, liveRooms);
  socket.on("join_room", async ({ room, username }) => {
    console.log(`🔵 JOIN: ${username} -> ${room}`);
    if (!isEnglishRoom(room)) {
      const ok = await hasFullAccessFor(username);
      if (!ok) {
        socket.emit("access_denied", {
          reason: "Subscribe to access " + room,
          code: "SUBSCRIPTION_REQUIRED",
        });
        return;
      }
    }
    const activeCount = getActiveUsersInRoom(room);
    if (activeCount >= ROOM_MAX_USERS) {
      socket.emit("room_full", {
        message: `Room ${room} full (50/50) - try another subject`,
      });
      return;
    }

    for (const r of socket.rooms) {
      if (r !== socket.id && r !== room && r.endsWith("-room")) socket.leave(r);
    }
    socket.join(room);
    socket.username = username;
    socket.currentRoom = room;
    socket.roomId = room;
    socketUserMap[socket.id] = { room, username, joinedAt: Date.now() };

    if (!roomState[room])
      roomState[room] = {
        qCount: 0,
        scores: {},
        userStats: {},
        streaks: {},
        history: [],
        answered: new Set(),
        is_question_locked: false,
        winner: null,
        timer: null,
        currentQ: null,
        expiresAt: null,
        createdAt: Date.now(),
        lastActive: Date.now(),
      };
    roomState[room].lastActive = Date.now();
    if (roomState[room].scores[username] === undefined)
      roomState[room].scores[username] = 0;
    if (!roomState[room].userStats[username])
      roomState[room].userStats[username] = {
        score: 0,
        correct: 0,
        lastCorrectAt: 0,
      };
    if (!roomState[room].streaks[username])
      roomState[room].streaks[username] = 0;
    if (!roomState[room].answered) roomState[room].answered = new Set();

    // === TIER 5: SAVE ROOM STATE ===
    arenaRedis.saveRoomState(room, roomState[room]).catch(() => {});

    emitParticipants(room);
    socket.to(room).emit("userJoined", { username });
    const subject = normalizeSubject(room.replace("-room", "").toLowerCase());
    const bankLen = questionBank[subject]?.length || 0;
    console.log(
      `📚 ${subject} bank=${bankLen} | room ${room} users=${activeCount + 1}`,
    );
    if (bankLen === 0) {
      socket.emit("receive_message", {
        room,
        author: "System",
        message: `⚠️ No questions for ${subject}. Upload CSV first.`,
        system: true,
      });
      return;
    }
    if (!roomState[room].timer) {
      startQuizLoop(room, subject);
    } else {
      let state = roomState[room];
      if (state.currentQ && state.expiresAt) {
        let remainingMs = Math.max(0, state.expiresAt - Date.now());
        socket.emit("new_question", {
          qNumber: state.qCount,
          question: state.currentQ,
          time: Math.ceil(remainingMs / 1000),
          expiresAt: state.expiresAt,
          serverTime: Date.now(),
          subject,
        });
        if (state.is_question_locked)
          socket.emit("question_locked", {
            winner: state.winner,
            message: `🔒 Locked by ${state.winner}`,
            correct: state.currentQ.correct,
          });
      }
    }
  });

  socket.on("leave_room", (payload) => {
    let targetRoom, username;
    if (typeof payload === "string") {
      targetRoom = payload;
      username = socketUserMap[socket.id]?.username;
    } else if (payload && typeof payload === "object") {
      targetRoom = payload.room || socketUserMap[socket.id]?.room;
      username = payload.username || socketUserMap[socket.id]?.username;
    } else {
      targetRoom = socketUserMap[socket.id]?.room;
      username = socketUserMap[socket.id]?.username;
    }
    if (targetRoom) socket.leave(targetRoom);
    if (socketUserMap[socket.id]) delete socketUserMap[socket.id];
    if (targetRoom && username) {
      console.log(`🔴 LEAVE: ${username} -> ${targetRoom}`);
      io.to(targetRoom).emit("userLeft", { username });
      emitParticipants(targetRoom);
      setTimeout(() => cleanupRoomIfEmpty(targetRoom), 1000);
    } else if (targetRoom) {
      setTimeout(() => cleanupRoomIfEmpty(targetRoom), 1000);
    }
  });

  socket.on("answer_question", async ({ room, username, answer }) => {
    if (!isEnglishRoom(room)) {
      const ok = await hasFullAccessFor(username);
      if (!ok) {
        socket.emit("access_denied", { reason: "Subscription required" });
        return;
      }
    }
    let state = roomState[room];
    if (!state || !state.currentQ) return;
    state.lastActive = Date.now();
    if (!state.answered) state.answered = new Set();
    if (state.answered.has(username)) {
      socket.emit("answer_rejected", { reason: "You already answered" });
      return;
    }
    if (state.is_question_locked === true) {
      socket.emit("answer_rejected", {
        reason: `Locked by ${state.winner}`,
        winner: state.winner,
      });
      return;
    }
    let correct = state.currentQ.correct.trim().toUpperCase();
    let given = answer.trim().toUpperCase();
    let isCorrect = correct === given;

    if (isCorrect) {
      state.is_question_locked = true;
      state.winner = username;
      state.answered.add(username);
      if (!state.userStats[username])
        state.userStats[username] = { score: 0, correct: 0, lastCorrectAt: 0 };
      state.userStats[username].score =
        (state.userStats[username].score || 0) + 1;
      state.userStats[username].correct =
        (state.userStats[username].correct || 0) + 1;
      state.userStats[username].lastCorrectAt = Date.now();
      state.scores[username] = state.userStats[username].score;
      state.streaks[username] = (state.streaks[username] || 0) + 1;

      // === TIER 5: SAVE SCORE TO REDIS ===
      arenaRedis
        .updateScore(room, username, username, state.scores[username])
        .catch(() => {});
      arenaRedis.saveRoomState(room, state).catch(() => {});

      io.to(room).emit("question_locked", {
        winner: username,
        answer: given,
        correct,
        message: `🏆 ${username} wins! Answer: ${correct}`,
      });
      io.to(room).emit("answer_result", {
        username,
        answer: given,
        correct,
        isCorrect,
        score: state.scores[username],
        correctCount: state.userStats[username].correct,
        lastCorrectAt: state.userStats[username].lastCorrectAt,
      });
    } else {
      state.answered.add(username);
      state.streaks[username] = 0;
      if (!state.userStats[username])
        state.userStats[username] = { score: 0, correct: 0, lastCorrectAt: 0 };
      io.to(room).emit("answer_result", {
        username,
        answer: given,
        correct,
        isCorrect,
        score: state.scores[username] || 0,
        correctCount: state.userStats[username].correct,
      });
    }
    emitParticipants(room);
  });

  socket.on("send_message", async (data) => {
    if (!isEnglishRoom(data.room)) {
      const ok = await hasFullAccessFor(data.author || data.username);
      if (!ok) return;
    }
    const st = roomState[data.room];
    if (st) st.lastActive = Date.now();
    io.to(data.room).emit("receive_message", data);
  });

  socket.on("private_message", ({ room, to, from, message }) => {
    let targetSocketId = null;
    for (const [sid, info] of Object.entries(socketUserMap)) {
      if (info.username === to && info.room === room) {
        targetSocketId = sid;
        break;
      }
    }
    const payload = { from, to, message, room, ts: Date.now() };
    if (targetSocketId) io.to(targetSocketId).emit("private_message", payload);
    if (targetSocketId !== socket.id) socket.emit("private_message", payload);
  });

  socket.on("disconnect", () => {
    const data = socketUserMap[socket.id];
    if (data) {
      console.log(`⚫ DISCONNECT: ${data.username} from ${data.room}`);
      socket.to(data.room).emit("userLeft", { username: data.username });
      delete socketUserMap[socket.id];
      emitParticipants(data.room);
      setTimeout(() => cleanupRoomIfEmpty(data.room), 1500);
    }
  });
});
app.get("/", (req, res) =>
  res.send(
    "JAMB-2go Bot Engine 30K READY: " +
      Object.keys(questionBank)
        .map((k) => `${k}(${questionBank[k].length})`)
        .join(", "),
  ),
);
initRedisAdapter().then(() => {
  server.listen(VITALS.SYSTEM.PORT, () =>
    console.log(`Server on ${VITALS.SYSTEM.PORT} - TIER 5 STEP 1+2A READY`),
  );
});

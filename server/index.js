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
const User = require("./models/User");
const { registerLiveRankHandlers } = require("./sockets/liveRankHandler");
const { rateLimit } = require("express-rate-limit");
const {
  getDisplayName,
  getIconForScore,
  getLiveRank,
} = require("./config/liveRanks");
const arenaRankService = require("./services/arenaRankService");
const arenaRedis = require("./utils/arenaRedis");
const monitorService = require("./services/systemMonitorService");

mongoose
  .connect(VITALS.SYSTEM.MONGODB_URI, { dbName: VITALS.SYSTEM.MONGODB_DB_NAME })
  .then(() => console.log("✅ MongoDB jamb-2go connected"))
  .catch((e) => {
    console.error("❌ MongoDB FAILED:", e.message);
  });

async function hasFullAccessFor(usernameOrEmail) {
  if (!usernameOrEmail) return false;
  try {
    const user = await User.findOne({
      $or: [
        { email: usernameOrEmail.toLowerCase().trim() },
        { username: new RegExp(`^${usernameOrEmail}$`, "i") },
        { userId: usernameOrEmail },
      ],
    });
    if (!user) return false;

    const now = new Date();

    // Paid users
    if (
      user.subscriptionStatus === "active" &&
      user.subscriptionExpiresAt &&
      new Date(user.subscriptionExpiresAt) > now
    ) {
      return true;
    }

    // Trial users — THIS FIXES JAGO
    if (
      user.subscriptionStatus === "trial" &&
      user.trialEndsAt &&
      new Date(user.trialEndsAt) > now
    ) {
      return true;
    }
  } catch (e) {
    console.log("access check err", e.message);
  }
  return false;
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
      "X-Admin-Password",
      "x-admin-password",
    ],
  }),
);
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    tier: "TIER 6 - PERSIST FIXED",
    time: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
app.get("/", (req, res) => res.send("JAMB-2GO TIER 6 - Live Rank Ready 🚀"));

// === FIXED RATE LIMITER (NO ipKeyGenerator) ===
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests" },
});
const cbtStartLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many CBT starts" },
  keyGenerator: (req) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "anon";
    const user = req.body?.userId || req.headers["x-user-id"] || "anon";
    return `${ip}-${user}`;
  },
});
app.use("/api/", generalLimiter);
app.use("/api/cbt/start", cbtStartLimiter);
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
const adminStorageRoutes = require("./routes/adminStorage");

app.use("/api/cbt", cbtRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/drill", drillRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminStorageRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: corsOrigin, credentials: true },
});

let redisPubClient, redisSubClient;
async function initRedisAdapter() {
  if (!VITALS.SYSTEM.REDIS_URL) {
    console.log("⚠️ No REDIS_URL - single-server mode");
    return;
  }
  try {
    const { createAdapter } = require("@socket.io/redis-adapter");
    const { createClient } = require("redis");
    redisPubClient = createClient({ url: VITALS.SYSTEM.REDIS_URL });
    redisSubClient = redisPubClient.duplicate();
    await Promise.all([redisPubClient.connect(), redisSubClient.connect()]);
    io.adapter(createAdapter(redisPubClient, redisSubClient));
    arenaRedis.setRedisClients(redisPubClient, redisSubClient);
    console.log("✅ TIER 5: Redis ready");
    try {
      await arenaRankService.rebuildIfEmpty();
      console.log("✅ TIER 6: Ranks check done");
    } catch {}
  } catch (e) {
    console.log("⚠️ Redis failed:", e.message);
  }
}

const ADMIN_PASSWORD = VITALS.ADMIN.PASSWORD;
function checkAdmin(req, res, next) {
  const pass =
    req.headers["x-admin-password"] ||
    req.body?.adminPassword ||
    req.query?.adminPassword;
  if (pass !== ADMIN_PASSWORD)
    return res.status(401).json({ error: "Unauthorized" });
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
    let qs = [];
    for (let i = 1; i < lines.length; i++) {
      let vals = lines[i].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      if (vals.length >= 6) {
        let obj = {};
        header.forEach(
          (h, idx) => (obj[h] = (vals[idx] || "").replace(/^"|"$/g, "").trim()),
        );
        if (obj.question_text) qs.push(obj);
      }
    }
    if (!questionBank[subject]) questionBank[subject] = [];
    questionBank[subject] = questionBank[subject].concat(qs);
  });
}
loadQuestions();
function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
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
function countDrillFileQs(fp) {
  try {
    if (!fs.existsSync(fp)) return 0;
    const txt = fs.readFileSync(fp, "utf8");
    const lines = txt.split(/\r?\n/).filter((l) => l.trim() !== "");
    const has = lines[0].toLowerCase().includes("question_text");
    return has ? Math.max(0, lines.length - 1) : lines.length;
  } catch {
    return 0;
  }
}
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
let drillCountsCache = {};
function rebuildDrillCache() {
  drillCountsCache = {};
  const subsFS = fs.existsSync(DRILL_PATH)
    ? fs
        .readdirSync(DRILL_PATH)
        .filter((f) => fs.statSync(path.join(DRILL_PATH, f)).isDirectory())
    : [];
  const subsDB = Object.keys(topicsCache);
  const allSubs = [...new Set([...subsFS, ...subsDB])];
  allSubs.forEach((subj) => {
    const folder = path.join(DRILL_PATH, subj);
    const files = fs.existsSync(folder)
      ? fs.readdirSync(folder).filter((f) => f.toLowerCase().endsWith(".csv"))
      : [];
    const topicsDB = topicsCache[subj] || [];
    const topicsFiles = files.map((f) => path.basename(f, ".csv"));
    const allTopics = [...new Set([...topicsDB, ...topicsFiles])].filter(
      isValidTopicName,
    );
    const counts = {};
    let total = 0;
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
      total += c;
    });
    drillCountsCache[subj] = {
      topics: allTopics,
      counts,
      totalQs: total,
      totalTopics: allTopics.length,
    };
  });
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
  let fromBank = [];
  if (questionBank[subj]) {
    const raw = [
      ...new Set(questionBank[subj].map((q) => q.topic).filter(Boolean)),
    ];
    fromBank = raw.filter(isValidTopicName);
  }
  const all = [...new Set([...(cached.topics || []), ...fromBank])].filter(
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
  res.json({ subject: subj, ...buildCountsForSubject(subj) });
});
app.get("/api/drill/topics/:subject", (req, res) => {
  const subj = normalizeSubject(req.params.subject);
  res.json({ subject: subj, ...buildCountsForSubject(subj) });
});
app.post("/admin/topics", checkAdmin, async (req, res) => {
  const { subject, topic } = req.body;
  if (!subject || !topic) return res.status(400).json({ error: "required" });
  const subj = normalizeSubject(subject);
  if (!topicsCache[subj]) topicsCache[subj] = [];
  const norm = topic.trim();
  if (!topicsCache[subj].some((t) => t.toLowerCase() === norm.toLowerCase())) {
    topicsCache[subj].push(norm);
    await saveTopicsCache();
    rebuildDrillCache();
  }
  const data = buildCountsForSubject(subj);
  res.json({
    success: true,
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
  const fp = path.join(DRILL_PATH, subj, `${topicName}.csv`);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  rebuildDrillCache();
  res.json({ success: true, ...buildCountsForSubject(subj) });
});
app.get("/api/drill/questions", (req, res) => {
  try {
    let { subject, topic, count } = req.query;
    if (!subject || !topic) return res.status(400).json({ error: "Missing" });
    subject = normalizeSubject(subject);
    topic = decodeURIComponent(topic).trim();
    const num = count === "All" ? 1000 : parseInt(count) || 20;
    const fp = path.join(DRILL_PATH, subject, `${topic}.csv`);
    if (fs.existsSync(fp)) {
      const content = fs.readFileSync(fp, "utf8");
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
      const sh = all.sort(() => 0.5 - Math.random()).slice(0, num);
      return res.json({
        questions: sh.map((q, i) => ({
          id: `${subject}-${topic}-${i}`,
          subject,
          topic: q.topic || topic,
          ...q,
        })),
        total: all.length,
      });
    }
    const old = path.join(__dirname, "questions", `${subject}.csv`);
    if (!fs.existsSync(old)) return res.status(404).json({ error: "No file" });
    const content = fs.readFileSync(old, "utf8");
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
      const b = topic.toLowerCase();
      return a === b || a.includes(b) || b.includes(a);
    });
    if (filtered.length === 0) return res.status(404).json({ error: "No Qs" });
    const sh = filtered.sort(() => 0.5 - Math.random()).slice(0, num);
    res.json({
      questions: sh.map((q, i) => ({
        id: `${subject}-${topic}-${i}`,
        subject,
        topic: q.topic,
        ...q,
      })),
      total: filtered.length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
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
    if (!subject || !topic) return res.status(400).json({ error: "required" });
    const subj = normalizeSubject(subject);
    const topicName = topic.trim();
    const lockKey = `${subj}::${topicName.toLowerCase()}`;
    if (_activeLocks.has(lockKey))
      return res.status(429).json({ error: "Upload in progress" });
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
        message: "Duplicate ignored",
        counts: buildCountsForSubject(subj).counts,
        totalQs: buildCountsForSubject(subj).totalQs,
      });
    }
    _activeLocks.add(lockKey);
    _recentUploadHashes.set(hash, Date.now());
    const folder = path.join(DRILL_PATH, subj);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    const filePath = path.join(folder, `${topicName}.csv`);
    let incoming = [];
    if (csvText) {
      let lines = csvText.split(/\r?\n/).filter((l) => l.trim() !== "");
      const has = lines[0].toLowerCase().includes("question_text");
      incoming = has ? lines.slice(1) : lines;
    } else if (Array.isArray(questions)) {
      incoming = questions.map((q) =>
        [
          csvEscape(q.question_text),
          csvEscape(q.option_a),
          csvEscape(q.option_b),
          csvEscape(q.option_c),
          csvEscape(q.option_d),
          csvEscape(q.correct),
          csvEscape(q.explanation),
          csvEscape(q.topic || topicName),
        ].join(","),
      );
    }
    let existingSet = new Set();
    let isNew = !fs.existsSync(filePath);
    if (!isNew) {
      const ex = fs
        .readFileSync(filePath, "utf8")
        .trim()
        .split(/\r?\n/)
        .filter((l) => l.trim() !== "");
      const has = ex[0].toLowerCase().includes("question_text");
      const dataLines = has ? ex.slice(1) : ex;
      dataLines.forEach((line) => {
        try {
          const t = parseCsvLine(line)[0];
          if (t) existingSet.add(t.trim().toLowerCase());
        } catch {}
      });
    }
    let toAdd = [];
    let dup = 0;
    incoming.forEach((row) => {
      try {
        const t = parseCsvLine(row)[0];
        if (!t) return;
        const n = t.trim().toLowerCase();
        if (existingSet.has(n)) dup++;
        else {
          toAdd.push(row);
          existingSet.add(n);
        }
      } catch {
        toAdd.push(row);
      }
    });
    let finalTotal = 0;
    if (isNew) {
      fs.writeFileSync(
        filePath,
        "question_text,option_a,option_b,option_c,option_d,correct,explanation,topic\n" +
          toAdd.join("\n"),
      );
      finalTotal = toAdd.length;
    } else {
      if (toAdd.length > 0)
        fs.appendFileSync(filePath, "\n" + toAdd.join("\n"));
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
      message: `${toAdd.length} added, ${dup} dup skipped. Total ${finalTotal}`,
      count: toAdd.length,
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
    if (!config.enabled) return res.status(403).json({ error: "CBT disabled" });
    const { subjects, userId, username } = req.body;
    const actualUser = username || userId || req.headers["x-user-id"];
    if (!actualUser) return res.status(401).json({ error: "Login required" });
    if (!subjects || subjects.length !== 3)
      return res.status(400).json({ error: "Select 3" });
    const ok = await hasFullAccessFor(actualUser);
    if (!ok) return res.status(403).json({ error: "Subscription required" });
    const canonical = ["english", ...subjects.map((s) => normalizeSubject(s))];
    let exam = [];
    canonical.forEach((subj) => {
      const bank = questionBank[subj] || [];
      const sh = [...bank]
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.min(config.questionsPerSubject, bank.length));
      sh.forEach((q, idx) =>
        exam.push({
          id: `${subj}-${idx}-${Date.now()}`,
          subject: subj,
          number: exam.length + 1,
          ...q,
        }),
      );
    });
    res.json({
      duration: config.durationMinutes * 60,
      durationMinutes: config.durationMinutes,
      questions: exam,
    });
  } catch (e) {
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
    const seen = new Set();
    let rows = [];
    let dup = 0;
    if (csvText) {
      const lines = csvText.split("\n").filter((l) => l.trim() !== "");
      const has = lines[0].toLowerCase().includes("question_text");
      const start = has ? 1 : 0;
      let headers = has
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
      for (let i = start; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 6) continue;
        let obj = {};
        headers.forEach((h, idx) => (obj[h] = cols[idx] || ""));
        if (!obj.question_text) continue;
        const n = obj.question_text.trim().toLowerCase();
        if (existingSet.has(n) || seen.has(n)) {
          dup++;
          continue;
        }
        seen.add(n);
        if (topicName) obj.topic = topicName;
        rows.push(
          [
            csvEscape(obj.question_text),
            csvEscape(obj.option_a),
            csvEscape(obj.option_b),
            csvEscape(obj.option_c),
            csvEscape(obj.option_d),
            csvEscape(obj.correct || "A"),
            csvEscape(obj.explanation || ""),
            csvEscape(obj.topic || "General"),
          ].join(","),
        );
      }
    }
    if (rows.length === 0)
      return res.json({
        success: true,
        message: `0 new, ${dup} dup`,
        total: existingBank.length,
      });
    if (!fs.existsSync(filePath))
      fs.writeFileSync(
        filePath,
        "question_text,option_a,option_b,option_c,option_d,correct,explanation,topic\n",
      );
    fs.appendFileSync(filePath, rows.join("\n") + "\n");
    loadQuestions();
    rebuildDrillCache();
    res.json({
      success: true,
      message: `${rows.length} added`,
      total: questionBank[subj]?.length || 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
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
    const active = await Subscription.find({
      status: "active",
      expiresAt: { $gt: new Date() },
    });
    const PRICE = VITALS.SUBSCRIPTION.PRICE;
    const totalRev = allSubs.reduce((s, x) => s + (x.amount || PRICE), 0);
    res.json({
      kpis: {
        totalUsers,
        activeSubs: active.length,
        mrr: active.length * PRICE,
        totalRevenue: totalRev,
      },
      revenueTrend: [{ month: "Mar", revenue: totalRev }],
      subjectPopularity: Object.entries(questionBank).map(([k, v]) => ({
        name: k,
        attempts: v.length,
      })),
      tableData: [],
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

// === ROOM + RANK PERSISTENCE FIXED ===
let roomState = {};
let socketUserMap = {};
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
    const st = roomState[room];
    if (st) {
      if (st.timer) clearInterval(st.timer);
      console.log(`🧹 CLEANUP: ${room}`);
      delete roomState[room];
      try {
        arenaRedis.clearRoomState(room);
      } catch {}
    }
    if (global.liveRooms) global.liveRooms.delete(room);
  }
}
setInterval(() => {
  let c = 0;
  for (const r of Object.keys(roomState)) {
    const cnt = getActiveUsersInRoom(r);
    const st = roomState[r];
    const idle = Date.now() - (st.lastActive || st.createdAt || Date.now());
    if (cnt === 0 || idle > ROOM_IDLE_MS) {
      if (st.timer) clearInterval(st.timer);
      delete roomState[r];
      try {
        arenaRedis.clearRoomState(r);
      } catch {}
      if (global.liveRooms) global.liveRooms.delete(r);
      c++;
    }
  }
  if (c > 0) console.log(`🧹 Cleaned ${c} rooms`);
}, ROOM_CLEANUP_INTERVAL);
function getRandomQuestion(subject) {
  const canonical = normalizeSubject(subject);
  const list = questionBank[canonical];
  if (!list || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}
function emitParticipants(room) {
  const state = roomState[room];
  if (!state) return;

  // Build from ACTIVE sockets + scores to avoid ghost counts
  const activeUsernames = new Set(
    Object.values(socketUserMap)
      .filter((u) => u.room === room)
      .map((u) => u.username),
  );

  const usersArr = Array.from(activeUsernames).map((username) => {
    const score = state.scores[username] || 0;
    const stats = state.userStats?.[username] || {};
    const correct = stats.correct || score;
    let displayName = username;
    let icon = "🐣";
    try {
      displayName = getDisplayName(username, correct);
      icon = getIconForScore(correct);
    } catch {}
    return {
      username,
      displayName,
      score,
      correct,
      liveCorrect: correct,
      icon,
      streak: state.streaks[username] || 0,
      lastCorrectAt: stats.lastCorrectAt || 0,
      isActive: true,
    };
  });

  console.log(
    `👥 EMIT ${room}: ${usersArr.length} users ->`,
    usersArr.map((u) => u.username),
  );

  // Emit ALL possible events so frontend gets it regardless of what it listens to
  io.to(room).emit("roomUsers", usersArr);
  io.to(room).emit("update_users", usersArr);
  io.to(room).emit("update_scores", usersArr);
  io.to(room).emit("live:participants", {
    count: usersArr.length,
    users: usersArr,
  });
  io.to(room).emit("room:participants", usersArr);
  io.to(room).emit("participants:update", {
    count: usersArr.length,
    users: usersArr,
  });
} // === ARENA QUIZ - OPTION 2 FIX (per-player shuffle, text judge) ===
const crypto = require("crypto");

function strongShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getShuffledQuestion(baseQ) {
  if (!baseQ) return null;
  const rawCorrect = (baseQ.correct || baseQ.correct_answer || "A")
    .toString()
    .trim()
    .toUpperCase();
  const origLetter = ["A", "B", "C", "D"].includes(rawCorrect)
    ? rawCorrect
    : "A";
  const opts = [
    { letter: "A", text: baseQ.option_a },
    { letter: "B", text: baseQ.option_b },
    { letter: "C", text: baseQ.option_c },
    { letter: "D", text: baseQ.option_d },
  ];
  const correctText =
    opts.find((o) => o.letter === origLetter)?.text || opts[0].text;
  const shuffled = strongShuffle(opts);
  let newCorrect = "A";
  const newQ = { ...baseQ };
  ["A", "B", "C", "D"].forEach((nl, i) => {
    newQ["option_" + nl.toLowerCase()] = shuffled[i].text;
    if (shuffled[i].text === correctText) newCorrect = nl;
  });
  newQ.correct = newCorrect;
  newQ.correct_answer = newCorrect;
  newQ.correctText = correctText;
  newQ.id = `${baseQ.topic || "q"}-${crypto.randomBytes(4).toString("hex")}`;
  return newQ;
}

function buildLeaderboard(room) {
  const state = roomState[room];
  if (!state) return [];
  const lb = Object.entries(state.userStats || {}).map(([user, data]) => {
    const correct = data.correct || 0;
    let displayName = user;
    let icon = "🐣";
    try {
      displayName = getDisplayName(user, correct);
      icon = getIconForScore(correct);
    } catch {}
    return {
      user,
      username: user,
      displayName,
      score: data.score || 0,
      correct,
      liveCorrect: correct,
      icon,
      streak: state.streaks[user] || 0,
      lastCorrectAt: data.lastCorrectAt || 0,
    };
  });
  lb.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.lastCorrectAt || 0) - (b.lastCorrectAt || 0);
  });
  return lb;
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
      baseQ: null,
      correctText: null,
      expiresAt: null,
      createdAt: Date.now(),
      lastActive: Date.now(),
    };
  let state = roomState[room];
  if (state.timer) clearInterval(state.timer);
  const canonical = normalizeSubject(subject);
  const intervalTime = ["maths", "physics", "chemistry", "accounting"].includes(
    canonical,
  )
    ? 30000
    : 20000;

  const ask = () => {
    if (!roomState[room]) return;
    state = roomState[room];
    state.lastActive = Date.now();
    if (state.qCount > 0 && state.qCount % 10 === 0) {
      const lb = buildLeaderboard(room);
      io.to(room).emit("show_leaderboard", {
        leaderboard: lb,
        qNumber: state.qCount,
      });
    }
    const baseQ = getRandomQuestion(canonical);
    if (!baseQ) return;
    const baseCorrect = (baseQ.correct || baseQ.correct_answer || "A")
      .toString()
      .toUpperCase()
      .trim();
    const correctText =
      baseQ["option_" + baseCorrect.toLowerCase()] || baseQ.option_a;

    state.baseQ = baseQ;
    state.correctText = correctText;
    state.currentQ = { ...baseQ, correctText };
    state.qCount += 1;
    state.questionStart = Date.now();
    state.expiresAt = state.questionStart + intervalTime;
    state.intervalTime = intervalTime;
    state.answered = new Set();
    state.is_question_locked = false;
    state.winner = null;
    arenaRedis.saveRoomState(room, state).catch(() => {});

    // OPTION 2: different A/B/C/D per socket, same correctText
    const socketsInRoom = io.sockets.adapter.rooms.get(room);
    if (socketsInRoom) {
      for (const sid of socketsInRoom) {
        const shuffledQ = getShuffledQuestion(baseQ);
        io.to(sid).emit("new_question", {
          qNumber: state.qCount,
          question: shuffledQ,
          time: intervalTime / 1000,
          expiresAt: state.expiresAt,
          serverTime: Date.now(),
          subject: canonical,
        });
      }
    } else {
      io.to(room).emit("new_question", {
        qNumber: state.qCount,
        question: getShuffledQuestion(baseQ),
        time: intervalTime / 1000,
        expiresAt: state.expiresAt,
        serverTime: Date.now(),
        subject: canonical,
      });
    }
    console.log(
      `❓ [${room}] Q${state.qCount} correctText="${correctText.slice(0, 30)}"`,
    );
  };
  ask();
  state.timer = setInterval(ask, intervalTime);
  console.log(`✅ Quiz loop started for ${room} - OPTION 2`);
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
        console.log(`🚫 ACCESS DENIED: ${username} -> ${room}`);
        socket.emit("access_denied", {
          reason: VITALS.MESSAGES.ACCESS_DENIED_SUB,
          message: VITALS.MESSAGES.ACCESS_DENIED_SUB,
          code: "SUBSCRIPTION_REQUIRED",
        });
        emitParticipants(room);
        return;
      }
    }
    const activeCount = getActiveUsersInRoom(room);
    if (activeCount >= ROOM_MAX_USERS) {
      socket.emit("room_full", { message: `Room ${room} full` });
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
        baseQ: null,
        correctText: null,
        expiresAt: null,
        createdAt: Date.now(),
        lastActive: Date.now(),
      };
    roomState[room].lastActive = Date.now();

    let persistentScore = 0;
    let persistentDisplay = username;
    let persistentIcon = "🐣";
    try {
      const liveData = await arenaRankService.getUserRank(username);
      if (liveData) {
        persistentScore = liveData.score || liveData.correct || 0;
        persistentDisplay = liveData.displayName || username;
        persistentIcon = liveData.icon || getIconForScore(persistentScore);
      }
    } catch (e) {
      console.log("load rank err", e.message);
    }

    if (roomState[room].scores[username] === undefined)
      roomState[room].scores[username] = persistentScore;
    else if (persistentScore > roomState[room].scores[username])
      roomState[room].scores[username] = persistentScore;

    if (!roomState[room].userStats[username]) {
      roomState[room].userStats[username] = {
        score: persistentScore,
        correct: persistentScore,
        lastCorrectAt: Date.now(),
        displayName: persistentDisplay,
        icon: persistentIcon,
      };
    } else if (
      persistentScore > (roomState[room].userStats[username].correct || 0)
    ) {
      roomState[room].userStats[username].correct = persistentScore;
      roomState[room].userStats[username].score = persistentScore;
      roomState[room].scores[username] = persistentScore;
    }
    if (!roomState[room].streaks[username])
      roomState[room].streaks[username] = 0;
    if (!roomState[room].answered) roomState[room].answered = new Set();
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
        message: `⚠️ No questions for ${subject}`,
        system: true,
      });
      return;
    }
    if (!roomState[room].timer) {
      startQuizLoop(room, subject);
    } else {
      const st = roomState[room];
      if (st.currentQ && st.expiresAt) {
        const rem = Math.max(0, st.expiresAt - Date.now());
        const shuffledForJoiner = getShuffledQuestion(st.baseQ || st.currentQ);
        socket.emit("new_question", {
          qNumber: st.qCount,
          question: shuffledForJoiner,
          time: Math.ceil(rem / 1000),
          expiresAt: st.expiresAt,
          serverTime: Date.now(),
          subject,
        });
        if (st.is_question_locked)
          socket.emit("question_locked", {
            winner: st.winner,
            message: `🔒 Locked by ${st.winner}`,
            correct: st.correctText || st.currentQ.correct,
            correctText: st.correctText,
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

  socket.on(
    "answer_question",
    async ({ room, username, answer, answerText }) => {
      if (!isEnglishRoom(room)) {
        const ok = await hasFullAccessFor(username);
        if (!ok) {
          socket.emit("access_denied", {
            reason: VITALS.MESSAGES.ACCESS_DENIED_SUB,
          });
          return;
        }
      }
      let state = roomState[room];
      if (!state || !state.currentQ) return;
      state.lastActive = Date.now();
      if (!state.answered) state.answered = new Set();
      if (state.answered.has(username)) {
        socket.emit("answer_rejected", { reason: "Already answered" });
        return;
      }
      if (state.is_question_locked === true) {
        socket.emit("answer_rejected", {
          reason: `Locked by ${state.winner}`,
          winner: state.winner,
        });
        return;
      }
      const correctText = (
        state.correctText ||
        state.currentQ.correctText ||
        ""
      ).trim();
      const givenText = (answerText || "").trim();
      const givenLetter = (answer || "").trim().toUpperCase();

      // REJECT if frontend didn't send text — this forces text-only
      if (!givenText) {
        console.log(
          `⚠️ ${username} sent no answerText, only letter ${givenLetter} — rejecting`,
        );
        socket.emit("answer_rejected", {
          reason: "Update frontend to send answerText",
        });
        return;
      }

      const isCorrect = givenText.toLowerCase() === correctText.toLowerCase();

      console.log(
        `📝 JUDGE [${room}] Q${state.qCount}: correctText="${correctText}" | given="${givenText}" (${givenLetter}) => ${isCorrect ? "✅" : "❌"}`,
      );

      if (isCorrect) {
        state.is_question_locked = true;
        state.winner = username;
        state.answered.add(username);
        if (!state.userStats[username])
          state.userStats[username] = {
            score: 0,
            correct: 0,
            lastCorrectAt: 0,
          };
        state.userStats[username].score += 1;
        state.userStats[username].correct += 1;
        state.userStats[username].lastCorrectAt = Date.now();
        state.scores[username] = state.userStats[username].score;
        state.streaks[username] = (state.streaks[username] || 0) + 1;
        arenaRedis
          .updateScore(room, username, username, state.scores[username])
          .catch(() => {});
        arenaRedis.saveRoomState(room, state).catch(() => {});
        let displayName = username;
        let icon = "🐣";
        let newScore = state.userStats[username].correct;
        try {
          const live = await arenaRankService.onCorrectAnswer(username);
          displayName =
            live.displayName ||
            getDisplayName(username, live.score || newScore);
          icon = live.icon || getIconForScore(live.score || newScore);
          newScore = live.score || newScore;
          const rankInfo = getLiveRank(newScore);
          io.to(room).emit("live:user:rankUpdate", {
            username,
            displayName,
            icon,
            score: newScore,
            correct: newScore,
            correctCount: newScore,
          });
          io.to(room).emit("live_rank_update", {
            username,
            displayName,
            icon,
            score: newScore,
            correct: newScore,
          });
          if ([20, 60, 200, 500, 1200, 2500].includes(newScore)) {
            io.to(room).emit("live:rank:announcement", {
              text: `🚀 ${displayName} is now ${icon} ${rankInfo.name}!`,
              username,
              icon,
              tier: rankInfo.tier,
            });
            io.to(room).emit("live:rank:public", {
              username,
              displayName,
              newRank: rankInfo,
              text: `${displayName} is now ${rankInfo.name}!`,
            });
          }
        } catch (e) {
          console.log("rank save error", e.message);
        }
        io.to(room).emit("question_locked", {
          winner: username,
          winnerDisplay: displayName,
          answer: givenLetter,
          answerText: answerText,
          correct: correctText,
          correctText: correctText,
          message: `🏆 ${displayName} wins! Answer: ${correctText}`,
        });

        io.to(room).emit("answer_result", {
          username,
          displayName,
          answer: givenLetter,
          answerText,
          correct: correctText,
          correctText: correctText,
          isCorrect,
          score: state.scores[username],
          correctCount: state.userStats[username].correct,
          streak: state.streaks[username],
          lastCorrectAt: state.userStats[username].lastCorrectAt,
        });
      } else {
        state.answered.add(username);
        state.streaks[username] = 0;
        if (!state.userStats[username])
          state.userStats[username] = {
            score: 0,
            correct: 0,
            lastCorrectAt: 0,
          };
        let failDisplayName = username;
        try {
          failDisplayName = getDisplayName(
            username,
            state.userStats[username].correct || 0,
          );
        } catch {}
        io.to(room).emit("answer_result", {
          username,
          displayName: failDisplayName,
          answer: givenLetter,
          answerText,
          correct: state.currentQ.correct,
          correctText,
          isCorrect,
          score: state.scores[username] || 0,
          correctCount: state.userStats[username].correct || 0,
          streak: 0,
          lastCorrectAt: state.userStats[username].lastCorrectAt || 0,
        });
      }
      emitParticipants(room);
    },
  );
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
    let target = null;
    for (const [sid, info] of Object.entries(socketUserMap)) {
      if (info.username === to && info.room === room) {
        target = sid;
        break;
      }
    }
    const payload = { from, to, message, room, ts: Date.now() };
    if (target) io.to(target).emit("private_message", payload);
    if (target !== socket.id) socket.emit("private_message", payload);
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

app.get("/admin/live", checkAdmin, (req, res) => {
  // Don't leak correctText to admin UI - strip it
  const safeState = {};
  for (const [room, st] of Object.entries(roomState)) {
    safeState[room] = {
      qCount: st.qCount,
      userCount: Object.keys(st.scores || {}).length,
      isLocked: st.is_question_locked,
      winner: st.winner,
      correctText: st.correctText ? `${st.correctText.slice(0, 20)}...` : null, // masked
    };
  }
  res.json(monitorService.getLive(io, socketUserMap, safeState));
});

app.get("/admin/storage", checkAdmin, async (req, res) => {
  res.json(await monitorService.getStorage());
});

app.get("/admin/ranks", checkAdmin, async (req, res) => {
  res.json(await arenaRankService.getGlobalRanks(100));
});

initRedisAdapter().then(() => {
  server.listen(VITALS.SYSTEM.PORT, () =>
    console.log(
      `Server on ${VITALS.SYSTEM.PORT} - TIER 6 OPTION 2 correctText FIXED`,
    ),
  );
});

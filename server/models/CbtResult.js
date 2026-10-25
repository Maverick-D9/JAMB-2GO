const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const cbtResultSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, default: "Anonymous" },
    date: { type: Date, default: Date.now },

    totalScore: { type: Number, required: true },
    rawScore: Number,
    rawTotal: Number,

    englishScore: Number,
    subject2Name: String,
    subject2Score: Number,
    subject3Name: String,
    subject3Score: Number,
    subject4Name: String,
    subject4Score: Number,

    subjects: [
      {
        name: String,
        score: Number,
        total: Number,
        _id: false,
      },
    ],

    timeTaken: { type: Number, default: 0 },
    isFlagged: { type: Boolean, default: false },
    attemptId: { type: String, required: true, unique: true },

    userAnswers: { type: Object, default: {} },
    questionsSnapshot: { type: Object, default: null },
  },
  { timestamps: true },
);

// === PRODUCTION INDEXES FOR 100K+ DOCS ===
// attemptId already indexed by unique:true above, don't add again
cbtResultSchema.index({ userId: 1, totalScore: -1 });
cbtResultSchema.index({ isFlagged: 1, totalScore: -1, timeTaken: 1 });
cbtResultSchema.index({ date: -1 });
cbtResultSchema.index({ userId: 1, date: -1 });

const CbtResultModel = mongoose.model("CbtResult", cbtResultSchema);

// === AUTO MIGRATION ===
(async () => {
  try {
    const FILE_PATH = path.join(__dirname, "..", "cbt-results.json");
    if (!fs.existsSync(FILE_PATH)) return;
    const raw = fs.readFileSync(FILE_PATH, "utf8");
    const jsonData = JSON.parse(raw);
    if (!Array.isArray(jsonData) || jsonData.length === 0) return;
    const countInDb = await CbtResultModel.countDocuments();
    if (countInDb > 0) {
      console.log(
        `✅ CbtResult already in Mongo (${countInDb}), skipping migration`,
      );
      return;
    }
    console.log(`🔄 MIGRATING ${jsonData.length} old results to Mongo...`);
    const docs = jsonData.map((r) => ({
      userId: r.userId || r.username || "Anonymous",
      name: r.name || r.userId || "Anonymous",
      date: r.date ? new Date(r.date) : new Date(r.createdAt || Date.now()),
      totalScore: r.totalScore || 0,
      rawScore: r.rawScore || 0,
      rawTotal: r.rawTotal || 0,
      englishScore: r.englishScore || 0,
      subject2Name: r.subject2Name || "",
      subject2Score: r.subject2Score || 0,
      subject3Name: r.subject3Name || "",
      subject3Score: r.subject3Score || 0,
      subject4Name: r.subject4Name || "",
      subject4Score: r.subject4Score || 0,
      subjects: r.subjects || [],
      timeTaken: r.timeTaken || 0,
      isFlagged: r.isFlagged || false,
      attemptId:
        r.attemptId ||
        r._id ||
        `att_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      userAnswers: r.userAnswers || {},
      questionsSnapshot: r.questionsSnapshot || null,
    }));
    for (let i = 0; i < docs.length; i += 500) {
      const batch = docs.slice(i, i + 500);
      await CbtResultModel.insertMany(batch, { ordered: false });
    }
    console.log(`✅ MIGRATED ${docs.length} results`);
    fs.renameSync(FILE_PATH, FILE_PATH + `.backup_${Date.now()}.json`);
  } catch (e) {
    console.log("Migration skip/error:", e.message);
  }
})();

module.exports = CbtResultModel;

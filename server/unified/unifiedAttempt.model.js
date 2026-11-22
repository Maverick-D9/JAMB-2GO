// server/unified/unifiedAttempt.model.js
const mongoose = require("mongoose");
const conn = require("./unified.db");

const AttemptSchema = new mongoose.Schema({
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UnifiedTest",
    required: true,
    index: true,
  },
  username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  fullName: { type: String, default: "" },
  userId: { type: String, default: "" },
  score: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  answers: { type: Object, default: {} },
  submittedAt: { type: Date, default: Date.now },
});

// 1 username = 1 attempt per test - cheat-proof for backend
AttemptSchema.index({ testId: 1, username: 1 }, { unique: true });

module.exports = conn.model("UnifiedAttempt", AttemptSchema);

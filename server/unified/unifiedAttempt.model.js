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
  // RESUME - B: Global timer
  status: {
    type: String,
    enum: ["in_progress", "submitted"],
    default: "in_progress",
  },
  questions: { type: Array, default: [] }, // frozen snapshot
  currentIndex: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
  endsAt: { type: Date }, // = test.endAt (global), NOT now + duration
  lastSavedAt: { type: Date, default: Date.now },
  submittedAt: { type: Date },
});

AttemptSchema.index({ testId: 1, username: 1 }, { unique: true });
module.exports = conn.model("UnifiedAttempt", AttemptSchema);

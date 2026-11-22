// server/unified/unified.model.js
const mongoose = require("mongoose");
const conn = require("./unified.db");

const TestSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subjects: { type: [String], default: [] },
  // NEW: Topic filter - "all" = all topics, or e.g. "Circle Theorems"
  topic: { type: String, default: "all" },
  startAt: { type: Date, required: true },
  endAt: { type: Date, default: null },
  durationMinutes: { type: Number, default: 120 },
  questionsPerSubject: { type: Number, default: 40 },
  status: {
    type: String,
    enum: ["upcoming", "live", "ended"],
    default: "upcoming",
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = conn.model("UnifiedTest", TestSchema);

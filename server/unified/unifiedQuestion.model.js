const mongoose = require("mongoose");
const s = new mongoose.Schema(
  {
    subject: String,
    topic: String,
    questionText: String, // HTML + $$LaTeX$$
    diagramUrl: { type: String, default: "" },
    diagramPublicId: { type: String, default: "" },
    diagramType: String, // file | link
    optionA: String,
    optionB: String,
    optionC: String,
    optionD: String,
    correct: String,
    explanation: String,
    difficulty: { type: String, default: "medium" },
  },
  { timestamps: true },
);
module.exports = mongoose.model("UnifiedQuestion", s);

const mongoose = require("mongoose");

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
    subjects: [{ name: String, score: Number, total: Number, _id: false }],
    timeTaken: { type: Number, default: 0 },
    isFlagged: { type: Boolean, default: false },
    attemptId: { type: String, required: true, unique: true },
  },
  { timestamps: false },
);

// ONLY 1 extra index needed + unique attemptId = 3 total with _id
cbtResultSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model("CbtResult", cbtResultSchema);

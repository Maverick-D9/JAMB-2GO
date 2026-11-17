const mongoose = require("mongoose");

const DuelRankSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, required: true, index: true },
    duelPoints: { type: Number, default: 0 },
    duelWins: { type: Number, default: 0 },
    duelLosses: { type: Number, default: 0 },
    duelDraws: { type: Number, default: 0 },
    lastDuelAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.DuelRank || mongoose.model("DuelRank", DuelRankSchema);

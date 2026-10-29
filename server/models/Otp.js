// Otp.js - Mongo TTL Version - FIXED NO LOOP
const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    code: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

otpSchema.index({ email: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

otpSchema.statics.createOtp = async function (email, code) {
  if (!email) throw new Error("Email required");
  const rawEmail = typeof email === "object" ? email.email || "" : email;
  const key = String(rawEmail || email)
    .toLowerCase()
    .trim();

  await this.deleteMany({ email: key });
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // FIX: Use .save() instead of this.create to avoid infinite loop
  const doc = new this({
    email: key,
    code: String(code),
    attempts: 0,
    expiresAt,
  });
  await doc.save();
  return doc;
};

otpSchema.statics.verifyOtp = async function (email, code) {
  if (!email) return { ok: false, error: "Email required" };
  const rawEmail = typeof email === "object" ? email.email || "" : email;
  const key = String(rawEmail || email)
    .toLowerCase()
    .trim();

  const rec = await this.findOne({ email: key });
  if (!rec) return { ok: false, error: "Code expired. Request a new one." };
  if (new Date() > rec.expiresAt) {
    await this.deleteOne({ _id: rec._id });
    return { ok: false, error: "Code expired" };
  }
  rec.attempts += 1;
  await rec.save();
  if (rec.attempts > 5) {
    await this.deleteOne({ _id: rec._id });
    return { ok: false, error: "Too many attempts. Request new code." };
  }
  if (String(rec.code) !== String(code)) {
    return { ok: false, error: "Invalid code" };
  }
  await this.deleteOne({ _id: rec._id });
  return { ok: true };
};

// REMOVED dangerous override of this.create

module.exports = mongoose.model("Otp", otpSchema);

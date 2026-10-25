// Otp.js - Mongo TTL Version (production ready - FIXED INDEXES)
const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

// === INDEXES FOR SCALE - FIXED ===
otpSchema.index({ email: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL - auto deletes

otpSchema.statics.createOtp = async function (email, code) {
  const key = email.toLowerCase().trim();
  await this.deleteMany({ email: key });
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const doc = await this.create({
    email: key,
    code: String(code),
    attempts: 0,
    expiresAt,
  });
  return doc;
};

otpSchema.statics.verifyOtp = async function (email, code) {
  const key = email.toLowerCase().trim();
  const rec = await this.findOne({ email: key });
  if (!rec) {
    return { ok: false, error: "Code expired. Request a new one." };
  }
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

otpSchema.statics.create = function (email, code) {
  return this.createOtp(email, code);
};

otpSchema.statics.verify = function (email, code) {
  return this.verifyOtp(email, code);
};

module.exports = mongoose.model("Otp", otpSchema);

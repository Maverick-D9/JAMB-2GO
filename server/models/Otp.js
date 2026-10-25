// Otp.js - Mongo TTL Version (production ready)
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
      index: { expireAfterSeconds: 0 }, // <-- Mongo auto-deletes after this time
    },
  },
  { timestamps: true },
);

// === INDEXES FOR SCALE ===
otpSchema.index({ email: 1 });
otpSchema.index({ expiresAt: 1 });

otpSchema.statics.createOtp = async function (email, code) {
  const key = email.toLowerCase().trim();

  // Delete any old OTP for same email
  await this.deleteMany({ email: key });

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

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

  // Success - delete OTP
  await this.deleteOne({ _id: rec._id });
  return { ok: true };
};

// Keep old method names so auth.js still works if you call Otp.create / Otp.verify
otpSchema.statics.create = function (email, code) {
  return this.createOtp(email, code);
};

otpSchema.statics.verify = function (email, code) {
  return this.verifyOtp(email, code);
};

module.exports = mongoose.model("Otp", otpSchema);

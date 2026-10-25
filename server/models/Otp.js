// otp.js - Fixed
const otps = new Map();

const Otp = {
  create(email, code) {
    const key = email.toLowerCase();
    otps.set(key, {
      code: String(code),
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
    });
    // auto-cleanup after 11 min
    setTimeout(() => otps.delete(key), 11 * 60 * 1000);
  },
  verify(email, code) {
    const key = email.toLowerCase();
    const rec = otps.get(key);
    if (!rec) return { ok: false, error: "Code expired. Request a new one." };
    if (Date.now() > rec.expiresAt) {
      otps.delete(key);
      return { ok: false, error: "Code expired" };
    }
    rec.attempts++;
    if (rec.attempts > 5) {
      otps.delete(key);
      return { ok: false, error: "Too many attempts. Request new code." };
    }
    if (String(rec.code) !== String(code))
      return { ok: false, error: "Invalid code" };

    otps.delete(key);
    return { ok: true };
  },
};

module.exports = Otp;

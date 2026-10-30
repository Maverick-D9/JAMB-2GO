const mongoose = require("mongoose");
const VITALS = require("../config/vitals");

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, unique: true },
    id: { type: String },
    email: { type: String, unique: true, lowercase: true, required: true },
    username: { type: String },
    password: String,
    fullName: String,
    subject: { type: String, default: "english-room" },
    liveCorrect: { type: Number, default: 0 },
    picture: String,
    isGoogle: Boolean,
    verified: { type: Boolean, default: true },
    trialEndsAt: Date,
    subscriptionStatus: { type: String, default: "trial" },
    subscriptionExpiresAt: { type: Date },
    lastPaymentReference: String,
    // === TIER 2 ADD: daily 2-attempt counter for paid users ===
    cbtDailyUsage: {
      date: { type: String, default: "" }, // YYYY-MM-DD Lagos
      count: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

userSchema.index({ subscriptionStatus: 1, subscriptionExpiresAt: 1 });

userSchema.statics.findByEmail = function (email) {
  if (!email) return null;
  return this.findOne({ email: email.toLowerCase().trim() });
};

userSchema.statics.findByUsername = function (username) {
  if (!username) return null;
  return this.findOne({ username: new RegExp(`^${username}$`, "i") });
};

userSchema.statics.findByIdCustom = async function (userId) {
  if (!userId) return null;
  let user = await this.findOne({ userId });
  if (user) return user;
  user = await this.findOne({ id: userId });
  if (user) return user;
  if (String(userId).includes("@")) {
    return this.findOne({ email: userId.toLowerCase().trim() });
  }
  return null;
};

userSchema.statics.createUser = function (userInput) {
  const now = new Date();
  const trialEndsAt =
    userInput.trialEndsAt ||
    new Date(now.getTime() + VITALS.TRIAL.DURATION_DAYS * 24 * 60 * 60 * 1000);
  return this.create({
    userId:
      userInput.userId ||
      userInput.id ||
      `user_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    id: userInput.userId || userInput.id,
    email: (userInput.email || "").toLowerCase().trim(),
    username: userInput.username?.toLowerCase().trim(),
    password: userInput.password,
    fullName: userInput.fullName || userInput.username || "User",
    subject: userInput.subject || "english-room",
    picture: userInput.picture || null,
    isGoogle: !!userInput.isGoogle,
    verified: true,
    trialEndsAt,
    subscriptionStatus: "trial",
    subscriptionExpiresAt: null,
    lastPaymentReference: null,
  });
};

userSchema.statics.updateUser = function (userId, updates) {
  return this.findOneAndUpdate(
    { userId },
    { $set: updates },
    { returnDocument: "after" },
  );
};

userSchema.statics.checkUserAccess = function (user) {
  if (!user)
    return {
      tier: VITALS.SUBSCRIPTION.FREE_TIER_NAME,
      status: "free",
      daysLeft: 0,
    };
  const now = new Date();
  const trialEnds = user.trialEndsAt ? new Date(user.trialEndsAt) : new Date(0);
  const subExpires = user.subscriptionExpiresAt
    ? new Date(user.subscriptionExpiresAt)
    : null;

  if (user.subscriptionStatus === "active" && subExpires && now < subExpires) {
    const daysLeft = Math.ceil((subExpires - now) / 86400000);
    const cappedDays = Math.min(daysLeft, VITALS.SUBSCRIPTION.DURATION_DAYS);
    return {
      tier: VITALS.SUBSCRIPTION.TIER_NAME,
      status: "active",
      daysLeft: cappedDays,
      expiresAt: user.subscriptionExpiresAt,
      trialEndsAt: user.trialEndsAt,
    };
  }

  if (user.subscriptionStatus === "trial" && now < trialEnds) {
    const daysLeft = Math.ceil((trialEnds - now) / 86400000);
    const cappedDays = Math.min(daysLeft, VITALS.TRIAL.DURATION_DAYS);
    return {
      tier: VITALS.SUBSCRIPTION.TIER_NAME,
      status: "trial",
      daysLeft: cappedDays,
      trialEndsAt: user.trialEndsAt,
    };
  }

  const isExpiredActive =
    user.subscriptionStatus === "active" && subExpires && now >= subExpires;
  return {
    tier: VITALS.SUBSCRIPTION.FREE_TIER_NAME,
    status: isExpiredActive
      ? "expired"
      : user.subscriptionStatus === "trial"
        ? "expired"
        : user.subscriptionStatus || "free",
    daysLeft: 0,
    expiredAt: isExpiredActive ? user.subscriptionExpiresAt : undefined,
  };
};

module.exports = mongoose.model("User", userSchema);

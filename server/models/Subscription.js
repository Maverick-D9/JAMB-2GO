const mongoose = require("mongoose");
const VITALS = require("../config/vitals");

const subSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    email: { type: String },
    reference: { type: String, unique: true, required: true },
    amount: { type: Number, default: VITALS.SUBSCRIPTION.PRICE },
    amountKobo: { type: Number, default: VITALS.SUBSCRIPTION.PRICE_KOBO },
    paidAt: { type: Date, default: Date.now },
    expiresAt: Date,
    status: { type: String, default: "active" },
  },
  { timestamps: true },
);

// ONLY 2 INDEXES NEEDED - reference is already unique
subSchema.index({ userId: 1, status: 1 }); // fast "is user active?"

subSchema.statics.createSubscription = async function (
  userId,
  reference,
  email,
) {
  const existing = await this.findOne({ reference });
  if (existing) return existing;
  const now = new Date();
  const User = require("./User");
  const u = await User.findByIdCustom(userId);
  let base = now;
  const trialEndsAt = u?.trialEndsAt ? new Date(u.trialEndsAt) : null;
  const subExpiresAt = u?.subscriptionExpiresAt
    ? new Date(u.subscriptionExpiresAt)
    : null;
  const isTrialActive =
    u?.subscriptionStatus === "trial" && trialEndsAt && now < trialEndsAt;
  const isSubActive =
    u?.subscriptionStatus === "active" && subExpiresAt && now < subExpiresAt;
  if (isTrialActive) base = trialEndsAt;
  else if (isSubActive) base = subExpiresAt;
  else base = now;
  const expiresAt = new Date(base);
  expiresAt.setDate(base.getDate() + VITALS.SUBSCRIPTION.DURATION_DAYS);
  const doc = await this.findOneAndUpdate(
    { reference },
    {
      userId,
      email,
      reference,
      amount: VITALS.SUBSCRIPTION.PRICE,
      amountKobo: VITALS.SUBSCRIPTION.PRICE_KOBO,
      paidAt: now,
      expiresAt,
      status: "active",
    },
    { upsert: true, returnDocument: "after" },
  );
  await User.updateUser(userId, {
    subscriptionStatus: "active",
    subscriptionExpiresAt: expiresAt,
    lastPaymentReference: reference,
  });
  console.log(
    `✅ User ${userId} active till ${expiresAt.toISOString()} (Option B base: ${base.toISOString()})`,
  );
  return doc;
};

subSchema.statics.isActive = async function (userId) {
  const User = require("./User");
  const user = await User.findByIdCustom(userId);
  if (!user) return false;
  const access = User.checkUserAccess(user);
  return access.tier === VITALS.SUBSCRIPTION.TIER_NAME;
};

subSchema.statics.getAccess = async function (userId) {
  const User = require("./User");
  const user = await User.findByIdCustom(userId);
  if (!user)
    return {
      tier: VITALS.SUBSCRIPTION.FREE_TIER_NAME,
      status: "free",
      daysLeft: 0,
    };
  return User.checkUserAccess(user);
};

module.exports = mongoose.model("Subscription", subSchema);

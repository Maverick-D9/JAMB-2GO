const mongoose = require("mongoose");
const subSchema = new mongoose.Schema(
  {
    userId: { type: String, index: true, required: true },
    email: { type: String, index: true },
    reference: { type: String, unique: true, required: true },
    amount: { type: Number, default: 2000 },
    amountKobo: { type: Number, default: 200000 },
    paidAt: { type: Date, default: Date.now },
    expiresAt: Date,
    status: { type: String, default: "active", index: true },
  },
  { timestamps: true },
);

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
  const currentExp = u?.subscriptionExpiresAt
    ? new Date(u.subscriptionExpiresAt)
    : now;
  const base = currentExp > now ? currentExp : now;
  const expiresAt = new Date(base);
  expiresAt.setDate(base.getDate() + 30);

  const doc = await this.findOneAndUpdate(
    { reference },
    {
      userId,
      email,
      reference,
      amount: 2000,
      amountKobo: 200000,
      paidAt: now,
      expiresAt,
      status: "active",
    },
    { upsert: true, returnDocument: "after" },
  );

  // FIXED: Store Date object, not ISO string (was breaking comparisons)
  await User.updateUser(userId, {
    subscriptionStatus: "active",
    subscriptionExpiresAt: expiresAt,
    lastPaymentReference: reference,
  });
  console.log(`✅ User ${userId} active till ${expiresAt.toISOString()}`);
  return doc;
};

subSchema.statics.isActive = async function (userId) {
  const User = require("./User");
  const user = await User.findByIdCustom(userId);
  if (!user) return false;
  const access = User.checkUserAccess(user);
  return access.tier === "full_access";
};

subSchema.statics.getAccess = async function (userId) {
  const User = require("./User");
  const user = await User.findByIdCustom(userId);
  if (!user) return { tier: "english_only", status: "free", daysLeft: 0 };
  return User.checkUserAccess(user);
};
module.exports = mongoose.model("Subscription", subSchema);

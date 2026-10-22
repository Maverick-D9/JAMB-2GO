require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const email = "dredd992001@gmail.com"; // change to your email
  const user = await User.findOneAndUpdate(
    { email },
    {
      trialEndsAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      subscriptionStatus: "trial",
      subscriptionExpiresAt: null,
    },
    { new: true },
  );
  console.log(`✅ ${user.email} expired. trialEndsAt: ${user.trialEndsAt}`);
  await mongoose.disconnect();
})();

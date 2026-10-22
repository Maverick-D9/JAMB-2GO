const express = require("express");
const axios = require("axios");
const router = express.Router();
const User = require("../models/User");
const Subscription = require("../models/Subscription");
const { sendReceipt } = require("../utils/mailer");

// === NEW: SINGLE SOURCE ===
const VITALS = require("../config/vitals");

const PAYSTACK_SECRET =
  VITALS.PAYSTACK.SECRET_KEY || process.env.PAYSTACK_SECRET_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

router.post("/subscribe/initialize", async (req, res) => {
  try {
    const { email, userId } = req.body;
    if (!email) return res.status(400).json({ error: "email required" });

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: email.toLowerCase(),
        amount: VITALS.SUBSCRIPTION.PRICE_KOBO, // <- was 2000*100, now from vitals
        metadata: {
          userId,
          email: email.toLowerCase(),
          plan: VITALS.SUBSCRIPTION.NAME,
          tier: VITALS.SUBSCRIPTION.TIER_NAME,
        },
        callback_url: `${FRONTEND_URL}${VITALS.SUBSCRIPTION.CALLBACK_PATH}`,
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } },
    );
    res.json(response.data);
  } catch (error) {
    console.error("Init error:", error.response?.data || error.message);
    res
      .status(500)
      .json({ error: "Paystack init failed", details: error.response?.data });
  }
});

router.post("/subscribe/verify", async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) return res.status(400).json({ success: false });

    const verifyRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } },
    );
    const data = verifyRes.data.data;
    if (data.status !== "success") return res.json({ success: false, data });

    const email = (
      data.customer?.email ||
      data.metadata?.email ||
      ""
    ).toLowerCase();
    const userIdMeta = data.metadata?.userId || email;

    let user =
      (await User.findByIdCustom(userIdMeta)) ||
      (await User.findByEmail(email));
    if (!user && email) {
      user = await User.createUser({
        userId: userIdMeta,
        email,
        username: email.split("@")[0],
        fullName: data.customer?.first_name || email.split("@")[0],
      });
    }
    if (!user) return res.json({ success: false, message: "User not found" });

    const userIdFinal = user.userId || user.id || email;

    // Prevent double processing
    const existingSub = await Subscription.findOne({ reference });
    if (existingSub) {
      const access = await Subscription.getAccess(userIdFinal);
      return res.json({ success: true, alreadyProcessed: true, access });
    }

    const sub = await Subscription.createSubscription(
      userIdFinal,
      reference,
      user.email,
    );
    const access = await Subscription.getAccess(userIdFinal);

    try {
      await sendReceipt(user.email, reference, sub.expiresAt);
    } catch (e) {
      console.log("mail error", e.message);
    }

    console.log(
      `✅ VERIFY ACTIVATED: ${user.email} - ${reference} - ${VITALS.SUBSCRIPTION.NAME} ₦${VITALS.SUBSCRIPTION.PRICE}`,
    );
    return res.json({
      success: true,
      access,
      user: { email: user.email, userId: userIdFinal },
    });
  } catch (error) {
    console.error("Verify error:", error.response?.data || error.message);
    res.status(500).json({ success: false, error: "Verify failed" });
  }
});

// FIXED: NO MORE fs.readFileSync users.json - THIS WAS BLOCKING 30K
router.get("/access/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase().trim();
    const user =
      (await User.findByEmail(email)) || (await User.findByIdCustom(email));

    if (!user) {
      return res.json({
        hasAccess: false,
        tier: "english_only",
        status: "free",
        daysLeft: 0,
        email,
      });
    }

    const access = User.checkUserAccess(user);
    // Use vitals tier name
    const isFull = access.tier === VITALS.SUBSCRIPTION.TIER_NAME;
    res.json({
      ...access,
      hasAccess: isFull,
      email,
      price: VITALS.SUBSCRIPTION.PRICE,
      plan: VITALS.SUBSCRIPTION.NAME,
    });
  } catch (e) {
    console.log("access err", e.message);
    res.json({
      hasAccess: false,
      tier: "english_only",
      status: "free",
      daysLeft: 0,
    });
  }
});

module.exports = router;

// server/config/vitals.js - SINGLE SOURCE FOR EVERYTHING
const PRICE = 2500;
const DISPLAY = "₦2500";
const DISPLAY_COMMA = "₦2,500";
const DURATION_DAYS = 50;
const PASS_NAME = "JAMB-2Go Pass";

const SUBSCRIPTION = {
  PRICE,
  PRICE_KOBO: PRICE * 100,
  DURATION_DAYS,
  NAME: PASS_NAME,
  TIER_NAME: "full_access",
  FREE_TIER_NAME: "english_only",
  CALLBACK_PATH: "/payment/callback",
  DISPLAY,
  DISPLAY_COMMA,
  LABEL: `${DISPLAY_COMMA}/${DURATION_DAYS}days`,
  LABEL_SHORT: `${DISPLAY_COMMA} Pass`,
};

module.exports = {
  SUBSCRIPTION,
  TRIAL: { DURATION_DAYS: 2 },

  SYSTEM: {
    PORT: parseInt(process.env.PORT) || 5000,
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DB_NAME: "jamb-2go",
    REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
    CORS_ORIGINS: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",")
      : true, // ✅ FIXED: true = allow all, fixes Arena Loading
    CBT_CONFIG_FILE: "cbt_config.json",
    TOPICS_FILE: "topics.json",
    QUESTIONS_FOLDER: "questions",
    DRILL_FOLDER: "drill_questions",
  },

  ADMIN: { PASSWORD: process.env.ADMIN_PASSWORD || "JAMB2GO_2026" },
  PAYSTACK: { SECRET_KEY: process.env.PAYSTACK_SECRET_KEY },

  MESSAGES: {
    CHECKING_PASS: `Checking ${DISPLAY} Pass...`,
    PAY_SUCCESS: `Payment successful! ${DISPLAY} Pass unlocked - Live + CBT + Drill`,
    EXPIRED_CBT: `Your ${DISPLAY} pass expired. Please renew to continue CBT.`,
    CBT_LOCKED_TITLE: "CBT Locked 🔒",
    CBT_LOCKED_DESC: `Unlock ${SUBSCRIPTION.LABEL} ${PASS_NAME} to get Live Rooms + Unlimited CBT + Drill Palace.`,
    DRILL_LOCKED_TITLE: "Drill Palace Locked 🔒",
    DRILL_LOCKED_DESC: `Unlock ${SUBSCRIPTION.LABEL} ${PASS_NAME} to access Drill Palace + CBT + All Live Rooms.`,
    FREE_ZONE_TITLE: `Unlock ${PASS_NAME}`,
    FREE_ZONE_DESC: `You're in Free Zone — only ENGLISH is free. Unlock all 10 subjects + CBT + Drill + Chat for`,
    PAY_BUTTON_SHORT: `Unlock Now — ${SUBSCRIPTION.LABEL}`,
    PASS_BADGE: `${SUBSCRIPTION.LABEL} Pass`,
    CBT_DISABLED: "CBT Mode is disabled by admin",
    ACCESS_DENIED_SUB: `Subscription expired or not found - please pay ${SUBSCRIPTION.LABEL}`,
    TRIAL_ENDED: "Trial Ended — Stay a Jambite!",
  },
};

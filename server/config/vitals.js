// server/config/vitals.js - SINGLE SOURCE - FIXED TIER 1 + TIER 2
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

  // === CBT - SINGLE SOURCE FOR ALL CBT TUNABLES ===
  CBT: {
    DAILY_LIMIT: 2, // <-- change here only, cbt.js picks it up
    DURATION_MINUTES: 120,
    QUESTIONS_PER_SUBJECT: 40,
    ENABLED: true,
    MIN_SECONDS_PER_QUESTION: 8, // anti-cheat: flag if faster than this per Q
    DUPLICATE_WINDOW_MS: 90 * 1000, // ignore same-score save within 90s
    DAY_MS: 24 * 60 * 60 * 1000,
    JAMB_MAX_SCORE: 400,
    SUBJECTS: [
      "english",
      "maths",
      "mathematics",
      "physics",
      "chemistry",
      "biology",
      "commerce",
      "economics",
      "government",
      "accounting",
      "literature",
      "crs",
      "irs",
      "geography",
      "agric",
    ],
    REQUIRED_SUBJECTS_COUNT: 3, // user picks 3 + english = 4 total
    LEADERBOARD_LIMIT: 100,
    STREAK_LIMIT: 10,
    STREAK_FETCH_LIMIT: 5000,
  },

  AUTH: {
    JWT_SECRET: process.env.JWT_SECRET || "jamb2go_secret_change_this",
  },

  SYSTEM: {
    PORT: parseInt(process.env.PORT) || 5000,
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DB_NAME: "jamb-2go",
    REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
    FRONTEND_URL: process.env.FRONTEND_URL || "https://jamb-2-go.vercel.app",
    CORS_ORIGINS: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [
          "http://localhost:5173",
          "http://localhost:3000",
          "https://jamb-2-go.vercel.app",
          "https://www.jamb-2-go.vercel.app",
        ],
    CBT_CONFIG_FILE: "cbt_config.json",
    TOPICS_FILE: "topics.json",
    QUESTIONS_FOLDER: "questions",
    DRILL_FOLDER: "drill_questions",
  },

  ADMIN: {
    PASSWORD: process.env.ADMIN_PASSWORD || "JAMB2GO_2026",
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "JAMB2GO_2026",
  },
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "JAMB2GO_2026",

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
    PAY_BUTTON_FULL: `Unlock ${DISPLAY_COMMA} — 50 Days Full Access`,
    PASS_BADGE: `${SUBSCRIPTION.LABEL} Pass`,
    CBT_DISABLED: "CBT Mode is disabled by admin",
    ACCESS_DENIED_SUB: `Subscription expired or not found - please pay ${SUBSCRIPTION.LABEL}`,
    TRIAL_ENDED: "Trial Ended — Stay a Jambite!",
    DAILY_LIMIT_REACHED: (count, limit) =>
      `Daily limit reached. You have used ${count}/${limit} full CBT attempts today. Try again tomorrow.`,
  },
};

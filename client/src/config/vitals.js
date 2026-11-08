// src/config/vitals.js - SYNCED WITH BACKEND server/config/vitals.js
// RULE: Change numbers in BACKEND first, then copy same numbers here.
// Frontend NEVER enforces limits - backend does. This file is for DISPLAY only.
const PRICE = 2500;
const DISPLAY = "₦2500";
const DISPLAY_COMMA = "₦2,500";
const DAYS = 50;
const PASS_NAME = "JAMB-2Go Pass";

const LABEL = `${DISPLAY_COMMA}/${DAYS}days`;

export const VITALS = {
  SYSTEM: {
    API_BASE: import.meta.env.VITE_API_URL || "http://localhost:5000",
  },
  SUBSCRIPTION: {
    PRICE,
    PRICE_KOBO: PRICE * 100,
    DISPLAY,
    DISPLAY_COMMA,
    DURATION_DAYS: DAYS,
    NAME: PASS_NAME,
    TIER_NAME: "full_access",
    FREE_TIER_NAME: "english_only",
    CALLBACK_PATH: "/payment/callback",
    LABEL,
    LABEL_SHORT: `${DISPLAY_COMMA} Pass`,
  },
  TRIAL: {
    DURATION_DAYS: 2,
  },

  // === CBT - MIRROR OF BACKEND VITALS.CBT ===
  // Keep these numbers identical to server/config/vitals.js
  // Backend is source of truth, this is just so UI doesn't hardcode 40 / 120 everywhere.
  CBT: {
    DAILY_LIMIT: 2,
    DURATION_MINUTES: 120,
    QUESTIONS_PER_SUBJECT: 40,
    ENABLED: true,
    REQUIRED_SUBJECTS_COUNT: 3, // user picks 3 + english = 4
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
  },

  MESSAGES: {
    CHECKING_PASS: `Checking ${DISPLAY} Pass...`,
    PAY_SUCCESS: `Payment successful! ${DISPLAY} Pass unlocked - Live + CBT + Drill`,
    EXPIRED_CBT: `Your ${DISPLAY} pass expired. Please renew to continue CBT.`,
    CBT_LOCKED_TITLE: "CBT Locked 🔒",
    CBT_LOCKED_DESC: `Unlock ${LABEL} ${PASS_NAME} to get Live Rooms + Unlimited CBT + Drill Palace.`,
    DRILL_LOCKED_TITLE: "Drill Palace Locked 🔒",
    DRILL_LOCKED_DESC: `Unlock ${LABEL} ${PASS_NAME} to access Drill Palace + CBT + All Live Rooms.`,
    FREE_ZONE_TITLE: `Unlock ${PASS_NAME}`,
    FREE_ZONE_DESC: `You're in Free Zone — only ENGLISH is free. Unlock all 10 subjects + CBT + Drill + Chat for`,
    PAY_BUTTON_FULL: `Pay ${DISPLAY} with Paystack - Unlock All`,
    PAY_BUTTON_SHORT: `Unlock Now — ${LABEL}`,
    PASS_BADGE: `${LABEL} Pass`,
    CBT_DISABLED: "CBT Mode is disabled by admin",
    ACCESS_DENIED_SUB: `Subscription expired or not found - please pay ${DISPLAY_COMMA} - ${DAYS}days access`,
    TRIAL_ENDED: "Trial Ended — Stay a Jambite!",
    DAILY_LIMIT_REACHED: (count, limit) =>
      `Daily limit reached. You have used ${count}/${limit} full CBT attempts today. Try again tomorrow.`,
  },
};

export const SUBSCRIPTION = VITALS.SUBSCRIPTION;
export const CBT = VITALS.CBT;

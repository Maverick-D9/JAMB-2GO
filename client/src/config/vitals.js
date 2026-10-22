// src/config/vitals.js - FRONTEND SINGLE SOURCE
const PRICE = 2500;
const DISPLAY = "₦2500";
const DISPLAY_COMMA = "₦2,500";
const DAYS = 50;
const PASS_NAME = "JAMB-2Go Pass";

export const VITALS = {
  SYSTEM: {
    API_BASE: import.meta.env.VITE_API_URL || "http://localhost:5000",
  },
  SUBSCRIPTION: {
    PRICE,
    DISPLAY,
    DISPLAY_COMMA,
    DURATION_DAYS: DAYS,
    NAME: PASS_NAME,
    // This is the ONE label that rhymes everywhere
    LABEL: `${DISPLAY_COMMA}/${DAYS}days`,
    LABEL_SHORT: `${DISPLAY_COMMA} Pass`,
  },
  MESSAGES: {
    CHECKING_PASS: `Checking ${DISPLAY} Pass...`,
    PAY_SUCCESS: `Payment successful! ${DISPLAY} Pass unlocked - Live + CBT + Drill`,
    EXPIRED_CBT: `Your ${DISPLAY} pass expired. Please renew to continue CBT.`,
    CBT_LOCKED_TITLE: "CBT Locked 🔒",
    CBT_LOCKED_DESC: `Unlock ${DISPLAY_COMMA}/${DAYS}days ${PASS_NAME} to get Live Rooms + Unlimited CBT + Drill Palace.`,
    DRILL_LOCKED_TITLE: "Drill Palace Locked 🔒",
    DRILL_LOCKED_DESC: `Unlock ${DISPLAY_COMMA}/${DAYS}days ${PASS_NAME} to access Drill Palace + CBT + All Live Rooms.`,
    FREE_ZONE_TITLE: `Unlock ${PASS_NAME}`,
    FREE_ZONE_DESC: `You're in Free Zone — only ENGLISH is free. Unlock all 10 subjects + CBT + Drill + Chat for`,
    PAY_BUTTON_FULL: `Pay ${DISPLAY} with Paystack - Unlock All`,
    PAY_BUTTON_SHORT: `Unlock Now — ${DISPLAY_COMMA}/${DAYS}days`,
    PASS_BADGE: `${DISPLAY_COMMA}/${DAYS}days Pass`,
    CBT_DISABLED: "CBT Mode is disabled by admin",
    ACCESS_DENIED_SUB: `Subscription expired or not found - please pay ${DISPLAY_COMMA} - ${DAYS}days access`,
    TRIAL_ENDED: "Trial Ended — Stay a Jambite!",
  },
};

// For backwards compatibility if you were using VITALS.SUBSCRIPTION.DISPLAY etc
export const SUBSCRIPTION = VITALS.SUBSCRIPTION;

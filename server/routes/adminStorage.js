const express = require("express");
const mongoose = require("mongoose");
const os = require("os");
const router = express.Router();
const VITALS = require("../config/vitals");
const User = require("../models/User");

// === ADMIN AUTH - same password as index.js ===
const ADMIN_PASSWORD =
  VITALS.ADMIN.PASSWORD || VITALS.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
function checkAdmin(req, res, next) {
  const pass =
    req.headers["x-admin-password"] ||
    req.headers["x-admin-password".toLowerCase()] ||
    req.body?.adminPassword ||
    req.query?.adminPassword;
  if (pass !== ADMIN_PASSWORD)
    return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ======== YOUR OLD ROUTES - NOW PROTECTED ========
router.get("/storage", checkAdmin, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const stats = await db.stats();
    const dataMB = (stats.dataSize / 1024 / 1024).toFixed(2);
    const storageMB = (stats.storageSize / 1024 / 1024).toFixed(2);
    const mem = process.memoryUsage();
    res.json({
      mongo: {
        dataMB,
        storageMB,
        dataSize: `${dataMB} MB`,
        percentUsed: ((stats.dataSize / (512 * 1024 * 1024)) * 100).toFixed(1),
        objects: stats.objects,
      },
      server: {
        platform: os.platform(),
        node: process.version,
        uptimeHrs: (os.uptime() / 3600).toFixed(1),
        cpuCount: os.cpus().length,
        loadAvg: os.loadavg()[0].toFixed(2),
        heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(1),
        heapTotalMB: (mem.heapTotal / 1024 / 1024).toFixed(1),
        rssMB: (mem.rss / 1024 / 1024).toFixed(1),
        freeMB: (os.freemem() / 1024 / 1024).toFixed(0),
        totalMB: (os.totalmem() / 1024 / 1024).toFixed(0),
      },
      render: {
        note: "Render free disk is ephemeral & resets on deploy. Only Mongo 512MB is persistent limit.",
        diskLimitMB: 512,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/cleanup-preview", checkAdmin, async (req, res) => {
  const duration = VITALS?.SUBSCRIPTION?.DURATION_DAYS || 50;
  const trial = VITALS?.TRIAL?.DURATION_DAYS || 3;
  const totalDays = duration + trial;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - totalDays);
  const Subscription = mongoose.model("Subscription");
  const total = await Subscription.countDocuments();
  const oldCount = await Subscription.countDocuments({
    updatedAt: { $lt: cutoff },
  });
  res.json({ oldCount, total, cutoff, duration, trial, totalDays });
});

router.delete("/cleanup", checkAdmin, async (req, res) => {
  const duration = VITALS?.SUBSCRIPTION?.DURATION_DAYS || 50;
  const trial = VITALS?.TRIAL?.DURATION_DAYS || 3;
  const totalDays = duration + trial;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - totalDays);
  const Subscription = mongoose.model("Subscription");
  const result = await Subscription.deleteMany({ updatedAt: { $lt: cutoff } });
  res.json({ deleted: result.deletedCount, totalDays });
});

// ======== NEW: TRIAL ADMIN SYSTEM ========

// 1. List / search users + see trial status
router.get("/users", checkAdmin, async (req, res) => {
  try {
    const { search = "", limit = 50 } = req.query;
    const q = {};
    if (search) {
      q.$or = [
        { email: new RegExp(search, "i") },
        { username: new RegExp(search, "i") },
        { fullName: new RegExp(search, "i") },
      ];
    }
    const users = await User.find(q)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();
    const now = new Date();
    const data = users.map((u) => {
      const trialEnds = u.trialEndsAt ? new Date(u.trialEndsAt) : null;
      const subEnds = u.subscriptionExpiresAt
        ? new Date(u.subscriptionExpiresAt)
        : null;
      let statusLabel = u.subscriptionStatus;
      if (u.subscriptionStatus === "trial" && trialEnds && trialEnds < now)
        statusLabel = "trial_expired";
      if (u.subscriptionStatus === "active" && subEnds && subEnds < now)
        statusLabel = "paid_expired";
      return {
        _id: u._id,
        userId: u.userId,
        email: u.email,
        username: u.username,
        fullName: u.fullName,
        subscriptionStatus: u.subscriptionStatus,
        statusLabel,
        trialEndsAt: u.trialEndsAt,
        subscriptionExpiresAt: u.subscriptionExpiresAt,
        createdAt: u.createdAt,
        daysLeftTrial: trialEnds ? Math.ceil((trialEnds - now) / 86400000) : 0,
      };
    });
    res.json({ success: true, count: data.length, users: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. Reset ONE user - by email / username / userId
router.post("/reset-trial", checkAdmin, async (req, res) => {
  try {
    const { identifier, email, username, userId, days = 5 } = req.body;
    const searchVal = (identifier || email || username || userId || "").trim();
    if (!searchVal)
      return res
        .status(400)
        .json({ error: "Provide identifier: email or username" });
    const daysNum = parseInt(days) || 5;
    const newTrialEnds = new Date(Date.now() + daysNum * 24 * 60 * 60 * 1000);
    const user = await User.findOne({
      $or: [
        { email: searchVal.toLowerCase() },
        { username: new RegExp(`^${searchVal}$`, "i") },
        { userId: searchVal },
      ],
    });
    if (!user)
      return res.status(404).json({ error: "User not found: " + searchVal });
    // Don't overwrite active paid user unless you force it
    if (
      user.subscriptionStatus === "active" &&
      user.subscriptionExpiresAt &&
      new Date(user.subscriptionExpiresAt) > new Date() &&
      !req.body.force
    ) {
      return res
        .status(400)
        .json({
          error:
            "User is ACTIVE PAID till " +
            user.subscriptionExpiresAt +
            ". Pass force:true to overwrite.",
        });
    }
    user.subscriptionStatus = "trial";
    user.trialEndsAt = newTrialEnds;
    user.subscriptionExpiresAt = null;
    await user.save();
    res.json({
      success: true,
      message: `${user.username || user.email} reset to ${daysNum} days trial`,
      user: {
        email: user.email,
        username: user.username,
        subscriptionStatus: user.subscriptionStatus,
        trialEndsAt: user.trialEndsAt,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Reset ALL users to X days - THIS IS YOUR CURRENT TASK
router.post("/reset-all-trials", checkAdmin, async (req, res) => {
  try {
    const { days = 5, skipPaid = true } = req.body;
    const daysNum = parseInt(days) || 5;
    const newTrialEnds = new Date(Date.now() + daysNum * 24 * 60 * 60 * 1000);
    const now = new Date();
    // Filter: if skipPaid=true, we NO touch users wey still get active paid sub
    let filter = {};
    if (skipPaid) {
      filter = {
        $nor: [
          { subscriptionStatus: "active", subscriptionExpiresAt: { $gt: now } },
        ],
      };
    }
    const result = await User.updateMany(filter, {
      $set: {
        subscriptionStatus: "trial",
        trialEndsAt: newTrialEnds,
        subscriptionExpiresAt: null,
      },
    });
    res.json({
      success: true,
      message: `Reset ${result.modifiedCount} users to ${daysNum} days trial (ends ${newTrialEnds.toISOString()})`,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
      trialEndsAt: newTrialEnds,
      skippedPaid: skipPaid,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 4. Stats for admin panel
router.get("/trial-stats", checkAdmin, async (req, res) => {
  const now = new Date();
  const total = await User.countDocuments();
  const activePaid = await User.countDocuments({
    subscriptionStatus: "active",
    subscriptionExpiresAt: { $gt: now },
  });
  const activeTrial = await User.countDocuments({
    subscriptionStatus: "trial",
    trialEndsAt: { $gt: now },
  });
  const expiredTrial = await User.countDocuments({
    subscriptionStatus: "trial",
    trialEndsAt: { $lte: now },
  });
  res.json({ success: true, total, activePaid, activeTrial, expiredTrial });
});

module.exports = router;

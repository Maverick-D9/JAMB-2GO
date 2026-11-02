const express = require("express");
const mongoose = require("mongoose");
const os = require("os");
const router = express.Router();

// Replace with your vitals import
const VITALS = require("../config/vitals");
// or if vitals is in client, copy values:
// const DURATION = 50, TRIAL = 2

router.get("/storage", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const stats = await db.stats();

    // --- MONGO (persistent) ---
    const dataMB = (stats.dataSize / 1024 / 1024).toFixed(2);
    const storageMB = (stats.storageSize / 1024 / 1024).toFixed(2);

    // --- SERVER (Render / Node) ---
    const mem = process.memoryUsage();
    const sysMem = {
      freeMB: (os.freemem() / 1024 / 1024).toFixed(0),
      totalMB: (os.totalmem() / 1024 / 1024).toFixed(0),
      usedPercent: (
        ((os.totalmem() - os.freemem()) / os.totalmem) *
        100
      ).toFixed(1),
    };

    const server = {
      platform: os.platform(),
      node: process.version,
      uptimeHrs: (os.uptime() / 3600).toFixed(1),
      cpuCount: os.cpus().length,
      loadAvg: os.loadavg()[0].toFixed(2),
      heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(1),
      heapTotalMB: (mem.heapTotal / 1024 / 1024).toFixed(1),
      rssMB: (mem.rss / 1024 / 1024).toFixed(1),
      ...sysMem,
    };

    // --- RENDER DISK (ephemeral, 512MB warning) ---
    // Render free tier has ~512MB disk that resets on deploy
    // We can't get exact disk on all hosts, but we show what we can

    res.json({
      mongo: {
        dataMB,
        storageMB,
        dataSize: `${dataMB} MB`,
        percentUsed: ((stats.dataSize / (512 * 1024 * 1024)) * 100).toFixed(1),
        objects: stats.objects,
      },
      server,
      render: {
        note: "Render free disk is ephemeral & resets on deploy. Only Mongo 512MB is persistent limit.",
        diskLimitMB: 512,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Your existing cleanup routes (keep them, using VITALS) ---
router.get("/cleanup-preview", async (req, res) => {
  const duration = VITALS?.SUBSCRIPTION?.DURATION_DAYS || 50;
  const trial = VITALS?.TRIAL?.DURATION_DAYS || 2;
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

router.delete("/cleanup", async (req, res) => {
  const duration = VITALS?.SUBSCRIPTION?.DURATION_DAYS || 50;
  const trial = VITALS?.TRIAL?.DURATION_DAYS || 2;
  const totalDays = duration + trial;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - totalDays);

  const Subscription = mongoose.model("Subscription");
  const result = await Subscription.deleteMany({ updatedAt: { $lt: cutoff } });

  res.json({ deleted: result.deletedCount, totalDays });
});

module.exports = router;

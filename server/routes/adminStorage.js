const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const VITALS = require("../config/vitals");

// CORRECT PATH - from routes/ to utils/
const arenaRedisModule = require("../utils/arenaRedis");

// Handle different export styles
const redisClient =
  arenaRedisModule.redis ||
  arenaRedisModule.client ||
  arenaRedisModule.redisClient ||
  arenaRedisModule.default ||
  arenaRedisModule;

router.get("/storage", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const mongoStats = await db.stats();
    const collections = await db.listCollections().toArray();

    let redisInfo = { used_memory_human: "N/A" };
    try {
      if (redisClient && redisClient.info) {
        const info = await redisClient.info("memory");
        const line = info
          .split("\r\n")
          .find((l) => l.startsWith("used_memory_human"));
        redisInfo.used_memory_human = line ? line.split(":")[1] : "Connected";
      }
    } catch (e) {
      redisInfo.used_memory_human = "Error: " + e.message;
    }

    res.json({
      mongo: {
        dataSize: `${(mongoStats.dataSize / 1024 / 1024).toFixed(2)} MB`,
        storageSize: `${(mongoStats.storageSize / 1024 / 1024).toFixed(2)} MB`,
        collections: collections.length,
        objects: mongoStats.objects,
        percentUsed: (
          (mongoStats.storageSize / (512 * 1024 * 1024)) *
          100
        ).toFixed(1),
      },
      redis: redisInfo,
      server: {
        heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
        uptime: `${(process.uptime() / 3600).toFixed(2)} hours`,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/cleanup-preview", async (req, res) => {
  try {
    const DURATION = VITALS.SUBSCRIPTION.DURATION_DAYS; // 50
    const TRIAL = VITALS.TRIAL.DURATION_DAYS; // 2
    const TOTAL_DAYS = DURATION + TRIAL; // 52

    const cutoff = new Date(Date.now() - TOTAL_DAYS * 24 * 60 * 60 * 1000);
    const Subscription = mongoose.model("Subscription");
    
    const oldCount = await Subscription.countDocuments({ expiresAt: { $lt: cutoff } });
    const total = await Subscription.countDocuments();
    res.json({ oldCount, total, cutoff, totalDays: TOTAL_DAYS, duration: DURATION, trial: TRIAL });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/cleanup", async (req, res) => {
  try {
    const DURATION = VITALS.SUBSCRIPTION.DURATION_DAYS;
    const TRIAL = VITALS.TRIAL.DURATION_DAYS;
    const TOTAL_DAYS = DURATION + TRIAL;

    const cutoff = new Date(Date.now() - TOTAL_DAYS * 24 * 60 * 60 * 1000);
    const Subscription = mongoose.model("Subscription");
    
    const result = await Subscription.deleteMany({ expiresAt: { $lt: cutoff } });
    res.json({ deleted: result.deletedCount, totalDays: TOTAL_DAYS, cutoff });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router; 

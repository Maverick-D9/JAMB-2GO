const express = require("express");
const router = express.Router();
const Announcement = require("./announcement.model");
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "JAMB2GO_2026";
const checkAdmin = (req, res, next) => {
  if (req.headers["x-admin-password"] !== ADMIN_PASS)
    return res.status(401).json({ error: "Wrong admin password" });
  next();
};

router.get("/active", async (req, res) => {
  try {
    const one = await Announcement.findOne({ isActive: true })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, announcement: one || null });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});
router.get("/all", checkAdmin, async (req, res) => {
  try {
    const all = await Announcement.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, announcements: all });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});
router.post("/", checkAdmin, async (req, res) => {
  try {
    const { title, message, linkLabel, linkUrl, type } = req.body;
    if (!title || !message)
      return res.status(400).json({ error: "Title + Message needed" });
    await Announcement.updateMany({ isActive: true }, { isActive: false });
    const created = await Announcement.create({
      title,
      message,
      linkLabel: linkLabel || "",
      linkUrl: linkUrl || "",
      type: type || "info",
      isActive: true,
    });
    res.json({ success: true, announcement: created });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});
router.put("/:id", checkAdmin, async (req, res) => {
  try {
    const { title, message, linkLabel, linkUrl, type, isActive } = req.body;
    if (isActive === true)
      await Announcement.updateMany(
        { _id: { $ne: req.params.id } },
        { isActive: false },
      );
    const updated = await Announcement.findByIdAndUpdate(
      req.params.id,
      { title, message, linkLabel, linkUrl, type, isActive },
      { new: true },
    );
    res.json({ success: true, announcement: updated });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});
router.delete("/:id", checkAdmin, async (req, res) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});
module.exports = router;

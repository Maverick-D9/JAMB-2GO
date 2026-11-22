const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const UnifiedQuestion = require("./unifiedQuestion.model");
const router = express.Router();
const upload = multer({ dest: "uploads/" });

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET,
});

// 1. Upload diagram file -> Cloudinary
router.post("/upload-diagram", upload.single("image"), async (req, res) => {
  try {
    const r = await cloudinary.uploader.upload(req.file.path);
    res.json({ success: true, url: r.secure_url });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// 2. Single create
router.post("/", async (req, res) => {
  try {
    const q = await UnifiedQuestion.create(req.body);
    res.json({ success: true, question: q });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 3. Bulk create - array from Excel
router.post("/bulk", async (req, res) => {
  try {
    const { questions } = req.body;
    const created = await UnifiedQuestion.insertMany(questions);
    res.json({ success: true, count: created.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 4. List for admin + for exam picker
// IMPORTANT: /list MUST come before /:id, else Express go think "list" na ID
router.get("/list", async (req, res) => {
  try {
    const { subject } = req.query;
    const q = await UnifiedQuestion.find(
      subject && subject !== "all" ? { subject } : {},
    )
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();
    res.json({ success: true, questions: q });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const { subject } = req.query;
    const q = await UnifiedQuestion.find(subject ? { subject } : {})
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    res.json({ success: true, questions: q });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 5. UPDATE ONE - for Edit button in Manage Vault
router.put("/:id", async (req, res) => {
  try {
    const updated = await UnifiedQuestion.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    );
    if (!updated)
      return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, question: updated });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 6. DELETE ONE - for Delete button in Manage Vault
router.delete("/:id", async (req, res) => {
  try {
    await UnifiedQuestion.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;

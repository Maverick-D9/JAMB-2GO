const express = require("express");
const multer = require("multer");
const cloudinary = require("./cloudinary");
const UnifiedQuestion = require("./unifiedQuestion.model");
const router = express.Router();

// Use memory, not disk - Render no keep disk files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// 1. Upload diagram file -> Cloudinary
router.post("/upload-diagram", upload.single("diagram"), async (req, res) => {
  try {
    if (!req.file)
      return res
        .status(400)
        .json({ success: false, error: "No image selected" });

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "jamb2go/unified-diagrams",
          resource_type: "image",
          transformation: [{ width: 800, crop: "limit", quality: "auto" }],
        },
        (err, result) => (err ? reject(err) : resolve(result)),
      );
      stream.end(req.file.buffer);
    });

    res.json({
      success: true,
      diagramUrl: result.secure_url,
      diagramPublicId: result.public_id,
      url: result.secure_url,
    });
  } catch (e) {
    console.log("Cloudinary upload error:", e);
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

// 5. UPDATE ONE
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

// 6. DELETE ONE
router.delete("/:id", async (req, res) => {
  try {
    await UnifiedQuestion.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;

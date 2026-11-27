const mongoose = require("mongoose");

const AnnouncementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  linkLabel: { type: String, default: "", trim: true }, // e.g. "Join WhatsApp Group"
  linkUrl: { type: String, default: "", trim: true }, // e.g. "https://chat.whatsapp.com/..."
  type: { type: String, enum: ["info", "warning", "urgent"], default: "info" },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Announcement", AnnouncementSchema);

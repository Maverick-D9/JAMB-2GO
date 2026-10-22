const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Otp = require("../models/Otp");
const { sendOtp } = require("../utils/mailer");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "jamb2go_secret_change_this";
const GOOGLE_CLIENT_ID =
  "882391897710-2lluqbkg9f4f2smnbof64qvr33kot2kl.apps.googleusercontent.com";

global.pendingUsers = global.pendingUsers || new Map();
global.resetTokens = global.resetTokens || new Map();

function genCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
function genTrial() {
  return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
}

router.post("/request-otp", async (req, res) => {
  try {
    const { email, username, fullName, password, subject } = req.body;
    if (!email || !password || !username)
      return res.status(400).json({ error: "All fields required" });

    const cleanEmail = email.toLowerCase().trim();
    const cleanUsername = username.toLowerCase().trim();

    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail)
      return res
        .status(409)
        .json({ error: "Email already registered. Please login." });

    const existingUser = await User.findOne({
      username: new RegExp(`^${cleanUsername}$`, "i"),
    });
    if (existingUser)
      return res.status(409).json({ error: "Username already taken" });

    const code = genCode();

    // Clean old OTPs
    try {
      await Otp.deleteMany({ email: cleanEmail });
    } catch {}

    try {
      await Otp.create({
        email: cleanEmail,
        code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
    } catch {
      try {
        Otp.create && Otp.create(cleanEmail, code);
      } catch {}
    }

    // Hash and save pending BEFORE email - so session exists even if email fails
    const hashed = await bcrypt.hash(password, 10);
    global.pendingUsers.set(cleanEmail, {
      fullName,
      username: cleanUsername,
      email: cleanEmail,
      password: hashed,
      subject: subject || "english-room",
      trialEndsAt: genTrial(),
    });

    // Send email - this will NOT throw now (fixed mailer.js)
    const mailResult = await sendOtp(cleanEmail, code);

    res.json({
      success: true,
      message: mailResult.devMode
        ? "OTP generated (check server terminal if email not received)"
        : "OTP sent to " + email,
      // devOtp allows signup to work even when Gmail is blocked
      devOtp: mailResult.devMode ? code : undefined,
    });
  } catch (e) {
    console.error("request-otp error:", e);
    // If we already saved pending user, don't block - return success
    const cleanEmail = (req.body.email || "").toLowerCase().trim();
    if (global.pendingUsers.has(cleanEmail)) {
      const code = global.pendingUsers.get(cleanEmail)?.code || null;
      return res.json({
        success: true,
        message: "OTP generated - check server logs",
        devOtp: code,
      });
    }
    res.status(500).json({ error: "Failed to send OTP: " + e.message });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { email, code } = req.body;
    const cleanEmail = (email || "").toLowerCase().trim();
    let check = { ok: false };
    try {
      const otpDoc = await Otp.findOne({ email: cleanEmail });
      if (
        otpDoc &&
        otpDoc.code === code &&
        new Date(otpDoc.expiresAt) > new Date()
      )
        check.ok = true;
      else if (otpDoc) check.error = "Invalid or expired code";
      else check.error = "No OTP found";
    } catch {
      check = Otp.verify(email, code);
    }
    if (!check.ok)
      return res.status(400).json({ error: check.error || "Invalid code" });
    const pending = global.pendingUsers.get(cleanEmail);
    if (!pending)
      return res
        .status(400)
        .json({ error: "Signup session expired. Signup again." });
    const user = await User.createUser({
      fullName: pending.fullName,
      username: pending.username,
      email: pending.email,
      password: pending.password,
      subject: pending.subject,
      trialEndsAt: pending.trialEndsAt,
    });
    global.pendingUsers.delete(cleanEmail);
    try {
      await Otp.deleteOne({ email: cleanEmail });
    } catch {}
    const token = jwt.sign(
      { email: user.email, username: user.username, userId: user.userId },
      JWT_SECRET,
      { expiresIn: "30d" },
    );
    res.json({
      success: true,
      token,
      user: {
        username: user.username,
        email: user.email,
        subject: user.subject,
        fullName: user.fullName,
        userId: user.userId,
      },
    });
  } catch (e) {
    console.error("verify-otp error:", e);
    res.status(500).json({ error: "Verification failed: " + e.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    if (!emailOrUsername || !password)
      return res.status(400).json({ error: "Email and password required" });
    const clean = emailOrUsername.toLowerCase().trim();
    const user = await User.findOne({
      $or: [
        { email: clean },
        { username: new RegExp(`^${emailOrUsername}$`, "i") },
        { userId: emailOrUsername },
      ],
    });
    if (!user)
      return res.status(401).json({ error: "Invalid email or password." });
    if (!user.password) {
      return res.status(401).json({
        error:
          "This account uses Google login. Use Continue with Google or Reset Password to set a password.",
      });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok)
      return res.status(401).json({ error: "Invalid email or password." });
    const token = jwt.sign(
      { email: user.email, username: user.username, userId: user.userId },
      JWT_SECRET,
      { expiresIn: "30d" },
    );
    res.json({
      success: true,
      token,
      user: {
        username: user.username,
        email: user.email,
        subject: user.subject,
        fullName: user.fullName,
        userId: user.userId,
      },
    });
  } catch (e) {
    console.error("login error:", e.message);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/google", async (req, res) => {
  try {
    const { id_token } = req.body;
    if (!id_token) return res.status(400).json({ error: "No Google token" });
    const payload = JSON.parse(
      Buffer.from(id_token.split(".")[1], "base64").toString(),
    );
    if (payload.aud !== GOOGLE_CLIENT_ID)
      return res.status(400).json({ error: "Invalid Google Client ID" });
    if (!payload.email_verified)
      return res.status(400).json({ error: "Google email not verified" });
    const email = payload.email.toLowerCase();
    let user = await User.findOne({ email });
    if (!user) {
      let baseUsername = payload.email
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      let username = baseUsername;
      let i = 1;
      while (await User.findOne({ username }))
        username = `${baseUsername}${i++}`;
      user = await User.createUser({
        fullName: payload.name || payload.given_name || baseUsername,
        username: username,
        email: email,
        password: await bcrypt.hash(
          Math.random().toString(36).slice(-12) + "Goog!",
          10,
        ),
        subject: "english-room",
        isGoogle: true,
        picture: payload.picture,
        trialEndsAt: genTrial(),
      });
    }
    const token = jwt.sign(
      { email: user.email, username: user.username, userId: user.userId },
      JWT_SECRET,
      { expiresIn: "30d" },
    );
    res.json({
      success: true,
      token,
      user: {
        username: user.username,
        email: user.email,
        subject: user.subject,
        fullName: user.fullName,
        name: user.fullName,
        userId: user.userId,
        picture: user.picture || payload.picture,
      },
    });
  } catch (e) {
    console.error("Google auth error:", e.message);
    res.status(500).json({ error: "Google authentication failed" });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });
    if (!user)
      return res.status(404).json({ error: "No account with this email" });
    const code = genCode();
    try {
      await Otp.deleteMany({ email: cleanEmail });
      await Otp.create({
        email: cleanEmail,
        code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
    } catch (e) {
      console.log("OTP mongo error fallback", e.message);
    }
    const result = await sendOtp(cleanEmail, code, "reset");
    global.resetTokens.set(cleanEmail, {
      code,
      expires: Date.now() + 10 * 60 * 1000,
    });
    res.json({
      success: true,
      message: "Reset code sent to " + cleanEmail,
      devOtp: result.devMode ? code : undefined,
    });
  } catch (e) {
    console.error("forgot-password error:", e);
    res.status(500).json({ error: "Failed to send reset email: " + e.message });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword)
      return res.status(400).json({ error: "All fields required" });
    if (newPassword.length < 6)
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    const cleanEmail = email.toLowerCase().trim();
    let valid = false;
    try {
      const otpDoc = await Otp.findOne({ email: cleanEmail });
      if (
        otpDoc &&
        otpDoc.code === code &&
        new Date(otpDoc.expiresAt) > new Date()
      )
        valid = true;
    } catch {}
    const mem = global.resetTokens.get(cleanEmail);
    if (mem && mem.code === code && mem.expires > Date.now()) valid = true;
    if (!valid)
      return res.status(400).json({ error: "Invalid or expired code" });
    const user = await User.findOne({ email: cleanEmail });
    if (!user) return res.status(404).json({ error: "User not found" });
    const hashed = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ _id: user._id }, { password: hashed });
    try {
      await Otp.deleteMany({ email: cleanEmail });
    } catch {}
    global.resetTokens.delete(cleanEmail);
    res.json({
      success: true,
      message: "Password reset successful. You can now login.",
    });
  } catch (e) {
    console.error("reset-password error:", e);
    res.status(500).json({ error: "Reset failed: " + e.message });
  }
});

module.exports = router;

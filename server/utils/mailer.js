const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS?.replace(/\s/g, ""); // remove spaces from app password

  if (!user || !pass) {
    console.log("⚠️ EMAIL_USER / EMAIL_PASS missing - DEV OTP mode");
    return null;
  }

  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user, pass },
    family: 4,
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000,
    // REMOVED: tls: { ciphers: "SSLv3" } <- This was killing you
    tls: {
      ciphers: "TLSv1.2",
    },
  });

  transporter.verify((err) => {
    if (err) console.log("[MAIL CONFIG FAIL]", err.message);
    else console.log("[MAIL READY] Gmail ready:", user);
  });

  return transporter;
}

async function sendOtp(email, code, type = "verify") {
  const isReset = type === "reset";
  let tx = getTransporter();

  if (!tx) {
    console.log(`\n========== DEV OTP [${type.toUpperCase()}] ==========`);
    console.log(`To: ${email} | CODE: ${code}`);
    console.log(`=====================================\n`);
    return { success: true, devMode: true, code };
  }

  try {
    await tx.sendMail({
      from: `"JAMB CBT" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: isReset
        ? "Reset Your JAMB CBT Password - Verification Code"
        : "Your JAMB CBT Verification Code",
      html: `
      <div style="font-family:Inter,sans-serif;background:#0F172A;padding:24px">
        <div style="max-width:420px;margin:auto;background:#1E293B;padding:28px;border-radius:16px;border:1px solid #334155">
          <h2 style="color:white;margin:16px 0 8px">${isReset ? "Reset your password" : "Verify your email"}</h2>
          <p style="color:#94a3b8;font-size:13px">Use this code:</p>
          <div style="font-size:32px;font-weight:800;letter-spacing:10px;color:#38BDF8;text-align:center;margin:20px 0;background:#0F172A;padding:16px;border-radius:12px">${code}</div>
          <p style="color:#64748b;font-size:11px">Expires in 10 minutes.</p>
        </div>
      </div>
    `,
    });
    console.log(`[OTP SENT] ${email} -> ${code}`);
    return { success: true };
  } catch (e) {
    console.error(`[MAIL FAIL] ${email} -> ${code}:`, e.message);
    // Kill broken transporter so next email creates fresh one
    transporter = null;

    console.log(`\n========== FALLBACK DEV OTP ==========`);
    console.log(`To: ${email} | CODE: ${code}`);
    console.log(`=====================================\n`);
    return { success: true, devMode: true, code, error: e.message };
  }
}

async function sendReceipt(email, reference, expiresAt) {
  const tx = getTransporter();
  if (!tx) {
    console.log(`[DEV RECEIPT] ${email} - ${reference}`);
    return { success: true, devMode: true };
  }
  const expiryDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString("en-NG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "30 days from now";

  try {
    await tx.sendMail({
      from: `"JAMB CBT" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Payment Confirmed - JAMB CBT Full Access",
      html: `<div style="font-family:sans-serif;padding:24px"><h2>Payment Successful!</h2><p>Ref: ${reference}<br>Amount: ₦2,500<br>Expires: ${expiryDate}</p></div>`,
    });
    return { success: true };
  } catch (e) {
    console.error(`[RECEIPT FAIL] ${email}:`, e.message);
    transporter = null;
    return { success: true, devMode: true, error: e.message };
  }
}

module.exports = { sendOtp, sendReceipt };

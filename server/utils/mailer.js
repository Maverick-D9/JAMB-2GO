const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.log(
      "⚠️ EMAIL_USER / EMAIL_PASS missing in .env - using DEV OTP mode",
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587, // FIXED: was 465 (blocked by ISP + causes ENETUNREACH)
    secure: false, // must be false for 587
    auth: { user, pass },
    family: 4, // FIXED: Force IPv4 - this kills ENETUNREACH error
    tls: { ciphers: "SSLv3" },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  return transporter;
}

async function sendOtp(email, code, type = "verify") {
  const isReset = type === "reset";
  const tx = getTransporter();

  // No email config? Log OTP and return success so signup never blocks
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
          <div style="width:40px;height:40px;background:#38BDF8;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#0F172A">J</div>
          <h2 style="color:white;margin:16px 0 8px">${isReset ? "Reset your password" : "Verify your email"}</h2>
          <p style="color:#94a3b8;font-size:13px">${isReset ? "Use this code to reset your password:" : "Use this code to create your account:"}</p>
          <div style="font-size:32px;font-weight:800;letter-spacing:10px;color:#38BDF8;text-align:center;margin:20px 0;background:#0F172A;padding:16px;border-radius:12px">${code}</div>
          <p style="color:#64748b;font-size:11px">Expires in 10 minutes. If you didn't request this, ignore.</p>
          <p style="color:#475569;font-size:10px;margin-top:20px;border-top:1px solid #1e293b;padding-top:12px">🔒 Secure 256-bit SSL Encrypted</p>
        </div>
      </div>
    `,
    });
    console.log(`[OTP SENT] ${email} -> ${code}`);
    return { success: true };
  } catch (e) {
    console.error(`[MAIL FAIL] ${email} -> ${code}:`, e.message);
    console.log(`\n========== FALLBACK DEV OTP ==========`);
    console.log(`To: ${email} | CODE: ${code}`);
    console.log(`=====================================\n`);
    // CRITICAL: Don't throw - return devMode so auth.js doesn't return 500
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
      subject: "Payment Confirmed - JAMB CBT Full Access Activated",
      html: `
      <div style="font-family:Inter,sans-serif;background:#0F172A;padding:24px">
        <div style="max-width:480px;margin:auto;background:#1E293B;padding:28px;border-radius:16px;border:1px solid #334155">
          <div style="width:40px;height:40px;background:#22c55e;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#0F172A">✓</div>
          <h2 style="color:white;margin:16px 0 8px">Payment Successful!</h2>
          <p style="color:#94a3b8;font-size:13px;line-height:1.6">Your full access to JAMB CBT has been activated. You now have access to all subjects.</p>
          <div style="background:#0F172A;padding:16px;border-radius:12px;margin:20px 0;border:1px solid #1e293b">
            <p style="color:#64748b;font-size:11px;margin:0 0 4px">REFERENCE</p>
            <p style="color:white;font-size:13px;font-family:monospace;margin:0 0 12px">${reference}</p>
            <p style="color:#64748b;font-size:11px;margin:0 0 4px">AMOUNT</p>
            <p style="color:white;font-size:13px;margin:0 0 12px">₦2,000</p>
            <p style="color:#64748b;font-size:11px;margin:0 0 4px">EXPIRES</p>
            <p style="color:#38BDF8;font-size:13px;margin:0">${expiryDate}</p>
          </div>
          <p style="color:#475569;font-size:11px;margin-top:20px;border-top:1px solid #1e293b;padding-top:12px">Need help? Reply to this email.<br/>🔒 Secure 256-bit SSL Encrypted</p>
        </div>
      </div>
    `,
    });
    return { success: true };
  } catch (e) {
    console.error(`[RECEIPT FAIL] ${email}:`, e.message);
    // Receipt failure should never block payment - log and continue
    return { success: true, devMode: true, error: e.message };
  }
}

module.exports = { sendOtp, sendReceipt };

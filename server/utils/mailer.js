const nodemailer = require("nodemailer");

function getTransporter(port = 587) {
  const user = (process.env.EMAIL_USER || "").trim();
  const pass = (process.env.EMAIL_PASS || "").replace(/\s/g, "").trim();

  if (!user || !pass) {
    console.log("⚠️ EMAIL_USER / EMAIL_PASS missing - DEV OTP mode");
    return null;
  }

  const is465 = port === 465;

  return nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: port,
    secure: is465, // true for 465, false for others
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    pool: false,
    connectionTimeout: 8000,
    socketTimeout: 10000,
    greetingTimeout: 8000,
  });
}

async function sendOtp(email, code, type = "verify") {
  const isReset = type === "reset";
  const ports = [587, 465, 2525];

  const firstTx = getTransporter(ports[0]);
  if (!firstTx) {
    console.log(`\n========== DEV OTP [${type.toUpperCase()}] ==========`);
    console.log(`To: ${email} | CODE: ${code}`);
    console.log(`=====================================\n`);
    return { success: true, devMode: true, code };
  }

  let lastError = null;

  for (const port of ports) {
    try {
      console.log(`[MAIL TRY] Port ${port} -> ${email}`);
      const tx = getTransporter(port);

      const info = await tx.sendMail({
        from: `"JAMB CBT" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: isReset
          ? "🔐 Password Reset Request - JAMB CBT"
          : "Your JAMB CBT Verification Code",
        html: isReset
          ? `
      <div style="font-family:Inter,sans-serif;background:#0F172A;padding:24px">
        <div style="max-width:460px;margin:auto;background:#1E293B;padding:28px;border-radius:16px;border:1px solid #334155">
          <h2 style="color:white;margin:0 0 8px">Reset your password</h2>
          <p style="color:#94a3b8;font-size:14px;margin:0">A password reset was requested for <b style="color:white">${email}</b></p>
          <div style="font-size:32px;font-weight:800;letter-spacing:10px;color:#38BDF8;text-align:center;margin:20px 0;background:#0F172A;padding:16px;border-radius:12px">${code}</div>
          <p style="color:#64748b;font-size:11px;text-align:center">Expires in 10 minutes. Don't share this code.</p>
          <div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:10px;padding:14px;margin-top:20px">
            <p style="color:#92400E;font-size:13px;font-weight:700;margin:0 0 6px">⚠️ Did you request this?</p>
            <p style="color:#92400E;font-size:12px;margin:0;line-height:1.5">
              If YES: Use code above to reset.<br/>
              If NO: Someone entered your email. Ignore this email — your password is still safe. Don't share code with anyone. JAMB CBT team will NEVER ask for this code. If you keep getting this, secure your email and change your JAMB password.
            </p>
          </div>
        </div>
      </div>`
          : `
      <div style="font-family:Inter,sans-serif;background:#0F172A;padding:24px">
        <div style="max-width:420px;margin:auto;background:#1E293B;padding:28px;border-radius:16px;border:1px solid #334155">
          <h2 style="color:white;margin:16px 0 8px">Verify your email</h2>
          <p style="color:#94a3b8;font-size:14px">Welcome to JAMB CBT!</p>
          <div style="font-size:32px;font-weight:800;letter-spacing:10px;color:#38BDF8;text-align:center;margin:20px 0;background:#0F172A;padding:16px;border-radius:12px">${code}</div>
          <p style="color:#64748b;font-size:11px">Expires in 10 minutes.</p>
        </div>
      </div>`,
      });

      console.log(
        `[OTP SENT via ${port}] ${email} -> ${code} | ${info.messageId}`,
      );
      return { success: true, port };
    } catch (e) {
      lastError = e;
      console.error(`[MAIL FAIL Port ${port}] ${email}:`, e.message);
      continue;
    }
  }

  console.log(
    `\n========== ALL PORTS FAILED - FALLBACK DEV OTP [${type.toUpperCase()}] ==========`,
  );
  console.log(
    `To: ${email} | CODE: ${code} | Last Error: ${lastError?.message}`,
  );
  console.log(
    `================================================================\n`,
  );
  return { success: true, devMode: true, code, error: lastError?.message };
}

async function sendReceipt(email, reference, expiresAt) {
  const expiryDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString("en-NG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "30 days";

  const ports = [587, 465];

  for (const port of ports) {
    try {
      const tx = getTransporter(port);
      if (!tx) return { success: true, devMode: true };
      await tx.sendMail({
        from: `"JAMB CBT" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Payment Confirmed - JAMB CBT Full Access",
        html: `<div style="font-family:sans-serif;padding:24px"><h2>Payment Successful!</h2><p>Ref: ${reference}<br>Amount: ₦2,500<br>Expires: ${expiryDate}</p></div>`,
      });
      console.log(`[RECEIPT SENT via ${port}] ${email}`);
      return { success: true, port };
    } catch (e) {
      console.error(`[RECEIPT FAIL Port ${port}] ${email}:`, e.message);
    }
  }
  return { success: false, error: "All ports failed" };
}

module.exports = { sendOtp, sendReceipt };

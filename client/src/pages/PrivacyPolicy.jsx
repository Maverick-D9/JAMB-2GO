import React from "react";

const PrivacyPolicy = () => {
  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };

  const h2 = { color: "#fff", marginTop: "28px" };
  const h3 = { color: "#fff", marginBottom: "4px" };
  const muted = { color: "#94a3b8" };
  const link = { color: "#38bdf8" };

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "40px auto",
        padding: "24px",
        lineHeight: "1.7",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        color: "#e2e8f0",
        background: "transparent",
      }}
    >
      <button
        onClick={goBack}
        style={{
          background: "#0F172A",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.15)",
          padding: "10px 18px",
          borderRadius: "100px",
          fontWeight: "800",
          fontSize: "13px",
          cursor: "pointer",
          marginBottom: "20px",
        }}
      >
        ← Go Back
      </button>
      <h1
        style={{
          fontSize: "30px",
          lineHeight: "1.2",
          marginBottom: "8px",
          color: "#fff",
        }}
      >
        Privacy Policy for JAMB-2-GO
      </h1>
      <p style={muted}>
        <strong>Last Updated:</strong> November 12, 2026
      </p>

      <p>
        JAMB-2-GO is a JAMB preparation and quiz arena app. This Privacy Policy
        explains what information we collect, how we use it, and the choices you
        have. By using JAMB-2-GO, you agree to the practices described here.
      </p>
      <p>
        JAMB-2-GO is an independent study tool. It is not affiliated with,
        endorsed by, or operated by the Joint Admissions and Matriculation Board
        (JAMB).
      </p>

      <h2 style={h2}>1. Information We Collect</h2>
      <p>We only collect information needed to run the app:</p>
      <h3 style={h3}>a) Information you provide</h3>
      <ul>
        <li>
          <strong>Google Sign-In:</strong> your name, email address, and profile
          picture, as provided by Google when you choose to sign in with Google.
        </li>
        <li>
          <strong>Username:</strong> the display name you choose inside the app.
          Other players can see your username, room, score, and streak in the
          arena / lobby.
        </li>
      </ul>

      <h3 style={h3}>b) Gameplay information</h3>
      <ul>
        <li>Room you join, questions answered, score, and streak.</li>
        <li>Timer / game status, for example whether a room is locked.</li>
        <li>
          This information is used to show the leaderboard, run the arena, and
          keep the game fair.
        </li>
      </ul>

      <h3 style={h3}>c) Technical information</h3>
      <ul>
        <li>
          Basic technical logs from our hosting provider, such as device /
          browser type, approximate location from IP address, and pages visited.
          We do not collect your precise GPS location.
        </li>
        <li>
          Preferences stored in your browser, such as your chosen username,
          where needed to keep you signed in.
        </li>
      </ul>

      <h2 style={h2}>2. Information We Do NOT Collect</h2>
      <ul>
        <li>We do not collect your Google password.</li>
        <li>
          We do not collect your precise location, contacts, photos, or files.
        </li>
        <li>We do not collect payment or bank card information.</li>
        <li>
          We do not collect your JAMB registration number, NIN, or exam results,
          unless you voluntarily type it in a chat / username field - please do
          not do so.
        </li>
      </ul>

      <h2 style={h2}>3. How We Use Your Information</h2>
      <ul>
        <li>To create and manage your account and keep you signed in.</li>
        <li>
          To provide JAMB preparation services, rooms, quizzes, and the arena.
        </li>
        <li>
          To show your username, score, and streak to other players in the same
          room.
        </li>
        <li>
          To fix bugs, prevent cheating / abuse, and improve the platform.
        </li>
        <li>To respond to your questions or data requests.</li>
      </ul>
      <p>
        We do not use your personal information to show you personalized
        third-party ads.
      </p>

      <h2 style={h2}>4. Data Sharing and Third-Party Services</h2>
      <p>
        We do not sell your personal data. We do not share it for third-party
        marketing. We only share what is needed to run the app:
      </p>
      <ul>
        <li>
          <strong>Google Sign-In:</strong> to authenticate you. Google processes
          your data under its own policy:{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noreferrer"
            style={link}
          >
            policies.google.com/privacy
          </a>
        </li>
        <li>
          <strong>Vercel (hosting):</strong> hosts this website and may process
          basic technical logs to deliver and secure the site:{" "}
          <a
            href="https://vercel.com/legal/privacy-policy"
            target="_blank"
            rel="noreferrer"
            style={link}
          >
            vercel.com/legal/privacy-policy
          </a>
        </li>
        <li>
          <strong>Other players:</strong> your username, room, score, and streak
          are visible inside the arena to other players in that room. Your email
          address is never shown to other players.
        </li>
        <li>
          <strong>Legal:</strong> we may disclose information if required by law
          or to protect the safety of users and the service.
        </li>
      </ul>

      <h2 style={h2}>5. Cookies and Local Storage</h2>
      <p>
        We use strictly necessary cookies / browser storage to keep you signed
        in and remember your preferences. We do not use advertising cookies. You
        can clear your browser storage at any time, but you may need to sign in
        again.
      </p>

      <h2 style={h2}>6. Data Retention</h2>
      <p>
        We keep your account and gameplay information only for as long as needed
        to provide the service. If you stop using JAMB-2-GO and ask us to delete
        your account, we will delete or anonymize your personal information
        within a reasonable time, except where we must keep it for legal or
        security reasons.
      </p>

      <h2 style={h2}>7. Data Security</h2>
      <p>
        We use reasonable technical measures to protect your information,
        including secure HTTPS connections and access controls. No method of
        transmission over the internet is 100% secure, so we cannot guarantee
        absolute security.
      </p>

      <h2 style={h2}>8. Your Rights and Choices</h2>
      <p>You can:</p>
      <ul>
        <li>
          View and update your username / profile picture via Google or in-app
          settings.
        </li>
        <li>Sign out at any time.</li>
        <li>Ask us for a copy of your personal information.</li>
        <li>Ask us to correct or delete your personal information.</li>
      </ul>
      <p>
        <strong>To delete your account / data:</strong> email us at{" "}
        <a href="mailto:lawalmonday02@gmail.com" style={link}>
          lawalmonday02@gmail.com
        </a>{" "}
        from the email address you used to sign in, with the subject{" "}
        <strong>“Delete my JAMB-2-GO account”</strong>. We will confirm once it
        is deleted.
      </p>

      <h2 style={h2}>9. Children</h2>
      <p>
        JAMB-2-GO is intended for JAMB candidates, generally aged 16 and above.
        It is not directed at children under 13. If you are under 18, please use
        the app with a parent or guardian&apos;s permission. If you believe a
        child under 13 has provided personal information, contact us and we will
        delete it.
      </p>

      <h2 style={h2}>10. Users in Nigeria</h2>
      <p>
        Our users are mainly in Nigeria. Your information is processed in line
        with the Nigeria Data Protection Act (NDPA) 2023. You have the right to
        request access, correction, or deletion of your data, and to lodge a
        complaint with the Nigeria Data Protection Commission if you believe
        your rights have been violated.
      </p>

      <h2 style={h2}>11. International Transfers</h2>
      <p>
        Our hosting and authentication providers may process your information on
        servers outside Nigeria, including in the United States. They use
        appropriate safeguards to protect your data.
      </p>

      <h2 style={h2}>12. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. If we make material
        changes, we will update the “Last Updated” date at the top of this page.
        Continued use of JAMB-2-GO after a change means you accept the updated
        policy.
      </p>

      <h2 style={h2}>13. Contact Us</h2>
      <p>
        If you have any questions about this Privacy Policy or your data,
        contact us at:{" "}
        <a href="mailto:lawalmonday02@gmail.com" style={link}>
          lawalmonday02@gmail.com
        </a>
      </p>
      <p style={{ ...muted, fontSize: "14px", marginTop: "32px" }}>
        Data Controller: JAMB-2-GO • Contact: lawalmonday02@gmail.com
      </p>

      <button
        onClick={goBack}
        style={{
          width: "100%",
          marginTop: "24px",
          background: "#38BDF8",
          color: "#000",
          border: "none",
          padding: "15px",
          borderRadius: "100px",
          fontWeight: "900",
          fontSize: "14px",
          cursor: "pointer",
        }}
      >
        ← Go Back
      </button>
    </div>
  );
};

export default PrivacyPolicy;

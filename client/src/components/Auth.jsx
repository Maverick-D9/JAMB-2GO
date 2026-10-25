import { useState, useEffect, useRef } from "react";
import { VITALS } from "../config/vitals";

const API = `${VITALS.SYSTEM.API_BASE}/api/auth`;
const GOOGLE_CLIENT_ID =
  "882391897710-2lluqbkg9f4f2smnbof64qvr33kot2kl.apps.googleusercontent.com";

function saveSession(data) {
  const u = data.user || {};
  const displayName =
    u.fullName || u.username || (u.email ? u.email.split("@")[0] : "Jambite");
  const safeUser = {
    userId: u.userId || u.id || u.username || u.email,
    username: u.username || u.email?.split("@")[0] || displayName,
    email: u.email,
    fullName: u.fullName || u.username || displayName,
    name: u.fullName || u.name || u.username,
    subject: "english-room",
    picture: u.picture || null,
  };
  localStorage.setItem("jambite_user", JSON.stringify(safeUser));
  localStorage.setItem("token", data.token);
  localStorage.setItem("userId", safeUser.userId);
  localStorage.setItem("email", safeUser.email);
  localStorage.setItem("username", safeUser.username);
  localStorage.setItem("fullName", safeUser.fullName);
  return safeUser;
}

export default function Auth({ onAuth }) {
  const [view, setView] = useState("login");
  const [isLogin, setIsLogin] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState({});
  const [agree, setAgree] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [devOtp, setDevOtp] = useState(null);
  const otpRefs = useRef([]);

  const [forgotEmail, setForgotEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [forgotDevOtp, setForgotDevOtp] = useState(null);

  const [quizState, setQuizState] = useState(0);
  const [battleTime, setBattleTime] = useState(12);
  const [showPlus, setShowPlus] = useState(false);
  useEffect(() => {
    const i = setInterval(() => setQuizState((s) => (s + 1) % 4), 2500);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    if (quizState === 2) {
      setShowPlus(true);
      setTimeout(() => setShowPlus(false), 800);
    }
  }, [quizState]);
  useEffect(() => {
    const t = setInterval(
      () => setBattleTime((p) => (p <= 1 ? 15 : p - 1)),
      1000,
    );
    return () => clearInterval(t);
  }, []);

  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    remember: false,
  });

  const showToast = (msg, type = "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleLogin,
        });
        window.google.accounts.id.renderButton(
          document.getElementById("googleBtn"),
          {
            theme: "outline",
            size: "large",
            width: "340",
            text: "continue_with",
            shape: "pill",
          },
        );
      }
    };
    document.body.appendChild(script);
  }, []);

  const handleGoogleLogin = async (response) => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Google login failed");
      const safeUser = saveSession(data);
      showToast(`Welcome ${safeUser.fullName}!`, "success");
      onAuth(safeUser);
    } catch (err) {
      showToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStrength = (p) => {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };
  const strength = getStrength(form.password);

  useEffect(() => {
    if (view !== "otp" || canResend) return;
    if (timer === 0) {
      setCanResend(true);
      return;
    }
    const t = setTimeout(() => setTimer(timer - 1), 1000);
    return () => clearTimeout(t);
  }, [timer, view, canResend]);

  const validate = () => {
    const e = {};
    if (!isLogin) {
      if (!form.fullName.trim() || form.fullName.length < 3)
        e.fullName = "Full name must be at least 3 chars";
      if (!form.username.trim() || form.username.length < 3)
        e.username = "Username min 3 chars";
    }
    if (isLogin && !form.username.trim())
      e.username = "Username or email required";
    if (!isLogin && !/\S+@\S+\.\S+/.test(form.email))
      e.email = "Enter a valid email";
    if (form.password.length < 6)
      e.password = "Password must be at least 6 chars";
    if (!isLogin && form.password !== form.confirmPassword)
      e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleOtpChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const newOtp = [...otp];
    newOtp[i] = val;
    setOtp(newOtp);
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
    if (!val && i > 0) otpRefs.current[i - 1]?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (!isLogin && !agree) {
      showToast("Please agree to Terms");
      return;
    }
    setLoading(true);
    try {
      if (!isLogin) {
        const res = await fetch(`${API}/request-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: form.fullName,
            username: form.username,
            email: form.email,
            password: form.password,
            subject: "english-room",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to send OTP");
        setOtpEmail(form.email);
        setDevOtp(data.devOtp || null);
        setView("otp");
        setTimer(60);
        setCanResend(false);
        if (data.devOtp) {
          setOtp(data.devOtp.toString().split(""));
          showToast(`Email is slow — Your code is ${data.devOtp}`, "success");
        } else {
          setOtp(["", "", "", "", "", ""]);
          showToast(data.message || "Code sent to " + form.email, "success");
        }
      } else {
        const res = await fetch(`${API}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emailOrUsername: form.username,
            password: form.password,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Login failed");
        const safeUser = saveSession(data);
        showToast(`Welcome back, ${safeUser.username}!`, "success");
        onAuth(safeUser);
      }
    } catch (err) {
      showToast(err.message);
    }
    setLoading(false);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) {
      showToast("Enter 6 digits");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const safeUser = saveSession(data);
      showToast(`Account verified! Welcome ${safeUser.username}`, "success");
      onAuth(safeUser);
    } catch (err) {
      showToast(err.message);
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          username: form.username,
          email: form.email,
          password: form.password,
          subject: "english-room",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTimer(60);
      setCanResend(false);
      if (data.devOtp) {
        setDevOtp(data.devOtp);
        setOtp(data.devOtp.toString().split(""));
        showToast(`New code: ${data.devOtp}`, "success");
      } else {
        showToast("Code resent to " + otpEmail, "success");
      }
    } catch (err) {
      showToast(err.message);
    }
    setLoading(false);
  };

  const handleForgotRequest = async (e) => {
    e.preventDefault();
    if (!/\S+@\S+\.\S+/.test(forgotEmail)) {
      showToast("Enter valid email");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForgotDevOtp(data.devOtp || null);
      showToast(data.devOtp ? `Code: ${data.devOtp}` : data.message, "success");
      setView("reset");
      if (data.devOtp) setResetCode(data.devOtp.toString());
    } catch (err) {
      showToast(err.message);
    }
    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetCode.length !== 6) {
      showToast("Enter 6-digit code");
      return;
    }
    if (newPassword.length < 6) {
      showToast("Password must be at least 6 chars");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail,
          code: resetCode,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Password reset! Please login", "success");
      setView("login");
      setIsLogin(true);
      setResetCode("");
      setNewPassword("");
      setForgotDevOtp(null);
    } catch (err) {
      showToast(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full bg-[#080C18] relative flex items-center justify-center p-4 overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Cinzel:wght@700&display=swap');
        @keyframes aurora{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-30px) scale(1.1)}}
        @keyframes float{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-12px) rotate(-1deg)}}
        @keyframes float2{0%,100%{transform:translateY(0) rotate(2deg)}50%{transform:translateY(-8px) rotate(1deg)}}
        @keyframes pop{0%{transform:scale(0.5);opacity:0}50%{transform:scale(1.3)}100%{transform:scale(1);opacity:1}}
        @keyframes fadeIn{from{opacity:0; transform:translateY(8px)} to{opacity:1; transform:translateY(0)}}
       .input-wrap:focus-within{border-color:#38BDF8!important; box-shadow:0 0 0 3px rgba(56,189,248,0.15)}
       .input-error{border-color:#ef4444!important}
      `}</style>

      <div className="absolute inset-0">
        <div
          className="absolute w-[900px] h-[700px] -top-[200px] -left-[200px] bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.28),_transparent_60%)] blur-[40px]"
          style={{ animation: "aurora 12s infinite" }}
        />
        <div
          className="absolute w-[800px] h-[800px] top-[10%] right-[-150px] bg-[radial-gradient(ellipse_at_center,_rgba(168,85,247,0.22),_transparent_60%)] blur-[40px]"
          style={{ animation: "aurora 14s infinite reverse" }}
        />
        <div className="absolute w-[600px] h-[600px] bottom-[-100px] left-[30%] bg-[radial-gradient(ellipse_at_center,_rgba(251,191,36,0.12),_transparent_70%)] blur-[50px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: toast.type === "error" ? "#7f1d1d" : "#065f46",
            color: "white",
            padding: "12px 20px",
            borderRadius: 100,
            zIndex: 50,
            fontSize: 13,
            fontWeight: 600,
            border: `1px solid ${toast.type === "error" ? "#ef4444" : "#10b981"}`,
            animation: "fadeIn 0.3s ease",
          }}
        >
          {toast.type === "error" ? "❌" : "✅"} {toast.msg}
        </div>
      )}

      <div className="relative w-full max-w-[1250px] grid lg:grid-cols-[1.15fr_0.85fr] gap-6 items-center">
        <div className="hidden lg:block pl-10">
          <div className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/10 rounded-full px-3 py-1 text-[10px] tracking-[0.15em] text-amber-200 uppercase font-bold mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />{" "}
            TEST YOURSELF • IMPROVE YOURSELF • THINK DIVERSE • TRASCEND • 2000+
            JAMBITES
          </div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-[#38BDF8] flex items-center justify-center font-black text-black text-xl">
              J
            </div>
            <span
              className="font-black text-white tracking-tight text-[16px]"
              style={{ fontFamily: "Cinzel" }}
            >
              SCHOLARS' HAVEN
            </span>
          </div>
          <h1 className="font-black text-[56px] leading-[0.9] tracking-tight text-white">
            Compete.
            <br />
            Learn.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400">
              Top Your JAMB.
            </span>
          </h1>
          <p className="text-slate-400 text-[15px] mt-4 max-w-[420px] leading-relaxed">
            Join 2,000+ JAMBITES in real-time quiz battles. English, Maths,
            Physics — race to answer first.
          </p>
          <div className="relative mt-10 w-[440px] h-[340px]">
            <div
              className="absolute left-0 top-0 w-[310px] bg-[#121A2E]/80 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
              style={{ animation: "float 6s ease-in-out infinite" }}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  LIVE BATTLE • Q12
                </span>
                <span className="bg-red-500/15 text-red-300 border border-red-500/20 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1 h-1 bg-red-400 rounded-full animate-pulse" />{" "}
                  {battleTime}s
                </span>
              </div>
              <div className="bg-[#080C18] rounded-xl p-3 border border-white/5">
                <p className="text-white text-[13px] font-semibold leading-snug">
                  What is the synonym of "effervescent"?
                </p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {["Lively", "Dull", "Calm", "Tired"].map((opt, i) => {
                    const isC = i === 0;
                    const active = quizState >= 1 && isC;
                    return (
                      <div
                        key={opt}
                        className={`text-[11px] font-bold px-2.5 py-2 rounded-full border transition-all duration-500 ${active ? "bg-emerald-500 text-black border-emerald-400 scale-105" : "bg-white/5 text-slate-400 border-white/10"}`}
                      >
                        {active ? "✓ " : ""}
                        {opt}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex -space-x-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-500 border-2 border-[#121A2E] flex items-center justify-center text-[10px] font-black text-white">
                    C
                  </div>
                  <div className="w-7 h-7 rounded-full bg-amber-400 border-2 border-[#121A2E] flex items-center justify-center text-[10px] font-black text-black">
                    D
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span
                    className={`${quizState >= 1 ? "text-emerald-400 font-black" : "text-slate-500"}`}
                  >
                    Chidi ✓
                  </span>
                  <span className="text-slate-600">vs</span>
                  <span className="text-slate-500">Dee</span>
                </div>
              </div>
              {showPlus && (
                <div
                  className="absolute -right-2 -top-2 bg-emerald-400 text-black font-black text-[12px] px-2.5 py-1 rounded-full shadow-lg"
                  style={{ animation: "pop 0.5s ease" }}
                >
                  +10 pts
                </div>
              )}
            </div>
            <div
              className="absolute right-2 bottom-10 w-[200px] bg-[#121A2E]/90 backdrop-blur-xl border border-amber-400/20 rounded-2xl p-3 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
              style={{ animation: "float2 7s ease-in-out infinite" }}
            >
              <p className="text-[9px] font-bold tracking-widest text-amber-300 uppercase mb-2">
                Leaderboard • Live
              </p>
              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-white font-bold">1. Chidi</span>
                  <span className="text-emerald-400 font-black">340</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">2. You</span>
                  <span className="text-amber-300 font-black">280 👑</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">3. Dee</span>
                  <span className="text-slate-400">265</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#121A2E]/75 backdrop-blur-2xl border border-white/10 rounded-[28px] p-8 shadow-[0_25px_80px_rgba(0,0,0,0.6)] relative overflow-y-auto max-h-[95vh]">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />

          {view === "forgot" ? (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <h2 className="font-black text-[26px] text-white tracking-tight">
                Forgot Password
              </h2>
              <p className="text-slate-400 text-[13px] mt-1">
                Enter your email to receive a reset code
              </p>
              <form onSubmit={handleForgotRequest} className="grid gap-4 mt-7">
                <div className="input-wrap flex items-center bg-[#080C18] border border-white/10 rounded-full px-4">
                  <span className="mr-2 text-slate-500 text-sm">✉️</span>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="your@gmail.com"
                    className="flex-1 bg-transparent border-none outline-none text-white py-3.5 text-[14px] placeholder:text-slate-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-full bg-[#38BDF8] text-black font-black text-sm"
                >
                  {loading ? "Sending..." : "Send Reset Code"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setView("login");
                    setIsLogin(true);
                  }}
                  className="bg-transparent border-none text-slate-500 text-[12px] cursor-pointer"
                >
                  ← Back to login
                </button>
              </form>
            </div>
          ) : view === "reset" ? (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <h2 className="font-black text-[26px] text-white tracking-tight">
                Reset Password
              </h2>
              <p className="text-slate-400 text-[13px] mt-1">
                Code sent to {forgotEmail}
              </p>
              {forgotDevOtp && (
                <div className="bg-sky-500/10 border border-sky-400/30 rounded-2xl p-4 text-center mt-4">
                  <p className="text-[11px] text-sky-300 uppercase tracking-widest font-bold">
                    Email slow — use this code
                  </p>
                  <p className="text-[32px] font-black tracking-[10px] text-white mt-1">
                    {forgotDevOtp}
                  </p>
                </div>
              )}
              <form onSubmit={handleResetPassword} className="grid gap-4 mt-7">
                <div className="input-wrap flex items-center bg-[#080C18] border border-white/10 rounded-full px-4">
                  <span className="mr-2 text-slate-500 text-sm">🔢</span>
                  <input
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="6-digit code"
                    className="flex-1 bg-transparent border-none outline-none text-white py-3.5 text-[14px] tracking-[6px] placeholder:text-slate-500"
                    required
                    maxLength={6}
                  />
                </div>
                <div className="input-wrap flex items-center bg-[#080C18] border border-white/10 rounded-full px-4">
                  <span className="mr-2 text-[12px]">🔒</span>
                  <input
                    type={showPass ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 6)"
                    className="flex-1 bg-transparent border-none outline-none text-white py-3.5 text-[14px] placeholder:text-slate-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="bg-transparent border-none cursor-pointer text-sm"
                  >
                    {showPass ? "🙈" : "👁️"}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-full bg-[#38BDF8] text-black font-black text-sm"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </button>
                <button
                  type="button"
                  onClick={() => setView("forgot")}
                  className="bg-transparent border-none text-slate-500 text-[12px] cursor-pointer"
                >
                  ← Change email
                </button>
              </form>
            </div>
          ) : (
            <>
              <h2 className="font-black text-[26px] text-white tracking-tight">
                {view === "otp"
                  ? "Verify Email"
                  : isLogin
                    ? "Welcome Back"
                    : "Create an Account"}
              </h2>
              <p className="text-slate-400 text-[13px] mt-1">
                {view === "otp"
                  ? `We sent a 6-digit code to ${otpEmail}`
                  : isLogin
                    ? "Log in to continue your streak."
                    : "Join the room and start competing."}
              </p>

              {view === "otp" ? (
                <form
                  onSubmit={handleVerify}
                  className="grid gap-4 mt-7"
                  style={{ animation: "fadeIn 0.3s ease" }}
                >
                  {devOtp && (
                    <div className="bg-sky-500/10 border border-sky-400/30 rounded-2xl p-4 text-center">
                      <p className="text-[11px] text-sky-300 uppercase tracking-widest font-bold">
                        Email is slow — use this code
                      </p>
                      <p className="text-[32px] font-black tracking-[10px] text-white mt-1">
                        {devOtp}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Auto-filled below — just tap Verify
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2 justify-between">
                    {otp.map((d, i) => (
                      <input
                        key={i}
                        ref={(el) => (otpRefs.current[i] = el)}
                        value={d}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        maxLength={1}
                        className="w-[48px] h-[56px] text-center text-[20px] font-black bg-[#080C18] border border-white/10 rounded-xl text-white outline-none focus:border-sky-400/50"
                      />
                    ))}
                  </div>
                  <p className="text-center text-slate-500 text-[11px]">
                    {devOtp
                      ? "Code shown above — no need to check Gmail"
                      : "Scholar's code sent to your Gmail"}
                  </p>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-full bg-[#38BDF8] text-black font-black text-sm"
                  >
                    {loading ? "Verifying..." : "Verify & Create Account"}
                  </button>
                  <div className="text-center text-[12px] text-slate-400">
                    {canResend ? (
                      <button
                        type="button"
                        onClick={handleResend}
                        className="bg-transparent border-none text-sky-400 font-bold cursor-pointer"
                      >
                        Resend Code
                      </button>
                    ) : (
                      <span>Resend code in {timer}s</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setView("signup");
                      setIsLogin(false);
                      setDevOtp(null);
                    }}
                    className="bg-transparent border-none text-slate-500 text-[12px] cursor-pointer"
                  >
                    ← Back to signup
                  </button>
                </form>
              ) : (
                <>
                  <form
                    onSubmit={handleSubmit}
                    className="grid gap-3.5 mt-7"
                    noValidate
                  >
                    {!isLogin && (
                      <>
                        <div>
                          <div
                            className={`input-wrap ${errors.fullName ? "input-error" : ""} flex items-center bg-[#080C18] border border-white/10 rounded-full px-4`}
                          >
                            <span className="mr-2 text-slate-500 text-sm">
                              👤
                            </span>
                            <input
                              value={form.fullName}
                              onChange={(e) =>
                                setForm({ ...form, fullName: e.target.value })
                              }
                              placeholder="Full Name"
                              className="flex-1 bg-transparent border-none outline-none text-white py-3.5 text-[14px] placeholder:text-slate-500"
                            />
                          </div>
                          {errors.fullName && (
                            <div className="text-[#f87171] text-[11px] mt-1 ml-4">
                              {errors.fullName}
                            </div>
                          )}
                        </div>
                        <div>
                          <div
                            className={`input-wrap ${errors.username ? "input-error" : ""} flex items-center bg-[#080C18] border border-white/10 rounded-full px-4`}
                          >
                            <span className="mr-2 text-slate-500 text-sm">
                              @
                            </span>
                            <input
                              value={form.username}
                              onChange={(e) =>
                                setForm({ ...form, username: e.target.value })
                              }
                              placeholder="Username"
                              className="flex-1 bg-transparent border-none outline-none text-white py-3.5 text-[14px] placeholder:text-slate-500"
                            />
                          </div>
                          {errors.username && (
                            <div className="text-[#f87171] text-[11px] mt-1 ml-4">
                              {errors.username}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    {isLogin ? (
                      <div>
                        <div
                          className={`input-wrap ${errors.username ? "input-error" : ""} flex items-center bg-[#080C18] border border-white/10 rounded-full px-4`}
                        >
                          <span className="mr-2 text-slate-500 text-sm">@</span>
                          <input
                            value={form.username}
                            onChange={(e) =>
                              setForm({ ...form, username: e.target.value })
                            }
                            placeholder="Username or Email"
                            className="flex-1 bg-transparent border-none outline-none text-white py-3.5 text-[14px] placeholder:text-slate-500"
                          />
                        </div>
                        {errors.username && (
                          <div className="text-[#f87171] text-[11px] mt-1 ml-4">
                            {errors.username}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div
                          className={`input-wrap ${errors.email ? "input-error" : ""} flex items-center bg-[#080C18] border border-white/10 rounded-full px-4`}
                        >
                          <span className="mr-2 text-slate-500 text-sm">
                            ✉️
                          </span>
                          <input
                            type="email"
                            value={form.email}
                            onChange={(e) =>
                              setForm({ ...form, email: e.target.value })
                            }
                            placeholder="Email Address"
                            className="flex-1 bg-transparent border-none outline-none text-white py-3.5 text-[14px] placeholder:text-slate-500"
                          />
                        </div>
                        {errors.email && (
                          <div className="text-[#f87171] text-[11px] mt-1 ml-4">
                            {errors.email}
                          </div>
                        )}
                      </div>
                    )}
                    <div>
                      <div
                        className={`input-wrap ${errors.password ? "input-error" : ""} flex items-center bg-[#080C18] border border-white/10 rounded-full px-4`}
                      >
                        <span className="mr-2 text-[12px]">🔒</span>
                        <input
                          type={showPass ? "text" : "password"}
                          value={form.password}
                          onChange={(e) =>
                            setForm({ ...form, password: e.target.value })
                          }
                          placeholder="Password"
                          className="flex-1 bg-transparent border-none outline-none text-white py-3.5 text-[14px] placeholder:text-slate-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(!showPass)}
                          className="bg-transparent border-none cursor-pointer text-sm"
                        >
                          {showPass ? "🙈" : "👁️"}
                        </button>
                      </div>
                      {errors.password && (
                        <div className="text-[#f87171] text-[11px] mt-1 ml-4">
                          {errors.password}
                        </div>
                      )}
                      {!isLogin && form.password && (
                        <div className="mt-2 ml-1">
                          <div className="flex gap-1">
                            {[0, 1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className="h-1 flex-1 rounded-full transition-all"
                                style={{
                                  background:
                                    i < strength
                                      ? strength === 1
                                        ? "#ef4444"
                                        : strength === 2
                                          ? "#f97316"
                                          : strength === 3
                                            ? "#eab308"
                                            : "#22c55e"
                                      : "rgba(255,255,255,0.1)",
                                }}
                              />
                            ))}
                          </div>
                          <div
                            className="text-[11px] mt-1"
                            style={{
                              color:
                                strength === 1
                                  ? "#ef4444"
                                  : strength === 2
                                    ? "#f97316"
                                    : strength === 3
                                      ? "#eab308"
                                      : "#22c55e",
                            }}
                          >
                            {strength === 0
                              ? "Too weak"
                              : strength === 1
                                ? "Weak"
                                : strength === 2
                                  ? "Fair"
                                  : strength === 3
                                    ? "Good"
                                    : "Strong"}
                          </div>
                        </div>
                      )}
                    </div>
                    {!isLogin && (
                      <>
                        <div>
                          <div
                            className={`input-wrap ${errors.confirmPassword ? "input-error" : ""} flex items-center bg-[#080C18] border border-white/10 rounded-full px-4`}
                          >
                            <span className="mr-2 text-[12px]">🔒</span>
                            <input
                              type={showConfirm ? "text" : "password"}
                              value={form.confirmPassword}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  confirmPassword: e.target.value,
                                })
                              }
                              placeholder="Confirm Password"
                              className="flex-1 bg-transparent border-none outline-none text-white py-3.5 text-[14px] placeholder:text-slate-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirm(!showConfirm)}
                              className="bg-transparent border-none cursor-pointer text-sm"
                            >
                              {showConfirm ? "🙈" : "👁️"}
                            </button>
                          </div>
                          {errors.confirmPassword && (
                            <div className="text-[#f87171] text-[11px] mt-1 ml-4">
                              {errors.confirmPassword}
                            </div>
                          )}
                        </div>
                        <label className="flex gap-2 items-start cursor-pointer mt-1">
                          <input
                            type="checkbox"
                            checked={agree}
                            onChange={(e) => setAgree(e.target.checked)}
                            className="mt-1 accent-[#38BDF8]"
                          />
                          <span className="text-slate-400 text-[12px] leading-[1.4]">
                            I agree to the{" "}
                            <span className="text-sky-400 underline">
                              Terms of Service
                            </span>{" "}
                            and Privacy Policy
                          </span>
                        </label>
                      </>
                    )}
                    {isLogin && (
                      <div className="flex justify-between items-center text-[12px]">
                        <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.remember}
                            onChange={(e) =>
                              setForm({ ...form, remember: e.target.checked })
                            }
                            className="accent-[#38BDF8]"
                          />{" "}
                          Remember Me
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setForgotEmail(
                              form.username.includes("@") ? form.username : "",
                            );
                            setView("forgot");
                          }}
                          className="bg-transparent border-none text-sky-400 font-bold cursor-pointer"
                        >
                          Forgot Password?
                        </button>
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={loading || (!isLogin && !agree)}
                      className={`w-full py-3.5 rounded-full border-none font-black text-[14px] mt-2 transition-all ${loading || (!isLogin && !agree) ? "bg-[#1e3a5f] text-slate-400 cursor-not-allowed" : "bg-[#38BDF8] text-black cursor-pointer shadow-[0_0_20px_rgba(56,189,248,0.3)] hover:bg-[#0ea5e9]"}`}
                    >
                      {loading
                        ? "Please wait..."
                        : isLogin
                          ? "Log In"
                          : "Create My Account"}
                    </button>
                    <div className="flex items-center gap-3 my-1">
                      <div className="flex-1 h-[1px] bg-white/10" />
                      <span className="text-slate-500 text-[10px] uppercase tracking-widest">
                        or continue with
                      </span>
                      <div className="flex-1 h-[1px] bg-white/10" />
                    </div>
                    <div className="flex justify-center bg-white rounded-full p-[3px] w-full">
                      <div
                        id="googleBtn"
                        className="w-full flex justify-center"
                      ></div>
                    </div>
                  </form>
                  <div className="text-center mt-5 text-slate-500 text-[13px]">
                    {isLogin ? "New here? " : "Already have an account? "}
                    <button
                      onClick={() => {
                        setIsLogin(!isLogin);
                        setView(isLogin ? "signup" : "login");
                        setErrors({});
                      }}
                      className="bg-transparent border-none text-sky-400 font-bold cursor-pointer text-[13px]"
                    >
                      {isLogin ? "Create an Account" : "Log In"}
                    </button>
                  </div>
                  <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-center gap-1.5 text-slate-600 text-[11px]">
                    🔒 Secure 256-bit SSL Encrypted
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

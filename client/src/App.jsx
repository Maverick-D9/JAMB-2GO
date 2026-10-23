import { useState, useEffect, useMemo, useRef } from "react";
import io from "socket.io-client";
import Auth from "./components/Auth";
import Admin from "./pages/Admin";
import CBTSetup from "./pages/CBTSetup";
import CBTExam from "./pages/CBTExam";
import CBTResult from "./pages/CBTResult";
import CbtReview from "./pages/CbtReview";
import CBTDrillSetup from "./pages/CBTDrillSetup";
import CBTDrill from "./pages/CBTDrill";
import CBTDrillResult from "./pages/CBTDrillResult";
import CBTDrillReview from "./pages/CBTDrillReview";
import AdminTopics from "./pages/AdminTopics";
import { VITALS } from "./config/vitals";
import Reviews from "./pages/Reviews";
import ReviewFab from "./components/ReviewFab.jsx";

const API_BASE = VITALS.SYSTEM.API_BASE;
const socket = io.connect(API_BASE);

const SUBJECTS = [
  { id: "english-room", label: "ENGLISH", count: 85 },
  { id: "maths-room", label: "MATHS", count: 121 },
  { id: "physics-room", label: "PHYSICS", count: 112 },
  { id: "chemistry-room", label: "CHEMISTRY", count: 124 },
  { id: "accounting-room", label: "ACCOUNTING", count: 115 },
  { id: "biology-room", label: "BIOLOGY", count: 136 },
  { id: "economics-room", label: "ECONOMICS", count: 101 },
  { id: "commerce-room", label: "COMMERCE", count: 111 },
  { id: "government-room", label: "GOVT", count: 165 },
  { id: "literature-room", label: "LIT", count: 94 },
  { id: "crs-room", label: "CRS", count: 89 },
  { id: "geography-room", label: "GEOGRAPHY", count: 0 },
  { id: "agriculture-room", label: "AGRIC", count: 0 },
  { id: "yoruba-room", label: "YORUBA", count: 0 },
  { id: "marketing-room", label: "MARKETING", count: 0 },
  { id: "irs-room", label: "IRS", count: 0 },
  { id: "history-room", label: "HISTORY", count: 0 },
];

function PaywallModal({ access, userId, email, onClose }) {
  const [loading, setLoading] = useState(false);
  const handleSubscribe = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/payment/subscribe/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email }),
      });
      const json = await res.json();
      const authUrl = json.data?.authorization_url || json.authorization_url;
      const reference = json.data?.reference || json.reference;
      if (!authUrl) {
        alert("Failed to get Paystack link");
        setLoading(false);
        return;
      }
      localStorage.setItem("paystack_ref", reference);
      window.location.href = authUrl;
    } catch (e) {
      alert("Paystack error: " + e.message);
      setLoading(false);
    }
  };
  const isTrial = access?.status === "trial";
  const isExpired = access?.status === "expired";
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-[12px] grid place-items-center z-[300] p-4">
      <div className="bg-gradient-to-b from-[#1e293b] to-[#0f172a] w-[420px] max-w-[95vw] rounded-[28px] p-7 border border-amber-400/30 shadow-[0_0_60px_rgba(251,191,36,0.25)] text-center">
        <div className="text-[40px]">👑</div>
        <h2 className="text-white text-[22px] font-black mt-2">
          {isExpired
            ? VITALS.MESSAGES.TRIAL_ENDED
            : isTrial
              ? `Upgrade Your Trial 👑`
              : VITALS.MESSAGES.FREE_ZONE_TITLE}
        </h2>
        <p className="text-slate-400 text-[13px] mt-2 leading-6">
          {isTrial ? (
            <>
              You are on FREE trial —{" "}
              <b className="text-white">{access.daysLeft} day(s) left.</b>
              <br />
              <span className="text-emerald-300">
                Option B: Pay now and your {VITALS.SUBSCRIPTION.DURATION_DAYS}{" "}
                days will start AFTER trial ends. You keep your free days +{" "}
                {VITALS.SUBSCRIPTION.DURATION_DAYS} days.
              </span>
            </>
          ) : (
            <>
              {VITALS.MESSAGES.FREE_ZONE_DESC} {VITALS.SUBSCRIPTION.LABEL}
            </>
          )}
        </p>
        <div className="mt-5 bg-[#080C18] border border-white/10 rounded-[18px] p-4 text-left">
          <div className="flex justify-between text-[13px]">
            <span className="text-slate-400">{VITALS.SUBSCRIPTION.NAME}</span>
            <span className="text-white font-bold">
              {VITALS.SUBSCRIPTION.LABEL}
            </span>
          </div>
          <div className="mt-2 text-[12px] text-slate-300 grid gap-1.5">
            <div>✅ All Subjects • Live Arena</div>
            <div>✅ CBT Practice • Test your speed & accuracy</div>
            <div>✅ Drill Palace • Topic Mastery</div>
            <div>✅ Chat & DMs</div>
            {isTrial && (
              <div className="text-emerald-300 font-bold">
                ✅ You keep {access.daysLeft} free days +{" "}
                {VITALS.SUBSCRIPTION.DURATION_DAYS} days after
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full mt-5 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black text-[15px]"
        >
          {loading
            ? "Opening Paystack..."
            : isTrial
              ? `Upgrade Now — ${VITALS.SUBSCRIPTION.LABEL} (Starts after trial)`
              : VITALS.MESSAGES.PAY_BUTTON_SHORT}
        </button>
        <button onClick={onClose} className="mt-3 text-slate-500 text-[12px]">
          {isTrial
            ? "Continue trial for now"
            : "Maybe later — stay in English only"}
        </button>
      </div>
    </div>
  );
}

function SystemMessage({ type, username }) {
  return (
    <div className="self-center bg-[#0F172A] border border-dashed border-slate-600 text-slate-500 text-[11px] px-3 py-1.5 rounded-full my-1.5 font-semibold">
      {type === "joined" ? `→ ${username} joined` : `← ${username} left`}
    </div>
  );
}

function ParticipantsList({
  users,
  currentUsername,
  activeChat,
  setActiveChat,
  unreadDMs,
  setUnreadDMs,
}) {
  const sorted = useMemo(
    () => [...users].sort((a, b) => (b.score || 0) - (a.score || 0)),
    [users],
  );
  return (
    <div className="bg-[#121A2E]/70 backdrop-blur-xl border border-white/10 rounded-[18px] p-3.5 w-full">
      <div className="text-white font-extrabold text-[11px] tracking-widest mb-2.5">
        PARTICIPANTS • {users.length}
      </div>
      <div className="grid gap-2">
        {sorted.map((u) => {
          const isMe = u.username === currentUsername;
          const isActive = activeChat === u.username;
          const unread = unreadDMs[u.username] || 0;
          return (
            <button
              key={u.username}
              onClick={() => {
                if (isMe) return;
                setActiveChat(u.username);
                setUnreadDMs((prev) => ({ ...prev, [u.username]: 0 }));
              }}
              className={`flex justify-between items-center p-2.5 rounded-xl border w-full text-left ${isActive ? "bg-sky-400 border-sky-400" : "bg-transparent border-transparent hover:bg-white/5"}`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-[10px] grid place-items-center text-[12px] font-extrabold relative ${isActive ? "bg-[#0F172A] text-white" : "bg-slate-700 text-white"}`}
                >
                  {u.username[0]?.toUpperCase()}
                  {unread > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] min-w-[16px] h-4 rounded-full grid place-items-center">
                      {unread}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[13px] font-semibold truncate ${isActive ? "text-black" : "text-slate-300"}`}
                >
                  {u.username} {isMe && "(you)"}
                </span>
              </div>
              <span
                className={`text-[12px] font-extrabold ${isActive ? "text-black" : "text-sky-400"}`}
              >
                {u.score || 0} pts
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChatPanel({
  activeChat,
  setActiveChat,
  messages,
  privateConversations,
  chatMsg,
  setChatMsg,
  hasAccess,
  room,
  username,
  socket,
}) {
  const [showEmoji, setShowEmoji] = useState(false);
  const EMOJIS = [
    "😀",
    "😂",
    "❤️",
    "🔥",
    "👏",
    "💯",
    "😭",
    "😎",
    "⚡",
    "🙏",
    "💀",
    "😅",
    "🤣",
    "👑",
    "✅",
    "❌",
    "🎉",
    "😡",
    "🥺",
    "🤝",
    "😍",
    "🙌",
    "👀",
    "💪",
  ];

  const isRoom = activeChat === "room";
  const currentHistory = isRoom
    ? messages
    : privateConversations[activeChat] || [];

  const send = () => {
    if (!chatMsg.trim() || !hasAccess) return;
    if (isRoom)
      socket.emit("send_message", { room, author: username, message: chatMsg });
    else
      socket.emit("private_message", {
        room,
        to: activeChat,
        from: username,
        message: chatMsg,
      });
    setChatMsg("");
    setShowEmoji(false);
  };

  const addEmoji = (emoji) => {
    setChatMsg((prev) => prev + emoji);
  };

  return (
    <div
      className={`bg-[#121A2E]/70 backdrop-blur-xl rounded-[18px] p-3.5 border flex flex-col flex-1 overflow-hidden w-full ${isRoom ? "border-white/10" : "border-sky-400/30"}`}
    >
      <div className="flex justify-between items-center mb-2.5">
        <div
          className={`font-extrabold text-[11px] ${isRoom ? "text-white" : "text-sky-400"}`}
        >
          {isRoom ? "LIVE CHAT" : `DM • ${activeChat}`}
        </div>
        {!isRoom && (
          <button
            onClick={() => setActiveChat("room")}
            className="bg-[#0F172A] border border-white/10 text-slate-400 text-[11px] px-2.5 py-1 rounded-full"
          >
            ← Back
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col gap-2">
        {currentHistory.map((m, i) => {
          if (m.type === "system")
            return (
              <SystemMessage key={i} type={m.eventType} username={m.username} />
            );
          const isMe = (m.author || m.from) === username;
          return (
            <div
              key={i}
              className={`flex gap-2 max-w-[85%] ${isMe ? "self-end" : "self-start"}`}
            >
              <div
                className={`px-3 py-2 rounded-[12px] text-[13px] border ${isMe ? "bg-[#0F172A] border-white/5 text-slate-300" : "bg-[#1e3a5f]/50 border-sky-400/20 text-slate-300"}`}
              >
                <b className="text-sky-400">{m.author || m.from}: </b>
                {m.message}
              </div>
            </div>
          );
        })}
      </div>

      {showEmoji && (
        <div className="grid grid-cols-6 gap-1 p-2 bg-[#0F172A] border border-white/10 rounded-xl mt-2.5 animate-[pop_0.2s]">
          {EMOJIS.map((em) => (
            <button
              key={em}
              onClick={() => addEmoji(em)}
              className="text-[20px] hover:bg-white/10 rounded-lg p-1.5 transition"
            >
              {em}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-2.5 items-center">
        <button
          onClick={() => setShowEmoji(!showEmoji)}
          className="w-10 h-[42px] rounded-full bg-[#0F172A] border border-white/10 grid place-items-center text-[18px] shrink-0 hover:bg-white/10"
        >
          😊
        </button>
        <input
          value={chatMsg}
          onChange={(e) => setChatMsg(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={hasAccess ? "Message..." : `🔒 Subscribe to chat`}
          className="flex-1 px-4 py-3 rounded-full bg-[#0F172A] border border-white/10 text-white outline-none text-[13px]"
        />
        <button
          onClick={send}
          className="w-11 h-[42px] rounded-full bg-sky-400 text-black grid place-items-center font-bold"
        >
          ↗
        </button>
      </div>
    </div>
  );
}

function LeaderboardModal({
  leaderboardData,
  qNumber,
  username,
  room,
  myStreak,
  onClose,
}) {
  const sorted = useMemo(
    () => [...leaderboardData].sort((a, b) => (b.score || 0) - (a.score || 0)),
    [leaderboardData],
  );
  const top3 = sorted.slice(0, 3);
  const rank2 = top3[1];
  const rank1 = top3[0];
  const myEntry = sorted.find(
    (u) => u.user === username || u.username === username,
  );
  const myRank =
    sorted.findIndex((u) => u.user === username || u.username === username) + 1;
  const subjectLabel = (room || "english-room")
    .replace("-room", "")
    .toUpperCase();
  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-[14px] grid place-items-center z-[200] p-4 overflow-hidden">
      <div className="bg-[#111B2F] w-[440px] max-w-[95vw] rounded-[22px] border border-amber-300/20 shadow-[0_0_80px_rgba(251,191,36,0.28)] overflow-hidden p-0 relative">
        <div className="text-center pt-6 pb-2">
          <div className="flex justify-center gap-2 text-[22px]">
            <span>👑</span>
            <span>🏆</span>
            <span>👑</span>
          </div>
          <h2 className="text-white font-black text-[20px] mt-2 tracking-tight">
            Leaderboard Q{qNumber}
          </h2>
          <div className="mt-1 text-[11px] font-black tracking-widest text-sky-400">
            JAMB-2GO • {subjectLabel} • ROUND {qNumber} • {myStreak} 🔥 STREAK!
          </div>
          <div className="mt-1 text-[11px] font-bold text-amber-300">
            YOUR RANK: #{myRank || 1} • {myEntry?.score || 0} pts • {myStreak}🔥
          </div>
        </div>
        <div className="grid grid-cols-3 items-end gap-2 px-6 mt-5 h-[150px]">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-[#1F2A44] border border-white/10 grid place-items-center font-black text-white text-[14px]">
              {rank2?.user?.[0]?.toUpperCase() || "C"}
            </div>
            <div className="text-white text-[12px] font-bold mt-1.5 truncate max-w-[100px]">
              {rank2?.user || "Chidi"}
            </div>
            <div className="text-[10px] text-slate-400">
              {rank2?.score || 13} pts
            </div>
            <div className="w-full h-[46px] mt-2 rounded-[10px] bg-[#1A233A] border border-white/10 grid place-items-center text-slate-400 font-black text-[15px]">
              2
            </div>
          </div>
          <div className="flex flex-col items-center -mt-6">
            <div className="w-[60px] h-[60px] rounded-[16px] bg-sky-400 grid place-items-center font-black text-black text-[24px] shadow-[0_0_32px_rgba(56,189,248,0.7)] border-2 border-sky-300">
              {rank1?.user?.[0]?.toUpperCase() || "D"}
            </div>
            <div className="text-white text-[12px] font-black mt-1.5 truncate max-w-[110px]">
              {(rank1?.user?.split("@")[0] || username || "Dee") + " • YOU"}
            </div>
            <div className="text-[10px] text-amber-300 font-bold">
              {rank1?.score || 0} pts
            </div>
            <div className="w-full h-[68px] mt-2 rounded-[10px] bg-sky-400 grid place-items-center text-black font-black text-[18px]">
              1
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-[12px] bg-[#1A233A] border border-dashed border-white/20 grid place-items-center text-slate-500 text-[14px]">
              ?
            </div>
            <div className="text-[10px] text-slate-500 mt-6 text-center leading-3">
              Waiting for
              <br />
              challengers
            </div>
            <div className="w-full h-[38px] mt-2 rounded-[10px] bg-[#1A233A] border border-white/5 grid place-items-center text-slate-600 font-black">
              3
            </div>
          </div>
        </div>
        <div className="px-3 mt-5 grid gap-2">
          {sorted.slice(0, 6).map((e, i) => {
            const isMe = e.user === username || e.username === username;
            return (
              <div
                key={e.user || i}
                className={`flex justify-between items-center px-3 py-2.5 rounded-[12px] border text-[12px] ${isMe ? "bg-sky-400/10 border-sky-400/30 text-amber-200" : "bg-[#0F172A] border-white/10 text-white"}`}
              >
                <span className="font-bold truncate">
                  {isMe ? `👑 ${e.user} (you) 🔥 ${myStreak}` : `👨‍🎓 ${e.user}`}
                </span>
                <span className="text-sky-300 font-bold text-[11px] shrink-0 ml-2">
                  {e.score} pts
                </span>
              </div>
            );
          })}
        </div>
        <div className="p-3 mt-2">
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-[14px] bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black text-[14px]"
          >
            Continue → Q{qNumber + 1} • {myStreak}🔥
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [authedUser, setAuthedUser] = useState(() => {
    try {
      const s = localStorage.getItem("jambite_user");
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });
  const username = authedUser?.username || "";
  const userId =
    authedUser?.userId ||
    authedUser?.id ||
    authedUser?._id ||
    authedUser?.email ||
    authedUser?.username ||
    "";
  const userEmail = authedUser?.email || "";
  const [access, setAccess] = useState({
    tier: "english_only",
    status: "free",
    daysLeft: 0,
  });
  const [showPaywall, setShowPaywall] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [room, setRoom] = useState(() => authedUser?.subject || "english-room");
  const [palaceMode, setPalaceMode] = useState("arena");
  const [currentQ, setCurrentQ] = useState(null);
  const [qNumber, setQNumber] = useState(0);
  const [timer, setTimer] = useState(60);
  const [expiresAt, setExpiresAt] = useState(null);
  const [myScore, setMyScore] = useState(0);
  const [myStreak, setMyStreak] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [toast, setToast] = useState(null);
  const [chatMsg, setChatMsg] = useState("");
  const [messages, setMessages] = useState([]);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedWinner, setLockedWinner] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [prevLeaderboardData, setPrevLeaderboardData] = useState(null);
  const [roomUsers, setRoomUsers] = useState([]);
  const [activeChat, setActiveChat] = useState("room");
  const [privateConversations, setPrivateConversations] = useState({});
  const [unreadDMs, setUnreadDMs] = useState({});
  const [hovered, setHovered] = useState(false);

  const fetchAccess = async () => {
    const emailToUse = userEmail || userId;
    if (!emailToUse) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/payment/access/${encodeURIComponent(emailToUse)}`,
      );
      const data = await res.json();
      setAccess(data);
    } catch (e) {
      console.log(e);
    }
  };
  useEffect(() => {
    if (userEmail || userId) fetchAccess();
  }, [userEmail, userId]);

  const verifyGuard = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/payment/callback") return;
    if (verifyGuard.current) return;
    verifyGuard.current = true;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("reference") || localStorage.getItem("paystack_ref");
    if (!ref) {
      window.history.replaceState({}, "", "/");
      window.location.href = "/";
      return;
    }
    if (sessionStorage.getItem("verifying") === ref) return;
    sessionStorage.setItem("verifying", ref);
    fetch(`${API_BASE}/api/payment/subscribe/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference: ref }),
    })
      .then((r) => r.json())
      .then((d) => {
        localStorage.removeItem("paystack_ref");
        sessionStorage.removeItem("verifying");
        if (d.success) {
          if (d.access) setAccess(d.access);
          window.history.replaceState({}, "", "/");
          window.location.href = "/";
        } else {
          alert("Payment verification failed");
          window.history.replaceState({}, "", "/");
        }
      })
      .catch((err) => {
        sessionStorage.removeItem("verifying");
        alert("Verify error: " + err.message);
      });
  }, []);

  if (
    typeof window !== "undefined" &&
    window.location.pathname === "/payment/callback"
  )
    return (
      <div className="min-h-screen bg-[#080C18] grid place-items-center text-white p-4 text-center">
        <div>
          <div className="text-[40px]">⏳</div>
          <div className="mt-2 font-black">Verifying payment...</div>
          <div className="text-slate-400 text-[12px] mt-1">
            Please wait, unlocking full mode
          </div>
        </div>
      </div>
    );
  if (typeof window !== "undefined" && window.location.pathname === "/admin")
    return <Admin />;
  if (
    typeof window !== "undefined" &&
    window.location.pathname === "/cbt-setup"
  )
    return <CBTSetup />;
  if (typeof window !== "undefined" && window.location.pathname === "/cbt-exam")
    return <CBTExam />;
  if (
    typeof window !== "undefined" &&
    window.location.pathname === "/cbt-result"
  )
    return <CBTResult />;
  if (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/cbt-review")
  )
    return <CbtReview />;
  if (
    typeof window !== "undefined" &&
    window.location.pathname === "/cbt-drill"
  )
    return <CBTDrillSetup />;
  if (
    typeof window !== "undefined" &&
    window.location.pathname === "/cbt-drill-run"
  )
    return <CBTDrill />;
  if (
    typeof window !== "undefined" &&
    window.location.pathname === "/cbt-drill-result"
  )
    return <CBTDrillResult />;
  if (
    typeof window !== "undefined" &&
    window.location.pathname === "/cbt-drill-review"
  )
    return <CBTDrillReview />;
  if (
    typeof window !== "undefined" &&
    window.location.pathname === "/admin/topics"
  )
    return <AdminTopics />;

  if (
    typeof window !== "undefined" &&
    window.location.pathname === "/reviews"
  ) {
    return <Reviews />;
  }
  const isEnglishRoom = room === "english-room";
  const hasFullAccess = access?.tier === "full_access";
  const canAccessCurrentRoom = isEnglishRoom || hasFullAccess;

  const joinRoom = (id) => {
    const isEnglish = id === "english-room";
    if (!isEnglish && !hasFullAccess) {
      setShowPaywall(true);
      return;
    }
    if (!username) return;
    setCurrentQ(null);
    setQNumber(0);
    setTimer(60);
    setExpiresAt(null);
    setSelected(null);
    setFeedback(null);
    setHasAnswered(false);
    setIsLocked(false);
    setLockedWinner(null);
    if (showChat && room !== id) {
      socket.emit("leave_room", { room, username });
      setMessages([]);
      setPrivateConversations({});
      setUnreadDMs({});
      setActiveChat("room");
      setMyScore(0);
      setMyStreak(0);
      setRoomUsers([]);
    }
    setRoom(id);
    setShowChat(true);
    socket.emit("join_room", { room: id, username });
  };

  const handleBackToLobby = () => {
    if (room && username) {
      socket.emit("leave_room", { room, username });
    }
    setShowChat(false);
    setMessages([]);
    setPrivateConversations({});
    setUnreadDMs({});
    setActiveChat("room");
    setMyScore(0);
    setMyStreak(0);
    setRoomUsers([]);
  };

  const handleSubjectClick = (id) => {
    const isEnglish = id === "english-room";
    if (!isEnglish && !hasFullAccess) {
      setShowPaywall(true);
      return;
    }
    if (palaceMode === "scholar")
      window.location.href = `/cbt-setup?subject=${id}`;
    else joinRoom(id);
  };
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };
  const answer = (opt) => {
    if (!canAccessCurrentRoom) {
      setShowPaywall(true);
      return;
    }
    if (hasAnswered || isLocked) return;
    setSelected(opt);
    setHasAnswered(true);
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 600;
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.08);
    } catch {}
    socket.emit("answer_question", { room, username, answer: opt });
  };
  const handleLogout = () => {
    localStorage.removeItem("jambite_user");
    setAuthedUser(null);
    setShowChat(false);
    if (room && username) {
      socket.emit("leave_room", { room, username });
    }
  };

  useEffect(() => {
    socket.off("receive_message");
    socket.off("new_question");
    socket.off("answer_result");
    socket.off("question_locked");
    socket.off("answer_rejected");
    socket.off("show_leaderboard");
    socket.off("roomUsers");
    socket.off("update_users");
    socket.off("userJoined");
    socket.off("userLeft");
    socket.off("update_scores");
    socket.off("private_message");
    socket.off("access_denied");
    socket.on("receive_message", (d) =>
      setMessages((m) => [...m, { ...d, type: "chat" }]),
    );
    socket.on("private_message", (d) => {
      const otherUser = d.from === username ? d.to : d.from;
      const msgObj = {
        from: d.from,
        to: d.to,
        message: d.message,
        type: "dm",
        ts: d.ts || Date.now(),
      };
      setPrivateConversations((prev) => ({
        ...prev,
        [otherUser]: [...(prev[otherUser] || []), msgObj],
      }));
      if (d.from !== username) {
        setUnreadDMs((prev) => ({
          ...prev,
          [otherUser]: (prev[otherUser] || 0) + 1,
        }));
        showToast(`✉️ New DM from ${d.from}`);
      }
    });
    socket.on("new_question", (d) => {
      const incoming = (d.subject || "").toLowerCase();
      const current = room.replace("-room", "").toLowerCase();
      const norm = (s) => (s === "mathematics" ? "maths" : s);
      if (incoming && norm(incoming) !== norm(current)) return;
      setCurrentQ(d.question);
      setQNumber(d.qNumber);
      setExpiresAt(d.expiresAt);
      setSelected(null);
      setFeedback(null);
      setHasAnswered(false);
      setIsLocked(false);
      setLockedWinner(null);
      setTimer(Math.max(0, Math.ceil((d.expiresAt - Date.now()) / 1000)));
    });
    socket.on("answer_result", (d) => {
      if (d.username === username) {
        setMyScore(d.score);
        setMyStreak((s) => (d.isCorrect ? s + 1 : 0));
        setFeedback({ correct: d.correct, isCorrect: d.isCorrect });
        if (!isLocked)
          showToast(
            d.isCorrect ? `✅ CORRECT! +1` : `❌ WRONG! Correct: ${d.correct}`,
          );
      } else if (d.isCorrect) showToast(`⚡ ${d.username} got it!`);
    });
    socket.on("question_locked", (data) => {
      setIsLocked(true);
      setLockedWinner(data.winner);
      showToast(data.message);
      setFeedback((p) => ({ ...p, correct: data.correct }));
    });
    socket.on("answer_rejected", (data) => {
      showToast(`🔒 ${data.reason}`);
      setIsLocked(true);
      setLockedWinner(data.winner);
    });
    socket.on("show_leaderboard", (data) => {
      setPrevLeaderboardData(leaderboardData.length ? leaderboardData : null);
      setLeaderboardData(
        [...data.leaderboard].sort((a, b) => (b.score || 0) - (a.score || 0)),
      );
      setShowLeaderboard(true);
    });
    const handleRoomUsers = (users) => setRoomUsers(users);
    socket.on("roomUsers", handleRoomUsers);
    socket.on("update_users", handleRoomUsers);
    socket.on("update_scores", handleRoomUsers);
    socket.on("userJoined", ({ username: u }) =>
      setMessages((m) => [
        ...m,
        { type: "system", eventType: "joined", username: u },
      ]),
    );
    socket.on("userLeft", ({ username: u }) =>
      setMessages((m) => [
        ...m,
        { type: "system", eventType: "left", username: u },
      ]),
    );
    return () => {
      socket.off("receive_message");
      socket.off("new_question");
      socket.off("answer_result");
      socket.off("question_locked");
      socket.off("answer_rejected");
      socket.off("show_leaderboard");
      socket.off("roomUsers");
      socket.off("update_users");
      socket.off("userJoined");
      socket.off("userLeft");
      socket.off("update_scores");
      socket.off("private_message");
    };
  }, [room, username, isLocked, leaderboardData]);

  useEffect(() => {
    if (!expiresAt) return;
    const iv = setInterval(
      () => setTimer(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))),
      200,
    );
    return () => clearInterval(iv);
  }, [expiresAt]);
  useEffect(() => {
    if (activeChat !== "room")
      setUnreadDMs((prev) => ({ ...prev, [activeChat]: 0 }));
  }, [activeChat]);

  if (!authedUser)
    return (
      <Auth
        onAuth={(u) => {
          setAuthedUser(u);
          setRoom(u.subject || "english-room");
        }}
      />
    );

  if (!showChat) {
    return (
      <div className="min-h-screen w-full bg-[#050A14] relative flex justify-center items-start py-6 px-4 overflow-hidden">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600&family=Permanent+Marker&family=Cinzel:wght@800&display=swap');
          @keyframes drift {
            0% { transform: translate(0px, 0px); }
            25% { transform: translate(18px, -18px); }
            50% { transform: translate(-14px, -32px); }
            75% { transform: translate(12px, -12px); }
            100% { transform: translate(0px, 0px); }
          }
          @keyframes blinkNeon {
            0%,100% { opacity: 1; }
            8% { opacity: 0.2; }
            10% { opacity: 1; }
            45% { opacity: 0.7; }
            60% { opacity: 0.1; }
            62% { opacity: 1; }
          }
          @keyframes rotateSlow { 0%{transform: rotate(0deg)} 100%{transform: rotate(360deg)} }
          @keyframes pulseAtom { 0%,100%{transform: scale(1)} 50%{transform: scale(1.15)} }
        `}</style>

        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 0,
            overflow: "hidden",
            filter: hovered ? "brightness(1.6)" : "brightness(1)",
            transition: "filter 0.4s ease",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "4%",
              top: "6%",
              animation: "drift 6s ease-in-out infinite",
            }}
          >
            <div
              style={{
                animation: "blinkNeon 1.6s infinite",
                color: "#38BDF8",
                fontSize: "52px",
                fontFamily: "Permanent Marker",
                textShadow: hovered
                  ? "0 0 40px #38BDF8, 0 0 80px #38BDF8"
                  : "0 0 20px #38BDF8",
                transform: "rotate(-8deg)",
                transition: "text-shadow 0.4s",
              }}
            >
              E = mc²
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: "2%",
              top: "26%",
              animation: "drift 7s ease-in-out infinite",
              animationDelay: "0.3s",
            }}
          >
            <div
              style={{
                animation: "blinkNeon 2.2s infinite",
                color: "#7DD3FC",
                fontSize: "18px",
                fontFamily: "Caveat",
                animationDelay: "0.2s",
                transform: "rotate(-4deg)",
              }}
            >
              x = (-b ± √(b²-4ac)) / 2a
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: "74%",
              top: "5%",
              animation: "drift 5.5s ease-in-out infinite",
              animationDelay: "0.6s",
            }}
          >
            <div
              style={{
                animation: "blinkNeon 1.4s infinite",
                color: "#FDE68A",
                fontSize: "34px",
                fontFamily: "Permanent Marker",
                textShadow: hovered ? "0 0 40px #FDE68A" : "0 0 18px #FDE68A",
                animationDelay: "0.4s",
                transform: "rotate(6deg)",
              }}
            >
              e^iπ + 1 = 0
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: "4%",
              top: "42%",
              animation: "drift 6.5s ease-in-out infinite",
            }}
          >
            <div
              style={{
                animation: "blinkNeon 2.4s infinite",
                color: "#22D3EE",
                fontSize: "42px",
                fontFamily: "Permanent Marker",
                textShadow: "0 0 18px #22D3EE",
                transform: "rotate(8deg)",
              }}
            >
              H₂O
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: "72%",
              top: "30%",
              animation: "drift 7s ease-in-out infinite",
              animationDelay: "0.8s",
            }}
          >
            <div
              style={{
                animation: "blinkNeon 2s infinite",
                color: "#BAE6FD",
                fontSize: "16px",
                fontFamily: "Caveat",
                transform: "rotate(-2deg)",
              }}
            >
              ∫ eˣ dx = eˣ + C
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: "81%",
              top: "58%",
              animation: "drift 5s ease-in-out infinite",
              animationDelay: "1s",
            }}
          >
            <div
              style={{
                animation: "blinkNeon 1.8s infinite",
                color: "#fff",
                fontSize: "32px",
                fontFamily: "Permanent Marker",
                textShadow: hovered ? "0 0 30px #fff" : "0 0 14px #fff",
                transform: "rotate(-6deg)",
              }}
            >
              F = ma
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: "2%",
              top: "64%",
              animation: "drift 8s ease-in-out infinite",
            }}
          >
            <div
              style={{
                animation: "blinkNeon 2s infinite",
                color: "#38BDF8",
                fontSize: "16px",
                fontFamily: "Caveat",
                transform: "rotate(4deg)",
              }}
            >
              ∑ 1/n² = π²/6
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: "32%",
              top: "90%",
              animation: "drift 6s ease-in-out infinite",
            }}
          >
            <div
              style={{
                animation: "blinkNeon 2.1s infinite",
                color: "#FDE68A",
                fontSize: "20px",
                fontFamily: "Caveat",
                transform: "rotate(-8deg)",
              }}
            >
              a² + b² = c²
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: "71%",
              top: "88%",
              animation: "drift 6.5s ease-in-out infinite",
            }}
          >
            <div
              style={{
                animation: "blinkNeon 2.3s infinite",
                color: "#FDE68A",
                fontSize: "28px",
                fontFamily: "Permanent Marker",
                textShadow: "0 0 14px #FDE68A",
                transform: "rotate(5deg)",
              }}
            >
              PV = nRT
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: "83%",
              top: "74%",
              animation: "drift 7s ease-in-out infinite",
            }}
          >
            <div
              style={{
                animation: "blinkNeon 1.7s infinite",
                color: "#7DD3FC",
                fontSize: "18px",
                fontFamily: "Caveat",
                transform: "rotate(7deg)",
              }}
            >
              λ = h/p
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: "82%",
              top: "42%",
              animation: "drift 8s ease-in-out infinite, blinkNeon 3s infinite",
            }}
          >
            <svg
              width="90"
              height="90"
              viewBox="0 0 100 100"
              style={{
                transform: "rotate(-12deg)",
                filter: "drop-shadow(0 0 12px #FDE68A)",
              }}
            >
              <polygon
                points="50,5 85,25 85,65 50,85 15,65 15,25"
                fill="none"
                stroke="#FDE68A"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              <polygon
                points="50,18 72,30 72,58 50,70 28,58 28,30"
                fill="none"
                stroke="#FDE68A"
                strokeWidth="2"
                opacity="0.6"
              />
              <circle cx="50" cy="5" r="6" fill="#FDE68A" />
              <circle cx="85" cy="25" r="6" fill="#FDE68A" />
              <circle cx="85" cy="65" r="6" fill="#FDE68A" />
              <circle cx="50" cy="85" r="6" fill="#FDE68A" />
              <circle cx="15" cy="65" r="6" fill="#FDE68A" />
              <circle cx="15" cy="25" r="6" fill="#FDE68A" />
            </svg>
          </div>
          <div
            style={{
              position: "absolute",
              left: "1%",
              top: "70%",
              animation: "drift 10s ease-in-out infinite",
              opacity: 0.7,
            }}
          >
            <svg
              width="120"
              height="70"
              viewBox="0 0 120 70"
              style={{
                transform: "rotate(8deg)",
                filter: "drop-shadow(0 0 10px #7DD3FC)",
              }}
            >
              <polygon
                points="5,35 25,10 55,10 75,35 55,60 25,60"
                fill="none"
                stroke="#7DD3FC"
                strokeWidth="2"
              />
              <polygon
                points="55,10 85,10 105,35 85,60 55,60"
                fill="none"
                stroke="#7DD3FC"
                strokeWidth="2"
              />
              <line
                x1="30"
                y1="18"
                x2="50"
                y2="18"
                stroke="#7DD3FC"
                strokeWidth="1.5"
              />
              <line
                x1="15"
                y1="35"
                x2="15"
                y2="50"
                stroke="#7DD3FC"
                strokeWidth="1.5"
              />
            </svg>
          </div>
          <div
            style={{
              position: "absolute",
              left: "6%",
              top: "78%",
              animation:
                "drift 8s ease-in-out infinite, pulseAtom 3s ease-in-out infinite",
            }}
          >
            <svg
              width="110"
              height="110"
              viewBox="0 0 100 100"
              style={{ filter: "drop-shadow(0 0 14px #38BDF8)" }}
            >
              <circle cx="50" cy="50" r="8" fill="#38BDF8" />
              <ellipse
                cx="50"
                cy="50"
                rx="42"
                ry="18"
                fill="none"
                stroke="#38BDF8"
                strokeWidth="2"
                transform="rotate(0 50 50)"
              />
              <ellipse
                cx="50"
                cy="50"
                rx="42"
                ry="18"
                fill="none"
                stroke="#38BDF8"
                strokeWidth="2"
                transform="rotate(60 50 50)"
              />
              <ellipse
                cx="50"
                cy="50"
                rx="42"
                ry="18"
                fill="none"
                stroke="#38BDF8"
                strokeWidth="2"
                transform="rotate(120 50 50)"
              />
              <circle
                cx="92"
                cy="50"
                r="4"
                fill="#22D3EE"
                style={{
                  animation: "rotateSlow 3s linear infinite",
                  transformOrigin: "50px 50px",
                }}
              />
            </svg>
          </div>
          <div
            style={{
              position: "absolute",
              left: "8%",
              top: "12%",
              animation: "drift 7s ease-in-out infinite",
              opacity: 0.5,
            }}
          >
            <svg
              width="50"
              height="60"
              viewBox="0 0 50 60"
              style={{ transform: "rotate(-10deg)" }}
            >
              <path
                d="M15 5 L15 35 L5 50 L45 50 L35 35 L35 5 Z"
                fill="none"
                stroke="#22D3EE"
                strokeWidth="2"
              />
              <path
                d="M10 42 Q25 48 40 42"
                stroke="#22D3EE"
                strokeWidth="2"
                fill="none"
              />
              <circle cx="20" cy="46" r="2" fill="#22D3EE" opacity="0.6">
                <animate
                  attributeName="cy"
                  values="46;30;46"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
            </svg>
          </div>
          <div
            style={{
              position: "absolute",
              left: "60%",
              top: "76%",
              animation: "drift 6s ease-in-out infinite, blinkNeon 2s infinite",
            }}
          >
            <svg
              width="44"
              height="60"
              viewBox="0 0 44 60"
              style={{ filter: "drop-shadow(0 0 12px #FDE68A)" }}
            >
              <path
                d="M22 2 C10 2 2 12 2 24 C2 34 10 42 14 46 L14 54 L30 54 L30 46 C34 42 42 34 42 24 C42 12 34 2 22 2 Z"
                fill="none"
                stroke="#FDE68A"
                strokeWidth="2.5"
              />
              <path
                d="M14 54 L30 54 L28 58 L16 58 Z"
                fill="#FDE68A"
                opacity="0.8"
              />
              <text
                x="50%"
                y="30"
                dominantBaseline="middle"
                textAnchor="middle"
                fontSize="20"
              >
                💡
              </text>
            </svg>
          </div>
          <div
            style={{
              position: "absolute",
              left: "18%",
              top: "82%",
              animation: "drift 9s ease-in-out infinite",
              opacity: 0.6,
            }}
          >
            <svg width="120" height="60" viewBox="0 0 120 60">
              <line
                x1="0"
                y1="5"
                x2="120"
                y2="5"
                stroke="#fff"
                strokeWidth="2"
                opacity="0.4"
              />
              <g>
                <line
                  x1="20"
                  y1="5"
                  x2="20"
                  y2="35"
                  stroke="#fff"
                  strokeWidth="1.2"
                />
                <circle
                  cx="20"
                  cy="45"
                  r="8"
                  fill="none"
                  stroke="#FDE68A"
                  strokeWidth="2"
                />
              </g>
              <g>
                <line
                  x1="50"
                  y1="5"
                  x2="50"
                  y2="35"
                  stroke="#fff"
                  strokeWidth="1.2"
                />
                <circle
                  cx="50"
                  cy="45"
                  r="8"
                  fill="none"
                  stroke="#7DD3FC"
                  strokeWidth="2"
                />
              </g>
              <g>
                <line
                  x1="80"
                  y1="5"
                  x2="80"
                  y2="35"
                  stroke="#fff"
                  strokeWidth="1.2"
                />
                <circle
                  cx="80"
                  cy="45"
                  r="8"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="2"
                />
              </g>
            </svg>
          </div>
          <div
            style={{
              position: "absolute",
              width: "300px",
              height: "300px",
              background:
                "radial-gradient(circle, rgba(56,189,248,0.2) 0%, transparent 70%)",
              top: "10%",
              left: "20%",
              filter: "blur(20px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: "250px",
              height: "250px",
              background:
                "radial-gradient(circle, rgba(251,191,36,0.15) 0%, transparent 70%)",
              top: "60%",
              right: "5%",
              filter: "blur(25px)",
            }}
          />
        </div>

        {showPaywall && (
          <PaywallModal
            access={access}
            userId={userId}
            email={userEmail}
            onClose={() => setShowPaywall(false)}
          />
        )}

        <div className="relative z-10 w-[640px] max-w-[95vw]">
          <div className="text-center">
            <div
              className="font-black text-[42px] tracking-tight drop-shadow-[0_0_24px_rgba(56,189,248,0.6)]"
              style={{ fontFamily: "Cinzel" }}
            >
              <span className="text-white">SCHOLARS'</span>
              <span className="text-[#38BDF8]">•</span>
              <span className="text-white">HAVEN</span>
            </div>
            <p className="text-slate-400 text-[13px] mt-1">
              Welcome back,Scholar-{" "}
              <span className="text-white font-bold">{username} 👑</span> •{" "}
              {hasFullAccess
                ? `✅ ${access.status} • ${access.daysLeft}d left`
                : `🔓 Free Zone — English Only`}
            </p>
          </div>

          {/* === OPTION B + SUBSCRIBE DURING TRIAL FIX === */}
          {hasFullAccess ? (
            <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-[14px] px-4 py-2.5 flex justify-between items-center backdrop-blur-xl gap-2">
              <span className="text-emerald-300 text-[12px] font-bold shrink-0">
                👑{" "}
                {access.status === "trial"
                  ? `🎁 Trial: ${access.daysLeft}d left`
                  : `Active Pass: ${access.daysLeft}d left`}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 text-[11px] hidden md:inline">
                  All 11 rooms unlocked
                </span>
                {access.status === "trial" && (
                  <button
                    onClick={() => setShowPaywall(true)}
                    className="bg-amber-400 text-black text-[11px] font-black px-3.5 py-1.5 rounded-full shadow-[0_0_20px_rgba(251,191,36,0.4)] hover:scale-105 transition"
                  >
                    Upgrade Now — Keep {access.daysLeft}d +{" "}
                    {VITALS.SUBSCRIPTION.DURATION_DAYS}d 👑
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 bg-amber-400/10 border border-amber-400/20 rounded-[14px] px-4 py-3 flex justify-between items-center backdrop-blur-xl">
              <div>
                <div className="text-amber-200 text-[12px] font-bold">
                  🔓 Free Zone — English Only
                </div>
                <div className="text-amber-200/60 text-[11px]">
                  Unlock all for {VITALS.SUBSCRIPTION.LABEL}
                </div>
              </div>
              <button
                onClick={() => setShowPaywall(true)}
                className="bg-amber-400 text-black text-[11px] font-black px-3.5 py-1.5 rounded-full"
              >
                Unlock 👑
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
            <button
              onClick={() => {
                if (!hasFullAccess) {
                  setShowPaywall(true);
                  return;
                }
                setPalaceMode("scholar");
              }}
              className={`text-left p-[16px] rounded-[20px] border backdrop-blur-xl bg-[#121A2E]/80 ${palaceMode === "scholar" ? "border-violet-500/50 shadow-[0_0_30px_rgba(139,92,246,0.3)]" : "border-white/10"} ${!hasFullAccess ? "opacity-60" : ""}`}
            >
              <div className="w-9 h-9 rounded-xl bg-violet-500/15 grid place-items-center">
                🎯
              </div>
              <div className="mt-3 font-extrabold text-[13px] text-white">
                CBT Practice {!hasFullAccess && "🔒"}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                4 subjects, Controlled timing.
              </div>
            </button>
            <button
              onClick={() => {
                if (!hasFullAccess) {
                  setShowPaywall(true);
                  return;
                }
                window.location.href = "/cbt-drill";
              }}
              className={`text-left p-[16px] rounded-[20px] border backdrop-blur-xl bg-[#121A2E]/80 border-emerald-500/20 ${!hasFullAccess ? "opacity-60" : ""}`}
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 grid place-items-center">
                🏆
              </div>
              <div className="mt-3 font-extrabold text-[13px] text-white">
                Drill Palace {!hasFullAccess && "🔒"}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Topic by topic mastery.
              </div>
            </button>
            <button
              onClick={() => setPalaceMode("arena")}
              className={`text-left p-[16px] rounded-[20px] border backdrop-blur-xl bg-[#121A2E]/80 ${palaceMode === "arena" ? "border-sky-400/50 shadow-[0_0_30px_rgba(56,189,248,0.3)]" : "border-white/10"}`}
            >
              <div className="w-9 h-9 rounded-xl bg-sky-400/15 grid place-items-center">
                ▶️
              </div>
              <div className="mt-3 font-extrabold text-[13px] text-white">
                Live Room Quiz
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Wake up the Scholar in you!.
              </div>
            </button>
          </div>

          <div className="mt-4 mb-3 text-[11px] text-sky-300/70 uppercase text-center tracking-[0.18em] font-black">
            ⚗️ CHOOSE YOUR BATTLEFIELD — SCULPT YOUR MIND ⚗️
          </div>

          <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="grid grid-cols-2 gap-2.5"
          >
            {SUBJECTS.map((s) => {
              const isEnglish = s.id === "english-room";
              const locked = !isEnglish && !hasFullAccess;
              return (
                <button
                  key={s.id}
                  onClick={() => handleSubjectClick(s.id)}
                  className={`relative p-[18px] rounded-[16px] border font-extrabold text-[13px] backdrop-blur-xl transition-all hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(56,189,248,0.4)] ${s.id === room ? "bg-sky-400 border-sky-400 text-black shadow-[0_0_30px_rgba(56,189,248,0.6)]" : locked ? "bg-[#121A2E]/40 border-white/5 text-slate-500" : "bg-[#141E2F]/80 border-white/10 text-white hover:border-sky-400/50"}`}
                >
                  {s.label} {locked ? "🔒" : "✅"}
                </button>
              );
            })}
          </div>

          <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/5">
            <div className="text-[11px] text-slate-600">
              {VITALS.SUBSCRIPTION.NAME} • {VITALS.SUBSCRIPTION.LABEL} • Nerd
              Mode ON
            </div>
            <button
              onClick={handleLogout}
              className="border border-white/10 text-slate-500 text-[11px] px-3.5 py-1.5 rounded-full"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const opts = currentQ
    ? [
        { k: "A", v: currentQ.option_a },
        { k: "B", v: currentQ.option_b },
        { k: "C", v: currentQ.option_c },
        { k: "D", v: currentQ.option_d },
      ]
    : [];
  const TOTAL = 60;
  const prog = Math.max(0, Math.min(1, timer / TOTAL));
  const R = 26;
  const C = 2 * Math.PI * R;
  const off = C * (1 - prog);
  const urgent = timer <= 10 && timer > 0;

  return (
    <div className="w-full h-screen bg-[#050A14] overflow-hidden font-['Inter',sans-serif] relative flex flex-col">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700;800&display=swap'); @keyframes pulse-red { 0%{transform:scale(1); box-shadow:0 0 0 0 rgba(239,68,68,0.7)} 70%{transform:scale(1.08); box-shadow:0 0 0 14px rgba(239,68,68,0)} 100%{transform:scale(1); box-shadow:0 0 0 0 rgba(239,68,68,0)} } @keyframes flicker { 0%,100%{transform:scale(1) rotate(-2deg); filter:brightness(1)} 25%{transform:scale(1.25) rotate(2deg); filter:brightness(1.4)} 50%{transform:scale(0.9) rotate(-1deg)} 75%{transform:scale(1.15) rotate(1deg)} } @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} } @keyframes pop { 0%{transform:scale(0.96)} 60%{transform:scale(1.02)} 100%{transform:scale(1)} } .glass-card{ background: rgba(30, 41, 59, 0.8); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(56, 189, 248, 0.3); box-shadow: 0 0 90px rgba(56,189,248,0.12), inset 0 1px 0 rgba(255,255,255,0.08); } .option-btn{ transition: all 0.18s cubic-bezier(.34,1.56,.64,1); } .option-btn:hover{ transform: translateY(-2px) scale(1.01); box-shadow: 0 0 32px rgba(56,189,248,0.35); border-color: rgba(56,189,248,0.9) !important; }`}</style>
      {showPaywall && (
        <PaywallModal
          access={access}
          userId={userId}
          email={userEmail}
          onClose={() => setShowPaywall(false)}
        />
      )}
      {toast && (
        <div className="fixed top-[88px] left-1/2 -translate-x-1/2 bg-[#121A2E]/95 border border-sky-400/40 text-white px-6 py-3 rounded-full z-[100] text-[13px] font-bold shadow-[0_0_40px_rgba(56,189,248,0.4)] animate-[pop_0.3s]">
          {toast}
        </div>
      )}
      {showLeaderboard && (
        <LeaderboardModal
          leaderboardData={leaderboardData}
          qNumber={qNumber}
          username={username}
          room={room}
          myStreak={myStreak}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
      <div className="h-[76px] w-full bg-[#0A1224]/95 backdrop-blur-xl border-b border-white/[0.08] flex items-center justify-between px-5 md:px-7 z-20">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-sky-400 to-cyan-300 grid place-items-center font-black text-black text-[14px] shadow-[0_0_24px_rgba(56,189,248,0.6)]">
            {username[0]?.toUpperCase()}
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3.5 py-1.5 rounded-full bg-white/[0.08] border border-white/10 text-white text-[11px] font-black tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-[glow-pulse_1s_infinite]" />
              {room.replace("-room", "").toUpperCase()}
            </div>
            <div className="px-3.5 py-1.5 rounded-full bg-[#1e293b] border border-amber-400/30 text-white text-[11px] font-black tracking-wide flex items-center gap-1">
              <span>{myStreak}</span>
              <span
                style={{
                  animation: "flicker 0.7s infinite",
                  display: "inline-block",
                }}
              >
                🔥
              </span>
              <span className="text-amber-300">STREAK</span>
            </div>
            <div className="hidden md:flex px-3 py-1.5 rounded-full bg-[#0F172A] text-slate-400 text-[11px] font-bold">
              {myScore} pts •{" "}
              <button
                onClick={handleBackToLobby}
                className="ml-2 text-sky-400 hover:text-white"
              >
                ← Lobby
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isLocked && (
            <div className="hidden md:flex px-3.5 py-1.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 text-[11px] font-black tracking-widest">
              🔒 LOCKED by {lockedWinner}
            </div>
          )}
          <div
            className="relative w-[62px] h-[62px] grid place-items-center"
            style={urgent ? { animation: "pulse-red 0.85s infinite" } : {}}
          >
            <svg
              className="absolute w-full h-full -rotate-90"
              viewBox="0 0 62 62"
            >
              <circle
                cx="31"
                cy="31"
                r={R}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="4"
              />
              <circle
                cx="31"
                cy="31"
                r={R}
                fill="none"
                stroke={urgent ? "#EF4444" : "#38BDF8"}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={off}
                style={{
                  transition: "stroke-dashoffset 0.2s linear, stroke 0.3s ease",
                }}
              />
            </svg>
            <div
              className={`font-black text-[14px] tracking-tighter ${urgent ? "text-[#EF4444]" : "text-white"}`}
              style={{ fontFamily: "Space Grotesk" }}
            >
              {timer}s
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] overflow-hidden">
        <div className="relative flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-sky-500/[0.07] rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-violet-500/[0.05] rounded-full blur-[100px] pointer-events-none" />
          {currentQ ? (
            <div
              className="w-full max-w-[760px] z-10"
              style={{
                animation:
                  feedback && !feedback.isCorrect
                    ? "shake 0.45s"
                    : "pop 0.35s cubic-bezier(.34,1.56,.64,1)",
              }}
            >
              <div className="flex justify-between items-center mb-3.5 px-1">
                <span className="text-sky-300/70 text-[11px] font-black tracking-[0.22em]">
                  QUESTION {qNumber} / ARENA MODE
                </span>
                <span className="text-slate-500 text-[10px] font-bold tracking-widest">
                  ⚡ FIRST CORRECT LOCKS QUESTION
                </span>
              </div>
              <div className="glass-card rounded-[28px] p-6 md:p-8">
                <h2
                  className="text-white text-[21px] md:text-[26px] font-[800] leading-[1.25] tracking-tight"
                  dangerouslySetInnerHTML={{ __html: currentQ.question_text }}
                />
                <div className="grid gap-3.5 mt-7">
                  {opts.map((o) => {
                    const isSelected = selected === o.k;
                    const isCorrect = feedback?.correct === o.k;
                    const isWrongSelected =
                      isSelected && feedback && !feedback.isCorrect;
                    let wrap = "bg-[#0F172A] border-white/10 text-slate-200";
                    if (feedback) {
                      if (isCorrect)
                        wrap =
                          "bg-emerald-500/20 border-emerald-400 text-white shadow-[0_0_50px_rgba(16,185,129,0.45)]";
                      else if (isWrongSelected)
                        wrap =
                          "bg-red-500/20 border-red-400/60 text-white shadow-[0_0_30px_rgba(239,68,68,0.3)]";
                    } else if (isSelected)
                      wrap =
                        "bg-sky-400 border-sky-400 text-black shadow-[0_0_40px_rgba(56,189,248,0.6)]";
                    return (
                      <button
                        key={o.k}
                        onClick={() => answer(o.k)}
                        disabled={hasAnswered || isLocked}
                        className={`option-btn w-full text-left p-[16px] md:p-[18px] rounded-[18px] border-2 flex items-center gap-4 ${wrap}`}
                      >
                        <span
                          className={`w-11 h-11 rounded-[12px] grid place-items-center font-black text-[13px] shrink-0 border-2 transition-all ${isSelected && !feedback ? "bg-black text-sky-400 border-black" : isCorrect && feedback ? "bg-emerald-400 text-black border-emerald-400" : "bg-[#1e293b] text-sky-300 border-white/10"}`}
                        >
                          {o.k}
                        </span>
                        <span className="text-[15px] md:text-[16px] font-semibold tracking-wide flex-1">
                          {o.v}
                        </span>
                        {isCorrect && feedback && (
                          <span className="ml-auto text-[22px]">✨</span>
                        )}
                        {isWrongSelected && (
                          <span className="ml-auto text-[18px]">💥</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-[28px] p-12 text-center max-w-[480px] z-10">
              <div className="text-[44px] animate-pulse">⚔️</div>
              <div className="text-white font-black text-[18px] mt-3 tracking-tight">
                Arena Loading...
              </div>
              <div className="text-slate-400 text-[13px] mt-1">
                Next question dropping in 3...2...1
              </div>
            </div>
          )}
        </div>
        <div className="hidden lg:flex w-full max-w-[360px] bg-[#080C18]/70 border-l border-white/10 flex-col p-3.5 gap-3.5 backdrop-blur-xl">
          <ParticipantsList
            users={
              roomUsers.length ? roomUsers : [{ username, score: myScore }]
            }
            currentUsername={username}
            activeChat={activeChat}
            setActiveChat={setActiveChat}
            unreadDMs={unreadDMs}
            setUnreadDMs={setUnreadDMs}
          />
          <ChatPanel
            activeChat={activeChat}
            setActiveChat={setActiveChat}
            messages={messages}
            privateConversations={privateConversations}
            chatMsg={chatMsg}
            setChatMsg={setChatMsg}
            hasAccess={canAccessCurrentRoom}
            room={room}
            username={username}
            socket={socket}
          />
        </div>
      </div>
      <ReviewFab />
    </div>
  );
}

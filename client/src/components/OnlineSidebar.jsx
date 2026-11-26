import { useState, useEffect } from "react";
import { UNIFIED } from "../unified/unified.config";

export default function OnlineSidebar() {
  const [users, setUsers] = useState([]);
  const [count, setCount] = useState(0);

  const me = (() => {
    try {
      return JSON.parse(localStorage.getItem("jambite_user") || "{}");
    } catch {
      return {};
    }
  })();

  useEffect(() => {
    const beat = () => {
      if (!me?.username) return;
      fetch(`${UNIFIED.API_BASE}/api/presence/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: me.username,
          fullName: me.fullName || me.name || "",
        }),
      }).catch(() => {});
    };
    beat();
    const beatTimer = setInterval(beat, 30000);

    const load = () => {
      fetch(`${UNIFIED.API_BASE}/api/presence/online`)
        .then((r) => r.json())
        .then((d) => {
          setUsers(d.users || []);
          setCount(d.count || 0);
        })
        .catch(() => {});
    };
    load();
    const loadTimer = setInterval(load, 10000);
    return () => {
      clearInterval(beatTimer);
      clearInterval(loadTimer);
    };
  }, []);

  return (
    <aside className="hidden xl:block w-[260px] shrink-0">
      <div className="sticky top-6 rounded-[22px] border border-white/10 bg-[#0F172A]/80 backdrop-blur overflow-hidden">
        {/* Header - Classy */}
        <div className="px-4 pt-4 pb-3 border-b border-white/10">
          <p className="text-[10px] tracking-[0.25em] text-amber-400 font-bold">
            ✦ LIVE IN THE PALACE
          </p>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-[32px] leading-none font-black text-white">
              {count}
            </span>
            <span className="text-[12px] text-slate-400 pb-0.5">
              Scholars Online
            </span>
            <span className="ml-auto flex items-center gap-1 text-[10px] bg-emerald-400/10 text-emerald-300 px-2 py-1 rounded-full border border-emerald-400/20 font-bold">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />{" "}
              LIVE
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Updating automatically • No refresh
          </p>
        </div>

        {/* List */}
        <div className="max-h-[520px] overflow-y-auto p-2 space-y-1">
          {users.length === 0 && (
            <p className="text-center text-slate-500 text-[12px] py-8">
              No scholar online yet.
              <br />
              Be the first 👑
            </p>
          )}
          {users.map((u) => {
            const isMe =
              u.username?.toLowerCase() === me?.username?.toLowerCase();
            return (
              <div
                key={u.username}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl ${isMe ? "bg-amber-400/10 border border-amber-400/25" : "hover:bg-white/5"}`}
              >
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-black font-black text-[13px]">
                    {u.username?.[0]?.toUpperCase()}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#0F172A] rounded-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-white truncate">
                    @{u.username}{" "}
                    {isMe && (
                      <span className="text-[9px] bg-amber-400 text-black px-1.5 py-0.5 rounded-full ml-1">
                        YOU
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {u.fullName || "Scholar"}
                  </p>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold">
                  ●
                </span>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-white/10 bg-white/[0.02] text-center">
          <p className="text-[11px] text-slate-400">
            👑 <b className="text-amber-300">1,240+</b> Scholars don join Haven
          </p>
        </div>
      </div>
    </aside>
  );
}

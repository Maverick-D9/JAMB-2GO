// client/src/hooks/useLiveRank.js
import { useEffect, useState } from "react";
import { getLiveRank } from "../config/liveRanks";

export function useLiveRank(socket) {
  const [announcement, setAnnouncement] = useState(null);

  useEffect(() => {
    if (!socket) return;

    const onUpdate = (data) => {
      // Update user list in your room state here
      // setRoomUsers(prev => prev.map(u => u._id===data.userId ? {...u, liveCorrect: data.correctCount} : u))
    };

    const onAnnounce = (data) => {
      setAnnouncement(data.text);
      setTimeout(() => setAnnouncement(null), 4000);
    };

    socket.on("live:user:rankUpdate", onUpdate);
    socket.on("live:rank:announcement", onAnnounce);

    return () => {
      socket.off("live:user:rankUpdate", onUpdate);
      socket.off("live:rank:announcement", onAnnounce);
    };
  }, [socket]);

  return { announcement };
}

// client/src/hooks/useLiveRank.js
import { useEffect, useState } from "react";
import { getLiveRank } from "../config/liveRanks";

export function useLiveRank(socket) {
  const [announcement, setAnnouncement] = useState(null);

  useEffect(() => {
    if (!socket) return;
    const onUpdate = (data) => {
      console.log("rankUpdate data:", data);
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

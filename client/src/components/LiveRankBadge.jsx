import { getLiveRank } from "../config/liveRanks";

export function LiveUsername({ username, liveCorrect }) {
  const rank = getLiveRank(liveCorrect || 0);
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-bold">{username}</span>
      <span title={`${rank.name} - ${liveCorrect || 0} correct`}>
        {rank.icon}
      </span>
    </span>
  );
}

// client/src/unified/unified.api.js
import { UNIFIED, getUser } from "./unified.config";

export async function fetchUnifiedTests() {
  const r = await fetch(`${UNIFIED.API_BASE}/api/unified/tests`);
  return r.json();
}

export async function checkUnifiedAccess() {
  const u = getUser();
  const id = u.userId || u.username || u.email || "";
  if (!id) return { hasAccess: false };
  const r = await fetch(
    `${UNIFIED.API_BASE}/api/payment/access/${encodeURIComponent(id)}`,
  );
  const d = await r.json();
  const hasAccess =
    d.tier === "full_access" ||
    (d.tier === "trial" && (d.daysLeft ?? 0) > 0) ||
    d.isActive === true;
  return { hasAccess, data: d };
}

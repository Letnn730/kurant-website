// Admin endpoints are off unless ADMIN_TOKEN is set (a long random secret in the Pages settings).
// Call them with the header "Authorization: Bearer <ADMIN_TOKEN>".

import { json, sameSecret } from "./util.js";

export function denied(request, env) {
  if (!env.ADMIN_TOKEN) return json({ ok: false, error: "not_found" }, 404);
  const auth = request.headers.get("Authorization") || "";
  const given = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return sameSecret(given, env.ADMIN_TOKEN) ? null : json({ ok: false, error: "unauthorized" }, 401);
}

// Resend allows about 2 API requests per second on the default plan.
export const pace = () => new Promise((resolve) => setTimeout(resolve, 600));

export function limitParam(request, fallback, max) {
  const n = Number(new URL(request.url).searchParams.get("limit"));
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback;
}

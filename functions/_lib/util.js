// Shared helpers for the waitlist functions. No routes here: this folder exports no onRequest handlers.

export const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });

export const redirect = (location) =>
  new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store" } });

export const clip = (value, max) => String(value ?? "").trim().slice(0, max);
export const oneOf = (value, allowed) => (allowed.includes(value) ? value : "");

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const TOKEN_RE = /^[0-9a-f]{32}$/;
export const CODE_RE = /^[0-9a-z]{6}$/;

// One person, one entry: "Jo.Doe+kurant@gmail.com" and "jodoe@gmail.com" are the same inbox.
export function normEmail(email) {
  const at = email.lastIndexOf("@");
  let local = email.slice(0, at).toLowerCase();
  let domain = email.slice(at + 1).toLowerCase();
  local = local.split("+")[0];
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

export function randomHex(bytes) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Referral codes: 6 characters, no look-alikes (0/o, 1/l/i), easy to read aloud.
const CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export function randomCode() {
  const buf = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(buf, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time comparison for the admin token.
export function sameSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length === 0 || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const origin = (request) => new URL(request.url).origin;

export const thanksPath = (lang) => (lang === "en" ? "/en/thanks/" : "/merci/");
export const homePath = (lang) => (lang === "en" ? "/en/" : "/");

// Read a JSON body with a size cap. Returns null when the body is missing, too large or not JSON.
export async function readJson(request, maxBytes = 4096) {
  if (!(request.headers.get("Content-Type") || "").includes("application/json")) return null;
  if (Number(request.headers.get("Content-Length") || 0) > maxBytes) return null;
  try {
    const text = await request.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

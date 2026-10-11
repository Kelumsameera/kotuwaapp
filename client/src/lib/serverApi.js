import { headers } from "next/headers";

const API_URL = process.env.API_URL || "http://localhost:5050";

// The shopper's IP: the LAST X-Forwarded-For entry, which is the one our own reverse proxy
// (or Next.js itself) wrote. Earlier entries can be faked by the visitor, so they are dropped.
function shopperIp(forwardedFor) {
  const entries = (forwardedFor || "").split(",").map((entry) => entry.trim()).filter(Boolean);
  return entries[entries.length - 1] || "";
}

// Reads public data from the API while rendering a page on the server (GET only).
// Passes the shopper's IP along so the API's rate limit counts each shopper separately.
// Returns null for 404 so pages can show "not found".
export async function serverApi(path) {
  const incoming = await headers();
  const requestHeaders = {};
  const ip = shopperIp(incoming.get("x-forwarded-for"));
  if (ip) requestHeaders["x-forwarded-for"] = ip;

  const response = await fetch(`${API_URL}/api${path}`, { headers: requestHeaders, cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`API request failed: ${response.status} ${path}`);
  return response.json();
}

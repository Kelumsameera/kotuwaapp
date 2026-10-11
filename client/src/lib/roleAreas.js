// Which protected areas of the site each role may open.
// This only hides links and redirects early; the backend checks every request for real.
export const AREA_ROLES = {
  admin: ["super_admin"],
  seller: ["seller"],
  pos: ["seller", "seller_cashier"],
  rider: ["rider"],
  account: ["super_admin", "seller", "seller_cashier", "rider", "customer"],
  shopping: ["customer"],
};

// URL prefix → area name, used by proxy.js.
export const PROTECTED_PREFIXES = {
  "/admin": "admin",
  "/seller": "seller",
  "/pos": "pos",
  "/rider": "rider",
  "/account": "account",
  "/checkout": "shopping",
  "/wishlist": "shopping",
  "/orders": "shopping",
};

// Returns true when the role may open the area.
export function canOpenArea(role, area) {
  return Boolean(role && AREA_ROLES[area]?.includes(role));
}

// Finds which protected area a path belongs to (or null if it is public).
export function areaForPath(pathname) {
  const prefix = Object.keys(PROTECTED_PREFIXES).find(
    (candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`)
  );
  return prefix ? PROTECTED_PREFIXES[prefix] : null;
}

// The page a user lands on after logging in.
export function homePathForRole(role) {
  if (role === "super_admin") return "/admin";
  if (role === "seller") return "/seller";
  if (role === "seller_cashier") return "/pos";
  if (role === "rider") return "/rider";
  return "/";
}

// Only allow redirects to our own pages (blocks "?next=https://evil.com" tricks).
export function safeNextPath(next) {
  if (typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

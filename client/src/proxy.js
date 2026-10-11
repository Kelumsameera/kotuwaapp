import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { areaForPath, canOpenArea } from "@/lib/roleAreas";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET || "");

if (!process.env.JWT_ACCESS_SECRET) {
  console.error("JWT_ACCESS_SECRET is missing in client/.env.local; every protected page will redirect to /login.");
}

// Reads the role from the access-token cookie. Returns null if missing, invalid or expired.
async function readRoleFromToken(request) {
  const token = request.cookies.get("access_token")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET);
    return payload.role;
  } catch {
    return null;
  }
}

// Runs before protected pages render: sends visitors to login, and wrong roles to /forbidden.
// This is for a smooth experience only; the Express API checks every request itself.
export async function proxy(request) {
  const { pathname, search } = request.nextUrl;
  const area = areaForPath(pathname);
  if (!area) return NextResponse.next();

  const role = await readRoleFromToken(request);

  if (!role) {
    // The login page tries a silent token refresh first, then comes back here.
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (!canOpenArea(role, area)) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/seller/:path*",
    "/pos/:path*",
    "/rider/:path*",
    "/account/:path*",
    "/checkout/:path*",
    "/wishlist/:path*",
    "/orders/:path*",
  ],
};

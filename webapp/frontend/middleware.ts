import { type NextRequest, NextResponse } from "next/server";

import { DEFAULT_LOCALE, isLocale, negotiate } from "./i18n/locales";

export function middleware(req: NextRequest) {
  const existing = req.cookies.get("NEXT_LOCALE")?.value;
  if (isLocale(existing)) {
    return NextResponse.next();
  }
  const locale = negotiate(req.headers.get("accept-language"));
  const res = NextResponse.next();
  res.cookies.set("NEXT_LOCALE", locale ?? DEFAULT_LOCALE, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};

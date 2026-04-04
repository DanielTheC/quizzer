import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// Include exact `/admin`, `/portal`, and `/auth` — some Next matchers only match when there is
// an extra segment after `/:path*`, which skips the index routes and breaks cookie refresh.
export const config = {
  matcher: [
    "/portal",
    "/portal/:path*",
    "/admin",
    "/admin/:path*",
    "/auth",
    "/auth/:path*",
  ],
};

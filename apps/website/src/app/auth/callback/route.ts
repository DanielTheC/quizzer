import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClientSafe } from "@/lib/supabase/server";

function safeNextPath(raw: string | null): string {
  const t = raw?.trim() ?? "";
  if ((t.startsWith("/portal") || t.startsWith("/admin")) && !t.startsWith("//")) {
    return t;
  }
  return "/portal";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nextPath = safeNextPath(url.searchParams.get("next"));
  const errorParam = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/portal/sign-in?error=${encodeURIComponent(errorParam)}`, url.origin),
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/portal/sign-in", url.origin));
  }

  const supabase = await createServerSupabaseClientSafe();
  if (!supabase) {
    return NextResponse.redirect(
      new URL("/portal/sign-in?error=server_misconfigured", url.origin),
    );
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/portal/sign-in?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  return NextResponse.redirect(new URL(nextPath, url.origin));
}

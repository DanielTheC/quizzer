import { NextResponse } from "next/server";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import { createServerSupabaseClientSafe } from "@/lib/supabase/server";

/** Matches `venues_google_maps_url_shape` in DB (case-insensitive). */
const GOOGLE_MAPS_URL_RE =
  /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps)/i;

const RE_AT = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
const RE_LL = /[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
const RE_Q_COORD = /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
const RE_3D_4D = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/;

function extractLatLng(resolvedUrl: string): { lat: number; lng: number } | null {
  for (const re of [RE_AT, RE_LL, RE_Q_COORD, RE_3D_4D]) {
    const m = resolvedUrl.match(re);
    if (!m) continue;
    const lat = Number.parseFloat(m[1]);
    const lng = Number.parseFloat(m[2]);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      return { lat, lng };
    }
  }
  return null;
}

async function resolveShortLink(url: string): Promise<string> {
  let current = url;
  for (let i = 0; i < 4; i++) {
    let res: Response;
    try {
      res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new Error("network");
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) break;
      current = new URL(loc, current).href;
      continue;
    }
    break;
  }
  return current;
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClientSafe();
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: isOperator, error: rpcError } = await supabase.rpc("is_operator");
  if (rpcError) {
    captureSupabaseError("api.admin.resolve_google_maps_url.is_operator", rpcError);
    return NextResponse.json({ error: "Could not verify access" }, { status: 500 });
  }
  if (!isOperator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawUrl = typeof (body as Record<string, unknown>).url === "string" ? (body as { url: string }).url.trim() : "";
  if (!rawUrl) {
    return NextResponse.json({ ok: false, error: "Not a Google Maps URL" }, { status: 400 });
  }

  if (!GOOGLE_MAPS_URL_RE.test(rawUrl)) {
    return NextResponse.json({ ok: false, error: "Not a Google Maps URL" }, { status: 400 });
  }

  let resolvedUrl = rawUrl;
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    if (host === "maps.app.goo.gl" || host === "goo.gl") {
      try {
        resolvedUrl = await resolveShortLink(rawUrl);
      } catch (e) {
        if (e instanceof Error && e.message === "network") {
          return NextResponse.json(
            { ok: false, error: "Couldn't reach Google to resolve the link. Try again." },
            { status: 502 },
          );
        }
        throw e;
      }
    }
  } catch (e) {
    if (e instanceof TypeError) {
      return NextResponse.json({ ok: false, error: "Not a Google Maps URL" }, { status: 400 });
    }
    throw e;
  }

  const coords = extractLatLng(resolvedUrl);
  if (!coords) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Couldn't extract coordinates from that URL. Open the venue in Google Maps, click Share, and copy the link.",
      },
      { status: 422 },
    );
  }

  return NextResponse.json({ ok: true, lat: coords.lat, lng: coords.lng });
}

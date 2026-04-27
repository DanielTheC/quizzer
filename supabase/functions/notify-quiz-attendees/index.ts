// Notify players who saved a quiz: Expo Push API. Gated by JWT + publican_profiles or publican_venues for the quiz's venue.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-authorization",
};

const MAX_MESSAGE_LEN = 2000;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type Body = {
  quiz_event_id?: string;
  message?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function venueNameFromQuiz(quiz: { venues?: unknown }): string {
  const vr = quiz.venues;
  if (Array.isArray(vr) && vr[0] && typeof vr[0] === "object") {
    const n = (vr[0] as { name?: string }).name;
    return (n ?? "").trim() || "Venue";
  }
  if (vr && typeof vr === "object" && !Array.isArray(vr)) {
    const n = (vr as { name?: string }).name;
    return (n ?? "").trim() || "Venue";
  }
  return "Venue";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed", code: "method" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error("notify-quiz-attendees: missing Supabase env");
    return jsonResponse({ ok: false, error: "Server misconfiguration", code: "config" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ ok: false, error: "Missing or invalid authorization", code: "unauthorized" }, 401);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body", code: "bad_request" }, 400);
  }

  const quizEventId = typeof body.quiz_event_id === "string" ? body.quiz_event_id.trim() : "";
  const messageRaw = typeof body.message === "string" ? body.message.trim() : "";
  if (!quizEventId || !messageRaw) {
    return jsonResponse(
      { ok: false, error: "quiz_event_id and message are required", code: "bad_request" },
      400
    );
  }
  if (messageRaw.length > MAX_MESSAGE_LEN) {
    return jsonResponse(
      { ok: false, error: `Message must be at most ${MAX_MESSAGE_LEN} characters`, code: "bad_request" },
      400
    );
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user?.id) {
    return jsonResponse({ ok: false, error: "Invalid session", code: "unauthorized" }, 401);
  }

  const { data: isPublican, error: rpcErr } = await userClient.rpc("is_publican");
  if (rpcErr) {
    console.warn("is_publican:", rpcErr.message);
  }
  if (!isPublican) {
    return jsonResponse({ ok: false, error: "Only publicans can notify attendees", code: "forbidden" }, 403);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: quiz, error: quizErr } = await admin
    .from("quiz_events")
    .select("id, venue_id, venues ( name )")
    .eq("id", quizEventId)
    .maybeSingle();

  if (quizErr || !quiz) {
    return jsonResponse({ ok: false, error: "Quiz not found", code: "not_found" }, 404);
  }

  const venueId = quiz.venue_id as string;
  const venueName = venueNameFromQuiz(quiz as { venues?: unknown });
  const prefixedBody = `${venueName}: ${messageRaw}`;

  const [profileRes, legacyRes] = await Promise.all([
    admin
      .from("publican_profiles")
      .select("id")
      .eq("id", user.id)
      .eq("venue_id", venueId)
      .maybeSingle(),
    admin
      .from("publican_venues")
      .select("id")
      .eq("user_id", user.id)
      .eq("venue_id", venueId)
      .maybeSingle(),
  ]);

  if (profileRes.error || legacyRes.error) {
    console.warn("publican venue membership:", profileRes.error?.message ?? legacyRes.error?.message);
  }
  const authorised = Boolean(profileRes.data) || Boolean(legacyRes.data);

  if (!authorised) {
    return jsonResponse(
      { ok: false, error: "You do not manage this quiz's venue", code: "forbidden" },
      403
    );
  }

  const { data: interestRows, error: intErr } = await admin
    .from("quiz_event_interests")
    .select("user_id")
    .eq("quiz_event_id", quizEventId);

  if (intErr) {
    console.error("quiz_event_interests:", intErr);
    return jsonResponse({ ok: false, error: "Failed to load interested players", code: "db" }, 500);
  }

  const userIds = [...new Set((interestRows ?? []).map((r: { user_id: string }) => r.user_id).filter(Boolean))];
  const interestedCount = userIds.length;

  if (interestedCount === 0) {
    return jsonResponse({
      ok: true,
      interestedCount: 0,
      pushSent: 0,
      pushSkipped: 0,
    });
  }

  const { data: tokenRows, error: tokErr } = await admin
    .from("push_tokens")
    .select("user_id, token, updated_at")
    .in("user_id", userIds)
    .order("updated_at", { ascending: false });

  if (tokErr) {
    const msg = tokErr.message ?? String(tokErr);
    const code = (tokErr as { code?: string }).code ?? "";
    const missing =
      msg.toLowerCase().includes("push_tokens") ||
      msg.includes("schema cache") ||
      msg.includes("Could not find the table") ||
      code === "42P01" ||
      code === "PGRST205";
    console.error("push_tokens:", msg);
    return jsonResponse(
      {
        ok: false,
        error:
          "Push delivery is not set up: the push_tokens table is missing or not exposed to the API. Apply migration 20260409100000_push_tokens.sql (or equivalent), run Supabase schema reload, and redeploy.",
        code: "push_tokens_missing",
        details: msg,
      },
      missing ? 503 : 500
    );
  }

  const latestByUser = new Map<string, string>();
  for (const row of tokenRows ?? []) {
    const uid = row.user_id as string;
    const token = String(row.token ?? "").trim();
    if (!uid || !token) continue;
    if (!latestByUser.has(uid)) latestByUser.set(uid, token);
  }

  let pushSkipped = 0;
  for (const uid of userIds) {
    if (!latestByUser.has(uid)) pushSkipped += 1;
  }

  const expoMessages = userIds
    .map((uid) => {
      const to = latestByUser.get(uid);
      if (!to) return null;
      return {
        to,
        title: venueName,
        body: prefixedBody,
        data: { quizEventId: quizEventId },
      };
    })
    .filter((m) => m != null);

  let pushSent = 0;

  if (expoMessages.length > 0) {
    const chunkSize = 99;
    for (let i = 0; i < expoMessages.length; i += chunkSize) {
      const chunk = expoMessages.slice(i, i + chunkSize);
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
      let expoJson: { data?: Array<{ status?: string; message?: string }> } = {};
      try {
        expoJson = (await res.json()) as typeof expoJson;
      } catch {
        console.error("Expo push: invalid JSON");
      }

      if (!res.ok) {
        console.error("Expo push HTTP error:", res.status, JSON.stringify(expoJson));
        return jsonResponse(
          {
            ok: false,
            error: "Expo push service rejected the request",
            code: "expo_error",
            status: res.status,
          },
          502
        );
      }

      const results = expoJson.data ?? [];
      for (const item of results) {
        if (item?.status === "ok") pushSent += 1;
        else console.warn("Expo ticket:", item?.status, item?.message);
      }
    }
  }

  return jsonResponse({
    ok: true,
    interestedCount,
    pushSent,
    pushSkipped,
  });
});

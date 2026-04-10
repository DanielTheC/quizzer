/**
 * Notifies users in quiz_event_interests when a host sets host_cancelled_at.
 * Auth: caller must be an allowlisted host (same as host_patch_quiz_event_host_fields).
 *
 * Invoked from the host app after a successful cancellation patch. Optionally you can
 * add a Database Webhook on quiz_events (UPDATE) in the Supabase Dashboard to POST here
 * with a service-role client if you need server-only triggers.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-authorization",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type Body = {
  quiz_event_id?: string;
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
    console.error("notify-quiz-cancelled: missing Supabase env");
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
  if (!quizEventId) {
    return jsonResponse({ ok: false, error: "quiz_event_id is required", code: "bad_request" }, 400);
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

  const { data: isHost, error: hostErr } = await userClient.rpc("is_allowlisted_host");
  if (hostErr) {
    console.warn("is_allowlisted_host:", hostErr.message);
  }
  if (!isHost) {
    return jsonResponse({ ok: false, error: "Only allowlisted hosts can notify participants", code: "forbidden" }, 403);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: quiz, error: quizErr } = await admin
    .from("quiz_events")
    .select("id, day_of_week, host_cancelled_at, venues ( name )")
    .eq("id", quizEventId)
    .maybeSingle();

  if (quizErr || !quiz) {
    return jsonResponse({ ok: false, error: "Quiz not found", code: "not_found" }, 404);
  }

  if (quiz.host_cancelled_at == null) {
    return jsonResponse(
      { ok: false, error: "Quiz is not cancelled; set cancellation before notifying", code: "bad_request" },
      400
    );
  }

  const venueName = venueNameFromQuiz(quiz as { venues?: unknown });
  const dowNum = Number((quiz as { day_of_week?: unknown }).day_of_week);
  const dow = Number.isFinite(dowNum) ? Math.max(0, Math.min(6, dowNum)) : 0;
  const dayName = DAY_NAMES[dow] ?? "that day";
  const pushBody = `${venueName} quiz on ${dayName} has been cancelled by the host.`;

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
    console.error("push_tokens:", tokErr);
    return jsonResponse({ ok: false, error: "Failed to load push tokens", code: "db" }, 500);
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
        title: "Quiz cancelled",
        body: pushBody,
        data: { quizEventId: quizEventId, type: "quiz_cancelled" },
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

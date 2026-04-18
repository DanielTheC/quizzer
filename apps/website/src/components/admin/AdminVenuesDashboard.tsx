"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import type { CSSProperties } from "react";
import { Fragment, useCallback, useEffect, useState } from "react";

type VenueRow = {
  id: string;
  name: string;
  address: string | null;
  postcode: string | null;
  borough: string | null;
};

type PublicanProfileRow = {
  id: string;
  venue_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

function publicanDisplayName(p: Pick<PublicanProfileRow, "first_name" | "last_name">): string {
  const fn = p.first_name?.trim() || "";
  const ln = p.last_name?.trim() || "";
  return [fn, ln].filter(Boolean).join(" ") || "—";
}

function formatVenueAddress(v: VenueRow): string {
  const parts = [v.address?.trim(), v.postcode?.trim(), v.borough?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function AdminVenuesDashboard() {
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [publicansByVenueId, setPublicansByVenueId] = useState<Record<string, PublicanProfileRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [expandedVenueId, setExpandedVenueId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirst, setInviteFirst] = useState("");
  const [inviteLast, setInviteLast] = useState("");
  const [removeBusyVenueId, setRemoveBusyVenueId] = useState<string | null>(null);
  const [inviteBusyVenueId, setInviteBusyVenueId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: venueRows, error: vErr } = await supabase
        .from("venues")
        .select("id, name, address, postcode, borough")
        .order("name", { ascending: true });
      if (vErr) {
        captureSupabaseError("admin.venues_list", vErr);
        throw new Error(vErr.message);
      }
      const list = (venueRows ?? []) as VenueRow[];
      setVenues(list);

      const venueIds = list.map((v) => v.id);
      if (venueIds.length === 0) {
        setPublicansByVenueId({});
        return;
      }

      const { data: profileRows, error: pErr } = await supabase
        .from("publican_profiles")
        .select("id, venue_id, email, first_name, last_name")
        .in("venue_id", venueIds);
      if (pErr) {
        captureSupabaseError("admin.publican_profiles_by_venues", pErr);
        throw new Error(pErr.message);
      }

      const next: Record<string, PublicanProfileRow> = {};
      for (const row of (profileRows ?? []) as PublicanProfileRow[]) {
        if (row.venue_id && !next[row.venue_id]) {
          next[row.venue_id] = row;
        }
      }
      setPublicansByVenueId(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load venues.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!expandedVenueId) {
      setInviteEmail("");
      setInviteFirst("");
      setInviteLast("");
      return;
    }
    setInviteEmail("");
    setInviteFirst("");
    setInviteLast("");
  }, [expandedVenueId]);

  async function removeLinkedPublican(venueId: string) {
    if (!window.confirm("Remove the linked publican account from this venue? They will lose portal access for this venue.")) {
      return;
    }
    setRemoveBusyVenueId(venueId);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: e } = await supabase.from("publican_profiles").delete().eq("venue_id", venueId);
      if (e) {
        captureSupabaseError("publican_profiles admin delete", e, { venueId });
        throw new Error(e.message);
      }
      setPublicansByVenueId((prev) => {
        const next = { ...prev };
        delete next[venueId];
        return next;
      });
      setInviteEmail("");
      setInviteFirst("");
      setInviteLast("");
      setToast("Publican link removed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove publican.");
    } finally {
      setRemoveBusyVenueId(null);
    }
  }

  async function invitePublican(venueId: string) {
    const email = inviteEmail.trim();
    if (!email) {
      setError("Publican email is required.");
      return;
    }
    setInviteBusyVenueId(venueId);
    setError(null);
    try {
      const res = await fetch("/api/admin/create-publican", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          venue_id: venueId,
          first_name: inviteFirst.trim() || null,
          last_name: inviteLast.trim() || null,
        }),
      });
      const body = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        throw new Error(body.error ?? "Invite failed.");
      }
      setToast("Invitation sent. The publican will receive an email to set their password.");
      setInviteEmail("");
      setInviteFirst("");
      setInviteLast("");
      const supabase = createBrowserSupabaseClient();
      const { data, error: qErr } = await supabase
        .from("publican_profiles")
        .select("id, venue_id, email, first_name, last_name")
        .eq("venue_id", venueId)
        .maybeSingle();
      if (qErr) {
        captureSupabaseError("publican_profiles admin read after invite", qErr);
        setPublicansByVenueId((prev) => {
          const next = { ...prev };
          delete next[venueId];
          return next;
        });
      } else if (data) {
        setPublicansByVenueId((prev) => ({
          ...prev,
          [venueId]: data as PublicanProfileRow,
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not invite publican.");
    } finally {
      setInviteBusyVenueId(null);
    }
  }

  return (
    <div className="relative space-y-6">
      {toast ? (
        <p
          key={toast}
          className="animate-admin-toast fixed bottom-6 right-6 z-50 max-w-sm rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-4 py-2 text-sm font-semibold text-quizzer-black shadow-[var(--shadow-card)]"
          role="status"
        >
          {toast}
        </p>
      ) : null}

      <h1 className="font-heading animate-admin-fade-in-up text-2xl uppercase text-quizzer-black">Venues</h1>
      <p className="max-w-2xl text-sm text-quizzer-black/75">
        Manage publican portal access per venue. Invite a publican to link their account, or remove access when needed.
      </p>

      {error ? (
        <p className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-[3px] border-quizzer-red bg-quizzer-cream px-3 py-2 text-sm text-quizzer-red">
          {error}
        </p>
      ) : null}

      <section
        className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
        style={{ "--admin-stagger": "0ms" } as CSSProperties}
      >
        <h2 className="font-heading text-sm uppercase tracking-wide text-quizzer-black">All venues</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm text-quizzer-black">
            <thead>
              <tr className="border-b-[3px] border-quizzer-black bg-quizzer-cream">
                <th className="px-3 py-2 font-heading text-xs uppercase tracking-wide">Venue</th>
                <th className="px-3 py-2 font-heading text-xs uppercase tracking-wide">Address</th>
                <th className="px-3 py-2 font-heading text-xs uppercase tracking-wide">Publican</th>
              </tr>
            </thead>
            <tbody>
              {loading && venues.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-quizzer-black/60">
                    Loading…
                  </td>
                </tr>
              ) : venues.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-quizzer-black/60">
                    No venues yet.
                  </td>
                </tr>
              ) : (
                venues.map((v) => {
                  const profile = publicansByVenueId[v.id];
                  const expanded = expandedVenueId === v.id;
                  return (
                    <Fragment key={v.id}>
                      <tr
                        className={`cursor-pointer border-b border-quizzer-black/10 transition-colors hover:bg-quizzer-cream/40 ${
                          expanded ? "bg-quizzer-cream/50" : ""
                        }`}
                        onClick={() => setExpandedVenueId(expanded ? null : v.id)}
                      >
                        <td className="px-3 py-3 font-semibold">{v.name}</td>
                        <td className="max-w-xs px-3 py-3 text-quizzer-black/85">{formatVenueAddress(v)}</td>
                        <td className="px-3 py-3">
                          {profile ? (
                            <span className="text-quizzer-black">
                              {publicanDisplayName(profile)} · {profile.email}
                            </span>
                          ) : (
                            <span className="text-quizzer-black/50">No publican linked</span>
                          )}
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="border-b border-quizzer-black/15 bg-quizzer-cream/25">
                          <td colSpan={3} className="px-3 py-4">
                            <div className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]">
                              <p className="font-heading text-xs uppercase tracking-wide text-quizzer-black">
                                Publican · {v.name}
                              </p>
                              {profile ? (
                                <div className="mt-3 space-y-2 text-sm">
                                  <p className="font-medium text-quizzer-black">{profile.email}</p>
                                  <p className="text-quizzer-black/80">
                                    Name:{" "}
                                    <span className="font-semibold text-quizzer-black">{publicanDisplayName(profile)}</span>
                                  </p>
                                  <button
                                    type="button"
                                    disabled={removeBusyVenueId === v.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void removeLinkedPublican(v.id);
                                    }}
                                    className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-red px-3 py-1.5 text-xs font-semibold text-quizzer-white shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
                                  >
                                    {removeBusyVenueId === v.id ? "Removing…" : "Remove"}
                                  </button>
                                </div>
                              ) : (
                                <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                                  <p className="text-xs text-quizzer-black/70">
                                    No publican linked. Invite someone to manage this venue in the portal.
                                  </p>
                                  <label className="block text-xs font-medium text-quizzer-black">
                                    Email *
                                    <input
                                      type="email"
                                      value={inviteEmail}
                                      onChange={(e) => setInviteEmail(e.target.value)}
                                      autoComplete="off"
                                      className="mt-1 w-full max-w-md rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                                    />
                                  </label>
                                  <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                                    <label className="block text-xs font-medium text-quizzer-black">
                                      First name
                                      <input
                                        type="text"
                                        value={inviteFirst}
                                        onChange={(e) => setInviteFirst(e.target.value)}
                                        className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                                      />
                                    </label>
                                    <label className="block text-xs font-medium text-quizzer-black">
                                      Last name
                                      <input
                                        type="text"
                                        value={inviteLast}
                                        onChange={(e) => setInviteLast(e.target.value)}
                                        className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                                      />
                                    </label>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={inviteBusyVenueId === v.id || !inviteEmail.trim()}
                                    onClick={() => void invitePublican(v.id)}
                                    className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-3 py-1.5 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
                                  >
                                    {inviteBusyVenueId === v.id ? "Sending…" : "Send invite"}
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

import Link from "next/link";
import { mapPublicanVenueRows } from "@/components/portal/portal-types";
import { PortalSupabaseEnvMissing } from "@/components/portal/PortalSupabaseEnvMissing";
import { createServerSupabaseClientSafe } from "@/lib/supabase/server";

export default async function PortalHomePage() {
  const supabase = await createServerSupabaseClientSafe();
  if (!supabase) {
    return <PortalSupabaseEnvMissing />;
  }

  const { data: pvRows } = await supabase
    .from("publican_venues")
    .select("id, venue_id, venues ( name )")
    .order("created_at", { ascending: true });
  const links = mapPublicanVenueRows(pvRows ?? []);

  return (
    <div className="px-8 py-12">
      <div className="max-w-2xl">
        <h1 className="font-heading text-3xl uppercase text-quizzer-black">Overview</h1>
        <p className="mt-4 text-quizzer-black/80">
          Open a venue to view quiz nights, player interest, and status. More tools will land here soon.
        </p>
        {links.length > 0 ? (
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {links.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/portal/venues/${v.venueId}`}
                  className="flex min-h-[4.5rem] items-center rounded-[var(--radius-card)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white px-4 py-3 font-medium text-quizzer-black shadow-[var(--shadow-card)] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[var(--shadow-card-hover)]"
                >
                  {v.venueName}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

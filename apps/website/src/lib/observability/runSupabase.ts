import { captureSupabaseError, type SupabaseReportableError } from "./supabaseErrors";

type SupabaseResultLike<T> = { data: T | null; error: SupabaseReportableError | null };

/**
 * Run a Supabase query, report errors to Sentry, throw on failure, return data on success.
 * Replaces the `const { data, error } = await x; if (error) { capture(); throw }` boilerplate.
 *
 * Example:
 *   const venues = await runSupabase("portal.venues_list", () =>
 *     supabase.from("venues").select("id, name")
 *   );
 */
export async function runSupabase<T>(
  operation: string,
  query: () => PromiseLike<SupabaseResultLike<T>>,
  extras?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await query();
  if (error) {
    captureSupabaseError(operation, error, extras);
    throw new Error(error.message);
  }
  if (data === null) {
    throw new Error(`Supabase ${operation}: no data returned`);
  }
  return data;
}

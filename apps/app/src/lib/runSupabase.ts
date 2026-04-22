import { captureSupabaseError } from "./sentryInit";

type SupabaseResultLike<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

export async function runSupabase<T>(
  operation: string,
  query: () => PromiseLike<SupabaseResultLike<T>>,
): Promise<T> {
  const { data, error } = await query();
  if (error) {
    captureSupabaseError(operation, error);
    throw new Error(error.message);
  }
  if (data === null) {
    throw new Error(`Supabase ${operation}: no data returned`);
  }
  return data;
}

/** List scroll offset below which we auto-reveal the filters row after “Hide filters”. */
export const LIST_TOOLBAR_NEAR_TOP_PX = 28;
export const LIST_SCROLL_DIRECTION_PX = 8;
export const LIST_TOOLBAR_EXPAND_FALLBACK_PX = 320;
export const SEARCH_DEBOUNCE_MS = 250;

/** Parse start_time (e.g. "19:30", "19:30:00", "1930") to minutes since midnight for sorting. */
export function startTimeToMinutes(s: string): number {
  const str = String(s).trim();
  const parts = str.split(/[:.]/);
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

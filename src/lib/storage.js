const STORAGE_KEY = "collection-fund-state-v1";

export function loadState(fallback) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.transactions)) return fallback;
    return {
      kidName: parsed.kidName ?? fallback.kidName,
      matchRatio: typeof parsed.matchRatio === "number" ? parsed.matchRatio : fallback.matchRatio,
      transactions: parsed.transactions,
    };
  } catch {
    return fallback;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — app still works for the session.
  }
}

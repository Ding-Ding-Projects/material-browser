export function readTabPreference(storage, key, fallback) {
  try { const value = storage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; }
}
export function restoreWorkspaceTabs(saved, catalogue) {
  if (!Array.isArray(saved)) return [];
  const destinations = new Map(catalogue.filter((item) => item.page).map((item) => [item.id, item]));
  return [...new Set(saved.filter((id) => typeof id === "string"))].slice(0, 200).map((id) => destinations.get(id)).filter(Boolean).map((item) => ({ ...item }));
}
export function tabFocusId(visibleIds, active) {
  return visibleIds.includes(active) ? active : visibleIds[0] || "";
}

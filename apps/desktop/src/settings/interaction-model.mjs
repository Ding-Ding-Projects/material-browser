export function resolveSearchRecords(ids, records) {
  const current = new Map(records.map((record) => [record.id, record]));
  return [...new Set(ids)].flatMap((id) =>
    current.has(id) ? [current.get(id)] : [],
  );
}
export function revealSettingKeys(matchedKeys, definitions, target) {
  const valid = new Set(definitions.map((d) => d.key));
  return [
    ...new Set([
      ...matchedKeys,
      ...(target && valid.has(target) ? [target] : []),
    ]),
  ].filter((key) => valid.has(key));
}
export function settingInstanceId(key, instance) {
  return `setting-${key}-${instance.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}
export function choiceAccessibleName(label, value, options, automatic) {
  return `${label}: ${options.find((option) => option[0] === value)?.[1] || value || automatic}`;
}
export function parseNumericDraft(text) {
  return text.trim() === "" ? Number.NaN : Number(text);
}
export function bindTabChanges(element, ids, onSelect) {
  const changed = (event) => {
    if (event.target !== element) return;
    const id = ids[element.activeTabIndex];
    if (typeof id === "string") onSelect(id);
  };
  element.addEventListener("change", changed);
  return () => element.removeEventListener("change", changed);
}
export async function initializeTabSelection(
  element,
  ids,
  value,
  isCurrent = () => true,
) {
  await element.updateComplete;
  if (!isCurrent()) return false;
  const index = ids.indexOf(value);
  if (index < 0) return false;
  element.activeTabIndex = index;
  return true;
}

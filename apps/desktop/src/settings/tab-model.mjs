export const tabIds = [
  "language",
  "appearance",
  "accessibility",
  "focus",
  "notifications",
  "schedules",
  "history",
  "privacy",
  "tools",
  "about",
];
export function defaultTabs() {
  return {
    version: 1,
    edge: "left",
    order: [...tabIds],
    pinned: [],
    closed: [],
    groups: [],
    membership: {},
  };
}
export function validateTabs(input) {
  if (
    !input ||
    input.version !== 1 ||
    !["left", "right", "top", "bottom"].includes(input.edge)
  )
    throw Error("Invalid tab layout");
  for (const key of ["order", "pinned", "closed"])
    if (
      !Array.isArray(input[key]) ||
      input[key].some((id) => !tabIds.includes(id)) ||
      new Set(input[key]).size !== input[key].length
    )
      throw Error("Invalid tab collection");
  if (
    input.order.length !== tabIds.length ||
    input.pinned.some((id) => input.closed.includes(id)) ||
    !Array.isArray(input.groups) ||
    input.groups.length > 30 ||
    !input.membership ||
    typeof input.membership !== "object"
  )
    throw Error("Invalid tab state");
  for (const group of input.groups)
    if (
      !group ||
      typeof group.id !== "string" ||
      typeof group.name !== "string" ||
      !group.name.trim() ||
      group.name.length > 80 ||
      !/^#[a-f\d]{6}$/i.test(group.color) ||
      typeof group.collapsed !== "boolean"
    )
      throw Error("Invalid tab group");
  if (new Set(input.groups.map((g) => g.id)).size !== input.groups.length)
    throw Error("Duplicate group");
  for (const [id, group] of Object.entries(input.membership))
    if (!tabIds.includes(id) || !input.groups.some((g) => g.id === group))
      throw Error("Invalid group membership");
  return structuredClone(input);
}
export function moveTab(state, id, delta) {
  const next = validateTabs(state),
    from = next.order.indexOf(id),
    to = Math.max(0, Math.min(next.order.length - 1, from + delta));
  if (from < 0) throw Error("Unknown tab");
  next.order.splice(from, 1);
  next.order.splice(to, 0, id);
  return next;
}
export function previewTabClose(state, ids, includePinned = false) {
  return {
    close: ids.filter(
      (id) =>
        tabIds.includes(id) &&
        !state.closed.includes(id) &&
        (includePinned || !state.pinned.includes(id)),
    ),
    excluded: ids.filter((id) => state.pinned.includes(id) && !includePinned),
  };
}
export function closeTabs(state, ids, includePinned = false) {
  const next = validateTabs(state),
    preview = previewTabClose(next, ids, includePinned);
  next.closed = [...new Set([...next.closed, ...preview.close])];
  next.pinned = next.pinned.filter((id) => !preview.close.includes(id));
  return { state: next, ...preview };
}
export function orderedOpenTabs(state, revealed) {
  const open = state.order.filter((id) => !state.closed.includes(id));
  const unpinned = open.filter((id) => !state.pinned.includes(id));
  const grouped = [
    ...unpinned.filter((id) => !state.membership[id]),
    ...state.groups.flatMap((g) =>
      unpinned.filter((id) => state.membership[id] === g.id),
    ),
  ];
  return [...open.filter((id) => state.pinned.includes(id)), ...grouped].filter(
    (id) => {
      const group = state.groups.find((g) => g.id === state.membership[id]);
      return !group?.collapsed || revealed === id;
    },
  );
}

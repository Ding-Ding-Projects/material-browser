/** Preserve critical and in-flight bilingual groups; coalesce only an explicit supersession key. */
export function enqueueSpeechGroups(
  queue,
  incoming,
  activeGroupId,
  maximum = 100,
) {
  let next = queue.map((group) => ({
    ...group,
    parts: group.parts.map((part) => ({ ...part })),
  }));
  if (incoming.supersedes && !incoming.critical)
    next = next.filter(
      (group) =>
        group.critical ||
        group.id === activeGroupId ||
        group.supersedes !== incoming.supersedes,
    );
  if (next.length >= maximum) {
    const removable = next.findIndex(
      (group) => !group.critical && group.id !== activeGroupId,
    );
    if (removable >= 0) next.splice(removable, 1);
    else return { queue: next, accepted: false, overflow: true };
  }
  next.push({
    ...incoming,
    parts: incoming.parts.map((part) => ({ ...part })),
  });
  return { queue: next, accepted: true, overflow: false };
}
export function takeSpeechPart(queue) {
  if (!queue.length) return { queue, part: null, groupId: null };
  const next = queue.map((group) => ({ ...group, parts: [...group.parts] })),
    group = next[0],
    part = group.parts.shift();
  if (!group.parts.length) next.shift();
  return { queue: next, part, groupId: group.id };
}

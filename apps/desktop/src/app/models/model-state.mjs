/** Merge exact provider identities without inventing variants or dropping installed models. */
export function reconcileModels(catalogue, installed, running) {
  const rows = new Map();
  const add = (value, source) => {
    const name = typeof value?.name === 'string' ? value.name : value?.model;
    if (typeof name !== 'string' || !name || name.length > 256) return;
    const previous = rows.get(name) || {};
    rows.set(name, { ...previous, ...value, name, source: previous.source || source, installed: previous.installed || source === 'installed', running: previous.running || source === 'running' });
  };
  for (const item of catalogue) add(item, 'catalogue');
  for (const item of installed) add(item, 'installed');
  for (const item of running) add(item, 'running');
  return [...rows.values()];
}
export function readQueue(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(v => typeof v === 'string' && v.length > 0 && v.length <= 256))].slice(0, 50);
}
export function batchEstimate(names, models) {
  let bytes = 0, unknown = 0;
  for (const name of names) {
    const model = models.find(m => m.name === name);
    if (typeof model?.size === 'number' && Number.isFinite(model.size) && model.size >= 0) bytes += model.size;
    else unknown++;
  }
  return { bytes, unknown, complete: unknown === 0 };
}

/** Family records describe the catalogue, but only exact returned tags are selectable. */
export function catalogueVariants(rows) {
  return rows.flatMap(row => Array.isArray(row?.tags) ? row.tags : typeof (row?.name || row?.model) === 'string' && (row.name || row.model).includes(':') ? [row] : []);
}

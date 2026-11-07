/** Tiny TTL set used to make sure the same event id is never processed twice. */
const seenIds = new Map<string, number>();
const TTL = 60_000;

export function alreadySeen(id: string): boolean {
  if (seenIds.has(id)) return true;
  seenIds.set(id, Date.now());
  return false;
}

setInterval(() => {
  const cutoff = Date.now() - TTL;
  for (const [id, t] of seenIds) if (t < cutoff) seenIds.delete(id);
}, 30_000).unref();

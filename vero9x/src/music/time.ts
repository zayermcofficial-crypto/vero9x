export function fmtTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

/** Accepts 90, 90s, 1m30s, 1:30, 1:02:03. Returns milliseconds or null. */
export function parseTime(input: string): number | null {
  const t = input.trim().toLowerCase();
  let m = /^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/.exec(t);
  if (m) return m[3] !== undefined ? (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000 : (Number(m[1]) * 60 + Number(m[2])) * 1000;
  m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(t);
  if (m && (m[1] || m[2] || m[3])) return (Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)) * 1000;
  return null;
}

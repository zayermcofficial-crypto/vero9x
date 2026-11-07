const levels = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof levels;
const min = levels[(process.env.LOG_LEVEL as Level) ?? 'info'] ?? levels.info;

function log(level: Level, msg: string, meta?: unknown) {
  if (levels[level] < min) return;
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`;
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta === undefined) return out(line);
  out(line, meta instanceof Error ? meta.stack ?? meta.message : meta);
}

export const logger = {
  debug: (m: string, x?: unknown) => log('debug', m, x),
  info: (m: string, x?: unknown) => log('info', m, x),
  warn: (m: string, x?: unknown) => log('warn', m, x),
  error: (m: string, x?: unknown) => log('error', m, x),
};

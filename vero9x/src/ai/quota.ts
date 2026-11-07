import { db, getSettings } from '../database/db';

/** Per-user, per-server daily AI usage limit (0 = unlimited). Atomic check-and-increment. */
export function consumeQuota(guildId: string, userId: string): { ok: boolean; used: number; limit: number } {
  const limit = getSettings(guildId).ai_daily_limit;
  const day = new Date().toISOString().slice(0, 10);
  return db.transaction(() => {
    const row = db.prepare('SELECT count FROM ai_usage WHERE guild_id = ? AND user_id = ? AND day = ?').get(guildId, userId, day) as { count: number } | undefined;
    const used = row?.count ?? 0;
    if (limit > 0 && used >= limit) return { ok: false, used, limit };
    db.prepare(`INSERT INTO ai_usage (guild_id, user_id, day, count) VALUES (?, ?, ?, 1)
      ON CONFLICT (guild_id, user_id, day) DO UPDATE SET count = count + 1`).run(guildId, userId, day);
    return { ok: true, used: used + 1, limit };
  })();
}

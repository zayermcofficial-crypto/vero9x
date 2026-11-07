import { Message } from 'discord.js';
import { db, getSettings } from '../database/db';
import { logger } from '../utils/logger';

export const xpForLevel = (level: number) => 5 * level * level + 50 * level + 100;

export function levelFromXp(total: number) {
  let level = 0;
  let rem = Math.max(0, total);
  while (rem >= xpForLevel(level)) { rem -= xpForLevel(level); level++; }
  return { level, current: rem, needed: xpForLevel(level) };
}

export function progressBar(current: number, needed: number, size = 12): string {
  const filled = Math.max(0, Math.min(size, Math.round((current / needed) * size)));
  return '▰'.repeat(filled) + '▱'.repeat(size - filled);
}

/** Adds (or removes, if negative) XP atomically. Returns old/new level so callers can announce level-ups. */
export function addXp(guildId: string, userId: string, amount: number, countMessage = false) {
  return db.transaction(() => {
    db.prepare('INSERT OR IGNORE INTO levels (guild_id, user_id) VALUES (?, ?)').run(guildId, userId);
    const before = (db.prepare('SELECT xp FROM levels WHERE guild_id = ? AND user_id = ?').get(guildId, userId) as { xp: number }).xp;
    const after = Math.max(0, before + amount);
    db.prepare('UPDATE levels SET xp = ?, messages = messages + ? WHERE guild_id = ? AND user_id = ?').run(after, countMessage ? 1 : 0, guildId, userId);
    return { before, after, oldLevel: levelFromXp(before).level, newLevel: levelFromXp(after).level };
  })();
}

export function setXp(guildId: string, userId: string, xp: number): void {
  db.prepare(`INSERT INTO levels (guild_id, user_id, xp) VALUES (?, ?, ?)
    ON CONFLICT (guild_id, user_id) DO UPDATE SET xp = excluded.xp`).run(guildId, userId, Math.max(0, xp));
}

export function getRank(guildId: string, userId: string) {
  const row = db.prepare('SELECT xp, messages FROM levels WHERE guild_id = ? AND user_id = ?').get(guildId, userId) as { xp: number; messages: number } | undefined;
  const xp = row?.xp ?? 0;
  const pos = (db.prepare('SELECT COUNT(*) + 1 AS p FROM levels WHERE guild_id = ? AND xp > ?').get(guildId, xp) as { p: number }).p;
  return { xp, messages: row?.messages ?? 0, position: pos, ...levelFromXp(xp) };
}

const lastXp = new Map<string, number>();
setInterval(() => {
  const cutoff = Date.now() - 10 * 60_000;
  for (const [k, t] of lastXp) if (t < cutoff) lastXp.delete(k);
}, 120_000).unref();

/** Grants configured role rewards up to `level`. */
export async function applyRoleRewards(message: Message, level: number): Promise<void> {
  if (!message.guild || !message.member) return;
  const rows = db.prepare('SELECT role_id FROM level_rewards WHERE guild_id = ? AND level <= ?').all(message.guild.id, level) as { role_id: string }[];
  const missing = rows.map((r) => r.role_id).filter((id) => !message.member!.roles.cache.has(id) && message.guild!.roles.cache.get(id)?.editable);
  if (missing.length) await message.member.roles.add(missing, 'VERO9X level reward').catch((e) => logger.warn('Level reward failed', e as Error));
}

export async function handleMessageXp(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  const s = getSettings(message.guild.id);
  if (!s.leveling_enabled || message.content.length < 3) return;
  const key = `${message.guild.id}:${message.author.id}`;
  if (Date.now() - (lastXp.get(key) ?? 0) < s.xp_cooldown * 1000) return;
  lastXp.set(key, Date.now());

  const lo = Math.min(s.xp_min, s.xp_max), hi = Math.max(s.xp_min, s.xp_max);
  const gain = lo + Math.floor(Math.random() * (hi - lo + 1));
  const r = addXp(message.guild.id, message.author.id, gain, true);
  if (r.newLevel > r.oldLevel) {
    await applyRoleRewards(message, r.newLevel);
    const text = (s.levelup_message ?? 'GG {user}, you reached **level {level}**!').replaceAll('{user}', `${message.author}`).replaceAll('{level}', String(r.newLevel));
    const ch = s.levelup_channel ? await message.guild.channels.fetch(s.levelup_channel).catch(() => null) : message.channel;
    if (ch?.isSendable()) await ch.send({ content: text, allowedMentions: { users: [message.author.id] } }).catch(() => undefined);
  }
}

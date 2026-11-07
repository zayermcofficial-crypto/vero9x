import { ChatInputCommandInteraction, EmbedBuilder, Guild, GuildMember, User } from 'discord.js';
import { db, getSettings, GuildSettings } from '../database/db';
import { COLORS, embed } from '../utils/embeds';
import { logger } from '../utils/logger';

export type CaseType = 'warn' | 'ban' | 'unban' | 'kick' | 'timeout' | 'untimeout' | 'automod';

/** Per-guild sequential case numbers, allocated inside a transaction so they never collide. */
export function createCase(guildId: string, type: CaseType, targetId: string, moderatorId: string, reason: string, durationSeconds?: number): number {
  return db.transaction(() => {
    const row = db.prepare('SELECT COALESCE(MAX(case_no), 0) + 1 AS n FROM mod_cases WHERE guild_id = ?').get(guildId) as { n: number };
    db.prepare(
      'INSERT INTO mod_cases (guild_id, case_no, type, target_id, moderator_id, reason, duration_seconds, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(guildId, row.n, type, targetId, moderatorId, reason, durationSeconds ?? null, Date.now());
    return row.n;
  })();
}

export interface CaseRow {
  case_no: number; type: CaseType; target_id: string; moderator_id: string;
  reason: string; duration_seconds: number | null; created_at: number;
}

export function getCases(guildId: string, targetId: string, type?: CaseType, limit = 10): CaseRow[] {
  const sql = `SELECT case_no, type, target_id, moderator_id, reason, duration_seconds, created_at FROM mod_cases
    WHERE guild_id = ? AND target_id = ? ${type ? 'AND type = ?' : ''} ORDER BY case_no DESC LIMIT ?`;
  const args = type ? [guildId, targetId, type, limit] : [guildId, targetId, limit];
  return db.prepare(sql).all(...args) as CaseRow[];
}

export function countCases(guildId: string, targetId: string, type: CaseType): number {
  return (db.prepare('SELECT COUNT(*) AS c FROM mod_cases WHERE guild_id = ? AND target_id = ? AND type = ?').get(guildId, targetId, type) as { c: number }).c;
}

const TYPE_COLOR: Record<CaseType, number> = {
  warn: 0xd4a017, ban: COLORS.danger, unban: COLORS.success, kick: 0xc0392b,
  timeout: 0x8b4513, untimeout: COLORS.success, automod: COLORS.primary,
};

export function caseEmbed(type: CaseType, caseNo: number, target: User, moderator: User, reason: string, durationSeconds?: number): EmbedBuilder {
  const e = embed(`Case #${caseNo} • ${type.toUpperCase()}`, undefined, TYPE_COLOR[type]).addFields(
    { name: 'Target', value: `${target} \`${target.id}\``, inline: true },
    { name: 'Moderator', value: `${moderator}`, inline: true },
    { name: 'Reason', value: reason.slice(0, 1000) },
  );
  if (durationSeconds) e.addFields({ name: 'Duration', value: formatDuration(durationSeconds), inline: true });
  return e;
}

export async function sendLog(guild: Guild, e: EmbedBuilder, settings: GuildSettings = getSettings(guild.id)): Promise<void> {
  if (!settings.log_channel) return;
  try {
    const ch = await guild.channels.fetch(settings.log_channel);
    if (ch?.isTextBased() && 'send' in ch) await ch.send({ embeds: [e], allowedMentions: { parse: [] } });
  } catch (err) {
    logger.warn(`Could not write to log channel in ${guild.id}`, err as Error);
  }
}

export async function dmUser(user: User, e: EmbedBuilder): Promise<boolean> {
  try { await user.send({ embeds: [e] }); return true; } catch { return false; }
}

export function parseDuration(input: string): number | null {
  const m = /^(\d+)\s*(s|m|h|d|w)$/i.exec(input.trim());
  if (!m) return null;
  const mult = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[m[2].toLowerCase() as 's' | 'm' | 'h' | 'd' | 'w'];
  return Number(m[1]) * mult;
}

export function formatDuration(sec: number): string {
  const parts: string[] = [];
  for (const [label, size] of [['d', 86400], ['h', 3600], ['m', 60], ['s', 1]] as const) {
    if (sec >= size) { parts.push(`${Math.floor(sec / size)}${label}`); sec %= size; }
  }
  return parts.join(' ') || '0s';
}

/** Returns an error message if the invoker may NOT act on the target, otherwise null. */
export async function checkTarget(i: ChatInputCommandInteraction, target: GuildMember): Promise<string | null> {
  const guild = i.guild!;
  const mod = await guild.members.fetch(i.user.id);
  if (target.id === i.user.id) return "You can't do that to yourself.";
  if (target.id === i.client.user.id) return 'Nice try.';
  if (target.id === guild.ownerId) return "You can't act on the server owner.";
  if (i.user.id !== guild.ownerId) {
    if (mod.roles.highest.comparePositionTo(target.roles.highest) <= 0) return 'Their highest role is equal to or above yours.';
  }
  return null;
}

/** Runs configured warn thresholds. Returns a note describing the automatic action taken, if any. */
export async function applyWarnThresholds(guild: Guild, member: GuildMember | null, count: number, botId: string): Promise<string | null> {
  if (!member) return null;
  const s = getSettings(guild.id);
  try {
    if (s.warn_ban_at > 0 && count >= s.warn_ban_at && member.bannable) {
      await member.ban({ reason: `Auto: reached ${count} warnings` });
      const n = createCase(guild.id, 'ban', member.id, botId, `Auto: reached ${count} warnings`);
      return `Threshold reached — user was **banned** automatically (case #${n}).`;
    }
    if (s.warn_timeout_at > 0 && count >= s.warn_timeout_at && member.moderatable) {
      const sec = s.warn_timeout_minutes * 60;
      await member.timeout(sec * 1000, `Auto: reached ${count} warnings`);
      const n = createCase(guild.id, 'timeout', member.id, botId, `Auto: reached ${count} warnings`, sec);
      return `Threshold reached — user was **timed out for ${formatDuration(sec)}** automatically (case #${n}).`;
    }
  } catch (err) {
    logger.warn('Warn threshold action failed', err as Error);
  }
  return null;
}

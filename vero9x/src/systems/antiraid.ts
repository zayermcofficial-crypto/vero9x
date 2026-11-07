import { GuildMember } from 'discord.js';
import { getSettings } from '../database/db';
import { embed } from '../utils/embeds';
import { logger } from '../utils/logger';
import { createCase, sendLog } from './moderation';

const joins = new Map<string, number[]>();
const raidUntil = new Map<string, number>();
const JOIN_LIMIT = 8;
const JOIN_WINDOW_MS = 15_000;
const RAID_MODE_MS = 120_000;
const NEW_ACCOUNT_MS = 7 * 86_400_000;

setInterval(() => {
  const now = Date.now();
  for (const [g, until] of raidUntil) if (until < now) raidUntil.delete(g);
  for (const [g, arr] of joins) {
    const kept = arr.filter((t) => t > now - JOIN_WINDOW_MS);
    if (kept.length) joins.set(g, kept); else joins.delete(g);
  }
}, 30_000).unref();

/** Detects join floods. While raid mode is active, brand-new accounts are timed out for 10 minutes. */
export async function checkRaid(member: GuildMember): Promise<void> {
  const s = getSettings(member.guild.id);
  if (!s.antiraid) return;
  const now = Date.now();
  const arr = (joins.get(member.guild.id) ?? []).filter((t) => t > now - JOIN_WINDOW_MS);
  arr.push(now);
  joins.set(member.guild.id, arr);

  if (arr.length >= JOIN_LIMIT && !raidUntil.has(member.guild.id)) {
    raidUntil.set(member.guild.id, now + RAID_MODE_MS);
    await sendLog(member.guild, embed('🚨 Anti-raid triggered', `**${arr.length}** members joined within ${JOIN_WINDOW_MS / 1000}s. Raid mode is on for ${RAID_MODE_MS / 60000} minutes: accounts younger than 7 days get a 10m timeout.`), s);
  }
  if ((raidUntil.get(member.guild.id) ?? 0) > now && now - member.user.createdTimestamp < NEW_ACCOUNT_MS && member.moderatable) {
    try {
      await member.timeout(600_000, 'Anti-raid: new account during join flood');
      createCase(member.guild.id, 'automod', member.id, member.client.user.id, 'Anti-raid: new account during join flood', 600);
    } catch (err) { logger.warn('Anti-raid timeout failed', err as Error); }
  }
}

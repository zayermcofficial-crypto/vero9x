import { Message, PermissionFlagsBits } from 'discord.js';
import { db, getSettings } from '../database/db';
import { logger } from '../utils/logger';
import { embed } from '../utils/embeds';
import { createCase, sendLog } from './moderation';

interface Hit { t: number; c: string }
const recent = new Map<string, Hit[]>();
const WINDOW_MS = 8_000;
const SPAM_COUNT = 5; // messages inside the window
const FLOOD_REPEATS = 3; // identical messages inside the window
const INVITE_RE = /(discord\.gg|discord(?:app)?\.com\/invite)\/\S+/i;
const LINK_RE = /https?:\/\/\S+/i;

const badwordCache = new Map<string, { words: string[]; at: number }>();
export function invalidateBadwords(guildId: string) { badwordCache.delete(guildId); }
function badwords(guildId: string): string[] {
  const c = badwordCache.get(guildId);
  if (c && Date.now() - c.at < 60_000) return c.words;
  const words = (db.prepare('SELECT word FROM badwords WHERE guild_id = ?').all(guildId) as { word: string }[]).map((r) => r.word);
  badwordCache.set(guildId, { words, at: Date.now() });
  return words;
}
export function containsBadword(content: string, words: string[]): string | null {
  const text = ` ${content.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  return words.find((w) => text.includes(` ${w} `)) ?? null;
}

setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [k, v] of recent) {
    const kept = v.filter((h) => h.t > cutoff);
    if (kept.length) recent.set(k, kept); else recent.delete(k);
  }
  for (const [g, c] of badwordCache) if (Date.now() - c.at > 120_000) badwordCache.delete(g);
}, 30_000).unref();

/** Returns true if the message was removed by auto-moderation. Members with Manage Messages are exempt. */
export async function runAutomod(message: Message): Promise<boolean> {
  if (!message.guild || !message.member) return false;
  const s = getSettings(message.guild.id);
  if (!(s.automod_spam || s.automod_links || s.automod_invites || s.automod_badwords || s.automod_mentions)) return false;
  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return false;

  let reason: string | null = null;
  let timeoutSec = 0;
  const mentions = message.mentions.users.size + message.mentions.roles.size;

  if (s.automod_mentions && mentions >= s.mention_limit) {
    reason = `Mention spam (${mentions} mentions)`; timeoutSec = 600;
  } else if (s.automod_invites && INVITE_RE.test(message.content)) {
    reason = 'Server invites are not allowed';
  } else if (s.automod_links && LINK_RE.test(message.content) && !INVITE_RE.test(message.content)) {
    reason = 'Links are not allowed';
  } else if (s.automod_badwords && containsBadword(message.content, badwords(message.guild.id))) {
    reason = 'Message contained a blocked word';
  } else if (s.automod_spam) {
    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const arr = (recent.get(key) ?? []).filter((h) => h.t > now - WINDOW_MS);
    arr.push({ t: now, c: message.content.toLowerCase() });
    recent.set(key, arr);
    if (arr.length >= SPAM_COUNT) { reason = 'Spam (too many messages too fast)'; timeoutSec = 300; }
    else if (message.content && arr.filter((h) => h.c === message.content.toLowerCase()).length >= FLOOD_REPEATS) { reason = 'Flooding (repeated messages)'; timeoutSec = 300; }
    if (reason) recent.delete(key);
  }
  if (!reason) return false;

  try {
    await message.delete().catch(() => undefined);
    let applied = '';
    if (timeoutSec && message.member.moderatable) {
      await message.member.timeout(timeoutSec * 1000, `Automod: ${reason}`);
      applied = ` • timed out ${timeoutSec / 60}m`;
    }
    const caseNo = createCase(message.guild.id, 'automod', message.author.id, message.client.user.id, reason, timeoutSec || undefined);
    if (message.channel.isSendable()) {
      const notice = await message.channel.send({ embeds: [embed('Automod', `${message.author}, ${reason.toLowerCase()}${applied}.`)], allowedMentions: { users: [message.author.id] } });
      setTimeout(() => notice.delete().catch(() => undefined), 6_000).unref();
    }
    await sendLog(message.guild, embed(`Automod • Case #${caseNo}`, `**User:** ${message.author} \`${message.author.id}\`\n**Channel:** ${message.channel}\n**Reason:** ${reason}${applied}`), s);
  } catch (err) {
    logger.warn('Automod action failed', err as Error);
  }
  return true;
}

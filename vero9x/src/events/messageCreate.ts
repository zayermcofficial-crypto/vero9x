import { Events, Message } from 'discord.js';
import { handleAiMessage, shouldRespond } from '../ai/chat';
import { db } from '../database/db';
import { runAutomod } from '../systems/automod';
import { handleMessageXp } from '../systems/leveling';
import { BotEvent } from '../types';
import { alreadySeen } from '../utils/dedupe';
import { embed } from '../utils/embeds';

async function handleAfk(message: Message): Promise<void> {
  if (!message.guild || !message.channel.isSendable()) return;
  const gid = message.guild.id;
  const own = db.prepare('DELETE FROM afk WHERE guild_id = ? AND user_id = ?').run(gid, message.author.id);
  if (Number(own.changes) > 0) {
    const n = await message.channel.send({ embeds: [embed('Welcome back', `${message.author}, I removed your AFK status.`)], allowedMentions: { parse: [] } });
    setTimeout(() => n.delete().catch(() => undefined), 6_000).unref();
  }
  const lines: string[] = [];
  for (const u of [...message.mentions.users.values()].slice(0, 3)) {
    if (u.id === message.author.id) continue;
    const row = db.prepare('SELECT reason, since FROM afk WHERE guild_id = ? AND user_id = ?').get(gid, u.id) as { reason: string; since: number } | undefined;
    if (row) lines.push(`**${u.username}** is AFK: ${row.reason} (<t:${Math.floor(row.since / 1000)}:R>)`);
  }
  if (lines.length) await message.reply({ embeds: [embed('AFK', lines.join('\n'))], allowedMentions: { parse: [], repliedUser: false } });
}

const event: BotEvent = {
  name: Events.MessageCreate,
  async execute(message: Message) {
    if (message.author.bot || !message.guild || !message.member) return;
    if (alreadySeen(message.id)) return;
    if (await runAutomod(message)) return;
    await handleAfk(message);
    await handleMessageXp(message);
    if (shouldRespond(message)) await handleAiMessage(message);
  },
};
export default event;

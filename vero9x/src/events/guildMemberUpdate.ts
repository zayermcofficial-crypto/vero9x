import { Events, GuildMember, PartialGuildMember } from 'discord.js';
import { getSettings } from '../database/db';
import { sendLog } from '../systems/moderation';
import { BotEvent } from '../types';
import { embed } from '../utils/embeds';

const event: BotEvent = {
  name: Events.GuildMemberUpdate,
  async execute(oldM: GuildMember | PartialGuildMember, newM: GuildMember) {
    if (oldM.partial) return;
    const added = newM.roles.cache.filter((r) => !oldM.roles.cache.has(r.id));
    const removed = oldM.roles.cache.filter((r) => !newM.roles.cache.has(r.id));
    if (!added.size && !removed.size) return;
    const s = getSettings(newM.guild.id);
    if (!s.log_messages) return;
    const lines = [...added.map((r) => `➕ ${r}`), ...removed.map((r) => `➖ ${r}`)].join('\n');
    await sendLog(newM.guild, embed('Roles updated', `${newM} \`${newM.id}\`\n${lines}`), s);
  },
};
export default event;

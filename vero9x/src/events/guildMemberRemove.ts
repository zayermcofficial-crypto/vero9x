import { Events, GuildMember, PartialGuildMember } from 'discord.js';
import { getSettings } from '../database/db';
import { sendLog } from '../systems/moderation';
import { BotEvent } from '../types';
import { COLORS, embed } from '../utils/embeds';

const event: BotEvent = {
  name: Events.GuildMemberRemove,
  async execute(member: GuildMember | PartialGuildMember) {
    const s = getSettings(member.guild.id);
    const name = member.user?.tag ?? 'A member';
    await sendLog(member.guild, embed('Member left', `**${name}** \`${member.id}\``, COLORS.danger), s);
    if (!s.goodbye_channel) return;
    const ch = await member.guild.channels.fetch(s.goodbye_channel).catch(() => null);
    if (!ch?.isTextBased() || !('send' in ch)) return;
    await ch.send({
      embeds: [embed('Goodbye', `**${name}** left the server. We're now **${member.guild.memberCount}** members.`, COLORS.charcoal)],
      allowedMentions: { parse: [] },
    });
  },
};
export default event;

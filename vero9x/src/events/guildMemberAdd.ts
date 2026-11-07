import { Events, GuildMember } from 'discord.js';
import { getSettings } from '../database/db';
import { checkRaid } from '../systems/antiraid';
import { sendLog } from '../systems/moderation';
import { renderTemplate } from '../systems/welcome';
import { BotEvent } from '../types';
import { COLORS, embed } from '../utils/embeds';
import { logger } from '../utils/logger';

const event: BotEvent = {
  name: Events.GuildMemberAdd,
  async execute(member: GuildMember) {
    const s = getSettings(member.guild.id);
    await checkRaid(member);
    await sendLog(member.guild, embed('Member joined', `${member} \`${member.id}\`\nAccount created <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, COLORS.success), s);

    if (s.welcome_role) {
      await member.roles.add(s.welcome_role, 'VERO9X auto-role').catch((e) => logger.warn(`Auto-role failed in ${member.guild.id}`, e as Error));
    }
    if (!s.welcome_channel) return;
    const ch = await member.guild.channels.fetch(s.welcome_channel).catch(() => null);
    if (!ch?.isTextBased() || !('send' in ch)) return;
    const text = renderTemplate(s.welcome_message ?? 'Welcome {user} to **{server}**! You are member **#{count}**.', member);
    await ch.send({
      content: `${member}`,
      embeds: [embed(`Welcome to ${member.guild.name}`, text).setThumbnail(member.displayAvatarURL({ size: 256 }))],
      allowedMentions: { users: [member.id] },
    });
  },
};
export default event;

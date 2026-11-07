import { MessageFlags, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { countCases, getCases } from '../../systems/moderation';
import { Command } from '../../types';
import { embed } from '../../utils/embeds';

const command: Command = {
  perms: [PermissionFlagsBits.ModerateMembers],
  data: new SlashCommandBuilder().setName('warnings').setDescription("View a member's warning history")
    .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)),
  async execute(i) {
    const user = i.options.getUser('user', true);
    const rows = getCases(i.guildId!, user.id, 'warn', 10);
    const total = countCases(i.guildId!, user.id, 'warn');
    const desc = rows.length
      ? rows.map((r) => `**#${r.case_no}** • <t:${Math.floor(r.created_at / 1000)}:R> • by <@${r.moderator_id}>\n> ${r.reason}`).join('\n\n')
      : 'No warnings. Clean record.';
    await i.reply({ embeds: [embed(`Warnings • ${user.username}`, desc).setThumbnail(user.displayAvatarURL()).setFooter({ text: `VERO9X • ${total} total warning(s)` })], flags: MessageFlags.Ephemeral });
  },
};
export default command;

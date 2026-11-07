import { MessageFlags, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getCases } from '../../systems/moderation';
import { Command } from '../../types';
import { embed } from '../../utils/embeds';

const command: Command = {
  perms: [PermissionFlagsBits.ModerateMembers],
  data: new SlashCommandBuilder().setName('modlogs').setDescription('Full moderation history for a member')
    .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)),
  async execute(i) {
    const user = i.options.getUser('user', true);
    const rows = getCases(i.guildId!, user.id, undefined, 15);
    const desc = rows.length
      ? rows.map((r) => `**#${r.case_no} ${r.type.toUpperCase()}** • <t:${Math.floor(r.created_at / 1000)}:d> • <@${r.moderator_id}>\n> ${r.reason.slice(0, 120)}`).join('\n')
      : 'No moderation history.';
    await i.reply({ embeds: [embed(`Mod logs • ${user.username}`, desc.slice(0, 4000)).setThumbnail(user.displayAvatarURL())], flags: MessageFlags.Ephemeral });
  },
};
export default command;

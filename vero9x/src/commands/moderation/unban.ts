import { MessageFlags, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { caseEmbed, createCase, sendLog } from '../../systems/moderation';
import { Command } from '../../types';
import { errorEmbed } from '../../utils/embeds';

const command: Command = {
  perms: [PermissionFlagsBits.BanMembers],
  data: new SlashCommandBuilder().setName('unban').setDescription('Unban a user by ID')
    .addStringOption((o) => o.setName('user_id').setDescription('Discord user ID').setRequired(true).setMinLength(15).setMaxLength(25))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  async execute(i) {
    const id = i.options.getString('user_id', true).trim();
    const reason = i.options.getString('reason') ?? 'No reason provided';
    if (!/^\d{15,25}$/.test(id)) return void (await i.reply({ embeds: [errorEmbed('That is not a valid user ID.')], flags: MessageFlags.Ephemeral }));
    const ban = await i.guild!.bans.fetch(id).catch(() => null);
    if (!ban) return void (await i.reply({ embeds: [errorEmbed('That user is not banned.')], flags: MessageFlags.Ephemeral }));
    await i.guild!.members.unban(id, `${i.user.tag}: ${reason}`);
    const n = createCase(i.guildId!, 'unban', id, i.user.id, reason);
    const e = caseEmbed('unban', n, ban.user, i.user, reason);
    await i.reply({ embeds: [e] });
    await sendLog(i.guild!, e);
  },
};
export default command;

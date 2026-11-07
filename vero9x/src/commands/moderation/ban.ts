import { MessageFlags, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { caseEmbed, checkTarget, createCase, dmUser, sendLog } from '../../systems/moderation';
import { Command } from '../../types';
import { embed, errorEmbed } from '../../utils/embeds';

const command: Command = {
  perms: [PermissionFlagsBits.BanMembers],
  data: new SlashCommandBuilder().setName('ban').setDescription('Ban a user')
    .addUserOption((o) => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500))
    .addIntegerOption((o) => o.setName('delete_days').setDescription('Days of messages to delete (0-7)').setMinValue(0).setMaxValue(7)),
  async execute(i) {
    const user = i.options.getUser('user', true);
    const reason = i.options.getString('reason') ?? 'No reason provided';
    const days = i.options.getInteger('delete_days') ?? 0;
    const member = await i.guild!.members.fetch(user.id).catch(() => null);
    if (member) {
      const problem = (await checkTarget(i, member)) ?? (member.bannable ? null : 'I cannot ban that member (my role is too low).');
      if (problem) return void (await i.reply({ embeds: [errorEmbed(problem)], flags: MessageFlags.Ephemeral }));
      await dmUser(user, embed(`You were banned from ${i.guild!.name}`, `**Reason:** ${reason}`));
    } else if (user.id === i.user.id || user.id === i.client.user.id) {
      return void (await i.reply({ embeds: [errorEmbed("That's not a valid target.")], flags: MessageFlags.Ephemeral }));
    }
    await i.guild!.members.ban(user.id, { reason: `${i.user.tag}: ${reason}`, deleteMessageSeconds: days * 86400 });
    const n = createCase(i.guildId!, 'ban', user.id, i.user.id, reason);
    const e = caseEmbed('ban', n, user, i.user, reason);
    await i.reply({ embeds: [e] });
    await sendLog(i.guild!, e);
  },
};
export default command;

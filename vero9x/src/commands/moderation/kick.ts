import { MessageFlags, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { caseEmbed, checkTarget, createCase, dmUser, sendLog } from '../../systems/moderation';
import { Command } from '../../types';
import { embed, errorEmbed } from '../../utils/embeds';

const command: Command = {
  perms: [PermissionFlagsBits.KickMembers],
  data: new SlashCommandBuilder().setName('kick').setDescription('Kick a member')
    .addUserOption((o) => o.setName('user').setDescription('Member to kick').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  async execute(i) {
    const user = i.options.getUser('user', true);
    const reason = i.options.getString('reason') ?? 'No reason provided';
    const member = await i.guild!.members.fetch(user.id).catch(() => null);
    if (!member) return void (await i.reply({ embeds: [errorEmbed('That user is not in this server.')], flags: MessageFlags.Ephemeral }));
    const problem = (await checkTarget(i, member)) ?? (member.kickable ? null : 'I cannot kick that member (my role is too low).');
    if (problem) return void (await i.reply({ embeds: [errorEmbed(problem)], flags: MessageFlags.Ephemeral }));

    await dmUser(user, embed(`You were kicked from ${i.guild!.name}`, `**Reason:** ${reason}`));
    await member.kick(`${i.user.tag}: ${reason}`);
    const n = createCase(i.guildId!, 'kick', user.id, i.user.id, reason);
    const e = caseEmbed('kick', n, user, i.user, reason);
    await i.reply({ embeds: [e] });
    await sendLog(i.guild!, e);
  },
};
export default command;

import { MessageFlags, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { caseEmbed, createCase, sendLog } from '../../systems/moderation';
import { Command } from '../../types';
import { errorEmbed } from '../../utils/embeds';

const command: Command = {
  perms: [PermissionFlagsBits.ModerateMembers],
  data: new SlashCommandBuilder().setName('untimeout').setDescription('Remove a timeout')
    .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  async execute(i) {
    const user = i.options.getUser('user', true);
    const reason = i.options.getString('reason') ?? 'No reason provided';
    const member = await i.guild!.members.fetch(user.id).catch(() => null);
    if (!member || !member.isCommunicationDisabled()) return void (await i.reply({ embeds: [errorEmbed('That member is not timed out.')], flags: MessageFlags.Ephemeral }));
    if (!member.moderatable) return void (await i.reply({ embeds: [errorEmbed('I cannot modify that member (my role is too low).')], flags: MessageFlags.Ephemeral }));
    await member.timeout(null, `${i.user.tag}: ${reason}`);
    const n = createCase(i.guildId!, 'untimeout', user.id, i.user.id, reason);
    const e = caseEmbed('untimeout', n, user, i.user, reason);
    await i.reply({ embeds: [e] });
    await sendLog(i.guild!, e);
  },
};
export default command;

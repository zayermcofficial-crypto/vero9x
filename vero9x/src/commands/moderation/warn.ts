import { MessageFlags, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { applyWarnThresholds, caseEmbed, checkTarget, countCases, createCase, dmUser, sendLog } from '../../systems/moderation';
import { Command } from '../../types';
import { embed, errorEmbed } from '../../utils/embeds';

const command: Command = {
  perms: [PermissionFlagsBits.ModerateMembers],
  data: new SlashCommandBuilder().setName('warn').setDescription('Warn a member')
    .addUserOption((o) => o.setName('user').setDescription('Member to warn').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(500)),
  async execute(i) {
    const user = i.options.getUser('user', true);
    const reason = i.options.getString('reason', true);
    const member = await i.guild!.members.fetch(user.id).catch(() => null);
    if (!member) return void (await i.reply({ embeds: [errorEmbed('That user is not in this server.')], flags: MessageFlags.Ephemeral }));
    const problem = await checkTarget(i, member);
    if (problem) return void (await i.reply({ embeds: [errorEmbed(problem)], flags: MessageFlags.Ephemeral }));
    if (user.bot) return void (await i.reply({ embeds: [errorEmbed("Bots can't be warned.")], flags: MessageFlags.Ephemeral }));

    const caseNo = createCase(i.guildId!, 'warn', user.id, i.user.id, reason);
    const total = countCases(i.guildId!, user.id, 'warn');
    const dmOk = await dmUser(user, embed(`You were warned in ${i.guild!.name}`, `**Reason:** ${reason}\n**Total warnings:** ${total}`));
    const auto = await applyWarnThresholds(i.guild!, member, total, i.client.user.id);
    const e = caseEmbed('warn', caseNo, user, i.user, reason).addFields({ name: 'Total warnings', value: String(total), inline: true });
    if (auto) e.addFields({ name: 'Automatic action', value: auto });
    if (!dmOk) e.setFooter({ text: 'VERO9X • Clan Systems  |  DM failed (closed DMs)' });
    await i.reply({ embeds: [e] });
    await sendLog(i.guild!, e);
  },
};
export default command;

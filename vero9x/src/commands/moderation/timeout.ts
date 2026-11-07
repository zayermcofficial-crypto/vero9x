import { MessageFlags, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { caseEmbed, checkTarget, createCase, dmUser, formatDuration, parseDuration, sendLog } from '../../systems/moderation';
import { Command } from '../../types';
import { embed, errorEmbed } from '../../utils/embeds';

const MAX = 28 * 86400;
const command: Command = {
  perms: [PermissionFlagsBits.ModerateMembers],
  data: new SlashCommandBuilder().setName('timeout').setDescription('Timeout a member')
    .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption((o) => o.setName('duration').setDescription('e.g. 10m, 2h, 1d (max 28d)').setRequired(true).setMaxLength(8))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  async execute(i) {
    const user = i.options.getUser('user', true);
    const reason = i.options.getString('reason') ?? 'No reason provided';
    const sec = parseDuration(i.options.getString('duration', true));
    const fail = (m: string) => i.reply({ embeds: [errorEmbed(m)], flags: MessageFlags.Ephemeral });
    if (!sec || sec < 5 || sec > MAX) return void (await fail('Invalid duration. Use e.g. `10m`, `2h`, `1d` (5s – 28d).'));
    const member = await i.guild!.members.fetch(user.id).catch(() => null);
    if (!member) return void (await fail('That user is not in this server.'));
    const problem = (await checkTarget(i, member)) ?? (member.moderatable ? null : 'I cannot timeout that member (my role is too low).');
    if (problem) return void (await fail(problem));

    await member.timeout(sec * 1000, `${i.user.tag}: ${reason}`);
    await dmUser(user, embed(`You were timed out in ${i.guild!.name}`, `**Duration:** ${formatDuration(sec)}\n**Reason:** ${reason}`));
    const n = createCase(i.guildId!, 'timeout', user.id, i.user.id, reason, sec);
    const e = caseEmbed('timeout', n, user, i.user, reason, sec);
    await i.reply({ embeds: [e] });
    await sendLog(i.guild!, e);
  },
};
export default command;

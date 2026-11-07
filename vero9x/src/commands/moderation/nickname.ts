import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { checkTarget, sendLog } from '../../systems/moderation';
import { Command } from '../../types';
import { embed, errorEmbed, successEmbed } from '../../utils/embeds';

const command: Command = {
  perms: [PermissionFlagsBits.ManageNicknames],
  data: new SlashCommandBuilder().setName('nickname').setDescription("Change or reset a member's nickname")
    .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption((o) => o.setName('nickname').setDescription('New nickname (leave empty to reset)').setMaxLength(32)),
  async execute(i) {
    const user = i.options.getUser('user', true);
    const nick = i.options.getString('nickname');
    const member = await i.guild!.members.fetch(user.id).catch(() => null);
    const fail = (m: string) => i.reply({ embeds: [errorEmbed(m)], flags: MessageFlags.Ephemeral });
    if (!member) return void (await fail('That user is not in this server.'));
    const problem = member.id === i.user.id ? null : await checkTarget(i, member);
    if (problem) return void (await fail(problem));
    if (!member.manageable) return void (await fail('I cannot change that member (my role is too low).'));
    await member.setNickname(nick, `${i.user.tag} via VERO9X`);
    await i.reply({ embeds: [successEmbed(nick ? `${user}'s nickname is now **${nick}**.` : `Reset ${user}'s nickname.`, 'Nickname')] });
    await sendLog(i.guild!, embed('Nickname changed', `${i.user} changed ${user}'s nickname to ${nick ? `**${nick}**` : '*(reset)*'}.`));
  },
};
export default command;

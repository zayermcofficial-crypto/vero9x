import { GuildMember } from 'discord.js';

export function renderTemplate(tpl: string, member: GuildMember): string {
  return tpl
    .replaceAll('{user}', `${member}`)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{count}', String(member.guild.memberCount));
}

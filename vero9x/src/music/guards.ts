import { ChatInputCommandInteraction, GuildMember, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { getSettings } from '../database/db';
import { errorEmbed } from '../utils/embeds';
import { getSession, humansInChannel, musicAvailable, Session } from './manager';

export function voiceCheck(member: GuildMember, s?: Session): string | null {
  const vc = member.voice.channel;
  if (!vc) return 'Join a voice channel first.';
  if (s && vc.id !== s.voiceChannelId) return `I'm playing in <#${s.voiceChannelId}>. Join that channel to control the music.`;
  return null;
}

/** If the server set a DJ role, only DJs / Manage Server holders (or a lone listener) may control playback. */
export function djCheck(member: GuildMember, s: Session): string | null {
  const dj = getSettings(member.guild.id).dj_role;
  if (!dj) return null;
  if (member.roles.cache.has(dj) || member.permissions.has(PermissionFlagsBits.ManageGuild)) return null;
  if (humansInChannel(member.guild, s.voiceChannelId) <= 1) return null;
  return `Only members with <@&${dj}> can control the music in this server.`;
}

type Ctx = { s: Session; member: GuildMember };
/** Runs `fn` only if music is up, a session exists, the user is in the right voice channel and (optionally) is allowed to control it. */
export async function withSession(i: ChatInputCommandInteraction, control: boolean, fn: (c: Ctx) => Promise<void>): Promise<void> {
  const fail = (m: string) => i.reply({ embeds: [errorEmbed(m)], flags: MessageFlags.Ephemeral });
  if (!musicAvailable()) return void (await fail('Music is offline right now. Please try again later.'));
  const s = getSession(i.guildId!);
  if (!s) return void (await fail('Nothing is playing. Start something with `/play`.'));
  const member = await i.guild!.members.fetch(i.user.id);
  const problem = voiceCheck(member, s) ?? (control ? djCheck(member, s) : null);
  if (problem) return void (await fail(problem));
  await fn({ s, member });
}

import { MessageFlags, PermissionsBitField, SlashCommandBuilder, version as djsVersion } from 'discord.js';
import { formatDuration } from '../../systems/moderation';
import { Command } from '../../types';
import { embed, errorEmbed } from '../../utils/embeds';

const P = PermissionsBitField.Flags;
export const INVITE_PERMS = new PermissionsBitField([P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory, P.AddReactions,
  P.ManageMessages, P.ManageChannels, P.ManageRoles, P.ManageNicknames, P.KickMembers, P.BanMembers, P.ModerateMembers]);

const ping: Command = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),
  async execute(i) {
    const sent = await i.reply({ embeds: [embed('Pinging…')], withResponse: true });
    const rtt = sent.resource!.message!.createdTimestamp - i.createdTimestamp;
    await i.editReply({ embeds: [embed('Pong', `**Round-trip:** \`${rtt}ms\`\n**API heartbeat:** \`${Math.round(i.client.ws.ping)}ms\``)] });
  },
};
const uptime: Command = {
  data: new SlashCommandBuilder().setName('uptime').setDescription('How long VERO9X has been online'),
  async execute(i) { await i.reply({ embeds: [embed('Uptime', `Online for **${formatDuration(Math.floor(process.uptime()))}**`)] }); },
};
const botinfo: Command = {
  data: new SlashCommandBuilder().setName('botinfo').setDescription('About VERO9X'),
  async execute(i) {
    await i.reply({ embeds: [embed('VERO9X', 'Multipurpose bot: moderation, leveling, economy, games, utility and AI.').addFields(
      { name: 'Servers', value: String(i.client.guilds.cache.size), inline: true },
      { name: 'Uptime', value: formatDuration(Math.floor(process.uptime())), inline: true },
      { name: 'Memory', value: `${(process.memoryUsage().rss / 1048576).toFixed(0)} MB`, inline: true },
      { name: 'Runtime', value: `Node ${process.version} • discord.js ${djsVersion}` },
    )] });
  },
};
const invite: Command = {
  data: new SlashCommandBuilder().setName('invite').setDescription('Get the VERO9X invite link'),
  async execute(i) {
    const url = `https://discord.com/oauth2/authorize?client_id=${i.client.user.id}&permissions=${INVITE_PERMS.bitfield}&scope=bot%20applications.commands`;
    await i.reply({ embeds: [embed('Invite VERO9X', `[Add VERO9X to your server](${url})`)], flags: MessageFlags.Ephemeral });
  },
};
const membercount: Command = {
  data: new SlashCommandBuilder().setName('membercount').setDescription('Total members in this server'),
  async execute(i) { await i.reply({ embeds: [embed('Members', `**${i.guild!.memberCount.toLocaleString()}** members in ${i.guild!.name}`)] }); },
};
const serverinfo: Command = {
  data: new SlashCommandBuilder().setName('serverinfo').setDescription('Info about this server'),
  async execute(i) {
    const g = i.guild!;
    const e = embed(g.name).addFields(
      { name: 'Owner', value: `<@${g.ownerId}>`, inline: true }, { name: 'Members', value: String(g.memberCount), inline: true },
      { name: 'Channels', value: String(g.channels.cache.size), inline: true }, { name: 'Roles', value: String(g.roles.cache.size), inline: true },
      { name: 'Boosts', value: String(g.premiumSubscriptionCount ?? 0), inline: true }, { name: 'Created', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:R>`, inline: true },
    );
    const icon = g.iconURL({ size: 256 });
    if (icon) e.setThumbnail(icon);
    await i.reply({ embeds: [e] });
  },
};
const userinfo: Command = {
  data: new SlashCommandBuilder().setName('userinfo').setDescription('Info about a member')
    .addUserOption((o) => o.setName('user').setDescription('Defaults to you')),
  async execute(i) {
    const user = i.options.getUser('user') ?? i.user;
    const member = await i.guild!.members.fetch(user.id).catch(() => null);
    const e = embed(user.username).setThumbnail(user.displayAvatarURL({ size: 256 })).addFields(
      { name: 'ID', value: `\`${user.id}\``, inline: true }, { name: 'Account created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true });
    if (member) {
      const roles = member.roles.cache.filter((r) => r.id !== i.guildId).sort((a, b) => b.position - a.position).map((r) => `${r}`);
      e.addFields({ name: 'Joined server', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown', inline: true },
        { name: `Roles (${roles.length})`, value: roles.slice(0, 15).join(' ') || 'None' });
    }
    await i.reply({ embeds: [e] });
  },
};
const avatar: Command = {
  data: new SlashCommandBuilder().setName('avatar').setDescription("Show a user's avatar")
    .addUserOption((o) => o.setName('user').setDescription('Defaults to you')),
  async execute(i) {
    const u = i.options.getUser('user') ?? i.user;
    await i.reply({ embeds: [embed(`${u.username}'s avatar`).setImage(u.displayAvatarURL({ size: 1024 }))] });
  },
};
const banner: Command = {
  data: new SlashCommandBuilder().setName('banner').setDescription("Show a user's profile banner")
    .addUserOption((o) => o.setName('user').setDescription('Defaults to you')),
  async execute(i) {
    const u = await (i.options.getUser('user') ?? i.user).fetch(true);
    const url = u.bannerURL({ size: 1024 });
    if (!url) return void (await i.reply({ embeds: [errorEmbed(`${u.username} has no banner.`)], flags: MessageFlags.Ephemeral }));
    await i.reply({ embeds: [embed(`${u.username}'s banner`).setImage(url)] });
  },
};
export default [ping, uptime, botinfo, invite, membercount, serverinfo, userinfo, avatar, banner];

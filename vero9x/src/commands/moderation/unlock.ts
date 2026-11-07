import { ChannelType, MessageFlags, SlashCommandBuilder, TextChannel, PermissionFlagsBits } from 'discord.js';
import { embed, errorEmbed } from '../../utils/embeds';
import { sendLog } from '../../systems/moderation';
import { Command } from '../../types';

const command: Command = {
  perms: [PermissionFlagsBits.ManageChannels],
  data: new SlashCommandBuilder().setName('unlock').setDescription('Let @everyone send messages in a channel again')
    .addChannelOption((o) => o.setName('channel').setDescription('Defaults to this channel').addChannelTypes(ChannelType.GuildText))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(300)),
  async execute(i) {
    const ch = (i.options.getChannel('channel') ?? i.channel) as TextChannel | null;
    if (!ch || ch.type !== ChannelType.GuildText) return void (await i.reply({ embeds: [errorEmbed('Pick a text channel.')], flags: MessageFlags.Ephemeral }));
    const reason = i.options.getString('reason') ?? 'No reason provided';
    await ch.permissionOverwrites.edit(i.guild!.roles.everyone, { SendMessages: null }, { reason: `${i.user.tag}: ${reason}` });
    const e = embed('🔓 Channel unlocked', `${ch} is unlocked.\n**Reason:** ${reason}`);
    await i.reply({ embeds: [e] });
    await sendLog(i.guild!, e);
  },
};
export default command;

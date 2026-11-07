import { ChannelType, MessageFlags, SlashCommandBuilder, TextChannel, PermissionFlagsBits } from 'discord.js';
import { embed, errorEmbed } from '../../utils/embeds';
import { sendLog } from '../../systems/moderation';
import { Command } from '../../types';

const command: Command = {
  perms: [PermissionFlagsBits.ManageChannels],
  data: new SlashCommandBuilder().setName('slowmode').setDescription('Set channel slowmode')
    .addIntegerOption((o) => o.setName('seconds').setDescription('0 disables (max 21600)').setRequired(true).setMinValue(0).setMaxValue(21600))
    .addChannelOption((o) => o.setName('channel').setDescription('Defaults to this channel').addChannelTypes(ChannelType.GuildText)),
  async execute(i) {
    const ch = (i.options.getChannel('channel') ?? i.channel) as TextChannel | null;
    if (!ch || ch.type !== ChannelType.GuildText) return void (await i.reply({ embeds: [errorEmbed('Pick a text channel.')], flags: MessageFlags.Ephemeral }));
    const sec = i.options.getInteger('seconds', true);
    await ch.setRateLimitPerUser(sec, `${i.user.tag} via VERO9X`);
    const e = embed('⏱ Slowmode', sec ? `${ch} slowmode set to **${sec}s**.` : `Slowmode disabled in ${ch}.`);
    await i.reply({ embeds: [e] });
    await sendLog(i.guild!, e);
  },
};
export default command;

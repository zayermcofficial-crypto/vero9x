import { ChannelType, MessageFlags, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { embed, errorEmbed, successEmbed } from '../../utils/embeds';
import { sendLog } from '../../systems/moderation';
import { Command } from '../../types';

const command: Command = {
  perms: [PermissionFlagsBits.ManageMessages],
  data: new SlashCommandBuilder().setName('clear').setDescription('Delete the last N messages in this channel')
    .addIntegerOption((o) => o.setName('amount').setDescription('1-100').setRequired(true).setMinValue(1).setMaxValue(100)),
  async execute(i) {
    const ch = i.channel;
    if (!ch || ch.type !== ChannelType.GuildText) return void (await i.reply({ embeds: [errorEmbed('Use this in a server text channel.')], flags: MessageFlags.Ephemeral }));
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const deleted = await ch.bulkDelete(i.options.getInteger('amount', true), true);
    await i.editReply({ embeds: [successEmbed(`Deleted **${deleted.size}** message(s). (Discord can't bulk-delete messages older than 14 days.)`)] });
    await sendLog(i.guild!, embed('Messages cleared', `${i.user} cleared **${deleted.size}** message(s) in ${ch}.`));
  },
};
export default command;

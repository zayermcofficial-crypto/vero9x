import { ChannelType, Message, MessageFlags, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { embed, errorEmbed, successEmbed } from '../../utils/embeds';
import { sendLog } from '../../systems/moderation';
import { Command } from '../../types';

const command: Command = {
  perms: [PermissionFlagsBits.ManageMessages],
  data: new SlashCommandBuilder().setName('purge').setDescription('Filtered cleanup of the last 100 messages')
    .addStringOption((o) => o.setName('filter').setDescription('What to delete').setRequired(true).addChoices(
      { name: 'From a specific user', value: 'user' }, { name: 'From bots', value: 'bots' },
      { name: 'Containing links', value: 'links' }, { name: 'With attachments', value: 'attachments' }))
    .addUserOption((o) => o.setName('user').setDescription('Required when filter is "user"')),
  async execute(i) {
    const ch = i.channel;
    if (!ch || ch.type !== ChannelType.GuildText) return void (await i.reply({ embeds: [errorEmbed('Use this in a server text channel.')], flags: MessageFlags.Ephemeral }));
    const filter = i.options.getString('filter', true);
    const user = i.options.getUser('user');
    if (filter === 'user' && !user) return void (await i.reply({ embeds: [errorEmbed('Pick a `user` for the user filter.')], flags: MessageFlags.Ephemeral }));
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const msgs = await ch.messages.fetch({ limit: 100 });
    const test: Record<string, (m: Message) => boolean> = {
      user: (m) => m.author.id === user?.id, bots: (m) => m.author.bot,
      links: (m) => /https?:\/\/\S+/i.test(m.content), attachments: (m) => m.attachments.size > 0,
    };
    const deleted = await ch.bulkDelete(msgs.filter(test[filter]), true);
    await i.editReply({ embeds: [successEmbed(`Purged **${deleted.size}** message(s) (filter: ${filter}).`)] });
    await sendLog(i.guild!, embed('Messages purged', `${i.user} purged **${deleted.size}** message(s) in ${ch} (filter: \`${filter}\`).`));
  },
};
export default command;

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { withSession } from '../../music/guards';
import { nowPlayingEmbed, queueEmbed } from '../../music/ui';
import { Command } from '../../types';
import { errorEmbed, successEmbed } from '../../utils/embeds';

const EPH = MessageFlags.Ephemeral;

const queue: Command = {
  data: new SlashCommandBuilder().setName('queue').setDescription('Show the music queue')
    .addIntegerOption((o) => o.setName('page').setDescription('Page number').setMinValue(1).setMaxValue(100)),
  execute: (i) => withSession(i, false, async ({ s }) => {
    let page = i.options.getInteger('page') ?? 1;
    const rows = (pages: number) => [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`q:${i.id}:prev`).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
      new ButtonBuilder().setCustomId(`q:${i.id}:next`).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= pages))];
    const first = queueEmbed(s, page);
    page = Math.min(page, first.pages);
    const res = await i.reply({ embeds: [first.embed], components: first.pages > 1 ? rows(first.pages) : [], withResponse: true });
    if (first.pages <= 1) return;
    const collector = res.resource!.message!.createMessageComponentCollector({ componentType: ComponentType.Button, time: 90_000, filter: (x) => x.user.id === i.user.id && x.customId.startsWith(`q:${i.id}:`) });
    collector.on('collect', async (x) => {
      page += x.customId.endsWith('next') ? 1 : -1;
      const q = queueEmbed(s, page);
      page = Math.min(Math.max(1, page), q.pages);
      await x.update({ embeds: [q.embed], components: rows(q.pages) });
    });
    collector.on('end', () => void i.editReply({ components: [] }).catch(() => undefined));
  }),
};
const nowplaying: Command = {
  data: new SlashCommandBuilder().setName('nowplaying').setDescription('Show the current song'),
  execute: (i) => withSession(i, false, async ({ s }) => {
    if (!s.queue.current) return void (await i.reply({ embeds: [errorEmbed('Nothing is playing.')], flags: EPH }));
    await i.reply({ embeds: [nowPlayingEmbed(s)] });
  }),
};
const remove: Command = {
  data: new SlashCommandBuilder().setName('remove').setDescription('Remove a song from the queue')
    .addIntegerOption((o) => o.setName('position').setDescription('Position in /queue').setRequired(true).setMinValue(1).setMaxValue(500)),
  execute: (i) => withSession(i, true, async ({ s }) => {
    const t = s.queue.remove(i.options.getInteger('position', true));
    if (!t) return void (await i.reply({ embeds: [errorEmbed('There is no track at that position.')], flags: EPH }));
    await i.reply({ embeds: [successEmbed(`Removed **${t.title}**.`, 'Removed')] });
  }),
};
const clearqueue: Command = {
  data: new SlashCommandBuilder().setName('clearqueue').setDescription('Clear all upcoming songs (keeps the current one)'),
  execute: (i) => withSession(i, true, async ({ s }) => { const n = s.queue.clearUpcoming(); await i.reply({ embeds: [successEmbed(`Cleared **${n}** queued track(s).`, 'Queue cleared')] }); }),
};
export default [queue, nowplaying, remove, clearqueue];

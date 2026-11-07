import { ActionRowBuilder, ComponentType, MessageFlags, SlashCommandBuilder, StringSelectMenuBuilder } from 'discord.js';
import { Command } from '../../types';
import { embed } from '../../utils/embeds';

const ICONS: Record<string, string> = { moderation: '🛡️', utility: '🧰', leveling: '📈', economy: '💰', fun: '🎮', ai: '🤖', admin: '⚙️' };

const command: Command = {
  data: new SlashCommandBuilder().setName('help').setDescription('Browse everything VERO9X can do'),
  async execute(i) {
    const groups = new Map<string, string[]>();
    for (const c of i.client.commands.values()) {
      if (c.perms?.length && !i.memberPermissions?.has(c.perms)) continue;
      groups.set(c.category, [...(groups.get(c.category) ?? []), `\`/${c.data.name}\` — ${c.data.description}`]);
    }
    const cats = [...groups.keys()].sort();
    const home = () => embed('VERO9X • Command Center', 'Pick a category below. You only see commands you can use.')
      .addFields(cats.map((c) => ({ name: `${ICONS[c] ?? '•'} ${c}`, value: `${groups.get(c)!.length} commands`, inline: true })));
    const menu = new StringSelectMenuBuilder().setCustomId(`help:${i.id}`).setPlaceholder('Choose a category')
      .addOptions([{ label: 'Overview', value: '__home', emoji: '🏠' }, ...cats.map((c) => ({ label: c[0].toUpperCase() + c.slice(1), value: c, emoji: ICONS[c] }))]);
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
    const res = await i.reply({ embeds: [home()], components: [row], flags: MessageFlags.Ephemeral, withResponse: true });
    const collector = res.resource!.message!.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 120_000, filter: (x) => x.user.id === i.user.id });
    collector.on('collect', async (x) => {
      const v = x.values[0];
      if (v === '__home') return void (await x.update({ embeds: [home()] }));
      await x.update({ embeds: [embed(`${ICONS[v] ?? ''} ${v}`, groups.get(v)!.join('\n').slice(0, 4000))] });
    });
    collector.on('end', () => void i.editReply({ components: [] }).catch(() => undefined));
  },
};
export default command;

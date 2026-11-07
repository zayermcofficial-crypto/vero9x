import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getNode, musicAvailable } from '../../music/manager';
import { Command } from '../../types';
import { embed, errorEmbed } from '../../utils/embeds';

const TESTS: [string, string][] = [
  ['SoundCloud search "lofi"', 'scsearch:lofi'],
  ['SoundCloud search "daft punk one more time"', 'scsearch:daft punk one more time'],
  ['SoundCloud search "mala"', 'scsearch:mala'],
  ['Direct MP3 link', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'],
];

const command: Command = {
  perms: [PermissionFlagsBits.ManageGuild],
  data: new SlashCommandBuilder().setName('musicdiag').setDescription('Test the music server (admin)'),
  async execute(i) {
    if (!musicAvailable()) return void (await i.reply({ embeds: [errorEmbed('The bot is not connected to Lavalink. Check LAVALINK_URL / LAVALINK_PASSWORD and the Lavalink service.')], flags: MessageFlags.Ephemeral }));
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const node = getNode()!;
    const info = await node.rest.getLavalinkInfo().catch(() => undefined);
    const e = embed('🔧 Music diagnostics', info
      ? `Lavalink **${info.version.semver}**\nSources: ${info.sourceManagers.join(', ') || 'none'}\nPlugins: ${info.plugins.map((p) => p.name).join(', ') || 'none'}`
      : 'Connected, but could not read server info.');
    for (const [label, id] of TESTS) {
      let line: string;
      try {
        const r = await node.rest.resolve(id);
        if (!r) line = '❌ no answer';
        else if (r.loadType === 'search') line = r.data.length ? `✅ ${r.data.length} results, first: ${r.data[0].info.title}` : '⚠️ no results';
        else if (r.loadType === 'track') line = `✅ ${r.data.info.title}`;
        else if (r.loadType === 'playlist') line = `✅ playlist: ${r.data.info.name}`;
        else if (r.loadType === 'empty') line = '⚠️ no results';
        else line = `❌ ${r.data.message}${r.data.cause ? ` — ${r.data.cause}` : ''}`;
      } catch (err) { line = `❌ ${(err as Error).message}`; }
      e.addFields({ name: label, value: line.slice(0, 300) });
    }
    await i.editReply({ embeds: [e] });
  },
};
export default command;

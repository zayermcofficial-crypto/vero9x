import { AutocompleteInteraction, ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { djCheck, voiceCheck, withSession } from '../../music/guards';
import { Resolved, destroySession, enqueue, getOrCreateSession, getSession, musicAvailable, previous, resolveTracks, seek, setPaused, setVolume, skip, stopPlayback, suggest } from '../../music/manager';
import { fmtTime, parseTime } from '../../music/time';
import { trackLink } from '../../music/ui';
import { Command } from '../../types';
import { embed, errorEmbed, successEmbed } from '../../utils/embeds';

const EPH = MessageFlags.Ephemeral;

const play: Command = {
  cooldown: 2,
  data: new SlashCommandBuilder().setName('play').setDescription('Play a song (name, or a SoundCloud / Bandcamp / Twitch / stream URL)')
    .addStringOption((o) => o.setName('query').setDescription('Song name or URL').setRequired(true).setMaxLength(300).setAutocomplete(true)),
  async autocomplete(i: AutocompleteInteraction) {
    const q = i.options.getFocused().trim();
    if (q.length < 3 || /^https?:\/\//i.test(q) || !musicAvailable()) return void (await i.respond([]));
    const out = await Promise.race([suggest(q).catch(() => []), new Promise<[]>((r) => setTimeout(() => r([]), 2300))]);
    await i.respond(out).catch(() => undefined);
  },
  async execute(i) {
    const fail = (m: string) => i.reply({ embeds: [errorEmbed(m)], flags: EPH });
    if (!musicAvailable()) return void (await fail('Music is offline right now. Please try again later.'));
    const member = await i.guild!.members.fetch(i.user.id);
    const vc = member.voice.channel;
    const existing = getSession(i.guildId!);
    const problem = voiceCheck(member, existing);
    if (problem) return void (await fail(problem));
    if (existing) { const dj = djCheck(member, existing); if (dj && existing.queue.current) return void (await fail(dj)); }
    if (!vc || (vc.type !== ChannelType.GuildVoice && vc.type !== ChannelType.GuildStageVoice)) return void (await fail('Join a normal voice channel first.'));
    const me = i.guild!.members.me;
    if (!existing && me) {
      const perms = vc.permissionsFor(me);
      if (!perms.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) return void (await fail(`I need **Connect** and **Speak** in ${vc}. Check the channel permissions (or re-invite me with /invite).`));
      if (!vc.joinable) return void (await fail(`I can't join ${vc} (it may be full).`));
    }
    await i.deferReply();
    const res = await resolveTracks(i.options.getString('query', true).trim(), i.user.id).catch((): Resolved => ({ tracks: [], error: 'The music server had a problem. Try again.' }));
    if (res.error || !res.tracks.length) return void (await i.editReply({ embeds: [errorEmbed(res.error ?? 'No results found.')] }));
    const s = await getOrCreateSession(i.guild!, vc.id, i.channelId);
    const { added, position } = await enqueue(s, res.tracks);
    if (!added) return void (await i.editReply({ embeds: [errorEmbed('The queue is full (500 tracks).')] }));
    const t = res.tracks[0];
    const text = res.playlist ? `Added **${added}** track(s) from **${res.playlist}**.` : position === 0 ? `Starting **${trackLink(t)}**.` : `Queued **${trackLink(t)}** at position **${position}**.`;
    await i.editReply({ embeds: [embed('🎵 Added', text)] });
  },
};
const join: Command = {
  data: new SlashCommandBuilder().setName('join').setDescription('Make VERO9X join your voice channel'),
  async execute(i) {
    if (!musicAvailable()) return void (await i.reply({ embeds: [errorEmbed('Music is offline right now.')], flags: EPH }));
    const member = await i.guild!.members.fetch(i.user.id);
    const vc = member.voice.channel;
    const problem = voiceCheck(member, getSession(i.guildId!));
    if (problem || !vc) return void (await i.reply({ embeds: [errorEmbed(problem ?? 'Join a voice channel first.')], flags: EPH }));
    const me = i.guild!.members.me;
    if (!vc.joinable || !me || !vc.permissionsFor(me).has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) return void (await i.reply({ embeds: [errorEmbed(`I need **Connect** and **Speak** in ${vc}.`)], flags: EPH }));
    await i.deferReply();
    await getOrCreateSession(i.guild!, vc.id, i.channelId);
    await i.editReply({ embeds: [successEmbed(`Joined ${vc}. Use \`/play\` to start the music.`, 'Connected')] });
  },
};
const leave: Command = {
  data: new SlashCommandBuilder().setName('leave').setDescription('Disconnect VERO9X from voice'),
  execute: (i) => withSession(i, true, async () => { await destroySession(i.guildId!); await i.reply({ embeds: [successEmbed('Disconnected.', 'Bye')] }); }),
};
const pause: Command = {
  data: new SlashCommandBuilder().setName('pause').setDescription('Pause the music'),
  execute: (i) => withSession(i, true, async ({ s }) => {
    if (!s.queue.current) return void (await i.reply({ embeds: [errorEmbed('Nothing is playing.')], flags: EPH }));
    await setPaused(s, true); await i.reply({ embeds: [successEmbed('Paused. Use `/resume` to continue.', '⏸ Paused')] });
  }),
};
const resume: Command = {
  data: new SlashCommandBuilder().setName('resume').setDescription('Resume the music'),
  execute: (i) => withSession(i, true, async ({ s }) => { await setPaused(s, false); await i.reply({ embeds: [successEmbed('Back to the music.', '▶ Resumed')] }); }),
};
const skipCmd: Command = {
  data: new SlashCommandBuilder().setName('skip').setDescription('Skip the current song'),
  execute: (i) => withSession(i, true, async ({ s }) => {
    if (!s.queue.current) return void (await i.reply({ embeds: [errorEmbed('Nothing is playing.')], flags: EPH }));
    const t = await skip(s);
    await i.reply({ embeds: [successEmbed(`Skipped **${t?.title ?? 'the track'}**.`, '⏭ Skipped')] });
  }),
};
const prev: Command = {
  data: new SlashCommandBuilder().setName('previous').setDescription('Go back to the previous song'),
  execute: (i) => withSession(i, true, async ({ s }) => {
    if (!(await previous(s))) return void (await i.reply({ embeds: [errorEmbed('There is no previous track.')], flags: EPH }));
    await i.reply({ embeds: [successEmbed('Playing the previous track.', '⏮ Previous')] });
  }),
};
const stop: Command = {
  data: new SlashCommandBuilder().setName('stop').setDescription('Stop the music and clear the queue'),
  execute: (i) => withSession(i, true, async ({ s }) => { await stopPlayback(s); await i.reply({ embeds: [successEmbed('Stopped and cleared the queue.', '⏹ Stopped')] }); }),
};
const seekCmd: Command = {
  data: new SlashCommandBuilder().setName('seek').setDescription('Jump to a time in the current song')
    .addStringOption((o) => o.setName('time').setDescription('e.g. 1:30, 90, 1m30s').setRequired(true).setMaxLength(12)),
  execute: (i) => withSession(i, true, async ({ s }) => {
    const t = s.queue.current;
    if (!t) return void (await i.reply({ embeds: [errorEmbed('Nothing is playing.')], flags: EPH }));
    if (t.isStream) return void (await i.reply({ embeds: [errorEmbed("You can't seek in a live stream.")], flags: EPH }));
    const ms = parseTime(i.options.getString('time', true));
    if (ms === null || ms >= t.length) return void (await i.reply({ embeds: [errorEmbed(`Use a time inside the song (0:00 – ${fmtTime(t.length)}), like \`1:30\`.`)], flags: EPH }));
    await seek(s, ms); await i.reply({ embeds: [successEmbed(`Jumped to **${fmtTime(ms)}**.`, '⏩ Seek')] });
  }),
};
const volume: Command = {
  data: new SlashCommandBuilder().setName('volume').setDescription('Set the volume (5-150)')
    .addIntegerOption((o) => o.setName('level').setDescription('Volume percent').setRequired(true).setMinValue(5).setMaxValue(150)),
  execute: (i) => withSession(i, true, async ({ s }) => { const v = i.options.getInteger('level', true); await setVolume(s, v); await i.reply({ embeds: [successEmbed(`Volume set to **${v}%**.`, '🔊 Volume')] }); }),
};
const loop: Command = {
  data: new SlashCommandBuilder().setName('loop').setDescription('Set loop mode')
    .addStringOption((o) => o.setName('mode').setDescription('Loop mode').setRequired(true).addChoices({ name: 'Off', value: 'off' }, { name: 'Current song', value: 'track' }, { name: 'Whole queue', value: 'queue' })),
  execute: (i) => withSession(i, true, async ({ s }) => { s.queue.loop = i.options.getString('mode', true) as 'off' | 'track' | 'queue'; await i.reply({ embeds: [successEmbed(`Loop is now **${s.queue.loop}**.`, '🔁 Loop')] }); }),
};
const shuffle: Command = {
  data: new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the queue'),
  execute: (i) => withSession(i, true, async ({ s }) => {
    if (s.queue.upcoming.length < 2) return void (await i.reply({ embeds: [errorEmbed('Add at least 2 songs to shuffle.')], flags: EPH }));
    s.queue.shuffle(); await i.reply({ embeds: [successEmbed(`Shuffled **${s.queue.upcoming.length}** tracks.`, '🔀 Shuffle')] });
  }),
};
export default [play, join, leave, pause, resume, skipCmd, prev, stop, seekCmd, volume, loop, shuffle];

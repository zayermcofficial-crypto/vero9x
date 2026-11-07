import { Client, Guild, Message, VoiceState } from 'discord.js';
import { Connectors, Player, Shoukaku, Track } from 'shoukaku';
import { env } from '../config/env';
import { COLORS, embed } from '../utils/embeds';
import { logger } from '../utils/logger';
import { MusicTrack, Queue } from './queue';
import { controlRows, nowPlayingEmbed } from './ui';

export interface Session {
  guildId: string; player: Player; queue: Queue;
  textChannelId: string; voiceChannelId: string;
  npMessage: Message | null; idleTimer: NodeJS.Timeout | null; destroyed: boolean;
}

const DEFAULT_VOLUME = 60;
const IDLE_MS = 3 * 60_000;
const ALONE_MS = 2 * 60_000;
const BLOCKED_HOSTS = /(youtube\.com|youtu\.be|spotify\.com|music\.apple\.com|deezer\.com)/i;

let shoukaku: Shoukaku | null = null;
let discord: Client | null = null;
const sessions = new Map<string, Session>();
const creating = new Map<string, Promise<Session>>();

export function initMusic(client: Client): void {
  discord = client;
  const { url, password, secure } = env.lavalink;
  if (!url || !password) { logger.warn('LAVALINK_URL / LAVALINK_PASSWORD not set — music commands are disabled'); return; }
  shoukaku = new Shoukaku(new Connectors.DiscordJS(client), [{ name: 'main', url, auth: password, secure }], {
    resume: true, resumeTimeout: 30, reconnectTries: 15, reconnectInterval: 5, voiceConnectionTimeout: 15,
  });
  shoukaku.on('ready', (name) => logger.info(`Lavalink node "${name}" connected`));
  shoukaku.on('error', (name, err) => logger.warn(`Lavalink node "${name}" error`, err));
  shoukaku.on('disconnect', (name) => logger.warn(`Lavalink node "${name}" disconnected`));
}

/** True when a Lavalink node is connected and ready. */
export function musicAvailable(): boolean {
  return !!shoukaku && [...shoukaku.nodes.values()].some((n) => (n.state as number) === 1);
}
export const getSession = (guildId: string): Session | undefined => sessions.get(guildId);

function toTrack(t: Track, requesterId: string): MusicTrack {
  return { encoded: t.encoded, title: t.info.title, author: t.info.author, uri: t.info.uri ?? null, length: t.info.length, isStream: t.info.isStream, artwork: t.info.artworkUrl ?? null, requesterId };
}

export interface Resolved { tracks: MusicTrack[]; playlist?: string; error?: string }
/** Text → SoundCloud search (top result). URLs are loaded directly (SoundCloud, Bandcamp, Twitch, Vimeo, direct audio). */
export async function resolveTracks(query: string, requesterId: string): Promise<Resolved> {
  const node = shoukaku?.getIdealNode();
  if (!node) return { tracks: [], error: 'The music server is not connected right now. Try again in a moment.' };
  const isUrl = /^https?:\/\//i.test(query);
  if (isUrl && BLOCKED_HOSTS.test(query)) return { tracks: [], error: 'YouTube, Spotify, Apple Music and Deezer links are not supported. Try a **SoundCloud** or **Bandcamp** link, or just type a song name.' };
  const res = await node.rest.resolve(isUrl ? query : `scsearch:${query}`);
  if (!res) return { tracks: [], error: 'The music server did not answer. Try again.' };
  switch (res.loadType) {
    case 'track': return { tracks: [toTrack(res.data, requesterId)] };
    case 'search': return res.data.length ? { tracks: [toTrack(res.data[0], requesterId)] } : { tracks: [], error: 'No results found.' };
    case 'playlist': return { tracks: res.data.tracks.slice(0, 100).map((t) => toTrack(t, requesterId)), playlist: res.data.info.name };
    case 'empty': return { tracks: [], error: 'No results found.' };
    case 'error': return { tracks: [], error: `Could not load that: ${res.data.message || 'unknown error'}` };
    default: return { tracks: [], error: 'Could not load that.' };
  }
}

/** Up to 5 SoundCloud suggestions for /play autocomplete. */
export async function suggest(query: string): Promise<{ name: string; value: string }[]> {
  const node = shoukaku?.getIdealNode();
  if (!node) return [];
  const res = await node.rest.resolve(`scsearch:${query}`);
  if (res?.loadType !== 'search') return [];
  return res.data.slice(0, 5).map((t) => ({
    name: `${t.info.title} — ${t.info.author}`.slice(0, 100),
    value: (t.info.uri && t.info.uri.length <= 100 ? t.info.uri : `${t.info.title} ${t.info.author}`).slice(0, 100),
  }));
}

export async function getOrCreateSession(guild: Guild, voiceChannelId: string, textChannelId: string): Promise<Session> {
  const existing = sessions.get(guild.id);
  if (existing) { existing.textChannelId = textChannelId; return existing; }
  const pending = creating.get(guild.id);
  if (pending) return pending;
  if (!shoukaku) throw new Error('Music is not configured.');
  const p = (async () => {
    const player = await shoukaku!.joinVoiceChannel({ guildId: guild.id, channelId: voiceChannelId, shardId: guild.shardId, deaf: true });
    await player.setGlobalVolume(DEFAULT_VOLUME);
    const s: Session = { guildId: guild.id, player, queue: new Queue(), textChannelId, voiceChannelId, npMessage: null, idleTimer: null, destroyed: false };
    player.on('end', (ev) => { if (!s.destroyed && (ev.reason === 'finished' || ev.reason === 'loadFailed')) void onTrackEnd(s, ev.reason === 'loadFailed'); });
    player.on('exception', (ev) => { logger.warn(`Track exception in ${s.guildId}: ${ev.exception?.message}`); void say(s, `⚠️ I couldn't play **${s.queue.current?.title ?? 'that track'}** — skipping.`); });
    player.on('stuck', () => { if (!s.destroyed) void skip(s); });
    player.on('closed', (ev) => { if (ev.code === 4014 || ev.code === 4006) void destroySession(s.guildId); });
    sessions.set(guild.id, s);
    scheduleIdle(s, IDLE_MS);
    return s;
  })().finally(() => creating.delete(guild.id));
  creating.set(guild.id, p);
  return p;
}

async function say(s: Session, text: string): Promise<void> {
  const ch = await discord?.channels.fetch(s.textChannelId).catch(() => null);
  if (ch?.isSendable()) await ch.send({ embeds: [embed('VERO9X Music', text, COLORS.charcoal)], allowedMentions: { parse: [] } }).catch(() => undefined);
}

function clearIdle(s: Session) { if (s.idleTimer) { clearTimeout(s.idleTimer); s.idleTimer = null; } }
export function scheduleIdle(s: Session, ms: number): void {
  clearIdle(s);
  s.idleTimer = setTimeout(() => {
    if (s.destroyed) return;
    void say(s, ms === ALONE_MS ? '👋 Everyone left, so I did too.' : '👋 Nothing left to play, so I left the channel.');
    void destroySession(s.guildId);
  }, ms);
  s.idleTimer.unref();
}

async function retireNowPlaying(s: Session, note?: string): Promise<void> {
  const m = s.npMessage; s.npMessage = null;
  if (!m) return;
  if (note) await m.edit({ embeds: [embed('Music', note, COLORS.charcoal)], components: [] }).catch(() => undefined);
  else await m.delete().catch(() => undefined);
}

async function announce(s: Session): Promise<void> {
  if (!s.queue.current) return;
  const old = s.npMessage; s.npMessage = null;
  const ch = await discord?.channels.fetch(s.textChannelId).catch(() => null);
  if (ch?.isSendable()) s.npMessage = await ch.send({ embeds: [nowPlayingEmbed(s)], components: controlRows(s), allowedMentions: { parse: [] } }).catch(() => null);
  if (old) await old.delete().catch(() => undefined);
}

async function startTrack(s: Session, track: MusicTrack): Promise<void> {
  clearIdle(s);
  await s.player.playTrack({ track: { encoded: track.encoded } });
  if (s.player.paused) await s.player.setPaused(false);
  await announce(s);
}

async function onTrackEnd(s: Session, failed: boolean): Promise<void> {
  try {
    const next = s.queue.advance(failed);
    if (next) return void (await startTrack(s, next));
    await retireNowPlaying(s, '✅ Queue finished. Add more with `/play`.');
    scheduleIdle(s, IDLE_MS);
  } catch (err) { logger.warn('onTrackEnd failed', err as Error); }
}

/** Adds tracks and starts playback if idle. Returns the 1-based queue position of the first added track (0 = playing now). */
export async function enqueue(s: Session, tracks: MusicTrack[]): Promise<{ added: number; position: number }> {
  const wasIdle = !s.queue.current;
  const before = s.queue.upcoming.length;
  const added = s.queue.add(tracks);
  if (wasIdle && added) { const first = s.queue.advance(); if (first) await startTrack(s, first); }
  return { added, position: wasIdle ? 0 : before + 1 };
}
export async function skip(s: Session): Promise<MusicTrack | null> {
  const skipped = s.queue.current;
  const next = s.queue.skip();
  if (next) await startTrack(s, next);
  else { await s.player.stopTrack(); await retireNowPlaying(s, '✅ Queue finished. Add more with `/play`.'); scheduleIdle(s, IDLE_MS); }
  return skipped;
}
export async function previous(s: Session): Promise<boolean> {
  const prev = s.queue.previous();
  if (!prev) return false;
  await startTrack(s, prev);
  return true;
}
/** Stops playback and clears the queue, but stays in the channel (leaves after a few idle minutes). */
export async function stopPlayback(s: Session): Promise<void> {
  s.queue.clearAll();
  await s.player.stopTrack();
  await retireNowPlaying(s, '⏹ Stopped.');
  scheduleIdle(s, IDLE_MS);
}
export async function setPaused(s: Session, paused: boolean): Promise<void> { await s.player.setPaused(paused); }
export async function setVolume(s: Session, v: number): Promise<void> { await s.player.setGlobalVolume(v); }
export async function seek(s: Session, ms: number): Promise<void> { await s.player.seekTo(ms); }
export function humansInChannel(guild: Guild, channelId: string): number {
  const ch = guild.channels.cache.get(channelId);
  return ch?.isVoiceBased() ? ch.members.filter((m) => !m.user.bot).size : 0;
}

export async function destroySession(guildId: string): Promise<void> {
  const s = sessions.get(guildId);
  if (!s) return;
  s.destroyed = true;
  clearIdle(s);
  sessions.delete(guildId);
  s.queue.clearAll();
  await retireNowPlaying(s, '👋 Disconnected.');
  s.player.removeAllListeners();
  await shoukaku?.leaveVoiceChannel(guildId).catch(() => undefined);
}

/** Keeps sessions in sync with the voice channel: leave when alone, clean up if the bot is disconnected. */
export function handleVoiceUpdate(oldS: VoiceState, newS: VoiceState): void {
  const s = sessions.get(newS.guild.id);
  if (!s || s.destroyed || !discord?.user) return;
  if (newS.id === discord.user.id) {
    if (!newS.channelId) void destroySession(s.guildId);
    else s.voiceChannelId = newS.channelId;
    return;
  }
  if (oldS.channelId !== s.voiceChannelId && newS.channelId !== s.voiceChannelId) return;
  if (humansInChannel(newS.guild, s.voiceChannelId) === 0) scheduleIdle(s, ALONE_MS);
  else if (s.queue.current) clearIdle(s);
}

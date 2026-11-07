import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { COLORS, embed } from '../utils/embeds';
import type { Session } from './manager';
import { MusicTrack } from './queue';
import { fmtTime } from './time';

export function progressBar(pos: number, len: number, size = 14): string {
  if (!len) return '';
  const i = Math.min(size - 1, Math.floor((pos / len) * size));
  return '▬'.repeat(i) + '🔘' + '▬'.repeat(size - i - 1);
}
export const trackLink = (t: MusicTrack) => (t.uri ? `[${t.title.slice(0, 80)}](${t.uri})` : t.title.slice(0, 80));

export function nowPlayingEmbed(s: Session): EmbedBuilder {
  const t = s.queue.current;
  if (!t) return embed('Nothing playing', 'Use `/play` to start the music.', COLORS.charcoal);
  const pos = s.player.position ?? 0;
  const e = embed('🎶 Now playing', `**${trackLink(t)}**\nby ${t.author}`, COLORS.accent).addFields(
    { name: 'Progress', value: t.isStream ? '🔴 LIVE' : `${fmtTime(pos)} ${progressBar(pos, t.length)} ${fmtTime(t.length)}` },
    { name: 'Requested by', value: `<@${t.requesterId}>`, inline: true },
    { name: 'Volume', value: `${s.player.volume}%`, inline: true },
    { name: 'Loop', value: s.queue.loop, inline: true },
    { name: 'Up next', value: s.queue.upcoming.length ? `${s.queue.upcoming.length} track(s)` : 'nothing', inline: true },
  );
  if (t.artwork) e.setThumbnail(t.artwork);
  return e;
}

export function controlRows(s: Session): ActionRowBuilder<ButtonBuilder>[] {
  const b = (id: string, label: string, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(`music:${id}`).setLabel(label).setStyle(style);
  const loopLabel = s.queue.loop === 'track' ? '🔂' : '🔁';
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      b('prev', '⏮'), b('pause', s.player.paused ? '▶ Resume' : '⏸ Pause', ButtonStyle.Primary), b('skip', '⏭'),
      b('loop', loopLabel, s.queue.loop === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success), b('shuffle', '🔀')),
    new ActionRowBuilder<ButtonBuilder>().addComponents(b('vdown', '🔉 −10'), b('vup', '🔊 +10'), b('stop', '⏹ Stop', ButtonStyle.Danger)),
  ];
}

export const QUEUE_PAGE_SIZE = 10;
export function queueEmbed(s: Session, page: number): { embed: EmbedBuilder; pages: number } {
  const total = s.queue.upcoming.length;
  const pages = Math.max(1, Math.ceil(total / QUEUE_PAGE_SIZE));
  const p = Math.min(Math.max(1, page), pages);
  const slice = s.queue.upcoming.slice((p - 1) * QUEUE_PAGE_SIZE, p * QUEUE_PAGE_SIZE);
  const cur = s.queue.current;
  const lines = slice.map((t, n) => `**${(p - 1) * QUEUE_PAGE_SIZE + n + 1}.** ${trackLink(t)} \`${t.isStream ? 'LIVE' : fmtTime(t.length)}\` • <@${t.requesterId}>`);
  const e = embed('📜 Queue', `${cur ? `**Now:** ${trackLink(cur)} • <@${cur.requesterId}>\n\n` : ''}${lines.join('\n') || '*Nothing queued.*'}`, COLORS.accent)
    .setFooter({ text: `VERO9X • page ${p}/${pages} • ${total} queued • ${fmtTime(s.queue.totalLength())} total` });
  return { embed: e, pages };
}

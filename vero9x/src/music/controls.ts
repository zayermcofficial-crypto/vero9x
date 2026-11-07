import { ButtonInteraction, MessageFlags } from 'discord.js';
import { errorEmbed } from '../utils/embeds';
import { djCheck, voiceCheck } from './guards';
import { destroySession, getSession, previous, setPaused, setVolume, skip, stopPlayback } from './manager';
import { controlRows, nowPlayingEmbed } from './ui';

const LOOPS = ['off', 'queue', 'track'] as const;

/** Handles the buttons on the now-playing message (customId = music:<action>). */
export async function handleMusicButton(i: ButtonInteraction): Promise<void> {
  const deny = (m: string) => i.reply({ embeds: [errorEmbed(m)], flags: MessageFlags.Ephemeral });
  const s = i.guildId ? getSession(i.guildId) : undefined;
  if (!s) return void (await deny('Nothing is playing right now.'));
  const member = await i.guild!.members.fetch(i.user.id);
  const problem = voiceCheck(member, s) ?? djCheck(member, s);
  if (problem) return void (await deny(problem));

  const action = i.customId.split(':')[1];
  await i.deferUpdate();
  const refresh = () => i.editReply({ embeds: [nowPlayingEmbed(s)], components: controlRows(s) }).catch(() => undefined);
  switch (action) {
    case 'pause': await setPaused(s, !s.player.paused); return void (await refresh());
    case 'loop': s.queue.loop = LOOPS[(LOOPS.indexOf(s.queue.loop) + 1) % LOOPS.length]; return void (await refresh());
    case 'shuffle': s.queue.shuffle(); return void (await refresh());
    case 'vup': await setVolume(s, Math.min(150, s.player.volume + 10)); return void (await refresh());
    case 'vdown': await setVolume(s, Math.max(5, s.player.volume - 10)); return void (await refresh());
    case 'skip': await skip(s); return;
    case 'prev': if (!(await previous(s))) await i.followUp({ embeds: [errorEmbed('There is no previous track.')], flags: MessageFlags.Ephemeral }); return;
    case 'stop': await stopPlayback(s); return;
    default: void destroySession; return;
  }
}

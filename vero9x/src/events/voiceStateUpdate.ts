import { Events, VoiceState } from 'discord.js';
import { handleVoiceUpdate } from '../music/manager';
import { BotEvent } from '../types';

const event: BotEvent = {
  name: Events.VoiceStateUpdate,
  execute(oldState: VoiceState, newState: VoiceState) { handleVoiceUpdate(oldState, newState); },
};
export default event;

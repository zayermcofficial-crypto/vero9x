import { Events, Guild } from 'discord.js';
import { destroySession } from '../music/manager';
import { BotEvent } from '../types';

const event: BotEvent = {
  name: Events.GuildDelete,
  async execute(guild: Guild) { await destroySession(guild.id); },
};
export default event;

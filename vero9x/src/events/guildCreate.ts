import { Events, Guild } from 'discord.js';
import { getSettings } from '../database/db';
import { BotEvent } from '../types';
import { logger } from '../utils/logger';

const event: BotEvent = {
  name: Events.GuildCreate,
  execute(guild: Guild) {
    getSettings(guild.id);
    logger.info(`Joined guild ${guild.name} (${guild.id})`);
  },
};
export default event;

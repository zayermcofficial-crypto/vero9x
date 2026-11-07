import { ActivityType, Client, Events } from 'discord.js';
import { getSettings } from '../database/db';
import { startScheduler } from '../systems/scheduler';
import { BotEvent } from '../types';
import { logger } from '../utils/logger';

const event: BotEvent = {
  name: Events.ClientReady,
  once: true,
  execute(client: Client<true>) {
    client.guilds.cache.forEach((g) => getSettings(g.id));
    client.user.setPresence({ activities: [{ name: '/help • VERO9X', type: ActivityType.Listening }], status: 'online' });
    startScheduler(client);
    logger.info(`VERO9X online as ${client.user.tag} in ${client.guilds.cache.size} server(s)`);
  },
};
export default event;

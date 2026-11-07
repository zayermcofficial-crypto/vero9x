import { Client } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { BotEvent } from '../types';
import { logger } from '../utils/logger';

export function loadEvents(client: Client): void {
  const dir = path.join(__dirname, '..', 'events');
  const files = fs.readdirSync(dir).filter((f) => /\.(js|ts)$/.test(f) && !f.endsWith('.d.ts'));
  for (const file of files) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const event: BotEvent = require(path.join(dir, file)).default;
    if (!event?.name) { logger.warn(`Skipping event file ${file}`); continue; }
    const run = async (...args: unknown[]) => {
      try { await event.execute(...args); } catch (err) { logger.error(`Error in event ${event.name}`, err as Error); }
    };
    if (event.once) client.once(event.name, run); else client.on(event.name, run);
  }
}

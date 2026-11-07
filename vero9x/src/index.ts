import { Client, GatewayIntentBits, Options, Partials } from 'discord.js';
import { env } from './config/env';
import { db, migrate } from './database/db';
import { loadCommands, registerCommands } from './handlers/commandHandler';
import { loadEvents } from './handlers/eventHandler';
import { logger } from './utils/logger';

async function main() {
  migrate();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers, // privileged: enable in the Developer Portal
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent, // privileged: enable in the Developer Portal
      GatewayIntentBits.GuildModeration,
    ],
    partials: [Partials.GuildMember],
    // Keep memory bounded on small hosts
    makeCache: Options.cacheWithLimits({ ...Options.DefaultMakeCacheSettings, MessageManager: 50, ReactionManager: 0 }),
    sweepers: { ...Options.DefaultSweeperSettings, messages: { interval: 300, lifetime: 900 } },
  });

  client.commands = loadCommands();
  logger.info(`Loaded ${client.commands.size} commands`);
  loadEvents(client);

  client.on('error', (e) => logger.error('Client error', e));
  client.on('shardDisconnect', (_e, id) => logger.warn(`Shard ${id} disconnected`));
  client.on('shardReconnecting', (id) => logger.info(`Shard ${id} reconnecting`));

  if (env.autoRegister) {
    await registerCommands(client.commands).catch((e) => logger.error('Command registration failed (bot will still start)', e as Error));
  }

  const shutdown = (signal: string) => {
    logger.info(`${signal} received — shutting down`);
    client.destroy().catch(() => undefined).finally(() => { try { db.close(); } catch { /* ignore */ } process.exit(0); });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (r) => logger.error('Unhandled rejection', r as Error));
  process.on('uncaughtException', (e) => logger.error('Uncaught exception', e));

  await client.login(env.token);
}

main().catch((e) => { logger.error('Fatal startup error', e as Error); process.exit(1); });

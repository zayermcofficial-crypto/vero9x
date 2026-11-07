import { loadCommands, registerCommands } from './handlers/commandHandler';
import { logger } from './utils/logger';

registerCommands(loadCommands(), true)
  .then(() => process.exit(0))
  .catch((err) => { logger.error('Command registration failed', err as Error); process.exit(1); });

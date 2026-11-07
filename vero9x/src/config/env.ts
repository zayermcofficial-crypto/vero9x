import 'dotenv/config';
import path from 'node:path';

function required(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export const env = {
  token: required('DISCORD_TOKEN'),
  clientId: required('CLIENT_ID'),
  devGuildId: process.env.DEV_GUILD_ID?.trim() || undefined,
  dataDir: path.resolve(process.env.DATA_DIR?.trim() || './data'),
  autoRegister: (process.env.AUTO_REGISTER ?? 'true').toLowerCase() !== 'false',
  ai: {
    provider: (process.env.AI_PROVIDER?.trim() || 'anthropic') as 'anthropic' | 'openai',
    apiKey: process.env.AI_API_KEY?.trim() || '',
    model: process.env.AI_MODEL?.trim() || 'claude-haiku-5-5',
    baseUrl: process.env.AI_BASE_URL?.trim() || '',
  },
};

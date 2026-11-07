import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { migrations } from './migrations';

fs.mkdirSync(env.dataDir, { recursive: true });
const raw = new DatabaseSync(path.join(env.dataDir, 'vero9x.db'));
raw.exec('PRAGMA journal_mode = WAL');
raw.exec('PRAGMA foreign_keys = ON');

export interface RunResult { changes: number | bigint; lastInsertRowid: number | bigint }
interface Stmt {
  run(...params: unknown[]): RunResult;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(...params: unknown[]): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  all(...params: unknown[]): any[];
}

/**
 * Thin wrapper over Node's built-in SQLite (no native compilation needed).
 * Keeps the surface small so moving to PostgreSQL later only touches this file.
 */
export const db = {
  prepare: (sql: string): Stmt => raw.prepare(sql) as unknown as Stmt,
  exec: (sql: string): void => raw.exec(sql),
  close: (): void => raw.close(),
  /** Returns a function that runs `fn` in a transaction (rolled back on error). */
  transaction<T>(fn: () => T): () => T {
    return () => {
      raw.exec('BEGIN IMMEDIATE');
      try {
        const result = fn();
        raw.exec('COMMIT');
        return result;
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    };
  },
};

export function migrate(): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)');
  const applied = new Set((db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version));
  for (const m of migrations) {
    if (applied.has(m.version)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(m.version, Date.now());
    })();
    logger.info(`Applied migration ${m.version}: ${m.name}`);
  }
}

export interface GuildSettings {
  guild_id: string;
  log_channel: string | null; welcome_channel: string | null; goodbye_channel: string | null;
  suggestion_channel: string | null; levelup_channel: string | null;
  welcome_role: string | null; welcome_message: string | null; levelup_message: string | null;
  warn_timeout_at: number; warn_timeout_minutes: number; warn_ban_at: number;
  automod_spam: number; automod_links: number; automod_invites: number; automod_badwords: number;
  automod_mentions: number; mention_limit: number; antiraid: number; log_messages: number;
  ai_enabled: number; ai_persona: string; ai_instructions: string | null; ai_daily_limit: number;
  leveling_enabled: number; xp_min: number; xp_max: number; xp_cooldown: number;
  economy_enabled: number; currency: string; daily_amount: number; weekly_amount: number; work_min: number; work_max: number;
}

export function getSettings(guildId: string): GuildSettings {
  db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);
  return db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId) as GuildSettings;
}

let editable: Set<string> | null = null;
/** Column names are checked against the real table schema, so only existing settings can be written. */
export function updateSetting(guildId: string, key: keyof GuildSettings, value: string | number | null): void {
  if (!editable) {
    editable = new Set((db.prepare('PRAGMA table_info(guild_settings)').all() as { name: string }[]).map((c) => c.name));
    editable.delete('guild_id');
  }
  if (!editable.has(key)) throw new Error(`Setting not editable: ${key}`);
  getSettings(guildId);
  db.prepare(`UPDATE guild_settings SET ${key} = ? WHERE guild_id = ?`).run(value, guildId);
}

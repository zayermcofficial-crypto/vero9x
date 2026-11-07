export interface Migration { version: number; name: string; sql: string }

// Append new migrations at the END. Never edit an applied migration.
export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      CREATE TABLE guild_settings (
        guild_id TEXT PRIMARY KEY,
        log_channel TEXT, welcome_channel TEXT, goodbye_channel TEXT, suggestion_channel TEXT, levelup_channel TEXT,
        welcome_role TEXT, welcome_message TEXT, levelup_message TEXT,
        warn_timeout_at INTEGER NOT NULL DEFAULT 3,
        warn_timeout_minutes INTEGER NOT NULL DEFAULT 60,
        warn_ban_at INTEGER NOT NULL DEFAULT 0,
        automod_spam INTEGER NOT NULL DEFAULT 1,
        automod_links INTEGER NOT NULL DEFAULT 0,
        automod_invites INTEGER NOT NULL DEFAULT 0,
        automod_badwords INTEGER NOT NULL DEFAULT 0,
        automod_mentions INTEGER NOT NULL DEFAULT 1,
        mention_limit INTEGER NOT NULL DEFAULT 5,
        antiraid INTEGER NOT NULL DEFAULT 1,
        log_messages INTEGER NOT NULL DEFAULT 1,
        ai_enabled INTEGER NOT NULL DEFAULT 1,
        ai_persona TEXT NOT NULL DEFAULT 'friendly',
        ai_instructions TEXT,
        ai_daily_limit INTEGER NOT NULL DEFAULT 30,
        leveling_enabled INTEGER NOT NULL DEFAULT 1,
        xp_min INTEGER NOT NULL DEFAULT 15,
        xp_max INTEGER NOT NULL DEFAULT 25,
        xp_cooldown INTEGER NOT NULL DEFAULT 60,
        economy_enabled INTEGER NOT NULL DEFAULT 1,
        currency TEXT NOT NULL DEFAULT '🪙',
        daily_amount INTEGER NOT NULL DEFAULT 200,
        weekly_amount INTEGER NOT NULL DEFAULT 1000,
        work_min INTEGER NOT NULL DEFAULT 50,
        work_max INTEGER NOT NULL DEFAULT 150
      );
      CREATE TABLE ai_channels (guild_id TEXT NOT NULL, channel_id TEXT NOT NULL, PRIMARY KEY (guild_id, channel_id));
      CREATE TABLE ai_usage (guild_id TEXT NOT NULL, user_id TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (guild_id, user_id, day));
      CREATE TABLE badwords (guild_id TEXT NOT NULL, word TEXT NOT NULL, PRIMARY KEY (guild_id, word));
      CREATE TABLE mod_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL, case_no INTEGER NOT NULL, type TEXT NOT NULL,
        target_id TEXT NOT NULL, moderator_id TEXT NOT NULL, reason TEXT NOT NULL,
        duration_seconds INTEGER, created_at INTEGER NOT NULL,
        UNIQUE (guild_id, case_no)
      );
      CREATE INDEX idx_cases_target ON mod_cases (guild_id, target_id);
      CREATE TABLE levels (
        guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
        xp INTEGER NOT NULL DEFAULT 0, messages INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
      );
      CREATE INDEX idx_levels_xp ON levels (guild_id, xp DESC);
      CREATE TABLE level_rewards (guild_id TEXT NOT NULL, level INTEGER NOT NULL, role_id TEXT NOT NULL, PRIMARY KEY (guild_id, level));
      CREATE TABLE economy (
        guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
        wallet INTEGER NOT NULL DEFAULT 0, bank INTEGER NOT NULL DEFAULT 0,
        last_daily INTEGER NOT NULL DEFAULT 0, last_weekly INTEGER NOT NULL DEFAULT 0, last_work INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, user_id),
        CHECK (wallet >= 0 AND bank >= 0)
      );
      CREATE TABLE shop_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, name TEXT NOT NULL,
        price INTEGER NOT NULL, description TEXT, role_id TEXT
      );
      CREATE UNIQUE INDEX idx_shop_name ON shop_items (guild_id, lower(name));
      CREATE TABLE inventory (
        guild_id TEXT NOT NULL, user_id TEXT NOT NULL, item_id INTEGER NOT NULL, qty INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (guild_id, user_id, item_id)
      );
      CREATE TABLE afk (guild_id TEXT NOT NULL, user_id TEXT NOT NULL, reason TEXT NOT NULL, since INTEGER NOT NULL, PRIMARY KEY (guild_id, user_id));
      CREATE TABLE reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, guild_id TEXT, channel_id TEXT,
        message TEXT NOT NULL, due_at INTEGER NOT NULL
      );
      CREATE INDEX idx_reminders_due ON reminders (due_at);
    `,
  },
];

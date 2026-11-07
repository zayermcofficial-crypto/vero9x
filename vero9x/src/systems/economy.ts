import { db } from '../database/db';

export interface Account { wallet: number; bank: number; last_daily: number; last_weekly: number; last_work: number }

export function getAccount(guildId: string, userId: string): Account {
  db.prepare('INSERT OR IGNORE INTO economy (guild_id, user_id) VALUES (?, ?)').run(guildId, userId);
  return db.prepare('SELECT wallet, bank, last_daily, last_weekly, last_work FROM economy WHERE guild_id = ? AND user_id = ?').get(guildId, userId) as Account;
}

export function credit(guildId: string, userId: string, amount: number): void {
  getAccount(guildId, userId);
  db.prepare('UPDATE economy SET wallet = wallet + ? WHERE guild_id = ? AND user_id = ?').run(amount, guildId, userId);
}

/** Atomic: only succeeds when the wallet really holds `amount`. */
export function debitWallet(guildId: string, userId: string, amount: number): boolean {
  getAccount(guildId, userId);
  const r = db.prepare('UPDATE economy SET wallet = wallet - ? WHERE guild_id = ? AND user_id = ? AND wallet >= ?').run(amount, guildId, userId, amount);
  return Number(r.changes) === 1;
}

export function transfer(guildId: string, from: string, to: string, amount: number): boolean {
  return db.transaction(() => {
    if (!debitWallet(guildId, from, amount)) return false;
    credit(guildId, to, amount);
    return true;
  })();
}

/** Claims a timed reward. Returns 0 on success, otherwise the epoch-ms when it becomes available. */
export function claim(guildId: string, userId: string, column: 'last_daily' | 'last_weekly' | 'last_work', cooldownMs: number, amount: number): number {
  return db.transaction(() => {
    const acc = getAccount(guildId, userId);
    const next = acc[column] + cooldownMs;
    if (next > Date.now()) return next;
    db.prepare(`UPDATE economy SET wallet = wallet + ?, ${column} = ? WHERE guild_id = ? AND user_id = ?`).run(amount, Date.now(), guildId, userId);
    return 0;
  })();
}

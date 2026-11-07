import { Client } from 'discord.js';
import { db } from '../database/db';
import { embed } from '../utils/embeds';
import { logger } from '../utils/logger';

interface Reminder { id: number; user_id: string; guild_id: string | null; channel_id: string | null; message: string }
let running = false;

async function deliver(client: Client, r: Reminder): Promise<void> {
  const e = embed('⏰ Reminder', r.message);
  if (r.channel_id) {
    const ch = await client.channels.fetch(r.channel_id).catch(() => null);
    if (ch?.isSendable()) {
      const sent = await ch.send({ content: `<@${r.user_id}>`, embeds: [e], allowedMentions: { users: [r.user_id] } }).then(() => true).catch(() => false);
      if (sent) return;
    }
  }
  const user = await client.users.fetch(r.user_id).catch(() => null);
  await user?.send({ embeds: [e] }).catch(() => undefined);
}

/** Polls the reminders table. Rows are deleted before delivery, so a crash can never double-send. */
export function startScheduler(client: Client): void {
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const due = db.prepare('SELECT id, user_id, guild_id, channel_id, message FROM reminders WHERE due_at <= ? ORDER BY due_at LIMIT 25').all(Date.now()) as Reminder[];
      for (const r of due) {
        db.prepare('DELETE FROM reminders WHERE id = ?').run(r.id);
        await deliver(client, r).catch((e) => logger.warn('Reminder delivery failed', e as Error));
      }
      if (Math.random() < 0.01) db.prepare('DELETE FROM ai_usage WHERE day < ?').run(new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10));
    } catch (err) {
      logger.error('Scheduler tick failed', err as Error);
    } finally {
      running = false;
    }
  }, 15_000).unref();
}

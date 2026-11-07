import { Events, Interaction, PermissionsBitField } from 'discord.js';
import { getSettings } from '../database/db';
import { BotEvent } from '../types';
import { alreadySeen } from '../utils/dedupe';
import { friendlyError, replyError } from '../utils/embeds';
import { logger } from '../utils/logger';

const cooldowns = new Map<string, number>();
setInterval(() => {
  const now = Date.now();
  for (const [k, until] of cooldowns) if (until < now) cooldowns.delete(k);
}, 60_000).unref();

const event: BotEvent = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;
    if (alreadySeen(interaction.id)) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;
    if (!interaction.inGuild() || !interaction.guild) {
      await replyError(interaction, 'VERO9X commands only work inside a server.');
      return;
    }

    try {
      getSettings(interaction.guild.id);
      if (command.perms?.length && !interaction.memberPermissions?.has(command.perms)) {
        const names = new PermissionsBitField(command.perms).toArray().join(', ');
        await replyError(interaction, `You need the **${names}** permission to use \`/${command.data.name}\`.`);
        return;
      }
      if (command.cooldown) {
        const key = `${command.data.name}:${interaction.user.id}`;
        const until = cooldowns.get(key) ?? 0;
        if (until > Date.now()) {
          await replyError(interaction, `Slow down — try again <t:${Math.ceil(until / 1000)}:R>.`);
          return;
        }
        cooldowns.set(key, Date.now() + command.cooldown * 1000);
      }
      await command.execute(interaction);
    } catch (err) {
      logger.error(`Command /${interaction.commandName} failed`, err as Error);
      await replyError(interaction, friendlyError(err)).catch(() => undefined);
    }
  },
};
export default event;

import { Events, Message, PartialMessage } from 'discord.js';
import { getSettings } from '../database/db';
import { sendLog } from '../systems/moderation';
import { BotEvent } from '../types';
import { COLORS, embed } from '../utils/embeds';

const event: BotEvent = {
  name: Events.MessageDelete,
  async execute(message: Message | PartialMessage) {
    if (!message.guild || message.author?.bot || !message.content) return;
    const s = getSettings(message.guild.id);
    if (!s.log_messages || message.channelId === s.log_channel) return;
    await sendLog(message.guild, embed('Message deleted', `**Author:** ${message.author ?? 'unknown'}\n**Channel:** <#${message.channelId}>\n\n${message.content.slice(0, 1500)}`, COLORS.danger), s);
  },
};
export default event;

import { Events, Message, PartialMessage } from 'discord.js';
import { getSettings } from '../database/db';
import { sendLog } from '../systems/moderation';
import { BotEvent } from '../types';
import { COLORS, embed } from '../utils/embeds';

const event: BotEvent = {
  name: Events.MessageUpdate,
  async execute(oldMsg: Message | PartialMessage, newMsg: Message | PartialMessage) {
    if (!newMsg.guild || newMsg.author?.bot || !oldMsg.content || !newMsg.content || oldMsg.content === newMsg.content) return;
    const s = getSettings(newMsg.guild.id);
    if (!s.log_messages || newMsg.channelId === s.log_channel) return;
    await sendLog(newMsg.guild, embed('Message edited', `**Author:** ${newMsg.author}\n**Channel:** <#${newMsg.channelId}> • [jump](${newMsg.url})`, COLORS.accent)
      .addFields({ name: 'Before', value: oldMsg.content.slice(0, 1000) }, { name: 'After', value: newMsg.content.slice(0, 1000) }), s);
  },
};
export default event;

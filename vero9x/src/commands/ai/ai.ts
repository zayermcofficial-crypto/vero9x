import { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { PERSONAS } from '../../ai/prompt';
import { deflection, looksLikeInjection, runAiTask } from '../../ai/chat';
import { db, getSettings, updateSetting } from '../../database/db';
import { env } from '../../config/env';
import { Command } from '../../types';
import { embed, errorEmbed, successEmbed } from '../../utils/embeds';

type I = Parameters<Command['execute']>[0];
async function task(i: I, instruction: string, content: string, title: string, maxChars?: number) {
  await i.deferReply();
  try {
    const out = await runAiTask(i.guildId!, i.guild!.name, i.user.id, instruction, content, maxChars);
    await i.editReply({ embeds: [embed(title, out)], allowedMentions: { parse: [] } });
  } catch (e) {
    await i.editReply({ embeds: [errorEmbed((e as Error).message.startsWith('AI provider') ? 'The AI service is having trouble. Try again shortly.' : (e as Error).message)] });
  }
}

const ask: Command = {
  cooldown: 5,
  data: new SlashCommandBuilder().setName('ask').setDescription('Ask the AI assistant anything')
    .addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true).setMaxLength(800)),
  async execute(i) {
    const q = i.options.getString('question', true);
    if (looksLikeInjection(q)) return void (await i.reply({ embeds: [embed('VERO9X', deflection())] }));
    await task(i, 'Answer the user\'s question helpfully and briefly.', q, '🤖 VERO9X');
  },
};
const summarize: Command = {
  cooldown: 20,
  data: new SlashCommandBuilder().setName('summarize').setDescription('Summarize recent messages in this channel')
    .addIntegerOption((o) => o.setName('messages').setDescription('How many recent messages (5-100, default 30)').setMinValue(5).setMaxValue(100)),
  async execute(i) {
    if (!i.channel || !('messages' in i.channel)) return void (await i.reply({ embeds: [errorEmbed('Use this in a text channel.')], flags: MessageFlags.Ephemeral }));
    await i.deferReply();
    const msgs = await i.channel.messages.fetch({ limit: i.options.getInteger('messages') ?? 30 }).catch(() => null);
    if (!msgs) return void (await i.editReply({ embeds: [errorEmbed("I can't read the history of this channel.")] }));
    const text = [...msgs.values()].reverse().filter((m) => !m.author.bot && m.content).map((m) => `${m.member?.displayName ?? m.author.username}: ${m.content}`).join('\n');
    if (!text) return void (await i.editReply({ embeds: [errorEmbed('There is nothing to summarize yet.')] }));
    try {
      const out = await runAiTask(i.guildId!, i.guild!.name, i.user.id, 'Summarize this chat log in 3-6 short bullet points. Mention who said what only when it matters.', text, 6000);
      await i.editReply({ embeds: [embed('📝 Summary', out)], allowedMentions: { parse: [] } });
    } catch (e) { await i.editReply({ embeds: [errorEmbed((e as Error).message)] }); }
  },
};
const translate: Command = {
  cooldown: 5,
  data: new SlashCommandBuilder().setName('translate').setDescription('Translate text into another language')
    .addStringOption((o) => o.setName('text').setDescription('Text to translate').setRequired(true).setMaxLength(800))
    .addStringOption((o) => o.setName('language').setDescription('Target language, e.g. Spanish, Bengali, Japanese').setRequired(true).setMaxLength(30)),
  async execute(i) {
    const lang = i.options.getString('language', true).replace(/[^\p{L} \-()]/gu, '').trim();
    if (!lang) return void (await i.reply({ embeds: [errorEmbed('Give a language name like `Spanish`.')], flags: MessageFlags.Ephemeral }));
    await task(i, `Translate the user content into ${lang}. Output ONLY the translation, nothing else.`, i.options.getString('text', true), `🌐 ${lang}`);
  },
};
const ai: Command = {
  perms: [PermissionFlagsBits.ManageGuild],
  data: new SlashCommandBuilder().setName('ai').setDescription('Configure the AI assistant for this server')
    .addSubcommand((s) => s.setName('status').setDescription('Show AI settings'))
    .addSubcommand((s) => s.setName('toggle').setDescription('Turn the AI on or off').addBooleanOption((o) => o.setName('enabled').setDescription('On or off').setRequired(true)))
    .addSubcommand((s) => s.setName('persona').setDescription('Choose the AI personality').addStringOption((o) => o.setName('style').setDescription('Style').setRequired(true).addChoices(...Object.keys(PERSONAS).map((k) => ({ name: k, value: k })))))
    .addSubcommand((s) => s.setName('instructions').setDescription('Server-specific instructions (empty clears)').addStringOption((o) => o.setName('text').setDescription('e.g. "We are a gaming community. Be concise."').setMaxLength(600)))
    .addSubcommand((s) => s.setName('limit').setDescription('Daily AI requests per member (0 = unlimited)').addIntegerOption((o) => o.setName('per_day').setDescription('Requests per day').setRequired(true).setMinValue(0).setMaxValue(500)))
    .addSubcommand((s) => s.setName('channel').setDescription('Let the AI chat freely in a channel')
      .addStringOption((o) => o.setName('action').setDescription('Add or remove').setRequired(true).addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }))
      .addChannelOption((o) => o.setName('channel').setDescription('Channel').setRequired(true).addChannelTypes(ChannelType.GuildText))),
  async execute(i) {
    const g = i.guildId!; const sub = i.options.getSubcommand();
    const ok = (m: string) => i.reply({ embeds: [successEmbed(m, 'AI settings')], flags: MessageFlags.Ephemeral });
    if (sub === 'status') {
      const s = getSettings(g);
      const chans = (db.prepare('SELECT channel_id FROM ai_channels WHERE guild_id = ?').all(g) as { channel_id: string }[]).map((c) => `<#${c.channel_id}>`).join(' ') || '`none (mention only)`';
      return void (await i.reply({ embeds: [embed('🤖 AI settings').addFields(
        { name: 'Provider', value: env.ai.apiKey ? `${env.ai.provider} ✅` : '`not configured by the bot owner`', inline: true },
        { name: 'Enabled', value: s.ai_enabled ? 'yes' : 'no', inline: true }, { name: 'Persona', value: s.ai_persona, inline: true },
        { name: 'Daily limit / member', value: s.ai_daily_limit ? String(s.ai_daily_limit) : 'unlimited', inline: true },
        { name: 'Chat channels', value: chans }, { name: 'Instructions', value: s.ai_instructions ?? '`none`' })], flags: MessageFlags.Ephemeral }));
    }
    if (sub === 'toggle') { const on = i.options.getBoolean('enabled', true); updateSetting(g, 'ai_enabled', on ? 1 : 0); return void (await ok(`AI is now **${on ? 'enabled' : 'disabled'}**.`)); }
    if (sub === 'persona') { updateSetting(g, 'ai_persona', i.options.getString('style', true)); return void (await ok('Persona updated.')); }
    if (sub === 'instructions') { updateSetting(g, 'ai_instructions', i.options.getString('text')); return void (await ok(i.options.getString('text') ? 'Instructions saved.' : 'Instructions cleared.')); }
    if (sub === 'limit') { updateSetting(g, 'ai_daily_limit', i.options.getInteger('per_day', true)); return void (await ok('Daily limit updated.')); }
    const ch = i.options.getChannel('channel', true);
    if (i.options.getString('action', true) === 'add') db.prepare('INSERT OR IGNORE INTO ai_channels (guild_id, channel_id) VALUES (?, ?)').run(g, ch.id);
    else db.prepare('DELETE FROM ai_channels WHERE guild_id = ? AND channel_id = ?').run(g, ch.id);
    await ok(`AI channel list updated for ${ch}.`);
  },
};
export default [ai, ask, summarize, translate];

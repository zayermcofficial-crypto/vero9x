import { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { invalidateBadwords } from '../../systems/automod';
import { db, getSettings, GuildSettings, updateSetting } from '../../database/db';
import { Command } from '../../types';
import { embed, errorEmbed, successEmbed } from '../../utils/embeds';

const TEXT = [ChannelType.GuildText, ChannelType.GuildAnnouncement] as const;
const TOGGLES = [
  ['Anti-spam & flood', 'automod_spam'], ['Link filter', 'automod_links'], ['Invite filter', 'automod_invites'], ['Bad-word filter', 'automod_badwords'],
  ['Anti-mention spam', 'automod_mentions'], ['Anti-raid', 'antiraid'], ['Message/role logging', 'log_messages'],
  ['Leveling', 'leveling_enabled'], ['Economy', 'economy_enabled'],
] as const;

const command: Command = {
  perms: [PermissionFlagsBits.ManageGuild],
  data: new SlashCommandBuilder().setName('config').setDescription('Configure VERO9X for this server')
    .addSubcommand((s) => s.setName('view').setDescription('Show current configuration'))
    .addSubcommand((s) => s.setName('channel').setDescription('Set a channel')
      .addStringOption((o) => o.setName('type').setDescription('Which channel').setRequired(true).addChoices(
        { name: 'Logs', value: 'log_channel' }, { name: 'Welcome', value: 'welcome_channel' }, { name: 'Goodbye', value: 'goodbye_channel' },
        { name: 'Suggestions', value: 'suggestion_channel' }, { name: 'Level-up messages', value: 'levelup_channel' }))
      .addChannelOption((o) => o.setName('channel').setDescription('Channel (leave empty to clear)').addChannelTypes(...TEXT)))
    .addSubcommand((s) => s.setName('welcome').setDescription('Auto-role and welcome text')
      .addRoleOption((o) => o.setName('role').setDescription('Role given to new members'))
      .addStringOption((o) => o.setName('message').setDescription('Placeholders: {user} {server} {count}').setMaxLength(500)))
    .addSubcommand((s) => s.setName('toggle').setDescription('Turn a module on or off')
      .addStringOption((o) => o.setName('module').setDescription('Module').setRequired(true).addChoices(...TOGGLES.map(([name, value]) => ({ name, value }))))
      .addBooleanOption((o) => o.setName('enabled').setDescription('On or off').setRequired(true)))
    .addSubcommand((s) => s.setName('badword').setDescription('Manage the bad-word list')
      .addStringOption((o) => o.setName('action').setDescription('Action').setRequired(true).addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }, { name: 'List', value: 'list' }))
      .addStringOption((o) => o.setName('word').setDescription('Word or phrase').setMaxLength(40)))
    .addSubcommand((s) => s.setName('thresholds').setDescription('Warning punishments and mention limit')
      .addIntegerOption((o) => o.setName('timeout_at').setDescription('Auto-timeout at N warnings (0 = off)').setMinValue(0).setMaxValue(50))
      .addIntegerOption((o) => o.setName('timeout_minutes').setDescription('Auto-timeout minutes').setMinValue(1).setMaxValue(40320))
      .addIntegerOption((o) => o.setName('ban_at').setDescription('Auto-ban at N warnings (0 = off)').setMinValue(0).setMaxValue(50))
      .addIntegerOption((o) => o.setName('mention_limit').setDescription('Mentions per message before automod acts').setMinValue(2).setMaxValue(50)))
    .addSubcommand((s) => s.setName('levels').setDescription('Leveling settings')
      .addIntegerOption((o) => o.setName('xp_min').setDescription('Min XP per message').setMinValue(1).setMaxValue(500))
      .addIntegerOption((o) => o.setName('xp_max').setDescription('Max XP per message').setMinValue(1).setMaxValue(500))
      .addIntegerOption((o) => o.setName('cooldown').setDescription('Seconds between XP gains').setMinValue(5).setMaxValue(3600))
      .addStringOption((o) => o.setName('message').setDescription('Level-up text: {user} {level}').setMaxLength(300)))
    .addSubcommand((s) => s.setName('levelreward').setDescription('Role rewards for levels')
      .addStringOption((o) => o.setName('action').setDescription('Action').setRequired(true).addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }))
      .addIntegerOption((o) => o.setName('level').setDescription('Level').setRequired(true).setMinValue(1).setMaxValue(500))
      .addRoleOption((o) => o.setName('role').setDescription('Role (required for add)')))
    .addSubcommand((s) => s.setName('economy').setDescription('Economy settings')
      .addStringOption((o) => o.setName('currency').setDescription('Currency symbol/emoji').setMaxLength(8))
      .addIntegerOption((o) => o.setName('daily').setDescription('Daily reward').setMinValue(1).setMaxValue(1_000_000))
      .addIntegerOption((o) => o.setName('weekly').setDescription('Weekly reward').setMinValue(1).setMaxValue(10_000_000))
      .addIntegerOption((o) => o.setName('work_min').setDescription('Min work pay').setMinValue(1).setMaxValue(1_000_000))
      .addIntegerOption((o) => o.setName('work_max').setDescription('Max work pay').setMinValue(1).setMaxValue(1_000_000))),
  async execute(i) {
    const gid = i.guildId!; const sub = i.options.getSubcommand();
    const ok = (m: string) => i.reply({ embeds: [successEmbed(m, 'Saved')], flags: MessageFlags.Ephemeral });
    const bad = (m: string) => i.reply({ embeds: [errorEmbed(m)], flags: MessageFlags.Ephemeral });
    const applyInts = (map: [string, keyof GuildSettings][]) => {
      let n = 0;
      for (const [opt, key] of map) { const v = i.options.getInteger(opt); if (v !== null) { updateSetting(gid, key, v); n++; } }
      return n;
    };

    if (sub === 'view') {
      const s = getSettings(gid);
      const ch = (id: string | null) => (id ? `<#${id}>` : '`not set`');
      const on = (v: number) => (v ? '✅' : '❌');
      const rewards = (db.prepare('SELECT level, role_id FROM level_rewards WHERE guild_id = ? ORDER BY level').all(gid) as { level: number; role_id: string }[]).map((r) => `L${r.level} → <@&${r.role_id}>`).join(' • ') || '`none`';
      return void (await i.reply({ embeds: [embed('VERO9X • Configuration').addFields(
        { name: 'Channels', value: `Logs: ${ch(s.log_channel)}\nWelcome: ${ch(s.welcome_channel)}\nGoodbye: ${ch(s.goodbye_channel)}\nSuggestions: ${ch(s.suggestion_channel)}\nLevel-ups: ${ch(s.levelup_channel)}` },
        { name: 'Modules', value: TOGGLES.map(([n, k]) => `${on(s[k])} ${n}`).join('\n'), inline: true },
        { name: 'Moderation', value: `Mention limit: ${s.mention_limit}\nTimeout at ${s.warn_timeout_at || 'off'} warns (${s.warn_timeout_minutes}m)\nBan at ${s.warn_ban_at || 'off'} warns`, inline: true },
        { name: 'Leveling', value: `${s.xp_min}-${s.xp_max} XP / ${s.xp_cooldown}s • rewards: ${rewards}` },
        { name: 'Economy', value: `${s.currency} daily ${s.daily_amount} • weekly ${s.weekly_amount} • work ${s.work_min}-${s.work_max}` })], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }));
    }
    if (sub === 'channel') {
      const key = i.options.getString('type', true) as keyof GuildSettings; const ch = i.options.getChannel('channel');
      updateSetting(gid, key, ch?.id ?? null);
      return void (await ok(ch ? `Set to ${ch}.` : 'Cleared.'));
    }
    if (sub === 'welcome') {
      const role = i.options.getRole('role'); const msg = i.options.getString('message');
      if (!role && !msg) return void (await bad('Provide a role and/or a message.'));
      if (role && (role.id === gid || role.managed)) return void (await bad('That role cannot be used as an auto-role.'));
      if (role) updateSetting(gid, 'welcome_role', role.id);
      if (msg) updateSetting(gid, 'welcome_message', msg);
      return void (await ok('Welcome settings updated.'));
    }
    if (sub === 'toggle') {
      const key = i.options.getString('module', true) as keyof GuildSettings; const on = i.options.getBoolean('enabled', true);
      updateSetting(gid, key, on ? 1 : 0);
      return void (await ok(`Module is now **${on ? 'enabled' : 'disabled'}**.`));
    }
    if (sub === 'badword') {
      const action = i.options.getString('action', true); const word = i.options.getString('word')?.toLowerCase().trim().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
      if (action === 'list') {
        const words = (db.prepare('SELECT word FROM badwords WHERE guild_id = ? ORDER BY word').all(gid) as { word: string }[]).map((w) => `\`${w.word}\``).join(', ');
        return void (await i.reply({ embeds: [embed('Blocked words', words || 'None.')], flags: MessageFlags.Ephemeral }));
      }
      if (!word) return void (await bad('Provide a `word`.'));
      if (action === 'add') {
        if ((db.prepare('SELECT COUNT(*) c FROM badwords WHERE guild_id = ?').get(gid) as { c: number }).c >= 200) return void (await bad('You can block up to 200 words.'));
        db.prepare('INSERT OR IGNORE INTO badwords (guild_id, word) VALUES (?, ?)').run(gid, word);
      } else db.prepare('DELETE FROM badwords WHERE guild_id = ? AND word = ?').run(gid, word);
      invalidateBadwords(gid);
      return void (await ok(`Word list updated (${action}). Enable it with \`/config toggle\` → Bad-word filter.`));
    }
    if (sub === 'thresholds') {
      return void (applyInts([['timeout_at', 'warn_timeout_at'], ['timeout_minutes', 'warn_timeout_minutes'], ['ban_at', 'warn_ban_at'], ['mention_limit', 'mention_limit']]) ? await ok('Thresholds updated.') : await bad('Provide at least one value.'));
    }
    if (sub === 'levels') {
      const msg = i.options.getString('message');
      if (msg) updateSetting(gid, 'levelup_message', msg);
      const n = applyInts([['xp_min', 'xp_min'], ['xp_max', 'xp_max'], ['cooldown', 'xp_cooldown']]) + (msg ? 1 : 0);
      return void (n ? await ok('Leveling settings updated.') : await bad('Provide at least one value.'));
    }
    if (sub === 'levelreward') {
      const level = i.options.getInteger('level', true); const role = i.options.getRole('role');
      if (i.options.getString('action', true) === 'add') {
        if (!role || role.id === gid || role.managed) return void (await bad('Pick a normal role to reward.'));
        db.prepare('INSERT INTO level_rewards (guild_id, level, role_id) VALUES (?, ?, ?) ON CONFLICT (guild_id, level) DO UPDATE SET role_id = excluded.role_id').run(gid, level, role.id);
        return void (await ok(`Level **${level}** now rewards ${role}.`));
      }
      db.prepare('DELETE FROM level_rewards WHERE guild_id = ? AND level = ?').run(gid, level);
      return void (await ok(`Removed the reward for level **${level}**.`));
    }
    if (sub === 'economy') {
      const cur = i.options.getString('currency');
      if (cur) updateSetting(gid, 'currency', cur);
      const n = applyInts([['daily', 'daily_amount'], ['weekly', 'weekly_amount'], ['work_min', 'work_min'], ['work_max', 'work_max']]) + (cur ? 1 : 0);
      return void (n ? await ok('Economy settings updated.') : await bad('Provide at least one value.'));
    }
  },
};
export default command;

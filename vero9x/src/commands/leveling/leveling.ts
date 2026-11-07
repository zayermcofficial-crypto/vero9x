import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { db, getSettings } from '../../database/db';
import { addXp, getRank, progressBar, setXp } from '../../systems/leveling';
import { Command } from '../../types';
import { embed, errorEmbed, successEmbed } from '../../utils/embeds';

async function showRank(i: Parameters<Command['execute']>[0], compact: boolean) {
  const user = i.options.getUser('user') ?? i.user;
  if (user.bot) return void (await i.reply({ embeds: [errorEmbed('Bots do not earn XP.')], flags: MessageFlags.Ephemeral }));
  if (!getSettings(i.guildId!).leveling_enabled) return void (await i.reply({ embeds: [errorEmbed('Leveling is disabled in this server.')], flags: MessageFlags.Ephemeral }));
  const r = getRank(i.guildId!, user.id);
  const bar = `${progressBar(r.current, r.needed)}  ${r.current}/${r.needed} XP`;
  const e = compact
    ? embed(`${user.username} • Level ${r.level}`, bar)
    : embed(`${user.username}'s rank`, bar).setThumbnail(user.displayAvatarURL({ size: 256 })).addFields(
      { name: 'Rank', value: `#${r.position}`, inline: true }, { name: 'Level', value: String(r.level), inline: true },
      { name: 'Total XP', value: r.xp.toLocaleString(), inline: true }, { name: 'Messages', value: r.messages.toLocaleString(), inline: true });
  await i.reply({ embeds: [e] });
}
const userOpt = (o: import('discord.js').SlashCommandUserOption) => o.setName('user').setDescription('Defaults to you');

const rank: Command = { data: new SlashCommandBuilder().setName('rank').setDescription('Show your rank card').addUserOption(userOpt), execute: (i) => showRank(i, false) };
const level: Command = { data: new SlashCommandBuilder().setName('level').setDescription('Quick level and progress').addUserOption(userOpt), execute: (i) => showRank(i, true) };

const xp: Command = {
  perms: [PermissionFlagsBits.ManageGuild],
  data: new SlashCommandBuilder().setName('xp').setDescription('Add or remove XP (admin)')
    .addStringOption((o) => o.setName('action').setDescription('Add or remove').setRequired(true).addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }))
    .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
    .addIntegerOption((o) => o.setName('amount').setDescription('XP amount').setRequired(true).setMinValue(1).setMaxValue(10_000_000)),
  async execute(i) {
    const user = i.options.getUser('user', true);
    if (user.bot) return void (await i.reply({ embeds: [errorEmbed('Bots do not earn XP.')], flags: MessageFlags.Ephemeral }));
    const amt = i.options.getInteger('amount', true) * (i.options.getString('action', true) === 'add' ? 1 : -1);
    const r = addXp(i.guildId!, user.id, amt);
    await i.reply({ embeds: [successEmbed(`${user} now has **${r.after.toLocaleString()} XP** (level ${r.newLevel}).`, 'XP updated')], allowedMentions: { parse: [] } });
  },
};
const setxp: Command = {
  perms: [PermissionFlagsBits.ManageGuild],
  data: new SlashCommandBuilder().setName('setxp').setDescription('Set a member\'s total XP (admin)')
    .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
    .addIntegerOption((o) => o.setName('xp').setDescription('Total XP').setRequired(true).setMinValue(0).setMaxValue(100_000_000)),
  async execute(i) {
    const user = i.options.getUser('user', true);
    if (user.bot) return void (await i.reply({ embeds: [errorEmbed('Bots do not earn XP.')], flags: MessageFlags.Ephemeral }));
    setXp(i.guildId!, user.id, i.options.getInteger('xp', true));
    await i.reply({ embeds: [successEmbed(`${user}'s XP is now **${i.options.getInteger('xp', true).toLocaleString()}**.`, 'XP set')], allowedMentions: { parse: [] } });
  },
};
const leaderboard: Command = {
  cooldown: 5,
  data: new SlashCommandBuilder().setName('leaderboard').setDescription('Server leaderboard')
    .addStringOption((o) => o.setName('type').setDescription('Which board').addChoices({ name: 'XP / levels', value: 'xp' }, { name: 'Coins', value: 'coins' })),
  async execute(i) {
    const type = i.options.getString('type') ?? 'xp';
    const s = getSettings(i.guildId!);
    const rows = (type === 'xp'
      ? db.prepare('SELECT user_id, xp AS score FROM levels WHERE guild_id = ? AND xp > 0 ORDER BY xp DESC LIMIT 10').all(i.guildId)
      : db.prepare('SELECT user_id, wallet + bank AS score FROM economy WHERE guild_id = ? AND wallet + bank > 0 ORDER BY wallet + bank DESC LIMIT 10').all(i.guildId)) as { user_id: string; score: number }[];
    const medals = ['🥇', '🥈', '🥉'];
    const body = rows.length
      ? rows.map((r, n) => `${medals[n] ?? `**${n + 1}.**`} <@${r.user_id}> — ${type === 'xp' ? `${r.score.toLocaleString()} XP` : `${s.currency} ${r.score.toLocaleString()}`}`).join('\n')
      : 'Nobody on the board yet.';
    await i.reply({ embeds: [embed(type === 'xp' ? '🏆 XP Leaderboard' : '💰 Richest Members', body)], allowedMentions: { parse: [] } });
  },
};
export default [rank, level, xp, setxp, leaderboard];

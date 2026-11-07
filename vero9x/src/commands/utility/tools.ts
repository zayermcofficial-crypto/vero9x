import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { db, getSettings } from '../../database/db';
import { getRank } from '../../systems/leveling';
import { getAccount } from '../../systems/economy';
import { parseDuration, formatDuration } from '../../systems/moderation';
import { Command } from '../../types';
import { calculate } from '../../utils/calc';
import { embed, errorEmbed, successEmbed } from '../../utils/embeds';

const EPH = MessageFlags.Ephemeral;
const NUM = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

const remind: Command = {
  cooldown: 3,
  data: new SlashCommandBuilder().setName('remind').setDescription('Set a reminder')
    .addStringOption((o) => o.setName('in').setDescription('When, e.g. 10m, 2h, 1d (max 365d)').setRequired(true).setMaxLength(8))
    .addStringOption((o) => o.setName('message').setDescription('What to remind you about').setRequired(true).setMaxLength(300)),
  async execute(i) {
    const sec = parseDuration(i.options.getString('in', true));
    if (!sec || sec < 10 || sec > 365 * 86400) return void (await i.reply({ embeds: [errorEmbed('Use a duration like `10m`, `2h`, `1d` (10s – 365d).')], flags: EPH }));
    const count = (db.prepare('SELECT COUNT(*) c FROM reminders WHERE user_id = ?').get(i.user.id) as { c: number }).c;
    if (count >= 25) return void (await i.reply({ embeds: [errorEmbed('You already have 25 active reminders.')], flags: EPH }));
    const due = Date.now() + sec * 1000;
    db.prepare('INSERT INTO reminders (user_id, guild_id, channel_id, message, due_at) VALUES (?, ?, ?, ?, ?)').run(i.user.id, i.guildId, i.channelId, i.options.getString('message', true), due);
    await i.reply({ embeds: [successEmbed(`I'll remind you <t:${Math.floor(due / 1000)}:R> (in ${formatDuration(sec)}).`, 'Reminder set')], flags: EPH });
  },
};
const poll: Command = {
  cooldown: 5,
  data: new SlashCommandBuilder().setName('poll').setDescription('Create a reaction poll')
    .addStringOption((o) => o.setName('question').setDescription('The question').setRequired(true).setMaxLength(200))
    .addStringOption((o) => o.setName('options').setDescription('2-9 choices separated by |  (empty = yes/no)').setMaxLength(600)),
  async execute(i) {
    const q = i.options.getString('question', true);
    const opts = (i.options.getString('options') ?? '').split('|').map((s) => s.trim()).filter(Boolean);
    if (opts.length === 1 || opts.length > 9) return void (await i.reply({ embeds: [errorEmbed('Give between 2 and 9 options, separated by `|`.')], flags: EPH }));
    const yesNo = opts.length === 0;
    const body = yesNo ? 'React with 👍 or 👎' : opts.map((o, n) => `${NUM[n]}  ${o}`).join('\n');
    const msg = await i.reply({ embeds: [embed(`📊 ${q}`, body).setFooter({ text: `Poll by ${i.user.username} • VERO9X` })], withResponse: true });
    const m = msg.resource!.message!;
    for (const r of yesNo ? ['👍', '👎'] : NUM.slice(0, opts.length)) await m.react(r).catch(() => undefined);
  },
};
const suggest: Command = {
  cooldown: 30,
  data: new SlashCommandBuilder().setName('suggest').setDescription('Send a suggestion to the server team')
    .addStringOption((o) => o.setName('suggestion').setDescription('Your idea').setRequired(true).setMaxLength(1000)),
  async execute(i) {
    const s = getSettings(i.guildId!);
    const ch = s.suggestion_channel ? await i.guild!.channels.fetch(s.suggestion_channel).catch(() => null) : null;
    if (!ch?.isSendable()) return void (await i.reply({ embeds: [errorEmbed('This server has no suggestion channel yet. An admin can set one with `/config channel`.')], flags: EPH }));
    const m = await ch.send({ embeds: [embed('💡 New suggestion', i.options.getString('suggestion', true)).setAuthor({ name: i.user.username, iconURL: i.user.displayAvatarURL() })], allowedMentions: { parse: [] } });
    await m.react('👍').catch(() => undefined); await m.react('👎').catch(() => undefined);
    await i.reply({ embeds: [successEmbed(`Your suggestion was posted in ${ch}.`, 'Sent')], flags: EPH });
  },
};
const calculator: Command = {
  data: new SlashCommandBuilder().setName('calculator').setDescription('Calculate a math expression')
    .addStringOption((o) => o.setName('expression').setDescription('e.g. (12+8)*3/4').setRequired(true).setMaxLength(100)),
  async execute(i) {
    const exp = i.options.getString('expression', true);
    try { await i.reply({ embeds: [embed('Calculator', `\`${exp}\`\n= **${Number(calculate(exp).toPrecision(12))}**`)] }); }
    catch (e) { await i.reply({ embeds: [errorEmbed((e as Error).message)], flags: EPH }); }
  },
};
export function parseDate(input: string, offsetHours: number): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(input.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4] ?? '0', m[5] ?? '0'].map(Number);
  const ms = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(ms);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59) return null;
  return Math.floor((ms - offsetHours * 3_600_000) / 1000);
}
const timestamp: Command = {
  data: new SlashCommandBuilder().setName('timestamp').setDescription('Make Discord timestamps (show in everyone\'s timezone)')
    .addStringOption((o) => o.setName('date').setDescription('YYYY-MM-DD or YYYY-MM-DD HH:MM (default: now)').setMaxLength(16))
    .addNumberOption((o) => o.setName('utc_offset').setDescription('Your UTC offset in hours, e.g. 6 or -5 (default 0)').setMinValue(-12).setMaxValue(14)),
  async execute(i) {
    const input = i.options.getString('date');
    const ts = input ? parseDate(input, i.options.getNumber('utc_offset') ?? 0) : Math.floor(Date.now() / 1000);
    if (ts === null) return void (await i.reply({ embeds: [errorEmbed('Use the format `2026-12-25` or `2026-12-25 18:30`.')], flags: EPH }));
    const rows = (['t', 'T', 'd', 'D', 'f', 'F', 'R'] as const).map((s) => `<t:${ts}:${s}> → \`<t:${ts}:${s}>\``).join('\n');
    await i.reply({ embeds: [embed('Timestamps', rows)], flags: EPH });
  },
};
const afk: Command = {
  data: new SlashCommandBuilder().setName('afk').setDescription('Set yourself as AFK')
    .addStringOption((o) => o.setName('reason').setDescription('Why are you away?').setMaxLength(100)),
  async execute(i) {
    const reason = i.options.getString('reason') ?? 'AFK';
    db.prepare(`INSERT INTO afk (guild_id, user_id, reason, since) VALUES (?, ?, ?, ?)
      ON CONFLICT (guild_id, user_id) DO UPDATE SET reason = excluded.reason, since = excluded.since`).run(i.guildId, i.user.id, reason, Date.now());
    await i.reply({ embeds: [successEmbed(`You're now AFK: ${reason}`, 'AFK set')], allowedMentions: { parse: [] } });
  },
};
const profile: Command = {
  data: new SlashCommandBuilder().setName('profile').setDescription('Your VERO9X profile')
    .addUserOption((o) => o.setName('user').setDescription('Defaults to you')),
  async execute(i) {
    const user = i.options.getUser('user') ?? i.user;
    const s = getSettings(i.guildId!);
    const r = getRank(i.guildId!, user.id);
    const acc = getAccount(i.guildId!, user.id);
    const e = embed(user.username).setThumbnail(user.displayAvatarURL({ size: 256 })).addFields(
      { name: 'Level', value: `${r.level} • #${r.position}`, inline: true }, { name: 'XP', value: r.xp.toLocaleString(), inline: true },
      { name: 'Messages', value: r.messages.toLocaleString(), inline: true },
      { name: 'Balance', value: `${s.currency} ${(acc.wallet + acc.bank).toLocaleString()}`, inline: true });
    await i.reply({ embeds: [e] });
  },
};
export default [remind, poll, suggest, calculator, timestamp, afk, profile];

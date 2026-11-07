import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { db, getSettings } from '../../database/db';
import { claim, credit, debitWallet, getAccount, transfer } from '../../systems/economy';
import { formatDuration } from '../../systems/moderation';
import { Command } from '../../types';
import { embed, errorEmbed, successEmbed } from '../../utils/embeds';

type I = Parameters<Command['execute']>[0];
const EPH = MessageFlags.Ephemeral;
/** Wraps a handler so it refuses to run when the server disabled the economy. */
const guard = (fn: (i: I) => Promise<void>) => async (i: I) => {
  if (!getSettings(i.guildId!).economy_enabled) return void (await i.reply({ embeds: [errorEmbed('The economy is disabled in this server.')], flags: EPH }));
  await fn(i);
};
const money = (g: string, n: number) => `${getSettings(g).currency} ${n.toLocaleString()}`;

const balance: Command = {
  data: new SlashCommandBuilder().setName('balance').setDescription('Check a balance').addUserOption((o) => o.setName('user').setDescription('Defaults to you')),
  execute: guard(async (i) => {
    const u = i.options.getUser('user') ?? i.user;
    const a = getAccount(i.guildId!, u.id);
    await i.reply({ embeds: [embed(`${u.username}'s balance`).addFields(
      { name: 'Wallet', value: money(i.guildId!, a.wallet), inline: true }, { name: 'Bank', value: money(i.guildId!, a.bank), inline: true },
      { name: 'Total', value: money(i.guildId!, a.wallet + a.bank), inline: true })] });
  }),
};
const timed = (name: string, desc: string, col: 'last_daily' | 'last_weekly', ms: number, key: 'daily_amount' | 'weekly_amount'): Command => ({
  data: new SlashCommandBuilder().setName(name).setDescription(desc),
  execute: guard(async (i) => {
    const amount = getSettings(i.guildId!)[key];
    const next = claim(i.guildId!, i.user.id, col, ms, amount);
    if (next) return void (await i.reply({ embeds: [errorEmbed(`Already claimed. Come back <t:${Math.ceil(next / 1000)}:R>.`)], flags: EPH }));
    await i.reply({ embeds: [successEmbed(`You received **${money(i.guildId!, amount)}**.`, `${name[0].toUpperCase()}${name.slice(1)} reward`)] });
  }),
});
const JOBS = ['delivered pizzas', 'fixed a server rack', 'streamed to 3 viewers', 'walked dogs', 'moderated a chaotic chat', 'edited a video', 'tutored a student', 'sold lemonade', 'coded a Discord bot', 'washed cars'];
const work: Command = {
  data: new SlashCommandBuilder().setName('work').setDescription('Work a job for coins (1h cooldown)'),
  execute: guard(async (i) => {
    const s = getSettings(i.guildId!);
    const lo = Math.min(s.work_min, s.work_max), hi = Math.max(s.work_min, s.work_max);
    const pay = lo + Math.floor(Math.random() * (hi - lo + 1));
    const next = claim(i.guildId!, i.user.id, 'last_work', 3_600_000, pay);
    if (next) return void (await i.reply({ embeds: [errorEmbed(`You're tired. Work again <t:${Math.ceil(next / 1000)}:R>.`)], flags: EPH }));
    await i.reply({ embeds: [successEmbed(`You ${JOBS[Math.floor(Math.random() * JOBS.length)]} and earned **${money(i.guildId!, pay)}**.`, 'Work')] });
  }),
};
function parseAmount(raw: string, max: number): number | null {
  if (raw.toLowerCase() === 'all') return max > 0 ? max : null;
  if (!/^\d{1,12}$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}
const amountOpt = (o: import('discord.js').SlashCommandStringOption) => o.setName('amount').setDescription('A number or "all"').setRequired(true).setMaxLength(12);
const deposit: Command = {
  data: new SlashCommandBuilder().setName('deposit').setDescription('Move coins from wallet to bank').addStringOption(amountOpt),
  execute: guard(async (i) => {
    const res = db.transaction(() => {
      const a = getAccount(i.guildId!, i.user.id);
      const n = parseAmount(i.options.getString('amount', true), a.wallet);
      if (!n || n > a.wallet) return null;
      db.prepare('UPDATE economy SET wallet = wallet - ?, bank = bank + ? WHERE guild_id = ? AND user_id = ?').run(n, n, i.guildId, i.user.id);
      return n;
    })();
    if (!res) return void (await i.reply({ embeds: [errorEmbed('Invalid amount or not enough coins in your wallet.')], flags: EPH }));
    await i.reply({ embeds: [successEmbed(`Deposited **${money(i.guildId!, res)}**.`, 'Deposit')] });
  }),
};
const withdraw: Command = {
  data: new SlashCommandBuilder().setName('withdraw').setDescription('Move coins from bank to wallet').addStringOption(amountOpt),
  execute: guard(async (i) => {
    const res = db.transaction(() => {
      const a = getAccount(i.guildId!, i.user.id);
      const n = parseAmount(i.options.getString('amount', true), a.bank);
      if (!n || n > a.bank) return null;
      db.prepare('UPDATE economy SET wallet = wallet + ?, bank = bank - ? WHERE guild_id = ? AND user_id = ?').run(n, n, i.guildId, i.user.id);
      return n;
    })();
    if (!res) return void (await i.reply({ embeds: [errorEmbed('Invalid amount or not enough coins in your bank.')], flags: EPH }));
    await i.reply({ embeds: [successEmbed(`Withdrew **${money(i.guildId!, res)}**.`, 'Withdraw')] });
  }),
};
const pay: Command = {
  cooldown: 3,
  data: new SlashCommandBuilder().setName('pay').setDescription('Send coins to another member')
    .addUserOption((o) => o.setName('user').setDescription('Recipient').setRequired(true))
    .addIntegerOption((o) => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1).setMaxValue(1_000_000_000)),
  execute: guard(async (i) => {
    const to = i.options.getUser('user', true);
    const amt = i.options.getInteger('amount', true);
    if (to.bot || to.id === i.user.id) return void (await i.reply({ embeds: [errorEmbed('Pick another real member.')], flags: EPH }));
    if (!transfer(i.guildId!, i.user.id, to.id, amt)) return void (await i.reply({ embeds: [errorEmbed('You do not have enough coins in your wallet.')], flags: EPH }));
    await i.reply({ embeds: [successEmbed(`Sent **${money(i.guildId!, amt)}** to ${to}.`, 'Payment sent')], allowedMentions: { users: [to.id] } });
  }),
};
interface Item { id: number; name: string; price: number; description: string | null; role_id: string | null }
const shop: Command = {
  data: new SlashCommandBuilder().setName('shop').setDescription('Browse and use the server shop')
    .addSubcommand((s) => s.setName('view').setDescription('See items for sale'))
    .addSubcommand((s) => s.setName('buy').setDescription('Buy an item').addStringOption((o) => o.setName('item').setDescription('Item name').setRequired(true).setMaxLength(40)))
    .addSubcommand((s) => s.setName('add').setDescription('Add an item (Manage Server)')
      .addStringOption((o) => o.setName('name').setDescription('Item name').setRequired(true).setMaxLength(40))
      .addIntegerOption((o) => o.setName('price').setDescription('Price').setRequired(true).setMinValue(1).setMaxValue(1_000_000_000))
      .addStringOption((o) => o.setName('description').setDescription('Description').setMaxLength(100))
      .addRoleOption((o) => o.setName('role').setDescription('Role granted on purchase')))
    .addSubcommand((s) => s.setName('remove').setDescription('Remove an item (Manage Server)').addStringOption((o) => o.setName('name').setDescription('Item name').setRequired(true).setMaxLength(40))),
  execute: guard(async (i) => {
    const sub = i.options.getSubcommand();
    const g = i.guildId!;
    if ((sub === 'add' || sub === 'remove') && !i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return void (await i.reply({ embeds: [errorEmbed('You need **Manage Server** to edit the shop.')], flags: EPH }));
    }
    if (sub === 'view') {
      const items = db.prepare('SELECT id, name, price, description, role_id FROM shop_items WHERE guild_id = ? ORDER BY price').all(g) as Item[];
      const body = items.length ? items.map((it) => `**${it.name}** — ${money(g, it.price)}${it.role_id ? ` • grants <@&${it.role_id}>` : ''}\n> ${it.description ?? 'No description'}`).join('\n') : 'The shop is empty. Admins can add items with `/shop add`.';
      return void (await i.reply({ embeds: [embed('🛒 Shop', body.slice(0, 4000))], allowedMentions: { parse: [] } }));
    }
    if (sub === 'add') {
      const role = i.options.getRole('role');
      if (role && (role.id === g || role.managed)) return void (await i.reply({ embeds: [errorEmbed('That role cannot be sold.')], flags: EPH }));
      try {
        db.prepare('INSERT INTO shop_items (guild_id, name, price, description, role_id) VALUES (?, ?, ?, ?, ?)').run(g, i.options.getString('name', true), i.options.getInteger('price', true), i.options.getString('description'), role?.id ?? null);
      } catch { return void (await i.reply({ embeds: [errorEmbed('An item with that name already exists.')], flags: EPH })); }
      return void (await i.reply({ embeds: [successEmbed('Item added to the shop.', 'Shop')], flags: EPH }));
    }
    if (sub === 'remove') {
      const r = db.prepare('DELETE FROM shop_items WHERE guild_id = ? AND lower(name) = lower(?)').run(g, i.options.getString('name', true));
      return void (await i.reply({ embeds: [Number(r.changes) ? successEmbed('Item removed.', 'Shop') : errorEmbed('No item with that name.')], flags: EPH }));
    }
    // buy
    const item = db.prepare('SELECT id, name, price, description, role_id FROM shop_items WHERE guild_id = ? AND lower(name) = lower(?)').get(g, i.options.getString('item', true)) as Item | undefined;
    if (!item) return void (await i.reply({ embeds: [errorEmbed('No item with that name. Check `/shop view`.')], flags: EPH }));
    const member = await i.guild!.members.fetch(i.user.id);
    if (item.role_id) {
      const role = i.guild!.roles.cache.get(item.role_id);
      if (!role || !role.editable) return void (await i.reply({ embeds: [errorEmbed('That role is no longer available or I cannot assign it.')], flags: EPH }));
      if (member.roles.cache.has(role.id)) return void (await i.reply({ embeds: [errorEmbed('You already have that role.')], flags: EPH }));
    }
    const ok = db.transaction(() => {
      if (!debitWallet(g, i.user.id, item.price)) return false;
      db.prepare(`INSERT INTO inventory (guild_id, user_id, item_id, qty) VALUES (?, ?, ?, 1)
        ON CONFLICT (guild_id, user_id, item_id) DO UPDATE SET qty = qty + 1`).run(g, i.user.id, item.id);
      return true;
    })();
    if (!ok) return void (await i.reply({ embeds: [errorEmbed(`You need ${money(g, item.price)} in your wallet.`)], flags: EPH }));
    if (item.role_id) await member.roles.add(item.role_id, 'VERO9X shop purchase').catch(() => credit(g, i.user.id, item.price));
    await i.reply({ embeds: [successEmbed(`You bought **${item.name}** for **${money(g, item.price)}**.`, 'Purchase complete')] });
  }),
};
const inventory: Command = {
  data: new SlashCommandBuilder().setName('inventory').setDescription('See your items').addUserOption((o) => o.setName('user').setDescription('Defaults to you')),
  execute: guard(async (i) => {
    const u = i.options.getUser('user') ?? i.user;
    const rows = db.prepare('SELECT s.name, v.qty FROM inventory v JOIN shop_items s ON s.id = v.item_id WHERE v.guild_id = ? AND v.user_id = ? ORDER BY s.name').all(i.guildId, u.id) as { name: string; qty: number }[];
    await i.reply({ embeds: [embed(`${u.username}'s inventory`, rows.length ? rows.map((r) => `• **${r.name}** ×${r.qty}`).join('\n') : 'Empty.')] });
  }),
};
export default [balance, timed('daily', 'Claim your daily reward', 'last_daily', 86_400_000, 'daily_amount'), timed('weekly', 'Claim your weekly reward', 'last_weekly', 604_800_000, 'weekly_amount'), work, deposit, withdraw, pay, shop, inventory];

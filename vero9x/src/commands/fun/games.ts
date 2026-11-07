import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types';
import { embed, errorEmbed } from '../../utils/embeds';

// ---------- Rock Paper Scissors (vs the bot) ----------
const MOVES = { rock: '🪨', paper: '📄', scissors: '✂️' } as const;
type Move = keyof typeof MOVES;
export function rpsResult(a: Move, b: Move): 'win' | 'lose' | 'draw' {
  if (a === b) return 'draw';
  return (a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper') ? 'win' : 'lose';
}
const rps: Command = {
  cooldown: 3,
  data: new SlashCommandBuilder().setName('rps').setDescription('Play rock paper scissors against VERO9X'),
  async execute(i) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents((Object.keys(MOVES) as Move[]).map((m) => new ButtonBuilder().setCustomId(`rps:${i.id}:${m}`).setEmoji(MOVES[m]).setLabel(m).setStyle(ButtonStyle.Secondary)));
    const res = await i.reply({ embeds: [embed('Rock Paper Scissors', 'Choose your move!')], components: [row], withResponse: true });
    const msg = res.resource!.message!;
    try {
      const click = await msg.awaitMessageComponent({ componentType: ComponentType.Button, time: 30_000, filter: (x) => x.user.id === i.user.id && x.customId.startsWith(`rps:${i.id}:`) });
      const mine = click.customId.split(':')[2] as Move;
      const bot = (Object.keys(MOVES) as Move[])[Math.floor(Math.random() * 3)];
      const r = rpsResult(mine, bot);
      await click.update({ embeds: [embed('Rock Paper Scissors', `You: ${MOVES[mine]}  vs  VERO9X: ${MOVES[bot]}\n\n**${r === 'win' ? 'You win! 🎉' : r === 'lose' ? 'I win! 😎' : "It's a draw."}**`)], components: [] });
    } catch { await i.editReply({ embeds: [embed('Rock Paper Scissors', 'Too slow — game cancelled.')], components: [] }).catch(() => undefined); }
  },
};

// ---------- Tic-Tac-Toe (two players) ----------
type Cell = '' | 'X' | 'O';
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
export function tttWinner(b: Cell[]): Cell | 'draw' | null {
  for (const [x, y, z] of LINES) if (b[x] && b[x] === b[y] && b[y] === b[z]) return b[x];
  return b.every(Boolean) ? 'draw' : null;
}
function board(b: Cell[], id: string, disabled: boolean): ActionRowBuilder<ButtonBuilder>[] {
  return [0, 1, 2].map((r) => new ActionRowBuilder<ButtonBuilder>().addComponents([0, 1, 2].map((c) => {
    const n = r * 3 + c;
    return new ButtonBuilder().setCustomId(`ttt:${id}:${n}`).setLabel(b[n] || '·').setStyle(b[n] === 'X' ? ButtonStyle.Primary : b[n] === 'O' ? ButtonStyle.Danger : ButtonStyle.Secondary).setDisabled(disabled || !!b[n]);
  })));
}
const tictactoe: Command = {
  cooldown: 10,
  data: new SlashCommandBuilder().setName('tictactoe').setDescription('Play tic-tac-toe with another member')
    .addUserOption((o) => o.setName('opponent').setDescription('Who do you challenge?').setRequired(true)),
  async execute(i) {
    const opp = i.options.getUser('opponent', true);
    if (opp.bot || opp.id === i.user.id) return void (await i.reply({ embeds: [errorEmbed('Pick another real member to play against.')], flags: MessageFlags.Ephemeral }));
    const players = [i.user, opp];
    const b: Cell[] = Array(9).fill('');
    let turn = 0;
    const header = () => `❌ ${players[0]}  vs  ⭕ ${players[1]}\n**${players[turn]}'s turn**`;
    const res = await i.reply({ content: header(), embeds: [], components: board(b, i.id, false), allowedMentions: { users: [opp.id] }, withResponse: true });
    const collector = res.resource!.message!.createMessageComponentCollector({ componentType: ComponentType.Button, idle: 120_000, filter: (x) => x.customId.startsWith(`ttt:${i.id}:`) });
    collector.on('collect', async (x) => {
      if (x.user.id !== players[turn].id) return void (await x.reply({ content: x.user.id === players[1 - turn].id ? "It's not your turn." : 'You are not in this game.', flags: MessageFlags.Ephemeral }));
      const n = Number(x.customId.split(':')[2]);
      if (b[n]) return void (await x.deferUpdate());
      b[n] = turn === 0 ? 'X' : 'O';
      const w = tttWinner(b);
      if (w) {
        collector.stop('done');
        return void (await x.update({ content: w === 'draw' ? `🤝 It's a draw between ${players[0]} and ${players[1]}!` : `🏆 ${players[turn]} wins!`, components: board(b, i.id, true) }));
      }
      turn = 1 - turn;
      await x.update({ content: header(), components: board(b, i.id, false) });
    });
    collector.on('end', (_c, reason) => { if (reason !== 'done') void i.editReply({ content: 'Game ended due to inactivity.', components: board(b, i.id, true) }).catch(() => undefined); });
  },
};

// ---------- Number guessing ----------
const active = new Set<string>();
const guess: Command = {
  data: new SlashCommandBuilder().setName('guess').setDescription('Guess the number between 1 and 100 (6 tries, type numbers in chat)'),
  async execute(i) {
    const key = `${i.channelId}:${i.user.id}`;
    if (active.has(key) || !i.channel?.isSendable()) return void (await i.reply({ embeds: [errorEmbed('You already have a game running here.')], flags: MessageFlags.Ephemeral }));
    active.add(key);
    const secret = 1 + Math.floor(Math.random() * 100);
    let tries = 6;
    await i.reply({ embeds: [embed('🔢 Guess the number', `${i.user}, I'm thinking of a number from **1 to 100**.\nType your guesses in chat. You have **${tries}** tries and 45 seconds per guess.`)] });
    const collector = i.channel.createMessageCollector({ filter: (m) => m.author.id === i.user.id && /^\d{1,3}$/.test(m.content.trim()), idle: 45_000 });
    collector.on('collect', async (m) => {
      const g = Number(m.content.trim());
      tries--;
      if (g === secret) { collector.stop('won'); return void (await m.reply({ embeds: [embed('🎉 Correct!', `It was **${secret}**. Solved with ${6 - tries} guess(es).`)] })); }
      if (tries === 0) { collector.stop('lost'); return void (await m.reply({ embeds: [embed('Out of tries', `The number was **${secret}**.`)] })); }
      await m.reply({ embeds: [embed(g < secret ? '⬆️ Higher' : '⬇️ Lower', `${tries} tries left.`)] });
    });
    collector.on('end', (_c, reason) => { active.delete(key); if (reason === 'idle' && i.channel?.isSendable()) void i.channel.send({ content: `⌛ Game over — the number was **${secret}**.` }).catch(() => undefined); });
  },
};
export default [rps, tictactoe, guess];

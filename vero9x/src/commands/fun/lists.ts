import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types';
import { embed } from '../../utils/embeds';

const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
/** Stable 0-99 number from two strings, so /ship and /rate give the same answer for the same input. */
export function hash100(a: string, b = ''): number {
  let h = 2166136261;
  for (const c of `${a.toLowerCase()}|${b.toLowerCase()}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return Math.abs(h) % 101;
}
function simple(name: string, desc: string, title: string, items: string[]): Command {
  return { cooldown: 2, data: new SlashCommandBuilder().setName(name).setDescription(desc), async execute(i) { await i.reply({ embeds: [embed(title, pick(items))] }); } };
}

const JOKES = ['Why do programmers prefer dark mode? Because light attracts bugs.', 'I told my computer I needed a break. It said: "No problem, I\'ll go to sleep."', 'Why did the scarecrow win an award? He was outstanding in his field.', 'What do you call fake spaghetti? An impasta.', 'I would tell you a UDP joke, but you might not get it.', 'Why don\'t skeletons fight each other? They don\'t have the guts.', 'There are 10 kinds of people: those who understand binary and those who don\'t.', 'I\'m reading a book on anti-gravity. It\'s impossible to put down.'];
const FACTS = ['Honey never spoils — edible honey was found in ancient Egyptian tombs.', 'Octopuses have three hearts and blue blood.', 'A day on Venus is longer than its year.', 'Bananas are berries, but strawberries are not.', 'The first computer "bug" was an actual moth found in a relay in 1947.', 'Sharks existed before trees.', 'There are more possible chess games than atoms in the observable universe.', 'Wombat droppings are cube-shaped.'];
const COMPLIMENTS = ['You make this server a better place.', 'Your energy is genuinely contagious.', 'You have excellent taste.', 'You are the kind of person people are glad to meet.', 'Your sense of humor is elite.', 'You make hard things look easy.', 'People notice how kind you are.'];
const ROASTS = ['You\'re the reason the "are you still there?" prompt exists.', 'You\'re like a cloud: when you disappear, it\'s a beautiful day. (Love you though.)', 'You bring so much joy… when you leave the voice chat. (Kidding!)', 'If laziness were an Olympic sport, you\'d send someone to compete for you.', 'You\'re proof that even autocorrect can\'t fix everything.', 'You have the confidence of a Wi-Fi signal that thinks it\'s full bars.'];
const QUOTES = ['"The secret of getting ahead is getting started." — Mark Twain', '"It always seems impossible until it\'s done." — Nelson Mandela', '"Whether you think you can or you think you can\'t, you\'re right." — Henry Ford', '"Well done is better than well said." — Benjamin Franklin', '"The only way to do great work is to love what you do." — Steve Jobs', '"Fall seven times, stand up eight." — Japanese proverb'];
const WYR = ['Would you rather always be 10 minutes late or always be 20 minutes early?', 'Would you rather have unlimited music or unlimited movies?', 'Would you rather be able to fly or be invisible?', 'Would you rather lose all your photos or all your contacts?', 'Would you rather live without internet for a year or without AC/heating?', 'Would you rather fight one horse-sized duck or a hundred duck-sized horses?'];
const TRUTHS = ['What is the most embarrassing thing you have done online?', 'What is a skill you wish you had?', 'What is the last thing you searched for?', 'Who in this server would you trust with a secret?', 'What is a habit you are trying to break?'];
const DARES = ['Change your nickname to something silly for an hour.', 'Send the 7th photo in your gallery (SFW!).', 'Type with your eyes closed for your next 3 messages.', 'Compliment the last 3 people who talked.', 'Use only emojis for the next 5 minutes.'];
const DAILYQ = ['What is one small thing that made you smile this week?', 'What is a game you could replay forever?', 'If you could master any skill overnight, what would it be?', 'What is the best advice you have ever received?', 'What song is stuck in your head right now?', 'What is your favorite way to spend a rainy day?', 'What is something you are looking forward to?'];
const BALL = ['It is certain.', 'Without a doubt.', 'Yes — definitely.', 'Most likely.', 'Outlook good.', 'Signs point to yes.', 'Reply hazy, try again.', 'Ask again later.', 'Better not tell you now.', "Don't count on it.", 'My sources say no.', 'Very doubtful.'];

const eightball: Command = {
  cooldown: 2,
  data: new SlashCommandBuilder().setName('8ball').setDescription('Ask the magic 8-ball')
    .addStringOption((o) => o.setName('question').setDescription('Your yes/no question').setRequired(true).setMaxLength(200)),
  async execute(i) { await i.reply({ embeds: [embed('🎱 Magic 8-Ball', `**Q:** ${i.options.getString('question', true)}\n**A:** ${pick(BALL)}`)] }); },
};
const coinflip: Command = {
  cooldown: 2,
  data: new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin')
    .addStringOption((o) => o.setName('call').setDescription('Call it').addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })),
  async execute(i) {
    const r = Math.random() < 0.5 ? 'heads' : 'tails'; const call = i.options.getString('call');
    await i.reply({ embeds: [embed('🪙 Coin flip', `It landed on **${r}**!${call ? (call === r ? '\nYou called it. 🎉' : '\nNot this time.') : ''}`)] });
  },
};
const truthordare: Command = {
  cooldown: 2,
  data: new SlashCommandBuilder().setName('truthordare').setDescription('Truth or dare')
    .addStringOption((o) => o.setName('choice').setDescription('Pick one (default: random)').addChoices({ name: 'Truth', value: 'truth' }, { name: 'Dare', value: 'dare' })),
  async execute(i) {
    const c = i.options.getString('choice') ?? pick(['truth', 'dare']);
    await i.reply({ embeds: [embed(c === 'truth' ? '🗣️ Truth' : '🔥 Dare', pick(c === 'truth' ? TRUTHS : DARES))] });
  },
};
const dailyquestion: Command = {
  data: new SlashCommandBuilder().setName('dailyquestion').setDescription("Today's conversation starter"),
  async execute(i) { await i.reply({ embeds: [embed('💬 Daily Question', DAILYQ[Math.floor(Date.now() / 86_400_000) % DAILYQ.length])] }); },
};
const compliment: Command = {
  cooldown: 3,
  data: new SlashCommandBuilder().setName('compliment').setDescription('Compliment someone').addUserOption((o) => o.setName('user').setDescription('Defaults to you')),
  async execute(i) { await i.reply({ embeds: [embed('💜 Compliment', `${i.options.getUser('user') ?? i.user}, ${pick(COMPLIMENTS)}`)], allowedMentions: { parse: [] } }); },
};
const roast: Command = {
  cooldown: 3,
  data: new SlashCommandBuilder().setName('roast').setDescription('A light-hearted roast (all in good fun)').addUserOption((o) => o.setName('user').setDescription('Defaults to you')),
  async execute(i) { await i.reply({ embeds: [embed('🔥 Roast', `${i.options.getUser('user') ?? i.user}, ${pick(ROASTS)}`)], allowedMentions: { parse: [] } }); },
};
const ship: Command = {
  cooldown: 3,
  data: new SlashCommandBuilder().setName('ship').setDescription('Check compatibility between two people')
    .addUserOption((o) => o.setName('first').setDescription('First person').setRequired(true))
    .addUserOption((o) => o.setName('second').setDescription('Second person (defaults to you)')),
  async execute(i) {
    const a = i.options.getUser('first', true), b = i.options.getUser('second') ?? i.user;
    const pct = hash100([a.id, b.id].sort()[0], [a.id, b.id].sort()[1]);
    const bar = '💜'.repeat(Math.round(pct / 10)) + '🖤'.repeat(10 - Math.round(pct / 10));
    await i.reply({ embeds: [embed('💘 Ship', `${a} × ${b}\n${bar}\n**${pct}%** compatible`)], allowedMentions: { parse: [] } });
  },
};
const rate: Command = {
  cooldown: 2,
  data: new SlashCommandBuilder().setName('rate').setDescription('Rate anything out of 10')
    .addStringOption((o) => o.setName('thing').setDescription('What to rate').setRequired(true).setMaxLength(100)),
  async execute(i) {
    const t = i.options.getString('thing', true);
    await i.reply({ embeds: [embed('⭐ Rating', `**${t}**\nI give it **${(hash100(t) / 10).toFixed(1)}/10**`)], allowedMentions: { parse: [] } });
  },
};
export default [
  simple('joke', 'Hear a joke', '😂 Joke', JOKES), simple('fact', 'Learn a random fact', '🧠 Fact', FACTS),
  simple('quote', 'An inspiring quote', '✨ Quote', QUOTES), simple('wouldyourather', 'Would you rather…?', '🤔 Would You Rather', WYR),
  eightball, coinflip, truthordare, dailyquestion, compliment, roast, ship, rate,
];

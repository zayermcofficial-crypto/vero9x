import { EmbedBuilder, InteractionReplyOptions, MessageFlags, RepliableInteraction } from 'discord.js';

export const COLORS = {
  primary: 0x7c3aed, // electric purple
  accent: 0x2563eb, // electric blue
  dark: 0x0b0b0f, // black
  charcoal: 0x1c1c24,
  success: 0x22c55e,
  danger: 0xef4444,
  gray: 0x1c1c24,
};
export const FOOTER = 'VERO9X';

export function embed(title?: string, description?: string, color: number = COLORS.primary): EmbedBuilder {
  const e = new EmbedBuilder().setColor(color).setFooter({ text: FOOTER }).setTimestamp();
  if (title) e.setTitle(title);
  if (description) e.setDescription(description);
  return e;
}
export const successEmbed = (d: string, title = 'Done') => embed(`✔  ${title}`, d, COLORS.success);
export const errorEmbed = (d: string, title = 'Error') => embed(`✖  ${title}`, d, COLORS.danger);

export async function replyError(i: RepliableInteraction, description: string): Promise<void> {
  const payload: InteractionReplyOptions = { embeds: [errorEmbed(description)], flags: MessageFlags.Ephemeral };
  if (i.deferred || i.replied) await i.followUp(payload);
  else await i.reply(payload);
}

/** Turn Discord / runtime errors into something a human can act on. */
export function friendlyError(err: unknown): string {
  const code = (err as { code?: number | string })?.code;
  switch (code) {
    case 50013: return "I'm missing permissions for that. Check my role position and permissions.";
    case 50001: return "I can't see that channel or resource (Missing Access).";
    case 10007: case 10013: return "I couldn't find that member/user.";
    case 10008: return 'That message no longer exists.';
    case 50007: return "I couldn't DM that user (their DMs are closed).";
    case 429: return "I'm being rate limited by Discord. Try again in a moment.";
    default: return 'Something went wrong on my side. It has been logged.';
  }
}

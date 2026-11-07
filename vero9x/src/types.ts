import { AutocompleteInteraction, ChatInputCommandInteraction, Collection, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  /** Discord permissions the invoker must have. Enforced at runtime AND set as default_member_permissions. */
  perms?: bigint[];
  /** Per-user cooldown in seconds. */
  cooldown?: number;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}
export interface LoadedCommand extends Command {
  category: string;
}
export interface BotEvent {
  name: string;
  once?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute(...args: any[]): Promise<void> | void;
}

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, LoadedCommand>;
  }
}

import { ChatInputCommandInteraction, InteractionResponse, Message } from 'discord.js';
import { ServiceContainer } from '@/services';
import { sendResponse } from '@/utils/helpers';
import { logger } from '@/utils/logger';

type CommandResponse = Promise<Message<boolean> | InteractionResponse<boolean> | void>;
type ServiceKeys = keyof ServiceContainer;
type ServiceMethods<T extends ServiceKeys> = keyof ServiceContainer[T];

interface CommandHandler {
  service: ServiceKeys;
  method: string;
  requiresArgs?: boolean;
  aliases?: string[];
  allowArgs?: boolean;
}

const commandHandlers: Record<string, CommandHandler> = {
  profile: { service: 'character', method: 'handleProfile', aliases: ['p'], allowArgs: true },
  hunt: { service: 'character', method: 'handleHunt', aliases: ['h'] },
  daily: { service: 'character', method: 'handleDaily', aliases: ['d'] },
  inventory: { service: 'inventory', method: 'handleInventoryView', aliases: ['i', 'inv'] },
  use: { service: 'inventory', method: 'handleUseItem', requiresArgs: true, aliases: ['u'] },
  balance: { service: 'character', method: 'handleBalance', aliases: ['b', 'bal'] },
  train: { service: 'mentor', method: 'handleTraining', aliases: ['t'] },
  map: { service: 'location', method: 'handleMapView', aliases: ['m'] },
  shop: { service: 'shop', method: 'handleShop', aliases: ['s'], allowArgs: true },
  buy: { service: 'shop', method: 'handleBuyCommand', requiresArgs: true },
  leaderboard: { service: 'character', method: 'handleLeaderboard', aliases: ['lb', 'top'], allowArgs: true },
  help: { service: 'character', method: 'handleHelp' },
  equip: { service: 'equipment', method: 'handleEquipCommand', requiresArgs: true, aliases: ['e'] },
  unequip: { service: 'equipment', method: 'handleUnequipCommand', requiresArgs: true }
};

export async function handleMessageCommand(
  message: Message,
  services: ServiceContainer,
  command: string,
  args: string[]
): CommandResponse {
  try {
    // Normalize command to lowercase
    const normalizedCommand = command.toLowerCase();

    // Find command handler
    const handler = Object.entries(commandHandlers).find(([cmd, h]) => 
      cmd === normalizedCommand || h.aliases?.includes(normalizedCommand)
    );

    if (!handler) {
      throw new Error('Command tidak ditemukan! Gunakan `a help` untuk melihat daftar command.');
    }

    const [_, { service, method, requiresArgs, allowArgs }] = handler;

    // Check if command requires args
    if (requiresArgs && args.length === 0) {
      throw new Error(`Mohon tentukan argumen untuk command ini!\nContoh: \`a ${normalizedCommand} [argumen]\``);
    }

    // Handle equip command specially
    if (normalizedCommand === 'equip' || normalizedCommand === 'e') {
      const serviceInstance = services[service as ServiceKeys];
      const methodFn = serviceInstance[method as ServiceMethods<typeof service>] as unknown as (source: Message, args: string[]) => CommandResponse;
      return methodFn.call(serviceInstance, message, args);
    }

    // Handle unequip command specially
    if (normalizedCommand === 'unequip') {
      const serviceInstance = services[service as ServiceKeys];
      const methodFn = serviceInstance[method as ServiceMethods<typeof service>] as unknown as (source: Message, args: string[]) => CommandResponse;
      return methodFn.call(serviceInstance, message, args);
    }

    // Handle use command specially
    if (normalizedCommand === 'use' || normalizedCommand === 'u') {
      const itemName = args[0].toLowerCase();
      const character = await services.character.getCharacterByDiscordId(message.author.id);
      if (!character) {
        throw new Error('❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.');
      }

      const inventory = await services.inventory.getInventory(character.id);
      const item = inventory.find(i => i.name.toLowerCase().includes(itemName));
      
      if (!item) {
        throw new Error(`❌ Item "${args[0]}" tidak ditemukan di inventory!`);
      }

      const serviceInstance = services[service as ServiceKeys];
      const methodFn = serviceInstance[method as ServiceMethods<typeof service>] as unknown as (source: Message, itemId: string) => CommandResponse;
      return methodFn.call(serviceInstance, message, item.id);
    }

    // Handle buy command specially
    if (normalizedCommand === 'buy' || normalizedCommand === 'b') {
      const serviceInstance = services[service as ServiceKeys];
      const methodFn = serviceInstance[method as ServiceMethods<typeof service>] as unknown as (source: Message, args: string[]) => CommandResponse;
      return methodFn.call(serviceInstance, message, args);
    }

    // Handle profile command with args
    if ((normalizedCommand === 'profile' || normalizedCommand === 'p') && allowArgs) {
      const serviceInstance = services[service as ServiceKeys];
      const methodFn = serviceInstance[method as ServiceMethods<typeof service>] as unknown as (source: Message) => CommandResponse;
      return methodFn.call(serviceInstance, message);
    }

    // Handle leaderboard command with args
    if ((normalizedCommand === 'leaderboard' || normalizedCommand === 'lb') && allowArgs) {
      const serviceInstance = services[service as ServiceKeys];
      const methodFn = serviceInstance[method as ServiceMethods<typeof service>] as unknown as (source: Message, type?: string) => CommandResponse;
      return methodFn.call(serviceInstance, message, args[0]);
    }

    // Handle shop command with args
    if ((normalizedCommand === 'shop' || normalizedCommand === 's') && allowArgs) {
      const serviceInstance = services[service as ServiceKeys];
      const methodFn = serviceInstance[method as ServiceMethods<typeof service>] as unknown as (source: Message, args?: string[]) => CommandResponse;
      return methodFn.call(serviceInstance, message, args);
    }

    // Execute other commands normally
    const serviceInstance = services[service as ServiceKeys];
    const methodFn = serviceInstance[method as ServiceMethods<typeof service>] as unknown as (source: Message, ...args: string[]) => CommandResponse;
    return methodFn.call(serviceInstance, message, ...args);
  } catch (error) {
    logger.error('Command execution error:', error);
    return message.reply(error instanceof Error ? error.message : 'Terjadi kesalahan saat menjalankan command.');
  }
}

export async function execute(
  interaction: ChatInputCommandInteraction, 
  services: ServiceContainer
): CommandResponse {
  const subcommand = interaction.options.getSubcommand(false);
  if (!subcommand) {
    return sendResponse(interaction, {
      content: '❌ Subcommand tidak valid! Gunakan `/help` untuk melihat daftar command.'
    });
  }

  // Find command handler
  const handler = Object.entries(commandHandlers).find(([cmd, h]) => 
    cmd === subcommand || h.aliases?.includes(subcommand)
  );

  if (!handler) {
    return sendResponse(interaction, {
      content: '❌ Subcommand tidak valid! Gunakan `/help` untuk melihat daftar command.'
    });
  }

  const [_, { service, method }] = handler;

  // Special handling for use command
  if (subcommand === 'u') {
    const itemId = interaction.options.getString('item', true);
    return services.inventory.handleUseItem(interaction, itemId);
  }

  // Special handling for leaderboard command
  if (subcommand === 'lb') {
    const kategori = interaction.options.getString('kategori');
    const serviceInstance = services[service as ServiceKeys];
    const methodFn = serviceInstance[method as ServiceMethods<typeof service>] as unknown as (source: ChatInputCommandInteraction, type?: string) => Promise<unknown>;
    const result = await methodFn.call(serviceInstance, interaction, kategori || undefined);
    return result as CommandResponse;
  }

  // Execute other commands normally
  const serviceInstance = services[service as ServiceKeys];
  const methodFn = serviceInstance[method as ServiceMethods<typeof service>] as unknown as (source: ChatInputCommandInteraction) => CommandResponse;
  return methodFn.call(serviceInstance, interaction);
}
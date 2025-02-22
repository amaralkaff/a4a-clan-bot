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
}

const commandHandlers: Record<string, CommandHandler> = {
  profile: { service: 'character', method: 'handleProfile', aliases: ['p'] },
  hunt: { service: 'character', method: 'handleHunt', aliases: ['h'] },
  daily: { service: 'character', method: 'handleDaily', aliases: ['d'] },
  inventory: { service: 'inventory', method: 'handleInventoryView', aliases: ['i', 'inv'] },
  use: { service: 'inventory', method: 'handleUseItem', requiresArgs: true, aliases: ['u'] },
  balance: { service: 'character', method: 'handleBalance', aliases: ['b', 'bal'] },
  train: { service: 'mentor', method: 'handleTraining', aliases: ['t'] },
  map: { service: 'location', method: 'handleMapView', aliases: ['m'] },
  shop: { service: 'shop', method: 'handleShop', aliases: ['s'] },
  leaderboard: { service: 'character', method: 'handleLeaderboard', aliases: ['lb', 'top'] },
  help: { service: 'character', method: 'handleHelp' }
};

export async function handleMessageCommand(
  message: Message,
  services: ServiceContainer,
  command: string,
  args: string[]
): CommandResponse {
  // Find command handler
  const handler = Object.entries(commandHandlers).find(([cmd, h]) => 
    cmd === command || h.aliases?.includes(command)
  );

  if (!handler) {
    throw new Error('Command tidak ditemukan! Gunakan `a help` untuk melihat daftar command.');
  }

  const [_, { service, method, requiresArgs }] = handler;

  // Handle use command specially
  if (command === 'use' || command === 'u') {
    if (!args.length) {
      throw new Error('Mohon tentukan item yang ingin digunakan!\nContoh: `a u potion` atau `a use potion`');
    }
    const itemName = args[0].toLowerCase();
    
    // Get available items
    const character = await services.character.getCharacterByDiscordId(message.author.id);
    if (!character) {
      throw new Error('❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.');
    }

    const inventory = await services.inventory.getInventory(character.id);
    const item = inventory.find(i => i.name.toLowerCase().includes(itemName));
    
    if (!item) {
      throw new Error(`❌ Item "${args[0]}" tidak ditemukan di inventory!`);
    }

    logger.debug('Found item for use command:', {
      itemName: itemName,
      foundItem: {
        id: item.id,
        name: item.name,
        effect: item.effect
      }
    });

    // Execute use command with found item id
    const serviceInstance = services[service as ServiceKeys];
    const methodFn = serviceInstance[method as ServiceMethods<typeof service>] as unknown as (source: Message, itemId: string) => CommandResponse;
    return methodFn.call(serviceInstance, message, item.id);
  }

  // Execute other commands normally
  const serviceInstance = services[service as ServiceKeys];
  const methodFn = serviceInstance[method as ServiceMethods<typeof service>] as unknown as (source: Message, ...args: string[]) => CommandResponse;
  return methodFn.call(serviceInstance, message, ...args);
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
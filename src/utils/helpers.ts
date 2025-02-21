// src/utils/helpers.ts
import { InteractionReplyOptions } from 'discord.js';

export function createEphemeralReply(options: InteractionReplyOptions): InteractionReplyOptions {
  return {
    ...options,
    ephemeral: true
  };
}
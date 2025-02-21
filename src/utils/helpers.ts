// src/utils/helpers.ts
import { InteractionReplyOptions } from 'discord.js';

export function createEphemeralReply(options: InteractionReplyOptions): InteractionReplyOptions {
  return {
    ...options,
    ephemeral: true
  };
}

// Tambahkan helper functions untuk JSON fields
export function parseJsonField<T>(jsonString: string, defaultValue: T): T {
  try {
    return JSON.parse(jsonString);
  } catch {
    return defaultValue;
  }
}
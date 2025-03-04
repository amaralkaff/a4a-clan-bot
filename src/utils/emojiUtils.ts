import { ITEM_TYPE_EMOJIS } from '../config/gameData';

export function getItemTypeEmoji(type: string): string {
  return ITEM_TYPE_EMOJIS[type as keyof typeof ITEM_TYPE_EMOJIS] || '❓';
}

export function getTierEmoji(tier: number): string {
  const emojiMap: Record<number, string> = {
    1: '🥉',
    2: '🥈',
    3: '🥇',
    4: '👑',
    5: '💎'
  };
  return emojiMap[tier] || '❓';
}

export function getRarityEmoji(rarity: string): string {
  const emojiMap: Record<string, string> = {
    'LEGENDARY': '🟡',
    'EPIC': '🟣',
    'RARE': '🔵',
    'UNCOMMON': '🟢',
    'COMMON': '⚪'
  };
  return emojiMap[rarity] || '❓';
}

export function getBuffEmoji(type: string): string {
  const emojiMap: Record<string, string> = {
    'ATTACK': '⚔️',
    'DEFENSE': '🛡️',
    'SPEED': '💨',
    'ALL': '💫',
    'HEAL': '❤️',
    'HEAL_OVER_TIME': '💚',
    'BURN': '🔥',
    'POISON': '☠️',
    'STUN': '⚡',
    'DAMAGE': '🗡️',
    'EXP': '✨',
    'DROPS': '💎',
    'HEALING': '💖',
    'RUMBLE_BALL': '💊',
    'SUPER_MEAT': '🍖',
    'CRITICAL': '🎯',
    'COMBO': '🔄',
    'GEAR_SECOND': '🔧',
    'TRAINING': '🏋️',
    'MENTOR': '👨‍🏫',
    'FOOD': '🍖',
    'EXPLORATION': '🗺️',
    'QUEST': '📚',
    'BATTLE': '⚔️'
  };
  return emojiMap[type] || '⚡';
}

export function getMentorEmoji(mentor: string): string {
  const emojiMap: Record<string, string> = {
    'YB': '🥊',
    'Tierison': '⚔️',
    'LYuka': '🎯',
    'GarryAng': '🦵'
  };
  return emojiMap[mentor] || '❓';
}

export function getQuestTypeEmoji(type: string): string {
  const emojiMap: Record<string, string> = {
    'COMBAT': '⚔️',
    'GATHER': '🌾',
    'EXPLORE': '🗺️',
    'CRAFT': '⚒️',
    'HELP': '💡'
  };
  return emojiMap[type] || '📜';
} 
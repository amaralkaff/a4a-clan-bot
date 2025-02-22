// Helper functions for emojis and other utilities
export function getMentorEmoji(mentor: string): string {
  const emojiMap: Record<string, string> = {
    'YB': '⚔️',
    'Tierison': '🗡️',
    'LYuka': '🎯',
    'GarryAng': '🔥'
  };
  return emojiMap[mentor] || '👨‍🏫';
}

export function getItemTypeEmoji(type: string): string {
  const emojiMap: Record<string, string> = {
    'CONSUMABLE': '🧪',
    'WEAPON': '⚔️',
    'ARMOR': '🛡️',
    'MATERIAL': '📦',
    'FOOD': '🍖',
    'INGREDIENT': '🌿'
  };
  return emojiMap[type] || '📦';
}

export function getTierEmoji(tier: string): string {
  const emojiMap: Record<string, string> = {
    'STARTER': '🏝️',
    'INTERMEDIATE': '🏰',
    'ADVANCED': '⚔️'
  };
  return emojiMap[tier] || '🗺️';
} 
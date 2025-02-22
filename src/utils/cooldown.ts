import { COOLDOWNS } from '@/commands';

// Cooldown storage
const cooldownMap = new Map<string, Map<string, number>>();

export function getCooldown(userId: string, command: string): number {
  const userCooldowns = cooldownMap.get(userId);
  if (!userCooldowns) return 0;
  return userCooldowns.get(command) || 0;
}

export function setCooldown(userId: string, command: string): void {
  if (!cooldownMap.has(userId)) {
    cooldownMap.set(userId, new Map());
  }
  const userCooldowns = cooldownMap.get(userId)!;
  userCooldowns.set(command, Date.now() + (COOLDOWNS[command as keyof typeof COOLDOWNS] || 0));
}

export function checkCooldown(userId: string, command: string): boolean {
  const cooldownTime = getCooldown(userId, command);
  return Date.now() >= cooldownTime;
}

export function getRemainingCooldown(userId: string, command: string): number {
  const cooldownTime = getCooldown(userId, command);
  return Math.max(0, Math.ceil((cooldownTime - Date.now()) / 1000));
}

export function getCooldownMessage(command: string, remainingTime: number): string {
  return `⏰ ${command} sedang cooldown! Tunggu ${remainingTime} detik lagi.`;
}

// Clear expired cooldowns periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, userCooldowns] of cooldownMap.entries()) {
    for (const [command, time] of userCooldowns.entries()) {
      if (now >= time) {
        userCooldowns.delete(command);
      }
    }
    if (userCooldowns.size === 0) {
      cooldownMap.delete(userId);
    }
  }
}, 60000); // Clean up every minute 
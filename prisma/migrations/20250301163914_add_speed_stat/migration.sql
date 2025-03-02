-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "health" INTEGER NOT NULL DEFAULT 100,
    "maxHealth" INTEGER NOT NULL DEFAULT 100,
    "attack" INTEGER NOT NULL DEFAULT 10,
    "defense" INTEGER NOT NULL DEFAULT 10,
    "speed" INTEGER NOT NULL DEFAULT 10,
    "currentIsland" TEXT NOT NULL DEFAULT 'starter_island',
    "mentor" TEXT,
    "luffyProgress" INTEGER NOT NULL DEFAULT 0,
    "zoroProgress" INTEGER NOT NULL DEFAULT 0,
    "usoppProgress" INTEGER NOT NULL DEFAULT 0,
    "sanjiProgress" INTEGER NOT NULL DEFAULT 0,
    "dailyHealCount" INTEGER NOT NULL DEFAULT 0,
    "lastHealTime" DATETIME,
    "lastDailyReset" DATETIME,
    "combo" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "winStreak" INTEGER NOT NULL DEFAULT 0,
    "highestStreak" INTEGER NOT NULL DEFAULT 0,
    "huntStreak" INTEGER NOT NULL DEFAULT 0,
    "highestHuntStreak" INTEGER NOT NULL DEFAULT 0,
    "lastHuntTime" DATETIME,
    "questPoints" INTEGER NOT NULL DEFAULT 0,
    "explorationPoints" INTEGER NOT NULL DEFAULT 0,
    "statusEffects" TEXT NOT NULL DEFAULT '{"effects":[]}',
    "activeBuffs" TEXT NOT NULL DEFAULT '{"buffs":[]}',
    "coins" INTEGER NOT NULL DEFAULT 0,
    "bank" INTEGER NOT NULL DEFAULT 0,
    "totalGambled" INTEGER NOT NULL DEFAULT 0,
    "totalWon" INTEGER NOT NULL DEFAULT 0,
    "lastGambleTime" DATETIME,
    "equippedWeapon" TEXT,
    "equippedArmor" TEXT,
    "equippedAccessory" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Character_currentIsland_fkey" FOREIGN KEY ("currentIsland") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Character" ("activeBuffs", "attack", "bank", "coins", "combo", "createdAt", "currentIsland", "dailyHealCount", "defense", "equippedAccessory", "equippedArmor", "equippedWeapon", "experience", "explorationPoints", "health", "highestHuntStreak", "highestStreak", "huntStreak", "id", "lastDailyReset", "lastGambleTime", "lastHealTime", "lastHuntTime", "level", "losses", "luffyProgress", "maxHealth", "mentor", "name", "questPoints", "sanjiProgress", "statusEffects", "totalGambled", "totalWon", "updatedAt", "userId", "usoppProgress", "winStreak", "wins", "zoroProgress") SELECT "activeBuffs", "attack", "bank", "coins", "combo", "createdAt", "currentIsland", "dailyHealCount", "defense", "equippedAccessory", "equippedArmor", "equippedWeapon", "experience", "explorationPoints", "health", "highestHuntStreak", "highestStreak", "huntStreak", "id", "lastDailyReset", "lastGambleTime", "lastHealTime", "lastHuntTime", "level", "losses", "luffyProgress", "maxHealth", "mentor", "name", "questPoints", "sanjiProgress", "statusEffects", "totalGambled", "totalWon", "updatedAt", "userId", "usoppProgress", "winStreak", "wins", "zoroProgress" FROM "Character";
DROP TABLE "Character";
ALTER TABLE "new_Character" RENAME TO "Character";
CREATE UNIQUE INDEX "Character_userId_key" ON "Character"("userId");
CREATE INDEX "Character_level_currentIsland_idx" ON "Character"("level", "currentIsland");
CREATE INDEX "Character_mentor_idx" ON "Character"("mentor");
CREATE INDEX "Character_lastDailyReset_idx" ON "Character"("lastDailyReset");
CREATE INDEX "Character_huntStreak_highestHuntStreak_idx" ON "Character"("huntStreak", "highestHuntStreak");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

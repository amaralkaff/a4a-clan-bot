-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
    "currentIsland" TEXT NOT NULL DEFAULT 'starter_island',
    "mentor" TEXT,
    "luffyProgress" INTEGER NOT NULL DEFAULT 0,
    "zoroProgress" INTEGER NOT NULL DEFAULT 0,
    "usoppProgress" INTEGER NOT NULL DEFAULT 0,
    "sanjiProgress" INTEGER NOT NULL DEFAULT 0,
    "dailyHealCount" INTEGER NOT NULL DEFAULT 0,
    "lastHealTime" DATETIME,
    "combo" INTEGER NOT NULL DEFAULT 0,
    "questPoints" INTEGER NOT NULL DEFAULT 0,
    "explorationPoints" INTEGER NOT NULL DEFAULT 0,
    "lastDailyReset" DATETIME,
    "statusEffects" TEXT NOT NULL DEFAULT '{}',
    "activeBuffs" TEXT NOT NULL DEFAULT '{}',
    "coins" INTEGER NOT NULL DEFAULT 0,
    "bank" INTEGER NOT NULL DEFAULT 0,
    "totalGambled" INTEGER NOT NULL DEFAULT 0,
    "totalWon" INTEGER NOT NULL DEFAULT 0,
    "lastGambleTime" DATETIME,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "winStreak" INTEGER NOT NULL DEFAULT 0,
    "highestStreak" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Character_currentIsland_fkey" FOREIGN KEY ("currentIsland") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Character" ("activeBuffs", "attack", "combo", "createdAt", "currentIsland", "dailyHealCount", "defense", "experience", "explorationPoints", "health", "id", "lastDailyReset", "lastHealTime", "level", "luffyProgress", "maxHealth", "mentor", "name", "questPoints", "sanjiProgress", "statusEffects", "updatedAt", "userId", "usoppProgress", "zoroProgress") SELECT "activeBuffs", "attack", "combo", "createdAt", "currentIsland", "dailyHealCount", "defense", "experience", "explorationPoints", "health", "id", "lastDailyReset", "lastHealTime", "level", "luffyProgress", "maxHealth", "mentor", "name", "questPoints", "sanjiProgress", "statusEffects", "updatedAt", "userId", "usoppProgress", "zoroProgress" FROM "Character";
DROP TABLE "Character";
ALTER TABLE "new_Character" RENAME TO "Character";
CREATE UNIQUE INDEX "Character_userId_key" ON "Character"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Transaction_characterId_idx" ON "Transaction"("characterId");

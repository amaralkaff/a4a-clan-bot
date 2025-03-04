/*
  Warnings:

  - Added the required column `updatedAt` to the `Quest` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Quest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "objectives" TEXT NOT NULL,
    "rewards" TEXT NOT NULL,
    "progress" TEXT,
    "status" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "expiresAt" DATETIME,
    "isDaily" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quest_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Quest" ("characterId", "completedAt", "description", "expiresAt", "id", "name", "objectives", "progress", "rewards", "startedAt", "status", "templateId", "type") SELECT "characterId", "completedAt", "description", "expiresAt", "id", "name", "objectives", "progress", "rewards", "startedAt", "status", "templateId", "type" FROM "Quest";
DROP TABLE "Quest";
ALTER TABLE "new_Quest" RENAME TO "Quest";
CREATE INDEX "Quest_characterId_idx" ON "Quest"("characterId");
CREATE INDEX "Quest_templateId_idx" ON "Quest"("templateId");
CREATE UNIQUE INDEX "Quest_characterId_templateId_status_key" ON "Quest"("characterId", "templateId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

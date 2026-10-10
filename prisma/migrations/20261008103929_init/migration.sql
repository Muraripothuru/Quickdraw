-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedRoster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "guestKey" TEXT,
    "title" TEXT NOT NULL,
    "names" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedRoster_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Draw" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "guestKey" TEXT,
    "guestExpiresAt" DATETIME,
    "name" TEXT NOT NULL,
    "eventName" TEXT,
    "prize" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalParticipants" INTEGER NOT NULL DEFAULT 0,
    "totalEntries" INTEGER NOT NULL DEFAULT 0,
    "winnerCountTarget" INTEGER NOT NULL DEFAULT 1,
    "winnersSelectedCount" INTEGER NOT NULL DEFAULT 0,
    "removeWinnersOnSelect" BOOLEAN NOT NULL DEFAULT true,
    "animationStyle" TEXT NOT NULL DEFAULT 'wheel',
    "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "privacy" TEXT NOT NULL DEFAULT 'public',
    "seedCommitment" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "Draw_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "drawId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entryCount" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "position" INTEGER NOT NULL DEFAULT 0,
    "selectionOrder" INTEGER,
    "selectedAt" DATETIME,
    "entropyFingerprint" TEXT,
    CONSTRAINT "Participant_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "Draw" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "SavedRoster_userId_idx" ON "SavedRoster"("userId");

-- CreateIndex
CREATE INDEX "SavedRoster_guestKey_idx" ON "SavedRoster"("guestKey");

-- CreateIndex
CREATE INDEX "Draw_userId_idx" ON "Draw"("userId");

-- CreateIndex
CREATE INDEX "Draw_guestKey_idx" ON "Draw"("guestKey");

-- CreateIndex
CREATE INDEX "Participant_drawId_status_idx" ON "Participant"("drawId", "status");

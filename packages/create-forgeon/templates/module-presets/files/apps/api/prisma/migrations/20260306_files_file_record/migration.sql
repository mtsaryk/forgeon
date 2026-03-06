-- CreateTable
CREATE TABLE "FileRecord" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageDriver" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL DEFAULT 'system',
    "ownerId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileRecord_publicId_key" ON "FileRecord"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "FileRecord_storageKey_key" ON "FileRecord"("storageKey");

-- CreateIndex
CREATE INDEX "FileRecord_ownerType_ownerId_createdAt_idx" ON "FileRecord"("ownerType", "ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "FileRecord_createdById_createdAt_idx" ON "FileRecord"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "FileRecord_visibility_createdAt_idx" ON "FileRecord"("visibility", "createdAt");

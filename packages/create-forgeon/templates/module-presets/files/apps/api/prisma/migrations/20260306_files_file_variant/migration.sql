-- CreateTable
CREATE TABLE "FileBlob" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageDriver" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileBlob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileVariant" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "variantKey" TEXT NOT NULL,
    "blobId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileBlob_hash_size_mimeType_storageDriver_key" ON "FileBlob"("hash", "size", "mimeType", "storageDriver");

-- CreateIndex
CREATE INDEX "FileBlob_storageDriver_createdAt_idx" ON "FileBlob"("storageDriver", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FileVariant_fileId_variantKey_key" ON "FileVariant"("fileId", "variantKey");

-- CreateIndex
CREATE INDEX "FileVariant_blobId_idx" ON "FileVariant"("blobId");

-- CreateIndex
CREATE INDEX "FileVariant_variantKey_status_idx" ON "FileVariant"("variantKey", "status");

-- AddForeignKey
ALTER TABLE "FileVariant"
ADD CONSTRAINT "FileVariant_fileId_fkey"
FOREIGN KEY ("fileId") REFERENCES "FileRecord"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileVariant"
ADD CONSTRAINT "FileVariant_blobId_fkey"
FOREIGN KEY ("blobId") REFERENCES "FileBlob"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "FileVariant" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "variantKey" TEXT NOT NULL,
    "storageDriver" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileVariant_fileId_variantKey_key" ON "FileVariant"("fileId", "variantKey");

-- CreateIndex
CREATE INDEX "FileVariant_variantKey_status_idx" ON "FileVariant"("variantKey", "status");

-- AddForeignKey
ALTER TABLE "FileVariant"
ADD CONSTRAINT "FileVariant_fileId_fkey"
FOREIGN KEY ("fileId") REFERENCES "FileRecord"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

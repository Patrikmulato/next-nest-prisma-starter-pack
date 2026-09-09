-- CreateTable
CREATE TABLE "UsefulMapCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsefulMapCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsefulMap" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "blobPathname" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsefulMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsefulMapCategory_slug_key" ON "UsefulMapCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UsefulMapCategory_label_key" ON "UsefulMapCategory"("label");

-- CreateIndex
CREATE UNIQUE INDEX "UsefulMap_blobPathname_key" ON "UsefulMap"("blobPathname");

-- CreateIndex
CREATE INDEX "UsefulMap_categoryId_createdAt_idx" ON "UsefulMap"("categoryId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "UsefulMap_uploadedById_createdAt_idx" ON "UsefulMap"("uploadedById", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "UsefulMap" ADD CONSTRAINT "UsefulMap_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "UsefulMapCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsefulMap" ADD CONSTRAINT "UsefulMap_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "UsefulMap" DROP CONSTRAINT "UsefulMap_uploadedById_fkey";

-- AddForeignKey
ALTER TABLE "UsefulMap"
ADD CONSTRAINT "UsefulMap_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

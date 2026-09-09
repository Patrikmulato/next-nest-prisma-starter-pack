-- Phase 1/2 completion: enforce user ownership cascade and add Country.code

-- Drop and recreate foreign keys for cascade delete behavior
ALTER TABLE "SavedFilter" DROP CONSTRAINT "SavedFilter_userId_fkey";
ALTER TABLE "FilterHistory" DROP CONSTRAINT "FilterHistory_userId_fkey";

-- Remove orphan rows before making relation fields required
DELETE FROM "SavedFilter" WHERE "userId" IS NULL;
DELETE FROM "FilterHistory" WHERE "userId" IS NULL;

ALTER TABLE "SavedFilter" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "FilterHistory" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "SavedFilter"
  ADD CONSTRAINT "SavedFilter_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FilterHistory"
  ADD CONSTRAINT "FilterHistory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add unique Country.code field
ALTER TABLE "Country" ADD COLUMN "code" TEXT;
UPDATE "Country" SET "code" = "name" WHERE "code" IS NULL;
ALTER TABLE "Country" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");

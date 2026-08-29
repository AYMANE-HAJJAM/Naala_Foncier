-- AlterTable
ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "cloudinaryPublicId" TEXT;
ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "cloudinaryAssetId" TEXT;
ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "cloudinaryVersion" TEXT;
ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "cloudinaryResourceType" TEXT;
ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "cloudinaryDeliveryType" TEXT;
ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "format" TEXT;
ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "width" INTEGER;
ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "height" INTEGER;

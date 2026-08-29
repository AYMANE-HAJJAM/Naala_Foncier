-- Additive: terrain-specific custom category labels (category = AUTRE).
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "customCategoryName" TEXT;
ALTER TABLE "TerrainDraftDocument" ADD COLUMN IF NOT EXISTS "customCategoryName" TEXT;

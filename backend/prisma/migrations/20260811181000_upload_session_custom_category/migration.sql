-- Additive: carry terrain-specific Autre labels through post-creation upload sessions.
ALTER TABLE "UploadSession" ADD COLUMN IF NOT EXISTS "customCategoryName" TEXT;

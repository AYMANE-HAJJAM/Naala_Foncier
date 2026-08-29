-- Requisition.isPrincipal existed in the deployed database before Phase 1,
-- but was missing from the replayable migration history.
ALTER TABLE "Requisition"
  ADD COLUMN IF NOT EXISTS "isPrincipal" BOOLEAN NOT NULL DEFAULT true;


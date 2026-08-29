# Phase 1 — Data migration

## Additive migration

Folder: `backend/prisma/migrations/20260811150000_phase1_foundation`

Adds (no destructive drops):

- Enums: `TerrainEventType`, `TerrainEventSource`, `TerrainEventValidationStatus`, `DataFreshnessCode`, `AIExtractionStatus`, `TerrainDraftStatus`, `DocumentCategory.ACTES`
- Tables: `TerrainEvent`, `RequisitionStatusSnapshot`, `AIExtraction`, `TerrainDraft`, `TerrainDraftDocument`
- Columns: `LegalCase.linkedRequisitionId`, `Opposition.referenceDate|impact|notes|sourceDocumentId`
- Index: `Requisition.isPrincipal`

## Apply

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
npm run phase1:backfill
```

## Backfill script (`npm run phase1:backfill`)

Idempotent:

1. Ensures R 16605/31 is `isPrincipal=false`
2. Links LegalCase rows of R 20612/31 to R 16605 when missing
3. Creates `RequisitionRelation` réciproque if missing
4. Creates `TerrainEvent` rows from `terrain-summaries` (`source=IMPORT`) when not already present
5. Mirrors `Hearing` rows into `TerrainEvent` (`source=HEARING_MIRROR`) when not already mirrored
6. Upserts `RequisitionStatusSnapshot` from events + existing status fields

**Does not** overwrite newer manually entered identity fields with older import OCR variants.

## Compatibility

- Existing documents, assignments, reports, users, Cloudinary keys preserved
- `ACTES_PROPRIETE` documents remain valid; UI maps them under « 03 — Actes »
- `LegalCase` table kept (CourtCase conceptually); no rename
- Denormalized card fields on `Requisition` remain; refreshed when confirmed events are written

## Rollback note

Additive only. Rollback would require a down migration removing new tables/columns — not shipped in Phase 1. Prefer forward fixes.

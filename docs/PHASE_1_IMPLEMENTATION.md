# Phase 1 — Implementation summary

Date: 2026-08-11

## 1. What changed

### Domain
- Separated **identity** (Requisition fields) from **evolving status** (`TerrainEvent` + `RequisitionStatusSnapshot`)
- Added terrain creation **draft wizard** (`TerrainDraft` / `TerrainDraftDocument`)
- Added `AIExtraction` for proposals (never auto-official)
- Extended court model with `LegalCase.linkedRequisitionId`
- Extended oppositions with optional `referenceDate`, `impact`, `notes`, `sourceDocumentId`
- Document category `ACTES` (UI « 03 — Actes »; legacy `ACTES_PROPRIETE` still accepted)

### Backend modules
- `events` — TerrainEvent CRUD, calendar/upcoming, status snapshot refresh
- `terrain-drafts` — two-step creation API
- `ai-analysis` — `DocumentAnalysisProvider` + `CourtStatusProvider` boundaries (no fake AI, no Mahakim)

### Frontend
- Nav: Terrains / Mes terrains / Calendrier / Administration
- Terrain list cards (status, latest info, next date, doc count)
- Wizard: `/requisitions/nouveau`
- Detail tabs: Vue d’ensemble, Documents, Oppositions, Suivi judiciaire, Calendrier, Rapports, Historique (+ timeline)
- Administration: utilisateurs + affectations
- Calendar available to USER and ADMIN (scoped by assignment)

### Data
- Migration applied on Neon
- Backfill created import/hearing events + snapshots for the six principals
- R 16605 linked to R 20612 cases; remains non-principal

## 2. Prisma migrations

- `20260811150000_phase1_foundation` (applied)

See `docs/PHASE_1_DATA_MIGRATION.md`.

## 3. New backend surfaces

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/requisitions/:id/events` | Timeline |
| POST/PATCH/DELETE | `/api/terrain-events` | ADMIN events |
| GET | `/api/calendar/events` | Calendar range |
| GET | `/api/calendar/upcoming` | Next 30 days |
| POST… | `/api/terrain-drafts/*` | Wizard |

## 4. New frontend routes/components

- `/mes-terrains`, `/calendrier`, `/administration`, `/administration/utilisateurs`, `/administration/affectations`
- `/requisitions/nouveau`
- Redirects: `/mes-dossiers` → `/mes-terrains`, `/agenda` → `/calendrier`, `/utilisateurs` → administration
- `src/lib/api/phase1.ts` (typed helpers until Orval regen)
- `terrain-timeline.tsx`

## 5. Preserved

- Auth, permissions, Cloudinary uploads, OpenAPI stack
- Six principal terrains + documents/reports/assignments
- Hearings / LegalCase / Oppositions / Notifications
- No Mahakim scrape, no fake AI analysis

## 6. Remaining TODOs

1. Restart backend (`npm run dev`) so Nest picks up regenerated Prisma client
2. Regenerate Orval: with API up, `cd frontend && npm run generate:api`
3. Wire agenda “Nouvel événement” to real hearing/event create UI
4. Plug a real `DocumentAnalysisProvider` when credentials exist
5. Mahakim via `CourtStatusProvider` (later phase)
6. Final AI report generation (later phase)
7. Enrich overview “recent timeline” from `/events` (partially via Historique tab)

## 7. Manual test checklist

**ADMIN**
- [ ] Sidebar: Tableau de bord, Terrains, Calendrier, Administration
- [ ] Terrains list shows principals (not R 16605 as 7th)
- [ ] Nouveau terrain → upload with category → review → create
- [ ] Affectation des terrains → assign USER → USER notified
- [ ] Terrain detail: add mise à jour in Historique
- [ ] Documents categories 01–08; USER upload still works on assigned terrain

**USER**
- [ ] Mes terrains only
- [ ] Calendrier only assigned terrains’ hearings
- [ ] Cannot create terrain / cannot change official status
- [ ] Unassigned terrain → 403 / forbidden

**Data**
- [ ] Past dates never listed as “prochaine date”
- [ ] R 20612 shows linked R 16605
- [ ] No Cloudinary secrets in UI

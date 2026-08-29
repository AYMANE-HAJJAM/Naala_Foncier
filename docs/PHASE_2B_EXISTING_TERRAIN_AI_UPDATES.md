# Phase 2B — AI-Assisted Updates for Existing Terrains

## Objective

When a new document is uploaded to an **existing** terrain, GitHub Models compares it against the current **human-validated** state and produces **reviewable proposals**. Nothing becomes official until an ADMIN confirms.

Workflow:

```
Existing terrain → document uploaded → AI analysis (async)
→ proposals + conflicts → ADMIN review → confirm/reject
→ official events / court cases / oppositions / snapshot / calendar / notifications
```

---

## Architecture (extends Phase 2A)

| Component | Role |
|-----------|------|
| `AIAnalysisRun` | Generalized with `contextType`: `TERRAIN_CREATION` \| `EXISTING_TERRAIN_UPDATE` |
| `AIExtraction` | One row per proposal (`extractionType`: `TERRAIN_UPDATE.*`) |
| `TerrainOfficialContextBuilder` | Structured current state for AI (no full DB dump) |
| `GitHubModelsTerrainUpdateAnalysisProvider` | Single-document compare + structured JSON |
| `TerrainUpdateAnalysisService` | Trigger after upload, async processing |
| `TerrainUpdateProposalService` | List / confirm / reject / resolve conflicts |
| `StatusSnapshotService.refreshFromEvents()` | Snapshot after confirmed events |

GitHub Models configuration unchanged from Phase 2A (`AI_PROVIDER=github-models`, `GITHUB_MODELS_TOKEN`, etc.).

---

## Analysis trigger

After `DocumentsService.completeUploadSession()` succeeds:

1. Document is stored immediately (upload never blocked by AI).
2. `TerrainUpdateAnalysisService.triggerAfterUpload()` creates an `AIAnalysisRun`.
3. Background job normalizes file (DOCX/PDF/image — same preparer as 2A).
4. Provider receives **new document + official context** only (not all historical files).
5. Results persisted as `AIExtraction` proposals or `NO_CHANGE`.

Fingerprint: `documentId|documentVersionId` — no re-analysis of unchanged version.

---

## Proposal types

`NEW_EVENT`, `NEW_HEARING`, `HEARING_POSTPONED`, `COURT_DECISION`, `NEW_COURT_CASE`, `NEW_OPPOSITION`, `BORNAGE_UPDATE`, `IDENTITY_CONFLICT`, `DOCUMENT_INFORMATION`, `NO_ACTION`, etc.

Stored in `AIExtraction.extractionType` as `TERRAIN_UPDATE.{TYPE}`.

Statuses: `PROPOSED` → `CONFIRMED` | `REJECTED` | `SUPERSEDED`.

---

## Confirmation (transactional)

`POST /requisitions/:id/ai-proposals/:proposalId/confirm`

Maps proposal type to domain actions:

| Type | Official effect |
|------|-----------------|
| `NEW_HEARING` / procedural | `TerrainEvent` (CONFIRMED, AI_PROPOSAL source) |
| `HEARING_POSTPONED` | Postponement event; prior scheduled event `isScheduled=false` |
| `NEW_COURT_CASE` | `LegalCase` + `COURT_CASE_CREATED` event |
| `NEW_OPPOSITION` | `Opposition` + `OPPOSITION_ADDED` event |
| `IDENTITY_CONFLICT` | Resolution: KEEP_CURRENT / USE_PROPOSED / MANUAL_VALUE |

Then: snapshot refresh, audit log, optional USER notification.

Idempotent: already-`CONFIRMED` proposals return current state.

---

## API endpoints

| Method | Path | Access |
|--------|------|--------|
| GET | `/requisitions/:id/ai-proposals` | ADMIN |
| GET | `/requisitions/:id/ai-proposals/:proposalId` | ADMIN |
| POST | `/requisitions/:id/ai-proposals/:proposalId/confirm` | ADMIN |
| POST | `/requisitions/:id/ai-proposals/:proposalId/reject` | ADMIN |
| POST | `/requisitions/:id/ai-proposals/:proposalId/resolve-conflict` | ADMIN |
| GET | `/requisitions/:id/documents/:documentId/analysis-status` | Assigned USER / ADMIN |
| POST | `/requisitions/:id/documents/:documentId/analyze` | ADMIN retry |
| GET | `/admin/ai-proposals/pending-count` | ADMIN |

---

## Permissions

- **USER**: upload on assigned terrains; see simplified analysis status; **cannot** review proposals.
- **ADMIN**: review queue, confirm/reject, retry failed analysis.
- Unassigned USER upload → 403 (existing `AccessScopeService`).

---

## Frontend

- **Terrain detail**: `TerrainUpdateProposalsPanel` (ADMIN only).
- **Dashboard**: card “Mises à jour à valider” when `pendingAiProposals > 0`.
- **USER upload**: “Document ajouté” + optional “Analyse en cours” / “Mise à jour en attente de validation”.

---

## Notifications

- **ADMIN**: grouped `AI_UPDATE_REVIEW` when proposals created (per analysis run).
- **USER** (assigned): `TERRAIN_UPDATE_CONFIRMED` after ADMIN confirms important updates.

---

## Migration

`20260812140000_phase2b_terrain_update_analysis`

- `AIAnalysisContextType` enum
- `AIAnalysisRunStatus.NO_CHANGE`
- Optional `draftId`; add `requisitionId`, `documentId`, `documentVersionId`
- `AIExtraction.analysisRunId`

Run: `npm run db:migrate:deploy` (or `prisma migrate dev` locally).

---

## Manual test checklist

1. ADMIN opens existing terrain (e.g. R 148026/31).
2. Upload Tribunal document → appears immediately.
3. Wait for analysis → “Mises à jour proposées” panel (ADMIN).
4. Confirm one proposal → Timeline / Calendar / Snapshot update.
5. Reject another → stays out of official data.
6. Login as assigned USER → no proposal controls; sees confirmed updates.
7. USER uploads document → ADMIN gets review notification.

---

## Limitations (Phase 2B)

- No Mahakim sync, no AI reports, no chatbot.
- Postponement calendar cancellation is best-effort via `scheduledAt` match.
- Low-confidence oppositions remain review-only.
- Orval client: manual helpers in `frontend/src/lib/api/phase1.ts` until OpenAPI regen.

---

## Phase 2C (not implemented)

- AI strategic / portfolio reports
- Scheduled court monitoring
- Mahakim integration
- RAG / chatbot

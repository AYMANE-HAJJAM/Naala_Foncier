# Phase 1 — Foundation audit

Date: 2026-08-11  
Scope: NAALA FONCIER domain model, APIs, UI navigation, import baseline.

## 1. What exists (reusable)

### Platform / infra
- Next.js frontend + NestJS backend + Neon PostgreSQL + Prisma
- OpenAPI (`/api/openapi.json`) + Orval client (`frontend/src/generated/api`)
- Auth (JWT, refresh, roles ADMIN / USER, permission guards)
- Cloudinary authenticated document storage (upload sessions → complete)
- Audit log model + service

### Domain already present
| Concern | Current model / module | Notes |
|--------|-------------------------|-------|
| Terrain aggregate | `Requisition` | Keep name internally; UI = Terrains / Mes terrains |
| Identity fields | reference, propertyName, location, surface*, seller, buyer | Solid |
| Linked dossiers | `RequisitionRelation` + `isPrincipal` | R 16605 linked to R 20612; not a 7th principal |
| Assignments | `UserRequisitionAccess` | Grant/revoke on `/requisitions/:id/access` |
| Documents | `Document` + `DocumentVersion` | Categories close to Phase 1 set |
| Court | `LegalCase` (+ `CourtStage`) | Maps to CourtCase conceptually |
| Calendar / hearings | `Hearing` + `/api/agenda` | Scoped by access |
| Oppositions | `Opposition` | Richer than Phase 1 minimum |
| Notifications | `Notification` + bell UI | Works |
| Reports | `Report` / `ReportVersion` | Preserve |
| AI jobs | `AIAnalysisJob`, `DocumentAnalysis`, `ExtractedFact` | No fake results; provider not wired |
| Status denormalization | Fields on `Requisition` (`currentSituation`, `latestKnownEvent*`, …) | Useful for cards; not a true event history |
| Terrain factual seeds | `terrain-summaries.ts` + seed | Six principals + R 16605 non-principal |

### Frontend already present
- Portfolio list (`/requisitions`), user list (`/mes-dossiers`)
- Detail page with overview / documents / judiciaire / rapports / historique
- Document upload dialog (category + Cloudinary)
- Agenda month view (admin-only today)
- Users page (assignment UI stubbed)

### Business sources
- `backend/private-import/IMPORT_REVIEW.md`
- `backend/private-import/extracted/import-manifest.json`
- Presentation 1 / 2 + strategic DOCX extracts
- Do not invent legal facts; do not auto-import uncertain tribunal links on R 148026

## 2. Gaps vs Phase 1 goals

| Goal | Gap |
|------|-----|
| Fixed identity vs evolving status | Status mixed into Requisition text fields; no relational event timeline |
| `TerrainEvent` | Missing — hearings alone are not enough |
| Current status snapshot | Denormalized strings only; no freshness enum CONFIRMED/TO_CONFIRM/… |
| Two-step terrain wizard | Create button is toast stub; upload requires existing requisitionId |
| Document categories | `ACTES_PROPRIETE` vs required `ACTES`; RAPPORTS/AUTRE exist (keep for reports) |
| Court multi-case + linked requisition | LegalCase exists; `linkedRequisitionId` missing |
| Oppositions tab | Model exists; tab not in detail nav |
| USER calendar | Agenda admin-only in shell |
| Administration nav | Flat “Utilisateurs”; no “Affectation des terrains” |
| Terminology | “Mes dossiers” / “Dossiers fonciers” still in nav |
| AI proposals separate from official data | ExtractedFact exists; no draft-wizard analysis + `AIExtraction` boundary |
| Mahakim | Not present (correct for Phase 1) — need provider interface only |

## 3. Dangerous duplication

1. **Status story in three places**: `Requisition.currentSituation` / `latestKnownEvent*` / `Hearing` / future `TerrainEvent` — must designate events as source of truth and refresh snapshot from validated events.
2. **Court events**: `Hearing` vs judicial `TerrainEvent` — keep `Hearing` as scheduled calendar items; mirror important ones into `TerrainEvent` or derive timeline from both with clear mapping (no second free-text court history).
3. **Document categories**: UI keys vs Prisma enum vs free-text `Document.category` display strings in presenter.
4. **Hard-coded six terrains in UI sort** (`PRINCIPAL_ORDER`) — OK as display preference, not as domain limit; creation must work for new references.
5. **Portfolio vs mes-dossiers vs portefeuille redirects** — consolidate labels; keep routes with redirects.

## 4. What should be removed (UI only; do not delete data)

- Sidebar label “Mes dossiers” → “Mes terrains”
- Sidebar “Dossiers fonciers” → “Terrains”
- Fake progress / simulated create toasts for terrain & agenda create (replace with real flows)
- USER-facing AI confidence clutter
- Do **not** delete: auth, Cloudinary, OpenAPI, six principals, R 16605 link, reports, documents, assignments

## 5. What should be migrated

1. Additive Prisma migration for `TerrainEvent`, `RequisitionStatusSnapshot`, `AIExtraction`, `TerrainDraft` (+ draft documents), `LegalCase.linkedRequisitionId`, enum extensions (`ACTES`, event types, data freshness).
2. Data backfill: create validated `TerrainEvent` rows from `terrain-summaries` + existing `Hearing` / `LegalCase` (idempotent; do not overwrite newer manual DB facts).
3. Refresh `RequisitionStatusSnapshot` (and sync card fields on `Requisition`) from validated events.
4. Map `ACTES_PROPRIETE` → `ACTES` in documents (keep old enum value temporarily for safety).
5. Ensure R 16605 remains `isPrincipal=false` and linked relation to R 20612.

## 6. Migration plan (implementation order)

1. Document this audit.
2. Additive schema + SQL migration (no destructive drops).
3. Backend modules: `events`, terrain draft/wizard, status snapshot service, AI provider interface, court provider stub.
4. Seed/backfill script for existing six terrains.
5. Regenerate Orval client.
6. Frontend: nav, list cards, wizard, calendar for both roles, administration/assignments, detail tabs.
7. Verify builds/tests; write `PHASE_1_DATA_MIGRATION.md` + `PHASE_1_IMPLEMENTATION.md`.

## 7. Explicit non-goals (this phase)

- Mahakim scraping / browser automation
- Final AI report generation
- Fake AI analysis when no provider credentials
- DEV role (unless trivial — skipped)
- Deleting or recreating the six principal terrains

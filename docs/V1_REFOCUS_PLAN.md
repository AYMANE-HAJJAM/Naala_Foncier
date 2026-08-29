# NAALA FONCIER — V1 Refocus Plan

**Date:** 2026-07-24  
**Status:** Implementation in progress  
**Source documents:** `Présentation1.pptx`, `présentation 2.pptx`, `Rapport_2 synthese_strategique_…docx` were **not found** under the project, Documents, Desktop or Downloads at planning time. Seed data + product spec used as factual baseline. Unknowns stay « À confirmer » / « Non renseigné » / « Document non communiqué ».

---

## 1. Existing problems

### Product / UX
- Sidebar has 11 entries (oppositions, contentieux, actions, AI, rapports, paramètres…) — too wide for V1.
- Same dashboard for ADMIN and USER; KPIs partly hardcoded.
- Requisition detail has 9 tabs including topography, AI, actions kanban, strategic report simulation.
- Global `/documents` is demo (toasts); real upload only exists inside a dossier.
- Documents shown as flat lists; category cards use fake counts.
- `isReadOnlyUser()` treats every non-ADMIN as unable to upload — conflicts with V1 (USER may upload).
- Past hearing dates (08/07, 15/07, 22/07 2026) still presentable as upcoming.

### Backend
- USER lacks `document.upload`.
- No `PARTAGE` / `INTERNE` visibility ACL (only `DocumentConfidentiality`).
- Judicial model = `LegalCase` + `Hearing` (usable) but not shaped as CourtCase/CourtEvent with stages/events required by V1.
- Reports = JSON versions + validation workflow, not ADMIN file upload.
- Notifications = in-app only; no SMTP, no reminders, no `@nestjs/schedule`.
- Hearing create notifies **all** active users (too noisy).

### Data
- Neon must not be reset; migrations additive only.
- Obsolete demo users already deactivated by prior seed; keep idempotent.

---

## 2. Final routes

| Route | Who | Purpose |
|-------|-----|---------|
| `/login` | public | Auth |
| `/forbidden` | auth | 403 |
| `/` | both | ADMIN operational dashboard / USER « Mes dossiers » |
| `/requisitions` | both | Dossier list (ADMIN all / USER assigned). Alias redirect from `/portefeuille` |
| `/requisitions/[id]` | both | Detail — 5 tabs |
| `/agenda` | ADMIN | Agenda judiciaire |
| `/utilisateurs` | ADMIN | Users + assignments |
| `/notifications` | both | In-app notifications |
| `/profil` | USER (+ ADMIN ok) | Profile |

**Hidden / redirected (models kept):** `/oppositions`, `/contentieux`, `/actions`, `/analyses-ai`, `/rapports`, `/parametres`, `/documents` → redirect to `/` or `/requisitions`.

---

## 3. Final role permissions

### ADMIN
Full platform: users, requisitions CRUD, assignments, all dossiers, court cases/events, document metadata + delete + visibility, report upload, notifications trigger, agenda, audit.

### USER
- Login / profile
- View assigned requisitions only (403 otherwise)
- View/download PARTAGE documents on assigned dossiers
- **Upload** documents (default PARTAGE) to assigned dossiers
- View court timeline (read-only)
- View shared reports
- Notifications (in-app + email when SMTP configured)

### USER cannot
Create/edit requisition identity, manage users, modify court history, upload reports (category RAPPORTS / report endpoints), delete others’ docs, see INTERNE docs, administration pages.

**Permission keys (seed):**
- USER: `requisition.view`, `document.view`, `document.upload`, `legalCase.view`, `report.view` (+ hearing read via `requisition.view`)
- Remove from USER UI reliance on opposition/action/AI permissions (keep DB for later).

---

## 4. Database changes (additive)

| Change | Approach |
|--------|----------|
| Document visibility | Add `DocumentVisibility` enum `PARTAGE` \| `INTERNE`; field `visibility` default `PARTAGE` |
| Document date | Add optional `documentDate` |
| Court stages | Extend `LegalCase` with `courtCity`, `registrationDate`, `currentStage`, `generalObservation`, optional Mahakim fields |
| Court events | Extend `Hearing` with `nextAction`, `nextDate`, `visibility`, `createdById`; treat as CourtEvent in API |
| Report file | Add `ReportScope` (`REQUISITION` \| `PORTFOLIO`), `documentId?`, `reportDate?`, `description?`; keep JSON version optional for legacy |
| NotificationReminder | New model: userId, requisitionId?, courtEventId?, kind, dueAt, sentAt?, dedupeKey unique |
| Indexes | requisitionId+category, nextEventAt, eventDate, visibility, dedupeKey |

**Not deleted:** Opposition, ActionItem, AIAnalysis*, old ReportVersion validation fields (unused in V1 UI).

---

## 5. API changes

- Normalize aliases: `/requisitions/:id/court-cases`, `/court-cases/:id/events` (wrap LegalCase/Hearing).
- Document list filters visibility for USER (hide INTERNE).
- Grant USER `document.upload`; block RAPPORTS category for USER.
- Report POST creates Document in RAPPORTS + Report row; USER cannot POST.
- Notifications: create on court event / hearing change / ADMIN doc upload / USER doc upload (to ADMIN).
- MailService + env SMTP_*; schedule reminders 7/3/1/0 days (Africa/Casablanca).
- Agenda: mark past events without follow-up as overdue for ADMIN.

Orval regenerate after OpenAPI updates.

---

## 6. Pages to remove from V1 UX

| Page / tab | Action |
|------------|--------|
| Oppositions global + tab | Hide / redirect |
| Contentieux global | Hide (judicial moves into dossier tab) |
| Actions kanban | Hide |
| Analyses IA | Hide |
| Paramètres | Hide |
| Global documents registry | Redirect |
| Permissions matrix | Remove from users page |
| Topographie / AI / Actions / Strategic report tabs | Remove from detail |
| Dashboard charts / fake KPIs | Replace |

---

## 7. Pages to redesign

1. App shell nav (ADMIN 5 / USER 3)
2. ADMIN dashboard (priorities, agenda, recent docs, activity)
3. USER dashboard (Mes dossiers cards)
4. Requisitions list (`/requisitions`)
5. Requisition detail (5 tabs: Overview, Documents folders, Judicial, Reports, History)
6. Documents category → filtered list + upload
7. Agenda
8. Users (assign requisitions)
9. Notifications
10. Profile

Visual system: navy / stone / slate / sand-gold; compact tables; no neon/glass.

---

## 8. Data migration risks

- Additive migrations only — no Neon reset.
- Existing documents default `visibility = PARTAGE` (or INTERNE if already confidential — map `INTERNE` confidentiality → INTERNE visibility).
- Existing LegalCase/Hearing rows remain; new fields nullable then backfilled by careful seed upserts only for empty fields.
- Do not overwrite manually edited production rows in seed.
- Past dates in seed: keep as historical events with status « Date passée / compte rendu à renseigner ».

---

## 9. Test plan

**API:** ADMIN all dossiers; USER 2 assigned; 403 unassigned; USER upload assigned OK / unassigned 403; USER report upload 403; ADMIN report OK; category isolation; court event → notification; reminder dedupe; overdue alert.

**UI:** Role nav; dashboards; folder documents; court timeline read-only for USER; agenda overdue labels; smoke list in §22 of brief.

**Builds:** prisma generate/migrate, backend build/test, frontend Orval + build.

---

## 10. Implementation order (tracked)

1. Permissions + assignment checks (USER upload)
2. Requisition list + detail shell (5 tabs)
3. Document organization + upload
4. Court case/event tracking
5. Judicial agenda
6. In-app notifications
7. SMTP reminders
8. Report upload
9. Dashboard redesign (ADMIN/USER)
10. Remove obsolete V1 UI
11. UX polish
12. Tests and builds

---

## 11. Principal portfolio (from prior seed / brief)

- R 20657/31 — LROUIA LKBIRA  
- R 20629/31 — ENRALA 2  
- R 20696/31 — FEM ENTEL  
- R 20611/31 — ENAALA  
- R 20612/31 — ENAALA 1  
- R 148026/31 — AL MOUSTAKBEL / AMI ANTEL  
- Linked: R 16605/31  

Court refs: 2025/1403/237, 2024/1403/79, 2025/1403/238, 2025/1403/249, 2025/1403/250

# NAALA FONCIER — UI Redesign Plan (2026)

Temporary implementation document for the frontend visual and UX redesign. Business logic, APIs, auth, Neon, and Cloudinary remain unchanged.

---

## 1. Color tokens

| Token | Value | Usage |
|-------|-------|--------|
| `--ink` / `--navy-950` | `#0B1728` | Sidebar, primary actions, strong headings |
| `--navy-900` | `#132238` | Hover / elevated ink |
| `--navy-800` | `#1A2F45` | Active nav surface |
| `--canvas` | `#F5F4F0` | App background (warm stone) |
| `--surface` | `#FFFFFF` | Primary content surfaces |
| `--surface-muted` | `#F8F8F6` | Secondary grouping |
| `--border` | `#E6E4DE` | Subtle borders / dividers |
| `--text` | `#1C2430` | Primary text (deep slate) |
| `--text-muted` | `#5C6570` | Secondary text |
| `--text-faint` | `#8A929C` | Metadata labels |
| `--accent` | `#A8894A` | Selected nav, rare emphasis (muted bronze/sand) |
| `--accent-soft` | `#F3EEE3` | Soft accent wash |
| `--success` | `#1B7A55` | Completed / stable |
| `--warning` | `#B56A12` | Pending / overdue follow-up |
| `--critical` | `#B83A3A` | Critical / overdue only |
| `--info` | `#2F5F8A` | Informational |

No large gradients, glassmorphism, neon, or colorful icon chips.

---

## 2. Typography scale

Font: **Source Sans 3** (`next/font/google`) — professional institutional sans.

| Role | Size | Weight | Line-height |
|------|------|--------|-------------|
| Page title | 28–30px | 600 | 1.25 |
| Requisition title | 26–28px | 600 | 1.25 |
| Section title | 17–18px | 600 | 1.3 |
| Card / list title | 14–15px | 600 | 1.35 |
| Body | 14–15px | 400 | 1.5 |
| Metadata | 12–13px | 400–500 | 1.4 |
| Table | 13–14px | 400 | 1.4 |

Sentence case. Strong weight contrast. Avoid uppercase-everywhere labels.

---

## 3. Spacing scale (8px)

| Token | Value | Use |
|-------|-------|-----|
| `1` | 8px | Tight gaps |
| `2` | 16px | Standard gap |
| `3` | 24px | Large gap / card padding |
| `4` | 32px | Section spacing |
| Page pad | 28–36px | Desktop main horizontal |
| Shell topbar | 64–68px | Compact header |
| Sidebar | 232px / 72px | Expanded / collapsed |

Max content width: `max-w-[1280px]` on large screens where useful.

---

## 4. Layout grid

```
┌──────────┬────────────────────────────────────┐
│ Sidebar  │ TopBar (context · search · notifs) │
│ 232px    ├────────────────────────────────────┤
│ navy     │ Main (canvas) · max ~1280px        │
│          │                                    │
└──────────┴────────────────────────────────────┘
```

Surfaces only when grouping helps. Prefer spacing + hairline dividers over nested cards.

---

## 5. Component list

| Component | Purpose |
|-----------|---------|
| `AppShell` | Auth gate, shell chrome |
| `Sidebar` | Role nav, account footer |
| `TopBar` | Page context, search, notifications, user |
| `PageHeader` | Title + actions (no redundant eyebrow spam) |
| `SectionHeader` | Section title + optional action |
| `StatusBadge` | Restrained status chip |
| `EmptyState` | Compact empty |
| `DataList` / `DefinitionList` | Label–value facts |
| `CompactTable` | Shared table chrome |
| `DocumentCategoryCard` | Folder category tile |
| `DocumentRow` | File list row |
| `CourtTimeline` | Judicial timeline |
| `MetricItem` | Compact KPI |
| `NotificationItem` | Inbox row |
| `ConfirmDialog` / `DrawerForm` | Dialog primitives (existing Dialog) |

---

## 6. Route redesign list

| Route | Role | Redesign focus |
|-------|------|----------------|
| `/login` | Public | Calm institutional auth |
| `/` | ADMIN | Compact metrics + agenda + priorities |
| `/` | USER | Mes dossiers list + dates / docs |
| `/requisitions` | ADMIN | Clean portfolio table |
| `/requisitions/[id]` | Both | Context header, identity strip, underline tabs |
| `?tab=overview` | Both | Situation actuelle, no fake dashboards |
| `?tab=documents` | Both | Category cards → file table |
| `?tab=judiciaire` | Both | Summary + timeline |
| `?tab=rapports` | Both | Report list |
| `?tab=historique` | Both | Activity list |
| `/agenda` | ADMIN | Calendar / list polish |
| `/utilisateurs` | ADMIN | Table only (no permissions matrix) |
| `/notifications` | Both | Grouped inbox |
| `/profil` | USER | Simple profile |
| `/forbidden` | Public | Minimal |

Redirect stubs left as-is.

---

## 7. Components to remove / deprecate visually

- Oversized KPI cards with icon circles
- Dark pill tabs on requisition detail
- Permissions matrix tab on Users
- Decorative topbar date
- Large role / consultation badges in chrome
- Nested card-in-card patterns
- Fake progress / percentage panels (leave unused Progress for upload only)
- Marketing-style login claim list where possible

---

## 8. Components to refactor

- `app-shell.tsx` → cleaner sidebar + topbar
- `core.tsx` → quieter Card / Badge / EmptyState
- `page.tsx` → PageHeader / Breadcrumbs / SectionHeader
- `dashboard-page.tsx` → MetricItem density
- `requisition-detail-page.tsx` → header + underline tabs
- `overview-tab.tsx` / `judicial-tab.tsx` / Documents UI
- `operations.tsx` UsersPage → table
- `notifications/page.tsx` → date groups
- `login/page.tsx` → restrained institutional

---

## 9. Implementation order

1. Tokens + font + core primitives  
2. Shell (Sidebar / TopBar)  
3. Shared page chrome  
4. Dashboard / portfolio / users / notifications / profil / login  
5. Requisition detail + tabs  
6. Quality pass (build, consistency)

---

## 10. Non-goals

- Backend / Prisma / Neon changes  
- New fake metrics or charts  
- Rewriting Orval hooks  
- Changing ADMIN / USER permission model  

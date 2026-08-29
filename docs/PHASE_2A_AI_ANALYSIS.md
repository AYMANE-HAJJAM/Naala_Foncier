# Phase 2A — Real AI Document Analysis (Nouveau terrain)

## Status

Phase 2A implements **real, provider-backed structured extraction** for the ADMIN terrain-creation wizard.

Core principle:

**Documents → AI proposals → ADMIN review → confirmed official data only.**

AI output never becomes official terrain / court / opposition data without explicit human confirmation.

---

## Existing AI architecture (reused)

| Piece | Role |
|-------|------|
| `DocumentAnalysisProvider` | Provider-agnostic interface |
| `UnconfiguredDocumentAnalysisProvider` | Safe fallback when credentials missing |
| `AIExtraction` | Persist proposal payloads separately from official data |
| `TerrainDraft.proposedIdentityJson` / `proposedProceduralJson` | Wizard prefill store |
| `StorageService.fetchObjectBytes` | Authenticated Cloudinary download (private files) |
| `TerrainEventSource.AI_PROPOSAL` | Event provenance for later confirmation |

**Not reused for wizard runs:** `AIAnalysisJob` (post-creation requisition jobs). Wizard uses dedicated `AIAnalysisRun` scoped to `TerrainDraft`.

---

## Implementation strategy

1. Normalize draft documents server-side (DOCX text, PDF page text, scanned PDF page images, image multimodal).
2. Start an `AIAnalysisRun` (`PENDING` → `PROCESSING` → `COMPLETED` / `FAILED`).
3. Two-stage analysis via GitHub Models behind `DocumentAnalysisProvider`:
   - **Stage 1:** per-document factual extraction (structured facts + sources)
   - **Stage 2:** cross-document synthesis (matches, contradictions, missing info, identity, courts, events, oppositions)
4. Validate provider JSON with Zod (`AI_INVALID_RESPONSE` on failure; one repair retry).
5. Persist full result on the run + `AIExtraction` rows + draft JSON columns.
6. Frontend polls analysis status, then opens Step 2 with proposals, sources, conflicts.
7. Confirm persists only ADMIN-approved identity / court / events / oppositions.

Fingerprint of draft documents avoids re-running analysis when nothing changed.

---

## Provider integration (GitHub Models only in Phase 2A)

| Env | Purpose |
|-----|---------|
| `AI_PROVIDER` | `github-models` |
| `AI_MODEL` | Model id (default `openai/gpt-4.1`) |
| `GITHUB_MODELS_TOKEN` | GitHub PAT with models access (backend-only, never committed) |
| `GITHUB_MODELS_BASE_URL` | `https://models.github.ai/inference` |

The token must **never** appear in:

- Next.js public env vars
- frontend API responses
- browser requests
- logs

If missing / unknown provider:

- code `AI_PROVIDER_NOT_CONFIGURED`
- no fake facts
- “Continuer sans analyse automatique” remains usable

HTTP 429 from GitHub Models:

- code `AI_PROVIDER_RATE_LIMIT`
- message: *Limite temporaire du service d'analyse atteinte. Réessayez plus tard ou continuez sans analyse automatique.*

GitHub Models path:

- Chat completions: `POST {GITHUB_MODELS_BASE_URL}/chat/completions`
- DOCX → server-side text via `mammoth`
- Text PDF → page-boundary text via `pdfjs-dist`
- Scanned PDF → temporary page PNG renders via `pdf-to-img` (not persisted to Cloudinary)
- JPG/PNG → multimodal image input
- strict JSON + Zod runtime validation
- one optional correction retry on schema failure (no aggressive auto-retries)

`GitHubModelsDocumentAnalysisProvider` sits behind `DocumentAnalysisProvider`. OpenAI/Azure can replace it later without changing the terrain workflow.

---

## Key backend files

| File | Role |
|------|------|
| `document-analysis.provider.ts` | Interface, Zod schemas, fingerprint |
| `github-models.client.ts` | HTTP client (fetch, no token logging) |
| `github-models-document-analysis.provider.ts` | Two-stage GitHub Models extraction |
| `document-input.preparer.ts` | DOCX/PDF/image normalization |
| `terrain-draft-analysis.service.ts` | Async runs, reuse, persistence |
| `providers.ts` | Routes `github-models` → provider or unconfigured |

---

## Acceptance test (manual)

Recommended dossier: **R 148026/31 — AL MOUSTAKBEL / AMI ANTEL**

1. Set env:

```env
AI_PROVIDER=github-models
AI_MODEL=openai/gpt-4.1
GITHUB_MODELS_TOKEN=<your-token>
GITHUB_MODELS_BASE_URL=https://models.github.ai/inference
```

2. Restart Nest backend.
3. Nouveau terrain wizard → upload source documents for the dossier.
4. Run analysis → Step 2 should propose (when supported by sources): requisition reference, property name, location, surface, seller, buyer, bornage info, known dates.
5. Compare proposals against source documents (do not hard-code expected values in app logic).

---

## Out of scope (Phase 2A)

- Mahakim / court sync
- AI reports on existing terrains
- Existing-terrain monitoring
- Chatbot
- Automatic legal advice

---

## Manual verification checklist

Set `AI_PROVIDER=github-models` + `GITHUB_MODELS_TOKEN`, restart Nest, create terrain with multi-category docs, analyse, review conflicts/courts, confirm, verify official data only.

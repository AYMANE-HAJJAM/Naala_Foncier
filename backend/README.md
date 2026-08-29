# NAALA FONCIER — Backend

NestJS API with Prisma / PostgreSQL (Neon), JWT auth, and private document storage.

## Setup

```bash
cp .env.example .env
# Fill DATABASE_URL, DIRECT_URL, JWT secrets, INITIAL_ADMIN_PASSWORD
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:seed
```

## Run

```bash
npm run start:dev
```

- API: http://localhost:3001/api
- OpenAPI JSON: http://localhost:3001/api/openapi.json
- Swagger UI: http://localhost:3001/api/docs

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Watch mode |
| `npm run build` | Production build |
| `npm run test` | Unit tests |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate:deploy` | Apply migrations |
| `npm run prisma:seed` | Seed development data |

`DATABASE_URL` is used at runtime (Neon pooled URL). `DIRECT_URL` is used by Prisma migrations (Neon direct URL without `-pooler`).

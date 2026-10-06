# NAALA FONCIER — Backend

NestJS API with Prisma / PostgreSQL (Neon), JWT auth, and private document storage.

## Setup

```bash
cp .env.example .env
# Fill DATABASE_URL, DIRECT_URL and JWT secrets
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
- Health: http://localhost:3001/api/health
- OpenAPI JSON and Swagger UI are available only with `SWAGGER_ENABLED=true`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Watch mode |
| `npm run build` | Production build |
| `npm run test` | Unit tests |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate:deploy` | Apply migrations |
| `npm run prisma:seed` | Seed roles and permissions only |
| `npm run admin:setup` | Configure the sole active admin from PRIMARY_ADMIN_EMAIL / PRIMARY_ADMIN_PASSWORD; audit and clean other accounts |

`DATABASE_URL` is used at runtime (Neon pooled URL). `DIRECT_URL` is used by Prisma migrations (Neon direct URL without `-pooler`).

Production start: `npm start`. Render build, migration strategy, cookies and the complete env list: [deployment guide](../docs/RENDER_DEPLOYMENT.md). Node 24 is required. PRIMARY_ADMIN variables are only used by the explicit setup command. Read [admin cleanup and rotation](../docs/PRIMARY_ADMIN_CLEANUP.md) before running it; it disables other accounts and revokes all sessions. Never run it automatically on API startup.

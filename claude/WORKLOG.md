# Vera — Work Log

---

## 2026-04-10
### Entry #2 — Phase 2: Database & Prisma Setup

Installed Prisma v6, wrote the full schema, ran the migration, seeded demo data, and verified with 17 passing tests.

**What was done:**
- Installed `prisma` + `@prisma/client` (v6) in `packages/server`
- Ran `prisma init` — produces `prisma/schema.prisma` + `prisma.config.ts` (v6 format)
- Wrote full schema: `Physician`, `Patient`, `Session`, `Transcript`, `SoapNote`, `AuditEvent` + `SessionStatus` and `WorkflowStatus` enums
- Ran `prisma migrate dev --name initial-schema` — all tables created in local `vera` PostgreSQL database
- Client generated to `src/generated/prisma/` (Prisma v6 output path)
- Seed script creates: 1 physician (Dr. Sarah Smith, MD), 3 patients (James Okafor, Maria Chen, Robert Patel)
- Seed config moved to `prisma.config.ts` (v6 — `package.json#prisma` is deprecated)
- Created `src/lib/prisma.ts` — singleton PrismaClient

**Tests (`src/__tests__/database.test.ts`):**
- 16 integration tests across all 6 models + relationships
- Covers: creation, unique constraints, enum transitions, one-to-one enforcement, nested includes, multi-session physician
- All 17 tests pass (16 DB + 1 health)

**Prisma v6 notes:**
- Generator: `prisma-client` (not `prisma-client-js`)
- Output: `src/generated/prisma/client.ts` (import from `../generated/prisma/client`)
- Seed command: `prisma.config.ts` `seed.run` field (not `package.json#prisma`)
- Seed scripts need `import "dotenv/config"` — CLI config doesn't propagate env to ts-node

**Key files:**
- `packages/server/prisma/schema.prisma`
- `packages/server/prisma/seed.ts`
- `packages/server/prisma.config.ts`
- `packages/server/src/lib/prisma.ts`
- `packages/server/src/__tests__/database.test.ts`
- `packages/server/src/generated/prisma/` (generated — gitignored)

---

## 2026-04-10
### Entry #1 — Phase 1: Project Scaffolding

Set up full monorepo with npm workspaces and verified both servers run.

**Backend (`packages/server`):**
- Node.js + Express + TypeScript with `ts-node-dev` hot reload
- Strict `tsconfig.json`
- `GET /api/health` → `{ status: "ok", timestamp: <ISO> }`
- Basic Express 404 + global error handler
- Vitest + Supertest health endpoint test (passing)

**Frontend (`packages/web`):**
- React 18 + TypeScript + Vite
- Tailwind CSS with CSS variables (shadcn/ui theme tokens)
- `components.json` for shadcn/ui CLI (ready for component generation)
- `lib/utils.ts` with `cn()` helper
- Landing page: "Vera" / "Where medical documentation meets trust"

**Root:**
- `package.json` with npm workspaces (`packages/*`)
- `npm run dev` via `concurrently` starts both servers
- `.env.example` with all required env vars

**Key files:**
- `package.json` — workspace root + dev script
- `packages/server/src/index.ts` — Express app (exported for testing)
- `packages/server/src/__tests__/health.test.ts` — health test
- `packages/server/tsconfig.json`
- `packages/web/src/pages/LandingPage.tsx`
- `packages/web/tailwind.config.ts`, `postcss.config.js`, `components.json`
- `.env.example`

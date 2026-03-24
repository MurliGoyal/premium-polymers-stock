# Premium Polymers Command Decision Tree

Use this file whenever you are about to run update/deploy commands.

## 1) Quick Decision Tree

```text
Start
 |
 |-- Did you change prisma/schema.prisma?
 |      |
 |      |-- Yes -> Run Prisma generate + schema apply (+ optional seed)
 |      |
 |      |-- No
 |
 |-- Did you change prisma/seed.ts?
 |      |
 |      |-- Yes -> Run Prisma generate + seed
 |      |
 |      |-- No
 |
 |-- Did you add/edit prisma/migrations/* ?
 |      |
 |      |-- Yes -> Local: generate + apply. Server: migrate deploy
 |      |
 |      |-- No
 |
 |-- Only changed UI/app logic/docs?
        |
        |-- Yes -> No Prisma commands needed
```

## 2) Local Commands (Windows / dev machine)

### A. Only app code changes (no Prisma changes)

```bash
pnpm install
pnpm dev
```

### B. prisma/schema.prisma changed

```bash
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

Notes:
- If you do not want demo data refreshed, skip `pnpm db:seed`.
- `pnpm db:push` updates local schema quickly for development.

### C. prisma/seed.ts changed (schema unchanged)

```bash
pnpm db:generate
pnpm db:seed
```

### D. Added/changed migration files in prisma/migrations

```bash
pnpm db:generate
pnpm db:push
pnpm db:seed
```

Notes:
- For local dev in this project, `db:push` is acceptable.
- Production server should use `migrate deploy` (see below).

## 3) Oracle Server Commands (production-like)

Always run from project folder on server.

```bash
cd ~/Premiumpolymers
```

### A. Normal update (safe default)

```bash
git pull --ff-only
docker compose build app
docker compose up -d
docker compose run --rm app prisma migrate deploy
```

### B. If seed updates are needed too

```bash
docker compose run --rm app tsx prisma/seed.ts
```

### C. Verify app + DB + migrations

```bash
docker compose ps
docker compose exec -T postgres psql -U premium_polymers -d premium_polymers -c "select email, role from users order by email;"
docker compose exec -T postgres psql -U premium_polymers -d premium_polymers -c "select migration_name, finished_at from _prisma_migrations order by finished_at desc;"
```

## 4) When You Must NOT Skip Prisma Commands

Run Prisma commands if ANY of these changed:
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `prisma/migrations/*`
- Role/enum/model fields used by auth or actions

If none of the above changed, Prisma commands are usually unnecessary.

## 5) Data Safety Rules

These can cause data loss if used carelessly:
- `docker compose down -v`
- deleting DB volumes manually
- destructive SQL/delete scripts

These do NOT delete data by themselves:
- `docker compose build`
- `docker compose up -d`
- `prisma migrate deploy`

## 6) Common Mistakes to Avoid

1. Running `tsx` without file path.
- Wrong:
```bash
docker compose run --rm app tsx
```
- Correct:
```bash
docker compose run --rm app tsx prisma/seed.ts
```

2. Editing tracked files on server and then `git pull --ff-only` fails.
- If pull fails due to local edits, inspect first:
```bash
git status
```

3. Assuming `docker compose build` applies DB changes.
- Build only creates image. DB schema/data steps are separate.

## 7) One-Liner Cheat Sheet

- UI-only change: `pnpm dev`
- Schema change local: `pnpm db:generate && pnpm db:push && pnpm db:seed`
- Server deploy: `git pull --ff-only && docker compose build app && docker compose up -d && docker compose run --rm app prisma migrate deploy`
- Seed on server when needed: `docker compose run --rm app tsx prisma/seed.ts`

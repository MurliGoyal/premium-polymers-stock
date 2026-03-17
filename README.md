# Premium Polymers Stock Management

Premium stock and raw-material management for small operations teams, built as a polished internal SaaS-style app on Next.js, Prisma, and PostgreSQL.

## Highlights

- Warehouse-scoped raw material management for exactly two seeded warehouses: `E-219` and `F-12`
- Premium dashboard with KPIs, charts, alerts, recent activity, and mobile chart selection
- Validated raw-material creation with category master data and optional dimensional metadata
- Mobile-first responsive shell with tablet rail, mobile sheets, and premium icon treatment
- Secure transfer workflow with stock deduction, recipient reuse, and audit snapshots
- Separate transfer history and raw-material activity history ledgers
- Credentials auth with RBAC foundation for Admin, Manager, Operator, and Viewer
- PostgreSQL-backed persistence with transactional inventory updates, typed notification APIs, and audit logs
- Production hardening for env validation, notification failure handling, and security headers

## Tech Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS
- shadcn-style UI primitives
- Prisma ORM
- PostgreSQL
- NextAuth credentials auth
- Zod + react-hook-form
- Framer Motion
- Recharts

## Production Readiness

This repo is now set up for production-oriented deployment and verification:

- fail-fast required env validation for `DATABASE_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL`
- production metadata base URL handling
- security headers via `next.config.ts`
- notification API error contracts and safer client handling
- Docker assets included:
  - [Dockerfile](./Dockerfile)
  - [.dockerignore](./.dockerignore)
  - [docker-compose.example.yml](./docker-compose.example.yml)
  - [.env.production.example](./.env.production.example)

Before any public deployment:

- replace demo credentials in `prisma/seed.ts` or rotate them immediately after seeding
- set strong production secrets
- verify HTTPS and reverse proxy config
- back up the database before any schema push on non-empty environments

## Deployment

- Detailed Oracle Cloud VM guide: [ORACLE_SERVER_DEPLOYMENT_GUIDE.md](./ORACLE_SERVER_DEPLOYMENT_GUIDE.md)
- Recommended deployment style:
  - Git-based updates with `git pull`
  - Docker Compose for isolation
  - Nginx reverse proxy on a separate subdomain
  - WinSCP for server file access, env editing, and backup downloads

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL 14+ recommended

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Create a `.env` file from `.env.example` and update the values for your machine.

```bash
# macOS / Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Required variables:

- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_SECRET`: long random secret for session signing
- `NEXTAUTH_URL`: app URL, usually `http://localhost:3000` in development
- `NEXT_PUBLIC_APP_LOCALE`: optional locale override, defaults to `en-IN`
- `NEXT_PUBLIC_APP_TIME_ZONE`: optional timezone override, defaults to `Asia/Kolkata`

To generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Generate the Prisma client

```bash
pnpm db:generate
```

### 4. Push the schema and seed sample data

```bash
pnpm db:push
pnpm db:seed
```

### 5. Start the app

```bash
pnpm dev
```

Open `http://localhost:3000`.

## Seeded Demo Users

The seed script creates sample users for local development:

- Admin: `admin@premiumpolymers.com` / `admin123`
- Manager: `manager@premiumpolymers.com` / `admin123`
- Operator: `operator@premiumpolymers.com` / `admin123`
- Viewer: `viewer@premiumpolymers.com` / `admin123`

These credentials are for local seeded data only. Change them before any shared deployment.

## Available Scripts

- `pnpm dev`: start the development server
- `pnpm build`: create a production build
- `pnpm start`: run the production server
- `pnpm lint`: run ESLint
- `pnpm check`: run the same verification used for GitHub readiness
- `pnpm db:generate`: generate the Prisma client
- `pnpm db:push`: sync the Prisma schema to PostgreSQL
- `pnpm db:seed`: seed demo data

## Docker Assets

This repository now includes production-oriented Docker starter files:

- [Dockerfile](./Dockerfile)
- [.dockerignore](./.dockerignore)
- [docker-compose.example.yml](./docker-compose.example.yml)
- [.env.production.example](./.env.production.example)

Typical usage:

1. copy `docker-compose.example.yml` to `docker-compose.yml`
2. copy `.env.production.example` to `.env.production`
3. update secrets, domain, and database credentials
4. build and run with Docker Compose

## Project Structure

```text
prisma/
  schema.prisma
  seed.ts
src/
  app/
    (app)/
    (auth)/
    api/
  components/
  lib/
  types/
```

## Product Architecture Summary

- Frontend: server-rendered Next.js App Router with premium internal-tool UX patterns
- Backend: protected server actions and API routes for inventory, history, and notification flows
- Data model: warehouses, categories, recipients, raw materials, transfers, stock transactions, activity logs, notifications, and users
- Integrity model: stock changes run through server-side validation and Prisma transactions
- Access model: UI and backend permission checks share the same RBAC foundation

## Data Model Reference

- Prisma schema: [prisma/schema.prisma](./prisma/schema.prisma)
- Seed script: [prisma/seed.ts](./prisma/seed.ts)

Core models:

- `User`
- `Warehouse`
- `Category`
- `Recipient`
- `RawMaterial`
- `Transfer`
- `RawMaterialActivityLog`
- `StockTransaction`
- `Notification`

## Routes

- `/login`
- `/dashboard`
- `/warehouses`
- `/warehouses/[code]`
- `/warehouses/[code]/raw-materials/add`
- `/warehouses/[code]/transfer`
- `/transfer-history`
- `/raw-materials-history`
- `/settings/categories`
- `/settings/recipients`
- `/settings/users`

## GitHub Readiness

This repository includes:

- `.env.example` for safe environment setup
- `.env.production.example` for production Docker setup
- `.gitignore` coverage for local runtime artifacts and secrets
- GitHub Actions CI at `.github/workflows/ci.yml`

The CI workflow runs:

- `pnpm install --frozen-lockfile`
- `pnpm db:generate`
- `pnpm lint`
- `pnpm build`

## Verification

Current local verification completed successfully:

- `pnpm db:push`
- `pnpm db:seed`
- `pnpm lint`
- `pnpm build`
- live browser validation of login, dashboard, mobile/tablet shell behavior, add material, transfer, transfer history, and raw-material history

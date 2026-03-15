# Premium Polymers Stock Management

Premium stock and raw-material management for small operations teams, built as a polished internal SaaS-style app on Next.js, Prisma, and PostgreSQL.

## Highlights

- Warehouse-scoped raw material management for exactly two seeded warehouses: `E-219` and `F-12`
- Premium dashboard with KPIs, charts, alerts, and recent activity
- Validated raw-material creation with category master data and optional dimensional metadata
- Secure transfer workflow with stock deduction, recipient reuse, and audit snapshots
- Separate transfer history and raw-material activity history ledgers
- Credentials auth with RBAC foundation for Admin, Manager, Operator, and Viewer
- PostgreSQL-backed persistence with transactional inventory updates and audit logs

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
- live browser validation of login, dashboard, add material, transfer, transfer history, and raw-material history

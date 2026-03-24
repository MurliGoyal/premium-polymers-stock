# Premium Polymers Stock Management

Internal stock and raw-material management app for warehouse-led operations. The project is built on Next.js App Router, Prisma, PostgreSQL, and a custom dark-first UI shell tuned for desktop, tablet, and phone usage.

## What This Repo Does

This app manages:

- warehouse-level raw material inventory
- stock transfers to recipients or internal destinations
- audit history for raw material changes and stock deductions
- low-stock and out-of-stock notifications
- category, recipient, user, and system administration

The seeded demo is centered around two warehouses:

- `E-219` for primary resin and film storage
- `F-11` for secondary additives and packaging stock

The data model itself is not limited to two warehouses, but several dashboard views and seeded defaults are optimized around those seeded codes.

## Product Features

- Dashboard with KPI cards, warehouse summaries, transfer trends, category mix, stock totals, alerts, and quick actions
- Warehouse detail pages with search, filtering, sorting, pagination, responsive cards, and desktop tables
- Add-material workflow with server-side validation, inline category creation, dimensional metadata, and a roll-length calculator
- Transfer workflow with availability refresh, projected-balance preview, inline recipient creation, and server-enforced stock deduction
- Separate transfer-history and material-history ledgers with filters and detail drawers
- Settings screens for categories, recipients, users, and system-level operational summaries
- Credentials-based authentication with role-based access control
- Notification APIs for unread count, list retrieval, and mark-as-read flows

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Prisma ORM
- PostgreSQL
- NextAuth credentials provider
- Zod and react-hook-form
- Framer Motion
- Recharts
- Radix-based UI primitives

## Architecture

### Frontend

- `src/app` contains all routes, layouts, loading states, and route-group organization
- `src/components/layout` provides the persistent shell: sidebar, topbar, tablet rail, mobile navigation, command palette, and notifications
- `src/components/shared` contains responsive page headers, pagination, filter sheets, and warehouse action pickers
- `src/components/ui` contains app-specific UI primitives and wrappers

### Backend

- Route-local `actions.ts` files implement server actions for dashboard data, warehouse inventory, transfers, and settings mutations
- `src/app/api/auth/[...nextauth]/route.ts` hosts NextAuth
- `src/app/api/notifications/*` exposes notification list, unread-count, and mark-read endpoints

### Data Layer

- Prisma schema lives in `prisma/schema.prisma`
- Seed data lives in `prisma/seed.ts`
- `src/lib/prisma.ts` exposes the Prisma client
- `src/lib/quantities.ts`, `src/lib/inventory.ts`, `src/lib/naming.ts`, and related helpers centralize stock and naming behavior

### Auth and Access Control

- `src/lib/auth.ts` handles session lookup and permission assertions
- `src/lib/rbac.ts` maps permissions across `MANAGER`, `STOCK_MANAGEMENT`, and `VIEWER`
- Protected pages redirect unauthenticated users to `/login`

## Repo Structure

```text
.
├─ prisma/
│  ├─ schema.prisma              # Database schema
│  └─ seed.ts                    # Demo users, warehouses, materials, recipients, transfers
├─ public/                       # Static assets
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login            # Sign-in route
│  │  ├─ (app)/dashboard         # KPI dashboard and analytics
│  │  ├─ (app)/warehouses        # Warehouse list and detail views
│  │  ├─ (app)/transfer-history  # Transfer ledger
│  │  ├─ (app)/raw-materials-history
│  │  ├─ (app)/settings          # Categories, recipients, users, system admin
│  │  └─ api/                    # NextAuth and notification endpoints
│  ├─ components/
│  │  ├─ forms/
│  │  ├─ layout/
│  │  ├─ shared/
│  │  └─ ui/
│  ├─ lib/                       # Auth, env, RBAC, Prisma, utilities, validation
│  ├─ proxy.ts                   # Middleware / request proxy logic
│  └─ types/
├─ Dockerfile
├─ docker-compose.yml            # Docker starter file; replace placeholder credentials before use
├─ .env.example                  # Local development environment template
├─ .env.production.example       # Production environment template
└─ ORACLE_SERVER_DEPLOYMENT_GUIDE.md
```

## Routes

### Public

- `/login`

### Authenticated App

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
- `/settings/system`

## Core Subsystems

### Dashboard and Analytics

- Pulls aggregate inventory, warehouse, category, transfer, activity, and notification data from Prisma
- Shows mobile-specific chart switching to keep smaller screens readable
- Uses Recharts for transfer trend, category mix, and warehouse stock totals

### Warehouse Inventory

- Lists warehouse materials with status, metadata, stock values, and pagination
- Supports filter-by-status, category, unit, and recency
- Provides direct paths into transfer and history workflows

### Raw Material Creation

- Validates both on the client and server
- Creates stock transactions and activity logs on save
- Supports optional thickness, size, weight, GSM, and notes metadata
- Allows inline category creation without leaving the form

### Transfer Workflow

- Restricts selectable materials to positive available stock
- Revalidates stale stock availability after 5 minutes
- Calculates projected balance before submission
- Creates transfer records, stock transactions, audit logs, and notifications
- Allows inline recipient creation

### Audit History

- `raw-materials-history` shows material lifecycle events
- `transfer-history` shows outbound stock movement
- Both ledgers support filtering, mobile cards, desktop tables, and detail drawers

### Notifications

- Stores low-stock, out-of-stock, transfer, and system notifications in the database
- Exposes list, unread-count, and mark-read routes under `src/app/api/notifications`
- Integrates with the topbar notification UI

### Admin Settings

- Categories: master data for material classification
- Recipients: master data for transfer destinations
- Users: role and access management
- System admin: operational summary page for higher-level oversight

## Database Model

Main Prisma models:

- `User`
- `Warehouse`
- `Category`
- `Recipient`
- `RawMaterial`
- `Transfer`
- `RawMaterialActivityLog`
- `StockTransaction`
- `Notification`

Important enums:

- `Role`
- `MaterialStatus`
- `ActivityType`
- `TransactionType`
- `NotificationType`

High-level relationships:

- A warehouse owns many raw materials, transfers, stock transactions, activity logs, and notifications
- A raw material belongs to one warehouse and one category
- Transfers deduct from one raw material and target one recipient
- Activity logs and stock transactions preserve the inventory audit trail

## Environment Variables

### Local development

Copy `.env.example` to `.env`.

Required values:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

Optional values:

- `NEXT_PUBLIC_APP_LOCALE`
- `NEXT_PUBLIC_APP_TIME_ZONE`

### Production

Copy `.env.production.example` to `.env.production` and replace every placeholder value.

Important:

- `.env.production` should stay local to the deployment target and should not be committed
- `docker-compose.yml` ships with placeholder database credentials and must be edited before running in production
- `POSTGRES_PASSWORD` in `docker-compose.yml` must match the password embedded in `DATABASE_URL`

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL 14+ recommended

### Setup

```bash
pnpm install
Copy-Item .env.example .env
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000`.

## Seeded Demo Users

- Manager: `manager@premiumpolymers.com` / `admin123`
- Stock Management: `stock@premiumpolymers.com` / `admin123`
- Viewer: `viewer@premiumpolymers.com` / `admin123`

These accounts are for local demo data only. Replace or rotate them for any shared or production environment.

## Available Scripts

- `pnpm dev` starts the development server
- `pnpm build` creates a production build
- `pnpm start` runs the production server
- `pnpm lint` runs ESLint
- `pnpm check` runs lint plus build
- `pnpm db:generate` generates the Prisma client
- `pnpm db:push` syncs the Prisma schema to the database
- `pnpm db:seed` seeds the demo dataset

## Docker and Deployment

Tracked deployment assets:

- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`
- `.env.production.example`
- `ORACLE_SERVER_DEPLOYMENT_GUIDE.md`

Typical production flow:

1. Copy `.env.production.example` to `.env.production`
2. Replace placeholders in `.env.production`
3. Replace placeholder `POSTGRES_PASSWORD` in `docker-compose.yml`
4. Build and start with Docker Compose
5. Run Prisma schema push and seed commands inside the app container as needed

For the Oracle VM flow, use [`ORACLE_SERVER_DEPLOYMENT_GUIDE.md`](./ORACLE_SERVER_DEPLOYMENT_GUIDE.md).

## UI Notes

- The app intentionally uses a dark-first visual system
- Theme is currently forced to dark mode in `src/components/providers.tsx`
- Layout behavior is optimized separately for mobile, tablet, and desktop shells
- Motion is provided through Framer Motion with reduced-motion handling

## Current Constraints and Assumptions

- Dashboard summary ordering and seeded labels are optimized around the seeded warehouse catalog
- The app currently uses credentials auth only; there are no OAuth providers configured
- History pages currently load the most recent 200 records per ledger view
- The notification tray currently shows the 12 most recent notifications plus a global unread count
- Notification delivery is in-app only; there is no email or SMS channel in this repo
- Docker assets are starter files, not turnkey infrastructure; you still need to supply production secrets and server configuration

## Verification

Latest local verification completed during this repo pass:

- `pnpm lint`
- `pnpm build`
- live browser validation of `/dashboard` and `/warehouses/e-219`

The dashboard warehouse stock chart was corrected to use stock totals instead of material counts, and production docs/assets were aligned around a sanitized `.env.production.example`.

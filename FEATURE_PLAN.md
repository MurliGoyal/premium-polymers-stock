# Premium Polymers — Feature Implementation Plan

> **Document purpose:** This is a comprehensive, pre-implementation planning reference. Nothing described here has been built yet. Every section explains *what* we are building, *why* we have chosen the described approach, *which files* will be created or modified, and *how* every piece fits together. No code changes should be made until the relevant section is fully understood.

---

## Table of Contents

1. [Feature 1 — Master / Sub-Good Hierarchy for Finished Goods](#feature-1--master--sub-good-hierarchy-for-finished-goods)
2. [Feature 2 — PDF Report Download for Finished Goods](#feature-2--pdf-report-download-for-finished-goods)
3. [Feature 3 — Cross-Warehouse Read Access for Finished Goods Managers](#feature-3--cross-warehouse-read-access-for-finished-goods-managers)
4. [Feature 4 — Enhanced Fuzzy Search in Finished Goods](#feature-4--enhanced-fuzzy-search-in-finished-goods)
5. [Feature 5 — Total Raw Materials Aggregation Page](#feature-5--total-raw-materials-aggregation-page)
6. [Feature 6 — PDF Report Download for Raw Materials](#feature-6--pdf-report-download-for-raw-materials)
7. [Feature 7 — Password Change for Users and Managers](#feature-7--password-change-for-users-and-managers)
8. [Feature 8 — New Role: RAW_MATERIAL_MANAGER](#feature-8--new-role-raw_material_manager)
9. [Cross-Cutting Concerns & Shared Infrastructure](#cross-cutting-concerns--shared-infrastructure)
10. [Implementation Order Recommendation](#implementation-order-recommendation)

---

## Feature 1 — Master / Sub-Good Hierarchy for Finished Goods

### Problem Statement

Right now every `FinishedGood` record sits as a flat, independent item in the database. When a product like "ABC" exists in multiple physical variants — e.g., **ABC 100 mm** and **ABC 110 mm** — both variants appear as completely separate, unrelated rows in the table. Operators have no visual or structural way to understand that these two rows belong to the same product family. As the catalogue grows this creates confusion, makes filtering noisy, and makes bulk operations on a product family impossible.

### Goal

Introduce a two-level hierarchy:

- **Master Good** — the product family name, e.g. "ABC". It owns no stock directly. It is a grouping container.
- **Sub-Good (Variant)** — the concrete, stockable item that belongs to exactly one Master Good. It carries all existing fields (size, diameter, base unit, current stock, etc.) plus its own production/dispatch activity logs.

In the UI the Master Good appears as a collapsed row with a **chevron / expand toggle**. Clicking it reveals the dropdown list of all Sub-Goods that belong to it. Each Sub-Good row displays its own stock and actions independently.

### Why This Approach (Parent–Child in Same Table via `parentId`)

We considered three database strategies:

| Option | Pros | Cons |
|---|---|---|
| A — Separate `MasterFinishedGood` table | Clean separation, clear foreign key | Requires joins everywhere, big migration, all existing queries break |
| B — Self-referential `parentId` on existing `FinishedGood` | Single table, all existing queries still work for leaf records, minimal migration | Parent rows need a convention to signal "I am a container" |
| C — Denormalized `masterName` string column | Zero schema change | No relational integrity, hard to rename, duplicated data |

**Option B is chosen.** A nullable `parentId` column is added to `FinishedGood`. If a row has `parentId = null` AND `isContainer = true`, it is a Master Good. If a row has a non-null `parentId`, it is a Sub-Good. Existing flat goods with no parent and `isContainer = false` continue to work exactly as before, giving us zero regression risk.

### Database Schema Changes

**File:** `prisma/schema.prisma`

The `FinishedGood` model gains three new fields:

```
isContainer    Boolean  @default(false) @map("is_container")
parentId       String?  @map("parent_id")
parent         FinishedGood?  @relation("SubGoods", fields: [parentId], references: [id])
subGoods       FinishedGood[] @relation("SubGoods")
```

- `isContainer` — `true` for Master Goods, `false` (default) for all others. This explicit boolean prevents ambiguity: a container with no children yet is still a valid container.
- `parentId` — `null` for Master Goods and all pre-existing flat goods. Non-null for Sub-Goods.
- The self-referential relation uses a named relation `"SubGoods"` as required by Prisma for self-joins.
- A new index `@@index([parentId])` is added for fast "give me all children of this master" lookups.
- A new index `@@index([isContainer])` is added because the UI will frequently query "all Masters only."
- The existing `@@unique([warehouseCode, normalizedName])` constraint must be **relaxed** — a Master Good and its Sub-Good may share the same normalised name in the same warehouse. The unique constraint should move to sub-goods only (enforced at the application layer) to allow the container row to hold the shared display name without colliding.

A new Prisma migration will be generated: `prisma/migrations/20260404120000_add_finished_goods_hierarchy/migration.sql`

### Server Actions Changes

**File:** `src/app/(app)/finished-goods/actions.ts`

New and modified server actions:

1. **`createMasterGood(payload)`** — Creates a new `FinishedGood` row with `isContainer: true`, `parentId: null`, and `currentStock: 0`. Validates that no other Master Good with the same name already exists in the same warehouse.

2. **`createSubGood(payload)`** — Creates a new `FinishedGood` row with `isContainer: false` and `parentId` set to a valid Master Good's `id`. Accepts all existing variant fields (size, diameter, base unit, initial stock, stock-in date). A Sub-Good's `name` is auto-derived as `"{masterName} — {variant descriptor}"` but stored as a separate `displayName` field (or the existing `name` field can remain as the full descriptive name).

3. **`getFinishedGoodsWarehouseData(warehouseCode)`** — **Modified.** Currently this returns a flat list. It will now return a structured list of Master Goods (containers) each with a nested `subGoods` array, PLUS any legacy flat goods that have no parent. This is achieved with a Prisma query that fetches `FinishedGood` where `parentId = null`, and for each record includes its `subGoods`. This is a single query with `include: { subGoods: true }`.

4. **`deleteSubGood(payload)`** — Deletes a Sub-Good. If it is the last Sub-Good under a Master, optionally prompts the user to also delete the Master.

5. **`deleteMasterGood(payload)`** — Only permitted when `subGoods` count is zero. If Sub-Goods still exist, the action throws an error describing which variants must be removed first.

6. **`recordProduction(payload)`** — **Unchanged in logic.** The `finishedGoodId` in the payload must now reference a Sub-Good (`isContainer: false`). A guard is added: if the ID belongs to a container, the action throws `"Cannot record production on a master group. Select a variant."`.

7. **`recordDispatch(payload)`** — Same guard as above.

### UI Changes

**File:** `src/app/(app)/finished-goods/finished-goods-client.tsx`

This is the largest UI change.

#### New `GoodRow` Component Logic

The current flat list of goods mapped to table rows will be replaced with a two-level structure:

- **Level 1 — `MasterGoodRow`**: Renders the master name, a chevron expand/collapse button, and aggregate stats (total sub-goods count, total combined stock across all sub-goods, warehouse badge). No individual stock editing here.
- **Level 2 — `SubGoodRow`**: Rendered only when the parent is expanded. Visually indented. Shows all existing per-good columns (size, stock, status, last updated). All existing action buttons (Production, Dispatch, Delete) live here.

State management for expand/collapse uses a `Set<string>` stored in a `useState` hook — `expandedMasters`. Toggling a master good's ID in this Set shows or hides its sub-goods row group. This is pure client state and survives no re-renders above the component boundary, which is intentional — the user controls what is open.

#### New "Add Variant" Button

Inside each expanded Master Good row header, a small `+ Add Variant` button will appear. Clicking it opens the existing Add-Good dialog but pre-fills and locks the `masterGoodId` field, so the new good is automatically created as a Sub-Good under this master.

#### New "Add Master Group" Button

Alongside the existing global `+ Add Good` button, a new `+ Add Group` button is added. This opens a simplified dialog that only asks for a group name (and warehouse code which is already implied by context).

#### Type Changes in `finished-goods-client.tsx`

The `Good` type exported/used locally will be extended:

```
type Good = {
  // ... all existing fields ...
  isContainer: boolean;
  parentId: string | null;
  subGoods: Good[]; // populated for containers, empty array for sub-goods
};
```

The `FinishedGoodsData` type (which wraps the full page data) changes its `goods` field from `Good[]` to a mixed array that the UI flattens for render with the hierarchy logic described above.

#### Filtering and Sorting Implications

When `isContainer = true`, the master row participates in search by acting as a **group header**. If a search term matches the master name, all its sub-goods are shown. If the search term matches a sub-good's descriptor (e.g., "100 mm") but not the master name, only the matching sub-goods are shown (and the master row is still rendered as a collapsed header to maintain hierarchy context). This is handled in the `filtered` computed memo.

### Files Modified Summary (Feature 1)

| File | Change Type | Reason |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `isContainer`, `parentId`, self-relation, new indexes |
| `prisma/migrations/20260404120000_add_finished_goods_hierarchy/migration.sql` | Create | Generated by `prisma migrate dev` |
| `src/app/(app)/finished-goods/actions.ts` | Modify | Add `createMasterGood`, `createSubGood`, modify `getFinishedGoodsWarehouseData`, add guards to production/dispatch |
| `src/app/(app)/finished-goods/finished-goods-client.tsx` | Modify | Two-level render, expand/collapse state, new Add Group dialog, extended type definitions |
| `src/app/(app)/finished-goods/[code]/page.tsx` | Minor modify | Pass structured data to client, no logic changes |
| `src/lib/validation.ts` | Modify | Add `createMasterGoodSchema`, `createSubGoodSchema` with appropriate Zod shapes |

### Implementation Status (Done)

Feature 1 is now implemented in this codebase.

What was done:

- Added self-referential hierarchy support in `FinishedGood` with `isContainer`, `parentId`, and the `SubGoods` relation in the schema.
- Added migration `prisma/migrations/20260404120000_add_finished_goods_hierarchy/migration.sql` for `is_container`, `parent_id`, FK, and indexes.
- Updated finished goods warehouse fetch to return top-level rows with nested `subGoods` and to compute stats from stockable records only.
- Implemented new server actions in `src/app/(app)/finished-goods/actions.ts`:
  - `createMasterGood`
  - `createSubGood`
  - `deleteSubGood`
  - `deleteMasterGood`
- Added container safety guards in mutating actions so production/dispatch cannot be recorded on master groups.
- Updated normalized key generation so container, sub-good, and flat-good keys do not collide.
- Added Zod validation schemas in `src/lib/validation.ts`:
  - `createMasterGoodSchema`
  - `createSubGoodSchema`
- Updated `src/app/(app)/finished-goods/finished-goods-client.tsx` to support hierarchy UI:
  - master-group section with expand/collapse
  - `+ Add group`
  - `+ Add variant` under each master group
  - deletion flow for sub-goods and master groups
  - stock operations scoped to stockable items (sub-goods and legacy flat goods)

Notes on compatibility:

- Existing legacy flat finished goods continue to work.
- `addFinishedGood` is retained for flat goods while new hierarchy actions are used for grouped workflows.

---

## Feature 2 — PDF Report Download for Finished Goods

### Problem Statement

There is currently no way to export finished goods data for reporting, auditing, or external sharing. Management needs a portable, printable summary of what is in stock, what was produced, what was dispatched, and what the running balance is — for any time period they choose.

### Goal

A **"Download PDF"** button on the Finished Goods warehouse page. Clicking it opens a small popover/dialog where the user selects a **duration** (Today, This Week, This Month, This Year, or a Custom date range). The system then generates and downloads a PDF file containing:

1. **Header** — Report title ("Finished Goods Report — Warehouse F-12"), generated date/time, the selected duration label.
2. **Per-Good Section** — One row per Sub-Good (grouped under their Master Good heading). Columns: Good Name, Size, Production (total units produced within the duration), Dispatch (total units dispatched within the duration), Balance (current stock at time of report, not time-windowed — this is always the live figure).
3. **Grand Total Row** — Sum of all Production and Dispatch across all goods.
4. **Metadata Footer** — When each good was first added (`createdAt`) and when it was last updated (`updatedAt`).

### Why `@react-pdf/renderer` (or `jsPDF` + `html2canvas`)

Two mainstream approaches exist for PDF generation in Next.js:

| Approach | Pros | Cons |
|---|---|---|
| `@react-pdf/renderer` (server or client) | Produces proper vector PDF, small file size, no HTML dependency, declarative React syntax | Requires learning the PDF-specific component API, no HTML/CSS carry-over |
| `jsPDF` + `html2canvas` | Familiar, can screenshot the existing UI | Very large file size (rasterised), fonts are often blurry, not suitable for tabular data |
| Server-side Puppeteer / headless Chrome | High fidelity HTML-to-PDF | Extremely heavy, requires a running browser binary on the server, not suitable for this deployment |

**`@react-pdf/renderer` is chosen.** The PDF content is data-driven (tables, numbers) and not visually complex, which plays to this library's strengths. It produces small, clean, print-ready files. The generation will happen **client-side** — the data has already been fetched for the page, and we send it plus the duration filter to a React-PDF renderer invoked in a Web Worker (or directly in the browser since the dataset is small).

### Duration Filter Logic

The duration selector offers these presets, all computed from the moment the PDF button is clicked:

- **Today** — `createdAt >= start of today` (midnight of current day in IST)
- **This Week** — `createdAt >= last Monday 00:00 IST`
- **This Month** — `createdAt >= 1st of current month 00:00 IST`
- **This Year** — `createdAt >= 1st Jan of current year 00:00 IST`
- **Custom Range** — User picks a `from` date and `to` date via two `<Input type="date">` fields.

The time-zone `Asia/Kolkata` is already defined in `src/lib/constants.ts` as `APP_TIME_ZONE`. All date boundary calculations must use this constant.

The **duration only affects Production and Dispatch totals**. The "Balance" column always reflects the live `currentStock` of each good at the time of generation.

### Data Fetching Strategy

Rather than adding a new server action purely for PDF data (since the page already has all the goods loaded), the approach is:

1. A new server action **`getFinishedGoodsPdfData(warehouseCode, fromDate, toDate)`** is added to `src/app/(app)/finished-goods/actions.ts`. This action queries `FinishedGoodActivityLog` filtered by `warehouseCode`, `createdAt >= fromDate`, `createdAt <= toDate`, and `activityType IN [PRODUCTION, DISPATCH]`. It groups results by `finishedGoodId` and sums quantities per type.

2. This action is called **lazily on the client** — only when the user clicks "Generate PDF" after selecting a duration. A loading spinner replaces the button text during the async call. Once data returns, `@react-pdf/renderer`'s `pdf()` function is invoked in the browser and the resulting blob is downloaded via a synthetic `<a>` element.

3. The action is a `"use server"` function, called via `useTransition` + `startTransition` to avoid blocking the UI.

### PDF Layout Design

```
┌─────────────────────────────────────────────────────────┐
│  PREMIUM POLYMERS                          [Logo area]  │
│  Finished Goods Report — Warehouse F-12                 │
│  Period: 1 Jun 2025 – 30 Jun 2025                       │
│  Generated: 15 Jul 2025, 14:32 IST                      │
├────────────────────┬───────┬────────────┬──────────┬────┤
│ Good Name          │ Size  │ Production │ Dispatch │ Bal│
├────────────────────┼───────┼────────────┼──────────┼────┤
│ ABC (Master Group) │       │            │          │    │
│   ABC — 100 mm     │ 100mm │      500   │    350   │ 150│
│   ABC — 110 mm     │ 110mm │      200   │    200   │   0│
│ XYZ                │  75mm │      800   │    600   │ 200│
├────────────────────┼───────┼────────────┼──────────┼────┤
│ GRAND TOTAL        │       │    1,500   │  1,150   │ 350│
└────────────────────┴───────┴────────────┴──────────┴────┘
  Added: 01 Jan 2025  |  Last Updated: 14 Jul 2025
```

Master Good rows use a slightly bolder font and a light grey background band. Sub-Good rows are indented. The table uses alternating row shading for readability.

### New Files

**`src/components/pdf/finished-goods-report.tsx`** — The `@react-pdf/renderer` React component tree that defines the PDF layout. Accepts `{ warehouseCode, warehouseName, fromDate, toDate, goods }` as props. Contains `Document`, `Page`, `View`, `Text`, `StyleSheet` from `@react-pdf/renderer`.

**`src/lib/pdf-utils.ts`** — Shared utility functions used by both finished goods and raw materials PDF generation: `formatPdfDate(date)`, `computeDurationLabel(fromDate, toDate)`, `generateAndDownloadPdf(component, filename)`.

### Files Modified Summary (Feature 2)

| File | Change Type | Reason |
|---|---|---|
| `src/app/(app)/finished-goods/actions.ts` | Modify | Add `getFinishedGoodsPdfData(warehouseCode, fromDate, toDate)` server action |
| `src/app/(app)/finished-goods/finished-goods-client.tsx` | Modify | Add PDF button, duration selector dialog, call action, trigger download |
| `src/components/pdf/finished-goods-report.tsx` | Create | React-PDF document component |
| `src/lib/pdf-utils.ts` | Create | Shared PDF generation helpers |
| `package.json` / `pnpm-lock.yaml` | Modify | Add `@react-pdf/renderer` dependency |

### Implementation Status (Done)

Feature 2 is now implemented.

What was done:

- Installed `@react-pdf/renderer` and updated lockfile.
- Added server action `getFinishedGoodsPdfData` in `src/app/(app)/finished-goods/actions.ts`.
  - Accepts `warehouseCode`, `fromDate`, `toDate`.
  - Filters `FinishedGoodActivityLog` by date range and activity type (`PRODUCTION`, `DISPATCH`).
  - Returns totals grouped by `finishedGoodId`.
- Added `createdAt` to finished goods data mapping so PDF footer metadata can include added/updated timestamps.
- Added `src/lib/pdf-utils.ts` with:
  - `formatPdfDate`
  - `computeDurationLabel`
  - `generateAndDownloadPdf`
- Added `src/components/pdf/finished-goods-report.tsx`:
  - Warehouse report header and generated timestamp
  - Table grouped by master goods where available
  - Per-row Production, Dispatch, Balance
  - Grand totals row
  - Footer metadata lines (added and last updated)
- Updated `src/app/(app)/finished-goods/finished-goods-client.tsx`:
  - Added `Download PDF` action button.
  - Added duration picker dialog with presets:
    - Today
    - This Week
    - This Month
    - This Year
    - Custom Range
  - Uses `APP_TIME_ZONE` for preset date calculations and labels.
  - Calls `getFinishedGoodsPdfData`, builds grouped report rows, generates and downloads PDF in browser.
  - Updated report layout to a letterpad-style format with branded company header and formal footer details.

Scope confirmation:

- Only Feature 2 work was added in this iteration.

---

## Feature 3 — Cross-Warehouse Read Access for Finished Goods Managers

### Problem Statement

Currently a user with `role = FINISHED_GOODS_MANAGER` and `finishedGoodsWarehouseCode = "F-12"` can **only** see warehouse F-12. They cannot see E-221 at all — not even to read data. The request is to allow them to **read** the other warehouse while still **restricting all write operations** to their own warehouse.

### Goal

- A `FINISHED_GOODS_MANAGER` scoped to **F-12** can navigate to `/finished-goods/e-221` and see the goods listed there, but all mutation buttons (Add Good, Production, Dispatch, Delete, Bulk Edit) are hidden/disabled.
- A `FINISHED_GOODS_MANAGER` scoped to **E-221** has the symmetric behaviour.
- The **current user's own warehouse** still shows all management controls.
- Attempting to call a mutating server action for a warehouse the user does not own throws an authorisation error even if the UI somehow allowed it — **server-side enforcement is the source of truth**.

### Why This Is Not a Schema Change

The authorisation logic currently lives entirely in `src/lib/auth.ts` and `src/lib/rbac.ts`. There is no database concept of "read-only warehouse access" — it is all derived from `role` and `finishedGoodsWarehouseCode`. We do not need a new database table. We only need to change the permission-resolution functions.

### Changes to `src/lib/auth.ts`

**`getAllowedFinishedGoodsWarehouseCodes(user)`** — Currently returns an array of one code for scoped managers. This is used to decide **what they can navigate to**. This function will be split into two:

1. **`getReadableFinishedGoodsWarehouseCodes(user)`** — Returns ALL warehouse codes in `FINISHED_GOODS_WAREHOUSE_CODES` for `FINISHED_GOODS_MANAGER` (not just their own). This is used for navigation and page-render access.

2. **`getWritableFinishedGoodsWarehouseCodes(user)`** — Returns only the scoped code for `FINISHED_GOODS_MANAGER` (the existing behaviour of `getAllowedFinishedGoodsWarehouseCodes`). This is used by all server actions before performing any mutation.

The existing `getAllowedFinishedGoodsWarehouseCodes` function is **kept as an alias** for `getWritableFinishedGoodsWarehouseCodes` to avoid a wide refactor of call sites in `actions.ts` on day one.

**`canAccessFinishedGoodsWarehouse(user, warehouseCode)`** — This function currently returns false for a scoped manager visiting another warehouse. It will be updated to return `true` for all valid warehouse codes for any `FINISHED_GOODS_MANAGER` role — but the calling page must still distinguish read vs. write access.

**`resolveFinishedGoodsWarehouseForUser(user, warehouseCode)`** — Updated to allow any valid warehouse code for scoped managers (currently it redirects to their scoped warehouse if they request another).

### Changes to `src/app/(app)/finished-goods/[code]/page.tsx`

The page currently calls `resolveFinishedGoodsWarehouseForUser` and redirects if the resolved code doesn't match the requested code. After the fix, it will:

1. Allow any `FINISHED_GOODS_MANAGER` to view any warehouse.
2. Compute a new boolean prop `isOwnWarehouse` — `true` if the requested warehouse code equals the user's `finishedGoodsWarehouseCode`, `false` otherwise.
3. Pass `canManage={hasPermission(user.role, 'finished_goods:manage') && isOwnWarehouse}` to `FinishedGoodsClient`. This is the single prop that disables all mutation UI.

### Changes to `src/app/(app)/finished-goods/finished-goods-client.tsx`

The existing `canManage` prop already gates the Add, Bulk Edit, and Delete buttons. No new prop is needed — the fix is entirely in how `canManage` is computed in the page server component above.

However, a **read-only banner** should be shown when `canManage = false` but the user is a `FINISHED_GOODS_MANAGER`. Something like:

> "You are viewing Warehouse E-221 in read-only mode. You can only manage Warehouse F-12."

This banner must NOT appear for a `VIEWER` role — it is specifically for cross-warehouse reads by a manager.

A new prop `isReadOnlyView: boolean` will be added to `FinishedGoodsClient` and set to `true` only when role is `FINISHED_GOODS_MANAGER` and `isOwnWarehouse` is `false`.

### Changes to `src/app/(app)/finished-goods/page.tsx` (the directory/chooser page)

Currently if a scoped manager has only one allowed warehouse, it immediately redirects to that warehouse. After the change it will redirect to `/finished-goods` which shows a warehouse selector with both warehouses visible (one labelled "your warehouse", one labelled "view only"). The existing `FinishedGoodsWarehousesClient` component will receive a `writableWarehouseCodes` prop in addition to `warehouses` so it can visually distinguish the two.

### Server Action Guard Changes

In `src/app/(app)/finished-goods/actions.ts`, every mutating action (add good, record production, record dispatch, delete good, bulk edit) calls `assertServerPermission` at the top. After the change they also call a new helper:

**`assertOwnsFinishedGoodsWarehouse(user, warehouseCode)`** defined in `src/lib/auth.ts`:

```
If user.role === 'FINISHED_GOODS_MANAGER'
  AND warehouseCode is NOT in getWritableFinishedGoodsWarehouseCodes(user)
  THEN throw new Error("You can only manage your own warehouse.")
```

This ensures even if the client sends a mutating request for another warehouse, it is rejected server-side.

### Files Modified Summary (Feature 3)

| File | Change Type | Reason |
|---|---|---|
| `src/lib/auth.ts` | Modify | Split `getAllowedFinishedGoodsWarehouseCodes` into readable/writable variants; update `canAccessFinishedGoodsWarehouse`; add `assertOwnsFinishedGoodsWarehouse` |
| `src/app/(app)/finished-goods/page.tsx` | Modify | Use readable codes for navigation, pass writable codes to selector client |
| `src/app/(app)/finished-goods/[code]/page.tsx` | Modify | Compute `isOwnWarehouse`, pass `canManage` and `isReadOnlyView` correctly |
| `src/app/(app)/finished-goods/finished-goods-client.tsx` | Modify | Accept `isReadOnlyView` prop, render read-only banner |
| `src/app/(app)/finished-goods/finished-goods-warehouses-client.tsx` | Modify | Accept `writableWarehouseCodes` prop, visually distinguish read-only warehouses |
| `src/app/(app)/finished-goods/actions.ts` | Modify | Add `assertOwnsFinishedGoodsWarehouse` guard to all mutating actions |

### Implementation Status (Done)

Feature 3 is now implemented.

What was done:

- Updated authorization helpers in `src/lib/auth.ts`:
  - Added `getReadableFinishedGoodsWarehouseCodes`
  - Added `getWritableFinishedGoodsWarehouseCodes`
  - Kept `getAllowedFinishedGoodsWarehouseCodes` as alias to writable codes
  - Updated `canAccessFinishedGoodsWarehouse` to use readable codes
  - Updated `resolveFinishedGoodsWarehouseForUser` to resolve from readable codes
  - Added `assertOwnsFinishedGoodsWarehouse` for server-side write protection
- Updated `src/app/(app)/finished-goods/page.tsx`:
  - Uses readable warehouse codes for access flow
  - Passes writable warehouse codes to the selector client for view-only tagging
- Updated `src/app/(app)/finished-goods/[code]/page.tsx`:
  - Allows scoped managers to view other warehouses
  - Computes `isOwnWarehouse`
  - Sets `canManage` only for own warehouse
  - Passes read-only view metadata to client
- Updated `src/app/(app)/finished-goods/finished-goods-client.tsx`:
  - Accepts `isReadOnlyView` and `ownWarehouseCode` props
  - Shows read-only banner for scoped managers on non-owned warehouse pages
- Updated `src/app/(app)/finished-goods/finished-goods-warehouses-client.tsx`:
  - Accepts `writableWarehouseCodes`
  - Labels cards as `Your warehouse` vs `View only`
- Updated `src/app/(app)/finished-goods/actions.ts`:
  - Uses readable warehouse codes for directory data fetch
  - Adds `assertOwnsFinishedGoodsWarehouse` to all mutating finished-goods actions so cross-warehouse writes are rejected server-side

---

## Feature 4 — Enhanced Fuzzy Search in Finished Goods

### Problem Statement

The current search in `finished-goods-client.tsx` performs a simple case-insensitive `includes()` check against `good.name`. If the good is named "ABC" and you type "C", you get no results because "ABC" does not include "C" as a standalone substring in a meaningful way — actually it does include "C", so the real issue may be that search currently only checks the start, or only checks the `normalizedName`. Let us be precise: the user's complaint is that partial, non-prefix substrings do not match. We will make the search find goods whose name contains any sequence of typed characters **in order** (fuzzy matching), not just as a contiguous substring.

### Goal

Typing **"C"** in the search box finds **"ABC"**. Typing **"AB"** finds **"ABC"**. Typing **"AC"** should also find **"ABC"** (the characters A and C both appear in order). This is the classic **fuzzy / subsequence** matching pattern used in tools like VS Code's command palette.

Additionally, search should look across **multiple fields** — not just the good name, but also the size descriptor, base unit, and any notes — giving deeper, richer results.

### Why Client-Side Fuzzy Matching

The goods list for a single warehouse is already loaded in the client (typical size: tens to low hundreds of items). Running fuzzy matching entirely in the browser is instant — there is zero server latency, and we avoid adding server query complexity. A lightweight fuzzy-match utility (either written inline or imported from the already-bundled ecosystem) is fast enough for this scale.

### Implementation Plan

#### New File: `src/lib/fuzzy-search.ts`

This file exports a single pure function:

```
fuzzyScore(needle: string, haystack: string): number
```

Algorithm — **sequential character matching with bonus scoring:**

1. Normalise both needle and haystack to lower-case.
2. Walk through `needle` characters one by one. For each character, find its next occurrence in `haystack` starting from the last matched position.
3. If all characters of needle are found in order, the match succeeds. Return a score based on: consecutive character matches score higher, prefix matches score highest, middle-of-word matches score lower.
4. If any character is not found, return 0 (no match).

This is the same algorithm used by `fzf` and VS Code file-picker. Writing it inline (≈ 30 lines) avoids adding a new package dependency.

#### Changes to `src/app/(app)/finished-goods/finished-goods-client.tsx`

The `filtered` computed memo currently does something like:

```
const query = deferredSearch.toLowerCase();
goods.filter(good => good.name.toLowerCase().includes(query))
```

It will be replaced with:

```
const query = deferredSearch.trim();
if (!query) return all goods;

goods.filter(good => {
  const fields = [good.name, good.sizeDescriptor, good.baseUnit, good.notes ?? ""];
  return fields.some(field => fuzzyScore(query, field) > 0);
})
.sort by fuzzyScore descending (highest match quality first)
```

For Master Goods in the new hierarchy (Feature 1), a master is included in results if **any of its sub-goods** match, and those matching sub-goods are shown expanded. If the master's own name matches, all sub-goods are shown.

#### Search Scope for Sub-Goods

When Feature 1 is also implemented, the search pipeline is:

1. Compute fuzzy match score for each Sub-Good against all its fields.
2. A Master Good is "matched" if its own name fuzzy-matches OR if at least one of its Sub-Goods matches.
3. Only matching Sub-Goods are rendered inside an expanded Master, not all sub-goods.

This means search effectively "drills into" the hierarchy, which is the most intuitive behaviour.

### Files Modified Summary (Feature 4)

| File | Change Type | Reason |
|---|---|---|
| `src/lib/fuzzy-search.ts` | Create | Pure fuzzy matching utility function |
| `src/app/(app)/finished-goods/finished-goods-client.tsx` | Modify | Replace `includes()` search with `fuzzyScore()` multi-field search |

### Implementation Status (Done)

Feature 4 is now implemented.

What was done:

- Added `src/lib/fuzzy-search.ts` with a pure `fuzzyScore(needle, haystack)` helper.
- Wired `finished-goods-client.tsx` to use fuzzy scoring for the main finished-goods search.
- Search now evaluates multiple fields per good, including:
  - name
  - size/diameter descriptor
  - base unit
  - notes when present
- Search results are ranked by fuzzy match quality instead of using substring matching.
- Hierarchy-aware search was kept intact for Feature 1:
  - masters match when their own name matches fuzzily
  - sub-goods are shown only when they match
  - master groups expand naturally when searching
- The bulk-edit picker in the same file now reuses the same fuzzy matcher so the search behavior stays consistent within finished goods.

Process applied:

1. I introduced the shared fuzzy scorer as a standalone utility so the matching logic stays reusable.
2. I replaced the finished-goods substring filter with ranked fuzzy matching while preserving the existing warehouse filters and sort options.
3. I validated the hierarchy drill-down behavior so master groups still expand correctly and only matching variants are shown when a sub-good matches.
4. I checked the changed files for TypeScript errors before updating the plan.

---

## Feature 5 — Total Raw Materials Aggregation Page

### Problem Statement

Currently, the raw materials view is always scoped to a single warehouse. There is no way for a manager to see all raw materials across both warehouses on one screen. When the same material exists in both E-219 and F-11, the manager must navigate between two pages and mentally add the numbers together.

### Goal

A new **"Total Raw Materials"** page accessible from the warehouses listing page (`/warehouses`) via a prominent button. This page shows every raw material that exists in the system, **irrespective of warehouse**. When the same material (same name + same specification fingerprint — GSM, size, thickness, micron, base unit) exists in multiple warehouses, it is shown as a **single merged row** with combined stock. Materials that exist in only one warehouse are shown normally.

The page includes:
- A **very advanced search** bar with multi-field fuzzy search (same algorithm as Feature 4).
- **Filter controls** for: category, warehouse origin, status (In Stock / Low Stock / Out of Stock), unit, GSM range, size range.
- **Sort controls** for: name (A-Z / Z-A), stock (high to low / low to high), category, last updated (newest / oldest).
- A pagination control with configurable page size.

### Route

**`/warehouses/total`** — This keeps it nested under the warehouses section of the app, which is semantically correct (it is an aggregate warehouse view). The route is `src/app/(app)/warehouses/total/page.tsx`.

### Deduplication / Merging Logic

The concept of "same material" for merging purposes is defined by a **specification fingerprint**: a normalized string composed of:

```
normalizedName + "|" + (gsm ?? "") + "|" + (sizeValue ?? "") + "|" + (sizeUnit ?? "") + "|" + (thicknessValue ?? "") + "|" + (thicknessUnit ?? "") + "|" + (micron ?? "") + "|" + (baseUnit)
```

This fingerprint is computed for every raw material. Materials with the same fingerprint are merged. The merged row shows:
- Combined `currentStock` (sum of all instances).
- A **source badges** section showing e.g. `E-219: 120 kg` and `F-11: 80 kg` as small inline pills.
- `updatedAt` is the most recent of all merged records.
- `status` is derived from combined stock vs. combined minimum stock.
- Category, vendor, unit, and specification fields come from any one representative record (they are identical by definition of the fingerprint).

This merging happens **server-side** in the page's data-fetching function — never in the client — because the raw materials list can be large and we do not want to send duplicate data to the browser unnecessarily.

### New Server Action / Data Fetcher

**File:** `src/app/(app)/warehouses/total/actions.ts` (new file)

Function: **`getTotalRawMaterialsData()`**

1. Fetches all `RawMaterial` records from the database with their `warehouse`, `category`, and specification fields.
2. Computes the fingerprint for each.
3. Groups by fingerprint using a `Map<string, RawMaterial[]>`.
4. For each group, produces a merged record.
5. Returns an array of merged records sorted by name ascending by default.

This is a `"use server"` function, called from the page server component.

### New Page Files

**`src/app/(app)/warehouses/total/page.tsx`** — Server component. Calls `requirePagePermission("raw_materials:view")` — same permission as individual warehouse pages. Fetches data via `getTotalRawMaterialsData()`. Passes data to the client component.

**`src/app/(app)/warehouses/total/total-materials-client.tsx`** — Client component. Receives the merged materials array. Implements all the filter, sort, and search UI. Uses the same `fuzzyScore` utility from Feature 4 for search. Renders a table with expandable source-warehouse breakdown rows.

### Changes to Warehouses Listing Page

**File:** `src/app/(app)/warehouses/warehouses-client.tsx`

A **"Total Raw Materials"** button/card is added to the top of the warehouses listing. It links to `/warehouses/total`. This button is always visible to any user who has `raw_materials:view` permission.

It is rendered as a distinct "summary card" above the per-warehouse cards, with a different visual treatment (e.g. a gradient distinct from individual warehouses, an aggregate icon like a stacked-layers icon from lucide-react).

### Access Control

The total materials page uses `requirePagePermission("raw_materials:view")` — the same permission that already gates individual warehouse pages. No new permission is needed for viewing. The new `RAW_MATERIAL_MANAGER` role introduced in Feature 8 will also be able to interact with this page with full management capabilities.

### Files Modified/Created Summary (Feature 5)

| File | Change Type | Reason |
|---|---|---|
| `src/app/(app)/warehouses/total/page.tsx` | Create | New server component for the total materials page |
| `src/app/(app)/warehouses/total/actions.ts` | Create | `getTotalRawMaterialsData()` server action with dedup logic |
| `src/app/(app)/warehouses/total/total-materials-client.tsx` | Create | Client component with advanced search, filters, sort |
| `src/app/(app)/warehouses/warehouses-client.tsx` | Modify | Add "Total Raw Materials" button/card linking to new route |
| `src/lib/fuzzy-search.ts` | (created in Feature 4) | Reused here |

### Implementation Status (Done)

Feature 5 is now implemented.

What was done:

- Added a reusable raw-material fingerprint helper in `src/lib/raw-materials.ts` so cross-warehouse deduplication follows the feature spec.
- Added `src/app/(app)/warehouses/total/actions.ts` with `getTotalRawMaterialsData()` to merge raw materials server-side and compute per-warehouse source breakdowns.
- Added `src/app/(app)/warehouses/total/page.tsx` as the new `/warehouses/total` route with `raw_materials:view` access control.
- Added `src/app/(app)/warehouses/total/total-materials-client.tsx` with:
  - fuzzy search across multiple material fields
  - category / warehouse / status / unit / GSM / size filters
  - sort controls
  - page-size selection and pagination
  - expandable source-warehouse breakdown rows
- Added a prominent Total Raw Materials card to `src/app/(app)/warehouses/warehouses-client.tsx`.
- Updated raw-material mutation revalidation in warehouse and stock-adjustment actions so `/warehouses/total` refreshes after writes.

Process applied:

1. I reused the existing raw-material normalization logic and introduced a dedicated fingerprint helper for the aggregate view.
2. I built the aggregate page server-side first so the browser only receives merged rows, not duplicate warehouse records.
3. I matched the client UI to the rest of the app with the shared fuzzy search, filter sheets, and table/pagination patterns already used elsewhere.

---

## Feature 6 — PDF Report Download for Raw Materials

### Problem Statement

Raw materials data needs to be exportable in the same way as finished goods (Feature 2). This applies to both individual warehouse pages and the new "Total Raw Materials" page.

### Goal

A **"Download PDF"** button exists on:
1. **Each individual warehouse raw materials page** (`/warehouses/[code]`)
2. **The total raw materials page** (`/warehouses/total`)

Both buttons open the same duration-selector dialog as Feature 2 (Today / This Week / This Month / This Year / Custom Range). The generated PDF's content differs between the two:

#### Individual Warehouse PDF Format

```
┌────────────────────────────────────────────────────────┐
│  PREMIUM POLYMERS                                       │
│  Raw Materials Report — Warehouse E-219                 │
│  Period: 1 Jun 2025 – 30 Jun 2025                       │
│  Generated: 15 Jul 2025, 14:32 IST                      │
├──────────────────────────────────────────────────────   │
│  CATEGORY: FILMS                                        │
│  ─────────────────────────────────────────              │
│  Name            │ GSM  │ Unit │ Size   │ In Stock      │
│  Film Type A     │  30  │  kg  │ 100mm  │ 250 kg        │
│                  │      │      │        │ E-219: 150 kg  │
│                  │      │      │        │ F-11:  100 kg  │  ← if exists in both
│  ─────────────────────────────────────────              │
│  CATEGORY: RESINS                                       │
│  ...                                                    │
└────────────────────────────────────────────────────────┘
```

For materials that exist in both warehouses (even when viewing from a single warehouse PDF), the stock breakdown shows the individual warehouse quantities and their sum. This is because knowing the cross-warehouse stock is important context even from a single warehouse report.

The duration filter on the individual warehouse PDF affects... what exactly? There are no "production" or "dispatch" events for raw materials. Instead, the duration filter controls which materials are **included** based on when they were last updated. Materials not touched within the selected period are **greyed out or excluded** with an optional toggle "Include all materials regardless of period." This makes the report useful for auditing activity.

#### Total Raw Materials PDF Format

Same structure but:
- Header says "Total Raw Materials Report — All Warehouses"
- Every material shows its combined stock AND the per-warehouse breakdown in the "In Stock" column (as described above)
- Materials with the same fingerprint in both warehouses are deduplicated exactly as in the UI (Feature 5)

### New PDF Component

**`src/components/pdf/raw-materials-report.tsx`** — `@react-pdf/renderer` document component. Accepts `{ reportTitle, fromDate, toDate, categorisedMaterials }` where `categorisedMaterials` is an array of `{ categoryName: string, materials: MergedMaterial[] }`.

The PDF component groups materials under category headings rendered as bold section dividers, then renders a sub-table per category.

### New Server Actions

In `src/app/(app)/warehouses/[code]/actions.ts`:

**`getRawMaterialsPdfData(warehouseCode, fromDate, toDate)`** — Queries raw materials for the given warehouse, their categories, and looks up if each also exists in the other warehouse (to compute cross-warehouse stock breakdown). Filters by `updatedAt` within the date range.

In `src/app/(app)/warehouses/total/actions.ts`:

**`getTotalRawMaterialsPdfData(fromDate, toDate)`** — Similar to `getTotalRawMaterialsData()` but filtered to the date range, and formatted for the PDF renderer.

### Changes to Existing Warehouse Detail Page

**File:** `src/app/(app)/warehouses/[code]/warehouse-detail-client.tsx`

A PDF download button is added to the page header actions area, matching the design established in Feature 2. It opens the duration selector dialog and calls `getRawMaterialsPdfData`.

### Files Modified/Created Summary (Feature 6)

| File | Change Type | Reason |
|---|---|---|
| `src/components/pdf/raw-materials-report.tsx` | Create | React-PDF component for raw materials |
| `src/app/(app)/warehouses/[code]/actions.ts` | Modify | Add `getRawMaterialsPdfData` server action |
| `src/app/(app)/warehouses/[code]/warehouse-detail-client.tsx` | Modify | Add PDF download button and duration dialog |
| `src/app/(app)/warehouses/total/actions.ts` | Modify | Add `getTotalRawMaterialsPdfData` server action |
| `src/app/(app)/warehouses/total/total-materials-client.tsx` | Modify | Add PDF download button and duration dialog |
| `src/lib/pdf-utils.ts` | Modify | Extend with raw-materials-specific helpers if needed |

### Implementation Status (Done)

Feature 6 is now implemented.

What was done:

- Added `src/lib/raw-materials-pdf.ts` to group merged raw materials by category and format PDF-specific size text.
- Added `src/components/shared/duration-picker-dialog.tsx` as the shared duration picker for the PDF flow.
- Added `src/components/pdf/raw-materials-report.tsx` for the company-letterhead raw materials PDF layout.
- Added `getRawMaterialsPdfData` to `src/app/(app)/warehouses/[code]/actions.ts`.
- Added `getTotalRawMaterialsPdfData` to `src/app/(app)/warehouses/total/actions.ts`.
- Updated `src/app/(app)/warehouses/[code]/warehouse-detail-client.tsx` with a `Download PDF` action, the duration dialog, and the optional include-all-materials toggle.
- Updated `src/app/(app)/warehouses/total/total-materials-client.tsx` with a `Download PDF` action and the same shared duration dialog.

Process applied:

1. I reused the merged raw-materials read model from Feature 5 so the PDF reflects the same fingerprint-based grouping as the aggregate page.
2. I kept the report generation client-driven, but routed the data fetch through server actions so the PDF always renders from fresh warehouse data.
3. I used one shared duration dialog for both raw-materials entry points, with the warehouse page exposing the optional include-all-materials toggle and the total page using the same date-range picker without extra controls.

---

## Feature 7 — Password Change for Users and Managers

### Problem Statement

Currently there is no way for any user — including an admin — to change a password after account creation. The `createUser` action sets a password at creation time, and that's it. This is a significant usability and security gap.

### Goal

1. **Any user can change their own password** from a "My Account" or "Security" settings page. They must provide their current password for verification, then their new password (with confirmation).
2. **A MANAGER (admin) can change any user's password** from the Users settings page (`/settings/users`) — without needing to know the user's current password. This is the "admin reset" flow.

### Why Separate Flows

The two flows have different security requirements:
- Self-service change: requires current password verification to prevent session hijacking (if a user leaves their session open, a bystander cannot silently change the password without knowing the original).
- Admin reset: manager is trusted, no current-password requirement, but the action is permission-gated (`users:manage`).

### Database Changes

None. Password hashing already uses `bcryptjs` and is stored in `users.password_hash`. We just need new server actions and UI.

### New Server Actions

**File:** `src/app/(app)/settings/actions.ts` (modify existing)

**`changeOwnPassword(currentPassword, newPassword)`**:
1. Calls `assertServerPermission()` with no specific permission — any authenticated user can call this.
2. Fetches the calling user's `passwordHash` from the database using `session.user.id`.
3. Compares `currentPassword` against the stored hash using `bcryptjs.compare()`.
4. If comparison fails, throws `"Current password is incorrect."`.
5. Validates `newPassword` (minimum 6 characters, maximum 120 characters — same as `createUserSchema`).
6. Hashes the new password with `bcryptjs.hash(newPassword, 12)`.
7. Updates `users` row for the session user.
8. Does **not** invalidate the current session (this is standard behaviour — the user stays logged in).

**`adminChangeUserPassword(userId, newPassword)`**:
1. Calls `assertServerPermission("users:manage")`.
2. Confirms the target user exists.
3. Prevents changing the password of the currently logged-in admin to avoid lockout (disallowed: same as the delete-self guard).
4. Validates and hashes the new password.
5. Updates the target user's `passwordHash`.
6. Calls `revalidatePath("/settings/users")`.

Both actions are added to `src/lib/validation.ts` as `changePasswordSchema` (validates `currentPassword` and `newPassword` + `confirmPassword` fields).

### UI Changes — Self-Service Password Change

**New file: `src/app/(app)/settings/account/page.tsx`** — A new settings sub-page for the current user's account. Navigation link added to the settings sidebar/layout.

**New file: `src/app/(app)/settings/account/account-client.tsx`** — Client component with a "Change Password" form:
- "Current password" input (type password)
- "New password" input (type password)
- "Confirm new password" input (type password, validates it matches new password on the client before submitting)
- "Update password" submit button with loading state
- Success toast on completion

This page is accessible to **all roles** since every user should be able to change their own password.

### UI Changes — Admin Password Reset

**File:** `src/app/(app)/settings/users/users-client.tsx` (modify existing)

In the user table/card for each user, a new action button **"Reset Password"** appears (only visible when `canManage = true`). Clicking it opens a dialog:

- Title: "Reset password for [User Name]"
- "New password" input
- "Confirm new password" input
- "Reset Password" submit button (destructive styling since this is an admin override)
- A warning text: "The user will not be notified. Make sure to share the new password securely."

The dialog calls `adminChangeUserPassword(userId, newPassword)` via a `useTransition`.

The existing delete confirmation dialog pattern in `users-client.tsx` serves as the exact template for this new dialog's structure.

### Navigation / Settings Layout

**File:** `src/app/(app)/settings/` layout or sidebar component (whichever renders the settings navigation)

A new entry "My Account" (or "Security") is added to the settings navigation, linking to `/settings/account`. This entry is visible to all roles (since every user can access it), unlike "Users" which is only visible to managers.

### Files Modified/Created Summary (Feature 7)

| File | Change Type | Reason |
|---|---|---|
| `src/app/(app)/settings/actions.ts` | Modify | Add `changeOwnPassword` and `adminChangeUserPassword` server actions |
| `src/lib/validation.ts` | Modify | Add `changePasswordSchema` |
| `src/app/(app)/settings/account/page.tsx` | Create | New settings sub-page for self-service password change |
| `src/app/(app)/settings/account/account-client.tsx` | Create | Client component with change password form |
| `src/app/(app)/settings/users/users-client.tsx` | Modify | Add "Reset Password" button and dialog for admin flow |

### Implementation Status (Done)

Feature 7 is now implemented.

What was done:

- Added password validation schemas in `src/lib/validation.ts` for self-service changes and admin resets.
- Added `changeOwnPassword` and `adminChangeUserPassword` server actions in `src/app/(app)/settings/actions.ts` with current-password verification and manager-only reset protection.
- Added a new `/settings/account` route with a self-service password form and account summary card.
- Added a `My Account` entry to the settings navigation so every authenticated user can reach the password screen.
- Extended `src/app/(app)/settings/users/users-client.tsx` with a reset-password dialog for managers.
- Updated the settings topbar subtitle so the account page reads as password and account security rather than generic admin settings.

Process applied:

1. I split the work into a self-service password path and a manager-only reset path so the security boundaries stay explicit in both UI and server code.
2. I reused the existing settings layout patterns to keep the new page visually aligned with the rest of the admin area.
3. I validated the touched TypeScript and TSX files after the code changes, then recorded the implementation notes here.

---

## Feature 8 — New Role: RAW_MATERIAL_MANAGER

### Problem Statement

Currently there is no role that is dedicated exclusively to managing raw materials. The existing role breakdown is:

| Role | Can do raw materials? |
|---|---|
| MANAGER | Yes — full access to everything |
| FINISHED_GOODS_MANAGER | No |
| STOCK_MANAGEMENT | Partial — view + transfers + adjustments, but no create/edit/delete |
| VIEWER | Read-only |

A dedicated raw materials operator needs to: add new materials, edit specifications, adjust stock, perform and view transfers, view transfer history, view activity history — all without touching finished goods or user management. The `STOCK_MANAGEMENT` role is close but lacks `raw_materials:create`, `raw_materials:edit`, and `raw_materials:delete` permissions. Granting those to `STOCK_MANAGEMENT` would be too broad (that role is used for other operators). A new scoped role is the cleanest solution.

Additionally, the new `RAW_MATERIAL_MANAGER` role must be able to access the new Total Raw Materials page (Feature 5) with full management capability (adding materials, editing, adjusting stock, etc.).

### Goal

New role: **`RAW_MATERIAL_MANAGER`**

Permissions granted:
- `warehouses:view`
- `raw_materials:view`
- `raw_materials:create`
- `raw_materials:edit`
- `raw_materials:delete`
- `transfers:view`
- `transfers:create`
- `transfer_history:view`
- `raw_materials_history:view`
- `stock_adjustments:view`
- `stock_adjustments:manage`
- `categories:view`
- `categories:manage`
- `recipients:view`
- `recipients:manage`

Permissions **NOT** granted:
- `dashboard:view` — they go directly to `/warehouses` on login
- `finished_goods:view` / `finished_goods:manage` — completely separate domain
- `users:view` / `users:manage` — not their concern
- `settings:view` / `settings:manage` — except categories and recipients which are raw-materials-adjacent

### Database Schema Changes

**File:** `prisma/schema.prisma`

The `Role` enum gains a new value:

```
RAW_MATERIAL_MANAGER
```

A new Prisma migration is generated to add this enum value to the PostgreSQL database.

### Changes to `src/lib/rbac.ts`

The `rolePermissions` map gains a new entry:

```
RAW_MATERIAL_MANAGER: [
  "warehouses:view",
  "raw_materials:view",
  "raw_materials:create",
  "raw_materials:edit",
  "raw_materials:delete",
  "transfers:view",
  "transfers:create",
  "transfer_history:view",
  "raw_materials_history:view",
  "stock_adjustments:view",
  "stock_adjustments:manage",
  "categories:view",
  "categories:manage",
  "recipients:view",
  "recipients:manage",
]
```

`getRoleLabel()` gains a new mapping: `RAW_MATERIAL_MANAGER → "Raw Material Manager"`.

`getRoleColor()` gains a new case with a distinct colour (e.g., violet/purple tones to visually differentiate from the green Stock Management role).

### Changes to `src/lib/auth.ts`

**`getAuthorizedHome(user)`** — The home-page redirect for a logged-in user. `RAW_MATERIAL_MANAGER` does not have `dashboard:view` but does have `warehouses:view`, so they will naturally land on `/warehouses` following the existing priority chain in `getAuthorizedHome`. No code change is needed here — the existing `if (hasPermission(user.role, "warehouses:view")) return "/warehouses"` already handles it.

### Changes to `src/lib/validation.ts`

The `createUserSchema` Zod enum for `role` currently accepts:

```
z.enum(["MANAGER", "STOCK_MANAGEMENT", "FINISHED_GOODS_MANAGER", "VIEWER"])
```

It will be extended to:

```
z.enum(["MANAGER", "STOCK_MANAGEMENT", "FINISHED_GOODS_MANAGER", "RAW_MATERIAL_MANAGER", "VIEWER"])
```

### Changes to `src/app/(app)/settings/users/users-client.tsx`

The `<SelectItem>` list in the "Add User" dialog gains a new entry:

```
<SelectItem value="RAW_MATERIAL_MANAGER">Raw Material Manager</SelectItem>
```

It should be positioned logically between `STOCK_MANAGEMENT` and `VIEWER` in the list.

### Changes to Total Raw Materials Page (Feature 5 intersection)

**File:** `src/app/(app)/warehouses/total/page.tsx`

The page currently uses `requirePagePermission("raw_materials:view")`. Because `RAW_MATERIAL_MANAGER` has `raw_materials:view`, they will automatically gain access to this page with no additional change.

However, the management buttons on the total page (if any — adding materials from the aggregate view is complex and is out of scope for the first implementation) must also check `raw_materials:create` etc., which `RAW_MATERIAL_MANAGER` has.

### Changes to Navigation / Sidebar

**File:** whichever file renders the left-side navigation (likely in `src/components/layout/` or `src/app/(app)/layout.tsx`)

The navigation links are gated by permissions. Since `RAW_MATERIAL_MANAGER` has `warehouses:view` but not `dashboard:view`, the sidebar will naturally show Warehouses, Transfer History, Raw Materials History, and Stock Adjustments — but not Dashboard. This is driven by the existing `hasPermission` checks in the navigation renderer, so no change is needed there beyond the RBAC entry.

### Files Modified Summary (Feature 8)

| File | Change Type | Reason |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `RAW_MATERIAL_MANAGER` to `Role` enum |
| `prisma/migrations/20260404193000_add_raw_material_manager_role/migration.sql` | Create | Generated migration for enum value addition |
| `src/lib/rbac.ts` | Modify | Add permission list, label, and colour for new role |
| `src/lib/validation.ts` | Modify | Extend role enum in `createUserSchema` |
| `src/app/(app)/settings/users/users-client.tsx` | Modify | Add new role option in Add User dialog |

### Implementation Status (Done)

Feature 8 is now implemented.

What was done:

- Added `RAW_MATERIAL_MANAGER` to `prisma/schema.prisma` and created `prisma/migrations/20260404193000_add_raw_material_manager_role/migration.sql` so the database enum accepts the new role.
- Expanded `src/lib/rbac.ts` with the raw-material permission set, a readable role label, and a distinct role color.
- Extended `src/lib/validation.ts` so the add-user flow accepts the new role value.
- Updated `src/app/(app)/settings/users/users-client.tsx` to expose `Raw Material Manager` in the role selector.
- Kept the existing navigation and home-route behavior unchanged because the new permission set already lands the role on the correct raw-material pages.

Process applied:

1. I kept the feature constrained to the role system and the add-user form so it stayed low-risk.
2. I added the database enum migration alongside the schema change so the runtime role value and Prisma types stay aligned.
3. I verified the touched files after patching and then recorded the implementation notes here.

---

## Cross-Cutting Concerns & Shared Infrastructure

### Duration Selector Component

Both Features 2 and 6 need an identical "select a date range for the PDF" dialog. Rather than duplicating this in `finished-goods-client.tsx` and `warehouse-detail-client.tsx`, a shared component is created:

**`src/components/shared/duration-picker-dialog.tsx`**

Props:
```
{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (fromDate: Date, toDate: Date, label: string) => void;
  isLoading?: boolean;
}
```

Internally it manages: preset selection (`today` / `this-week` / `this-month` / `this-year` / `custom`), custom date inputs (shown only when `custom` is selected), and a Confirm button. The `APP_TIME_ZONE` constant from `src/lib/constants.ts` is used for all date boundary computations.

### Shared Infrastructure

The following shared helpers are now implemented and reused across the feature set:

- `src/components/shared/duration-picker-dialog.tsx` powers the PDF duration picker used by Features 2 and 6.
- `src/lib/pdf-utils.ts` centralises PDF date formatting, duration labelling, and browser download logic.
- `src/lib/raw-materials-pdf.ts` centralises raw-material PDF grouping and size formatting.
- `src/lib/fuzzy-search.ts` powers the search used in Feature 4 and the total raw materials view in Feature 5.
- `src/lib/constants.ts` now includes `COMPANY_LETTERHEAD`, which keeps the PDF headers and footers consistent.

No separate read-only banner component was created; the cross-warehouse messaging lives inline in the finished-goods and total raw materials views.

---

## Implementation Order Recommendation

The features should be implemented in the following order to minimise merge conflicts and maximise the ability to test each feature independently:

| Order | Feature | Reason for Order |
|---|---|---|
| 1 | **Feature 8** — New RAW_MATERIAL_MANAGER role | Pure RBAC addition, no UI changes beyond one dropdown item. Very low risk. Unlocks correct permission testing for all RM features. |
| 2 | **Feature 7** — Password Change | Isolated to settings pages. No dependency on any other feature. Low risk, high user value. |
| 3 | **Feature 4** — Enhanced Fuzzy Search | Creates `src/lib/fuzzy-search.ts` which is a dependency of Feature 5. No schema changes. |
| 4 | **Feature 3** — Cross-Warehouse Read Access | Auth/permission logic change. No schema changes. Affects FG pages which are separate from RM pages. |
| 5 | **Feature 1** — Master/Sub Finished Goods | Requires schema migration. Biggest UI change. Should be implemented after auth is stable (Feature 3). |
| 6 | **Feature 5** — Total Raw Materials Page | Creates new routes and actions. Depends on fuzzy search (Feature 4). No schema change. |
| 7 | **Feature 2** — PDF Download for Finished Goods | Depends on Feature 1 (master/sub hierarchy affects PDF structure). Creates PDF infrastructure used by Feature 6. |
| 8 | **Feature 6** — PDF Download for Raw Materials | Depends on Feature 5 (total page) and Feature 2 (shared PDF infrastructure). Implemented last. |

---

## Appendix A — Full List of Files to be Created

| File Path | Purpose |
|---|---|
| `src/lib/fuzzy-search.ts` | Sequential fuzzy matching utility |
| `src/lib/pdf-utils.ts` | Shared PDF generation helpers (date formatting, blob download) |
| `src/lib/raw-materials-pdf.ts` | Raw materials PDF grouping and formatting helpers |
| `src/components/pdf/finished-goods-report.tsx` | React-PDF document for finished goods |
| `src/components/pdf/raw-materials-report.tsx` | React-PDF document for raw materials |
| `src/components/shared/duration-picker-dialog.tsx` | Shared duration selector dialog for PDF generation |
| `src/app/(app)/warehouses/total/page.tsx` | Total raw materials page (server component) |
| `src/app/(app)/warehouses/total/actions.ts` | Server actions for total materials data |
| `src/app/(app)/warehouses/total/total-materials-client.tsx` | Total materials page (client component) |
| `src/app/(app)/settings/account/page.tsx` | My Account / Change Password page |
| `src/app/(app)/settings/account/account-client.tsx` | Account page client component |
| `prisma/migrations/20260404120000_add_finished_goods_hierarchy/` | Migration: add parentId, isContainer to FinishedGood |
| `prisma/migrations/20260404193000_add_raw_material_manager_role/` | Migration: add RAW_MATERIAL_MANAGER to Role enum |

---

## Appendix B — Full List of Files to be Modified

| File Path | What Changes |
|---|---|
| `prisma/schema.prisma` | Add FG hierarchy fields; add RAW_MATERIAL_MANAGER role |
| `src/lib/rbac.ts` | Add RAW_MATERIAL_MANAGER permissions, label, colour |
| `src/lib/auth.ts` | Split readable/writable FG warehouse codes; add cross-warehouse guard |
| `src/lib/validation.ts` | Add changePasswordSchema; extend createUserSchema role enum; add master/sub good schemas |
| `src/lib/constants.ts` | Add COMPANY_LETTERHEAD for branded PDF headers and footers |
| `src/lib/raw-materials.ts` | Add the raw-material fingerprint helper used by the aggregate page |
| `src/app/(app)/finished-goods/actions.ts` | Add createMasterGood, createSubGood, getFinishedGoodsPdfData; modify getFinishedGoodsWarehouseData; add ownership guard |
| `src/app/(app)/finished-goods/page.tsx` | Use readable warehouse codes; pass writable codes to selector |
| `src/app/(app)/finished-goods/[code]/page.tsx` | Compute isOwnWarehouse; pass canManage and isReadOnlyView correctly |
| `src/app/(app)/finished-goods/finished-goods-client.tsx` | Two-level hierarchy render; fuzzy search; read-only banner; PDF button |
| `src/app/(app)/finished-goods/finished-goods-warehouses-client.tsx` | Accept writableWarehouseCodes; mark read-only warehouses |
| `src/app/(app)/warehouses/warehouses-client.tsx` | Add Total Raw Materials card/button |
| `src/app/(app)/warehouses/[code]/warehouse-detail-client.tsx` | Add PDF download button |
| `src/app/(app)/warehouses/[code]/actions.ts` | Add getRawMaterialsPdfData server action |
| `src/app/(app)/settings/actions.ts` | Add changeOwnPassword, adminChangeUserPassword |
| `src/app/(app)/settings/users/users-client.tsx` | Add Reset Password button/dialog; add RAW_MATERIAL_MANAGER option |
| `package.json` | Add @react-pdf/renderer dependency |
| `pnpm-lock.yaml` | Updated by pnpm install |

---

*End of Feature Implementation Plan. This document should be updated as implementation decisions evolve during development.*
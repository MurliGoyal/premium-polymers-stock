# Implementation Plan

## Overview
Fix critical bugs identified across the Premium Polymers inventory management system, including missing imports, race conditions, null reference errors, and edge case handling issues.

## Identified Bugs

### Bug 1: Missing Import in warehouse-detail-client.tsx
**File**: `src/app/(app)/warehouses/[code]/warehouse-detail-client.tsx`
**Issue**: The `formatQuantity` function is called on line 172 but is not imported from `@/lib/utils`. This will cause a runtime error when rendering the mobile card view for materials.
**Impact**: Application crashes on mobile view when displaying warehouse materials.

### Bug 2: Race Condition in transfer-client.tsx
**File**: `src/app/(app)/warehouses/[code]/transfer/transfer-client.tsx`
**Issue**: The `refreshAvailability` function can be called multiple times concurrently (e.g., user clicks refresh button rapidly or form submission triggers refresh). The `isRefreshingAvailability` state prevents UI interaction but doesn't prevent concurrent API calls.
**Impact**: Multiple simultaneous API calls can cause inconsistent state updates and stale data.

### Bug 3: Incorrect Roll Length Formula in add-material-client.tsx
**File**: `src/app/(app)/warehouses/[code]/raw-materials/add/add-material-client.tsx`
**Issue**: The roll length formula in the help text says `abs(weight in kg × 1,000,000 / (gsm × width in mm))` but the actual calculation uses `(weightKg * 1000) / (gsm * widthInMeters)`. The formula description is misleading.
**Impact**: User confusion about how the roll length is calculated.

### Bug 4: Missing Error Boundary for Date Parsing
**File**: `src/app/(app)/transfer-history/transfer-history-client.tsx`
**Issue**: The date filtering uses `new Date(`${fromDate}T00:00:00`)` and `new Date(`${toDate}T23:59:59`)` without validating that the date strings are valid. Invalid date strings will result in `Invalid Date` which may cause unexpected filtering behavior.
**Impact**: Invalid date inputs could cause the filter to show no results or throw errors.

### Bug 5: Potential Null Reference in Dashboard Data
**File**: `src/app/(app)/dashboard/dashboard-client.tsx`
**Issue**: The `peakTransferDay` calculation uses `transferTrendData[0]` as fallback, but if the array is empty, this will be `undefined`. Accessing `peakTransferDay.date` or `peakTransferDay.label` on undefined will cause a crash.
**Impact**: Dashboard crashes when there are no transfer records.

### Bug 6: Missing Validation for Category Deletion
**File**: `src/app/(app)/settings/actions.ts`
**Issue**: The `deleteCategory` function checks for materials using the ID but doesn't check for materials in a transaction. If a material is created between the count check and the delete, the deletion could succeed while materials exist.
**Impact**: Orphaned materials with deleted categories.

### Bug 7: Unhandled Promise Rejection in Form Submission
**File**: `src/app/(app)/warehouses/[code]/raw-materials/add/add-material-client.tsx`
**Issue**: The "Save & add another" button triggers form submission but the `submissionMode` state is set after the click event. If the form validation fails, the mode is still changed.
**Impact**: Incorrect submission mode persists after validation errors.

### Bug 8: Missing Timeout Cleanup in Transfer Client
**File**: `src/app/(app)/warehouses/[code]/transfer/transfer-client.tsx`
**Issue**: The `window.setTimeout` call in `refreshAvailability` doesn't clear the timeout if the component unmounts before it fires.
**Impact**: Potential memory leak and state update on unmounted component.

## Types
No new types are required. Existing types are sufficient.

## Files
- `src/app/(app)/warehouses/[code]/warehouse-detail-client.tsx` - Add missing import
- `src/app/(app)/warehouses/[code]/transfer/transfer-client.tsx` - Fix race condition and timeout cleanup
- `src/app/(app)/warehouses/[code]/raw-materials/add/add-material-client.tsx` - Fix formula description and submission mode handling
- `src/app/(app)/transfer-history/transfer-history-client.tsx` - Add date validation
- `src/app/(app)/dashboard/dashboard-client.tsx` - Fix null reference in peakTransferDay
- `src/app/(app)/settings/actions.ts` - Add transaction safety for deletions

## Functions
- `formatQuantity` import added to `warehouse-detail-client.tsx`
- `refreshAvailability` modified in `transfer-client.tsx` to prevent concurrent calls
- Date validation added to `transfer-history-client.tsx`
- Null check added for `peakTransferDay` in `dashboard-client.tsx`
- Transaction added to `deleteCategory` in `settings/actions.ts`

## Classes
No class modifications required.

## Dependencies
No new dependencies required.

## Testing
- Test mobile view rendering in warehouse detail page
- Test rapid refresh button clicks in transfer form
- Test dashboard with empty transfer data
- Test date filtering with invalid date inputs
- Test category deletion with concurrent material creation

## Implementation Order
1. Fix missing import in warehouse-detail-client.tsx (critical - causes crashes)
2. Fix null reference in dashboard-client.tsx (critical - causes crashes)
3. Fix race condition in transfer-client.tsx (high - data consistency)
4. Add transaction safety for category deletion (high - data integrity)
5. Add date validation in transfer-history-client.tsx (medium - user experience)
6. Fix submission mode handling in add-material-client.tsx (medium - user experience)
7. Fix timeout cleanup in transfer-client.tsx (low - memory optimization)
8. Fix roll length formula description in add-material-client.tsx (low - documentation)
"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRightLeft, CalendarRange, Search } from "lucide-react";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TRANSFER_PAGE_SIZE } from "@/lib/constants";
import { formatDateTime, formatNumber } from "@/lib/utils";

type TransferRecord = {
  id: string;
  warehouseCode: string;
  materialName: string;
  category: string;
  quantity: number;
  unit: string;
  recipientName: string;
  referenceNumber: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  materialSnapshot: Record<string, unknown> | null;
};

export function TransferHistoryClient({
  transfers,
  warehouses,
  recipients,
  categories,
  materials,
  initialWarehouseFilter = "all",
}: {
  transfers: TransferRecord[];
  warehouses: string[];
  recipients: string[];
  categories: string[];
  materials: string[];
  initialWarehouseFilter?: string;
}) {
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState(initialWarehouseFilter);
  const [recipientFilter, setRecipientFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [materialFilter, setMaterialFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRecord | null>(null);
  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(() => {
    return transfers.filter((transfer) => {
      const normalizedSearch = deferredSearch.trim().toLowerCase();
      const createdAt = new Date(transfer.createdAt);

      if (
        normalizedSearch &&
        ![
          transfer.materialName,
          transfer.recipientName,
          transfer.referenceNumber ?? "",
          transfer.category,
          transfer.createdBy,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      ) {
        return false;
      }

      if (warehouseFilter !== "all" && transfer.warehouseCode !== warehouseFilter) return false;
      if (recipientFilter !== "all" && transfer.recipientName !== recipientFilter) return false;
      if (categoryFilter !== "all" && transfer.category !== categoryFilter) return false;
      if (materialFilter !== "all" && transfer.materialName !== materialFilter) return false;
      if (fromDate && createdAt < new Date(`${fromDate}T00:00:00`)) return false;
      if (toDate && createdAt > new Date(`${toDate}T23:59:59`)) return false;

      return true;
    });
  }, [categoryFilter, deferredSearch, fromDate, materialFilter, recipientFilter, toDate, transfers, warehouseFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / TRANSFER_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedTransfers = filtered.slice((currentPage - 1) * TRANSFER_PAGE_SIZE, currentPage * TRANSFER_PAGE_SIZE);
  const activeFilters = [
    warehouseFilter !== "all" ? `Warehouse: ${warehouseFilter}` : null,
    recipientFilter !== "all" ? `Recipient: ${recipientFilter}` : null,
    categoryFilter !== "all" ? `Category: ${categoryFilter}` : null,
    materialFilter !== "all" ? `Material: ${materialFilter}` : null,
    fromDate ? `From: ${fromDate}` : null,
    toDate ? `To: ${toDate}` : null,
  ].filter(Boolean) as string[];

  const snapshot = selectedTransfer?.materialSnapshot;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="rounded-[28px] border bg-card/95 p-6 shadow-sm shadow-slate-950/5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
              <ArrowRightLeft className="h-7 w-7 text-blue-500" />
              Transfer history
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Searchable audit log of all stock deductions, recipients, and reference records.
            </p>
          </div>
          <Badge variant="secondary" className="w-fit rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
            {filtered.length} matching transfers
          </Badge>
        </div>
      </div>

      <Card className="rounded-[28px] border bg-card/95 shadow-sm shadow-slate-950/5">
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-3 xl:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by material, recipient, reference, category, or user"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={warehouseFilter}
              onValueChange={(value) => {
                setWarehouseFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Warehouse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All warehouses</SelectItem>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse} value={warehouse}>
                    {warehouse}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={materialFilter}
              onValueChange={(value) => {
                setMaterialFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Material" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All materials</SelectItem>
                {materials.map((material) => (
                  <SelectItem key={material} value={material}>
                    {material}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={recipientFilter}
              onValueChange={(value) => {
                setRecipientFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Recipient" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All recipients</SelectItem>
                {recipients.map((recipient) => (
                  <SelectItem key={recipient} value={recipient}>
                    {recipient}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={categoryFilter}
              onValueChange={(value) => {
                setCategoryFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-md lg:grid-cols-2">
            <div className="space-y-1.5">
              <LabelText>From date</LabelText>
              <Input
                type="date"
                value={fromDate}
                onChange={(event) => {
                  setFromDate(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <LabelText>To date</LabelText>
              <Input
                type="date"
                value={toDate}
                onChange={(event) => {
                  setToDate(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          {activeFilters.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <Badge key={filter} variant="outline" className="rounded-full px-3 py-1 text-[11px]">
                  <CalendarRange className="mr-1 h-3 w-3" />
                  {filter}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-[28px] border bg-card/95 shadow-sm shadow-slate-950/5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <ArrowRightLeft className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">No transfers found</h3>
            <p className="mt-1 text-sm text-muted-foreground">Adjust your filters or broaden the date range.</p>
          </div>
        ) : (
          <>
            <div className="max-h-[640px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow className="hover:bg-card">
                    <TableHead>Reference</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Created by</TableHead>
                    <TableHead>Date / time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransfers.map((transfer) => (
                    <TableRow
                      key={transfer.id}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                      onClick={() => setSelectedTransfer(transfer)}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {transfer.referenceNumber || transfer.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {transfer.warehouseCode}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{transfer.materialName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{transfer.category}</TableCell>
                      <TableCell>
                        <span className="font-semibold text-orange-600">-{formatNumber(transfer.quantity)}</span>
                        <span className="ml-1 text-xs text-muted-foreground">{transfer.unit}</span>
                      </TableCell>
                      <TableCell>{transfer.recipientName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{transfer.createdBy}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDateTime(transfer.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <PaginationControls
              page={currentPage}
              pageCount={pageCount}
              itemCount={filtered.length}
              pageSize={TRANSFER_PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <Sheet open={!!selectedTransfer} onOpenChange={() => setSelectedTransfer(null)}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Transfer detail</SheetTitle>
            <SheetDescription>{selectedTransfer?.referenceNumber || selectedTransfer?.id.slice(0, 8)}</SheetDescription>
          </SheetHeader>
          {selectedTransfer ? (
            <div className="mt-6 space-y-5">
              <div className="grid gap-4 rounded-2xl border bg-muted/30 p-4 sm:grid-cols-2">
                <DetailBlock label="Warehouse" value={selectedTransfer.warehouseCode} />
                <DetailBlock label="Recipient" value={selectedTransfer.recipientName} />
                <DetailBlock label="Quantity" value={`${formatNumber(selectedTransfer.quantity)} ${selectedTransfer.unit}`} accent />
                <DetailBlock label="Performed by" value={selectedTransfer.createdBy} />
                <DetailBlock label="Category" value={selectedTransfer.category} />
                <DetailBlock label="Date / time" value={formatDateTime(selectedTransfer.createdAt)} />
              </div>

              {selectedTransfer.notes ? (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Notes</p>
                    <p className="mt-2 text-sm">{selectedTransfer.notes}</p>
                  </div>
                </>
              ) : null}

              {snapshot ? (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Material snapshot at transfer time</p>
                      <p className="mt-2 text-lg font-semibold">{String(snapshot.name ?? selectedTransfer.materialName)}</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <DetailBlock label="Base unit" value={String(snapshot.baseUnit ?? selectedTransfer.unit)} />
                      <DetailBlock label="Minimum stock" value={String(snapshot.minimumStock ?? "-")} />
                      <DetailBlock label="Stock before transfer" value={String(snapshot.stockBeforeTransfer ?? "-")} />
                      <DetailBlock label="Stock after transfer" value={String(snapshot.stockAfterTransfer ?? "-")} accent />
                      <DetailBlock label="Thickness" value={formatOptionalMeasurement(snapshot.thicknessValue, snapshot.thicknessUnit)} />
                      <DetailBlock label="Size" value={formatOptionalMeasurement(snapshot.sizeValue, snapshot.sizeUnit)} />
                      <DetailBlock label="Weight" value={formatOptionalMeasurement(snapshot.weightValue, snapshot.weightUnit)} />
                      <DetailBlock label="GSM" value={String(snapshot.gsm ?? "-")} />
                    </div>
                    {snapshot.notes ? (
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Snapshot notes</p>
                        <p className="mt-2 text-sm">{String(snapshot.notes)}</p>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}

function DetailBlock({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={accent ? "mt-2 font-semibold text-primary" : "mt-2 font-medium"}>{value}</p>
    </div>
  );
}

function LabelText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{children}</p>;
}

function formatOptionalMeasurement(value: unknown, unit: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return `${String(value)}${unit ? ` ${String(unit)}` : ""}`;
}

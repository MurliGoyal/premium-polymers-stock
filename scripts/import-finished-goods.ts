import path from "node:path";
import fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { MaterialStatus, Prisma, PrismaClient, FinishedGoodActivityType } from "@prisma/client";

function parseArg(name: string, fallback?: string) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  if (!raw) return fallback;
  return raw.slice(prefix.length);
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function buildNormalizedFinishedGoodKey(params: {
  warehouseCode: string;
  name: string;
  diameterValue?: number;
  diameterUnit?: string;
}) {
  const warehouse = params.warehouseCode.trim().toLowerCase();
  const name = normalizeName(params.name).toLowerCase();

  if (params.diameterValue === undefined) {
    return `${warehouse}::${name}`;
  }

  const diameterValue = String(params.diameterValue);
  const diameterUnit = params.diameterUnit?.trim().toLowerCase();
  return diameterUnit
    ? `${warehouse}::${name}::${diameterValue}::${diameterUnit}`
    : `${warehouse}::${name}::${diameterValue}`;
}

function resolveStatus(stock: Prisma.Decimal) {
  return stock.lte(0) ? MaterialStatus.OUT_OF_STOCK : MaterialStatus.IN_STOCK;
}

type AggregatedRow = {
  name: string;
  diameterValue: number;
  balance: number;
};

function parseCsv(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("CSV is empty or missing data rows.");
  }

  const header = lines[0].toLowerCase();
  if (!header.includes("item") || !header.includes("size") || !header.includes("balance")) {
    throw new Error("Unexpected CSV header. Expected ITEM, SIZE DIA. (MM), BALANCE.");
  }

  const aggregate = new Map<string, AggregatedRow>();

  for (let i = 1; i < lines.length; i += 1) {
    const row = lines[i];
    const parts = row.split(",");

    if (parts.length < 3) {
      continue;
    }

    const name = normalizeName(parts[0]);
    const diameterValue = Number(parts[1]);
    const balance = Number(parts[2]);

    if (!name) continue;
    if (!Number.isFinite(diameterValue) || diameterValue < 0) {
      throw new Error(`Invalid diameter at row ${i + 1}: ${parts[1]}`);
    }
    if (!Number.isFinite(balance) || balance < 0) {
      throw new Error(`Invalid balance at row ${i + 1}: ${parts[2]}`);
    }

    const key = `${name.toLowerCase()}::${diameterValue}`;
    const existing = aggregate.get(key);
    if (existing) {
      existing.balance += balance;
    } else {
      aggregate.set(key, { name, diameterValue, balance });
    }
  }

  return Array.from(aggregate.values());
}

async function main() {
  const csvPathArg = parseArg("file", path.join("data", "F-12 PROD. & DISPATCH WADS (JANUARY) - Extracted Table.csv"));
  const warehouseCode = parseArg("warehouse", "F-12") as string;
  const baseUnit = parseArg("unit", "pcs") as string;
  const diameterUnit = parseArg("diameterUnit", "mm") as string;

  const csvPath = path.isAbsolute(csvPathArg as string)
    ? (csvPathArg as string)
    : path.join(process.cwd(), csvPathArg as string);

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const rows = parseCsv(csvPath);
  if (rows.length === 0) {
    throw new Error("No valid rows found in CSV.");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  let created = 0;
  let updated = 0;

  try {
    for (const row of rows) {
      const normalizedName = buildNormalizedFinishedGoodKey({
        warehouseCode,
        name: row.name,
        diameterValue: row.diameterValue,
        diameterUnit,
      });

      const targetStock = new Prisma.Decimal(row.balance);

      await prisma.$transaction(async (tx) => {
        const existing = await tx.finishedGood.findUnique({ where: { normalizedName } });

        if (!existing) {
          const fg = await tx.finishedGood.create({
            data: {
              warehouseCode,
              name: row.name,
              normalizedName,
              baseUnit,
              diameterValue: row.diameterValue,
              diameterUnit,
              currentStock: targetStock,
              status: resolveStatus(targetStock),
            },
          });

          await tx.finishedGoodActivityLog.create({
            data: {
              finishedGoodId: fg.id,
              warehouseCode,
              activityType: FinishedGoodActivityType.PRODUCTION,
              quantityChange: targetStock,
              previousStock: new Prisma.Decimal(0),
              newStock: targetStock,
              notes: "Imported from CSV",
            },
          });

          created += 1;
          return;
        }

        const previousStock = existing.currentStock;
        const quantityChange = targetStock.minus(previousStock);

        await tx.finishedGood.update({
          where: { id: existing.id },
          data: {
            name: row.name,
            baseUnit,
            diameterValue: row.diameterValue,
            diameterUnit,
            currentStock: targetStock,
            status: resolveStatus(targetStock),
          },
        });

        if (!quantityChange.eq(0)) {
          await tx.finishedGoodActivityLog.create({
            data: {
              finishedGoodId: existing.id,
              warehouseCode,
              activityType: FinishedGoodActivityType.STOCK_ADJUSTED,
              quantityChange,
              previousStock,
              newStock: targetStock,
              notes: "CSV import sync",
            },
          });
        }

        updated += 1;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }

    console.log(`Imported ${rows.length} unique rows.`);
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

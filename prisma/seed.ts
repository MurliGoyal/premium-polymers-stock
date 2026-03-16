import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role, MaterialStatus, ActivityType, TransactionType, NotificationType } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { normalizeRecordName } from "../src/lib/naming";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // ─── Users ──────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@premiumpolymers.com" },
    update: {},
    create: { name: "Daryl Admin", email: "admin@premiumpolymers.com", passwordHash, role: Role.ADMIN },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@premiumpolymers.com" },
    update: {},
    create: { name: "Ravi Manager", email: "manager@premiumpolymers.com", passwordHash, role: Role.MANAGER },
  });

  const operator = await prisma.user.upsert({
    where: { email: "operator@premiumpolymers.com" },
    update: {},
    create: { name: "Amit Operator", email: "operator@premiumpolymers.com", passwordHash, role: Role.OPERATOR },
  });

  await prisma.user.upsert({
    where: { email: "viewer@premiumpolymers.com" },
    update: {},
    create: { name: "Priya Viewer", email: "viewer@premiumpolymers.com", passwordHash, role: Role.VIEWER },
  });

  console.log("  ✅ Users seeded");

  // ─── Warehouses ─────────────────────────────────────────────
  const warehouseE219 = await prisma.warehouse.upsert({
    where: { code: "E-219" },
    update: {},
    create: { code: "E-219", name: "Warehouse E-219 (Main Storage)", slug: "e-219" },
  });

  const warehouseF12 = await prisma.warehouse.upsert({
    where: { code: "F-12" },
    update: {},
    create: { code: "F-12", name: "Warehouse F-12 (Secondary)", slug: "f-12" },
  });

  console.log("  ✅ Warehouses seeded");

  // ─── Categories ─────────────────────────────────────────────
  const categoryData = [
    { name: "Polymer Resin", slug: "polymer-resin" },
    { name: "Adhesive", slug: "adhesive" },
    { name: "Film & Sheet", slug: "film-sheet" },
    { name: "Fiber & Yarn", slug: "fiber-yarn" },
    { name: "Packaging Material", slug: "packaging-material" },
    { name: "Colorant & Masterbatch", slug: "colorant-masterbatch" },
    { name: "Chemical Additive", slug: "chemical-additive" },
    { name: "Coating & Paint", slug: "coating-paint" },
    { name: "Foam Material", slug: "foam-material" },
    { name: "Rubber Compound", slug: "rubber-compound" },
    { name: "Wax & Lubricant", slug: "wax-lubricant" },
    { name: "Recycled Polymer", slug: "recycled-polymer" },
  ];

  const categories: Record<string, { id: string }> = {};
  for (const cat of categoryData) {
    const normalizedName = normalizeRecordName(cat.name);
    const c = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        normalizedName,
      },
      create: {
        ...cat,
        normalizedName,
      },
    });
    categories[cat.slug] = c;
  }

  console.log("  ✅ Categories seeded");

  // ─── Recipients ─────────────────────────────────────────────
  const recipientNames = [
    "Production Floor A",
    "Production Floor B",
    "R&D Laboratory",
    "Quality Control Dept",
    "Packaging Unit C",
    "Extrusion Line 1",
    "External Vendor - PolyTech",
  ];

  const recipients: Record<string, { id: string }> = {};
  for (const name of recipientNames) {
    const normalizedName = normalizeRecordName(name);
    const r = await prisma.recipient.upsert({
      where: { normalizedName },
      update: {
        name,
        normalizedName,
      },
      create: { name, normalizedName },
    });
    recipients[name] = r;
  }

  console.log("  ✅ Recipients seeded");

  // ─── Raw Materials ──────────────────────────────────────────
  const materialsData = [
    { name: "HDPE Resin HM9450F", cat: "polymer-resin", unit: "kg", stock: 2500, min: 500, wh: warehouseE219.id, thickness: null, size: null, weight: 25, weightUnit: "kg", gsm: null },
    { name: "LDPE Film Grade FE8000", cat: "polymer-resin", unit: "kg", stock: 1800, min: 400, wh: warehouseE219.id, thickness: null, size: null, weight: 25, weightUnit: "kg", gsm: null },
    { name: "PP Copolymer RC5032", cat: "polymer-resin", unit: "kg", stock: 120, min: 300, wh: warehouseE219.id, thickness: null, size: null, weight: 25, weightUnit: "kg", gsm: null },
    { name: "EVA Hot Melt Adhesive 7420", cat: "adhesive", unit: "kg", stock: 350, min: 100, wh: warehouseE219.id, thickness: null, size: null, weight: 20, weightUnit: "kg", gsm: null },
    { name: "PET Shrink Film 25μ", cat: "film-sheet", unit: "roll", stock: 45, min: 20, wh: warehouseE219.id, thickness: 0.025, size: "1000x5000", weight: 12, weightUnit: "kg", gsm: 25 },
    { name: "BOPP Metallised Film", cat: "film-sheet", unit: "roll", stock: 12, min: 15, wh: warehouseE219.id, thickness: 0.012, size: "800x3000", weight: 8, weightUnit: "kg", gsm: 20 },
    { name: "Titanium Dioxide (TiO2)", cat: "colorant-masterbatch", unit: "kg", stock: 800, min: 200, wh: warehouseE219.id, thickness: null, size: null, weight: 25, weightUnit: "kg", gsm: null },
    { name: "Carbon Black Masterbatch", cat: "colorant-masterbatch", unit: "kg", stock: 0, min: 150, wh: warehouseE219.id, thickness: null, size: null, weight: 25, weightUnit: "kg", gsm: null },
    { name: "UV Stabilizer Tinuvin 770", cat: "chemical-additive", unit: "kg", stock: 180, min: 50, wh: warehouseE219.id, thickness: null, size: null, weight: 10, weightUnit: "kg", gsm: null },
    { name: "Calcium Carbonate (CaCO3)", cat: "chemical-additive", unit: "kg", stock: 3200, min: 500, wh: warehouseE219.id, thickness: null, size: null, weight: 50, weightUnit: "kg", gsm: null },
    { name: "PE Stretch Wrap 23μ", cat: "packaging-material", unit: "roll", stock: 85, min: 30, wh: warehouseE219.id, thickness: 0.023, size: "500x200", weight: 3.5, weightUnit: "kg", gsm: 23 },
    { name: "Polypropylene Yarn 900D", cat: "fiber-yarn", unit: "kg", stock: 650, min: 200, wh: warehouseE219.id, thickness: null, size: null, weight: 20, weightUnit: "kg", gsm: null },
    // Warehouse F-12
    { name: "LLDPE Resin LL6201", cat: "polymer-resin", unit: "kg", stock: 1500, min: 400, wh: warehouseF12.id, thickness: null, size: null, weight: 25, weightUnit: "kg", gsm: null },
    { name: "PVC Compound Rigid", cat: "polymer-resin", unit: "kg", stock: 900, min: 250, wh: warehouseF12.id, thickness: null, size: null, weight: 25, weightUnit: "kg", gsm: null },
    { name: "Polyester Film 12μ", cat: "film-sheet", unit: "roll", stock: 8, min: 10, wh: warehouseF12.id, thickness: 0.012, size: "1200x3000", weight: 15, weightUnit: "kg", gsm: 17 },
    { name: "Nylon 6 Chips", cat: "polymer-resin", unit: "kg", stock: 450, min: 150, wh: warehouseF12.id, thickness: null, size: null, weight: 25, weightUnit: "kg", gsm: null },
    { name: "Epoxy Resin Clear", cat: "adhesive", unit: "litre", stock: 75, min: 20, wh: warehouseF12.id, thickness: null, size: null, weight: 1.2, weightUnit: "kg", gsm: null },
    { name: "PE Foam Sheet 5mm", cat: "foam-material", unit: "sheet", stock: 200, min: 50, wh: warehouseF12.id, thickness: 5, size: "2000x1000", weight: 0.5, weightUnit: "kg", gsm: null },
    { name: "SBR Rubber Compound", cat: "rubber-compound", unit: "kg", stock: 380, min: 100, wh: warehouseF12.id, thickness: null, size: null, weight: 25, weightUnit: "kg", gsm: null },
    { name: "Paraffin Wax 58°C", cat: "wax-lubricant", unit: "kg", stock: 520, min: 100, wh: warehouseF12.id, thickness: null, size: null, weight: 25, weightUnit: "kg", gsm: null },
    { name: "Anti-Block Agent MB", cat: "chemical-additive", unit: "kg", stock: 90, min: 40, wh: warehouseF12.id, thickness: null, size: null, weight: 20, weightUnit: "kg", gsm: null },
    { name: "Recycled HDPE Flakes", cat: "recycled-polymer", unit: "kg", stock: 2200, min: 500, wh: warehouseF12.id, thickness: null, size: null, weight: 50, weightUnit: "kg", gsm: null },
    { name: "Acrylic Coating Clear", cat: "coating-paint", unit: "litre", stock: 0, min: 30, wh: warehouseF12.id, thickness: null, size: null, weight: 1.1, weightUnit: "kg", gsm: null },
  ];

  const createdMaterials: { id: string; name: string; warehouseId: string; stock: number; min: number; unit: string }[] = [];

  for (const mat of materialsData) {
    const status = mat.stock <= 0 ? MaterialStatus.OUT_OF_STOCK : mat.stock <= mat.min ? MaterialStatus.LOW_STOCK : MaterialStatus.IN_STOCK;

    const m = await prisma.rawMaterial.create({
      data: {
        warehouseId: mat.wh,
        name: mat.name,
        normalizedName: normalizeRecordName(mat.name),
        categoryId: categories[mat.cat].id,
        baseUnit: mat.unit,
        currentStock: mat.stock,
        minimumStock: mat.min,
        thicknessValue: mat.thickness,
        thicknessUnit: mat.thickness ? "mm" : null,
        sizeValue: mat.size,
        sizeUnit: mat.size ? "mm" : null,
        weightValue: mat.weight,
        weightUnit: mat.weightUnit,
        gsm: mat.gsm,
        status,
        createdById: admin.id,
      },
    });

    createdMaterials.push({ id: m.id, name: m.name, warehouseId: mat.wh, stock: mat.stock, min: mat.min, unit: mat.unit });

    // Activity log for creation
    await prisma.rawMaterialActivityLog.create({
      data: {
        rawMaterialId: m.id,
        warehouseId: mat.wh,
        activityType: ActivityType.CREATED,
        afterSnapshot: { name: mat.name, stock: mat.stock, unit: mat.unit },
        performedById: admin.id,
      },
    });

    // Stock transaction for initial stock
    await prisma.stockTransaction.create({
      data: {
        warehouseId: mat.wh,
        rawMaterialId: m.id,
        transactionType: TransactionType.INITIAL,
        quantity: mat.stock,
        previousStock: 0,
        newStock: mat.stock,
        sourceType: "CREATION",
        createdById: admin.id,
      },
    });
  }

  console.log("  ✅ Raw Materials seeded");

  // ─── Sample Transfers ───────────────────────────────────────
  const transferData = [
    { materialIdx: 0, recipientName: "Production Floor A", qty: 200, user: admin, ref: "TRF-2024-001" },
    { materialIdx: 0, recipientName: "Extrusion Line 1", qty: 150, user: manager, ref: "TRF-2024-002" },
    { materialIdx: 1, recipientName: "Production Floor B", qty: 300, user: operator, ref: "TRF-2024-003" },
    { materialIdx: 4, recipientName: "Packaging Unit C", qty: 5, user: manager, ref: "TRF-2024-004" },
    { materialIdx: 6, recipientName: "R&D Laboratory", qty: 50, user: admin, ref: "TRF-2024-005" },
    { materialIdx: 9, recipientName: "Production Floor A", qty: 500, user: operator, ref: "TRF-2024-006" },
    { materialIdx: 11, recipientName: "Extrusion Line 1", qty: 100, user: manager, ref: "TRF-2024-007" },
    { materialIdx: 12, recipientName: "Production Floor B", qty: 200, user: admin, ref: "TRF-2024-008" },
    { materialIdx: 13, recipientName: "External Vendor - PolyTech", qty: 100, user: manager, ref: "TRF-2024-009" },
    { materialIdx: 15, recipientName: "R&D Laboratory", qty: 50, user: operator, ref: "TRF-2024-010" },
    { materialIdx: 17, recipientName: "Production Floor A", qty: 30, user: admin, ref: "TRF-2024-011" },
    { materialIdx: 18, recipientName: "Quality Control Dept", qty: 80, user: admin, ref: "TRF-2024-012" },
    { materialIdx: 19, recipientName: "Production Floor B", qty: 120, user: manager, ref: "TRF-2024-013" },
    { materialIdx: 20, recipientName: "R&D Laboratory", qty: 20, user: operator, ref: "TRF-2024-014" },
    { materialIdx: 21, recipientName: "Extrusion Line 1", qty: 500, user: admin, ref: "TRF-2024-015" },
  ];

  for (const t of transferData) {
    const mat = createdMaterials[t.materialIdx];
    if (!mat || mat.stock <= 0) continue;

    const transferQty = Math.min(t.qty, mat.stock);
    const newStock = mat.stock - transferQty;

    const transfer = await prisma.transfer.create({
      data: {
        warehouseId: mat.warehouseId,
        rawMaterialId: mat.id,
        quantity: transferQty,
        recipientId: recipients[t.recipientName].id,
        referenceNumber: t.ref,
        notes: `Seed transfer: ${transferQty} ${mat.unit} of ${mat.name}`,
        createdById: t.user.id,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 6) * 24 * 60 * 60 * 1000),
      },
    });

    // Update material stock
    const newStatus = newStock <= 0 ? MaterialStatus.OUT_OF_STOCK : newStock <= mat.min ? MaterialStatus.LOW_STOCK : MaterialStatus.IN_STOCK;
    await prisma.rawMaterial.update({
      where: { id: mat.id },
      data: { currentStock: newStock, status: newStatus },
    });
    mat.stock = newStock;

    // Activity log
    await prisma.rawMaterialActivityLog.create({
      data: {
        rawMaterialId: mat.id,
        warehouseId: mat.warehouseId,
        activityType: ActivityType.TRANSFER_DEDUCTION,
        beforeSnapshot: { stock: mat.stock + transferQty },
        afterSnapshot: { stock: newStock },
        quantityChange: -transferQty,
        sourceType: "TRANSFER",
        sourceId: transfer.id,
        performedById: t.user.id,
      },
    });

    // Stock transaction
    await prisma.stockTransaction.create({
      data: {
        warehouseId: mat.warehouseId,
        rawMaterialId: mat.id,
        transactionType: TransactionType.TRANSFER,
        quantity: transferQty,
        previousStock: mat.stock + transferQty,
        newStock,
        sourceType: "TRANSFER",
        sourceId: transfer.id,
        createdById: t.user.id,
      },
    });

    // Low stock notification
    if (newStatus === MaterialStatus.LOW_STOCK || newStatus === MaterialStatus.OUT_OF_STOCK) {
      await prisma.notification.create({
        data: {
          type: newStatus === MaterialStatus.OUT_OF_STOCK ? NotificationType.OUT_OF_STOCK : NotificationType.LOW_STOCK,
          warehouseId: mat.warehouseId,
          rawMaterialId: mat.id,
          message: `${mat.name} is ${newStatus === MaterialStatus.OUT_OF_STOCK ? "out of stock" : "running low"} (${newStock} ${mat.unit} remaining)`,
        },
      });
    }
  }

  console.log("  ✅ Transfers seeded");
  console.log("✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

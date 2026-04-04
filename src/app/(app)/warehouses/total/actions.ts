"use server";

import { MaterialStatus, Prisma } from "@prisma/client";
import { assertServerPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { quantityToNumber, sumQuantities } from "@/lib/quantities";
import { formatRawMaterialDisplayName, buildRawMaterialFingerprint } from "@/lib/raw-materials";
import { buildRawMaterialsPdfCategories } from "@/lib/raw-materials-pdf";
import { resolveMaterialStatus } from "@/lib/inventory";

type RawMaterialSourceRecord = {
  category: { id: string; name: string };
  currentStock: Prisma.Decimal;
  gsm: number | null;
  id: string;
  minimumStock: Prisma.Decimal;
  micron: number | null;
  name: string;
  normalizedName: string | null;
  sizeUnit: string | null;
  sizeValue: string | null;
  status: MaterialStatus;
  thicknessUnit: string | null;
  thicknessValue: number | null;
  updatedAt: Date;
  vendorName: string | null;
  warehouse: { code: string; name: string; slug: string };
  baseUnit: string;
};

export type TotalRawMaterialSource = {
  currentStock: number;
  minimumStock: number;
  status: MaterialStatus;
  updatedAt: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseSlug: string;
};

export type TotalRawMaterialRecord = {
  baseUnit: string;
  category: string;
  currentStock: number;
  displayName: string;
  gsm: number | null;
  id: string;
  minimumStock: number;
  micron: number | null;
  name: string;
  sizeUnit: string | null;
  sizeValue: string | null;
  status: MaterialStatus;
  sourceWarehouses: TotalRawMaterialSource[];
  thicknessUnit: string | null;
  thicknessValue: number | null;
  updatedAt: string;
  vendorName: string | null;
};

export async function getTotalRawMaterialsData(): Promise<{ materials: TotalRawMaterialRecord[] }> {
  await assertServerPermission("raw_materials:view");

  const materials = await prisma.rawMaterial.findMany({
    select: {
      id: true,
      name: true,
      normalizedName: true,
      vendorName: true,
      baseUnit: true,
      currentStock: true,
      minimumStock: true,
      thicknessValue: true,
      thicknessUnit: true,
      sizeValue: true,
      sizeUnit: true,
      gsm: true,
      micron: true,
      status: true,
      updatedAt: true,
      category: { select: { id: true, name: true } },
      warehouse: { select: { code: true, name: true, slug: true } },
    },
    orderBy: [{ name: "asc" }, { updatedAt: "desc" }],
  });

  const grouped = new Map<string, RawMaterialSourceRecord[]>();

  for (const material of materials) {
    const fingerprint = buildRawMaterialFingerprint({
      name: material.name,
      normalizedName: material.normalizedName,
      baseUnit: material.baseUnit,
      gsm: material.gsm,
      micron: material.micron,
      thicknessValue: material.thicknessValue,
      thicknessUnit: material.thicknessUnit,
      sizeValue: material.sizeValue,
      sizeUnit: material.sizeUnit,
    });

    const entries = grouped.get(fingerprint);
    if (entries) {
      entries.push(material);
    } else {
      grouped.set(fingerprint, [material]);
    }
  }

  return {
    materials: Array.from(grouped.entries())
      .map(([fingerprint, members]) => {
        const representative = members[0];
        const totalCurrentStock = sumQuantities(members.map((member) => member.currentStock));
        const totalMinimumStock = sumQuantities(members.map((member) => member.minimumStock));
        const status = resolveMaterialStatus(totalCurrentStock, totalMinimumStock);
        const latestUpdatedAt = members.reduce(
          (latest, member) => (member.updatedAt > latest ? member.updatedAt : latest),
          members[0].updatedAt,
        );

        const sourceMap = new Map<string, TotalRawMaterialSource>();

        for (const member of members) {
          const currentStock = quantityToNumber(member.currentStock);
          const minimumStock = quantityToNumber(member.minimumStock);
          const updatedAt = member.updatedAt.toISOString();
          const existingSource = sourceMap.get(member.warehouse.code);

          if (existingSource) {
            existingSource.currentStock += currentStock;
            existingSource.minimumStock += minimumStock;
            if (updatedAt > existingSource.updatedAt) {
              existingSource.updatedAt = updatedAt;
            }
            existingSource.status = resolveMaterialStatus(existingSource.currentStock, existingSource.minimumStock);
            continue;
          }

          sourceMap.set(member.warehouse.code, {
            currentStock,
            minimumStock,
            status: member.status,
            updatedAt,
            warehouseCode: member.warehouse.code,
            warehouseName: member.warehouse.name,
            warehouseSlug: member.warehouse.slug,
          });
        }

        const sourceWarehouses = Array.from(sourceMap.values()).sort((left, right) =>
          left.warehouseCode.localeCompare(right.warehouseCode),
        );

        return {
          baseUnit: representative.baseUnit,
          category: representative.category.name,
          currentStock: quantityToNumber(totalCurrentStock),
          displayName: formatRawMaterialDisplayName({
            name: representative.name,
            thicknessValue: representative.thicknessValue,
            thicknessUnit: representative.thicknessUnit,
            sizeValue: representative.sizeValue,
            sizeUnit: representative.sizeUnit,
            gsm: representative.gsm,
            micron: representative.micron,
          }),
          gsm: representative.gsm,
          id: fingerprint,
          minimumStock: quantityToNumber(totalMinimumStock),
          micron: representative.micron,
          name: representative.name,
          sizeUnit: representative.sizeUnit,
          sizeValue: representative.sizeValue,
          status,
          sourceWarehouses,
          thicknessUnit: representative.thicknessUnit,
          thicknessValue: representative.thicknessValue,
          updatedAt: latestUpdatedAt.toISOString(),
          vendorName: representative.vendorName,
        };
      })
      .sort((left, right) => {
        const byName = left.name.localeCompare(right.name);
        if (byName !== 0) {
          return byName;
        }

        const byCategory = left.category.localeCompare(right.category);
        if (byCategory !== 0) {
          return byCategory;
        }

        return left.displayName.localeCompare(right.displayName);
      }),
  };
}

  export async function getTotalRawMaterialsPdfData(payload: { fromDate: string; toDate: string; includeAllMaterials?: boolean }) {
    await assertServerPermission("raw_materials:view");

    const fromDate = new Date(payload.fromDate);
    const toDate = new Date(payload.toDate);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new Error("Select a valid date range.");
    }

    if (fromDate > toDate) {
      throw new Error("From date must be before to date.");
    }

    const { materials } = await getTotalRawMaterialsData();

    return {
      categories: buildRawMaterialsPdfCategories(materials, {
        fromDate,
        toDate,
        includeAllMaterials: payload.includeAllMaterials,
      }),
    };
  }
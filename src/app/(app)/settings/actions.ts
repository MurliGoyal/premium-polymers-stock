"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertServerPermission } from "@/lib/auth";
import { categoryNameSchema, recipientNameSchema } from "@/lib/validation";
import { slugify } from "@/lib/utils";

// Categories
export async function getCategories() {
  await assertServerPermission("categories:manage");
  return prisma.category.findMany({
    include: { _count: { select: { rawMaterials: true } } },
    orderBy: { name: "asc" },
  });
}

export async function addCategory(name: string) {
  await assertServerPermission("categories:manage");
  const parsedName = categoryNameSchema.parse(name);
  const slug = slugify(parsedName);
  const existing = await prisma.category.findFirst({
    where: {
      OR: [{ slug }, { name: { equals: parsedName, mode: "insensitive" } }],
    },
  });

  if (existing) return existing;

  const category = await prisma.category.create({ data: { name: parsedName, slug } });
  revalidatePath("/settings/categories");
  revalidatePath("/warehouses");
  return category;
}

export async function deleteCategory(id: string) {
  await assertServerPermission("categories:manage");
  const count = await prisma.rawMaterial.count({ where: { categoryId: id } });
  if (count > 0) throw new Error("Cannot delete category with existing materials");
  await prisma.category.delete({ where: { id } });
  revalidatePath("/settings/categories");
}

// Recipients
export async function getRecipientsWithCount() {
  await assertServerPermission("recipients:manage");
  return prisma.recipient.findMany({
    include: { _count: { select: { transfers: true } } },
    orderBy: { name: "asc" },
  });
}

export async function addRecipient(name: string) {
  await assertServerPermission("recipients:manage");
  const parsedName = recipientNameSchema.parse(name);
  const existing = await prisma.recipient.findFirst({
    where: { name: { equals: parsedName, mode: "insensitive" } },
  });
  if (existing) return existing;

  const recipient = await prisma.recipient.create({ data: { name: parsedName } });
  revalidatePath("/settings/recipients");
  return recipient;
}

export async function deleteRecipient(id: string) {
  await assertServerPermission("recipients:manage");
  const count = await prisma.transfer.count({ where: { recipientId: id } });
  if (count > 0) throw new Error("Cannot delete recipient with existing transfers");
  await prisma.recipient.delete({ where: { id } });
  revalidatePath("/settings/recipients");
}

// Users
export async function getUsers() {
  await assertServerPermission("users:manage");
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

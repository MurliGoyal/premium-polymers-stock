"use server";

import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertServerPermission } from "@/lib/auth";
import { normalizeRecordName } from "@/lib/naming";
import { categoryNameSchema, createUserSchema, recipientNameSchema } from "@/lib/validation";
import { slugify } from "@/lib/utils";

type CreatedEntityResult<T> = {
  created: boolean;
  entity: T;
};

const OPERATIONAL_DELETE_CONFIRMATION = "DELETE INVENTORY";

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// Categories
export async function getCategories() {
  await assertServerPermission("categories:view");
  return prisma.category.findMany({
    include: {
      _count: { select: { rawMaterials: true } },
      subcategories: {
        include: { _count: { select: { rawMaterials: true } } },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function addCategory(name: string): Promise<CreatedEntityResult<{ id: string; name: string; slug: string }>> {
  await assertServerPermission("categories:manage");
  const parsedName = categoryNameSchema.parse(name);
  const normalizedName = normalizeRecordName(parsedName);
  const slug = slugify(parsedName);
  const existing = await prisma.category.findFirst({
    where: {
      OR: [{ normalizedName }, { slug }, { name: { equals: parsedName, mode: "insensitive" } }],
    },
  });

  if (existing) {
    return {
      created: false,
      entity: { id: existing.id, name: existing.name, slug: existing.slug },
    };
  }

  try {
    const category = await prisma.category.create({ data: { name: parsedName, normalizedName, slug } });
    revalidatePath("/settings/categories");
    revalidatePath("/warehouses");
    return {
      created: true,
      entity: { id: category.id, name: category.name, slug: category.slug },
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const concurrentCategory = await prisma.category.findFirst({
      where: {
        OR: [{ normalizedName }, { slug }],
      },
    });

    if (!concurrentCategory) {
      throw error;
    }

    return {
      created: false,
      entity: { id: concurrentCategory.id, name: concurrentCategory.name, slug: concurrentCategory.slug },
    };
  }
}

export async function deleteCategory(id: string) {
  await assertServerPermission("categories:manage");
  const deleted = await prisma.category.deleteMany({
    where: {
      id,
      rawMaterials: { none: {} },
    },
  });

  if (deleted.count === 0) {
    const category = await prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!category) {
      throw new Error("Category not found");
    }

    throw new Error("Cannot delete category with existing materials");
  }

  revalidatePath("/settings/categories");
}

// Subcategories
export async function addSubcategory(
  categoryId: string,
  name: string
): Promise<CreatedEntityResult<{ id: string; name: string; slug: string }>> {
  await assertServerPermission("categories:manage");
  const parsedName = categoryNameSchema.parse(name);
  const normalizedName = normalizeRecordName(parsedName);
  const slug = slugify(parsedName);

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new Error("Category not found");

  const existing = await prisma.subcategory.findFirst({
    where: {
      categoryId,
      OR: [{ normalizedName }, { slug }, { name: { equals: parsedName, mode: "insensitive" } }],
    },
  });

  if (existing) {
    return { created: false, entity: { id: existing.id, name: existing.name, slug: existing.slug } };
  }

  try {
    const subcategory = await prisma.subcategory.create({
      data: { name: parsedName, normalizedName, slug, categoryId },
    });
    revalidatePath("/settings/categories");
    revalidatePath("/warehouses");
    return { created: true, entity: { id: subcategory.id, name: subcategory.name, slug: subcategory.slug } };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const concurrent = await prisma.subcategory.findFirst({
      where: { categoryId, OR: [{ normalizedName }, { slug }] },
    });
    if (!concurrent) throw error;
    return { created: false, entity: { id: concurrent.id, name: concurrent.name, slug: concurrent.slug } };
  }
}

export async function deleteSubcategory(id: string) {
  await assertServerPermission("categories:manage");
  const deleted = await prisma.subcategory.deleteMany({
    where: {
      id,
      rawMaterials: { none: {} },
    },
  });

  if (deleted.count === 0) {
    const subcategory = await prisma.subcategory.findUnique({ where: { id }, select: { id: true } });
    if (!subcategory) {
      throw new Error("Subcategory not found");
    }

    throw new Error("Cannot delete subcategory with existing materials");
  }

  revalidatePath("/settings/categories");
}

// Recipients
export async function getRecipientsWithCount() {
  await assertServerPermission("recipients:view");
  return prisma.recipient.findMany({
    include: { _count: { select: { transfers: true } } },
    orderBy: { name: "asc" },
  });
}

export async function addRecipient(name: string): Promise<CreatedEntityResult<{ id: string; name: string }>> {
  await assertServerPermission("recipients:manage");
  const parsedName = recipientNameSchema.parse(name);
  const normalizedName = normalizeRecordName(parsedName);
  const existing = await prisma.recipient.findFirst({
    where: {
      OR: [{ normalizedName }, { name: { equals: parsedName, mode: "insensitive" } }],
    },
  });
  if (existing) {
    return {
      created: false,
      entity: { id: existing.id, name: existing.name },
    };
  }

  try {
    const recipient = await prisma.recipient.create({ data: { name: parsedName, normalizedName } });
    revalidatePath("/settings/recipients");
    return {
      created: true,
      entity: { id: recipient.id, name: recipient.name },
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const concurrentRecipient = await prisma.recipient.findFirst({
      where: {
        OR: [{ normalizedName }, { name: { equals: parsedName, mode: "insensitive" } }],
      },
    });

    if (!concurrentRecipient) {
      throw error;
    }

    return {
      created: false,
      entity: { id: concurrentRecipient.id, name: concurrentRecipient.name },
    };
  }
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
  await assertServerPermission("users:view");
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function createUser(payload: unknown) {
  await assertServerPermission("users:manage");
  const data = createUserSchema.parse(payload);

  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) {
    throw new Error("A user with this email already exists.");
  }

  const passwordHash = await hash(data.password, 12);

  await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      isActive: true,
    },
  });

  revalidatePath("/settings/users");
}

export async function getOperationalDataSummary() {
  await assertServerPermission("settings:view");

  const [
    rawMaterials,
    transfers,
    activityLogs,
    stockTransactions,
    notifications,
    users,
    categories,
    recipients,
    warehouses,
  ] = await Promise.all([
    prisma.rawMaterial.count(),
    prisma.transfer.count(),
    prisma.rawMaterialActivityLog.count(),
    prisma.stockTransaction.count(),
    prisma.notification.count(),
    prisma.user.count(),
    prisma.category.count(),
    prisma.recipient.count(),
    prisma.warehouse.count(),
  ]);

  return {
    deletable: {
      rawMaterials,
      transfers,
      activityLogs,
      stockTransactions,
      notifications,
      total: rawMaterials + transfers + activityLogs + stockTransactions + notifications,
    },
    preserved: {
      users,
      categories,
      recipients,
      warehouses,
    },
  };
}

export async function resetOperationalData(confirmationText: string) {
  await assertServerPermission("settings:manage");

  if (confirmationText.trim() !== OPERATIONAL_DELETE_CONFIRMATION) {
    throw new Error(`Type ${OPERATIONAL_DELETE_CONFIRMATION} to confirm this reset.`);
  }

  const [notifications, transfers, activityLogs, stockTransactions, rawMaterials] =
    await prisma.$transaction([
      prisma.notification.deleteMany(),
      prisma.transfer.deleteMany(),
      prisma.rawMaterialActivityLog.deleteMany(),
      prisma.stockTransaction.deleteMany(),
      prisma.rawMaterial.deleteMany(),
    ]);

  [
    "/dashboard",
    "/warehouses",
    "/transfer-history",
    "/raw-materials-history",
    "/settings/system",
  ].forEach((path) => revalidatePath(path));

  return {
    deleted: {
      rawMaterials: rawMaterials.count,
      transfers: transfers.count,
      activityLogs: activityLogs.count,
      stockTransactions: stockTransactions.count,
      notifications: notifications.count,
    },
    totalDeleted:
      notifications.count +
      transfers.count +
      activityLogs.count +
      stockTransactions.count +
      rawMaterials.count,
  };
}

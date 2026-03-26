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
const DELETE_ALL_CATEGORIES_CONFIRMATION = "DELETE ALL CATEGORIES";
const DELETE_ALL_RECIPIENTS_CONFIRMATION = "DELETE ALL RECIPIENTS";

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// Categories
export async function getCategories() {
  await assertServerPermission("categories:view");
  return prisma.category.findMany({
    include: {
      _count: { select: { rawMaterials: true } },
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

export async function deleteAllCategories(confirmationText: string) {
  await assertServerPermission("settings:manage");

  if (confirmationText.trim() !== DELETE_ALL_CATEGORIES_CONFIRMATION) {
    throw new Error(`Type ${DELETE_ALL_CATEGORIES_CONFIRMATION} to confirm this action.`);
  }

  const linkedMaterials = await prisma.rawMaterial.count();
  if (linkedMaterials > 0) {
    throw new Error("Cannot delete categories while raw materials exist. Clear inventory data first.");
  }

  const categoriesDeleted = await prisma.category.deleteMany();

  revalidatePath("/settings/categories");
  revalidatePath("/settings/system");
  revalidatePath("/warehouses");

  return {
    categoriesDeleted: categoriesDeleted.count,
    totalDeleted: categoriesDeleted.count,
  };
}

export async function deleteAllRecipients(confirmationText: string) {
  await assertServerPermission("settings:manage");

  if (confirmationText.trim() !== DELETE_ALL_RECIPIENTS_CONFIRMATION) {
    throw new Error(`Type ${DELETE_ALL_RECIPIENTS_CONFIRMATION} to confirm this action.`);
  }

  const linkedTransfers = await prisma.transfer.count();
  if (linkedTransfers > 0) {
    throw new Error("Cannot delete recipients while transfer history exists. Clear operational data first.");
  }

  const recipientsDeleted = await prisma.recipient.deleteMany();

  revalidatePath("/settings/recipients");
  revalidatePath("/settings/system");

  return {
    recipientsDeleted: recipientsDeleted.count,
  };
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

export async function deleteUser(userId: string) {
  const currentUser = await assertServerPermission("users:manage");

  if (currentUser.id === userId) {
    throw new Error("You cannot delete your own account.");
  }

  const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!targetUser) {
    throw new Error("User not found.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.rawMaterial.updateMany({ where: { createdById: userId }, data: { createdById: null } });
    await tx.transfer.updateMany({ where: { createdById: userId }, data: { createdById: null } });
    await tx.rawMaterialActivityLog.updateMany({ where: { performedById: userId }, data: { performedById: null } });
    await tx.stockTransaction.updateMany({ where: { createdById: userId }, data: { createdById: null } });
    await tx.finishedGoodActivityLog.updateMany({ where: { performedById: userId }, data: { performedById: null } });
    await tx.user.delete({ where: { id: userId } });
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

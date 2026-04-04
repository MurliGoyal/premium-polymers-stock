import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import {
  DEFAULT_FINISHED_GOODS_WAREHOUSE_CODE,
  FINISHED_GOODS_WAREHOUSE_CODES,
  FINISHED_GOODS_WAREHOUSES,
} from "@/lib/constants";
import { getRequiredServerEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  hasPermission,
  isFinishedGoodsWarehouseScopedRole,
  type Permission,
} from "@/lib/rbac";

function normalizeEmailInput(email: string) {
  return email.trim().toLowerCase();
}

function isMissingFinishedGoodsWarehouseColumn(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022"
  );
}

async function findUserForAuth(email: string) {
  try {
    return await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        role: true,
        isActive: true,
        finishedGoodsWarehouseCode: true,
      },
    });
  } catch (error) {
    if (!isMissingFinishedGoodsWarehouseColumn(error)) {
      throw error;
    }

    const fallbackUser = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        role: true,
        isActive: true,
      },
    });

    return fallbackUser
      ? { ...fallbackUser, finishedGoodsWarehouseCode: null }
      : null;
  }
}

function normalizeFinishedGoodsWarehouseCode(code?: string | null) {
  const normalized = code?.trim().toUpperCase();

  if (!normalized) {
    return null;
  }

  return FINISHED_GOODS_WAREHOUSE_CODES.includes(
    normalized as (typeof FINISHED_GOODS_WAREHOUSE_CODES)[number],
  )
    ? normalized
    : null;
}

function getFinishedGoodsWarehousePath(code?: string | null) {
  const resolvedCode =
    normalizeFinishedGoodsWarehouseCode(code) ??
    DEFAULT_FINISHED_GOODS_WAREHOUSE_CODE;
  const warehouse =
    FINISHED_GOODS_WAREHOUSES.find((entry) => entry.code === resolvedCode) ??
    FINISHED_GOODS_WAREHOUSES[0];

  return `/finished-goods/${warehouse.slug}`;
}

export const authOptions: NextAuthOptions = {
  secret: getRequiredServerEnv("NEXTAUTH_SECRET"),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const normalizedEmail = credentials?.email ? normalizeEmailInput(credentials.email) : "";
        const password = credentials?.password ?? "";

        if (!normalizedEmail || !password) return null;

        const user = await findUserForAuth(normalizedEmail);

        if (!user || !user.isActive) return null;

        const isPasswordValid = await compare(password, user.passwordHash);
        if (!isPasswordValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          finishedGoodsWarehouseCode: normalizeFinishedGoodsWarehouseCode(
            user.finishedGoodsWarehouseCode,
          ),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
        token.finishedGoodsWarehouseCode = (
          user as { finishedGoodsWarehouseCode?: string | null }
        ).finishedGoodsWarehouseCode ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.finishedGoodsWarehouseCode =
          (token.finishedGoodsWarehouseCode as string | null | undefined) ??
          null;
      }
      return session;
    },
  },
};

export async function getServerAuthSession() {
  return getServerSession(authOptions);
}

export type AuthenticatedUser = {
  email: string;
  finishedGoodsWarehouseCode?: string | null;
  id: string;
  name: string;
  role: string;
};

export function getAllowedFinishedGoodsWarehouseCodes(
  user: Pick<AuthenticatedUser, "finishedGoodsWarehouseCode" | "role">,
) {
  return getWritableFinishedGoodsWarehouseCodes(user);
}

export function getReadableFinishedGoodsWarehouseCodes(
  user: Pick<AuthenticatedUser, "finishedGoodsWarehouseCode" | "role">,
) {
  if (!isFinishedGoodsWarehouseScopedRole(user.role)) {
    return [...FINISHED_GOODS_WAREHOUSE_CODES];
  }

  return [...FINISHED_GOODS_WAREHOUSE_CODES];
}

export function getWritableFinishedGoodsWarehouseCodes(
  user: Pick<AuthenticatedUser, "finishedGoodsWarehouseCode" | "role">,
) {
  if (!isFinishedGoodsWarehouseScopedRole(user.role)) {
    return [...FINISHED_GOODS_WAREHOUSE_CODES];
  }

  const scopedCode = normalizeFinishedGoodsWarehouseCode(
    user.finishedGoodsWarehouseCode,
  );
  return scopedCode ? [scopedCode] : [];
}

export function canAccessFinishedGoodsWarehouse(
  user: Pick<AuthenticatedUser, "finishedGoodsWarehouseCode" | "role">,
  warehouseCode?: string | null,
) {
  const resolvedCode = normalizeFinishedGoodsWarehouseCode(warehouseCode);

  if (!resolvedCode) {
    return false;
  }

  return getReadableFinishedGoodsWarehouseCodes(user).includes(
    resolvedCode as (typeof FINISHED_GOODS_WAREHOUSE_CODES)[number],
  );
}

export function resolveFinishedGoodsWarehouseForUser(
  user: Pick<AuthenticatedUser, "finishedGoodsWarehouseCode" | "role">,
  warehouseCode?: string | null,
) {
  const allowedCodes = getReadableFinishedGoodsWarehouseCodes(user);

  if (allowedCodes.length === 0) {
    return null;
  }

  const requestedCode = normalizeFinishedGoodsWarehouseCode(warehouseCode);
  if (
    requestedCode &&
    allowedCodes.includes(
      requestedCode as (typeof FINISHED_GOODS_WAREHOUSE_CODES)[number],
    )
  ) {
    return requestedCode;
  }

  return allowedCodes[0];
}

export function assertOwnsFinishedGoodsWarehouse(
  user: Pick<AuthenticatedUser, "finishedGoodsWarehouseCode" | "role">,
  warehouseCode: string,
) {
  if (!isFinishedGoodsWarehouseScopedRole(user.role)) {
    return;
  }

  const writableCodes = getWritableFinishedGoodsWarehouseCodes(user);
  if (!writableCodes.includes(warehouseCode)) {
    throw new Error("You can only manage your own warehouse.");
  }
}

function getAuthorizedHome(
  user: Pick<AuthenticatedUser, "finishedGoodsWarehouseCode" | "role">,
) {
  if (hasPermission(user.role, "dashboard:view")) {
    return "/dashboard";
  }

  if (hasPermission(user.role, "warehouses:view")) {
    return "/warehouses";
  }

  if (hasPermission(user.role, "finished_goods:view")) {
    return getFinishedGoodsWarehousePath(user.finishedGoodsWarehouseCode);
  }

  return "/login";
}

export async function requirePagePermission(permission?: Permission) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (permission && !hasPermission(session.user.role, permission)) {
    redirect(getAuthorizedHome(session.user));
  }

  return session.user;
}

export async function assertServerPermission(permission?: Permission) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    throw new Error("Authentication required.");
  }

  if (permission && !hasPermission(session.user.role, permission)) {
    throw new Error("You do not have permission to perform this action.");
  }

  return session.user;
}

export async function assertAnyServerPermission(permissions: Permission[]) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    throw new Error("Authentication required.");
  }

  if (!permissions.some((permission) => hasPermission(session.user.role, permission))) {
    throw new Error("You do not have permission to perform this action.");
  }

  return session.user;
}

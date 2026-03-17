import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import { getRequiredServerEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { hasPermission, type Permission } from "@/lib/rbac";

function normalizeEmailInput(email: string) {
  return email.trim().toLowerCase();
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

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (!user || !user.isActive) return null;

        const isPasswordValid = await compare(password, user.passwordHash);
        if (!isPasswordValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};

export async function getServerAuthSession() {
  return getServerSession(authOptions);
}

export async function requirePagePermission(permission?: Permission) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (permission && !hasPermission(session.user.role, permission)) {
    redirect("/dashboard");
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

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      roles: string[];
      permissions: string[];
      twoFactorEnabled: boolean;
      twoFactorForced: boolean;
      twoFactorVerified?: boolean;
    };
  }
  interface User {
    id: string;
    roles: string[];
    permissions: string[];
    twoFactorEnabled: boolean;
    twoFactorForced: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    roles: string[];
    permissions: string[];
    twoFactorEnabled: boolean;
    twoFactorForced: boolean;
    twoFactorVerified?: boolean;
    permissionsRefreshedAt?: number;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) return null;

          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            include: {
              userRoles: { include: { role: true } },
            },
          });

          if (!user) return null;

          const valid = await bcrypt.compare(credentials.password, user.password);
          if (!valid) return null;

          const roles = user.userRoles.map((ur) => ur.role.name);
          const permissions = [
            ...new Set(
              user.userRoles.flatMap((ur) => ur.role.permissions as string[])
            ),
          ];

          const settings = await prisma.systemSettings.findUnique({
            where: { id: "singleton" },
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            roles,
            permissions,
            twoFactorEnabled: user.twoFactorEnabled,
            twoFactorForced: settings?.force2FA ?? false,
          };
        } catch (error) {
          console.error("[authorize] DB error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user, session }: any) {
      if (user) {
        token.id = user.id;
        token.roles = user.roles;
        token.permissions = user.permissions;
        token.twoFactorEnabled = user.twoFactorEnabled;
        token.twoFactorForced = user.twoFactorForced;
        token.twoFactorVerified = false;
        token.permissionsRefreshedAt = Date.now();
      }
      // When client calls update({ twoFactorEnabled: true }), update the token
      if (session?.twoFactorEnabled !== undefined) {
        token.twoFactorEnabled = Boolean(session.twoFactorEnabled);
      }
      // Re-fetch permissions from DB every 60 seconds so role changes take effect without re-login
      const age = Date.now() - ((token.permissionsRefreshedAt as number) ?? 0);
      if (token.id && age > 60_000) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            include: { userRoles: { include: { role: true } } },
          });
          if (dbUser) {
            token.roles = dbUser.userRoles.map((ur) => ur.role.name);
            token.permissions = [
              ...new Set(dbUser.userRoles.flatMap((ur) => ur.role.permissions as string[])),
            ];
            token.twoFactorEnabled = dbUser.twoFactorEnabled;
          }
          const settings = await prisma.systemSettings.findUnique({ where: { id: "singleton" } });
          token.twoFactorForced = settings?.force2FA ?? false;
        } catch {
          // keep existing token values on DB error
        }
        token.permissionsRefreshedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.roles = token.roles as string[];
      session.user.permissions = token.permissions as string[];
      session.user.twoFactorEnabled = token.twoFactorEnabled as boolean;
      session.user.twoFactorForced = token.twoFactorForced as boolean;
      session.user.twoFactorVerified = token.twoFactorVerified as boolean;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
};

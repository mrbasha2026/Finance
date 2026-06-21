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

        // Check system-level force2FA
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
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.roles = user.roles;
        token.permissions = user.permissions;
        token.twoFactorEnabled = user.twoFactorEnabled;
        token.twoFactorForced = user.twoFactorForced;
        token.twoFactorVerified = false;
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

import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Admin-only routes
    const adminRoutes = ["/users", "/roles", "/audit", "/settings"];
    if (adminRoutes.some((r) => pathname.startsWith(r))) {
      const permissions = (token?.permissions as string[]) ?? [];
      if (!permissions.includes("system.settings") && !permissions.includes("users.manage")) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|js|css|woff2?|ttf)).*)",
  ],
};

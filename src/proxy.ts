import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/warehouses/:path*",
    "/transfer-history/:path*",
    "/raw-materials-history/:path*",
    "/settings/:path*",
  ],
};

import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      finishedGoodsWarehouseCode?: string | null;
    };
  }

  interface User {
    role: string;
    finishedGoodsWarehouseCode?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    finishedGoodsWarehouseCode?: string | null;
  }
}

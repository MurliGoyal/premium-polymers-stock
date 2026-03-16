export type AppShellUser = {
  email: string;
  name: string;
  role: string;
};

export type AppShellWarehouse = {
  code: string;
  name: string;
  slug: string;
};

export type AppShellNotification = {
  createdAt: string;
  id: string;
  isRead: boolean;
  message: string;
  rawMaterialName: string | null;
  type: string;
  warehouseCode: string | null;
};

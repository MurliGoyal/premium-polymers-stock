import { requirePagePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getCategories } from "../actions";
import { CategoriesClient } from "./categories-client";

export default async function CategoriesPage() {
  const user = await requirePagePermission("categories:view");
  const categories = await getCategories();
  return (
    <CategoriesClient
      canManage={hasPermission(user.role, "categories:manage")}
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        materialCount: c._count.rawMaterials,
        createdAt: c.createdAt.toISOString(),
        subcategories: c.subcategories.map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          materialCount: s._count.rawMaterials,
        })),
      }))}
    />
  );
}

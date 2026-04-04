import { z } from "zod";
import { FINISHED_GOODS_WAREHOUSE_CODES, MATERIAL_UNITS, SIZE_UNITS, THICKNESS_UNITS } from "@/lib/constants";
import { collapseWhitespace } from "@/lib/naming";

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;

const trimmedString = (label: string, max = 120) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or less`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length ? value : undefined))
    .nullable()
    .optional();

const normalizedName = (label: string, max = 120) =>
  trimmedString(label, max)
    .transform(collapseWhitespace)
    .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value), `${label} contains unsupported control characters`);

const optionalNormalizedName = (label: string, max = 120) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => collapseWhitespace(value))
    .transform((value) => (value.length ? value : undefined))
    .refine((value) => value === undefined || !CONTROL_CHARACTER_PATTERN.test(value), `${label} contains unsupported control characters`)
    .nullable()
    .optional();

const positiveNumber = (label: string) =>
  z
    .number({ error: `${label} must be a number` })
    .finite(`${label} must be a valid number`)
    .min(0, `${label} cannot be negative`);

export const categoryNameSchema = normalizedName("Category name");
export const recipientNameSchema = normalizedName("Recipient name");
export const rawMaterialNameSchema = normalizedName("Raw material name");

export const rawMaterialFormSchema = z
  .object({
    warehouseId: trimmedString("Warehouse"),
    name: rawMaterialNameSchema,
    categoryId: trimmedString("Category"),
    vendorName: optionalNormalizedName("Vendor name", 120),
    baseUnit: z
      .string({ error: "Unit is required" })
      .trim()
      .min(1, "Select a unit")
      .max(30, "Unit must be 30 characters or less")
      .refine(
        (value) => MATERIAL_UNITS.includes(value as (typeof MATERIAL_UNITS)[number]) || /^[a-zA-Z][a-zA-Z0-9 -]{0,29}$/.test(value),
        "Enter a valid unit"
      ),
    currentStock: positiveNumber("Current stock"),
    minimumStock: positiveNumber("Minimum stock"),
    thicknessValue: z.number().finite().min(0).optional().nullable(),
    thicknessUnit: z.enum(THICKNESS_UNITS).optional().nullable(),
    sizeValue: optionalText(80),
    sizeUnit: z.enum(SIZE_UNITS).optional().nullable(),
    gsm: z.number().finite().min(0).optional().nullable(),
    micron: z.number().finite().min(0).optional().nullable(),
    notes: optionalText(400),
  })
  .superRefine((value, context) => {
    if (value.thicknessValue && !value.thicknessUnit) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["thicknessUnit"],
        message: "Select a thickness unit",
      });
    }

    if (value.sizeValue && !value.sizeUnit) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sizeUnit"],
        message: "Select a size unit",
      });
    }
  });

export const stockAdjustmentFormSchema = z.object({
  rawMaterialId: trimmedString("Raw material"),
  warehouseId: trimmedString("Warehouse"),
  adjustmentType: z.enum(["set", "add", "subtract"], { error: "Select an adjustment type" }),
  quantity: z
    .number({ error: "Quantity is required" })
    .finite("Quantity must be a valid number")
    .min(0, "Quantity cannot be negative"),
  reason: optionalText(400),
});

export const rawMaterialSpecificationUpdateSchema = z
  .object({
    rawMaterialId: trimmedString("Raw material"),
    warehouseId: trimmedString("Warehouse"),
    thicknessValue: z.number().finite().min(0).optional().nullable(),
    thicknessUnit: z.enum(THICKNESS_UNITS).optional().nullable(),
    sizeValue: optionalText(80),
    sizeUnit: z.enum(SIZE_UNITS).optional().nullable(),
    gsm: z.number().finite().min(0).optional().nullable(),
    micron: z.number().finite().min(0).optional().nullable(),
    notes: optionalText(400),
  })
  .superRefine((value, context) => {
    if (value.thicknessValue && !value.thicknessUnit) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["thicknessUnit"],
        message: "Select a thickness unit",
      });
    }

    if (value.sizeValue && !value.sizeUnit) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sizeUnit"],
        message: "Select a size unit",
      });
    }
  });

export const transferFormSchema = z.object({
  warehouseId: trimmedString("Warehouse"),
  rawMaterialId: trimmedString("Raw material"),
  quantity: z
    .number({ error: "Quantity is required" })
    .finite("Quantity must be a valid number")
    .positive("Quantity must be greater than zero"),
  recipientId: trimmedString("Recipient"),
  notes: optionalText(400),
  referenceNumber: optionalText(80),
});

export const createUserSchema = z.object({
  name: normalizedName("Name", 120),
  email: z
    .string({ error: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Enter a valid email address"),
  password: z
    .string({ error: "Password is required" })
    .min(6, "Password must be at least 6 characters")
    .max(120, "Password must be 120 characters or less"),
  role: z.enum(["MANAGER", "STOCK_MANAGEMENT", "FINISHED_GOODS_MANAGER", "RAW_MATERIAL_MANAGER", "VIEWER"], { error: "Select a valid role" }),
  finishedGoodsWarehouseCode: z
    .string()
    .trim()
    .transform((value) => (value.length ? value.toUpperCase() : undefined))
    .refine(
      (value) => value === undefined || FINISHED_GOODS_WAREHOUSE_CODES.includes(value as (typeof FINISHED_GOODS_WAREHOUSE_CODES)[number]),
      "Select a valid finished goods warehouse"
    )
    .optional(),
}).superRefine((value, context) => {
  if (value.role === "FINISHED_GOODS_MANAGER" && !value.finishedGoodsWarehouseCode) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["finishedGoodsWarehouseCode"],
      message: "Select a finished goods warehouse",
    });
  }
});

const currentPasswordSchema = z
  .string({ error: "Current password is required" })
  .min(1, "Current password is required")
  .max(120, "Current password must be 120 characters or less");

const passwordSchema = z
  .string({ error: "Password is required" })
  .min(6, "Password must be at least 6 characters")
  .max(120, "Password must be 120 characters or less");

export const changePasswordSchema = z
  .object({
    confirmPassword: passwordSchema,
    currentPassword: currentPasswordSchema,
    newPassword: passwordSchema,
  })
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  });

export const adminChangePasswordSchema = z
  .object({
    confirmPassword: passwordSchema,
    newPassword: passwordSchema,
    userId: trimmedString("User"),
  })
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  });

export const createMasterGoodSchema = z.object({
  warehouseCode: z.string().trim().optional(),
  name: normalizedName("Group name"),
});

export const createSubGoodSchema = z
  .object({
    warehouseCode: z.string().trim().optional(),
    masterGoodId: trimmedString("Master group"),
    name: normalizedName("Variant name"),
    baseUnit: z
      .string({ error: "Unit is required" })
      .trim()
      .min(1, "Select a unit")
      .max(30, "Unit must be 30 characters or less")
      .refine(
        (value) =>
          MATERIAL_UNITS.includes(value as (typeof MATERIAL_UNITS)[number]) ||
          /^[a-zA-Z][a-zA-Z0-9 -]{0,29}$/.test(value),
        "Enter a valid unit",
      ),
    diameterValue: z.number().finite().min(0).optional(),
    diameterUnit: z.enum(THICKNESS_UNITS).optional(),
    initialStock: z.number().finite().min(0).optional(),
    stockInDate: z.string().trim().optional(),
  })
  .superRefine((value, context) => {
    if (value.diameterValue !== undefined && !value.diameterUnit) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["diameterUnit"],
        message: "Select a diameter unit",
      });
    }
  });

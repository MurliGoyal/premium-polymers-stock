import { z } from "zod";
import { MATERIAL_UNITS, SIZE_UNITS, THICKNESS_UNITS } from "@/lib/constants";
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
    subcategoryId: z.string().trim().optional().nullable(),
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

    if (value.gsm == null && value.micron == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gsm"],
        message: "Enter GSM or Micron",
      });
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["micron"],
        message: "Enter GSM or Micron",
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
  role: z.enum(["MANAGER", "STOCK_MANAGEMENT", "VIEWER"], { error: "Select a valid role" }),
});

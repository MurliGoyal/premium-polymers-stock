import { Prisma } from "@prisma/client";

export type QuantityValue = Prisma.Decimal | number | string | null | undefined;

const ZERO: Prisma.Decimal = new Prisma.Decimal(0);

export function toDecimal(value: QuantityValue): Prisma.Decimal {
  if (value === null || value === undefined || value === "") {
    return ZERO;
  }

  return new Prisma.Decimal(value);
}

export function quantityToNumber(value: QuantityValue, fallback = 0): number {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value instanceof Prisma.Decimal ? value.toString() : value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function quantityToString(value: QuantityValue, scale = 3): string {
  return toDecimal(value).toFixed(scale);
}

export function serializeQuantity(value: QuantityValue) {
  if (value === null || value === undefined) {
    return null;
  }

  return quantityToString(value);
}

export function sumQuantities(values: QuantityValue[]) {
  return values.reduce<Prisma.Decimal>((sum, value) => sum.plus(toDecimal(value)), ZERO);
}

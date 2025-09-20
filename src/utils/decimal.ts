import { Decimal } from "@prisma/client/runtime/library";

export function parseDecimal(value: any): Decimal | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Decimal) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    return new Decimal(value);
  }
  return null;
}

export function parseDecimalFromJSON(value: any): any {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map(parseDecimalFromJSON);
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, parseDecimalFromJSON(v)])
    );
  }
  if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value)) {
    return new Decimal(value);
  }
  return value;
}

import type { Prisma } from "../../generated/prisma/client.js";

function toJsonValue(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (typeof value === "object") return toPrismaJsonObject(value);
  if (typeof value === "bigint") return value.toString();
  return null;
}

export function toPrismaJsonObject(value: object): Prisma.InputJsonObject {
  const result: Record<string, Prisma.InputJsonValue | null> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) result[key] = toJsonValue(item);
  }
  return result;
}

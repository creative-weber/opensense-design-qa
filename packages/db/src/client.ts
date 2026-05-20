import { PrismaClient } from "@prisma/client";

// ─── Singleton Prisma client ──────────────────────────────────────────────────
// Prevents multiple connections during hot-reload in development.

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const db: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log:
      process.env["NODE_ENV"] === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env["NODE_ENV"] !== "production") {
  globalThis.__prisma = db;
}

export { type PrismaClient } from "@prisma/client";

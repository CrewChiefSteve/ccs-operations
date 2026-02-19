import { mutation } from "./_generated/server";

// ============================================================
// CLEAR ALL — Wipe every table for a clean slate
// ============================================================
// Run with: npx convex run clearAndReseed:clearAll
// Then:     npx convex run seed:run
//
// Or both in one shot:
//   npx convex run clearAndReseed:clearAll && npx convex run seed:run
// ============================================================

export const clearAll = mutation({
  handler: async (ctx) => {
    const tables = [
      "receiptPhotos",
      "inventoryTransactions",
      "purchaseOrderLines",
      "purchaseOrders",
      "bomEntries",
      "componentSuppliers",
      "inventory",
      "buildOrders",
      "tasks",
      "alerts",
      "components",
      "suppliers",
      "locations",
      "bomChangeLogs",
      "bomSnapshots",
      "briefings",
      "driveFiles",
      "driveSyncLog",
    ] as const;

    const counts: Record<string, number> = {};
    for (const table of tables) {
      const rows = await ctx.db.query(table as any).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
      counts[table] = rows.length;
    }

    return { message: "🧹 All data cleared. Run `npx convex run seed:run` to re-seed.", deleted: counts };
  },
});

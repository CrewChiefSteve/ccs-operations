import { convexQuery } from "../convex-client.js";

// ============================================================
// ORDER & SUPPLIER TOOLS
// ============================================================

export const orderTools = [
  {
    name: "inventory_list_suppliers",
    description:
      "List all suppliers in the CCS vendor directory. Returns names, contact info, and internal ratings.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum results (default: 50)",
          default: 50,
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const result = await convexQuery("inventory/suppliers:list", {
        limit: (args.limit as number) ?? 50,
      });
      return result;
    },
  },

  {
    name: "inventory_list_purchase_orders",
    description:
      'List purchase orders with optional status filter. Statuses: "draft", "submitted", "confirmed", "shipped", "received", "cancelled".',
    inputSchema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          description:
            'Filter by PO status: "draft", "submitted", "confirmed", "shipped", "received", "cancelled"',
        },
        limit: {
          type: "number",
          description: "Maximum results (default: 20)",
          default: 20,
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const result = await convexQuery("inventory/purchaseOrders:list", {
        status: args.status as string | undefined,
        limit: (args.limit as number) ?? 20,
      });
      return result;
    },
  },

  {
    name: "inventory_list_build_orders",
    description:
      'List build orders (production runs). Shows product, quantity, status, and assignment. Statuses: "planned", "materials_reserved", "in_progress", "qc", "complete", "cancelled".',
    inputSchema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          description: "Filter by build order status",
        },
        product: {
          type: "string",
          description: "Filter by product name",
        },
        limit: {
          type: "number",
          description: "Maximum results (default: 20)",
          default: 20,
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const result = await convexQuery("inventory/buildOrders:list", {
        status: args.status as string | undefined,
        productName: args.product as string | undefined,
        limit: (args.limit as number) ?? 20,
      });
      return result;
    },
  },

  {
    name: "inventory_get_build_detail",
    description:
      "Get full details for a specific build order including materials status, pick list, related tasks, and QC results. Requires the build order ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        buildOrderId: {
          type: "string",
          description: "The Convex document ID of the build order",
        },
      },
      required: ["buildOrderId"],
    },
    handler: async (args: Record<string, unknown>) => {
      const result = await convexQuery(
        "inventory/buildLifecycle:getDetail",
        { id: args.buildOrderId as string }
      );
      return result;
    },
  },

  {
    name: "inventory_production_stats",
    description:
      "Get production statistics — total orders, yield rates, average build times. Optionally filter by product.",
    inputSchema: {
      type: "object" as const,
      properties: {
        product: {
          type: "string",
          description: "Optional: filter stats to a specific product",
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const result = await convexQuery(
        "inventory/buildLifecycle:productionStats",
        { product: args.product as string | undefined }
      );
      return result;
    },
  },
];

import { convexQuery } from "../convex-client.js";

// ============================================================
// COMPONENT & STOCK TOOLS
// ============================================================

export const componentTools = [
  {
    name: "inventory_list_components",
    description:
      "List all components in the CCS inventory system. Returns part numbers, names, categories, and current stock levels. Optionally filter by category or active status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          description:
            'Filter by category: "mcu", "sensor", "passive", "connector", "pcb", "mechanical", "consumable"',
        },
        activeOnly: {
          type: "boolean",
          description: "Only show active components (default: true)",
          default: true,
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 50)",
          default: 50,
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const result = await convexQuery("inventory/components:list", {
        category: args.category as string | undefined,
        limit: (args.limit as number) ?? 50,
      });
      return result;
    },
  },

  {
    name: "inventory_search_components",
    description:
      'Full-text search across component names and descriptions. Use this to find components like "ESP32" or "thermocouple" or "capacitor".',
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search term to match against component names and descriptions",
        },
        limit: {
          type: "number",
          description: "Maximum results (default: 10)",
          default: 10,
        },
      },
      required: ["query"],
    },
    handler: async (args: Record<string, unknown>) => {
      const result = await convexQuery("inventory/components:search", {
        query: args.query as string,
        limit: (args.limit as number) ?? 10,
      });
      return result;
    },
  },

  {
    name: "inventory_get_component",
    description:
      "Get detailed information about a specific component by part number. Includes stock levels, suppliers, and BOM usage.",
    inputSchema: {
      type: "object" as const,
      properties: {
        partNumber: {
          type: "string",
          description: 'CCS part number, e.g. "CCS-MCU-001"',
        },
      },
      required: ["partNumber"],
    },
    handler: async (args: Record<string, unknown>) => {
      // Get component
      const components = await convexQuery("inventory/components:list", {}) as any[];
      const component = components?.find(
        (c: any) => c.partNumber === args.partNumber
      );
      if (!component) {
        return { error: `Component not found: ${args.partNumber}` };
      }

      // Get stock levels
      const stock = await convexQuery("inventory/stock:listByComponent", {
        componentId: component._id,
      });

      // Get suppliers
      const suppliers = await convexQuery(
        "inventory/componentSuppliers:listByComponent",
        { componentId: component._id }
      );

      return { component, stock, suppliers };
    },
  },

  {
    name: "inventory_check_stock",
    description:
      "Check current stock levels for all components, or filtered by product BOM. Shows quantity on hand, reserved, and available.",
    inputSchema: {
      type: "object" as const,
      properties: {
        product: {
          type: "string",
          description:
            'Optional: filter to components used in a specific product BOM, e.g. "Oil_Heater_Controller"',
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      if (args.product) {
        // Get BOM entries for the product, then check stock for each
        const bomEntries = await convexQuery("inventory/bomEntries:list", {
          product: args.product as string,
        }) as any[];

        if (!bomEntries || bomEntries.length === 0) {
          return { error: `No BOM entries found for product: ${args.product}` };
        }

        return { product: args.product, bomEntries };
      }

      // General low stock report
      const report = await convexQuery("inventory/stock:lowStockReport", {});
      return report;
    },
  },

  {
    name: "inventory_check_feasibility",
    description:
      'Check if we can build N units of a product. Shows which components are short and by how much. Example: "Can we build 10 Oil Heater units?"',
    inputSchema: {
      type: "object" as const,
      properties: {
        product: {
          type: "string",
          description:
            'Product name, e.g. "Oil_Heater_Controller", "RaceScale"',
        },
        quantity: {
          type: "number",
          description: "Number of units to check feasibility for",
        },
      },
      required: ["product", "quantity"],
    },
    handler: async (args: Record<string, unknown>) => {
      const result = await convexQuery("inventory/bomEntries:checkFeasibility", {
        product: args.product as string,
        quantity: args.quantity as number,
      });
      return result;
    },
  },
];

#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { componentTools } from "./tools/components.js";
import { orderTools } from "./tools/orders.js";
import { operationsTools } from "./tools/operations.js";
import { convexQuery } from "./convex-client.js";

// ============================================================
// CCS INVENTORY MCP SERVER
// ============================================================
//
// Read-only MCP server for the CCS Technologies inventory system.
// Designed for use with Claude Code, Claude Chat, or any MCP client.
//
// Provides:
// - 16 tools for querying inventory, orders, alerts, tasks, briefings
// - 3 resources for quick reference data
// - 4 prompts for common inventory workflows
//
// Configuration:
//   CONVEX_URL=https://rugged-heron-983.convex.cloud
//
// Usage with Claude Code (claude_desktop_config.json):
//   {
//     "mcpServers": {
//       "ccs-inventory": {
//         "command": "npx",
//         "args": ["tsx", "/path/to/ccs-operations/packages/inventory-mcp/src/index.ts"],
//         "env": {
//           "CONVEX_URL": "https://rugged-heron-983.convex.cloud"
//         }
//       }
//     }
//   }

// ---- Collect all tools ----
const ALL_TOOLS = [...componentTools, ...orderTools, ...operationsTools];

// Build handler lookup
const toolHandlers = new Map<
  string,
  (args: Record<string, unknown>) => Promise<unknown>
>();
for (const tool of ALL_TOOLS) {
  toolHandlers.set(tool.name, tool.handler);
}

// ---- Create server ----
const server = new Server(
  {
    name: "ccs-inventory",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// ============================================================
// TOOL HANDLERS
// ============================================================

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ALL_TOOLS.map(({ handler, ...toolDef }) => toolDef),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const handler = toolHandlers.get(name);

  if (!handler) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Unknown tool: ${name}. Available tools: ${ALL_TOOLS.map((t) => t.name).join(", ")}`,
        },
      ],
      isError: true,
    };
  }

  try {
    const result = await handler(args ?? {});
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error calling ${name}: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// ============================================================
// RESOURCES — Quick reference data
// ============================================================

const RESOURCES = [
  {
    uri: "ccs://products",
    name: "CCS Products",
    description:
      "List of current CCS Technologies products and their identifiers",
    mimeType: "application/json",
  },
  {
    uri: "ccs://inventory-summary",
    name: "Inventory Summary",
    description:
      "Current inventory health snapshot — stock levels, alerts, pending orders",
    mimeType: "application/json",
  },
  {
    uri: "ccs://bom-status",
    name: "BOM Sync Status",
    description:
      "Status of BOM synchronization between Google Drive and inventory system",
    mimeType: "application/json",
  },
];

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: RESOURCES,
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case "ccs://products": {
      const products = [
        "Oil_Heater_Controller",
        "RaceScale",
        "Ride_Height_Sensor",
        "Tire_Temperature",
        "Tire-Temp-Probe",
      ];
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify({ products }, null, 2),
          },
        ],
      };
    }

    case "ccs://inventory-summary": {
      try {
        const overview = await convexQuery("dashboard:overview", {});
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(overview, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify({ error: error.message }),
            },
          ],
        };
      }
    }

    case "ccs://bom-status": {
      try {
        const overview = await convexQuery("agent/bomSync:syncOverview", {});
        const pending = await convexQuery("agent/bomSync:pendingChanges", {});
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify({ overview, pending }, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify({ error: error.message }),
            },
          ],
        };
      }
    }

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// ============================================================
// PROMPTS — Common inventory workflows
// ============================================================

const PROMPTS = [
  {
    name: "check-build-readiness",
    description:
      "Check if we have all materials to build N units of a product",
    arguments: [
      {
        name: "product",
        description:
          'Product name, e.g. "Oil_Heater_Controller", "RaceScale"',
        required: true,
      },
      {
        name: "quantity",
        description: "Number of units to build",
        required: true,
      },
    ],
  },
  {
    name: "morning-briefing",
    description:
      "Get a full morning operational briefing with inventory, tasks, and Drive status",
    arguments: [],
  },
  {
    name: "supplier-comparison",
    description:
      "Compare suppliers for a specific component — pricing, lead times, and reliability",
    arguments: [
      {
        name: "component",
        description: "Component name or part number to compare suppliers for",
        required: true,
      },
    ],
  },
  {
    name: "inventory-health-check",
    description:
      "Run a comprehensive inventory health check — low stock, stale counts, overdue POs, and build feasibility",
    arguments: [],
  },
];

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: PROMPTS,
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "check-build-readiness":
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Check if CCS Technologies has all the materials to build ${args?.quantity ?? "?"} units of ${args?.product ?? "the product"}.\n\n1. Use inventory_check_feasibility to check material availability\n2. For any shortages, check preferred suppliers and lead times\n3. If we can build, show the material pick list\n4. If we can't, show exactly what's short and recommend PO quantities\n\nBe specific with numbers — stock counts, costs, lead times.`,
            },
          },
        ],
      };

    case "morning-briefing":
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Get today's CCS Technologies operational briefing.\n\n1. Use inventory_get_briefing to get the latest briefing\n2. Use inventory_dashboard for current numbers\n3. Use inventory_list_alerts to check for any critical alerts\n4. Use inventory_list_tasks to see what needs action today\n\nPresent this like a competent operations manager — lead with what needs attention, skip what's fine, be specific about numbers and actions needed.`,
            },
          },
        ],
      };

    case "supplier-comparison":
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Compare suppliers for "${args?.component ?? "the component"}" in the CCS inventory system.\n\n1. Search for the component using inventory_search_components\n2. Get the component details including all suppliers\n3. Show a comparison: unit cost, lead time, minimum order, preferred status\n4. Make a recommendation based on cost, reliability, and lead time`,
            },
          },
        ],
      };

    case "inventory-health-check":
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Run a comprehensive CCS inventory health check.\n\n1. inventory_dashboard — get the overall snapshot\n2. inventory_check_stock — find any low stock items\n3. inventory_list_purchase_orders with status "submitted" or "shipped" — pending incoming\n4. inventory_list_build_orders — active production\n5. inventory_escalation_status — any overdue tasks or stale alerts\n6. inventory_bom_sync_status — any unresolved BOM changes\n\nSummarize: What's healthy, what needs attention, what's blocked. Prioritize action items.`,
            },
          },
        ],
      };

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

// ============================================================
// START SERVER
// ============================================================

async function main() {
  // Validate environment
  if (!process.env.CONVEX_URL) {
    console.error(
      "ERROR: CONVEX_URL environment variable is required.\n" +
        "Set it to your Convex deployment URL.\n" +
        "Example: CONVEX_URL=https://rugged-heron-983.convex.cloud"
    );
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CCS Inventory MCP server started (read-only mode)");
  console.error(`Connected to Convex: ${process.env.CONVEX_URL}`);
  console.error(`Tools: ${ALL_TOOLS.length}`);
  console.error(`Resources: ${RESOURCES.length}`);
  console.error(`Prompts: ${PROMPTS.length}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

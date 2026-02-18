import { ConvexHttpClient } from "convex/browser";

// ============================================================
// CONVEX CLIENT FOR MCP SERVER
// ============================================================
//
// Uses ConvexHttpClient (no WebSocket, stateless HTTP).
// Perfect for an MCP server that makes individual queries.
//
// Required env var: CONVEX_URL
// Get this from your .env.local or the Convex dashboard.

let client: ConvexHttpClient | null = null;

export function getConvexClient(): ConvexHttpClient {
  if (client) return client;

  const url = process.env.CONVEX_URL;
  if (!url) {
    throw new Error(
      "CONVEX_URL environment variable is required.\n" +
        "Set it to your Convex deployment URL, e.g.:\n" +
        "  CONVEX_URL=https://rugged-heron-983.convex.cloud\n" +
        "Find it in .env.local or the Convex dashboard."
    );
  }

  client = new ConvexHttpClient(url);
  return client;
}

/**
 * Execute a Convex query function.
 *
 * Usage:
 *   const result = await convexQuery("inventory.components.list", { limit: 50 });
 *
 * The function name is resolved against the Convex API at runtime.
 * Since we're using ConvexHttpClient, we pass the function reference as a string.
 */
export async function convexQuery(
  functionPath: string,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  const c = getConvexClient();
  // ConvexHttpClient.query expects a FunctionReference, but we can use
  // the string path trick with anyApi for dynamic function resolution.
  // For type safety in production, you'd generate types from your Convex schema.
  return await (c as any).query(functionPath, args);
}

/**
 * Execute a Convex mutation function.
 * (Included for future read-write expansion, not used in v1.)
 */
export async function convexMutation(
  functionPath: string,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  const c = getConvexClient();
  return await (c as any).mutation(functionPath, args);
}

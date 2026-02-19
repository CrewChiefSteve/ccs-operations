import { v } from "convex/values";
import { action, mutation, query } from "../_generated/server";

// ============================================================
// SUPPLIER API — Integration structure for DigiKey, Mouser, LCSC
// ============================================================
// All API calls are STUBBED until supplier accounts are set up.
// Each stub returns realistic response shapes matching the real APIs.
//
// To activate:
//   1. Create a DigiKey developer account → get Client ID + Secret
//   2. Create a Mouser API account → get API Key
//   3. Update supplierApiConfigs via the Settings/Pricing page
//   4. Replace stub functions below with real HTTP calls
// ============================================================

// ----------------------------------------------------------
// API CONFIG MANAGEMENT
// ----------------------------------------------------------

export const listConfigs = query({
  handler: async (ctx) => {
    const configs = await ctx.db.query("supplierApiConfigs").collect();
    return await Promise.all(
      configs.map(async (config) => {
        const supplier = await ctx.db.get(config.supplierId);
        return {
          ...config,
          supplierName: supplier?.name ?? "Unknown",
          // Never expose secrets to the client
          apiKeyEncrypted: config.apiKeyEncrypted ? "••••••••" : undefined,
          clientSecret: config.clientSecret ? "••••••••" : undefined,
        };
      })
    );
  },
});

export const getConfig = query({
  args: { supplierId: v.id("suppliers") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("supplierApiConfigs")
      .withIndex("by_supplier", (q) => q.eq("supplierId", args.supplierId))
      .unique();
  },
});

export const upsertConfig = mutation({
  args: {
    supplierId: v.id("suppliers"),
    provider: v.union(
      v.literal("digikey"),
      v.literal("mouser"),
      v.literal("lcsc"),
      v.literal("manual")
    ),
    clientId: v.optional(v.string()),
    clientSecret: v.optional(v.string()),
    apiKeyEncrypted: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("supplierApiConfigs")
      .withIndex("by_supplier", (q) => q.eq("supplierId", args.supplierId))
      .unique();

    const isConfigured = !!(args.clientId || args.apiKeyEncrypted);

    if (existing) {
      await ctx.db.patch(existing._id, {
        provider: args.provider,
        clientId: args.clientId,
        clientSecret: args.clientSecret,
        apiKeyEncrypted: args.apiKeyEncrypted,
        isConfigured,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("supplierApiConfigs", {
      supplierId: args.supplierId,
      provider: args.provider,
      clientId: args.clientId,
      clientSecret: args.clientSecret,
      apiKeyEncrypted: args.apiKeyEncrypted,
      isConfigured,
      lastSyncStatus: "never",
      updatedAt: Date.now(),
    });
  },
});

// ----------------------------------------------------------
// PRICING DATA QUERIES
// ----------------------------------------------------------

// Get all supplier pricing for a specific component
export const getComponentPricing = query({
  args: { componentId: v.id("components") },
  handler: async (ctx, args) => {
    const component = await ctx.db.get(args.componentId);
    if (!component) return null;

    const supplierLinks = await ctx.db
      .query("componentSuppliers")
      .withIndex("by_component", (q) => q.eq("componentId", args.componentId))
      .collect();

    const pricing = await Promise.all(
      supplierLinks.map(async (link) => {
        const supplier = await ctx.db.get(link.supplierId);
        const config = await ctx.db
          .query("supplierApiConfigs")
          .withIndex("by_supplier", (q) => q.eq("supplierId", link.supplierId))
          .unique();

        return {
          ...link,
          supplierName: supplier?.name ?? "Unknown",
          supplierCode: supplier?.code ?? "Unknown",
          apiProvider: config?.provider ?? "manual",
          apiConfigured: config?.isConfigured ?? false,
          lastSyncAt: config?.lastSyncAt,
          lastSyncStatus: config?.lastSyncStatus,
        };
      })
    );

    return {
      component: {
        _id: component._id,
        name: component.name,
        partNumber: component.partNumber,
        category: component.category,
        manufacturer: component.manufacturer,
        manufacturerPartNumber: component.manufacturerPartNumber,
      },
      pricing: pricing.sort((a, b) => (a.unitPrice ?? Infinity) - (b.unitPrice ?? Infinity)),
    };
  },
});

// ----------------------------------------------------------
// STUBBED API ACTIONS
// ----------------------------------------------------------
// These are Convex actions (not mutations) because they would
// make external HTTP calls in production.

export const searchParts = action({
  args: {
    provider: v.string(),
    query: v.string(),
  },
  handler: async (_ctx, args) => {
    switch (args.provider) {
      case "digikey":
        return searchDigiKey(args.query);
      case "mouser":
        return searchMouser(args.query);
      case "lcsc":
        return searchLCSC(args.query);
      default:
        return { results: [], message: "Unknown provider" };
    }
  },
});

export const refreshPricing = action({
  args: {
    provider: v.string(),
    supplierPartNumber: v.string(),
  },
  handler: async (_ctx, args) => {
    switch (args.provider) {
      case "digikey":
        return getDigiKeyPricing(args.supplierPartNumber);
      case "mouser":
        return getMouserPricing(args.supplierPartNumber);
      case "lcsc":
        return getLCSCPricing(args.supplierPartNumber);
      default:
        return { price: null, message: "Unknown provider" };
    }
  },
});

// ----------------------------------------------------------
// STUB IMPLEMENTATIONS
// ----------------------------------------------------------
// TODO: Replace each stub with real API calls when keys are available.
// Each function documents the API endpoint and auth requirements.

/**
 * DigiKey Product Search API
 * TODO: Replace with real API call when API key is configured
 * Docs: https://developer.digikey.com/products/product-information/partsearch
 * Auth: OAuth2 Client Credentials (Client ID + Client Secret)
 * Endpoint: POST https://api.digikey.com/products/v4/search/keyword
 */
function searchDigiKey(query: string) {
  return {
    results: [] as Array<{
      partNumber: string;
      manufacturer: string;
      description: string;
      unitPrice: number;
      moq: number;
      inStock: number;
      leadTimeDays: number;
      url: string;
    }>,
    totalCount: 0,
    message: `DigiKey API not configured. Search for "${query}" requires Client ID and Client Secret from developer.digikey.com`,
    provider: "digikey" as const,
    configured: false,
  };
}

/**
 * Mouser Part Search API
 * TODO: Replace with real API call when API key is configured
 * Docs: https://api.mouser.com/api/docs/ui/index
 * Auth: API Key (passed as header)
 * Endpoint: POST https://api.mouser.com/api/v2/search/keyword
 */
function searchMouser(query: string) {
  return {
    results: [] as Array<{
      partNumber: string;
      manufacturer: string;
      description: string;
      unitPrice: number;
      moq: number;
      inStock: number;
      leadTimeDays: number;
      url: string;
    }>,
    totalCount: 0,
    message: `Mouser API not configured. Search for "${query}" requires an API key from api.mouser.com`,
    provider: "mouser" as const,
    configured: false,
  };
}

/**
 * LCSC Part Search API
 * TODO: Replace with real API call when API key is configured
 * Docs: https://lcsc.com/api
 * Auth: API Key
 * Endpoint: GET https://wmsc.lcsc.com/ftps/wm/product/search
 */
function searchLCSC(query: string) {
  return {
    results: [] as Array<{
      partNumber: string;
      manufacturer: string;
      description: string;
      unitPrice: number;
      moq: number;
      inStock: number;
      leadTimeDays: number;
      url: string;
    }>,
    totalCount: 0,
    message: `LCSC API not configured. Search for "${query}" requires an API key`,
    provider: "lcsc" as const,
    configured: false,
  };
}

/**
 * DigiKey Part Pricing
 * TODO: Replace with real API call
 * Endpoint: GET https://api.digikey.com/products/v4/search/{partNumber}/productdetails
 */
function getDigiKeyPricing(supplierPN: string) {
  return {
    price: null as number | null,
    inStock: null as number | null,
    leadTimeDays: null as number | null,
    moq: null as number | null,
    priceBreaks: [] as Array<{ quantity: number; price: number }>,
    message: `DigiKey pricing for "${supplierPN}" requires API configuration`,
    provider: "digikey" as const,
    configured: false,
  };
}

/**
 * Mouser Part Pricing
 * TODO: Replace with real API call
 * Endpoint: POST https://api.mouser.com/api/v2/search/partnumber
 */
function getMouserPricing(supplierPN: string) {
  return {
    price: null as number | null,
    inStock: null as number | null,
    leadTimeDays: null as number | null,
    moq: null as number | null,
    priceBreaks: [] as Array<{ quantity: number; price: number }>,
    message: `Mouser pricing for "${supplierPN}" requires API configuration`,
    provider: "mouser" as const,
    configured: false,
  };
}

/**
 * LCSC Part Pricing
 * TODO: Replace with real API call
 */
function getLCSCPricing(supplierPN: string) {
  return {
    price: null as number | null,
    inStock: null as number | null,
    leadTimeDays: null as number | null,
    moq: null as number | null,
    priceBreaks: [] as Array<{ quantity: number; price: number }>,
    message: `LCSC pricing for "${supplierPN}" requires API configuration`,
    provider: "lcsc" as const,
    configured: false,
  };
}

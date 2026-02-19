/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent_alerts from "../agent/alerts.js";
import type * as agent_bomSync from "../agent/bomSync.js";
import type * as agent_briefing from "../agent/briefing.js";
import type * as agent_taskEscalation from "../agent/taskEscalation.js";
import type * as agent_tasks from "../agent/tasks.js";
import type * as clearAndReseed from "../clearAndReseed.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as driveSync_driveFiles from "../driveSync/driveFiles.js";
import type * as driveSync_syncLog from "../driveSync/syncLog.js";
import type * as inventory_bomEntries from "../inventory/bomEntries.js";
import type * as inventory_buildLifecycle from "../inventory/buildLifecycle.js";
import type * as inventory_buildOrders from "../inventory/buildOrders.js";
import type * as inventory_buildWorkflow from "../inventory/buildWorkflow.js";
import type * as inventory_componentSuppliers from "../inventory/componentSuppliers.js";
import type * as inventory_components from "../inventory/components.js";
import type * as inventory_locations from "../inventory/locations.js";
import type * as inventory_purchaseOrders from "../inventory/purchaseOrders.js";
import type * as inventory_receiving from "../inventory/receiving.js";
import type * as inventory_stock from "../inventory/stock.js";
import type * as inventory_stockmonitor from "../inventory/stockmonitor.js";
import type * as inventory_storage from "../inventory/storage.js";
import type * as inventory_suppliers from "../inventory/suppliers.js";
import type * as inventory_transactions from "../inventory/transactions.js";
import type * as notifications from "../notifications.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "agent/alerts": typeof agent_alerts;
  "agent/bomSync": typeof agent_bomSync;
  "agent/briefing": typeof agent_briefing;
  "agent/taskEscalation": typeof agent_taskEscalation;
  "agent/tasks": typeof agent_tasks;
  clearAndReseed: typeof clearAndReseed;
  crons: typeof crons;
  dashboard: typeof dashboard;
  "driveSync/driveFiles": typeof driveSync_driveFiles;
  "driveSync/syncLog": typeof driveSync_syncLog;
  "inventory/bomEntries": typeof inventory_bomEntries;
  "inventory/buildLifecycle": typeof inventory_buildLifecycle;
  "inventory/buildOrders": typeof inventory_buildOrders;
  "inventory/buildWorkflow": typeof inventory_buildWorkflow;
  "inventory/componentSuppliers": typeof inventory_componentSuppliers;
  "inventory/components": typeof inventory_components;
  "inventory/locations": typeof inventory_locations;
  "inventory/purchaseOrders": typeof inventory_purchaseOrders;
  "inventory/receiving": typeof inventory_receiving;
  "inventory/stock": typeof inventory_stock;
  "inventory/stockmonitor": typeof inventory_stockmonitor;
  "inventory/storage": typeof inventory_storage;
  "inventory/suppliers": typeof inventory_suppliers;
  "inventory/transactions": typeof inventory_transactions;
  notifications: typeof notifications;
  seed: typeof seed;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

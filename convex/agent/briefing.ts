import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  internalAction,
} from "../_generated/server";
import { internal } from "../_generated/api";

// ============================================================
// DAILY BRIEFING GENERATOR
// ============================================================
//
// Flow:
// 1. Cron triggers at configured time (e.g., 7:00 AM CT)
// 2. Gather operational data from all systems
// 3. Call Claude API to synthesize into a human-readable briefing
// 4. Store in Convex for dashboard display
//
// The briefing sounds like a senior ops manager, not a chatbot.

// ============================================================
// QUERIES — Dashboard-facing
// ============================================================

// Get today's briefing
export const today = query({
  handler: async (ctx) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const results = await ctx.db
      .query("briefings")
      .withIndex("by_date", (q) => q.eq("date", todayStr))
      .take(1);
    return results[0] ?? null;
  },
});

// Get the most recent briefing (might not be today's)
export const latest = query({
  handler: async (ctx) => {
    const results = await ctx.db
      .query("briefings")
      .withIndex("by_generatedAt")
      .order("desc")
      .take(1);
    return results[0] ?? null;
  },
});

// List recent briefings
export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("briefings")
      .withIndex("by_generatedAt")
      .order("desc")
      .take(args.limit ?? 14); // Default: last 2 weeks
  },
});

// Mark a briefing as read
export const markRead = mutation({
  args: {
    id: v.id("briefings"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const briefing = await ctx.db.get(args.id);
    if (!briefing) throw new Error("Briefing not found");

    const readBy = briefing.readBy ?? [];
    if (!readBy.includes(args.userId)) {
      await ctx.db.patch(args.id, { readBy: [...readBy, args.userId] });
    }
  },
});

// ============================================================
// INTERNAL QUERIES — Data gathering for briefing
// ============================================================

// Gather inventory snapshot
export const _gatherInventoryData = internalQuery({
  handler: async (ctx) => {
    const now = Date.now();
    const yesterday = now - 24 * 60 * 60 * 1000;
    const today = new Date().toISOString().split("T")[0];

    // Low stock alerts (open)
    const lowStockAlerts = await ctx.db
      .query("alerts")
      .withIndex("by_type_status", (q) =>
        q.eq("type", "low_stock").eq("status", "active")
      )
      .collect();

    // Pending POs (submitted, confirmed, shipped)
    const allPOs = await ctx.db.query("purchaseOrders").collect();
    const pendingPOs = allPOs.filter((po) =>
      ["submitted", "confirmed", "shipped"].includes(po.status)
    );

    // POs arriving today
    const arrivingToday = pendingPOs.filter((po) => {
      if (!po.expectedDelivery) return false;
      const deliveryDate = new Date(po.expectedDelivery)
        .toISOString()
        .split("T")[0];
      return deliveryDate === today;
    });

    // Overdue POs
    const overduePOs = pendingPOs.filter((po) => {
      if (!po.expectedDelivery) return false;
      return po.expectedDelivery < now && po.status !== "received";
    });

    // Active build orders
    const allBuilds = await ctx.db.query("buildOrders").collect();
    const activeBuilds = allBuilds.filter((b) =>
      ["planned", "materials_reserved", "in_progress", "qc"].includes(b.status)
    );

    // Recent transactions (last 24h)
    const allTransactions = await ctx.db.query("inventoryTransactions").collect();
    const recentTransactions = allTransactions.filter(
      (t) => t.timestamp > yesterday
    );

    // Component count
    const components = await ctx.db.query("components").collect();
    const activeComponents = components.filter((c) => c.status === "active");

    return {
      lowStockCount: lowStockAlerts.length,
      lowStockItems: lowStockAlerts.map((a) => a.title).slice(0, 5),
      pendingPOCount: pendingPOs.length,
      pendingPOs: pendingPOs.map((po) => ({
        poNumber: po.poNumber,
        status: po.status,
        expectedDelivery: po.expectedDelivery,
        total: po.totalCost,
      })),
      arrivingTodayCount: arrivingToday.length,
      arrivingToday: arrivingToday.map((po) => po.poNumber),
      overduePOCount: overduePOs.length,
      overduePOs: overduePOs.map((po) => ({
        poNumber: po.poNumber,
        expectedDelivery: po.expectedDelivery,
      })),
      activeBuildOrderCount: activeBuilds.length,
      activeBuilds: activeBuilds.map((b) => ({
        buildNumber: b.buildNumber,
        product: b.productName,
        quantity: b.quantity,
        status: b.status,
      })),
      recentTransactionCount: recentTransactions.length,
      totalActiveComponents: activeComponents.length,
    };
  },
});

// Gather Drive snapshot
export const _gatherDriveData = internalQuery({
  handler: async (ctx) => {
    const now = Date.now();
    const yesterday = now - 24 * 60 * 60 * 1000;
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

    const allFiles = await ctx.db.query("driveFiles").collect();

    // Files modified yesterday
    const modifiedYesterday = allFiles.filter(
      (f) => (f.modifiedTime ?? 0) > yesterday
    );

    // BOM change logs (unresolved)
    const allChangeLogs = await ctx.db.query("bomChangeLogs").collect();
    const unresolvedChanges = allChangeLogs.filter(
      (l) => l.status === "detected" || l.status === "requires_human"
    );

    // Recent sync status
    const syncLogs = await ctx.db
      .query("driveSyncLog")
      .withIndex("by_startedAt")
      .order("desc")
      .take(5);
    const lastSync = syncLogs[0];

    // Products with stale engineering logs (no BOM/doc updates in 14+ days)
    const products = new Set(allFiles.map((f) => f.productName).filter(Boolean));
    const staleProducts: string[] = [];
    for (const product of products) {
      const productFiles = allFiles.filter((f) => f.productName === product);
      const latestMod = Math.max(...productFiles.map((f) => f.modifiedTime ?? 0));
      if (latestMod < twoWeeksAgo) {
        staleProducts.push(product!);
      }
    }

    return {
      filesModifiedYesterday: modifiedYesterday.length,
      modifiedFiles: modifiedYesterday
        .map((f) => `${f.name} (${f.productName ?? "shared"})`)
        .slice(0, 10),
      unresolvedBomChanges: unresolvedChanges.length,
      bomChangeDetails: unresolvedChanges
        .map(
          (l) =>
            `${l.changeType}: ${l.componentName ?? "unknown"} in ${l.product}`
        )
        .slice(0, 5),
      lastSyncAt: lastSync?.startedAt,
      lastSyncStatus: lastSync?.status,
      staleProducts,
      totalFiles: allFiles.length,
    };
  },
});

// Gather task/alert snapshot
export const _gatherTaskData = internalQuery({
  handler: async (ctx) => {
    const now = Date.now();
    const yesterday = now - 24 * 60 * 60 * 1000;

    // All tasks
    const allTasks = await ctx.db.query("tasks").collect();
    const pendingTasks = allTasks.filter(
      (t) => t.status === "pending" || t.status === "in_progress"
    );
    const overdueTasks = pendingTasks.filter(
      (t) => t.dueAt && t.dueAt < now
    );
    const completedYesterday = allTasks.filter(
      (t) => t.status === "completed" && t.completedAt && t.completedAt > yesterday
    );

    // Open alerts
    const allAlerts = await ctx.db.query("alerts").collect();
    const openAlerts = allAlerts.filter((a) => a.status === "active");
    const criticalAlerts = openAlerts.filter((a) => a.severity === "critical");

    return {
      pendingCount: pendingTasks.length,
      pendingTasks: pendingTasks
        .sort((a, b) => {
          const priorityOrder: Record<string, number> = {
            urgent: 0,
            high: 1,
            normal: 2,
            low: 3,
          };
          return (
            (priorityOrder[a.priority] ?? 9) -
            (priorityOrder[b.priority] ?? 9)
          );
        })
        .slice(0, 5)
        .map((t) => ({
          title: t.title,
          priority: t.priority,
          type: t.type,
          dueAt: t.dueAt,
          isOverdue: t.dueAt ? t.dueAt < now : false,
        })),
      overdueCount: overdueTasks.length,
      overdueTasks: overdueTasks.map((t) => t.title).slice(0, 5),
      completedYesterdayCount: completedYesterday.length,
      openAlertCount: openAlerts.length,
      criticalAlertCount: criticalAlerts.length,
      criticalAlerts: criticalAlerts
        .map((a) => a.title)
        .slice(0, 3),
    };
  },
});

// ============================================================
// INTERNAL MUTATIONS
// ============================================================

// Create a new briefing record (in "generating" state)
export const _createBriefing = internalMutation({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    // Check if one already exists for today
    const existing = await ctx.db
      .query("briefings")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .take(1);

    if (existing[0]) {
      // Update the existing one to "generating"
      await ctx.db.patch(existing[0]._id, {
        status: "generating",
        error: undefined,
      });
      return existing[0]._id;
    }

    return await ctx.db.insert("briefings", {
      date: args.date,
      generatedAt: Date.now(),
      summary: "",
      sections: {
        inventory: {
          lowStockCount: 0,
          pendingPOs: 0,
          arrivingToday: 0,
          activeBuildOrders: 0,
          highlights: [],
        },
        drive: {
          filesModifiedYesterday: 0,
          structuralViolations: 0,
          staleEngLogs: 0,
          highlights: [],
        },
        tasks: {
          pendingCount: 0,
          overdueCount: 0,
          completedYesterday: 0,
          highlights: [],
        },
        upcoming: { highlights: [] },
      },
      status: "generating",
    });
  },
});

// Finalize a briefing with generated content
export const _finalizeBriefing = internalMutation({
  args: {
    id: v.id("briefings"),
    summary: v.string(),
    sections: v.object({
      inventory: v.object({
        lowStockCount: v.number(),
        pendingPOs: v.number(),
        arrivingToday: v.number(),
        activeBuildOrders: v.number(),
        highlights: v.array(v.string()),
      }),
      drive: v.object({
        filesModifiedYesterday: v.number(),
        structuralViolations: v.number(),
        staleEngLogs: v.number(),
        highlights: v.array(v.string()),
      }),
      tasks: v.object({
        pendingCount: v.number(),
        overdueCount: v.number(),
        completedYesterday: v.number(),
        highlights: v.array(v.string()),
      }),
      upcoming: v.object({
        highlights: v.array(v.string()),
      }),
    }),
    dataSnapshot: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...data } = args;
    await ctx.db.patch(id, {
      ...data,
      generatedAt: Date.now(),
      status: "ready",
    });
  },
});

// Mark briefing as errored
export const _failBriefing = internalMutation({
  args: {
    id: v.id("briefings"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "error",
      error: args.error,
    });
  },
});

// ============================================================
// ACTION — The Main Briefing Generator
// ============================================================

export const generate = internalAction({
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().toLocaleDateString("en-US", {
      weekday: "long",
    });
    const dateFormatted = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    // 1. Create the briefing record
    const briefingId = await ctx.runMutation(
      internal.agent.briefing._createBriefing,
      { date: today }
    );

    try {
      // 2. Gather data from all systems
      const [inventoryData, driveData, taskData] = await Promise.all([
        ctx.runQuery(internal.agent.briefing._gatherInventoryData),
        ctx.runQuery(internal.agent.briefing._gatherDriveData),
        ctx.runQuery(internal.agent.briefing._gatherTaskData),
      ]);

      const dataSnapshot = JSON.stringify(
        { inventoryData, driveData, taskData },
        null,
        2
      );

      // 3. Build structured sections from raw data
      const sections = buildSectionsFromData(
        inventoryData,
        driveData,
        taskData
      );

      // 4. Generate natural language summary via Claude API
      const summary = await generateBriefingSummary(
        dateFormatted,
        inventoryData,
        driveData,
        taskData
      );

      // 5. Save the completed briefing
      await ctx.runMutation(internal.agent.briefing._finalizeBriefing, {
        id: briefingId,
        summary,
        sections,
        dataSnapshot,
      });

      return { success: true, briefingId };
    } catch (error: any) {
      // Log the error but don't crash
      await ctx.runMutation(internal.agent.briefing._failBriefing, {
        id: briefingId,
        error: error.message ?? "Unknown error generating briefing",
      });
      return { success: false, error: error.message };
    }
  },
});

// ============================================================
// HELPER: Build structured sections from raw data
// ============================================================

function buildSectionsFromData(
  inventory: any,
  drive: any,
  tasks: any
) {
  // Inventory highlights
  const inventoryHighlights: string[] = [];
  if (inventory.lowStockCount > 0) {
    inventoryHighlights.push(
      `${inventory.lowStockCount} component${inventory.lowStockCount > 1 ? "s" : ""} below minimum stock`
    );
  }
  if (inventory.arrivingTodayCount > 0) {
    inventoryHighlights.push(
      `${inventory.arrivingTodayCount} PO${inventory.arrivingTodayCount > 1 ? "s" : ""} arriving today: ${inventory.arrivingToday.join(", ")}`
    );
  }
  if (inventory.overduePOCount > 0) {
    inventoryHighlights.push(
      `⚠️ ${inventory.overduePOCount} overdue PO${inventory.overduePOCount > 1 ? "s" : ""}`
    );
  }
  if (inventory.activeBuildOrderCount > 0) {
    for (const build of inventory.activeBuilds) {
      inventoryHighlights.push(
        `Build ${build.buildNumber}: ${build.quantity}x ${build.product} (${build.status})`
      );
    }
  }
  if (inventoryHighlights.length === 0) {
    inventoryHighlights.push("All inventory levels healthy. No pending orders.");
  }

  // Drive highlights
  const driveHighlights: string[] = [];
  if (drive.filesModifiedYesterday > 0) {
    driveHighlights.push(
      `${drive.filesModifiedYesterday} file${drive.filesModifiedYesterday > 1 ? "s" : ""} modified yesterday`
    );
  }
  if (drive.unresolvedBomChanges > 0) {
    driveHighlights.push(
      `${drive.unresolvedBomChanges} unresolved BOM change${drive.unresolvedBomChanges > 1 ? "s" : ""} need attention`
    );
  }
  if (drive.staleProducts.length > 0) {
    driveHighlights.push(
      `Engineering logs stale (14+ days) for: ${drive.staleProducts.join(", ")}`
    );
  }
  if (driveHighlights.length === 0) {
    driveHighlights.push("Drive is quiet. No structural issues detected.");
  }

  // Task highlights
  const taskHighlights: string[] = [];
  if (tasks.overdueCount > 0) {
    taskHighlights.push(
      `⚠️ ${tasks.overdueCount} overdue task${tasks.overdueCount > 1 ? "s" : ""}`
    );
  }
  if (tasks.pendingCount > 0) {
    taskHighlights.push(
      `${tasks.pendingCount} task${tasks.pendingCount > 1 ? "s" : ""} pending your action`
    );
  }
  if (tasks.completedYesterdayCount > 0) {
    taskHighlights.push(
      `${tasks.completedYesterdayCount} task${tasks.completedYesterdayCount > 1 ? "s" : ""} completed yesterday ✓`
    );
  }
  if (tasks.criticalAlertCount > 0) {
    taskHighlights.push(
      `🚨 ${tasks.criticalAlertCount} critical alert${tasks.criticalAlertCount > 1 ? "s" : ""}: ${tasks.criticalAlerts.join("; ")}`
    );
  }
  if (taskHighlights.length === 0) {
    taskHighlights.push("All clear — no pending tasks or alerts.");
  }

  // Upcoming highlights (synthesized from all data)
  const upcomingHighlights: string[] = [];
  if (inventory.pendingPOCount > 0) {
    upcomingHighlights.push(
      `${inventory.pendingPOCount} PO${inventory.pendingPOCount > 1 ? "s" : ""} in pipeline`
    );
  }
  for (const build of inventory.activeBuilds ?? []) {
    if (build.status === "planned") {
      upcomingHighlights.push(
        `Build ${build.buildNumber} (${build.quantity}x ${build.product}) ready to start`
      );
    }
  }
  if (upcomingHighlights.length === 0) {
    upcomingHighlights.push("No upcoming deadlines or builds scheduled.");
  }

  return {
    inventory: {
      lowStockCount: inventory.lowStockCount,
      pendingPOs: inventory.pendingPOCount,
      arrivingToday: inventory.arrivingTodayCount,
      activeBuildOrders: inventory.activeBuildOrderCount,
      highlights: inventoryHighlights,
    },
    drive: {
      filesModifiedYesterday: drive.filesModifiedYesterday,
      structuralViolations: drive.unresolvedBomChanges,
      staleEngLogs: drive.staleProducts.length,
      highlights: driveHighlights,
    },
    tasks: {
      pendingCount: tasks.pendingCount,
      overdueCount: tasks.overdueCount,
      completedYesterday: tasks.completedYesterdayCount,
      highlights: taskHighlights,
    },
    upcoming: {
      highlights: upcomingHighlights,
    },
  };
}

// ============================================================
// HELPER: Generate natural language summary via Claude API
// ============================================================

async function generateBriefingSummary(
  dateFormatted: string,
  inventory: any,
  drive: any,
  tasks: any
): Promise<string> {
  // Check if ANTHROPIC_API_KEY is available
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Fallback: generate a structured briefing without Claude API
    return generateFallbackBriefing(dateFormatted, inventory, drive, tasks);
  }

  const prompt = `You are the CCS Technologies Operations Manager — a competent, no-nonsense operations professional. Generate a morning operational briefing for Steve (CEO/Founder) based on the following data.

Be direct, specific, and actionable. Don't use corporate buzzwords. If something needs attention, say so clearly. If everything is fine, say that too — don't manufacture urgency.

Date: ${dateFormatted}

INVENTORY DATA:
${JSON.stringify(inventory, null, 2)}

DRIVE DATA:
${JSON.stringify(drive, null, 2)}

TASKS & ALERTS:
${JSON.stringify(tasks, null, 2)}

Format the briefing like this example:
---
Good morning, Steve. Here's your operational snapshot for [day].

📦 INVENTORY
[2-4 bullet points, most important first]

📁 DRIVE
[1-3 bullet points about file changes and issues]

✅ TASKS
[1-3 bullet points about pending work]

🔮 UPCOMING
[1-2 bullet points about what's ahead]
---

Keep it under 300 words. Lead with what needs action. Skip sections that have nothing to report (just say "All clear" in one line).`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error(`Claude API error: ${response.status}`);
      return generateFallbackBriefing(dateFormatted, inventory, drive, tasks);
    }

    const data = await response.json();
    const text = data.content
      ?.filter((block: any) => block.type === "text")
      .map((block: any) => block.text)
      .join("\n");

    return text || generateFallbackBriefing(dateFormatted, inventory, drive, tasks);
  } catch (error) {
    console.error("Claude API call failed:", error);
    return generateFallbackBriefing(dateFormatted, inventory, drive, tasks);
  }
}

/**
 * Fallback briefing when Claude API is unavailable.
 * Still structured and readable, just not as polished.
 */
function generateFallbackBriefing(
  dateFormatted: string,
  inventory: any,
  drive: any,
  tasks: any
): string {
  const lines: string[] = [];
  lines.push(`Good morning, Steve. Here's your operational snapshot for ${dateFormatted}.`);
  lines.push("");

  // Inventory
  lines.push("📦 INVENTORY");
  if (inventory.lowStockCount > 0) {
    lines.push(
      `- ${inventory.lowStockCount} components below minimum stock (see alerts for details)`
    );
  }
  if (inventory.arrivingTodayCount > 0) {
    lines.push(
      `- ${inventory.arrivingTodayCount} PO(s) arriving today: ${inventory.arrivingToday.join(", ")}`
    );
  }
  if (inventory.overduePOCount > 0) {
    lines.push(`- ⚠️ ${inventory.overduePOCount} overdue PO(s) need follow-up`);
  }
  if (inventory.activeBuildOrderCount > 0) {
    lines.push(
      `- ${inventory.activeBuildOrderCount} active build order(s)`
    );
  }
  if (
    inventory.lowStockCount === 0 &&
    inventory.arrivingTodayCount === 0 &&
    inventory.activeBuildOrderCount === 0
  ) {
    lines.push("- All clear — inventory levels healthy, no pending deliveries.");
  }
  lines.push("");

  // Drive
  lines.push("📁 DRIVE");
  if (drive.filesModifiedYesterday > 0) {
    lines.push(`- ${drive.filesModifiedYesterday} files modified yesterday`);
  }
  if (drive.unresolvedBomChanges > 0) {
    lines.push(
      `- ${drive.unresolvedBomChanges} unresolved BOM change(s) need review`
    );
  }
  if (drive.staleProducts.length > 0) {
    lines.push(
      `- Engineering logs stale for: ${drive.staleProducts.join(", ")} (14+ days)`
    );
  }
  if (
    drive.filesModifiedYesterday === 0 &&
    drive.unresolvedBomChanges === 0 &&
    drive.staleProducts.length === 0
  ) {
    lines.push("- All clear — no changes or issues detected.");
  }
  lines.push("");

  // Tasks
  lines.push("✅ TASKS");
  if (tasks.overdueCount > 0) {
    lines.push(`- ⚠️ ${tasks.overdueCount} overdue task(s)`);
  }
  if (tasks.pendingCount > 0) {
    lines.push(`- ${tasks.pendingCount} task(s) pending your action`);
  }
  if (tasks.completedYesterdayCount > 0) {
    lines.push(`- ${tasks.completedYesterdayCount} task(s) completed yesterday ✓`);
  }
  if (tasks.criticalAlertCount > 0) {
    lines.push(`- 🚨 ${tasks.criticalAlertCount} critical alert(s)`);
  }
  if (
    tasks.pendingCount === 0 &&
    tasks.overdueCount === 0 &&
    tasks.criticalAlertCount === 0
  ) {
    lines.push("- All clear — no pending tasks or alerts.");
  }

  return lines.join("\n");
}

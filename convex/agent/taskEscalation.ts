import { internalMutation } from "../_generated/server";

// ============================================================
// TASK ESCALATION — SLA Monitor
// ============================================================
// Called by cron jobs (convex/crons.ts). Not exposed to clients.
//
// checkTaskSLAs: Scans all open tasks against their dueAt SLA.
//   24hr+ overdue → escalationLevel 1, priority bumped to "high",
//                   task_overdue warning alert created.
//   48hr+ overdue → escalationLevel 2, priority bumped to "urgent",
//                   critical alert flagging co-founder notification.
//   Deduplicates alerts — won't double-alert for the same task.
// ============================================================

export const checkTaskSLAs = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;

    // Gather all open tasks with a due date
    const tasks = await ctx.db.query("tasks").collect();
    const openTasks = tasks.filter(
      (t) =>
        !["completed", "verified", "cancelled"].includes(t.status) &&
        t.dueAt !== undefined &&
        t.dueAt !== null
    );

    let escalated = 0;
    let alertsCreated = 0;

    for (const task of openTasks) {
      const overdueMsec = now - task.dueAt!;
      if (overdueMsec <= 0) continue; // Not overdue yet

      const hoursOverdue = overdueMsec / (1000 * 60 * 60);
      const targetLevel = hoursOverdue >= 48 ? 2 : hoursOverdue >= 24 ? 1 : 0;
      if (targetLevel === 0) continue;

      // Already at or beyond this escalation level — skip
      if (task.escalationLevel >= targetLevel) continue;

      const newPriority = targetLevel === 2 ? "urgent" : "high";
      const newStatus = task.status === "pending" ? "escalated" : task.status;

      await ctx.db.patch(task._id, {
        escalationLevel: targetLevel,
        escalatedAt: now,
        priority: newPriority,
        status: newStatus,
        updatedAt: now,
      });
      escalated++;

      // Deduplicate: check for existing active task_overdue alert for this task
      const existingAlerts = await ctx.db
        .query("alerts")
        .withIndex("by_type", (q) => q.eq("type", "task_overdue"))
        .collect();

      const alreadyAlerted = existingAlerts.some(
        (a) =>
          (a.status === "active" || a.status === "acknowledged") &&
          a.agentContext?.includes(task._id)
      );

      if (alreadyAlerted) continue;

      const severity = targetLevel === 2 ? "critical" : "warning";
      const daysOverdue = Math.ceil(overdueMsec / (1000 * 60 * 60 * 24));

      const title =
        targetLevel === 2
          ? `URGENT: Task overdue 48h+ — notify co-founder: ${task.title}`
          : `Task overdue 24h+: ${task.title}`;

      const message =
        targetLevel === 2
          ? `Task "${task.title}" is ${daysOverdue} day(s) overdue (SLA: ${task.slaHours ?? "N/A"}h). ` +
            `Priority escalated to URGENT. Co-founder notification required per SLA policy.` +
            (task.assignedTo ? ` Assigned to: ${task.assignedTo}.` : " Unassigned.")
          : `Task "${task.title}" is ${daysOverdue} day(s) overdue (SLA: ${task.slaHours ?? "N/A"}h). ` +
            `Priority bumped to HIGH.` +
            (task.assignedTo ? ` Assigned to: ${task.assignedTo}.` : " Unassigned.");

      await ctx.db.insert("alerts", {
        type: "task_overdue",
        severity,
        title,
        message,
        status: "active",
        agentGenerated: true,
        agentContext: JSON.stringify({
          trigger: "task_escalation_cron",
          taskId: task._id,
          escalationLevel: targetLevel,
          hoursOverdue: Math.round(hoursOverdue),
          assignedTo: task.assignedTo,
        }),
        updatedAt: now,
      });
      alertsCreated++;
    }

    console.log(
      `[TaskEscalation] Checked ${openTasks.length} open tasks. ` +
        `Escalated ${escalated}, created ${alertsCreated} alerts.`
    );

    return { tasksChecked: openTasks.length, escalated, alertsCreated };
  },
});

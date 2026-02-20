"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { PageHeader, LoadingState, AgentAvatar } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { CREW_LIST, resolveAlertAgent, resolveTaskAgent } from "@/lib/crew";
import type { CrewMember } from "@/lib/crew";
import { ALERT_SEVERITY_CONFIG, TASK_PRIORITY_CONFIG } from "@/lib/constants";
import { formatRelativeTime, cn } from "@/lib/utils";
import { Activity, AlertTriangle, ListChecks } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Alert = {
  _id: any;
  type: string;
  severity: string;
  title: string;
  message: string;
  status: string;
  agentGenerated?: boolean;
  agentContext?: string;
  _creationTime: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Task = {
  _id: any;
  title: string;
  description: string;
  type?: string;
  priority: string;
  status: string;
  agentGenerated?: boolean;
  agentContext?: string;
  _creationTime: number;
};

type ActivityItem = {
  id: string;
  kind: "alert" | "task";
  agent: CrewMember;
  title: string;
  severity?: string;
  priority?: string;
  timestamp: number;
};

export default function CrewPage() {
  const alerts = useQuery(api.agent.alerts.list, { limit: 100 });
  const tasks = useQuery(api.agent.tasks.list, { limit: 100 });

  // Derive per-agent stats and recent activity
  const { agentStats, activityFeed } = useMemo(() => {
    const stats: Record<string, { alertCount: number; taskCount: number; lastAction: number }> = {};
    for (const member of CREW_LIST) {
      stats[member.id] = { alertCount: 0, taskCount: 0, lastAction: 0 };
    }

    const feed: ActivityItem[] = [];

    // Count alerts per agent
    if (alerts) {
      for (const alert of alerts as Alert[]) {
        const agent = resolveAlertAgent(alert);
        if (agent) {
          stats[agent.id].alertCount++;
          if (alert._creationTime > stats[agent.id].lastAction) {
            stats[agent.id].lastAction = alert._creationTime;
          }
          feed.push({
            id: `alert-${alert._id}`,
            kind: "alert",
            agent,
            title: alert.title,
            severity: alert.severity,
            timestamp: alert._creationTime,
          });
        }
      }
    }

    // Count tasks per agent
    if (tasks) {
      for (const task of tasks as Task[]) {
        const agent = resolveTaskAgent(task);
        if (agent) {
          stats[agent.id].taskCount++;
          if (task._creationTime > stats[agent.id].lastAction) {
            stats[agent.id].lastAction = task._creationTime;
          }
          feed.push({
            id: `task-${task._id}`,
            kind: "task",
            agent,
            title: task.title,
            priority: task.priority,
            timestamp: task._creationTime,
          });
        }
      }
    }

    // Sort feed by time, newest first
    feed.sort((a, b) => b.timestamp - a.timestamp);

    return { agentStats: stats, activityFeed: feed.slice(0, 20) };
  }, [alerts, tasks]);

  if (alerts === undefined || tasks === undefined) {
    return <LoadingState message="Loading crew data..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ops Crew"
        description="The autonomous agents keeping CCS Operations running"
      />

      {/* Agent Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {CREW_LIST.map((member) => {
          const stats = agentStats[member.id];
          return (
            <div
              key={member.id}
              className="card flex flex-col gap-4"
            >
              {/* Header */}
              <div className="flex items-start gap-4">
                <AgentAvatar agent={member} size="lg" showName={false} />
                <div className="min-w-0 flex-1">
                  <h3 className={cn("text-base font-semibold", member.color)}>
                    {member.name}
                  </h3>
                  <p className="text-xs text-text-secondary">{member.title}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="text-2xs text-emerald-400">Active</span>
                    <span className="text-2xs text-text-tertiary">
                      · {member.cronInterval}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs leading-relaxed text-text-secondary">
                {member.description}
              </p>

              {/* Stats */}
              <div className="flex items-center gap-4 border-t border-surface-4 pt-3">
                {member.alertTypes.length > 0 && (
                  <div className="flex items-center gap-1.5 text-2xs text-text-tertiary">
                    <AlertTriangle size={10} />
                    <span>
                      <span className="font-medium text-text-secondary">
                        {stats.alertCount}
                      </span>{" "}
                      alert{stats.alertCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
                {member.taskTypes.length > 0 && (
                  <div className="flex items-center gap-1.5 text-2xs text-text-tertiary">
                    <ListChecks size={10} />
                    <span>
                      <span className="font-medium text-text-secondary">
                        {stats.taskCount}
                      </span>{" "}
                      task{stats.taskCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
                {member.id === "slaEnforcer" && (
                  <div className="flex items-center gap-1.5 text-2xs text-text-tertiary">
                    <AlertTriangle size={10} />
                    <span>
                      <span className="font-medium text-text-secondary">
                        {stats.alertCount}
                      </span>{" "}
                      escalation{stats.alertCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
                {stats.lastAction > 0 && (
                  <div className="ml-auto text-2xs text-text-tertiary">
                    Last: {formatRelativeTime(stats.lastAction)}
                  </div>
                )}
                {stats.lastAction === 0 && (
                  <div className="text-2xs text-text-tertiary">
                    No recent activity
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Activity Feed */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Activity size={14} className="text-text-tertiary" />
          <h2 className="text-sm font-semibold text-text-primary">
            Recent Crew Activity
          </h2>
          <span className="text-2xs text-text-tertiary">
            Last {activityFeed.length} actions
          </span>
        </div>

        {activityFeed.length === 0 ? (
          <div className="card-compact text-center">
            <p className="text-sm text-text-secondary">
              No agent activity yet. The crew will start logging actions as crons run.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {activityFeed.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-surface-3/50"
              >
                <AgentAvatar agent={item.agent} size="sm" showName={false} />
                <span className={cn("text-2xs font-medium w-20 flex-shrink-0", item.agent.color)}>
                  {item.agent.name}
                </span>
                <span className="text-xs text-text-tertiary flex-shrink-0">
                  {item.kind === "alert" ? "raised" : "assigned"}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-text-primary">
                  {item.title}
                </span>
                {item.severity && (
                  <Badge
                    className={cn(
                      "flex-shrink-0 text-2xs",
                      ALERT_SEVERITY_CONFIG[item.severity]?.color ??
                        "bg-surface-3 text-text-tertiary"
                    )}
                  >
                    {item.severity}
                  </Badge>
                )}
                {item.priority && !item.severity && (
                  <Badge
                    className={cn(
                      "flex-shrink-0 text-2xs",
                      TASK_PRIORITY_CONFIG[item.priority]?.color ??
                        "bg-surface-3 text-text-tertiary"
                    )}
                  >
                    {item.priority}
                  </Badge>
                )}
                <span className="flex-shrink-0 text-2xs text-text-tertiary">
                  {formatRelativeTime(item.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

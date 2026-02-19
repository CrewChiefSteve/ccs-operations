"use client";

import { useState, FormEvent } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  PageHeader,
  StatusBadge,
  EmptyState,
  LoadingState,
  Modal,
  FormField,
} from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import {
  ListChecks,
  Plus,
  Clock,
  CheckCircle2,
  Circle,
  PlayCircle,
  Filter,
} from "lucide-react";
import {
  TASK_PRIORITY_CONFIG,
  TASK_STATUS_CONFIG,
} from "@/lib/constants";
import { formatRelativeTime, formatDate, cn } from "@/lib/utils";

type Task = {
  _id: string;
  title: string;
  description: string;
  assignedTo?: string;
  priority: string;
  status: string;
  dueDate?: number;
  category: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  completionNotes?: string;
  createdBy: string;
  _creationTime: number;
  completedAt?: number;
};

export default function TasksPage() {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const tasks = useQuery(api.agent.tasks.list, {
    status: statusFilter === "all" ? undefined : statusFilter,
    category: categoryFilter === "all" ? undefined : categoryFilter,
  });

  const createTask = useMutation(api.agent.tasks.create);
  const updateTaskStatus = useMutation(api.agent.tasks.updateStatus);
  const completeTask = useMutation(api.agent.tasks.complete);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await createTask({
      title: form.get("title") as string,
      description: form.get("description") as string,
      priority: form.get("priority") as string,
      category: form.get("category") as string,
      assignedTo: (form.get("assignedTo") as string) || undefined,
    });
    setShowCreate(false);
  }

  async function handleComplete(taskId: string) {
    const notes = prompt("Completion notes (optional):");
    await completeTask({
      taskId,
      completionNotes: notes || undefined,
    });
    setSelectedTask(null);
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Circle size={16} className="text-amber-400" />;
      case "in_progress":
        return <PlayCircle size={16} className="text-blue-400" />;
      case "completed":
        return <CheckCircle2 size={16} className="text-emerald-400" />;
      default:
        return <Circle size={16} className="text-text-tertiary" />;
    }
  };

  const isOverdue = (task: Task) =>
    task.dueDate &&
    task.dueDate < Date.now() &&
    task.status !== "completed" &&
    task.status !== "cancelled";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Task Queue"
        description="Agent-assigned and manual tasks"
        actions={
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            New Task
          </button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-lg border border-surface-4 bg-surface-1 p-0.5">
          {["pending", "in_progress", "all", "completed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === s
                  ? "bg-surface-3 text-text-primary"
                  : "text-text-tertiary hover:text-text-secondary"
              )}
            >
              {s === "all"
                ? "All"
                : TASK_STATUS_CONFIG[s]?.label ?? s}
            </button>
          ))}
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="input-base w-40"
        >
          <option value="all">All Categories</option>
          <option value="inventory">Inventory</option>
          <option value="drive">Drive</option>
          <option value="production">Production</option>
          <option value="purchasing">Purchasing</option>
        </select>
      </div>

      {/* Task List */}
      {tasks === undefined ? (
        <LoadingState />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={
            statusFilter === "pending"
              ? "No pending tasks"
              : "No tasks found"
          }
          description={
            statusFilter === "pending"
              ? "You're all caught up! The agent will assign tasks as needed."
              : "Try a different filter"
          }
        />
      ) : (
        <div className="space-y-2">
          {tasks.map((task: Task) => (
            <div
              key={task._id}
              onClick={() => setSelectedTask(task)}
              className={cn(
                "card-compact cursor-pointer transition-all hover:border-surface-3",
                isOverdue(task) && "border-status-danger/30"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{statusIcon(task.status)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-text-primary">
                      {task.title}
                    </h3>
                    <StatusBadge
                      status={task.priority}
                      config={TASK_PRIORITY_CONFIG}
                    />
                    <Badge className="bg-surface-3 text-text-tertiary">
                      {task.category}
                    </Badge>
                    {isOverdue(task) && (
                      <Badge className="bg-red-500/15 text-red-400">
                        Overdue
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-text-secondary line-clamp-2">
                    {task.description}
                  </p>
                  <div className="mt-2 flex items-center gap-4 text-2xs text-text-tertiary">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {formatRelativeTime(task._creationTime)}
                    </span>
                    {task.createdBy === "agent" && (
                      <span className="font-mono text-accent/60">
                        agent-assigned
                      </span>
                    )}
                    {task.dueDate && (
                      <span
                        className={cn(
                          isOverdue(task) && "text-status-danger font-medium"
                        )}
                      >
                        Due {formatDate(task.dueDate)}
                      </span>
                    )}
                    {task.assignedTo && (
                      <span>→ {task.assignedTo}</span>
                    )}
                  </div>
                </div>
                {task.status !== "completed" &&
                  task.status !== "cancelled" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleComplete(task._id);
                      }}
                      className="btn-ghost text-xs text-status-success hover:bg-emerald-500/10"
                    >
                      <CheckCircle2 size={14} />
                      Done
                    </button>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Task Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Task"
        description="Manually create a task (the agent creates most tasks automatically)"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <FormField label="Title" required>
            <input
              name="title"
              required
              placeholder="Physical inventory count for MCUs"
              className="input-base"
            />
          </FormField>
          <FormField label="Description" required>
            <textarea
              name="description"
              rows={3}
              required
              placeholder="Detailed instructions…"
              className="input-base resize-none"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Priority">
              <select name="priority" className="input-base">
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </FormField>
            <FormField label="Category">
              <select name="category" className="input-base">
                <option value="inventory">Inventory</option>
                <option value="drive">Drive</option>
                <option value="production">Production</option>
                <option value="purchasing">Purchasing</option>
              </select>
            </FormField>
          </div>
          <FormField label="Assign To">
            <input
              name="assignedTo"
              placeholder="Steve, Nick, etc."
              className="input-base"
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create Task
            </button>
          </div>
        </form>
      </Modal>

      {/* Task Detail Modal */}
      <Modal
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        title={selectedTask?.title ?? ""}
        size="md"
      >
        {selectedTask && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <StatusBadge
                status={selectedTask.status}
                config={TASK_STATUS_CONFIG}
              />
              <StatusBadge
                status={selectedTask.priority}
                config={TASK_PRIORITY_CONFIG}
              />
              <Badge className="bg-surface-3 text-text-tertiary">
                {selectedTask.category}
              </Badge>
            </div>

            <div className="rounded-lg bg-surface-2 p-4">
              <p className="text-sm leading-relaxed text-text-primary">
                {selectedTask.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-2xs text-text-tertiary">Created</p>
                <p className="text-text-primary">
                  {formatDate(selectedTask._creationTime)}
                  {selectedTask.createdBy === "agent" && (
                    <span className="ml-1.5 font-mono text-2xs text-accent/60">
                      by agent
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-2xs text-text-tertiary">Due Date</p>
                <p
                  className={cn(
                    "text-text-primary",
                    isOverdue(selectedTask) && "text-status-danger"
                  )}
                >
                  {selectedTask.dueDate
                    ? formatDate(selectedTask.dueDate)
                    : "No deadline"}
                </p>
              </div>
            </div>

            {selectedTask.completionNotes && (
              <div>
                <p className="text-2xs text-text-tertiary">Completion Notes</p>
                <p className="text-sm text-text-secondary">
                  {selectedTask.completionNotes}
                </p>
              </div>
            )}

            {selectedTask.status !== "completed" &&
              selectedTask.status !== "cancelled" && (
                <div className="flex gap-2 border-t border-surface-4 pt-4">
                  {selectedTask.status === "pending" && (
                    <button
                      onClick={() =>
                        updateTaskStatus({
                          taskId: selectedTask._id,
                          status: "in_progress",
                        }).then(() => setSelectedTask(null))
                      }
                      className="btn-secondary"
                    >
                      <PlayCircle size={14} />
                      Start Working
                    </button>
                  )}
                  <button
                    onClick={() => handleComplete(selectedTask._id)}
                    className="btn-primary"
                  >
                    <CheckCircle2 size={14} />
                    Mark Complete
                  </button>
                </div>
              )}
          </div>
        )}
      </Modal>
    </div>
  );
}

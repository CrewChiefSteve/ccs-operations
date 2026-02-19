"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  LoadingState,
  Modal,
  FormField,
} from "@/components/ui";
import { ROLE_CONFIG } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/utils";
import { Shield, UserX, UserCheck } from "lucide-react";

export default function SettingsPage() {
  const { isAdmin, profile } = useCurrentUser();
  const users = useQuery(api.users.listUsers);
  const updateRole = useMutation(api.users.updateRole);
  const deactivateUser = useMutation(api.users.deactivateUser);
  const reactivateUser = useMutation(api.users.reactivateUser);

  const [editingUser, setEditingUser] = useState<{
    id: Id<"userProfiles">;
    displayName: string;
    role: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield size={48} className="mx-auto mb-4 text-text-tertiary" />
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            Admin Access Required
          </h2>
          <p className="text-sm text-text-secondary">
            You need admin privileges to access settings.
          </p>
        </div>
      </div>
    );
  }

  if (users === undefined) return <LoadingState message="Loading users..." />;

  const handleRoleChange = async () => {
    if (!editingUser) return;
    setSubmitting(true);
    try {
      await updateRole({
        userId: editingUser.id,
        role: editingUser.role as "admin" | "operator",
      });
      setEditingUser(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update role");
    }
    setSubmitting(false);
  };

  const handleToggleActive = async (
    userId: Id<"userProfiles">,
    isActive: boolean
  ) => {
    try {
      if (isActive) {
        await deactivateUser({ userId });
      } else {
        await reactivateUser({ userId });
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage users, roles, and system configuration"
      />

      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-text-tertiary mb-3">
          Users
        </h3>

        <DataTable
          data={users}
          columns={[
            {
              key: "displayName",
              header: "Name",
              render: (u) => (
                <div>
                  <div className="font-medium text-text-primary">
                    {u.displayName}
                  </div>
                  <div className="text-2xs text-text-tertiary">{u.email}</div>
                </div>
              ),
            },
            {
              key: "role",
              header: "Role",
              render: (u) => <StatusBadge status={u.role} config={ROLE_CONFIG} />,
            },
            {
              key: "isActive",
              header: "Status",
              render: (u) => (
                <span
                  className={`text-xs font-medium ${u.isActive ? "text-emerald-400" : "text-red-400"}`}
                >
                  {u.isActive ? "Active" : "Inactive"}
                </span>
              ),
            },
            {
              key: "lastActiveAt",
              header: "Last Active",
              render: (u) => (
                <span className="text-text-secondary text-sm">
                  {formatRelativeTime(u.lastActiveAt)}
                </span>
              ),
            },
            {
              key: "actions",
              header: "",
              className: "w-24",
              render: (u) => {
                const isSelf = u.clerkUserId === profile?.clerkUserId;
                return (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() =>
                        setEditingUser({
                          id: u._id,
                          displayName: u.displayName,
                          role: u.role,
                        })
                      }
                      className="px-2 py-1 text-2xs rounded bg-surface-3 text-text-secondary hover:text-text-primary transition-colors"
                      title="Edit role"
                    >
                      Role
                    </button>
                    {!isSelf && (
                      <button
                        onClick={() => handleToggleActive(u._id, u.isActive)}
                        className="px-1.5 py-1 rounded bg-surface-3 text-text-secondary hover:text-text-primary transition-colors"
                        title={u.isActive ? "Deactivate" : "Reactivate"}
                      >
                        {u.isActive ? (
                          <UserX size={12} />
                        ) : (
                          <UserCheck size={12} />
                        )}
                      </button>
                    )}
                  </div>
                );
              },
            },
          ]}
        />
      </div>

      {/* Role Edit Modal */}
      {editingUser && (
        <Modal
          open
          onClose={() => setEditingUser(null)}
          title={`Edit Role — ${editingUser.displayName}`}
          size="sm"
        >
          <div className="space-y-4">
            <FormField label="Role" required>
              <select
                value={editingUser.role}
                onChange={(e) =>
                  setEditingUser({ ...editingUser, role: e.target.value })
                }
                className="input-base"
              >
                <option value="admin">Admin — Full access</option>
                <option value="operator">
                  Operator — Receiving, counting, builds, tasks
                </option>
              </select>
            </FormField>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingUser(null)}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleRoleChange}
                disabled={submitting}
                className="btn-primary text-sm"
              >
                {submitting ? "Saving..." : "Save Role"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Cpu,
  Package,
  Truck,
  ClipboardList,
  Hammer,
  ListChecks,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Zap,
  PackageCheck,
} from "lucide-react";
import { useState } from "react";

const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/catalog", label: "Components", icon: Cpu },
      { href: "/inventory", label: "Stock Levels", icon: Package },
      { href: "/suppliers", label: "Suppliers", icon: Truck },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/orders", label: "Purchase Orders", icon: ClipboardList },
      { href: "/receiving", label: "Receive Shipments", icon: PackageCheck },
      { href: "/builds", label: "Build Orders", icon: Hammer },
    ],
  },
  {
    label: "Agent",
    items: [
      { href: "/tasks", label: "Task Queue", icon: ListChecks },
      { href: "/alerts", label: "Alerts", icon: AlertTriangle },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-surface-4 bg-surface-1 transition-all duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-surface-4 px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent">
            <Zap size={14} className="text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-wide text-text-primary">
                CCS OPS
              </span>
              <span className="text-2xs text-text-tertiary">
                Operations Platform
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            {!collapsed && (
              <p className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-widest text-text-tertiary">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-accent/10 text-accent font-medium"
                        : "text-text-secondary hover:bg-surface-3/50 hover:text-text-primary",
                      collapsed && "justify-center px-0"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon
                      size={16}
                      className={cn(
                        "flex-shrink-0",
                        isActive ? "text-accent" : "text-text-tertiary"
                      )}
                    />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-surface-4 p-3">
        <div
          className={cn(
            "flex items-center",
            collapsed ? "justify-center" : "justify-between"
          )}
        >
          <div className={cn("flex items-center gap-2", collapsed && "hidden")}>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "h-7 w-7",
                },
              }}
            />
            <span className="text-xs text-text-secondary">Account</span>
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            {collapsed ? (
              <ChevronRight size={14} />
            ) : (
              <ChevronLeft size={14} />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

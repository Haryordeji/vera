import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import {
  LayoutDashboard,
  ClipboardList,
  Clock,
  UserCircle,
  Plus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApi } from "@/lib/api";
import type { Session } from "@/lib/types";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, key: "dashboard" },
  { to: "/patients", label: "Patients", icon: Users, end: false, key: "patients" },
  { to: "/visits", label: "Past Visits", icon: Clock, end: false, key: "visits" },
  { to: "/profile", label: "My Profile", icon: UserCircle, end: false, key: "profile" },
] as const;

export function Sidebar() {
  const navigate = useNavigate();
  const { get } = useApi();
  const [activeCount, setActiveCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<Session[]>("/sessions?scope=mine")
      .then((sessions) => {
        if (cancelled) return;
        const list = Array.isArray(sessions) ? sessions : [];
        setActiveCount(list.filter((s) => s.status !== "COMPLETED").length);
      })
      .catch(() => {
        if (!cancelled) setActiveCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [get]);

  return (
    <aside className="flex flex-col w-60 shrink-0 h-full bg-white border-r border-slate-200">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600 shrink-0" />
          <span className="text-lg font-semibold text-slate-800 tracking-tight">
            Vera
          </span>
        </div>
        <p className="mt-1 text-[10px] text-slate-400 leading-snug">
          Where medical documentation meets trust
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end, key }) => {
          const showBadge =
            key === "dashboard" && activeCount !== null && activeCount > 0;
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {showBadge && (
                <span
                  data-testid="sidebar-active-badge"
                  className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-semibold leading-none"
                >
                  {activeCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 py-4 border-t border-slate-100 space-y-3">
        <button
          onClick={() => navigate("/visits/new")}
          className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          Start New Visit
        </button>

        <div className="flex items-center gap-3 px-1">
          <UserButton afterSignOutUrl="/sign-in" />
          <span className="text-xs text-slate-500">My Account</span>
        </div>
      </div>
    </aside>
  );
}

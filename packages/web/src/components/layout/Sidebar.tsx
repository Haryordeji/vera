import { NavLink, useNavigate } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import {
  LayoutDashboard,
  ClipboardList,
  Clock,
  Settings,
  Plus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/patients", label: "Patients", icon: Users, end: false },
  { to: "/visits", label: "Past Visits", icon: Clock, end: false },
  { to: "/settings", label: "Settings", icon: Settings, end: false },
];

export function Sidebar() {
  const navigate = useNavigate();

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
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
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
            {label}
          </NavLink>
        ))}
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

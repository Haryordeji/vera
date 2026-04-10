import { useState } from "react";
import { PanelRight } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { RightPanel } from "./RightPanel";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
  /** Pass content here to enable the right panel column (e.g. on ActiveVisitPage) */
  rightPanel?: React.ReactNode;
  /** Page title shown in the top bar */
  title?: string;
}

export function AppLayout({ children, rightPanel, title }: AppLayoutProps) {
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const hasRightPanel = rightPanel !== undefined;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Left sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shrink-0">
          <h1 className="text-base font-semibold text-slate-800 truncate">
            {title ?? "Vera"}
          </h1>

          {hasRightPanel && (
            <button
              onClick={() => setRightPanelOpen((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                rightPanelOpen
                  ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "text-slate-500 hover:bg-slate-100"
              )}
              aria-label="Toggle audit panel"
            >
              <PanelRight className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </button>
          )}
        </header>

        {/* Content row */}
        <div className="flex flex-1 min-h-0">
          <main className="flex-1 overflow-y-auto">{children}</main>

          {hasRightPanel && (
            <RightPanel
              open={rightPanelOpen}
              onClose={() => setRightPanelOpen(false)}
            >
              {rightPanel}
            </RightPanel>
          )}
        </div>
      </div>
    </div>
  );
}

import { X, History } from "lucide-react";
import { cn } from "@/lib/utils";

interface RightPanelProps {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}

export function RightPanel({ open, onClose, children }: RightPanelProps) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-20 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <aside
        data-testid="right-panel"
        className={cn(
          "flex flex-col w-72 shrink-0 h-full bg-slate-50 border-l border-slate-200",
          "transition-all duration-200",
          // Desktop: always in flow, shown/hidden via width
          "lg:relative lg:translate-x-0",
          open ? "lg:flex" : "lg:hidden",
          // Mobile: fixed overlay
          "fixed right-0 top-0 z-30 lg:static",
          !open && "hidden"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">
              Audit &amp; Version History
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {children ?? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <History className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">
                Audit events will appear here as the visit progresses.
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

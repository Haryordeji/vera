import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { VisitCard } from "@/components/visit/VisitCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useApi } from "@/lib/api";
import type { Session, SessionStatus } from "@/lib/types";
import { Clock, Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_FILTERS: { label: string; value: SessionStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Recording", value: "RECORDING" },
  { label: "In Review", value: "IN_REVIEW" },
  { label: "Completed", value: "COMPLETED" },
];

export default function PastVisitsPage() {
  const { get } = useApi();
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SessionStatus | "ALL">("ALL");

  useEffect(() => {
    get<Session[]>("/sessions")
      .then(setSessions)
      .catch(() => showToast("Failed to load visits", "error"))
      .finally(() => setLoading(false));
  }, [get]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;
      const matchesSearch =
        !search.trim() ||
        s.patient?.fullName.toLowerCase().includes(search.toLowerCase()) ||
        s.patient?.mrn?.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [sessions, search, statusFilter]);

  return (
    <AppLayout title="Past Visits">
      <div className="px-6 py-6 max-w-4xl mx-auto space-y-5">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Past Visits</h2>
          <p className="mt-1 text-slate-500">All sessions for your account.</p>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by patient name or MRN…"
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              aria-label="Search visits"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            <div className="flex gap-1">
              {STATUS_FILTERS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  className={cn(
                    "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                    statusFilter === value
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Session list */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-slate-200 px-4 py-3 flex items-center gap-4">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-5 w-20 shrink-0" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 px-5 py-16 text-center">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-slate-700 mb-1">
              {sessions.length === 0 ? "No visits yet" : "No matching visits"}
            </h3>
            <p className="text-sm text-slate-400">
              {sessions.length === 0
                ? "Completed visits will appear here."
                : "Try adjusting your search or filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => (
              <VisitCard key={s.id} session={s} />
            ))}
            <p className="text-xs text-slate-400 text-center pt-1">
              {filtered.length} visit{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

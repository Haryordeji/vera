import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { VisitCard } from "@/components/visit/VisitCard";
import { PhysicianFilter } from "@/components/visit/PhysicianFilter";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useApi } from "@/lib/api";
import type { Session, SessionStatus } from "@/lib/types";
import { Clock, Search, SlidersHorizontal } from "lucide-react";

const STATUS_OPTIONS: { label: string; value: SessionStatus | "ALL" }[] = [
  { label: "All Statuses", value: "ALL" },
  { label: "Recording", value: "RECORDING" },
  { label: "Transcribing", value: "TRANSCRIBING" },
  { label: "Generating Note", value: "GENERATING_NOTE" },
  { label: "In Review", value: "IN_REVIEW" },
  { label: "Completed", value: "COMPLETED" },
];

export default function PastVisitsPage() {
  const { get } = useApi();
  const { showToast } = useToast();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [physicianId, setPhysicianId] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus | "ALL">("ALL");

  // Debounce search input → 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch whenever any filter changes (search is already debounced)
  useEffect(() => {
    const params = new URLSearchParams({ scope: "all" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (physicianId) params.set("physician", physicianId);
    if (status !== "ALL") params.set("status", status);

    setLoading(true);
    get<Session[]>(`/sessions?${params.toString()}`)
      .then(setSessions)
      .catch(() => showToast("Failed to load visits", "error"))
      .finally(() => setLoading(false));
  }, [get, debouncedSearch, physicianId, status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppLayout title="Past Visits">
      <div className="px-6 py-6 max-w-4xl mx-auto space-y-5">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Past Visits</h2>
          <p className="mt-1 text-slate-500">
            Practice-wide archive of all visits across physicians.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by patient name or MRN…"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            aria-label="Search visits"
          />
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters:</span>
          </div>
          <PhysicianFilter value={physicianId} onChange={setPhysicianId} />
          <select
            data-testid="status-filter"
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value as SessionStatus | "ALL")}
            className="px-3 py-2 border border-slate-200 rounded-md text-sm bg-white text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 cursor-pointer"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Results */}
        {loading ? (
          <div className="space-y-2" data-testid="past-visits-loading">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="bg-white rounded-lg border border-slate-200 px-4 py-3 flex items-center gap-4"
              >
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-5 w-20 shrink-0" />
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div
            data-testid="past-visits-empty"
            className="bg-white rounded-lg border border-slate-200 px-5 py-16 text-center"
          >
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-slate-700 mb-1">
              No visits match your search.
            </h3>
            <p className="text-sm text-slate-400">
              Try adjusting your search or filters.
            </p>
          </div>
        ) : (
          <div className="space-y-2" data-testid="past-visits-list">
            {sessions.map((s) => (
              <VisitCard key={s.id} session={s} />
            ))}
            <p className="text-xs text-slate-400 text-center pt-1">
              {sessions.length} visit{sessions.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

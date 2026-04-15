import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ActiveSessionCard } from "@/components/visit/ActiveSessionCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useApi } from "@/lib/api";
import type { Session, SessionStatus } from "@/lib/types";
import { Plus, Loader2, ClipboardCheck, CheckCircle2, ArrowRight } from "lucide-react";

const IN_PROGRESS_STATUSES: SessionStatus[] = [
  "RECORDING",
  "TRANSCRIBING",
  "GENERATING_NOTE",
];

export default function DashboardPage() {
  const { get } = useApi();
  const navigate = useNavigate();
  const { user } = useUser();
  const { showToast } = useToast();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<Session[]>("/sessions?scope=mine")
      .then(setSessions)
      .catch(() => showToast("Failed to load visits", "error"))
      .finally(() => setLoading(false));
  }, [get]); // eslint-disable-line react-hooks/exhaustive-deps

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const firstName = user?.firstName ?? "";

  const inProgressCount = sessions.filter((s) =>
    IN_PROGRESS_STATUSES.includes(s.status)
  ).length;
  const awaitingReviewCount = sessions.filter((s) => s.status === "IN_REVIEW").length;

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const completedThisWeek = sessions.filter(
    (s) => s.status === "COMPLETED" && new Date(s.recordedAt).getTime() >= weekAgo
  ).length;

  const activeSessions = sessions.filter((s) => s.status !== "COMPLETED");

  return (
    <AppLayout title="Dashboard">
      <div className="px-6 py-6 max-w-4xl mx-auto space-y-8">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h2>
          <p className="mt-1 text-slate-500">
            Here's what needs your attention today.
          </p>
        </div>

        {/* Quick stats */}
        <div
          data-testid="quick-stats"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <StatCard
            testId="stat-in-progress"
            label="In Progress"
            value={inProgressCount}
            icon={Loader2}
            loading={loading}
          />
          <StatCard
            testId="stat-awaiting-review"
            label="Awaiting Review"
            value={awaitingReviewCount}
            icon={ClipboardCheck}
            loading={loading}
          />
          <StatCard
            testId="stat-completed-this-week"
            label="Completed This Week"
            value={completedThisWeek}
            icon={CheckCircle2}
            loading={loading}
          />
        </div>

        {/* Start New Visit CTA */}
        <div>
          <button
            onClick={() => navigate("/visits/new")}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            Start New Visit
          </button>
        </div>

        {/* Active sessions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Your Active Sessions
            </h3>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg border border-slate-200 px-5 py-4 flex items-center gap-4"
                >
                  <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="w-40 h-4" />
                    <Skeleton className="w-56 h-3" />
                  </div>
                  <Skeleton className="w-20 h-5 shrink-0" />
                </div>
              ))}
            </div>
          ) : activeSessions.length === 0 ? (
            <div
              data-testid="dashboard-empty-state"
              className="bg-slate-50 border border-dashed border-slate-200 rounded-lg px-6 py-10 text-center"
            >
              <p className="text-sm text-slate-600">
                No active sessions. Start a new visit or{" "}
                <button
                  onClick={() => navigate("/visits")}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  view past visits
                </button>
                .
              </p>
            </div>
          ) : (
            <div data-testid="active-sessions-list" className="space-y-2">
              {activeSessions.map((s) => (
                <ActiveSessionCard key={s.id} session={s} />
              ))}
            </div>
          )}

          {/* Past visits link */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => navigate("/visits")}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              View all past visits
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function StatCard({
  testId,
  label,
  value,
  icon: Icon,
  loading,
}: {
  testId: string;
  label: string;
  value: number;
  icon: React.ElementType;
  loading: boolean;
}) {
  return (
    <div
      data-testid={testId}
      className="bg-white rounded-lg border border-slate-200 px-5 py-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        <Icon className="w-4 h-4 text-slate-300" />
      </div>
      <div className="mt-2 h-8 flex items-center">
        {loading ? (
          <Skeleton className="w-8 h-7" />
        ) : (
          <p
            data-testid={`${testId}-value`}
            className="text-2xl font-semibold text-slate-800"
          >
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

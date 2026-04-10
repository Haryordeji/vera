import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { VisitCard } from "@/components/visit/VisitCard";
import { useApi } from "@/lib/api";
import type { Session } from "@/lib/types";
import { ClipboardList, Plus, Clock, CheckCircle2, Loader2 } from "lucide-react";

export default function DashboardPage() {
  const { get } = useApi();
  const navigate = useNavigate();
  const { user } = useUser();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<Session[]>("/sessions")
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [get]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const firstName = user?.firstName ?? "";

  // Quick stats derived from sessions
  const thisWeek = sessions.filter((s) => {
    const d = new Date(s.recordedAt);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  }).length;

  const pendingReview = sessions.filter((s) => s.status === "IN_REVIEW").length;
  const completed = sessions.filter((s) => s.status === "COMPLETED").length;

  const recentSessions = sessions.slice(0, 5);

  return (
    <AppLayout title="Dashboard">
      <div className="px-6 py-6 max-w-4xl mx-auto space-y-8">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h2>
          <p className="mt-1 text-slate-500">
            Ready to start documenting? Your patients are waiting.
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Visits this week" value={thisWeek} icon={ClipboardList} loading={loading} />
          <StatCard label="Pending review" value={pendingReview} icon={Clock} loading={loading} />
          <StatCard label="Completed" value={completed} icon={CheckCircle2} loading={loading} />
        </div>

        {/* Recent visits */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Recent Visits</h3>
            {sessions.length > 5 && (
              <button
                onClick={() => navigate("/visits")}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                View all →
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : recentSessions.length === 0 ? (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-6 py-8 text-center">
              <ClipboardList className="w-10 h-10 text-blue-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-800 mb-1">No visits yet</h3>
              <p className="text-sm text-slate-500 mb-5">
                Start a new visit to record a patient encounter and generate a SOAP note.
              </p>
              <button
                onClick={() => navigate("/visits/new")}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
              >
                <Plus className="w-4 h-4" />
                Start New Visit
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentSessions.map((s) => (
                <VisitCard key={s.id} session={s} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 px-5 py-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        <Icon className="w-4 h-4 text-slate-300" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-800">
        {loading ? <span className="text-slate-300">—</span> : value}
      </p>
    </div>
  );
}

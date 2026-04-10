import { AppLayout } from "@/components/layout/AppLayout";
import { Clock, Search } from "lucide-react";

export default function PastVisitsPage() {
  return (
    <AppLayout title="Past Visits">
      <div className="px-6 py-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Past Visits
            </h2>
            <p className="mt-1 text-slate-500">
              All completed and in-review sessions.
            </p>
          </div>
        </div>

        {/* Search bar placeholder */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-md border border-slate-200 text-slate-400">
          <Search className="w-4 h-4 shrink-0" />
          <span className="text-sm">Search by patient name or MRN…</span>
        </div>

        {/* Empty state */}
        <div className="bg-white rounded-lg border border-slate-200 px-5 py-16 text-center">
          <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-medium text-slate-700 mb-1">
            No past visits
          </h3>
          <p className="text-sm text-slate-400">
            Completed visits will appear here. Start a new visit to get going.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

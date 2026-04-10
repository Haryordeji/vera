import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ClipboardList, Plus, Clock } from "lucide-react";

export default function DashboardPage() {
  const navigate = useNavigate();

  return (
    <AppLayout title="Dashboard">
      <div className="px-6 py-6 max-w-4xl mx-auto space-y-8">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Good morning
          </h2>
          <p className="mt-1 text-slate-500">
            Ready to start documenting? Your patients are waiting.
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Visits this week", value: "—", icon: ClipboardList },
            { label: "Pending review", value: "—", icon: Clock },
            { label: "Approved today", value: "—", icon: ClipboardList },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="bg-white rounded-lg border border-slate-200 px-5 py-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">{label}</span>
                <Icon className="w-4 h-4 text-slate-300" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-slate-800">
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-6 py-8 text-center">
          <ClipboardList className="w-10 h-10 text-blue-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-800 mb-1">
            No active visits
          </h3>
          <p className="text-sm text-slate-500 mb-5">
            Start a new visit to record a patient encounter and generate a SOAP
            note.
          </p>
          <button
            onClick={() => navigate("/visits/new")}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            Start New Visit
          </button>
        </div>

        {/* Recent visits placeholder */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Recent Visits
          </h3>
          <div className="bg-white rounded-lg border border-slate-200 px-5 py-10 text-center">
            <p className="text-sm text-slate-400">
              Your recent visits will appear here.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

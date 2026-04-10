import { AppLayout } from "@/components/layout/AppLayout";
import { UserRound } from "lucide-react";

export default function NewVisitPage() {
  return (
    <AppLayout title="New Visit">
      <div className="px-6 py-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">New Visit</h2>
          <p className="mt-1 text-slate-500">
            Select an existing patient or create a new one to begin.
          </p>
        </div>

        {/* Patient selection placeholder */}
        <div className="bg-white rounded-lg border border-slate-200 px-6 py-10 text-center">
          <UserRound className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-medium text-slate-700 mb-1">
            Patient selection
          </h3>
          <p className="text-sm text-slate-400">
            Patient search and creation will be implemented in Phase 5.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

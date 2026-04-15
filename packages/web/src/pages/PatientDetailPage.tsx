import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowLeft } from "lucide-react";

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <AppLayout title="Patient Detail">
      <div className="px-6 py-6 max-w-4xl mx-auto space-y-4">
        <Link
          to="/patients"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to patients
        </Link>
        <div className="bg-white rounded-lg border border-slate-200 px-5 py-16 text-center">
          <h2 className="text-base font-medium text-slate-700 mb-1">
            Patient Detail
          </h2>
          <p className="text-sm text-slate-400">
            Full profile, visit history, allergies, and medications — coming soon.
          </p>
          <p className="text-xs text-slate-300 mt-3">Patient ID: {id}</p>
        </div>
      </div>
    </AppLayout>
  );
}

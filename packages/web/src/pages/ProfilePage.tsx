import { AppLayout } from "@/components/layout/AppLayout";
import { UserRound, Mail, Award } from "lucide-react";

export default function ProfilePage() {
  return (
    <AppLayout title="My Profile">
      <div className="px-6 py-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">My Profile</h2>
          <p className="mt-1 text-slate-500">
            Manage your profile and preferences.
          </p>
        </div>

        {/* Profile section */}
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          <div className="px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-700">
              Physician Profile
            </h3>
          </div>

          {[
            { label: "Full Name", icon: UserRound, placeholder: "Dr. Jane Smith" },
            { label: "Email", icon: Mail, placeholder: "jane.smith@clinic.com" },
            { label: "Credentials", icon: Award, placeholder: "MD, FACP" },
          ].map(({ label, icon: Icon, placeholder }) => (
            <div key={label} className="px-5 py-4 flex items-center gap-4">
              <Icon className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                  {label}
                </p>
                <div className="h-8 bg-slate-50 rounded border border-slate-200 flex items-center px-3">
                  <span className="text-sm text-slate-400">{placeholder}</span>
                </div>
              </div>
            </div>
          ))}

          <div className="px-5 py-4">
            <p className="text-xs text-slate-400">
              Profile editing will be implemented in Phase 11.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

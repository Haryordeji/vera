import { ClipboardList } from "lucide-react";

/** Wraps Clerk's SignIn/SignUp with a branded split layout */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 text-white px-12 py-14">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <ClipboardList className="w-7 h-7 text-white/90" />
            <span className="text-2xl font-bold tracking-tight">Vera</span>
          </div>
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Where medical<br />documentation<br />meets trust.
          </h2>
          <p className="text-blue-100 text-lg leading-relaxed max-w-sm">
            Record a patient visit, get a structured SOAP note in under a minute, then review and sign off — all in one place.
          </p>
        </div>

        {/* Feature highlights */}
        <ul className="space-y-3">
          {[
            "AI-powered SOAP note generation",
            "Speaker-labeled transcription",
            "Full audit trail & version history",
          ].map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-sm text-blue-100">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-300 shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {/* Right panel — auth form */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile brand mark */}
          <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <ClipboardList className="w-6 h-6 text-blue-600" />
            <span className="text-xl font-bold text-slate-800">Vera</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

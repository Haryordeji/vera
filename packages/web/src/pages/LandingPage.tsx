import { UserButton } from "@clerk/clerk-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white/60 backdrop-blur-sm">
        <span className="text-lg font-semibold text-slate-800">Vera</span>
        <UserButton afterSignOutUrl="/sign-in" />
      </header>

      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] text-center space-y-4">
        <h1 className="text-6xl font-bold tracking-tight text-slate-900">
          Vera
        </h1>
        <p className="text-xl text-slate-500 font-light">
          Where medical documentation meets trust
        </p>
      </main>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { useApi } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export interface PhysicianOption {
  id: string;
  fullName: string;
}

interface PhysicianFilterProps {
  value: string | null;
  onChange: (physicianId: string | null) => void;
}

export function PhysicianFilter({ value, onChange }: PhysicianFilterProps) {
  const { get } = useApi();
  const { showToast } = useToast();
  const [physicians, setPhysicians] = useState<PhysicianOption[]>([]);

  useEffect(() => {
    get<PhysicianOption[]>("/physicians")
      .then(setPhysicians)
      .catch(() => showToast("Failed to load physicians", "error"));
  }, [get]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative">
      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      <select
        data-testid="physician-filter"
        aria-label="Filter by physician"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="pl-9 pr-8 py-2 border border-slate-200 rounded-md text-sm bg-white text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 appearance-none cursor-pointer"
      >
        <option value="">All Physicians</option>
        {physicians.map((p) => (
          <option key={p.id} value={p.id}>
            Dr. {p.fullName}
          </option>
        ))}
      </select>
    </div>
  );
}

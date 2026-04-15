import { Eye } from "lucide-react";

interface OwnershipBannerProps {
  physicianName: string;
}

export function OwnershipBanner({ physicianName }: OwnershipBannerProps) {
  return (
    <div
      data-testid="ownership-banner"
      className="flex items-center gap-3 px-4 py-3 rounded-lg border border-blue-100 bg-blue-50 text-blue-900"
      role="status"
    >
      <Eye className="w-4 h-4 text-blue-500 shrink-0" />
      <p className="text-sm">
        This visit was conducted by{" "}
        <span className="font-semibold">Dr. {physicianName}</span>. You are
        viewing in read-only mode.
      </p>
    </div>
  );
}

import { Eye, UserCheck } from "lucide-react";

interface OwnershipBannerProps {
  physicianName: string;
  asAssignedReviewer?: boolean;
}

export function OwnershipBanner({
  physicianName,
  asAssignedReviewer = false,
}: OwnershipBannerProps) {
  const Icon = asAssignedReviewer ? UserCheck : Eye;
  return (
    <div
      data-testid="ownership-banner"
      data-variant={asAssignedReviewer ? "reviewer" : "read-only"}
      className="flex items-center gap-3 px-4 py-3 rounded-lg border border-blue-100 bg-blue-50 text-blue-900"
      role="status"
    >
      <Icon className="w-4 h-4 text-blue-500 shrink-0" />
      <p className="text-sm">
        This visit was conducted by{" "}
        <span className="font-semibold">Dr. {physicianName}</span>.{" "}
        {asAssignedReviewer
          ? "You are reviewing this note."
          : "You are viewing in read-only mode."}
      </p>
    </div>
  );
}

import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  message?: string;
  onRetry: () => void;
  testId?: string;
}

export function ListError({
  message = "Something went wrong while loading this view.",
  onRetry,
  testId,
}: Props) {
  return (
    <div
      data-testid={testId ?? "list-error"}
      className="bg-white rounded-lg border border-slate-200 px-6 py-10 text-center"
    >
      <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
      <p className="text-sm font-medium text-slate-700">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        data-testid={testId ? `${testId}-retry` : "list-error-retry"}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-md transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Try again
      </button>
    </div>
  );
}

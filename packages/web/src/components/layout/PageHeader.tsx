import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PageHeaderProps {
  title: string;
  /** Path to navigate to, or the literal string "history" to use browser back. */
  backTo?: string;
  backLabel?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, backTo, backLabel, children }: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (!backTo) return;
    if (backTo === "history") {
      navigate(-1);
    } else {
      navigate(backTo);
    }
  };

  return (
    <div className="mb-5" data-testid="page-header">
      {backTo && (
        <button
          type="button"
          onClick={handleBack}
          data-testid="page-header-back"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel ?? "Back"}
        </button>
      )}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-slate-900 truncate">{title}</h2>
        {children && (
          <div className="flex items-center gap-2 shrink-0">{children}</div>
        )}
      </div>
    </div>
  );
}

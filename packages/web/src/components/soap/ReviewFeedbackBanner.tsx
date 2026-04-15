import { MessageSquareWarning } from "lucide-react";

interface ReviewFeedbackBannerProps {
  reviewerName: string | null;
  feedback: string;
}

export function ReviewFeedbackBanner({
  reviewerName,
  feedback,
}: ReviewFeedbackBannerProps) {
  const heading = reviewerName
    ? `Dr. ${reviewerName} returned this note for revision:`
    : "The assigned reviewer returned this note for revision:";

  return (
    <div
      data-testid="review-feedback-banner"
      role="status"
      className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4"
    >
      <MessageSquareWarning className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p
          className="text-sm font-medium text-amber-900"
          data-testid="review-feedback-banner-heading"
        >
          {heading}
        </p>
        <blockquote
          data-testid="review-feedback-banner-body"
          className="mt-2 border-l-2 border-amber-300 pl-3 text-sm text-amber-900 whitespace-pre-wrap italic"
        >
          {feedback}
        </blockquote>
      </div>
    </div>
  );
}

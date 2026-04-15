import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useApi } from "@/lib/api";

interface Props {
  sessionId: string;
}

/**
 * Fetches a session's audio as a blob (so we can pass the Clerk Bearer token)
 * and renders it inside a native `<audio>` element via a blob URL. Used to
 * replay audio on completed visits and for non-owner read-only views.
 */
export function AudioPlayback({ sessionId }: Props) {
  const { getBlob } = useApi();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getBlob(`/sessions/${sessionId}/audio`)
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setBlobUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load audio.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [sessionId, getBlob]);

  if (loading) {
    return (
      <div
        data-testid="audio-playback-loading"
        className="flex items-center gap-2 text-sm text-slate-500"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading audio…
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div
        data-testid="audio-playback-error"
        className="flex items-center gap-2 text-sm text-red-600"
      >
        <AlertCircle className="w-4 h-4" />
        {error ?? "Audio unavailable."}
      </div>
    );
  }

  return (
    <audio
      data-testid="audio-playback"
      src={blobUrl}
      controls
      className="w-full"
    />
  );
}

import { useState, useEffect, useRef } from "react";
import { Mic, Square, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useAudioRecorder, formatDuration } from "@/hooks/useAudioRecorder";
import { useApi } from "@/lib/api";
import type { Session } from "@/lib/types";

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface Props {
  sessionId: string;
  onUploadComplete?: (session: Session) => void;
}

export function AudioRecorder({ sessionId, onUploadComplete }: Props) {
  const { isRecording, duration, audioBlob, error, startRecording, stopRecording } =
    useAudioRecorder();
  const { uploadFile } = useApi();

  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const audioBlobUrlRef = useRef<string | null>(null);

  // Auto-upload as soon as a blob is available
  useEffect(() => {
    if (!audioBlob) return;

    // Revoke any previous object URL
    if (audioBlobUrlRef.current) {
      URL.revokeObjectURL(audioBlobUrlRef.current);
    }
    audioBlobUrlRef.current = URL.createObjectURL(audioBlob);

    const doUpload = async () => {
      setUploadStatus("uploading");
      setUploadError(null);
      try {
        const formData = new FormData();
        formData.append("audio", audioBlob, `${sessionId}.webm`);
        const updated = await uploadFile<Session>(
          `/sessions/${sessionId}/upload-audio`,
          formData
        );
        setUploadStatus("success");
        onUploadComplete?.(updated);
      } catch (err) {
        setUploadStatus("error");
        setUploadError(
          err instanceof Error ? err.message : "Upload failed"
        );
      }
    };

    doUpload();
  }, [audioBlob]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {/* Recorder controls */}
      <div className="flex items-center gap-4">
        {!isRecording && uploadStatus === "idle" && (
          <button
            onClick={startRecording}
            data-testid="start-recording-btn"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            <Mic className="w-4 h-4" />
            Start Recording
          </button>
        )}

        {isRecording && (
          <>
            <span
              className="w-3 h-3 rounded-full bg-red-500 animate-pulse"
              aria-label="Recording indicator"
            />
            <span
              data-testid="recording-duration"
              className="text-sm font-mono font-semibold text-slate-700 tabular-nums"
            >
              {formatDuration(duration)}
            </span>
            <button
              onClick={stopRecording}
              data-testid="stop-recording-btn"
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              <Square className="w-4 h-4" />
              Stop Recording
            </button>
          </>
        )}
      </div>

      {/* Error from microphone access */}
      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1.5" data-testid="recorder-error">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}

      {/* Upload status */}
      {uploadStatus === "uploading" && (
        <div className="flex items-center gap-2 text-sm text-slate-500" data-testid="upload-status-uploading">
          <Loader2 className="w-4 h-4 animate-spin" />
          Uploading recording…
        </div>
      )}

      {uploadStatus === "error" && (
        <p className="text-sm text-red-600 flex items-center gap-1.5" data-testid="upload-status-error">
          <AlertCircle className="w-4 h-4" />
          {uploadError}
        </p>
      )}

      {/* Playback (shown once upload is done) */}
      {uploadStatus === "success" && audioBlobUrlRef.current && (
        <div className="space-y-2" data-testid="playback-section">
          <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Recording uploaded successfully
          </div>
          <audio
            controls
            src={audioBlobUrlRef.current}
            data-testid="audio-player"
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}

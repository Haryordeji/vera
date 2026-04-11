import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import type { Session } from "../lib/types";

// ---------------------------------------------------------------------------
// Stable mocks via vi.hoisted so references don't change between renders
// ---------------------------------------------------------------------------
const { mockUseAudioRecorder, mockUploadFile } = vi.hoisted(() => ({
  mockUseAudioRecorder: vi.fn().mockReturnValue({
    isRecording: false,
    duration: 0,
    audioBlob: null,
    error: null,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
  }),
  mockUploadFile: vi.fn().mockResolvedValue(null as unknown as Session),
}));

vi.mock("@/hooks/useAudioRecorder", () => ({
  useprovisionalRecorder: mockUseAudioRecorder,
  useAudioRecorder: mockUseAudioRecorder,
  formatDuration: (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`,
}));

vi.mock("@/lib/api", () => ({
  useApi: () => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    uploadFile: mockUploadFile,
  }),
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ getToken: () => Promise.resolve("test-token") }),
  useUser: () => ({ isLoaded: true, isSignedIn: true, user: null }),
  UserButton: () => <button>User</button>,
}));

// Stub URL.createObjectURL — not available in jsdom
beforeAll(() => {
  Object.defineProperty(globalThis.URL, "createObjectURL", {
    value: vi.fn().mockReturnValue("blob:mock-url"),
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis.URL, "revokeObjectURL", {
    value: vi.fn(),
    writable: true,
    configurable: true,
  });
});

import { AudioRecorder } from "../components/audio/AudioRecorder";

function renderRecorder(sessionId = "test-session-id") {
  return render(<AudioRecorder sessionId={sessionId} />);
}

// ---------------------------------------------------------------------------
// Idle state
// ---------------------------------------------------------------------------
describe("AudioRecorder — idle state", () => {
  it("shows the Start Recording button", () => {
    mockUseAudioRecorder.mockReturnValue({
      isRecording: false,
      duration: 0,
      audioBlob: null,
      error: null,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
    });
    renderRecorder();
    expect(screen.getByTestId("start-recording-btn")).toBeInTheDocument();
    expect(screen.getByText("Start Recording")).toBeInTheDocument();
  });

  it("does not show recording controls or audio player when idle", () => {
    renderRecorder();
    expect(screen.queryByTestId("stop-recording-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("recording-duration")).not.toBeInTheDocument();
    expect(screen.queryByTestId("audio-player")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Recording state
// ---------------------------------------------------------------------------
describe("AudioRecorder — recording state", () => {
  it("shows elapsed time in MM:SS format", () => {
    mockUseAudioRecorder.mockReturnValue({
      isRecording: true,
      duration: 65,
      audioBlob: null,
      error: null,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
    });
    renderRecorder();
    expect(screen.getByTestId("recording-duration")).toHaveTextContent("01:05");
  });

  it("shows Stop Recording button and hides Start Recording", () => {
    renderRecorder();
    expect(screen.getByTestId("stop-recording-btn")).toBeInTheDocument();
    expect(screen.queryByTestId("start-recording-btn")).not.toBeInTheDocument();
  });

  it("shows a recording indicator", () => {
    renderRecorder();
    expect(screen.getByLabelText("Recording indicator")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Post-recording — successful upload
// ---------------------------------------------------------------------------
describe("AudioRecorder — after recording (upload success)", () => {
  it("shows audio player after successful upload", async () => {
    const mockSession: Partial<Session> = {
      id: "test-session-id",
      status: "TRANSCRIBING",
    };
    mockUploadFile.mockResolvedValue(mockSession as Session);

    mockUseAudioRecorder.mockReturnValue({
      isRecording: false,
      duration: 30,
      audioBlob: new Blob(["fake audio"], { type: "audio/webm" }),
      error: null,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
    });

    await act(async () => {
      renderRecorder();
    });

    await waitFor(() =>
      expect(screen.getByTestId("audio-player")).toBeInTheDocument()
    );
    expect(screen.getByTestId("playback-section")).toBeInTheDocument();
    expect(screen.getByText("Recording uploaded successfully")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Post-recording — upload failure
// ---------------------------------------------------------------------------
describe("AudioRecorder — after recording (upload error)", () => {
  it("shows error message on upload failure", async () => {
    mockUploadFile.mockRejectedValue(new Error("Network error"));

    mockUseAudioRecorder.mockReturnValue({
      isRecording: false,
      duration: 10,
      audioBlob: new Blob(["fake audio"], { type: "audio/webm" }),
      error: null,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
    });

    await act(async () => {
      renderRecorder();
    });

    await waitFor(() =>
      expect(screen.getByTestId("upload-status-error")).toBeInTheDocument()
    );
    expect(screen.getByText("Network error")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Microphone error state
// ---------------------------------------------------------------------------
describe("AudioRecorder — microphone error", () => {
  it("displays the error message returned by the hook", () => {
    mockUseAudioRecorder.mockReturnValue({
      isRecording: false,
      duration: 0,
      audioBlob: null,
      error: "Permission denied",
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
    });
    renderRecorder();
    expect(screen.getByTestId("recorder-error")).toBeInTheDocument();
    expect(screen.getByText("Permission denied")).toBeInTheDocument();
  });
});

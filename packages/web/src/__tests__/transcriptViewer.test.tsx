import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TranscriptViewer } from "../components/transcript/TranscriptViewer";
import type { Utterance } from "../components/transcript/TranscriptViewer";

const UTTERANCES: Utterance[] = [
  { speaker: "Doctor", text: "Good morning, how are you feeling today?", start: 0, end: 2.5 },
  { speaker: "Patient", text: "Not great — I have a persistent cough.", start: 3.0, end: 5.5 },
  { speaker: "Doctor", text: "How long has the cough been going on?", start: 6.0, end: 8.0 },
  { speaker: "Patient", text: "About two weeks now.", start: 8.5, end: 9.5 },
];

describe("TranscriptViewer — loading state", () => {
  it("shows loading spinner and message", () => {
    render(<TranscriptViewer utterances={[]} loading={true} />);
    expect(screen.getByTestId("transcript-loading")).toBeInTheDocument();
    expect(screen.getByText("Transcribing your recording…")).toBeInTheDocument();
  });

  it("does not show utterances while loading", () => {
    render(<TranscriptViewer utterances={UTTERANCES} loading={true} />);
    expect(screen.queryByTestId("transcript-content")).not.toBeInTheDocument();
  });
});

describe("TranscriptViewer — empty state", () => {
  it("shows placeholder text when no utterances", () => {
    render(<TranscriptViewer utterances={[]} />);
    expect(screen.getByTestId("transcript-empty")).toBeInTheDocument();
    expect(
      screen.getByText("Transcript will appear here after recording.")
    ).toBeInTheDocument();
  });
});

describe("TranscriptViewer — with utterances", () => {
  it("renders all utterances", () => {
    render(<TranscriptViewer utterances={UTTERANCES} />);
    expect(screen.getByTestId("transcript-content")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^utterance-/)).toHaveLength(4);
  });

  it("renders Doctor utterance text", () => {
    render(<TranscriptViewer utterances={UTTERANCES} />);
    expect(
      screen.getByText("Good morning, how are you feeling today?")
    ).toBeInTheDocument();
  });

  it("renders Patient utterance text", () => {
    render(<TranscriptViewer utterances={UTTERANCES} />);
    expect(
      screen.getByText("Not great — I have a persistent cough.")
    ).toBeInTheDocument();
  });

  it("sets data-speaker attribute on each utterance", () => {
    render(<TranscriptViewer utterances={UTTERANCES} />);
    const first = screen.getByTestId("utterance-0");
    const second = screen.getByTestId("utterance-1");
    expect(first).toHaveAttribute("data-speaker", "Doctor");
    expect(second).toHaveAttribute("data-speaker", "Patient");
  });

  it("applies blue styling to Doctor utterances", () => {
    render(<TranscriptViewer utterances={UTTERANCES} />);
    const doctorUtterance = screen.getByTestId("utterance-0");
    expect(doctorUtterance.className).toContain("blue");
  });

  it("applies gray/slate styling to Patient utterances", () => {
    render(<TranscriptViewer utterances={UTTERANCES} />);
    const patientUtterance = screen.getByTestId("utterance-1");
    expect(patientUtterance.className).toContain("slate");
    // Patient bubbles are right-aligned
    expect(patientUtterance.className).toContain("ml-auto");
  });

  it("shows speaker labels (Doctor / Patient)", () => {
    render(<TranscriptViewer utterances={UTTERANCES} />);
    const labels = screen.getAllByTestId(/^speaker-label-/);
    const texts = labels.map((el) => el.textContent);
    expect(texts).toContain("Doctor");
    expect(texts).toContain("Patient");
  });

  it("formats timestamps as MM:SS", () => {
    render(<TranscriptViewer utterances={UTTERANCES} />);
    // First utterance starts at 0s → "00:00"
    expect(screen.getByText("00:00")).toBeInTheDocument();
    // Third utterance starts at 6s → "00:06"
    expect(screen.getByText("00:06")).toBeInTheDocument();
  });
});

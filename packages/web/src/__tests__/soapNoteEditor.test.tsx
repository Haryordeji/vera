import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SoapNoteEditor } from "../components/soap/SoapNoteEditor";
import type { SoapContent } from "../components/soap/SoapNoteEditor";

const MOCK_NOTE: SoapContent = {
  subjective: "Patient reports persistent cough for two weeks.",
  objective: "No objective findings documented in this encounter.",
  assessment: "Upper respiratory infection, likely viral.",
  plan: "Rest, fluids, OTC cough suppressant. Follow up in one week.",
};

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------
describe("SoapNoteEditor — loading state", () => {
  it("shows spinner and generating message", () => {
    render(<SoapNoteEditor note={null} loading={true} />);
    expect(screen.getByTestId("soap-loading")).toBeInTheDocument();
    expect(screen.getByText("Generating SOAP note…")).toBeInTheDocument();
  });

  it("does not show the editor while loading", () => {
    render(<SoapNoteEditor note={MOCK_NOTE} loading={true} />);
    expect(screen.queryByTestId("soap-editor")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
describe("SoapNoteEditor — empty state", () => {
  it("shows placeholder when no note provided", () => {
    render(<SoapNoteEditor note={null} />);
    expect(screen.getByTestId("soap-empty")).toBeInTheDocument();
    expect(
      screen.getByText("SOAP note will appear here after transcription.")
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// With note
// ---------------------------------------------------------------------------
describe("SoapNoteEditor — with note", () => {
  it("renders all four section labels", () => {
    render(<SoapNoteEditor note={MOCK_NOTE} />);
    expect(screen.getByTestId("soap-label-subjective")).toBeInTheDocument();
    expect(screen.getByTestId("soap-label-objective")).toBeInTheDocument();
    expect(screen.getByTestId("soap-label-assessment")).toBeInTheDocument();
    expect(screen.getByTestId("soap-label-plan")).toBeInTheDocument();
  });

  it("shows Subjective / Objective / Assessment / Plan labels", () => {
    render(<SoapNoteEditor note={MOCK_NOTE} />);
    expect(screen.getByText("Subjective")).toBeInTheDocument();
    expect(screen.getByText("Objective")).toBeInTheDocument();
    expect(screen.getByText("Assessment")).toBeInTheDocument();
    expect(screen.getByText("Plan")).toBeInTheDocument();
  });

  it("populates each textarea with the correct content", () => {
    render(<SoapNoteEditor note={MOCK_NOTE} />);
    expect(screen.getByTestId("soap-textarea-subjective")).toHaveValue(
      MOCK_NOTE.subjective
    );
    expect(screen.getByTestId("soap-textarea-objective")).toHaveValue(
      MOCK_NOTE.objective
    );
    expect(screen.getByTestId("soap-textarea-assessment")).toHaveValue(
      MOCK_NOTE.assessment
    );
    expect(screen.getByTestId("soap-textarea-plan")).toHaveValue(
      MOCK_NOTE.plan
    );
  });

  it("renders four section containers", () => {
    render(<SoapNoteEditor note={MOCK_NOTE} />);
    expect(screen.getAllByTestId(/^soap-section-/)).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------
describe("SoapNoteEditor — editing", () => {
  it("calls onChange when a textarea is edited", () => {
    const handleChange = vi.fn();
    render(<SoapNoteEditor note={MOCK_NOTE} onChange={handleChange} />);

    const textarea = screen.getByTestId("soap-textarea-subjective");
    fireEvent.change(textarea, { target: { value: "Updated subjective text" } });

    expect(handleChange).toHaveBeenCalledWith(
      "subjective",
      "Updated subjective text"
    );
  });

  it("updates local textarea value when edited", () => {
    render(<SoapNoteEditor note={MOCK_NOTE} />);
    const textarea = screen.getByTestId(
      "soap-textarea-plan"
    ) as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "New plan content" } });
    expect(textarea.value).toBe("New plan content");
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Session } from "../lib/types";

vi.mock("@clerk/clerk-react", () => ({
  UserButton: () => <button data-testid="user-button">User</button>,
  useUser: () => ({ isLoaded: true, isSignedIn: true }),
  useAuth: () => ({ getToken: () => Promise.resolve("test-token") }),
}));

import { StatusBadge } from "../components/visit/StatusBadge";
import { VisitCard } from "../components/visit/VisitCard";

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------
describe("StatusBadge", () => {
  it.each([
    ["RECORDING", "Recording"],
    ["TRANSCRIBING", "Transcribing"],
    ["GENERATING_NOTE", "Generating Note"],
    ["IN_REVIEW", "In Review"],
    ["COMPLETED", "Completed"],
  ] as const)("renders label '%s' → '%s'", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("sets data-status attribute for easy querying", () => {
    render(<StatusBadge status="COMPLETED" />);
    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveAttribute("data-status", "COMPLETED");
  });

  it("applies correct colour class for RECORDING (blue)", () => {
    render(<StatusBadge status="RECORDING" />);
    const badge = screen.getByTestId("status-badge");
    expect(badge.className).toContain("blue");
  });

  it("applies correct colour class for COMPLETED (green)", () => {
    render(<StatusBadge status="COMPLETED" />);
    const badge = screen.getByTestId("status-badge");
    expect(badge.className).toContain("green");
  });

  it("applies correct colour class for IN_REVIEW (orange)", () => {
    render(<StatusBadge status="IN_REVIEW" />);
    const badge = screen.getByTestId("status-badge");
    expect(badge.className).toContain("orange");
  });

  it("accepts an extra className prop", () => {
    render(<StatusBadge status="COMPLETED" className="mt-2" />);
    expect(screen.getByTestId("status-badge").className).toContain("mt-2");
  });
});

// ---------------------------------------------------------------------------
// VisitCard
// ---------------------------------------------------------------------------
const makeSession = (overrides: Partial<Session> = {}): Session => ({
  id: "session-abc",
  physicianId: "phys-1",
  patientId: "pat-1",
  status: "RECORDING",
  recordedAt: "2026-04-10T10:00:00.000Z",
  audioFileUrl: null,
  createdAt: "2026-04-10T10:00:00.000Z",
  updatedAt: "2026-04-10T10:00:00.000Z",
  patient: { id: "pat-1", fullName: "Jane Doe", mrn: "MRN-100", dateOfBirth: null, sex: null, heightCm: null, eyeColor: null, bloodType: null, createdAt: "", updatedAt: "" },
  ...overrides,
});

describe("VisitCard", () => {
  function renderCard(session: Session) {
    return render(
      <MemoryRouter>
        <VisitCard session={session} />
      </MemoryRouter>
    );
  }

  it("shows patient name", () => {
    renderCard(makeSession());
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("shows formatted date", () => {
    renderCard(makeSession());
    // The date should appear somewhere in the card
    expect(screen.getByText(/Apr 10, 2026/)).toBeInTheDocument();
  });

  it("renders a StatusBadge with correct status", () => {
    renderCard(makeSession({ status: "COMPLETED" }));
    expect(screen.getByTestId("status-badge")).toHaveAttribute("data-status", "COMPLETED");
  });

  it("falls back gracefully when patient is undefined", () => {
    renderCard(makeSession({ patient: undefined }));
    expect(screen.getByText("Unknown Patient")).toBeInTheDocument();
  });

  it("has correct aria-label for accessibility", () => {
    renderCard(makeSession());
    expect(screen.getByRole("button", { name: /open visit for jane doe/i })).toBeInTheDocument();
  });
});

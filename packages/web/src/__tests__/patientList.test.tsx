import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Patient } from "../lib/types";

// ---------------------------------------------------------------------------
// Stable mocked API — hoisted so its references stay constant across renders
// ---------------------------------------------------------------------------
const { mockGet, mockPost, mockPut, mockDel, mockUploadFile } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDel: vi.fn(),
  mockUploadFile: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  useApi: () => ({
    get: mockGet,
    post: mockPost,
    put: mockPut,
    del: mockDel,
    uploadFile: mockUploadFile,
  }),
}));

vi.mock("@clerk/clerk-react", () => ({
  UserButton: () => <button data-testid="user-button">User</button>,
  useUser: () => ({ isLoaded: true, isSignedIn: true }),
  useAuth: () => ({ getToken: () => Promise.resolve("test-token") }),
}));

import { PatientCard } from "../components/patient/PatientCard";
import PatientListPage from "../pages/PatientListPage";
import { ToastProvider } from "../components/ui/Toast";

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "patient-1",
    fullName: "Alice Example",
    dateOfBirth: "1990-05-15T00:00:00.000Z",
    mrn: "MRN-001",
    sex: null,
    heightCm: null,
    eyeColor: null,
    bloodType: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    _count: { allergies: 2, medications: 1, sessions: 5 },
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/patients"]}>
      <ToastProvider>
        <PatientListPage />
      </ToastProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockPut.mockReset();
  mockDel.mockReset();
  mockUploadFile.mockReset();
});

// ---------------------------------------------------------------------------
// PatientCard
// ---------------------------------------------------------------------------
describe("PatientCard", () => {
  it("renders name, MRN, DOB, and visit count", () => {
    render(
      <MemoryRouter>
        <PatientCard patient={makePatient()} />
      </MemoryRouter>
    );

    expect(screen.getByText("Alice Example")).toBeInTheDocument();
    expect(screen.getByText(/MRN-001/)).toBeInTheDocument();
    // DOB: year is the timezone-safe part to assert on
    expect(screen.getByText(/DOB:.*1990/)).toBeInTheDocument();
    expect(screen.getByText("5 visits")).toBeInTheDocument();
  });

  it("does not render allergy count on the card", () => {
    render(
      <MemoryRouter>
        <PatientCard
          patient={makePatient({
            _count: { allergies: 2, medications: 1, sessions: 5 },
          })}
        />
      </MemoryRouter>
    );
    expect(screen.queryByText(/allerg/i)).not.toBeInTheDocument();
  });

  it("pluralizes visit count correctly for single values", () => {
    render(
      <MemoryRouter>
        <PatientCard
          patient={makePatient({
            fullName: "Solo Patient",
            _count: { allergies: 1, medications: 0, sessions: 1 },
          })}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("1 visit")).toBeInTheDocument();
  });

  it("renders zero visit count when _count is absent", () => {
    render(
      <MemoryRouter>
        <PatientCard patient={makePatient({ _count: undefined })} />
      </MemoryRouter>
    );
    expect(screen.getByText("0 visits")).toBeInTheDocument();
  });

  it("links to the patient detail page", () => {
    render(
      <MemoryRouter>
        <PatientCard patient={makePatient()} />
      </MemoryRouter>
    );
    const btn = screen.getByRole("button", { name: /Open patient Alice Example/i });
    expect(btn).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PatientListPage
// ---------------------------------------------------------------------------
describe("PatientListPage", () => {
  it("renders patient cards fetched from the API", async () => {
    mockGet.mockResolvedValue([
      makePatient({ id: "p1", fullName: "Alice Example" }),
      makePatient({
        id: "p2",
        fullName: "Bob Patient",
        mrn: "MRN-002",
        _count: { allergies: 0, medications: 3, sessions: 2 },
      }),
    ]);

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(screen.getByText("Alice Example")).toBeInTheDocument();
      expect(screen.getByText("Bob Patient")).toBeInTheDocument();
    });

    // Footer count
    expect(screen.getByText(/2 patients/)).toBeInTheDocument();
    // First fetch uses no search query
    expect(mockGet).toHaveBeenCalledWith("/patients");
  });

  it("shows empty state when no patients returned", async () => {
    mockGet.mockResolvedValue([]);

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(screen.getByText("No patients yet")).toBeInTheDocument();
    });
  });

  it("debounces search input and calls the API with ?search=", async () => {
    mockGet.mockResolvedValue([]);
    const user = userEvent.setup();

    await act(async () => {
      renderPage();
    });

    const input = await screen.findByLabelText("Search patients");
    await user.type(input, "Alice");

    await waitFor(
      () => {
        expect(mockGet).toHaveBeenCalledWith("/patients?search=Alice");
      },
      { timeout: 2000 }
    );
  });

  it("opens the create form when Add New Patient is clicked", async () => {
    mockGet.mockResolvedValue([]);
    const user = userEvent.setup();

    await act(async () => {
      renderPage();
    });

    await user.click(screen.getByRole("button", { name: /Add New Patient/i }));

    expect(screen.getByTestId("create-patient-form")).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Blood type")).toBeInTheDocument();
  });

  it("submits the create form and posts to /patients", async () => {
    mockGet.mockResolvedValue([]);
    mockPost.mockResolvedValue(makePatient({ id: "new", fullName: "New Patient" }));
    const user = userEvent.setup();

    await act(async () => {
      renderPage();
    });

    await user.click(screen.getByRole("button", { name: /Add New Patient/i }));
    await user.type(screen.getByLabelText("Full name"), "New Patient");
    await user.click(screen.getByRole("button", { name: /Create Patient/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/patients",
        expect.objectContaining({ fullName: "New Patient" })
      );
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Allergy, Medication, Patient } from "../lib/types";

// ---------------------------------------------------------------------------
// Hoisted API mocks
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
  useUser: () => ({ isLoaded: true, isSignedIn: true, user: { firstName: "Sarah" } }),
  useAuth: () => ({ getToken: () => Promise.resolve("test-token") }),
}));

import PatientListPage from "../pages/PatientListPage";
import PatientDetailPage from "../pages/PatientDetailPage";
import { AllergyList } from "../components/patient/AllergyList";
import { MedicationList } from "../components/patient/MedicationList";
import { ToastProvider } from "../components/ui/Toast";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const makePatient = (overrides: Partial<Patient> = {}): Patient => ({
  id: "pat-1",
  fullName: "Jane Doe",
  dateOfBirth: null,
  mrn: null,
  sex: null,
  heightCm: null,
  eyeColor: null,
  bloodType: null,
  createdAt: "",
  updatedAt: "",
  allergies: [],
  medications: [],
  sessions: [],
  ...overrides,
});

const makeAllergy = (id: string, name: string): Allergy => ({
  id,
  patientId: "pat-1",
  name,
  severity: "Mild",
  reaction: null,
  createdAt: "",
});

const makeMedication = (id: string, name: string): Medication => ({
  id,
  patientId: "pat-1",
  name,
  dosage: "10mg",
  frequency: "Daily",
  createdAt: "",
});

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockPut.mockReset();
  mockDel.mockReset();
  mockUploadFile.mockReset();
});

// ---------------------------------------------------------------------------
// Empty-state rendering: API success with empty payload should NOT surface error
// ---------------------------------------------------------------------------
describe("Empty states vs error states", () => {
  it("PatientListPage shows empty state (not error) when API returns []", async () => {
    mockGet.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/patients"]}>
        <ToastProvider>
          <PatientListPage />
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId("patient-list-empty")).toBeInTheDocument()
    );
    expect(screen.getByText("No patients yet")).toBeInTheDocument();
    expect(screen.getByText("Add your first patient.")).toBeInTheDocument();
    expect(screen.queryByTestId("patient-list-error")).not.toBeInTheDocument();
  });

  it("PatientDetailPage shows empty visit history (not error) when patient has no sessions", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path.startsWith("/patients/pat-1")) {
        return Promise.resolve(makePatient({ sessions: [] }));
      }
      return Promise.resolve([]);
    });

    render(
      <MemoryRouter initialEntries={["/patients/pat-1"]}>
        <ToastProvider>
          <Routes>
            <Route path="/patients/:id" element={<PatientDetailPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId("patient-visit-history-empty")).toBeInTheDocument()
    );
    expect(
      screen.getByText("No visits yet for this patient.")
    ).toBeInTheDocument();
    expect(screen.getByText("Start the first one.")).toBeInTheDocument();
    expect(screen.queryByTestId("patient-detail-error")).not.toBeInTheDocument();
  });

  it("PatientListPage shows error state with retry when API fails", async () => {
    mockGet.mockRejectedValue(new Error("API 500: boom"));

    render(
      <MemoryRouter initialEntries={["/patients"]}>
        <ToastProvider>
          <PatientListPage />
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId("patient-list-error")).toBeInTheDocument()
    );
    expect(screen.getByTestId("patient-list-error-retry")).toBeInTheDocument();
    expect(screen.queryByTestId("patient-list-empty")).not.toBeInTheDocument();
  });

  it("PatientDetailPage shows error state with retry when API fails", async () => {
    mockGet.mockRejectedValue(new Error("API 500: boom"));

    render(
      <MemoryRouter initialEntries={["/patients/pat-1"]}>
        <ToastProvider>
          <Routes>
            <Route path="/patients/:id" element={<PatientDetailPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId("patient-detail-error")).toBeInTheDocument()
    );
    expect(screen.getByTestId("patient-detail-error-retry")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AllergyList editable gating
// ---------------------------------------------------------------------------
describe("AllergyList editable gating", () => {
  const allergies = [makeAllergy("a1", "Penicillin")];

  it("hides delete buttons and add form when editable={false}", () => {
    render(
      <ToastProvider>
        <AllergyList
          patientId="pat-1"
          allergies={allergies}
          onChange={() => {}}
          editable={false}
        />
      </ToastProvider>
    );

    // Chip still renders
    expect(screen.getByText("Penicillin")).toBeInTheDocument();
    // But no remove X button
    expect(
      screen.queryByRole("button", { name: /remove allergy/i })
    ).not.toBeInTheDocument();
    // And no add button
    expect(
      screen.queryByRole("button", { name: /add allergy/i })
    ).not.toBeInTheDocument();
  });

  it("shows delete buttons and add button when editable={true}", () => {
    render(
      <ToastProvider>
        <AllergyList
          patientId="pat-1"
          allergies={allergies}
          onChange={() => {}}
          editable={true}
        />
      </ToastProvider>
    );

    expect(
      screen.getByRole("button", { name: /remove allergy penicillin/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add allergy/i })
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// MedicationList editable gating
// ---------------------------------------------------------------------------
describe("MedicationList editable gating", () => {
  const medications = [makeMedication("m1", "Lisinopril")];

  it("hides edit/delete buttons and add form when editable={false}", () => {
    render(
      <ToastProvider>
        <MedicationList
          patientId="pat-1"
          medications={medications}
          onChange={() => {}}
          editable={false}
        />
      </ToastProvider>
    );

    expect(screen.getByText("Lisinopril")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /edit medication/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /remove medication/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add medication/i })
    ).not.toBeInTheDocument();
  });

  it("shows edit/delete buttons and add button when editable={true}", () => {
    render(
      <ToastProvider>
        <MedicationList
          patientId="pat-1"
          medications={medications}
          onChange={() => {}}
          editable={true}
        />
      </ToastProvider>
    );

    expect(
      screen.getByRole("button", { name: /edit medication lisinopril/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /remove medication lisinopril/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add medication/i })
    ).toBeInTheDocument();
  });
});

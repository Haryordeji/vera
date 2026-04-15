import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Patient, Allergy, Medication, PatientSummary } from "../lib/types";

// ---------------------------------------------------------------------------
// Hoisted mocks — stable references across renders
// ---------------------------------------------------------------------------
const { mockGet, mockPost, mockPut, mockDel, mockUploadFile, mockNavigate } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDel: vi.fn(),
  mockUploadFile: vi.fn(),
  mockNavigate: vi.fn(),
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

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { PatientProfile } from "../components/patient/PatientProfile";
import { AllergyList } from "../components/patient/AllergyList";
import { MedicationList } from "../components/patient/MedicationList";
import { PatientVisitHistory } from "../components/patient/PatientVisitHistory";
import PatientDetailPage from "../pages/PatientDetailPage";
import { ToastProvider } from "../components/ui/Toast";

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "patient-1",
    fullName: "Alice Example",
    dateOfBirth: "1990-05-15T00:00:00.000Z",
    mrn: "MRN-001",
    sex: "Female",
    heightCm: 165,
    eyeColor: "Brown",
    bloodType: "A+",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    allergies: [],
    medications: [],
    sessions: [],
    ...overrides,
  };
}

function makeAllergy(overrides: Partial<Allergy> = {}): Allergy {
  return {
    id: "allergy-1",
    patientId: "patient-1",
    name: "Penicillin",
    severity: "Severe",
    reaction: "Hives",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeMedication(overrides: Partial<Medication> = {}): Medication {
  return {
    id: "med-1",
    patientId: "patient-1",
    name: "Lisinopril",
    dosage: "10mg",
    frequency: "Once daily",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeVisit(overrides: Partial<PatientSummary> = {}): PatientSummary {
  return {
    id: "session-1",
    status: "COMPLETED",
    recordedAt: "2026-02-26T10:00:00.000Z",
    physician: { fullName: "Sarah Smith" },
    soapNote: { workflowStatus: "APPROVED" },
    ...overrides,
  };
}

function wrap(ui: React.ReactElement) {
  return (
    <MemoryRouter>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockPut.mockReset();
  mockDel.mockReset();
  mockUploadFile.mockReset();
  mockNavigate.mockReset();
});

// ---------------------------------------------------------------------------
// PatientProfile
// ---------------------------------------------------------------------------
describe("PatientProfile", () => {
  it("renders all demographic fields", () => {
    render(wrap(<PatientProfile patient={makePatient()} onUpdated={() => {}} />));

    expect(screen.getByText("Alice Example")).toBeInTheDocument();
    expect(screen.getByText("MRN-001")).toBeInTheDocument();
    expect(screen.getByText("Female")).toBeInTheDocument();
    expect(screen.getByText("165 cm")).toBeInTheDocument();
    expect(screen.getByText("Brown")).toBeInTheDocument();
    expect(screen.getByText("A+")).toBeInTheDocument();
  });

  it("renders em-dash for missing fields", () => {
    render(
      wrap(
        <PatientProfile
          patient={makePatient({
            dateOfBirth: null,
            mrn: null,
            sex: null,
            heightCm: null,
            eyeColor: null,
            bloodType: null,
          })}
          onUpdated={() => {}}
        />
      )
    );
    // DOB, MRN, sex, height, eye color, blood type all show "—"
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBe(6);
  });

  it("switches to edit mode and saves via PUT", async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    mockPut.mockResolvedValue(makePatient({ fullName: "Alice Updated" }));

    render(wrap(<PatientProfile patient={makePatient()} onUpdated={onUpdated} />));

    await user.click(screen.getByRole("button", { name: /edit profile/i }));
    expect(screen.getByTestId("patient-profile-edit")).toBeInTheDocument();

    const name = screen.getByLabelText("Full name") as HTMLInputElement;
    await user.clear(name);
    await user.type(name, "Alice Updated");

    await user.click(screen.getByRole("button", { name: /^save/i }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        "/patients/patient-1",
        expect.objectContaining({ fullName: "Alice Updated" })
      );
    });
    expect(onUpdated).toHaveBeenCalled();
  });

  it("cancel button exits edit mode without calling PUT", async () => {
    const user = userEvent.setup();
    render(wrap(<PatientProfile patient={makePatient()} onUpdated={() => {}} />));

    await user.click(screen.getByRole("button", { name: /edit profile/i }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByTestId("patient-profile-edit")).not.toBeInTheDocument();
    expect(mockPut).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AllergyList
// ---------------------------------------------------------------------------
describe("AllergyList", () => {
  it("renders allergies with severity color coding via data-severity", () => {
    const allergies = [
      makeAllergy({ id: "a1", name: "Penicillin", severity: "Severe" }),
      makeAllergy({ id: "a2", name: "Latex", severity: "Moderate" }),
      makeAllergy({ id: "a3", name: "Dust", severity: "Mild" }),
    ];
    render(wrap(<AllergyList patientId="patient-1" allergies={allergies} onChange={() => {}} />));

    expect(screen.getByText("Penicillin")).toBeInTheDocument();
    expect(screen.getByText("Latex")).toBeInTheDocument();
    expect(screen.getByText("Dust")).toBeInTheDocument();

    expect(screen.getByTestId("allergy-chip-a1").getAttribute("data-severity")).toBe("Severe");
    expect(screen.getByTestId("allergy-chip-a2").getAttribute("data-severity")).toBe("Moderate");
    expect(screen.getByTestId("allergy-chip-a3").getAttribute("data-severity")).toBe("Mild");
  });

  it("shows empty-state message when allergies is empty", () => {
    render(wrap(<AllergyList patientId="patient-1" allergies={[]} onChange={() => {}} />));
    expect(screen.getByText("No allergies recorded.")).toBeInTheDocument();
  });

  it("add form posts and calls onChange with the new allergy", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const created = makeAllergy({ id: "a-new", name: "Sulfa", severity: "Mild" });
    mockPost.mockResolvedValue(created);

    render(wrap(<AllergyList patientId="patient-1" allergies={[]} onChange={onChange} />));

    await user.click(screen.getByRole("button", { name: /add allergy/i }));
    await user.type(screen.getByLabelText("Allergy name"), "Sulfa");
    await user.selectOptions(screen.getByLabelText("Allergy severity"), "Mild");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/patients/patient-1/allergies",
        expect.objectContaining({ name: "Sulfa", severity: "Mild" })
      );
    });
    expect(onChange).toHaveBeenCalledWith([created]);
  });

  it("delete button calls DELETE and onChange with remaining list", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const allergies = [
      makeAllergy({ id: "a1", name: "Penicillin" }),
      makeAllergy({ id: "a2", name: "Latex" }),
    ];
    mockDel.mockResolvedValue(undefined);

    render(wrap(<AllergyList patientId="patient-1" allergies={allergies} onChange={onChange} />));

    await user.click(screen.getByRole("button", { name: /remove allergy penicillin/i }));

    await waitFor(() => {
      expect(mockDel).toHaveBeenCalledWith("/patients/patient-1/allergies/a1");
    });
    expect(onChange).toHaveBeenCalledWith([allergies[1]]);
  });
});

// ---------------------------------------------------------------------------
// MedicationList
// ---------------------------------------------------------------------------
describe("MedicationList", () => {
  it("renders medication name, dosage, and frequency", () => {
    render(
      wrap(
        <MedicationList
          patientId="patient-1"
          medications={[makeMedication()]}
          onChange={() => {}}
        />
      )
    );
    expect(screen.getByText("Lisinopril")).toBeInTheDocument();
    expect(screen.getByText(/10mg/)).toBeInTheDocument();
    expect(screen.getByText("Once daily")).toBeInTheDocument();
  });

  it("add form posts and calls onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const created = makeMedication({ id: "m-new", name: "Aspirin", dosage: "81mg", frequency: "Daily" });
    mockPost.mockResolvedValue(created);

    render(wrap(<MedicationList patientId="patient-1" medications={[]} onChange={onChange} />));

    await user.click(screen.getByRole("button", { name: /add medication/i }));
    await user.type(screen.getByLabelText("Medication name"), "Aspirin");
    await user.type(screen.getByLabelText("Medication dosage"), "81mg");
    await user.type(screen.getByLabelText("Medication frequency"), "Daily");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/patients/patient-1/medications",
        expect.objectContaining({ name: "Aspirin", dosage: "81mg", frequency: "Daily" })
      );
    });
    expect(onChange).toHaveBeenCalledWith([created]);
  });

  it("edit button opens form pre-filled and PUTs on save", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const med = makeMedication();
    const updated = { ...med, dosage: "20mg" };
    mockPut.mockResolvedValue(updated);

    render(wrap(<MedicationList patientId="patient-1" medications={[med]} onChange={onChange} />));

    await user.click(screen.getByRole("button", { name: /edit medication lisinopril/i }));

    const dosage = screen.getByLabelText("Medication dosage") as HTMLInputElement;
    expect(dosage.value).toBe("10mg");
    await user.clear(dosage);
    await user.type(dosage, "20mg");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        "/patients/patient-1/medications/med-1",
        expect.objectContaining({ dosage: "20mg" })
      );
    });
    expect(onChange).toHaveBeenCalledWith([updated]);
  });

  it("delete button calls DELETE and removes the row via onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const med = makeMedication();
    mockDel.mockResolvedValue(undefined);

    render(wrap(<MedicationList patientId="patient-1" medications={[med]} onChange={onChange} />));

    await user.click(screen.getByRole("button", { name: /remove medication lisinopril/i }));

    await waitFor(() => {
      expect(mockDel).toHaveBeenCalledWith("/patients/patient-1/medications/med-1");
    });
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

// ---------------------------------------------------------------------------
// PatientVisitHistory
// ---------------------------------------------------------------------------
describe("PatientVisitHistory", () => {
  it("renders visits with physician name and status badge", () => {
    const visits = [
      makeVisit({ id: "s1", physician: { fullName: "Sarah Smith" }, status: "COMPLETED" }),
      makeVisit({
        id: "s2",
        recordedAt: "2026-01-10T10:00:00.000Z",
        physician: { fullName: "James Lee" },
        status: "IN_REVIEW",
      }),
    ];
    render(wrap(<PatientVisitHistory patientId="patient-1" visits={visits} />));

    expect(screen.getByText("Dr. Sarah Smith")).toBeInTheDocument();
    expect(screen.getByText("Dr. James Lee")).toBeInTheDocument();
    expect(screen.getAllByTestId("status-badge").length).toBe(2);
  });

  it("shows empty state when visits is empty", () => {
    render(wrap(<PatientVisitHistory patientId="patient-1" visits={[]} />));
    expect(screen.getByText("No visits yet")).toBeInTheDocument();
  });

  it("shows SOAP workflow status pill when soapNote present", () => {
    const visits = [makeVisit({ id: "s1", soapNote: { workflowStatus: "APPROVED" } })];
    render(wrap(<PatientVisitHistory patientId="patient-1" visits={visits} />));
    expect(screen.getByTestId("visit-soap-s1")).toHaveTextContent("Approved");
  });

  it("Start New Visit button POSTs to /sessions and navigates", async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue({ id: "new-session" });

    render(wrap(<PatientVisitHistory patientId="patient-1" visits={[]} />));

    await user.click(screen.getByTestId("start-new-visit"));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/sessions", { patientId: "patient-1" });
    });
    expect(mockNavigate).toHaveBeenCalledWith("/visits/new-session");
  });

  it("clicking a visit row navigates to /visits/:id", async () => {
    const user = userEvent.setup();
    const visits = [makeVisit({ id: "s1" })];
    render(wrap(<PatientVisitHistory patientId="patient-1" visits={visits} />));

    await user.click(screen.getByTestId("visit-row-s1"));
    expect(mockNavigate).toHaveBeenCalledWith("/visits/s1");
  });
});

// ---------------------------------------------------------------------------
// PatientDetailPage — full two-column layout
// ---------------------------------------------------------------------------
describe("PatientDetailPage", () => {
  function renderPage(patientId = "patient-1") {
    return render(
      <MemoryRouter initialEntries={[`/patients/${patientId}`]}>
        <ToastProvider>
          <Routes>
            <Route path="/patients/:id" element={<PatientDetailPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );
  }

  it("fetches the patient and renders both columns", async () => {
    mockGet.mockResolvedValue(
      makePatient({
        allergies: [makeAllergy()],
        medications: [makeMedication()],
        sessions: [makeVisit()],
      })
    );

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith("/patients/patient-1");
    });

    // Both columns
    expect(screen.getByTestId("patient-detail-layout")).toBeInTheDocument();
    expect(screen.getByTestId("patient-detail-sticky")).toBeInTheDocument();

    // Left: visit history
    expect(screen.getByTestId("patient-visit-history")).toBeInTheDocument();
    expect(screen.getByText("Dr. Sarah Smith")).toBeInTheDocument();

    // Right: profile + allergies + medications
    expect(screen.getByTestId("patient-profile")).toBeInTheDocument();
    expect(screen.getByTestId("allergy-list")).toBeInTheDocument();
    expect(screen.getByTestId("medication-list")).toBeInTheDocument();
  });

  it("right column has sticky classes so the profile pins while the page scrolls", async () => {
    mockGet.mockResolvedValue(makePatient());

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(screen.getByTestId("patient-detail-sticky")).toBeInTheDocument();
    });

    const sticky = screen.getByTestId("patient-detail-sticky");
    expect(sticky.className).toContain("sticky");
  });

  it("shows patient-not-found when fetch returns nothing usable", async () => {
    mockGet.mockRejectedValue(new Error("404"));

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(screen.getByText("Patient not found")).toBeInTheDocument();
    });
  });
});

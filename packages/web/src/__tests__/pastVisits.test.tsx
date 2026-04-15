import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Session, SessionStatus, Patient } from "../lib/types";

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

import PastVisitsPage from "../pages/PastVisitsPage";
import { PhysicianFilter } from "../components/visit/PhysicianFilter";
import { ToastProvider } from "../components/ui/Toast";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const makePatient = (fullName: string, mrn: string | null = null): Patient => ({
  id: `pat-${fullName}`,
  fullName,
  dateOfBirth: null,
  mrn,
  sex: null,
  heightCm: null,
  eyeColor: null,
  bloodType: null,
  createdAt: "",
  updatedAt: "",
});

function makeSession(
  id: string,
  status: SessionStatus,
  patientName: string,
  physicianId: string,
  physicianName: string
): Session {
  return {
    id,
    physicianId,
    patientId: `pat-${patientName}`,
    status,
    recordedAt: "2026-04-10T10:00:00.000Z",
    audioFileUrl: null,
    createdAt: "2026-04-10T10:00:00.000Z",
    updatedAt: "2026-04-10T10:00:00.000Z",
    patient: makePatient(patientName),
    physician: {
      id: physicianId,
      clerkId: "",
      fullName: physicianName,
      email: "",
      credentials: null,
      createdAt: "",
      updatedAt: "",
    },
  };
}

const PHYSICIANS = [
  { id: "phys-smith", fullName: "Sarah Smith" },
  { id: "phys-lee", fullName: "James Lee" },
];

const ALL_SESSIONS: Session[] = [
  makeSession("s1", "COMPLETED", "Sarah Johnson", "phys-smith", "Sarah Smith"),
  makeSession("s2", "IN_REVIEW", "James Wilson", "phys-lee", "James Lee"),
  makeSession("s3", "COMPLETED", "Maria Garcia", "phys-smith", "Sarah Smith"),
];

/**
 * Dispatch mock GET responses based on URL:
 *   /physicians → PHYSICIANS
 *   /sessions?... → honors scope=all + optional search/physician/status filters
 */
function configureMockGet() {
  mockGet.mockImplementation((path: string) => {
    if (path === "/physicians") {
      return Promise.resolve(PHYSICIANS);
    }
    if (path.startsWith("/sessions")) {
      const url = new URL(`http://x${path}`);
      const search = url.searchParams.get("search")?.toLowerCase() ?? "";
      const physicianId = url.searchParams.get("physician");
      const status = url.searchParams.get("status");

      let rows = ALL_SESSIONS;
      if (physicianId) rows = rows.filter((s) => s.physicianId === physicianId);
      if (status) rows = rows.filter((s) => s.status === status);
      if (search) {
        rows = rows.filter(
          (s) =>
            s.patient?.fullName.toLowerCase().includes(search) ||
            s.patient?.mrn?.toLowerCase().includes(search)
        );
      }
      return Promise.resolve(rows);
    }
    return Promise.resolve([]);
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/visits"]}>
      <ToastProvider>
        <PastVisitsPage />
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
// PastVisitsPage
// ---------------------------------------------------------------------------
describe("PastVisitsPage", () => {
  it("fetches with scope=all on initial load", async () => {
    configureMockGet();
    renderPage();
    await waitFor(() => {
      expect(
        mockGet.mock.calls.some(([p]) => p === "/sessions?scope=all")
      ).toBe(true);
    });
  });

  it("renders visits from multiple physicians", async () => {
    configureMockGet();
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("past-visits-list")).toBeInTheDocument()
    );

    expect(screen.getByText("Sarah Johnson")).toBeInTheDocument();
    expect(screen.getByText("James Wilson")).toBeInTheDocument();
    expect(screen.getByText("Maria Garcia")).toBeInTheDocument();

    // Physician names on each card (rendered by VisitCard)
    const physicianTags = screen.getAllByTestId("visit-card-physician");
    const texts = physicianTags.map((el) => el.textContent);
    expect(texts).toContain("Dr. Sarah Smith");
    expect(texts).toContain("Dr. James Lee");
  });

  it("search input filters by patient name (debounced)", async () => {
    configureMockGet();
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("Sarah Johnson")).toBeInTheDocument());

    const searchBox = screen.getByLabelText("Search visits");
    await act(async () => {
      await user.type(searchBox, "Garcia");
    });

    // Advance the 300ms debounce
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    await waitFor(() => {
      expect(
        mockGet.mock.calls.some(([p]) => typeof p === "string" && p.includes("search=Garcia"))
      ).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByText("Maria Garcia")).toBeInTheDocument();
      expect(screen.queryByText("Sarah Johnson")).not.toBeInTheDocument();
      expect(screen.queryByText("James Wilson")).not.toBeInTheDocument();
    });
  });

  it("physician dropdown filters by selected physician", async () => {
    configureMockGet();
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("Sarah Johnson")).toBeInTheDocument());

    const physicianSelect = screen.getByTestId("physician-filter");
    await act(async () => {
      await user.selectOptions(physicianSelect, "phys-lee");
    });

    await waitFor(() => {
      expect(
        mockGet.mock.calls.some(([p]) => typeof p === "string" && p.includes("physician=phys-lee"))
      ).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByText("James Wilson")).toBeInTheDocument();
      expect(screen.queryByText("Sarah Johnson")).not.toBeInTheDocument();
      expect(screen.queryByText("Maria Garcia")).not.toBeInTheDocument();
    });
  });

  it("status dropdown filters by selected status", async () => {
    configureMockGet();
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("Sarah Johnson")).toBeInTheDocument());

    const statusSelect = screen.getByTestId("status-filter");
    await act(async () => {
      await user.selectOptions(statusSelect, "IN_REVIEW");
    });

    await waitFor(() => {
      expect(
        mockGet.mock.calls.some(([p]) => typeof p === "string" && p.includes("status=IN_REVIEW"))
      ).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByText("James Wilson")).toBeInTheDocument();
      expect(screen.queryByText("Sarah Johnson")).not.toBeInTheDocument();
      expect(screen.queryByText("Maria Garcia")).not.toBeInTheDocument();
    });
  });

  it("shows 'No visits match your search.' empty state when the API returns no results", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === "/physicians") return Promise.resolve(PHYSICIANS);
      return Promise.resolve([]);
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("past-visits-empty")).toBeInTheDocument()
    );
    expect(screen.getByText("No visits match your search.")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PhysicianFilter (standalone)
// ---------------------------------------------------------------------------
describe("PhysicianFilter", () => {
  it("renders physician names fetched from /api/physicians", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === "/physicians") return Promise.resolve(PHYSICIANS);
      return Promise.resolve([]);
    });

    render(
      <ToastProvider>
        <PhysicianFilter value={null} onChange={() => {}} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Dr. Sarah Smith")).toBeInTheDocument();
      expect(screen.getByText("Dr. James Lee")).toBeInTheDocument();
    });
    // Default "All Physicians" option is always present
    expect(screen.getByText("All Physicians")).toBeInTheDocument();
  });

  it("calls onChange with the selected physician id (and null for 'All')", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === "/physicians") return Promise.resolve(PHYSICIANS);
      return Promise.resolve([]);
    });
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <PhysicianFilter value={null} onChange={onChange} />
      </ToastProvider>
    );

    await waitFor(() => expect(screen.getByText("Dr. Sarah Smith")).toBeInTheDocument());

    const select = screen.getByTestId("physician-filter");
    await act(async () => {
      await user.selectOptions(select, "phys-smith");
    });
    expect(onChange).toHaveBeenLastCalledWith("phys-smith");

    await act(async () => {
      await user.selectOptions(select, "");
    });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Vitals } from "../lib/types";

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

import { VitalsForm } from "../components/vitals/VitalsForm";
import { VitalsDisplay } from "../components/vitals/VitalsDisplay";
import { ToastProvider } from "../components/ui/Toast";

function makeVitals(overrides: Partial<Vitals> = {}): Vitals {
  return {
    id: "vitals-1",
    sessionId: "session-1",
    weightKg: 72.5,
    bloodPressureSys: 120,
    bloodPressureDia: 80,
    heartRate: 72,
    temperatureC: 37.0,
    respiratoryRate: 16,
    oxygenSaturation: 98.5,
    recordedAt: "2026-04-14T10:00:00.000Z",
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
});

// ---------------------------------------------------------------------------
// VitalsForm
// ---------------------------------------------------------------------------
describe("VitalsForm", () => {
  it("renders all seven vital-sign inputs with correct types and ranges", () => {
    render(wrap(<VitalsForm sessionId="session-1" onSaved={() => {}} />));

    const weight = screen.getByTestId("vitals-input-weight") as HTMLInputElement;
    expect(weight.type).toBe("number");
    expect(weight.step).toBe("0.1");

    const bpSys = screen.getByTestId("vitals-input-bp-sys") as HTMLInputElement;
    expect(bpSys.min).toBe("60");
    expect(bpSys.max).toBe("250");

    const bpDia = screen.getByTestId("vitals-input-bp-dia") as HTMLInputElement;
    expect(bpDia.min).toBe("40");
    expect(bpDia.max).toBe("150");

    const hr = screen.getByTestId("vitals-input-hr") as HTMLInputElement;
    expect(hr.min).toBe("30");
    expect(hr.max).toBe("250");

    const temp = screen.getByTestId("vitals-input-temp") as HTMLInputElement;
    expect(temp.step).toBe("0.1");
    expect(temp.min).toBe("34");
    expect(temp.max).toBe("42");

    const rr = screen.getByTestId("vitals-input-rr") as HTMLInputElement;
    expect(rr.min).toBe("8");
    expect(rr.max).toBe("60");

    const spo2 = screen.getByTestId("vitals-input-spo2") as HTMLInputElement;
    expect(spo2.step).toBe("0.1");
    expect(spo2.min).toBe("70");
    expect(spo2.max).toBe("100");
  });

  it("unit labels render next to each input", () => {
    render(wrap(<VitalsForm sessionId="session-1" onSaved={() => {}} />));
    expect(screen.getByText("kg")).toBeInTheDocument();
    expect(screen.getAllByText("mmHg").length).toBe(2);
    expect(screen.getByText("bpm")).toBeInTheDocument();
    expect(screen.getByText("°C")).toBeInTheDocument();
    expect(screen.getByText("/min")).toBeInTheDocument();
    expect(screen.getByText("%")).toBeInTheDocument();
  });

  it("submits via POST and calls onSaved on new entry", async () => {
    const user = userEvent.setup();
    const saved = makeVitals();
    mockPost.mockResolvedValue(saved);
    const onSaved = vi.fn();

    render(wrap(<VitalsForm sessionId="session-1" onSaved={onSaved} />));

    await user.type(screen.getByTestId("vitals-input-hr"), "72");
    await user.type(screen.getByTestId("vitals-input-temp"), "37");
    await user.click(screen.getByTestId("vitals-save"));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/sessions/session-1/vitals",
        expect.objectContaining({ heartRate: 72, temperatureC: 37 })
      );
    });
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it("submits via PUT when initial vitals are provided", async () => {
    const user = userEvent.setup();
    const saved = makeVitals({ heartRate: 80 });
    mockPut.mockResolvedValue(saved);
    const onSaved = vi.fn();

    render(
      wrap(
        <VitalsForm
          sessionId="session-1"
          initial={makeVitals()}
          onSaved={onSaved}
        />
      )
    );

    const hr = screen.getByTestId("vitals-input-hr") as HTMLInputElement;
    expect(hr.value).toBe("72");

    await user.clear(hr);
    await user.type(hr, "80");
    await user.click(screen.getByTestId("vitals-save"));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        "/sessions/session-1/vitals",
        expect.objectContaining({ heartRate: 80 })
      );
    });
    expect(onSaved).toHaveBeenCalledWith(saved);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("sends null for empty fields", async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue(makeVitals());

    render(wrap(<VitalsForm sessionId="session-1" onSaved={() => {}} />));

    await user.type(screen.getByTestId("vitals-input-hr"), "70");
    await user.click(screen.getByTestId("vitals-save"));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/sessions/session-1/vitals",
        expect.objectContaining({
          heartRate: 70,
          weightKg: null,
          temperatureC: null,
          bloodPressureSys: null,
        })
      );
    });
  });
});

// ---------------------------------------------------------------------------
// VitalsDisplay
// ---------------------------------------------------------------------------
describe("VitalsDisplay", () => {
  it("renders values with units", () => {
    render(<VitalsDisplay vitals={makeVitals()} onEdit={() => {}} />);
    expect(screen.getByTestId("vitals-display-hr")).toHaveTextContent("72");
    expect(screen.getByTestId("vitals-display-hr")).toHaveTextContent("bpm");
    expect(screen.getByTestId("vitals-display-temp")).toHaveTextContent("37.0");
    expect(screen.getByTestId("vitals-display-temp")).toHaveTextContent("°C");
    expect(screen.getByTestId("vitals-display-spo2")).toHaveTextContent("98.5");
  });

  it("shows -- for null values and hides their unit", () => {
    render(
      <VitalsDisplay
        vitals={makeVitals({
          heartRate: null,
          temperatureC: null,
          oxygenSaturation: null,
        })}
        onEdit={() => {}}
      />
    );
    expect(screen.getByTestId("vitals-display-hr")).toHaveTextContent("--");
    expect(screen.getByTestId("vitals-display-temp")).toHaveTextContent("--");
    expect(screen.getByTestId("vitals-display-spo2")).toHaveTextContent("--");
    // Unit label should only appear when the value is present — HR unit should NOT render here
    expect(screen.getByTestId("vitals-display-hr").textContent).not.toContain("bpm");
  });

  it("classifies HR 110 as borderline (yellow) and HR 130 as critical (red)", () => {
    const { rerender } = render(
      <VitalsDisplay vitals={makeVitals({ heartRate: 110 })} onEdit={() => {}} />
    );
    expect(screen.getByTestId("vitals-display-hr").getAttribute("data-severity")).toBe(
      "borderline"
    );

    rerender(<VitalsDisplay vitals={makeVitals({ heartRate: 130 })} onEdit={() => {}} />);
    expect(screen.getByTestId("vitals-display-hr").getAttribute("data-severity")).toBe(
      "critical"
    );
  });

  it("classifies temp 38.5 as borderline and 39.5 as critical", () => {
    const { rerender } = render(
      <VitalsDisplay vitals={makeVitals({ temperatureC: 38.5 })} onEdit={() => {}} />
    );
    expect(screen.getByTestId("vitals-display-temp").getAttribute("data-severity")).toBe(
      "borderline"
    );

    rerender(
      <VitalsDisplay vitals={makeVitals({ temperatureC: 39.5 })} onEdit={() => {}} />
    );
    expect(screen.getByTestId("vitals-display-temp").getAttribute("data-severity")).toBe(
      "critical"
    );
  });

  it("classifies SpO2 93 as borderline and 88 as critical", () => {
    const { rerender } = render(
      <VitalsDisplay vitals={makeVitals({ oxygenSaturation: 93 })} onEdit={() => {}} />
    );
    expect(screen.getByTestId("vitals-display-spo2").getAttribute("data-severity")).toBe(
      "borderline"
    );

    rerender(
      <VitalsDisplay vitals={makeVitals({ oxygenSaturation: 88 })} onEdit={() => {}} />
    );
    expect(screen.getByTestId("vitals-display-spo2").getAttribute("data-severity")).toBe(
      "critical"
    );
  });

  it("classifies BP systolic 150 as borderline and 190 as critical", () => {
    const { rerender } = render(
      <VitalsDisplay vitals={makeVitals({ bloodPressureSys: 150 })} onEdit={() => {}} />
    );
    expect(screen.getByTestId("vitals-display-bp-sys").getAttribute("data-severity")).toBe(
      "borderline"
    );

    rerender(
      <VitalsDisplay vitals={makeVitals({ bloodPressureSys: 190 })} onEdit={() => {}} />
    );
    expect(screen.getByTestId("vitals-display-bp-sys").getAttribute("data-severity")).toBe(
      "critical"
    );
  });

  it("normal values render with data-severity=normal", () => {
    render(<VitalsDisplay vitals={makeVitals()} onEdit={() => {}} />);
    expect(screen.getByTestId("vitals-display-hr").getAttribute("data-severity")).toBe(
      "normal"
    );
    expect(screen.getByTestId("vitals-display-temp").getAttribute("data-severity")).toBe(
      "normal"
    );
    expect(screen.getByTestId("vitals-display-spo2").getAttribute("data-severity")).toBe(
      "normal"
    );
  });

  it("edit button calls onEdit", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<VitalsDisplay vitals={makeVitals()} onEdit={onEdit} />);
    await user.click(screen.getByTestId("vitals-edit"));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

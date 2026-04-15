import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { PageHeader } from "../components/layout/PageHeader";

function renderHeader(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("PageHeader", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it("renders the title", () => {
    renderHeader(<PageHeader title="Patient Detail" />);
    expect(screen.getByText("Patient Detail")).toBeInTheDocument();
  });

  it("renders the back button with label when backTo is provided", () => {
    renderHeader(
      <PageHeader title="Patient Detail" backTo="/patients" backLabel="Back to Patients" />
    );
    const back = screen.getByTestId("page-header-back");
    expect(back).toBeInTheDocument();
    expect(back).toHaveTextContent("Back to Patients");
  });

  it("does not render the back button when backTo is omitted", () => {
    renderHeader(<PageHeader title="Dashboard" />);
    expect(screen.queryByTestId("page-header-back")).not.toBeInTheDocument();
  });

  it("calls navigate with the path when back button with a path is clicked", async () => {
    const user = userEvent.setup();
    renderHeader(
      <PageHeader title="Patient Detail" backTo="/patients" backLabel="Back to Patients" />
    );
    await user.click(screen.getByTestId("page-header-back"));
    expect(mockNavigate).toHaveBeenCalledWith("/patients");
  });

  it("calls navigate(-1) when backTo is 'history'", async () => {
    const user = userEvent.setup();
    renderHeader(<PageHeader title="Active Visit" backTo="history" backLabel="Back" />);
    await user.click(screen.getByTestId("page-header-back"));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it("renders children as right-side actions", () => {
    renderHeader(
      <PageHeader title="Active Visit">
        <button data-testid="header-action">Action</button>
      </PageHeader>
    );
    expect(screen.getByTestId("header-action")).toBeInTheDocument();
  });
});

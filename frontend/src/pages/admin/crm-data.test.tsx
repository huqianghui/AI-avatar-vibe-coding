import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US", changeLanguage: vi.fn() },
  }),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock react-dropzone — capture onDrop callback for testing
let capturedOnDrop: ((files: File[]) => void) | null = null;
vi.mock("react-dropzone", () => ({
  useDropzone: vi.fn((opts: { onDrop?: (files: File[]) => void }) => {
    capturedOnDrop = opts?.onDrop ?? null;
    return {
      getRootProps: () => ({}),
      getInputProps: () => ({}),
      isDragActive: false,
    };
  }),
}));

// Mock the crm-import hooks
const mockUseLastCrmImport = vi.fn();
const mockUploadMutate = vi.fn();
const mockDownloadMutate = vi.fn();

vi.mock("@/hooks/use-crm-import", () => ({
  useLastCrmImport: (...args: unknown[]) => mockUseLastCrmImport(...args),
  useUploadCrmExcel: () => ({ mutate: mockUploadMutate, isPending: false }),
  useDownloadCrmTemplate: () => ({ mutate: mockDownloadMutate }),
}));

import CrmDataPage from "./crm-data";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <CrmDataPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const mockImportResult = {
  id: "log1",
  filename: "crm_data.xlsx",
  imported_by: "admin1",
  created_at: "2026-03-15T10:00:00Z",
  success_count: 10,
  skipped: [{ row: 3, reason: "missing email" }],
  unmatched: [{ row: 5, email: "foo@bar.com", reason: "no matching user" }],
};

describe("CrmDataPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnDrop = null;
    mockUseLastCrmImport.mockReturnValue({ data: null, isLoading: false });
  });

  it("renders page title and description", () => {
    renderPage();
    expect(screen.getByText("crmData.title")).toBeInTheDocument();
    expect(screen.getByText("crmData.description")).toBeInTheDocument();
  });

  it("renders empty state when no import has occurred", () => {
    mockUseLastCrmImport.mockReturnValue({ data: null, isLoading: false });
    renderPage();
    expect(screen.getByText("crmData.emptyTitle")).toBeInTheDocument();
    expect(screen.getByText("crmData.emptyBody")).toBeInTheDocument();
  });

  it("renders summary badges and result summary when import data exists", () => {
    mockUseLastCrmImport.mockReturnValue({ data: mockImportResult, isLoading: false });
    renderPage();
    expect(screen.getByText("crmData.resultSummary")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
  });

  it("upload button is disabled with no file selected, enabled after drop", async () => {
    renderPage();

    const uploadButton = screen.getByText("crmData.uploadButton").closest("button");
    expect(uploadButton).toBeDisabled();

    const fakeFile = new File(["fake-content"], "crm.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    expect(capturedOnDrop).not.toBeNull();
    act(() => {
      capturedOnDrop!([fakeFile]);
    });

    expect(await screen.findByText("crm.xlsx")).toBeInTheDocument();
    expect(uploadButton).not.toBeDisabled();
  });

  it("shows destructive header-error banner on 422 and hides result summary in same pass", async () => {
    const user = userEvent.setup();
    mockUseLastCrmImport.mockReturnValue({ data: mockImportResult, isLoading: false });
    mockUploadMutate.mockImplementation(
      (_data: unknown, opts: { onError?: (error: unknown) => void }) => {
        opts.onError?.({ response: { status: 422 } });
      },
    );
    renderPage();

    const fakeFile = new File(["fake-content"], "bad-headers.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    act(() => {
      capturedOnDrop!([fakeFile]);
    });

    const uploadButton = await screen.findByText("crmData.uploadButton");
    await user.click(uploadButton);

    expect(screen.getByText("crmData.headerErrorTitle")).toBeInTheDocument();
    expect(screen.getByText("crmData.headerErrorBody")).toBeInTheDocument();
    // Result summary card body must be mutually exclusive with the banner
    expect(screen.queryByText("crmData.resultSummary")).not.toBeInTheDocument();
  });
});

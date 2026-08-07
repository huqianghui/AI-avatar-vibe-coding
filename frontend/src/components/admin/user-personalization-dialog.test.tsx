import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { selectFluentOption } from "@/test/test-utils";
import type { AdminUser } from "@/api/users";
import type { PersonalizationSummary, UserPreference } from "@/api/user-preferences";

const translations: Record<string, string> = {
  "personalization.title": "个性化",
  "personalization.crmMatched": "已匹配 CRM 数据",
  "personalization.crmUnmatched": "未匹配 CRM 数据",
  "personalization.emptyTitle": "暂无偏好标签",
  "personalization.emptyBody": "在下方添加第一个标签",
  "personalization.categoryPlaceholder": "选择分类",
  "personalization.valuePlaceholder": "输入偏好内容",
  "personalization.add": "添加",
  "personalization.adding": "添加中…",
  "personalization.deleteTag": "删除标签",
  "personalization.deleteToast": "已删除标签「{{label}}」",
  "personalization.undo": "撤销",
  "personalization.category.communicationStyle": "沟通风格",
  "personalization.category.focusArea": "关注领域",
  "personalization.category.languagePreference": "语言偏好",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      let str = translations[key] ?? key;
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          str = str.replace(`{{${k}}}`, String(v));
        }
      }
      return str;
    },
  }),
}));

const mockToastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

let mockSummary: PersonalizationSummary = {
  crm_matched: false,
  customer_name: null,
  company: null,
  preferences: [],
};

const mockCreateMutate = vi.fn();
const mockDeleteMutate = vi.fn();

vi.mock("@/hooks/use-user-preferences", () => ({
  usePersonalizationSummary: () => ({ data: mockSummary }),
  useCreatePreference: () => ({ mutate: mockCreateMutate, isPending: false }),
  useDeletePreference: () => ({ mutate: mockDeleteMutate, isPending: false }),
  CATEGORY_OPTIONS: [
    { value: "communication_style", labelKey: "personalization.category.communicationStyle" },
    { value: "focus_area", labelKey: "personalization.category.focusArea" },
    { value: "language_preference", labelKey: "personalization.category.languagePreference" },
  ],
}));

import { UserPersonalizationDialog } from "./user-personalization-dialog";

const mockUser: AdminUser = {
  id: "u1",
  username: "john",
  email: "john@example.com",
  full_name: "John Doe",
  role: "user",
  is_active: true,
  preferred_language: "en",
  business_unit: "Oncology",
  created_at: "2026-01-01T00:00:00Z",
};

const matchedPreference: UserPreference = {
  id: "p1",
  user_id: "u1",
  category: "focus_area",
  value: "oncology",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function renderDialog() {
  return render(
    <FluentProvider theme={webLightTheme}>
      <UserPersonalizationDialog user={mockUser} open onOpenChange={vi.fn()} />
    </FluentProvider>,
  );
}

describe("UserPersonalizationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSummary = {
      crm_matched: false,
      customer_name: null,
      company: null,
      preferences: [],
    };
  });

  it("renders matched CRM status with customer/company, never crm_notes or contact_person", () => {
    mockSummary = {
      crm_matched: true,
      customer_name: "张三",
      company: "XX医院",
      preferences: [],
    };
    renderDialog();

    expect(screen.getByText("已匹配 CRM 数据")).toBeInTheDocument();
    expect(screen.getByText(/张三/)).toBeInTheDocument();
    expect(screen.getByText(/XX医院/)).toBeInTheDocument();
    expect(screen.queryByText(/crm_notes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/contact_person/i)).not.toBeInTheDocument();
  });

  it("renders unmatched CRM status with neutral (non-destructive) styling", () => {
    mockSummary = { crm_matched: false, customer_name: null, company: null, preferences: [] };
    renderDialog();

    const unmatchedText = screen.getByText("未匹配 CRM 数据");
    expect(unmatchedText).toBeInTheDocument();
    expect(unmatchedText.className).not.toMatch(/destructive|weakness/);
  });

  it("renders empty state when preferences is empty, with add-row still visible", () => {
    mockSummary = { crm_matched: false, customer_name: null, company: null, preferences: [] };
    renderDialog();

    expect(screen.getByText("暂无偏好标签")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("输入偏好内容")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加" })).toBeInTheDocument();
  });

  it("renders a chip per preference item", () => {
    mockSummary = {
      crm_matched: false,
      customer_name: null,
      company: null,
      preferences: [matchedPreference],
    };
    renderDialog();

    expect(screen.getByText(/关注领域.*oncology/)).toBeInTheDocument();
  });

  it("calls create-mutation with category and value when Add is clicked", async () => {
    const user = userEvent.setup({ delay: null });
    mockSummary = { crm_matched: false, customer_name: null, company: null, preferences: [] };
    renderDialog();

    await user.type(screen.getByPlaceholderText("输入偏好内容"), "oncology");
    const addButton = screen.getByRole("button", { name: "添加" });
    await selectFluentOption(user, "关注领域", () => !(addButton as HTMLButtonElement).disabled);
    await user.click(addButton);

    expect(mockCreateMutate).toHaveBeenCalledWith(
      { category: "focus_area", value: "oncology" },
      expect.anything(),
    );
  });

  it("disables Add button when category or value is empty", () => {
    mockSummary = { crm_matched: false, customer_name: null, company: null, preferences: [] };
    renderDialog();

    expect(screen.getByRole("button", { name: "添加" })).toBeDisabled();
  });

  it("deletes a chip via direct mutation without a blocking second dialog", async () => {
    const user = userEvent.setup({ delay: null });
    mockSummary = {
      crm_matched: false,
      customer_name: null,
      company: null,
      preferences: [matchedPreference],
    };
    renderDialog();

    const deleteButton = screen.getByTitle("删除标签");
    await user.click(deleteButton);

    expect(mockDeleteMutate).toHaveBeenCalledWith("p1", expect.anything());
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });
});

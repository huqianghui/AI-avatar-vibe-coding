import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const changeLanguageMock = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: changeLanguageMock, language: "en" },
  }),
}));

import { LanguageSwitcher } from "./language-switcher";

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    changeLanguageMock.mockClear();
  });

  it("renders the trigger button with switch language aria-label", () => {
    render(<LanguageSwitcher />);
    const button = screen.getByRole("button", { name: /switch language/i });
    expect(button).toBeInTheDocument();
  });

  it("opens dropdown and shows language options when trigger is clicked", async () => {
    render(<LanguageSwitcher />);
    const trigger = screen.getByRole("button", { name: /switch language/i });
    await userEvent.click(trigger);

    // Translation keys are rendered as-is by the mock
    expect(screen.getByText("lang.zhCN")).toBeInTheDocument();
    expect(screen.getByText("lang.enUS")).toBeInTheDocument();
    expect(screen.getByText("lang.esES")).toBeInTheDocument();
    expect(screen.getByText("lang.esMX")).toBeInTheDocument();
    expect(screen.getByText("lang.esUS")).toBeInTheDocument();
  });

  it("calls changeLanguage with zh-CN when Chinese option is clicked", async () => {
    render(<LanguageSwitcher />);
    const trigger = screen.getByRole("button", { name: /switch language/i });
    await userEvent.click(trigger);

    const zhOption = screen.getByText("lang.zhCN");
    await userEvent.click(zhOption);
    expect(changeLanguageMock).toHaveBeenCalledWith("zh-CN");
  });

  it("calls changeLanguage with en-US when English option is clicked", async () => {
    render(<LanguageSwitcher />);
    const trigger = screen.getByRole("button", { name: /switch language/i });
    await userEvent.click(trigger);

    const enOption = screen.getByText("lang.enUS");
    await userEvent.click(enOption);
    expect(changeLanguageMock).toHaveBeenCalledWith("en-US");
  });

  it("calls changeLanguage with es-ES when the es-ES option is clicked", async () => {
    render(<LanguageSwitcher />);
    const trigger = screen.getByRole("button", { name: /switch language/i });
    await userEvent.click(trigger);

    const esESOption = screen.getByText("lang.esES");
    await userEvent.click(esESOption);
    expect(changeLanguageMock).toHaveBeenCalledWith("es-ES");
  });

  it("calls changeLanguage with es-MX when the es-MX option is clicked", async () => {
    render(<LanguageSwitcher />);
    const trigger = screen.getByRole("button", { name: /switch language/i });
    await userEvent.click(trigger);

    const esMXOption = screen.getByText("lang.esMX");
    await userEvent.click(esMXOption);
    expect(changeLanguageMock).toHaveBeenCalledWith("es-MX");
  });

  it("calls changeLanguage with es-US when the es-US option is clicked", async () => {
    render(<LanguageSwitcher />);
    const trigger = screen.getByRole("button", { name: /switch language/i });
    await userEvent.click(trigger);

    const esUSOption = screen.getByText("lang.esUS");
    await userEvent.click(esUSOption);
    expect(changeLanguageMock).toHaveBeenCalledWith("es-US");
  });
});

/**
 * PersonaSwitcher tests (Phase 36, PERSONA-03).
 *
 * Presentational component -- receives `isAuthenticated`, `personas`,
 * `activePersonaId`, `onSwitch` as props (no internal data fetching), so
 * these tests exercise the trigger/menu/selection wiring directly without
 * needing a QueryClientProvider. `avatar-page.tsx` owns wiring the real
 * `useSelectedPersona()` / `useEnabledPersonas()` / `useSetSelectedPersona()`
 * hooks into these props.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonaSwitcher, type PersonaSwitcherPersona } from "./persona-switcher";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const PERSONAS: PersonaSwitcherPersona[] = [
  {
    id: "persona-lisa",
    name: "Lisa",
    character: "lisa",
    style: "casual-sitting",
    greeting: "Hi, I'm Lisa!",
  },
  {
    id: "persona-harry",
    name: "Harry",
    character: "harry",
    style: "casual",
    greeting: "Hey, I'm Harry!",
  },
];

describe("PersonaSwitcher", () => {
  it("renders null when isAuthenticated is false", () => {
    const { container } = render(
      <PersonaSwitcher
        isAuthenticated={false}
        personas={PERSONAS}
        activePersonaId={PERSONAS[0]!.id}
        onSwitch={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a trigger with the active persona's name and a chevron when authenticated", () => {
    render(
      <PersonaSwitcher
        isAuthenticated={true}
        personas={PERSONAS}
        activePersonaId="persona-harry"
        onSwitch={vi.fn()}
      />,
    );

    const trigger = screen.getByTestId("persona-switcher-trigger");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("Harry");
    expect(trigger.querySelector("svg")).toBeInTheDocument();
  });

  it("opening the menu lists every persona with a Check icon only on the active row", async () => {
    const user = userEvent.setup();
    render(
      <PersonaSwitcher
        isAuthenticated={true}
        personas={PERSONAS}
        activePersonaId="persona-lisa"
        onSwitch={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId("persona-switcher-trigger"));

    const lisaOption = screen.getByTestId("persona-switcher-option-persona-lisa");
    const harryOption = screen.getByTestId("persona-switcher-option-persona-harry");
    expect(lisaOption).toHaveTextContent("Lisa");
    expect(harryOption).toHaveTextContent("Harry");

    // Check icon renders inside the active row only.
    expect(lisaOption.querySelector('[data-testid="persona-switcher-check"]')).toBeInTheDocument();
    expect(
      harryOption.querySelector('[data-testid="persona-switcher-check"]'),
    ).not.toBeInTheDocument();
  });

  it("clicking a different row closes the menu immediately and calls onSwitch(personaId) exactly once", async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();
    render(
      <PersonaSwitcher
        isAuthenticated={true}
        personas={PERSONAS}
        activePersonaId="persona-lisa"
        onSwitch={onSwitch}
      />,
    );

    await user.click(screen.getByTestId("persona-switcher-trigger"));
    await user.click(screen.getByTestId("persona-switcher-option-persona-harry"));

    expect(onSwitch).toHaveBeenCalledTimes(1);
    expect(onSwitch).toHaveBeenCalledWith("persona-harry");
    expect(
      screen.queryByTestId("persona-switcher-option-persona-harry"),
    ).not.toBeInTheDocument();
  });

  it("clicking the already-active row does not call onSwitch", async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();
    render(
      <PersonaSwitcher
        isAuthenticated={true}
        personas={PERSONAS}
        activePersonaId="persona-lisa"
        onSwitch={onSwitch}
      />,
    );

    await user.click(screen.getByTestId("persona-switcher-trigger"));
    await user.click(screen.getByTestId("persona-switcher-option-persona-lisa"));

    expect(onSwitch).not.toHaveBeenCalled();
  });
});

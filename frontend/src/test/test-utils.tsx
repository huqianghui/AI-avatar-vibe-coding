import { render, screen, waitFor, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactElement, type ReactNode } from "react";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function AllProviders({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

/**
 * Select an option from the Fluent UI `Select` adapter (backed by Fluent
 * `Dropdown`) by its visible label.
 *
 * Under jsdom + a modal `Dialog` focus-trap, driving Fluent's `Dropdown`
 * synchronously with `userEvent` intermittently fails two ways: the OPEN click
 * is swallowed (listbox never expands) or the SELECT click lands a tick before
 * Fluent has wired its option handlers, so `onOptionSelect` never fires and the
 * selection silently no-ops. (Production is unaffected: real pointer timing
 * leaves gaps between open and click, and the app always mounts under
 * `FluentProvider` via `FluentThemeBridge`.)
 *
 * This helper defeats both races with a `waitFor` retry that performs exactly
 * one action per attempt — open the listbox when it is collapsed, otherwise
 * click the target option — giving each step its own tick, and stopping as soon
 * as `onCommitted` reports the selection landed. See Phase 40-06.
 *
 * IMPORTANT: set the `user` instance up with `userEvent.setup({ delay: null })`.
 * The default `delay: 0` inserts a real `setTimeout(0)` between every sub-event
 * of a click; under the full suite's 8-fork CPU contention the macrotask queue
 * is starved, so each `user.click` balloons to seconds and the retry budget
 * below is exhausted before a click lands. `delay: null` dispatches a click's
 * sub-events on a synchronous microtask chain, immune to that starvation, while
 * the 50ms real-time `waitFor` interval still lets effects flush between
 * attempts. This is what makes the two modal-Dialog select tests deterministic
 * in the full run (they passed in isolation regardless). See Phase 40-06.
 *
 * @param user       the `userEvent` instance driving the interaction
 *                   (create with `userEvent.setup({ delay: null })`)
 * @param optionName accessible name / visible text of the target option
 * @param onCommitted returns true once the selection has propagated (e.g. a
 *                    dependent control has enabled); the loop stops when true
 */
async function selectFluentOption(
  user: ReturnType<typeof userEvent.setup>,
  optionName: string | RegExp,
  onCommitted: () => boolean,
) {
  const combobox = screen.getByRole("combobox");
  // Under jsdom + a modal `Dialog` focus-trap, driving Fluent's `Dropdown`
  // synchronously produces two intermittent failure modes: (1) the click that
  // should OPEN the listbox is swallowed (`aria-expanded` stays "false", no
  // options render), and (2) the listbox opens but the click that should SELECT
  // the option lands a tick before Fluent wires its option handlers, so
  // `onOptionSelect` never fires. `waitFor` retries this callback, and each
  // retry performs exactly ONE action — open when closed, else click the target
  // option. Crucially the retries are frequent (50ms), so a swallowed SELECT is
  // followed by a re-open and a fresh SELECT a tick later, and those repeated
  // interleaved ticks are what let Fluent finish wiring its option handlers
  // before a click finally lands. We branch on `aria-expanded` (never
  // `{Escape}`, which would close the enclosing modal dialog) and stop as soon
  // as `onCommitted` reports the selection landed.
  await waitFor(
    async () => {
      if (onCommitted()) return;
      const expanded = combobox.getAttribute("aria-expanded") === "true";
      if (!expanded) {
        await user.click(combobox);
      } else {
        const option = screen.queryByRole("option", { name: optionName });
        if (option) await user.click(option);
      }
      if (!onCommitted()) {
        throw new Error(`Fluent option "${optionName}" has not committed yet`);
      }
    },
    // Generous timeout: under full-suite parallel load each `user.click` is far
    // slower (workers contend for CPU), so a tight budget starves the retry
    // loop of attempts. Stays within the per-test `testTimeout`.
    { timeout: 10_000, interval: 50 },
  );
}

export { renderWithProviders, createTestQueryClient, selectFluentOption };
export { render, screen, within, waitFor, act } from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";

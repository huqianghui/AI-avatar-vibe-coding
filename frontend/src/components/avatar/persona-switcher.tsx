/**
 * PersonaSwitcher (Phase 36, PERSONA-03) -- header dropdown letting a
 * logged-in user pick their active digital-human persona. Per
 * 36-UI-SPEC.md section 3: hidden entirely (not disabled) for anonymous
 * visitors, `DropdownMenu` (not a Sheet/Dialog) so it never registers as a
 * `<nav>` element (AVUI-01 chrome-absence assertion stays satisfied).
 *
 * Purely presentational -- receives `personas` / `activePersonaId` /
 * `onSwitch` as props rather than fetching its own data, so it has zero
 * TanStack Query dependency and can be unit-tested without a
 * QueryClientProvider. `avatar-page.tsx` owns wiring the real
 * `useEnabledPersonas()` / `useSelectedPersona()` / `useSetSelectedPersona()`
 * hooks into these props.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { AVATAR_CHARACTER_MAP, getAvatarInitials } from "@/data/avatar-characters";
import { cn } from "@/lib/utils";

/** The subset of `AvatarPersona` fields the switcher needs to render a row. */
export interface PersonaSwitcherPersona {
  id: string;
  name: string;
  character: string;
  style: string;
  greeting: string;
}

export interface PersonaSwitcherProps {
  /** Hidden entirely (returns `null`) when `false` -- anonymous visitors
   * never see this control (36-UI-SPEC.md section 3). */
  isAuthenticated: boolean;
  /** Every enabled persona (the menu's content). */
  personas: PersonaSwitcherPersona[];
  /** The caller's currently-resolved active persona id. */
  activePersonaId: string | null | undefined;
  /** Fired with the newly-selected persona's id. Never fired for the
   * already-active row (re-selecting it is a no-op, not a "switch"). */
  onSwitch: (personaId: string) => void;
  /** Disables the trigger while a switch is in flight (T-36-22: UX-layer
   * mitigation against rapid persona-switch spam). */
  disabled?: boolean;
}

/** 32px (or custom-sized) thumbnail circle with an image+onError fallback to
 * a gradient + initials, matching the admin persona-editor convention. */
function PersonaThumbnail({
  persona,
  className,
}: {
  persona: PersonaSwitcherPersona;
  className?: string;
}) {
  const [imageError, setImageError] = useState(false);
  const meta = AVATAR_CHARACTER_MAP.get(persona.character);
  const gradientClasses = meta?.gradientClasses ?? "from-gray-500 to-gray-700";

  if (imageError || !meta) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white",
          gradientClasses,
          className,
        )}
      >
        {getAvatarInitials(persona.name)}
      </div>
    );
  }

  return (
    <img
      src={meta.thumbnailUrl}
      alt={persona.name}
      onError={() => setImageError(true)}
      className={cn("shrink-0 rounded-full object-cover", className)}
    />
  );
}

export function PersonaSwitcher({
  isAuthenticated,
  personas,
  activePersonaId,
  onSwitch,
  disabled = false,
}: PersonaSwitcherProps) {
  const { t } = useTranslation("avatar");

  if (!isAuthenticated) return null;

  const activePersona = personas.find((p) => p.id === activePersonaId) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          data-testid="persona-switcher-trigger"
          className="h-auto gap-2 px-2 py-1 font-normal"
        >
          {activePersona ? (
            <>
              <PersonaThumbnail persona={activePersona} className="size-8" />
              <span className="text-sm">
                {activePersona.name}
                {activePersona.style ? (
                  <span className="text-muted-foreground">
                    {" · "}
                    {activePersona.style.replace(/-/g, " ")}
                  </span>
                ) : null}
              </span>
            </>
          ) : null}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("personaSwitcher.title")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {personas.map((persona) => {
          const isActive = persona.id === activePersona?.id;
          return (
            <DropdownMenuItem
              key={persona.id}
              data-testid={`persona-switcher-option-${persona.id}`}
              className="gap-2"
              onSelect={() => {
                if (!isActive) onSwitch(persona.id);
              }}
            >
              <PersonaThumbnail persona={persona} className="size-8" />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm">{persona.name}</span>
                {persona.style ? (
                  <span className="truncate text-xs text-muted-foreground">{persona.style}</span>
                ) : null}
              </div>
              {isActive ? (
                <Check
                  data-testid="persona-switcher-check"
                  className="ml-auto h-4 w-4 text-primary"
                />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
